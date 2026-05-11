// ===========================================================================
// works-list.js
// トップページの「進行中の作品」セクション
// localStorage の作品リストをサムネ・進捗付きで表示
// ===========================================================================

// 作品一覧を再描画
function worksListRender() {
  const container = document.getElementById('works-list');
  const section = document.getElementById('works-list-section');
  if (!container || !section) return;

  const works = workProgressGetAll();

  // ★段階4変更: 作品0件時もセクションを表示し、空状態メッセージ+インポートボタンを使えるようにする
  // (別端末からインポートしたい場面に対応)
  section.classList.remove('hidden');
  container.innerHTML = '';

  // 「全部エクスポート」ボタンは作品0件時は無効化
  const exportAllBtn = document.getElementById('works-export-all-btn');
  if (exportAllBtn) exportAllBtn.disabled = (works.length === 0);

  if (works.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'works-list-empty';
    empty.textContent = '進行中の作品はまだありません。画像を変換して「制作モードを開始」するか、下のボタンからインポートしてください。';
    container.appendChild(empty);
    return;
  }

  // 更新日時降順でソート(最近作業したもの優先)
  works.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // クリア
  container.innerHTML = '';

  works.forEach(w => {
    const item = document.createElement('div');
    item.className = 'works-list-item';

    // サムネイル
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'works-list-thumb';
    if (w.thumbnailDataURL) {
      const img = document.createElement('img');
      img.src = w.thumbnailDataURL;
      img.alt = '';
      thumbWrap.appendChild(img);
    }
    item.appendChild(thumbWrap);

    // 中央の情報部
    const info = document.createElement('div');
    info.className = 'works-list-info';

    const name = document.createElement('div');
    name.className = 'works-list-name';
    name.textContent = w.name || '(名前なし)';
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'works-list-meta';
    const pct = w.progressPct || 0;
    const painted = w.paintedCells || 0;
    const total = w.totalCells || 0;
    meta.textContent = `${w.convertedWidth}×${w.convertedHeight} ・ ${painted}/${total}マス (${pct}%)`;
    info.appendChild(meta);

    // 進捗バー
    const barWrap = document.createElement('div');
    barWrap.className = 'works-list-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'works-list-bar';
    if (pct >= 100) bar.classList.add('works-list-bar-complete');
    bar.style.width = pct + '%';
    barWrap.appendChild(bar);
    info.appendChild(barWrap);

    item.appendChild(info);

    // ボタン群
    const actions = document.createElement('div');
    actions.className = 'works-list-actions';

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn small primary';
    resumeBtn.textContent = pct >= 100 ? '見る' : '続きから';
    resumeBtn.addEventListener('click', () => {
      if (typeof paintModeOpenById === 'function') {
        paintModeOpenById(w.id);
      }
    });
    actions.appendChild(resumeBtn);

    // ★段階4追加: 1作品ずつ.spoito.jsonへエクスポート
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn small ghost';
    exportBtn.textContent = '保存';
    exportBtn.title = 'この作品を .spoito.json ファイルとして保存';
    exportBtn.addEventListener('click', () => {
      worksListExportOne(w.id);
    });
    actions.appendChild(exportBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn small ghost';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => {
      // 進捗が0より大きい場合は確認ダイアログを少し強めに
      const msg = pct > 0
        ? `作品「${w.name}」を削除しますか？\n進捗(${pct}%)も失われます。\nこの操作は取り消せません。`
        : `作品「${w.name}」を削除しますか？`;
      if (confirm(msg)) {
        workProgressDelete(w.id);
        worksListRender();
      }
    });
    actions.appendChild(delBtn);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

// DOM読込完了時に初期描画
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', worksListRender);
} else {
  worksListRender();
}

// ===========================================================================
// ★段階4追加: 進捗ファイルの保存/読込(エクスポート/インポート)
// ===========================================================================

// JSONファイルの形式情報(本家shareWorkと同じパターンに揃える)
const WORK_PROGRESS_FORMAT = 'spoito-work-progress';
const WORK_PROGRESS_VERSION = 1;
const WORK_PROGRESS_EXT = '.spoito.json';

// 1作品ずつエクスポート
function worksListExportOne(id) {
  const work = workProgressGet(id);
  if (!work) {
    alert('作品が見つかりません。');
    return;
  }
  const payload = _worksListBuildPayload([work]);
  const filename = _worksListSanitizeFilename(work.name || 'work') + WORK_PROGRESS_EXT;
  try {
    _worksListTriggerDownload(filename, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('エクスポート失敗:', e);
    alert('ファイルの保存に失敗しました。\n' + (e.message || e));
  }
}

// 全作品をまとめてエクスポート
function worksListExportAll() {
  const works = workProgressGetAll();
  if (works.length === 0) {
    alert('エクスポートできる作品がありません。');
    return;
  }
  const payload = _worksListBuildPayload(works);
  const dateStr = _worksListFormatDateForFilename(new Date());
  const filename = `すぽいと帳-進行中作品-${dateStr}${WORK_PROGRESS_EXT}`;
  try {
    _worksListTriggerDownload(filename, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('エクスポート失敗:', e);
    alert('ファイルの保存に失敗しました。\n' + (e.message || e));
  }
}

// ファイル選択ダイアログを開いてインポート開始
function worksListImportFromFile() {
  const fileInput = document.getElementById('works-import-file');
  if (!fileInput) {
    alert('ファイル選択UIが見つかりません。');
    return;
  }
  // 同じファイルを連続で選べるようにvalueをリセット
  fileInput.value = '';
  fileInput.click();
}

// file inputで選ばれたファイルを処理
function _worksListOnImportFileSelected(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];

  // ファイルサイズの安全弁(50MB以上は弾く: 通常は数MB以下)
  if (file.size > 50 * 1024 * 1024) {
    alert('ファイルが大きすぎます(50MB上限)。\n別ファイルを選んでください。');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    let text;
    try {
      // FileReaderはデフォルトでUTF-8として読む(日本語ファイル名でもOK)
      text = ev.target.result;
    } catch (err) {
      alert('ファイルの読み込みに失敗しました。\n' + (err.message || err));
      return;
    }
    _worksListImportFromText(text);
  };
  reader.onerror = () => {
    alert('ファイルの読み込みに失敗しました。');
  };
  // UTF-8として読込(本家のshare-work.jsと同じ)
  reader.readAsText(file, 'utf-8');
}

// JSON文字列からインポート処理
function _worksListImportFromText(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    alert('JSON形式として解釈できませんでした。\n正しい .spoito.json ファイルを選んでください。');
    return;
  }

  // フォーマット検証
  if (!payload || payload.format !== WORK_PROGRESS_FORMAT) {
    alert('このファイルは「すぽいと帳」の進捗ファイルではないようです。\nformat="' + (payload && payload.format || '不明') + '"');
    return;
  }
  if (typeof payload.version !== 'number' || payload.version > WORK_PROGRESS_VERSION) {
    if (!confirm(`このファイルはバージョン ${payload.version} です。\n現在対応しているバージョンは ${WORK_PROGRESS_VERSION} です。\n読み込みを続行しますか？`)) {
      return;
    }
  }
  if (!Array.isArray(payload.works) || payload.works.length === 0) {
    alert('ファイル内に作品データが含まれていません。');
    return;
  }

  // 各作品を順番に取り込む
  const existingIds = new Set(workProgressGetAll().map(w => w.id));
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const work of payload.works) {
    // データ検証
    if (!_worksListValidateWork(work)) {
      errors++;
      console.warn('不正な作品データをスキップ:', work);
      continue;
    }

    // ID重複時の動作をユーザーに確認
    if (existingIds.has(work.id)) {
      const userChoice = confirm(
        `作品「${work.name}」は既に存在します。\n\n` +
        `[OK] 既存を上書きする(進捗も上書き)\n` +
        `[キャンセル] 別作品として追加する`
      );
      if (userChoice) {
        // 上書き: 既存IDのまま保存(workProgressUpsertが置き換える)
        if (workProgressUpsert(work)) imported++;
        else errors++;
      } else {
        // 別作品として追加: 新しいIDを発行し、名前に印を付ける
        const newWork = Object.assign({}, work);
        newWork.id = 'work_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        newWork.name = (work.name || '無題') + ' (インポート)';
        newWork.createdAt = Date.now();
        newWork.updatedAt = Date.now();
        if (workProgressUpsert(newWork)) {
          imported++;
          existingIds.add(newWork.id);
        } else {
          errors++;
        }
      }
    } else {
      // 重複なし: そのまま追加
      if (workProgressUpsert(work)) {
        imported++;
        existingIds.add(work.id);
      } else {
        errors++;
      }
    }
  }

  // 結果表示
  let resultMsg = `読み込み完了\n\n`;
  resultMsg += `読み込んだ作品: ${imported}件\n`;
  if (skipped > 0) resultMsg += `スキップ: ${skipped}件\n`;
  if (errors > 0) resultMsg += `エラー: ${errors}件(コンソールで詳細確認)\n`;
  alert(resultMsg);

  // 画面を更新
  worksListRender();
}

// 作品データの最低限の検証(必須フィールドが揃っているか)
function _worksListValidateWork(work) {
  if (!work || typeof work !== 'object') return false;
  const required = ['id', 'name', 'paletteMap', 'paintedMap',
                    'totalCells', 'convertedWidth', 'convertedHeight'];
  for (const k of required) {
    if (!(k in work)) {
      console.warn('必須フィールド欠落:', k, work);
      return false;
    }
  }
  if (typeof work.id !== 'string' || work.id.length === 0) return false;
  if (typeof work.convertedWidth !== 'number' || work.convertedWidth <= 0) return false;
  if (typeof work.convertedHeight !== 'number' || work.convertedHeight <= 0) return false;
  return true;
}

// エクスポート用ペイロードを作成
function _worksListBuildPayload(works) {
  return {
    format: WORK_PROGRESS_FORMAT,
    version: WORK_PROGRESS_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'すぽいと帳',
    works: works,
  };
}

// ブラウザでダウンロードトリガー(モダンブラウザは日本語ファイル名OK)
function _worksListTriggerDownload(filename, content) {
  // BOM付きUTF-8として保存(Windowsのメモ帳でも文字化けしないように)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // URL解放(少し待ってから: Safari対策)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ファイル名のサニタイズ(OS禁止文字を _ に置換、長さ制限)
function _worksListSanitizeFilename(name) {
  // Windows禁止文字: < > : " / \ | ? * と制御文字
  let safe = String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '_')           // 先頭ドットを置換
    .replace(/\s+$/g, '')           // 末尾の空白を削除
    .trim();
  // 空文字防止
  if (!safe) safe = 'work';
  // 長すぎないように100文字制限
  if (safe.length > 100) safe = safe.substring(0, 100);
  return safe;
}

// ファイル名用の日付文字列 (例: 2026-05-11_1830)
function _worksListFormatDateForFilename(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// バルク操作ボタンとファイル入力のセットアップ
function attachWorksListBulkControls() {
  const exportAllBtn = document.getElementById('works-export-all-btn');
  if (exportAllBtn) exportAllBtn.addEventListener('click', worksListExportAll);

  const importBtn = document.getElementById('works-import-btn');
  if (importBtn) importBtn.addEventListener('click', worksListImportFromFile);

  const fileInput = document.getElementById('works-import-file');
  if (fileInput) fileInput.addEventListener('change', _worksListOnImportFileSelected);
}

// DOM読込時に登録
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachWorksListBulkControls);
} else {
  attachWorksListBulkControls();
}
