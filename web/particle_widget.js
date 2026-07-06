import { app } from "../../scripts/app.js";
import { openFilterLibrary } from "./filter_library.js";
import { t } from "./i18n.js";
import {
  loadPixiJS, loadPixiFilters,
  rgb01ToHex, evalGradient, inRect,
  createParticleSystem, makeFilterInstance, SCENE_WIDE_FILTERS,
} from "./particle_engine.js";

// ---- ボタンヘルパー (VRM Pose Editor 互換スタイル) ----
function makeSmallButton(label, bg, title = "") {
  const btn = document.createElement("button");
  btn.textContent = label;
  if (title) btn.title = title;
  btn.style.cssText =
    `padding:4px 10px;background:${bg};color:#fff;border:none;` +
    "border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold;" +
    "transition:opacity 0.15s;white-space:nowrap;";
  btn.addEventListener("mouseover", () => { btn.style.opacity = "0.8"; });
  btn.addEventListener("mouseout",  () => { btn.style.opacity = "1"; });
  return btn;
}


// ================================================================
// ノード拡張登録
// ================================================================
app.registerExtension({
  name: "ParticleRenderer",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "ParticleRenderer") return;

    // onNodeCreated が async だと await 中に LiteGraph が node.configure() を実行し
    // 保存値(null 含む)でウィジェット値が上書きされ MTB COLOR widget がクラッシュする。
    // そのため PIXI のロードをここで完了させ、onNodeCreated を同期関数にする。
    const PIXI = await loadPixiJS();
    await loadPixiFilters();

    const onNodeCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);
      const node = this;
      node.size = [560, 860];

      // ---- Offscreen Canvas ----
      const canvas = document.createElement("canvas");
      canvas.width=512; canvas.height=512;
      canvas.style.cssText="position:fixed;left:-9999px;top:-9999px;";
      document.body.appendChild(canvas);

      // PixiJS は ▶再生 ボタン押下時に初期化する（グラフ復元時の WebGL コンテキスト枯渇を防ぐため）
      let pixiApp = null;
      let scene = null;
      let particleLayer = null; // パーティクルのみのフィルター対象
      let filterWrapper = null; // BG+フィルタ ON 時のフィルター対象（scale.y 無し → フィルターパイプラインが正常動作）

      function initPixiApp(w, h) {
        if (pixiApp) return;
        pixiApp = new PIXI.Application({
          view: canvas,
          width: w,
          height: h,
          backgroundAlpha: 0,
          resolution: 1,
          autoStart: false,
          antialias: true,
        });
        // filterWrapper: Y反転なし → フィルターを適用しても座標系が崩れない
        filterWrapper = new PIXI.Container();
        pixiApp.stage.addChild(filterWrapper);
        scene = new PIXI.Container();
        scene.position.set(w / 2, h / 2);
        scene.scale.y = -1; // Y軸を反転してシーン座標系（上方向が正）にする
        filterWrapper.addChild(scene); // scene は filterWrapper の子
        particleLayer = new PIXI.Container();
        scene.addChild(particleLayer);
        currentW = w;
        currentH = h;
      }

      let particleSystems = [];
      let animating=false, animFrameId=null;
      let currentW=512, currentH=512;

      let filterSettings = node.properties?.filterSettings
        ? JSON.parse(JSON.stringify(node.properties.filterSettings))
        : { type: "none", params: {} };

      function saveFilterSettings() {
        node.properties = node.properties || {};
        node.properties.filterSettings = JSON.parse(JSON.stringify(filterSettings));
      }

      function applyFilter() {
        if (!scene || !particleLayer || !filterWrapper) return;
        // 全コンテナのフィルターをクリア
        filterWrapper.filters = [];
        filterWrapper.filterArea = null;
        particleLayer.filters = [];
        if (bgSprite) bgSprite.filters = [];
        if (pixiApp) { pixiApp.stage.filters = []; pixiApp.stage.filterArea = null; }
        const f = filterSettings.type;
        const p = filterSettings.params;
        if (!filterEnabled || f === "none" || !PIXI.filters) return;
        const type = node.widgets?.find(w => w.name === "particle_type")?.value ?? "smoke";

        // フィルターインスタンス生成は particle_engine.js に集約
        // （同一インスタンスの複数コンテナ割り当ては競合するため毎回新規生成）
        const makeFilter = () => makeFilterInstance(PIXI, f, p, { width: currentW, height: currentH });
        const SCENE_WIDE = SCENE_WIDE_FILTERS.has(f);

        try {
          if (type === "none" || SCENE_WIDE) {
            // particle_type=none / 全面エフェクト型: stage に適用
            const fil = makeFilter();
            if (!fil) return;
            pixiApp.stage.filters = [fil];
            const pad = fil.padding ?? 0;
            pixiApp.stage.filterArea = new PIXI.Rectangle(-pad, -pad, currentW + pad * 2, currentH + pad * 2);
          } else {
            // パーティクルレイヤーに適用（常に）
            const fil = makeFilter();
            if (!fil) return;
            particleLayer.filters = [fil];
            // BG+Filter: ON かつ bgSprite あり → 背景画像にも個別インスタンスで適用
            if (filterOnBg && bgSprite) {
              const filBg = makeFilter();
              if (filBg) bgSprite.filters = [filBg];
            }
          }
        } catch(e) {
          console.warn("[ParticleRenderer] applyFilter failed:", e);
        }
      }

      // ---- 背景色 ----
      let bgColorOn    = node.properties?.bgColorOn    ?? false;
      let bgColorValue = node.properties?.bgColorValue ?? "#1a1a2e";
      let bgColorRect  = null;

      function saveBgColorProps() {
        node.properties = node.properties || {};
        node.properties.bgColorOn    = bgColorOn;
        node.properties.bgColorValue = bgColorValue;
      }

      function applyBgColor() {
        if (!pixiApp || !filterWrapper) return;
        if (bgColorRect) {
          filterWrapper.removeChild(bgColorRect);
          bgColorRect.destroy();
          bgColorRect = null;
        }
        if (!bgColorOn) return;
        bgColorRect = new PIXI.Graphics();
        const hex = parseInt(bgColorValue.replace("#", ""), 16);
        bgColorRect.beginFill(hex, 1);
        bgColorRect.drawRect(0, 0, currentW, currentH);
        bgColorRect.endFill();
        filterWrapper.addChildAt(bgColorRect, 0);
      }

      // ---- バックグラウンド入力画像スプライト (particle_type="none" 時) ----
      let bgSprite = null;
      let _bgLoadToken = 0; // 競合防止: 最新のloadBackgroundSprite呼び出しを識別

      // ---- 背景画像フィルター適用フラグ ----
      let filterOnBg = node.properties?.filterOnBg ?? false;

      function saveFilterOnBg() {
        node.properties = node.properties || {};
        node.properties.filterOnBg = filterOnBg;
      }

      // ---- フィルター適用の ON/OFF（OFF で選択中フィルターを一時無効化） ----
      let filterEnabled = node.properties?.filterEnabled ?? true;

      function saveFilterEnabled() {
        node.properties = node.properties || {};
        node.properties.filterEnabled = filterEnabled;
      }

      // ---- カスタムパーティクルテクスチャ（複数） ----
      // 旧形式（particleTextureUrl）からの移行も onConfigure で処理
      let customParticleTextures = []; // [{url: string, name: string, tex: PIXI.Texture|null}]

      async function loadCustomTextures() {
        for (const item of customParticleTextures) {
          if (item.tex && !item.tex.destroyed) continue;
          if (!item.url || !item.url.startsWith("data:image/")) {
            item.tex = null;
            continue;
          }
          try {
            item.tex = await PIXI.Texture.fromURL(item.url);
          } catch(e) {
            console.warn("[ParticleRenderer] custom texture load failed:", e);
            item.tex = null;
          }
        }
      }

      function getLoadedTextures() {
        return customParticleTextures.map(t => t.tex).filter(t => t && !t.destroyed);
      }

      // ---- パーティクル回転・スケール・シェイプ ----
      let currentSize            = node.properties?.particleSize           ?? 5.0;
      let particleSpread         = node.properties?.particleSpread         ?? 1.0;
      let particleRotation       = node.properties?.particleRotation       ?? 0;
      let randomParticleRotation = node.properties?.randomParticleRotation ?? false;
      let randomParticleScale    = node.properties?.randomParticleScale    ?? false;
      let particleShapePreset    = node.properties?.particleShapePreset    ?? "default";
      let randomParticleShape    = node.properties?.randomParticleShape    ?? false;
      const _defMotionParams     = { turbulence: 0, turbFreq: 1, windX: 0, windY: 0, swirl: 0 };
      let particleMotionParams   = node.properties?.particleMotionParams
        ? { ..._defMotionParams, ...node.properties.particleMotionParams }
        : { ..._defMotionParams };
      let globalStrength         = node.properties?.globalStrength ?? 1.0;
      let starStretch            = node.properties?.starStretch    ?? 2.0;
      let currentBlendMode       = node.properties?.blendMode      ?? "default";
      let scatterMode            = node.properties?.scatterMode    ?? false;
      let particleCharSet        = node.properties?.particleCharSet ?? [];

      function saveScatterMode() {
        node.properties = node.properties || {};
        node.properties.scatterMode = scatterMode;
      }

      function saveParticleSettings() {
        node.properties = node.properties || {};
        node.properties.particleSize           = currentSize;
        node.properties.particleSpread         = particleSpread;
        node.properties.particleRotation       = particleRotation;
        node.properties.randomParticleRotation = randomParticleRotation;
        node.properties.randomParticleScale    = randomParticleScale;
        node.properties.particleShapePreset    = particleShapePreset;
        node.properties.randomParticleShape    = randomParticleShape;
        node.properties.particleMotionParams   = { ...particleMotionParams };
        node.properties.globalStrength         = globalStrength;
        node.properties.starStretch            = starStretch;
        node.properties.blendMode              = currentBlendMode;
        node.properties.particleCharSet        = particleCharSet;
      }

      async function loadBackgroundSprite() {
        // 既存の bgSprite を全て除去（二重追加を防ぐために filterWrapper の子も走査）
        if (filterWrapper) {
          const stale = filterWrapper.children.filter(c => c !== scene && c !== bgColorRect);
          for (const s of stale) { filterWrapper.removeChild(s); s.destroy(); }
        }
        bgSprite = null;

        const token = ++_bgLoadToken; // このロード固有のトークン

        const type = node.widgets?.find(w => w.name === "particle_type")?.value ?? "smoke";
        // "none" タイプ、または「BG+フィルタ」が ON のときに背景画像を読み込む
        if (type !== "none" && !filterOnBg) return;
        // image 入力が接続されていない場合はスプライトを読み込まない
        const imageInput = node.inputs?.find(inp => inp.name === "image");
        if (!imageInput?.link) return;
        const nodeId = node.widgets?.find(w => w.name === "node_id")?.value ?? "particle_0";
        let data;
        try {
          const res = await fetch(`/particle/input/${nodeId}`);
          data = await res.json();
        } catch (_) { return; }
        if (token !== _bgLoadToken) return; // より新しいロードが始まっていたら破棄
        if (!data.image) return;
        if (!filterWrapper) return;
        let tex;
        try { tex = await PIXI.Texture.fromURL(data.image); } catch(_) { return; }
        if (token !== _bgLoadToken) return; // テクスチャロード中に上書きされた場合
        if (!filterWrapper) return;
        bgSprite = new PIXI.Sprite(tex);
        bgSprite.width  = currentW;
        bgSprite.height = currentH;
        bgSprite.anchor.set(0.5);
        // filterWrapper は scale.y=-1 ではないのでスクリーン座標で配置する
        bgSprite.position.set(currentW / 2, currentH / 2);
        filterWrapper.addChildAt(bgSprite, 0); // filterWrapper の最背面（scene の後ろ）
      }

      // ---- 複数発生点 ----
      let emitters = (node.properties?.emitters)
        ? JSON.parse(JSON.stringify(node.properties.emitters))
        : [{ origin:{x:0,y:-50}, direction:Math.PI/2, arrowLenPx:80 }];
      let selectedEmitterIdx = 0;

      function saveEmitters() {
        node.properties = node.properties||{};
        node.properties.emitters = JSON.parse(JSON.stringify(emitters));
      }
      const getSelEm = () => emitters[Math.min(selectedEmitterIdx, emitters.length-1)];

      const ARROW_MIN=20, ARROW_MAX=200;
      const getStrength = em => 0.2+(em.arrowLenPx-ARROW_MIN)/(ARROW_MAX-ARROW_MIN)*2.8;

      // ---- カラーグラデーション ----
      let colorStops = (node.properties?.colorStops)
        ? JSON.parse(JSON.stringify(node.properties.colorStops))
        : [{pos:0.0,color:"#ffffff"},{pos:1.0,color:"#888888"}];
      let selectedStopIdx = 0;

      function saveColorStops() {
        node.properties = node.properties||{};
        node.properties.colorStops = JSON.parse(JSON.stringify(colorStops));
      }
      const gradientFn = t => evalGradient(colorStops,t);

      function syncColorWidget() {
        // 全ての particle_color ウィジェット（標準 + MTB）を同期する
        const col = colorStops[selectedStopIdx]?.color;
        const value = (typeof col === "string" && col.startsWith("#")) ? col : "#ffffff";
        node.widgets?.forEach(w => {
          if (w.name === "particle_color") w.value = value;
        });
        node.setDirtyCanvas(true,false);
      }

      // ---- レイアウト ----
      const PREVIEW_X=15, PREVIEW_MARGIN=8;
      const GRAD_TRACK_H=22, GRAD_HANDLE_H=20, GRAD_TOTAL_H=GRAD_TRACK_H+GRAD_HANDLE_H+4;
      const SLIDER_UI_H=26, EM_CTL_H=22, LABEL_H=18;

      function getWidgetsBottom() {
        if (!node.widgets||node.widgets.length===0) return 50;
        let maxY=50;
        for (const w of node.widgets) {
          if (w.last_y!=null) {
            const h=w.computeSize?w.computeSize(node.size[0])[1]:22;
            maxY=Math.max(maxY,w.last_y+h);
          }
        }
        return maxY;
      }

      const getGradBarY = () => getWidgetsBottom()+PREVIEW_MARGIN+LABEL_H;
      const getSizeBarY = () => getGradBarY()+GRAD_TOTAL_H+PREVIEW_MARGIN;
      const getEmCtlY   = () => getSizeBarY()+SLIDER_UI_H+PREVIEW_MARGIN;
      const getPreviewY = () => getEmCtlY()+EM_CTL_H+PREVIEW_MARGIN;
      const getPreviewW = () => node.size[0]-PREVIEW_X*2;
      // プレビュー領域はノード幅基準の正方形で固定（出力サイズを変えてもノード高さが変わらない）
      const getPreviewH = () => getPreviewW();
      // 固定プレビュー領域の内側に、出力の縦横比でフィットさせた表示矩形（レターボックス）
      function getViewRect() {
        const pw=getPreviewW(), ph=getPreviewH(), py=getPreviewY();
        const wv = parseInt(node.widgets?.find(w => w.name === "width")?.value  ?? 512);
        const hv = parseInt(node.widgets?.find(w => w.name === "height")?.value ?? 512);
        const ar = wv/Math.max(1,hv);
        const w  = ar>=1 ? pw : Math.round(ph*ar);
        const h  = ar>=1 ? Math.round(pw/ar) : ph;
        return {x:PREVIEW_X+(pw-w)/2, y:py+(ph-h)/2, w, h};
      }

      // 動的ボタン矩形
      let plusBtnRect={x:0,y:0,w:24,h:16};
      let minusBtnRect={x:0,y:0,w:24,h:16};
      let emDelBtnRect={x:0,y:0,w:80,h:EM_CTL_H-4};
      let emResetBtnRect={x:0,y:0,w:60,h:EM_CTL_H-4};

      // ---- レンダラーリサイズ ----
      function resizeRenderer(w,h) {
        currentW=w; currentH=h;
        if (!pixiApp) return;
        pixiApp.renderer.resize(w,h);
        scene.position.set(w/2, h/2);
        if (bgColorRect) {
          bgColorRect.clear();
          const hex = parseInt(bgColorValue.replace("#", ""), 16);
          bgColorRect.beginFill(hex, 1);
          bgColorRect.drawRect(0, 0, w, h);
          bgColorRect.endFill();
        }
        if (bgSprite) { bgSprite.width = w; bgSprite.height = h; bgSprite.position.set(w / 2, h / 2); }
      }

      // ---- 座標変換（出力表示矩形 getViewRect 基準） ----
      function sceneToPreview(tx,ty) {
        const vr=getViewRect();
        return {x:vr.x+(tx/currentW+.5)*vr.w, y:vr.y+(.5-ty/currentH)*vr.h};
      }
      function previewToScene(px,py_) {
        const vr=getViewRect();
        return {x:((px-vr.x)/vr.w-.5)*currentW, y:(.5-(py_-vr.y)/vr.h)*currentH};
      }
      function clampToPreview(px,py_) {
        const vr=getViewRect();
        return {x:Math.max(vr.x,Math.min(vr.x+vr.w,px)), y:Math.max(vr.y,Math.min(vr.y+vr.h,py_))};
      }

      // ---- ブレンドモード適用 ----
      function applyBlendMode() {
        if (currentBlendMode === "default" || particleSystems.length === 0) return;
        const bm = PIXI.BLEND_MODES[currentBlendMode] ?? PIXI.BLEND_MODES.NORMAL;
        for (const ps of particleSystems) {
          for (const sprite of ps.particles) sprite.blendMode = bm;
        }
      }

      // ---- パーティクル再構築 ----
      function rebuildParticles(overrides = null) {
        for (const ps of particleSystems) ps.dispose();
        particleSystems = [];
        if (!scene || !pixiApp) return;
        const type  = node.widgets?.find(w=>w.name==="particle_type")?.value??"smoke";
        const total = parseInt(node.widgets?.find(w=>w.name==="particle_count")?.value??200);
        const countPerEm = type === "none" ? 0 : Math.max(10, Math.floor(total/emitters.length));

        // プレビューオーバーライド: nullなら通常設定を使用
        let _texsArr;
        if (overrides && overrides.textures !== undefined) {
          // item.tex があればそれを優先、なければ customParticleTextures から URL で照合
          const matched = (overrides.textures ?? [])
            .map(ot => ot.tex ?? customParticleTextures.find(ct => ct.url === ot.url)?.tex)
            .filter(t => t && !t.destroyed);
          _texsArr = matched.length > 0 ? matched : null;
        } else {
          const loaded = getLoadedTextures();
          _texsArr = loaded.length > 0 ? loaded : null;
        }
        const _size    = overrides?.size           ?? currentSize;
        const _rot     = overrides?.rotation       ?? particleRotation;
        const _randRot = overrides?.randomRotation ?? randomParticleRotation;
        const _randSc  = overrides?.randomScale    ?? randomParticleScale;
        const _shape   = overrides?.shapePreset    ?? particleShapePreset;
        const _randSh  = overrides?.randomShape    ?? randomParticleShape;
        const _motion  = overrides?.motionParams
          ? { ..._defMotionParams, ...overrides.motionParams }
          : particleMotionParams;
        const _spread  = overrides?.spread         ?? particleSpread;
        const _gs      = overrides?.globalStrength ?? globalStrength;
        const _stretch = overrides?.starStretch    ?? starStretch;

        for (const em of emitters) {
          particleSystems.push(createParticleSystem(
            type, particleLayer, PIXI, pixiApp.renderer, countPerEm, gradientFn,
            em.origin, em.direction, _size, getStrength(em) * _gs,
            _texsArr, _rot, _randRot, _randSc, _shape, _randSh, _motion, _spread, scatterMode, particleCharSet, _stretch
          ));
        }
        applyFilter();
        applyBlendMode();
      }

      // ---- キャプチャ送信 ----
      async function sendCapture() {
        if (!pixiApp) return;
        pixiApp.render();
        const dataUrl=canvas.toDataURL("image/png");
        const nodeId=node.widgets?.find(w=>w.name==="node_id")?.value??"particle_0";
        // bgSprite が存在する = 背景画像がPixiJS内に合成済み → Python側で再合成しない
        const bgBaked = bgSprite !== null;
        await fetch("/particle/capture",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({node_id:nodeId, image:dataUrl, bg_baked:bgBaked}),
        });
      }

      // ---- アニメーションループ ----
      let lastTime = 0;
      function animate(time) {
        if (!animating || !pixiApp) return;
        animFrameId = requestAnimationFrame(animate);
        if (!time) time = performance.now();
        const delta = lastTime === 0 ? 0.016 : (time - lastTime) / 1000.0;
        lastTime = time;
        const dt = Math.min(delta, 0.1);

        for (const ps of particleSystems) ps.update(dt);
        pixiApp.render();
        node.setDirtyCanvas(true,false);
      }

      // ================================================================
      // カラーストップ操作
      // ================================================================
      function addStop() {
        const s=[...colorStops].sort((a,b)=>a.pos-b.pos);
        let newPos=0.5;
        if (s.length>=2) {
          let maxGap=-1,gi=0;
          for (let i=0;i<s.length-1;i++) {
            const gap=s[i+1].pos-s[i].pos;
            if (gap>maxGap){maxGap=gap;gi=i;}
          }
          newPos=(s[gi].pos+s[gi+1].pos)/2;
        }
        const c=evalGradient(colorStops,newPos);
        colorStops.push({pos:newPos,color:rgb01ToHex(c)});
        selectedStopIdx=colorStops.length-1;
        syncColorWidget(); saveColorStops();
        if (animating) rebuildParticles();
        node.setDirtyCanvas(true,false);
      }

      function removeStop() {
        if (colorStops.length<=1) return;
        colorStops.splice(selectedStopIdx,1);
        selectedStopIdx=Math.max(0,Math.min(selectedStopIdx,colorStops.length-1));
        syncColorWidget(); saveColorStops();
        if (animating) rebuildParticles();
        node.setDirtyCanvas(true,false);
      }

      function selectStop(idx) {
        selectedStopIdx=idx; syncColorWidget();
      }

      function hitTestStop(mx,my) {
        const gradY=getGradBarY(),hy=gradY+GRAD_TRACK_H+1,pw=getPreviewW();
        for (let i=0;i<colorStops.length;i++) {
          const hx=PREVIEW_X+colorStops[i].pos*pw;
          if (Math.abs(mx-hx)<9&&my>=hy&&my<=hy+GRAD_HANDLE_H) return i;
        }
        return -1;
      }

      // ================================================================
      // エミッター操作
      // ================================================================
      function hitTestEmitter(mx,my) {
        for (let i=0;i<emitters.length;i++) {
          const p=sceneToPreview(emitters[i].origin.x,emitters[i].origin.y);
          if (Math.hypot(mx-p.x,my-p.y)<14) return i;
        }
        return -1;
      }

      function getSelDirHandle() {
        const em=getSelEm();
        const origin=sceneToPreview(em.origin.x,em.origin.y);
        return {
          origin,
          dir:{
            x:origin.x+Math.cos(em.direction)*em.arrowLenPx,
            y:origin.y-Math.sin(em.direction)*em.arrowLenPx,
          }
        };
      }

      // ================================================================
      // マウス操作
      // ================================================================
      let dragMode=null;

      node.onMouseDown=function(e,localPos) {
        if (e.button!==0) return false;
        const mx=localPos[0],my=localPos[1];
        const pw=getPreviewW(),ph=getPreviewH(),py=getPreviewY();
        const gradY=getGradBarY();

        if (inRect(mx,my,plusBtnRect))  { addStop();    return true; }
        if (inRect(mx,my,minusBtnRect)) { removeStop(); return true; }

        if (my>=gradY-2&&my<=gradY+GRAD_TOTAL_H) {
          const hitIdx=hitTestStop(mx,my);
          if (hitIdx>=0) {
            selectStop(hitIdx); dragMode="stop_move";
          } else if (my>=gradY&&my<=gradY+GRAD_TRACK_H) {
            let nearIdx=0,nearDist=Infinity;
            for (let i=0;i<colorStops.length;i++) {
              const d=Math.abs(mx-(PREVIEW_X+colorStops[i].pos*pw));
              if (d<nearDist){nearDist=d;nearIdx=i;}
            }
            selectStop(nearIdx);
          }
          return true;
        }

        const sbr={x:PREVIEW_X,y:getSizeBarY(),w:getPreviewW(),h:SLIDER_UI_H-4};
        if (inRect(mx,my,sbr)) {
          dragMode="size_slider";
          currentSize=1+Math.max(0,Math.min(1,(mx-sbr.x)/sbr.w))*19;
          if (animating) rebuildParticles();
          node.setDirtyCanvas(true,false);
          return true;
        }

        if (inRect(mx,my,emDelBtnRect)) {
          if (emitters.length>1) {
            emitters.splice(selectedEmitterIdx,1);
            selectedEmitterIdx=Math.max(0,Math.min(selectedEmitterIdx,emitters.length-1));
          } else {
            // 最後の1つは削除せず中央にリセット
            emitters[0].origin={x:0,y:0};
            selectedEmitterIdx=0;
          }
          saveEmitters();
          if (animating) rebuildParticles();
          node.setDirtyCanvas(true,false);
          return true;
        }

        if (inRect(mx,my,emResetBtnRect)) {
          emitters=[{origin:{x:0,y:0},direction:Math.PI/2,arrowLenPx:80}];
          selectedEmitterIdx=0;
          saveEmitters();
          if (animating) rebuildParticles();
          node.setDirtyCanvas(true,false);
          return true;
        }

        const {origin,dir}=getSelDirHandle();
        const onDirH=Math.hypot(mx-dir.x,my-dir.y)<16;
        const vr=getViewRect();
        const inPreview=mx>=vr.x&&mx<=vr.x+vr.w&&my>=vr.y&&my<=vr.y+vr.h;

        if (!inPreview&&!onDirH) return false;

        if (onDirH) { dragMode="direction"; return true; }

        const emHit=hitTestEmitter(mx,my);
        if (emHit>=0) {
          selectedEmitterIdx=emHit;
          dragMode="emitter_origin";
          node.setDirtyCanvas(true,false);
          return true;
        }

        if (inPreview) {
          emitters.push({
            origin:previewToScene(mx,my),
            direction:getSelEm().direction,
            arrowLenPx:getSelEm().arrowLenPx,
          });
          selectedEmitterIdx=emitters.length-1;
          saveEmitters();
          if (animating) rebuildParticles();
          dragMode="emitter_origin";
          node.setDirtyCanvas(true,false);
          return true;
        }
        return false;
      };

      node.onMouseMove=function(e,localPos) {
        if (dragMode===null) return false;
        const mx=localPos[0],my=localPos[1];

        if (dragMode==="stop_move") {
          colorStops[selectedStopIdx].pos=Math.max(0,Math.min(1,(mx-PREVIEW_X)/getPreviewW()));
          if (animating) rebuildParticles();
        } else if (dragMode==="emitter_origin") {
          const c=clampToPreview(mx,my);
          emitters[selectedEmitterIdx].origin=previewToScene(c.x,c.y);
          if (animating) rebuildParticles();
        } else if (dragMode==="direction") {
          const em=getSelEm();
          const origin=sceneToPreview(em.origin.x,em.origin.y);
          const dx=mx-origin.x,dy=origin.y-my,dist=Math.hypot(dx,dy);
          if (dist>2) {
            em.direction=Math.atan2(dy,dx);
            em.arrowLenPx=Math.max(ARROW_MIN,Math.min(ARROW_MAX,dist));
            if (animating) rebuildParticles();
          }
        } else if (dragMode==="size_slider") {
          const sbr={x:PREVIEW_X,y:getSizeBarY(),w:getPreviewW(),h:SLIDER_UI_H-4};
          currentSize=1+Math.max(0,Math.min(1,(mx-sbr.x)/sbr.w))*19;
          if (animating) rebuildParticles();
        }

        node.setDirtyCanvas(true,false);
        return true;
      };

      node.onMouseUp=function(){dragMode=null;return false;};

      // ================================================================
      // onDrawForeground
      // ================================================================
      node.onDrawForeground=function(ctx) {
        const pw=getPreviewW(),ph=getPreviewH(),py=getPreviewY();
        const gradY=getGradBarY(), sbY=getSizeBarY(), emCtlY=getEmCtlY();
        const labelY=gradY-LABEL_H;

        const requiredH=py+ph+16;
        if (node.size[1]!==requiredH) node.size[1]=requiredH;

        const btnW=24,btnH=16;
        plusBtnRect ={x:PREVIEW_X+pw-btnW*2-4,y:labelY+1,w:btnW,h:btnH};
        minusBtnRect={x:PREVIEW_X+pw-btnW   -2,y:labelY+1,w:btnW,h:btnH};

        ctx.fillStyle="#999"; ctx.font="11px sans-serif"; ctx.textBaseline="middle";
        ctx.fillText(t("colorRamp"),PREVIEW_X,labelY+btnH/2);

        ctx.fillStyle="#2a4a2a"; ctx.fillRect(plusBtnRect.x,plusBtnRect.y,plusBtnRect.w,plusBtnRect.h);
        ctx.strokeStyle="#4a8a4a"; ctx.lineWidth=1; ctx.strokeRect(plusBtnRect.x,plusBtnRect.y,plusBtnRect.w,plusBtnRect.h);
        ctx.fillStyle="#6f6"; ctx.font="bold 14px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("+",plusBtnRect.x+plusBtnRect.w/2,plusBtnRect.y+plusBtnRect.h/2);

        const canRm=colorStops.length>1;
        ctx.fillStyle=canRm?"#4a2a2a":"#222"; ctx.fillRect(minusBtnRect.x,minusBtnRect.y,minusBtnRect.w,minusBtnRect.h);
        ctx.strokeStyle=canRm?"#8a4a4a":"#333"; ctx.strokeRect(minusBtnRect.x,minusBtnRect.y,minusBtnRect.w,minusBtnRect.h);
        ctx.fillStyle=canRm?"#f88":"#555";
        ctx.fillText("−",minusBtnRect.x+minusBtnRect.w/2,minusBtnRect.y+minusBtnRect.h/2);
        ctx.textAlign="left";

        ctx.fillStyle="#1a1a1a"; ctx.fillRect(PREVIEW_X,gradY,pw,GRAD_TRACK_H);
        if (colorStops.length>0) {
          const sorted=[...colorStops].sort((a,b)=>a.pos-b.pos);
          const grd=ctx.createLinearGradient(PREVIEW_X,0,PREVIEW_X+pw,0);
          for (const s of sorted) grd.addColorStop(Math.max(0,Math.min(1,s.pos)),s.color);
          ctx.fillStyle=grd; ctx.fillRect(PREVIEW_X,gradY,pw,GRAD_TRACK_H);
        }
        ctx.strokeStyle="#555"; ctx.lineWidth=1; ctx.strokeRect(PREVIEW_X,gradY,pw,GRAD_TRACK_H);

        const hy=gradY+GRAD_TRACK_H+1;
        for (let i=0;i<colorStops.length;i++) {
          const s=colorStops[i],hx=PREVIEW_X+s.pos*pw,sel=i===selectedStopIdx;
          ctx.fillStyle=sel?"#fff":"#bbb";
          ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(hx-7,hy+14); ctx.lineTo(hx+7,hy+14); ctx.closePath(); ctx.fill();
          if (sel){ctx.strokeStyle="#ffdd00";ctx.lineWidth=1.5;ctx.stroke();}
          ctx.fillStyle=s.color; ctx.fillRect(hx-6,hy+14,12,5);
          ctx.strokeStyle="#333"; ctx.lineWidth=.5; ctx.strokeRect(hx-6,hy+14,12,5);
        }

        const sbr={x:PREVIEW_X,y:sbY,w:pw,h:SLIDER_UI_H-4};
        ctx.fillStyle="#2a2a2a"; ctx.fillRect(sbr.x,sbr.y,sbr.w,sbr.h);
        ctx.fillStyle="#4a7a9b"; ctx.fillRect(sbr.x,sbr.y,sbr.w*((currentSize-1)/19),sbr.h);
        ctx.fillStyle="#ccc"; ctx.font="12px sans-serif"; ctx.textBaseline="middle";
        ctx.fillText(`${t("size")}: ${currentSize.toFixed(1)}`,sbr.x+8,sbr.y+sbr.h/2);
        ctx.strokeStyle="#555"; ctx.lineWidth=1; ctx.strokeRect(sbr.x,sbr.y,sbr.w,sbr.h);

        emDelBtnRect={x:PREVIEW_X,y:emCtlY+2,w:80,h:EM_CTL_H-4};
        emResetBtnRect={x:PREVIEW_X+84,y:emCtlY+2,w:60,h:EM_CTL_H-4};

        // Delete Emitter ボタン（常にアクティブ / 1つのみの場合は中央リセット）
        ctx.fillStyle="#4a2a2a"; ctx.fillRect(emDelBtnRect.x,emDelBtnRect.y,emDelBtnRect.w,emDelBtnRect.h);
        ctx.strokeStyle="#8a4a4a"; ctx.lineWidth=1; ctx.strokeRect(emDelBtnRect.x,emDelBtnRect.y,emDelBtnRect.w,emDelBtnRect.h);
        ctx.fillStyle="#f88"; ctx.font="11px sans-serif"; ctx.textBaseline="middle"; ctx.textAlign="center";
        ctx.fillText(t("deleteEmitter"),emDelBtnRect.x+emDelBtnRect.w/2,emDelBtnRect.y+emDelBtnRect.h/2);

        // Reset ボタン（全削除→発生点1を中央に）
        ctx.fillStyle="#2a3a4a"; ctx.fillRect(emResetBtnRect.x,emResetBtnRect.y,emResetBtnRect.w,emResetBtnRect.h);
        ctx.strokeStyle="#3a6a8a"; ctx.strokeRect(emResetBtnRect.x,emResetBtnRect.y,emResetBtnRect.w,emResetBtnRect.h);
        ctx.fillStyle="#7abadb";
        ctx.fillText(t("resetEmitters"),emResetBtnRect.x+emResetBtnRect.w/2,emResetBtnRect.y+emResetBtnRect.h/2);
        ctx.textAlign="left";

        ctx.fillStyle="#888"; ctx.font="11px sans-serif";
        ctx.fillText(
          t("emitterStatus", emitters.length, selectedEmitterIdx+1),
          emResetBtnRect.x+emResetBtnRect.w+8, emCtlY+EM_CTL_H/2
        );

        // 固定プレビュー領域（レターボックス背景）+ 出力表示矩形
        const vr=getViewRect();
        ctx.fillStyle="#181818"; ctx.fillRect(PREVIEW_X,py,pw,ph);
        ctx.strokeStyle="#333"; ctx.lineWidth=1; ctx.strokeRect(PREVIEW_X,py,pw,ph);
        ctx.fillStyle="#111"; ctx.fillRect(vr.x,vr.y,vr.w,vr.h);
        try{ctx.drawImage(canvas,vr.x,vr.y,vr.w,vr.h);}catch(_){}
        ctx.strokeStyle="#555"; ctx.lineWidth=1; ctx.strokeRect(vr.x,vr.y,vr.w,vr.h);

        for (let i=0;i<emitters.length;i++) {
          const em=emitters[i];
          const p=sceneToPreview(em.origin.x,em.origin.y);
          if (p.x<vr.x||p.x>vr.x+vr.w||p.y<vr.y||p.y>vr.y+vr.h) continue;
          const sel=i===selectedEmitterIdx;
          const cr=10;
          ctx.strokeStyle=sel?"rgba(100,200,255,1)":"rgba(100,200,255,0.4)";
          ctx.lineWidth=sel?2:1;
          ctx.beginPath();
          ctx.moveTo(p.x-cr,p.y); ctx.lineTo(p.x+cr,p.y);
          ctx.moveTo(p.x,p.y-cr); ctx.lineTo(p.x,p.y+cr);
          ctx.stroke();
          ctx.strokeStyle=sel?"rgba(100,200,255,0.7)":"rgba(100,200,255,0.3)";
          ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle=sel?"rgba(100,200,255,1)":"rgba(100,200,255,0.5)";
          ctx.font=sel?"bold 10px sans-serif":"10px sans-serif";
          ctx.textBaseline="bottom"; ctx.fillText(String(i+1),p.x+8,p.y);
        }

        const {origin,dir}=getSelDirHandle();
        ctx.save();
        ctx.beginPath(); ctx.rect(vr.x,vr.y,vr.w,vr.h); ctx.clip();
        ctx.strokeStyle="rgba(255,220,50,0.85)"; ctx.lineWidth=2; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(origin.x,origin.y); ctx.lineTo(dir.x,dir.y); ctx.stroke();
        ctx.setLineDash([]);
        const ang=Math.atan2(dir.y-origin.y,dir.x-origin.x);
        ctx.strokeStyle="rgba(255,220,50,1)"; ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(dir.x,dir.y); ctx.lineTo(dir.x-10*Math.cos(ang-.45),dir.y-10*Math.sin(ang-.45));
        ctx.moveTo(dir.x,dir.y); ctx.lineTo(dir.x-10*Math.cos(ang+.45),dir.y-10*Math.sin(ang+.45));
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle="rgba(255,220,50,0.9)";
        ctx.beginPath(); ctx.arc(dir.x,dir.y,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="rgba(255,220,50,0.85)"; ctx.font="10px sans-serif"; ctx.textBaseline="bottom";
        ctx.fillText(`${t("strength")}: ${getStrength(getSelEm()).toFixed(1)}`,dir.x+9,dir.y);
      };

      // ================================================================
      // ボタン行 DOM ウィジェット (VRM Pose Editor 互換スタイル)
      // ================================================================
      const btnContainer = document.createElement("div");
      btnContainer.style.cssText =
        "display:flex;flex-direction:column;align-items:stretch;" +
        "background:#2c2c2c;padding:4px 6px;box-sizing:border-box;gap:4px;";

      // ---- 1行目: 再生・キャプチャ・背景色 ----
      const btnRow1 = document.createElement("div");
      btnRow1.style.cssText = "display:flex;gap:4px;align-items:center;flex-wrap:wrap;";

      const playBtn = makeSmallButton(t("play"), "#3a7a3a", t("playTitle"));
      playBtn.onclick = async () => {
        if (animating) return;
        const wv=parseInt(node.widgets?.find(w=>w.name==="width")?.value??512);
        const hv=parseInt(node.widgets?.find(w=>w.name==="height")?.value??512);
        initPixiApp(wv, hv);
        resizeRenderer(wv, hv);
        applyBgColor();
        if (customParticleTextures.some(t => !t.tex || t.tex.destroyed)) {
          await loadCustomTextures();
        }
        rebuildParticles();

        // filterOnBg=ON または type=none で image 接続がある場合は
        // queuePrompt で Python を先に実行し input_images を最新化してから背景を読む
        const _type = node.widgets?.find(w=>w.name==="particle_type")?.value??"smoke";
        const _hasImageLink = node.inputs?.find(inp=>inp.name==="image")?.link != null;
        if (_hasImageLink && (filterOnBg || _type === "none")) {
          await new Promise(resolve => {
            const timer = setTimeout(resolve, 8000); // 8秒でタイムアウト
            const prev = node.onExecuted;
            node.onExecuted = async function(data) {
              clearTimeout(timer);
              node.onExecuted = prev;
              await prev?.apply(this, arguments);
              resolve();
            };
            app.queuePrompt(0);
          });
        }

        await loadBackgroundSprite();
        applyFilter();
        animating=true; lastTime=0; requestAnimationFrame(animate);
      };

      const stopBtn = makeSmallButton(t("stopCapture"), "#4a90d9", t("stopCaptureTitle"));
      stopBtn.onclick = async () => {
        if (!animating) return;
        animating=false;
        cancelAnimationFrame(animFrameId);
        for (const ps of particleSystems) ps.update(0);
        try { await sendCapture(); app.queuePrompt(0); }
        catch(e) { console.error("[ParticleRenderer] capture failed:", e); }
      };

      const scatterBtn = makeSmallButton(scatterMode ? t("scatterModeOn") : t("scatterModeOff"), scatterMode ? "#8a4a8a" : "#333344", t("scatterModeTitle"));
      scatterBtn.onclick = () => {
        scatterMode = !scatterMode;
        scatterBtn.textContent = scatterMode ? t("scatterModeOn") : t("scatterModeOff");
        scatterBtn.style.background = scatterMode ? "#8a4a8a" : "#333344";
        saveScatterMode();
        if (animating) rebuildParticles();
      };

      // 背景色トグルボタン
      const bgToggleBtn = makeSmallButton(bgColorOn ? t("bgColor") : t("bgTransparent"), bgColorOn ? "#4a6a3a" : "#333344", t("bgColorToggleTitle"));

      // 背景カラーピッカー
      const bgColorInput = document.createElement("input");
      bgColorInput.type = "color";
      bgColorInput.value = bgColorValue;
      bgColorInput.title = t("bgColorPickerTitle");
      bgColorInput.style.cssText =
        "width:28px;height:26px;border:none;cursor:pointer;background:none;" +
        "padding:0;flex-shrink:0;border-radius:3px;";

      bgToggleBtn.onclick = () => {
        bgColorOn = !bgColorOn;
        bgToggleBtn.textContent = bgColorOn ? t("bgColor") : t("bgTransparent");
        bgToggleBtn.style.background = bgColorOn ? "#4a6a3a" : "#333344";
        saveBgColorProps();
        applyBgColor();
      };
      bgColorInput.addEventListener("input", () => {
        bgColorValue = bgColorInput.value;
        saveBgColorProps();
        if (bgColorOn) applyBgColor();
      });

      btnRow1.appendChild(playBtn);
      btnRow1.appendChild(stopBtn);
      btnRow1.appendChild(scatterBtn);

      // ---- 2行目: フィルタライブラリ（左）+ 背景色（右端）----
      const btnRow2 = document.createElement("div");
      btnRow2.style.cssText = "display:flex;gap:4px;align-items:center;justify-content:space-between;flex-wrap:wrap;";
      const btnRow2Left  = document.createElement("div");
      btnRow2Left.style.cssText  = "display:flex;gap:4px;align-items:center;";
      const btnRow2Right = document.createElement("div");
      btnRow2Right.style.cssText = "display:flex;gap:4px;align-items:center;";

      const filterLibBtn = makeSmallButton(t("settingBtn"), "#4a4a8a", t("filterLibraryTitle"));
      filterLibBtn.onclick = () => {
        openFilterLibrary({
          mainCanvas: canvas,
          filterSettings,
          particleSettings: {
            textures:       customParticleTextures.map(t => ({ url: t.url, name: t.name })),
            size:           currentSize,
            spread:         particleSpread,
            rotation:       particleRotation,
            randomRotation: randomParticleRotation,
            randomScale:    randomParticleScale,
            shapePreset:    particleShapePreset,
            randomShape:    randomParticleShape,
            motionParams:   { ...particleMotionParams },
            globalStrength: globalStrength,
            starStretch:    starStretch,
            charSet:        [...particleCharSet],
          },
          onPreview: settings => {
            filterSettings.type   = settings.type;
            filterSettings.params = settings.params;
            applyFilter();
            if (!animating && pixiApp) pixiApp.render();
            node.setDirtyCanvas(true, false);
          },
          onSave: (filterSets, particleSets) => {
            // フィルター設定
            filterSettings.type   = filterSets.type;
            filterSettings.params = filterSets.params;
            saveFilterSettings();
            applyFilter();

            // パーティクル設定
            const prevUrls = customParticleTextures.map(t => t.url).join(",");
            // URLが同じエントリは既存のロード済み tex を引き継ぐ（再ロード不要）
            customParticleTextures = (particleSets.textures ?? []).map(t => {
              const existing = customParticleTextures.find(ct => ct.url === t.url);
              return { url: t.url, name: t.name, tex: existing?.tex ?? null };
            });
            currentSize               = particleSets.size           ?? currentSize;
            particleSpread            = particleSets.spread         ?? 1.0;
            particleRotation          = particleSets.rotation       ?? 0;
            randomParticleRotation    = particleSets.randomRotation ?? false;
            randomParticleScale       = particleSets.randomScale    ?? false;
            particleShapePreset       = particleSets.shapePreset   ?? "default";
            randomParticleShape       = particleSets.randomShape   ?? false;
            particleMotionParams      = { ..._defMotionParams, ...(particleSets.motionParams ?? {}) };
            globalStrength            = particleSets.globalStrength ?? 1.0;
            starStretch               = particleSets.starStretch    ?? 2.0;
            particleCharSet           = particleSets.charSet ?? [];
            node.properties = node.properties || {};
            node.properties.particleTextures = customParticleTextures.map(t => ({ url: t.url, name: t.name }));
            delete node.properties.particleTextureUrl; // 旧形式を削除
            saveParticleSettings();

            const doRebuild = () => {
              if (animating) rebuildParticles();
              if (!animating && pixiApp) pixiApp.render();
              node.setDirtyCanvas(true, false);
            };
            const newUrls = customParticleTextures.map(t => t.url).join(",");
            if (newUrls !== prevUrls && pixiApp) {
              loadCustomTextures().then(doRebuild);
            } else {
              doRebuild();
            }
          },
          onParticlePreview: async (snap) => {
            if (!pixiApp) return;
            if (snap?.textures?.length) {
              // snap.textures の各アイテムに PIXI.Texture を付与（未ロード分は即時ロード）
              await Promise.all(snap.textures.map(async item => {
                const found = customParticleTextures.find(ct => ct.url === item.url);
                if (found?.tex && !found.tex.destroyed) { item.tex = found.tex; return; }
                if (item.url?.startsWith("data:image/")) {
                  try { item.tex = await PIXI.Texture.fromURL(item.url); } catch(_) {}
                }
              }));
            }
            rebuildParticles(snap);
            if (!animating) pixiApp.render();
            node.setDirtyCanvas(true, false);
          },
        });
      };
      // Setting ボタンは1行目（Scatter の右隣）に配置
      btnRow1.appendChild(filterLibBtn);

      // フィルター適用 ON/OFF トグル
      const filterToggleBtn = makeSmallButton(
        filterEnabled ? t("filterToggleOn") : t("filterToggleOff"),
        filterEnabled ? "#4a6a8a" : "#333344",
        t("filterToggleTitle")
      );
      filterToggleBtn.onclick = () => {
        filterEnabled = !filterEnabled;
        filterToggleBtn.textContent = filterEnabled ? t("filterToggleOn") : t("filterToggleOff");
        filterToggleBtn.style.background = filterEnabled ? "#4a6a8a" : "#333344";
        saveFilterEnabled();
        applyFilter();
        if (!animating && pixiApp) pixiApp.render();
        node.setDirtyCanvas(true, false);
      };
      btnRow2Left.appendChild(filterToggleBtn);

      // 背景画像＋パーティクルにまとめてフィルターを適用するトグル
      const filterOnBgBtn = makeSmallButton(
        filterOnBg ? t("bgFilterOn") : t("bgFilterOff"),
        filterOnBg ? "#4a4a8a" : "#333344",
        t("bgFilterTitle")
      );
      filterOnBgBtn.onclick = async () => {
        filterOnBg = !filterOnBg;
        filterOnBgBtn.textContent = filterOnBg ? t("bgFilterOn") : t("bgFilterOff");
        filterOnBgBtn.style.background = filterOnBg ? "#4a4a8a" : "#333344";
        saveFilterOnBg();
        if (pixiApp) await loadBackgroundSprite();
        applyFilter();
        if (!animating && pixiApp) pixiApp.render();
        node.setDirtyCanvas(true, false);
      };
      btnRow2Left.appendChild(filterOnBgBtn);

      // ブレンドモード ドロップダウン
      const blendModeSelect = document.createElement("select");
      blendModeSelect.title = t("blendMode");
      blendModeSelect.style.cssText =
        "background:#2a2a3a;color:#ccc;border:1px solid #555;border-radius:4px;" +
        "font-size:11px;padding:2px 4px;cursor:pointer;height:26px;";
      const BLEND_OPTIONS = [
        ["default",  t("blendDefault")],
        ["NORMAL",   t("blendNormal")],
        ["ADD",      t("blendAdd")],
        ["MULTIPLY", t("blendMultiply")],
        ["SCREEN",   t("blendScreen")],
      ];
      for (const [val, label] of BLEND_OPTIONS) {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = label;
        if (val === currentBlendMode) opt.selected = true;
        blendModeSelect.appendChild(opt);
      }
      blendModeSelect.addEventListener("change", () => {
        currentBlendMode = blendModeSelect.value;
        node.properties = node.properties || {};
        node.properties.blendMode = currentBlendMode;
        applyBlendMode();
        if (!animating && pixiApp) pixiApp.render();
        node.setDirtyCanvas(true, false);
      });
      btnRow2Left.appendChild(blendModeSelect);

      btnRow2Right.appendChild(bgToggleBtn);
      btnRow2Right.appendChild(bgColorInput);

      btnRow2.appendChild(btnRow2Left);
      btnRow2.appendChild(btnRow2Right);

      btnContainer.appendChild(btnRow1);
      btnContainer.appendChild(btnRow2);

      const domWidget = node.addDOMWidget("particle_btn_row", "particle_buttons", btnContainer, {
        serialize: false,
        getValue() { return null; },
        setValue() {},
      });
      domWidget.computeSize = function() {
        return [node.size[0] || 560, 72];
      };

      function hookWidgets() {
        node.widgets?.forEach(w=>{
          if (w.name==="particle_color") {
            const orig=w.callback;
            w.callback=function(value,...args) {
              orig?.call(this,value,...args);
              const col=(typeof value==="string"&&value.startsWith("#"))?value:w.value;
              if (typeof col==="string"&&col.startsWith("#")&&
                  selectedStopIdx>=0&&selectedStopIdx<colorStops.length) {
                colorStops[selectedStopIdx].color=col;
                saveColorStops();
                if (animating) rebuildParticles();
                syncColorWidget();
              }
            };
          }
          if (["particle_type","particle_count"].includes(w.name)) {
            const orig=w.callback;
            w.callback=(...args)=>{orig?.(...args);if(animating)rebuildParticles();};
          }
        });
        syncColorWidget();
      }
      // onNodeCreated が同期関数になったため setTimeout 不要。
      // ただし MTB の ensureColorWidgets は onNodeCreated チェーンの後半で動くため
      // queueMicrotask で一周待ってからフックする。
      queueMicrotask(hookWidgets);

      // グラフ復元後 (node.configure 完了時) に COLOR widget の null 値を修正する
      const origOnConfigure = node.onConfigure;
      node.onConfigure = function(data) {
        origOnConfigure?.apply(this, arguments);
        // properties が復元された後に colorStops と emitters を再同期
        if (node.properties?.colorStops) {
          colorStops = JSON.parse(JSON.stringify(node.properties.colorStops));
          for (let i = 0; i < colorStops.length; i++) {
            if (!colorStops[i]?.color) {
              if (colorStops[i]) colorStops[i].color = "#ffffff";
            }
          }
        }
        if (node.properties?.emitters) {
          emitters = JSON.parse(JSON.stringify(node.properties.emitters));
        }
        if (node.properties?.filterSettings) {
          filterSettings = JSON.parse(JSON.stringify(node.properties.filterSettings));
        }
        if (node.properties?.bgColorOn !== undefined) {
          bgColorOn    = node.properties.bgColorOn;
          bgColorValue = node.properties.bgColorValue ?? "#1a1a2e";
          bgColorInput.value = bgColorValue;
          bgToggleBtn.textContent = bgColorOn ? t("bgColor") : t("bgTransparent");
          bgToggleBtn.style.background = bgColorOn ? "#4a6a3a" : "#333344";
        }
        if (node.properties?.filterOnBg !== undefined) {
          filterOnBg = node.properties.filterOnBg;
          filterOnBgBtn.textContent = filterOnBg ? t("bgFilterOn") : t("bgFilterOff");
          filterOnBgBtn.style.background = filterOnBg ? "#4a4a8a" : "#333344";
        }
        if (node.properties?.filterEnabled !== undefined) {
          filterEnabled = node.properties.filterEnabled;
          filterToggleBtn.textContent = filterEnabled ? t("filterToggleOn") : t("filterToggleOff");
          filterToggleBtn.style.background = filterEnabled ? "#4a6a8a" : "#333344";
        }
        if (node.properties?.blendMode !== undefined) {
          currentBlendMode = node.properties.blendMode;
          blendModeSelect.value = currentBlendMode;
        }
        if (node.properties?.scatterMode !== undefined) {
          scatterMode = node.properties.scatterMode;
          scatterBtn.textContent = scatterMode ? t("scatterModeOn") : t("scatterModeOff");
          scatterBtn.style.background = scatterMode ? "#8a4a8a" : "#333344";
        }
        if (node.properties?.particleTextures !== undefined) {
          customParticleTextures = (node.properties.particleTextures ?? []).map(t => ({ ...t, tex: null }));
        } else if (node.properties?.particleTextureUrl) {
          // 旧形式からの移行
          customParticleTextures = [{ url: node.properties.particleTextureUrl, name: "texture", tex: null }];
        }
        if (node.properties?.particleSize !== undefined) {
          currentSize = node.properties.particleSize;
        }
        if (node.properties?.particleSpread !== undefined) {
          particleSpread = node.properties.particleSpread;
        }
        if (node.properties?.particleRotation !== undefined) {
          particleRotation = node.properties.particleRotation;
        }
        if (node.properties?.randomParticleRotation !== undefined) {
          randomParticleRotation = node.properties.randomParticleRotation;
        }
        if (node.properties?.randomParticleScale !== undefined) {
          randomParticleScale = node.properties.randomParticleScale;
        }
        if (node.properties?.particleShapePreset !== undefined) {
          particleShapePreset = node.properties.particleShapePreset;
        }
        if (node.properties?.randomParticleShape !== undefined) {
          randomParticleShape = node.properties.randomParticleShape;
        }
        if (node.properties?.particleMotionParams !== undefined) {
          particleMotionParams = { ..._defMotionParams, ...node.properties.particleMotionParams };
        }
        if (node.properties?.globalStrength !== undefined) {
          globalStrength = node.properties.globalStrength;
        }
        if (node.properties?.starStretch !== undefined) {
          starStretch = node.properties.starStretch;
        }
        if (node.properties?.particleCharSet !== undefined) {
          particleCharSet = node.properties.particleCharSet;
        }
        // COLOR widget の null 値を確実に修正する（標準 + MTB 両方）
        const col = colorStops[selectedStopIdx]?.color;
        node.widgets?.forEach(w => {
          if (w.name === "particle_color") {
            if (typeof col === "string" && col.startsWith("#")) {
              w.value = col;
            } else if (!w.value) {
              w.value = "#ffffff";
            }
          }
        });
      };

      // Python render() 完了後に background sprite をリロード
      // （onExecuted 時点で input_images[nodeId] が確実に更新済み）
      const origOnExecuted = node.onExecuted;
      node.onExecuted = async function(data) {
        origOnExecuted?.apply(this, arguments);
        const curType = node.widgets?.find(w => w.name === "particle_type")?.value ?? "smoke";
        if (pixiApp && (filterOnBg || curType === "none")) {
          await loadBackgroundSprite();
          applyFilter();
          if (!animating) pixiApp.render();
          node.setDirtyCanvas(true, false);
        }
      };

      // image 入力が切断されたら bgSprite を即時クリア
      const origOnConnectionsChange = node.onConnectionsChange;
      node.onConnectionsChange = function(type, slotIndex, isConnected) {
        origOnConnectionsChange?.apply(this, arguments);
        if (type === 1 && !isConnected && node.inputs?.[slotIndex]?.name === "image") {
          if (bgSprite && filterWrapper) {
            filterWrapper.removeChild(bgSprite);
            bgSprite.destroy();
            bgSprite = null;
          }
          if (pixiApp && !animating) pixiApp.render();
          node.setDirtyCanvas(true, false);
        }
      };

      const origOnRemoved=node.onRemoved;
      node.onRemoved=function(){
        origOnRemoved?.apply(this,arguments);
        animating=false;
        cancelAnimationFrame(animFrameId);
        for (const ps of particleSystems) ps.dispose();
        particleSystems=[];
        if (pixiApp) {
          pixiApp.destroy(true, { children: true });
          pixiApp = null;
          scene = null;
          particleLayer = null;
          filterWrapper = null;
          bgSprite = null; // destroy で破棄済み、参照だけクリア
        }
        canvas.remove();
      };
    };
  },
});
