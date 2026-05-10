// ===========================================================================
// paint-mode.js
// 制作アシスト機能の画面とロジック
// 番号塗り絵風の画面でセルをクリックして塗り済みフラグをトグル
// 塗り進捗をリアルタイムにlocalStorageに保存
// ===========================================================================

// 制作モードの状態(描画用にメモリ展開した配列を保持)
let _paintState = {
  work:        null,  // 現在編集中の作品オブジェクト(workProgressから取得)
  cellPx:      1,
  canvasW:     0,
  canvasH:     0,
  showNumbers: false,
  paletteMap:  null,  // Int16Array (展開済み)
  paintedMap:  null,  // Uint8Array (展開済み, 0=未塗り 1=塗り済み)
  idxToNum:    null,  // Map<paletteIdx, displayNum>
  returnTo:    null,  // 終了時に戻るセクションID
  // ★段階2追加: 表示モードと8×8拡大用の状態
  viewMode:    'full',  // 'full' (全体) | 'zoom' (8×8拡大)
  zoomBlockX:  0,       // 8×8拡大表示中の現在ブロック(列)
  zoomBlockY:  0,       // 8×8拡大表示中の現在ブロック(行)
  zoomCols:    0,       // 全体の列ブロック数
  zoomRows:    0,       // 全体の行ブロック数
  zoomCellPx:  1,       // 8×8拡大時のセルピクセルサイズ
};

const PAINT_BG_COLOR          = '#FFFFFF';
const PAINT_TRANSPARENT_COLOR = '#F5F5F5';
const PAINT_DONE_COLOR        = '#D0D0D0'; // 塗り済みセルの色(灰色)
const PAINT_BLOCK_SIZE        = 8;         // 1ブロック=8×8マス

// ===== 公開関数 =====

// 制作モード開始(現在のconvertedDataから新規作品を作る)
function paintModeStartFromCurrent() {
  // 変換モードでないと困る
  if (typeof viewMode !== 'undefined' && viewMode !== 'converted') {
    alert('「ゲームパレット変換」モードに切り替えてから開始してください。');
    return;
  }
  if (typeof convertedData === 'undefined' || !convertedData) {
    alert('先に画像を読み込んで変換してください。');
    return;
  }
  const work = workProgressCreateFromCurrent();
  if (!work) {
    alert('作品の作成に失敗しました。');
    return;
  }
  _paintState.returnTo = 'main-content';
  paintModeOpen(work);
}

// 既存の作品IDを指定して開く(再開用)
function paintModeOpenById(id) {
  const work = workProgressGet(id);
  if (!work) {
    alert('作品が見つかりません。');
    return;
  }
  _paintState.returnTo = 'upload-section';
  paintModeOpen(work);
}

// 作品オブジェクトで制作モード画面に入る
function paintModeOpen(work) {
  _paintState.work = work;
  _paintState.paletteMap = workProgressUnpackPaletteMap(work.paletteMap);
  _paintState.paintedMap = workProgressUnpackPaintedMap(
    work.paintedMap, work.convertedWidth * work.convertedHeight
  );
  _buildIdxToNum();

  // ★段階2追加: 表示モードと8×8拡大状態を初期化
  _paintState.viewMode = 'full';
  _paintState.zoomBlockX = 0;
  _paintState.zoomBlockY = 0;
  _paintState.zoomCols = Math.ceil(work.convertedWidth / PAINT_BLOCK_SIZE);
  _paintState.zoomRows = Math.ceil(work.convertedHeight / PAINT_BLOCK_SIZE);

  // 他のセクションを非表示にし、paint-sectionだけ表示
  const hideIds = ['upload-section', 'crop-section', 'main-content', 'notice-section'];
  hideIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const paintSec = document.getElementById('paint-section');
  if (paintSec) paintSec.classList.remove('hidden');

  // ヘッダーに作品名表示
  const nameEl = document.getElementById('paint-work-name');
  if (nameEl) nameEl.textContent = work.name;

  // ★段階2追加: 表示モードトグルUIを初期化(全体表示)
  paintModeSetViewMode('full');
  // 8×8拡大時のブロック総数表示も更新
  _paintModeUpdateZoomPositionDisplay();

  paintModeRender();
  paintModeUpdateProgress();
  paintModeRenderColorList();   // ★段階2追加
  paintModeUpdateCompletion();  // ★段階2追加
  window.scrollTo(0, 0);
}

// 制作モード終了(進捗はクリックごとに保存済みなので追加保存不要)
function paintModeExit() {
  const returnTo = _paintState.returnTo;
  _paintState.work = null;
  _paintState.paletteMap = null;
  _paintState.paintedMap = null;
  _paintState.idxToNum = null;

  const paintSec = document.getElementById('paint-section');
  if (paintSec) paintSec.classList.add('hidden');

  // notice-sectionは常時表示なので戻す
  const notice = document.getElementById('notice-section');
  if (notice) notice.classList.remove('hidden');

  // 戻り先のセクションを表示
  // imgDataがあって変換済みなら main-content に戻れる
  if (returnTo === 'main-content'
      && typeof imgData !== 'undefined' && imgData
      && typeof convertedData !== 'undefined' && convertedData) {
    const main = document.getElementById('main-content');
    if (main) main.classList.remove('hidden');
  } else {
    const upload = document.getElementById('upload-section');
    if (upload) upload.classList.remove('hidden');
  }

  // 作品一覧を再描画(進捗が更新されているので)
  if (typeof worksListRender === 'function') worksListRender();
}

// ===== 内部関数 =====

function _buildIdxToNum() {
  const map = _paintState.paletteMap;
  const used = new Set();
  for (let i = 0; i < map.length; i++) {
    if (map[i] >= 0) used.add(map[i]);
  }
  const list = [...used].sort((a, b) => {
    return (PALETTE[a].row * 12 + PALETTE[a].col) - (PALETTE[b].row * 12 + PALETTE[b].col);
  });
  const idxToNum = new Map();
  list.forEach(idx => {
    idxToNum.set(idx, PALETTE[idx].row * 12 + PALETTE[idx].col + 1);
  });
  _paintState.idxToNum = idxToNum;
}

// ★段階2追加: 表示モードに応じたルーター
function paintModeRender() {
  if (_paintState.viewMode === 'zoom') {
    paintModeRenderZoom();
  } else {
    paintModeRenderFull();
  }
}

// キャンバスをフルレンダリング(全体表示モード)
function paintModeRenderFull() {
  const canvas = document.getElementById('paint-canvas');
  if (!canvas || !_paintState.work) return;
  const ctx = canvas.getContext('2d');
  const work = _paintState.work;
  const w = work.convertedWidth;
  const h = work.convertedHeight;

  // ビューポート基準で表示サイズを決定(8×8拡大モーダルと同じ理由で安定値を使う)
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const targetW = Math.min(720, Math.max(280, viewportW - 80));
  const targetH = Math.max(280, viewportH * 0.65);
  const target = Math.floor(Math.min(targetW, targetH));
  const cellPx = Math.max(2, Math.floor(target / Math.max(w, h)));
  const canvasW = cellPx * w;
  const canvasH = cellPx * h;
  const showNumbers = cellPx >= 14; // 14px未満では番号は読めないので非表示

  _paintState.cellPx = cellPx;
  _paintState.canvasW = canvasW;
  _paintState.canvasH = canvasH;
  _paintState.showNumbers = showNumbers;

  // 内部解像度=表示解像度で1:1に(8×8拡大モーダルで学んだ知見)
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasH + 'px';
  ctx.imageSmoothingEnabled = false;

  // クリア
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = PAINT_BG_COLOR;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 各セル描画
  _paintModeDrawAllCells(ctx);
  // グリッド線を上書き描画
  _paintModeDrawGridLines(ctx);
}

// 全セルを描画
function _paintModeDrawAllCells(ctx) {
  const work = _paintState.work;
  const w = work.convertedWidth;
  const h = work.convertedHeight;
  const cellPx = _paintState.cellPx;
  const showNumbers = _paintState.showNumbers;
  const paletteMap = _paintState.paletteMap;
  const paintedMap = _paintState.paintedMap;
  const idxToNum = _paintState.idxToNum;
  const numFontSize = Math.max(8, Math.round(cellPx * 0.42));

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = paletteMap[i];
      const cx = x * cellPx;
      const cy = y * cellPx;

      if (idx < 0) {
        // 透明セル
        ctx.fillStyle = PAINT_TRANSPARENT_COLOR;
        ctx.fillRect(cx, cy, cellPx, cellPx);
        continue;
      }

      if (paintedMap[i]) {
        // 塗り済み: 灰色
        ctx.fillStyle = PAINT_DONE_COLOR;
        ctx.fillRect(cx, cy, cellPx, cellPx);
        // チェックマーク(セルが大きい時のみ)
        if (cellPx >= 16) {
          ctx.font = `bold ${Math.round(cellPx * 0.55)}px sans-serif`;
          ctx.fillStyle = '#888888';
          ctx.fillText('✓', cx + cellPx / 2, cy + cellPx / 2 + 1);
        }
      } else {
        // 未塗り: パレット色 + 番号
        const palHex = PALETTE[idx].h;
        ctx.fillStyle = palHex;
        ctx.fillRect(cx, cy, cellPx, cellPx);

        if (showNumbers) {
          const numStr = String(idxToNum.get(idx)).padStart(2, '0');
          const rgb = hexToRgb(palHex);
          const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
          const textColor = luma < 140 ? '#FFFFFF' : '#1A0F05';
          const haloColor = luma < 140 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';
          ctx.font = `800 ${numFontSize}px "JetBrains Mono", monospace`;
          ctx.lineWidth = Math.max(2, Math.round(numFontSize * 0.18));
          ctx.strokeStyle = haloColor;
          ctx.strokeText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
          ctx.fillStyle = textColor;
          ctx.fillText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
        }
      }
    }
  }
}

// グリッド線を描画(細線+8×8の太線)
function _paintModeDrawGridLines(ctx) {
  const work = _paintState.work;
  const w = work.convertedWidth;
  const h = work.convertedHeight;
  const cellPx = _paintState.cellPx;
  const canvasW = _paintState.canvasW;
  const canvasH = _paintState.canvasH;

  // セルが小さすぎる時はグリッド省略
  if (cellPx < 4) return;

  // 通常のグリッド線
  ctx.strokeStyle = 'rgba(58, 31, 10, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= w; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellPx + 0.5, 0);
    ctx.lineTo(i * cellPx + 0.5, canvasH);
    ctx.stroke();
  }
  for (let i = 0; i <= h; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellPx + 0.5);
    ctx.lineTo(canvasW, i * cellPx + 0.5);
    ctx.stroke();
  }

  // 8×8の太線(画像サイズが16以上の時)
  if (w >= 16 || h >= 16) {
    ctx.strokeStyle = 'rgba(229, 83, 10, 0.7)';
    ctx.lineWidth = Math.max(2, cellPx * 0.1);
    for (let i = 8; i < w; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i * cellPx + 0.5, 0);
      ctx.lineTo(i * cellPx + 0.5, canvasH);
      ctx.stroke();
    }
    for (let i = 8; i < h; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellPx + 0.5);
      ctx.lineTo(canvasW, i * cellPx + 0.5);
      ctx.stroke();
    }
  }
}

// ===== ★段階2追加: 8×8拡大表示 =====

// 8×8拡大表示モードの描画
function paintModeRenderZoom() {
  const canvas = document.getElementById('paint-canvas');
  if (!canvas || !_paintState.work) return;
  const ctx = canvas.getContext('2d');
  const work = _paintState.work;
  const w = work.convertedWidth;
  const h = work.convertedHeight;
  const paletteMap = _paintState.paletteMap;
  const paintedMap = _paintState.paintedMap;
  const idxToNum = _paintState.idxToNum;

  // 表示するセルの範囲(端のブロックは半端あり)
  const startX = _paintState.zoomBlockX * PAINT_BLOCK_SIZE;
  const startY = _paintState.zoomBlockY * PAINT_BLOCK_SIZE;
  const endX = Math.min(startX + PAINT_BLOCK_SIZE, w);
  const endY = Math.min(startY + PAINT_BLOCK_SIZE, h);
  const cellsW = endX - startX;
  const cellsH = endY - startY;

  // ビューポート基準で表示サイズを決定(8×8拡大モーダルと同じロジック)
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const targetW = Math.min(640, Math.max(280, viewportW - 100));
  const targetH = Math.max(280, viewportH * 0.55);
  const target = Math.floor(Math.min(targetW, targetH));
  const cellPx = Math.max(8, Math.floor(target / Math.max(cellsW, cellsH)));
  const canvasW = cellPx * cellsW;
  const canvasH = cellPx * cellsH;

  _paintState.zoomCellPx = cellPx;

  // 内部解像度=表示解像度の1:1にする(線消失バグ防止)
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasH + 'px';
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // 背景
  ctx.fillStyle = PAINT_BG_COLOR;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // セル描画(全体表示と同じロジックだが範囲が限定)
  const numFontSize = Math.max(14, Math.round(cellPx * 0.42));
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let y = 0; y < cellsH; y++) {
    for (let x = 0; x < cellsW; x++) {
      const srcX = startX + x;
      const srcY = startY + y;
      const i = srcY * w + srcX;
      const idx = paletteMap[i];
      const cx = x * cellPx;
      const cy = y * cellPx;

      if (idx < 0) {
        ctx.fillStyle = PAINT_TRANSPARENT_COLOR;
        ctx.fillRect(cx, cy, cellPx, cellPx);
        continue;
      }

      if (paintedMap[i]) {
        // 塗り済み
        ctx.fillStyle = PAINT_DONE_COLOR;
        ctx.fillRect(cx, cy, cellPx, cellPx);
        if (cellPx >= 16) {
          ctx.font = `bold ${Math.round(cellPx * 0.55)}px sans-serif`;
          ctx.fillStyle = '#888888';
          ctx.fillText('✓', cx + cellPx / 2, cy + cellPx / 2 + 1);
        }
      } else {
        // 未塗り
        const palHex = PALETTE[idx].h;
        ctx.fillStyle = palHex;
        ctx.fillRect(cx, cy, cellPx, cellPx);

        const numStr = String(idxToNum.get(idx)).padStart(2, '0');
        const rgb = hexToRgb(palHex);
        const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
        const textColor = luma < 140 ? '#FFFFFF' : '#1A0F05';
        const haloColor = luma < 140 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';
        ctx.font = `800 ${numFontSize}px "JetBrains Mono", monospace`;
        ctx.lineWidth = Math.max(2, Math.round(numFontSize * 0.18));
        ctx.strokeStyle = haloColor;
        ctx.strokeText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
        ctx.fillStyle = textColor;
        ctx.fillText(numStr, cx + cellPx / 2, cy + cellPx / 2 + 1);
      }
    }
  }

  // グリッド線(8×8拡大ではセルが大きいので必ず表示)
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
}

// 表示モード切替(全体↔8×8拡大)
function paintModeSetViewMode(mode) {
  if (mode !== 'full' && mode !== 'zoom') return;
  if (!_paintState.work) return;
  _paintState.viewMode = mode;

  // トグルボタンのactive状態を更新
  const fullBtn = document.getElementById('paint-view-full-btn');
  const zoomBtn = document.getElementById('paint-view-zoom-btn');
  if (fullBtn) fullBtn.classList.toggle('active', mode === 'full');
  if (zoomBtn) zoomBtn.classList.toggle('active', mode === 'zoom');

  // 8×8拡大用UIの表示切替
  const zoomNav = document.getElementById('paint-zoom-nav');
  if (zoomNav) zoomNav.classList.toggle('hidden', mode !== 'zoom');
  const zoomPos = document.getElementById('paint-zoom-position');
  if (zoomPos) zoomPos.classList.toggle('hidden', mode !== 'zoom');

  // 再描画
  paintModeRender();
  if (mode === 'zoom') {
    _paintModeUpdateZoomPositionDisplay();
    _paintModeUpdateZoomNavButtons();
  }
}

// 8×8拡大表示中のブロック移動
function paintModeMoveZoom(dx, dy) {
  const newX = _paintState.zoomBlockX + dx;
  const newY = _paintState.zoomBlockY + dy;
  if (newX < 0 || newX >= _paintState.zoomCols) return;
  if (newY < 0 || newY >= _paintState.zoomRows) return;
  _paintState.zoomBlockX = newX;
  _paintState.zoomBlockY = newY;
  paintModeRenderZoom();
  _paintModeUpdateZoomPositionDisplay();
  _paintModeUpdateZoomNavButtons();
}

// 現在ブロック位置(A1, B2など)の表示更新
function _paintModeUpdateZoomPositionDisplay() {
  const cur = document.getElementById('paint-zoom-current');
  if (cur) cur.textContent = _paintModeBlockLabel(_paintState.zoomBlockX, _paintState.zoomBlockY);
  const total = document.getElementById('paint-zoom-total');
  if (total) total.textContent = String(_paintState.zoomCols * _paintState.zoomRows);
}

// 端ブロックでの矢印ボタン無効化
function _paintModeUpdateZoomNavButtons() {
  const up    = document.getElementById('paint-zoom-up-btn');
  const down  = document.getElementById('paint-zoom-down-btn');
  const left  = document.getElementById('paint-zoom-left-btn');
  const right = document.getElementById('paint-zoom-right-btn');
  if (up)    up.disabled    = _paintState.zoomBlockY <= 0;
  if (down)  down.disabled  = _paintState.zoomBlockY >= _paintState.zoomRows - 1;
  if (left)  left.disabled  = _paintState.zoomBlockX <= 0;
  if (right) right.disabled = _paintState.zoomBlockX >= _paintState.zoomCols - 1;
}

// ブロック番号 → ラベル(A1, B2, AA1, AB1...)
function _paintModeBlockLabel(bx, by) {
  let col = '';
  let n = bx;
  while (true) {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return col + (by + 1);
}

// 進捗表示の更新
function paintModeUpdateProgress() {
  const work = _paintState.work;
  if (!work) return;
  const pctEl = document.getElementById('paint-progress-pct');
  const barEl = document.getElementById('paint-progress-bar');
  const cntEl = document.getElementById('paint-progress-count');
  if (pctEl) pctEl.textContent = (work.progressPct || 0) + '%';
  if (barEl) barEl.style.width = (work.progressPct || 0) + '%';
  if (cntEl) cntEl.textContent = (work.paintedCells || 0) + ' / ' + (work.totalCells || 0);

  // 完成判定: 進捗パーセントの色 + バーの色
  const isComplete = (work.progressPct || 0) >= 100;
  if (pctEl) pctEl.classList.toggle('paint-progress-complete', isComplete);
  if (barEl) barEl.classList.toggle('paint-progress-bar-complete', isComplete);
}

// ★段階2追加: 完成バナーの表示制御
function paintModeUpdateCompletion() {
  const work = _paintState.work;
  if (!work) return;
  const banner = document.getElementById('paint-complete-banner');
  if (!banner) return;
  banner.classList.toggle('hidden', (work.progressPct || 0) < 100);
}

// ★段階2追加: 使用色一覧の描画
function paintModeRenderColorList() {
  const container = document.getElementById('paint-color-list');
  if (!container) return;
  if (!_paintState.work || !_paintState.paletteMap || !_paintState.paintedMap) {
    container.innerHTML = '';
    return;
  }

  const stats = _paintModeComputeColorStats();
  container.innerHTML = '';

  if (stats.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'paint-color-empty';
    empty.textContent = '使用色がありません';
    container.appendChild(empty);
    return;
  }

  stats.forEach(([idx, stat]) => {
    const item = document.createElement('div');
    item.className = 'paint-color-item';
    const isComplete = stat.painted >= stat.total;
    if (isComplete) item.classList.add('paint-color-complete');

    // 番号バッジ
    const num = document.createElement('span');
    num.className = 'paint-color-num';
    num.textContent = String(_paintState.idxToNum.get(idx)).padStart(2, '0');
    item.appendChild(num);

    // 色見本
    const swatch = document.createElement('div');
    swatch.className = 'paint-color-swatch';
    swatch.style.background = PALETTE[idx].h;
    item.appendChild(swatch);

    // 情報部(残数 + バー or Complete!)
    const info = document.createElement('div');
    info.className = 'paint-color-info';

    if (isComplete) {
      const completeMark = document.createElement('div');
      completeMark.className = 'paint-color-complete-label';
      completeMark.textContent = 'Complete! ✓';
      info.appendChild(completeMark);
    } else {
      const remaining = stat.total - stat.painted;
      const count = document.createElement('div');
      count.className = 'paint-color-count';
      count.textContent = `残 ${remaining} / ${stat.total}`;
      info.appendChild(count);

      const barWrap = document.createElement('div');
      barWrap.className = 'paint-color-bar-wrap';
      const bar = document.createElement('div');
      bar.className = 'paint-color-bar';
      const pct = stat.total > 0 ? (stat.painted / stat.total * 100) : 0;
      bar.style.width = pct + '%';
      barWrap.appendChild(bar);
      info.appendChild(barWrap);
    }

    item.appendChild(info);
    container.appendChild(item);
  });
}

// 使用色ごとの統計を計算(描画番号順にソート)
function _paintModeComputeColorStats() {
  const paletteMap = _paintState.paletteMap;
  const paintedMap = _paintState.paintedMap;
  const idxToNum   = _paintState.idxToNum;
  if (!paletteMap || !paintedMap || !idxToNum) return [];

  const stats = new Map(); // idx -> {total, painted}
  for (let i = 0; i < paletteMap.length; i++) {
    const idx = paletteMap[i];
    if (idx < 0) continue;
    let stat = stats.get(idx);
    if (!stat) {
      stat = { total: 0, painted: 0 };
      stats.set(idx, stat);
    }
    stat.total++;
    if (paintedMap[i]) stat.painted++;
  }

  // 番号塗り絵と同じ表示順(idxToNumの数値の昇順)でソート
  const list = [...stats.entries()].sort((a, b) => {
    const numA = idxToNum.get(a[0]) || 0;
    const numB = idxToNum.get(b[0]) || 0;
    return numA - numB;
  });
  return list;
}

// クリック処理(全体表示・8×8拡大表示の両方に対応)
function paintModeOnCanvasClick(e) {
  const canvas = document.getElementById('paint-canvas');
  if (!canvas || !_paintState.work) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = _paintState.work.convertedWidth;
  const h = _paintState.work.convertedHeight;

  // クリック位置を画像内の絶対座標(absX, absY)に変換
  let absX, absY;
  if (_paintState.viewMode === 'zoom') {
    // 8×8拡大: 表示中のブロック内のローカル座標 + ブロック起点
    const cellPx = _paintState.zoomCellPx;
    const localX = Math.floor(x / cellPx);
    const localY = Math.floor(y / cellPx);
    const startX = _paintState.zoomBlockX * PAINT_BLOCK_SIZE;
    const startY = _paintState.zoomBlockY * PAINT_BLOCK_SIZE;
    const endX = Math.min(startX + PAINT_BLOCK_SIZE, w);
    const endY = Math.min(startY + PAINT_BLOCK_SIZE, h);
    if (localX < 0 || localX >= (endX - startX)) return;
    if (localY < 0 || localY >= (endY - startY)) return;
    absX = startX + localX;
    absY = startY + localY;
  } else {
    // 全体表示
    const cellPx = _paintState.cellPx;
    absX = Math.floor(x / cellPx);
    absY = Math.floor(y / cellPx);
    if (absX < 0 || absX >= w || absY < 0 || absY >= h) return;
  }

  const i = absY * w + absX;

  // 透明セルは塗らない
  if (_paintState.paletteMap[i] < 0) return;

  // トグル
  _paintState.paintedMap[i] = _paintState.paintedMap[i] ? 0 : 1;

  // 統計の再計算と保存
  const work = _paintState.work;
  work.paintedCells = _countPaintedCells(_paintState.paintedMap, _paintState.paletteMap);
  work.progressPct = work.totalCells > 0
    ? Math.round(100 * work.paintedCells / work.totalCells) : 0;
  work.paintedMap = workProgressPackPaintedMap(_paintState.paintedMap);
  workProgressUpsert(work);

  // 各種UI更新(現在の表示モードに応じて再描画)
  paintModeRender();
  paintModeUpdateProgress();
  paintModeRenderColorList();   // ★段階2追加
  paintModeUpdateCompletion();  // ★段階2追加
}

// 塗り済みセル数のカウント(透明セルは除外)
function _countPaintedCells(paintedMap, paletteMap) {
  let count = 0;
  for (let i = 0; i < paintedMap.length; i++) {
    if (paintedMap[i] && paletteMap[i] >= 0) count++;
  }
  return count;
}

// イベントハンドラの登録
function attachPaintModeControls() {
  const startBtn = document.getElementById('paint-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', paintModeStartFromCurrent);
  }
  const exitBtn = document.getElementById('paint-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', paintModeExit);
  }
  const canvas = document.getElementById('paint-canvas');
  if (canvas) {
    canvas.addEventListener('click', paintModeOnCanvasClick);
  }

  // ★段階2追加: 表示モード切替ボタン
  const fullBtn = document.getElementById('paint-view-full-btn');
  if (fullBtn) fullBtn.addEventListener('click', () => paintModeSetViewMode('full'));
  const zoomBtn = document.getElementById('paint-view-zoom-btn');
  if (zoomBtn) zoomBtn.addEventListener('click', () => paintModeSetViewMode('zoom'));

  // ★段階2追加: 8×8拡大時の矢印ボタン
  const upBtn    = document.getElementById('paint-zoom-up-btn');
  const downBtn  = document.getElementById('paint-zoom-down-btn');
  const leftBtn  = document.getElementById('paint-zoom-left-btn');
  const rightBtn = document.getElementById('paint-zoom-right-btn');
  if (upBtn)    upBtn.addEventListener('click',    () => paintModeMoveZoom(0, -1));
  if (downBtn)  downBtn.addEventListener('click',  () => paintModeMoveZoom(0,  1));
  if (leftBtn)  leftBtn.addEventListener('click',  () => paintModeMoveZoom(-1, 0));
  if (rightBtn) rightBtn.addEventListener('click', () => paintModeMoveZoom( 1, 0));

  // ★段階2追加: キーボードの矢印キーでもブロック移動可能(8×8拡大時のみ)
  document.addEventListener('keydown', _paintModeOnKeyDown);
}

// ★段階2追加: 矢印キーハンドラ
function _paintModeOnKeyDown(e) {
  if (!_paintState.work) return;                  // 制作モードに入っていない時は無視
  if (_paintState.viewMode !== 'zoom') return;    // 8×8拡大時のみ反応
  // 入力欄にフォーカスがある時は無視(入力を妨げない)
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
  // paint-sectionが見えていない時(他のモーダル等)は無視
  const paintSec = document.getElementById('paint-section');
  if (!paintSec || paintSec.classList.contains('hidden')) return;

  let dx = 0, dy = 0;
  switch (e.key) {
    case 'ArrowLeft':  dx = -1; break;
    case 'ArrowRight': dx =  1; break;
    case 'ArrowUp':    dy = -1; break;
    case 'ArrowDown':  dy =  1; break;
    default: return;
  }
  e.preventDefault();
  paintModeMoveZoom(dx, dy);
}

// DOM読込完了時に自動初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachPaintModeControls);
} else {
  attachPaintModeControls();
}
