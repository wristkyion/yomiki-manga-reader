let libraryData = [];
let collections = [];
let readingSummary = null;

function initSidebarNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (page === 'statistics.html') {
    document.querySelector('.nav-item[data-view="stats"]')?.classList.add('active');
  } else if (page === 'settings.html') {
    document.querySelector('.nav-item[data-view="settings"]')?.classList.add('active');
  } else if (page === 'studio.html') {
    document.querySelector('.nav-item[data-view="studio"]')?.classList.add('active');
  }

  // FILTER buttons -> go to Library
  document.querySelectorAll('.nav-item[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      sessionStorage.setItem('yomiki_target_filter', filter);
      window.location.href = 'index.html';
    });
  });

  // VIEW buttons
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'stats') return; // already here
      if (view === 'studio') window.location.href = 'studio.html';
      if (view === 'settings') window.location.href = 'settings.html';
    });
  });

  // Footer buttons
  document.getElementById('btn-import')?.addEventListener('click', () => {
    showToast('Import is available on the Library page', 'info');
  });
  document.getElementById('btn-scan')?.addEventListener('click', () => {
    showToast('Scan Folder is available on the Library page', 'info');
  });
}

function isCompleted(manga) {
  if (!manga || !manga.bookmark || !manga.chapters.length) return false;
  const lastCh = manga.chapters.length - 1;
  const lastPg = Math.max(0, (manga.chapters[lastCh]?.pages?.length || 1) - 1);
  return manga.bookmark.chapter >= lastCh && manga.bookmark.page >= lastPg;
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

function calculateReadingStreak() {
  const readTimes = JSON.parse(localStorage.getItem('Yomiki_read_times') || '{}');
  const dates = Object.values(readTimes)
    .map(t => new Date(t).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => new Date(b) - new Date(a));

  if (!dates.length) return 0;

  let streak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  for (let i = 0; i < dates.length; i++) {
    const checkDate = new Date(Date.now() - i * 86400000).toDateString();
    if (dates.includes(checkDate)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/* ============================================
   READ ACTIVITY — reads from localStorage
   written by reader.js trackDailyPage()
   ============================================ */
function getLast7DaysActivity() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyPages = JSON.parse(localStorage.getItem('Yomiki_daily_pages') || '{}');
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    result.push({
      label: days[d.getDay()],
      value: dailyPages[dateKey] || 0
    });
  }
  return result;
}

function getGenreColors() {
  return [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
}

function drawActivityChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 10, right: 10, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (!data.length || data.every(d => d.value === 0)) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No reading data yet', width / 2, height / 2);
    return;
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = (chartW / data.length) * 0.7;
  const gap = (chartW / data.length) * 0.3;

  // Grid lines
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-subtle');
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Bars
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  data.forEach((d, i) => {
    const x = padding.left + i * (barW + gap) + gap / 2;
    const barH = (d.value / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    // Bar
    const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(1, accent + '40');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, height - 8);
  });
}

function drawGenreDonut(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(centerX, centerY) - 10;
  const innerRadius = radius * 0.6;

  if (!data.length) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No genres yet', centerX, centerY);
    return;
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  let currentAngle = -Math.PI / 2;

  data.forEach(d => {
    const sliceAngle = (d.value / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();

    currentAngle += sliceAngle;
  });
}

function renderStatusBars(data) {
  const container = document.getElementById('status-bars');
  if (!container) return;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const colors = {
    'Ongoing': 'var(--accent)',
    'Completed': 'var(--success)',
    'Hiatus': '#F7DC6F',
    'Unknown': 'var(--text-muted)'
  };

  container.innerHTML = data.map(d => `
    <div class="status-bar-row">
      <div class="status-bar-label">${escapeHtml(d.label)}</div>
      <div class="status-bar-track">
        <div class="status-bar-fill" style="width:0%; background: ${colors[d.label] || 'var(--accent)'}"></div>
      </div>
      <div class="status-bar-value">${d.value}</div>
    </div>
  `).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.status-bar-fill').forEach((fill, i) => {
      setTimeout(() => {
        fill.style.width = `${(data[i].value / maxVal) * 100}%`;
      }, 100 + i * 100);
    });
  });
}

function renderGenreLegend(data) {
  const container = document.getElementById('genre-legend');
  if (!container) return;

  container.innerHTML = data.map(d => `
    <div class="legend-row">
      <div class="legend-row-name">
        <span class="legend-row-dot" style="background:${d.color}"></span>
        <span>${escapeHtml(d.label)}</span>
      </div>
      <div class="legend-row-value">${d.value}</div>
    </div>
  `).join('');
}

async function renderTopManga(list) {
  const container = document.getElementById('top-manga');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No reading data yet</div>';
    return;
  }

  const maxProgress = Math.max(...list.map(m => m.progress), 1);

  // Pre-load cover images as base64
  const mangaWithCovers = await Promise.all(
    list.map(async (m) => {
      if (!m.coverPath) return { ...m, coverData: null };
      try {
        const data = await tauriInvoke('get_image_base64', { path: m.coverPath });
        return { ...m, coverData: data };
      } catch (e) {
        return { ...m, coverData: null };
      }
    })
  );

  container.innerHTML = mangaWithCovers.map((m, i) => `
    <div class="top-manga-item">
      <div class="top-manga-rank ${i < 3 ? 'top' : ''}">${i + 1}</div>
      <div class="top-manga-cover">
        ${m.coverData 
          ? `<img src="${m.coverData}" alt="${escapeHtml(m.title)}">` 
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);color:var(--text-muted);font-size:0.7rem;">No Cover</div>`
        }
      </div>
      <div class="top-manga-info">
        <div class="top-manga-title">${escapeHtml(m.title)}</div>
        <div class="top-manga-meta">${m.chapters} chapters · ${m.progress}% read</div>
      </div>
      <div class="top-manga-bar">
        <div class="top-manga-progress" style="width:0%"></div>
      </div>
    </div>
  `).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.top-manga-progress').forEach((bar, i) => {
      setTimeout(() => {
        bar.style.width = `${(mangaWithCovers[i].progress / maxProgress) * 100}%`;
      }, 200 + i * 100);
    });
  });
}

function renderTimeBreakdown(data) {
  const container = document.getElementById('time-breakdown');
  if (!container) return;

  container.innerHTML = data.map(d => `
    <div class="time-break-item">
      <span class="time-break-label">${escapeHtml(d.label)}</span>
      <span class="time-break-value">${d.value}</span>
    </div>
  `).join('');
}

async function loadStats() {
  try {
    libraryData = await tauriInvoke('get_library');
    collections = await tauriInvoke('get_collections');
    readingSummary = await tauriInvoke('get_reading_summary').catch(() => null);
  } catch (e) {
    console.error('Failed to load stats:', e);
    showToast('Failed to load statistics', 'error');
    return;
  }

  // Calculate stats
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
  const completionPct = totalPages > 0 ? Math.min(100, Math.round((readPages / totalPages) * 100)) : 0;

  // Hero section
  document.getElementById('hero-completion').textContent = completionPct + '%';
  document.getElementById('hero-fill').style.width = completionPct + '%';
  document.getElementById('hero-total').textContent = totalManga;
  document.getElementById('hero-read').textContent = bookmarked;
  document.getElementById('hero-done').textContent = completed;

  // Mini cards
  document.getElementById('mini-chapters').textContent = totalChapters;
  document.getElementById('mini-pages').textContent = totalPages;
  document.getElementById('mini-fav').textContent = favorites;
  document.getElementById('mini-collections').textContent = collections.length;
  document.getElementById('mini-streak').textContent = calculateReadingStreak();

  /* ============================================
     REAL READING ACTIVITY — from localStorage
     ============================================ */
  const activityData = getLast7DaysActivity();
  drawActivityChart(document.getElementById('activity-canvas'), activityData);

  // Genre breakdown
  const genreMap = {};
  libraryData.forEach(m => {
    if (!m.genre || !Array.isArray(m.genre)) return;
    m.genre.forEach(g => {
      const trimmed = (g || '').toString().trim();
      if (trimmed) genreMap[trimmed] = (genreMap[trimmed] || 0) + 1;
    });
  });
  const genreColors = getGenreColors();
  const genreData = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({
      label,
      value,
      color: genreColors[i % genreColors.length]
    }));
  document.getElementById('genre-center').querySelector('.donut-value').textContent = genreData.length;
  drawGenreDonut(document.getElementById('genre-canvas'), genreData);
  renderGenreLegend(genreData);

  // Status distribution
  const statusMap = {};
  libraryData.forEach(m => {
    const status = (m.status || 'Unknown').toString().trim();
    statusMap[status] = (statusMap[status] || 0) + 1;
  });
  const statusData = Object.entries(statusMap).map(([label, value]) => ({ label, value }));
  renderStatusBars(statusData);

  // Reading time
  const totalTime = readingSummary?.total_time_seconds || 0;
  const hours = Math.floor(totalTime / 3600);
  const mins = Math.floor((totalTime % 3600) / 60);
  document.getElementById('time-total').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const timeBreakdown = [
    { label: 'Today', value: `${readingSummary?.today_pages || 0} pages` },
    { label: 'This Week', value: `${readingSummary?.week_pages || 0} pages` },
    { label: 'Last Read', value: readingSummary?.last_read_manga || '-' }
  ];
  renderTimeBreakdown(timeBreakdown);

  // Top manga
  const topManga = libraryData
    .filter(m => m.bookmark)
    .map(m => ({
      title: m.title,
      coverPath: m.cover,
      chapters: m.chapters.length,
      progress: getProgressPercent(m)
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);
  await renderTopManga(topManga);
}

// Period toggle
function switchActivityPeriod(period) {
  // Re-render chart with the selected period (stub for future 30-day view)
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.period-btn[data-period="${period}"]`)?.classList.add('active');
  loadStats();
}

document.addEventListener('DOMContentLoaded', () => {
  initSidebarNav();

  document.getElementById('back-btn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchActivityPeriod(btn.dataset.period);
    });
  });

  loadStats();
});