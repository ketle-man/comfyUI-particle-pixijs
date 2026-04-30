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
};

// ---- エクスポート: ライブラリを開く ----
export function openFilterLibrary({ mainCanvas, filterSettings, particleSettings, onPreview, onSave, onParticlePreview }) {
  if (document.getElementById("filter-lib-modal")) return;
  document.body.appendChild(
    buildModal({ mainCanvas, filterSettings, particleSettings, onPreview, onSave, onParticlePreview })
  );
}

// ================================================================
// モーダル構築
// ================================================================
function buildModal({ mainCanvas, filterSettings, particleSettings, onPreview, onSave, onParticlePreview }) {
  const origSettings = JSON.parse(JSON.stringify(filterSettings));
  let   tempSettings = JSON.parse(JSON.stringify(filterSettings));

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
  };
  let tempParticle = JSON.parse(JSON.stringify(origParticle));
  const notifyParticle = () => onParticlePreview?.(JSON.parse(JSON.stringify(tempParticle)));

  let currentKey        = tempSettings.type || "none";
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
           "width:min(96vw,1000px);height:min(94vh,680px);display:flex;flex-direction:column;" +
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

  // ── 左パネル: リスト ──
  const leftPanel = el("div", {
    style: "width:160px;flex-shrink:0;overflow-y:auto;border-right:1px solid #2a2a4a;" +
           "background:#1a1a28;padding:6px 0;",
  });

  const filterItems = {};
  for (const [secId, secKey] of [["basic", "sectionBasic"], ["extra", "sectionExtra"]]) {
    leftPanel.appendChild(el("div", {
      style: "font-size:10px;color:#556;padding:8px 10px 3px;letter-spacing:0.06em;font-weight:bold;",
    }, t(secKey)));
    for (const [key, def] of Object.entries(FILTER_CATALOG)) {
      if (def.section !== secId) continue;
      const item = el("div", {
        style: "padding:7px 12px;cursor:pointer;font-size:12px;transition:background 0.1s;" +
               "border-left:3px solid transparent;user-select:none;",
      }, t(def.labelKey));
      item.addEventListener("mouseenter", () => { if (currentKey !== key) item.style.background = "#252545"; });
      item.addEventListener("mouseleave", () => { if (currentKey !== key) item.style.background = ""; });
      item.addEventListener("click", () => selectFilter(key));
      filterItems[key] = item;
      leftPanel.appendChild(item);
    }
  }

  // ---- パーティクル設定項目 ----
  leftPanel.appendChild(el("div", {
    style: "font-size:10px;color:#556;padding:8px 10px 3px;letter-spacing:0.06em;font-weight:bold;",
  }, t("sectionParticle")));
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
  leftPanel.appendChild(particleItem);

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
  leftPanel.appendChild(particleParamsItem);

  function highlightList(activeKey) {
    for (const [k, item] of Object.entries(filterItems)) {
      const sel = k === activeKey;
      item.style.background      = sel ? "#2a2a5a" : "";
      item.style.borderLeftColor = sel ? "#4a8adb" : "transparent";
      item.style.color           = sel ? "#aaccff" : "#ccc";
    }
    const pSel = activeKey === "particle_settings";
    particleItem.style.background      = pSel ? "#2a2a5a" : "";
    particleItem.style.borderLeftColor = pSel ? "#da8a4a" : "transparent";
    particleItem.style.color           = pSel ? "#ffccaa" : "#ccc";
    const ppSel = activeKey === "particle_params";
    particleParamsItem.style.background      = ppSel ? "#2a2a5a" : "";
    particleParamsItem.style.borderLeftColor = ppSel ? "#da8a4a" : "transparent";
    particleParamsItem.style.color           = ppSel ? "#ffccaa" : "#ccc";
  }

  // ── 中央パネル: プレビュー ──
  const centerPanel = el("div", {
    style: "flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
           "background:#111118;padding:16px;gap:10px;",
  });
  const previewCanvas = document.createElement("canvas");
  const _maxPrev = 320;
  const _mw = mainCanvas.width  || 512;
  const _mh = mainCanvas.height || 512;
  const _ratio = _mw / _mh;
  previewCanvas.width  = _ratio >= 1 ? _maxPrev : Math.round(_maxPrev * _ratio);
  previewCanvas.height = _ratio >= 1 ? Math.round(_maxPrev / _ratio) : _maxPrev;
  previewCanvas.style.cssText =
    "border-radius:6px;box-shadow:0 2px 16px rgba(0,0,0,0.7);" +
    "max-width:100%;max-height:calc(100% - 40px);object-fit:contain;";
  const previewCtx = previewCanvas.getContext("2d");
  const previewInfo = el("div", {
    style: "font-size:11px;color:#555;text-align:center;",
  }, t("previewInfo"));
  centerPanel.append(previewCanvas, previewInfo);

  let rafId = null;
  function startPreviewLoop() {
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

  // ---- フィルターパラメータパネル ----
  function buildParamPanel(key) {
    rightPanel.replaceChildren();
    const def = FILTER_CATALOG[key];
    if (!def) return;

    rightPanel.appendChild(el("div", {
      style: "font-size:14px;font-weight:bold;color:#e0e0ff;padding-bottom:5px;" +
             "border-bottom:1px solid #333;margin-bottom:4px;",
    }, t(def.labelKey)));
    rightPanel.appendChild(el("div", {
      style: "font-size:11px;color:#778;margin-bottom:10px;",
    }, t(def.descKey)));

    if (def.params.length === 0) {
      rightPanel.appendChild(
        el("div", { style: "color:#666;font-size:12px;padding:8px 0;" }, t("noParams"))
      );
      return;
    }

    for (const p of def.params) {
      const rowWrap = el("div", { style: "margin-bottom:10px;" });
      rowWrap.appendChild(el("div", { style: "font-size:11px;color:#99a;margin-bottom:3px;" }, t(p.labelKey)));

      if (p.type === "color") {
        const curVal   = tempSettings.params[p.key] ?? p.def;
        const colorInp = document.createElement("input");
        colorInp.type  = "color";
        colorInp.value = typeof curVal === "string" ? curVal : p.def;
        colorInp.style.cssText =
          "width:100%;height:28px;border:1px solid #333;cursor:pointer;border-radius:4px;";
        colorInp.addEventListener("input", () => {
          tempSettings.params[p.key] = colorInp.value;
          onPreview(JSON.parse(JSON.stringify(tempSettings)));
        });
        rowWrap.appendChild(colorInp);
      } else {
        const curVal = tempSettings.params[p.key] ?? p.def;
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

        const updateVal = v => {
          tempSettings.params[p.key] = v;
          onPreview(JSON.parse(JSON.stringify(tempSettings)));
        };
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
      rightPanel.appendChild(rowWrap);
    }
  }

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

    // ---- モーション設定 ----
    rightPanel.appendChild(el("div", {
      style: "font-size:12px;font-weight:bold;color:#aac8ff;margin-top:14px;margin-bottom:8px;" +
             "border-top:1px solid #2a2a4a;padding-top:10px;",
    }, t("motionSettings")));

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

  // ---- Footer ----
  const footer = el("div", {
    style: "display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:10px 14px;" +
           "background:#16213e;border-top:1px solid #333;flex-shrink:0;",
  });
  const cancelBtn = mkBtn(t("cancel"), "#4a4a4a");
  cancelBtn.onclick = () => cleanup(false);
  const saveBtn = mkBtn(t("applyAndClose"), "#3a7a3a");
  saveBtn.onclick = () => {
    onSave(JSON.parse(JSON.stringify(tempSettings)), { ...tempParticle });
    cleanup(true);
  };
  footer.append(cancelBtn, saveBtn);

  // ---- 組み立て ----
  body.append(leftPanel, centerPanel, rightPanel);
  dialog.append(header, body, footer);
  overlay.appendChild(dialog);

  // ---- フィルター選択 ----
  function selectFilter(key) {
    const def = FILTER_CATALOG[key];
    if (!def) return;
    currentKey = key;
    const newParams = {};
    for (const p of def.params) {
      newParams[p.key] = (key === origSettings.type && origSettings.params[p.key] !== undefined)
        ? origSettings.params[p.key]
        : (tempSettings.type === key && tempSettings.params[p.key] !== undefined)
          ? tempSettings.params[p.key]
          : p.def;
    }
    tempSettings = { type: key, params: newParams };
    highlightList(key);
    buildParamPanel(key);
    onPreview(JSON.parse(JSON.stringify(tempSettings)));
  }

  function selectParticle() {
    currentKey = "particle_settings";
    highlightList("particle_settings");
    buildParticleParamPanel();
  }

  function selectParticleParams() {
    currentKey = "particle_params";
    highlightList("particle_params");
    buildParticleParamsPanel();
  }

  // ---- クリーンアップ ----
  function cleanup(saved) {
    cancelAnimationFrame(rafId);
    if (!saved) {
      onPreview(origSettings);
      onParticlePreview?.(null);
    }
    overlay.remove();
  }

  // ---- 初期化 ----
  selectFilter(tempSettings.type || "none");
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
