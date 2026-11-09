let pendingSettings = {
  lib_path: null,
  theme: 'dark',
  rtl: false,
  ui_scale: 100,
  disable_animations: false,
  custom_css_path: null,
  firstmeet: false,
  auto_bookmark: true,
  keybinds: {
    next_page: 'ArrowRight',
    prev_page: 'ArrowLeft',
    toggle_fullscreen: 'f',
    save_bookmark: 'b'
  }
};

let devtoolsOpen = false;

/* ========== SIDEBAR NAVIGATION (Cross-Page) ========== */

function initSidebarNav() {
  // Highlight current page
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  if (page === 'settings.html') {
    document.querySelector('.nav-item[data-view="settings"]')?.classList.add('active');
  } else if (page === 'studio.html') {
    document.querySelector('.nav-item[data-view="studio"]')?.classList.add('active');
  } else if (page === 'index.html' || page === '' || page === 'viewer.html') {
    document.querySelector('.nav-item[data-filter="all"]')?.classList.add('active');
  }

  // Main nav — library filters go to Library page
  document.querySelectorAll('.nav-item[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  });

  // View nav — settings/studio/stats
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'stats') window.location.href = 'statistics.html';
      else if (view === 'studio' && page !== 'studio.html') window.location.href = 'studio.html';
      else if (view === 'settings' && page !== 'settings.html') window.location.href = 'settings.html';
    });
  });

  // Footer actions — import/scan are library features, route there
  document.getElementById('btn-import')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  document.getElementById('btn-scan')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

/* ========== DEVTOOLS ========== */

document.getElementById('btn-toggle-devtools')?.addEventListener('click', async () => {
  try {
    const btn = document.getElementById('btn-toggle-devtools');
    const label = btn?.querySelector('.btn-label');
    if (devtoolsOpen) {
      await tauriInvoke('close_devtools');
      devtoolsOpen = false;
      if (label) label.textContent = 'Open DevTools';
      document.getElementById('devtools-status').textContent = 'DevTools is closed';
      document.getElementById('devtools-status').className = 'devtools-status closed';
      showToast('DevTools closed', 'info');
    } else {
      await tauriInvoke('open_devtools');
      devtoolsOpen = true;
      if (label) label.textContent = 'Close DevTools';
      document.getElementById('devtools-status').textContent = 'DevTools is open';
      document.getElementById('devtools-status').className = 'devtools-status open';
      showToast('DevTools opened', 'success');
    }
  } catch (e) {
    showToast('DevTools not available in release mode', 'error');
  }
});

let currentCustomPath = null;

function showBackupMsg(text, type) {
  const el = document.getElementById('backup-msg');
  if (!el) return;
  el.textContent = text;
  el.style.color = type === 'error' ? 'var(--error)' : 'var(--success)';
  setTimeout(() => { el.textContent = ''; }, 5000);
}

function updateResetCssButton() {
  const btn = document.getElementById('btn-reset-css');
  if (!btn) return;
  btn.style.display = pendingSettings.custom_css_path ? 'inline-flex' : 'none';
}

function applyPendingToUI() {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.checked = pendingSettings.theme === 'light';

  const rtlToggle = document.getElementById('rtl-toggle');
  if (rtlToggle) rtlToggle.checked = pendingSettings.rtl;

  const scaleSlider = document.getElementById('ui-scale');
  const scaleValue = document.getElementById('ui-scale-value');
  if (scaleSlider) scaleSlider.value = pendingSettings.ui_scale;
  if (scaleValue) scaleValue.textContent = Math.round(pendingSettings.ui_scale) + '%';

  const animToggle = document.getElementById('anim-toggle');
  if (animToggle) animToggle.checked = pendingSettings.disable_animations;

  const cssPath = document.getElementById('css-path');
  if (cssPath) cssPath.textContent = pendingSettings.custom_css_path || 'No file selected';
  updateResetCssButton();

  const autoBmToggle = document.getElementById('auto-bookmark-toggle');
  if (autoBmToggle) autoBmToggle.checked = pendingSettings.auto_bookmark;

  document.querySelectorAll('.keybind-input').forEach(el => {
    const action = el.dataset.action;
    const key = pendingSettings.keybinds?.[action] || '';
    el.textContent = key === ' ' ? 'Space' : (key || '—');
  });

  if (pendingSettings.lib_path) {
    const modeCustom = document.getElementById('mode-custom');
    if (modeCustom) modeCustom.checked = true;
    currentCustomPath = pendingSettings.lib_path;
    const currentPath = document.getElementById('current-path');
    if (currentPath) currentPath.textContent = pendingSettings.lib_path;
    const customSection = document.getElementById('custom-path-section');
    if (customSection) customSection.classList.remove('hidden');
  } else {
    const modeDefault = document.getElementById('mode-default');
    if (modeDefault) modeDefault.checked = true;
    const customSection = document.getElementById('custom-path-section');
    if (customSection) customSection.classList.add('hidden');
  }
}

function applySettingsToApp(settings) {
  document.documentElement.setAttribute('data-theme', settings.theme);
  localStorage.setItem('Yomiki_theme', settings.theme);
  localStorage.setItem('Yomiki_rtl', settings.rtl ? '1' : '0');
  document.documentElement.setAttribute('data-ui-scale', Math.round(settings.ui_scale));
  document.documentElement.setAttribute('data-animations', settings.disable_animations ? 'false' : 'true');

  let link = document.getElementById('custom-theme-css');
  if (settings.custom_css_path) {
    if (!link) {
      link = document.createElement('link');
      link.id = 'custom-theme-css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = toAssetUrl(settings.custom_css_path);
  } else if (link) {
    link.href = '';
  }
  localStorage.setItem('Yomiki_auto_bookmark', settings.auto_bookmark ? '1' : '0');
  localStorage.setItem('Yomiki_keybinds', JSON.stringify(settings.keybinds || {}));
  localStorage.setItem('Yomiki_settings', JSON.stringify(settings));
}


function initSidebarNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (page === 'settings.html') {
    document.querySelector('.nav-item[data-view="settings"]')?.classList.add('active');
  } else if (page === 'studio.html') {
    document.querySelector('.nav-item[data-view="studio"]')?.classList.add('active');
  }

  // FILTER buttons -> store target filter, then navigate
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
      if (view === 'stats') {
        sessionStorage.setItem('yomiki_target_filter', 'all');
        window.location.href = 'index.html';
      } else if (view === 'studio' && page !== 'studio.html') {
        window.location.href = 'studio.html';
      } else if (view === 'settings' && page !== 'settings.html') {
        window.location.href = 'settings.html';
      }
    });
  });

document.getElementById('btn-import')?.addEventListener('click', () => {
  showToast('Import is available on the Library page', 'info');
  sessionStorage.setItem('yomiki_target_filter', 'all');
});

document.getElementById('btn-scan')?.addEventListener('click', () => {
  showToast('Scan Folder is available on the Library page', 'info');
  sessionStorage.setItem('yomiki_target_filter', 'all');
});
}

document.addEventListener('DOMContentLoaded', async () => {
  initSidebarNav();

  // Back button
  document.getElementById('back-btn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Load settings from Rust
  try {
    const settings = await tauriInvoke('get_settings');
    const defaultPath = await tauriInvoke('get_default_lib_path');
    document.getElementById('default-path-display').textContent = defaultPath;

    pendingSettings = { ...pendingSettings, ...settings };
    if (typeof pendingSettings.keybinds !== 'object' || !pendingSettings.keybinds) {
      pendingSettings.keybinds = { ...pendingSettings.keybinds };
    }
    applyPendingToUI();
  } catch (e) {
    console.error('Failed to load settings:', e);
  }

  // Theme toggle (pending only)
  document.getElementById('theme-toggle')?.addEventListener('change', (e) => {
    pendingSettings.theme = e.target.checked ? 'light' : 'dark';
  });

  // RTL toggle (pending only)
  document.getElementById('rtl-toggle')?.addEventListener('change', (e) => {
    pendingSettings.rtl = e.target.checked;
  });

  // UI Scale
  const scaleSlider = document.getElementById('ui-scale');
  const scaleValue = document.getElementById('ui-scale-value');
  scaleSlider?.addEventListener('input', (e) => {
    pendingSettings.ui_scale = parseInt(e.target.value, 10);
    scaleValue.textContent = pendingSettings.ui_scale + '%';
  });

  // Disable animations
  document.getElementById('anim-toggle')?.addEventListener('change', (e) => {
    pendingSettings.disable_animations = e.target.checked;
  });

  // Custom CSS picker
  document.getElementById('btn-pick-css')?.addEventListener('click', async () => {
    try {
      const path = await tauriInvoke('pick_css_file');
      if (path) {
        pendingSettings.custom_css_path = path;
        document.getElementById('css-path').textContent = path;
        updateResetCssButton();
      }
    } catch (e) {
      console.error('Pick CSS error:', e);
    }
  });

  // Reset CSS button
  document.getElementById('btn-reset-css')?.addEventListener('click', () => {
    pendingSettings.custom_css_path = null;
    document.getElementById('css-path').textContent = 'No file selected';
    updateResetCssButton();
    showToast('Custom CSS reset (Save to apply)', 'info');
  });

  // Keybind capture
  document.querySelectorAll('.keybind-input').forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('capturing')) return;
      el.classList.add('capturing');
      const oldText = el.textContent;
      el.textContent = 'Press key...';

      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = el.dataset.action;
        if (!pendingSettings.keybinds) pendingSettings.keybinds = {};
        pendingSettings.keybinds[action] = e.key;
        el.textContent = e.key === ' ' ? 'Space' : e.key;
        el.classList.remove('capturing');
        window.removeEventListener('keydown', handler);
      };

      window.addEventListener('keydown', handler);
    });
  });

  // Library location radios
  document.querySelectorAll('input[name="lib-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        document.getElementById('custom-path-section')?.classList.remove('hidden');
        pendingSettings.lib_path = currentCustomPath;
      } else {
        document.getElementById('custom-path-section')?.classList.add('hidden');
        pendingSettings.lib_path = null;
      }
    });
  });

  // Pick folder
  document.getElementById('btn-pick-folder')?.addEventListener('click', async () => {
    try {
      const path = await tauriInvoke('pick_folder');
      if (path) {
        currentCustomPath = path;
        pendingSettings.lib_path = path;
        document.getElementById('current-path').textContent = path;
        document.getElementById('mode-custom').checked = true;
        document.getElementById('custom-path-section').classList.remove('hidden');
      }
    } catch (e) {
      console.error('Pick folder error:', e);
    }
  });

  // Auto-bookmark toggle
  document.getElementById('auto-bookmark-toggle')?.addEventListener('change', (e) => {
    pendingSettings.auto_bookmark = e.target.checked;
  });

  // Save everything
  document.getElementById('btn-save')?.addEventListener('click', async () => {
    try {
      await tauriInvoke('save_settings', { settings: pendingSettings });
      applySettingsToApp(pendingSettings);
      showToast('Settings saved!', 'success');
    } catch (e) {
      showToast('Save failed: ' + e, 'error');
    }
  });

  // Backup & Restore
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      const data = await tauriInvoke('export_backup');
      const preview = document.getElementById('backup-preview');
      preview.textContent = data.substring(0, 2000) + (data.length > 2000 ? '\n...' : '');
      preview.style.display = 'block';
      showBackupMsg('Backup saved to ~/Yomiki/backup.json', 'success');
    } catch (e) {
      showBackupMsg('Export failed: ' + e, 'error');
    }
  });

  document.getElementById('btn-restore')?.addEventListener('click', async () => {
    try {
      const data = await tauriInvoke('import_backup');
      if (!data) return showBackupMsg('No backup found', 'error');
      await tauriInvoke('restore_backup', { data });
      showBackupMsg('Backup restored! Refresh library to see changes.', 'success');
    } catch (e) {
      showBackupMsg('Import failed: ' + e, 'error');
    }
  });

  // Changelog
const changelogData = [
  {
    version: '1.4fixed-release | UI Update & Change name',
    date: '2026-05-21',
    changes: [
      'UI Re-Design from old into to new design',
      'Changing name Yomikyo to Yomiki',
      'Statistic are unsued right now so later we fixed it and make it new',
      'Improvment emojis into to SVG',
      'From this time, we might be focus on fix the bug feature on our apps, stay tune about the new feature'
    ]
  },
  {
    version: '1.3release | Studio Update!',
    date: '2026-05-20',
    changes: [
      'Manga Studio is now available',
      'Improved overall stability',
      'Fixed multiple UI and system bugs',
      'Updated settings position',
      'Context Menu at save bookmark now it`s saved now'
    ]
  },
  {
    version: '1.2fixed-release | Polish and Fixes Update',
    date: '2026-05-19',
    changes: [
      'Fixed "Custom Theme CSS" not applying in production builds (CSP fix)',
      'New library view toggle: switch between Compact and Detailed views',
      'Fixed Developer menu (Ctrl+Shift+D) not working properly in some cases',
      'Added Auto Bookmark setting — toggle automatic progress saving',
      'Fixed Right keys now navigate chapters next in Vertical mode',
      'Fixed Page Up/Down or Page Up/Down scrolls by full page height in Vertical mode',
      
    ]
  },
  {
    version: '1.1release | First Stable Release',
    date: '2026-05-18',
    changes: [
      'Official release of Yomiki 1.1 with all features fully implemented and tested',
      'Split tags and genres into separate fields for better organization and filtering',
      'Added Developer Tools for easier debugging and user support. also work for styling .css (accessible from settings)',
      'Added Collections for your manga library to organize your manga into custom groups and shelves',
      'Improvment UI',
      'New manga.json "title", ""author", "artist", "description", "tags", "genres", "type", "status", "cover", "nsfw", and "locked" fields for better metadata support and library management',
      'Added blur for nsfw manga covers (kept for safety)',
      'Studio mode! (still in view only, but will be fully implemented in a future update)',
      'Notification Fix',
      'Right-Click to show context menu (just find it by urself)',
      'Improve performance and ram usage',
      'Drag n drop support for importing manga (just drop a .zip or .ykm onto the library view)',
      'Fixed viewer control auto-hide not working properly in some cases',
      'First meet onboarding tour to help new users get familiar with the app',
      'Mascost? yea cute',
      'Oh yea try this (Ctrl+Shift+D) something will happend!'
    ]
  },
  {
    version: '1.0beta | Almost There Update',
    date: '2026-05-16',
    changes: [
      'Revoked the "Save to apply" requirement for certain settings - changes now apply immediately for a more intuitive experience',
      'Added sort options in the library view search',
      'Added new & move genre/tag into to advanced search',
      'Added more settings options (UI scale, animation toggle, custom CSS, and more)',
      'Improved the backup and restore system with better error handling and user feedback',
      'Added a changelog modal to keep users informed about updates and changes'
    ]
  },
  {
    version: '0.9beta | Customization Update',
    date: '2026-05-15',
    changes: [
      'Integrated Discord Rich Presence support',
      'Light mode toggle added to settings',
      'RTL (Right-to-Left)/Manga Style reading mode option implemented',
      'Implemented data backup and restore functionality'
    ]
  },

  {
    version: '0.8beta | Reader Overhaul',
    date: '2026-05-13',
    changes: [
      'Redesigned the reader UI for a cleaner and more immersive reading experience',
      'Enhanced reader performance and responsiveness',
      'Fixed various bugs, crashes, and stability issues',
      'Implemented custom manga library path configuration in settings'
    ]
  },

  {
    version: '0.5beta | Reading Experience Update',
    date: '2026-05-12',
    changes: [
      'Added reading statistics tracking, including time spent and pages read',
      'Implemented a "Continue Reading" button for quick access to the last opened manga',
      'Added All, Favorites, and Completed filters for library management',
      'Introduced Vertical, Single Page, and Book (spread) reading modes',
      'Implemented tag filtering support in the library view',
      'Included 20 sample manga for testing'
    ]
  },

  {
    version: '0.1beta | Teaser Publish',
    date: '2026-05-11',
    changes: [
      'Released the first public beta version of Yomiki',
      'Implemented basic manga reading functionality',
      'Added support for ZIP and YKM (custom) manga formats',
      'Introduced a thumbnail-based library view with recent activity sorting',
      'Built the application using Rust and Tauri for a fast native experience',
      'Included example manga and metadata files to help users get started (at our page on GitHub)',
      'Enabled custom manga importing through the "C:/Users/[Username]/Yomiki/manga" directory'
    ]
  }
];

  document.getElementById('btn-changelog')?.addEventListener('click', () => {
    const list = document.getElementById('changelog-list');
    list.innerHTML = changelogData.map(entry => `
      <div class="changelog-item">
        <h4>${escapeHtml(entry.version)} — ${escapeHtml(entry.date)}</h4>
        <ul>${entry.changes.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
      </div>
    `).join('');
    const modal = document.getElementById('changelog-modal');
    document.body.style.overflow = 'hidden';
    void modal.offsetHeight;
    modal.classList.add('active');
  });

  function closeChangelog() {
    const modal = document.getElementById('changelog-modal');
    modal.classList.remove('active');
    setTimeout(() => { document.body.style.overflow = ''; }, 500);
  }

  document.getElementById('changelog-close')?.addEventListener('click', closeChangelog);
  document.getElementById('changelog-backdrop')?.addEventListener('click', closeChangelog);

  // Check updates
  document.getElementById('btn-check-update')?.addEventListener('click', async () => {
    const status = document.getElementById('update-status');
    status.style.display = 'flex';
    status.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Checking...';

    setTimeout(() => {
      status.innerHTML = '<span class="version">1.4fixed-release</span> — You are up to date! (Check update feature coming soon)';
    }, 800);
  });
});