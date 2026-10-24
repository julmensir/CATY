import { query } from './db.js';
import { tokenize } from './memory.js';

export async function summarizerInit() { console.log('[SUMMARIZER] Siap menggunakan Database.'); }

export function analyzeKnowledgeTopics(knowledgeChunks) {
    const topicMap = new Map();
    for (const chunk of knowledgeChunks) {
        const title = chunk.text.match(/^#{1,6}\s+(.+)$/m)?.[1] || chunk.text.match(/^\[(.+?)\]/)?.[1] || chunk.source.replace(/\.(md|txt)$/i, '');
        if (!title) continue;
        const key = title.toLowerCase().slice(0, 50);
        if (!topicMap.has(key)) topicMap.set(key, { title, count: 0, chunks: [], keywords: new Set() });
        const entry = topicMap.get(key); entry.count++; entry.chunks.push(chunk.source);
        tokenize(chunk.text).slice(0, 10).forEach(w => entry.keywords.add(w));
    }
    return Array.from(topicMap.values()).map(t => ({ ...t, keywords: Array.from(t.keywords).slice(0, 8) })).sort((a, b) => b.count - a.count);
}

export function generateKnowledgeSummary(knowledgeChunks) {
    const topics = analyzeKnowledgeTopics(knowledgeChunks);
    return { timestamp: new Date().toISOString(), totalChunks: knowledgeChunks.length, totalTopics: topics.length, topTopics: topics.slice(0, 20).map(t => ({ title: t.title, chunks: t.count, keywords: t.keywords })) };
}

export async function generateDailyInsight(feedbackData, learningQueue, unansweredData) {
    const today = new Date().toISOString().slice(0, 10);
    const todayFeedback = feedbackData.filter(f => new Date(f.timestamp).toISOString().startsWith(today));
    const todayGood = todayFeedback.filter(f => f.rating === 'good').length;
    const todayBad = todayFeedback.filter(f => f.rating === 'bad').length;
    const topPending = learningQueue.filter(q => !q.resolved && q.count >= 3).sort((a, b) => b.count - a.count).slice(0, 5);
    const unanswered = unansweredData.filter(u => !u.resolved).length;

    const insight = {
        id: 'ins_' + Date.now(), date: today,
        feedback: { total: todayFeedback.length, good: todayGood, bad: todayBad, satisfaction: todayFeedback.length > 0 ? ((todayGood / todayFeedback.length) * 100).toFixed(1) : 0 },
        pendingTopics: topPending.map(t => ({ question: t.original, count: t.count, priority: t.priority })),
        unansweredCount: unanswered,
        recommendations: generateRecommendations(todayFeedback, topPending, unanswered),
        timestamp: new Date().toISOString()
    };
    return insight;
}

function generateRecommendations(todayFeedback, topPending, unansweredCount) {
    const recs = [];
    if (todayFeedback.length === 0) recs.push({ level: 'info', message: 'Belum ada feedback hari ini. Ajak user kasih rating ya!' });
    const badCount = todayFeedback.filter(f => f.rating === 'bad').length;
    if (badCount >= 3) recs.push({ level: 'warning', message: `Ada ${badCount} jawaban rating buruk hari ini. Cek halaman Feedback.` });
    if (unansweredCount >= 5) recs.push({ level: 'warning', message: `Ada ${unansweredCount} pertanyaan belum terjawab. Tambahkan ke buku pengetahuan!` });
    if (topPending.length > 0) recs.push({ level: 'info', message: `Topik sering ditanya: "${topPending[0].original}" (${topPending[0].count}x).` });
    if (recs.length === 0) recs.push({ level: 'success', message: 'Semua berjalan baik. Pertahankan kualitas layanan! ✅' });
    return recs;
}

export async function getSummaries(limit = 30) {
    // Kita simpan ringkasan di config table dengan key 'summaries'
    const res = await query(`SELECT value FROM config WHERE key = 'summaries'`);
    let summaries = res.rows[0]?.value || [];
    return summaries.slice(-limit).reverse();
}
export async function getLatestSummary() {
    const res = await query(`SELECT value FROM config WHERE key = 'summaries'`);
    let summaries = res.rows[0]?.value || [];
    return summaries[summaries.length - 1] || null;
}