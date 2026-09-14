/**
 * Filter Library Modal
 * - フィルター選択・プレビュー・詳細設定・保存
 * - パーティクルテクスチャ・回転設定
 */

import { t } from "./i18n.js";

// ---- フィルターカタログ (全定義) ----
// label/desc は i18n キーに変更。section は内部コード "basic"/"extra" に統一。
export const FILTER_CATALOG = {
  none:       { labelKey: "filterNoneLabel",       section: "basic", descKey: "filterNoneDesc",
                params: [] },
  glow:       { labelKey: "filterGlowLabel",       section: "basic", descKey: "filterGlowDesc",
                params: [
                  { key:"outerStrength", labelKey:"paramOuterStrength", min:0.1, max:8,  step:0.1,  def:2  },
                  { key:"distance",      labelKey:"paramGlowDistance",  min:1,   max:30, step:1,    def:15 },
                  { key:"color",         labelKey:"paramGlowColor",     type:"color",               def:"#ffffff" },
                ]},
  bloom:      { labelKey: "filterBloomLabel",      section: "basic", descKey: "filterBloomDesc",
                params: [
                  { key:"blur",       labelKey:"paramBlur",       min:1,  max:20, step:1,    def:8   },
                  { key:"threshold",  labelKey:"paramThreshold",  min:0,  max:1,  step:0.05, def:0.1 },
                  { key:"brightness", labelKey:"paramBrightness", min:0,  max:2,  step:0.05, def:1   },
                ]},
  kawaseBlur: { labelKey: "filterKawaseBlurLabel", section: "basic", descKey: "filterKawaseBlurDesc",
                params: [
                  { key:"blur",    labelKey:"paramBlur",    min:0, max:20, step:0.5, def:4 },
                  { key:"quality", labelKey:"paramQuality", min:1, max:8,  step:1,   def:3 },
                ]},
  pixelate:   { labelKey: "filterPixelateLabel",   section: "basic", descKey: "filterPixelateDesc",
                params: [
                  { key:"size", labelKey:"paramPixelSize", min:2, max:50, step:1, def:10 },
                ]},
  oldFilm:    { labelKey: "filterOldFilmLabel",    section: "basic", descKey: "filterOldFilmDesc",
                params: [
                  { key:"sepia",      labelKey:"paramSepia",      min:0, max:1, step:0.05, def:0.5 },
                  { key:"noise",      labelKey:"paramNoise",      min:0, max:1, step:0.05, def:0.3 },
                  { key:"scratch",    labelKey:"paramScratch",    min:0, max:1, step:0.05, def:0.4 },
                  { key:"vignetting", labelKey:"paramVignetting", min:0, max:1, step:0.05, def:0.3 },
                ]},
  crt:        { labelKey: "filterCrtLabel",        section: "basic", descKey: "filterCrtDesc",
                params: [
                  { key:"curvature",    labelKey:"paramCurvature",    min:0,   max:10, step:0.5,  def:3    },
                  { key:"lineWidth",    labelKey:"paramLineWidth",    min:0.5, max:5,  step:0.5,  def:1    },
                  { key:"lineContrast", labelKey:"paramLineContrast", min:0,   max:1,  step:0.05, def:0.25 },
                  { key:"vignetting",   labelKey:"paramVignetting",   min:0,   max:1,  step:0.05, def:0.3  },
                ]},
  dot:        { labelKey: "filterDotLabel",        section: "extra", descKey: "filterDotDesc",
                params: [
                  { key:"scale", labelKey:"paramScale", min:1, max:20, step:0.5, def:1 },
                  { key:"angle", labelKey:"paramAngle", min:0, max:5,  step:0.1, def:5 },
                ]},
  dropShadow: { labelKey: "filterDropShadowLabel", section: "extra", descKey: "filterDropShadowDesc",
                params: [
                  { key:"offsetX", labelKey:"paramOffsetX",    min:-30, max:30, step:1,    def:4   },
                  { key:"offsetY", labelKey:"paramOffsetY",    min:-30, max:30, step:1,    def:4   },
                  { key:"blur",    labelKey:"paramBlur",       min:0,   max:20, step:0.5,  def:2   },
                  { key:"alpha",   labelKey:"paramAlpha",      min:0,   max:1,  step:0.05, def:0.5 },
                  { key:"color",   labelKey:"paramShadowColor", type:"color",               def:"#000000" },
                ]},
  motionBlur: { labelKey: "filterMotionBlurLabel", section: "extra", descKey: "filterMotionBlurDesc",
                params: [
                  { key:"velocityX",  labelKey:"paramVelocityX",  min:-50, max:50, step:1, def:0 },
                  { key:"velocityY",  labelKey:"paramVelocityY",  min:-50, max:50, step:1, def:0 },
                  { key:"kernelSize", labelKey:"paramKernelSize", min:3,   max:25, step:2, def:5 },
                  { key:"offset",     labelKey:"paramOffset",     min:-50, max:50, step:1, def:0 },
                ]},
  outline:    { labelKey: "filterOutlineLabel",    section: "extra", descKey: "filterOutlineDesc",
                params: [
                  { key:"thickness", labelKey:"paramThickness",   min:0,   max:10, step:0.5,  def:1   },
                  { key:"quality",   labelKey:"paramQuality",     min:0,   max:1,  step:0.05, def:0.1 },
                  { key:"alpha",     labelKey:"paramAlpha",       min:0,   max:1,  step:0.05, def:1   },
                  { key:"color",     labelKey:"paramOutlineColor", type:"color",               def:"#000000" },
                ]},
  rgbSplit:   { labelKey: "filterRgbSplitLabel",   section: "extra", descKey: "filterRgbSplitDesc",
                params: [
                  { key:"redX",  labelKey:"paramRedX",  min:-20, max:20, step:1, def:-2 },
                  { key:"redY",  labelKey:"paramRedY",  min:-20, max:20, step:1, def:0  },
                  { key:"blueX", labelKey:"paramBlueX", min:-20, max:20, step:1, def:2  },
                  { key:"blueY", labelKey:"paramBlueY", min:-20, max:20, step:1, def:0  },
                ]},
  zoomBlur:   { labelKey: "filterZoomBlurLabel",   section: "extra", descKey: "filterZoomBlurDesc",
                params: [
                  { key:"strength",    labelKey:"paramStrength",    min:0, max:0.5, step:0.01, def:0.1 },
                  { key:"centerX",     labelKey:"paramCenterX",     min:0, max:1,   step:0.01, def:0.5 },
                  { key:"centerY",     labelKey:"paramCenterY",     min:0, max:1,   step:0.01, def:0.5 },
                  { key:"innerRadius", labelKey:"paramInnerRadius", min:0, max:200,  step:5,   def:0   },
                ]},
  adjustment: { labelKey: "filterAdjustmentLabel", section: "color", descKey: "filterAdjustmentDesc",
                params: [
                  { key:"gamma",      labelKey:"paramGamma",      min:0.1, max:3, step:0.05, def:1 },
                  { key:"saturation", labelKey:"paramSaturation", min:0,   max:3, step:0.05, def:1 },
                  { key:"contrast",   labelKey:"paramContrast",   min:0,   max:3, step:0.05, def:1 },
                  { key:"brightness", labelKey:"paramBrightness", min:0,   max:3, step:0.05, def:1 },
                ]},
  hsl:        { labelKey: "filterHslLabel",        section: "color", descKey: "filterHslDesc",
                params: [
                  { key:"hue",        labelKey:"paramHue",        min:-180, max:180, step:1,    def:0 },
                  { key:"saturation", labelKey:"paramSaturation", min:-1,   max:1,   step:0.05, def:0 },
                  { key:"lightness",  labelKey:"paramLightness",  min:-1,   max:1,   step:0.05, def:0 },
                ]},
  colorOverlay: { labelKey: "filterColorOverlayLabel", section: "color", descKey: "filterColorOverlayDesc",
                params: [
                  { key:"color", labelKey:"paramOverlayColor", type:"color",          def:"#ff0000" },
                  { key:"alpha", labelKey:"paramAlpha",        min:0, max:1, step:0.05, def:0.5     },
                ]},
  grayscale:  { labelKey: "filterGrayscaleLabel",  section: "color", descKey: "filterGrayscaleDesc",
                params: [] },
  advancedBloom: { labelKey: "filterAdvancedBloomLabel", section: "effects", descKey: "filterAdvancedBloomDesc",
                params: [
                  { key:"threshold",  labelKey:"paramThreshold",  min:0, max:1,  step:0.05, def:0.5 },
                  { key:"bloomScale", labelKey:"paramBloomScale", min:0, max:3,  step:0.05, def:1   },
                  { key:"brightness", labelKey:"paramBrightness", min:0, max:3,  step:0.05, def:1   },
                  { key:"blur",       labelKey:"paramBlur",       min:0, max:20, step:0.5,  def:8   },
                ]},
  ascii:      { labelKey: "filterAsciiLabel",      section: "effects", descKey: "filterAsciiDesc",
                params: [
                  { key:"size", labelKey:"paramAsciiSize", min:2, max:20, step:1, def:8 },
                ]},
  bevel:      { labelKey: "filterBevelLabel",      section: "effects", descKey: "filterBevelDesc",
                params: [
                  { key:"rotation",    labelKey:"paramAngle",       min:0, max:360, step:1,    def:45  },
                  { key:"thickness",   labelKey:"paramThickness",   min:0, max:10,  step:0.5,  def:2   },
                  { key:"lightColor",  labelKey:"paramLightColor",  type:"color",              def:"#ffffff" },
                  { key:"lightAlpha",  labelKey:"paramLightAlpha",  min:0, max:1,   step:0.05, def:0.7 },
                  { key:"shadowColor", labelKey:"paramShadowColor", type:"color",              def:"#000000" },
                  { key:"shadowAlpha", labelKey:"paramShadowAlpha", min:0, max:1,   step:0.05, def:0.7 },
                ]},
  bulgePinch: { labelKey: "filterBulgePinchLabel", section: "effects", descKey: "filterBulgePinchDesc",
                params: [
                  { key:"centerX",  labelKey:"paramCenterX",  min:0,  max:1,   step:0.01, def:0.5 },
                  { key:"centerY",  labelKey:"paramCenterY",  min:0,  max:1,   step:0.01, def:0.5 },
                  { key:"radius",   labelKey:"paramRadius",   min:10, max:500, step:5,    def:150 },
                  { key:"strength", labelKey:"paramStrength", min:-1, max:1,   step:0.05, def:0.5 },
                ]},
  crossHatch: { labelKey: "filterCrossHatchLabel", section: "effects", descKey: "filterCrossHatchDesc",
                params: [] },
  emboss:     { labelKey: "filterEmbossLabel",     section: "effects", descKey: "filterEmbossDesc",
                params: [
                  { key:"strength", labelKey:"paramStrength", min:0, max:20, step:0.5, def:5 },
                ]},
  glitch:     { labelKey: "filterGlitchLabel",     section: "effects", descKey: "filterGlitchDesc",
                params: [
                  { key:"slices",    labelKey:"paramSlices",    min:2,    max:20,  step:1, def:5   },
                  { key:"offset",    labelKey:"paramOffset",    min:-200, max:200, step:1, def:100 },
                  { key:"direction", labelKey:"paramDirection", min:0,    max:360, step:5, def:0   },
                ]},
  godray:     { labelKey: "filterGodrayLabel",     section: "effects", descKey: "filterGodrayDesc",
                params: [
                  { key:"angle",      labelKey:"paramAngle",      min:-60, max:60, step:1,    def:30  },
                  { key:"gain",       labelKey:"paramGain",       min:0,   max:1,  step:0.05, def:0.5 },
                  { key:"lacunarity", labelKey:"paramLacunarity", min:0,   max:5,  step:0.1,  def:2.5 },
                  { key:"time",       labelKey:"paramTime",       min:0,   max:10, step:0.1,  def:0   },
                ]},
  radialBlur: { labelKey: "filterRadialBlurLabel", section: "effects", descKey: "filterRadialBlurDesc",
                params: [
                  { key:"angle",      labelKey:"paramAngle",      min:-180, max:180, step:1,    def:20  },
                  { key:"centerX",    labelKey:"paramCenterX",    min:0,    max:1,   step:0.01, def:0.5 },
                  { key:"centerY",    labelKey:"paramCenterY",    min:0,    max:1,   step:0.01, def:0.5 },
                  { key:"kernelSize", labelKey:"paramKernelSize", min:3,    max:25,  step:2,    def:5   },
                ]},
  reflection: { labelKey: "filterReflectionLabel", section: "effects", descKey: "filterReflectionDesc",
                params: [
                  { key:"boundary",   labelKey:"paramBoundary",   min:0,  max:1,   step:0.01, def:0.5 },
                  { key:"amplitude",  labelKey:"paramAmplitude",  min:0,  max:50,  step:1,    def:20  },
                  { key:"waveLength", labelKey:"paramWaveLength", min:10, max:200, step:1,    def:100 },
                  { key:"time",       labelKey:"paramTime",       min:0,  max:10,  step:0.1,  def:0   },
                ]},
  shockwave:  { labelKey: "filterShockwaveLabel",  section: "effects", descKey: "filterShockwaveDesc",
                params: [
                  { key:"centerX",    labelKey:"paramCenterX",    min:0,  max:1,   step:0.01, def:0.5 },
                  { key:"centerY",    labelKey:"paramCenterY",    min:0,  max:1,   step:0.01, def:0.5 },
                  { key:"amplitude",  labelKey:"paramAmplitude",  min:0,  max:100, step:1,    def:30  },
                  { key:"wavelength", labelKey:"paramWaveLength", min:10, max:400, step:5,    def:160 },
                  { key:"time",       labelKey:"paramTime",       min:0,  max:5,   step:0.05, def:0.5 },
                ]},
  tiltShift:  { labelKey: "filterTiltShiftLabel",  section: "effects", descKey: "filterTiltShiftDesc",
                params: [
                  { key:"blur",         labelKey:"paramBlur",         min:0, max:200,  step:5,  def:100 },
                  { key:"gradientBlur", labelKey:"paramGradientBlur", min:0, max:1500, step:10, def:600 },
                ]},
  twist:      { labelKey: "filterTwistLabel",      section: "effects", descKey: "filterTwistDesc",
                params: [
                  { key:"angle",   labelKey:"paramStrength", min:-10, max:10,  step:0.5,  def:4   },
                  { key:"radius",  labelKey:"paramRadius",   min:10,  max:500, step:5,    def:200 },
                  { key:"centerX", labelKey:"paramCenterX",  min:0,   max:1,   step:0.01, def:0.5 },
                  { key:"centerY", labelKey:"paramCenterY",  min:0,   max:1,   step:0.01, def:0.5 },
                ]},
};

// フィルターカタログのセクション定義（フィルタータブ・マルチタブのカタログ割り当てで共用）
const FILTER_CATALOG_SECTIONS = [
  ["basic", "sectionBasic"], ["extra", "sectionExtra"],
  ["color", "sectionColor"], ["effects", "sectionEffects"],
];

// ---- カタログ一覧の汎用ビルダー ----
// container にセクション見出し+フィルター項目を描画し、クリック時に onSelectType(key) を呼ぶ。
// getActiveKey() は現在アクティブなフィルター種類キー（ホバー時のハイライト抑制・初期ハイライトに使用）。
// 戻り値の highlight(activeKey) を呼ぶと選択中項目のスタイルを更新できる。
function buildCatalogList(container, onSelectType, getActiveKey) {
  const items = {};
  for (const [secId, secKey] of FILTER_CATALOG_SECTIONS) {
    container.appendChild(el("div", {
      style: "font-size:10px;color:#556;padding:8px 10px 3px;letter-spacing:0.06em;font-weight:bold;",
    }, t(secKey)));
    for (const [key, def] of Object.entries(FILTER_CATALOG)) {
      if (def.section !== secId) continue;
      const item = el("div", {
        style: "padding:7px 12px;cursor:pointer;font-size:12px;transition:background 0.1s;" +
               "border-left:3px solid transparent;user-select:none;",
      }, t(def.labelKey));
      item.addEventListener("mouseenter", () => { if (getActiveKey() !== key) item.style.background = "#252545"; });
      item.addEventListener("mouseleave", () => { if (getActiveKey() !== key) item.style.background = ""; });
      item.addEventListener("click", () => onSelectType(key));
      items[key] = item;
      container.appendChild(item);
    }
  }
  function highlight(activeKey) {
    for (const [k, item] of Object.entries(items)) {
      const sel = k === activeKey;
      item.style.background      = sel ? "#2a2a5a" : "";
      item.style.borderLeftColor = sel ? "#4a8adb" : "transparent";
      item.style.color           = sel ? "#aaccff" : "#ccc";
    }
  }
  return { items, highlight };
}

// ---- 指定フィルター種類のパラメータ値を解決 ----
// candidates（{type, params} の配列、優先順）の中から type が一致する最初の値を採用し、
// 見つからなければ定義上のデフォルト値を使う（フィルターの選び直し時に値を引き継ぐため）。
function resolveParamsForType(key, def, candidates) {
  const newParams = {};
  for (const p of def.params) {
    let val;
    for (const cand of candidates) {
      if (cand && cand.type === key && cand.params && cand.params[p.key] !== undefined) {
        val = cand.params[p.key];
        break;
      }
    }
    newParams[p.key] = val !== undefined ? val : p.def;
  }
  return newParams;
}

// ---- フィルターのタイトル・説明文描画（共通） ----
function renderFilterHeader(container, def) {
  container.appendChild(el("div", {
    style: "font-size:14px;font-weight:bold;color:#e0e0ff;padding-bottom:5px;" +
           "border-bottom:1px solid #333;margin-bottom:4px;",
  }, t(def.labelKey)));
  container.appendChild(el("div", {
    style: "font-size:11px;color:#778;margin-bottom:10px;",
  }, t(def.descKey)));
}

// ---- パラメータ行（スライダー/カラーピッカー）の描画（共通） ----
// getParam(key)/setParam(key, value) を通じて状態の読み書きとプレビュー通知を呼び出し側に委譲する。
function renderParamRows(container, def, { getParam, setParam }) {
  for (const p of def.params) {
    const rowWrap = el("div", { style: "margin-bottom:10px;" });
    rowWrap.appendChild(el("div", { style: "font-size:11px;color:#99a;margin-bottom:3px;" }, t(p.labelKey)));

    if (p.type === "color") {
      const curVal   = getParam(p.key) ?? p.def;
      const colorInp = document.createElement("input");
      colorInp.type  = "color";
      colorInp.value = typeof curVal === "string" ? curVal : p.def;
      colorInp.style.cssText =
        "width:100%;height:28px;border:1px solid #333;cursor:pointer;border-radius:4px;";
      colorInp.addEventListener("input", () => {
        setParam(p.key, colorInp.value);
      });
      rowWrap.appendChild(colorInp);
    } else {
      const curVal = getParam(p.key) ?? p.def;
      const slRow  = el("div", { style: "display:flex;align-items:center;gap:6px;" });

      const sl = document.createElement("input");
      sl.type = "range"; sl.min = p.min; sl.max = p.max; sl.step = p.step; sl.value = curVal;
      sl.style.cssText = "flex:1;height:14px;accent-color:#4a90d9;cursor:pointer;min-width:60px;";
      sl.addEventListener("wheel", e => e.stopPropagation(), { passive: true });

      const dec    = p.step < 0.1 ? 2 : (p.step < 1 ? 1 : 0);
      const numInp = document.createElement("input");
      numInp.type = "number"; numInp.min = p.min; numInp.max = p.max; numInp.step = p.step;
      numInp.value = parseFloat(curVal).toFixed(dec);
      numInp.style.cssText =
        "width:56px;background:#111;border:1px solid #444;color:#ddd;" +
        "padding:2px 5px;border-radius:4px;font-size:11px;text-align:right;" +
        "appearance:textfield;-moz-appearance:textfield;";
      numInp.addEventListener("wheel",   e => e.stopPropagation(), { passive: true });
      numInp.addEventListener("keydown", e => e.stopPropagation());

      const updateVal = v => setParam(p.key, v);
      sl.addEventListener("input", () => {
        const v = parseFloat(sl.value); numInp.value = v.toFixed(dec); updateVal(v);
      });
      numInp.addEventListener("change", () => {
        let v = parseFloat(numInp.value);
        if (isNaN(v)) { numInp.value = parseFloat(sl.value).toFixed(dec); return; }
        v = Math.max(p.min, Math.min(p.max, v));
        numInp.value = v.toFixed(dec); sl.value = v; updateVal(v);
      });

      slRow.append(sl, numInp);
      rowWrap.appendChild(slRow);
    }
    container.appendChild(rowWrap);
  }
}

// ---- エクスポート: ライブラリを開く ----
// 拡張オプション（すべて省略可・省略時は従来動作）:
//   topBar         : ヘッダーと3ペインの間に挿入する任意のコントロール行（外部SPAの統合UI用）
//   previewElement : 中央ペインに表示する要素。指定時は内部のコピー用プレビューcanvasを作らず、
//                    この要素（ライブcanvas等）をそのまま表示する
//   saveLabel      : 保存ボタンのラベル（既定: "✓ Apply & Close"）
//   onClose        : クローズ時コールバック (saved: boolean) => void。保存/キャンセル問わず最後に呼ばれる
//   filterStack    : フィルタースタック配列 [{type, params, enabled}, ...]（単一フィルターは要素数1として表現）
//   onLoadMultiPresets  : () => Promise<Array<{name, stack}>>  保存済みマルチプリセット一覧の取得
//   onSaveMultiPreset   : (name, stack) => Promise<void>       プリセットの保存（同名なら上書き）
//   onDeleteMultiPreset : (name) => Promise<void>              プリセットの削除
export function openFilterLibrary({ mainCanvas, filterStack, particleSettings, onPreview, onSave, onParticlePreview, onLoadMultiPresets, onSaveMultiPreset, onDeleteMultiPreset, topBar, previewElement, saveLabel, onClose }) {
  if (document.getElementById("filter-lib-modal")) return;
  document.body.appendChild(
    buildModal({ mainCanvas, filterStack, particleSettings, onPreview, onSave, onParticlePreview, onLoadMultiPresets, onSaveMultiPreset, onDeleteMultiPreset, topBar, previewElement, saveLabel, onClose })
  );
}

// ================================================================
// モーダル構築
// ================================================================
function buildModal({ mainCanvas, filterStack, particleSettings, onPreview, onSave, onParticlePreview, onLoadMultiPresets, onSaveMultiPreset, onDeleteMultiPreset, topBar = null, previewElement = null, saveLabel = null, onClose = null }) {
  const origStack = JSON.parse(JSON.stringify(filterStack));
  let   tempStack = JSON.parse(JSON.stringify(filterStack));
  let   selectedRowIdx     = 0;     // スタック内で選択/展開中の行インデックス（フィルターカタログでの割り当て対象でもある）
  let   multiPresets       = [];    // [{name, stack}]
  let   multiPresetsLoaded = false;
  let   refreshMultiPanel  = () => {}; // buildMultiPanel() 実行後に差し替えられる再描画フック（Clearボタン用）

  const _defMotion = { turbulence: 0, turbFreq: 1, windX: 0, windY: 0, swirl: 0 };
  const origParticle = {
    textures: (function() {
      if (particleSettings?.textures?.length) return JSON.parse(JSON.stringify(particleSettings.textures));
      if (particleSettings?.textureUrl) return [{ url: particleSettings.textureUrl, name: particleSettings.textureName ?? "texture" }];
      return [];
    })(),
    size:           particleSettings?.size           ?? 5.0,
    spread:         particleSettings?.spread         ?? 1.0,
    rotation:       particleSettings?.rotation       ?? 0,
    randomRotation: particleSettings?.randomRotation ?? false,
    randomScale:    particleSettings?.randomScale    ?? false,
    shapePreset:    particleSettings?.shapePreset    ?? "default",
    randomShape:    particleSettings?.randomShape    ?? false,
    motionParams:   { ..._defMotion, ...(particleSettings?.motionParams ?? {}) },
    globalStrength: particleSettings?.globalStrength ?? 1.0,
    starStretch:    particleSettings?.starStretch    ?? 2.0,
    charSet:        particleSettings?.charSet ?? [],
  };
  let tempParticle = JSON.parse(JSON.stringify(origParticle));
  const notifyParticle = () => onParticlePreview?.(JSON.parse(JSON.stringify(tempParticle)));

  let currentKey        = tempStack.length === 1 ? (tempStack[0]?.type || "none") : null;
  let particleFileInput = null;

  // ---- Overlay ----
  const overlay = el("div", {
    id: "filter-lib-modal",
    style: "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;" +
           "display:flex;align-items:center;justify-content:center;",
  });
  overlay.tabIndex = -1;
  overlay.addEventListener("keydown", e => { if (e.key === "Escape") cleanup(false); });
  overlay.addEventListener("click",   e => { if (e.target === overlay) cleanup(false); });

  // ---- Dialog ----
  const dialog = el("div", {
    style: "background:#1e1e2e;color:#ccc;border-radius:10px;" +
           "width:min(96vw,1360px);height:min(94vh,1060px);display:flex;flex-direction:column;" +
           "box-shadow:0 8px 40px rgba(0,0,0,0.85);overflow:hidden;font-family:sans-serif;",
  });

  // ---- Header ----
  const header = el("div", {
    style: "display:flex;align-items:center;gap:8px;padding:10px 14px;" +
           "background:#16213e;border-bottom:1px solid #333;flex-shrink:0;",
  });
  header.append(
    el("span", { style: "font-size:15px;font-weight:bold;color:#e0e0ff;flex:1;" },
       t("filterLibraryHeader")),
    el("span", { style: "font-size:11px;color:#666;" }, t("escapeToCancel")),
    mkCloseBtn(() => cleanup(false))
  );

  // ---- Body (3カラム) ----
  const body = el("div", { style: "display:flex;flex:1;overflow:hidden;" });

  // ── 左パネル: タブ + リスト ──
  const leftPanel = el("div", {
    style: "width:170px;flex-shrink:0;display:flex;flex-direction:column;" +
           "border-right:1px solid #2a2a4a;background:#1a1a28;",
  });

  // ---- タブバー（フィルター / マルチ / パーティクル） ----
  let activeTab       = "filter";
  let lastParticleKey = "particle_settings";

  const TAB_COLORS = {
    filter:   { border: "#4a8adb", text: "#aaccff" },
    multi:    { border: "#4ada7a", text: "#aaffcc" },
    particle: { border: "#da8a4a", text: "#ffccaa" },
  };

  const tabBar = el("div", {
    style: "display:flex;flex-shrink:0;border-bottom:1px solid #2a2a4a;background:#16213e;",
  });
  const tabBtns = {};
  for (const [id, labelKey] of [["filter", "tabFilter"], ["multi", "tabMulti"], ["particle", "tabParticle"]]) {
    const btn = el("div", {
      style: "flex:1;text-align:center;padding:8px 2px;cursor:pointer;font-size:11px;" +
             "user-select:none;border-bottom:2px solid transparent;transition:background 0.1s;",
    }, t(labelKey));
    btn.addEventListener("click", () => setTab(id));
    tabBtns[id] = btn;
    tabBar.appendChild(btn);
  }
  leftPanel.appendChild(tabBar);

  const listScroll = el("div", { style: "flex:1;overflow-y:auto;padding:6px 0;" });
  leftPanel.appendChild(listScroll);

  const filterListEl   = el("div");
  const particleListEl = el("div", { style: "display:none;" });
  const multiListEl    = el("div", { style: "display:none;" });
  listScroll.append(filterListEl, particleListEl, multiListEl);

  function setTab(id) {
    activeTab = id;
    for (const [k, btn] of Object.entries(tabBtns)) {
      const sel = k === id;
      const c = TAB_COLORS[k];
      btn.style.background        = sel ? "#252545" : "";
      btn.style.borderBottomColor = sel ? c.border : "transparent";
      btn.style.color             = sel ? c.text : "#888";
      btn.style.fontWeight        = sel ? "bold" : "normal";
    }
    filterListEl.style.display   = id === "filter"   ? "" : "none";
    particleListEl.style.display = id === "particle" ? "" : "none";
    multiListEl.style.display    = id === "multi"    ? "" : "none";
    if (id === "filter") {
      highlightFilterCatalog(tempStack[selectedRowIdx]?.type ?? null);
      buildMultiPanel();
    } else if (id === "multi") {
      buildMultiPanel();
      loadMultiPresetsOnce().then(refreshMultiPresetList);
    } else if (lastParticleKey === "particle_params") {
      selectParticleParams();
    } else if (lastParticleKey === "particle_motion") {
      selectParticleMotion();
    } else {
      selectParticle();
    }
  }

  // ---- フィルタータブ: フィルター一覧（常時表示、選択中の行に割り当てる） ----
  const { highlight: highlightFilterCatalog } =
    buildCatalogList(filterListEl, key => assignSelectedRowType(key), () => tempStack[selectedRowIdx]?.type);

  // ---- パーティクルタブ: 設定項目 ----
  const particleItem = el("div", {
    style: "padding:7px 12px;cursor:pointer;font-size:12px;transition:background 0.1s;" +
           "border-left:3px solid transparent;user-select:none;",
  }, t("particleLabel"));
  particleItem.addEventListener("mouseenter", () => {
    if (currentKey !== "particle_settings") particleItem.style.background = "#252545";
  });
  particleItem.addEventListener("mouseleave", () => {
    if (currentKey !== "particle_settings") particleItem.style.background = "";
  });
  particleItem.addEventListener("click", () => selectParticle());
  particleListEl.appendChild(particleItem);

  const particleParamsItem = el("div", {
    style: "padding:7px 12px;cursor:pointer;font-size:12px;transition:background 0.1s;" +
           "border-left:3px solid transparent;user-select:none;",
  }, t("particleParams"));
  particleParamsItem.addEventListener("mouseenter", () => {
    if (currentKey !== "particle_params") particleParamsItem.style.background = "#252545";
  });
  particleParamsItem.addEventListener("mouseleave", () => {
    if (currentKey !== "particle_params") particleParamsItem.style.background = "";
  });
  particleParamsItem.addEventListener("click", () => selectParticleParams());
  particleListEl.appendChild(particleParamsItem);

  const particleMotionItem = el("div", {
    style: "padding:7px 12px;cursor:pointer;font-size:12px;transition:background 0.1s;" +
           "border-left:3px solid transparent;user-select:none;",
  }, t("motionSettings"));
  particleMotionItem.addEventListener("mouseenter", () => {
    if (currentKey !== "particle_motion") particleMotionItem.style.background = "#252545";
  });
  particleMotionItem.addEventListener("mouseleave", () => {
    if (currentKey !== "particle_motion") particleMotionItem.style.background = "";
  });
  particleMotionItem.addEventListener("click", () => selectParticleMotion());
  particleListEl.appendChild(particleMotionItem);

  function highlightParticleList(activeKey) {
    const pSel = activeKey === "particle_settings";
    particleItem.style.background      = pSel ? "#2a2a5a" : "";
    particleItem.style.borderLeftColor = pSel ? "#da8a4a" : "transparent";
    particleItem.style.color           = pSel ? "#ffccaa" : "#ccc";
    const ppSel = activeKey === "particle_params";
    particleParamsItem.style.background      = ppSel ? "#2a2a5a" : "";
    particleParamsItem.style.borderLeftColor = ppSel ? "#da8a4a" : "transparent";
    particleParamsItem.style.color           = ppSel ? "#ffccaa" : "#ccc";
    const pmSel = activeKey === "particle_motion";
    particleMotionItem.style.background      = pmSel ? "#2a2a5a" : "";
    particleMotionItem.style.borderLeftColor = pmSel ? "#da8a4a" : "transparent";
    particleMotionItem.style.color           = pmSel ? "#ffccaa" : "#ccc";
  }

  // ── 中央パネル: プレビュー ──
  const centerPanel = el("div", {
    style: "flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
           "background:#111118;padding:16px;gap:10px;",
  });
  let previewCanvas = null, previewCtx = null;
  if (previewElement) {
    // 外部提供のライブプレビュー要素（コピー描画は行わない）
    centerPanel.appendChild(previewElement);
  } else {
    previewCanvas = document.createElement("canvas");
    const _maxPrev = 640;
    const _mw = mainCanvas.width  || 512;
    const _mh = mainCanvas.height || 512;
    const _ratio = _mw / _mh;
    previewCanvas.width  = _ratio >= 1 ? _maxPrev : Math.round(_maxPrev * _ratio);
    previewCanvas.height = _ratio >= 1 ? Math.round(_maxPrev / _ratio) : _maxPrev;
    previewCanvas.style.cssText =
      "border-radius:6px;box-shadow:0 2px 16px rgba(0,0,0,0.7);" +
      "max-width:100%;max-height:calc(100% - 40px);object-fit:contain;";
    previewCtx = previewCanvas.getContext("2d");
    const previewInfo = el("div", {
      style: "font-size:11px;color:#555;text-align:center;",
    }, t("previewInfo"));
    centerPanel.append(previewCanvas, previewInfo);
  }

  let rafId = null;
  function startPreviewLoop() {
    if (!previewCanvas) return;
    const pw = previewCanvas.width, ph = previewCanvas.height;
    function loop() {
      try {
        previewCtx.clearRect(0, 0, pw, ph);
        if (mainCanvas.width > 0 && mainCanvas.height > 0)
          previewCtx.drawImage(mainCanvas, 0, 0, pw, ph);
      } catch(_) {}
      rafId = requestAnimationFrame(loop);
    }
    loop();
  }

  // ── 右パネル: パラメータ ──
  const rightPanel = el("div", {
    style: "width:270px;flex-shrink:0;border-left:1px solid #2a2a4a;overflow-y:auto;" +
           "background:#1a1a28;padding:10px 14px;display:flex;flex-direction:column;gap:0;",
  });

  // ---- パーティクル設定パネル（テクスチャ＋シェイプ） ----
  const SHAPE_LIST = [
    { id: "circle_outline",   label: "◯" },
    { id: "circle_fill",      label: "●" },
    { id: "square_outline",   label: "□" },
    { id: "square_fill",      label: "■" },
    { id: "triangle_outline", label: "△" },
    { id: "triangle_fill",    label: "▲" },
    { id: "star_outline",     label: "☆" },
    { id: "star_fill",        label: "★" },
  ];

  function buildParticleParamPanel() {
    rightPanel.replaceChildren();

    rightPanel.appendChild(el("div", {
      style: "font-size:14px;font-weight:bold;color:#ffccaa;padding-bottom:5px;" +
             "border-bottom:1px solid #333;margin-bottom:4px;",
    }, t("particleLabel")));
    rightPanel.appendChild(el("div", {
      style: "font-size:11px;color:#778;margin-bottom:12px;",
    }, t("particleShapeDesc")));

    // ---- テクスチャ（複数） ----
    rightPanel.appendChild(
      el("div", { style: "font-size:11px;color:#99a;margin-bottom:5px;" }, t("textureImage"))
    );

    if (!particleFileInput) {
      particleFileInput = document.createElement("input");
      particleFileInput.type    = "file";
      particleFileInput.accept  = "image/*";
      particleFileInput.multiple = true;
      particleFileInput.style.display = "none";
      dialog.appendChild(particleFileInput);
    }

    // テクスチャリスト本体（overflow なし・高さ自動）
    const texListEl = el("div", { style: "margin-bottom:6px;" });

    function drawThumb(canvas, url) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // プレースホルダー色を先に塗る
      ctx.fillStyle = "#2a2a3a";
      ctx.fillRect(0, 0, 28, 28);
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, 28, 28);
        const s = Math.min(28 / img.width, 28 / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (28 - w) / 2, (28 - h) / 2, w, h);
      };
      img.onerror = () => {
        ctx.fillStyle = "#555";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", 14, 14);
      };
      img.src = url;
    }

    function refreshTexList() {
      texListEl.replaceChildren();
      if (tempParticle.textures.length === 0) {
        texListEl.appendChild(el("div", {
          style: "font-size:11px;color:#778;padding:4px 0;",
        }, t("defaultTexture")));
        return;
      }
      for (let i = 0; i < tempParticle.textures.length; i++) {
        const item = tempParticle.textures[i];
        const row = el("div", {
          style: "display:flex;align-items:center;gap:6px;padding:3px 0;" +
                 "border-bottom:1px solid #2a2a3a;",
        });
        const thumb = document.createElement("canvas");
        thumb.width = 28; thumb.height = 28;
        thumb.style.cssText =
          "display:block;width:28px;height:28px;flex-shrink:0;" +
          "border:1px solid #444;border-radius:2px;";
        if (item.url) drawThumb(thumb, item.url);
        const nameEl = el("span", {
          style: "font-size:11px;color:#bbb;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
        }, item.name);
        const delBtn = el("button", {
          style: "background:#4a2a2a;border:1px solid #6a3a3a;color:#f88;border-radius:3px;" +
                 "cursor:pointer;font-size:11px;padding:1px 6px;flex-shrink:0;line-height:1.4;",
        }, "×");
        delBtn.onclick = () => {
          tempParticle.textures.splice(i, 1);
          refreshTexList();
          notifyParticle();
        };
        row.append(thumb, nameEl, delBtn);
        texListEl.appendChild(row);
      }
    }
    refreshTexList();

    particleFileInput.onchange = () => {
      const files = Array.from(particleFileInput.files ?? []);
      if (!files.length) return;
      let loaded = 0;
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = ev => {
          tempParticle.textures.push({ url: ev.target.result, name: file.name });
          loaded++;
          if (loaded === files.length) { refreshTexList(); notifyParticle(); }
        };
        reader.readAsDataURL(file);
      }
      particleFileInput.value = "";
    };

    const texBtnRow = el("div", { style: "display:flex;gap:6px;margin-bottom:14px;" });
    const texSelBtn = mkBtn(t("selectFile"), "#5a4a2a");
    texSelBtn.onclick = () => particleFileInput.click();
    const texClrBtn  = mkBtn(t("resetDefault"), "#383838");
    texClrBtn.onclick = () => {
      tempParticle.textures = [];
      refreshTexList();
      notifyParticle();
    };
    texBtnRow.append(texSelBtn, texClrBtn);
    rightPanel.append(texListEl, texBtnRow);

    // ---- プリセットシェイプ ----
    rightPanel.appendChild(
      el("div", { style: "font-size:11px;color:#99a;margin-bottom:6px;" }, t("particleShapePreset"))
    );

    const shapeGrid = el("div", {
      style: "display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px;",
    });

    const allShapeItems = [{ id: "default", label: t("shapeDefault") }, ...SHAPE_LIST];
    const shapeBtns = {};

    function updateShapeButtons() {
      for (const [id, btn] of Object.entries(shapeBtns)) {
        const sel = id === tempParticle.shapePreset;
        btn.style.background   = sel ? "#4a5a8a" : "#2a2a3a";
        btn.style.borderColor  = sel ? "#6a8adb" : "#333";
        btn.style.color        = sel ? "#ffffff" : "#aaa";
      }
    }

    for (const { id, label } of allShapeItems) {
      const btn = el("button", {
        style: "padding:5px 2px;background:#2a2a3a;color:#aaa;border:1px solid #333;" +
               "border-radius:4px;cursor:pointer;font-size:14px;text-align:center;" +
               "transition:background 0.1s;",
      }, label);
      btn.addEventListener("click", () => {
        tempParticle.shapePreset = id;
        updateShapeButtons();
        notifyParticle();
      });
      shapeBtns[id] = btn;
      shapeGrid.appendChild(btn);
    }
    updateShapeButtons();
    rightPanel.appendChild(shapeGrid);

    // ---- ランダムシェイプ ----
    const randShapeWrap = el("div", { style: "margin-bottom:10px;" });
    const randShapeRow  = el("div", { style: "display:flex;align-items:center;gap:8px;" });
    const randShapeChk  = document.createElement("input");
    randShapeChk.type    = "checkbox";
    randShapeChk.checked = tempParticle.randomShape;
    randShapeChk.style.cssText = "width:16px;height:16px;cursor:pointer;accent-color:#4a90d9;flex-shrink:0;";
    randShapeChk.addEventListener("change", () => { tempParticle.randomShape = randShapeChk.checked; notifyParticle(); });
    randShapeRow.append(
      randShapeChk,
      el("span", { style: "font-size:12px;color:#ccc;line-height:1.4;" }, t("randomShapeDesc"))
    );
    randShapeWrap.appendChild(el("div", { style: "font-size:11px;color:#99a;margin-bottom:6px;" }, t("randomShape")));
    randShapeWrap.appendChild(randShapeRow);
    rightPanel.appendChild(randShapeWrap);

    // ---- テキスト文字シェイプ ----
    const charSection = el("div", {
      style: "margin-top:12px;border-top:1px solid #2a2a4a;padding-top:10px;",
    });
    charSection.appendChild(el("div", {
      style: "font-size:11px;color:#99a;margin-bottom:3px;",
    }, t("charShapeLabel")));
    charSection.appendChild(el("div", {
      style: "font-size:10px;color:#556;margin-bottom:6px;line-height:1.5;",
    }, t("charShapeDesc")));

    const charInput = document.createElement("input");
    charInput.type = "text";
    charInput.placeholder = t("charShapePlaceholder");
    charInput.value = (tempParticle.charSet ?? []).join(",");
    charInput.style.cssText =
      "width:100%;box-sizing:border-box;background:#111;border:1px solid #444;color:#ddd;" +
      "padding:4px 6px;border-radius:4px;font-size:12px;margin-bottom:6px;" +
      "appearance:textfield;";
    charInput.addEventListener("wheel",   e => e.stopPropagation(), { passive: true });
    charInput.addEventListener("keydown", e => e.stopPropagation());

    function updateCharSet() {
      const chars = charInput.value
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length === 1 && /^[^\x00-\x1F\x7F\s,]$/.test(s));
      tempParticle.charSet = [...new Set(chars)];
      notifyParticle();
    }
    charInput.addEventListener("input", updateCharSet);

    const SYMBOL_SET = [
      '!', '"', '#', '$', '%', '&', "'", '(', ')',
      '*', '+', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@',
      '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~',
      '★', '☆', '♪', '♥', '♦', '♣', '♠', '→', '←', '↑', '↓',
      '≠', '≤', '≥', '±', '∞', '×',
    ].join(',');

    const charBtnRow = el("div", { style: "display:flex;gap:4px;flex-wrap:wrap;" });

    const charAZBtn = mkBtn("[A-Z]", "#2a4a5a");
    charAZBtn.onclick = () => {
      charInput.value = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)).join(",");
      updateCharSet();
    };
    const char09Btn = mkBtn("[0-9]", "#2a4a5a");
    char09Btn.onclick = () => {
      charInput.value = "0,1,2,3,4,5,6,7,8,9";
      updateCharSet();
    };
    const charSymBtn = mkBtn(t("charShapeSymbols"), "#2a4a5a");
    charSymBtn.onclick = () => {
      charInput.value = SYMBOL_SET;
      updateCharSet();
    };
    const charClrBtn = mkBtn(t("charShapeClear"), "#383838");
    charClrBtn.onclick = () => {
      charInput.value = "";
      updateCharSet();
    };

    charBtnRow.append(charAZBtn, char09Btn, charSymBtn, charClrBtn);
    charSection.append(charInput, charBtnRow);
    rightPanel.appendChild(charSection);

  }

  // ---- パーティクルパラメーターパネル（回転・ランダム回転・ランダムスケール） ----
  function buildParticleParamsPanel() {
    rightPanel.replaceChildren();

    rightPanel.appendChild(el("div", {
      style: "font-size:14px;font-weight:bold;color:#ffccaa;padding-bottom:5px;" +
             "border-bottom:1px solid #333;margin-bottom:4px;",
    }, t("particleParams")));
    rightPanel.appendChild(el("div", {
      style: "font-size:11px;color:#778;margin-bottom:14px;",
    }, t("particleParamsDesc")));

    // ---- サイズ・広がり（共通ヘルパー） ----
    function mkSlider(labelKey, min, max, step, getter, setter) {
      const dec = step < 0.1 ? 2 : (step < 1 ? 1 : 0);
      const wrap = el("div", { style: "margin-bottom:14px;" });
      wrap.appendChild(el("div", { style: "font-size:11px;color:#99a;margin-bottom:3px;" }, t(labelKey)));
      const slRow = el("div", { style: "display:flex;align-items:center;gap:6px;" });
      const sl = document.createElement("input");
      sl.type = "range"; sl.min = min; sl.max = max; sl.step = step; sl.value = getter();
      sl.style.cssText = "flex:1;height:14px;accent-color:#4a90d9;cursor:pointer;min-width:60px;";
      sl.addEventListener("wheel", e => e.stopPropagation(), { passive: true });
      const numInp = document.createElement("input");
      numInp.type = "number"; numInp.min = min; numInp.max = max; numInp.step = step;
      numInp.value = parseFloat(getter()).toFixed(dec);
      numInp.style.cssText =
        "width:56px;background:#111;border:1px solid #444;color:#ddd;" +
        "padding:2px 5px;border-radius:4px;font-size:11px;text-align:right;" +
        "appearance:textfield;-moz-appearance:textfield;";
      numInp.addEventListener("wheel",   e => e.stopPropagation(), { passive: true });
      numInp.addEventListener("keydown", e => e.stopPropagation());
      sl.addEventListener("input", () => {
        const v = parseFloat(sl.value); numInp.value = v.toFixed(dec); setter(v);
      });
      numInp.addEventListener("change", () => {
        let v = parseFloat(numInp.value);
        if (isNaN(v)) { numInp.value = parseFloat(sl.value).toFixed(dec); return; }
        v = Math.max(min, Math.min(max, v));
        numInp.value = v.toFixed(dec); sl.value = v; setter(v);
      });
      slRow.append(sl, numInp);
      wrap.appendChild(slRow);
      rightPanel.appendChild(wrap);
    }

    mkSlider("particleSize", 1, 20, 0.5,
      () => tempParticle.size,
      v  => { tempParticle.size = v; notifyParticle(); });
    mkSlider("particleSpread", 0, 5, 0.1,
      () => tempParticle.spread,
      v  => { tempParticle.spread = v; notifyParticle(); });

    // ---- 全体の強さ ----
    {
      const wrap = el("div", { style: "margin-bottom:14px;" });
      wrap.appendChild(el("div", { style: "font-size:11px;color:#99a;margin-bottom:3px;" }, t("globalStrength")));
      const slRow = el("div", { style: "display:flex;align-items:center;gap:6px;" });

      const sl = document.createElement("input");
      sl.type = "range"; sl.min = 0.1; sl.max = 3.0; sl.step = 0.05; sl.value = tempParticle.globalStrength;
      sl.style.cssText = "flex:1;height:14px;accent-color:#4a90d9;cursor:pointer;min-width:60px;";
      sl.addEventListener("wheel", e => e.stopPropagation(), { passive: true });

      const numInp = document.createElement("input");
      numInp.type = "number"; numInp.min = 0.1; numInp.max = 3.0; numInp.step = 0.05;
      numInp.value = parseFloat(tempParticle.globalStrength).toFixed(2);
      numInp.style.cssText =
        "width:56px;background:#111;border:1px solid #444;color:#ddd;" +
        "padding:2px 5px;border-radius:4px;font-size:11px;text-align:right;" +
        "appearance:textfield;-moz-appearance:textfield;";
      numInp.addEventListener("wheel",   e => e.stopPropagation(), { passive: true });
      numInp.addEventListener("keydown", e => e.stopPropagation());

      sl.addEventListener("input", () => {
        const v = parseFloat(sl.value); numInp.value = v.toFixed(2); tempParticle.globalStrength = v; notifyParticle();
      });
      numInp.addEventListener("change", () => {
        let v = parseFloat(numInp.value);
        if (isNaN(v)) { numInp.value = parseFloat(sl.value).toFixed(2); return; }
        v = Math.max(0.1, Math.min(3.0, v));
        numInp.value = v.toFixed(2); sl.value = v; tempParticle.globalStrength = v; notifyParticle();
      });

      slRow.append(sl, numInp);
      wrap.appendChild(slRow);
      rightPanel.appendChild(wrap);
    }

    // ---- 光条の伸び（star_warp 専用） ----
    mkSlider("starStretch", 0, 6, 0.1,
      () => tempParticle.starStretch,
      v  => { tempParticle.starStretch = v; notifyParticle(); });

    // ---- 固定回転角度 ----
    const rotWrap = el("div", { style: "margin-bottom:12px;" });
    rotWrap.appendChild(
      el("div", { style: "font-size:11px;color:#99a;margin-bottom:4px;" }, t("rotationAngle"))
    );
    const rotRow = el("div", { style: "display:flex;align-items:center;gap:6px;" });

    const rotSl = document.createElement("input");
    rotSl.type = "range"; rotSl.min = 0; rotSl.max = 360; rotSl.step = 1;
    rotSl.value = tempParticle.rotation;
    rotSl.style.cssText = "flex:1;height:14px;accent-color:#4a90d9;cursor:pointer;min-width:60px;";
    rotSl.addEventListener("wheel", e => e.stopPropagation(), { passive: true });

    const rotNum = document.createElement("input");
    rotNum.type = "number"; rotNum.min = 0; rotNum.max = 360; rotNum.step = 1;
    rotNum.value = tempParticle.rotation;
    rotNum.style.cssText =
      "width:56px;background:#111;border:1px solid #444;color:#ddd;" +
      "padding:2px 5px;border-radius:4px;font-size:11px;text-align:right;" +
      "appearance:textfield;-moz-appearance:textfield;";
    rotNum.addEventListener("wheel",   e => e.stopPropagation(), { passive: true });
    rotNum.addEventListener("keydown", e => e.stopPropagation());

    rotSl.addEventListener("input", () => {
      const v = parseInt(rotSl.value); rotNum.value = v; tempParticle.rotation = v; notifyParticle();
    });
    rotNum.addEventListener("change", () => {
      let v = parseInt(rotNum.value);
      if (isNaN(v)) { rotNum.value = rotSl.value; return; }
      v = Math.max(0, Math.min(360, v));
      rotNum.value = v; rotSl.value = v; tempParticle.rotation = v; notifyParticle();
    });

    rotRow.append(rotSl, rotNum);
    rotWrap.appendChild(rotRow);
    rightPanel.appendChild(rotWrap);

    // ---- ランダム系チェックボックス ----
    function mkCheckRow(labelKey, descKey, getter, setter) {
      const wrap = el("div", { style: "margin-bottom:14px;" });
      wrap.appendChild(el("div", { style: "font-size:11px;color:#99a;margin-bottom:6px;" }, t(labelKey)));
      const row = el("div", { style: "display:flex;align-items:center;gap:8px;" });
      const chk = document.createElement("input");
      chk.type    = "checkbox";
      chk.checked = getter();
      chk.style.cssText = "width:16px;height:16px;cursor:pointer;accent-color:#4a90d9;flex-shrink:0;";
      chk.addEventListener("change", () => setter(chk.checked));
      row.append(
        chk,
        el("span", { style: "font-size:12px;color:#ccc;line-height:1.4;" }, t(descKey))
      );
      wrap.appendChild(row);
      return wrap;
    }

    rightPanel.appendChild(mkCheckRow(
      "randomRotation", "randomRotationDesc",
      () => tempParticle.randomRotation,
      v => { tempParticle.randomRotation = v; notifyParticle(); }
    ));
    rightPanel.appendChild(mkCheckRow(
      "randomScale", "randomScaleDesc",
      () => tempParticle.randomScale,
      v => { tempParticle.randomScale = v; notifyParticle(); }
    ));

    rightPanel.appendChild(el("div", {
      style: "font-size:10px;color:#556;margin-top:6px;line-height:1.6;border-top:1px solid #222;padding-top:8px;",
    }, t("particleSettingsNote")));
  }

  // ---- モーション設定パネル ----
  function buildMotionPanel() {
    rightPanel.replaceChildren();

    rightPanel.appendChild(el("div", {
      style: "font-size:14px;font-weight:bold;color:#ffccaa;padding-bottom:5px;" +
             "border-bottom:1px solid #333;margin-bottom:4px;",
    }, t("motionSettings")));
    rightPanel.appendChild(el("div", {
      style: "font-size:11px;color:#778;margin-bottom:14px;",
    }, t("particleMotionDesc")));

    const MOTION_PARAMS_DEF = [
      { key: "turbulence", labelKey: "paramTurbulence", min: 0,    max: 5,    step: 0.1, def: 0 },
      { key: "turbFreq",   labelKey: "paramTurbFreq",   min: 0.1,  max: 10,   step: 0.1, def: 1 },
      { key: "windX",      labelKey: "paramWindX",       min: -200, max: 200,  step: 1,   def: 0 },
      { key: "windY",      labelKey: "paramWindY",       min: -200, max: 200,  step: 1,   def: 0 },
      { key: "swirl",      labelKey: "paramSwirl",       min: -5,   max: 5,    step: 0.1, def: 0 },
    ];

    if (!tempParticle.motionParams) tempParticle.motionParams = { ..._defMotion };

    for (const p of MOTION_PARAMS_DEF) {
      const rowWrap = el("div", { style: "margin-bottom:10px;" });
      rowWrap.appendChild(el("div", { style: "font-size:11px;color:#99a;margin-bottom:3px;" }, t(p.labelKey)));
      const slRow = el("div", { style: "display:flex;align-items:center;gap:6px;" });

      const curVal = tempParticle.motionParams[p.key] ?? p.def;
      const dec = p.step < 0.1 ? 2 : (p.step < 1 ? 1 : 0);

      const sl = document.createElement("input");
      sl.type = "range"; sl.min = p.min; sl.max = p.max; sl.step = p.step; sl.value = curVal;
      sl.style.cssText = "flex:1;height:14px;accent-color:#4a90d9;cursor:pointer;min-width:60px;";
      sl.addEventListener("wheel", e => e.stopPropagation(), { passive: true });

      const numInp = document.createElement("input");
      numInp.type = "number"; numInp.min = p.min; numInp.max = p.max; numInp.step = p.step;
      numInp.value = parseFloat(curVal).toFixed(dec);
      numInp.style.cssText =
        "width:56px;background:#111;border:1px solid #444;color:#ddd;" +
        "padding:2px 5px;border-radius:4px;font-size:11px;text-align:right;" +
        "appearance:textfield;-moz-appearance:textfield;";
      numInp.addEventListener("wheel",   e => e.stopPropagation(), { passive: true });
      numInp.addEventListener("keydown", e => e.stopPropagation());

      sl.addEventListener("input", () => {
        const v = parseFloat(sl.value);
        numInp.value = v.toFixed(dec);
        tempParticle.motionParams[p.key] = v;
        notifyParticle();
      });
      numInp.addEventListener("change", () => {
        let v = parseFloat(numInp.value);
        if (isNaN(v)) { numInp.value = parseFloat(sl.value).toFixed(dec); return; }
        v = Math.max(p.min, Math.min(p.max, v));
        numInp.value = v.toFixed(dec); sl.value = v;
        tempParticle.motionParams[p.key] = v;
        notifyParticle();
      });

      slRow.append(sl, numInp);
      rowWrap.appendChild(slRow);
      rightPanel.appendChild(rowWrap);
    }
  }

  // ---- マルチタブ: 左ペイン（保存済みレシピ〔プリセット〕一覧のみ） ----
  const multiPresetListWrapEl = el("div");
  multiListEl.append(multiPresetListWrapEl);

  async function loadMultiPresetsOnce() {
    if (multiPresetsLoaded) return;
    multiPresetListWrapEl.replaceChildren(
      el("div", { style: "font-size:11px;color:#667;padding:8px 10px;" }, t("loadingPresets"))
    );
    multiPresets = (await onLoadMultiPresets?.()) ?? [];
    multiPresetsLoaded = true;
  }

  function refreshMultiPresetList() {
    multiPresetListWrapEl.replaceChildren();
    if (multiPresets.length === 0) {
      multiPresetListWrapEl.appendChild(
        el("div", { style: "font-size:11px;color:#667;padding:8px 10px;" }, t("multiPresetListEmpty"))
      );
      return;
    }
    for (const preset of multiPresets) {
      const row = el("div", {
        style: "display:flex;align-items:center;justify-content:space-between;gap:4px;" +
               "padding:7px 12px;cursor:pointer;font-size:12px;user-select:none;",
      });
      const nameEl = el("span", {
        style: "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      }, preset.name);
      nameEl.addEventListener("click", () => {
        if (!confirm(t("confirmLoadPreset", preset.name))) return;
        loadMultiPreset(preset);
      });
      const delBtn = el("button", {
        style: "background:none;border:none;color:#a66;cursor:pointer;font-size:13px;padding:0 4px;flex-shrink:0;",
      }, "×");
      delBtn.onclick = async e => {
        e.stopPropagation();
        if (!confirm(t("confirmDeletePreset", preset.name))) return;
        await onDeleteMultiPreset?.(preset.name);
        multiPresets = multiPresets.filter(p => p.name !== preset.name);
        refreshMultiPresetList();
      };
      row.append(nameEl, delBtn);
      multiPresetListWrapEl.appendChild(row);
    }
  }

  function loadMultiPreset(preset) {
    tempStack      = JSON.parse(JSON.stringify(preset.stack));
    selectedRowIdx = 0;
    refreshMultiPanel();
    onPreview(JSON.parse(JSON.stringify(tempStack)));
  }

  // ---- マルチタブ: 右ペイン（スタック編集UI） ----
  function buildMultiPanel() {
    rightPanel.replaceChildren();

    rightPanel.appendChild(el("div", {
      style: "font-size:11px;color:#778;padding-bottom:5px;border-bottom:1px solid #333;margin-bottom:10px;",
    }, t("multiStackDesc")));

    const stackListEl = el("div", {
      style: "max-height:220px;overflow-y:auto;border:1px solid #2a2a4a;border-radius:4px;margin-bottom:10px;",
    });
    const multiParamAreaEl = el("div", { style: "margin-bottom:10px;" });
    const toolbarEl = el("div", {
      style: "display:flex;gap:4px;flex-wrap:wrap;border-top:1px solid #2a2a4a;padding-top:8px;",
    });
    rightPanel.append(stackListEl, multiParamAreaEl, toolbarEl);

    function refreshStackList() {
      stackListEl.replaceChildren();
      tempStack.forEach((row, idx) => {
        const rowEl = el("div", {
          style: "display:flex;align-items:center;gap:6px;padding:5px 8px;cursor:pointer;" +
                 "border-bottom:1px solid #22223a;user-select:none;",
        });
        if (idx === selectedRowIdx) rowEl.style.background = "#2a2a5a";
        const toggleTri = el("span", { style: "width:12px;flex-shrink:0;color:#8ac0e0;" },
          idx === selectedRowIdx ? "▼" : "▶");
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = row.enabled !== false;
        chk.style.cssText = "width:14px;height:14px;cursor:pointer;accent-color:#4a90d9;flex-shrink:0;";
        chk.addEventListener("click", e => e.stopPropagation());
        chk.addEventListener("change", () => { row.enabled = chk.checked; notifyMultiPreview(); });
        const label = el("span", {
          style: "font-size:12px;color:#ccc;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
        }, row.type === "none" ? t("clickToAssignFilter") : t(FILTER_CATALOG[row.type]?.labelKey ?? "filterNoneLabel"));
        rowEl.append(toggleTri, chk, label);
        rowEl.addEventListener("click", () => {
          selectedRowIdx = idx;
          if (row.type === "none") {
            // 未割り当ての行を選ぶと、カタログで選べるようにフィルタータブへ切り替える
            setTab("filter");
            return;
          }
          refreshStackList();
          refreshMultiParamArea();
        });
        stackListEl.appendChild(rowEl);
      });
      highlightFilterCatalog(tempStack[selectedRowIdx]?.type ?? null);
    }

    function refreshMultiParamArea() {
      multiParamAreaEl.replaceChildren();
      const row = tempStack[selectedRowIdx];
      if (!row || row.type === "none") {
        multiParamAreaEl.appendChild(
          el("div", { style: "color:#666;font-size:12px;padding:8px 0;" }, t("clickToAssignFilter"))
        );
        return;
      }
      const def = FILTER_CATALOG[row.type];
      if (!def) return;
      renderFilterHeader(multiParamAreaEl, def);
      if (def.params.length === 0) {
        multiParamAreaEl.appendChild(
          el("div", { style: "color:#666;font-size:12px;padding:8px 0;" }, t("noParams"))
        );
        return;
      }
      renderParamRows(multiParamAreaEl, def, {
        getParam: k => row.params[k],
        setParam: (k, v) => { row.params[k] = v; notifyMultiPreview(); },
      });
    }

    function notifyMultiPreview() {
      onPreview(JSON.parse(JSON.stringify(tempStack)));
    }

    const addBtn = mkBtn("+", "#3a5a3a");
    addBtn.title = t("addFilterRow");
    addBtn.onclick = () => {
      tempStack.push({ type: "none", params: {}, enabled: true });
      selectedRowIdx = tempStack.length - 1;
      // フィルタータブ(カタログ)へ自動切替。既にフィルタータブなら単に再描画される。
      setTab("filter");
    };

    const removeBtn = mkBtn("−", "#5a3a3a");
    removeBtn.title = t("removeFilterRow");
    removeBtn.onclick = () => {
      if (tempStack.length <= 1) return;
      tempStack.splice(selectedRowIdx, 1);
      selectedRowIdx = Math.max(0, Math.min(selectedRowIdx, tempStack.length - 1));
      refreshStackList();
      refreshMultiParamArea();
      notifyMultiPreview();
    };

    const upBtn = mkBtn("▲", "#3a3a5a");
    upBtn.title = t("moveFilterUp");
    upBtn.onclick = () => {
      if (selectedRowIdx <= 0) return;
      [tempStack[selectedRowIdx - 1], tempStack[selectedRowIdx]] = [tempStack[selectedRowIdx], tempStack[selectedRowIdx - 1]];
      selectedRowIdx--;
      refreshStackList();
      notifyMultiPreview();
    };
    const downBtn = mkBtn("▼", "#3a3a5a");
    downBtn.title = t("moveFilterDown");
    downBtn.onclick = () => {
      if (selectedRowIdx >= tempStack.length - 1) return;
      [tempStack[selectedRowIdx + 1], tempStack[selectedRowIdx]] = [tempStack[selectedRowIdx], tempStack[selectedRowIdx + 1]];
      selectedRowIdx++;
      refreshStackList();
      notifyMultiPreview();
    };

    const savePresetBtn = mkBtn(t("savePreset"), "#3a5a7a");
    savePresetBtn.onclick = async () => {
      const name = prompt(t("presetNamePrompt"), "");
      if (!name) return;
      const stackCopy = JSON.parse(JSON.stringify(tempStack));
      await onSaveMultiPreset?.(name, stackCopy);
      const idx = multiPresets.findIndex(p => p.name === name);
      const entry = { name, stack: stackCopy };
      if (idx >= 0) multiPresets[idx] = entry; else multiPresets.push(entry);
      setTab("multi"); // 保存結果が一覧に反映されたことを見せる
    };

    toolbarEl.append(addBtn, removeBtn, upBtn, downBtn, savePresetBtn);

    refreshMultiPanel = () => { refreshStackList(); refreshMultiParamArea(); };
    refreshStackList();
    refreshMultiParamArea();
  }

  // ---- Footer ----
  const footer = el("div", {
    style: "display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:10px 14px;" +
           "background:#16213e;border-top:1px solid #333;flex-shrink:0;",
  });
  const clearBtn = mkBtn(t("clearFilters"), "#7a5a2a");
  clearBtn.onclick = () => {
    if (tempStack.length > 1) {
      tempStack.length = 1;
      selectedRowIdx = 0;
      refreshMultiPanel();
      onPreview(JSON.parse(JSON.stringify(tempStack)));
    }
  };
  const cancelBtn = mkBtn(t("cancel"), "#4a4a4a");
  cancelBtn.onclick = () => cleanup(false);
  const saveBtn = mkBtn(saveLabel ?? t("applyAndClose"), "#3a7a3a");
  saveBtn.onclick = () => {
    onSave(JSON.parse(JSON.stringify(tempStack)), { ...tempParticle });
    cleanup(true);
  };
  footer.append(clearBtn, cancelBtn, saveBtn);

  // ---- 組み立て ----
  body.append(leftPanel, centerPanel, rightPanel);
  if (topBar) dialog.append(header, topBar, body, footer);
  else        dialog.append(header, body, footer);
  overlay.appendChild(dialog);

  // ---- カタログでフィルターを選ぶと、選択中の行(selectedRowIdx)に即座に割り当てる ----
  // 右ペインは常にマルチのスタック編集UIのみなので、タブを行き来する必要はない。
  function assignSelectedRowType(key) {
    const def = FILTER_CATALOG[key];
    if (!def) return;
    const prevRow = tempStack[selectedRowIdx];
    const newParams = resolveParamsForType(key, def, [prevRow]);
    tempStack[selectedRowIdx] = { type: key, params: newParams, enabled: prevRow?.enabled ?? true };
    highlightFilterCatalog(key);
    refreshMultiPanel();
    onPreview(JSON.parse(JSON.stringify(tempStack)));
  }

  function selectParticle() {
    currentKey      = "particle_settings";
    lastParticleKey = "particle_settings";
    highlightParticleList("particle_settings");
    buildParticleParamPanel();
  }

  function selectParticleParams() {
    currentKey      = "particle_params";
    lastParticleKey = "particle_params";
    highlightParticleList("particle_params");
    buildParticleParamsPanel();
  }

  function selectParticleMotion() {
    currentKey      = "particle_motion";
    lastParticleKey = "particle_motion";
    highlightParticleList("particle_motion");
    buildMotionPanel();
  }

  // ---- クリーンアップ ----
  function cleanup(saved) {
    if (rafId) cancelAnimationFrame(rafId);
    if (!saved) {
      onPreview(origStack);
      onParticlePreview?.(null);
    }
    overlay.remove();
    onClose?.(saved);
  }

  // ---- 初期化 ----
  setTab("filter");
  startPreviewLoop();
  requestAnimationFrame(() => overlay.focus());

  return overlay;
}

// ================================================================
// UI ヘルパー (light_editor.js 互換)
// ================================================================
function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style") e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  if (text !== undefined) e.textContent = text;
  return e;
}

function mkBtn(label, bg) {
  const b = el("button", {
    style: "padding:4px 12px;background:" + bg + ";color:#fff;border:none;" +
           "border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold;white-space:nowrap;",
  }, label);
  b.addEventListener("mouseover", () => { b.style.opacity = "0.8"; });
  b.addEventListener("mouseout",  () => { b.style.opacity = "1"; });
  return b;
}

function mkCloseBtn(fn) {
  const b = el("button", {
    style: "background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:4px 8px;",
  }, "✕");
  b.onclick = fn;
  return b;
}
