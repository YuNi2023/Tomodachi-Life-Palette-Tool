

// 言語切替時に動的UI（既に描画済みの動的テキスト）を再描画するハブ
function refreshDynamicLabels() {
  // color-info.js のラベル
  if (typeof refreshColorInfoLabels === 'function') refreshColorInfoLabels();
  // crop-tool.js のサイズ表記
  if (typeof updateCropInfo === 'function' && typeof cropSrcCanvas !== 'undefined' && cropSrcCanvas) {
    try { updateCropInfo(); } catch (_) {}
  }
  // view-mode.js のimg-info表記
  if (typeof updateImgInfo === 'function' && typeof imgData !== 'undefined' && imgData) {
    try { updateImgInfo(); } catch (_) {}
  }
  // recipe.js のサマリーと行を再描画（変換済みの場合のみ）
  if (typeof rebuildRecipe === 'function' && typeof viewMode !== 'undefined' && viewMode === 'converted') {
    try { rebuildRecipe(); } catch (_) {}
  }
  // favorites.js を再描画（aria-labelの言語追従）
  if (typeof renderFavorites === 'function') {
    try { renderFavorites(); } catch (_) {}
  }
  // 言語切替時に <html lang> も更新済み（i18n.js側で対応済み）
}

async function init() {
  // i18nを最初に初期化（DOM翻訳を完了させてから他の処理へ）
  if (typeof initI18n === 'function') {
    await initI18n();
  }

  cacheDomRefs();

  attachUploadHandlers();
  attachCropHandlers();
  attachCanvasInteractions();
  attachZoomControls();
  attachConvertControls();
  attachHexInput();
  attachFavorites();
  attachCopyStepsButton();
  attachModalHandlers();
  attachResizeHandler();

  buildPaletteGrid();

  // 言語切替時の動的UI再描画
  window.addEventListener('i18nchange', refreshDynamicLabels);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
