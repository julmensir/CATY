// ============================================================
// lib/dashboard-stats.js
// Hitung statistik dashboard — SIVT AI
// ============================================================

/**
 * Hitung Topik Populer dari pertanyaan warga
 * @param {Array} unansweredQuestions - List pertanyaan warga
 * @param {Array} learningQueue - List dari learning queue
 * @param {number} limit - Batas jumlah
 * @returns {Array} - [{ title, count, source }]
 */
export function calculateTopTopics(unansweredQuestions = [], learningQueue = [], limit = 10) {
    const topicMap = {};

    // Dari pertanyaan warga yang belum dijawab
    for (const u of unansweredQuestions) {
        const q = (u.question || '').trim();
        if (!q) continue;
        const key = q.toLowerCase();

        if (topicMap[key]) {
            topicMap[key].count += (u.count || 1);
            topicMap[key].lastAsked = u.lastAsked;
        } else {
            topicMap[key] = {
                title: q,
                count: u.count || 1,
                source: 'pertanyaan-warga',
                firstAsked: u.firstAsked,
                lastAsked: u.lastAsked,
                resolved: u.resolved
            };
        }
    }

    // Dari learning queue (kalau ada)
    for (const item of learningQueue) {
        const q = (item.question || item.original || '').trim();
        if (!q) continue;
        const key = q.toLowerCase();

        if (topicMap[key]) {
            topicMap[key].count += (item.count || 1);
        } else {
            topicMap[key] = {
                title: q,
                count: item.count || 1,
                source: 'learning-queue',
                firstAsked: item.firstAsked,
                lastAsked: item.lastAsked,
                resolved: item.resolved
            };
        }
    }

    // Sort by count desc
    const sorted = Object.values(topicMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    return sorted;
}

/**
 * Hitung aktivitas per hari (7 hari terakhir)
 * Sumber data: pertanyaan warga (permanen, tidak terhapus)
 * @param {Array} unansweredQuestions
 * @param {number} days - Jumlah hari
 * @returns {Array} - [{ date, day, sessions, questions, feedback }]
 */
export function calculateDailyActivity(unansweredQuestions = [], feedbackList = [], days = 7) {
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const now = new Date();
    const result = [];

    // ✅ Safety: pastikan days valid
    const safeDays = Math.max(1, Math.min(365, parseInt(days) || 7));

    for (let i = safeDays - 1; i >= 0; i--) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() - i);
        dayDate.setHours(0, 0, 0, 0);

        const dayStart = dayDate.getTime();
        const dayEnd = dayStart + 86400000;

        // ✅ Pertanyaan masuk: fallback ke lastAsked / timestamp kalau firstAsked tidak ada
        const questionsCount = unansweredQuestions.filter(u => {
            const raw = u.firstAsked || u.lastAsked || u.timestamp || 0;
            const t = new Date(raw).getTime();
            return Number.isFinite(t) && t >= dayStart && t < dayEnd;
        }).length;

        // ✅ Resolved: fallback ke lastAsked
        const resolvedCount = unansweredQuestions.filter(u => {
            if (!u.resolved) return false;
            const raw = u.resolvedAt || u.lastAsked || 0;
            const t = new Date(raw).getTime();
            return Number.isFinite(t) && t >= dayStart && t < dayEnd;
        }).length;

        // ✅ Feedback: fallback ke timestamp
        const feedbackCount = feedbackList.filter(f => {
            const t = new Date(f.timestamp || 0).getTime();
            return Number.isFinite(t) && t >= dayStart && t < dayEnd;
        }).length;

        const y = dayDate.getFullYear();
        const m = String(dayDate.getMonth() + 1).padStart(2, '0');
        const d = String(dayDate.getDate()).padStart(2, '0');

        result.push({
            date: `${y}-${m}-${d}`,
            day: dayNames[dayDate.getDay()],
            sessions: questionsCount,
            questions: questionsCount,
            resolved: resolvedCount,
            feedback: feedbackCount
        });
    }

    return result;
}

/**
 * Hitung aktivitas harian dari analytics.dailyStats (PERMANEN)
 * Ini yang PALING AKURAT karena trackEvent() mencatat setiap interaksi
 * ke file analytics.json, jadi tidak hilang walau sesi dihapus 2 jam.
 *
 * @param {Object} dailyStats - { '2026-10-11': { chats: 5, good: 3, bad: 1 }, ... }
 * @param {number} days - Jumlah hari yang mau dihitung
 * @returns {Array} - [{ date, day, sessions, questions, good, bad }]
 */
export function calculateDailyActivityFromAnalytics(dailyStats = {}, days = 7) {
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const now = new Date();
    const result = [];

    // ✅ Safety: pastikan days valid
    const safeDays = Math.max(1, Math.min(365, parseInt(days) || 7));

    for (let i = safeDays - 1; i >= 0; i--) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() - i);
        dayDate.setHours(0, 0, 0, 0);

        const y = dayDate.getFullYear();
        const m = String(dayDate.getMonth() + 1).padStart(2, '0');
        const d = String(dayDate.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;

        // ✅ Ambil dari analytics.dailyStats
        const dayData = dailyStats[dateKey] || {};
        const chats = dayData.chats || 0;           // jumlah pesan
        const sessions = dayData.sessions || 0;     // jumlah sesi unik (dari trackEvent)
        const good = dayData.good || 0;
        const bad = dayData.bad || 0;

        result.push({
            date: dateKey,
            day: dayNames[dayDate.getDay()],
            sessions: sessions,    // ✅ pakai sessions dari data (bukan chats!)
            messages: chats,       // ✅ TAMBAH messages biar PDF bisa tampil
            questions: chats,      // tetap untuk backward compat
            good: good,
            bad: bad
        });
    }

    return result;
}


/**
 * Hitung kategori pertanyaan dari pertanyaan warga + feedback
 * @param {Array} unansweredQuestions
 * @param {Array} feedbackList
 * @returns {Array} - [{ name, count }]
 */
export function calculateCategories(unansweredQuestions = [], feedbackList = []) {
    const CATEGORIES = {
        'Administrasi': ['ktp', 'kk', 'akta', 'surat', 'domisili', 'pindah', 'kelahiran', 'kematian', 'nikah', 'kawin'],
        'Layanan Sosial': ['bansos', 'bantuan', 'blt', 'pkh', 'sembako', 'disabilitas', 'lansia', 'fotokopi', 'biaya'],
        'Kesehatan': ['sehat', 'puskesmas', 'posyandu', 'vaksin', 'imunisasi', 'bpjs'],
        'Pendidikan': ['sekolah', 'beasiswa', 'pendidikan', 'siswa', 'madrasah'],
        'Pajak & Retribusi': ['pajak', 'pbb', 'retribusi', 'bayar', 'iuran'],
        'Perizinan': ['izin', 'usaha', 'ho', 'imb', 'reklame'],
        'Pengaduan': ['aduan', 'lapor', 'keluhan', 'masalah', 'komplain'],
        'Lainnya': []
    };

    const categoryCount = {};
    Object.keys(CATEGORIES).forEach(k => categoryCount[k] = 0);

    const classifyText = (text) => {
        const q = (text || '').toLowerCase();
        let matched = false;
        for (const [cat, kws] of Object.entries(CATEGORIES)) {
            if (cat === 'Lainnya') continue;
            if (kws.some(kw => q.includes(kw))) {
                categoryCount[cat] += 1;
                matched = true;
                break;
            }
        }
        if (!matched) categoryCount['Lainnya'] += 1;
    };

    for (const u of unansweredQuestions) {
        // Tambahkan weight berdasarkan count
        const weight = u.count || 1;
        for (let i = 0; i < weight; i++) classifyText(u.question);
    }

    for (const f of feedbackList) {
        classifyText(f.question);
    }

    return Object.entries(categoryCount)
        .filter(([_, v]) => v > 0)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Hitung sumber jawaban dari analytics
 */
export function calculateSourceDistribution(analytics = {}) {
    return {
        memory: analytics.totalMemoryHits || 0,
        rag: analytics.totalRagHits || 0,
        ai: Math.max(0, (analytics.totalAnswers || 0) - (analytics.totalMemoryHits || 0) - (analytics.totalRagHits || 0)),
        refusal: analytics.totalRefusals || 0,
        redirect: analytics.totalOutOfScope || 0
    };
}