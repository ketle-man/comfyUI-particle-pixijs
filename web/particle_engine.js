/**
 * Particle Engine (standalone)
 * - PixiJS ロード・カラーユーティリティ・パーティクルシステム・フィルター生成
 * - ComfyUI フロントエンド（particle_widget.js）と外部SPA の両方から import される。
 *   ここに ComfyUI 依存（scripts/app.js 等）のコードを置かないこと。
 */

// ---- PixiJS ロード（web/lib/ に同梱したファイルをローカル配信） ----
// CDN + SRI 方式は環境によって応答が改変されハッシュ不一致でブロックされるため同梱に変更
export async function loadPixiJS() {
  if (window.PIXI) return window.PIXI;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("./lib/pixi.min.js", import.meta.url).href;
    script.onload = () => resolve(window.PIXI);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ---- pixi-filters v5 ロード (PixiJS v7 対応、web/lib/ に同梱) ----
export async function loadPixiFilters() {
  if (window.PIXI?.filters?.GlowFilter) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("./lib/pixi-filters.min.js", import.meta.url).href;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ---- カラーユーティリティ ----
export function hexToRgb01(hex) {
  if (!hex || hex.length < 7) return { r: 1, g: 1, b: 1 };
  return {
    r: parseInt(hex.slice(1,3),16)/255,
    g: parseInt(hex.slice(3,5),16)/255,
    b: parseInt(hex.slice(5,7),16)/255,
  };
}
export function rgb01ToHex(c) {
  const ch = v => Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,"0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
}
export function lerpRgb(c1,c2,t) {
  return {r:c1.r+(c2.r-c1.r)*t, g:c1.g+(c2.g-c1.g)*t, b:c1.b+(c2.b-c1.b)*t};
}
export function evalGradient(stops, t) {
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

export function inRect(mx,my,r) { return mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h; }

// ---- PIXI パーティクル用ベーステクスチャ生成 ----
let baseParticleTexture = null;
export function getParticleTexture(PIXI, renderer) {
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
export const PARTICLE_SHAPE_PRESETS = [
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
    default: {
      if (shapeType && shapeType.startsWith("char_")) {
        const ch = shapeType.slice(5);
        ctx.font = "bold 52px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ch, 32, 34);
      }
      break;
    }
  }
}

export function getShapeTexture(PIXI, shapeType) {
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
export class ParticleSystem {
  constructor(scene, PIXI, renderer, count, gradientFn, origin, direction, particleSize, strength, customTextures = null, particleRotation = 0, randomParticleRotation = false, randomScale = false, shapePreset = "default", randomShape = false, motionParams = null, spread = 1.0, scatterMode = false, charSet = [], starStretch = 2.0) {
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
    this.scatterMode            = scatterMode;
    this.charSet                = (charSet && charSet.length > 0) ? charSet : null;
    this.starStretch            = starStretch;
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
  _getAlpha(t) { return 1.0; }
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
    if (this.charSet) {
      const ch = this.charSet[Math.floor(Math.random() * this.charSet.length)];
      return getShapeTexture(this.PIXI, `char_${ch}`);
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
      const t0 = this.ages[i] / (this.lifetimes[i] || 1);
      this._setColorAndAlpha(i, t0, this._getAlpha(t0));
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
export class SmokeSystem extends ParticleSystem {
  _getAlpha(_t) { return 0.35; }
  init() {
    for (let i=0;i<this.count;i++){this.velocities.push({x:0,y:0});this.lifetimes.push(0);this.ages.push(0);}
    this._spawnAll(this.PIXI.BLEND_MODES.NORMAL);
  }
  _resetParticle(i) {
    const sprite = this.particles[i];
    const ox = this.scatterMode ? (Math.random() - 0.5) * this.renderer.width  : this.origin.x;
    const oy = this.scatterMode ? (Math.random() - 0.5) * this.renderer.height : this.origin.y;
    const dir=this.direction;
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
      this._setColorAndAlpha(i, t, this._getAlpha(t));
    }
  }
}

// ---- 火花 ----
export class SparkSystem extends ParticleSystem {
  _getAlpha(_t) { return 0.9; }
  init() {
    for (let i=0;i<this.count;i++){this.velocities.push({x:0,y:0});this.lifetimes.push(0);this.ages.push(0);}
    this._spawnAll(this.PIXI.BLEND_MODES.ADD);
  }
  _resetParticle(i) {
    const sprite = this.particles[i];
    const ox = this.scatterMode ? (Math.random() - 0.5) * this.renderer.width  : this.origin.x;
    const oy = this.scatterMode ? (Math.random() - 0.5) * this.renderer.height : this.origin.y;
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
      const t=this.ages[i]/this.lifetimes[i];
      const sprite = this.particles[i];
      sprite.position.x += this.velocities[i].x*delta;
      sprite.position.y += this.velocities[i].y*delta;
      this.velocities[i].y += g*delta;
      this._applyMotion(sprite, i, delta);
      this._setColorAndAlpha(i, t, this._getAlpha(t));
    }
  }
}

// ---- 光線 ----
export class RaySystem extends ParticleSystem {
  _getAlpha(t) { return 0.8 * (1 - t); }
  init() {
    for (let i=0;i<this.count;i++){this.velocities.push({x:0,y:0});this.lifetimes.push(0);this.ages.push(0);}
    this._spawnAll(this.PIXI.BLEND_MODES.ADD);
  }
  _resetParticle(i) {
    const sprite = this.particles[i];
    const ox = this.scatterMode ? (Math.random() - 0.5) * this.renderer.width  : this.origin.x;
    const oy = this.scatterMode ? (Math.random() - 0.5) * this.renderer.height : this.origin.y;
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
      const t=this.ages[i]/this.lifetimes[i];
      const sprite = this.particles[i];
      sprite.position.x += this.velocities[i].x*delta*(1-t);
      sprite.position.y += this.velocities[i].y*delta*(1-t);
      this._applyMotion(sprite, i, delta);
      this._setColorAndAlpha(i, t, this._getAlpha(t));
    }
  }
}

// ---- スターワープ ----
export class StarWarpSystem extends ParticleSystem {
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
    // 伸び倍率はコンストラクタの starStretch パラメータ（Setting で調整可・デフォルト 2.0）を使用
    this.starBaseSize = Math.max(0.02, this.particleSize * 0.015);
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
      // local -Y のキャンバス方向 = (sinθ, cosθ) を VP 外向き (dx,-dy) に合わせると
      //   sprite.rotation = Math.atan2(dx, -dy)
      sprite.rotation = Math.atan2(dx, -dy);

      this._applyMotion(sprite, i, delta);

      // カメラに近いほど明るく・グラデーション終端色
      this._setColorAndAlpha(i, distanceScale, distanceScale);
    }
  }
}

export class NoneSystem extends ParticleSystem {
  init()       {}
  update(_dt)  {}
}

export function createParticleSystem(type,scene,PIXI,renderer,count,gradientFn,origin,direction,size,strength,customTextures=null,particleRotation=0,randomParticleRotation=false,randomScale=false,shapePreset="default",randomShape=false,motionParams=null,spread=1.0,scatterMode=false,charSet=[],starStretch=2.0) {
  const ex = [customTextures, particleRotation, randomParticleRotation, randomScale, shapePreset, randomShape, motionParams, spread, scatterMode, charSet, starStretch];
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
// フィルターインスタンス生成
// ================================================================

// 全面エフェクト型フィルター: 出力領域全体のアルファを 1.0 に強制するため、
// 透明レイヤー単位で適用すると不透明矩形化して背後を覆い隠す → 常に stage 全体に適用すること
export const SCENE_WIDE_FILTERS = new Set(["godray"]);

/**
 * フィルターインスタンスを生成するファクトリ（呼ぶたびに新規インスタンスを返す）。
 * 同一インスタンスを複数コンテナに割り当てると内部状態が競合するため毎回生成する。
 * @param {object} PIXI   - PIXI 名前空間（filters ロード済みであること）
 * @param {string} type   - FILTER_CATALOG のキー
 * @param {object} params - パラメーター
 * @param {{width:number, height:number}} ctx - 出力キャンバスサイズ（center系パラメーターの換算に使用）
 * @returns {PIXI.Filter|null}
 */
export function makeFilterInstance(PIXI, type, params, ctx) {
  const PF = PIXI.filters;
  if (!PF) return null;
  const p = params ?? {};
  const width  = ctx?.width  ?? 512;
  const height = ctx?.height ?? 512;
  const hexColor = s => parseInt((s ?? "#ffffff").replace("#", ""), 16);

  switch (type) {
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
        center:      { x: (p.centerX ?? 0.5) * width, y: (p.centerY ?? 0.5) * height },
        innerRadius: p.innerRadius ?? 0,
      });
    case "adjustment":
      return new PF.AdjustmentFilter({
        gamma:      p.gamma      ?? 1,
        saturation: p.saturation ?? 1,
        contrast:   p.contrast   ?? 1,
        brightness: p.brightness ?? 1,
      });
    case "hsl":
      return new PF.HslAdjustmentFilter({
        hue:        p.hue        ?? 0,
        saturation: p.saturation ?? 0,
        lightness:  p.lightness  ?? 0,
      });
    case "colorOverlay":
      return new PF.ColorOverlayFilter(hexColor(p.color ?? "#ff0000"), p.alpha ?? 0.5);
    case "grayscale":
      return new PF.GrayscaleFilter();
    case "advancedBloom":
      return new PF.AdvancedBloomFilter({
        threshold:  p.threshold  ?? 0.5,
        bloomScale: p.bloomScale ?? 1,
        brightness: p.brightness ?? 1,
        blur:       p.blur       ?? 8,
      });
    case "ascii":
      return new PF.AsciiFilter(p.size ?? 8);
    case "bevel": {
      const fil = new PF.BevelFilter({
        rotation:    p.rotation    ?? 45,
        thickness:   p.thickness   ?? 2,
        lightColor:  hexColor(p.lightColor  ?? "#ffffff"),
        lightAlpha:  p.lightAlpha  ?? 0.7,
        shadowColor: hexColor(p.shadowColor ?? "#000000"),
        shadowAlpha: p.shadowAlpha ?? 0.7,
      });
      fil.padding = Math.ceil(p.thickness ?? 2) + 4;
      return fil;
    }
    case "bulgePinch":
      return new PF.BulgePinchFilter({
        center:   [p.centerX ?? 0.5, p.centerY ?? 0.5],
        radius:   p.radius   ?? 150,
        strength: p.strength ?? 0.5,
      });
    case "crossHatch":
      return new PF.CrossHatchFilter();
    case "emboss":
      return new PF.EmbossFilter(p.strength ?? 5);
    case "glitch":
      return new PF.GlitchFilter({
        slices:    p.slices    ?? 5,
        offset:    p.offset    ?? 100,
        direction: p.direction ?? 0,
      });
    case "godray":
      return new PF.GodrayFilter({
        angle:      p.angle      ?? 30,
        gain:       p.gain       ?? 0.5,
        lacunarity: p.lacunarity ?? 2.5,
        parallel:   true,
        time:       p.time       ?? 0,
      });
    case "radialBlur":
      return new PF.RadialBlurFilter(
        p.angle ?? 20,
        [(p.centerX ?? 0.5) * width, (p.centerY ?? 0.5) * height],
        p.kernelSize ?? 5
      );
    case "reflection":
      return new PF.ReflectionFilter({
        mirror:     true,
        boundary:   p.boundary ?? 0.5,
        amplitude:  [0, p.amplitude ?? 20],
        waveLength: [30, p.waveLength ?? 100],
        time:       p.time ?? 0,
      });
    case "shockwave":
      return new PF.ShockwaveFilter(
        [(p.centerX ?? 0.5) * width, (p.centerY ?? 0.5) * height],
        { amplitude: p.amplitude ?? 30, wavelength: p.wavelength ?? 160 },
        p.time ?? 0.5
      );
    case "tiltShift":
      return new PF.TiltShiftFilter(p.blur ?? 100, p.gradientBlur ?? 600);
    case "twist":
      return new PF.TwistFilter({
        angle:  p.angle  ?? 4,
        radius: p.radius ?? 200,
        offset: new PIXI.Point((p.centerX ?? 0.5) * width, (p.centerY ?? 0.5) * height),
      });
    default: return null;
  }
}
