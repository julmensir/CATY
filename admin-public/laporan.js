// ============================================================
// admin-public/laporan.js
// UI & Logic Laporan — SIVT AI
// ============================================================

let reportChartInstance = null;
let reportCategoryChartInstance = null;
let reportSourceChartInstance = null;
let currentReportData = null;

// ============================================================
// HELPER: Format tanggal LOCAL (WIB), BUKAN UTC
// ============================================================
function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================
// GET RANGE
// ============================================================
function getReportRange() {
  const preset = document.getElementById('reportRange')?.value || '30d';
  const now = new Date();
  let from;

  if (preset === 'today') {
    // ✅ Hari ini: dari jam 00:00 sampai sekarang
    from = new Date();
    from.setHours(0, 0, 0, 0);
  } else if (preset === '7d') {
    // ✅ 7 hari = H-6 sampai H (inklusif)
    from = new Date(now.getTime() - 6 * 86400000);
    from.setHours(0, 0, 0, 0);
  } else if (preset === '30d') {
    from = new Date(now.getTime() - 29 * 86400000);
    from.setHours(0, 0, 0, 0);
  } else if (preset === '90d') {
    from = new Date(now.getTime() - 89 * 86400000);
    from.setHours(0, 0, 0, 0);
  } else if (preset === '1y') {
    from = new Date(now.getTime() - 364 * 86400000);
    from.setHours(0, 0, 0, 0);
  } else if (preset === 'custom') {
    const fromVal = document.getElementById('reportFrom')?.value;
    const toVal = document.getElementById('reportTo')?.value;
    return {
      from: fromVal || toLocalDateString(new Date(now.getTime() - 29 * 86400000)),
      to: toVal || toLocalDateString(now)
    };
  } else {
    from = new Date(now.getTime() - 29 * 86400000);
    from.setHours(0, 0, 0, 0);
  }

  // ✅ PAKAI toLocalDateString (LOCAL timezone WIB) — bukan toISOString (UTC)
  return {
    from: toLocalDateString(from),
    to: toLocalDateString(now)
  };
}

function toggleCustomRange() {
  const preset = document.getElementById('reportRange')?.value;
  const customDiv = document.getElementById('reportCustomRange');
  if (customDiv) customDiv.style.display = preset === 'custom' ? 'flex' : 'none';
}

// ============================================================
// LOAD REPORT
// ============================================================
async function loadReport() {
  console.log('[LAPORAN] Loading...');
  const range = getReportRange();
  const from = range.from;
  const to = range.to;

  const rangeDisplay = document.getElementById('reportRangeDisplay');
  if (rangeDisplay) {
    rangeDisplay.textContent = `${new Date(from).toLocaleDateString('id-ID')} - ${new Date(to).toLocaleDateString('id-ID')}`;
  }

  const overviewEl = document.getElementById('reportOverview');
  if (overviewEl) overviewEl.innerHTML = '<div class="text-center text-secondary py-4"><i class="ti ti-loader-2 ti-spin"></i> Memuat laporan...</div>';

  try {
    const url = `/api/admin/report/summary?from=${from}&to=${to}`;
    const res = await adminFetch(url);

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    currentReportData = data;
    console.log('[LAPORAN] Data loaded:', data);

    renderReportOverview(data);
    renderReportChart(data.daily || []);
    renderReportSourceChart(data.analytics || {});
    renderReportTopTopics(data.topTopics || []);
    renderReportCategoryChart(data.categories || []);
    renderReportKnowledge(data.knowledge || {});
    renderReportMemory(data.memory || {});
    renderReportProviders(data.providers || {});
    renderReportSessions(data);
    renderReportFeedback(data);
    renderReportUnanswered(data);

    console.log('[LAPORAN] OK');
  } catch (err) {
    console.error('[LAPORAN] Error:', err);
    if (overviewEl) {
      overviewEl.innerHTML = `
        <div class="card">
          <div class="card-body text-center py-5">
            <i class="ti ti-alert-triangle text-red mb-3" style="font-size: 48px;"></i>
            <h3 class="mb-2">Gagal memuat laporan</h3>
            <p class="text-secondary">${err.message}</p>
            <button class="btn btn-primary" onclick="loadReport()">
              <i class="ti ti-refresh me-1"></i> Coba Lagi
            </button>
          </div>
        </div>
      `;
    }
    showToast('Gagal load laporan: ' + err.message, 'error');
  }
}

// ============================================================
// RENDER: OVERVIEW
// ============================================================
function renderReportOverview(data) {
  const el = document.getElementById('reportOverview');
  if (!el) return;

  const card = (icon, color, value, label, sub = '') => `
    <div class="col-sm-6 col-lg-3">
      <div class="card">
        <div class="card-body">
          <div class="d-flex align-items-center mb-2">
            <span class="kpi-icon bg-${color}-lt"><i class="ti ${icon}"></i></span>
            <div class="ms-2 text-secondary small text-uppercase fw-bold">${label}</div>
          </div>
          <div class="h1 mb-1">${value}</div>
          <div class="text-secondary small">${sub}</div>
        </div>
      </div>
    </div>
  `;

  el.innerHTML = `
    <div class="row row-cards mb-3">
      ${card('ti-messages', 'blue', data.sessions.total, 'Total Sesi', `${data.sessions.messages} pesan`)}
      ${card('ti-mood-smile', 'green', (data.feedback.satisfactionRate || 0) + '%', 'Kepuasan', `${data.feedback.good}👍 / ${data.feedback.bad}👎`)}
      ${card('ti-help-circle', 'orange', data.unanswered.total, 'Pertanyaan Warga', `${data.unanswered.pending} pending`)}
      ${card('ti-brain', 'purple', data.memory.total, 'Memori AI', `${data.memory.totalHits} hit`)}
    </div>
    <div class="row row-cards mb-3">
      ${card('ti-book', 'cyan', data.knowledge.chunks, 'Chunk Pengetahuan', `${data.knowledge.topics} topik`)}
      ${card('ti-cloud', 'teal', data.providers.active + '/' + data.providers.total, 'Provider Aktif', 'Fallback otomatis')}
      ${card('ti-hierarchy-3', 'pink', data.graph.nodes, 'Graph Nodes', `${data.graph.edges} edges`)}
      ${card('ti-calendar', 'indigo', data.period.days, 'Hari Periode', 'hari aktif')}
    </div>
  `;
}

// ============================================================
// RENDER: CHART HARIAN
// ============================================================
function renderReportChart(daily) {
  const el = document.getElementById('reportChart');
  if (!el) return;

  if (!daily || daily.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada data pada periode ini.</div>';
    return;
  }

  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');

  if (reportChartInstance) reportChartInstance.destroy();
  reportChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: daily.map(d => new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })),
      datasets: [{
        label: 'Sesi',
        data: daily.map(d => d.sessions),
        borderColor: '#3b82f6',
        backgroundColor: gradient,
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

// ============================================================
// RENDER: DISTRIBUSI SUMBER JAWABAN (BARU)
// ============================================================
function renderReportSourceChart(analytics) {
  const el = document.getElementById('reportSourceChart');
  if (!el) return;

  const memoryHits = analytics.totalMemoryHits || 0;
  const ragHits = analytics.totalRagHits || 0;
  const refusals = analytics.totalRefusals || 0;
  const redirects = analytics.totalOutOfScope || 0;
  const totalChats = analytics.totalChats || 0;

  // ✅ AI murni = totalChats - semua kategori
  const aiPure = Math.max(0, totalChats - memoryHits - ragHits - refusals - redirects);

  const values = [memoryHits, ragHits, aiPure, refusals, redirects];

  if (values.every(v => v === 0)) {
    el.innerHTML = `
      <div class="text-center text-secondary py-4">
        <i class="ti ti-chart-donut" style="font-size: 48px; opacity: 0.5;"></i>
        <p class="mt-2">Belum ada data pada periode ini</p>
      </div>
    `;
    return;
  }

  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');

  if (reportSourceChartInstance) reportSourceChartInstance.destroy();

  const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#f97316'];

  reportSourceChartInstance = new Chart(ctx, {
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
// RENDER: TOPIK POPULER
// ============================================================
function renderReportTopTopics(topics) {
  const el = document.getElementById('reportTopTopics');
  if (!el) return;

  if (!topics || topics.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada topik.</div>';
    return;
  }

  const maxCount = Math.max(...topics.map(t => t.count || 1), 1);
  el.innerHTML = topics.slice(0, 15).map((t, i) => {
    const pct = Math.round(((t.count || 0) / maxCount) * 100);
    return `
      <div class="mb-2">
        <div class="d-flex align-items-center mb-1">
          <span class="badge bg-blue-lt text-blue me-2" style="min-width: 32px;">#${i + 1}</span>
          <div class="flex-fill text-truncate" style="font-size: 13px;">${t.title}</div>
          <span class="badge bg-blue text-white ms-2">${t.count || 0}x</span>
        </div>
        <div class="progress" style="height: 5px;">
          <div class="progress-bar bg-blue" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// RENDER: KATEGORI CHART
// ============================================================
function renderReportCategoryChart(categories) {
  const el = document.getElementById('reportCategoryChart');
  if (!el) return;

  if (!categories || categories.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-4">Belum ada kategori.</div>';
    return;
  }

  el.innerHTML = '<canvas></canvas>';
  const ctx = el.querySelector('canvas').getContext('2d');
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

  if (reportCategoryChartInstance) reportCategoryChartInstance.destroy();
  reportCategoryChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories.map(c => c.name),
      datasets: [{
        label: 'Jumlah',
        data: categories.map(c => c.count),
        backgroundColor: categories.map((_, i) => colors[i % colors.length]),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { grid: { display: false } }
      }
    }
  });
}

// ============================================================
// RENDER: KNOWLEDGE
// ============================================================
function renderReportKnowledge(knowledge) {
  const el = document.getElementById('reportKnowledge');
  if (!el) return;

  if (!knowledge.files || knowledge.files.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-3">Belum ada file pengetahuan.</div>';
    return;
  }

  let html = `<div class="alert alert-info mb-2">
    <i class="ti ti-book me-1"></i>
    Total <strong>${knowledge.chunks}</strong> chunk • <strong>${knowledge.topics}</strong> topik
  </div>`;
  html += '<div class="table-responsive"><table class="table table-vcenter table-sm"><thead><tr>';
  html += '<th>File</th><th>Ukuran</th></tr></thead><tbody>';
  knowledge.files.forEach(f => {
    html += `<tr><td><i class="ti ti-file-text me-1"></i> ${f.name}</td><td>${(f.size / 1024).toFixed(1)} KB</td></tr>`;
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ============================================================
// RENDER: MEMORY
// ============================================================
function renderReportMemory(memory) {
  const el = document.getElementById('reportMemory');
  if (!el) return;

  if (!memory.topMemory || memory.topMemory.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-3">Belum ada memori AI.</div>';
    return;
  }

  let html = `<div class="alert alert-info mb-2">
    <i class="ti ti-brain me-1"></i>
    Total <strong>${memory.total}</strong> memori • <strong>${memory.totalHits}</strong> hit
  </div>`;
  html += '<div class="table-responsive"><table class="table table-vcenter table-sm"><thead><tr>';
  html += '<th>Pertanyaan</th><th>Hit</th></tr></thead><tbody>';
  memory.topMemory.slice(0, 15).forEach(m => {
    html += `<tr><td style="font-size: 12px;">${m.question}</td><td><span class="badge bg-yellow text-white">${m.hit}</span></td></tr>`;
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ============================================================
// RENDER: PROVIDERS
// ============================================================
function renderReportProviders(providers) {
  const el = document.getElementById('reportProviders');
  if (!el) return;

  if (!providers.list || providers.list.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-3">Belum ada provider.</div>';
    return;
  }

  let html = '<div class="table-responsive"><table class="table table-vcenter table-sm"><thead><tr>';
  html += '<th>#</th><th>Provider</th><th>Roles</th><th>Status</th></tr></thead><tbody>';
  providers.list.forEach(p => {
    const badge = p.enabled
      ? '<span class="badge bg-green text-white">Aktif</span>'
      : '<span class="badge bg-secondary text-white">Off</span>';
    html += `<tr><td>${p.index}</td><td><strong>${p.name}</strong></td><td><small>${p.roles.join(', ')}</small></td><td>${badge}</td></tr>`;
  });
  html += '</tbody></table></div>';
  html += `<div class="text-secondary small mt-2">${providers.active}/${providers.total} provider aktif</div>`;
  el.innerHTML = html;
}

// ============================================================
// RENDER: SESSIONS
// ============================================================
function renderReportSessions(data) {
  const el = document.getElementById('reportSessions');
  if (!el) return;

  el.innerHTML = `
    <div class="alert alert-info">
      <i class="ti ti-messages me-1"></i>
      Total <strong>${data.sessions.total}</strong> sesi dengan <strong>${data.sessions.messages}</strong> pesan
      • Rata-rata <strong>${data.sessions.avgMessagesPerSession}</strong> pesan/sesi
    </div>
    <p class="text-secondary small mb-0">Untuk detail per sesi, silakan export CSV atau cetak PDF.</p>
  `;
}

// ============================================================
// RENDER: FEEDBACK
// ============================================================
function renderReportFeedback(data) {
  const el = document.getElementById('reportFeedback');
  if (!el) return;

  if (!data.feedback.items || data.feedback.items.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-3">Belum ada feedback.</div>';
    return;
  }

  let html = `<div class="alert alert-info mb-2">
    <i class="ti ti-mood-smile me-1"></i>
    Total <strong>${data.feedback.total}</strong> feedback •
    <span class="text-green">${data.feedback.good}👍</span> •
    <span class="text-red">${data.feedback.bad}👎</span> •
    Kepuasan: <strong>${data.feedback.satisfactionRate}%</strong>
  </div>`;

  html += '<div class="table-responsive"><table class="table table-vcenter table-sm"><thead><tr>';
  html += '<th>Waktu</th><th>Pertanyaan</th><th>Rating</th><th>Provider</th></tr></thead><tbody>';
  data.feedback.items.slice(0, 30).forEach(f => {
    const badge = f.rating === 'good'
      ? '<span class="badge bg-green text-white">👍 Bagus</span>'
      : '<span class="badge bg-red text-white">👎 Kurang</span>';
    html += `<tr>
      <td style="font-size: 11px;">${new Date(f.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
      <td style="font-size: 12px;">${f.question.slice(0, 80)}</td>
      <td>${badge}</td>
      <td style="font-size: 11px;">${f.provider || '-'}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  html += `<div class="text-secondary small mt-2">Menampilkan ${Math.min(data.feedback.items.length, 30)} dari ${data.feedback.total} feedback</div>`;
  el.innerHTML = html;
}

// ============================================================
// RENDER: UNANSWERED
// ============================================================
function renderReportUnanswered(data) {
  const el = document.getElementById('reportUnanswered');
  if (!el) return;

  if (!data.unanswered.items || data.unanswered.items.length === 0) {
    el.innerHTML = '<div class="text-center text-secondary py-3">Tidak ada pertanyaan.</div>';
    return;
  }

  let html = `<div class="alert alert-info mb-2">
    <i class="ti ti-help-circle me-1"></i>
    Total <strong>${data.unanswered.total}</strong> pertanyaan •
    <span class="text-yellow">${data.unanswered.pending} pending</span> •
    <span class="text-green">${data.unanswered.resolved} selesai</span>
  </div>`;

  html += '<div class="table-responsive"><table class="table table-vcenter table-sm"><thead><tr>';
  html += '<th>Pertanyaan</th><th>Ditanya</th><th>Terakhir</th><th>Status</th></tr></thead><tbody>';
  data.unanswered.items.slice(0, 30).forEach(u => {
    const badge = u.resolved
      ? '<span class="badge bg-green text-white">Selesai</span>'
      : '<span class="badge bg-yellow text-white">Pending</span>';
    html += `<tr>
      <td style="font-size: 12px;">${u.question}</td>
      <td><span class="badge bg-blue-lt">${u.count}x</span></td>
      <td style="font-size: 11px;">${new Date(u.lastAsked).toLocaleDateString('id-ID')}</td>
      <td>${badge}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  html += `<div class="text-secondary small mt-2">Menampilkan ${Math.min(data.unanswered.items.length, 30)} dari ${data.unanswered.total} pertanyaan</div>`;
  el.innerHTML = html;
}

// ============================================================
// EXPORT CSV
// ============================================================
async function exportReport(type) {
  const range = getReportRange();
  showToast(`Menyiapkan CSV ${type}...`, 'info');

  try {
    const res = await fetch(`/api/admin/report/export?type=${type}&from=${range.from}&to=${range.to}`, {
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Export ${type} berhasil`, 'success');
  } catch (err) {
    showToast('Gagal export: ' + err.message, 'error');
  }
}

// ============================================================
// PRINT BROWSER
// ============================================================
function printReport() {
  window.print();
}

// ============================================================
// PDF MODAL
// ============================================================
function openPdfModal() {
  if (!currentReportData) {
    showToast('Laporan belum dimuat. Klik Refresh dulu.', 'warning');
    return;
  }

  const range = getReportRange();
  const periodInfo = document.getElementById('pdfPeriodInfo');
  if (periodInfo) {
    periodInfo.textContent = `${new Date(range.from).toLocaleDateString('id-ID')} - ${new Date(range.to).toLocaleDateString('id-ID')}`;
  }

  const modalEl = document.getElementById('pdfModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function updatePdfPreview() {
  const mode = document.querySelector('input[name="pdfMode"]:checked')?.value || 'quick';
  const sectionIds = [
    'pdfSectionOverview', 'pdfSectionSessions', 'pdfSectionFeedback',
    'pdfSectionUnanswered', 'pdfSectionTopTopics', 'pdfSectionCategories',
    'pdfSectionKnowledge', 'pdfSectionMemory', 'pdfSectionProviders',
    'pdfSectionGraph', 'pdfSectionAnalytics', 'pdfSectionSources'
  ];

  const quickSections = [
    'pdfSectionOverview', 'pdfSectionSessions', 'pdfSectionFeedback',
    'pdfSectionUnanswered', 'pdfSectionTopTopics'
  ];

  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (mode === 'quick') {
      el.checked = quickSections.includes(id);
    } else if (mode === 'all') {
      el.checked = true;
    }
  });
}

// ============================================================
// GENERATE PDF
// ============================================================
async function generatePDF() {
  if (!currentReportData) {
    showToast('Laporan belum dimuat', 'warning');
    return;
  }

  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    showToast('Library PDF belum dimuat. Refresh halaman.', 'error');
    return;
  }

  const btn = document.getElementById('pdfGenerateBtn');
  const progress = document.getElementById('pdfProgress');
  const progressText = document.getElementById('pdfProgressText');

  if (btn) btn.disabled = true;
  if (progress) progress.style.display = 'block';
  if (progressText) progressText.textContent = 'Menyiapkan PDF...';

  try {
    // Ambil section yang dicentang
    const sectionMap = {
      overview: 'pdfSectionOverview',
      sessions: 'pdfSectionSessions',
      feedback: 'pdfSectionFeedback',
      unanswered: 'pdfSectionUnanswered',
      topics: 'pdfSectionTopTopics',
      categories: 'pdfSectionCategories',
      knowledge: 'pdfSectionKnowledge',
      memory: 'pdfSectionMemory',
      providers: 'pdfSectionProviders',
      graph: 'pdfSectionGraph',
      analytics: 'pdfSectionAnalytics',
      sources: 'pdfSectionSources'
    };

    const sections = [];
    for (const [key, id] of Object.entries(sectionMap)) {
      if (document.getElementById(id)?.checked) {
        sections.push(key);
      }
    }

    if (sections.length === 0) {
      showToast('Pilih minimal 1 section', 'warning');
      if (btn) btn.disabled = false;
      if (progress) progress.style.display = 'none';
      return;
    }

    if (progressText) progressText.textContent = `Generate PDF (${sections.length} section)...`;

    // Build PDF
    const doc = window.buildLaporanPDF(currentReportData, {
      sections,
      aiName: currentReportData.aiName || 'SIVT AI'
    });

    // Save
    const range = getReportRange();
    const filename = `Laporan-${currentReportData.aiName || 'SIVT'}-${range.from}-to-${range.to}.pdf`;
    doc.save(filename);

    if (progressText) progressText.textContent = 'Selesai!';
    showToast('PDF berhasil diunduh', 'success');

    setTimeout(() => {
      const modalEl = document.getElementById('pdfModal');
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      if (progress) progress.style.display = 'none';
      if (btn) btn.disabled = false;
    }, 1500);

  } catch (err) {
    console.error('[PDF] Error:', err);
    showToast('Gagal generate PDF: ' + err.message, 'error');
    if (progress) progress.style.display = 'none';
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// EXPOSE GLOBAL
// ============================================================
window.loadReport = loadReport;
window.toggleCustomRange = toggleCustomRange;
window.exportReport = exportReport;
window.printReport = printReport;
window.openPdfModal = openPdfModal;
window.generatePDF = generatePDF;
window.updatePdfPreview = updatePdfPreview;
window.getReportRange = getReportRange;

console.log('[LAPORAN] File laporan.js loaded ✓');