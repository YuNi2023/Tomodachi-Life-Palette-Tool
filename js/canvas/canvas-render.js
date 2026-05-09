

function setupCanvases() {
  renderPixelCanvas();
}

function renderPixelCanvas() {
  const src = getActiveData();
  if (!src) return;

  const w = src.width, h = src.height;
  pixelCanvas.width    = w * zoom;
  pixelCanvas.height   = h * zoom;
  overlayCanvas.width  = w * zoom;
  overlayCanvas.height = h * zoom;

  const ctx = pixelCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height);

  ctx.drawImage(src.originalCanvas, 0, 0, w * zoom, h * zoom);

  if (rulerEnabled) drawRulerCrosshair(ctx, w, h);

  zoomLabel.textContent = zoom + '×';

  rebuildRuler();

  if (hoverPaletteIdx >= 0) {
    drawHighlight(hoverPaletteIdx);
  } else if (lastSelPx >= 0) {
    drawSelectionOverlay(lastSelPx, lastSelPy);
  } else {
    clearOverlayWithGrid();
  }
}

function clearOverlayWithGrid() {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (gridEnabled) drawGridOverlay(ctx);
}

function drawGridOverlay(ctx) {
  const src = getActiveData();
  if (!src) return;
  const w = src.width, h = src.height;
  const W = w * zoom;
  const H = h * zoom;

  ctx.save();

  if (zoom >= 2) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 1; x < w; x++) {
      const px = Math.round(x * zoom) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
    }
    for (let y = 1; y < h; y++) {
      const py = Math.round(y * zoom) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
    }
    ctx.stroke();
  }

  const cxIdx = w / 2;
  const cyIdx = h / 2;
  ctx.strokeStyle = 'rgba(232, 90, 12, 0.55)';
  ctx.lineWidth = Math.max(1, zoom * 0.18);
  ctx.beginPath();
  for (let x = 8; x < w; x += 8) {
    if (x === cxIdx) continue;
    const px = Math.round(x * zoom) + 0.5;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
  }
  for (let y = 8; y < h; y += 8) {
    if (y === cyIdx) continue;
    const py = Math.round(y * zoom) + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(W, py);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(214, 64, 4, 0.92)';
  ctx.lineWidth = Math.max(2, zoom * 0.32);
  ctx.beginPath();
  const cxPx = Math.round(cxIdx * zoom) + 0.5;
  const cyPx = Math.round(cyIdx * zoom) + 0.5;
  if (w >= 2) {
    ctx.moveTo(cxPx, 0);
    ctx.lineTo(cxPx, H);
  }
  if (h >= 2) {
    ctx.moveTo(0, cyPx);
    ctx.lineTo(W, cyPx);
  }
  ctx.stroke();

  ctx.restore();
}

function drawRulerCrosshair(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(232, 90, 12, 0.55)';
  ctx.lineWidth = Math.max(1, zoom <= 2 ? 1 : 1.5);
  ctx.setLineDash([Math.max(3, zoom), Math.max(2, zoom * 0.5)]);

  ctx.beginPath();
  ctx.moveTo(cx * zoom, 0);
  ctx.lineTo(cx * zoom, h * zoom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, cy * zoom);
  ctx.lineTo(w * zoom, cy * zoom);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

const _RULER_NICE_STEPS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
const _RULER_MIN_TICK_PX = 26;

function rebuildRuler() {
  const stage = document.getElementById('canvas-stage');
  const top   = document.getElementById('ruler-top');
  const left  = document.getElementById('ruler-left');
  if (!stage || !top || !left) return;

  if (!rulerEnabled) {
    stage.classList.remove('ruler-on');
    top.innerHTML  = '';
    left.innerHTML = '';
    return;
  }

  const src = getActiveData();
  if (!src) return;
  const w = src.width;
  const h = src.height;

  stage.classList.add('ruler-on');

  let step = 1;
  for (const s of _RULER_NICE_STEPS) {
    step = s;
    if (s * zoom >= _RULER_MIN_TICK_PX) break;
  }

  const cxIdx = Math.floor(w / 2);
  const cyIdx = Math.floor(h / 2);

  top.style.width = (w * zoom) + 'px';
  let topHtml = '';
  for (let x = 0; x < w; x += step) {
    const isCenter = (x === cxIdx);
    const isMajor  = (x !== 0 && x % 8 === 0);
    const cls = ['ruler-tick'];
    if (x === 0)     cls.push('first');
    if (isCenter)    cls.push('center');
    else if (isMajor) cls.push('major');
    const centerPx = x * zoom + zoom / 2;
    topHtml += `<div class="${cls.join(' ')}" style="left:${centerPx}px">${x + 1}</div>`;
  }
  top.innerHTML = topHtml;

  left.style.height = (h * zoom) + 'px';
  let leftHtml = '';
  for (let y = 0; y < h; y += step) {
    const isCenter = (y === cyIdx);
    const isMajor  = (y !== 0 && y % 8 === 0);
    const cls = ['ruler-tick'];
    if (y === 0)     cls.push('first');
    if (isCenter)    cls.push('center');
    else if (isMajor) cls.push('major');
    const centerPx = y * zoom + zoom / 2;
    leftHtml += `<div class="${cls.join(' ')}" style="top:${centerPx}px">${y + 1}</div>`;
  }
  left.innerHTML = leftHtml;
}

function drawSelectionOverlay(px, py) {
  if (hoverPaletteIdx >= 0) return;

  clearOverlayWithGrid();

  const ctx = overlayCanvas.getContext('2d');
  const cellX = px * zoom;
  const cellY = py * zoom;
  const cellW = zoom;
  const cellH = zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(232, 90, 12, 0.7)';
  ctx.lineWidth = Math.max(1, Math.round(zoom * 0.08));
  ctx.setLineDash([Math.max(4, zoom * 0.3), Math.max(3, zoom * 0.2)]);
  ctx.beginPath();
  ctx.moveTo(0, cellY + cellH / 2);
  ctx.lineTo(overlayCanvas.width, cellY + cellH / 2);
  ctx.moveTo(cellX + cellW / 2, 0);
  ctx.lineTo(cellX + cellW / 2, overlayCanvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  const ringPad = Math.max(3, Math.round(zoom * 0.25));
  const lwOuter = Math.max(3, Math.round(zoom * 0.18));
  const lwInner = Math.max(2, Math.round(zoom * 0.12));

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = lwOuter + lwInner;
  ctx.strokeRect(
    cellX - ringPad,
    cellY - ringPad,
    cellW + ringPad * 2,
    cellH + ringPad * 2
  );

  ctx.strokeStyle = '#E85A0C';
  ctx.lineWidth = lwInner;
  ctx.strokeRect(
    cellX - ringPad,
    cellY - ringPad,
    cellW + ringPad * 2,
    cellH + ringPad * 2
  );
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellW - 1, cellH - 1);
  ctx.restore();
}

function toggleRuler() {
  rulerEnabled = !rulerEnabled;
  const btn = document.getElementById('ruler-btn');
  if (btn) btn.classList.toggle('active', rulerEnabled);
  renderPixelCanvas();
}

function toggleGrid() {
  gridEnabled = !gridEnabled;
  const btn = document.getElementById('grid-btn');
  if (btn) btn.classList.toggle('active', gridEnabled);
  try {
    localStorage.setItem(GRID_STORAGE_KEY, gridEnabled ? '1' : '0');
  } catch (_) {}
  renderPixelCanvas();
}

function initGrid() {
  let saved = false;
  try {
    saved = localStorage.getItem(GRID_STORAGE_KEY) === '1';
  } catch (_) {}
  gridEnabled = saved;
  const btn = document.getElementById('grid-btn');
  if (btn) btn.classList.toggle('active', gridEnabled);
}
