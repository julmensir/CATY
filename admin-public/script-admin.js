// ============================================================
// SIVT AI — Admin Dashboard Script (TABLER FINAL)
// 100% kompatibel dengan Tabler Icons
// ============================================================

let currentUser = null;
let adminToken = null;
let currentPage = 'dashboard';
let currentTheme = null;
let currentInboxTab = 'all';
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

  const loginPage = document.getElementById('loginPage');
  const adminPage = document.getElementById('adminPage');
  if (loginPage) loginPage.style.display = 'flex';
  if (adminPage) adminPage.style.display = 'none';

  // Sidebar nav binding
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) showPage(page);
      if (window.innerWidth < 992) {
        const menu = document.getElementById('sidebar-menu');
        if (menu && menu.classList.contains('show')) {
          const bsCollapse = bootstrap.Collapse.getInstance(menu);
          if (bsCollapse) bsCollapse.hide();
        }
      }
    });
  });

  // Notif dropdown auto-close
  document.addEventListener('click', (e) => {
    const wrapper = e.target.closest('.dropdown');
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
      if (!wrapper || !wrapper.contains(menu)) {
        const inst = bootstrap.Dropdown.getInstance(menu.previousElementSibling);
        if (inst) inst.hide();
      }
    });
  });

  // Keyboard Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(m => {
        const inst = bootstrap.Modal.getInstance(m);
        if (inst) inst.hide();
      });
    }
  });

  startLiveClock();
  initFixedNavbar();
  await loadPublicConfigAdmin();
  await checkAdminSession();
});

// ============================================================
// LIVE CLOCK
// ============================================================
function startLiveClock() {
  const clockEl = document.getElementById('liveClock');
  const dateEl = document.getElementById('liveDate');
  if (!clockEl || !dateEl) return;
  function update() {
    const now = new Date();

    // ✅ Jam format rapi: 19.01.25
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hh}.${mm}.${ss}`;

    // ✅ Tanggal pendek cantik: "Sen, 11 Okt 2026"
    const day = String(now.getDate()).padStart(2, '0');
    const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
    dateEl.textContent = `${dayNames[now.getDay()]}, ${day} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }
  update();
  setInterval(update, 1000);
}

// ============================================================
// DARK MODE
// ============================================================
async function toggleDarkMode() {
  const html = document.documentElement;
  const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-bs-theme', next);
  localStorage.setItem('sivt-theme', next);
  const icon = document.getElementById('darkModeIcon');
  if (icon) {
    icon.className = next === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
  }
  // ✅ FIX: Dark mode admin hanya di localStorage.
  // Jangan POST ke server supaya tidak ganggu warga.
}
(function() {
  const saved = localStorage.getItem('sivt-theme') || 'light';
  document.documentElement.setAttribute('data-bs-theme', saved);
  document.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('darkModeIcon');
    if (icon && saved === 'dark') {
      icon.className = 'ti ti-sun';
    }
  });
})();

function refreshCurrentPage() {
  loadCurrentPage();
  showToast('Halaman di-refresh', 'info');
}

// ============================================================
// LOAD PUBLIC CONFIG
// ============================================================
async function loadPublicConfigAdmin() {
  try {
    const res = await fetch('/api/config/public');
    const cfg = await res.json();

    // ✅ AUTO-UPDATE JUDUL TAB BROWSER
    document.title = `${cfg.aiName || 'SIVT AI'} - Admin Dashboard`;

    const loginTitle = document.getElementById('loginTitle');
    if (loginTitle) loginTitle.textContent = cfg.aiName || 'SIVT AI';
    const sidebarAiName = document.getElementById('sidebarAiName');
    if (sidebarAiName) sidebarAiName.textContent = cfg.aiName || 'SIVT AI';

    const logoHtml = cfg.logoUrl
      ? `<img src="${cfg.logoUrl}" alt="logo" style="width:100%;height:100%;object-fit:contain;">`
      : 'S';
    const loginLogo = document.getElementById('loginLogo');
    if (loginLogo) loginLogo.innerHTML = logoHtml;
    const sidebarLogo = document.getElementById('sidebarLogo');
    if (sidebarLogo) sidebarLogo.innerHTML = logoHtml;

    // ✅ FIX: Tema admin TIDAK di-apply di sini.
    // Tema admin di-load terpisah via loadAdminTheme().
    // Endpoint publik hanya untuk logo, nama, tagline, dll.

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
    console.warn('[CONFIG] Error:', err.message);
  }
}

// ============================================================
// LOAD ADMIN THEME — Selalu ambil tema dari endpoint admin
// ============================================================
async function loadAdminTheme() {
  if (!adminToken) return;  // Belum login, skip
  try {
    const res = await adminFetch('/api/admin/theme');
    if (!res.ok) return;
    const data = await res.json();
    if (data.theme) {
      currentTheme = {
        ...data.theme,
        applyToWarga: data.themeApplyToWarga === true
      };
      applyTheme(data.theme);
    }
  } catch (err) {
    console.warn('[ADMIN-THEME] Gagal load:', err.message);
  }
}

// ============================================================
// THEME
// ============================================================
function applyTheme(theme) {
  if (!theme) return;
  // ❌ JANGAN timpa currentTheme di sini — biar applyToWarga tetap tersimpan
  // currentTheme = theme;  ← HAPUS BARIS INI

  const root = document.documentElement;
  if (theme.primary) {
    root.style.setProperty('--tblr-primary', theme.primary);
    root.style.setProperty('--tblr-blue', theme.primary);
    root.style.setProperty('--tblr-btn-primary-bg', theme.primary);
  }
  if (theme.primaryDark) {
    root.style.setProperty('--tblr-primary-darken', theme.primaryDark);
  }
  if (theme.accent) {
    root.style.setProperty('--tblr-pink', theme.accent);
  }
  if (theme.sidebarStart && theme.sidebarEnd) {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) {
      sidebar.style.background = `linear-gradient(180deg, ${theme.sidebarStart} 0%, ${theme.primary || theme.sidebarEnd} 50%, ${theme.sidebarEnd} 100%)`;
    }
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
  default: { primary: '#0d47a1', primaryDark: '#0a3a8a', accent: '#ec4899' },
  dark:    { primary: '#1f2937', primaryDark: '#111827', accent: '#6366f1' },
  green:   { primary: '#059669', primaryDark: '#047857', accent: '#f59e0b' },
  purple:  { primary: '#7c3aed', primaryDark: '#6d28d9', accent: '#ec4899' },
  red:     { primary: '#dc2626', primaryDark: '#b91c1c', accent: '#f59e0b' },
  teal:    { primary: '#0d9488', primaryDark: '#0f766e', accent: '#f97316' },
  orange:  { primary: '#ea580c', primaryDark: '#c2410c', accent: '#0891b2' }
};
function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  document.getElementById('theme-primary').value = p.primary;
  document.getElementById('theme-primaryDark').value = p.primaryDark;
  document.getElementById('theme-accent').value = p.accent;
  previewTheme();
}
async function saveTheme() {
  const applyToWarga = document.getElementById('themeApplyToWarga')?.checked || false;
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
      method: 'POST',
      body: JSON.stringify({
        theme: theme,
        themeApplyToWarga: applyToWarga
      })
    });
    const data = await res.json();
    if (data.success) {
      currentTheme = { ...theme, applyToWarga };
      applyTheme(theme);   // ✅ Apply langsung ke admin
      const msg = applyToWarga
        ? 'Tema disimpan & diterapkan ke Admin + Warga'
        : 'Tema disimpan (hanya Admin)';
      showToast(msg, 'success');
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}
function resetTheme() {
  showConfirmAsync('Reset tema ke default?').then(ok => {
    if (ok) {
      applyPreset('default');
      showToast('Tema direset', 'info');
    }
  });
}
function applyLogoSizeAdmin(size) {
  const s = LOGO_SIZES[size] || LOGO_SIZES.medium;
  const loginLogo = document.getElementById('loginLogo');
  const sidebarLogo = document.getElementById('sidebarLogo');
  if (loginLogo) { loginLogo.style.width = s.login + 'px'; loginLogo.style.height = s.login + 'px'; }
  if (sidebarLogo) { sidebarLogo.style.width = s.sidebar + 'px'; sidebarLogo.style.height = s.sidebar + 'px'; }
}

// ============================================================
// ROLE CHECKBOXES
// ============================================================
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
// ROBUST DASHBOARD LOADER — Retry sampai dashboard.js siap
// ============================================================
function tryLoadDashboard(retries = 10) {
  if (window.loadDashboardNew && window.startDashboardAutoRefresh) {
    window.loadDashboardNew(window._currentDashPeriod || '1d');
    window.startDashboardAutoRefresh();
    console.log('[DASHBOARD] Auto-load berhasil ✓');
    return;
  }
  if (retries > 0) {
    setTimeout(() => tryLoadDashboard(retries - 1), 100);
  } else {
    console.warn('[DASHBOARD] Gagal load: dashboard.js tidak termuat');
  }
}
window.tryLoadDashboard = tryLoadDashboard;

// ============================================================
// AUTH
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
      const usernameEl = document.getElementById('adminUsername');
      if (usernameEl) usernameEl.textContent = data.username;
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('adminPage').style.display = 'block';
      await loadAdminConfig();
      await loadAdminTheme();
      showPage('dashboard');
      loadNotificationsBadge();
      setInterval(loadNotificationsBadge, 30000);
      tryLoadDashboard();   // ✅ Robust auto-load
    }
  } catch (err) { console.warn('[AUTH]', err.message); }
}

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
      await loadAdminTheme();
      showPage('dashboard');
      loadNotificationsBadge();
      showToast(`Selamat datang, ${username}!`, 'success');
      setInterval(loadNotificationsBadge, 30000);
      tryLoadDashboard();   // ✅ Robust auto-load
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
  const ok = await showConfirmAsync('Yakin ingin logout dari dashboard admin?');
  if (!ok) return;
  try { await adminFetch('/api/admin/logout', { method: 'POST' }); } catch (_) {}
  currentUser = null; adminToken = null;
  document.getElementById('adminPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  showToast('Berhasil logout', 'info');
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
// NAVIGATION
// ============================================================
function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  document.querySelectorAll('.page-section').forEach(p => {
    p.style.display = p.id === 'page-' + page ? 'block' : 'none';
  });
  const titles = {
    dashboard: 'Dashboard', general: 'Umum', logo: 'Logo & Branding',
    theme: 'Warna Tema', providers: 'Provider AI', prompt: 'Prompt AI',
    knowledge: 'Pengetahuan', graph: 'Knowledge Graph', inbox: 'Pertanyaan Warga',
    feedback: 'Feedback & Akurasi', memory: 'Memori AI', sessions: 'Percakapan',
    notifications: 'Notifikasi', backup: 'Backup', security: 'Keamanan',
    report: 'Laporan'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[page] || page;
  loadCurrentPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// LOAD CURRENT PAGE — Router otomatis pemanggil loader
// ============================================================
function loadCurrentPage() {
  const loaders = {
    dashboard:     () => { if (window.loadDashboardNew) window.loadDashboardNew(window._currentDashPeriod || '1d'); },
    general:       () => loadAdminConfig(),
    logo:          () => loadAdminConfig(),
    theme:         () => loadThemeToForm(),
    prompt:        () => loadAdminConfig(),
    providers:     () => loadAdminConfig(),
    knowledge:     () => loadAdminConfig(),
    graph:         () => loadGraphVisualization(),
    inbox:         () => loadPertanyaanWarga(),
    feedback:      () => loadFeedback(),
    report:        () => { if (window.loadReport) window.loadReport(); },
    memory:        () => { loadAdminConfig(); if (window.loadMemoryList) window.loadMemoryList(); },
    sessions:      () => loadSessions(),
    notifications: () => loadNotifications(),
    backup:        () => {
      loadBackups();
      // ✅ Reset file input saat masuk halaman backup
      const restoreFile = document.getElementById('restoreFile');
      if (restoreFile) restoreFile.value = '';
    },
    security:      () => {}
  };
  const fn = loaders[currentPage];
  if (fn) {
    try { fn(); } catch (err) { console.warn(`[PAGE] Loader ${currentPage} gagal:`, err.message); }
  }
}
window.loadCurrentPage = loadCurrentPage;



function loadThemeToForm() {
  if (!currentTheme) return;
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setV('theme-primary', currentTheme.primary || '#0d47a1');
  setV('theme-primaryDark', currentTheme.primaryDark || '#0a3a8a');
  setV('theme-accent', currentTheme.accent || '#ec4899');
  setV('theme-sidebarStart', currentTheme.sidebarStart || '#0a3a8a');
  setV('theme-sidebarEnd', currentTheme.sidebarEnd || '#0d47a1');

  // Load toggle "Update ke Warga"
  const toggleEl = document.getElementById('themeApplyToWarga');
  if (toggleEl) toggleEl.checked = currentTheme.applyToWarga === true;

  previewTheme();
}


// ============================================================
// NOTIFIKASI
// ============================================================
async function loadNotificationsBadge() {
  try {
    const res = await adminFetch('/api/admin/notifications');
    const data = await res.json();
    const badge = document.getElementById('notifBadge');
    if (data.unread > 0) {
      badge.textContent = data.unread > 99 ? '99+' : data.unread;
      badge.style.display = 'inline-flex';
    } else badge.style.display = 'none';
    renderNotifDropdown(data.items || []);
  } catch (err) {}
}

function renderNotifDropdown(items) {
  const body = document.getElementById('notifBody');
  if (!body) return;
  if (!items || items.length === 0) {
    body.innerHTML = '<div class="text-center text-secondary py-4">Belum ada notifikasi</div>';
    return;
  }
  body.innerHTML = items.slice(0, 10).map(n => `
    <div class="list-group-item">
      <div class="row align-items-center">
        <div class="col-auto">
          <span class="status-dot ${n.level === 'danger' ? 'bg-red' : n.level === 'warning' ? 'bg-yellow' : 'bg-blue'}"></span>
        </div>
        <div class="col text-truncate">
          <div class="fw-bold small">${n.title}</div>
          <div class="text-secondary small text-truncate">${n.message}</div>
          <div class="text-secondary small">${timeAgo(n.timestamp)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function timeAgo(t) {
  const diff = Date.now() - new Date(t).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Baru saja';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  return `${Math.floor(hr / 24)} hari lalu`;
}

async function loadNotifications() {
  const el = document.getElementById('notificationsList');
  if (!el) return;
  el.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2"></i> Memuat...</div>';
  try {
    const res = await adminFetch('/api/admin/notifications');
    const data = await res.json();
    await loadNotificationsBadge();
    if (!data.items || data.items.length === 0) {
      el.innerHTML = '<div class="text-center text-secondary py-4">Tidak ada notifikasi.</div>';
      return;
    }
    el.innerHTML = data.items.map(n => {
      const icon = n.level === 'danger' ? 'ti-alert-triangle' : n.level === 'warning' ? 'ti-alert-circle' : 'ti-info-circle';
      return `
        <div class="alert alert-${n.level === 'danger' ? 'danger' : n.level === 'warning' ? 'warning' : 'info'} ${n.read ? 'opacity-50' : ''}">
          <div class="d-flex">
            <div><i class="ti ${icon} me-2"></i></div>
            <div class="flex-fill">
              <div class="fw-bold">${n.title}</div>
              <div>${n.message}</div>
              <div class="text-secondary small mt-1">${new Date(n.timestamp).toLocaleString('id-ID')}</div>
            </div>
            ${!n.read ? '<span class="badge bg-primary">BARU</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    el.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
  }
}

async function markAllRead() {
  try {
    await adminFetch('/api/admin/notifications/read', { method: 'POST', body: JSON.stringify({}) });
    showToast('Semua notifikasi ditandai sudah dibaca', 'success');
    loadNotifications();
    loadNotificationsBadge();
  } catch (err) { showToast(err.message, 'error'); }
}

async function clearNotifications() {
  const ok = await showConfirmAsync('Hapus semua notifikasi?');
  if (!ok) return;
  try {
    await adminFetch('/api/admin/notifications/clear', { method: 'POST' });
    showToast('Semua notifikasi dihapus', 'success');
    loadNotifications();
    loadNotificationsBadge();
  } catch (err) { showToast(err.message, 'error'); }
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
    setVal('cfg-surveyLink', cfg.surveyLink || '');
    setVal('cfg-surveyIdleMinutes', cfg.surveyIdleMinutes || 3);
    const cb = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
    cb('memoryEnabled', cfg.memoryEnabled !== false);
    cb('convEnabled', cfg.conversationHistoryEnabled !== false);
    cb('surveyEnabled', cfg.surveyEnabled !== false);
    setVal('memoryMinScore', cfg.memoryMinScore || 75);
    setVal('memorySaveThreshold', cfg.memorySaveThreshold || 55);
    setVal('convSize', cfg.conversationHistorySize || 20);
    setVal('rateLimitPerSession', cfg.rateLimitPerSession || 20);
    updateLogoPreview(cfg.logoUrl);

    const setBadge = (id, v) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = v; el.style.display = v > 0 ? 'inline-flex' : 'none'; }
    };
    setBadge('badgeProviders', (cfg.providers || []).length);
    setBadge('badgeKnowledge', cfg.knowledgeChunks || 0);
    setBadge('badgeMemory', cfg.memoryCount || 0);
    setBadge('badgeSessions', cfg.sessionCount || 0);
    setBadge('badgeInbox', (cfg.pendingUnanswered || 0) + (cfg.pendingLearning || 0));
    if (cfg.graph) setBadge('badgeGraph', cfg.graph.nodes || 0);

    renderProviders(cfg.providers || []);
    renderKnowledgeFiles(cfg.knowledgeFiles || [], cfg.knowledgeChunks || 0);
  } catch (err) {
    console.error('Gagal load admin config:', err);
  }
}

// ============================================================
// PROVIDERS
// ============================================================
function renderProviders(providers) {
  const el = document.getElementById('providersList');
  if (!el) return;
  if (providers.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada provider. Tambahkan API key di atas.</div>';
    return;
  }
  let html = '<div class="table-responsive"><table class="table table-vcenter card-table"><thead><tr>';
  html += '<th>#</th><th>Provider</th><th>Role</th><th>Model</th><th>Status</th><th class="w-1">Aksi</th>';
  html += '</tr></thead><tbody>';
  providers.forEach(p => {
    const statusBadge = p.enabled
      ? '<span class="badge bg-green text-white">Aktif</span>'
      : '<span class="badge bg-secondary text-white">Off</span>';
    const customTag = p.isCustom ? ' <span class="badge bg-warning text-white">CUSTOM</span>' : '';
    const roleBadges = VALID_ROLES.map(role => {
      const active = (p.roles || ['chat']).includes(role);
      return `<span class="badge ${active ? 'bg-blue' : 'bg-secondary'} text-white me-1" style="cursor:pointer;" onclick="toggleRole(${p.index}, '${role}')">${role}</span>`;
    }).join('');
    const embModels = (p.embeddingModels || []).length > 0
      ? `<div class="text-secondary small mt-1"><i class="ti ti-ruler-measure"></i> ${(p.embeddingModels || []).join(', ')}</div>`
      : '';
    html += `<tr>
      <td>${p.index + 1}</td>
      <td><strong>${p.displayName}</strong>${customTag}</td>
      <td><div style="max-width:280px;">${roleBadges}</div></td>
      <td>
        <code>${(p.models || []).slice(0, 2).join(', ')}</code>
        ${embModels}
      </td>
      <td>${statusBadge}</td>
      <td>
        <div class="btn-list flex-nowrap">
          <button class="btn btn-sm btn-icon btn-ghost-info" onclick="testProvider(${p.index}, 'chat')" title="Test Chat">
            <i class="ti ti-flask"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-ghost-info" onclick="testProvider(${p.index}, 'embedding')" title="Test Embedding">
            <i class="ti ti-ruler-measure"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-ghost-primary" onclick="editProviderModels(${p.index}, '${(p.models || []).join(',')}', '${(p.embeddingModels || []).join(',')}')" title="Edit Model">
            <i class="ti ti-edit"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-ghost-warning" onclick="editProviderKey(${p.index})" title="Edit API Key">
            <i class="ti ti-key"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-ghost-secondary" onclick="toggleProvider(${p.index})" title="On/Off">
            <i class="ti ti-power"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-ghost-danger" onclick="removeProvider(${p.index})" title="Hapus">
            <i class="ti ti-trash"></i>
          </button>
        </div>
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
    const roles = new Set(provider.roles || ['chat']);
    if (roles.has(role)) {
      if (roles.size > 1) roles.delete(role);
      else { showToast('Minimal 1 role harus aktif', 'warning'); return; }
    } else roles.add(role);
    const res = await adminFetch('/api/admin/providers/update-roles', {
      method: 'POST', body: JSON.stringify({ index, roles: [...roles] })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminConfig();
      showToast(`Role ${role} diperbarui`, 'success');
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function addProvider() {
  const isCustom = document.querySelector('#providerCustom.active');
  let payload;
  if (isCustom) {
    const name = document.getElementById('customProviderName').value.trim();
    const displayName = document.getElementById('customProviderDisplay').value.trim();
    const endpoint = document.getElementById('customProviderEndpoint').value.trim();
    const apiKey = document.getElementById('customProviderKey').value.trim();
    const modelsRaw = document.getElementById('customProviderModels').value.trim();
    const embModelsRaw = document.getElementById('customProviderEmbeddingModels').value.trim();
    const roles = getSelectedRoles('customProviderRoles');
    if (!name) return showToast('Nama provider wajib diisi', 'warning');
    if (!endpoint) return showToast('Endpoint wajib diisi', 'warning');
    if (!apiKey) return showToast('API Key wajib diisi', 'warning');
    const models = modelsRaw ? modelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const embeddingModels = embModelsRaw ? embModelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    payload = { name, apiKey, models, embeddingModels, customEndpoint: endpoint, displayName, roles };
  } else {
    const name = document.getElementById('newProviderName').value;
    const apiKey = document.getElementById('newProviderKey').value.trim();
    const modelsRaw = document.getElementById('newProviderModels').value.trim();
    const embModelsRaw = document.getElementById('newProviderEmbeddingModels').value.trim();
    const roles = getSelectedRoles('newProviderRoles');
    if (!apiKey) return showToast('API key harus diisi', 'warning');
    const models = modelsRaw ? modelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const embeddingModels = embModelsRaw ? embModelsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    payload = { name, apiKey, models, embeddingModels, roles };
  }
  const status = document.getElementById('addProviderStatus');
  status.innerHTML = '<i class="ti ti-loader-2 ti-spin"></i> Menambahkan...';
  try {
    const res = await adminFetch('/api/admin/providers/add', {
      method: 'POST', body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      status.innerHTML = `<span class="text-success">Ditambahkan. Total: ${data.total}</span>`;
      ['newProviderKey','newProviderModels','newProviderEmbeddingModels',
       'customProviderName','customProviderDisplay','customProviderEndpoint',
       'customProviderKey','customProviderModels','customProviderEmbeddingModels']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      loadAdminConfig();
      showToast('Provider berhasil ditambahkan', 'success');
    } else {
      status.innerHTML = `<span class="text-danger">${data.message}</span>`;
      showToast(data.message, 'error');
    }
  } catch (err) {
    status.innerHTML = `<span class="text-danger">${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

async function editProviderKey(index) {
  showPrompt('Masukkan API key baru untuk provider ini:', '', async (val) => {
    if (val.length < 5) return showToast('API key tidak valid', 'error');
    try {
      const res = await adminFetch('/api/admin/providers/update-key', {
        method: 'POST', body: JSON.stringify({ index, apiKey: val.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('API key diperbarui', 'success');
        loadAdminConfig();
      } else showToast(data.message, 'error');
    } catch (err) { showToast(err.message, 'error'); }
  }, 'Edit API Key');
}

async function editProviderModels(index, currentModels, currentEmbModels) {
  showPrompt('Edit model CHAT (pisah koma):', currentModels, async (modelsStr) => {
    const models = modelsStr.split(',').map(s => s.trim()).filter(Boolean);
    showPrompt('Edit model EMBEDDING (pisah koma, kosongkan skip):', currentEmbModels || '', async (embStr) => {
      const embeddingModels = embStr ? embStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (models.length === 0 && embeddingModels.length === 0) {
        return showToast('Minimal 1 model', 'warning');
      }
      try {
        const res = await adminFetch('/api/admin/providers/update-models', {
          method: 'POST', body: JSON.stringify({ index, models, embeddingModels })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Model diperbarui', 'success');
          loadAdminConfig();
        } else showToast(data.message, 'error');
      } catch (err) { showToast(err.message, 'error'); }
    }, 'Edit Model Embedding');
  }, 'Edit Model Chat');
}

async function removeProvider(index) {
  const ok = await showConfirmAsync('Hapus provider ini?');
  if (!ok) return;
  try {
    const res = await adminFetch('/api/admin/providers/remove', {
      method: 'POST', body: JSON.stringify({ index })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Provider dihapus', 'success');
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleProvider(index) {
  try {
    const res = await adminFetch('/api/admin/providers/toggle', {
      method: 'POST', body: JSON.stringify({ index })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminConfig();
      loadNotificationsBadge();
      showToast('Status provider diperbarui', 'success');
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function testProvider(index, type = 'chat') {
  showToast(`Menguji provider (${type})...`, 'info');
  try {
    const res = await adminFetch('/api/admin/providers/test', {
      method: 'POST', body: JSON.stringify({ index, type })
    });
    const data = await res.json();
    if (data.success) {
      showAlert(data.message, 'Test Berhasil', 'success');
    } else {
      showAlert(data.message, 'Test Gagal', 'error');
    }
  } catch (err) { showAlert(err.message, 'Error', 'error'); }
}

// ============================================================
// PERTANYAAN WARGA
// ============================================================
function switchInboxTab(tab) {
  currentInboxTab = tab;
  document.querySelectorAll('#page-inbox .nav-link[data-inbox-tab]').forEach(t => {
    t.classList.toggle('active', t.dataset.inboxTab === tab);
  });
  loadPertanyaanWarga();
}

async function loadPertanyaanWarga() {
  const el = document.getElementById('inboxList');
  if (!el) return;
  el.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i> Memuat...</div>';

  if (currentInboxTab === 'all') {
    try {
      const res = await adminFetch('/api/admin/unanswered?filter=all');
      const data = await res.json();
      const badge = document.getElementById('badgeInbox');
      if (badge) {
        badge.textContent = data.pending || 0;
        badge.style.display = (data.pending || 0) > 0 ? 'inline-flex' : 'none';
      }
      const countAll = document.getElementById('inboxTabAllCount');
      if (countAll) countAll.textContent = data.total || 0;

      if (!data.items || data.items.length === 0) {
        el.innerHTML = '<div class="text-center py-4"><i class="ti ti-circle-check text-green" style="font-size:48px;"></i><p class="text-secondary mt-2">Tidak ada pertanyaan warga.</p></div>';
        return;
      }
      el.innerHTML = data.items.map(u => {
        const isResolved = u.resolved;
        const countBadge = u.count > 1 ? `<span class="badge bg-yellow text-white ms-2">Ditanya ${u.count}x</span>` : '';
        const safeQuestion = u.question.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
          <div class="card mb-2 ${isResolved ? 'opacity-75' : ''}">
            <div class="card-body">
              <div class="d-flex align-items-start gap-3">
                <div class="avatar avatar-sm ${isResolved ? 'bg-green' : 'bg-yellow'} text-white">
                  <i class="ti ${isResolved ? 'ti-check' : 'ti-help-circle'}"></i>
                </div>
                <div class="flex-fill">
                  <div class="fw-bold">${u.question}</div>
                  <div class="text-secondary small mt-1">
                    <i class="ti ti-clock"></i> ${new Date(u.lastAsked).toLocaleString('id-ID')}
                    ${countBadge}
                    ${isResolved ? '<span class="badge bg-green text-white ms-2">Selesai</span>' : '<span class="badge bg-red text-white ms-2">Belum</span>'}
                  </div>
                  <div class="mt-2 d-flex gap-2 flex-wrap">
                    ${!isResolved ? `
                      <button class="btn btn-sm btn-primary" onclick="openAnswerModal('${u.id}', '${safeQuestion}', 'unanswered')">
                        <i class="ti ti-plus"></i> Tambah Jawaban
                      </button>
                      <button class="btn btn-sm btn-outline-secondary" onclick="markUnansweredResolved('${u.id}')">
                        <i class="ti ti-check"></i> Tandai Selesai
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUnanswered('${u.id}')">
                      <i class="ti ti-trash"></i> Hapus
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      el.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
    }
  } else {
    try {
      const res = await adminFetch('/api/admin/learning/queue?filter=pending');
      const data = await res.json();
      const stats = data.stats || {};
      const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      setText('inboxTabPriorityCount', stats.pending || 0);

      if (!data.items || data.items.length === 0) {
        el.innerHTML = '<div class="text-center py-4"><i class="ti ti-circle-check text-green" style="font-size:48px;"></i><p class="text-secondary mt-2">Tidak ada antrian prioritas.</p></div>';
        return;
      }
      el.innerHTML = data.items.map(item => {
        const priorityColors = { urgent: 'red', high: 'yellow', medium: 'blue', normal: 'secondary' };
        const color = priorityColors[item.priority] || 'secondary';
        const safeQuestion = (item.original || item.question).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const variants = (item.variants || []).slice(0, 3).map(v =>
          `<div class="text-secondary small"><i class="ti ti-quote"></i> ${v}</div>`
        ).join('');
        return `
          <div class="card mb-2 ${item.resolved ? 'opacity-75' : ''}">
            <div class="card-body">
              <div class="d-flex justify-content-between mb-2">
                <span class="badge bg-${color} text-white">${(item.priority || 'normal').toUpperCase()}</span>
                <span class="text-secondary small"><i class="ti ti-flame"></i> ${item.count}x</span>
              </div>
              <div class="fw-bold mb-2"><i class="ti ti-help-circle me-1"></i> ${item.question}</div>
              ${variants ? `<div class="mb-2">${variants}</div>` : ''}
              <div class="text-secondary small mb-2">
                Pertama: ${new Date(item.firstAsked).toLocaleDateString('id-ID')} •
                Terakhir: ${new Date(item.lastAsked).toLocaleDateString('id-ID')}
              </div>
              <div class="d-flex gap-2 flex-wrap">
                ${!item.resolved ? `
                  <button class="btn btn-sm btn-primary" onclick="openAnswerModal('${item.id}', '${safeQuestion}', 'learning')">
                    <i class="ti ti-plus"></i> Tambah ke Pengetahuan
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" onclick="resolveLearning('${item.id}')">
                    <i class="ti ti-check"></i> Tandai Selesai
                  </button>
                ` : '<span class="badge bg-green text-white">Selesai</span>'}
                <button class="btn btn-sm btn-outline-danger" onclick="deleteLearning('${item.id}')">
                  <i class="ti ti-trash"></i> Hapus
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      el.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
    }
  }
}

async function markUnansweredResolved(id) {
  try {
    const res = await adminFetch('/api/admin/unanswered/resolve', {
      method: 'POST', body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Ditandai sudah dijawab', 'success');
      loadPertanyaanWarga();
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteUnanswered(id) {
  const ok = await showConfirmAsync('Hapus pertanyaan ini?');
  if (!ok) return;
  try {
    const res = await adminFetch('/api/admin/unanswered/delete', {
      method: 'POST', body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Pertanyaan dihapus', 'success');
      loadPertanyaanWarga();
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function resolveLearning(id) {
  try {
    const res = await adminFetch('/api/admin/learning/resolve', {
      method: 'POST', body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Ditandai selesai', 'success');
      loadPertanyaanWarga();
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteLearning(id) {
  const ok = await showConfirmAsync('Hapus dari antrian prioritas?');
  if (!ok) return;
  try {
    const res = await adminFetch('/api/admin/learning/delete', {
      method: 'POST', body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Dihapus dari antrian', 'success');
      loadPertanyaanWarga();
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function clearInboxResolved() {
  const ok = await showConfirmAsync('Hapus semua pertanyaan yang sudah diselesaikan?');
  if (!ok) return;
  try {
    if (currentInboxTab === 'all') {
      await adminFetch('/api/admin/unanswered/clear', {
        method: 'POST', body: JSON.stringify({ onlyResolved: true })
      });
    } else {
      await adminFetch('/api/admin/learning/clear-resolved', { method: 'POST' });
    }
    showToast('Pertanyaan resolved dibersihkan', 'success');
    loadPertanyaanWarga();
    loadAdminConfig();
  } catch (err) { showToast(err.message, 'error'); }
}

async function clearInboxAll() {
  const tabLabel = currentInboxTab === 'all' ? 'Semua Pertanyaan Warga' : 'Antrian Prioritas';
  const confirmed = await showConfirmAsync(
    `HAPUS SEMUA ${tabLabel}?\n\nSemua data akan hilang PERMANEN.`,
    'Hapus Semua Pertanyaan',
    'Ya, Hapus Semua'
  );
  if (!confirmed) return;
  try {
    showToast('Menghapus semua pertanyaan...', 'info');
    if (currentInboxTab === 'all') {
      await adminFetch('/api/admin/unanswered/clear', {
        method: 'POST', body: JSON.stringify({ onlyResolved: false })
      });
    } else {
      await adminFetch('/api/admin/learning/clear-all', { method: 'POST' });
    }
    showToast('Semua pertanyaan dihapus', 'success');
    loadPertanyaanWarga();
    loadAdminConfig();
  } catch (err) { showToast(err.message, 'error'); }
}

// ============================================================
// FEEDBACK
// ============================================================
async function loadFeedback() {
  try {
    const statsRes = await adminFetch('/api/admin/feedback/stats?days=7');
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
    renderFeedbackPieChart(stats.feedback);

    // ✅ RENDER TREN 7 HARI (pakai dailyFeedback dari API)
    renderFeedbackTrendInFeedbackPage(stats.dailyFeedback || []);
  } catch (err) { console.error(err); }
  const el = document.getElementById('feedbackList');
  if (!el) return;
  el.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i></div>';
  try {
    const res = await adminFetch('/api/admin/feedback/list');
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada feedback.</div>';
      return;
    }
    el.innerHTML = data.items.map(f => {
      const ratingColor = f.rating === 'good' ? 'green' : 'red';
      return `
        <div class="card mb-2">
          <div class="card-body">
            <div class="d-flex gap-3">
              <div class="avatar bg-${ratingColor} text-white">
                <i class="ti ti-thumb-${f.rating === 'good' ? 'up' : 'down'}"></i>
              </div>
              <div class="flex-fill">
                <div class="fw-bold">${f.question}</div>
                <div class="text-secondary small mt-1">${f.answer}</div>
                <div class="text-secondary small mt-2">
                  <i class="ti ti-clock"></i> ${new Date(f.timestamp).toLocaleString('id-ID')}
                  ${f.provider ? `• <i class="ti ti-cloud"></i> ${f.provider}` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    el.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
  }
}

function renderFeedbackPieChart(feedback) {
  const el = document.getElementById('feedbackPieChart');
  if (!el) return;
  if (!feedback || (feedback.total || 0) === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada feedback</div>';
    return;
  }
  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');
  // ✅ Pakai window.feedbackPieChartInstance biar aman antar file
  if (window.feedbackPieChartInstance) window.feedbackPieChartInstance.destroy();
  window.feedbackPieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Bagus 👍', 'Kurang 👎'],
      datasets: [{
        data: [feedback.good || 0, feedback.bad || 0],
        backgroundColor: ['#10b981', '#dc3545'],
        borderColor: '#fff',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12 } }
      }
    }
  });
}

// ============================================================
// RENDER TREN 7 HARI untuk Feedback Page
// ============================================================
function renderFeedbackTrendInFeedbackPage(dailyFeedback) {
  const el = document.getElementById('feedbackChart');
  if (!el) return;

  if (!dailyFeedback || dailyFeedback.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada data</div>';
    return;
  }

  // Cek apakah ada data feedback
  const hasData = dailyFeedback.some(d => (d.good || 0) + (d.bad || 0) > 0);
  if (!hasData) {
    el.innerHTML = `
      <div class="text-center text-secondary py-4">
        <i class="ti ti-mood-empty" style="font-size: 48px; opacity: 0.5;"></i>
        <p class="mt-2">Belum ada feedback 7 hari terakhir</p>
      </div>
    `;
    return;
  }

  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');

  if (window.feedbackChartInstance) window.feedbackChartInstance.destroy();
  window.feedbackChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dailyFeedback.map(d => d.day),
      datasets: [
        {
          label: 'Bagus 👍',
          data: dailyFeedback.map(d => d.good || 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        },
        {
          label: 'Kurang 👎',
          data: dailyFeedback.map(d => d.bad || 0),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 14,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 14,
          callbacks: {
            title: (items) => {
              const d = dailyFeedback[items[0].dataIndex];
              const dateStr = new Date(d.date).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short'
              });
              return `${d.day}, ${dateStr}`;
            },
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

async function clearFeedback() {
  const ok = await showConfirmAsync('Hapus semua data feedback?');
  if (!ok) return;
  try {
    await adminFetch('/api/admin/feedback/clear', { method: 'POST', body: JSON.stringify({}) });
    showToast('Semua feedback dihapus', 'success');
    loadFeedback();
  } catch (err) { showToast(err.message, 'error'); }
}

async function clearAnalytics() {
  const ok = await showConfirmAsync('Reset semua data analytics?');
  if (!ok) return;
  try {
    await adminFetch('/api/admin/feedback/clear', { method: 'POST', body: JSON.stringify({ analytics: true }) });
    showToast('Analytics direset', 'success');
    loadFeedback();
  } catch (err) { showToast(err.message, 'error'); }
}

// ============================================================
// ANSWER MODAL
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

  const modalEl = document.getElementById('answerModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }
  setTimeout(() => {
    const ans = document.getElementById('modal-answer');
    if (ans) ans.focus();
  }, 300);
}

function closeAnswerModal() {
  const modalEl = document.getElementById('answerModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

async function submitAnswerToKnowledge() {
  const id = document.getElementById('modal-id').value;
  const question = document.getElementById('modal-question').value;
  const answer = document.getElementById('modal-answer').value.trim();
  const category = document.getElementById('modal-category').value.trim();
  const source = document.getElementById('modal-source').value;
  const statusEl = document.getElementById('modalPipelineStatus');
  const submitBtn = document.getElementById('modalSubmitBtn');

  if (!answer) return showToast('Jawaban tidak boleh kosong', 'warning');
  if (answer.length < 20) return showToast('Jawaban minimal 20 karakter', 'warning');
  if (submitBtn) submitBtn.disabled = true;

  if (statusEl) {
    statusEl.innerHTML = `
      <div class="alert alert-info">
        <i class="ti ti-loader-2 ti-spin me-2"></i> Menyimpan & update pipeline...
      </div>
    `;
  }

  try {
    const res = await adminFetch('/api/admin/unified/add-to-knowledge', {
      method: 'POST', body: JSON.stringify({ id, question, answer, category, source })
    });
    const data = await res.json();
    if (data.success) {
      const s = data.steps || {};
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="alert alert-success">
            <div><i class="ti ti-check me-1"></i> Buku Pengetahuan ${s.savedToKnowledge ? 'OK' : 'gagal'}</div>
            <div><i class="ti ti-check me-1"></i> Knowledge Graph ${s.graphUpdated ? '+edges' : 'gagal'}</div>
            <div><i class="ti ti-check me-1"></i> Semantic: ${s.triplesExtracted || 0} triple</div>
          </div>
        `;
      }
      showToast('Jawaban ditambahkan ke knowledge base', 'success');
      setTimeout(() => {
        closeAnswerModal();
        loadPertanyaanWarga();
        loadAdminConfig();
      }, 2000);
    } else {
      if (statusEl) statusEl.innerHTML = `<div class="alert alert-danger">Gagal: ${data.message}</div>`;
      showToast(data.message, 'error');
      if (submitBtn) submitBtn.disabled = false;
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    showToast(err.message, 'error');
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
  else box.innerHTML = '<i class="ti ti-photo text-secondary" style="font-size: 40px;"></i>';
}

async function uploadLogo() {
  const fileInput = document.getElementById('logoFile');
  const status = document.getElementById('logoStatus');
  if (!fileInput.files[0]) return showToast('Pilih file logo dulu', 'warning');
  const formData = new FormData();
  formData.append('logo', fileInput.files[0]);
  status.innerHTML = '<i class="ti ti-loader-2 ti-spin"></i> Uploading...';
  try {
    const res = await fetch('/api/admin/logo/upload', {
      method: 'POST', credentials: 'include',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      status.innerHTML = '<span class="text-success">Logo diupload!</span>';
      updateLogoPreview(data.logoUrl);
      await loadPublicConfigAdmin();
      loadAdminConfig();
      showToast('Logo berhasil diupload', 'success');
    } else {
      status.innerHTML = `<span class="text-danger">${data.message}</span>`;
      showToast(data.message, 'error');
    }
  } catch (err) {
    status.innerHTML = `<span class="text-danger">${err.message}</span>`;
    showToast(err.message, 'error');
  }
  fileInput.value = '';
}

async function deleteLogo() {
  const ok = await showConfirmAsync('Hapus logo saat ini?');
  if (!ok) return;
  const status = document.getElementById('logoStatus');
  try {
    const res = await adminFetch('/api/admin/logo/delete', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      status.innerHTML = '<span class="text-success">Logo dihapus</span>';
      updateLogoPreview('');
      await loadPublicConfigAdmin();
      loadAdminConfig();
      showToast('Logo dihapus', 'success');
    } else {
      status.innerHTML = `<span class="text-danger">${data.message}</span>`;
      showToast(data.message, 'error');
    }
  } catch (err) {
    status.innerHTML = `<span class="text-danger">${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

// ============================================================
// GENERAL / PROMPT / SURVEY
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
    if (data.success) {
      await loadPublicConfigAdmin();
      // ✅ Langsung update judul tab tanpa refresh
      document.title = `${updates.aiName || 'SIVT AI'} - Admin Dashboard`;
      showToast('Pengaturan umum disimpan', 'success');
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function savePrompt() {
  const systemInstruction = document.getElementById('cfg-systemInstruction').value;
  try {
    const res = await adminFetch('/api/admin/config', {
      method: 'POST', body: JSON.stringify({ systemInstruction })
    });
    const data = await res.json();
    if (data.success) showToast('Prompt AI disimpan', 'success');
    else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function saveSurveyConfig() {
  const statusEl = document.getElementById('surveyStatus');
  const updates = {
    surveyLink: document.getElementById('cfg-surveyLink').value.trim(),
    surveyIdleMinutes: parseInt(document.getElementById('cfg-surveyIdleMinutes').value) || 3,
    surveyEnabled: document.getElementById('surveyEnabled').checked
  };
  if (updates.surveyEnabled && !updates.surveyLink) {
    return showToast('Link survei wajib diisi', 'warning');
  }
  try {
    const res = await adminFetch('/api/admin/config', {
      method: 'POST', body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (data.success) {
      if (statusEl) statusEl.innerHTML = '<span class="text-success">Tersimpan</span>';
      showToast('Pengaturan survei disimpan', 'success');
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

// ============================================================
// KNOWLEDGE
// ============================================================
function renderKnowledgeFiles(files, chunks) {
  const el = document.getElementById('knowledgeFilesList');
  if (!el) return;
  if (files.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada file</div>';
    return;
  }
  let html = `<p class="text-secondary small mb-3">Total ${chunks} chunk aktif</p>`;
  html += '<div class="table-responsive"><table class="table table-vcenter"><thead><tr><th>Nama</th><th>Ukuran</th><th class="w-1">Aksi</th></tr></thead><tbody>';
  files.forEach(f => {
    html += `<tr>
      <td>${f.name}</td>
      <td>${(f.size / 1024).toFixed(1)} KB</td>
      <td><button class="btn btn-sm btn-icon btn-ghost-danger" onclick="deleteKnowledge('${f.name}')"><i class="ti ti-trash"></i></button></td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

async function uploadKnowledge() {
  const fileInput = document.getElementById('knowledgeFile');
  if (!fileInput.files[0]) return showToast('Pilih file dulu', 'warning');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  const status = document.getElementById('uploadStatus');
  status.innerHTML = '<i class="ti ti-loader-2 ti-spin"></i> Uploading...';
  try {
    const res = await fetch('/api/admin/knowledge/upload', {
      method: 'POST', credentials: 'include',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      status.innerHTML = `<span class="text-success">${data.message}</span>`;
      fileInput.value = '';
      loadAdminConfig();
      showToast('File pengetahuan ditambahkan', 'success');
    } else {
      status.innerHTML = `<span class="text-danger">${data.message}</span>`;
      showToast(data.message, 'error');
    }
  } catch (err) {
    status.innerHTML = `<span class="text-danger">${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

async function deleteKnowledge(name) {
  const ok = await showConfirmAsync(`Hapus file "${name}"?`);
  if (!ok) return;
  try {
    const res = await adminFetch('/api/admin/knowledge/delete', {
      method: 'POST', body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
      showToast('File dihapus', 'success');
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function reloadKnowledge() {
  showToast('Sedang reload knowledge...', 'info');
  try {
    const res = await adminFetch('/api/admin/knowledge/reload', { method: 'POST' });
    const data = await res.json();
    showToast(`Reload selesai. Total ${data.chunks} chunk.`, 'success');
    loadAdminConfig();
  } catch (err) { showToast(err.message, 'error'); }
}

// ============================================================
// MEMORY
// ============================================================
async function loadMemoryList() {
  const el = document.getElementById('memoryList');
  if (!el) return;
  el.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i> Memuat...</div>';
  try {
    const res = await adminFetch('/api/admin/memory');
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      el.innerHTML = '<div class="text-center py-4"><i class="ti ti-brain text-secondary" style="font-size:48px;"></i><p class="text-secondary mt-2">Belum ada memori AI</p></div>';
      return;
    }
    el.innerHTML = `
      <div class="alert alert-info mb-3">
        <i class="ti ti-database me-2"></i> Total: <strong>${data.items.length}</strong> memori tersimpan
      </div>
      <div class="row row-cards">
        ${data.items.map((m, i) => {
          const date = new Date(m.timestamp).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          const variantsHtml = (m.variants || []).length > 0
            ? `<div class="mt-2"><div class="text-secondary small mb-1"><i class="ti ti-refresh"></i> Variasi:</div><div>${m.variants.map(v => `<span class="badge bg-blue-lt text-blue me-1">${v}</span>`).join('')}</div></div>`
            : '';
          const keywordsHtml = (m.keywords || []).length > 0
            ? `<div class="mt-2"><div class="text-secondary small mb-1"><i class="ti ti-tags"></i> Keywords:</div><div>${m.keywords.map(k => `<span class="badge bg-purple-lt text-purple me-1">${k}</span>`).join('')}</div></div>`
            : '';
          return `
            <div class="col-md-6 col-lg-4">
              <div class="card h-100">
                <div class="card-header">
                  <div class="text-secondary small"><i class="ti ti-clock me-1"></i> ${date}</div>
                  <div class="card-actions">
                    <button class="btn btn-sm btn-icon btn-ghost-primary" onclick="openEditMemory(${i})" title="Edit">
                      <i class="ti ti-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-ghost-danger" onclick="deleteMemory(${i})" title="Hapus">
                      <i class="ti ti-trash"></i>
                    </button>
                  </div>
                </div>
                <div class="card-body">
                  <div class="fw-bold mb-2"><i class="ti ti-help-circle text-primary me-1"></i> ${m.question}</div>
                  <div class="text-secondary small" style="max-height:100px;overflow-y:auto;">
                    <i class="ti ti-message-circle text-green me-1"></i> ${m.answer}
                  </div>
                  ${variantsHtml}
                  ${keywordsHtml}
                </div>
                <div class="card-footer">
                  <span class="badge bg-yellow text-white"><i class="ti ti-flame me-1"></i> Hit: ${m.hit || 0}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
  }
}

async function openEditMemory(index) {
  try {
    const res = await adminFetch(`/api/admin/memory/${index}`);
    const data = await res.json();
    if (!data.success) return showToast(data.message || 'Gagal load', 'error');
    const m = data.item;
    document.getElementById('editMemoryIndex').value = index;
    document.getElementById('editMemoryQuestion').value = m.question || '';
    document.getElementById('editMemoryAnswer').value = m.answer || '';
    document.getElementById('editMemoryVariants').value = (m.variants || []).join(', ');
    document.getElementById('editMemoryKeywords').value = (m.keywords || []).join(', ');

    const modalEl = document.getElementById('editMemoryModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.show();
    }
    setTimeout(() => {
      const q = document.getElementById('editMemoryQuestion');
      if (q) q.focus();
    }, 300);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeEditMemory() {
  const modalEl = document.getElementById('editMemoryModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

async function saveEditMemory() {
  const index = parseInt(document.getElementById('editMemoryIndex').value);
  const question = document.getElementById('editMemoryQuestion').value.trim();
  const answer = document.getElementById('editMemoryAnswer').value.trim();
  const variants = document.getElementById('editMemoryVariants').value.trim();
  const keywords = document.getElementById('editMemoryKeywords').value.trim();

  if (!question) return showToast('Pertanyaan wajib diisi', 'warning');
  if (!answer) return showToast('Jawaban wajib diisi', 'warning');
  if (answer.length < 20) return showToast('Jawaban minimal 20 karakter', 'warning');

  const btn = document.getElementById('editMemorySaveBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await adminFetch('/api/admin/memory/update', {
      method: 'POST',
      body: JSON.stringify({ index, question, answer, variants, keywords })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Memori diperbarui', 'success');
      closeEditMemory();
      loadMemoryList();
    } else showToast(data.message, 'error');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteMemory(index) {
  const ok = await showConfirmAsync('Hapus memori ini?');
  if (!ok) return;
  try {
    const res = await adminFetch('/api/admin/memory/delete', {
      method: 'POST', body: JSON.stringify({ index })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Memori dihapus', 'success');
      loadMemoryList();
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function clearMemory() {
  const confirmed = await showConfirmAsync(
    'HAPUS SEMUA MEMORI AI?\n\nSemua data memori akan hilang PERMANEN.',
    'Hapus Semua Memori',
    'Ya, Hapus Semua'
  );
  if (!confirmed) return;
  try {
    showToast('Menghapus semua memori...', 'info');
    const res = await adminFetch('/api/admin/memory/clear', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Semua memori dihapus', 'success');
      loadMemoryList();
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function reloadMemory() {
  showToast('Sedang reload memori...', 'info');
  try {
    const res = await adminFetch('/api/admin/memory/reload', { method: 'POST' });
    const data = await res.json();
    showToast(`Reload selesai. Total ${data.total} memori.`, 'success');
    loadMemoryList();
    loadAdminConfig();
  } catch (err) { showToast(err.message, 'error'); }
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
    if (data.success) showToast('Pengaturan memori disimpan', 'success');
    else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
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
    if (data.success) showToast('Pengaturan konteks disimpan', 'success');
    else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

// ============================================================
// SESSIONS
// ============================================================
async function loadSessions() {
  const el = document.getElementById('sessionsList');
  if (!el) return;
  el.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i></div>';
  try {
    const res = await adminFetch('/api/admin/sessions');
    const data = await res.json();
    if (!data.sessions || data.sessions.length === 0) {
      el.innerHTML = '<div class="text-center text-secondary py-4">Tidak ada sesi aktif.</div>';
      return;
    }
    let html = '<div class="table-responsive"><table class="table table-vcenter"><thead><tr><th>Mulai</th><th>Aktif Terakhir</th><th>Pesan</th><th>Pesan Terakhir</th></tr></thead><tbody>';
    data.sessions.forEach(s => {
      html += `<tr>
        <td>${new Date(s.createdAt).toLocaleString('id-ID')}</td>
        <td>${new Date(s.lastActivity).toLocaleString('id-ID')}</td>
        <td>${s.messageCount}</td>
        <td class="text-secondary small">${s.lastMessage || '-'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
  }
}

async function clearSessions() {
  const ok = await showConfirmAsync('Hapus semua sesi percakapan?');
  if (!ok) return;
  try {
    const res = await adminFetch('/api/admin/sessions/clear', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Semua sesi dihapus', 'success');
      loadSessions();
      loadAdminConfig();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

// ============================================================
// BACKUP
// ============================================================
async function runBackupNow() {
  const el = document.getElementById('backupsList');
  if (el) el.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i> Membuat backup...</div>';
  showToast('Sedang membuat backup...', 'info');
  try {
    const res = await adminFetch('/api/admin/backup', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadBackups();
    } else showToast(data.message, 'error');
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadBackups() {
  const el = document.getElementById('backupsList');
  if (!el) return;
  el.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i></div>';
  try {
    const res = await adminFetch('/api/admin/backups');
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada backup.</div>';
      return;
    }
    let html = '<div class="table-responsive"><table class="table table-vcenter"><thead><tr><th>Nama File</th><th>Tanggal</th><th>Ukuran</th><th class="w-1">Aksi</th></tr></thead><tbody>';
    data.items.forEach(b => {
      html += `<tr>
        <td><code>${b.name}</code></td>
        <td>${new Date(b.created).toLocaleString('id-ID')}</td>
        <td>${(b.size / 1024).toFixed(1)} KB</td>
        <td>
          <button class="btn btn-sm btn-icon btn-ghost-primary" onclick="downloadBackup('${b.name}')" title="Download">
            <i class="ti ti-download"></i>
          </button>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
  }
}

async function downloadBackup(filename) {
  showToast('Memulai download...', 'info');
  try {
    const res = await fetch(`/api/admin/backup/download/${encodeURIComponent(filename)}`, {
      credentials: 'include', headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Download selesai', 'success');
  } catch (err) {
    showToast('Gagal download: ' + err.message, 'error');
  }
}

async function startRestore() {
  const fileInput = document.getElementById('restoreFile');
  const statusEl = document.getElementById('restoreStatus');
  const btn = document.getElementById('restoreBtn');
  if (!fileInput.files[0]) return showToast('Pilih file backup dulu', 'warning');
  const file = fileInput.files[0];
  if (!file.name.endsWith('.zip.enc')) return showToast('File harus .zip.enc', 'error');

  const ok = await showConfirmAsync(
    `Restore dari file: ${file.name}\n\nData lama akan di-backup dulu.\nSetelah restore, WAJIB restart server.`,
    'Restore Backup'
  );
  if (!ok) return;

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.innerHTML = '<div class="alert alert-info"><i class="ti ti-loader-2 ti-spin me-2"></i> Mengupload...</div>';

  try {
    const formData = new FormData();
    formData.append('backup', file);
    const res = await fetch('/api/admin/backup/restore', {
      method: 'POST', credentials: 'include',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      if (statusEl) statusEl.innerHTML = `<div class="alert alert-success"><i class="ti ti-check me-2"></i> Restore berhasil. Restart server untuk apply.</div>`;
      fileInput.value = '';
      showAlert('Restore berhasil!\n\nSekarang RESTART server.', 'Restart Server', 'success');
    } else {
      if (statusEl) statusEl.innerHTML = `<div class="alert alert-danger">Gagal: ${data.message}</div>`;
      showToast(data.message, 'error');
      if (btn) btn.disabled = false;
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    showToast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// SECURITY
// ============================================================
async function changePassword() {
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const status = document.getElementById('passwordStatus');
  if (!oldPassword || !newPassword) {
    status.innerHTML = '<span class="text-danger">Isi semua field</span>';
    return showToast('Isi semua field', 'warning');
  }
  if (newPassword.length < 8) {
    status.innerHTML = '<span class="text-danger">Minimal 8 karakter</span>';
    return showToast('Password minimal 8 karakter', 'warning');
  }
  try {
    const res = await adminFetch('/api/admin/change-password', {
      method: 'POST', body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    if (data.success) {
      status.innerHTML = `<span class="text-success">${data.message}</span>`;
      document.getElementById('oldPassword').value = '';
      document.getElementById('newPassword').value = '';
      showToast('Password berhasil diubah', 'success');
    } else {
      status.innerHTML = `<span class="text-danger">${data.message}</span>`;
      showToast(data.message, 'error');
    }
  } catch (err) {
    status.innerHTML = `<span class="text-danger">${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

// ============================================================
// GRAPH
// ============================================================
async function loadGraphVisualization() {
  const container = document.getElementById('graphContainer');
  const statsEl = document.getElementById('graphStats');
  if (!container) return;
  const limit = parseInt(document.getElementById('graphLimit')?.value) || 200;
  const minDegree = parseInt(document.getElementById('graphMinDegree')?.value) || 1;
  container.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i> Memuat graph...</div>';

  try {
    const res = await adminFetch(`/api/admin/graph/visualize?limit=${limit}&minDegree=${minDegree}`);
    const data = await res.json();
    if (!data.nodes || data.nodes.length === 0) {
      container.innerHTML = '<div class="text-center text-secondary py-4">Graph kosong.</div>';
      return;
    }
    if (statsEl) {
      statsEl.style.display = 'block';
      statsEl.innerHTML = `Node: <strong>${data.stats.shown}</strong> • Edge: <strong>${data.edges.length}</strong> • Total: <strong>${data.stats.totalNodes}</strong> • Max degree: <strong>${data.stats.maxDegree}</strong>`;
    }
    graphNodesDataset = new vis.DataSet(data.nodes);
    graphEdgesDataset = new vis.DataSet(data.edges);
    const options = {
      nodes: { shape: 'dot', scaling: { min: 10, max: 40 }, font: { size: 12 } },
      edges: { color: { color: 'rgba(100,100,100,0.4)', highlight: '#dc3545' }, smooth: { type: 'continuous', roundness: 0.5 } },
      physics: { enabled: true, stabilization: { iterations: 200 }, barnesHut: { gravitationalConstant: -8000, centralGravity: 0.3, springLength: 120, springConstant: 0.04, damping: 0.09 } },
      interaction: { hover: true, tooltipDelay: 150, navigationButtons: true, keyboard: true }
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
    container.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
  }
}

async function showGraphNodeDetail(nodeId) {
  const detailEl = document.getElementById('graphNodeDetail');
  const nameEl = document.getElementById('graphNodeName');
  const bodyEl = document.getElementById('graphNodeBody');
  if (!detailEl || !bodyEl) return;
  detailEl.style.display = 'block';
  nameEl.textContent = nodeId;
  bodyEl.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i></div>';
  try {
    const res = await adminFetch(`/api/admin/graph/node/${encodeURIComponent(nodeId)}`);
    const data = await res.json();
    if (!data.found) { bodyEl.innerHTML = '<div class="text-secondary">Node tidak ditemukan.</div>'; return; }
    const n = data.node;
    let html = `<div class="mb-3">
      <span class="badge bg-blue text-white me-1">Degree: ${n.degree}</span>
      <span class="badge bg-green text-white me-1">Sumber: ${n.sources.length}</span>
    </div>`;
    if (n.sources && n.sources.length > 0) {
      html += `<div class="mb-3"><b>File sumber:</b><br><small class="text-secondary">${n.sources.map(s => `• ${s}`).join('<br>')}</small></div>`;
    }
    html += `<div class="mb-2"><b>Tetangga (${data.neighbors.length}):</b></div>`;
    if (data.neighbors.length === 0) html += '<div class="text-secondary">Tidak ada tetangga.</div>';
    else {
      html += '<div class="d-flex flex-wrap gap-2">';
      data.neighbors.forEach(nb => {
        html += `<span class="badge bg-blue-lt text-blue" style="cursor:pointer;" onclick="showGraphNodeDetail('${nb.id.replace(/'/g, "\\'")}')">${nb.label} (${nb.weight})</span>`;
      });
      html += '</div>';
    }
    bodyEl.innerHTML = html;
  } catch (err) {
    bodyEl.innerHTML = `<div class="text-danger">Gagal: ${err.message}</div>`;
  }
}

function closeGraphNodeDetail() {
  const el = document.getElementById('graphNodeDetail');
  if (el) el.style.display = 'none';
}

async function startEnrich() {
  const btn = document.getElementById('enrichBtn');
  const statusEl = document.getElementById('enrichStatus');
  const maxChunks = parseInt(document.getElementById('enrichMaxChunks')?.value) || 30;
  const ok = await showConfirmAsync(`Mulai enrich ${maxChunks} chunk? Ini akan memakai token API.`, 'Enrich Graph');
  if (!ok) return;
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.innerHTML = '<i class="ti ti-loader-2 ti-spin"></i> Memulai...';
  try {
    const res = await adminFetch('/api/admin/graph/enrich', {
      method: 'POST', body: JSON.stringify({ maxChunks, concurrency: 2 })
    });
    const data = await res.json();
    if (!data.success) {
      if (statusEl) statusEl.innerHTML = `<span class="text-danger">${data.message}</span>`;
      if (btn) btn.disabled = false;
      return;
    }
    if (enrichPollTimer) clearInterval(enrichPollTimer);
    enrichPollTimer = setInterval(pollEnrichStatus, 2000);
    pollEnrichStatus();
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
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
      if (statusEl) statusEl.innerHTML = '<span class="text-success">Enrich selesai!</span>';
      showToast('Enrich selesai!', 'success');
      if (btn) btn.disabled = false;
      return;
    }
    const { done, total } = data.progress;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    if (statusEl) {
      statusEl.innerHTML = `<div><i class="ti ti-loader-2 ti-spin me-1"></i> ${done}/${total} chunk (${pct}%)</div>`;
    }
  } catch (err) {}
}

// ============================================================
// TOAST & MODALS
// ============================================================
function showToast(message, type = 'info') {
  // Remove existing toast
  document.querySelectorAll('.sivt-toast').forEach(t => t.remove());

  const config = {
    info:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: 'ti-info-circle',       title: 'Informasi' },
    success: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  icon: 'ti-circle-check',      title: 'Berhasil' },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: 'ti-alert-triangle',    title: 'Perhatian' },
    error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: 'ti-alert-circle',      title: 'Gagal' }
  };
  const c = config[type] || config.info;

  const toast = document.createElement('div');
  toast.className = 'sivt-toast';
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 99999;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    min-width: 320px;
    max-width: 420px;
    padding: 16px 18px;
    background: #ffffff;
    border-radius: 16px;
    box-shadow:
      0 20px 60px rgba(13, 71, 161, 0.15),
      0 8px 24px rgba(0, 0, 0, 0.08),
      0 0 0 1px rgba(0, 0, 0, 0.04);
    opacity: 0;
    transform: translateX(120%) scale(0.9);
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden;
  `;

  toast.innerHTML = `
    <div style="
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: ${c.bg};
      color: ${c.color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      position: relative;
    ">
      <i class="ti ${c.icon}"></i>
    </div>
    <div style="flex: 1; min-width: 0; padding-top: 2px;">
      <div style="
        font-size: 14px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 2px;
        letter-spacing: -0.2px;
      ">${c.title}</div>
      <div style="
        font-size: 13px;
        color: #6b7280;
        line-height: 1.5;
        word-wrap: break-word;
      ">${message}</div>
    </div>
    <button onclick="this.closest('.sivt-toast').remove()" style="
      flex-shrink: 0;
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;
    " onmouseover="this.style.background='#f3f4f6'; this.style.color='#374151';"
       onmouseout="this.style.background='transparent'; this.style.color='#9ca3af';">
      <i class="ti ti-x"></i>
    </button>
    <div style="
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: ${c.color};
      border-radius: 0 0 16px 16px;
      animation: sivtToastProgress 3.5s linear forwards;
    "></div>
  `;

  // Progress animation
  const style = document.createElement('style');
  if (!document.getElementById('sivt-toast-anim')) {
    style.id = 'sivt-toast-anim';
    style.textContent = `
      @keyframes sivtToastProgress {
        from { width: 100%; }
        to { width: 0%; }
      }
      .sivt-toast {
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Show animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0) scale(1)';
  });

  // Auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%) scale(0.9)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function showAlert(message, title = 'Informasi', type = 'info') {
  const colors = { info: 'bg-blue', success: 'bg-green', warning: 'bg-yellow', error: 'bg-red' };
  const icons = { info: 'ti-info-circle', success: 'ti-circle-check', warning: 'ti-alert-triangle', error: 'ti-alert-circle' };
  const html = `
    <div class="modal modal-blur fade" id="dynAlertModal" tabindex="-1">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-status ${colors[type] || 'bg-blue'}"></div>
          <div class="modal-body text-center py-4">
            <i class="ti ${icons[type] || 'ti-info-circle'} text-${type === 'error' ? 'red' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'blue'} mb-2" style="font-size: 48px;"></i>
            <h3 class="mb-2">${title}</h3>
            <div class="text-secondary">${message.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary w-100" data-bs-dismiss="modal">OK</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  const modalEl = document.getElementById('dynAlertModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener('hidden.bs.modal', () => div.remove(), { once: true });
}

function showConfirmAsync(message, title = 'Konfirmasi', okLabel = 'Ya, Lanjutkan') {
  return new Promise((resolve) => {
    const html = `
      <div class="modal modal-blur fade" id="dynConfirmModal" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content">
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            <div class="modal-status bg-danger"></div>
            <div class="modal-body text-center py-4">
              <i class="ti ti-alert-triangle text-danger mb-2" style="font-size: 48px;"></i>
              <h3 class="mb-2">${title}</h3>
              <div class="text-secondary">${message.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="modal-footer">
              <div class="w-100">
                <div class="row">
                  <div class="col"><button class="btn w-100" data-bs-dismiss="modal">Batal</button></div>
                  <div class="col"><button class="btn btn-danger w-100" id="dynConfirmOk">${okLabel}</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    const modalEl = document.getElementById('dynConfirmModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    document.getElementById('dynConfirmOk').onclick = () => { modal.hide(); resolve(true); };
    modalEl.addEventListener('hidden.bs.modal', () => {
      div.remove();
      resolve(false);
    }, { once: true });
  });
}

function showPrompt(message, defaultValue, onSubmit, title = 'Input') {
  const html = `
    <div class="modal modal-blur fade" id="dynPromptModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="ti ti-edit me-2"></i>${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2">${message}</div>
            <input type="text" class="form-control" id="dynPromptInput" value="${defaultValue || ''}">
          </div>
          <div class="modal-footer">
            <button class="btn" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary" id="dynPromptOk">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  const modalEl = document.getElementById('dynPromptModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  setTimeout(() => {
    const input = document.getElementById('dynPromptInput');
    if (input) { input.focus(); input.select(); }
  }, 300);
  document.getElementById('dynPromptOk').onclick = () => {
    const val = document.getElementById('dynPromptInput').value.trim();
    modal.hide();
    if (onSubmit && val) onSubmit(val);
  };
  modalEl.addEventListener('hidden.bs.modal', () => div.remove(), { once: true });
}

// ============================================================
// FIXED NAVBAR — Scroll Effect
// ============================================================
function initFixedNavbar() {
  const header = document.querySelector('.page-wrapper > header.navbar');
  if (!header) {
    console.warn('[NAVBAR] Header tidak ditemukan');
    return;
  }

  const onScroll = () => {
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  // Pasang event listener (throttle pakai requestAnimationFrame)
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Cek posisi awal
  onScroll();

  console.log('[NAVBAR] Fixed navbar aktif ✓');
}
window.initFixedNavbar = initFixedNavbar;

// ============================================================
// EXPOSE GLOBAL
// ============================================================
window.doLogin = doLogin;

// ============================================================
// EXPOSE GLOBAL
// ============================================================
window.doLogin = doLogin;
window.doLogout = doLogout;
window.showPage = showPage;
window.adminFetch = adminFetch;
window.toggleDarkMode = toggleDarkMode;
window.refreshCurrentPage = refreshCurrentPage;
window.loadPertanyaanWarga = loadPertanyaanWarga;
window.switchInboxTab = switchInboxTab;
window.openAnswerModal = openAnswerModal;
window.closeAnswerModal = closeAnswerModal;
window.submitAnswerToKnowledge = submitAnswerToKnowledge;
window.openEditMemory = openEditMemory;
window.closeEditMemory = closeEditMemory;
window.saveEditMemory = saveEditMemory;
window.deleteMemory = deleteMemory;
window.clearMemory = clearMemory;
window.reloadMemory = reloadMemory;
window.saveMemorySettings = saveMemorySettings;
window.saveConversationSettings = saveConversationSettings;
window.loadFeedback = loadFeedback;
window.clearFeedback = clearFeedback;
window.clearAnalytics = clearAnalytics;
window.saveGeneral = saveGeneral;
window.savePrompt = savePrompt;
window.saveSurveyConfig = saveSurveyConfig;
window.uploadLogo = uploadLogo;
window.deleteLogo = deleteLogo;
window.previewTheme = previewTheme;
window.syncColorFromText = syncColorFromText;
window.applyPreset = applyPreset;
window.saveTheme = saveTheme;
window.resetTheme = resetTheme;
window.addProvider = addProvider;
window.editProviderKey = editProviderKey;
window.editProviderModels = editProviderModels;
window.removeProvider = removeProvider;
window.toggleProvider = toggleProvider;
window.testProvider = testProvider;
window.toggleRole = toggleRole;
window.uploadKnowledge = uploadKnowledge;
window.deleteKnowledge = deleteKnowledge;
window.reloadKnowledge = reloadKnowledge;
window.clearSessions = clearSessions;
window.runBackupNow = runBackupNow;
window.downloadBackup = downloadBackup;
window.startRestore = startRestore;
window.changePassword = changePassword;
window.loadGraphVisualization = loadGraphVisualization;
window.showGraphNodeDetail = showGraphNodeDetail;
window.closeGraphNodeDetail = closeGraphNodeDetail;
window.startEnrich = startEnrich;
window.loadNotifications = loadNotifications;
window.markAllRead = markAllRead;
window.clearNotifications = clearNotifications;
window.loadAdminTheme = loadAdminTheme;
window.loadPublicConfigAdmin = loadPublicConfigAdmin;
window.loadCurrentPage = loadCurrentPage;
window.loadMemoryList = loadMemoryList;
window.loadThemeToForm = loadThemeToForm;
window.tryLoadDashboard = tryLoadDashboard;
window.clearInboxResolved = clearInboxResolved;
window.clearInboxAll = clearInboxAll;
window.markUnansweredResolved = markUnansweredResolved;
window.deleteUnanswered = deleteUnanswered;
window.resolveLearning = resolveLearning;
window.deleteLearning = deleteLearning;

// ============================================================
// LOGIN PASSWORD TOGGLE — Show/Hide password
// ============================================================
function initPasswordToggle() {
  const passwordInput = document.getElementById('loginPassword');
  const passwordToggle = document.getElementById('passwordToggle');
  const passwordToggleIcon = document.getElementById('passwordToggleIcon');

  if (!passwordInput || !passwordToggle || !passwordToggleIcon) {
    console.warn('[PASSWORD-TOGGLE] Element tidak ditemukan');
    return;
  }

  // Hindari double binding
  if (passwordToggle.dataset.bound === 'true') return;
  passwordToggle.dataset.bound = 'true';

  passwordToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isPassword = passwordInput.type === 'password';

    if (isPassword) {
      // Show password
      passwordInput.type = 'text';
      passwordToggleIcon.className = 'ti ti-eye';
    } else {
      // Hide password
      passwordInput.type = 'password';
      passwordToggleIcon.className = 'ti ti-eye-off';
    }

    passwordInput.focus();
  });

  console.log('[PASSWORD-TOGGLE] Aktif ✓');
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPasswordToggle);
} else {
  initPasswordToggle();
}