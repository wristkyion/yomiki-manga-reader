let manga = null;
let currentChapter = 0;
let currentPage = 0;
let mode = 'vertical';
let verticalRenderedChapter = -1;
let suppressScrollPageUpdate = false;
let sessionStartTime = Date.now();
let lastRecordTime = Date.now();
let sessionPagesFlipped = 0;
let countedPages = new Set();
let liveTimerInterval = null;
let preloadedImages = new Map();

const UI_HIDE_DELAY = 3000;
let mouseOverUI = false;
let uiVisible = true;

/* ============================================
   DAILY PAGE TRACKING — called whenever a page
   is first viewed in this session
   ============================================ */
function trackDailyPage() {
  try {
    const key = 'Yomiki_daily_pages';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const today = new Date().toISOString().split('T')[0];
    data[today] = (data[today] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('trackDailyPage failed:', e);
  }
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const mangaId = params.get('id');
  currentChapter = parseInt(params.get('chapter') || '0', 10);
  currentPage = parseInt(params.get('page') || '0', 10);
  mode = params.get('mode') || 'vertical';
  countedPages = new Set();

  if (!mangaId) {
    document.body.innerHTML = '<div class="error"><p>No manga selected.</p><a href="index.html">← Back to Library</a></div>';
    return;
  }

  tauriInvoke('get_library').then(library => {
    manga = library.find(m => m.id === mangaId);
    if (!manga) {
      document.body.innerHTML = '<div class="error"><p>Manga not found.</p><a href="index.html">← Back to Library</a></div>';
      return;
    }
    sessionStartTime = Date.now();
    lastRecordTime = Date.now();
    sessionPagesFlipped = 0;
    discordConnect();
    updateDiscordPresence();
    startLiveTimer();
    setupViewer();
    initTheme();
  });
}

function startLiveTimer() {
  const timerEl = document.getElementById('live-timer');
  if (liveTimerInterval) clearInterval(liveTimerInterval);

  liveTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    if (timerEl) timerEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${mins}:${secs}`;
  }, 1000);
}

function stopLiveTimer() {
  if (liveTimerInterval) {
    clearInterval(liveTimerInterval);
    liveTimerInterval = null;
  }
}

function loadKeybinds() {
  try {
    const raw = localStorage.getItem('Yomiki_keybinds');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    next_page: 'ArrowRight',
    prev_page: 'ArrowLeft',
    toggle_fullscreen: 'f',
    save_bookmark: 'b'
  };
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

/* ─── Auto-Hide: Edge-hover with delay (float) ─── */
function setupAutoHide() {
  const header = document.querySelector('.viewer-header');
  const controls = document.querySelector('.viewer-controls');
  const EDGE_ZONE = 45;   // px from top/bottom to trigger show
  const SHOW_DELAY = 120; // ms delay before showing

  let showTimer = null;
  let hideTimer = null;

  function scheduleShow() {
    if (uiVisible) return;
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      showViewerUI();
    }, SHOW_DELAY);
  }

  function scheduleHide() {
    if (mouseOverUI) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      hideViewerUI();
    }, UI_HIDE_DELAY);
  }

  document.addEventListener('mousemove', (e) => {
    const y = e.clientY;
    const h = window.innerHeight;
    const nearEdge = y < EDGE_ZONE || y > h - EDGE_ZONE;
    const overUI = e.target.closest('.viewer-header, .viewer-controls');

    if (nearEdge || overUI) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      scheduleShow();
    } else {
      if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      scheduleHide();
    }
  });

  [header, controls].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', () => {
      mouseOverUI = true;
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      showViewerUI();
    });
    el.addEventListener('mouseleave', () => {
      mouseOverUI = false;
      scheduleHide();
    });
  });

  // Start hidden after a short delay so it doesn't flash on load
  setTimeout(scheduleHide, 800);
}

function showViewerUI() {
  if (uiVisible) return;
  uiVisible = true;

  document.body.classList.remove('ui-hidden');

  const header = document.querySelector('.viewer-header');
  const controls = document.querySelector('.viewer-controls');
  const progressBar = document.querySelector('.progress-bar-container');
  const progressText = document.querySelector('.progress-text');

  if (header) header.classList.remove('hidden-ui');
  if (controls) controls.classList.remove('hidden-ui');
  if (progressBar) progressBar.classList.remove('hidden-ui');
  if (progressText) progressText.classList.remove('hidden-ui');
}

function hideViewerUI() {
  if (mouseOverUI) return;
  uiVisible = false;

  document.body.classList.add('ui-hidden');

  const header = document.querySelector('.viewer-header');
  const controls = document.querySelector('.viewer-controls');
  const progressBar = document.querySelector('.progress-bar-container');
  const progressText = document.querySelector('.progress-text');

  if (header) header.classList.add('hidden-ui');
  if (controls) controls.classList.add('hidden-ui');
  if (progressBar) progressBar.classList.add('hidden-ui');
  if (progressText) progressText.classList.add('hidden-ui');
}

async function discordConnect() {
  try {
    await tauriInvoke('discord_connect');
  } catch (e) {
    console.log('Discord not available:', e);
  }
}

function updateDiscordPresence() {
  if (!manga) return;
  const ch = manga.chapters[currentChapter];
  const chName = ch ? ch.name : 'Unknown';
  const pageNum = currentPage + 1;
  const totalPages = ch ? ch.pages.length : 0;

  const state = `Ch. ${currentChapter + 1}: ${chName}`;
  const details = `Reading ${manga.title}`;
  const largeText = `Yomiki Reader`;
  const smallText = `${pageNum}/${totalPages} pages · ${mode} mode`;

  tauriInvoke('discord_update_presence', {
    state,
    details,
    largeText,
    smallText
  }).catch(() => {});
}

function clearDiscordPresence() {
  tauriInvoke('discord_clear_presence').catch(() => {});
}

function recordStats() {
  if (!manga) return;
  const now = Date.now();
  const duration = Math.floor((now - lastRecordTime) / 1000);
  lastRecordTime = now;

  tauriInvoke('record_reading_session', {
    mangaId: manga.id,
    mangaTitle: manga.title,
    chapter: currentChapter,
    pagesRead: currentPage + 1,
    durationSeconds: duration
  }).catch(err => console.log('Stats error:', err));
}

function shouldAutoBookmark() {
  const saved = localStorage.getItem('Yomiki_auto_bookmark');
  if (saved !== null) return saved === '1';
  // Default true if not set
  return true;
}

function saveProgress() {
  if (!manga) return;
  recordStats();
  updateDiscordPresence();

  // Only skip the actual bookmark save if auto-bookmark is disabled
  if (!shouldAutoBookmark()) return;

  tauriInvoke('save_bookmark', {
    id: manga.id,
    chapter: currentChapter,
    page: currentPage,
    mode: mode
  }).catch(() => {});
}

function setupViewer() {
  document.getElementById('manga-title').textContent = manga.title;

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.viewer-header, .viewer-controls, #chapter-select, .mode-switcher')) return;
    e.preventDefault();

    showContextMenu([
      { 
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', 
        label: 'Back to Library', 
        action: () => { saveProgress(); clearDiscordPresence(); window.location.href = 'index.html'; } 
      },
      { separator: true },
      { 
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>', 
        label: 'Previous Page', 
        action: () => prevPage() 
      },
      { 
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>', 
        label: 'Next Page', 
        action: () => nextPage() 
      },
      { separator: true },
      { 
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>', 
        label: 'Vertical Mode', 
        action: () => { mode = 'vertical'; updateUrl(); render(); } 
      },
      { 
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>', 
        label: 'Single Page', 
        action: () => { mode = 'single'; updateUrl(); render(); } 
      },
      { 
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', 
        label: 'Book Mode', 
        action: () => { mode = 'book'; updateUrl(); render(); } 
      },
      { separator: true },
      { 
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>', 
        label: 'Save Bookmark', 
        action: () => { 
          if (!manga) return;
          recordStats();
          updateDiscordPresence();
          tauriInvoke('save_bookmark', {
            id: manga.id,
            chapter: currentChapter,
            page: currentPage,
            mode: mode
          }).then(() => {
            showToast('Bookmark saved!', 'success');
          }).catch(() => {
            showToast('Failed to save bookmark', 'error');
          });
        }
      }
    ], e.clientX, e.clientY);
  });

  const chSelect = document.getElementById('chapter-select');
  chSelect.innerHTML = manga.chapters.map((ch, i) =>
    `<option value="${i}" ${i === currentChapter ? 'selected' : ''}>${escapeHtml(ch.name)}</option>`
  ).join('');

  chSelect.addEventListener('change', (e) => {
    saveProgress();
    currentChapter = parseInt(e.target.value, 10);
    currentPage = 0;
    verticalRenderedChapter = -1;
    updateUrl();
    render();
  });

  document.querySelectorAll('.mode-switcher button').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      updateUrl();
      render();
    });
  });

  document.getElementById('prev-btn').addEventListener('click', prevPage);
  document.getElementById('next-btn').addEventListener('click', nextPage);
  document.getElementById('back-btn').addEventListener('click', () => {
    saveProgress();
    stopLiveTimer();
    clearDiscordPresence();
    window.location.href = 'index.html';
  });

  document.getElementById('fullscreen-btn')?.addEventListener('click', toggleFullscreen);

  document.addEventListener('keydown', handleKey);
  document.getElementById('reader-container').addEventListener('click', handleClick);

  setupAutoHide();

  window.addEventListener('beforeunload', () => {
    saveProgress();
    stopLiveTimer();
    clearDiscordPresence();
  });

  const container = document.getElementById('reader-container');
  container.addEventListener('scroll', () => {
    if (mode !== 'vertical' || suppressScrollPageUpdate) return;
    const imgs = container.querySelectorAll('img[data-index]');
    let closest = 0;
    let minDist = Infinity;
    const containerCenter = container.scrollTop + container.clientHeight / 3;

    imgs.forEach(img => {
      const imgCenter = img.offsetTop + img.clientHeight / 2;
      const dist = Math.abs(imgCenter - containerCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = parseInt(img.dataset.index, 10);
      }
    });

    if (closest !== currentPage) {
      const start = Math.min(currentPage, closest);
      const end = Math.max(currentPage, closest);
      for (let i = start; i <= end; i++) {
        const key = `${currentChapter}-${i}`;
        if (!countedPages.has(key)) {
          countedPages.add(key);
          sessionPagesFlipped++;
          trackDailyPage(); // <-- REAL TRACKING
        }
      }
      currentPage = closest;
      updateDiscordPresence();
      updateUrl();
      updateCounter();
      // Auto-save on page change if enabled
      if (shouldAutoBookmark()) {
        tauriInvoke('save_bookmark', {
          id: manga.id,
          chapter: currentChapter,
          page: currentPage,
          mode: mode
        }).catch(() => {});
      }
    }
  });

  updateModeButtons();
  render();
}

function updateUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('chapter', currentChapter);
  url.searchParams.set('page', currentPage);
  url.searchParams.set('mode', mode);
  window.history.replaceState({}, '', url);
}

function updateCounter() {
  const ch = manga.chapters[currentChapter];
  if (!ch) return;
  document.getElementById('page-counter').textContent = `${currentPage + 1} / ${ch.pages.length}`;
  updateProgress();
}

function updateModeButtons() {
  document.querySelectorAll('.mode-switcher button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function getTotalPages() {
  const ch = manga.chapters[currentChapter];
  return ch ? ch.pages.length : 0;
}

function prevPage() {
  if (mode === 'vertical') {
    const container = document.getElementById('reader-container');
    const imgs = container.querySelectorAll('img[data-index]');

    // First try to go to previous page within current chapter
    if (currentPage > 0) {
      const target = imgs[currentPage - 1];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    // If at first page, go to previous chapter
    if (currentChapter > 0) {
      saveProgress();
      currentChapter--;
      currentPage = manga.chapters[currentChapter].pages.length - 1;
      verticalRenderedChapter = -1;
      document.getElementById('chapter-select').value = currentChapter;
      updateUrl();
      render();
    }
    return;
  }
  if (mode === 'book') {
    if (currentPage >= 2) {
      const p1 = `${currentChapter}-${currentPage - 1}`;
      const p2 = `${currentChapter}-${currentPage - 2}`;
      if (!countedPages.has(p1)) { countedPages.add(p1); sessionPagesFlipped++; trackDailyPage(); }
      if (!countedPages.has(p2)) { countedPages.add(p2); sessionPagesFlipped++; trackDailyPage(); }
      currentPage -= 2;
    } else if (currentPage === 1) {
      const p0 = `${currentChapter}-0`;
      if (!countedPages.has(p0)) { countedPages.add(p0); sessionPagesFlipped++; trackDailyPage(); }
      currentPage = 0;
    } else if (currentChapter > 0) {
      // Prev chapter in book mode
      saveProgress();
      currentChapter--;
      const ch = manga.chapters[currentChapter];
      currentPage = ch.pages.length % 2 === 0 ? ch.pages.length - 2 : ch.pages.length - 1;
      document.getElementById('chapter-select').value = currentChapter;
      updateUrl();
      render();
      return;
    }
  } else {
    if (currentPage > 0) {
      const p = `${currentChapter}-${currentPage - 1}`;
      if (!countedPages.has(p)) { countedPages.add(p); sessionPagesFlipped++; trackDailyPage(); }
      currentPage--;
    } else if (currentChapter > 0) {
      // Prev chapter in single mode
      saveProgress();
      currentChapter--;
      currentPage = manga.chapters[currentChapter].pages.length - 1;
      document.getElementById('chapter-select').value = currentChapter;
      updateUrl();
      render();
      return;
    }
  }
  updateDiscordPresence();
  updateUrl();
  render();
  saveProgress();
}

function nextPage() {
  const total = getTotalPages();

  if (mode === 'vertical') {
    const container = document.getElementById('reader-container');
    const imgs = container.querySelectorAll('img[data-index]');
    const totalPages = imgs.length;

    // First try to go to next page within current chapter
    if (currentPage < totalPages - 1) {
      const target = imgs[currentPage + 1];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    // If at last page, go to next chapter
    if (currentChapter < manga.chapters.length - 1) {
      saveProgress();
      currentChapter++;
      currentPage = 0;
      verticalRenderedChapter = -1;
      document.getElementById('chapter-select').value = currentChapter;
      updateUrl();
      render();
    }
    return;
  }
  if (mode === 'book') {
    if (currentPage + 2 < total) {
      const p1 = `${currentChapter}-${currentPage + 1}`;
      const p2 = `${currentChapter}-${currentPage + 2}`;
      if (!countedPages.has(p1)) { countedPages.add(p1); sessionPagesFlipped++; trackDailyPage(); }
      if (!countedPages.has(p2)) { countedPages.add(p2); sessionPagesFlipped++; trackDailyPage(); }
      currentPage += 2;
    } else if (currentPage + 1 < total) {
      const p1 = `${currentChapter}-${currentPage + 1}`;
      if (!countedPages.has(p1)) { countedPages.add(p1); sessionPagesFlipped++; trackDailyPage(); }
      currentPage += 1;
    } else if (currentChapter < manga.chapters.length - 1) {
      saveProgress();
      currentChapter++;
      currentPage = 0;
      const p0 = `${currentChapter}-0`;
      if (!countedPages.has(p0)) { countedPages.add(p0); sessionPagesFlipped++; trackDailyPage(); }
      document.getElementById('chapter-select').value = currentChapter;
      updateUrl();
      render();
      return;
    }
  } else {
    if (currentPage + 1 < total) {
      const p = `${currentChapter}-${currentPage + 1}`;
      if (!countedPages.has(p)) { countedPages.add(p); sessionPagesFlipped++; trackDailyPage(); }
      currentPage++;
    } else if (currentChapter < manga.chapters.length - 1) {
      saveProgress();
      currentChapter++;
      currentPage = 0;
      const p0 = `${currentChapter}-0`;
      if (!countedPages.has(p0)) { countedPages.add(p0); sessionPagesFlipped++; trackDailyPage(); }
      document.getElementById('chapter-select').value = currentChapter;
      updateUrl();
      render();
      return;
    }
  }
  updateDiscordPresence();
  updateUrl();
  render();
  saveProgress();
}

function handleKey(e) {
  if (e.key === 'Escape') {
    saveProgress();
    stopLiveTimer();
    clearDiscordPresence();
    window.location.href = 'index.html';
    return;
  }

  const kb = loadKeybinds();
  const nextKey = kb.next_page || 'ArrowRight';
  const prevKey = kb.prev_page || 'ArrowLeft';
  const fsKey = kb.toggle_fullscreen || 'f';
  const bmKey = kb.save_bookmark || 'b';

  if (e.key === fsKey) {
    e.preventDefault();
    toggleFullscreen();
    return;
  }
  if (e.key === bmKey) {
    e.preventDefault();
    if (!shouldAutoBookmark()) {
      // Manual save when auto is off
      tauriInvoke('save_bookmark', {
        id: manga.id,
        chapter: currentChapter,
        page: currentPage,
        mode: mode
      }).catch(() => {});
      showToast('Bookmark saved!', 'success');
    } else {
      saveProgress();
      showToast('Bookmark saved!', 'success');
    }
    return;
  }

  if (mode === 'vertical') {
    const container = document.getElementById('reader-container');
    const imgs = container.querySelectorAll('img[data-index]');
    const scrollAmount = container.clientHeight * 0.9;

    if (e.key === prevKey || e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      // If at very top of first page, go prev chapter
      if (currentPage === 0 && container.scrollTop <= 10) {
        if (currentChapter > 0) {
          saveProgress();
          currentChapter--;
          currentPage = manga.chapters[currentChapter].pages.length - 1;
          verticalRenderedChapter = -1;
          document.getElementById('chapter-select').value = currentChapter;
          updateUrl();
          render();
        }
        return;
      }
      // Otherwise scroll up or go to prev page
      if (currentPage > 0) {
        imgs[currentPage - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      }
      return;
    }

    if (e.key === nextKey || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      const totalPages = imgs.length;
      const currentImg = imgs[currentPage];
      const isAtBottom = currentImg ? 
        (currentImg.offsetTop + currentImg.clientHeight - container.scrollTop <= container.clientHeight + 50) : false;

      // If at last page and at bottom, go next chapter
      if (currentPage >= totalPages - 1 && isAtBottom) {
        if (currentChapter < manga.chapters.length - 1) {
          saveProgress();
          currentChapter++;
          currentPage = 0;
          verticalRenderedChapter = -1;
          document.getElementById('chapter-select').value = currentChapter;
          updateUrl();
          render();
        }
        return;
      }
      // Otherwise scroll down or go to next page
      if (currentPage < totalPages - 1 && isAtBottom) {
        imgs[currentPage + 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      }
      return;
    }
  }

  if (e.key === prevKey || e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault();
    prevPage();
  } else if (e.key === nextKey || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    nextPage();
  }
}

function handleClick(e) {
  if (mode === 'vertical') return;

  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const w = rect.width;
  if (x < w * 0.3) prevPage();
  else if (x > w * 0.7) nextPage();
}

async function loadImgSrc(img, path) {
  if (preloadedImages.has(path)) {
    img.src = preloadedImages.get(path);
    return;
  }
  try {
    const data = await tauriInvoke('get_image_base64', { path });
    img.src = data;
  } catch (err) {
    console.error('Failed to load page:', path, err);
    img.alt = 'Failed';
  }
}

function updateProgress() {
  const ch = manga?.chapters[currentChapter];
  if (!ch) return;

  const totalPages = ch.pages.length;
  const totalChapters = manga.chapters.length;

  let pagesBefore = 0;
  for (let i = 0; i < currentChapter; i++) {
    pagesBefore += manga.chapters[i].pages.length;
  }

  const currentProgress = currentPage + (mode === 'book' ? 2 : 1);
  const totalAllPages = manga.chapters.reduce((sum, c) => sum + c.pages.length, 0);
  const readPages = pagesBefore + Math.min(currentProgress, totalPages);
  const percent = Math.round((readPages / totalAllPages) * 100);

  document.getElementById('progress-bar').style.width = percent + '%';
  document.getElementById('progress-text').textContent = `${percent}% · Ch.${currentChapter + 1}/${totalChapters}`;
}

function render() {
  updateModeButtons();
  updateCounter();
  const container = document.getElementById('reader-container');
  const ch = manga.chapters[currentChapter];
  if (!ch) return;

  container.className = 'reader-container mode-' + mode;

  if (mode === 'vertical') {
    const overlay = document.getElementById('loading-overlay');

    if (verticalRenderedChapter !== currentChapter) {
      overlay.classList.remove('hidden');
      verticalRenderedChapter = currentChapter;
      suppressScrollPageUpdate = true;

      let loadedCount = 0;
      const total = ch.pages.length;

      const oldImages = container.querySelectorAll('.manga-page');
      oldImages.forEach(img => img.remove());

      const onImgDone = () => {
        loadedCount++;
        if (loadedCount >= total) {
          overlay.classList.add('hidden');
          const target = container.querySelector(`img[data-index="${currentPage}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
          }
          requestAnimationFrame(() => {
            setTimeout(() => { suppressScrollPageUpdate = false; }, 50);
          });
        }
      };

      ch.pages.forEach((page, i) => {
        const img = document.createElement('img');
        img.alt = `Page ${i + 1}`;
        img.className = 'manga-page';
        img.dataset.index = i;

        img.onload = onImgDone;
        img.onerror = onImgDone;

        container.appendChild(img);
        loadImgSrc(img, page).catch(() => onImgDone());
      });
    }
  }
  else if (mode === 'single') {
    verticalRenderedChapter = -1;
    container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Loading page...</p></div>';

    const img = document.createElement('img');
    img.alt = `Page ${currentPage + 1}`;
    img.className = 'manga-page';
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s ease';
    img.onload = () => { img.style.opacity = '1'; };

    if (currentPage + 1 < ch.pages.length) {
      tauriInvoke('get_image_base64', { path: ch.pages[currentPage + 1] }).catch(() => {});
    }

    loadImgSrc(img, ch.pages[currentPage]).then(() => {
      container.innerHTML = '';
      container.appendChild(img);
    });
  }
  else if (mode === 'book') {
    verticalRenderedChapter = -1;
    container.innerHTML = '<div class="loading-page"><div class="spinner"></div><p>Loading pages...</p></div>';

    const wrap = document.createElement('div');
    wrap.className = 'book-spread';

    const rtl = localStorage.getItem('Yomiki_rtl') === '1';

    let loadedCount = 0;
    const totalToLoad = (currentPage < ch.pages.length ? 1 : 0) + (currentPage + 1 < ch.pages.length ? 1 : 0);

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        container.innerHTML = '';
        container.appendChild(wrap);
      }
    };

    if (currentPage < ch.pages.length) {
      const img1 = document.createElement('img');
      img1.className = rtl ? 'manga-page right-page' : 'manga-page left-page';
      img1.style.opacity = '0';
      img1.style.transition = 'opacity 0.3s ease';
      img1.onload = () => { img1.style.opacity = '1'; checkLoaded(); };
      img1.onerror = () => { img1.style.opacity = '1'; checkLoaded(); };
      wrap.appendChild(img1);
      loadImgSrc(img1, ch.pages[currentPage]);
    }
    if (currentPage + 1 < ch.pages.length) {
      const img2 = document.createElement('img');
      img2.className = rtl ? 'manga-page left-page' : 'manga-page right-page';
      img2.style.opacity = '0';
      img2.style.transition = 'opacity 0.3s ease';
      img2.onload = () => { img2.style.opacity = '1'; checkLoaded(); };
      img2.onerror = () => { img2.style.opacity = '1'; checkLoaded(); };
      wrap.appendChild(img2);
      loadImgSrc(img2, ch.pages[currentPage + 1]);
    }

    if (totalToLoad === 0) {
      container.innerHTML = '<div class="loading-page">No pages</div>';
    }
  }
  if (mode !== 'vertical' && currentPage >= getTotalPages() - 3) {
    preloadNextChapter();
  }
}

function preloadNextChapter() {
  if (!manga || currentChapter >= manga.chapters.length - 1) return;
  const next = manga.chapters[currentChapter + 1];
  if (!next?.pages?.length) return;

  next.pages.slice(0, 3).forEach(path => {
    if (preloadedImages.has(path)) return;
    tauriInvoke('get_image_base64', { path })
      .then(data => preloadedImages.set(path, data))
      .catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', init);