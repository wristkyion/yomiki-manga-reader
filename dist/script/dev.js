(function () {
    'use strict';

    /* ===== EMERGENCY RESET: Fix corrupted Image.prototype.src from previous session ===== */
    (function emergencyReset() {
        if (window.__origImageSrcDescriptor) {
            try {
                Object.defineProperty(Image.prototype, 'src', window.__origImageSrcDescriptor);
                console.log('[Dev] Emergency reset: Image.prototype.src restored');
            } catch(e) {
                console.log('[Dev] Emergency reset: descriptor already clean');
            }
        }
        window.__slowLoadActive = false;
    })();

    /* ===== Config ===== */
    const TABS = [
        { id: 'main',   label: 'Main' },
        { id: 'viewer', label: 'Viewer' },
        { id: 'data',   label: 'Data' },
        { id: 'other',  label: 'Other' },
    ];

    const COMMANDS = [
        { tab: 'main', cmd: 'del-all',       icon: '🗑',  label: 'Delete All Manga',      hint: 'Wipes library' },
        { tab: 'main', cmd: 'reset-data',    icon: '♻️',  label: 'Reset App Data',        hint: 'All JSON files' },
        { tab: 'main', cmd: 'reveal-dir',    icon: '📂',  label: 'Reveal App Directory',  hint: 'Open folder' },
        { tab: 'main', cmd: 'reveal-lib-dir', icon: '📚', label: 'Reveal Library Folder', hint: 'Manga root' },
        { tab: 'main', cmd: 'bulk-dummies',  icon: '🤖',  label: 'Bulk Dummy Manga',      hint: '5 test entries' },
        { tab: 'main', cmd: 'integrity-check', icon: '🔍', label: 'Integrity Check',       hint: 'Scan library' },
        { tab: 'main', cmd: 'app-info',      icon: 'ℹ️',  label: 'App Info',              hint: 'OS, version' },
        { tab: 'main', cmd: 'reload',        icon: '🔄',  label: 'Reload App',            hint: '' },
        { tab: 'main', cmd: 'hard-reload',   icon: '🔃',  label: 'Hard Reload',           hint: 'No cache' },

        { tab: 'viewer', cmd: 'force-refresh', icon: '🔥',  label: 'Force Refresh',         hint: 'Reset state' },
        { tab: 'viewer', cmd: 'toggle-rtl',    icon: '🎭',  label: 'Toggle RTL',            hint: 'Book mode' },
        { tab: 'viewer', cmd: 'clear-preload', icon: '🧹',  label: 'Clear Preload',         hint: 'Free memory' },
        { tab: 'viewer', cmd: 'image-info',    icon: '📐',  label: 'Image Info Overlay',    hint: 'Dims & format' },
        { tab: 'viewer', cmd: 'slow-load',     icon: '🐌',  label: 'Simulate Slow Load',    hint: 'Test spinner' },
        { tab: 'viewer', cmd: 'jump-to',       icon: '🚀',  label: 'Jump to Page/Chapter',  hint: 'Teleport' },
        { tab: 'viewer', cmd: 'random-manga',  icon: '🎲',  label: 'Random Manga',          hint: 'Teleport' },

        { tab: 'data', cmd: 'random-dummy',  icon: '🤖',  label: 'Create Random Manga',   hint: 'Memory only' },
        { tab: 'data', cmd: 'dump-lib',      icon: '📋',  label: 'Dump Library JSON',     hint: 'To console' },
        { tab: 'data', cmd: 'dump-settings', icon: '⚙️',  label: 'Dump Settings',         hint: 'localStorage' },
        { tab: 'data', cmd: 'disk-usage',    icon: '📊',  label: 'Library Disk Usage',    hint: 'Size & count' },
        { tab: 'data', cmd: 'storage-size',  icon: '💾',  label: 'Storage Size',          hint: 'local/session' },
        { tab: 'data', cmd: 'clear-session', icon: '🧼',  label: 'Clear Session Storage', hint: 'Non-destructive' },
        { tab: 'data', cmd: 'devtools',      icon: '🐞',  label: 'Open DevTools',         hint: '' },

        { tab: 'other', cmd: 'reload-css',    icon: '🎨',  label: 'Reload CSS Only',       hint: 'Hot reload' },
        { tab: 'other', cmd: 'fps-counter',   icon: '📈',  label: 'FPS Counter',           hint: 'Overlay' },
        { tab: 'other', cmd: 'debug-outline', icon: '🔲',  label: 'Debug Outlines',        hint: 'Red borders' },
        { tab: 'other', cmd: 'toggle-grid',   icon: '▦',   label: 'Toggle Grid Overlay',   hint: 'Layout test' },
        { tab: 'other', cmd: 'mascot-army',   icon: '👾',  label: 'Mascot Army',           hint: 'Chaos mode' },
        { tab: 'other', cmd: 'mascot-spin',   icon: '🌀',  label: 'Mascot Spin',           hint: 'Morale boost' },
        { tab: 'other', cmd: 'fake-crash',    icon: '💻',  label: 'Fake Crash Screen',     hint: 'Prank mode' },
        { tab: 'other', cmd: 'benchmark',     icon: '⏱️',  label: 'Reader Benchmark',      hint: 'Perf test' },
        { tab: 'other', cmd: 'matrix-rain',   icon: '🌧️',  label: 'Matrix Rain',           hint: 'Wake up Neo' },
        { tab: 'other', cmd: 'rage-mode',     icon: '😤',  label: 'Rage Mode',             hint: 'Screen shake' },
        { tab: 'other', cmd: 'fake-error',    icon: '💥',  label: 'Fake Error Toast',      hint: 'Test style' },
        { tab: 'other', cmd: 'disco',         icon: '🕺',  label: 'Disco Mode',            hint: 'Party time' },
    ];

    /* ===== State ===== */
    let panel = null;
    let visible = false;
    let activeTab = 'main';
    let isDragging = false;
    let dragOffX = 0;
    let dragOffY = 0;

    /* ===== Session Storage Helpers ===== */
    const SS_KEY_OPEN = 'Yomiki_dev_open';
    const SS_KEY_POS = 'Yomiki_dev_pos';
    const SS_KEY_TAB = 'Yomiki_dev_tab';
    const SS_KEY_OVERLAYS = 'Yomiki_dev_overlays';

    function ssGet(key, fallback) {
        try {
            const raw = sessionStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function ssSet(key, val) {
        try {
            sessionStorage.setItem(key, JSON.stringify(val));
        } catch {}
    }

    /* ===== Overlay State Helpers ===== */
    function getOverlays() {
        return ssGet(SS_KEY_OVERLAYS, { fps: false, outline: false, grid: false, disco: false, slowLoad: false, imageInfo: false });
    }

    function setOverlay(key, val) {
        const o = getOverlays();
        o[key] = val;
        ssSet(SS_KEY_OVERLAYS, o);
    }

    /* ===== Confirmation Modal ===== */
    function showConfirmModal(title, message, onConfirm, danger = false) {
        const existing = document.getElementById('dev-confirm-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'dev-confirm-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            animation: dev-fade-in 0.2s ease;
        `;

        modal.innerHTML = `
            <div style="
                background: var(--bg-primary);
                border: 1px solid var(--border-medium);
                border-radius: var(--radius-lg);
                padding: 24px;
                width: 320px;
                max-width: 90vw;
                box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 40px var(--accent-soft);
                animation: dev-scale-in 0.2s cubic-bezier(0.32, 0.72, 0, 1);
            ">
                <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
                    ${title}
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px;">
                    ${message}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="dev-confirm-yes" style="
                        flex: 1;
                        padding: 10px;
                        border: none;
                        border-radius: var(--radius-md);
                        background: ${danger ? 'var(--error)' : 'var(--accent)'};
                        color: #fff;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 150ms ease;
                    ">Yes, do it</button>
                    <button id="dev-confirm-no" style="
                        flex: 1;
                        padding: 10px;
                        border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md);
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 150ms ease;
                    ">Nah</button>
                </div>
            </div>
        `;

        if (!document.getElementById('dev-modal-animations')) {
            const style = document.createElement('style');
            style.id = 'dev-modal-animations';
            style.textContent = `
                @keyframes dev-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes dev-scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        const yesBtn = modal.querySelector('#dev-confirm-yes');
        const noBtn = modal.querySelector('#dev-confirm-no');
        yesBtn.focus();

        yesBtn.addEventListener('click', () => { modal.remove(); onConfirm(); });
        noBtn.addEventListener('click', () => { modal.remove(); });

        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const escHandler = (e) => {
            if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);
    }

    /* ===== Jump Modal (for viewer) ===== */
    function showJumpModal() {
        const existing = document.getElementById('dev-jump-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'dev-jump-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; z-index: 100001;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            animation: dev-fade-in 0.2s ease;
        `;

        modal.innerHTML = `
            <div style="
                background: var(--bg-primary); border: 1px solid var(--border-medium);
                border-radius: var(--radius-lg); padding: 24px; width: 280px; max-width: 90vw;
                box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 40px var(--accent-soft);
                animation: dev-scale-in 0.2s cubic-bezier(0.32, 0.72, 0, 1);
            ">
                <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px;">Jump To</div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Chapter</label>
                    <input id="dev-jump-ch" type="number" min="0" value="0" style="
                        width: 100%; padding: 8px; margin-top: 4px;
                        background: var(--bg-tertiary); border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md); color: var(--text-primary); font-size: 13px;
                        outline: none;
                    ">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Page</label>
                    <input id="dev-jump-pg" type="number" min="0" value="0" style="
                        width: 100%; padding: 8px; margin-top: 4px;
                        background: var(--bg-tertiary); border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md); color: var(--text-primary); font-size: 13px;
                        outline: none;
                    ">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="dev-jump-go" style="
                        flex: 1; padding: 10px; border: none; border-radius: var(--radius-md);
                        background: var(--accent); color: #fff; font-size: 13px; font-weight: 600;
                        cursor: pointer; transition: all 150ms ease;
                    ">Go</button>
                    <button id="dev-jump-cancel" style="
                        flex: 1; padding: 10px; border: 1px solid var(--border-medium);
                        border-radius: var(--radius-md); background: var(--bg-tertiary);
                        color: var(--text-primary); font-size: 13px; font-weight: 600;
                        cursor: pointer; transition: all 150ms ease;
                    ">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const chIn = modal.querySelector('#dev-jump-ch');
        const pgIn = modal.querySelector('#dev-jump-pg');
        const goBtn = modal.querySelector('#dev-jump-go');

        goBtn.focus();
        pgIn.value = typeof currentPage !== 'undefined' ? currentPage : 0;
        chIn.value = typeof currentChapter !== 'undefined' ? currentChapter : 0;

        goBtn.addEventListener('click', () => {
            const ch = parseInt(chIn.value, 10) || 0;
            const pg = parseInt(pgIn.value, 10) || 0;
            if (typeof currentChapter !== 'undefined') window.currentChapter = ch;
            if (typeof currentPage !== 'undefined') window.currentPage = pg;
            if (typeof render === 'function') render();
            toast(`Jumped to Ch.${ch} Pg.${pg}`, 'success');
            modal.remove();
        });

        modal.querySelector('#dev-jump-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const escHandler = (e) => {
            if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);
    }

    /* ===== Random Dummy Generator ===== */
    const DUMMY_TITLES = [
        "The Silent Witch", "Dragon's Daughter", "Cafe of Lost Things",
        "Moonlit Garden", "Stardust Memories", "Cat & Coffee",
        "Summer Ghost", "Paper Butterfly", "Electric Sheep",
        "Lemonade Sky", "Invisible String", "Midnight Diner",
        "Rainy Season", "Ghost Apartment", "Bread & Butter"
    ];
    const DUMMY_AUTHORS = [
        "A. Tanaka", "Y. Suzuki", "M. Yamamoto", "K. Sato",
        "H. Watanabe", "R. Kobayashi", "S. Ito", "N. Nakamura"
    ];
    const DUMMY_GENRES = ["Romance", "Comedy", "Slice of Life", "Fantasy", "Drama", "Sci-Fi", "Mystery", "Horror", "Action"];
    const DUMMY_TAGS = ["school", "cute", "fluff", "angst", "magic", "food", "cats", "rain", "summer", "winter", "ghost", "robots"];

    function pick(arr, n = 1) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    }

    function createRandomDummy() {
        const id = `dummy_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const title = pick(DUMMY_TITLES, 1)[0];
        const author = pick(DUMMY_AUTHORS, 1)[0];
        const genres = pick(DUMMY_GENRES, Math.floor(Math.random() * 3) + 1);
        const tags = pick(DUMMY_TAGS, Math.floor(Math.random() * 4) + 1);
        const status = pick(["Ongoing", "Completed", "Hiatus"], 1)[0];
        const nsfw = Math.random() > 0.75;

        const manga = {
            id, title,
            description: `A wonderful story about ${tags.slice(0, 2).join(' and ')}. Generated for testing.`,
            author, genre: genres, tags,
            type: "Manga", status,
            cover: null,
            path: `/dummy/${id}`,
            chapters: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => ({
                name: `Chapter ${i + 1}`,
                path: `/dummy/${id}/ch${i + 1}`,
                pages: []
            })),
            is_favorite: false,
            bookmark: null,
            nsfw,
            locked: false,
            collections: []
        };

        if (typeof libraryData !== 'undefined' && Array.isArray(libraryData)) {
            libraryData.push(manga);
            if (typeof renderLibrary === 'function') renderLibrary();
            if (typeof renderContinueReading === 'function') renderContinueReading();
            toast(`Created "${title}"`, 'success');
            console.log('[Dev] Dummy:', manga);
        } else {
            toast('Library not ready', 'error');
        }
    }

    /* ===== UI Builders ===== */
    function buildPanel() {
        if (panel) return panel;

        const el = document.createElement('div');
        el.id = 'Yomiki-dev-panel';

        const dragBar = document.createElement('div');
        dragBar.className = 'dev-drag-bar';
        dragBar.innerHTML = `
            <span class="dev-drag-title">Yomiki-Dev Menu</span>
            <button class="dev-close-btn">✕</button>
        `;

        const body = document.createElement('div');
        body.className = 'dev-body';

        const sidebar = document.createElement('div');
        sidebar.className = 'dev-sidebar';

        const mascotWrap = document.createElement('div');
        mascotWrap.className = 'dev-mascot-wrap';
        mascotWrap.innerHTML = `
            <div class="dev-mascot" id="dev-mascot">
                <img src="./image/happy-mascot.png" alt="mascot">
            </div>
        `;
        sidebar.appendChild(mascotWrap);

        TABS.forEach(t => {
            const btn = document.createElement('button');
            btn.className = `dev-sidetab${t.id === activeTab ? ' active' : ''}`;
            btn.textContent = t.label;
            btn.dataset.tab = t.id;
            btn.addEventListener('click', () => switchTab(t.id));
            sidebar.appendChild(btn);
        });

        const contentArea = document.createElement('div');
        contentArea.className = 'dev-content-area';

        const contentHeader = document.createElement('div');
        contentHeader.className = 'dev-content-header';
        contentHeader.textContent = TABS.find(t => t.id === activeTab)?.label || 'Main';

        const contents = {};
        TABS.forEach(t => {
            const div = document.createElement('div');
            div.className = `dev-tab-content${t.id === activeTab ? ' active' : ''}`;
            div.dataset.content = t.id;

            const cmds = COMMANDS.filter(c => c.tab === t.id);
            cmds.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'dev-cmd';
                btn.dataset.cmd = c.cmd;
                btn.innerHTML = `
                    <span class="dev-cmd-icon">${c.icon}</span>
                    <span class="dev-cmd-label">${c.label}</span>
                    ${c.hint ? `<span class="dev-cmd-hint">${c.hint}</span>` : ''}
                `;
                btn.addEventListener('click', () => runCmd(c.cmd));
                div.appendChild(btn);
            });

            contents[t.id] = div;
            contentArea.appendChild(div);
        });

        contentArea.insertBefore(contentHeader, contentArea.firstChild);
        body.appendChild(sidebar);
        body.appendChild(contentArea);

        const footer = document.createElement('div');
        footer.className = 'dev-footer';
        footer.innerHTML = '<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> to toggle · Grab top bar to drag';

        el.appendChild(dragBar);
        el.appendChild(body);
        el.appendChild(footer);
        document.body.appendChild(el);

        const savedPos = ssGet(SS_KEY_POS, null);
        if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
            el.style.left = savedPos.x + 'px';
            el.style.top = savedPos.y + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }

        dragBar.querySelector('.dev-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggle(true);
        });
        dragBar.addEventListener('mousedown', startDrag);
        dragBar.addEventListener('touchstart', startDragTouch, { passive: false });

        // Mascot spin
        const mascot = el.querySelector('#dev-mascot');
        if (mascot) {
            mascot.style.cursor = 'pointer';
            mascot.addEventListener('click', () => {
                mascot.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                const currentRot = parseFloat(mascot.dataset.rot || '0');
                const nextRot = currentRot + 360;
                mascot.style.transform = `rotate(${nextRot}deg)`;
                mascot.dataset.rot = nextRot;
                toast('🌀 Mascot spin!', 'success');
            });
        }

        panel = el;
        return el;
    }

    function switchTab(id) {
        activeTab = id;
        ssSet(SS_KEY_TAB, id);

        const tabLabel = TABS.find(t => t.id === id)?.label || id;

        panel.querySelectorAll('.dev-sidetab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === id);
        });

        const header = panel.querySelector('.dev-content-header');
        if (header) header.textContent = tabLabel;

        panel.querySelectorAll('.dev-tab-content').forEach(c => {
            c.classList.toggle('active', c.dataset.content === id);
        });
    }

    /* ===== Drag ===== */
    function startDrag(e) {
        if (e.target.closest('.dev-close-btn')) return;
        isDragging = true;
        const r = panel.getBoundingClientRect();
        dragOffX = e.clientX - r.left;
        dragOffY = e.clientY - r.top;
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    }

    function startDragTouch(e) {
        if (e.target.closest('.dev-close-btn')) return;
        isDragging = true;
        const t = e.touches[0];
        const r = panel.getBoundingClientRect();
        dragOffX = t.clientX - r.left;
        dragOffY = t.clientY - r.top;
        document.addEventListener('touchmove', onDragTouch, { passive: false });
        document.addEventListener('touchend', stopDragTouch);
    }

    function onDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        move(e.clientX - dragOffX, e.clientY - dragOffY);
    }

    function onDragTouch(e) {
        if (!isDragging) return;
        e.preventDefault();
        const t = e.touches[0];
        move(t.clientX - dragOffX, t.clientY - dragOffY);
    }

    function move(x, y) {
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        if (panel) {
            const r = panel.getBoundingClientRect();
            ssSet(SS_KEY_POS, { x: r.left, y: r.top });
        }
    }

    function stopDragTouch() {
        isDragging = false;
        document.removeEventListener('touchmove', onDragTouch);
        document.removeEventListener('touchend', stopDragTouch);
        if (panel) {
            const r = panel.getBoundingClientRect();
            ssSet(SS_KEY_POS, { x: r.left, y: r.top });
        }
    }

    /* ===== Toggle ===== */
    function toggle(manual = true) {
        if (!panel) buildPanel();
        visible = !visible;
        panel.classList.toggle('active', visible);
        ssSet(SS_KEY_OPEN, visible);
        
        if (manual) {
            if (visible) toast('Yomiki-Dev Menu active. Enjoy!', 'success');
            else toast('Yomiki-Dev Menu Inactive... byee!', 'info');
        }
    }

    /* ===== Commands ===== */
    function toast(msg, type = 'info') {
        if (typeof showToast === 'function') showToast(msg, type);
        else console.log(`[Dev] ${msg}`);
    }

    async function runCmd(cmd) {
        try {
            switch (cmd) {
                case 'del-all':
                    showConfirmModal(
                        'Delete All Manga?',
                        'Are you sure you want to delete ALL manga from your library folder? This cannot be undone.',
                        async () => {
                            await tauriInvoke('dev_delete_all_manga');
                            toast('All manga deleted', 'success');
                            if (typeof loadLibrary === 'function') await loadLibrary();
                        },
                        true
                    );
                    break;

                case 'reset-data':
                    showConfirmModal(
                        'Reset App Data?',
                        'Are you sure you want to reset ALL app data? This includes settings, favorites, bookmarks, collections, and reading stats.',
                        async () => {
                            await tauriInvoke('dev_reset_app_data');
                            toast('All app data reset', 'success');
                            setTimeout(() => window.location.reload(), 600);
                        },
                        true
                    );
                    break;

                case 'reveal-dir':
                    await tauriInvoke('dev_reveal_app_dir');
                    toast('Opened app directory', 'success');
                    break;

                case 'reveal-lib-dir':
                    await tauriInvoke('dev_reveal_lib_dir');
                    toast('Opened library folder', 'success');
                    break;

                case 'bulk-dummies':
                    await tauriInvoke('dev_fill_dummy_library');
                    if (typeof loadLibrary === 'function') await loadLibrary();
                    toast('5 dummy manga created', 'success');
                    break;

                case 'integrity-check':
                    if (typeof libraryData === 'undefined' || !libraryData.length) {
                        toast('Library empty', 'error'); break;
                    }
                    const issues = [];
                    libraryData.forEach(m => {
                        if (!m.chapters.length) issues.push(`${m.title}: zero chapters`);
                        m.chapters.forEach(c => {
                            if (!c.pages.length) issues.push(`${m.title} → ${c.name}: zero pages`);
                        });
                        if (!m.cover) issues.push(`${m.title}: missing cover`);
                    });
                    console.table(issues.length ? issues : ['All clean']);
                    toast(`${issues.length} issues found`, issues.length ? 'error' : 'success');
                    break;

                case 'app-info':
                    const sysInfo = await tauriInvoke('dev_get_system_info');
                    const info = {
                        ...sysInfo,
                        screen: `${window.screen.width}x${window.screen.height}`,
                        dpr: window.devicePixelRatio,
                        ua: navigator.userAgent,
                        libSize: typeof libraryData !== 'undefined' ? libraryData.length : 'N/A',
                    };
                    console.log('%c[App Info]', 'color:#3498db;font-weight:bold;font-size:14px;', info);
                    toast('App info dumped to console', 'success');
                    break;

                case 'reload':
                    window.location.reload();
                    break;

                case 'hard-reload':
                    const u = new URL(window.location.href);
                    u.searchParams.set('_rc', Date.now());
                    window.location.href = u.toString();
                    break;

                case 'reload-css':
                    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                        const url = new URL(link.href);
                        url.searchParams.set('_rc', Date.now());
                        link.href = url.toString();
                    });
                    toast('Stylesheets reloaded', 'success');
                    break;

                case 'force-refresh':
                    if (!window.location.pathname.includes('viewer.html')) {
                        toast('Not on viewer page', 'info');
                        break;
                    }
                    if (typeof currentPage !== 'undefined') window.currentPage = 0;
                    if (typeof verticalRenderedChapter !== 'undefined') window.verticalRenderedChapter = -1;
                    if (window.preloadedImages instanceof Map) window.preloadedImages.clear();
                    if (typeof render === 'function') render();
                    toast('Viewer force-refreshed', 'success');
                    break;

                case 'toggle-rtl':
                    const rtl = localStorage.getItem('Yomiki_rtl') === '1';
                    localStorage.setItem('Yomiki_rtl', rtl ? '0' : '1');
                    toast(`RTL ${rtl ? 'OFF' : 'ON'}`, 'success');
                    break;

                case 'clear-preload':
                    if (window.preloadedImages instanceof Map) {
                        window.preloadedImages.clear();
                        toast('Preload cache cleared', 'success');
                    } else {
                        toast('No cache on this page', 'info');
                    }
                    break;

                case 'image-info':
                    if (!window.location.pathname.includes('viewer.html')) {
                        toast('Not on viewer page', 'info'); break;
                    }
                    const imgs = document.querySelectorAll('.manga-page, .viewer-image, img[data-page]');
                    if (!imgs.length) { toast('No images found', 'info'); break; }
                    
                    const anyOn = imgs[0]?.dataset.devInfo === 'on';
                    imgs.forEach(img => {
                        if (anyOn) {
                            img.dataset.devInfo = 'off';
                            const badge = img.parentElement.querySelector('.dev-img-badge');
                            if (badge) badge.remove();
                            return;
                        }
                        img.dataset.devInfo = 'on';
                        const badge = document.createElement('div');
                        badge.className = 'dev-img-badge';
                        badge.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.75);color:#0f0;font-family:monospace;font-size:10px;padding:2px 6px;border-radius:4px;pointer-events:none;z-index:10;';
                        badge.textContent = `${img.naturalWidth}x${img.naturalHeight}`;
                        if (img.parentElement.style.position !== 'relative') img.parentElement.style.position = 'relative';
                        img.parentElement.appendChild(badge);
                    });
                    setOverlay('imageInfo', !anyOn);
                    toast(`Image info ${!anyOn ? 'ON' : 'OFF'}`, 'success');
                    break;

                case 'slow-load': {
                    if (!window.__origImageSrcDescriptor) {
                        window.__origImageSrcDescriptor = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
                    }
                    
                    if (window.__slowLoadActive) {
                        Object.defineProperty(Image.prototype, 'src', window.__origImageSrcDescriptor);
                        window.__slowLoadActive = false;
                        setOverlay('slowLoad', false);
                        toast('Slow load OFF — Image.src restored', 'info');
                    } else {
                        const orig = window.__origImageSrcDescriptor;
                        Object.defineProperty(Image.prototype, 'src', {
                            configurable: true,
                            enumerable: orig.enumerable,
                            get: orig.get,
                            set: function(val) {
                                if (window.__slowLoadActive) {
                                    setTimeout(() => { orig.set.call(this, val); }, 800);
                                } else {
                                    orig.set.call(this, val);
                                }
                            }
                        });
                        window.__slowLoadActive = true;
                        setOverlay('slowLoad', true);
                        toast('Slow load ON (+800ms)', 'success');
                    }
                    break;
                }

                case 'jump-to':
                    if (!window.location.pathname.includes('viewer.html')) {
                        toast('Not on viewer page', 'info'); break;
                    }
                    showJumpModal();
                    break;

                case 'random-manga':
                    if (typeof libraryData === 'undefined' || !libraryData.length) {
                        toast('Library empty', 'error');
                        break;
                    }
                    const r = libraryData[Math.floor(Math.random() * libraryData.length)];
                    window.location.href = `viewer.html?id=${encodeURIComponent(r.id)}&chapter=0&page=0&mode=vertical`;
                    break;

                case 'random-dummy':
                    createRandomDummy();
                    break;

                case 'dump-lib':
                    const json = await tauriInvoke('dev_export_library_json');
                    console.log('%c[Library Dump]', 'color:#2ecc71;font-weight:bold;font-size:14px;', JSON.parse(json));
                    toast('Dumped to console (F12)', 'success');
                    break;

                case 'dump-settings':
                    const settingsDump = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        try { settingsDump[k] = JSON.parse(localStorage.getItem(k)); } catch {
                            settingsDump[k] = localStorage.getItem(k);
                        }
                    }
                    console.log('%c[Settings Dump]', 'color:#9b59b6;font-weight:bold;font-size:14px;', settingsDump);
                    toast('Settings dumped to console', 'success');
                    break;

                case 'disk-usage':
                    const usage = await tauriInvoke('dev_get_disk_usage');
                    toast(`${usage.readable} · ${usage.file_count} files`, 'info');
                    console.log('[Dev] Disk:', usage);
                    break;

                case 'storage-size':
                    let lsBytes = 0, ssBytes = 0;
                    for (let k in localStorage) if (localStorage.hasOwnProperty(k)) lsBytes += localStorage[k].length * 2;
                    for (let k in sessionStorage) if (sessionStorage.hasOwnProperty(k)) ssBytes += sessionStorage[k].length * 2;
                    const total = ((lsBytes + ssBytes) / 1024).toFixed(2);
                    toast(`localStorage: ${(lsBytes/1024).toFixed(1)}KB · sessionStorage: ${(ssBytes/1024).toFixed(1)}KB`, 'info');
                    console.log('[Dev] Storage:', { localStorageKB: (lsBytes/1024).toFixed(2), sessionStorageKB: (ssBytes/1024).toFixed(2) });
                    break;

                case 'clear-session':
                    sessionStorage.clear();
                    toast('Session storage cleared', 'success');
                    break;

                case 'devtools':
                    await tauriInvoke('open_devtools');
                    break;

                case 'fps-counter':
                    if (window.__fpsDiv) {
                        cancelAnimationFrame(window.__fpsRaf);
                        window.__fpsDiv.remove(); window.__fpsDiv = null;
                        setOverlay('fps', false);
                        toast('FPS counter off', 'info'); break;
                    }
                    const fpsDiv = document.createElement('div');
                    fpsDiv.style.cssText = 'position:fixed;top:8px;left:8px;z-index:999999;background:rgba(0,0,0,0.8);color:#0f0;font-family:monospace;padding:6px 10px;border-radius:6px;font-size:12px;pointer-events:none;';
                    document.body.appendChild(fpsDiv); window.__fpsDiv = fpsDiv;
                    let last = performance.now(), frames = 0;
                    const loop = (t) => {
                        frames++;
                        if (t - last >= 1000) {
                            const mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB' : 'N/A';
                            fpsDiv.textContent = `FPS ${frames} | Heap ${mem}`;
                            frames = 0; last = t;
                        }
                        window.__fpsRaf = requestAnimationFrame(loop);
                    };
                    window.__fpsRaf = requestAnimationFrame(loop);
                    setOverlay('fps', true);
                    toast('FPS counter on', 'success');
                    break;

                case 'debug-outline':
                    const ex = document.getElementById('dev-debug-outline');
                    if (ex) {
                        ex.remove();
                        setOverlay('outline', false);
                        toast('Outlines off', 'info');
                    } else {
                        const s = document.createElement('style');
                        s.id = 'dev-debug-outline';
                        s.textContent = '*{outline:1px solid rgba(255,0,0,0.4)!important;outline-offset:-1px!important;}';
                        document.head.appendChild(s);
                        setOverlay('outline', true);
                        toast('Debug outlines on', 'success');
                    }
                    break;

                case 'toggle-grid':
                    const gridEx = document.getElementById('dev-grid-overlay');
                    if (gridEx) {
                        gridEx.remove();
                        setOverlay('grid', false);
                        toast('Grid off', 'info');
                    } else {
                        const gs = document.createElement('style');
                        gs.id = 'dev-grid-overlay';
                        gs.textContent = `
                            html::before {
                                content: ''; position: fixed; inset: 0; z-index: 999998;
                                background-image: linear-gradient(rgba(255,0,0,0.07) 1px, transparent 1px),
                                                  linear-gradient(90deg, rgba(255,0,0,0.07) 1px, transparent 1px);
                                background-size: 20px 20px;
                                pointer-events: none;
                            }
                        `;
                        document.head.appendChild(gs);
                        setOverlay('grid', true);
                        toast('Grid overlay on', 'success');
                    }
                    break;

                /* ===== MASCOT ARMY ===== */
                case 'mascot-army': {
                    if (document.getElementById('dev-mascot-army-layer')) {
                        document.getElementById('dev-mascot-army-layer').remove();
                        toast('Mascot army dismissed', 'info');
                        break;
                    }

                    const layer = document.createElement('div');
                    layer.id = 'dev-mascot-army-layer';
                    layer.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden;';

                    // Dismiss button
                    const dismiss = document.createElement('button');
                    dismiss.textContent = '💥 Dismiss Army';
                    dismiss.style.cssText = 'position:fixed;top:16px;right:16px;z-index:100000;padding:8px 16px;background:#f44;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;pointer-events:auto;font-family:sans-serif;';
                    dismiss.onclick = () => { layer.remove(); toast('Army dismissed', 'info'); };
                    layer.appendChild(dismiss);

                    const count = 25 + Math.floor(Math.random() * 50);
                    const mascots = [];

                    for (let i = 0; i < count; i++) {
                        const m = document.createElement('img');
                        m.src = './image/happy-mascot.png';
                        m.draggable = false;
                        const size = 100 + Math.floor(Math.random() * 150);
                        m.style.cssText = `
                            position: absolute;
                            width: ${size}px;
                            height: auto;
                            pointer-events: auto;
                            cursor: grab;
                            user-select: none;
                            -webkit-user-drag: none;
                            filter: hue-rotate(${Math.random() * 360}deg) saturate(${0.5 + Math.random()});
                            will-change: transform, left, top;
                        `;

                        const state = {
                            x: Math.random() * (window.innerWidth - size),
                            y: Math.random() * (window.innerHeight - size),
                            vx: (Math.random() - 0.5) * 90,
                            vy: (Math.random() - 0.5) * 90,
                            rotation: Math.random() * 360,
                            rotSpeed: (Math.random() - 0.5) * 8,
                            squished: false,
                            dragging: false,
                            dragOffsetX: 0,
                            dragOffsetY: 0
                        };

                        m.style.left = state.x + 'px';
                        m.style.top = state.y + 'px';

                        // Squish on click, explode on double click
                        m.addEventListener('mousedown', (e) => {
                            e.stopPropagation();
                            if (e.detail === 2) {
                                // Explode
                                m.style.transition = 'all 0.3s ease-out';
                                m.style.transform = 'scale(2.5) rotate(720deg)';
                                m.style.opacity = '0';
                                setTimeout(() => m.remove(), 300);
                                toast('💥 Boom!', 'success');
                                return;
                            }
                            // Start drag
                            state.dragging = true;
                            state.dragOffsetX = e.clientX - state.x;
                            state.dragOffsetY = e.clientY - state.y;
                            m.style.cursor = 'grabbing';
                            m.style.zIndex = '100001';
                        });

                        // Squish toggle (on mouseup if not dragged far)
                        let dragStartX = 0, dragStartY = 0;
                        m.addEventListener('mousedown', (e) => {
                            dragStartX = e.clientX;
                            dragStartY = e.clientY;
                        });
                        m.addEventListener('mouseup', (e) => {
                            const dist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
                            if (dist < 5 && !state.dragging) {
                                state.squished = !state.squished;
                                m.style.transition = 'transform 0.15s';
                                m.style.transform = state.squished
                                    ? `scaleY(0.5) scaleX(1.4) rotate(${state.rotation}deg)`
                                    : `rotate(${state.rotation}deg)`;
                                setTimeout(() => m.style.transition = '', 150);
                            }
                        });

                        layer.appendChild(m);
                        mascots.push({ el: m, state });
                    }

                    document.body.appendChild(layer);

                    // Global drag handlers
                    const onMouseMove = (e) => {
                        mascots.forEach(({ el, state }) => {
                            if (state.dragging) {
                                state.x = e.clientX - state.dragOffsetX;
                                state.y = e.clientY - state.dragOffsetY;
                                el.style.left = state.x + 'px';
                                el.style.top = state.y + 'px';
                            }
                        });
                    };

                    const onMouseUp = () => {
                        mascots.forEach(({ el, state }) => {
                            if (state.dragging) {
                                state.dragging = false;
                                el.style.cursor = 'grab';
                                el.style.zIndex = '';
                                // Fling velocity from last movement
                                state.vx = (Math.random() - 0.5) * 4;
                                state.vy = (Math.random() - 0.5) * 4;
                            }
                        });
                    };

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);

                    // Physics loop
                    let raf;
                    function animate() {
                        mascots.forEach(({ el, state }) => {
                            if (!el.isConnected || state.dragging) return;

                            state.x += state.vx;
                            state.y += state.vy;
                            state.rotation += state.rotSpeed;

                            // Bounce off walls
                            const w = el.offsetWidth;
                            const h = el.offsetHeight;
                            if (state.x <= 0) { state.x = 0; state.vx = Math.abs(state.vx) * 0.9; }
                            if (state.x >= window.innerWidth - w) { state.x = window.innerWidth - w; state.vx = -Math.abs(state.vx) * 0.9; }
                            if (state.y <= 0) { state.y = 0; state.vy = Math.abs(state.vy) * 0.9; }
                            if (state.y >= window.innerHeight - h) { state.y = window.innerHeight - h; state.vy = -Math.abs(state.vy) * 0.9; }

                            // Gravity
                            state.vy += 0.08;
                            // Air resistance
                            state.vx *= 0.998;
                            state.vy *= 0.998;

                            el.style.left = state.x + 'px';
                            el.style.top = state.y + 'px';
                            if (!state.squished) {
                                el.style.transform = `rotate(${state.rotation}deg)`;
                            }
                        });
                        raf = requestAnimationFrame(animate);
                    }
                    animate();

                    // Cleanup
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((m) => {
                            if (Array.from(m.removedNodes).includes(layer)) {
                                cancelAnimationFrame(raf);
                                window.removeEventListener('mousemove', onMouseMove);
                                window.removeEventListener('mouseup', onMouseUp);
                                observer.disconnect();
                            }
                        });
                    });
                    observer.observe(document.body, { childList: true });

                    toast(`Deployed ${count} mascots!`, 'success');
                    break;
                }

                case 'mascot-spin':
                    const msc = panel?.querySelector('#dev-mascot');
                    if (msc) msc.click();
                    else toast('Mascot not found', 'error');
                    break;

                    /* ===== FAKE CRASH SCREEN ===== */
                    case 'fake-crash': {
                        if (document.getElementById('dev-fake-crash')) return;

                        // Detect current theme
                        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff6b6b';
                        const bgPrimary = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#0d0d0f';
                        const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#f0f0f5';
                        const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#a0a0b0';
                        const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6e6e7e';

                        const crashScreen = document.createElement('div');
                        crashScreen.id = 'dev-fake-crash';
                        crashScreen.style.cssText = `
                            position: fixed;
                            top: 0; left: 0; right: 0; bottom: 0;
                            width: 100vw; height: 100vh;
                            z-index: 999999;
                            background: ${bgPrimary};
                            color: ${textPrimary};
                            font-family: var(--font-sans, 'Segoe UI', system-ui, sans-serif);
                            cursor: none;
                            user-select: none;
                            -webkit-user-select: none;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            overflow: hidden;
                        `;

                        // Yomiki-themed crash content
                        crashScreen.innerHTML = `
                            <div style="
                                text-align: center;
                                max-width: 600px;
                                padding: 40px;
                                animation: dev-crash-fade-in 0.6s ease-out;
                            ">
                                <!-- Mascot error face -->
                                <div style="
                                    width: 120px; height: 120px;
                                    margin: 0 auto 32px;
                                    background: ${isDark ? 'rgba(255,107,107,0.1)' : 'rgba(232,93,117,0.1)'};
                                    border-radius: var(--radius-xl, 24px);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 64px;
                                    border: 2px solid ${isDark ? 'rgba(255,107,107,0.2)' : 'rgba(232,93,117,0.2)'};
                                ">
                                    😵
                                </div>

                                <div style="
                                    font-size: 28px;
                                    font-weight: 700;
                                    color: ${textPrimary};
                                    margin-bottom: 16px;
                                    letter-spacing: -0.02em;
                                ">
                                    Yomiki encountered a fatal error
                                </div>

                                <div style="
                                    font-size: 15px;
                                    color: ${textSecondary};
                                    line-height: 1.6;
                                    margin-bottom: 32px;
                                ">
                                    The application has crashed unexpectedly.<br>
                                    We're sorry for the inconvenience.
                                </div>

                                <!-- Fake error details -->
                                <div style="
                                    background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'};
                                    border: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
                                    border-radius: var(--radius-md, 12px);
                                    padding: 20px 24px;
                                    text-align: left;
                                    font-family: 'SF Mono', 'Fira Code', monospace;
                                    font-size: 12px;
                                    line-height: 1.8;
                                    color: ${textMuted};
                                    margin-bottom: 32px;
                                    max-width: 480px;
                                ">
                                    <div style="color: ${accent}; font-weight: 600; margin-bottom: 8px;">
                                        Error Report:
                                    </div>
                                    <div>Type: FATAL_EXCEPTION</div>
                                    <div>Code: 0xYomiki_DEAD</div>
                                    <div>Module: reader_core.dll</div>
                                    <div>Address: 0x00007FF6A3B2C4D8</div>
                                    <div style="margin-top: 8px; opacity: 0.7;">
                                        manga.json corrupted at chapter_index: NaN
                                    </div>
                                    <div style="opacity: 0.7;">
                                        preloadedImages: Map(0) {} — cache evaporated
                                    </div>
                                </div>

                                <!-- Progress bar -->
                                <div style="
                                    width: 200px;
                                    height: 4px;
                                    background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
                                    border-radius: var(--radius-full, 9999px);
                                    margin: 0 auto 16px;
                                    overflow: hidden;
                                ">
                                    <div id="dev-crash-progress" style="
                                        width: 0%;
                                        height: 100%;
                                        background: ${accent};
                                        border-radius: var(--radius-full, 9999px);
                                        transition: width 0.3s ease;
                                    "></div>
                                </div>

                                <div style="
                                    font-size: 13px;
                                    color: ${textMuted};
                                    margin-bottom: 24px;
                                ">
                                    Collecting crash data... <span id="dev-crash-percent">0</span>%
                                </div>

                            </div>

                            <!-- Background decoration -->
                            <div style="
                                position: absolute;
                                inset: 0;
                                pointer-events: none;
                                opacity: 0.03;
                                background-image: radial-gradient(circle at 20% 50%, ${accent} 1px, transparent 1px),
                                                radial-gradient(circle at 80% 50%, ${accent} 1px, transparent 1px);
                                background-size: 40px 40px;
                            "></div>
                        `;

                        // Add entrance animation
                        if (!document.getElementById('dev-crash-anim')) {
                            const style = document.createElement('style');
                            style.id = 'dev-crash-anim';
                            style.textContent = `
                                @keyframes dev-crash-fade-in {
                                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                                    to { opacity: 1; transform: translateY(0) scale(1); }
                                }
                                @keyframes dev-crash-shake {
                                    0%, 100% { transform: translateX(0); }
                                    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
                                    20%, 40%, 60%, 80% { transform: translateX(2px); }
                                }
                            `;
                            document.head.appendChild(style);
                        }

                        document.body.appendChild(crashScreen);

                        // Animate progress bar
                        const progressEl = crashScreen.querySelector('#dev-crash-progress');
                        const percentEl = crashScreen.querySelector('#dev-crash-percent');
                        let pct = 0;
                        const interval = setInterval(() => {
                            if (!document.getElementById('dev-fake-crash')) {
                                clearInterval(interval);
                                return;
                            }
                            pct += Math.random() * 8 + 2;
                            if (pct >= 100) {
                                pct = 100;
                                clearInterval(interval);
                                // "Stuck" at 100%
                                if (percentEl) percentEl.textContent = '100';
                                if (progressEl) progressEl.style.width = '100%';
                                
                                // Add shake effect
                                const content = crashScreen.querySelector('div');
                                if (content) {
                                    content.style.animation = 'dev-crash-shake 0.5s ease-in-out';
                                }
                                return;
                            }
                            if (percentEl) percentEl.textContent = Math.floor(pct);
                            if (progressEl) progressEl.style.width = pct + '%';
                        }, 150);

                        // Escape mechanism: press any key 3 times within 2 seconds
                        let keyCount = 0;
                        let keyTimeout;
                        const keyHandler = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            keyCount++;
                            
                            // Visual feedback
                            const content = crashScreen.querySelector('div');
                            if (content) {
                                content.style.transform = 'scale(0.98)';
                                setTimeout(() => content.style.transform = '', 100);
                            }
                            
                            if (keyCount >= 3) {
                                clearInterval(interval);
                                crashScreen.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                                crashScreen.style.opacity = '0';
                                crashScreen.style.transform = 'scale(1.05)';
                                setTimeout(() => crashScreen.remove(), 400);
                                document.removeEventListener('keydown', keyHandler);
                                document.removeEventListener('click', keyHandler);
                                toast('Yomiki recovered successfully', 'success');
                            } else {
                                clearTimeout(keyTimeout);
                                keyTimeout = setTimeout(() => keyCount = 0, 2000);
                                // Update hint
                                const hint = crashScreen.querySelector('strong');
                                if (hint) hint.textContent = `${3 - keyCount} more`;
                            }
                        };
                        document.addEventListener('keydown', keyHandler);
                        document.addEventListener('click', keyHandler);

                        toast('💥 Yomiki "crashed"! Press any key 3x to recover', 'error');
                        break;
                    }

                /* ===== READER BENCHMARK ===== */
                case 'benchmark': {
                    if (!window.location.pathname.includes('viewer.html')) {
                        toast('Open a manga in viewer first', 'error');
                        break;
                    }

                    const results = {
                        frames: [],
                        startTime: null,
                        running: true,
                        pageCount: 0,
                        targetPages: 10
                    };

                    const overlay = document.createElement('div');
                    overlay.id = 'dev-benchmark-overlay';
                    overlay.style.cssText = `
                        position: fixed; top: 16px; right: 16px; z-index: 999999;
                        background: rgba(0,0,0,0.85); color: #0f0;
                        font-family: monospace; font-size: 13px;
                        padding: 16px; border-radius: 8px;
                        min-width: 220px; backdrop-filter: blur(4px);
                        border: 1px solid rgba(0,255,0,0.3);
                    `;
                    overlay.innerHTML = `
                        <div style="font-weight:bold;margin-bottom:8px;color:#fff;">📊 Reader Benchmark</div>
                        <div id="dev-bench-status">Warming up...</div>
                        <div id="dev-bench-fps" style="margin-top:4px;">FPS: --</div>
                        <div id="dev-bench-pages">Pages: 0/${results.targetPages}</div>
                        <div style="margin-top:8px;font-size:11px;color:#888;">Press ESC to abort</div>
                    `;
                    document.body.appendChild(overlay);

                    let lastFrame = performance.now();
                    let frameCount = 0;
                    let lastFpsUpdate = performance.now();

                    function measureFrame(now) {
                        if (!results.running) return;
                        const delta = now - lastFrame;
                        lastFrame = now;
                        frameCount++;

                        if (now - lastFpsUpdate > 500) {
                            const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
                            const fpsEl = document.getElementById('dev-bench-fps');
                            if (fpsEl) fpsEl.textContent = `FPS: ${fps}`;
                            frameCount = 0;
                            lastFpsUpdate = now;
                        }

                        if (results.startTime) {
                            results.frames.push(delta);
                        }
                        requestAnimationFrame(measureFrame);
                    }
                    requestAnimationFrame(measureFrame);

                    async function runTest() {
                        const statusEl = document.getElementById('dev-bench-status');
                        const pagesEl = document.getElementById('dev-bench-pages');

                        await new Promise(r => setTimeout(r, 500));

                        for (let i = 0; i < results.targetPages && results.running; i++) {
                            if (statusEl) statusEl.textContent = `Scrolling to page ${i + 1}...`;
                            results.startTime = performance.now();

                            if (typeof currentPage !== 'undefined') {
                                window.currentPage = i;
                                if (typeof render === 'function') render();
                            } else if (typeof nextPage === 'function') {
                                nextPage();
                            } else {
                                const viewer = document.querySelector('.viewer-container, #viewer, [class*="viewer"]');
                                if (viewer) viewer.scrollTop += window.innerHeight * 0.8;
                            }

                            await new Promise(resolve => {
                                const checkRender = () => {
                                    const elapsed = performance.now() - results.startTime;
                                    if (elapsed > 3000) {
                                        results.frames.push(elapsed);
                                        resolve();
                                        return;
                                    }
                                    const imgs = document.querySelectorAll('.manga-page img, .viewer-image, img[data-page]');
                                    const allLoaded = Array.from(imgs).every(img => img.complete && img.naturalHeight > 0);
                                    if (allLoaded && elapsed > 100) {
                                        results.frames.push(elapsed);
                                        resolve();
                                    } else {
                                        requestAnimationFrame(checkRender);
                                    }
                                };
                                requestAnimationFrame(checkRender);
                            });

                            results.pageCount++;
                            if (pagesEl) pagesEl.textContent = `Pages: ${results.pageCount}/${results.targetPages}`;
                            await new Promise(r => setTimeout(r, 200));
                        }

                        if (!results.running) return;

                        const validFrames = results.frames.filter(f => f > 0);
                        const avgFrame = validFrames.length ? validFrames.reduce((a, b) => a + b, 0) / validFrames.length : 0;
                        const maxFrame = validFrames.length ? Math.max(...validFrames) : 0;
                        const minFrame = validFrames.length ? Math.min(...validFrames) : 0;
                        const drops = validFrames.filter(f => f > 33).length;

                        if (statusEl) {
                            statusEl.innerHTML = `
                                <span style="color:#0f0;">✓ Complete!</span>
                                <div style="margin-top:8px;font-size:11px;line-height:1.5;">
                                    Avg render: ${avgFrame.toFixed(1)}ms<br>
                                    Worst: ${maxFrame.toFixed(1)}ms<br>
                                    Best: ${minFrame.toFixed(1)}ms<br>
                                    Frame drops (>33ms): ${drops}/${validFrames.length}<br>
                                    <span style="color:${drops > validFrames.length * 0.1 ? '#f44' : '#0f0'};">
                                        ${drops > validFrames.length * 0.1 ? '⚠️ Stuttering detected' : '✓ Smooth scrolling'}
                                    </span>
                                </div>
                            `;
                        }

                        setTimeout(() => {
                            document.getElementById('dev-benchmark-overlay')?.remove();
                            results.running = false;
                        }, 5000);
                    }

                    const abortHandler = (e) => {
                        if (e.key === 'Escape') {
                            results.running = false;
                            document.getElementById('dev-benchmark-overlay')?.remove();
                            document.removeEventListener('keydown', abortHandler);
                            toast('Benchmark aborted', 'info');
                        }
                    };
                    document.addEventListener('keydown', abortHandler);

                    runTest();
                    toast('Benchmark running... scroll in progress', 'success');
                    break;
                }

                /* ===== MATRIX RAIN ===== */
                case 'matrix-rain': {
                    if (document.getElementById('dev-matrix-canvas')) {
                        document.getElementById('dev-matrix-canvas').remove();
                        toast('Matrix rain stopped', 'info');
                        break;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.id = 'dev-matrix-canvas';
                    canvas.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;';
                    document.body.appendChild(canvas);

                    const ctx = canvas.getContext('2d');
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;

                    const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
                    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    const nums = '0123456789';
                    const alphabet = katakana + latin + nums;

                    const fontSize = 14;
                    const columns = canvas.width / fontSize;
                    const drops = [];
                    for (let i = 0; i < columns; i++) {
                        drops[i] = Math.random() * -100; // Start above screen at random heights
                    }

                    let raf;
                    function draw() {
                        if (!document.getElementById('dev-matrix-canvas')) return;

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        ctx.fillStyle = '#0f0';
                        ctx.font = `${fontSize}px monospace`;

                        for (let i = 0; i < drops.length; i++) {
                            const text = alphabet[Math.floor(Math.random() * alphabet.length)];
                            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                                drops[i] = 0;
                            }
                            drops[i]++;
                        }
                        raf = requestAnimationFrame(draw);
                    }
                    draw();

                    // Resize handler
                    const resizeHandler = () => {
                        if (!document.getElementById('dev-matrix-canvas')) {
                            window.removeEventListener('resize', resizeHandler);
                            return;
                        }
                        canvas.width = window.innerWidth;
                        canvas.height = window.innerHeight;
                    };
                    window.addEventListener('resize', resizeHandler);

                    // Click to stop
                    canvas.addEventListener('click', () => {
                        cancelAnimationFrame(raf);
                        canvas.remove();
                        window.removeEventListener('resize', resizeHandler);
                        toast('Matrix rain stopped', 'info');
                    });

                    toast('🌧️ Matrix rain started — click to stop', 'success');
                    break;
                }

                /* ===== RAGE MODE ===== */
                case 'rage-mode': {
                    if (window.__rageModeActive) {
                        // Stop
                        window.__rageModeActive = false;
                        document.body.style.transform = '';
                        document.body.style.transition = '';
                        if (window.__rageClickHandler) {
                            document.removeEventListener('click', window.__rageClickHandler);
                            window.__rageClickHandler = null;
                        }
                        if (window.__rageKeyHandler) {
                            document.removeEventListener('keydown', window.__rageKeyHandler);
                            window.__rageKeyHandler = null;
                        }
                        if (window.__rageInterval) {
                            clearInterval(window.__rageInterval);
                            window.__rageInterval = null;
                        }
                        toast('😤 Rage mode OFF', 'info');
                        break;
                    }

                    window.__rageModeActive = true;
                    let intensity = 0;
                    const maxIntensity = 20;

                    // Screen shake interval
                    window.__rageInterval = setInterval(() => {
                        if (!window.__rageModeActive) return;
                        const shakeX = (Math.random() - 0.5) * intensity * 2;
                        const shakeY = (Math.random() - 0.5) * intensity * 2;
                        const rotate = (Math.random() - 0.5) * intensity * 0.5;
                        document.body.style.transition = 'transform 0.05s';
                        document.body.style.transform = `translate(${shakeX}px, ${shakeY}px) rotate(${rotate}deg)`;
                    }, 50);

                    // Click = more rage
                    window.__rageClickHandler = (e) => {
                        if (!window.__rageModeActive) return;
                        intensity = Math.min(intensity + 2, maxIntensity);
                        
                        // Flash red
                        const flash = document.createElement('div');
                        flash.style.cssText = 'position:fixed;inset:0;z-index:99997;background:rgba(255,0,0,0.15);pointer-events:none;transition:opacity 0.3s;';
                        document.body.appendChild(flash);
                        requestAnimationFrame(() => flash.style.opacity = '0');
                        setTimeout(() => flash.remove(), 300);

                        // Spawn angry text
                        const rageText = document.createElement('div');
                        const texts = ['RAGE!', 'SMASH!', 'GRRR!', 'ANGRY!', 'FURY!', 'RAAAAH!'];
                        rageText.textContent = texts[Math.floor(Math.random() * texts.length)];
                        rageText.style.cssText = `
                            position: fixed; z-index: 99999; pointer-events: none;
                            left: ${e.clientX}px; top: ${e.clientY}px;
                            font-size: ${20 + Math.random() * 30}px;
                            font-weight: 900; color: #f00;
                            text-shadow: 2px 2px 0 #000;
                            font-family: impact, sans-serif;
                            transform: translate(-50%, -50%) rotate(${(Math.random() - 0.5) * 40}deg);
                            animation: dev-rage-float 0.8s ease-out forwards;
                        `;
                        document.body.appendChild(rageText);
                        setTimeout(() => rageText.remove(), 800);
                    };
                    document.addEventListener('click', window.__rageClickHandler);

                    // Keyboard smash = more rage
                    window.__rageKeyHandler = () => {
                        if (!window.__rageModeActive) return;
                        intensity = Math.min(intensity + 1, maxIntensity);
                    };
                    document.addEventListener('keydown', window.__rageKeyHandler);

                    // Add animation if not present
                    if (!document.getElementById('dev-rage-anim')) {
                        const style = document.createElement('style');
                        style.id = 'dev-rage-anim';
                        style.textContent = `
                            @keyframes dev-rage-float {
                                0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
                                50% { opacity: 1; transform: translate(-50%, -150%) scale(1.2); }
                                100% { opacity: 0; transform: translate(-50%, -250%) scale(1); }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    // Decay intensity over time
                    const decayInterval = setInterval(() => {
                        if (!window.__rageModeActive) {
                            clearInterval(decayInterval);
                            return;
                        }
                        intensity = Math.max(intensity - 0.5, 0);
                    }, 100);

                    toast('😤 RAGE MODE ON! Click and type to get angrier!', 'success');
                    break;
                }

                case 'fake-error':
                    toast('This is a fake catastrophic error', 'error');
                    console.error('[Dev] Fake error');
                    break;

                case 'disco':
                    if (window.__discoInterval) {
                        clearInterval(window.__discoInterval);
                        window.__discoInterval = null;
                        document.body.style.filter = '';
                        document.body.classList.remove('dev-disco-active');
                        setOverlay('disco', false);
                        toast('Disco stopped', 'info');
                    } else {
                        let hue = 0;
                        window.__discoInterval = setInterval(() => {
                            hue = (hue + 4) % 360;
                            document.body.style.filter = `hue-rotate(${hue}deg) saturate(1.6) brightness(1.05)`;
                        }, 50);
                        document.body.classList.add('dev-disco-active');
                        setOverlay('disco', true);
                        toast('🕺 Disco mode!', 'success');
                    }
                    break;
            }
        } catch (e) {
            console.error('Dev cmd failed:', e);
            toast('Command failed: ' + e, 'error');
        }
    }

    /* ===== Hotkey ===== */
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            toggle(true);
        }
    });

    /* ===== Auto-open & restore on EVERY page load ===== */
    (function initDevPanel() {
        const wasOpen = ssGet(SS_KEY_OPEN, false);
        const savedPos = ssGet(SS_KEY_POS, null);
        const savedTab = ssGet(SS_KEY_TAB, 'main');

        if (wasOpen) {
            buildPanel();
            visible = true;
            panel.classList.add('active');

            if (savedPos && typeof savedPos.x === 'number') {
                panel.style.left = savedPos.x + 'px';
                panel.style.top = savedPos.y + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            }

            if (savedTab && TABS.find(t => t.id === savedTab)) {
                activeTab = savedTab;
                switchTab(savedTab);
            }

            requestAnimationFrame(() => {
                const overlays = getOverlays();
                if (overlays.fps) runCmd('fps-counter');
                if (overlays.outline) runCmd('debug-outline');
                if (overlays.grid) runCmd('toggle-grid');
                if (overlays.disco) runCmd('disco');
                if (overlays.imageInfo) {
                    setTimeout(() => runCmd('image-info'), 800);
                }
            });
        }
    })();

    /* ===== Public API ===== */
    window.YomikiDev = {
        toggle: (m) => toggle(m),
        run: runCmd,
        tab: switchTab,
        dummy: () => runCmd('random-dummy'),
        cmds: Object.fromEntries(COMMANDS.map(c => [c.cmd, () => runCmd(c.cmd)])),
    };
})();