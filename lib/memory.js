// ============================================================
// MEMORY SYSTEM — VERSI FINAL
// - Deteksi topik (KK vs KTP vs Akta) supaya tidak ketuker
// - Pertanyaan identik langsung hit
// - Overlap longgar tapi aman karena sudah difilter topik
// ============================================================

const SYNONYMS = {
    'bikin': 'buat', 'membuat': 'buat', 'bikinin': 'buat', 'buatkan': 'buat',
    'gimana': 'bagaimana', 'caranya': 'cara', 'gmn': 'bagaimana',
    'syrat': 'syarat', 'syaratnya': 'syarat', 'persyaratan': 'syarat',
    'ilang': 'hilang', 'kehilangan': 'hilang', 'raib': 'hilang',
    'sobek': 'rusak',
    'ktpel': 'ktp', 'miskin': 'tidak mampu', 'akte': 'akta',
    'srt': 'surat', 'suratnya': 'surat',
    'waktu': 'jam', 'pukul': 'jam',
    'lokasi': 'alamat', 'tempat': 'alamat',
    'telp': 'telepon', 'tlp': 'telepon', 'kontak': 'telepon',
    'wa': 'whatsapp',
    'harga': 'biaya', 'bayar': 'biaya', 'tarif': 'biaya',
    'free': 'gratis', 'daring': 'online',
    'urus': 'buat', 'ngurus': 'buat'
};

const STOPWORDS = new Set([
    'yang','dan','di','ke','dari','untuk','apa','itu','ini','saya','kamu',
    'adalah','atau','dengan','pada','akan','bisa','ada','tidak','nya',
    'kalau','gimana','bagaimana','mau','ingin','tolong','dong','sih','ya',
    'nih','deh','kok','lah','kan','aku','anda','kita','mereka','saja',
    'juga','masih','sudah','belum','hanya','sama','punya','tapi','tetapi',
    'oleh','buat','dalam','luar','atas','bawah','sini','sana','situ',
    'mohon','minta','kasih','beri','coba','cek','lihat','tanya',
    'kenapa','kog','ko','eh','woi','bang','mas','mbak','terus','lanjut',
    'selanjutnya','kemudian','gitu','gt','gni','gini','yah'
]);

// ============================================================
// TOPIK SPESIFIK — pembeda layanan (KK vs KTP vs Akta dll)
// ============================================================
const TOPIC_KEYWORDS = {
    'kk':         ['kk', 'kartu keluarga', 'keluarga'],
    'ktp':        ['ktp', 'ktpel', 'e-ktp', 'kartu identitas', 'identitas'],
    'akta_lahir': ['akta lahir', 'akte lahir', 'akta kelahiran', 'akte kelahiran', 'kelahiran'],
    'akta_mati':  ['akta kematian', 'akte kematian', 'kematian', 'meninggal', 'wafat'],
    'akta_nikah': ['akta nikah', 'akte nikah', 'akta perkawinan', 'buku nikah', 'nikah', 'kawin'],
    'pindah':     ['pindah', 'domisili', 'mutasi'],
    'usaha':      ['usaha', 'umkm', 'niaga', 'dagang'],
    'surat':      ['surat', 'keterangan', 'pengantar', 'sku', 'skck', 'domisili'],
    'nik':        ['nik'],
    'kia':        ['kia', 'identitas anak']
};

function detectTopics(text) {
    const lower = ' ' + text.toLowerCase() + ' ';
    const found = new Set();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        for (const kw of keywords) {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`\\b${escaped}\\b`, 'i');
            if (re.test(lower)) {
                found.add(topic);
                break;
            }
        }
    }
    return found;
}

export function normalizeWord(w) {
    let word = w.toLowerCase().trim();
    if (SYNONYMS[word]) word = SYNONYMS[word];
    return word;
}

export function stemID(word) {
    let w = word;
    w = w.replace(/^(memper|diper|me|di|ter|ber|pe|se)/, '');
    w = w.replace(/(kan|lah|nya|kah|pun|ku|mu)$/, '');
    return w.length > 2 ? w : word;
}

export function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .map(normalizeWord)
        .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

export function makeBigrams(words) {
    const bigrams = [];
    for (let i = 0; i < words.length - 1; i++) {
        bigrams.push(words[i] + ' ' + words[i + 1]);
    }
    return bigrams;
}

// ============================================================
// SEARCH MEMORY — dengan bonus topik & penalti topik beda
// ============================================================
export function memorySearch(question, memoryItems, minScore = 60) {
    if (!memoryItems || memoryItems.length === 0) {
        return { item: null, score: 0, isConfident: false };
    }

    const qWords = tokenize(question);
    if (qWords.length === 0) {
        return { item: null, score: 0, isConfident: false };
    }

    const qStems = qWords.map(stemID);
    const qBigrams = makeBigrams(qWords);
    const qNorm = question.toLowerCase().trim();
    const qTopics = detectTopics(question);

    let best = null;
    let bestScore = 0;

    for (const m of memoryItems) {
        const allText = [m.question, ...(m.variants || []), ...(m.keywords || [])].join(' ');
        const tokens = tokenize(allText);
        const tokenSet = new Set(tokens);
        const stemSet = new Set(tokens.map(stemID));
        const bigramSet = new Set(makeBigrams(tokens));

        let score = 0;
        for (const w of qWords) if (tokenSet.has(w)) score += 5;
        for (const s of qStems) if (stemSet.has(s)) score += 4;
        for (const bg of qBigrams) if (bigramSet.has(bg)) score += 15;

        // Bonus identik
        const mNorm = m.question.toLowerCase().trim();
        if (qNorm === mNorm) score += 50;
        else if (m.variants && m.variants.some(v => v.toLowerCase().trim() === qNorm)) score += 40;

        // Bonus hit
        score += Math.min(m.hit || 0, 3);

        // === BONUS / PENALTI TOPIK ===
        const memTopics = detectTopics([m.question, ...(m.variants || [])].join(' '));

        const topicOverlap = [...qTopics].filter(t => memTopics.has(t)).length;
        if (topicOverlap > 0) {
            score += 25 * topicOverlap;   // bonus besar kalau topik sama
        } else if (qTopics.size > 0 && memTopics.size > 0) {
            score -= 40;                  // penalti besar kalau topik beda
        }

        if (score > bestScore) {
            bestScore = score;
            best = m;
        }
    }

    return {
        item: best,
        score: bestScore,
        isConfident: bestScore >= minScore
    };
}

// ============================================================
// ADD MEMORY — Jawaban WAJIB LENGKAP
// ============================================================
export function memoryAdd(question, answer, memoryItems, saveThreshold = 40) {
    if (!answer || answer.length < 50) return { added: false };

    if (/belum ada di buku|belum yakin|tidak tahu|tidak ada info|di luar topik|di luar tugas|hubungi petugas langsung/i.test(answer)) {
        return { added: false };
    }

    if (/:\s*$/.test(answer.trim())) return { added: false };
    if (/\.\.\.\s*$/.test(answer.trim())) return { added: false };

    const qNorm = question.toLowerCase().trim();
    const existing = memorySearch(question, memoryItems, saveThreshold);

    if (existing.item && existing.isConfident) {
        // Cek topik: kalau topik beda, jangan update — buat entri baru
        const qTopics = detectTopics(question);
        const memTopics = detectTopics([existing.item.question, ...(existing.item.variants || [])].join(' '));
        const topicOverlap = [...qTopics].filter(t => memTopics.has(t)).length;

        if (qTopics.size > 0 && memTopics.size > 0 && topicOverlap === 0) {
            // Topik beda → buat entri baru (jangan update yang lama)
            // (lanjut ke bawah)
        } else {
            existing.item.hit = (existing.item.hit || 0) + 1;
            if (!existing.item.variants) existing.item.variants = [];
            if (!existing.item.variants.includes(qNorm) && existing.item.question.toLowerCase() !== qNorm) {
                existing.item.variants.push(qNorm);
                if (existing.item.variants.length > 10) {
                    existing.item.variants = existing.item.variants.slice(-10);
                }
            }
            if (answer.length > (existing.item.answer?.length || 0) + 20) {
                existing.item.answer = answer.slice(0, 3000);
            }
            return { added: false, updated: true };
        }
    }

    const title = question.length > 60 ? question.slice(0, 57) + '...' : question;
    memoryItems.push({
        timestamp: new Date().toISOString(),
        title,
        question: qNorm,
        variants: [],
        answer: answer.slice(0, 3000),
        hit: 1,
        keywords: tokenize(question).slice(0, 10)
    });
    return { added: true, updated: false };
}

// ============================================================
// VALIDATE MEMORY RELEVANCE — versi final (aman + longgar)
// ============================================================
export function validateMemoryRelevance(question, memoryItem) {
    if (!memoryItem) return false;

    const qNorm = question.toLowerCase().trim();
    const mNorm = (memoryItem.question || '').toLowerCase().trim();

    // 1. Jalur cepat: identik / match variasi
    if (qNorm === mNorm) return true;
    if (memoryItem.variants?.some(v => v.toLowerCase().trim() === qNorm)) return true;

    // 2. Deteksi topik — PEMISAH UTAMA
    const qTopics = detectTopics(question);
    const memTopics = detectTopics(
        [memoryItem.question, ...(memoryItem.variants || [])].join(' ')
    );

    if (qTopics.size > 0) {
        // User tanya topik spesifik → memory HARUS topik sama
        const intersection = [...qTopics].filter(t => memTopics.has(t));
        if (intersection.length === 0) {
            return false;   // topik beda → TOLAK (kirim ke AI)
        }
    }

    // 3. Overlap kata (longgar karena sudah difilter topik)
    const qWords = tokenize(question);
    if (qWords.length === 0) return false;

    const memTexts = [
        memoryItem.question || '',
        ...(memoryItem.variants || []),
        ...(memoryItem.keywords || [])
    ];
    const allMemTokens = tokenize(memTexts.join(' '));
    const memTokenSet = new Set(allMemTokens);

    let matchCount = 0;
    for (const w of qWords) if (memTokenSet.has(w)) matchCount++;

    const overlapRatio = matchCount / qWords.length;

    // 4. Karena topik sudah cocok, cukup 40% overlap
    if (overlapRatio >= 0.4) return true;
    if (matchCount >= 2) return true;

    return false;
}