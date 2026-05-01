import { app } from "../../scripts/app.js";
import { openFilterLibrary } from "./filter_library.js";
import { t } from "./i18n.js";

// ---- PixiJS CDN ロード ----
async function loadPixiJS() {
  if (window.PIXI) return window.PIXI;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js";
    script.onload = () => resolve(window.PIXI);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

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

// ---- pixi-filters v5 CDN ロード (PixiJS v7 対応) ----
async function loadPixiFilters() {
  if (window.PIXI?.filters?.GlowFilter) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // バージョンを固定して意図しないメジャー更新を防ぐ。
    // SRI ハッシュは `openssl dgst -sha512 -binary pixi-filters.min.js | openssl base64 -A` で生成し integrity 属性に追加すること。
    script.src = "https://cdn.jsdelivr.net/npm/pixi-filters@5.3.0/dist/browser/pixi-filters.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ---- カラーユーティリティ ----
function hexToRgb01(hex) {
  if (!hex || hex.length < 7) return { r: 1, g: 1, b: 1 };
  return {
    r: parseInt(hex.slice(1,3),16)/255,
    g: parseInt(hex.slice(3,5),16)/255,
    b: parseInt(hex.slice(5,7),16)/255,
  };
}
function rgb01ToHex(c) {
  const ch = v => Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,"0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
}
function lerpRgb(c1,c2,t) {
  return {r:c1.r+(c2.r-c1.r)*t, g:c1.g+(c2.g-c1.g)*t, b:c1.b+(c2.b-c1.b)*t};
}
function evalGradient(stops, t) {
  if (!stops||stops.length===0) return {r:1,g:1,b:1};
  const s=[...stops].sort((a,b)=>a.pos-b.pos);
  if (s.length===1)         return hexToRgb01(s[0].color);
  if (t<=s[0].pos)          return hexToRgb01(s[0].color);
  if (t>=s[s.length-1].pos) return hexToRgb01(s[s.length-1].color);
  for (let i=0;i<s.length-1;i++) {
    if (t>=s[i].pos&&t<=s[i+1].pos) {
      const lt=(t-s[i].pos)/(s[i+1].pos-s[i].pos);
      return lerpRgb(hexToRgb01(s[i].color),hexToRgb01(s[i+1].color),lt);
    }
  }
  return {r:1,g:1,b:1};
}

function inRect(mx,my,r) { return mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h; }

// ---- PIXI パーティクル用ベーステクスチャ生成 ----
// 将来的にはここで外部画像を読み込んで返すことで別タイプのパーティクルに対応可能
let baseParticleTexture = null;
function getParticleTexture(PIXI, renderer) {
  if (baseParticleTexture && !baseParticleTexture.destroyed) return baseParticleTexture;
  baseParticleTexture = null;
  // ぼかした白い円のグラデーションを作成
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255, 255, 255, 1)");
  grd.addColorStop(0.3, "rgba(255, 255, 255, 0.6)");
  grd.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  baseParticleTexture = PIXI.Texture.from(canvas);
  return baseParticleTexture;
}

// ---- プリセットシェイプテクスチャ ----
const PARTICLE_SHAPE_PRESETS = [
  "circle_outline", "circle_fill",
  "square_outline",  "square_fill",
  "triangle_outline","triangle_fill",
  "star_outline",    "star_fill",
];

const _shapeTexCache = {};

function _drawShape(ctx, shapeType) {
  const cx = 32, cy = 32, r = 26;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "white";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (shapeType) {
    case "circle_outline":
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      break;
    case "circle_fill":
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      break;
    case "square_outline":
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      break;
    case "square_fill":
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      break;
    case "triangle_outline": {
      const oy = r * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx,      cy - r);
      ctx.lineTo(cx + r,  cy + oy);
      ctx.lineTo(cx - r,  cy + oy);
      ctx.closePath(); ctx.stroke();
      break;
    }
    case "triangle_fill": {
      const oy = r * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx,      cy - r);
      ctx.lineTo(cx + r,  cy + oy);
      ctx.lineTo(cx - r,  cy + oy);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "star_outline":
    case "star_fill": {
      const pts = 5, outer = r, inner = r * 0.42;
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = (i * Math.PI / pts) - Math.PI / 2;
        const d = i % 2 === 0 ? outer : inner;
        i === 0 ? ctx.moveTo(cx + Math.cos(a)*d, cy + Math.sin(a)*d)
                : ctx.lineTo(cx + Math.cos(a)*d, cy + Math.sin(a)*d);
      }
      ctx.closePath();
      shapeType === "star_fill" ? ctx.fill() : ctx.stroke();
      break;
    }
  }
}

function getShapeTexture(PIXI, shapeType) {
  if (!shapeType || shapeType === "default") return getParticleTexture(PIXI);
  if (_shapeTexCache[shapeType] && !_shapeTexCache[shapeType].destroyed) {
    return _shapeTexCache[shapeType];
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  _drawShape(canvas.getContext("2d"), shapeType);
  _shapeTexCache[shapeType] = PIXI.Texture.from(canvas);
  return _shapeTexCache[shapeType];
}

// ================================================================
// パーティクルシステム基底 (PIXIJS)
// ================================================================
class ParticleSystem {
  constructor(scene, PIXI, renderer, count, gradientFn, origin, direction, particleSize, strength, customTextures = null, particleRotation = 0, randomParticleRotation = false, randomScale = false, shapePreset = "default", randomShape = false, motionParams = null, spread = 1.0) {
    this.PIXI = PIXI; this.scene = scene; this.renderer = renderer; this.count = count;
    this.gradientFn = gradientFn; this.origin = origin; this.direction = direction;
    this.particleSize = particleSize; this.strength = strength;
    this.particles = [];
    this.container = new PIXI.Container();
    this.scene.addChild(this.container);

    this.velocities = []; this.lifetimes = []; this.ages = []; this.scales = [];
    this.customTextures         = (customTextures && customTextures.length > 0) ? customTextures : null;
    this.particleRotation       = particleRotation;
    this.randomParticleRotation = randomParticleRotation;
    this.randomScale            = randomScale;
    this.shapePreset            = shapePreset;
    this.randomShape            = randomShape;
    this.motionParams           = motionParams || {};
    this.spread                 = spread;
    this.init();
  }
  init(){} update(delta){}
  dispose() {
    this.scene.removeChild(this.container);
    this.container.destroy({ children: true });
  }
  _getScale(targetPixelSize) {
    // base texture is 64x64
    return targetPixelSize / 64.0;
  }
  _setColorAndAlpha(i, t, alphaValue = 1.0) {
    const c = this.gradientFn(t);
    const sprite = this.particles[i];
    sprite.tint = (Math.round(c.r*255)<<16) | (Math.round(c.g*255)<<8) | Math.round(c.b*255);
    sprite.alpha = alphaValue;
  }
  _pickTex(i) {
    if (this.customTextures) {
      return this.customTextures[Math.floor(Math.random() * this.customTextures.length)];
    }
    if (this.randomShape) {
      return getShapeTexture(this.PIXI,
        PARTICLE_SHAPE_PRESETS[Math.floor(Math.random() * PARTICLE_SHAPE_PRESETS.length)]);
    }
    return getShapeTexture(this.PIXI, this.shapePreset);
  }

  _spawnAll(blendMode) {
    const baseRot = (this.particleRotation ?? 0) * Math.PI / 180;
    if (blendMode === undefined) blendMode = this.PIXI.BLEND_MODES.NORMAL;
    for (let i = 0; i < this.count; i++) {
      const sprite = new this.PIXI.Sprite(this._pickTex(i));
      sprite.anchor.set(0.5);
      sprite.blendMode = blendMode;
      sprite.rotation  = baseRot + ((this.randomParticleRotation ?? false) ? Math.random() * Math.PI * 2 : 0);
      this.scales[i]   = this.randomScale ? 0.5 + Math.random() * 1.0 : 1.0;
      this.container.addChild(sprite);
      this.particles.push(sprite);
      this._resetParticle(i);
      this.ages[i] = Math.random() * (this.lifetimes[i] || 1);
      this._setColorAndAlpha(i, this.ages[i] / (this.lifetimes[i] || 1));
    }
  }
  _applyMotion(sprite, i, delta) {
    const { turbulence = 0, turbFreq = 1, windX = 0, windY = 0, swirl = 0 } = this.motionParams;
    const age = this.ages[i] || 0;

    if (turbulence !== 0) {
      // 各パーティクルが異なる位相を持つよう黄金比・自然定数でオフセット
      sprite.position.x += Math.sin(age * turbFreq + i * 1.6180) * turbulence * delta * 60;
      sprite.position.y += Math.cos(age * turbFreq + i * 2.7183) * turbulence * delta * 60;
    }
    if (windX !== 0) sprite.position.x += windX * delta;
    if (windY !== 0) sprite.position.y += windY * delta;
    if (swirl !== 0) {
      const dx = sprite.position.x - this.origin.x;
      const dy = sprite.position.y - this.origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        sprite.position.x += (-dy / dist) * swirl * delta * 60;
        sprite.position.y += ( dx / dist) * swirl * delta * 60;
      }
    }
  }
}

// ---- 煙 ----
class SmokeSystem extends ParticleSystem {
  init() {
    for (let i=0;i<this.count;i++){this.velocities.push({x:0,y:0});this.lifetimes.push(0);this.ages.push(0);}
    this._spawnAll(this.PIXI.BLEND_MODES.NORMAL);
  }
  _resetParticle(i) {
    const sprite = this.particles[i];
    const ox=this.origin.x, oy=this.origin.y, dir=this.direction;
    sprite.position.set(ox+(Math.random()-.5)*40, oy+(Math.random()-.5)*12);
    
    const spd=(30+Math.random()*20)*this.strength, a=dir+(Math.random()-.5)*.5*(this.spread??1);
    this.velocities[i]={x:Math.cos(a)*spd*.3+(Math.random()-.5)*8, y:Math.sin(a)*spd};
    this.lifetimes[i]=3.0+Math.random()*2.0; this.ages[i]=0;
  }
  update(delta) {
    for (let i=0;i<this.count;i++) {
      this.ages[i]+=delta;
      if (this.ages[i]>this.lifetimes[i]){this._resetParticle(i);this._setColorAndAlpha(i,0);continue;}
      const t=this.ages[i]/this.lifetimes[i];
      const sprite = this.particles[i];
      sprite.position.x += this.velocities[i].x*delta;
      sprite.position.y += this.velocities[i].y*delta;
      sprite.position.x += Math.sin(this.ages[i]*2.5+i)*2*delta;
      this._applyMotion(sprite, i, delta);
      sprite.scale.set(this._getScale(this.particleSize*(18+t*12)) * (this.scales[i] ?? 1));
      this._setColorAndAlpha(i, t, 0.35);
    }
  }
}

// ---- 火花 ----
class SparkSystem extends ParticleSystem {
  init() {
    for (let i=0;i<this.count;i++){this.velocities.push({x:0,y:0});this.lifetimes.push(0);this.ages.push(0);}
    this._spawnAll(this.PIXI.BLEND_MODES.ADD);
  }
  _resetParticle(i) {
    const sprite = this.particles[i];
    const ox=this.origin.x, oy=this.origin.y;
    const angle=this.direction+(Math.random()-.5)*1.2*(this.spread??1);
    const speed=(40+Math.random()*120)*this.strength;
    sprite.position.set(ox+(Math.random()-.5)*10, oy+(Math.random()-.5)*10);
    this.velocities[i]={x:Math.cos(angle)*speed, y:Math.sin(angle)*speed};
    this.lifetimes[i]=.5+Math.random()*1.0; this.ages[i]=0;
    this.scales[i] = this.randomScale ? 0.5 + Math.random() * 1.0 : 1.0;
    sprite.scale.set(this._getScale(this.particleSize*4) * this.scales[i]);
  }
  update(delta) {
    const g=-180;
    for (let i=0;i<this.count;i++) {
      this.ages[i]+=delta;
      if (this.ages[i]>this.lifetimes[i]){this._resetParticle(i);this._setColorAndAlpha(i,0);continue;}
      const sprite = this.particles[i];
      sprite.position.x += this.velocities[i].x*delta;
      sprite.position.y += this.velocities[i].y*delta;
      this.velocities[i].y += g*delta;
      this._applyMotion(sprite, i, delta);
      this._setColorAndAlpha(i, this.ages[i]/this.lifetimes[i], 0.9);
    }
  }
}

// ---- 光線 ----
class RaySystem extends ParticleSystem {
  init() {
    for (let i=0;i<this.count;i++){this.velocities.push({x:0,y:0});this.lifetimes.push(0);this.ages.push(0);}
    this._spawnAll(this.PIXI.BLEND_MODES.ADD);
  }
  _resetParticle(i) {
    const sprite = this.particles[i];
    const ox=this.origin.x, oy=this.origin.y;
    const angle=this.direction+(Math.random()-.5)*.6*(this.spread??1);
    const speed=(60+Math.random()*140)*this.strength;
    sprite.position.set(ox, oy);
    this.velocities[i]={x:Math.cos(angle)*speed, y:Math.sin(angle)*speed};
    this.lifetimes[i]=.8+Math.random()*.8; this.ages[i]=0;
    this.scales[i] = this.randomScale ? 0.5 + Math.random() * 1.0 : 1.0;
    sprite.scale.set(this._getScale(this.particleSize*3) * this.scales[i]);
  }
  update(delta) {
    for (let i=0;i<this.count;i++) {
      this.ages[i]+=delta;
      if (this.ages[i]>this.lifetimes[i]){this._resetParticle(i);this._setColorAndAlpha(i,0);continue;}
      const t=this.ages[i]/this.lifetimes[i], fade=1-t;
      const sprite = this.particles[i];
      sprite.position.x += this.velocities[i].x*delta*fade;
      sprite.position.y += this.velocities[i].y*delta*fade;
      this._applyMotion(sprite, i, delta);
      this._setColorAndAlpha(i, t, 0.8 * fade);
    }
  }
}

// ---- スターワープ ----
class StarWarpSystem extends ParticleSystem {
  // constructor は定義しない。
  // ベースクラスの constructor が this.strength/particleSize 等を設定した後に
  // this.init() を呼ぶので、サブクラス固有の初期化は init() 内で行う。

  _randomizeStar(star, initial) {
    star.z = initial
      ? Math.random() * 2000
      : this.cameraZ + Math.random() * 1000 + 2000;
    const deg = Math.random() * Math.PI * 2;
    const d   = Math.random() * 50 + 1;
    star.x = Math.cos(deg) * d;
    star.y = Math.sin(deg) * d;
  }

  init() {
    // ベースコンストラクタが設定した this.strength / this.particleSize を使用
    this.cameraZ      = 0;
    this.speed        = 0;
    this.warpSpeed    = Math.max(0, Math.min(1, (this.strength - 0.2) / 2.8));
    this.fov          = 20;
    this.baseSpeed    = 0.025;
    // 512px キャンバス基準: 1920px 相当の元サンプルに合わせてストレッチを補正
    this.starStretch  = 2.0;
    this.starBaseSize = Math.max(0.02, this.particleSize * 0.005);
    this.stars        = [];

    for (let i = 0; i < this.count; i++) {
      const sprite = new this.PIXI.Sprite(this._pickTex(i));
      sprite.anchor.set(0.5, 0.7);
      sprite.blendMode = this.PIXI.BLEND_MODES.ADD;
      this.container.addChild(sprite);
      this.particles.push(sprite);
      const s = { z: 0, x: 0, y: 0 };
      this._randomizeStar(s, true);
      this.stars.push(s);
      this.scales[i] = this.randomScale ? 0.5 + Math.random() * 1.0 : 1.0;
    }
  }

  update(delta) {
    // speed をワープ速度にイージング（原作 PixiJS サンプルに準拠）
    this.speed += (this.warpSpeed - this.speed) / 20;
    // delta 秒 → cameraZ 移動量（600 = 10 * 60fps）
    this.cameraZ += delta * 600 * (this.speed + this.baseSpeed);

    const W     = this.renderer.width;
    const H     = this.renderer.height;
    const halfW = W / 2;
    const halfH = H / 2;

    for (let i = 0; i < this.count; i++) {
      const star   = this.stars[i];
      const sprite = this.particles[i];

      if (star.z < this.cameraZ) this._randomizeStar(star, false);

      const z = star.z - this.cameraZ;
      if (z <= 0) { sprite.visible = false; continue; }

      const distanceScale = Math.max(0, (2000 - z) / 2000);
      if (distanceScale <= 0) { sprite.visible = false; continue; }

      // 透視投影 → scene 座標（中心=0,0、Y上向き）
      const px = star.x * (this.fov / z) * W + this.origin.x;
      const py = -(star.y * (this.fov / z) * W) + this.origin.y;

      // キャンバス外に投影された星は非表示（巨大ストレッチを防ぐ）
      if (Math.abs(px) > halfW * 1.3 || Math.abs(py) > halfH * 1.3) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.position.set(px, py);

      // 消失点からの距離（ストレッチ量に使用）
      const dx   = px - this.origin.x;
      const dy   = py - this.origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const sf = this.scales[i] ?? 1;
      sprite.scale.x = distanceScale * this.starBaseSize * sf;
      sprite.scale.y = (distanceScale * this.starBaseSize
        + distanceScale * this.speed * this.starStretch * (dist / W)) * sf;

      // scene.scale.y=-1 を考慮した回転
      // 原作: atan2(dyCenter_canvas, dxCenter_canvas) + π/2
      // scene座標では dyCenter_canvas = -dy なので代入し
      // 恒等式 atan2(y,x)+π/2 = atan2(x,-y) を適用すると:
      //   atan2(-dy, dx) + π/2 = atan2(dx, -(-dy)) ... ← これは wrong
      // 直接導出: local -Y のキャンバス方向 = (sinθ, cosθ) を VP 外向き (dx,-dy) に合わせると
      //   sprite.rotation = Math.atan2(dx, -dy)
      sprite.rotation = Math.atan2(dx, -dy);

      this._applyMotion(sprite, i, delta);

      // カメラに近いほど明るく・グラデーション終端色
      this._setColorAndAlpha(i, distanceScale, distanceScale);
    }
  }
}

class NoneSystem extends ParticleSystem {
  init()       {}
  update(_dt)  {}
}

function createParticleSystem(type,scene,PIXI,renderer,count,gradientFn,origin,direction,size,strength,customTextures=null,particleRotation=0,randomParticleRotation=false,randomScale=false,shapePreset="default",randomShape=false,motionParams=null,spread=1.0) {
  const ex = [customTextures, particleRotation, randomParticleRotation, randomScale, shapePreset, randomShape, motionParams, spread];
  switch(type) {
    case "none":      return new NoneSystem     (scene,PIXI,renderer,0,    gradientFn,origin,direction,size,strength,...ex);
    case "smoke":     return new SmokeSystem    (scene,PIXI,renderer,count,gradientFn,origin,direction,size,strength,...ex);
    case "spark":     return new SparkSystem    (scene,PIXI,renderer,count,gradientFn,origin,direction,size,strength,...ex);
    case "ray":       return new RaySystem      (scene,PIXI,renderer,count,gradientFn,origin,direction,size,strength,...ex);
    case "star_warp": return new StarWarpSystem (scene,PIXI,renderer,count,gradientFn,origin,direction,size,strength,...ex);
    default:          return new SmokeSystem    (scene,PIXI,renderer,count,gradientFn,origin,direction,size,strength,...ex);
  }
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
        if (f === "none" || !PIXI.filters) return;
        const type = node.widgets?.find(w => w.name === "particle_type")?.value ?? "smoke";
        const PF = PIXI.filters;
        const hexColor = s => parseInt((s ?? "#ffffff").replace("#", ""), 16);

        // フィルターインスタンスを生成するファクトリ（呼ぶたびに新規インスタンスを返す）
        // 同一インスタンスを複数コンテナに割り当てると内部状態が競合するため毎回生成する
        function makeFilter() {
          switch (f) {
            case "glow":
              return new PF.GlowFilter({
                distance:      p.distance      ?? 15,
                outerStrength: p.outerStrength ?? 2,
                color:         hexColor(p.color),
              });
            case "bloom":
              return new PF.BloomFilter({
                blur:       p.blur       ?? 8,
                threshold:  p.threshold  ?? 0.1,
                bloomScale: p.brightness ?? 1,
              });
            case "kawaseBlur":
              return new PF.KawaseBlurFilter(p.blur ?? 4, p.quality ?? 3);
            case "pixelate":
              return new PF.PixelateFilter(p.size ?? 10);
            case "oldFilm":
              return new PF.OldFilmFilter({
                sepia:      p.sepia      ?? 0.5,
                noise:      p.noise      ?? 0.3,
                scratch:    p.scratch    ?? 0.4,
                vignetting: p.vignetting ?? 0.3,
              });
            case "crt":
              return new PF.CRTFilter({
                curvature:    p.curvature    ?? 3,
                lineWidth:    p.lineWidth    ?? 1,
                lineContrast: p.lineContrast ?? 0.25,
                vignetting:   p.vignetting   ?? 0.3,
              });
            case "dot":
              return new PF.DotFilter(p.scale ?? 1, p.angle ?? 5);
            case "dropShadow": {
              const fil = new PF.DropShadowFilter({
                offset: { x: p.offsetX ?? 4, y: p.offsetY ?? 4 },
                blur:   p.blur  ?? 2,
                alpha:  p.alpha ?? 0.5,
                color:  hexColor(p.color ?? "#000000"),
              });
              fil.padding = Math.ceil(
                Math.max(Math.abs(p.offsetX ?? 4), Math.abs(p.offsetY ?? 4)) + (p.blur ?? 2) * 2
              ) + 20;
              return fil;
            }
            case "motionBlur":
              return new PF.MotionBlurFilter(
                { x: p.velocityX ?? 0, y: p.velocityY ?? 0 },
                p.kernelSize ?? 5,
                p.offset     ?? 0
              );
            case "outline": {
              const fil = new PF.OutlineFilter(
                p.thickness ?? 1,
                hexColor(p.color ?? "#000000"),
                p.quality   ?? 0.1,
                p.alpha     ?? 1
              );
              fil.padding = Math.ceil(p.thickness ?? 1) * 2 + 4;
              return fil;
            }
            case "rgbSplit":
              return new PF.RGBSplitFilter(
                [p.redX  ?? -2, p.redY  ?? 0],
                [p.blueX ??  2, p.blueY ?? 0],
                [0, 0]
              );
            case "zoomBlur":
              return new PF.ZoomBlurFilter({
                strength:    p.strength    ?? 0.1,
                center:      { x: (p.centerX ?? 0.5) * currentW, y: (p.centerY ?? 0.5) * currentH },
                innerRadius: p.innerRadius ?? 0,
              });
            default: return null;
          }
        }

        try {
          if (type === "none") {
            // particle_type=none: particleLayer が空のため stage に適用
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

      // ---- 背景画像フィルター適用フラグ ----
      let filterOnBg = node.properties?.filterOnBg ?? false;

      function saveFilterOnBg() {
        node.properties = node.properties || {};
        node.properties.filterOnBg = filterOnBg;
      }

      // ---- カスタムパーティクルテクスチャ（複数） ----
      // 旧形式（particleTextureUrl）からの移行も onConfigure で処理
      let customParticleTextures = []; // [{url: string, name: string, tex: PIXI.Texture|null}]

      async function loadCustomTextures() {
        for (const item of customParticleTextures) {
          if (item.tex && !item.tex.destroyed) continue;
          if (!item.url || (!item.url.startsWith("data:image/") && !item.url.startsWith("/"))) {
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
      let currentBlendMode       = node.properties?.blendMode      ?? "default";

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
        node.properties.blendMode              = currentBlendMode;
      }

      async function loadBackgroundSprite() {
        if (bgSprite && filterWrapper) { filterWrapper.removeChild(bgSprite); bgSprite.destroy(); bgSprite = null; }
        else { bgSprite = null; }
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
        if (!data.image) return;
        if (!filterWrapper) return;
        let tex;
        try { tex = await PIXI.Texture.fromURL(data.image); } catch(_) { return; }
        if (!filterWrapper) return; // 非同期待機中に破棄された場合
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
      const getPreviewH = () => {
        const wv = parseInt(node.widgets?.find(w => w.name === "width")?.value  ?? 512);
        const hv = parseInt(node.widgets?.find(w => w.name === "height")?.value ?? 512);
        return Math.round(getPreviewW() * hv / Math.max(1, wv));
      };

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

      // ---- 座標変換 ----
      function sceneToPreview(tx,ty) {
        const pw=getPreviewW(),ph=getPreviewH(),py=getPreviewY();
        return {x:PREVIEW_X+(tx/currentW+.5)*pw, y:py+(.5-ty/currentH)*ph};
      }
      function previewToScene(px,py_) {
        const pw=getPreviewW(),ph=getPreviewH(),py=getPreviewY();
        return {x:((px-PREVIEW_X)/pw-.5)*currentW, y:(.5-(py_-py)/ph)*currentH};
      }
      function clampToPreview(px,py_) {
        const pw=getPreviewW(),ph=getPreviewH(),py=getPreviewY();
        return {x:Math.max(PREVIEW_X,Math.min(PREVIEW_X+pw,px)), y:Math.max(py,Math.min(py+ph,py_))};
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

        for (const em of emitters) {
          particleSystems.push(createParticleSystem(
            type, particleLayer, PIXI, pixiApp.renderer, countPerEm, gradientFn,
            em.origin, em.direction, _size, getStrength(em) * _gs,
            _texsArr, _rot, _randRot, _randSc, _shape, _randSh, _motion, _spread
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
        const inPreview=mx>=PREVIEW_X&&mx<=PREVIEW_X+pw&&my>=py&&my<=py+ph;

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

        ctx.fillStyle="#111"; ctx.fillRect(PREVIEW_X,py,pw,ph);
        ctx.strokeStyle="#444"; ctx.lineWidth=1; ctx.strokeRect(PREVIEW_X,py,pw,ph);
        try{ctx.drawImage(canvas,PREVIEW_X,py,pw,ph);}catch(_){}

        for (let i=0;i<emitters.length;i++) {
          const em=emitters[i];
          const p=sceneToPreview(em.origin.x,em.origin.y);
          if (p.x<PREVIEW_X||p.x>PREVIEW_X+pw||p.y<py||p.y>py+ph) continue;
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
        ctx.beginPath(); ctx.rect(PREVIEW_X,py,pw,ph); ctx.clip();
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
      btnRow1.appendChild(bgToggleBtn);
      btnRow1.appendChild(bgColorInput);

      // ---- 2行目: フィルタライブラリ + 将来の機能追加用スペース ----
      const btnRow2 = document.createElement("div");
      btnRow2.style.cssText = "display:flex;gap:4px;align-items:center;flex-wrap:wrap;";

      const filterLibBtn = makeSmallButton(t("filterLibrary"), "#4a4a8a", t("filterLibraryTitle"));
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
                if (item.url?.startsWith("data:image/") || item.url?.startsWith("/")) {
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
      btnRow2.appendChild(filterLibBtn);

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
      btnRow2.appendChild(filterOnBgBtn);

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
      btnRow2.appendChild(blendModeSelect);

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
        if (node.properties?.blendMode !== undefined) {
          currentBlendMode = node.properties.blendMode;
          blendModeSelect.value = currentBlendMode;
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
        if (pixiApp && filterOnBg) {
          await loadBackgroundSprite();
          applyFilter();
          if (!animating) pixiApp.render();
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
