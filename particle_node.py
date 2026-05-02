import numpy as np
import torch
import base64
import json
import re
from PIL import Image
import io
import server
from aiohttp import web


# --- API エンドポイント: フロントエンドからキャプチャ画像を受け取る ---

captured_images = {}  # node_id -> PIL Image（最後のキャプチャを保持し続ける）
input_images = {}    # node_id -> base64 PNG string（最新の入力画像）

_VALID_NODE_ID = re.compile(r'^[\w\-]{1,64}$')
_MAX_PAYLOAD_BYTES = 50 * 1024 * 1024  # 50MB


@server.PromptServer.instance.routes.post("/particle/capture")
async def particle_capture(request):
    if request.content_length is not None and request.content_length > _MAX_PAYLOAD_BYTES:
        return web.json_response({"status": "too_large"}, status=413)

    body = await request.read()  # 全チャンクを確実に読み切る
    if len(body) > _MAX_PAYLOAD_BYTES:
        return web.json_response({"status": "too_large"}, status=413)

    try:
        data = json.loads(body)
    except (json.JSONDecodeError, ValueError):
        return web.json_response({"status": "invalid_json"}, status=400)
    node_id = data.get("node_id", "default")

    if not _VALID_NODE_ID.match(str(node_id)):
        return web.json_response({"status": "invalid_node_id"}, status=400)

    image_data = data.get("image")  # base64 data URL
    bg_baked = data.get("bg_baked", False)  # 背景画像が PixiJS 側で合成済みか

    if image_data:
        # "data:image/png;base64,XXXX" から base64 部分を抽出
        match = re.match(r"data:image/\w+;base64,(.*)", image_data, re.DOTALL)
        if match:
            b64 = match.group(1)
            img_bytes = base64.b64decode(b64)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
            captured_images[node_id] = {"image": img, "bg_baked": bg_baked}

    return web.json_response({"status": "ok"})


@server.PromptServer.instance.routes.get("/particle/input/{node_id}")
async def particle_get_input(request):
    node_id = request.match_info["node_id"]
    if not _VALID_NODE_ID.match(str(node_id)):
        return web.json_response({"image": None})
    img = input_images.get(node_id)
    if img is None:
        return web.json_response({"image": None})
    return web.json_response({"image": img})


class ParticleRendererNode:
    """
    PixiJS パーティクルを Canvas に描画し、任意のタイミングで
    画像としてキャプチャして出力する ComfyUI カスタムノード。
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "particle_type": (["none", "smoke", "spark", "ray", "star_warp"],),
                "particle_color": ("COLOR", {"default": "#ffffff"}),
                "width": ("INT", {"default": 512, "min": 64, "max": 2048, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 2048, "step": 8}),
                "particle_count": ("INT", {"default": 200, "min": 10, "max": 2000, "step": 10}),
                "node_id": ("STRING", {"default": "particle_0"}),
            },
            "optional": {
                "image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "render"
    CATEGORY = "image/effects"
    OUTPUT_NODE = True

    def render(self, particle_type, particle_color, width, height, particle_count, node_id, image=None):
        # 最後にキャプチャされた画像を使用（消去しない → 手動実行でも同じ画像が返る）
        raw = captured_images.get(node_id, None)

        # 旧形式（PIL Image 直接）との後方互換
        if isinstance(raw, dict):
            particle_img = raw["image"].convert("RGBA")
            bg_baked     = raw.get("bg_baked", False)
        elif raw is not None:
            particle_img = raw.convert("RGBA")
            bg_baked     = False
        else:
            # 一度もキャプチャされていない場合は透明画像を返す
            particle_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            bg_baked     = False

        if image is not None:
            # 入力画像を JS 側が取得できるよう base64 で保存
            buf = io.BytesIO()
            Image.fromarray((image[0].cpu().numpy() * 255).astype(np.uint8), mode="RGB").save(buf, format="PNG")
            input_images[node_id] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        else:
            # 入力が切断されたらキャッシュをクリア（古い画像が背景に残るのを防ぐ）
            input_images.pop(node_id, None)

        if bg_baked:
            # 背景画像＋パーティクルがPixiJS側でフィルター込みで合成済み
            # → そのまま黒背景合成してRGB変換（Python側での再合成は行わない）
            black_bg = Image.new("RGBA", (particle_img.width, particle_img.height), (0, 0, 0, 255))
            black_bg.paste(particle_img, (0, 0), particle_img)
            result_pil = black_bg.convert("RGB")
        elif image is not None:
            # 入力画像にパーティクルをオーバーレイ（通常モード）
            # ComfyUI tensor: [B, H, W, C] float32 0-1
            bg_np = (image[0].cpu().numpy() * 255).astype(np.uint8)
            bg_pil = Image.fromarray(bg_np, mode="RGB").convert("RGBA")
            bg_pil = bg_pil.resize((particle_img.width, particle_img.height), Image.LANCZOS)
            bg_pil.paste(particle_img, (0, 0), particle_img)
            result_pil = bg_pil.convert("RGB")
        else:
            # プレビューの黒背景と見た目を合わせるため、黒背景に合成してからRGBに変換する
            black_bg = Image.new("RGBA", (width, height), (0, 0, 0, 255))
            black_bg.paste(particle_img, (0, 0), particle_img)
            result_pil = black_bg.convert("RGB")

        result_np = np.array(result_pil).astype(np.float32) / 255.0
        result_tensor = torch.from_numpy(result_np).unsqueeze(0)  # [1, H, W, 3]

        return (result_tensor,)

    @classmethod
    def IS_CHANGED(cls, node_id="particle_0", **kwargs):
        # キャプチャが存在するときだけ変化扱いにする
        # （毎回 time.time() にすると不要な再実行が多発するため）
        import hashlib
        raw = captured_images.get(node_id)
        if raw is None:
            return "no_capture"
        # 画像データのハッシュを返す → 内容が変わったときだけ再実行
        img = raw["image"] if isinstance(raw, dict) else raw
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return hashlib.md5(buf.getvalue(), usedforsecurity=False).hexdigest()


NODE_CLASS_MAPPINGS = {
    "ParticleRenderer": ParticleRendererNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ParticleRenderer": "Particle Renderer (PixiJS)",
}
