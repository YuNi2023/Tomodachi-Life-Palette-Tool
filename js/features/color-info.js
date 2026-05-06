

function selectColor(r, g, b, px, py) {
  const hex = rgbToHex(r, g, b);
  const hsv = rgbToHsv(r, g, b);

  document.getElementById('selected-swatch').style.background = hex;
  document.getElementById('hex-val').textContent = hex;
  document.getElementById('rgb-val').textContent = `${r}, ${g}, ${b}`;
  document.getElementById('hsv-val').textContent = `${hsv.h}°, ${hsv.s}%, ${hsv.v}%`;

  const posEl = document.getElementById('pixel-pos');
  if (px >= 0 && py >= 0) {
    const label = (viewMode === 'converted') ? t('color.convertedPrefix') : '';
    posEl.textContent = `${label}X:${px + 1} Y:${py + 1}`;
  } else {
    posEl.textContent = t('color.hexInputPos');
  }

  let bestDist = Infinity, bestIdx = 0;
  PALETTE.forEach((p, i) => {
    const c = hexToRgb(p.h);
    const d = colorDist(r, g, b, c.r, c.g, c.b);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  });
  closestIdx = bestIdx;
  updatePaletteHighlight(bestIdx, bestDist);

  updateFullColorGuide(hsv, r, g, b);

  if (px >= 0) {
    lastSelPx = px;
    lastSelPy = py;
    drawSelectionOverlay(px, py);
  } else {

    lastSelPx = -1;
    lastSelPy = -1;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  }

  noSelectMsg.classList.add('hidden');
  colorInfo.classList.remove('hidden');
}

function buildPaletteGrid() {
  const grid = document.getElementById('palette-grid');
  if (!grid) return;
  grid.innerHTML = '';
  PALETTE.forEach((p, i) => {
    const cell = document.createElement('div');
    cell.className = 'palette-cell';
    cell.style.background = p.h;
    cell.title = `${p.h}\n${t('color.rowCol', { row: p.row + 1, col: p.col + 1 })}`;
    cell.dataset.idx = i;
    grid.appendChild(cell);
  });

  attachPaletteHover();
}

function updatePaletteHighlight(bestIdx, bestDist) {
  document.querySelectorAll('.palette-cell').forEach((cell, i) => {
    cell.classList.toggle('closest', i === bestIdx);
  });
  const best = PALETTE[bestIdx];
  document.getElementById('closest-swatch').style.background = best.h;
  document.getElementById('closest-hex').textContent = best.h.toUpperCase();
  document.getElementById('closest-pos').textContent = t('color.rowCol', { row: best.row + 1, col: best.col + 1 });
  document.getElementById('closest-dist').textContent = Math.round(bestDist) + t('color.distHint');

  // 言語切替時に再描画できるよう、最後の値を保持
  lastClosestIdx = bestIdx;
  lastClosestDist = bestDist;
}

let lastClosestIdx = null;
let lastClosestDist = null;

// 言語切替時の再描画
function refreshColorInfoLabels() {
  // パレットセルのtitleを再生成
  document.querySelectorAll('.palette-cell').forEach((cell, i) => {
    const p = PALETTE[i];
    if (p) cell.title = `${p.h}\n${t('color.rowCol', { row: p.row + 1, col: p.col + 1 })}`;
  });
  // 最も近い色の表示を再描画
  if (lastClosestIdx != null) {
    const best = PALETTE[lastClosestIdx];
    document.getElementById('closest-pos').textContent = t('color.rowCol', { row: best.row + 1, col: best.col + 1 });
    document.getElementById('closest-dist').textContent = Math.round(lastClosestDist) + t('color.distHint');
  }
  // pixel-posの "変換後 X:.. Y:.." も再描画
  const posEl = document.getElementById('pixel-pos');
  if (posEl && posEl.textContent && posEl.textContent !== '-') {
    // 元の数値が取れないので、convertedPrefixに依存する場合のみ更新
    // 簡易: viewMode==='converted' && lastSelPx>=0 のとき再生成
    if (typeof viewMode !== 'undefined' && viewMode === 'converted'
        && typeof lastSelPx !== 'undefined' && lastSelPx >= 0) {
      posEl.textContent = `${t('color.convertedPrefix')}X:${lastSelPx + 1} Y:${lastSelPy + 1}`;
    }
  }
}
