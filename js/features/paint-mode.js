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
};

const PAINT_BG_COLOR          = '#FFFFFF';
const PAINT_TRANSPARENT_COLOR = '#F5F5F5';
const PAINT_DONE_COLOR        = '#D0D0D0'; // 塗り済みセルの色(灰色)

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

  paintModeRender();
  paintModeUpdateProgress();
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

// キャンバスをフルレンダリング(初回およびモード遷移時)
function paintModeRender() {
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

  // 完成判定
  if (pctEl) {
    pctEl.classList.toggle('paint-progress-complete', (work.progressPct || 0) >= 100);
  }
}

// クリック処理
function paintModeOnCanvasClick(e) {
  const canvas = document.getElementById('paint-canvas');
  if (!canvas || !_paintState.work) return;
  const rect = canvas.getBoundingClientRect();
  // CSSピクセルから内部ピクセル(1:1のはず)
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cellPx = _paintState.cellPx;
  const cx = Math.floor(x / cellPx);
  const cy = Math.floor(y / cellPx);
  const w = _paintState.work.convertedWidth;
  const h = _paintState.work.convertedHeight;
  if (cx < 0 || cx >= w || cy < 0 || cy >= h) return;
  const i = cy * w + cx;

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

  // 全体再描画(部分描画はグリッド線の処理が複雑なので段階1ではフル描画)
  paintModeRender();
  paintModeUpdateProgress();
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
}

// DOM読込完了時に自動初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachPaintModeControls);
} else {
  attachPaintModeControls();
}
