/* ========== SCAN & IMPORT ========== */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-scan')?.addEventListener('click', async () => {
    try {
      const path = await tauriInvoke('pick_folder');
      if (!path) return;
      showToast('Scanning folder...', 'info');
      const result = await tauriInvoke('scan_folder', { path });
      libraryData = result;
      renderLibrary();
      renderGenreTags();
      renderTypeTags();
      renderAdvancedTags();
      renderContinueReading();
      renderCollectionBar();
      showToast('Folder scanned successfully!', 'success');
    } catch (e) {
      showToast('Scan error: ' + e, 'error');
    }
  });

  document.getElementById('btn-import')?.addEventListener('click', async () => {
    try {
      const result = await tauriInvoke('pick_archives');
      if (!result || !result.length) return;
      
      let success = 0;
      for (const [path, filename] of result) {
        showToast(`Importing ${filename}...`, 'info');
        const lib = await tauriInvoke('import_archive', { path, filename });
        libraryData = lib;
        success++;
      }
      
      renderLibrary(document.getElementById('search-input')?.value || '');
      renderGenreTags();
      renderTypeTags();
      renderAdvancedTags();
      renderContinueReading();
      renderCollectionBar();
      showToast(`Imported ${success} archive(s) successfully!`, 'success');
    } catch (e) {
      showToast('Import error: ' + e, 'error');
    }
  });
});