/* ========== HELPERS ========== */

// Disable default browser context menu everywhere
document.addEventListener('contextmenu', (e) => {
  // Only allow if it's your custom context menu or specific elements
  if (!e.target.closest('.context-menu, .manga-card, .continue-card')) {
    e.preventDefault();
  }
}, true);

function naturalSort(arr, keyFn) {
  return arr.sort((a, b) => {
    const aStr = keyFn ? keyFn(a) : a;
    const bStr = keyFn ? keyFn(b) : b;
    return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function toAssetUrl(path) {
  if (!path) return '';
  const normalizedPath = path.replace(/\\/g, '/');
  const tauri = window.__TAURI__;
  if (tauri) {
    if (tauri.core && typeof tauri.core.convertFileSrc === 'function') {
      return tauri.core.convertFileSrc(normalizedPath);
    }
    if (typeof tauri.convertFileSrc === 'function') {
      return tauri.convertFileSrc(normalizedPath);
    }
    if (tauri.tauri && typeof tauri.tauri.convertFileSrc === 'function') {
      return tauri.tauri.convertFileSrc(normalizedPath);
    }
  }
  console.warn('convertFileSrc missing, using file:// fallback', normalizedPath);
  return 'file://' + normalizedPath;
}

async function tauriInvoke(cmd, args) {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return window.__TAURI__.core.invoke(cmd, args || {});
  }
  throw new Error('Tauri API not available');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ========== THEME ========== */

function initTheme() {
  const saved = localStorage.getItem('Yomiki_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('Yomiki_theme', next);
}

/* ========== NO SELECTION / DOUBLE CLICK ========== */

document.addEventListener('mousedown', (e) => {
  if (e.detail > 1) {
    e.preventDefault();
  }
});

/* ========== TOAST ========== */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    changes: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>'
  };
  
  const titles = {
    success: 'Success',
    error: 'Error',
    info: 'Info',
    changes: 'Changes'
  };

  // ─── Cap at 5 toasts ───
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= 5) {
    // Remove oldest(s) immediately to make room
    const excess = existing.length - 4; // keep 4, make room for 1 new
    for (let i = 0; i < excess; i++) {
      const old = existing[i];
      old.classList.remove('show');
      old.classList.add('hide');
      setTimeout(() => {
        if (old.parentNode) old.remove();
      }, 400);
    }
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${titles[type] || 'Info'}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <div class="toast-progress"><div class="toast-progress-bar"></div></div>
  `;
  
  container.appendChild(toast);

  // ─── Force reflow so animation always plays ───
  void toast.offsetHeight;

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 400);
  }, 3000);
}

/* ========== CONTEXT MENU ========== */

function showContextMenu(items, x, y) {
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';

  items.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
    } else {
      const btn = document.createElement('button');
      btn.className = 'context-menu-item' + (item.danger ? ' danger' : '');
            btn.innerHTML = `<span class="ctx-icon">${item.icon || ''}</span> <span>${escapeHtml(item.label)}</span>`;
      btn.onclick = (e) => {
        e.stopPropagation();
        item.action();
        menu.remove();
      };
      menu.appendChild(btn);
    }
  });

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  if (left + rect.width > window.innerWidth)  left = window.innerWidth - rect.width - 8;
  if (top + rect.height > window.innerHeight)   top = window.innerHeight - rect.height - 8;
  if (left < 0) left = 8;
  if (top < 0)  top = 8;
  menu.style.left = left + 'px';
  menu.style.top  = top + 'px';

  const close = () => menu.remove();
  requestAnimationFrame(() => {
    document.addEventListener('click', close, { once: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    }, { once: true });
  });
}

/* ========== APPLY ALL SETTINGS ========== */

function applyAllSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('Yomiki_settings') || '{}');

    const theme = s.theme || localStorage.getItem('Yomiki_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    const scale = s.ui_scale || 100;
    document.documentElement.setAttribute('data-ui-scale', Math.round(scale));

    const anim = s.disable_animations ? 'false' : 'true';
    document.documentElement.setAttribute('data-animations', anim);

    if (s.custom_css_path) {
      let link = document.getElementById('custom-theme-css');
      if (!link) {
        link = document.createElement('link');
        link.id = 'custom-theme-css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = toAssetUrl(s.custom_css_path);
    }
  } catch (e) {
    console.error('applyAllSettings error:', e);
  }
}

applyAllSettings();