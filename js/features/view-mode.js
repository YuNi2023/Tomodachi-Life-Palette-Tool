let _palRgbCache = null;
function getPaletteRgb() {
  if (!_palRgbCache) {
    _palRgbCache = PALETTE.map(p => hexToRgb(p.h));
  }
  return _palRgbCache;
}

function _clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

let _maxSafeCanvasDim = null;
function _detectSafeCanvasDim() {
  if (_maxSafeCanvasDim !== null) return _maxSafeCanvasDim;
  try {
    const c = document.createElement('canvas');
    c.width = 5000;
    c.height = 5000;
    const ctx = c.getContext('2d');
    if (!ctx) { _maxSafeCanvasDim = 3800; return _maxSafeCanvasDim; }
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, 2, 2);
    ctx.fillRect(4998, 4998, 2, 2);
    const p1 = ctx.getImageData(0, 0, 1, 1).data;
    const p2 = ctx.getImageData(4999, 4999, 1, 1).data;
    const ok = (p1[0] >= 250 && p1[1] < 10 && p1[2] < 10) &&
               (p2[0] >= 250 && p2[1] < 10 && p2[2] < 10);
    _maxSafeCanvasDim = ok ? 7000 : 3800;
  } catch (e) {
    _maxSafeCanvasDim = 3800;
  }
  return _maxSafeCanvasDim;
}

let _logoImageCache = null;
let _logoSafeForCanvas = null;
let _logoLoadPromise = null;

function _testLogoCanvasSafety(logo) {
  try {
    const test = document.createElement('canvas');
    test.width = 8;
    test.height = 8;
    const tctx = test.getContext('2d');
    tctx.drawImage(logo, 0, 0, 8, 8);
    test.toDataURL('image/png');
    return true;
  } catch (e) {
    return false;
  }
}

function _loadLogoSafe(src) {
  if (_logoLoadPromise) return _logoLoadPromise;

  _logoLoadPromise = (async () => {
    if (typeof fetch === 'function' && typeof createImageBitmap === 'function') {
      try {
        const res = await fetch(src);
        if (res.ok) {
          const blob = await res.blob();
          const bmp = await createImageBitmap(blob);
          if (_testLogoCanvasSafety(bmp)) {
            _logoImageCache = bmp;
            _logoSafeForCanvas = true;
            return bmp;
          }
        }
      } catch (e) {
        console.warn('logo fetch+createImageBitmap failed:', e);
      }
    }

    if (typeof fetch === 'function') {
      try {
        const res = await fetch(src);
        if (res.ok) {
          const blob = await res.blob();
          const objUrl = URL.createObjectURL(blob);
          const img = await new Promise(resolve => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => resolve(null);
            i.src = objUrl;
          });
          if (img && _testLogoCanvasSafety(img)) {
            _logoImageCache = img;
            _logoSafeForCanvas = true;
            return img;
          }
        }
      } catch (e) {
        console.warn('logo fetch+Image failed:', e);
      }
    }

    const existing = document.getElementById('branding-logo');
    if (existing) {
      const ready = await new Promise(resolve => {
        if (existing.complete) {
          resolve(existing.naturalWidth > 0 ? existing : null);
          return;
        }
        existing.addEventListener('load', () => resolve(existing), { once: true });
        existing.addEventListener('error', () => resolve(null), { once: true });
      });
      if (ready && _testLogoCanvasSafety(ready)) {
        _logoImageCache = ready;
        _logoSafeForCanvas = true;
        return ready;
      }
    }

    _logoSafeForCanvas = false;
    return null;
  })();

  return _logoLoadPromise;
}

function _drawFallbackLogo(ctx, cx, cy, radius) {
  const g = ctx.createRadialGradient(cx, cy - radius * 0.2, radius * 0.1, cx, cy, radius);
  g.addColorStop(0, '#FFB373');
  g.addColorStop(0.6, '#FF6B1A');
  g.addColorStop(1, '#E5530A');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  const dotR = radius * 0.18;
  const dotCenterX = cx;
  const dotCenterY = cy + radius * 0.05;
  const dotOffset = radius * 0.42;
  const dots = [
    { x: dotCenterX - dotOffset,            y: dotCenterY - dotOffset * 0.2, color: '#FFC93C' },
    { x: dotCenterX,                        y: dotCenterY - dotOffset * 0.6, color: '#FF8FA3' },
    { x: dotCenterX + dotOffset,            y: dotCenterY - dotOffset * 0.2, color: '#4ECDC4' },
    { x: dotCenterX - dotOffset * 0.6,      y: dotCenterY + dotOffset * 0.5, color: '#FFFFFF' },
    { x: dotCenterX + dotOffset * 0.6,      y: dotCenterY + dotOffset * 0.5, color: '#3A1F0A' },
  ];
  dots.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, dotR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,31,10,0.4)';
    ctx.lineWidth = Math.max(1, radius * 0.025);
    ctx.stroke();
  });
}

function _safeToBlob(canvas, resolve) {
  try {
    canvas.toBlob(b => {
      if (b) {
        resolve(b);
      } else {
        console.warn('canvas.toBlob returned null, trying toDataURL');
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const bin = atob(dataUrl.split(',')[1]);
          const len = bin.length;
          const arr = new Uint8Array(len);
          for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/png' }));
        } catch (e) {
          console.error('toDataURL fallback failed:', e);
          resolve(null);
        }
      }
    }, 'image/png');
  } catch (e) {
    console.error('canvas.toBlob threw:', e);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const bin = atob(dataUrl.split(',')[1]);
      const len = bin.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      resolve(new Blob([arr], { type: 'image/png' }));
    } catch (e2) {
      console.error('toDataURL fallback (after throw) failed:', e2);
      resolve(null);
    }
  }
}

function findNearestPaletteIdx(r, g, b, palRgb) {
  let bestIdx = 0, bestDist = Infinity;
  for (let k = 0; k < palRgb.length; k++) {
    const c = palRgb[k];
    const d = colorDist(r, g, b, c.r, c.g, c.b);
    if (d < bestDist) { bestDist = d; bestIdx = k; }
  }
  return bestIdx;
}

function convertImage(srcCanvas, srcWidth, srcHeight, gridSize, dither) {

  const aspect = srcWidth / srcHeight;
  let outW, outH;
  if (aspect >= 1) {
    outW = gridSize;
    outH = Math.max(1, Math.round(gridSize / aspect));
  } else {
    outH = gridSize;
    outW = Math.max(1, Math.round(gridSize * aspect));
  }

  const dsCanvas = document.createElement('canvas');
  dsCanvas.width  = outW;
  dsCanvas.height = outH;
  const dsCtx = dsCanvas.getContext('2d');
  dsCtx.imageSmoothingEnabled = true;
  dsCtx.imageSmoothingQuality = 'high';
  dsCtx.clearRect(0, 0, outW, outH);
  dsCtx.drawImage(srcCanvas, 0, 0, outW, outH);

  const imageData = dsCtx.getImageData(0, 0, outW, outH);
  const data = imageData.data;
  const palRgb = getPaletteRgb();
  const paletteMap = new Int16Array(outW * outH);

  if (dither) {

    const buf = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) buf[i] = data[i];

    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const i = (y * outW + x) * 4;
        const a = buf[i + 3];
        const p = y * outW + x;

        if (a < 10) {
          paletteMap[p] = -1;
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          continue;
        }

        const r = _clamp(buf[i],     0, 255);
        const g = _clamp(buf[i + 1], 0, 255);
        const b = _clamp(buf[i + 2], 0, 255);

        const idx = findNearestPaletteIdx(r, g, b, palRgb);
        paletteMap[p] = idx;
        const newC = palRgb[idx];

        data[i]     = newC.r;
        data[i + 1] = newC.g;
        data[i + 2] = newC.b;
        data[i + 3] = 255;

        const er = r - newC.r;
        const eg = g - newC.g;
        const eb = b - newC.b;

        _diffuse(buf, x + 1, y,     outW, outH, er, eg, eb, 7 / 16);
        _diffuse(buf, x - 1, y + 1, outW, outH, er, eg, eb, 3 / 16);
        _diffuse(buf, x,     y + 1, outW, outH, er, eg, eb, 5 / 16);
        _diffuse(buf, x + 1, y + 1, outW, outH, er, eg, eb, 1 / 16);
      }
    }
  } else {

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const a = data[i + 3];
      if (a < 10) {
        paletteMap[p] = -1;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
        continue;
      }
      const idx = findNearestPaletteIdx(data[i], data[i + 1], data[i + 2], palRgb);
      paletteMap[p] = idx;
      const newC = palRgb[idx];
      data[i]     = newC.r;
      data[i + 1] = newC.g;
      data[i + 2] = newC.b;
      data[i + 3] = 255;
    }
  }

  dsCtx.putImageData(imageData, 0, 0);

  const usedSet = new Set();
  for (let i = 0; i < paletteMap.length; i++) {
    const v = paletteMap[i];
    if (v >= 0) usedSet.add(v);
  }

  return {
    width: outW,
    height: outH,
    data: imageData.data,
    originalCanvas: dsCanvas,
    paletteMap,
    usedSet
  };
}

function _diffuse(buf, x, y, W, H, er, eg, eb, factor) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i]     += er * factor;
  buf[i + 1] += eg * factor;
  buf[i + 2] += eb * factor;
}

function getActiveData() {
  if (viewMode === 'converted' && convertedData) return convertedData;
  if (!imgData) return imgData;
  if (hsvAdjust.brightness === 0 && hsvAdjust.saturation === 0) return imgData;
  const adjusted = _getAdjustedSourceCanvas();
  if (!adjusted || adjusted === imgData.originalCanvas) return imgData;
  return {
    width: imgData.width,
    height: imgData.height,
    originalCanvas: adjusted,
  };
}

function brushPxLabel(g) {
  const TABLE = {
    8:   '32px',
    9:   '27px',
    13:  '19px',
    16:  '16px',
    20:  '13px',
    32:  '8px',
    37:  '7px',
    64:  '4px',
    85:  '3px',
    128: '2px',
    256: '1px',
  };
  if (TABLE[g]) return TABLE[g];
  const px = 256 / g;
  if (Number.isInteger(px)) return px + 'px';
  return px.toFixed(1) + 'px';
}

function updateBrushStatus() {
  const el = document.getElementById('brush-status');
  if (!el) return;
  const px = brushPxLabel(gridSize);
  let w, h;
  if (convertedData) {
    w = convertedData.width;
    h = convertedData.height;
  } else if (imgData) {
    const aspect = imgData.width / imgData.height;
    if (aspect >= 1) { w = gridSize; h = Math.max(1, Math.round(gridSize / aspect)); }
    else             { h = gridSize; w = Math.max(1, Math.round(gridSize * aspect)); }
  } else {
    w = gridSize; h = gridSize;
  }
  el.textContent = t('view.brushStatus', { px, w, h });
}

let hsvAdjust = { brightness: 0, saturation: 0 };

function _applyHsvAdjustment(srcCanvas, brightnessPct, saturationPct) {
  if (!srcCanvas) return srcCanvas;
  if (brightnessPct === 0 && saturationPct === 0) return srcCanvas;

  const out = document.createElement('canvas');
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const sCtx = srcCanvas.getContext('2d');
  const dCtx = out.getContext('2d');
  const img = sCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const d = img.data;

  const bMul = 1 + brightnessPct / 100;
  const sMul = 1 + saturationPct / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];

    r *= bMul; g *= bMul; b *= bMul;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * sMul;
    g = gray + (g - gray) * sMul;
    b = gray + (b - gray) * sMul;

    d[i]     = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  dCtx.putImageData(img, 0, 0);
  return out;
}

function _getAdjustedSourceCanvas() {
  if (!imgData) return null;
  if (hsvAdjust.brightness === 0 && hsvAdjust.saturation === 0) {
    return imgData.originalCanvas;
  }
  if (!imgData._adjustedCanvas ||
      imgData._adjustedKey !== `${hsvAdjust.brightness},${hsvAdjust.saturation}`) {
    imgData._adjustedCanvas = _applyHsvAdjustment(
      imgData.originalCanvas,
      hsvAdjust.brightness,
      hsvAdjust.saturation
    );
    imgData._adjustedKey = `${hsvAdjust.brightness},${hsvAdjust.saturation}`;
    imgData._paletteMap = null;
    imgData._paletteMapSrc = null;
  }
  return imgData._adjustedCanvas;
}

function _ensureOriginalPaletteMap() {
  if (!imgData) return null;
  const sourceCanvas = _getAdjustedSourceCanvas();
  if (!sourceCanvas) return null;
  if (imgData._paletteMap && imgData._paletteMapSrc === sourceCanvas) {
    return imgData._paletteMap;
  }
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d');
  const data = ctx.getImageData(0, 0, w, h).data;
  const map = new Int16Array(w * h);
  const palRgb = PALETTE.map(p => hexToRgb(p.h));
  const N = palRgb.length;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 128) { map[p] = -1; continue; }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let bestDist = Infinity, bestIdx = 0;
    for (let k = 0; k < N; k++) {
      const c = palRgb[k];
      const dr = r - c.r, dg = g - c.g, db = b - c.b;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; bestIdx = k; }
    }
    map[p] = bestIdx;
  }
  imgData._paletteMap = map;
  imgData._paletteMapSrc = sourceCanvas;
  return map;
}

function rebuildConvertedData() {
  if (!imgData) return;
  convertedData = convertImage(
    _getAdjustedSourceCanvas(),
    imgData.width,
    imgData.height,
    gridSize,
    ditherEnabled
  );

  if (viewMode === 'converted') {
    fitZoomToConverted();
    renderPixelCanvas();
    if (lastSelPx >= 0 && lastSelPx < convertedData.width &&
        lastSelPy >= 0 && lastSelPy < convertedData.height) {
      drawSelectionOverlay(lastSelPx, lastSelPy);
    } else {
      lastSelPx = -1;
      lastSelPy = -1;
      noSelectMsg.classList.remove('hidden');
      colorInfo.classList.add('hidden');
    }
  } else if (viewMode === 'original') {
    renderPixelCanvas();
  }

  rebuildRecipe();
  updateBrushStatus();
}

function fitZoomToConverted() {
  if (!convertedData) return;
  const max = Math.max(convertedData.width, convertedData.height);
  if (max <= 16)        zoom = 16;
  else if (max <= 24)   zoom = 12;
  else if (max <= 32)   zoom = 8;
  else if (max <= 48)   zoom = 8;
  else if (max <= 64)   zoom = 4;
  else if (max <= 128)  zoom = 4;
  else if (max <= 192)  zoom = 2;
  else                  zoom = 2;
}

function setViewMode(mode) {
  if (mode === viewMode) return;
  if (mode === 'converted' && !imgData) return;

  viewMode = mode;

  document.getElementById('view-original-btn').classList.toggle('active', mode === 'original');
  document.getElementById('view-converted-btn').classList.toggle('active', mode === 'converted');
  document.getElementById('convert-controls').classList.remove('hidden');
  const dlBtn = document.getElementById('download-btn');
  if (dlBtn) dlBtn.classList.toggle('hidden', mode !== 'converted');
  const dlPbnBtn = document.getElementById('download-pbn-btn');
  if (dlPbnBtn) dlPbnBtn.classList.toggle('hidden', mode !== 'converted');
  // ★ステップ2追加: 8×8拡大ボタンも変換モード時のみ表示
  const blockZoomBtn = document.getElementById('block-zoom-btn');
  if (blockZoomBtn) blockZoomBtn.classList.toggle('hidden', mode !== 'converted');

  if (mode === 'converted') {
    if (!convertedData) rebuildConvertedData();
    fitZoomToConverted();
  } else {
    if (imgData.width <= 16 && imgData.height <= 16)        zoom = 16;
    else if (imgData.width <= 32 && imgData.height <= 32)   zoom = 8;
    else if (imgData.width <= 64 && imgData.height <= 64)   zoom = 4;
    else if (imgData.width <= 128 && imgData.height <= 128) zoom = 2;
    else                                                    zoom = 1;
  }

  updateImgInfo();

  hoverPaletteIdx = -1;
  lastSelPx = -1;
  lastSelPy = -1;
  noSelectMsg.classList.remove('hidden');
  colorInfo.classList.add('hidden');

  renderPixelCanvas();
  rebuildRecipe();
  updateBrushStatus();
}

function updateImgInfo() {
  if (!imgData) return;
  if (viewMode === 'converted' && convertedData) {
    imgInfoEl.textContent = t('view.imgInfoConverted', {
      cw: convertedData.width, ch: convertedData.height,
      sw: imgData.width,        sh: imgData.height
    });
  } else {
    let txt = t('view.imgInfoOriginal', {
      w: imgData.width, h: imgData.height,
      total: imgData.width * imgData.height
    });
    if (imgData.width === 16 && imgData.height === 16) {
      txt += t('view.stampPaintReady');
    }
    if (imgData.cropped) {
      txt += t('view.stampCropped');
    }
    imgInfoEl.textContent = txt;
  }
}

function attachConvertControls() {
  document.getElementById('view-original-btn').addEventListener('click', () => setViewMode('original'));
  document.getElementById('view-converted-btn').addEventListener('click', () => setViewMode('converted'));

  _loadLogoSafe('./assets/favicon.png');

  document.querySelectorAll('.brush-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const newSize = parseInt(btn.dataset.size, 10);
      if (newSize === gridSize) return;
      gridSize = newSize;
      document.querySelectorAll('.brush-pill').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.size, 10) === gridSize);
      });
      rebuildConvertedData();
      updateImgInfo();
    });
  });

  document.querySelectorAll('.brush-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      document.querySelectorAll('.brush-mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === mode);
      });
      document.querySelectorAll('.brush-row').forEach(grp => {
        grp.classList.toggle('hidden', grp.dataset.mode !== mode);
      });
    });
  });

  const ditherEl = document.getElementById('dither-toggle');
  if (ditherEl) {
    ditherEl.addEventListener('change', () => {
      ditherEnabled = ditherEl.checked;
      rebuildConvertedData();
    });
  }

  const pbnGridEl = document.getElementById('pbn-grid-toggle');
  if (pbnGridEl) {
    try {
      pbnGridEl.checked = localStorage.getItem('spoito_pbn_grid') === '1';
    } catch (e) {}
    pbnGridEl.addEventListener('change', () => {
      try {
        localStorage.setItem('spoito_pbn_grid', pbnGridEl.checked ? '1' : '0');
      } catch (e) {}
    });
  }

  const brSlider = document.getElementById('brightness-slider');
  const brValue  = document.getElementById('brightness-value');
  const saSlider = document.getElementById('saturation-slider');
  const saValue  = document.getElementById('saturation-value');
  const hsvReset = document.getElementById('hsv-reset-btn');

  function _onHsvChange() {
    if (imgData) {
      imgData._adjustedCanvas = null;
      imgData._adjustedKey = null;
      imgData._paletteMap = null;
      imgData._paletteMapSrc = null;
    }
    rebuildConvertedData();
  }

  if (brSlider && brValue) {
    brSlider.addEventListener('input', () => {
      hsvAdjust.brightness = parseInt(brSlider.value, 10);
      brValue.textContent = (hsvAdjust.brightness > 0 ? '+' : '') + hsvAdjust.brightness;
    });
    brSlider.addEventListener('change', _onHsvChange);
  }

  if (saSlider && saValue) {
    saSlider.addEventListener('input', () => {
      hsvAdjust.saturation = parseInt(saSlider.value, 10);
      saValue.textContent = (hsvAdjust.saturation > 0 ? '+' : '') + hsvAdjust.saturation;
    });
    saSlider.addEventListener('change', _onHsvChange);
  }

  if (hsvReset) {
    hsvReset.addEventListener('click', () => {
      hsvAdjust.brightness = 0;
      hsvAdjust.saturation = 0;
      if (brSlider) { brSlider.value = '0'; }
      if (saSlider) { saSlider.value = '0'; }
      if (brValue)  { brValue.textContent = '0'; }
      if (saValue)  { saValue.textContent = '0'; }
      _onHsvChange();
    });
  }

  const dlBtn = document.getElementById('download-btn');
  if (dlBtn) {
    dlBtn.addEventListener('click', downloadConvertedImage);
  }

  const dlPbnBtn = document.getElementById('download-pbn-btn');
  if (dlPbnBtn) {
    dlPbnBtn.addEventListener('click', downloadPaintByNumbersImage);
  }

  // ★ステップ2追加: 8×8拡大表示モーダルの初期化
  attachBlockZoomControls();
}

function downloadConvertedImage() {
  if (viewMode !== 'converted' || !convertedData) return;

  const sourceCanvas = convertedData.originalCanvas;
  if (!sourceCanvas) return;

  composeBrandedImage(sourceCanvas, convertedData.width, convertedData.height)
    .then(blob => {
      if (!blob) {
        console.error('composeBrandedImage が null を返しました');
        alert(t('view.exportFail'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date();
      const ymd = ts.getFullYear() + String(ts.getMonth() + 1).padStart(2, '0') + String(ts.getDate()).padStart(2, '0');
      const hms = String(ts.getHours()).padStart(2, '0') + String(ts.getMinutes()).padStart(2, '0') + String(ts.getSeconds()).padStart(2, '0');
      const dither = ditherEnabled ? '_dither' : '';
      a.download = `supoito_${convertedData.width}x${convertedData.height}${dither}_${ymd}_${hms}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    })
    .catch(err => {
      console.error('ドット絵生成エラー:', err);
      alert(t('view.exportFail'));
    });
}

function composeBrandedImage(srcCanvas, srcW, srcH) {
  return new Promise((resolve, reject) => {
    try {
      let scale = 1;
      const minOutW = 512;
      const maxOutW = 1024;
      if (srcW * scale < minOutW) {
        scale = Math.ceil(minOutW / srcW);
      }
      if (srcW * scale > maxOutW) {
        scale = Math.max(1, Math.floor(maxOutW / srcW));
      }

      const imgW = srcW * scale;
      const imgH = srcH * scale;

      const bandH = Math.round(imgW * 0.19);
      const padX  = Math.round(imgW * 0.04);

      const outW = imgW;
      const outH = imgH + bandH;

      const out = document.createElement('canvas');
      out.width  = outW;
      out.height = outH;
      const ctx = out.getContext('2d');

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outW, imgH);
      ctx.drawImage(srcCanvas, 0, 0, srcW, srcH, 0, 0, imgW, imgH);

      const grad = ctx.createLinearGradient(0, imgH, 0, outH);
      grad.addColorStop(0, '#FFE8CF');
      grad.addColorStop(1, '#FFD9A8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, imgH, outW, bandH);

      ctx.fillStyle = '#FF6B1A';
      ctx.fillRect(0, imgH, outW, Math.max(3, Math.round(bandH * 0.05)));

      const logoSize = Math.round(bandH * 0.78);
      const logoY = imgH + Math.round((bandH - logoSize) / 2);
      const logoX = padX;

      ctx.imageSmoothingEnabled = true;
      const textX = logoX + logoSize + Math.round(bandH * 0.22);

      const titleSize = Math.round(bandH * 0.38);
      const subSize   = Math.round(bandH * 0.18);
      const urlSize   = Math.round(bandH * 0.16);

      ctx.fillStyle = '#3A1F0A';
      ctx.font = `800 ${titleSize}px "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const titleY = imgH + Math.round(bandH * 0.42);
      ctx.fillText('すぽいと帳', textX, titleY);

      ctx.fillStyle = '#8C5A30';
      ctx.font = `700 ${subSize}px "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic", sans-serif`;
      const subY = imgH + Math.round(bandH * 0.66);
      ctx.fillText('トモダチコレクション わくわく生活用', textX, subY);

      ctx.fillStyle = '#E5530A';
      ctx.font = `700 ${urlSize}px "JetBrains Mono", "SF Mono", monospace`;
      const urlY = imgH + Math.round(bandH * 0.90);
      ctx.fillText('yu08083.github.io/Tomodachi-Life-Palette-Tool', textX, urlY);

      const stampText = `${srcW}×${srcH}`;
      ctx.fillStyle = '#E5530A';
      ctx.font = `800 ${subSize}px "JetBrains Mono", "SF Mono", monospace`;
      const stampW = ctx.measureText(stampText).width;
      ctx.fillText(stampText, outW - padX - stampW, subY);

      _loadLogoSafe('./assets/favicon.png').then(logoImg => {
        const cx = logoX + logoSize / 2;
        const cy = logoY + logoSize / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, logoSize / 2 + 4, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.restore();

        let drewImage = false;
        if (logoImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, logoSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          try {
            ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
            drewImage = true;
          } catch (e) {}
          ctx.restore();
        }
        if (!drewImage) {
          _drawFallbackLogo(ctx, cx, cy, logoSize / 2);
        }
        _safeToBlob(out, resolve);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function downloadPaintByNumbersImage() {
  if (viewMode !== 'converted' || !convertedData) return;

  const maxSide = Math.max(convertedData.width, convertedData.height);
  if (maxSide >= 128) {
    const ok = confirm(t('view.pbnConfirm', {
      w: convertedData.width,
      h: convertedData.height
    }));
    if (!ok) return;
  }

  const pbnGridEl = document.getElementById('pbn-grid-toggle');
  const opts = { emphasizeGrid: !!(pbnGridEl && pbnGridEl.checked) };

  composePaintByNumbers(convertedData, opts)
    .then(blob => {
      if (!blob) {
        console.error('composePaintByNumbers が null を返しました');
        alert(t('view.exportFail'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date();
      const ymd = ts.getFullYear() + String(ts.getMonth() + 1).padStart(2, '0') + String(ts.getDate()).padStart(2, '0');
      const hms = String(ts.getHours()).padStart(2, '0') + String(ts.getMinutes()).padStart(2, '0') + String(ts.getSeconds()).padStart(2, '0');
      a.download = `supoito_pbn_${convertedData.width}x${convertedData.height}_${ymd}_${hms}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    })
    .catch(err => {
      console.error('番号塗り絵生成エラー:', err);
      alert(t('view.exportFail'));
    });
}

function _pbnComputeUsedList(d) {
  const map = d.paletteMap;
  const used = new Set();
  for (let i = 0; i < map.length; i++) if (map[i] >= 0) used.add(map[i]);
  const list = [...used].sort((a, b) => {
    const pa = PALETTE[a], pb = PALETTE[b];
    return (pa.row * 12 + pa.col) - (pb.row * 12 + pb.col);
  });
  const idxToNum = new Map();
  list.forEach(idx => {
    const p = PALETTE[idx];
    idxToNum.set(idx, p.row * 12 + p.col + 1);
  });
  return { usedList: list, idxToNum };
}

function _pbnComputeLayout(w, h, usedCount, options) {
  // ★ステップ1: optionsで強調ON時に上・左のマージンを確保
  const opts = options || {};
  const emphasize = !!opts.emphasizeGrid;

  const maxSide = Math.max(w, h);
  let cellPx;
  if (maxSide <= 32)       cellPx = 48;
  else if (maxSide <= 64)  cellPx = 40;
  else if (maxSide <= 128) cellPx = 32;
  else                     cellPx = 28;

  const legendCols = Math.min(4, usedCount);
  const legendRows = Math.ceil(usedCount / legendCols);

  const SAFE_DIM = _detectSafeCanvasDim();
  const dimsAt = (cp) => {
    const cu = Math.max(48, cp * 1.5);
    const axisM = emphasize ? Math.round(cu * 0.55) : 0;
    const px = Math.round(cu * 0.6) + axisM;
    const hh = Math.round(cu * 1.2) + axisM;
    const bh = Math.round(cu * 1.6);
    const lih = Math.round(cu * 0.7);
    const lh = legendRows * lih + Math.round(cu * 0.3);
    return { ow: w * cp + px * 2, oh: hh + h * cp + lh + bh };
  };
  let ds = dimsAt(cellPx);
  while (cellPx > 8 && (ds.ow > SAFE_DIM || ds.oh > SAFE_DIM)) {
    cellPx--;
    ds = dimsAt(cellPx);
  }

  const imgW = w * cellPx;
  const imgH = h * cellPx;
  const chromeUnit = Math.max(48, cellPx * 1.5);
  const axisMargin = emphasize ? Math.round(chromeUnit * 0.55) : 0;
  const padX    = Math.round(chromeUnit * 0.6) + axisMargin;
  const headerH = Math.round(chromeUnit * 1.2) + axisMargin;
  const bandH   = Math.round(chromeUnit * 1.6);
  const legendItemH = Math.round(chromeUnit * 0.7);
  const legendH = legendRows * legendItemH + Math.round(chromeUnit * 0.3);
  const outW = imgW + padX * 2;
  const outH = headerH + imgH + legendH + bandH;

  return {
    cellPx, imgW, imgH, chromeUnit, padX, headerH, bandH,
    legendCols, legendRows, legendItemH, legendH,
    outW, outH,
    offsetX: padX,
    offsetY: headerH,
    axisMargin,
    emphasizeGrid: emphasize,
  };
}

function _pbnDrawHeader(ctx, layout, w, h, usedCount) {
  const { padX, headerH, chromeUnit, outW } = layout;
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#3A1F0A';
  ctx.font = `800 ${Math.round(chromeUnit * 0.5)}px "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(t('view.numberedHeader2'), padX, headerH / 2);

  const sizeText = t('view.numberedSize', { w, h, n: usedCount });
  ctx.font = `700 ${Math.round(chromeUnit * 0.34)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#9C7553';
  ctx.textAlign = 'right';
  ctx.fillText(sizeText, outW - padX, headerH / 2);
  ctx.textAlign = 'left';
}

function _pbnDrawCells(ctx, layout, d, idxToNum) {
  const { offsetX, offsetY, cellPx } = layout;
  const w = d.width, h = d.height;
  const map = d.paletteMap;
  const numFontSize = Math.round(cellPx * 0.42);
  ctx.font = `800 ${numFontSize}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = map[y * w + x];
      const cx = offsetX + x * cellPx;
      const cy = offsetY + y * cellPx;

      if (idx < 0) {
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(cx, cy, cellPx, cellPx);
        continue;
      }
      const palHex = PALETTE[idx].h;
      ctx.fillStyle = palHex;
      ctx.fillRect(cx, cy, cellPx, cellPx);

      const numStr = String(idxToNum.get(idx)).padStart(2, '0');
      const rgb = hexToRgb(palHex);
      const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
      const textColor = luma < 140 ? '#FFFFFF' : '#1A0F05';
      const haloColor = luma < 140 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';

      ctx.lineWidth = Math.max(2, Math.round(numFontSize * 0.18));
      ctx.strokeStyle = haloColor;
      ctx.strokeText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
      ctx.fillStyle = textColor;
      ctx.fillText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
    }
  }
}

function _pbnDrawGridLines(ctx, layout, w, h, options) {
  const { offsetX, offsetY, imgW, imgH, cellPx } = layout;
  const emphasize = options && options.emphasizeGrid;

  ctx.strokeStyle = 'rgba(58, 31, 10, 0.55)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x++) {
    ctx.beginPath();
    ctx.moveTo(offsetX + x * cellPx + 0.5, offsetY);
    ctx.lineTo(offsetX + x * cellPx + 0.5, offsetY + imgH);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y++) {
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + y * cellPx + 0.5);
    ctx.lineTo(offsetX + imgW, offsetY + y * cellPx + 0.5);
    ctx.stroke();
  }

  if (emphasize) {
    const sub = (typeof gridSubdivision === 'number' && gridSubdivision === 16) ? 16 : 8;
    const cxIdx = w / 2;
    const cyIdx = h / 2;

    ctx.strokeStyle = 'rgba(232, 90, 12, 0.95)';
    ctx.lineWidth = Math.max(2.5, cellPx * 0.12);
    for (let x = sub; x < w; x += sub) {
      if (x === cxIdx) continue;
      ctx.beginPath();
      ctx.moveTo(offsetX + x * cellPx + 0.5, offsetY);
      ctx.lineTo(offsetX + x * cellPx + 0.5, offsetY + imgH);
      ctx.stroke();
    }
    for (let y = sub; y < h; y += sub) {
      if (y === cyIdx) continue;
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + y * cellPx + 0.5);
      ctx.lineTo(offsetX + imgW, offsetY + y * cellPx + 0.5);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = emphasize ? 'rgba(214, 64, 4, 1)' : '#FF8F4D';
  ctx.lineWidth = emphasize ? Math.max(3.5, cellPx * 0.18) : 2;
  const midX = offsetX + (w / 2) * cellPx;
  const midY = offsetY + (h / 2) * cellPx;
  if (!emphasize) ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(midX, offsetY);
  ctx.lineTo(midX, offsetY + imgH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(offsetX, midY);
  ctx.lineTo(offsetX + imgW, midY);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ★ステップ1+修正版: 8×8ブロックごとにA1,B2などのラベルを各ブロック中央に薄く描画
//   ラベル文字数(2〜4文字)に応じてフォントサイズを自動縮小し、必ずブロック内に収める
function _pbnDrawBlockLabels(ctx, layout, w, h) {
  if (!layout.emphasizeGrid) return;
  const { offsetX, offsetY, cellPx } = layout;
  const blockSize = 8;
  const cols = Math.ceil(w / blockSize);
  const rows = Math.ceil(h / blockSize);
  const fullBlockPx = blockSize * cellPx;
  // ベースのフォントサイズ(2文字想定 例:"A1"のときの基準)
  const baseFontSize = Math.max(10, Math.round(fullBlockPx * 0.55));

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const startX = bx * blockSize;
      const startY = by * blockSize;
      // 端のブロックは半端なサイズになりうる
      const endX = Math.min(startX + blockSize, w);
      const endY = Math.min(startY + blockSize, h);
      const blockActualPx = (endX - startX) * cellPx; // このブロックの実際の幅
      const centerX = offsetX + ((startX + endX) / 2) * cellPx;
      const centerY = offsetY + ((startY + endY) / 2) * cellPx;
      // 列ラベル: 0=A, 25=Z, 26=AA, 27=AB...
      const colLabel = bx < 26
        ? String.fromCharCode(65 + bx)
        : 'A' + String.fromCharCode(65 + bx - 26);
      const label = colLabel + (by + 1);

      // ★追加: ラベルがブロック幅をはみ出さないようフォントサイズを動的調整
      //   ブロック幅の92%以内に文字列が収まるようにする
      const availableWidth = blockActualPx * 0.92;
      let fontSize = baseFontSize;
      ctx.font = `900 ${fontSize}px "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic", sans-serif`;
      const measured = ctx.measureText(label).width;
      if (measured > availableWidth) {
        // 比例縮小(下限8pxで読めなくならないようにする)
        fontSize = Math.max(8, Math.floor(fontSize * availableWidth / measured));
        ctx.font = `900 ${fontSize}px "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic", sans-serif`;
      }

      // 白アウトライン+黒塗りの2重描画(暗いセル/明るいセルどちらでも薄く読める)
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.10));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.strokeText(label, centerX, centerY);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.fillText(label, centerX, centerY);
    }
  }
  ctx.restore();
}

// ★ステップ1: 10マスごとに座標番号を画像の上端・左端の外側に描画
function _pbnDrawAxisNumbers(ctx, layout, w, h) {
  if (!layout.emphasizeGrid) return;
  const { offsetX, offsetY, cellPx } = layout;
  const interval = 10;

  ctx.save();
  const fontSize = Math.max(12, Math.min(28, Math.round(cellPx * 0.5)));
  ctx.font = `800 ${fontSize}px "JetBrains Mono", "SF Mono", monospace`;
  ctx.fillStyle = '#5C3A1A';

  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  for (let x = interval; x <= w; x += interval) {
    const drawX = offsetX + (x - 0.5) * cellPx;
    const drawY = offsetY - Math.max(4, Math.round(cellPx * 0.2));
    ctx.fillText(String(x), drawX, drawY);
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let y = interval; y <= h; y += interval) {
    const drawX = offsetX - Math.max(4, Math.round(cellPx * 0.2));
    const drawY = offsetY + (y - 0.5) * cellPx;
    ctx.fillText(String(y), drawX, drawY);
  }
  ctx.restore();
}

function _pbnDrawLegend(ctx, layout, usedList, idxToNum) {
  const { offsetX, offsetY, imgH, padX, outW, chromeUnit, legendCols, legendItemH } = layout;
  const legendY0 = offsetY + imgH + Math.round(chromeUnit * 0.3);
  ctx.fillStyle = '#FF6B1A';
  ctx.fillRect(padX, legendY0 - 4, outW - padX * 2, 2);

  const colW = (outW - padX * 2) / legendCols;
  ctx.font = `700 ${Math.round(chromeUnit * 0.32)}px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  usedList.forEach((idx, n) => {
    const numStr = String(idxToNum.get(idx)).padStart(2, '0');
    const col = n % legendCols;
    const row = Math.floor(n / legendCols);
    const x = padX + col * colW;
    const y = legendY0 + row * legendItemH + legendItemH / 2;
    const p = PALETTE[idx];

    const swSize = Math.round(legendItemH * 0.6);
    ctx.fillStyle = p.h;
    ctx.fillRect(x, y - swSize / 2, swSize, swSize);
    ctx.strokeStyle = '#3A1F0A';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - swSize / 2 + 0.5, swSize - 1, swSize - 1);

    ctx.fillStyle = '#FF6B1A';
    ctx.font = `800 ${Math.round(chromeUnit * 0.34)}px "JetBrains Mono", monospace`;
    ctx.fillText(numStr, x + swSize + 8, y);

    const numW = ctx.measureText(numStr).width;
    ctx.fillStyle = '#3A1F0A';
    ctx.font = `700 ${Math.round(chromeUnit * 0.28)}px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif`;
    ctx.fillText(t('color.rowCol', { row: p.row + 1, col: p.col + 1 }), x + swSize + 8 + numW + 8, y);
  });
}

function _pbnDrawFooterText(ctx, layout) {
  const { offsetY, imgH, legendH, bandH, padX, outW } = layout;
  const bandY = offsetY + imgH + legendH;
  const bandGrad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  bandGrad.addColorStop(0, '#FFE8CF');
  bandGrad.addColorStop(1, '#FFD9A8');
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, bandY, outW, bandH);
  ctx.fillStyle = '#FF6B1A';
  ctx.fillRect(0, bandY, outW, Math.max(3, Math.round(bandH * 0.05)));

  const logoSize = Math.round(bandH * 0.78);
  const textX = padX + logoSize + Math.round(bandH * 0.22);

  ctx.fillStyle = '#3A1F0A';
  ctx.font = `800 ${Math.round(bandH * 0.34)}px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('すぽいと帳', textX, bandY + bandH * 0.45);

  ctx.fillStyle = '#8C5A30';
  ctx.font = `700 ${Math.round(bandH * 0.18)}px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif`;
  ctx.fillText('トモダチコレクション わくわく生活用', textX, bandY + bandH * 0.70);

  ctx.fillStyle = '#E5530A';
  ctx.font = `700 ${Math.round(bandH * 0.17)}px "JetBrains Mono", monospace`;
  ctx.fillText('yu08083.github.io/Tomodachi-Life-Palette-Tool', textX, bandY + bandH * 0.92);

  return { bandY, logoSize, logoX: padX, logoY: bandY + (bandH - logoSize) / 2 };
}

function _pbnDrawFooterLogo(ctx, footerInfo) {
  const { logoX, logoY, logoSize } = footerInfo;
  return _loadLogoSafe('./assets/favicon.png').then(logoImg => {
    const cx = logoX + logoSize / 2;
    const cy = logoY + logoSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, logoSize / 2 + 4, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    let drewImage = false;
    if (logoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      try {
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        drewImage = true;
      } catch (e) {}
      ctx.restore();
    }
    if (!drewImage) {
      _drawFallbackLogo(ctx, cx, cy, logoSize / 2);
    }
  });
}

function composePaintByNumbers(d, options) {
  return new Promise((resolve, reject) => {
    try {
      const opts = options || {};
      const w = d.width, h = d.height;

      const { usedList, idxToNum } = _pbnComputeUsedList(d);
      const layout = _pbnComputeLayout(w, h, usedList.length, opts);

      const out = document.createElement('canvas');
      out.width = layout.outW;
      out.height = layout.outH;
      const ctx = out.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, layout.outW, layout.outH);

      _pbnDrawHeader(ctx, layout, w, h, usedList.length);
      _pbnDrawCells(ctx, layout, d, idxToNum);
      _pbnDrawGridLines(ctx, layout, w, h, opts);
      _pbnDrawBlockLabels(ctx, layout, w, h);
      _pbnDrawAxisNumbers(ctx, layout, w, h);
      _pbnDrawLegend(ctx, layout, usedList, idxToNum);
      const footerInfo = _pbnDrawFooterText(ctx, layout);
      _pbnDrawFooterLogo(ctx, footerInfo).then(() => {
        _safeToBlob(out, resolve);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// ===========================================================================
// ★★★ ステップ2追加: 8×8 拡大表示モーダル機能 ★★★
// 番号塗り絵を1ブロック(8×8マス)単位で拡大表示し、4方向ボタンで隣接ブロックへ移動
// ===========================================================================

const BLOCK_ZOOM_SIZE = 8; // 1ブロックのサイズ(マス単位)

// 8×8拡大表示の状態管理
let _blockZoomState = {
  blockX: 0, // 現在表示中のブロック列(0始まり)
  blockY: 0, // 現在表示中のブロック行(0始まり)
  cols: 0,   // 全体のブロック列数(横方向)
  rows: 0,   // 全体のブロック行数(縦方向)
};

// 列インデックス→ラベル文字列(0=A, 1=B,..., 25=Z, 26=AA, 27=AB...)
function _blockColLabel(col) {
  if (col < 26) return String.fromCharCode(65 + col);
  return 'A' + String.fromCharCode(65 + col - 26);
}

// 8×8拡大モーダルを開く(現在の変換データから(0,0)ブロックを表示)
function openBlockZoomModal() {
  // 安全チェック: 変換データが存在しない場合はエラー
  if (viewMode !== 'converted' || !convertedData) {
    alert('先に「ゲームパレット変換」タブを開いてください');
    return;
  }
  const w = convertedData.width;
  const h = convertedData.height;
  // ブロック数を計算(端は半端あり)
  _blockZoomState.cols = Math.ceil(w / BLOCK_ZOOM_SIZE);
  _blockZoomState.rows = Math.ceil(h / BLOCK_ZOOM_SIZE);
  // 開いた直後は左上ブロック(A1)から
  _blockZoomState.blockX = 0;
  _blockZoomState.blockY = 0;

  // 全ブロック数を表示
  const totalEl = document.getElementById('block-zoom-total');
  if (totalEl) totalEl.textContent = String(_blockZoomState.cols * _blockZoomState.rows);

  // ★修正: モーダルを先に開いてから描画する(描画にはモーダルの実際の幅が必要)
  if (typeof openModal === 'function') {
    openModal('modal-block-zoom');
  }
  // 次のフレームで描画(モーダルがDOMに反映されてから幅を計測)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => renderBlockZoom());
  } else {
    setTimeout(renderBlockZoom, 0);
  }
}

// 指定方向にブロック移動(端では何もしない)
// dx,dy: -1, 0, +1 のいずれか
function moveBlockZoom(dx, dy) {
  const nx = _blockZoomState.blockX + dx;
  const ny = _blockZoomState.blockY + dy;
  // 範囲外なら何もしない
  if (nx < 0 || nx >= _blockZoomState.cols) return;
  if (ny < 0 || ny >= _blockZoomState.rows) return;
  _blockZoomState.blockX = nx;
  _blockZoomState.blockY = ny;
  renderBlockZoom();
}

// 端のブロック判定で4方向ボタンの有効/無効を更新
function _updateBlockZoomNavState() {
  const { blockX, blockY, cols, rows } = _blockZoomState;
  const setDisabled = (id, disabled) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  };
  setDisabled('block-zoom-up',    blockY <= 0);
  setDisabled('block-zoom-down',  blockY >= rows - 1);
  setDisabled('block-zoom-left',  blockX <= 0);
  setDisabled('block-zoom-right', blockX >= cols - 1);
}

// 現在のブロックをcanvasに描画
function renderBlockZoom() {
  const canvas = document.getElementById('block-zoom-canvas');
  if (!canvas || !convertedData) return;
  const ctx = canvas.getContext('2d');
  const w = convertedData.width;
  const h = convertedData.height;
  const map = convertedData.paletteMap;

  // 表示するセルの範囲(端のブロックは半端あり)
  const startX = _blockZoomState.blockX * BLOCK_ZOOM_SIZE;
  const startY = _blockZoomState.blockY * BLOCK_ZOOM_SIZE;
  const endX = Math.min(startX + BLOCK_ZOOM_SIZE, w);
  const endY = Math.min(startY + BLOCK_ZOOM_SIZE, h);
  const cellsW = endX - startX;
  const cellsH = endY - startY;

  // ★重要修正: ビューポート基準で安定計算する
  //   親要素のclientWidthに依存させると、スクロールバーやflexレイアウトの
  //   再計算で値が揺らぎ、canvasサイズと表示サイズが微妙にずれて
  //   グリッド線がピクセル丸めで部分的に消える問題が発生する
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  // 横方向: ビューポートの〜90% または 640px の小さい方(モーダル外余白を除いた値)
  const targetW = Math.min(640, Math.max(280, viewportW - 100));
  // 縦方向: ビューポートの55% (ヘッダーとナビボタンのスペースを残す)
  const targetH = Math.max(280, viewportH * 0.55);
  const target = Math.floor(Math.min(targetW, targetH));
  const maxDim = Math.max(cellsW, cellsH);
  const cellPx = Math.max(8, Math.floor(target / maxDim));
  const canvasW = cellPx * cellsW;
  const canvasH = cellPx * cellsH;

  // 内部解像度と表示解像度を完全一致(1:1)にしてCSSスケーリングを発生させない
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasH + 'px';

  // ★重要修正: canvas.widthによる暗黙のクリアに加え、明示的にもクリアして安全を期す
  ctx.clearRect(0, 0, canvasW, canvasH);
  // 線の角を整える(線が部分的に消える描画パスのバグを防ぐ)
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.imageSmoothingEnabled = false;

  // 背景クリア
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // パレット番号を計算(全画像に対する番号付与)
  const { idxToNum } = _pbnComputeUsedList(convertedData);

  // 各セル描画(色+番号)
  const numFontSize = Math.round(cellPx * 0.42);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `800 ${numFontSize}px "JetBrains Mono", monospace`;

  for (let y = 0; y < cellsH; y++) {
    for (let x = 0; x < cellsW; x++) {
      const srcX = startX + x;
      const srcY = startY + y;
      const idx = map[srcY * w + srcX];
      const cx = x * cellPx;
      const cy = y * cellPx;

      if (idx < 0) {
        // 透明セル: 薄いグレーで塗る
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(cx, cy, cellPx, cellPx);
        continue;
      }
      // パレットの色で塗る
      const palHex = PALETTE[idx].h;
      ctx.fillStyle = palHex;
      ctx.fillRect(cx, cy, cellPx, cellPx);

      // パレット番号(2桁0埋め)を中央に描画
      const num = idxToNum.get(idx);
      const numStr = String(num).padStart(2, '0');
      // セルの明暗で文字色を切り替え
      const rgb = hexToRgb(palHex);
      const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
      const textColor = luma < 140 ? '#FFFFFF' : '#1A0F05';
      const haloColor = luma < 140 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(2, Math.round(numFontSize * 0.18));
      ctx.strokeStyle = haloColor;
      ctx.strokeText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
      ctx.fillStyle = textColor;
      ctx.fillText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
    }
  }

  // グリッド線
  ctx.strokeStyle = 'rgba(58, 31, 10, 0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= cellsW; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellPx + 0.5, 0);
    ctx.lineTo(i * cellPx + 0.5, canvasH);
    ctx.stroke();
  }
  for (let i = 0; i <= cellsH; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellPx + 0.5);
    ctx.lineTo(canvasW, i * cellPx + 0.5);
    ctx.stroke();
  }

  // 現在位置表示更新(A1, B2など)
  const posEl = document.getElementById('block-zoom-current');
  if (posEl) {
    posEl.textContent = _blockColLabel(_blockZoomState.blockX) + (_blockZoomState.blockY + 1);
  }

  // 各方向ボタンの有効/無効を更新
  _updateBlockZoomNavState();
}

// 8×8拡大表示モーダル関連のイベントを初期化(attachConvertControlsから呼ばれる)
function attachBlockZoomControls() {
  // 拡大表示ボタン
  const openBtn = document.getElementById('block-zoom-btn');
  if (openBtn) openBtn.addEventListener('click', openBlockZoomModal);

  // 4方向ナビゲーションボタン
  const upBtn = document.getElementById('block-zoom-up');
  const dnBtn = document.getElementById('block-zoom-down');
  const lfBtn = document.getElementById('block-zoom-left');
  const rtBtn = document.getElementById('block-zoom-right');
  if (upBtn) upBtn.addEventListener('click', () => moveBlockZoom(0, -1));
  if (dnBtn) dnBtn.addEventListener('click', () => moveBlockZoom(0, 1));
  if (lfBtn) lfBtn.addEventListener('click', () => moveBlockZoom(-1, 0));
  if (rtBtn) rtBtn.addEventListener('click', () => moveBlockZoom(1, 0));

  // キーボードの矢印キーでも操作可能(モーダル表示中のみ)
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modal-block-zoom');
    if (!modal || modal.classList.contains('hidden')) return;
    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); moveBlockZoom(0, -1); break;
      case 'ArrowDown':  e.preventDefault(); moveBlockZoom(0, 1);  break;
      case 'ArrowLeft':  e.preventDefault(); moveBlockZoom(-1, 0); break;
      case 'ArrowRight': e.preventDefault(); moveBlockZoom(1, 0);  break;
    }
  });
}
