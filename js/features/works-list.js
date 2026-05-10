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

  // 1作品もなければセクションごと非表示
  if (works.length === 0) {
    section.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  section.classList.remove('hidden');

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
