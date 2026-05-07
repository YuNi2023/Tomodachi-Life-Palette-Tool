

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

  if (zoom >= 2) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x++) {
      ctx.beginPath();
      ctx.moveTo(x * zoom, 0);
      ctx.lineTo(x * zoom, h * zoom);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * zoom);
      ctx.lineTo(w * zoom, y * zoom);
      ctx.stroke();
    }

    if (w >= 32 || h >= 32) {
      const step = (w >= 128 || h >= 128) ? 16 : 8;
      ctx.strokeStyle = 'rgba(232, 90, 12, 0.45)';
      ctx.lineWidth = Math.max(1, zoom * 0.18);
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x * zoom, 0);
        ctx.lineTo(x * zoom, h * zoom);
        ctx.stroke();
      }
      for (let y = step; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom);
        ctx.lineTo(w * zoom, y * zoom);
        ctx.stroke();
      }
    }
  }

  if (rulerEnabled) drawRuler(ctx, w, h);

  if (cellNumbersEnabled && viewMode === 'converted' && src.paletteMap) {
    drawCellNumbers(ctx, src);
  }

  zoomLabel.textContent = zoom + '×';

  if (hoverPaletteIdx >= 0) {
    drawHighlight(hoverPaletteIdx);
  } else if (lastSelPx >= 0) {
    drawSelectionOverlay(lastSelPx, lastSelPy);
  }
}

function drawRuler(ctx, w, h) {
  ctx.save();

  const cx = w / 2;
  const cy = h / 2;

  ctx.strokeStyle = 'rgba(232, 90, 12, 0.85)';
  ctx.lineWidth = Math.max(1, zoom <= 2 ? 1 : 2);
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

  if (zoom >= 8) {
    const fs = Math.min(Math.floor(zoom * 0.55), 11);
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = 0; x < w; x++) {
      const label = String(x + 1);
      const px = x * zoom + zoom / 2;
      const py = zoom / 2;
      const isCenter = (x === cx - 1 || x === cx);
      ctx.fillStyle = isCenter ? 'rgba(232, 90, 12, 0.9)' : 'rgba(255,255,255,0.75)';
      ctx.fillRect(px - fs * 0.55, py - fs * 0.65, fs * 1.1, fs * 1.3);
      ctx.fillStyle = isCenter ? '#fff' : '#333';
      ctx.fillText(label, px, py);
    }
    for (let y = 0; y < h; y++) {
      const label = String(y + 1);
      const px = zoom / 2;
      const py = y * zoom + zoom / 2;
      const isCenter = (y === cy - 1 || y === cy);
      ctx.fillStyle = isCenter ? 'rgba(232, 90, 12, 0.9)' : 'rgba(255,255,255,0.75)';
      ctx.fillRect(px - fs * 0.55, py - fs * 0.65, fs * 1.1, fs * 1.3);
      ctx.fillStyle = isCenter ? '#fff' : '#333';
      ctx.fillText(label, px, py);
    }
  } else if (zoom >= 4) {
    const px = cx * zoom;
    const py = cy * zoom;
    ctx.fillStyle = 'rgba(232, 90, 12, 0.95)';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', px, py);
  } else {
    const px = cx * zoom;
    const py = cy * zoom;
    ctx.fillStyle = 'rgba(232, 90, 12, 0.95)';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSelectionOverlay(px, py) {
  const ctx = overlayCanvas.getContext('2d');

  if (hoverPaletteIdx >= 0) return;

  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  ctx.strokeStyle = '#E85A0C';
  ctx.lineWidth = Math.max(2, zoom * 0.3);
  ctx.strokeRect(px * zoom, py * zoom, zoom, zoom);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px * zoom - 1, py * zoom - 1, zoom + 2, zoom + 2);
}

function toggleRuler() {
  rulerEnabled = !rulerEnabled;
  const btn = document.getElementById('ruler-btn');
  btn.classList.toggle('active', rulerEnabled);
  renderPixelCanvas();
}

function drawCellNumbers(ctx, src) {
  if (zoom < 12) return;
  const w = src.width, h = src.height;
  const map = src.paletteMap;
  if (!map) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fs1 = Math.max(9, Math.round(zoom * 0.62));
  const fs2 = Math.max(8, Math.round(zoom * 0.5));
  const lw1 = Math.max(2, Math.round(fs1 * 0.2));
  const lw2 = Math.max(2, Math.round(fs2 * 0.2));
  const font1 = `800 ${fs1}px "JetBrains Mono", "Courier New", monospace`;
  const font2 = `800 ${fs2}px "JetBrains Mono", "Courier New", monospace`;

  let curDigits = 0;
  let curWhite = null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = map[y * w + x];
      if (idx < 0) continue;
      const p = PALETTE[idx];
      const num = p.row * 12 + p.col + 1;
      const text = String(num);
      const digits = text.length;

      if (digits !== curDigits) {
        curDigits = digits;
        if (digits === 1) {
          ctx.font = font1;
          ctx.lineWidth = lw1;
        } else {
          ctx.font = font2;
          ctx.lineWidth = lw2;
        }
      }

      const r = parseInt(p.h.slice(1, 3), 16);
      const g = parseInt(p.h.slice(3, 5), 16);
      const b = parseInt(p.h.slice(5, 7), 16);

      const useWhite = pickTextColor(r, g, b);
      if (useWhite !== curWhite) {
        curWhite = useWhite;
        ctx.strokeStyle = useWhite ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.98)';
        ctx.fillStyle = useWhite ? '#FFFFFF' : '#000000';
      }

      const cx = x * zoom + (zoom >> 1);
      const cy = y * zoom + (zoom >> 1);

      ctx.strokeText(text, cx, cy);
      ctx.fillText(text, cx, cy);
    }
  }
  ctx.restore();
}

function pickTextColor(r, g, b) {
  const srgb = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  const contrastWhite = (1.0 + 0.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastWhite >= contrastBlack;
}
