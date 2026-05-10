// ===========================================================================
// work-progress.js
// 制作アシスト機能のデータ管理層
// localStorage と現在の状態を仲介し、作品リストの管理、
// パレットマップ・塗り進捗マップのシリアライズなどを行う
// ===========================================================================

const WORKS_STORAGE_KEY = 'spoito_works_v1';
const WORKS_SOFT_LIMIT = 30; // localStorage容量のためのソフト上限

// ----- 公開関数 -----

// 全作品リストを取得
function workProgressGetAll() {
  try {
    const json = localStorage.getItem(WORKS_STORAGE_KEY);
    if (!json) return [];
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error('作品リスト読込失敗:', e);
    return [];
  }
}

// IDで作品取得
function workProgressGet(id) {
  return workProgressGetAll().find(w => w.id === id) || null;
}

// 作品保存(新規 or 更新)
function workProgressUpsert(work) {
  if (!work || !work.id) return false;
  const all = workProgressGetAll();
  const idx = all.findIndex(w => w.id === work.id);
  work.updatedAt = Date.now();
  if (idx >= 0) {
    all[idx] = work;
  } else {
    if (!work.createdAt) work.createdAt = Date.now();
    all.unshift(work); // 新しいものを上に
    if (all.length > WORKS_SOFT_LIMIT) {
      console.warn(`作品数が${WORKS_SOFT_LIMIT}を超えました(${all.length})。`);
    }
  }
  return _workProgressSaveAll(all);
}

// 作品削除
function workProgressDelete(id) {
  const all = workProgressGetAll().filter(w => w.id !== id);
  return _workProgressSaveAll(all);
}

// 全削除(将来用)
function workProgressClearAll() {
  return _workProgressSaveAll([]);
}

// 現在のconvertedDataから新規作品を作成して保存
// 戻り値: 作成された作品オブジェクト or null
function workProgressCreateFromCurrent(name) {
  if (typeof convertedData === 'undefined' || !convertedData) {
    console.error('convertedDataが存在しません');
    return null;
  }
  if (typeof imgData === 'undefined' || !imgData) {
    console.error('imgDataが存在しません');
    return null;
  }

  // 元画像(調整済みがあればそれを優先)を取得
  let sourceCanvas = imgData.originalCanvas;
  if (typeof _getAdjustedSourceCanvas === 'function') {
    const adjusted = _getAdjustedSourceCanvas();
    if (adjusted) sourceCanvas = adjusted;
  }
  // dataURL化(エラー対策: 失敗したらJPEGで再試行、それも駄目なら空文字)
  let sourceImageDataURL = '';
  try {
    sourceImageDataURL = sourceCanvas.toDataURL('image/png');
  } catch (e) {
    console.warn('元画像のPNG化失敗、JPEGで再試行:', e);
    try {
      sourceImageDataURL = sourceCanvas.toDataURL('image/jpeg', 0.9);
    } catch (e2) {
      console.error('元画像保存失敗:', e2);
      sourceImageDataURL = '';
    }
  }

  // グローバル設定値の取得(なければデフォルト)
  const gs   = (typeof gridSize !== 'undefined') ? gridSize : 32;
  const dith = (typeof ditherEnabled !== 'undefined') ? ditherEnabled : false;
  const hsv  = (typeof hsvAdjust !== 'undefined') ? hsvAdjust : { brightness: 0, saturation: 0 };

  const totalCells = _workProgressCountNonTransparent(convertedData.paletteMap);

  const work = {
    id:                  'work_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name:                name || ('作品 ' + _workProgressFormatDateTime(new Date())),
    createdAt:           Date.now(),
    updatedAt:           Date.now(),
    sourceImageDataURL:  sourceImageDataURL,
    sourceWidth:         imgData.width,
    sourceHeight:        imgData.height,
    convertedWidth:      convertedData.width,
    convertedHeight:     convertedData.height,
    gridSize:            gs,
    ditherEnabled:       dith,
    hsvBrightness:       hsv.brightness,
    hsvSaturation:       hsv.saturation,
    paletteMap:          workProgressPackPaletteMap(convertedData.paletteMap),
    paintedMap:          workProgressPackPaintedMap(
                           new Uint8Array(convertedData.width * convertedData.height)
                         ),
    totalCells:          totalCells,
    paintedCells:        0,
    progressPct:         0,
    thumbnailDataURL:    workProgressGenerateThumbnail(convertedData),
  };

  if (workProgressUpsert(work)) {
    return work;
  }
  return null;
}

// パレットマップ(Int16Array) → base64文字列(2bytes/cell)
function workProgressPackPaletteMap(arr) {
  const len = arr.length;
  const buf = new ArrayBuffer(len * 2);
  const view = new Int16Array(buf);
  for (let i = 0; i < len; i++) view[i] = arr[i];
  return _workProgressArrayBufferToBase64(buf);
}

// base64 → Int16Array
function workProgressUnpackPaletteMap(b64) {
  const buf = _workProgressBase64ToArrayBuffer(b64);
  return new Int16Array(buf);
}

// 塗り済みマップ(Uint8Array of 0/1) → base64文字列(8セル=1byte圧縮)
function workProgressPackPaintedMap(u8arr) {
  const byteLen = Math.ceil(u8arr.length / 8);
  const u8 = new Uint8Array(byteLen);
  for (let i = 0; i < u8arr.length; i++) {
    if (u8arr[i]) u8[Math.floor(i / 8)] |= (1 << (i % 8));
  }
  return _workProgressArrayBufferToBase64(u8.buffer);
}

// base64 → Uint8Array of 0/1
function workProgressUnpackPaintedMap(b64, totalCells) {
  if (!b64 || totalCells <= 0) return new Uint8Array(0);
  const buf = _workProgressBase64ToArrayBuffer(b64);
  const u8 = new Uint8Array(buf);
  const arr = new Uint8Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    arr[i] = (u8[Math.floor(i / 8)] >> (i % 8)) & 1;
  }
  return arr;
}

// サムネイル画像を生成(変換後画像を最大120pxに縮小)
function workProgressGenerateThumbnail(d) {
  if (!d || !d.originalCanvas) return '';
  const maxSize = 120;
  const scale = Math.min(1, maxSize / Math.max(d.width, d.height));
  const tw = Math.max(1, Math.round(d.width * scale));
  const th = Math.max(1, Math.round(d.height * scale));
  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(d.originalCanvas, 0, 0, d.width, d.height, 0, 0, tw, th);
  try {
    return c.toDataURL('image/png');
  } catch (e) {
    console.warn('サムネイル生成失敗:', e);
    return '';
  }
}

// ----- 内部ヘルパー -----

function _workProgressSaveAll(all) {
  try {
    localStorage.setItem(WORKS_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    console.error('作品リスト保存失敗:', e);
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      alert('保存容量がいっぱいです。「進行中の作品」から古い作品を削除してください。');
    }
    return false;
  }
}

function _workProgressCountNonTransparent(paletteMap) {
  let count = 0;
  for (let i = 0; i < paletteMap.length; i++) {
    if (paletteMap[i] >= 0) count++;
  }
  return count;
}

// ArrayBuffer → base64 (チャンク化により大きいデータでもスタックオーバーフローしない)
function _workProgressArrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000; // 32KB
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// base64 → ArrayBuffer
function _workProgressBase64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// 日時を "YYYY-MM-DD HH:MM" 形式にフォーマット
function _workProgressFormatDateTime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
