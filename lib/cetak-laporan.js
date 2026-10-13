// ============================================================
// lib/cetak-laporan.js
// Generator Laporan PDF — SIVT AI
// Menggunakan jsPDF + AutoTable (client-side di browser)
// ============================================================

/**
 * Format angka dengan pemisah ribuan
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format tanggal Indonesia
 */
function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Escape HTML untuk keamanan
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Buat laporan PDF dengan jsPDF + AutoTable
 * @param {Object} data - Data dari /api/admin/report/summary
 * @param {Object} options - { sections: [...], aiName: 'SIVT AI' }
 */
function buildLaporanPDF(data, options = {}) {
  const { jsPDF } = window.jspdf;
  const sections = options.sections || [];
  const aiName = options.aiName || data.aiName || 'SIVT AI';

  // ===== SETUP DOKUMEN =====
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 15;

  // ===== WARNA =====
  const COLOR_PRIMARY = [13, 71, 161];
  const COLOR_HEADER_BG = [13, 71, 161];
  const COLOR_HEADER_TXT = [255, 255, 255];
  const COLOR_ZEBRA = [245, 248, 252];
  const COLOR_BORDER = [220, 226, 235];
  const COLOR_TEXT = [31, 41, 55];
  const COLOR_TEXT_LIGHT = [107, 114, 128];

  let currentY = MARGIN;

  // ===== FOOTER DI SETIAP HALAMAN =====
  const addPageFooter = (doc) => {
    const pageCount = doc.internal.getNumberOfPages();
    const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(
      `Halaman ${currentPage} dari ${pageCount}`,
      PAGE_W / 2,
      PAGE_H - 8,
      { align: 'center' }
    );
    doc.text(
      `${aiName} — Laporan ${new Date().toLocaleDateString('id-ID')}`,
      MARGIN,
      PAGE_H - 8
    );
    doc.text(
      'Kemantren Tegalrejo, Yogyakarta',
      PAGE_W - MARGIN,
      PAGE_H - 8,
      { align: 'right' }
    );
  };

  // ===== HEADER DOKUMEN (halaman pertama) =====
  const drawMainHeader = () => {
    // Box header
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(0, 0, PAGE_W, 40, 'F');

    // Logo / Judul
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Laporan ${aiName}`, PAGE_W / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistem Informasi Virtual TEGALREJO', PAGE_W / 2, 25, { align: 'center' });

    const period = `${formatDate(data.period.from)} - ${formatDate(data.period.to)}`;
    doc.setFontSize(9);
    doc.text(`Periode: ${period} (${data.period.days} hari)`, PAGE_W / 2, 32, { align: 'center' });

    currentY = 50;
  };

  // ===== HELPER: SECTION TITLE =====
  const addSectionTitle = (title, icon = '') => {
    if (currentY > PAGE_H - 40) {
      doc.addPage();
      currentY = MARGIN;
    }
    doc.setFillColor(...COLOR_HEADER_BG);
    doc.rect(MARGIN, currentY, PAGE_W - (MARGIN * 2), 9, 'F');
    doc.setTextColor(...COLOR_HEADER_TXT);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${icon}${title}`.trim(), MARGIN + 3, currentY + 6);
    currentY += 13;
  };

  // ===== HELPER: KPI CARDS (Ringkasan angka) =====
  const addKpiCards = (items, cols = 4) => {
    const cardW = (PAGE_W - (MARGIN * 2) - ((cols - 1) * 3)) / cols;
    const cardH = 18;
    const rows = Math.ceil(items.length / cols);

    for (let r = 0; r < rows; r++) {
      if (currentY + cardH > PAGE_H - 25) {
        doc.addPage();
        currentY = MARGIN;
      }
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= items.length) break;
        const item = items[idx];
        const x = MARGIN + c * (cardW + 3);

        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(...COLOR_BORDER);
        doc.roundedRect(x, currentY, cardW, cardH, 2, 2, 'FD');

        doc.setFontSize(7);
        doc.setTextColor(...COLOR_TEXT_LIGHT);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label.toUpperCase(), x + 3, currentY + 5);

        doc.setFontSize(13);
        doc.setTextColor(...COLOR_PRIMARY);
        doc.setFont('helvetica', 'bold');
        doc.text(String(item.value), x + 3, currentY + 13);

        if (item.sub) {
          doc.setFontSize(7);
          doc.setTextColor(...COLOR_TEXT_LIGHT);
          doc.setFont('helvetica', 'normal');
          doc.text(String(item.sub), x + 3, currentY + 16.5);
        }
      }
      currentY += cardH + 3;
    }
    currentY += 2;
  };

  // ===== HELPER: TABLE dengan AutoTable =====
  const addTable = (head, body, options = {}) => {
    const startY = currentY;

    doc.autoTable({
      startY: startY,
      head: [head],
      body: body,
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: COLOR_BORDER,
        lineWidth: 0.1,
        textColor: COLOR_TEXT,
        valign: 'middle'
      },
      headStyles: {
        fillColor: COLOR_HEADER_BG,
        textColor: COLOR_HEADER_TXT,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: COLOR_ZEBRA
      },
      ...options,
      didDrawPage: (data) => {
        addPageFooter(doc);
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;
    if (currentY > PAGE_H - 30) {
      doc.addPage();
      currentY = MARGIN;
    }
  };

  // ===== HELPER: PARAGRAPH =====
  const addParagraph = (text, opts = {}) => {
    const fontSize = opts.fontSize || 9;
    const lines = doc.splitTextToSize(text, PAGE_W - (MARGIN * 2) - 4);
    const height = lines.length * (fontSize * 0.4) + 6;

    if (currentY + height > PAGE_H - 25) {
      doc.addPage();
      currentY = MARGIN;
    }

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_TEXT);

    if (opts.boxed) {
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(MARGIN, currentY, PAGE_W - (MARGIN * 2), height, 2, 2, 'FD');
      doc.text(lines, MARGIN + 3, currentY + 5);
    } else {
      doc.text(lines, MARGIN, currentY + 4);
    }

    currentY += height + 2;
  };

  // ============================================================
  // MULAI BUILD
  // ============================================================
  drawMainHeader();

  // ============================================================
  // 1. RINGKASAN UMUM
  // ============================================================
  if (sections.includes('overview')) {
    addSectionTitle('RINGKASAN UMUM');

    addKpiCards([
      { label: 'Total Sesi', value: formatNumber(data.sessions.total), sub: `${data.sessions.messages} pesan` },
      { label: 'Kepuasan', value: `${data.feedback.satisfactionRate}%`, sub: `Bagus: ${data.feedback.good} / Kurang: ${data.feedback.bad}` },
      { label: 'Pertanyaan', value: formatNumber(data.unanswered.total), sub: `${data.unanswered.pending} pending` },
      { label: 'Memori AI', value: formatNumber(data.memory.total), sub: `${data.memory.totalHits} hit` },
      { label: 'Pengetahuan', value: formatNumber(data.knowledge.chunks), sub: `${data.knowledge.topics} topik` },
      { label: 'Provider', value: `${data.providers.active}/${data.providers.total}`, sub: 'aktif/total' },
      { label: 'Graph Nodes', value: formatNumber(data.graph.nodes), sub: `${data.graph.edges} edges` },
      { label: 'Hari Periode', value: String(data.period.days), sub: 'hari aktif' }
    ]);
  }

  // ============================================================
  // 2. STATISTIK SESI
  // ============================================================
  if (sections.includes('sessions')) {
    addSectionTitle('STATISTIK SESI PERCAKAPAN');

    addKpiCards([
      { label: 'Total Sesi', value: formatNumber(data.sessions.total) },
      { label: 'Total Pesan', value: formatNumber(data.sessions.messages) },
      { label: 'Rata-rata Pesan', value: String(data.sessions.avgMessagesPerSession), sub: 'per sesi' }
    ], 3);

    if (data.daily && data.daily.length > 0) {
      const activeDays = data.daily.filter(d =>
        (d.sessions || 0) > 0 || (d.messages || 0) > 0
      );

      if (activeDays.length > 0) {
        addParagraph(`Aktivitas Harian (${activeDays.length} hari dengan aktivitas):`, { fontSize: 9 });
        addTable(
          ['Tanggal', 'Jumlah Sesi', 'Jumlah Pesan'],
          activeDays.map(d => [
            formatDate(d.date),
            formatNumber(d.sessions),
            formatNumber(d.messages || 0)
          ])
        );
      } else {
        addParagraph('Tidak ada aktivitas pada periode ini.', { boxed: true });
      }
    }
  }

  // ============================================================
  // 3. FEEDBACK & KEPUASAN
  // ============================================================
  if (sections.includes('feedback')) {
    addSectionTitle('FEEDBACK & KEPUASAN USER');

    addKpiCards([
      { label: 'Total Feedback', value: formatNumber(data.feedback.total) },
      { label: 'Bagus', value: formatNumber(data.feedback.good) },
      { label: 'Kurang', value: formatNumber(data.feedback.bad) },
      { label: 'Kepuasan', value: `${data.feedback.satisfactionRate}%` }
    ]);

    if (data.feedback.items && data.feedback.items.length > 0) {
      addParagraph(`Detail Feedback (menampilkan ${Math.min(data.feedback.items.length, 25)} dari ${data.feedback.total}):`, { fontSize: 9 });
      addTable(
        ['No', 'Waktu', 'Pertanyaan', 'Rating', 'Provider'],
        data.feedback.items.slice(0, 25).map((f, i) => [
          i + 1,
          formatDateTime(f.timestamp),
          (f.question || '').slice(0, 80),
          f.rating === 'good' ? 'Bagus' : 'Kurang',
          f.provider || '-'
        ]),
        {
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 30 },
            2: { cellWidth: 75 },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 30 }
          }
        }
      );
    } else {
      addParagraph('Belum ada feedback pada periode ini.', { boxed: true });
    }
  }

  // ============================================================
  // 4. PERTANYAAN WARGA
  // ============================================================
  if (sections.includes('unanswered')) {
    addSectionTitle('PERTANYAAN WARGA');

    addKpiCards([
      { label: 'Total', value: formatNumber(data.unanswered.total) },
      { label: 'Pending', value: formatNumber(data.unanswered.pending) },
      { label: 'Selesai', value: formatNumber(data.unanswered.resolved) }
    ], 3);

    if (data.unanswered.items && data.unanswered.items.length > 0) {
      addParagraph(`Daftar Pertanyaan (menampilkan ${Math.min(data.unanswered.items.length, 20)} dari ${data.unanswered.total}):`, { fontSize: 9 });
      addTable(
        ['No', 'Pertanyaan', 'Ditanya', 'Terakhir', 'Status'],
        data.unanswered.items.slice(0, 20).map((u, i) => [
          i + 1,
          (u.question || '').slice(0, 90),
          `${u.count}x`,
          formatDate(u.lastAsked),
          u.resolved ? 'Selesai' : 'Pending'
        ]),
        {
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 100 },
            2: { cellWidth: 18, halign: 'center' },
            3: { cellWidth: 25 },
            4: { cellWidth: 27, halign: 'center' }
          }
        }
      );
    } else {
      addParagraph('Tidak ada pertanyaan pada periode ini.', { boxed: true });
    }
  }

  // ============================================================
  // 5. TOPIK POPULER
  // ============================================================
  if (sections.includes('topics')) {
    addSectionTitle('TOPIK POPULER');

    if (data.topTopics && data.topTopics.length > 0) {
      const maxCount = Math.max(...data.topTopics.map(t => t.count || 1), 1);
      addTable(
        ['Rank', 'Topik', 'Frekuensi', 'Persentase'],
        data.topTopics.slice(0, 20).map((t, i) => [
          `#${i + 1}`,
          t.title || '-',
          `${t.count || 0}x`,
          `${Math.round(((t.count || 0) / maxCount) * 100)}%`
        ]),
        {
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 110 },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 20, halign: 'center' }
          }
        }
      );
    } else {
      addParagraph('Belum ada topik populer pada periode ini.', { boxed: true });
    }
  }

  // ============================================================
  // 6. KATEGORI PERTANYAAN
  // ============================================================
  if (sections.includes('categories')) {
    addSectionTitle('KATEGORI PERTANYAAN');

    if (data.categories && data.categories.length > 0) {
      const total = data.categories.reduce((sum, c) => sum + c.count, 0);
      addTable(
        ['Kategori', 'Jumlah', 'Persentase'],
        data.categories.map(c => [
          c.name,
          formatNumber(c.count),
          `${Math.round((c.count / total) * 100)}%`
        ]),
        {
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 40, halign: 'center' }
          }
        }
      );
    } else {
      addParagraph('Belum ada kategori pada periode ini.', { boxed: true });
    }
  }

  // ============================================================
  // 7. PENGETAHUAN
  // ============================================================
  if (sections.includes('knowledge')) {
    addSectionTitle('PENGETAHUAN');

    addKpiCards([
      { label: 'Total Chunk', value: formatNumber(data.knowledge.chunks) },
      { label: 'Total Topik', value: formatNumber(data.knowledge.topics) },
      { label: 'Total File', value: formatNumber((data.knowledge.files || []).length) }
    ], 3);

    if (data.knowledge.files && data.knowledge.files.length > 0) {
      addParagraph('Daftar File Pengetahuan:', { fontSize: 9 });
      addTable(
        ['No', 'Nama File', 'Ukuran'],
        data.knowledge.files.map((f, i) => [
          i + 1,
          f.name,
          `${(f.size / 1024).toFixed(1)} KB`
        ]),
        {
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 130 },
            2: { cellWidth: 35, halign: 'right' }
          }
        }
      );
    }
  }

  // ============================================================
  // 8. MEMORI AI
  // ============================================================
  if (sections.includes('memory')) {
    addSectionTitle('MEMORI AI');

    addKpiCards([
      { label: 'Total Memori', value: formatNumber(data.memory.total) },
      { label: 'Total Hit', value: formatNumber(data.memory.totalHits) }
    ], 2);

    if (data.memory.topMemory && data.memory.topMemory.length > 0) {
      addParagraph('Top Memori (paling sering diakses):', { fontSize: 9 });
      addTable(
        ['Rank', 'Pertanyaan', 'Hit'],
        data.memory.topMemory.slice(0, 20).map((m, i) => [
          `#${i + 1}`,
          (m.question || '').slice(0, 100),
          `${m.hit || 0}x`
        ]),
        {
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 135 },
            2: { cellWidth: 25, halign: 'center' }
          }
        }
      );
    }
  }

  // ============================================================
  // 9. PROVIDER AI
  // ============================================================
  if (sections.includes('providers')) {
    addSectionTitle('PROVIDER AI');

    addKpiCards([
      { label: 'Total Provider', value: formatNumber(data.providers.total) },
      { label: 'Aktif', value: formatNumber(data.providers.active) }
    ], 2);

    if (data.providers.list && data.providers.list.length > 0) {
      addTable(
        ['No', 'Provider', 'Roles', 'Model', 'Status'],
        data.providers.list.map(p => [
          p.index,
          p.name,
          (p.roles || []).join(', '),
          (p.models || []).length + ' model',
          p.enabled ? 'Aktif' : 'Off'
        ]),
        {
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 55 },
            2: { cellWidth: 55 },
            3: { cellWidth: 30, halign: 'center' },
            4: { cellWidth: 28, halign: 'center' }
          }
        }
      );
    }
  }

  // ============================================================
  // 10. KNOWLEDGE GRAPH
  // ============================================================
  if (sections.includes('graph')) {
    addSectionTitle('KNOWLEDGE GRAPH');

    addKpiCards([
      { label: 'Total Nodes', value: formatNumber(data.graph.nodes) },
      { label: 'Total Edges', value: formatNumber(data.graph.edges) }
    ], 2);

    addParagraph(
      `Knowledge Graph berisi ${formatNumber(data.graph.nodes)} node dan ${formatNumber(data.graph.edges)} relasi antar konsep. Graph ini dibangun dari seluruh dokumen pengetahuan dan diperkaya dengan ekstraksi relasi semantik.`,
      { fontSize: 9, boxed: true }
    );
  }

  // ============================================================
  // 11. ANALYTICS
  // ============================================================
  if (sections.includes('analytics')) {
    addSectionTitle('ANALYTICS');

    const analytics = data.analytics || {};
    addKpiCards([
      { label: 'Total Chat', value: formatNumber(analytics.totalChats || 0) },
      { label: 'Total Jawaban', value: formatNumber(analytics.totalAnswers || 0) },
      { label: 'Refusal', value: formatNumber(analytics.totalRefusals || 0) },
      { label: 'Akurasi', value: `${analytics.accuracyRate || 0}%` }
    ]);
  }

  // ============================================================
  // 12. DISTRIBUSI SUMBER JAWABAN (BARU)
  // ============================================================
  if (sections.includes('sources')) {
    addSectionTitle('DISTRIBUSI SUMBER JAWABAN');

    const analytics = data.analytics || {};
    const memoryHits = analytics.totalMemoryHits || 0;
    const ragHits = analytics.totalRagHits || 0;
    const refusals = analytics.totalRefusals || 0;
    const redirects = analytics.totalOutOfScope || 0;
    const totalChats = analytics.totalChats || 0;

    // ✅ AI murni = totalChats - semua kategori
    const aiPure = Math.max(0, totalChats - memoryHits - ragHits - refusals - redirects);
    const total = memoryHits + ragHits + aiPure + refusals + redirects;

    if (total === 0) {
      addParagraph('Belum ada data sumber jawaban pada periode ini.', { boxed: true });
    } else {
      // KPI Cards
      addKpiCards([
        { label: 'Memory', value: formatNumber(memoryHits), sub: `${total > 0 ? ((memoryHits / total) * 100).toFixed(1) : 0}%` },
        { label: 'RAG', value: formatNumber(ragHits), sub: `${total > 0 ? ((ragHits / total) * 100).toFixed(1) : 0}%` },
        { label: 'AI', value: formatNumber(aiPure), sub: `${total > 0 ? ((aiPure / total) * 100).toFixed(1) : 0}%` },
        { label: 'Refusal', value: formatNumber(refusals), sub: `${total > 0 ? ((refusals / total) * 100).toFixed(1) : 0}%` },
        { label: 'Redirect', value: formatNumber(redirects), sub: `${total > 0 ? ((redirects / total) * 100).toFixed(1) : 0}%` }
      ], 5);

      // Tabel detail
      addParagraph(`Distribusi dari ${formatNumber(total)} interaksi:`, { fontSize: 9 });

      const percentage = (v) => total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0%';

      addTable(
        ['No', 'Sumber Jawaban', 'Jumlah', 'Persentase'],
        [
          [1, 'Memory (dari memori AI)', formatNumber(memoryHits), percentage(memoryHits)],
          [2, 'RAG (dari buku pengetahuan)', formatNumber(ragHits), percentage(ragHits)],
          [3, 'AI (jawaban murni AI)', formatNumber(aiPure), percentage(aiPure)],
          [4, 'Refusal (menolak jawab)', formatNumber(refusals), percentage(refusals)],
          [5, 'Redirect (di luar topik)', formatNumber(redirects), percentage(redirects)],
          ['', 'TOTAL', formatNumber(total), '100%']
        ],
        {
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 90 },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 33, halign: 'right' }
          }
        }
      );
    }
  }

  // ===== FOOTER HALAMAN TERAKHIR =====
  addPageFooter(doc);

  // ===== INFO GENERATED =====
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  const totalPages = doc.internal.getNumberOfPages();
  doc.setPage(totalPages);
  doc.text(
    `Digenerate: ${new Date().toLocaleString('id-ID')}`,
    PAGE_W / 2,
    PAGE_H - 4,
    { align: 'center' }
  );

  return doc;
}

// Export untuk dipakai di frontend
window.buildLaporanPDF = buildLaporanPDF;