import { query } from './db.js';

const USE_DB = process.env.USE_DB === 'true';

export async function learningInit() {
    if (!USE_DB) {
        console.warn('[LEARNING] USE_DB=false — fitur learning nonaktif.');
        return;
    }
    try {
        await query('SELECT 1 FROM learning_queue LIMIT 1');
        console.log('[LEARNING] Siap menggunakan Database.');
    } catch (err) {
        console.warn('[LEARNING] Tabel learning_queue belum ada:', err.message);
    }
}

function similarity(a, b) {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLen = longer.length;
    const costs = [];
    for (let i = 0; i <= longerLen; i++) costs[i] = i;
    for (let i = 1; i <= shorter.length; i++) {
        let lastValue = i;
        for (let j = 1; j <= longerLen; j++) {
            if (shorter[i - 1] === longer[j - 1]) costs[j] = costs[j - 1];
            else costs[j] = Math.min(costs[j - 1], costs[j], lastValue) + 1;
            lastValue = costs[j];
        }
    }
    return 1 - costs[longerLen] / longerLen;
}

export async function recordUnansweredQuestion(question) {
    if (!USE_DB) return;
    const qNorm = String(question || '').toLowerCase().trim();
    if (!qNorm) return;

    const res = await query('SELECT * FROM learning_queue WHERE resolved = FALSE');
    let existing = null;
    for (const item of res.rows) {
        if (similarity(item.question, qNorm) >= 0.85) {
            existing = item;
            break;
        }
    }

    if (existing) {
        const variants = existing.variants || [];
        if (!variants.includes(qNorm)) {
            variants.push(qNorm);
            if (variants.length > 10) variants.shift();
        }
        await query(
            `UPDATE learning_queue SET count = count + 1, last_asked = NOW(), variants = $1 WHERE id = $2`,
            [variants, existing.id]
        );
    } else {
        await query(
            `INSERT INTO learning_queue (id, question, original, first_asked, last_asked) VALUES ($1,$2,$3,NOW(),NOW())`,
            ['lq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), qNorm, question]
        );
    }

    await query(
        `UPDATE learning_queue SET priority = CASE
            WHEN count >= 10 THEN 'urgent'
            WHEN count >= 5 THEN 'high'
            WHEN count >= 3 THEN 'medium'
            ELSE 'normal'
         END WHERE resolved = FALSE`
    );
}

export async function getLearningQueue(filter = 'all') {
    if (!USE_DB) return [];
    let sql = 'SELECT * FROM learning_queue';
    if (filter === 'pending') sql += ' WHERE resolved = FALSE';
    else if (filter === 'urgent') sql += " WHERE resolved = FALSE AND priority = 'urgent'";
    else if (filter === 'high') sql += " WHERE resolved = FALSE AND (priority = 'urgent' OR priority = 'high')";
    sql += ` ORDER BY CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, count DESC`;
    const res = await query(sql);
    return res.rows;
}

export async function getQueueStats() {
    if (!USE_DB) {
        return { total: 0, pending: 0, resolved: 0, urgent: 0, high: 0, medium: 0 };
    }
    const res = await query(
        `SELECT
            count(*) as total,
            count(*) FILTER (WHERE resolved = false) as pending,
            count(*) FILTER (WHERE priority = 'urgent' AND resolved = false) as urgent,
            count(*) FILTER (WHERE priority = 'high' AND resolved = false) as high,
            count(*) FILTER (WHERE priority = 'medium' AND resolved = false) as medium
         FROM learning_queue`
    );
    const row = res.rows[0];
    return {
        total: parseInt(row.total),
        pending: parseInt(row.pending),
        resolved: parseInt(row.total) - parseInt(row.pending),
        urgent: parseInt(row.urgent),
        high: parseInt(row.high),
        medium: parseInt(row.medium)
    };
}

export async function resolveQuestion(id) {
    if (!USE_DB) return false;
    const res = await query(`UPDATE learning_queue SET resolved = TRUE WHERE id = $1`, [id]);
    return res.rowCount > 0;
}

export async function deleteQuestion(id) {
    if (!USE_DB) return false;
    const res = await query(`DELETE FROM learning_queue WHERE id = $1`, [id]);
    return res.rowCount > 0;
}

export async function clearResolved() {
    if (!USE_DB) return;
    await query(`DELETE FROM learning_queue WHERE resolved = TRUE`);
}

export async function clearAll() {
    if (!USE_DB) return;
    await query(`DELETE FROM learning_queue`);
}