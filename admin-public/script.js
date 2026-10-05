// ============================================================
// SIVT AI — Admin Dashboard Script (Lengkap & Bersih)
// ============================================================

let currentUser = null;
let adminToken = null;
let currentPage = 'dashboard';
let currentTheme = null;
let currentUnansweredFilter = 'pending';
let currentLearningFilter = 'pending';
let currentFeedbackFilter = 'all';
let currentProviderMode = 'builtin';
let graphNetwork = null;
let graphNodesDataset = null;
let graphEdgesDataset = null;
let enrichPollTimer = null;

const VALID_ROLES = ['chat', 'embedding', 'enrichment', 'query-rewriter'];

const LOGO_SIZES = {
    small:  { login: 80,  sidebar: 36 },
    medium: { login: 90,  sidebar: 44 },
    large:  { login: 110, sidebar: 56 },
    xlarge: { login: 130, sidebar: 72 }
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[ADMIN] DOM loaded');

    // 1. Tampilkan login page DULU
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminPage').style.display = 'none';

    // 2. Bind nav sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page) showPage(page);
        });
    });

    // 3. Klik luar dropdown notif → tutup
    document.addEventListener('click', (e) => {
        const wrap = document.querySelector('.notif-wrapper');
        const dropdown = document.getElementById('notifDropdown');
        if (wrap && dropdown && !wrap.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // 4. Bind role checkboxes
    initRoleCheckboxes();

    // 5. Load config publik (logo, nama, tema) — versi aman
    await loadPublicConfigAdmin();

    // 6. Cek apakah sudah login
    await checkAdminSession();
});

// ============================================================
// LOAD PUBLIC CONFIG (VERSI AMAN UNTUK ADMIN)
// ============================================================
async function loadPublicConfigAdmin() {
    try {
        const res = await fetch('/api/config/public');
        const cfg = await res.json();

        const loginTitle = document.getElementById('loginTitle');
        if (loginTitle) loginTitle.textContent = cfg.aiName || 'SIVT AI';

        const sidebarAiName = document.getElementById('sidebarAiName');
        if (sidebarAiName) sidebarAiName.textContent = cfg.aiName || 'SIVT AI';

        const logoHtml = cfg.logoUrl
            ? `<img src="${cfg.logoUrl}" alt="logo" style="max-width:100%;max-height:100%;object-fit:contain;">`
            : 'S';

        const loginLogo = document.getElementById('loginLogo');
        if (loginLogo) loginLogo.innerHTML = logoHtml;

        const sidebarLogo = document.getElementById('sidebarLogo');
        if (sidebarLogo) sidebarLogo.innerHTML = logoHtml;

        if (cfg.theme) {
            currentTheme = cfg.theme;
            applyTheme(cfg.theme);
        }

        applyLogoSizeAdmin(cfg.logoSize || 'medium');

        if (cfg.logoUrl) {
            let fav = document.querySelector('link[rel="icon"]');
            if (!fav) {
                fav = document.createElement('link');
                fav.rel = 'icon';
                document.head.appendChild(fav);
            }
            fav.href = cfg.logoUrl;
        }
    } catch (err) {
        console.warn('[ADMIN] Gagal load public config:', err.message);
    }
}

// ============================================================
// TEMA
// ============================================================
function applyTheme(theme) {
    if (!theme) return;
    currentTheme = theme;
    const root = document.documentElement;
    if (theme.primary) root.style.setProperty('--primary', theme.primary);
    if (theme.primaryDark) root.style.setProperty('--primary-dark', theme.primaryDark);
    if (theme.primaryLight) root.style.setProperty('--primary-light', theme.primaryLight);
    if (theme.accent) root.style.setProperty('--accent', theme.accent);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme.primary) meta.setAttribute('content', theme.primary);

    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar && theme.sidebarStart && theme.sidebarEnd) {
        sidebar.style.background = `linear-gradient(180deg, ${theme.sidebarStart} 0%, ${theme.sidebarEnd} 100%)`;
    }
}

function previewTheme() {
    const theme = {
        primary: document.getElementById('theme-primary')?.value,
        primaryDark: document.getElementById('theme-primaryDark')?.value,
        accent: document.getElementById('theme-accent')?.value,
        sidebarStart: document.getElementById('theme-sidebarStart')?.value,
        sidebarEnd: document.getElementById('theme-sidebarEnd')?.value
    };
    Object.keys(theme).forEach(k => {
        const el = document.getElementById(`theme-${k}-text`);
        if (el) el.value = theme[k];
    });
    applyTheme(theme);
}

function syncColorFromText(key) {
    const textEl = document.getElementById(`theme-${key}-text`);
    const colorEl = document.getElementById(`theme-${key}`);
    if (!textEl || !colorEl) return;
    const val = textEl.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(val)) {
        colorEl.value = val;
        previewTheme();
    }
}

const PRESETS = {
    default: { primary: '#0d47a1', primaryDark: '#0a3a8a', accent: '#ec4899', sidebarStart: '#0a3a8a', sidebarEnd: '#0d47a1' },
    dark:    { primary: '#1f2937', primaryDark: '#111827', accent: '#6366f1', sidebarStart: '#111827', sidebarEnd: '#1f2937' },
    green:   { primary: '#059669', primaryDark: '#047857', accent: '#f59e0b', sidebarStart: '#047857', sidebarEnd: '#059669' },
    purple:  { primary: '#7c3aed', primaryDark: '#6d28d9', accent: '#ec4899', sidebarStart: '#6d28d9', sidebarEnd: '#7c3aed' },
    red:     { primary: '#dc2626', primaryDark: '#b91c1c', accent: '#f59e0b', sidebarStart: '#b91c1c', sidebarEnd: '#dc2626' },
    teal:    { primary: '#0d9488', primaryDark: '#0f766e', accent: '#f97316', sidebarStart: '#0f766e', sidebarEnd: '#0d9488' },
    orange:  { primary: '#ea580c', primaryDark: '#c2410c', accent: '#0891b2', sidebarStart: '#c2410c', sidebarEnd: '#ea580c' }
};

function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    document.getElementById('theme-primary').value = p.primary;
    document.getElementById('theme-primaryDark').value = p.primaryDark;
    document.getElementById('theme-accent').value = p.accent;
    document.getElementById('theme-sidebarStart').value = p.sidebarStart;
    document.getElementById('theme-sidebarEnd').value = p.sidebarEnd;
    previewTheme();
}

function loadThemeToForm() {
    if (!currentTheme) return;
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setV('theme-primary', currentTheme.primary || '#0d47a1');
    setV('theme-primaryDark', currentTheme.primaryDark || '#0a3a8a');
    setV('theme-accent', currentTheme.accent || '#ec4899');
    setV('theme-sidebarStart', currentTheme.sidebarStart || '#0a3a8a');
    setV('theme-sidebarEnd', currentTheme.sidebarEnd || '#0d47a1');
    previewTheme();
}

async function saveTheme() {
    const theme = {
        primary: document.getElementById('theme-primary').value,
        primaryDark: document.getElementById('theme-primaryDark').value,
        primaryLight: document.getElementById('theme-primary').value,
        accent: document.getElementById('theme-accent').value,
        sidebarStart: document.getElementById('theme-sidebarStart').value,
        sidebarEnd: document.getElementById('theme-sidebarEnd').value
    };
    try {
        const res = await adminFetch('/api/admin/config', {
            method: 'POST', body: JSON.stringify({ theme })
        });
        const data = await res.json();
        if (data.success) {
            currentTheme = theme;
            alert('✅ Tema disimpan');
        } else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

function resetTheme() {
    if (!confirm('Reset tema ke default?')) return;
    applyPreset('default');
}

// ============================================================
// LOGO SIZE (admin — hanya login & sidebar)
// ============================================================
function applyLogoSizeAdmin(size) {
    const s = LOGO_SIZES[size] || LOGO_SIZES.medium;
    const loginLogo = document.getElementById('loginLogo');
    const sidebarLogo = document.getElementById('sidebarLogo');
    if (loginLogo) { loginLogo.style.width = s.login + 'px'; loginLogo.style.height = s.login + 'px'; }
    if (sidebarLogo) { sidebarLogo.style.width = s.sidebar + 'px'; sidebarLogo.style.height = s.sidebar + 'px'; }
}

async function changeLogoSize(size) {
    applyLogoSizeAdmin(size);
    try {
        await adminFetch('/api/admin/config', {
            method: 'POST', body: JSON.stringify({ logoSize: size })
        });
    } catch (err) { console.error(err); }
}

// ============================================================
// ROLE CHECKBOXES
// ============================================================
function initRoleCheckboxes() {
    ['newProviderRoles', 'customProviderRoles'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const span = cb.parentElement.querySelector('.role-badge');
                if (span) span.classList.toggle('inactive', !cb.checked);
            });
        });
    });
}

function getSelectedRoles(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return ['chat'];
    const roles = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        roles.push(cb.value);
    });
    return roles.length > 0 ? roles : ['chat'];
}

// ============================================================
// CEK SESSION ADMIN
// ============================================================
async function checkAdminSession() {
    try {
        const res = await fetch('/api/admin/check', {
            credentials: 'include',
            headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
        });
        const data = await res.json();
        if (data.authenticated) {
            adminToken = data.token;
            currentUser = { username: data.username };
            document.getElementById('adminUsername').textContent = data.username;
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminPage').style.display = 'block';
            await loadAdminConfig();
            showPage('dashboard');
            setInterval(loadNotificationsBadge, 30000);
        }
    } catch (err) {
        console.warn('[AUTH] Cek session gagal:', err.message);
    }
}

// ============================================================
// SIDEBAR NAVIGATION
// ============================================================
function showPage(page) {
    currentPage = page;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === 'page-' + page);
    });

    const titles = {
        dashboard: 'Dashboard', general: 'Umum', logo: 'Logo & Branding',
        theme: 'Warna Tema', providers: 'Provider AI', prompt: 'Prompt AI',
        knowledge: 'Pengetahuan', graph: 'Knowledge Graph',
        unanswered: 'Pertanyaan Tak Terjawab', learning: 'Auto-Learning',
        feedback: 'Feedback & Akurasi', memory: 'Memori AI',
        sessions: 'Percakapan', notifications: 'Notifikasi',
        backup: 'Backup', security: 'Keamanan'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    loadCurrentPage();

    if (window.innerWidth < 992) {
        document.getElementById('adminSidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
    }
}

function loadCurrentPage() {
    const page = currentPage;
    if (page === 'dashboard') loadDashboard();
    if (page === 'notifications') loadNotifications();
    if (page === 'sessions') loadSessions();
    if (page === 'backup') loadBackups();
    if (page === 'memory') loadMemoryList();
    if (page === 'theme') loadThemeToForm();
    if (page === 'unanswered') loadUnanswered();
    if (page === 'learning') loadLearningQueue();
    if (page === 'feedback') loadFeedback();
    if (page === 'graph') loadGraphVisualization();
}

function toggleSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================
async function doLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            adminToken = data.token;
            currentUser = { username };
            document.getElementById('adminUsername').textContent = username;
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminPage').style.display = 'block';
            await loadAdminConfig();
            showPage('dashboard');
            setInterval(loadNotificationsBadge, 30000);
        } else {
            errorEl.textContent = data.message || 'Login gagal';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = 'Error: ' + err.message;
        errorEl.style.display = 'block';
    }
}

async function doLogout() {
    if (!confirm('Logout dari admin?')) return;
    try { await adminFetch('/api/admin/logout', { method: 'POST' }); } catch (_) {}
    currentUser = null; adminToken = null;
    document.getElementById('adminPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
}

function adminFetch(url, opts = {}) {
    return fetch(url, {
        ...opts,
        credentials: 'include',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        }
    });
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
    try {
        const res = await adminFetch('/api/admin/dashboard/stats');
        const data = await res.json();

        document.getElementById('dashAiName').textContent = data.aiName || 'SIVT AI';
        const uptime = data.uptime || 0;
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        document.getElementById('dashUptime').textContent = h > 0 ? `${h}j ${m}m` : `${m}m`;

        document.getElementById('statProviders').textContent = data.providers.total;
        document.getElementById('statProvidersSub').textContent =
            `${data.providers.active} aktif, ${data.providers.inactive} off`;
        document.getElementById('statKnowledge').textContent = data.knowledge.chunks;
        document.getElementById('statKnowledgeSub').textContent =
            `${data.knowledge.files} file, ${data.knowledge.topics} topik`;
        document.getElementById('statMemory').textContent = data.memory.total;
        document.getElementById('statMemorySub').textContent = `${data.memory.totalHits} total hit`;
        document.getElementById('statSessions').textContent = data.sessions.total;
        document.getElementById('statSessionsSub').textContent = `${data.sessions.messages} pesan`;
        document.getElementById('statUnanswered').textContent = data.unanswered.pending;
        document.getElementById('statUnansweredSub').textContent = `${data.unanswered.resolved} sudah dijawab`;
        document.getElementById('statNotif').textContent = data.notifications.unread;
        document.getElementById('statNotifSub').textContent = `dari ${data.notifications.total} total`;

        if (data.feedback) {
            document.getElementById('statFeedback').textContent = data.feedback.satisfactionRate + '%';
            document.getElementById('statFeedbackSub').textContent =
                `${data.feedback.good} 👍 / ${data.feedback.bad} 👎`;
        }
        if (data.analytics) {
            document.getElementById('statAccuracy').textContent = data.analytics.accuracyRate + '%';
            document.getElementById('statAccuracySub').textContent =
                `${data.analytics.totalRefusals} penolakan`;
        }
        if (data.graph) {
            document.getElementById('statGraphNodes').textContent = data.graph.nodes || 0;
            document.getElementById('statGraphEdges').textContent = data.graph.edges || 0;
        }

        renderChart(data.sessions.daily);
        renderProviderStatus(data.providers.list);
        renderLearningHighlight(data.learning);
        renderRAGStats(data.rag);
    } catch (err) {
        console.error('Gagal load dashboard:', err);
    }
}

function renderRAGStats(rag) {
    const el = document.getElementById('ragStatsPanel');
    if (!el) return;
    if (!rag) {
        el.innerHTML = '<div class="empty-state">RAG stats tidak tersedia</div>';
        return;
    }
    el.innerHTML = `
        <div class="rag-stats-grid">
            <div class="rag-stat"><div class="rag-stat-value">${rag.bm25Docs || 0}</div><div class="rag-stat-label">BM25 Docs</div></div>
            <div class="rag-stat"><div class="rag-stat-value">${rag.embedding?.indexedChunks || 0}</div><div class="rag-stat-label">Embedding Vecs</div></div>
            <div class="rag-stat"><div class="rag-stat-value">${rag.cache?.size || 0}</div><div class="rag-stat-label">Cache Size</div></div>
            <div class="rag-stat"><div class="rag-stat-value">${rag.cache?.hitRate || '0%'}</div><div class="rag-stat-label">Cache Hit</div></div>
            <div class="rag-stat"><div class="rag-stat-value">${rag.rewrites || 0}</div><div class="rag-stat-label">Rewrites</div></div>
            <div class="rag-stat"><div class="rag-stat-value">${rag.totalQueries || 0}</div><div class="rag-stat-label">Queries</div></div>
        </div>
        <div style="margin-top:12px;">
            <button class="btn-secondary" onclick="rebuildRAG()"><i class="fas fa-sync"></i> Rebuild RAG Index</button>
        </div>
    `;
}

async function rebuildRAG() {
    if (!confirm('Rebuild RAG index? Proses ini akan memanggil API embedding untuk semua chunk.')) return;
    try {
        const res = await adminFetch('/api/admin/rag/rebuild', { method: 'POST' });
        const data = await res.json();
        if (data.success) { alert('✅ RAG index dibangun ulang'); loadDashboard(); }
        else alert('❌ ' + data.message);
    } catch (err) { alert('Error: ' + err.message); }
}

function renderChart(daily) {
    const el = document.getElementById('chartWrap');
    if (!el) return;
    if (!daily || daily.length === 0) { el.innerHTML = '<div class="empty-state">Belum ada data</div>'; return; }
    const max = Math.max(...daily.map(d => d.sessions), 1);
    let html = '<div class="chart-bars">';
    daily.forEach(d => {
        const height = (d.sessions / max) * 100;
        html += `<div class="chart-bar-wrap" title="${d.date}: ${d.sessions} sesi">
            <div class="chart-bar-value">${d.sessions}</div>
            <div class="chart-bar" style="height: ${Math.max(height, 5)}%"></div>
            <div class="chart-bar-label">${d.day}</div>
        </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
}

function renderProviderStatus(list) {
    const el = document.getElementById('providerStatusList');
    if (!el) return;
    if (!list || list.length === 0) { el.innerHTML = '<div class="empty-state">Belum ada provider</div>'; return; }
    let html = '';
    list.forEach(p => {
        const badge = p.enabled ? '<span class="badge badge-success">✓</span>' : '<span class="badge badge-secondary">✗</span>';
        const roles = (p.roles || ['chat']).map(r => `<span class="role-badge ${r}">${r}</span>`).join(' ');
        html += `<div class="provider-status-item">
            <div class="provider-status-name">${badge} <strong>${p.name}</strong></div>
            <div class="provider-status-meta">${roles} · ${p.models} model</div>
        </div>`;
    });
    el.innerHTML = html;
}

function renderLearningHighlight(learning) {
    const el = document.getElementById('learningHighlight');
    if (!el || !learning) return;
    if (learning.pending === 0) { el.innerHTML = '<div class="empty-state">Tidak ada pertanyaan pending ✅</div>'; return; }
    el.innerHTML = `<div class="learning-highlight-content">
        <div class="learning-stat-big">${learning.pending}</div>
        <div class="learning-stat-label">Pertanyaan perlu diperhatikan</div>
        <div class="learning-stat-breakdown">
            ${learning.urgent > 0 ? `<span class="badge badge-danger">${learning.urgent} urgent</span>` : ''}
            ${learning.high > 0 ? `<span class="badge badge-warning">${learning.high} tinggi</span>` : ''}
            ${learning.medium > 0 ? `<span class="badge badge-primary">${learning.medium} sedang</span>` : ''}
        </div>
        <button class="btn-primary-lg" style="margin-top:14px;" onclick="showPage('learning')">
            <i class="fas fa-arrow-right"></i> Lihat Learning Queue
        </button>
    </div>`;
}

// ============================================================
// NOTIFIKASI
// ============================================================
function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    const isOpen = dropdown.classList.contains('show');
    if (isOpen) dropdown.classList.remove('show');
    else { dropdown.classList.add('show'); loadNotificationsDropdown(); }
}

async function loadNotificationsBadge() {
    try {
        const res = await adminFetch('/api/admin/notifications');
        const data = await res.json();
        const badge = document.getElementById('notifBadge');
        if (data.unread > 0) {
            badge.textContent = data.unread > 99 ? '99+' : data.unread;
            badge.style.display = 'flex';
        } else badge.style.display = 'none';
    } catch (err) {}
}

async function loadNotificationsDropdown() {
    const body = document.getElementById('notifBody');
    body.innerHTML = '<div class="notif-empty"><i class="fas fa-spinner fa-spin"></i> Memuat...</div>';
    try {
        const res = await adminFetch('/api/admin/notifications');
        const data = await res.json();

        const badge = document.getElementById('notifBadge');
        if (data.unread > 0) {
            badge.textContent = data.unread > 99 ? '99+' : data.unread;
            badge.style.display = 'flex';
        } else badge.style.display = 'none';

        if (!data.items || data.items.length === 0) {
            body.innerHTML = '<div class="notif-empty">Belum ada notifikasi</div>';
            return;
        }

        let html = '';
        data.items.slice(0, 10).forEach(n => {
            const date = timeAgo(n.timestamp);
            const icon = n.level === 'danger' ? 'exclamation-triangle' :
                         (n.level === 'warning' ? 'exclamation-circle' : 'info-circle');
            html += `<div class="notif-dropdown-item notif-${n.level} ${n.read ? 'notif-read' : ''}">
                <div class="notif-dropdown-icon"><i class="fas fa-${icon}"></i></div>
                <div class="notif-dropdown-content">
                    <div class="notif-dropdown-title">${n.title}</div>
                    <div class="notif-dropdown-msg">${n.message.slice(0, 80)}</div>
                    <div class="notif-dropdown-time">${date}</div>
                </div>
            </div>`;
        });
        body.innerHTML = html;
    } catch (err) {
        body.innerHTML = '<div class="notif-empty text-danger">Gagal memuat</div>';
    }
}

function timeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'Baru saja';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} menit lalu`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour} jam lalu`;
    const day = Math.floor(hour / 24);
    return `${day} hari lalu`;
}

// ============================================================
// LOAD ADMIN CONFIG
// ============================================================
async function loadAdminConfig() {
    try {
        const res = await adminFetch('/api/admin/config');
        const cfg = await res.json();

        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
        setVal('cfg-aiName', cfg.aiName);
        setVal('cfg-tagline', cfg.tagline);
        setVal('cfg-welcomeMessage', cfg.welcomeMessage);
        setVal('cfg-contact-address', cfg.contactInfo?.address);
        setVal('cfg-contact-phone', cfg.contactInfo?.phone);
        setVal('cfg-contact-whatsapp', cfg.contactInfo?.whatsapp);
        setVal('cfg-contact-email', cfg.contactInfo?.email);
        setVal('cfg-contact-hours', cfg.contactInfo?.hours);
        setVal('cfg-systemInstruction', cfg.systemInstruction);

        const cb = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
        cb('memoryEnabled', cfg.memoryEnabled !== false);
        cb('convEnabled', cfg.conversationHistoryEnabled !== false);

        setVal('memoryMinScore', cfg.memoryMinScore || 75);
        setVal('memorySaveThreshold', cfg.memorySaveThreshold || 55);
        setVal('convSize', cfg.conversationHistorySize || 20);
        setVal('rateLimitPerSession', cfg.rateLimitPerSession || 20);

        updateLogoPreview(cfg.logoUrl);
        const sizeRadio = document.querySelector(`input[name="logoSize"][value="${cfg.logoSize || 'medium'}"]`);
        if (sizeRadio) sizeRadio.checked = true;

        const setBadge = (id, v) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = v;
                el.style.display = v > 0 ? 'inline-flex' : 'none';
            }
        };
        setBadge('badgeProviders', (cfg.providers || []).length);
        setBadge('badgeKnowledge', cfg.knowledgeChunks || 0);
        setBadge('badgeMemory', cfg.memoryCount || 0);
        setBadge('badgeSessions', cfg.sessionCount || 0);
        setBadge('badgeUnanswered', cfg.pendingUnanswered || 0);
        setBadge('badgeLearning', cfg.pendingLearning || 0);
        if (cfg.graph) setBadge('badgeGraph', cfg.graph.nodes || 0);

        renderProviders(cfg.providers || []);
        renderKnowledgeFiles(cfg.knowledgeFiles || [], cfg.knowledgeChunks || 0);
    } catch (err) {
        console.error('Gagal load admin config:', err);
    }
}

// ============================================================
// PROVIDER MODE SWITCH
// ============================================================
function switchProviderMode(mode) {
    currentProviderMode = mode;
    document.querySelectorAll('#page-providers .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    const builtIn = document.getElementById('providerMode-builtin');
    const custom = document.getElementById('providerMode-custom');
    if (builtIn) builtIn.style.display = mode === 'builtin' ? 'block' : 'none';
    if (custom) custom.style.display = mode === 'custom' ? 'block' : 'none';
}

// ============================================================
// PROVIDERS LIST
// ============================================================
function renderProviders(providers) {
    const el = document.getElementById('providersList');
    if (!el) return;
    if (providers.length === 0) {
        el.innerHTML = '<div class="empty-state">Belum ada provider. Tambahkan API key di atas.</div>';
        return;
    }

    let html = '<div class="table-wrap"><table class="data-table"><thead><tr>';
    html += '<th>#</th><th>Provider</th><th>Role</th><th>Model</th><th>Status</th><th>Aksi</th>';
    html += '</tr></thead><tbody>';

    providers.forEach(p => {
        const statusBadge = p.enabled
            ? '<span class="badge badge-success">✓ Aktif</span>'
            : '<span class="badge badge-secondary">✗ Off</span>';

        const customTag = p.isCustom
            ? ' <span class="badge badge-warning" style="font-size:9px;">CUSTOM</span>'
            : '';

        const roleBadges = VALID_ROLES.map(role => {
            const roles = p.roles || ['chat'];
            const active = roles.includes(role);
            return `<span class="role-badge ${role} ${active ? '' : 'inactive'}"
                        onclick="toggleRole(${p.index}, '${role}')"
                        title="Klik untuk toggle role ${role}">
                ${role}${active ? ' ✓' : ''}
            </span>`;
        }).join('');

        const embModels = (p.embeddingModels || []).length > 0
            ? `<div style="font-size:10px;color:#666;margin-top:4px;">📐 ${(p.embeddingModels || []).join(', ')}</div>`
            : '';

        html += `<tr>
            <td>${p.index + 1}</td>
            <td><strong>${p.displayName}</strong>${customTag}</td>
            <td><div style="display:flex;flex-wrap:wrap;gap:4px;max-width:280px;">${roleBadges}</div></td>
            <td style="font-size:11px">
                <code>${(p.models || []).slice(0, 2).join(', ')}</code>
                ${embModels}
            </td>
            <td>${statusBadge}</td>
            <td style="white-space:nowrap">
                <button class="btn-icon-sm btn-info" onclick="testProvider(${p.index}, 'chat')" title="Test Chat"><i class="fas fa-vial"></i></button>
                <button class="btn-icon-sm btn-info" onclick="testProvider(${p.index}, 'embedding')" title="Test Embedding"><i class="fas fa-ruler-combined"></i></button>
                <button class="btn-icon-sm btn-primary" onclick="editProviderModels(${p.index}, '${(p.models || []).join(',')}', '${(p.embeddingModels || []).join(',')}')" title="Edit Model"><i class="fas fa-edit"></i></button>
                <button class="btn-icon-sm btn-warning" onclick="editProviderKey(${p.index})" title="Edit API Key"><i class="fas fa-key"></i></button>
                <button class="btn-icon-sm btn-secondary" onclick="toggleProvider(${p.index})" title="On/Off"><i class="fas fa-power-off"></i></button>
                <button class="btn-icon-sm btn-danger" onclick="removeProvider(${p.index})" title="Hapus"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;
}

async function toggleRole(index, role) {
    try {
        const cfgRes = await adminFetch('/api/admin/config');
        const cfg = await cfgRes.json();
        const provider = (cfg.providers || []).find(p => p.index === index);
        if (!provider) return;

        const currentRoles = provider.roles || ['chat'];
        const roles = new Set(currentRoles);

        if (roles.has(role)) {
            if (roles.size > 1) roles.delete(role);
            else { alert('Minimal 1 role harus aktif'); return; }
        } else roles.add(role);

        const res = await adminFetch('/api/admin/providers/update-roles', {
            method: 'POST',
            body: JSON.stringify({ index, roles: [...roles] })
        });
        const data = await res.json();
        if (data.success) loadAdminConfig();
        else alert('❌ ' + data.message);
    } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// ADD PROVIDER
// ============================================================
async function addProvider() {
    const isCustom = currentProviderMode === 'custom';
    let payload;

    if (isCustom) {
        const name = document.getElementById('customProviderName').value.trim();
        const displayName = document.getElementById('customProviderDisplay').value.trim();
        const endpoint = document.getElementById('customProviderEndpoint').value.trim();
        const apiKey = document.getElementById('customProviderKey').value.trim();
        const modelsRaw = document.getElementById('customProviderModels').value.trim();
        const embModelsRaw = document.getElementById('customProviderEmbeddingModels').value.trim();
        const roles = getSelectedRoles('customProviderRoles');

        if (!name) return alert('Nama provider wajib diisi');
        if (!endpoint) return alert('Custom Endpoint wajib diisi');
        if (!apiKey) return alert('API Key wajib diisi');

        const models = modelsRaw ? modelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const embeddingModels = embModelsRaw ? embModelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

        if (models.length === 0 && !roles.includes('embedding')) {
            return alert('Minimal 1 model chat wajib diisi');
        }

        payload = { name, apiKey, models, embeddingModels, customEndpoint: endpoint, displayName, roles };
    } else {
        const name = document.getElementById('newProviderName').value;
        const apiKey = document.getElementById('newProviderKey').value.trim();
        const modelsRaw = document.getElementById('newProviderModels').value.trim();
        const embModelsRaw = document.getElementById('newProviderEmbeddingModels').value.trim();
        const roles = getSelectedRoles('newProviderRoles');

        if (!apiKey) return alert('API key harus diisi');

        const models = modelsRaw ? modelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const embeddingModels = embModelsRaw ? embModelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        payload = { name, apiKey, models, embeddingModels, roles };
    }

    const status = document.getElementById('addProviderStatus');
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menambahkan...';

    try {
        const res = await adminFetch('/api/admin/providers/add', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            status.innerHTML = '<span class="text-success">✅ Ditambahkan. Total: ' + data.total + '</span>';
            ['newProviderKey','newProviderModels','newProviderEmbeddingModels',
             'customProviderName','customProviderDisplay','customProviderEndpoint',
             'customProviderKey','customProviderModels','customProviderEmbeddingModels']
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            loadAdminConfig();
        } else {
            status.innerHTML = '<span class="text-danger">' + data.message + '</span>';
        }
    } catch (err) {
        status.innerHTML = '<span class="text-danger">' + err.message + '</span>';
    }
}

async function editProviderKey(index) {
    const input = prompt('Masukkan API key baru untuk provider ini:');
    if (!input || input.trim().length < 5) return alert('API key tidak valid');
    try {
        const res = await adminFetch('/api/admin/providers/update-key', {
            method: 'POST',
            body: JSON.stringify({ index, apiKey: input.trim() })
        });
        const data = await res.json();
        if (data.success) { alert('✅ API key diperbarui'); loadAdminConfig(); }
        else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

async function editProviderModels(index, currentModels, currentEmbModels) {
    const input = prompt('Edit model CHAT provider (pisah dengan koma):', currentModels);
    if (input === null) return;
    const models = input.split(',').map(s => s.trim()).filter(Boolean);

    const inputEmb = prompt('Edit model EMBEDDING provider (pisah dengan koma, kosongkan untuk skip):', currentEmbModels || '');
    if (inputEmb === null) return;
    const embeddingModels = inputEmb.split(',').map(s => s.trim()).filter(Boolean);

    if (models.length === 0 && embeddingModels.length === 0) {
        return alert('Minimal 1 model (chat atau embedding)');
    }

    try {
        const res = await adminFetch('/api/admin/providers/update-models', {
            method: 'POST',
            body: JSON.stringify({ index, models, embeddingModels })
        });
        const data = await res.json();
        if (data.success) { alert('✅ Model diperbarui'); loadAdminConfig(); }
        else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

async function removeProvider(index) {
    if (!confirm('Hapus provider ini?')) return;
    try {
        const res = await adminFetch('/api/admin/providers/remove', {
            method: 'POST', body: JSON.stringify({ index })
        });
        const data = await res.json();
        if (data.success) loadAdminConfig(); else alert(data.message);
    } catch (err) { alert(err.message); }
}

async function toggleProvider(index) {
    try {
        const res = await adminFetch('/api/admin/providers/toggle', {
            method: 'POST', body: JSON.stringify({ index })
        });
        const data = await res.json();
        if (data.success) { loadAdminConfig(); loadNotificationsBadge(); }
        else alert(data.message);
    } catch (err) { alert(err.message); }
}

async function testProvider(index, type = 'chat') {
    try {
        const res = await adminFetch('/api/admin/providers/test', {
            method: 'POST', body: JSON.stringify({ index, type })
        });
        const data = await res.json();
        alert(data.success ? '✅ ' + data.message : '❌ ' + data.message);
    } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// UNANSWERED QUESTIONS
// ============================================================
function filterUnanswered(filter) {
    currentUnansweredFilter = filter;
    document.querySelectorAll('#page-unanswered .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    loadUnanswered();
}

async function loadUnanswered() {
    const el = document.getElementById('unansweredList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const res = await adminFetch(`/api/admin/unanswered?filter=${currentUnansweredFilter}`);
        const data = await res.json();

        document.getElementById('filterPendingCount').textContent = data.pending;
        document.getElementById('filterResolvedCount').textContent = data.resolved;
        document.getElementById('filterAllCount').textContent = data.total;

        const badge = document.getElementById('badgeUnanswered');
        if (badge) {
            badge.textContent = data.pending;
            badge.style.display = data.pending > 0 ? 'inline-flex' : 'none';
        }

        if (!data.items || data.items.length === 0) {
            el.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="font-size:32px; color:var(--success); margin-bottom:8px;"></i><br>Tidak ada pertanyaan yang cocok dengan filter.</div>';
            return;
        }

        let html = '';
        data.items.forEach(u => {
            const date = new Date(u.lastAsked).toLocaleString('id-ID');
            const isResolved = u.resolved;
            const countBadge = u.count > 1 ? `<span class="badge badge-warning">Ditanya ${u.count}x</span>` : '';
            const safeQuestion = u.question.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/'/g, "\\'");

            html += `<div class="unanswered-item ${isResolved ? 'unanswered-resolved' : ''}">
                <div class="unanswered-head">
                    <div class="unanswered-icon"><i class="fas fa-${isResolved ? 'check-circle' : 'question-circle'}"></i></div>
                    <div class="unanswered-question">${u.question}</div>
                    <div class="unanswered-badges">
                        ${countBadge}
                        ${isResolved ? '<span class="badge badge-success">✓ Sudah</span>' : '<span class="badge badge-danger">Belum</span>'}
                    </div>
                </div>
                <div class="unanswered-meta"><i class="fas fa-clock"></i> Terakhir ditanya: ${date}</div>
                <div class="unanswered-actions">
                    ${!isResolved ? `
                        <button class="btn-primary-lg btn-sm" onclick="openAnswerModal('${u.id}', '${safeQuestion}', 'unanswered')">
                            <i class="fas fa-plus-circle"></i> Tambah Jawaban
                        </button>
                        <button class="btn-secondary btn-sm" onclick="markUnansweredResolved('${u.id}')">
                            <i class="fas fa-check"></i> Tandai Sudah
                        </button>
                    ` : ''}
                    <button class="btn-danger-outline btn-sm" onclick="deleteUnanswered('${u.id}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>`;
        });
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = `<div class="empty-state text-danger">Gagal load: ${err.message}</div>`;
    }
}

async function markUnansweredResolved(id) {
    try {
        const res = await adminFetch('/api/admin/unanswered/resolve', {
            method: 'POST', body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) { loadUnanswered(); loadAdminConfig(); }
    } catch (err) { alert(err.message); }
}

async function deleteUnanswered(id) {
    if (!confirm('Hapus pertanyaan ini dari daftar?')) return;
    try {
        const res = await adminFetch('/api/admin/unanswered/delete', {
            method: 'POST', body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) { loadUnanswered(); loadAdminConfig(); }
    } catch (err) { alert(err.message); }
}

async function clearResolvedUnanswered() {
    if (!confirm('Hapus semua pertanyaan yang sudah dijawab?')) return;
    try {
        const res = await adminFetch('/api/admin/unanswered/clear', {
            method: 'POST', body: JSON.stringify({ onlyResolved: true })
        });
        const data = await res.json();
        if (data.success) { loadUnanswered(); loadAdminConfig(); }
    } catch (err) { alert(err.message); }
}

// ============================================================
// LEARNING QUEUE
// ============================================================
function filterLearning(filter) {
    currentLearningFilter = filter;
    document.querySelectorAll('#page-learning .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    loadLearningQueue();
}

async function loadLearningQueue() {
    const el = document.getElementById('learningList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const res = await adminFetch(`/api/admin/learning/queue?filter=${currentLearningFilter}`);
        const data = await res.json();

        const stats = data.stats || {};
        const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        setText('learningTotal', stats.total || 0);
        setText('learningPending', stats.pending || 0);
        setText('learningResolved', stats.resolved || 0);
        setText('learningUrgent', stats.urgent || 0);

        const setCount = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        setCount('learningFilterPendingCount', stats.pending || 0);
        setCount('learningFilterUrgentCount', stats.urgent || 0);
        setCount('learningFilterHighCount', (stats.urgent || 0) + (stats.high || 0));
        setCount('learningFilterAllCount', stats.total || 0);

        const badge = document.getElementById('badgeLearning');
        if (badge) {
            badge.textContent = stats.pending || 0;
            badge.style.display = (stats.pending || 0) > 0 ? 'inline-flex' : 'none';
        }

        if (!data.items || data.items.length === 0) {
            el.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="font-size:32px; color:var(--success); margin-bottom:8px;"></i><br>Tidak ada antrian belajar. AI Anda sudah pintar! 🎉</div>';
            return;
        }

        let html = '';
        data.items.forEach(item => {
            const date = new Date(item.lastAsked).toLocaleString('id-ID');
            const priorityClass = `priority-${item.priority}`;
            const priorityLabel = {
                urgent: '🚨 URGENT', high: '⚠️ TINGGI', medium: '📌 SEDANG', normal: 'ℹ️ NORMAL'
            }[item.priority] || 'NORMAL';

            const variants = (item.variants || []).slice(0, 3).map(v =>
                `<div class="variant-item"><i class="fas fa-quote-right"></i> ${v}</div>`
            ).join('');

            const safeQuestion = (item.original || item.question)
                .replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/'/g, "\\'");

            html += `<div class="learning-item ${priorityClass} ${item.resolved ? 'learning-resolved' : ''}">
                <div class="learning-head">
                    <div class="learning-priority">${priorityLabel}</div>
                    <div class="learning-count"><i class="fas fa-fire"></i> ${item.count}x ditanya</div>
                </div>
                <div class="learning-question"><i class="fas fa-question-circle"></i> ${item.question}</div>
                ${variants ? `<div class="learning-variants"><div class="variant-label">Variasi pertanyaan:</div>${variants}</div>` : ''}
                <div class="learning-meta">
                    <i class="fas fa-clock"></i> Pertama: ${new Date(item.firstAsked).toLocaleDateString('id-ID')} • Terakhir: ${date}
                </div>
                <div class="unanswered-actions">
                    ${!item.resolved ? `
                        <button class="btn-primary-lg btn-sm" onclick="openAnswerModal('${item.id}', '${safeQuestion}', 'learning')">
                            <i class="fas fa-plus-circle"></i> Tambah ke Pengetahuan
                        </button>
                        <button class="btn-secondary btn-sm" onclick="resolveLearning('${item.id}')">
                            <i class="fas fa-check"></i> Tandai Selesai
                        </button>
                    ` : `<span class="badge badge-success">✓ Sudah ditangani</span>`}
                    <button class="btn-danger-outline btn-sm" onclick="deleteLearning('${item.id}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>`;
        });
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = `<div class="empty-state text-danger">Gagal load: ${err.message}</div>`;
    }
}

async function resolveLearning(id) {
    try {
        const res = await adminFetch('/api/admin/learning/resolve', {
            method: 'POST', body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) { loadLearningQueue(); loadAdminConfig(); }
    } catch (err) { alert(err.message); }
}

async function deleteLearning(id) {
    if (!confirm('Hapus pertanyaan ini dari antrian belajar?')) return;
    try {
        const res = await adminFetch('/api/admin/learning/delete', {
            method: 'POST', body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) { loadLearningQueue(); loadAdminConfig(); }
    } catch (err) { alert(err.message); }
}

async function clearResolvedLearning() {
    if (!confirm('Hapus semua pertanyaan yang sudah diselesaikan?')) return;
    try {
        const res = await adminFetch('/api/admin/learning/clear-resolved', { method: 'POST' });
        const data = await res.json();
        if (data.success) { loadLearningQueue(); loadAdminConfig(); }
    } catch (err) { alert(err.message); }
}

async function clearAllLearning() {
    if (!confirm('⚠️ HAPUS SEMUA antrian belajar?')) return;
    if (!confirm('Yakin? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
        const res = await adminFetch('/api/admin/learning/clear-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) { loadLearningQueue(); loadAdminConfig(); }
    } catch (err) { alert(err.message); }
}

// ============================================================
// FEEDBACK
// ============================================================
function filterFeedback(filter) {
    currentFeedbackFilter = filter;
    document.querySelectorAll('#page-feedback .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    loadFeedback();
}

async function loadFeedback() {
    try {
        const statsRes = await adminFetch('/api/admin/feedback/stats');
        const stats = await statsRes.json();

        const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        setText('fbTotal', stats.feedback?.total || 0);
        setText('fbGood', stats.feedback?.good || 0);
        setText('fbBad', stats.feedback?.bad || 0);
        setText('fbSatisfaction', (stats.feedback?.satisfactionRate || 0) + '%');

        setText('anTotalChats', stats.analytics?.totalChats || 0);
        setText('anTotalAnswers', stats.analytics?.totalAnswers || 0);
        setText('anRefusals', stats.analytics?.totalRefusals || 0);
        setText('anAccuracy', (stats.analytics?.accuracyRate || 0) + '%');
        setText('anMemoryHits', stats.analytics?.totalMemoryHits || 0);
        setText('anRagHits', stats.analytics?.totalRagHits || 0);
        setText('anOutOfScope', stats.analytics?.totalOutOfScope || 0);

        renderFeedbackChart(stats.dailyStats);
    } catch (err) { console.error('Gagal load feedback stats:', err); }

    const el = document.getElementById('feedbackList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        let endpoint = '/api/admin/feedback/list';
        if (currentFeedbackFilter === 'good') endpoint = '/api/admin/feedback/good';
        if (currentFeedbackFilter === 'bad') endpoint = '/api/admin/feedback/bad';

        const res = await adminFetch(endpoint);
        const data = await res.json();

        if (!data.items || data.items.length === 0) {
            el.innerHTML = '<div class="empty-state">Belum ada feedback.</div>';
            return;
        }

        let html = '';
        data.items.forEach(f => {
            const date = new Date(f.timestamp).toLocaleString('id-ID');
            const icon = f.rating === 'good' ? 'thumbs-up' : 'thumbs-down';
            const badgeClass = f.rating === 'good' ? 'badge-success' : 'badge-danger';

            html += `<div class="feedback-item feedback-${f.rating}">
                <div class="feedback-head">
                    <div class="feedback-icon"><i class="fas fa-${icon}"></i></div>
                    <div class="feedback-question">${f.question}</div>
                    <span class="badge ${badgeClass}">${f.rating === 'good' ? '👍 Bagus' : '👎 Kurang'}</span>
                </div>
                <div class="feedback-answer">
                    <div class="feedback-label">Jawaban AI:</div>
                    <div class="feedback-answer-text">${f.answer}</div>
                </div>
                <div class="feedback-meta">
                    <i class="fas fa-clock"></i> ${date}
                    ${f.provider ? ` • <i class="fas fa-cloud"></i> ${f.provider}` : ''}
                    ${f.source ? ` • <i class="fas fa-tag"></i> ${f.source}` : ''}
                </div>
            </div>`;
        });
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = `<div class="empty-state text-danger">Gagal load: ${err.message}</div>`;
    }
}

function renderFeedbackChart(dailyStats) {
    const el = document.getElementById('feedbackChart');
    if (!el || !dailyStats) return;
    const days = Object.keys(dailyStats).sort().slice(-7);
    if (days.length === 0) { el.innerHTML = '<div class="empty-state">Belum ada data</div>'; return; }

    const max = Math.max(...days.map(d => dailyStats[d].chats || 0), 1);
    let html = '<div class="chart-bars">';
    days.forEach(day => {
        const stats = dailyStats[day];
        const total = stats.chats || 0;
        const good = stats.good || 0;
        const bad = stats.bad || 0;
        const height = (total / max) * 100;

        html += `<div class="chart-bar-wrap" title="${day}: ${total} chat">
            <div class="chart-bar-value">${total}</div>
            <div class="chart-bar chart-bar-multi" style="height: ${Math.max(height, 5)}%">
                <div class="bar-good" style="height: ${total > 0 ? (good/total)*100 : 0}%"></div>
                <div class="bar-bad" style="height: ${total > 0 ? (bad/total)*100 : 0}%"></div>
            </div>
            <div class="chart-bar-label">${day.slice(5)}</div>
        </div>`;
    });
    html += '</div>';
    html += '<div class="chart-legend"><span class="legend-item"><span class="legend-dot legend-good"></span> Bagus</span><span class="legend-item"><span class="legend-dot legend-bad"></span> Kurang</span></div>';
    el.innerHTML = html;
}

async function clearFeedback() {
    if (!confirm('Hapus semua data feedback?')) return;
    try {
        await adminFetch('/api/admin/feedback/clear', { method: 'POST', body: JSON.stringify({}) });
        loadFeedback();
    } catch (err) { alert(err.message); }
}

async function clearAnalytics() {
    if (!confirm('Reset semua data analytics?')) return;
    try {
        await adminFetch('/api/admin/feedback/clear', { method: 'POST', body: JSON.stringify({ analytics: true }) });
        loadFeedback();
    } catch (err) { alert(err.message); }
}

// ============================================================
// MODAL ANSWER + UNIFIED PIPELINE
// ============================================================
function openAnswerModal(id, question, source) {
    document.getElementById('modal-id').value = id;
    document.getElementById('modal-question').value = question;
    document.getElementById('modal-answer').value = '';
    document.getElementById('modal-category').value = '';
    document.getElementById('modal-source').value = source;
    document.getElementById('modalPipelineStatus').innerHTML = '';
    const btn = document.getElementById('modalSubmitBtn');
    if (btn) btn.disabled = false;
    document.getElementById('answerModal').classList.add('show');
    setTimeout(() => document.getElementById('modal-answer').focus(), 100);
}

function closeAnswerModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('answerModal').classList.remove('show');
}

async function submitAnswerToKnowledge() {
    const id = document.getElementById('modal-id').value;
    const question = document.getElementById('modal-question').value;
    const answer = document.getElementById('modal-answer').value.trim();
    const category = document.getElementById('modal-category').value.trim();
    const source = document.getElementById('modal-source').value;
    const statusEl = document.getElementById('modalPipelineStatus');
    const submitBtn = document.getElementById('modalSubmitBtn');

    if (!answer) return alert('Jawaban tidak boleh kosong');
    if (answer.length < 20) return alert('Jawaban minimal 20 karakter');

    if (submitBtn) submitBtn.disabled = true;

    if (statusEl) {
        statusEl.innerHTML = `
            <div class="pipeline-step pending"><i class="fas fa-spinner fa-spin"></i> Menyimpan ke Buku Pengetahuan...</div>
            <div class="pipeline-step pending"><i class="fas fa-circle"></i> Update Knowledge Graph...</div>
            <div class="pipeline-step pending"><i class="fas fa-circle"></i> Tandai resolved (3 fitur)...</div>
            <div class="pipeline-step pending"><i class="fas fa-circle"></i> Semantic Extraction via AI...</div>
        `;
    }

    try {
        const res = await adminFetch('/api/admin/unified/add-to-knowledge', {
            method: 'POST',
            body: JSON.stringify({ id, question, answer, category, source })
        });
        const data = await res.json();

        if (data.success) {
            const s = data.steps || {};
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="pipeline-step ${s.savedToKnowledge ? 'success' : 'failed'}">
                        <i class="fas fa-${s.savedToKnowledge ? 'check-circle' : 'times-circle'}"></i>
                        Buku Pengetahuan ${s.savedToKnowledge ? 'terupdate' : 'gagal'}
                    </div>
                    <div class="pipeline-step ${s.graphUpdated ? 'success' : 'failed'}">
                        <i class="fas fa-${s.graphUpdated ? 'check-circle' : 'times-circle'}"></i>
                        Knowledge Graph ${s.graphUpdated ? `+${s.edgesAdded} edges` : 'gagal'}
                    </div>
                    <div class="pipeline-step ${(s.resolvedUnanswered || s.resolvedLearning) ? 'success' : 'pending'}">
                        <i class="fas fa-${(s.resolvedUnanswered || s.resolvedLearning) ? 'check-circle' : 'circle'}"></i>
                        Resolved: ${s.resolvedUnanswered ? 'Tak Terjawab ✓ ' : ''}${s.resolvedLearning ? 'Auto-Learning ✓' : ''}
                    </div>
                    <div class="pipeline-step ${s.triplesExtracted > 0 ? 'success' : 'pending'}">
                        <i class="fas fa-${s.triplesExtracted > 0 ? 'check-circle' : 'circle'}"></i>
                        Semantic: ${s.triplesExtracted || 0} triple diekstrak
                    </div>
                `;
            }

            setTimeout(() => {
                closeAnswerModal();
                if (source === 'learning') loadLearningQueue();
                else loadUnanswered();
                loadAdminConfig();
            }, 2000);
        } else {
            if (statusEl) {
                statusEl.innerHTML = `<div class="pipeline-step failed"><i class="fas fa-times-circle"></i> Gagal: ${data.message}</div>`;
            }
            if (submitBtn) submitBtn.disabled = false;
        }
    } catch (err) {
        if (statusEl) {
            statusEl.innerHTML = `<div class="pipeline-step failed"><i class="fas fa-times-circle"></i> Error: ${err.message}</div>`;
        }
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ============================================================
// LOGO
// ============================================================
function updateLogoPreview(url) {
    const box = document.getElementById('logoPreviewBox');
    if (!box) return;
    if (url) box.innerHTML = `<img src="${url}" alt="Logo">`;
    else box.innerHTML = `<div class="logo-placeholder"><i class="fas fa-image"></i><span>Belum ada logo</span></div>`;
}

async function uploadLogo() {
    const fileInput = document.getElementById('logoFile');
    const status = document.getElementById('logoStatus');
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('logo', fileInput.files[0]);
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengupload...';

    try {
        const res = await fetch('/api/admin/logo/upload', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            status.innerHTML = '<span class="text-success">✅ Logo diupload!</span>';
            updateLogoPreview(data.logoUrl);
            await loadPublicConfigAdmin();
            loadAdminConfig();
        } else status.innerHTML = '<span class="text-danger">❌ ' + data.message + '</span>';
    } catch (err) { status.innerHTML = '<span class="text-danger">' + err.message + '</span>'; }
    fileInput.value = '';
}

async function deleteLogo() {
    if (!confirm('Hapus logo?')) return;
    const status = document.getElementById('logoStatus');
    try {
        const res = await adminFetch('/api/admin/logo/delete', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            status.innerHTML = '<span class="text-success">✅ Logo dihapus</span>';
            updateLogoPreview('');
            await loadPublicConfigAdmin();
            loadAdminConfig();
        } else status.innerHTML = '<span class="text-danger">❌ ' + data.message + '</span>';
    } catch (err) { status.innerHTML = '<span class="text-danger">' + err.message + '</span>'; }
}

// ============================================================
// GENERAL / PROMPT
// ============================================================
async function saveGeneral() {
    const updates = {
        aiName: document.getElementById('cfg-aiName').value.trim(),
        tagline: document.getElementById('cfg-tagline').value.trim(),
        welcomeMessage: document.getElementById('cfg-welcomeMessage').value,
        contactInfo: {
            address: document.getElementById('cfg-contact-address').value.trim(),
            phone: document.getElementById('cfg-contact-phone').value.trim(),
            whatsapp: document.getElementById('cfg-contact-whatsapp').value.trim(),
            email: document.getElementById('cfg-contact-email').value.trim(),
            hours: document.getElementById('cfg-contact-hours').value.trim()
        }
    };
    try {
        const res = await adminFetch('/api/admin/config', {
            method: 'POST', body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (data.success) { alert('✅ Pengaturan disimpan'); await loadPublicConfigAdmin(); }
        else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

async function savePrompt() {
    const systemInstruction = document.getElementById('cfg-systemInstruction').value;
    try {
        const res = await adminFetch('/api/admin/config', {
            method: 'POST', body: JSON.stringify({ systemInstruction })
        });
        const data = await res.json();
        if (data.success) alert('✅ Prompt disimpan'); else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

// ============================================================
// KNOWLEDGE
// ============================================================
function renderKnowledgeFiles(files, chunks) {
    const el = document.getElementById('knowledgeFilesList');
    if (!el) return;
    if (files.length === 0) { el.innerHTML = '<div class="empty-state">Belum ada file pengetahuan</div>'; return; }

    let html = `<p class="text-muted small">Total ${chunks} chunk aktif</p>`;
    html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Nama</th><th>Ukuran</th><th>Aksi</th></tr></thead><tbody>';
    files.forEach(f => {
        html += `<tr><td>${f.name}</td><td>${(f.size / 1024).toFixed(1)} KB</td><td><button class="btn-icon-sm btn-danger" onclick="deleteKnowledge('${f.name}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

async function uploadKnowledge() {
    const fileInput = document.getElementById('knowledgeFile');
    if (!fileInput.files[0]) return alert('Pilih file dulu');
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    const status = document.getElementById('uploadStatus');
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengupload...';
    try {
        const res = await fetch('/api/admin/knowledge/upload', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            status.innerHTML = '<span class="text-success">✅ ' + data.message + '</span>';
            fileInput.value = '';
            loadAdminConfig();
        } else status.innerHTML = '<span class="text-danger">❌ ' + data.message + '</span>';
    } catch (err) { status.innerHTML = '<span class="text-danger">' + err.message + '</span>'; }
}

async function deleteKnowledge(name) {
    if (!confirm(`Hapus file ${name}?`)) return;
    try {
        const res = await adminFetch('/api/admin/knowledge/delete', {
            method: 'POST', body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) loadAdminConfig(); else alert(data.message);
    } catch (err) { alert(err.message); }
}

async function reloadKnowledge() {
    try {
        const res = await adminFetch('/api/admin/knowledge/reload', { method: 'POST' });
        const data = await res.json();
        alert(`✅ Reload selesai. Total ${data.chunks} chunk.`);
        loadAdminConfig();
    } catch (err) { alert(err.message); }
}

// ============================================================
// MEMORY
// ============================================================
async function loadMemoryList() {
    const el = document.getElementById('memoryList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await adminFetch('/api/admin/memory');
        const data = await res.json();
        if (!data.items || data.items.length === 0) { el.innerHTML = '<div class="empty-state">Belum ada memori.</div>'; return; }

        let html = '';
        data.items.forEach((m, i) => {
            const date = new Date(m.timestamp).toLocaleString('id-ID');
            html += `<div class="memory-item">
                <div class="memory-head">
                    <span class="memory-date"><i class="fas fa-clock"></i> ${date}</span>
                    <span class="badge badge-primary">Hit: ${m.hit}</span>
                    <button class="btn-icon-sm btn-danger" onclick="deleteMemory(${i})"><i class="fas fa-trash"></i></button>
                </div>
                <div class="memory-question"><i class="fas fa-question-circle"></i> ${m.question}</div>
                <div class="memory-answer">${m.answer}</div>
            </div>`;
        });
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = `<div class="empty-state text-danger">Gagal load: ${err.message}</div>`;
    }
}

async function deleteMemory(index) {
    if (!confirm('Hapus memori ini?')) return;
    try {
        const res = await adminFetch('/api/admin/memory/delete', {
            method: 'POST', body: JSON.stringify({ index })
        });
        const data = await res.json();
        if (data.success) { loadMemoryList(); loadAdminConfig(); }
        else alert(data.message);
    } catch (err) { alert(err.message); }
}

async function clearMemory() {
    if (!confirm('HAPUS SEMUA MEMORI AI?')) return;
    if (!confirm('Yakin?')) return;
    try {
        const res = await adminFetch('/api/admin/memory/clear', { method: 'POST' });
        const data = await res.json();
        if (data.success) { alert('✅ Semua memori dihapus'); loadMemoryList(); loadAdminConfig(); }
        else alert(data.message);
    } catch (err) { alert(err.message); }
}

async function reloadMemory() {
    try {
        const res = await adminFetch('/api/admin/memory/reload', { method: 'POST' });
        const data = await res.json();
        alert(`✅ Reload selesai. Total ${data.total} memori.`);
        loadMemoryList();
        loadAdminConfig();
    } catch (err) { alert(err.message); }
}

async function saveMemorySettings() {
    const updates = {
        memoryEnabled: document.getElementById('memoryEnabled').checked,
        memoryMinScore: parseInt(document.getElementById('memoryMinScore').value) || 75,
        memorySaveThreshold: parseInt(document.getElementById('memorySaveThreshold').value) || 55
    };
    try {
        const res = await adminFetch('/api/admin/config', {
            method: 'POST', body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (data.success) alert('✅ Pengaturan memori disimpan'); else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

async function saveConversationSettings() {
    const updates = {
        conversationHistoryEnabled: document.getElementById('convEnabled').checked,
        conversationHistorySize: parseInt(document.getElementById('convSize').value) || 20,
        rateLimitPerSession: parseInt(document.getElementById('rateLimitPerSession').value) || 20
    };
    try {
        const res = await adminFetch('/api/admin/config', {
            method: 'POST', body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (data.success) alert('✅ Pengaturan konteks disimpan'); else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

// ============================================================
// SESSIONS
// ============================================================
async function loadSessions() {
    const el = document.getElementById('sessionsList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await adminFetch('/api/admin/sessions');
        const data = await res.json();
        if (!data.sessions || data.sessions.length === 0) { el.innerHTML = '<div class="empty-state">Tidak ada sesi aktif.</div>'; return; }

        let html = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Mulai</th><th>Aktif Terakhir</th><th>Pesan</th><th>Pesan Terakhir</th></tr></thead><tbody>';
        data.sessions.forEach(s => {
            const c = new Date(s.createdAt).toLocaleString('id-ID');
            const l = new Date(s.lastActivity).toLocaleString('id-ID');
            html += `<tr><td>${c}</td><td>${l}</td><td>${s.messageCount}</td><td style="font-size:12px">${s.lastMessage || '-'}</td></tr>`;
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = `<div class="empty-state text-danger">Gagal: ${err.message}</div>`;
    }
}

async function clearSessions() {
    if (!confirm('Hapus semua sesi percakapan?')) return;
    try {
        const res = await adminFetch('/api/admin/sessions/clear', { method: 'POST' });
        const data = await res.json();
        if (data.success) { loadSessions(); loadAdminConfig(); }
        else alert(data.message);
    } catch (err) { alert(err.message); }
}

// ============================================================
// NOTIFICATIONS FULL PAGE
// ============================================================
async function loadNotifications() {
    const el = document.getElementById('notificationsList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await adminFetch('/api/admin/notifications');
        const data = await res.json();
        await loadNotificationsBadge();

        if (!data.items || data.items.length === 0) { el.innerHTML = '<div class="empty-state">Tidak ada notifikasi.</div>'; return; }

        let html = '';
        data.items.forEach(n => {
            const date = new Date(n.timestamp).toLocaleString('id-ID');
            const icon = n.level === 'danger' ? 'exclamation-triangle' : (n.level === 'warning' ? 'exclamation-circle' : 'info-circle');
            html += `<div class="notif-item notif-${n.level} ${n.read ? 'notif-read' : ''}">
                <div class="notif-head">
                    <span class="notif-icon"><i class="fas fa-${icon}"></i></span>
                    <span class="notif-title">${n.title}</span>
                    ${!n.read ? '<span class="badge badge-primary">BARU</span>' : ''}
                </div>
                <div class="notif-msg">${n.message}</div>
                <div class="notif-date">${date}</div>
            </div>`;
        });
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = `<div class="empty-state text-danger">Gagal: ${err.message}</div>`;
    }
}

async function markAllRead() {
    try {
        await adminFetch('/api/admin/notifications/read', { method: 'POST', body: JSON.stringify({}) });
        loadNotifications();
        loadNotificationsBadge();
        loadNotificationsDropdown();
    } catch (err) { alert(err.message); }
}

async function clearNotifications() {
    if (!confirm('Hapus semua notifikasi?')) return;
    try {
        await adminFetch('/api/admin/notifications/clear', { method: 'POST' });
        loadNotifications();
        loadNotificationsBadge();
        loadNotificationsDropdown();
    } catch (err) { alert(err.message); }
}

// ============================================================
// BACKUP
// ============================================================
async function runBackupNow() {
    const el = document.getElementById('backupsList');
    if (el) el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Membuat backup...</div>';
    try {
        const res = await adminFetch('/api/admin/backup', { method: 'POST' });
        const data = await res.json();
        if (data.success) { alert('✅ ' + data.message); if (el) loadBackups(); }
        else alert('❌ ' + data.message);
    } catch (err) { alert(err.message); }
}

async function loadBackups() {
    const el = document.getElementById('backupsList');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await adminFetch('/api/admin/backups');
        const data = await res.json();
        if (!data.items || data.items.length === 0) { el.innerHTML = '<div class="empty-state">Belum ada backup.</div>'; return; }

        let html = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Nama File</th><th>Tanggal</th><th>Ukuran</th></tr></thead><tbody>';
        data.items.forEach(b => {
            const d = new Date(b.created).toLocaleString('id-ID');
            const size = (b.size / 1024).toFixed(1) + ' KB';
            html += `<tr><td><code>${b.name}</code></td><td>${d}</td><td>${size}</td></tr>`;
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
    } catch (err) {
        el.innerHTML = `<div class="empty-state text-danger">Gagal: ${err.message}</div>`;
    }
}

// ============================================================
// SECURITY
// ============================================================
async function changePassword() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const status = document.getElementById('passwordStatus');

    if (!oldPassword || !newPassword) { status.innerHTML = '<span class="text-danger">Isi semua field</span>'; return; }
    if (newPassword.length < 8) { status.innerHTML = '<span class="text-danger">Password minimal 8 karakter</span>'; return; }

    try {
        const res = await adminFetch('/api/admin/change-password', {
            method: 'POST', body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json();
        if (data.success) {
            status.innerHTML = '<span class="text-success">✅ ' + data.message + '</span>';
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
        } else status.innerHTML = '<span class="text-danger">❌ ' + data.message + '</span>';
    } catch (err) { status.innerHTML = '<span class="text-danger">' + err.message + '</span>'; }
}

// ============================================================
// KNOWLEDGE GRAPH VISUALIZATION
// ============================================================
async function loadGraphVisualization() {
    const container = document.getElementById('graphContainer');
    const statsEl = document.getElementById('graphStats');
    if (!container) return;

    const limit = parseInt(document.getElementById('graphLimit')?.value) || 300;
    const minDegree = parseInt(document.getElementById('graphMinDegree')?.value) || 1;

    container.classList.add('loading');
    container.innerHTML = '';
    if (statsEl) statsEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Memuat graph...</div>';

    try {
        const res = await adminFetch(`/api/admin/graph/visualize?limit=${limit}&minDegree=${minDegree}`);
        const data = await res.json();
        container.classList.remove('loading');

        if (!data.nodes || data.nodes.length === 0) {
            container.innerHTML = '<div class="empty-state">Graph kosong. Upload pengetahuan dulu atau rebuild graph.</div>';
            if (statsEl) statsEl.innerHTML = '';
            return;
        }

        if (statsEl) {
            statsEl.innerHTML = `
                <div class="graph-stat-item"><i class="fas fa-circle" style="color:var(--primary)"></i> Node ditampilkan: <strong>${data.stats.shown}</strong></div>
                <div class="graph-stat-item"><i class="fas fa-link" style="color:var(--success)"></i> Edge: <strong>${data.edges.length}</strong></div>
                <div class="graph-stat-item"><i class="fas fa-database" style="color:var(--warning)"></i> Total node: <strong>${data.stats.totalNodes}</strong></div>
                <div class="graph-stat-item"><i class="fas fa-fire" style="color:var(--danger)"></i> Max degree: <strong>${data.stats.maxDegree}</strong></div>
            `;
        }

        graphNodesDataset = new vis.DataSet(data.nodes);
        graphEdgesDataset = new vis.DataSet(data.edges);

        const options = {
            nodes: { shape: 'dot', scaling: { min: 10, max: 40 }, font: { size: 12, face: 'Arial', color: '#202124' } },
            edges: { color: { color: 'rgba(100,100,100,0.4)', highlight: '#dc3545' }, smooth: { type: 'continuous', roundness: 0.5 }, selectionWidth: 2 },
            physics: { enabled: true, stabilization: { enabled: true, iterations: 200, updateInterval: 25 }, barnesHut: { gravitationalConstant: -8000, centralGravity: 0.3, springLength: 120, springConstant: 0.04, damping: 0.09 } },
            interaction: { hover: true, tooltipDelay: 150, navigationButtons: true, keyboard: true },
            layout: { improvedLayout: true }
        };

        if (graphNetwork) graphNetwork.destroy();
        graphNetwork = new vis.Network(container, { nodes: graphNodesDataset, edges: graphEdgesDataset }, options);

        graphNetwork.on('click', (params) => {
            if (params.nodes && params.nodes.length > 0) showGraphNodeDetail(params.nodes[0]);
        });

        const searchEl = document.getElementById('graphSearch');
        if (searchEl && !searchEl._bound) {
            searchEl._bound = true;
            searchEl.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase().trim();
                if (!q || !graphNodesDataset) return;
                const match = graphNodesDataset.get({
                    filter: n => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
                });
                if (match.length > 0) {
                    graphNetwork.selectNodes([match[0].id]);
                    graphNetwork.focus(match[0].id, { scale: 1.2, animation: true });
                }
            });
        }
    } catch (err) {
        container.classList.remove('loading');
        container.innerHTML = `<div class="empty-state text-danger">Gagal load graph: ${err.message}</div>`;
        if (statsEl) statsEl.innerHTML = '';
    }
}

async function showGraphNodeDetail(nodeId) {
    const detailEl = document.getElementById('graphNodeDetail');
    const nameEl = document.getElementById('graphNodeName');
    const bodyEl = document.getElementById('graphNodeBody');
    if (!detailEl || !bodyEl) return;

    detailEl.style.display = 'block';
    nameEl.textContent = nodeId;
    bodyEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Memuat detail...</div>';

    try {
        const res = await adminFetch(`/api/admin/graph/node/${encodeURIComponent(nodeId)}`);
        const data = await res.json();

        if (!data.found) { bodyEl.innerHTML = '<div class="empty-state">Node tidak ditemukan.</div>'; return; }

        const n = data.node;
        let html = `<div class="graph-node-meta">
            <div class="graph-node-meta-item"><i class="fas fa-project-diagram"></i> Degree: <strong>${n.degree}</strong></div>
            <div class="graph-node-meta-item"><i class="fas fa-file-alt"></i> Sumber: <strong>${n.sources.length}</strong></div>
            <div class="graph-node-meta-item"><i class="fas fa-clock"></i> Dibuat: <strong>${new Date(n.createdAt).toLocaleDateString('id-ID')}</strong></div>
        </div>`;

        if (n.sources && n.sources.length > 0) {
            html += `<div style="margin-bottom:12px;"><b>File sumber:</b><br><small>${n.sources.map(s => `• ${s}`).join('<br>')}</small></div>`;
        }

        html += `<div style="margin-bottom:8px;"><b>Tetangga (${data.neighbors.length}):</b></div>`;

        if (data.neighbors.length === 0) html += '<div class="empty-state">Tidak ada tetangga.</div>';
        else {
            html += '<div class="graph-neighbors-list">';
            data.neighbors.forEach(nb => {
                html += `<span class="graph-neighbor-chip" onclick="showGraphNodeDetail('${nb.id.replace(/'/g, "\\'")}')">${nb.label} <span class="weight-badge">${nb.weight}</span></span>`;
            });
            html += '</div>';
        }

        bodyEl.innerHTML = html;
    } catch (err) {
        bodyEl.innerHTML = `<div class="empty-state text-danger">Gagal load detail: ${err.message}</div>`;
    }
}

function closeGraphNodeDetail() {
    const el = document.getElementById('graphNodeDetail');
    if (el) el.style.display = 'none';
}

// ============================================================
// GRAPH ENRICH
// ============================================================
async function startEnrich() {
    const btn = document.getElementById('enrichBtn');
    const statusEl = document.getElementById('enrichStatus');
    const maxChunks = parseInt(document.getElementById('enrichMaxChunks')?.value) || 30;

    if (!confirm(`Mulai enrich ${maxChunks} chunk? Ini akan memakai token API provider Anda.`)) return;

    if (btn) btn.disabled = true;
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memulai enrich...';

    try {
        const res = await adminFetch('/api/admin/graph/enrich', {
            method: 'POST',
            body: JSON.stringify({ maxChunks, concurrency: 2 })
        });
        const data = await res.json();

        if (!data.success) {
            if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${data.message}</span>`;
            if (btn) btn.disabled = false;
            return;
        }

        if (enrichPollTimer) clearInterval(enrichPollTimer);
        enrichPollTimer = setInterval(pollEnrichStatus, 2000);
        pollEnrichStatus();
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`;
        if (btn) btn.disabled = false;
    }
}

async function pollEnrichStatus() {
    const statusEl = document.getElementById('enrichStatus');
    const btn = document.getElementById('enrichBtn');

    try {
        const res = await adminFetch('/api/admin/graph/enrich/status');
        const data = await res.json();

        if (!data.inProgress) {
            if (enrichPollTimer) { clearInterval(enrichPollTimer); enrichPollTimer = null; }
            if (statusEl) statusEl.innerHTML = `<span style="color:var(--success)">✅ Enrich selesai! Klik "Refresh" di atas untuk lihat hasil.</span>`;
            if (btn) btn.disabled = false;
            return;
        }

        const { done, total } = data.progress;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        if (statusEl) {
            statusEl.innerHTML = `<div><i class="fas fa-spinner fa-spin"></i> Memproses... ${done}/${total} chunk (${pct}%)</div><div class="enrich-progress-bar"><div class="enrich-progress-fill" style="width:${pct}%"></div></div>`;
        }
    } catch (err) {}
}

// ============================================================
// KEYBOARD SHORTCUT
// ============================================================
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.getElementById('answerModal')?.classList.remove('show');
    }
});