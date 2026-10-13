// ============================================================
// FEEDBACK SYSTEM — Track user satisfaction & AI accuracy
// ============================================================
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

let feedbackData = [];
let analyticsData = {
    totalChats: 0,
    totalAnswers: 0,
    totalRefusals: 0,
    totalMemoryHits: 0,
    totalRagHits: 0,
    totalOutOfScope: 0,
    dailyStats: {} 
};

// ============================================================
// HELPER: Local date key (WIB), bukan UTC
// ============================================================
function getLocalDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============================================================
// SESSION TRACKER (in-memory, reset tiap ganti hari)
// Cuma simpan ID sesi hari ini biar tahu sesi unik.
// Ukuran RAM: ~50 byte per sesi. 1000 sesi = 50 KB. Ringan.
// ============================================================
let _todaySessionIds = new Set();
let _todayDateKey = getLocalDateKey();

function _checkDayRollover() {
    const today = getLocalDateKey();
    if (today !== _todayDateKey) {
        _todaySessionIds = new Set();
        _todayDateKey = today;
    }
}

// ============================================================
// INIT & SAVE
// ============================================================
export function feedbackInit() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    if (fs.existsSync(FEEDBACK_FILE)) {
        try { feedbackData = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8')); } catch { feedbackData = []; }
    }
    if (fs.existsSync(ANALYTICS_FILE)) {
        try { analyticsData = { ...analyticsData, ...JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8')) }; } catch {}
    }

    // ✅ Restore session tracker dari dailyStats hari ini
    const today = getLocalDateKey();
    _todayDateKey = today;
    _todaySessionIds = new Set();
    const todayCount = analyticsData.dailyStats?.[today]?.sessions || 0;
    if (todayCount > 0) {
        for (let i = 0; i < todayCount; i++) {
            _todaySessionIds.add(`__restored_${i}`);
        }
    }

    console.log(`[FEEDBACK] ${feedbackData.length} feedback dimuat.`);
}

export function feedbackSave() {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbackData.slice(-5000), null, 2), 'utf-8');
}

export function analyticsSave() {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analyticsData, null, 2), 'utf-8');
}

// ============================================================
// FEEDBACK
// ============================================================
export function addFeedback(question, answer, rating, sessionId, meta = {}) {
    const item = {
        id: 'fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        question: question.slice(0, 500),
        answer: answer.slice(0, 1000),
        rating, // 'good' | 'bad'
        sessionId: sessionId || 'unknown',
        provider: meta.provider || 'unknown',
        model: meta.model || 'unknown',
        source: meta.source || 'ai', // 'ai' | 'memory' | 'refusal' | 'out_of_scope'
        timestamp: new Date().toISOString()
    };
    feedbackData.push(item);

    // Update daily stats
    const day = getLocalDateKey();
    if (!analyticsData.dailyStats[day]) {
        analyticsData.dailyStats[day] = { chats: 0, good: 0, bad: 0, sessions: 0 };
    }
    if (rating === 'good') analyticsData.dailyStats[day].good++;
    else if (rating === 'bad') analyticsData.dailyStats[day].bad++;

    feedbackSave();
    analyticsSave();
    return item;
}

// ============================================================
// ANALYTICS
// ============================================================
export function trackEvent(type, sessionId = null) {
    analyticsData.totalChats++;
    if (type === 'refusal') analyticsData.totalRefusals++;
    if (type === 'memory') analyticsData.totalMemoryHits++;
    if (type === 'rag') analyticsData.totalRagHits++;
    if (type === 'out_of_scope') analyticsData.totalOutOfScope++;
    if (type === 'answer') analyticsData.totalAnswers++;

    // ✅ Pakai LOCAL date (WIB)
    const day = getLocalDateKey();
    if (!analyticsData.dailyStats[day]) {
        analyticsData.dailyStats[day] = { chats: 0, good: 0, bad: 0, sessions: 0 };
    }
    analyticsData.dailyStats[day].chats++;

    // ✅ Hitung sesi unik hari ini (RAM only, tidak disimpan ke file)
    if (sessionId) {
        _checkDayRollover();
        if (!_todaySessionIds.has(sessionId)) {
            _todaySessionIds.add(sessionId);
            analyticsData.dailyStats[day].sessions = _todaySessionIds.size;
        }
    }

    analyticsSave();
}

export function getStats() {
    const good = feedbackData.filter(f => f.rating === 'good').length;
    const bad = feedbackData.filter(f => f.rating === 'bad').length;
    const total = feedbackData.length;
    const satisfaction = total > 0 ? ((good / total) * 100).toFixed(1) : 0;

    return {
        feedback: {
            total,
            good,
            bad,
            satisfactionRate: parseFloat(satisfaction)
        },
        analytics: {
            totalChats: analyticsData.totalChats,
            totalAnswers: analyticsData.totalAnswers,
            totalRefusals: analyticsData.totalRefusals,
            totalMemoryHits: analyticsData.totalMemoryHits,
            totalRagHits: analyticsData.totalRagHits,
            totalOutOfScope: analyticsData.totalOutOfScope,
            // ✅ Akurasi = (Total Chat - Refusal) / Total Chat × 100
            // Rumus lama salah karena totalRefusals bisa > totalAnswers
            accuracyRate: analyticsData.totalChats > 0
                ? Math.max(0, Math.round(
                    ((analyticsData.totalChats - analyticsData.totalRefusals) / analyticsData.totalChats) * 100
                  ))
                : 0
        },
        dailyStats: analyticsData.dailyStats
    };
}

export function getBadExamples(limit = 20) {
    return feedbackData
        .filter(f => f.rating === 'bad')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

export function getGoodExamples(limit = 20) {
    return feedbackData
        .filter(f => f.rating === 'good')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

export function getFeedbackList(limit = 100) {
    return feedbackData
        .slice()
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
}

export function clearFeedback() {
    feedbackData = [];
    feedbackSave();
}

export function clearAnalytics() {
    analyticsData = {
        totalChats: 0,
        totalAnswers: 0,
        totalRefusals: 0,
        totalMemoryHits: 0,
        totalRagHits: 0,
        totalOutOfScope: 0,
        dailyStats: {}
    };
    analyticsSave();
}

// ============================================================
// DAILY FEEDBACK STATS — Untuk chart Tren 7 Hari
// ============================================================
/**
 * Hitung feedback harian (good & bad) untuk N hari terakhir
 * @param {number} days - Jumlah hari (default 7)
 * @returns {Array} - [{ date, day, good, bad, total }]
 */
export function getDailyFeedbackStats(days = 7) {
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const now = new Date();
    const result = [];

    const safeDays = Math.max(1, Math.min(365, parseInt(days) || 7));

    for (let i = safeDays - 1; i >= 0; i--) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() - i);
        dayDate.setHours(0, 0, 0, 0);

        const y = dayDate.getFullYear();
        const m = String(dayDate.getMonth() + 1).padStart(2, '0');
        const d = String(dayDate.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;

        // ✅ Prioritaskan dari analyticsData.dailyStats (sudah tersimpan)
        const dayStats = analyticsData.dailyStats?.[dateKey] || {};
        let good = dayStats.good || 0;
        let bad = dayStats.bad || 0;

        // ✅ Fallback: hitung dari feedbackData kalau dailyStats kosong
        if (good === 0 && bad === 0) {
            const dayStart = dayDate.getTime();
            const dayEnd = dayStart + 86400000;

            const dayFeedback = feedbackData.filter(f => {
                const t = new Date(f.timestamp).getTime();
                return Number.isFinite(t) && t >= dayStart && t < dayEnd;
            });
            good = dayFeedback.filter(f => f.rating === 'good').length;
            bad = dayFeedback.filter(f => f.rating === 'bad').length;
        }

        result.push({
            date: dateKey,
            day: dayNames[dayDate.getDay()],
            good,
            bad,
            total: good + bad
        });
    }

    return result;
}