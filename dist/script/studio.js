let currentPath = null;
let chapters = [];
let isLocked = false;

function parseTags(raw) {
  if (!raw) return [];
  return raw.includes(',')
    ? raw.split(',').map(s => s.trim()).filter(Boolean)
    : raw.split(/\s+/).map(s => s.trim()).filter(Boolean);
}

function loadMetaFromDOM() {
  const chapter_order = chapters.map(ch => ch.name);
  const page_order = {};
  chapters.forEach(ch => {
    page_order[ch.name] = ch.pages.map(p => PathFilename(p));
  });

  const coverEl = document.getElementById('cover-filename');
  const coverText = coverEl ? coverEl.textContent.trim() : 'No cover selected';
  return {
    title: document.getElementById('meta-title').value.trim(),
    description: document.getElementById('meta-description').value.trim(),
    author: document.getElementById('meta-author').value.trim(),
    genre: document.getElementById('meta-genre').value.split(',').map(s => s.trim()).filter(Boolean),
    tags: parseTags(document.getElementById('meta-tags').value),
    type: document.getElementById('meta-type').value,
    status: document.getElementById('meta-status').value,
    cover: coverText === 'No cover selected' || coverText === 'No cover set' ? '' : coverText,
    nsfw: document.getElementById('meta-nsfw').checked,
    locked: document.getElementById('meta-locked').checked,
    chapter_order,
    page_order,
  };
}

function setMetaToDOM(meta) {
  document.getElementById('meta-title').value = meta.title || '';
  document.getElementById('meta-author').value = meta.author || '';
  document.getElementById('meta-description').value = meta.description || '';
  document.getElementById('meta-genre').value = (meta.genre || []).join(', ');
  document.getElementById('meta-tags').value = (meta.tags || []).join(', ');
  document.getElementById('meta-type').value = meta.type || '';
  document.getElementById('meta-status').value = meta.status || 'Ongoing';
  document.getElementById('meta-nsfw').checked = meta.nsfw || false;
  document.getElementById('meta-locked').checked = meta.locked || false;

  const coverEl = document.getElementById('cover-filename');
  if (coverEl) {
    const coverName = meta.cover || 'No cover selected';
    coverEl.textContent = coverName;
    if (meta.cover) {
      coverEl.classList.add('has-cover');
    } else {
      coverEl.classList.remove('has-cover');
    }
  }
}

function PathFilename(path) {
  if (!path) return '';
  return path.split('/').pop().split('\\').pop();
}

async function scanCurrentFolder() {
  if (!currentPath) return;
  try {
    const jsonPath = currentPath + '/manga.json';
    let meta = {};
    try {
      const jsonText = await tauriInvoke('read_text_file', { path: jsonPath });
      meta = JSON.parse(jsonText);
    } catch (e) {
      console.log('No manga.json yet, using defaults');
    }

    setMetaToDOM(meta);
    isLocked = meta.locked || false;

    const lib = await tauriInvoke('get_library');
    const manga = lib.find(m => m.path === currentPath || m.path === currentPath.replace(/\\/g, '/'));
    if (manga) {
      chapters = manga.chapters.map(ch => ({ name: ch.name, pages: ch.pages }));
    } else {
      chapters = [];
      console.warn('Manga not found in library for path:', currentPath);
    }

    renderChapters();
    updateLockState();
  } catch (e) {
    console.error('scanCurrentFolder error:', e);
    showToast('Failed to load manga data: ' + e, 'error');
    throw e;
  }
}

function updateLockState() {
  const warning = document.getElementById('lock-warning');
  const editor = document.getElementById('editor-section');
  if (warning) warning.style.display = isLocked ? 'inline-flex' : 'none';

  const inputs = editor.querySelectorAll('input, textarea, select, button');
  inputs.forEach(el => {
    if (el.id === 'btn-export-ykm' || el.id === 'back-btn' || el.classList.contains('chapter-sort-btn')) return;
    el.disabled = isLocked;
    el.style.opacity = isLocked ? '0.5' : '';
  });
}

function renderChapters() {
  const container = document.getElementById('chapters-list');
  if (!chapters.length) {
    container.innerHTML = '<p class="studio-empty">No chapters yet. Click "Add Chapter" to start building your manga.</p>';
    return;
  }

  container.innerHTML = chapters.map((ch, i) => `
    <div class="chapter-item" data-index="${i}" data-chapter-name="${escapeHtml(ch.name)}">
      <div class="chapter-header">
        <div class="chapter-sort">
          <button class="btn-icon chapter-sort-btn" data-action="move-ch-up" data-index="${i}" ${i === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button class="btn-icon chapter-sort-btn" data-action="move-ch-down" data-index="${i}" ${i === chapters.length - 1 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <strong>${escapeHtml(ch.name)}</strong>
        <div class="chapter-actions">
          <button class="btn-secondary btn-sm" data-action="add-pages" data-chapter="${escapeHtml(ch.name)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Pages
          </button>
          <button class="btn-secondary btn-sm danger-btn" data-action="delete-ch" data-chapter="${escapeHtml(ch.name)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="chapter-pages" data-chapter="${escapeHtml(ch.name)}"
           ondragover="allowPageDrag(event)"
           ondrop="dropPage(event, '${escapeHtml(ch.name)}')"
           ondragenter="this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')">
        ${ch.pages.map((p, pi) => `
          <div class="page-thumb-wrapper" draggable="true"
               ondragstart="startPageDrag(event, '${escapeHtml(ch.name)}', ${pi})">
            <img class="page-thumb" src="" data-path="${escapeHtml(p)}" alt="">
            <div class="page-overlay">
              <button data-action="move-pg-left" data-chapter="${escapeHtml(ch.name)}" data-index="${pi}" ${pi === 0 ? 'disabled' : ''}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button data-action="move-pg-right" data-chapter="${escapeHtml(ch.name)}" data-index="${pi}" ${pi === ch.pages.length - 1 ? 'disabled' : ''}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              <button class="danger-btn" data-action="delete-pg" data-chapter="${escapeHtml(ch.name)}" data-index="${pi}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        `).join('')}
        <div class="page-add-placeholder" data-action="add-pages" data-chapter="${escapeHtml(ch.name)}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
      </div>
      <div class="chapter-page-count">${ch.pages.length} page${ch.pages.length !== 1 ? 's' : ''}</div>
    </div>
  `).join('');

  container.querySelectorAll('img[data-path]').forEach(img => {
    tauriInvoke('get_image_base64', { path: img.dataset.path }).then(data => {
      img.src = data;
    }).catch(() => {
      img.style.display = 'none';
    });
  });
}

function handleChapterClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  
  const action = btn.dataset.action;
  const chName = btn.dataset.chapter;
  const index = parseInt(btn.dataset.index);
  
  switch(action) {
    case 'move-ch-up': moveChapter(index, -1); break;
    case 'move-ch-down': moveChapter(index, 1); break;
    case 'add-pages': addPagesToChapter(chName); break;
    case 'delete-ch': deleteChapter(chName); break;
    case 'move-pg-left': movePage(chName, index, -1); break;
    case 'move-pg-right': movePage(chName, index, 1); break;
    case 'delete-pg': deletePage(chName, index); break;
  }
}

function moveChapter(index, dir) {
  if (index + dir < 0 || index + dir >= chapters.length) return;
  [chapters[index], chapters[index + dir]] = [chapters[index + dir], chapters[index]];
  renderChapters();
}

function movePage(chName, pageIndex, dir) {
  const ch = chapters.find(c => c.name === chName);
  if (!ch) return;
  if (pageIndex + dir < 0 || pageIndex + dir >= ch.pages.length) return;
  [ch.pages[pageIndex], ch.pages[pageIndex + dir]] = [ch.pages[pageIndex + dir], ch.pages[pageIndex]];
  renderChapters();
}

async function deletePage(chName, pageIndex) {
  if (isLocked) return;
  if (!confirm('Delete this page?')) return;
  const ch = chapters.find(c => c.name === chName);
  if (!ch) return;
  const path = ch.pages[pageIndex];
  try {
    await tauriInvoke('remove_page', { pagePath: path });
    ch.pages.splice(pageIndex, 1);
    renderChapters();
    showToast('Page deleted', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to delete page', 'error');
  }
}

let dragSource = null;

function startPageDrag(e, chName, pageIndex) {
  dragSource = { chName, pageIndex };
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('dragging');
}

function allowPageDrag(e) {
  e.preventDefault();
}

async function dropPage(e, targetChName) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragSource) return;
  const { chName, pageIndex } = dragSource;
  if (chName === targetChName) return;

  const sourceCh = chapters.find(c => c.name === chName);
  const targetCh = chapters.find(c => c.name === targetChName);
  if (!sourceCh || !targetCh) return;

  const path = sourceCh.pages[pageIndex];
  try {
    const newPath = await tauriInvoke('move_page', {
      pagePath: path,
      targetChapterPath: currentPath + '/' + targetChName
    });
    sourceCh.pages.splice(pageIndex, 1);
    targetCh.pages.push(newPath);
    renderChapters();
    showToast('Page moved to ' + targetChName, 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to move page', 'error');
  }
  dragSource = null;
}

async function addPagesToChapter(chapterName, filePaths = null) {
  if (isLocked) return;
  try {
    let paths = filePaths;
    if (!paths) {
      paths = await tauriInvoke('pick_images');
      if (!paths || !paths.length) return;
    }
    const added = await tauriInvoke('add_pages', {
      mangaPath: currentPath,
      chapterName: chapterName,
      imagePaths: paths
    });
    const ch = chapters.find(c => c.name === chapterName);
    if (ch) ch.pages.push(...added);
    renderChapters();
    showToast(`Added ${paths.length} page(s)`, 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to add pages: ' + e, 'error');
  }
}

async function deleteChapter(name) {
  if (isLocked) return;
  if (!confirm(`Delete chapter "${name}" and all its pages?`)) return;
  try {
    await tauriInvoke('delete_chapter', { mangaPath: currentPath, chapterName: name });
    chapters = chapters.filter(c => c.name !== name);
    renderChapters();
    showToast('Chapter deleted', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to delete chapter', 'error');
  }
}

async function openLibraryBrowser() {
  try {
    const lib = await tauriInvoke('get_library');
    const available = lib.filter(m => !m.locked);
    const list = document.getElementById('library-list');

    if (!available.length) {
      list.innerHTML = '<p class="studio-empty">No unlocked manga found. Create a new one or unlock an existing manga.</p>';
    } else {
      list.innerHTML = available.map(m => `
        <div class="library-item" data-path="${escapeHtml(m.path)}">
          <div class="library-info">
            <strong>${escapeHtml(m.title || m.id)}</strong>
            <span>${m.chapters.length} chapters &bull; ${escapeHtml(m.status || 'Unknown')}</span>
          </div>
          <button class="btn-primary btn-sm" data-path="${escapeHtml(m.path)}">Edit</button>
        </div>
      `).join('');
    }
    document.getElementById('library-modal').style.display = '';
  } catch (e) {
    console.error(e);
    showToast('Failed to load library', 'error');
  }
}

function handleLibraryClick(e) {
  const item = e.target.closest('.library-item');
  const btn = e.target.closest('.btn-primary');
  
  if (btn && btn.dataset.path) {
    e.stopPropagation();
    loadMangaFromLibrary(btn.dataset.path);
  } else if (item && item.dataset.path) {
    loadMangaFromLibrary(item.dataset.path);
  }
}

function closeLibraryModal() {
  document.getElementById('library-modal').style.display = 'none';
}

function hideLoadCreate() {
  const card = document.getElementById('load-create-card');
  if (card) card.style.display = 'none';
}

async function loadMangaFromLibrary(path) {
  closeLibraryModal();
  currentPath = path.replace(/\\/g, '/');
  const pathEl = document.getElementById('current-manga-path');
  const editorEl = document.getElementById('editor-section');
  if (pathEl) {
    pathEl.textContent = currentPath;
    pathEl.style.display = '';
  }
  if (editorEl) editorEl.style.display = '';
  hideLoadCreate();
  await scanCurrentFolder();
  showToast('Manga loaded from library', 'success');
}

async function saveMetadata(lock = false) {
  if (!currentPath) return;
  if (isLocked) return;
  const meta = loadMetaFromDOM();
  if (lock) meta.locked = true;
  try {
    const json = JSON.stringify(meta, null, 2);
    await tauriInvoke('save_manga_json', { folderPath: currentPath, jsonData: json });
    showToast(lock ? 'Saved & Locked!' : 'Metadata saved!', 'success');
    if (lock) {
      isLocked = true;
      updateLockState();
    }
  } catch (e) {
    console.error(e);
    showToast('Save failed: ' + e, 'error');
  }
}

let lastHoveredChapter = null;

function setupDragDrop() {
  document.addEventListener('dragenter', (e) => {
    const ch = e.target.closest('.chapter-item');
    if (ch) {
      lastHoveredChapter = chapters[parseInt(ch.dataset.index)]?.name || null;
    }
  });

  if (window.__TAURI__ && window.__TAURI__.event) {
    window.__TAURI__.event.listen('tauri://drag-drop', (event) => {
      const paths = event.payload?.paths || [];
      if (lastHoveredChapter && paths.length > 0) {
        addPagesToChapter(lastHoveredChapter, paths);
        lastHoveredChapter = null;
      }
    });
  }
}

/* ===== Custom Create Modal ===== */

function openCreateModal() {
  document.getElementById('create-modal').style.display = '';
  const input = document.getElementById('new-manga-title');
  input.value = '';
  input.classList.remove('error');
  document.getElementById('create-error').style.display = 'none';
  setTimeout(() => input.focus(), 50);
}

function closeCreateModal() {
  document.getElementById('create-modal').style.display = 'none';
}

async function confirmCreateManga() {
  const input = document.getElementById('new-manga-title');
  const title = input.value.trim();
  if (!title) {
    input.classList.add('error');
    document.getElementById('create-error').style.display = '';
    return;
  }
  input.classList.remove('error');
  document.getElementById('create-error').style.display = 'none';
  closeCreateModal();

  const folderName = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  try {
    const manga = await tauriInvoke('create_new_manga', {
      folderName: folderName,
      title: title
    });
    hideLoadCreate();
    currentPath = (manga.path || '').replace(/\\/g, '/');

    const pathEl = document.getElementById('current-manga-path');
    const editorEl = document.getElementById('editor-section');
    if (pathEl) {
      pathEl.textContent = currentPath;
      pathEl.style.display = '';
    }
    if (editorEl) editorEl.style.display = '';

    setMetaToDOM({ title, status: 'Ongoing' });
    chapters = [];
    isLocked = false;
    renderChapters();
    updateLockState();
    showToast('New manga created in library', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to create manga: ' + e, 'error');
  }
}

/* ===== Chapter Modal ===== */

function openChapterModal() {
  const modal = document.getElementById('chapter-modal');
  const input = document.getElementById('new-chapter-name');
  const error = document.getElementById('chapter-error');

  if (!modal || !input) {
    const name = prompt('Chapter folder name:');
    if (name && name.trim()) confirmAddChapter(name.trim());
    return;
  }

  input.value = '';
  input.classList.remove('error');
  input.style.borderColor = '';
  if (error) error.style.display = 'none';
  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 50);
}

function closeChapterModal() {
  const modal = document.getElementById('chapter-modal');
  if (modal) modal.style.display = 'none';
}

async function confirmAddChapter(name) {
  if (!name) return;
  if (isLocked) return;

  try {
    await tauriInvoke('create_chapter', { mangaPath: currentPath, chapterName: name });
    chapters.push({ name, pages: [] });
    renderChapters();
    showToast('Chapter created', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to create chapter: ' + e, 'error');
  }
}

/* ===== Event Listeners ===== */

document.addEventListener('DOMContentLoaded', () => {
  setupDragDrop();

  const params = new URLSearchParams(window.location.search);
  const pathParam = params.get('path');

  if (pathParam) {
    currentPath = pathParam.replace(/\\/g, '/');
    const pathEl = document.getElementById('current-manga-path');
    const editorEl = document.getElementById('editor-section');
    if (pathEl) {
      pathEl.textContent = currentPath;
      pathEl.style.display = '';
    }
    if (editorEl) editorEl.style.display = '';
    hideLoadCreate();

    scanCurrentFolder().catch(e => {
      console.error('Initial scan failed:', e);
      showToast('Failed to load manga data', 'error');
    });
  }

  document.getElementById('back-btn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('btn-edit-library')?.addEventListener('click', openLibraryBrowser);
  document.getElementById('btn-new-manga')?.addEventListener('click', openCreateModal);

  document.getElementById('btn-pick-cover')?.addEventListener('click', async () => {
    if (isLocked) return;
    try {
      const paths = await tauriInvoke('pick_images');
      if (!paths || !paths[0]) return;
      const coverName = await tauriInvoke('set_cover', {
        mangaPath: currentPath,
        imagePath: paths[0]
      });
      const coverEl = document.getElementById('cover-filename');
      if (coverEl) {
        coverEl.textContent = coverName;
        coverEl.classList.add('has-cover');
      }
      showToast('Cover set: ' + coverName, 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to set cover', 'error');
    }
  });

  document.getElementById('btn-add-chapter')?.addEventListener('click', () => {
    if (isLocked) return;
    openChapterModal();
  });

  document.getElementById('btn-chapter-cancel')?.addEventListener('click', closeChapterModal);
  document.getElementById('btn-chapter-cancel-alt')?.addEventListener('click', closeChapterModal);
  document.getElementById('chapter-modal-backdrop')?.addEventListener('click', closeChapterModal);
  document.getElementById('chapter-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'chapter-modal') closeChapterModal();
  });
  
  document.getElementById('btn-chapter-create')?.addEventListener('click', async () => {
    const input = document.getElementById('new-chapter-name');
    const error = document.getElementById('chapter-error');
    const name = input.value.trim();

    if (!name) {
      input.classList.add('error');
      input.style.borderColor = 'var(--error, #ff5a5a)';
      if (error) error.style.display = '';
      return;
    }

    input.classList.remove('error');
    input.style.borderColor = '';
    if (error) error.style.display = 'none';
    closeChapterModal();
    await confirmAddChapter(name);
  });

  document.getElementById('new-chapter-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-chapter-create')?.click();
    }
    if (e.key === 'Escape') {
      closeChapterModal();
    }
  });

  document.getElementById('btn-save-meta')?.addEventListener('click', () => saveMetadata(false));
  document.getElementById('btn-save-lock')?.addEventListener('click', () => saveMetadata(true));

  document.getElementById('btn-export-ykm')?.addEventListener('click', async () => {
    if (!currentPath) return;
    try {
      const meta = loadMetaFromDOM();
      meta.locked = true;
      const json = JSON.stringify(meta, null, 2);
      await tauriInvoke('save_manga_json', { folderPath: currentPath, jsonData: json });

      const mangaName = await tauriInvoke('export_ykm_to_exports', {
        folderPath: currentPath
      });
      showToast(`Exported ${mangaName} to Yomiki/Exports`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Export failed: ' + e, 'error');
    }
  });

  // Modal backdrop & button listeners
  document.getElementById('library-modal-backdrop')?.addEventListener('click', closeLibraryModal);
  document.getElementById('btn-library-cancel')?.addEventListener('click', closeLibraryModal);
  document.getElementById('create-modal-backdrop')?.addEventListener('click', closeCreateModal);
  document.getElementById('btn-create-cancel')?.addEventListener('click', closeCreateModal);
  document.getElementById('btn-create-cancel-alt')?.addEventListener('click', closeCreateModal);
  document.getElementById('btn-create-confirm')?.addEventListener('click', confirmCreateManga);

  // Library list delegation
  document.getElementById('library-list')?.addEventListener('click', handleLibraryClick);

  // Chapter list delegation
  document.getElementById('chapters-list')?.addEventListener('click', handleChapterClick);
});