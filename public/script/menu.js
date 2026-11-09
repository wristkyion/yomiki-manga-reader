let libraryData = [];
let currentSheetManga = null;
let currentFilter = 'all';
let activeGenres = new Set();
let activeTags = new Set();
let activeTypes = new Set();
let currentSort = 'title-asc';
let advancedOpen = false;
let activeStatus = 'all';
let continueExpanded = false;
let collections = [];
let activeCollection = null;
let deleteTargetId = null;
let resetTargetId = null;
let deleteCollectionTargetId = null;

function showDeleteCollectionModal(id, name) {
  deleteCollectionTargetId = id;
  document.getElementById('delete-collection-title').textContent = name;
  const modal = document.getElementById('delete-collection-modal');
  document.body.style.overflow = 'hidden';
  modal.classList.remove('hidden');
}

function closeDeleteCollectionModal() {
  const modal = document.getElementById('delete-collection-modal');
  modal.classList.add('hidden');
  deleteCollectionTargetId = null;
  setTimeout(() => {
    if (!document.querySelector('.modal-overlay:not(.hidden)')) document.body.style.overflow = '';
  }, 300);
}

async function confirmDeleteCollection() {
  if (!deleteCollectionTargetId) return;
  try {
    collections = await tauriInvoke('delete_collection', { id: deleteCollectionTargetId });
    libraryData = await tauriInvoke('get_library');
    renderCollectionManagerUI();
    renderCollectionBar();
    renderLibrary(document.getElementById('search-input').value);
    closeDeleteCollectionModal();
    showToast('Collection deleted', 'success');
  } catch (e) {
    showToast('Failed to delete collection', 'error');
  }
}

function showResetModal(id, title) {
  resetTargetId = id;
  document.getElementById('reset-manga-title').textContent = title;
  const modal = document.getElementById('reset-modal');
  document.body.style.overflow = 'hidden';
  modal.classList.remove('hidden');
}

function closeResetModal() {
  const modal = document.getElementById('reset-modal');
  modal.classList.add('hidden');
  resetTargetId = null;
  setTimeout(() => {
    if (!document.querySelector('.modal-overlay:not(.hidden)')) document.body.style.overflow = '';
  }, 300);
}

async function confirmReset() {
  if (!resetTargetId) return;
  try {
    await tauriInvoke('remove_bookmark', { id: resetTargetId });
    libraryData = await tauriInvoke('get_library');
    const freshManga = libraryData.find(m => m.id === resetTargetId);
    if (freshManga) currentSheetManga = freshManga;
    renderLibrary(document.getElementById('search-input').value);
    renderContinueReading();
    showToast('Progress reset', 'success');
    closeResetModal();
    if (currentSheetManga) openMangaSheet(currentSheetManga.id);
  } catch (e) {
    showToast('Failed to reset progress', 'error');
  }
}

function initViewToggle() {
  const toggle = document.getElementById('view-toggle');
  if (!toggle) return;
  updateViewToggleUI();
  toggle.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => switchViewMode(btn.dataset.mode));
  });
}

function isCompleted(manga) {
  if (!manga || !manga.bookmark || !manga.chapters.length) return false;
  const lastCh = manga.chapters.length - 1;
  const lastPg = Math.max(0, (manga.chapters[lastCh]?.pages?.length || 1) - 1);
  return manga.bookmark.chapter >= lastCh && manga.bookmark.page >= lastPg;
}

function setLibraryLoading(loading) {
  const loader = document.getElementById('library-loader');
  if (!loader) return;
  if (loading) loader.classList.remove('hidden');
  else loader.classList.add('hidden');
}

async function loadLibrary() {
  setLibraryLoading(true);
  try {
    libraryData = await tauriInvoke('get_library');
    collections = await tauriInvoke('get_collections');
    renderGenreTags();
    renderTypeTags();
    renderCollectionBar();
    renderLibrary();
    renderContinueReading();
    updateDiscordBrowsing();
    showOnboardingIfNeeded();
  } catch (e) {
    console.error('loadLibrary error:', e);
    showToast('Failed to load library', 'error');
  } finally {
    setLibraryLoading(false);
    sessionStorage.removeItem('yomiki_target_filter');
  }
}

/* ========== ONBOARDING (Multi-Step Floating) ========== */

let onboardingStep = 0;
const totalOnboardingSteps = 6;

function updateOnboardingUI() {
  // Steps
  document.querySelectorAll('.onboarding-step').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.step) === onboardingStep);
  });
  
  // Dots
  document.querySelectorAll('.onboarding-dots .dot').forEach(dot => {
    dot.classList.toggle('active', parseInt(dot.dataset.dot) === onboardingStep);
  });
  
  // Progress bar fill
  const fill = document.getElementById('onboarding-progress-fill');
  if (fill) {
    const pct = ((onboardingStep + 1) / totalOnboardingSteps) * 100;
    fill.style.width = pct + '%';
  }
  
  // Buttons
  const prevBtn = document.getElementById('btn-onboarding-prev');
  const nextBtn = document.getElementById('btn-onboarding-next');
  
  if (prevBtn) {
    prevBtn.style.visibility = onboardingStep === 0 ? 'hidden' : 'visible';
  }
  
  if (nextBtn) {
    if (onboardingStep === totalOnboardingSteps - 1) {
      nextBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Get Started';
      nextBtn.classList.add('glow');
    } else {
      nextBtn.innerHTML = 'Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px;vertical-align:middle"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
      nextBtn.classList.remove('glow');
    }
  }
}

function nextOnboardingStep() {
  if (onboardingStep < totalOnboardingSteps - 1) {
    onboardingStep++;
    updateOnboardingUI();
  } else {
    finishOnboarding();   // <-- calls the reload version
  }
}

function prevOnboardingStep() {
  if (onboardingStep > 0) {
    onboardingStep--;
    updateOnboardingUI();
  }
}

async function showOnboardingIfNeeded() {
  try {
    const settings = await tauriInvoke('get_settings');
    if (settings.firstmeet !== false) {
      onboardingStep = 0;
      const modal = document.getElementById('onboarding-modal');
      modal.classList.remove('hidden');
      updateOnboardingUI();
    }
  } catch (e) {
    console.error('First meet check failed:', e);
  }
}

// Used by Skip / Escape — closes without reloading
async function closeOnboardingModal() {
  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  
  try {
    const settings = await tauriInvoke('get_settings');
    if (settings.firstmeet !== false) {
      settings.firstmeet = false;
      await tauriInvoke('save_settings', { settings });
    }
  } catch (e) {
    console.error('Failed to save firstmeet flag:', e);
  }
}

// Used by "Get Started" on the last step — saves then reloads
async function finishOnboarding() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.add('hidden');
  
  try {
    const settings = await tauriInvoke('get_settings');
    if (settings.firstmeet !== false) {
      settings.firstmeet = false;
      await tauriInvoke('save_settings', { settings });
    }
  } catch (e) {
    console.error('Failed to save firstmeet flag:', e);
  }
  
  window.location.reload();
}

function updateDiscordBrowsing() {
  const total = libraryData.length;
  const inProgress = libraryData.filter(m => m.bookmark).length;
  tauriInvoke('discord_update_presence', {
    state: `${inProgress} in progress · ${total} total`,
    details: 'Browsing Yomiki Library',
    largeText: 'Yomiki',
    smallText: 'Library'
  }).catch(() => {});
}

function getAllGenres() {
  const genres = new Set();
  libraryData.forEach(m => {
    if (!m.genre || !Array.isArray(m.genre)) return;
    m.genre.forEach(g => {
      const trimmed = (g || '').toString().trim();
      if (trimmed) genres.add(trimmed);
    });
  });
  return Array.from(genres).sort();
}

function getAllTags() {
  const tags = new Set();
  libraryData.forEach(m => {
    if (!m.tags || !Array.isArray(m.tags)) return;
    m.tags.forEach(t => {
      const trimmed = (t || '').toString().trim();
      if (trimmed) tags.add(trimmed);
    });
  });
  return Array.from(tags).sort();
}

function getAllTypes() {
  const types = new Set();
  libraryData.forEach(m => {
    const t = (m.type || '').toString().trim();
    if (t) types.add(t);
  });
  return Array.from(types).sort();
}

function renderGenreTags() {
  const container = document.getElementById('advanced-genres');
  if (!container) return;
  const genres = getAllGenres();
  let html = '';
  if (activeGenres.size > 0) {
    html += `<button class="adv-option" id="adv-clear-genres"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Clear (${activeGenres.size})</button>`;
  }
  genres.forEach(g => {
    const active = activeGenres.has(g) ? 'active' : '';
    html += `<button class="adv-option ${active}" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('[data-genre]').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleGenre(btn.dataset.genre);
      renderGenreTags();
      renderLibrary(document.getElementById('search-input').value);
    });
  });
  document.getElementById('adv-clear-genres')?.addEventListener('click', () => {
    clearGenres();
    renderGenreTags();
    renderLibrary(document.getElementById('search-input').value);
  });
}

function renderTypeTags() {
  const container = document.getElementById('advanced-types');
  if (!container) return;
  const types = getAllTypes();
  let html = `<button class="adv-option ${activeTypes.size === 0 ? 'active' : ''}" data-type="all">All</button>`;
  types.forEach(t => {
    const active = activeTypes.has(t) ? 'active' : '';
    html += `<button class="adv-option ${active}" data-type="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.type === 'all') {
        activeTypes.clear();
      } else {
        if (activeTypes.has(btn.dataset.type)) activeTypes.delete(btn.dataset.type);
        else activeTypes.add(btn.dataset.type);
      }
      renderTypeTags();
      renderLibrary(document.getElementById('search-input').value);
    });
  });
}

function renderAdvancedTags() {
  const container = document.getElementById('advanced-tags');
  if (!container) return;
  const tags = getAllTags();
  let html = '';
  if (activeTags.size > 0) {
    html += `<button class="adv-option" id="adv-clear-tags"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Clear (${activeTags.size})</button>`;
  }
  tags.forEach(t => {
    const active = activeTags.has(t) ? 'active' : '';
    html += `<button class="adv-option ${active}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('[data-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleTag(btn.dataset.tag);
      renderAdvancedTags();
      renderLibrary(document.getElementById('search-input').value);
    });
  });
  document.getElementById('adv-clear-tags')?.addEventListener('click', () => {
    clearTags();
    renderAdvancedTags();
    renderLibrary(document.getElementById('search-input').value);
  });
}

function toggleGenre(genre) {
  if (activeGenres.has(genre)) activeGenres.delete(genre);
  else activeGenres.add(genre);
}

function clearGenres() {
  activeGenres.clear();
}

function toggleTag(tag) {
  if (activeTags.has(tag)) activeTags.delete(tag);
  else activeTags.add(tag);
}

function clearTags() {
  activeTags.clear();
}

function sortManga(list, sortType, times) {
  const sorted = [...list];
  switch (sortType) {
    case 'title-asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    case 'title-desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }));
    case 'recently-read':
      return sorted.sort((a, b) => (times[b.id] || 0) - (times[a.id] || 0));
    case 'recently-added':
      return sorted.sort((a, b) => naturalSortCompare(b.id, a.id));
    case 'unread':
      return sorted.sort((a, b) => {
        const aUnread = a.bookmark ? 0 : 1;
        const bUnread = b.bookmark ? 0 : 1;
        if (aUnread !== bUnread) return bUnread - aUnread;
        return a.title.localeCompare(b.title);
      });
    case 'progress':
      return sorted.sort((a, b) => {
        const aProg = getProgressPercent(a);
        const bProg = getProgressPercent(b);
        return bProg - aProg;
      });
    default:
      return sorted;
  }
}

function getProgressPercent(manga) {
  if (!manga.chapters.length) return 0;
  const totalPages = manga.chapters.reduce((s, c) => s + (c.pages?.length || 0), 0);
  if (!totalPages) return 0;
  if (!manga.bookmark) return 0;
  let read = 0;
  for (let i = 0; i < manga.bookmark.chapter; i++) read += manga.chapters[i]?.pages?.length || 0;
  read += manga.bookmark.page + 1;
  return Math.round((read / totalPages) * 100);
}

function naturalSortCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function renderLibrary(filter = '') {
  const grid = document.getElementById('library-grid');
  const empty = document.getElementById('empty-state');

  let filtered = libraryData;

  if (activeStatus !== 'all') {
    filtered = filtered.filter(m => {
      const status = (m.status || '').toString().trim().toLowerCase();
      return status === activeStatus;
    });
  }

  if (activeTypes.size > 0) {
    filtered = filtered.filter(m => activeTypes.has(m.type || ''));
  }

  if (activeGenres.size > 0) {
    filtered = filtered.filter(m => {
      for (const g of activeGenres) if (!m.genre.includes(g)) return false;
      return true;
    });
  }

  if (activeTags.size > 0) {
    filtered = filtered.filter(m => {
      for (const t of activeTags) if (!m.tags.includes(t)) return false;
      return true;
    });
  }

  if (currentFilter === 'favorites') filtered = filtered.filter(m => m.is_favorite);
  else if (currentFilter === 'bookmarks') filtered = filtered.filter(m => m.bookmark && !isCompleted(m));
  else if (currentFilter === 'completed') filtered = filtered.filter(m => isCompleted(m));
  else if (currentFilter === 'collection') {
    if (activeCollection) {
      filtered = filtered.filter(m => m.collections.includes(activeCollection));
    } else {
      filtered = filtered.filter(m => m.collections.length > 0);
    }
  }

  if (filter.trim()) {
    const q = filter.toLowerCase();
    filtered = filtered.filter(m => {
      const inTitle = m.title.toLowerCase().includes(q);
      const inAuthor = (m.author || '').toLowerCase().includes(q);
      const inGenre = m.genre.some(g => g.toLowerCase().includes(q));
      const inTag = m.tags.some(t => t.toLowerCase().includes(q));
      return inTitle || inAuthor || inGenre || inTag;
    });
  }

  const times = JSON.parse(localStorage.getItem('Yomiki_read_times') || '{}');
  filtered = sortManga(filtered, currentSort, times);

  if (!filtered || filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    
    let msg = 'No manga found';
    let mascotSrc = './image/sad-mascot.png';
    
    if (libraryData.length === 0) {
      msg = 'No manga in library. Click <b>Import</b> to add manga!';
    } else if (currentFilter === 'favorites') {
      msg = 'No favorite manga yet. Click the heart icon on any manga!';
    } else if (currentFilter === 'bookmarks') {
      msg = 'No bookmarked manga yet. Start reading to auto-save bookmarks!';
    } else if (currentFilter === 'completed') {
      msg = 'No completed manga yet. Read to the last page of the last chapter!';
      mascotSrc = './image/happy-mascot.png';
    } else if (currentFilter === 'collection') {
      msg = activeCollection ? 'No manga in this collection' : 'No collections yet. Add manga to collections from the manga page!';
    } else if (activeGenres.size > 0) {
      msg = `No manga with selected genres`;
    } else if (activeTags.size > 0) {
      msg = `No manga with selected tags`;
    } else if (activeTypes.size > 0) {
      msg = `No manga with selected types`;
    } else if (activeStatus !== 'all') {
      msg = `No ${activeStatus} manga found`;
    } else if (filter) {
      msg = `No manga matching "${escapeHtml(filter)}"`;
    }
    
    const mascotImg = document.getElementById('empty-mascot');
    const msgEl = document.getElementById('empty-message');
    if (mascotImg) mascotImg.src = mascotSrc;
    if (msgEl) msgEl.innerHTML = msg;
    return;
  }

  empty.classList.add('hidden');
  grid.className = `library-grid ${currentViewMode}-view`;

  grid.innerHTML = filtered.map((manga, index) => {
    return currentViewMode === 'detailed'
      ? createDetailedCard(manga, index)
      : createCompactCard(manga, index);
  }).join('');

  document.querySelectorAll('.manga-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      openMangaSheet(card.dataset.id);
    });
  });

  document.querySelectorAll('.manga-card').forEach(card => {
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const manga = libraryData.find(m => m.id === card.dataset.id);
      if (!manga) return;

      const heartIcon = manga.is_favorite 
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

      const items = [
        { 
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', 
          label: 'Read Now', 
          action: () => { currentSheetManga = manga; readNowSheet(); } 
        },
        { 
          icon: heartIcon, 
          label: manga.is_favorite ? 'Remove Favorite' : 'Add Favorite', 
          action: () => { currentSheetManga = manga; toggleFavoriteSheet(); } 
        },
      ];

      if (manga.bookmark) {
        items.push({ 
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', 
          label: 'Remove Bookmark', 
          action: () => { currentSheetManga = manga; bookmarkSheet(); } 
        });
      }

      items.push(
        { separator: true },
        { 
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="8" y1="11" x2="8" y2="11"/><line x1="16" y1="11" x2="16" y2="11"/></svg>', 
          label: 'Show in Folder', 
          action: () => { tauriInvoke('show_in_folder', { path: manga.path }).catch(() => showToast('Failed to open folder', 'error')); } 
        },
        { 
          icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', 
          label: 'Delete', 
          danger: true, 
          action: () => showDeleteModal(manga.id, manga.title) 
        }
      );

      showContextMenu(items, e.clientX, e.clientY);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const manga = libraryData.find(m => m.id === btn.dataset.delete);
      if (manga) showDeleteModal(manga.id, manga.title);
    });
  });

  filtered.forEach(manga => {
    const safeId = manga.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const wrapper = document.getElementById(`cover-${safeId}`);
    if (!wrapper) return;

    if (manga.nsfw) {
      wrapper.classList.add('nsfw-blur');
    } else {
      wrapper.classList.remove('nsfw-blur');
    }

    const badges = `
      ${manga.is_favorite ? '<span class="fav-badge pop-in"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span>' : ''}
      ${manga.bookmark ? '<span class="bookmark-badge pop-in"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></span>' : ''}
      ${isCompleted(manga) ? '<span class="done-badge pop-in"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
    `;

    const nsfwLabel = manga.nsfw ? '<div class="nsfw-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> NSFW</div>' : '';

    if (manga.cover) {
      tauriInvoke('get_image_base64', { path: manga.cover }).then(data => {
        if (wrapper) wrapper.innerHTML = `<img src="${data}" alt="${escapeHtml(manga.title)}">${nsfwLabel}${badges}`;
      }).catch(() => {
        if (wrapper) wrapper.innerHTML = `<div class="no-cover">No Cover</div>${badges}`;
      });
    } else {
      wrapper.innerHTML = `<div class="no-cover">No Cover</div>${badges}`;
    }
  });
}

/* ---------- VIEW TOGGLE ---------- */
let currentViewMode = localStorage.getItem('Yomiki_view_mode') || 'compact';

function initViewToggle() {
  const toggle = document.getElementById('view-toggle');
  if (!toggle) return;

  // Set initial active state based on saved mode
  updateViewToggleUI();

  // Attach click handlers
  toggle.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => switchViewMode(btn.dataset.mode));
  });
}

function updateViewToggleUI() {
  const toggle = document.getElementById('view-toggle');
  if (!toggle) return;

  toggle.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentViewMode);
  });
}

function switchViewMode(mode) {
  if (mode === currentViewMode) return;
  currentViewMode = mode;
  localStorage.setItem('Yomiki_view_mode', mode);
  updateViewToggleUI();   // Just update classes, don't re-create
  renderLibrary(document.getElementById('search-input').value);
}

function createCompactCard(manga, index) {
  const genres = manga.genre.join(', ');
  const safeId = manga.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const favIcon = manga.is_favorite 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' 
    : '';
  const bmIcon = manga.bookmark 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' 
    : '';
  const doneIcon = isCompleted(manga) 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' 
    : '';
  const nsfwIcon = manga.nsfw 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' 
    : '';

  return `
    <div class="manga-card compact" data-id="${escapeHtml(manga.id)}" style="--card-index:${index}">
      <div class="cover-wrapper" id="cover-${escapeHtml(safeId)}">
        <div class="no-cover shimmer">Loading...</div>
        ${favIcon ? `<span class="fav-badge pop-in">${favIcon}</span>` : ''}
        ${bmIcon ? `<span class="bookmark-badge pop-in">${bmIcon}</span>` : ''}
        ${doneIcon ? `<span class="done-badge pop-in">${doneIcon}</span>` : ''}
        ${nsfwIcon ? `<span class="nsfw-badge pop-in">${nsfwIcon}</span>` : ''}
      </div>
      <div class="info">
        <h3>${escapeHtml(manga.title)}</h3>
        ${manga.author ? `<p class="author">${escapeHtml(manga.author)}</p>` : ''}
        ${manga.status ? `<p class="status">${escapeHtml(manga.status)}</p>` : ''}
        ${genres ? `<p class="genre">${escapeHtml(genres)}</p>` : ''}
        <p class="chapters">${manga.chapters.length} chapter(s)</p>
      </div>
    </div>
  `;
}

function createDetailedCard(manga, index) {
  const safeId = manga.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const favIcon = manga.is_favorite 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' 
    : '';
  const bmIcon = manga.bookmark 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' 
    : '';
  const doneIcon = isCompleted(manga) 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' 
    : '';
  const nsfwIcon = manga.nsfw 
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' 
    : '';

  const cleanGenres = (Array.isArray(manga.genre) ? manga.genre : []).filter(g => g && g.toString().trim() !== '');
  const genreTags = cleanGenres.slice(0, 4).map(g => `<span class="tag-pill">${escapeHtml(g)}</span>`).join('');

  const lastCh = manga.chapters?.length > 0 ? manga.chapters[manga.chapters.length - 1] : null;
  const latestChNum = lastCh ? (lastCh.number || manga.chapters.length) : manga.chapters.length;

  let desc = '';
  if (manga.description) {
    desc = manga.description.length > 120 ? escapeHtml(manga.description.substring(0, 120)) + '...' : escapeHtml(manga.description);
  }

  return `
    <div class="manga-card detailed" data-id="${escapeHtml(manga.id)}" style="--card-index:${index}">
      <div class="cover-wrapper" id="cover-${escapeHtml(safeId)}">
        <div class="no-cover shimmer">Loading...</div>
        ${favIcon ? `<span class="fav-badge pop-in">${favIcon}</span>` : ''}
        ${bmIcon ? `<span class="bookmark-badge pop-in">${bmIcon}</span>` : ''}
        ${doneIcon ? `<span class="done-badge pop-in">${doneIcon}</span>` : ''}
        ${nsfwIcon ? `<span class="nsfw-badge pop-in">${nsfwIcon}</span>` : ''}
      </div>
      <div class="info">
        <h3 class="card-title">${escapeHtml(manga.title)}</h3>
        <div class="card-meta-row">
          ${manga.author ? `<span class="meta-item author-name">${escapeHtml(manga.author)}</span>` : ''}
          ${manga.status ? `<span class="meta-item status-pill">${escapeHtml(manga.status)}</span>` : ''}
          ${manga.type ? `<span class="meta-item type-pill">${escapeHtml(manga.type)}</span>` : ''}
        </div>
        <div class="card-tags">${genreTags}</div>
        ${desc ? `<p class="card-desc">${desc}</p>` : ''}
        <div class="card-footer">
          <span class="chapter-count">${manga.chapters.length} chapter(s)</span>
        </div>
      </div>
    </div>
  `;
}

/* ========== BOTTOM SHEET ========== */

function openMangaSheet(id) {
  const manga = libraryData.find(m => m.id === id);
  if (!manga) return;
  currentSheetManga = manga;

  const sheet = document.getElementById('manga-sheet');
  const coverDiv = document.getElementById('sheet-cover');

  if (manga.cover) {
    tauriInvoke('get_image_base64', { path: manga.cover }).then(data => {
      coverDiv.innerHTML = `<img src="${data}" alt="${escapeHtml(manga.title)}">`;
    }).catch(() => {
      coverDiv.innerHTML = '<div class="no-cover-sheet">No Cover</div>';
    });
  } else {
    coverDiv.innerHTML = '<div class="no-cover-sheet">No Cover</div>';
  }

  document.getElementById('sheet-title').textContent = manga.title;
  
  const statusEl = document.getElementById('sheet-status');
  statusEl.textContent = manga.status || 'Unknown';
  statusEl.style.display = '';
  
  const typeEl = document.getElementById('sheet-type');
  typeEl.textContent = manga.type || '-';
  typeEl.style.display = '';
  
  const genreEl = document.getElementById('sheet-genre');
  const cleanGenres = (Array.isArray(manga.genre) ? manga.genre : []).filter(g => g && g.toString().trim() !== '');
  genreEl.textContent = cleanGenres.join(', ') || '-';
  genreEl.style.display = '';
  
  const completed = isCompleted(manga);
  const completedCheck = completed
  ? ' · <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;display:inline-block"><polyline points="20 6 9 17 4 12"/></svg>Completed'
  : '';
  document.getElementById('sheet-chapters').innerHTML = `${manga.chapters.length} chapter(s)${completedCheck}`;

  const statsRow = document.getElementById('sheet-stats');
  statsRow.innerHTML = `
    <span>${manga.is_favorite ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Favorited' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Not Favorited'}</span>
    <span>·</span>
    <span>${manga.bookmark ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Bookmarked' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> No Bookmark'}</span>
    ${manga.nsfw ? '<span>·</span><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> NSFW</span>' : ''}
    ${manga.locked ? '<span>·</span><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Locked</span>' : ''}
  `;

  const about = document.getElementById('sheet-about');
  let aboutHtml = '';
  if (manga.description) {
    const descWithBreaks = escapeHtml(manga.description).replace(/\n/g, '<br>');
    aboutHtml += `<p style="margin-bottom:1rem;line-height:1.7;white-space:pre-line;">${descWithBreaks}</p>`;
  }
  
  // Tags — filter empty strings, show as nice pills
  const cleanTags = (Array.isArray(manga.tags) ? manga.tags : []).filter(t => t && t.toString().trim() !== '');
  if (cleanTags.length > 0) {
    aboutHtml += `
      <div style="margin-bottom:0.8rem;">
        <strong style="color:var(--text-secondary);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:0.4rem;">Tags</strong>
        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
          ${cleanTags.map(t => `<span style="display:inline-flex;align-items:center;padding:0.3rem 0.7rem;border-radius:999px;font-size:0.78rem;font-weight:600;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border-subtle);">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>`;
  } else {
    aboutHtml += `
      <div style="margin-bottom:0.8rem;">
        <strong style="color:var(--text-secondary);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:0.4rem;">Tags</strong>
        <span style="color:var(--text-muted);font-size:0.9rem;font-style:italic;">No tags</span>
      </div>`;
  }
  
  // Genres — filter empty strings, show as nice pills
  if (cleanGenres.length > 0) {
    aboutHtml += `
      <div style="margin-bottom:0.8rem;">
        <strong style="color:var(--text-secondary);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:0.4rem;">Genre</strong>
        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
          ${cleanGenres.map(g => `<span style="display:inline-flex;align-items:center;padding:0.3rem 0.7rem;border-radius:999px;font-size:0.78rem;font-weight:600;background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent-soft);">${escapeHtml(g)}</span>`).join('')}
        </div>
      </div>`;
  } else {
    aboutHtml += `
      <div style="margin-bottom:0.8rem;">
        <strong style="color:var(--text-secondary);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:0.4rem;">Genre</strong>
        <span style="color:var(--text-muted);font-size:0.9rem;font-style:italic;">No genres</span>
      </div>`;
  }
  
  if (manga.author) {
    aboutHtml += `
      <div style="margin-bottom:0.8rem;">
        <strong style="color:var(--text-secondary);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:0.4rem;">Author</strong>
        <span style="color:var(--text-secondary);font-size:0.9rem;">${escapeHtml(manga.author)}</span>
      </div>`;
  }
  
  if (!aboutHtml) aboutHtml = '<p style="color:var(--text-muted);">No metadata available.</p>';
  about.innerHTML = `<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:var(--space-sm);color:var(--text-primary);">About</h3>${aboutHtml}`;

  const colSection = document.getElementById('sheet-collections');
  const colTags = document.getElementById('sheet-collection-tags');
  const mangaCollections = Array.isArray(manga.collections) ? manga.collections : [];
  if (mangaCollections.length > 0) {
    colSection.style.display = '';
    colTags.innerHTML = mangaCollections.map(cid => {
      const col = collections.find(c => c.id === cid);
      return col ? `<span style="display:inline-flex;align-items:center;padding:0.35rem 0.9rem;border-radius:999px;font-size:0.82rem;font-weight:700;background:var(--accent-soft);color:var(--accent);margin:0.2rem;">${escapeHtml(col.name)}</span>` : '';
    }).join('');
  } else {
    colSection.style.display = 'none';
  }

  const favBtn = document.getElementById('sheet-fav');
  favBtn.textContent = manga.is_favorite ? '❤️ Favorited' : '♡ Favorite';
  favBtn.style.background = manga.is_favorite ? 'var(--accent)' : '';
  favBtn.style.color = manga.is_favorite ? '#fff' : '';

  const resetBtn = document.getElementById('sheet-reset');
  if (resetBtn) resetBtn.style.display = manga.bookmark ? '' : 'none';
  
  const editBtn = document.getElementById('sheet-edit');
  if (editBtn) editBtn.style.display = manga.locked ? 'none' : '';

  document.body.style.overflow = 'hidden';
  void sheet.offsetHeight;
  sheet.classList.add('active');
}

function refreshSheetCollections() {
  if (!currentSheetManga) return;
  const manga = libraryData.find(m => m.id === currentSheetManga.id);
  if (!manga) return;
  currentSheetManga = manga;
  
  const colSection = document.getElementById('sheet-collections');
  const colTags = document.getElementById('sheet-collection-tags');
  const mangaCollections = Array.isArray(manga.collections) ? manga.collections : [];
  if (mangaCollections.length > 0) {
    colSection.style.display = '';
    colTags.innerHTML = mangaCollections.map(cid => {
      const col = collections.find(c => c.id === cid);
      return col ? `<span class="pill" style="display:inline-flex;align-items:center;padding:0.35rem 0.9rem;border-radius:999px;font-size:0.82rem;font-weight:700;background:var(--accent-soft);color:var(--accent);margin:0.2rem;">${escapeHtml(col.name)}</span>` : '';
    }).join('');
  } else {
    colSection.style.display = 'none';
  }
}

function closeSheet() {
  const sheet = document.getElementById('manga-sheet');
  sheet.classList.remove('active');
  setTimeout(() => {
    document.body.style.overflow = '';
    currentSheetManga = null;
  }, 500);
}

async function toggleFavoriteSheet() {
  if (!currentSheetManga) return;
  try {
    const result = await tauriInvoke('toggle_favorite', {
      id: currentSheetManga.id,
      title: currentSheetManga.title
    });
    libraryData = result;
    const manga = libraryData.find(m => m.id === currentSheetManga.id);
    currentSheetManga = manga;

    const favBtn = document.getElementById('sheet-fav');
    favBtn.textContent = manga.is_favorite ? '❤️ Favorited' : '♡ Favorite';
    favBtn.style.background = manga.is_favorite ? 'var(--accent)' : '';
    favBtn.style.color = manga.is_favorite ? '#fff' : '';

    renderLibrary(document.getElementById('search-input').value);
    showToast(manga.is_favorite ? 'Added to favorites!' : 'Removed from favorites', 'success');
  } catch (e) {
    showToast('Failed to update favorite', 'error');
  }
}

async function bookmarkSheet() {
  if (!currentSheetManga || !currentSheetManga.bookmark) return;
  try {
    await tauriInvoke('remove_bookmark', { id: currentSheetManga.id });
    libraryData = await tauriInvoke('get_library');
    const manga = libraryData.find(m => m.id === currentSheetManga.id);
    currentSheetManga = manga;

    renderLibrary(document.getElementById('search-input').value);
    renderContinueReading();
    showToast('Bookmark removed', 'success');
    closeSheet();
  } catch (e) {
    showToast('Failed to remove bookmark', 'error');
  }
}

function readNowSheet() {
  if (!currentSheetManga) return;
  let chapter = 0, page = 0, mode = 'vertical';
  if (currentSheetManga.bookmark) {
    chapter = currentSheetManga.bookmark.chapter;
    page = currentSheetManga.bookmark.page;
    mode = currentSheetManga.bookmark.mode || 'vertical';
  }
  sessionStorage.setItem('currentMangaId', currentSheetManga.id);
  window.location.href = `viewer.html?id=${encodeURIComponent(currentSheetManga.id)}&chapter=${chapter}&page=${page}&mode=${mode}`;
}

/* ========== DELETE CONFIRMATION ========== */

function showDeleteModal(id, title) {
  deleteTargetId = id;
  document.getElementById('delete-manga-title').textContent = title;
  const modal = document.getElementById('delete-modal');
  document.body.style.overflow = 'hidden';
  modal.classList.remove('hidden');
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-modal');
  modal.classList.add('hidden');
  deleteTargetId = null;
  setTimeout(() => {
    if (!document.querySelector('.modal-overlay:not(.hidden)')) document.body.style.overflow = '';
  }, 300);
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  try {
    libraryData = await tauriInvoke('delete_manga', { id: deleteTargetId });
    renderLibrary(document.getElementById('search-input').value);
    renderContinueReading();
    closeDeleteModal();
    closeSheet();
    showToast('Manga deleted', 'success');
  } catch (e) {
    showToast('Delete failed: ' + e, 'error');
  }
}

/* ========== COLLECTIONS ========== */

function renderCollectionBar() {
  const bar = document.getElementById('collection-bar');
  const list = document.getElementById('collection-list');
  if (currentFilter !== 'collection') {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  
  let html = '';
  collections.forEach(c => {
    const active = activeCollection === c.id ? 'active' : '';
    html += `<button class="collection-pill ${active}" data-id="${escapeHtml(c.id)}">${escapeHtml(c.name)} <span class="count">${c.manga_ids.length}</span></button>`;
  });
  list.innerHTML = html;
  
  list.querySelectorAll('.collection-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCollection = btn.dataset.id === activeCollection ? null : btn.dataset.id;
      renderCollectionBar();
      renderLibrary(document.getElementById('search-input').value);
    });
  });
}

function openCollectionPicker() {
  if (!currentSheetManga) return;
  
  // Always refresh collections from backend first
  tauriInvoke('get_collections').then(freshCollections => {
    collections = freshCollections;
    renderCollectionPickerUI();
  }).catch(() => {
    // If refresh fails, use what we have
    renderCollectionPickerUI();
  });
}

function renderCollectionPickerUI() {
  const modal = document.getElementById('collection-picker');
  const list = document.getElementById('collection-picker-list');
  
  let html = '';
  collections.forEach(c => {
    const isIn = currentSheetManga && c.manga_ids.includes(currentSheetManga.id);
    html += `
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
        <button class="collection-picker-item ${isIn ? 'active' : ''}" data-id="${escapeHtml(c.id)}" style="flex:1;">
          <span>${escapeHtml(c.name)}</span>
          <span>${isIn ? '✓ Added' : '+'}</span>
        </button>
        <button class="btn-icon delete-col-btn" data-delete-col="${escapeHtml(c.id)}" title="Delete collection" style="width:32px;height:32px;flex-shrink:0;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius-sm);display:inline-flex;align-items:center;justify-content:center;color:var(--error);font-size:1.1rem;font-weight:700;cursor:pointer;">×</button>
      </div>
    `;
  });
  
  if (!collections.length) {
    html = '<p style="color:var(--text-muted);text-align:center;padding:1rem;">No collections yet. Create one below.</p>';
  }
  
  list.innerHTML = html;
  
  // Add / Remove from collection
  list.querySelectorAll('.collection-picker-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cid = btn.dataset.id;
      const isIn = btn.classList.contains('active');
      try {
        if (isIn) {
          collections = await tauriInvoke('remove_from_collection', { collectionId: cid, mangaId: currentSheetManga.id });
          showToast('Removed from collection', 'changes');
        } else {
          collections = await tauriInvoke('add_to_collection', { collectionId: cid, mangaId: currentSheetManga.id });
          showToast('Added to collection', 'success');
        }
        // Refresh everything
        libraryData = await tauriInvoke('get_library');
        const freshManga = libraryData.find(m => m.id === currentSheetManga.id);
        if (freshManga) currentSheetManga = freshManga;
        renderCollectionPickerUI();
        renderCollectionBar();
        renderLibrary(document.getElementById('search-input').value);
        refreshSheetCollections();
      } catch (e) {
        console.error('Collection update error:', e);
        showToast('Collection update failed', 'error');
      }
    });
  });

  // Delete collection — use modal
  list.querySelectorAll('.delete-col-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = collections.find(c => c.id === btn.dataset.deleteCol);
      if (!col) return;
      showDeleteCollectionModal(col.id, col.name);
    });
  });
}

function closeCollectionPicker() {
  const modal = document.getElementById('collection-picker');
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => {
    if (!document.querySelector('.sheet.active')) {
      document.body.style.overflow = '';
    }
  }, 300);
}

function openCollectionManager() {
  // Open the collection picker without a manga context — just for managing collections
  const modal = document.getElementById('collection-picker');
  const list = document.getElementById('collection-picker-list');
  
  // Refresh collections first
  tauriInvoke('get_collections').then(freshCollections => {
    collections = freshCollections;
    renderCollectionManagerUI();
  }).catch(() => {
    renderCollectionManagerUI();
  });
}

function renderCollectionManagerUI() {
  const modal = document.getElementById('collection-picker');
  const list = document.getElementById('collection-picker-list');
  
  let html = '';
  collections.forEach(c => {
    html += `
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
        <div style="flex:1;padding:0.8rem 1rem;background:var(--bg-tertiary);border:1px solid var(--border-subtle);border-radius:var(--radius-md);color:var(--text-primary);font-size:0.9rem;font-weight:600;display:flex;justify-content:space-between;align-items:center;">
          <span>${escapeHtml(c.name)}</span>
          <span style="color:var(--text-muted);font-size:0.8rem;">${c.manga_ids.length} manga</span>
        </div>
        <button class="btn-icon delete-col-btn" data-delete-col="${escapeHtml(c.id)}" title="Delete collection" style="width:32px;height:32px;flex-shrink:0;background:var(--bg-tertiary);border:1px solid var(--border-medium);border-radius:var(--radius-sm);display:inline-flex;align-items:center;justify-content:center;color:var(--error);font-size:1.1rem;font-weight:700;cursor:pointer;">×</button>
      </div>
    `;
  });
  
  if (!collections.length) {
    html = '<p style="color:var(--text-muted);text-align:center;padding:1rem;">No collections yet. Create one below.</p>';
  }
  
  list.innerHTML = html;
  list.querySelectorAll('.delete-col-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const col = collections.find(c => c.id === btn.dataset.deleteCol);
      if (!col) return;
      showDeleteCollectionModal(col.id, col.name);
    });
  });
  
  document.body.style.overflow = 'hidden';
  void modal.offsetHeight;
  modal.classList.add('active');
}

async function createNewCollection() {
  const input = document.getElementById('new-collection-name');
  const name = input.value.trim();
  if (!name) return;
  try {
    collections = await tauriInvoke('create_collection', { name });
    input.value = '';
    showToast('Collection created', 'success');
    openCollectionPicker();
    renderCollectionBar();
  } catch (e) {
    showToast('Failed to create collection', 'error');
  }
}

/* ========== FILTERS & NAVIGATION ========== */

function setupFilters() {
  // Sidebar filter navigation
  document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item[data-filter]').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentFilter = item.dataset.filter;
      
      // Update page title
      const titles = {
        'all': 'Library',
        'favorites': 'Favorites',
        'bookmarks': 'Reading',
        'completed': 'Completed',
        'collection': 'Collections'
      };
      document.getElementById('page-title').textContent = titles[currentFilter] || 'Library';
      
      renderCollectionBar();
      renderLibrary(document.getElementById('search-input').value);
    });
  });

  // Sidebar view navigation (Settings, Studio, Stats)
// In setupFilters() or wherever you handle data-view clicks
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view === 'settings') window.location.href = 'settings.html';
      else if (view === 'studio') window.location.href = 'studio.html';
      else if (view === 'stats') window.location.href = 'statistics.html';
    });
  });
}

function recordReadTime(mangaId) {
  const map = JSON.parse(localStorage.getItem('Yomiki_read_times') || '{}');
  map[mangaId] = Date.now();
  localStorage.setItem('Yomiki_read_times', JSON.stringify(map));
}

function renderContinueReading() {
  const section = document.getElementById('continue-section');
  const scroll = document.getElementById('continue-scroll');
  const arrow = document.getElementById('continue-arrow');
  const times = JSON.parse(localStorage.getItem('Yomiki_read_times') || '{}');

  const reading = libraryData
    .filter(m => m.bookmark && !isCompleted(m))
    .sort((a, b) => (times[b.id] || 0) - (times[a.id] || 0))
    .slice(0, 8);

  if (!reading.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  if (continueExpanded) {
    scroll.style.maxHeight = '500px';
    scroll.style.opacity = '1';
    scroll.style.marginTop = 'var(--space-md)';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
  } else {
    scroll.style.maxHeight = '0';
    scroll.style.opacity = '0';
    scroll.style.marginTop = '0';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }

  scroll.innerHTML = reading.map((m, i) => {
    const ch = m.chapters[m.bookmark.chapter];
    const total = ch ? ch.pages.length : 1;
    const pct = Math.min(100, Math.round(((m.bookmark.page + 1) / total) * 100));
    return `
      <div class="continue-card" data-id="${escapeHtml(m.id)}" style="--card-index:${i}">
        <div class="continue-cover" id="cont-${escapeHtml(m.id)}">
          <div class="no-cover shimmer" style="height:100%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">Loading</div>
          <div class="continue-progress"><div class="continue-progress-bar" style="width:${pct}%"></div></div>
        </div>
        <div class="continue-info">
          <h4>${escapeHtml(m.title)}</h4>
          <p>Ch.${m.bookmark.chapter + 1} · ${pct}%</p>
        </div>
      </div>
    `;
  }).join('');

  scroll.querySelectorAll('.continue-card').forEach(card => {
    card.addEventListener('click', () => {
      const m = libraryData.find(x => x.id === card.dataset.id);
      if (!m || !m.bookmark) return;
      const b = m.bookmark;
      const mode = b.mode || 'vertical';
      window.location.href = `viewer.html?id=${encodeURIComponent(m.id)}&chapter=${b.chapter}&page=${b.page}&mode=${mode}`;
    });
  });

    reading.forEach(m => {
    if (!m.cover) return;
    tauriInvoke('get_image_base64', { path: m.cover }).then(data => {
      const el = document.getElementById(`cont-${m.id}`);
      if (!el) return;
      const bar = el.querySelector('.continue-progress')?.outerHTML || '';
      if (m.nsfw) {
        el.classList.add('nsfw-blur');
        el.innerHTML = `<img src="${data}" alt="" style="filter:blur(10px) brightness(0.7);">${bar}<div class="nsfw-label" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.6);z-index:3;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> NSFW</div>`;
      } else {
        el.innerHTML = `<img src="${data}" alt="">${bar}`;
      }
    }).catch(() => {});
  });
}

function closeStatsModal() {
  const modal = document.getElementById('stats-modal');
  modal.classList.remove('active');
  setTimeout(() => {
    document.body.style.overflow = '';
  }, 500);
}

async function openStatsModal() {
  const modal = document.getElementById('stats-modal');
  const grid = document.getElementById('stats-grid');

  const totalManga = libraryData.length;
  const totalChapters = libraryData.reduce((s, m) => s + m.chapters.length, 0);
  const totalPages = libraryData.reduce((s, m) => s + m.chapters.reduce((c, ch) => c + (ch.pages?.length || 0), 0), 0);
  const favorites = libraryData.filter(m => m.is_favorite).length;
  const bookmarked = libraryData.filter(m => m.bookmark).length;
  const completed = libraryData.filter(m => isCompleted(m)).length;

  let readPages = 0;
  libraryData.forEach(m => {
    if (!m.bookmark) return;
    for (let i = 0; i < m.bookmark.chapter; i++) readPages += m.chapters[i]?.pages?.length || 0;
    readPages += m.bookmark.page + 1;
  });
  const pct = totalPages > 0 ? Math.min(100, Math.round((readPages / totalPages) * 100)) : 0;

  let summary = null;
  try { summary = await tauriInvoke('get_reading_summary'); } catch (e) {}

  const todayPages = summary?.today_pages || 0;
  const weekPages = summary?.week_pages || 0;
  const totalTime = summary?.total_time_seconds || 0;
  const totalPagesRead = summary?.total_pages_read || 0;
  const lastRead = summary?.last_read_manga || '-';

  const hours = Math.floor(totalTime / 3600);
  const mins = Math.floor((totalTime % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  grid.innerHTML = `
    <div class="stat-card wide">
      <div class="stat-value" style="font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Important!</div>
      <div class="stat-label">This stats feature is still in development.</div>
    </div>
    <div class="stat-card highlight wide">
      <div class="stat-value">${pct}%</div>
      <div class="stat-label">Library Completion</div>
    </div>
    <div class="stat-card"><div class="stat-value">${todayPages}</div><div class="stat-label">Pages Today</div></div>
    <div class="stat-card"><div class="stat-value">${weekPages}</div><div class="stat-label">Pages This Week</div></div>
    <div class="stat-card time"><div class="stat-value">${timeStr}</div><div class="stat-label">Total Reading Time</div></div>
    <div class="stat-card"><div class="stat-value">${totalPagesRead}</div><div class="stat-label">Total Pages Read</div></div>
    <div class="stat-card wide"><div class="stat-value" style="font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(lastRead)}</div><div class="stat-label">Last Read Manga</div></div>
    <div class="stat-card"><div class="stat-value">${totalManga}</div><div class="stat-label">Total Manga</div></div>
    <div class="stat-card"><div class="stat-value">${totalChapters}</div><div class="stat-label">Chapters</div></div>
    <div class="stat-card"><div class="stat-value">${totalPages}</div><div class="stat-label">Pages</div></div>
    <div class="stat-card"><div class="stat-value">${favorites}</div><div class="stat-label">Favorites</div></div>
    <div class="stat-card"><div class="stat-value">${bookmarked}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card"><div class="stat-value">${completed}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card"><div class="stat-value">${collections.length}</div><div class="stat-label">Collections</div></div>
  `;

  document.body.style.overflow = 'hidden';
  void modal.offsetHeight;
  modal.classList.add('active');
}

/* ========== DRAG & DROP ========== */

function setupDragDrop() {
  const overlay = document.getElementById('drop-overlay');
  if (!overlay) return;

  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounter++;
    overlay.classList.remove('hidden');
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.add('hidden');
    }
  });

  document.addEventListener('dragover', (e) => e.preventDefault());

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add('hidden');
    
    if (e.dataTransfer.files.length > 0) {
      showToast('Please use the Import button for file imports', 'info');
    }
  });

  if (window.__TAURI__?.event) {
    window.__TAURI__.event.listen('tauri://drag-drop', async (event) => {
      const paths = event.payload?.paths || [];
      if (!paths.length) return;
      
      let imported = 0;
      for (const path of paths) {
        const lower = path.toLowerCase();
        let result = null;
        try {
          if (lower.endsWith('.zip') || lower.endsWith('.ykm') || lower.endsWith('.cbz')) {
            const filename = path.split(/[\\/]/).pop();
            result = await tauriInvoke('import_archive', { path, filename });
          } else {
            result = await tauriInvoke('scan_folder', { path });
          }
        } catch (err) {
          showToast(err, 'error');
          continue;
        }
        if (result) {
          libraryData = result;
          imported++;
        }
      }
      if (imported) {
        collections = await tauriInvoke('get_collections');
        renderLibrary();
        renderContinueReading();
        renderCollectionBar();
        showToast(`Imported ${imported} package(s)`, 'success');
      }
    });
  }
}

/* ========== INIT ========== */

function initFromUrl() {
  const saved = sessionStorage.getItem('yomiki_target_filter');
  if (saved && ['all','favorites','bookmarks','completed','collection'].includes(saved)) {
    currentFilter = saved;
  }
}

function syncSidebarActive() {
  document.querySelectorAll('.nav-item[data-filter]').forEach(i => {
    i.classList.toggle('active', i.dataset.filter === currentFilter);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Read filter from sessionStorage
  initFromUrl();

  // 2. Set title immediately (no blink)
  const titles = {
    'all': 'Library',
    'favorites': 'Favorites',
    'bookmarks': 'Reading',
    'completed': 'Completed',
    'collection': 'Collections'
  };
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = titles[currentFilter] || 'Library';

  // 3. Load library — sidebar sync happens AFTER data loads
  loadLibrary().then(() => {
    syncSidebarActive();
    sessionStorage.removeItem('yomiki_target_filter');
  });

  setupFilters();
  setupDragDrop();
  initViewToggle();

  // Continue reading toggle
  document.getElementById('continue-toggle')?.addEventListener('click', () => {
    continueExpanded = !continueExpanded;
    renderContinueReading();
  });

  // Sort dropdown
  const sortBtn = document.getElementById('btn-sort');
  const sortMenu = document.getElementById('sort-menu');
  
  sortBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle('hidden');
  });

  sortMenu?.querySelectorAll('.sort-option').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      sortMenu.classList.add('hidden');
      sortMenu.querySelectorAll('.sort-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#advanced-sort .adv-option').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === currentSort);
      });
      renderLibrary(document.getElementById('search-input').value);
      showToast(`Sorted: ${btn.textContent}`, 'changes');
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-dropdown') && !e.target.closest('#btn-sort')) {
      sortMenu?.classList.add('hidden');
    }
  });

  // Advanced Search panel
  const advBtn = document.getElementById('btn-advanced');
  const advPanel = document.getElementById('advanced-panel');
  const advClose = document.getElementById('btn-advanced-close');

  advBtn?.addEventListener('click', () => {
    advancedOpen = true;
    advPanel.classList.remove('hidden');
    renderGenreTags();
    renderAdvancedTags();
    renderTypeTags();
  });

  advClose?.addEventListener('click', () => {
    advancedOpen = false;
    advPanel.classList.add('hidden');
  });

  advPanel?.addEventListener('click', (e) => {
    if (e.target === advPanel) {
      advancedOpen = false;
      advPanel.classList.add('hidden');
    }
  });

  document.querySelectorAll('#advanced-sort .adv-option').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      document.querySelectorAll('#advanced-sort .adv-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sortMenu?.querySelectorAll('.sort-option').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === currentSort);
      });
      renderLibrary(document.getElementById('search-input').value);
    });
  });

  document.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeStatus = btn.dataset.status;
      document.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderLibrary(document.getElementById('search-input').value);
    });
  });

  // Rescan
  const rescanBtn = document.getElementById('btn-rescan');
  rescanBtn?.addEventListener('click', async () => {
    rescanBtn.classList.add('spin-anim');
    showToast('Rescanning library...', 'info');
    await loadLibrary();
    rescanBtn.classList.remove('spin-anim');
    showToast('Library refreshed!', 'success');
  });

  // Sheet buttons
  document.getElementById('sheet-close')?.addEventListener('click', closeSheet);
  document.getElementById('sheet-backdrop')?.addEventListener('click', closeSheet);
  document.getElementById('sheet-read')?.addEventListener('click', readNowSheet);
  document.getElementById('sheet-fav')?.addEventListener('click', toggleFavoriteSheet);
  document.getElementById('sheet-collection')?.addEventListener('click', openCollectionPicker);
  document.getElementById('sheet-delete')?.addEventListener('click', () => {
    if (currentSheetManga) showDeleteModal(currentSheetManga.id, currentSheetManga.title);
  });

  document.getElementById('delete-cancel')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-backdrop')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-confirm')?.addEventListener('click', confirmDelete);

  // Collection picker
  document.getElementById('collection-picker-close')?.addEventListener('click', closeCollectionPicker);
  document.getElementById('collection-picker-backdrop')?.addEventListener('click', closeCollectionPicker);

  // Onboarding
  document.getElementById('btn-onboarding-next')?.addEventListener('click', nextOnboardingStep);
  document.getElementById('btn-onboarding-prev')?.addEventListener('click', prevOnboardingStep);
  document.getElementById('onboarding-skip')?.addEventListener('click', closeOnboardingModal);
  
  document.querySelectorAll('.onboarding-dots .dot').forEach(dot => {
    dot.addEventListener('click', () => {
      onboardingStep = parseInt(dot.dataset.dot);
      updateOnboardingUI();
    });
  });
  
  document.getElementById('btn-create-collection')?.addEventListener('click', async () => {
    const input = document.getElementById('new-collection-name');
    const name = input?.value.trim();
    if (!name) return;
    try {
      collections = await tauriInvoke('create_collection', { name });
      if (input) input.value = '';
      showToast('Collection created', 'success');
      if (currentSheetManga) {
        renderCollectionPickerUI();
      } else {
        renderCollectionManagerUI();
      }
      renderCollectionBar();
    } catch (e) {
      showToast('Failed to create collection', 'error');
    }
  });

  document.getElementById('btn-new-collection')?.addEventListener('click', () => {
    currentSheetManga = null;
    openCollectionManager();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSheet();
      closeStatsModal();
      closeDeleteModal();
      closeResetModal();
      closeDeleteCollectionModal();
      closeCollectionPicker();
      closeOnboardingModal();
      if (advancedOpen) {
        document.getElementById('advanced-panel')?.classList.add('hidden');
        advancedOpen = false;
      }
    }
  });

  document.getElementById('search-input')?.addEventListener('input', (e) => renderLibrary(e.target.value));

  document.getElementById('stats-close')?.addEventListener('click', closeStatsModal);
  document.getElementById('stats-backdrop')?.addEventListener('click', closeStatsModal);

  document.getElementById('sheet-reset')?.addEventListener('click', () => {
    if (!currentSheetManga || !currentSheetManga.bookmark) return;
    showResetModal(currentSheetManga.id, currentSheetManga.title);
  });

  // Delete modal
  document.getElementById('delete-cancel')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-confirm')?.addEventListener('click', confirmDelete);

  // Reset modal
  document.getElementById('reset-cancel')?.addEventListener('click', closeResetModal);
  document.getElementById('reset-confirm')?.addEventListener('click', confirmReset);

  // Delete collection modal
  document.getElementById('delete-collection-cancel')?.addEventListener('click', closeDeleteCollectionModal);
  document.getElementById('delete-collection-confirm')?.addEventListener('click', confirmDeleteCollection);

  // Edit button
  document.getElementById('sheet-edit')?.addEventListener('click', () => {
    if (!currentSheetManga || currentSheetManga.locked) return;
    window.location.href = `studio.html?path=${encodeURIComponent(currentSheetManga.path)}`;
  });
});