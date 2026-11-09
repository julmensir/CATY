import { query } from './db.js';

const USE_DB = process.env.USE_DB === 'true';

export async function feedbackInit() {
    if (!USE_DB) {
        console.warn('[FEEDBACK] USE_DB=false — fitur feedback nonaktif.');
        return;
    }
    try {
        await query('SELECT 1 FROM feedback LIMIT 1');
        console.log('[FEEDBACK] Siap menggunakan Database.');
    } catch (err) {
        console.warn('[FEEDBACK] Tabel feedback belum ada:', err.message);
    }
}

export async function addFeedback(question, answer, rating, sessionId, meta = {}) {
    if (!USE_DB) return null;
    const item = {
        question: String(question || '').slice(0, 500),
        answer: String(answer || '').slice(0, 1000),
        rating,
        sessionId: sessionId || 'unknown',
        provider: meta.provider || 'unknown',
        model: meta.model || 'unknown',
        source: meta.source || 'ai',
        timestamp: new Date()
    };
    await query(
        `INSERT INTO feedback (question, answer, rating, session_id, provider, model, source, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [item.question, item.answer, item.rating, item.sessionId, item.provider, item.model, item.source, item.timestamp]
    );
    return item;
}

export async function trackEvent(type, sessionId = null) {
    if (!USE_DB) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`;
    await query(
        `INSERT INTO analytics_events (event_type, session_id, ts, date_key) VALUES ($1,$2,$3,$4)`,
        [type, sessionId, now.getTime(), dateKey]
    );
}

export async function getStats() {
    if (!USE_DB) {
        return {
            feedback: { total: 0, good: 0, bad: 0, satisfactionRate: 0 },
            analytics: {
                totalChats: 0, totalAnswers: 0, totalRefusals: 0,
                totalMemoryHits: 0, totalRagHits: 0, totalOutOfScope: 0,
                accuracyRate: 0
            },
            dailyStats: {}
        };
    }

    const fbRes = await query('SELECT rating, COUNT(*) as c FROM feedback GROUP BY rating');
    let good = 0, bad = 0;
    fbRes.rows.forEach(r => {
        if (r.rating === 'good') good = parseInt(r.c);
        if (r.rating === 'bad') bad = parseInt(r.c);
    });
    const total = good + bad;
    const satisfaction = total > 0 ? ((good / total) * 100).toFixed(1) : 0;

    const anRes = await query('SELECT event_type, COUNT(*) as c FROM analytics_events GROUP BY event_type');
    const an = { totalChats: 0, totalAnswers: 0, totalRefusals: 0, totalMemoryHits: 0, totalRagHits: 0, totalOutOfScope: 0 };
    let totalEvents = 0;
    anRes.rows.forEach(r => {
        const count = parseInt(r.c);
        totalEvents += count;
        if (r.event_type === 'refusal') an.totalRefusals = count;
        if (r.event_type === 'memory') an.totalMemoryHits = count;
        if (r.event_type === 'rag') an.totalRagHits = count;
        if (r.event_type === 'out_of_scope') an.totalOutOfScope = count;
        if (r.event_type === 'answer') an.totalAnswers = count;
    });
    an.totalChats = totalEvents;

    const dailyRes = await query(
        `SELECT date_key, event_type, COUNT(*) as c FROM analytics_events GROUP BY date_key, event_type`
    );
    const dailyStats = {};
    dailyRes.rows.forEach(r => {
        if (!dailyStats[r.date_key]) dailyStats[r.date_key] = { chats: 0, good: 0, bad: 0, sessions: 0 };
        dailyStats[r.date_key].chats += parseInt(r.c);
    });
    const fbDaily = await query(
        `SELECT TO_CHAR(timestamp, 'YYYY-MM-DD') as date_key, rating, COUNT(*) as c FROM feedback GROUP BY date_key, rating`
    );
    fbDaily.rows.forEach(r => {
        if (!dailyStats[r.date_key]) dailyStats[r.date_key] = { chats: 0, good: 0, bad: 0, sessions: 0 };
        if (r.rating === 'good') dailyStats[r.date_key].good += parseInt(r.c);
        if (r.rating === 'bad') dailyStats[r.date_key].bad += parseInt(r.c);
    });

    return {
        feedback: { total, good, bad, satisfactionRate: parseFloat(satisfaction) },
        analytics: {
            ...an,
            accuracyRate: an.totalChats > 0
                ? Math.max(0, Math.round(((an.totalChats - an.totalRefusals) / an.totalChats) * 100))
                : 0
        },
        dailyStats
    };
}

export async function getBadExamples(limit = 20) {
    if (!USE_DB) return [];
    const res = await query(`SELECT * FROM feedback WHERE rating='bad' ORDER BY timestamp DESC LIMIT $1`, [limit]);
    return res.rows;
}

export async function getGoodExamples(limit = 20) {
    if (!USE_DB) return [];
    const res = await query(`SELECT * FROM feedback WHERE rating='good' ORDER BY timestamp DESC LIMIT $1`, [limit]);
    return res.rows;
}

export async function getFeedbackList(limit = 100) {
    if (!USE_DB) return [];
    const res = await query(`SELECT * FROM feedback ORDER BY timestamp DESC LIMIT $1`, [limit]);
    return res.rows;
}

export async function clearFeedback() {
    if (!USE_DB) return;
    await query('DELETE FROM feedback');
}

export async function clearAnalytics() {
    if (!USE_DB) return;
    await query('DELETE FROM analytics_events');
}

export async function getDailyFeedbackStats(days = 7) {
    if (!USE_DB) {
        const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            result.push({
                date: d.toISOString().slice(0, 10),
                day: dayNames[d.getDay()],
                good: 0, bad: 0, total: 0
            });
        }
        return result;
    }

    const res = await query(
        `SELECT TO_CHAR(timestamp, 'YYYY-MM-DD') as date, rating, COUNT(*) as c
         FROM feedback
         WHERE timestamp >= NOW() - INTERVAL '${days} days'
         GROUP BY date, rating`
    );
    const map = {};
    res.rows.forEach(r => {
        if (!map[r.date]) map[r.date] = { good: 0, bad: 0, total: 0 };
        map[r.date][r.rating] = parseInt(r.c);
        map[r.date].total += parseInt(r.c);
    });
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({
            date: key,
            day: dayNames[d.getDay()],
            good: map[key]?.good || 0,
            bad: map[key]?.bad || 0,
            total: map[key]?.total || 0
        });
    }
    return result;
}