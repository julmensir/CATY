// ============================================================
// admin-public/dashboard.js
// UI & Logic Dashboard — SIVT AI
// ============================================================

let sessionsChartInstance = null;
let sourceChartInstance = null;
let feedbackTrendChartInstance = null;
let categoryChartInstance = null;
let dashRefreshInterval = null;

// ============================================================
// FORMAT UPTIME
// ============================================================
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

// ============================================================
// CHANGE PERIOD
// ============================================================
function changePeriod(period) {
  document.querySelectorAll('.dash-period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  window.loadDashboardNew(period);
}

// ============================================================
// LOAD DASHBOARD
// ============================================================
async function loadDashboardNew(period) {
  // ✅ Fallback ke period tersimpan biar refresh tidak reset ke 24 Jam
  period = period || window._currentDashPeriod || '1d';
  try {
    // ✅ Simpan period aktif biar bisa dipakai refresh
    window._currentDashPeriod = period;

    const hour = new Date().getHours();
    const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
    const greetingEl = document.getElementById('dashGreeting');
    if (greetingEl) greetingEl.textContent = greeting + ' 👋';

    // ✅ Kirim period ke API
    const res = await window.adminFetch(`/api/admin/dashboard/stats?period=${encodeURIComponent(period)}`);
    const data = await res.json();
    // ... SISANYA TETAP SAMA, tidak perlu diubah

    const setText = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    setText('kpiProviders', data.providers?.total || 0);
    setText('kpiProvidersSub', `${data.providers?.active || 0} aktif, ${data.providers?.inactive || 0} off`);
    setText('kpiKnowledge', data.knowledge?.chunks || 0);
    setText('kpiKnowledgeSub', `${data.knowledge?.files || 0} file, ${data.knowledge?.topics || 0} topik`);
    setText('kpiMemory', data.memory?.total || 0);
    setText('kpiMemorySub', `${data.memory?.totalHits || 0} total hit`);
    setText('kpiSessions', data.sessions?.total || 0);
    setText('kpiSessionsSub', `${data.sessions?.messages || 0} pesan`);
    setText('kpiSatisfaction', (data.feedback?.satisfactionRate || 0) + '%');
    setText('kpiSatisfactionSub', `${data.feedback?.good || 0} 👍 / ${data.feedback?.bad || 0} 👎`);
    setText('kpiNotif', data.notifications?.unread || 0);
    setText('kpiNotifSub', `dari ${data.notifications?.total || 0} total`);
    setText('dashUptime', formatUptime(data.uptime || 0));

    const dashAiName = document.getElementById('dashAiName');
    if (dashAiName) dashAiName.textContent = data.aiName || 'SIVT AI';

    const label = document.getElementById('chartPeriodLabel');
    if (label) {
      const labels = { '1d': '24 Jam', '7d': '7 Hari', '30d': '30 Hari', '90d': '90 Hari', '1y': '1 Tahun' };
      label.textContent = labels[period] || '7 Hari Terakhir';
    }

    if (data.sessions?.daily) renderSessionsChart(data.sessions.daily);
    if (data.providers?.list) renderProviderHealth(data.providers.list);
    if (data.analytics) renderSourceChart(data.analytics);
    // ✅ Kirim dailyFeedback dari API + fallback ke daily sesi
    if (data.feedback) {
      renderFeedbackTrend(
        data.sessions?.daily || [],
        data.feedback,
        data.dailyFeedback || null   // ← data baru
      );
    }
    renderLearningHighlight(data.learning || { pending: 0 });
    renderTopTopics(data.topTopics || []);
    renderCategoryChart(data.categories || []);
  } catch (err) {
    console.error('Dashboard error:', err);
    if (window.showToast) window.showToast('Gagal memuat dashboard', 'error');
  }
}

// ============================================================
// RENDER: CHART SESI (Aktivitas)
// ============================================================
function renderSessionsChart(daily) {
  const el = document.getElementById('sessionsChart');
  if (!el) return;
  if (!daily || daily.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada data</div>';
    return;
  }
  el.innerHTML = '<canvas></canvas>';
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(13, 71, 161, 0.6)');
  gradient.addColorStop(1, 'rgba(13, 71, 161, 0.02)');

  if (sessionsChartInstance) sessionsChartInstance.destroy();
  sessionsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: daily.map(d => d.day),
      datasets: [{
        label: 'Aktivitas',
        data: daily.map(d => d.sessions || d.questions || 0),
        borderColor: '#0d47a1',
        backgroundColor: gradient,
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#0d47a1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(13, 71, 161, 0.95)',
          padding: 12,
          callbacks: {
            title: (items) => daily[items[0].dataIndex].date,
            label: (ctx) => `${ctx.parsed.y} aktivitas`
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

// ============================================================
// RENDER: SUMBER JAWABAN
// ============================================================
function renderSourceChart(analytics) {
  const el = document.getElementById('sourceChart');
  if (!el) return;

  // ✅ Hitung AI murni = totalChats - (memory + rag + refusal + redirect)
  const memoryHits = analytics.totalMemoryHits || 0;
  const ragHits = analytics.totalRagHits || 0;
  const refusals = analytics.totalRefusals || 0;
  const redirects = analytics.totalOutOfScope || 0;
  const totalChats = analytics.totalChats || 0;

  const aiPure = Math.max(0, totalChats - memoryHits - ragHits - refusals - redirects);

  const values = [
    memoryHits,
    ragHits,
    aiPure,       // ✅ AI murni
    refusals,
    redirects
  ];

  if (values.every(v => v === 0)) {
    el.innerHTML = `
      <div class="text-center text-secondary py-4">
        <i class="ti ti-chart-donut" style="font-size: 48px; opacity: 0.5;"></i>
        <p class="mt-2">Belum ada data</p>
      </div>
    `;
    return;
  }

  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');
  if (sourceChartInstance) sourceChartInstance.destroy();

  // ✅ WARNA BARU — Sesuai permintaan user:
  // Memory = Merah, RAG = Biru, AI = Kuning, Refusal = Hijau, Redirect = Jingga
  const colors = [
    '#ef4444',   // Memory   - Merah
    '#3b82f6',   // RAG      - Biru
    '#f59e0b',   // AI       - Kuning
    '#10b981',   // Refusal  - Hijau
    '#f97316'    // Redirect - Jingga
  ];

  sourceChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Memory', 'RAG', 'AI', 'Refusal', 'Redirect'],
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 10,
        hoverBorderWidth: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 14,
            font: { size: 12, weight: '600' },
            boxWidth: 12,
            boxHeight: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 14,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ============================================================
// RENDER: TREN FEEDBACK
// ============================================================
function renderFeedbackTrend(daily, feedback, dailyFeedback) {
  const el = document.getElementById('feedbackTrendChart');
  if (!el) return;

  // ✅ PRIORITAS 1: Pakai dailyFeedback dari API (data real per hari)
  let dataDaily = null;

  if (dailyFeedback && dailyFeedback.length > 0) {
    dataDaily = dailyFeedback;
  } else if (daily && daily.length > 0) {
    // Fallback: pakai daily sesi
    dataDaily = daily.map(d => ({
      day: d.day,
      date: d.date,
      good: d.good || 0,
      bad: d.bad || 0,
      total: (d.good || 0) + (d.bad || 0)
    }));
  } else {
    // Fallback terakhir: generate 7 hari dengan 0
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const now = new Date();
    dataDaily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dataDaily.push({
        day: dayNames[d.getDay()],
        date: d.toISOString().slice(0, 10),
        good: 0,
        bad: 0,
        total: 0
      });
    }
  }

  // Kalau tidak ada feedback sama sekali → pesan
  if ((feedback?.total || 0) === 0) {
    el.innerHTML = `
      <div class="text-center text-secondary py-4">
        <i class="ti ti-mood-empty" style="font-size: 48px; opacity: 0.5;"></i>
        <p class="mt-2">Belum ada feedback</p>
      </div>
    `;
    return;
  }

  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');

  if (feedbackTrendChartInstance) feedbackTrendChartInstance.destroy();
  feedbackTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dataDaily.map(d => d.day),
      datasets: [
        {
          label: 'Bagus 👍',
          data: dataDaily.map(d => d.good || 0),
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
          data: dataDaily.map(d => d.bad || 0),
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
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              const d = dataDaily[idx];
              const dateStr = new Date(d.date).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric'
              });
              return `${d.day}, ${dateStr}`;
            },
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: '600' } }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

// ============================================================
// RENDER: PROVIDER HEALTH
// ============================================================
function renderProviderHealth(providers) {
  const el = document.getElementById('providerHealthList');
  if (!el) return;
  if (!providers || providers.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada provider</div>';
    return;
  }
  el.innerHTML = providers.map(p => `
    <div class="d-flex align-items-center mb-2 p-2 rounded" style="background: var(--tblr-bg-surface-secondary);">
      <span class="status-dot ${p.enabled !== false ? 'status-dot-animated bg-green' : 'bg-red'} me-2"></span>
      <div class="flex-fill">
        <div class="fw-bold small">${p.name}</div>
        <div class="text-secondary small">${(p.roles || []).join(', ')} · ${p.models || 0} model</div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// RENDER: LEARNING HIGHLIGHT
// ============================================================
function renderLearningHighlight(learning) {
  const el = document.getElementById('learningHighlight');
  if (!el) return;
  const pending = learning?.pending || 0;
  if (pending === 0) {
    el.innerHTML = '<div class="text-center py-4"><i class="ti ti-circle-check text-green" style="font-size:48px;"></i><p class="text-secondary mt-2">Tidak ada pertanyaan pending</p></div>';
    return;
  }
  el.innerHTML = `
    <div class="text-center py-3">
      <div style="font-size: 56px; font-weight: 800; color: var(--tblr-yellow); line-height:1;">${pending}</div>
      <div class="text-secondary small mt-2">Pertanyaan perlu diperhatikan</div>
      <button class="btn btn-primary mt-3" onclick="showPage('inbox')">
        <i class="ti ti-arrow-right me-1"></i> Lihat Pertanyaan
      </button>
    </div>
  `;
}

// ============================================================
// RENDER: TOPIK POPULER (FIXED - dari pertanyaan warga)
// ============================================================
function renderTopTopics(topics) {
  const el = document.getElementById('topTopicsList');
  if (!el) return;

  if (!topics || topics.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada pertanyaan warga.<br><small>Topik akan muncul setelah warga bertanya.</small></div>';
    return;
  }

  const maxCount = Math.max(...topics.map(t => t.count || 1), 1);

  el.innerHTML = topics.slice(0, 8).map((t, i) => {
    const pct = Math.round(((t.count || 0) / maxCount) * 100);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span class="badge bg-blue-lt">#${i + 1}</span>`;
    return `
      <div class="mb-3">
        <div class="d-flex align-items-center mb-1">
          <span style="font-size: 16px; margin-right: 8px;">${medal}</span>
          <div class="flex-fill text-truncate" style="font-weight: 600; font-size: 13px;" title="${t.title}">
            ${t.title}
          </div>
          <span class="badge bg-blue text-white ms-2">${t.count || 0}x</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar bg-blue" style="width: ${pct}%"></div>
        </div>
        ${t.lastAsked ? `<div class="text-secondary small mt-1" style="font-size: 10px;"><i class="ti ti-clock"></i> Terakhir: ${new Date(t.lastAsked).toLocaleDateString('id-ID')}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ============================================================
// RENDER: KATEGORI PERTANYAAN
// ============================================================
function renderCategoryChart(categories) {
  const el = document.getElementById('categoryChart');
  if (!el) return;

  if (!categories || categories.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada data kategori.<br><small>Kategori akan muncul setelah ada pertanyaan warga.</small></div>';
    return;
  }

  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');

  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
  ];

  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories.map(c => c.name),
      datasets: [{
        label: 'Jumlah',
        data: categories.map(c => c.count),
        backgroundColor: categories.map((_, i) => colors[i % colors.length]),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x} pertanyaan`
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { grid: { display: false } }
      }
    }
  });
}

// ============================================================
// AUTO REFRESH
// ============================================================
function startDashboardAutoRefresh() {
  if (dashRefreshInterval) clearInterval(dashRefreshInterval);
  dashRefreshInterval = setInterval(() => {
    if (window.currentPage === 'dashboard') loadDashboardNew();
  }, 60000);
}

// ============================================================
// EXPOSE GLOBAL
// ============================================================
window.loadDashboardNew = loadDashboardNew;
window.changePeriod = changePeriod;
window.startDashboardAutoRefresh = startDashboardAutoRefresh;
window.formatUptime = formatUptime;

console.log('[DASHBOARD] File dashboard.js loaded ✓');