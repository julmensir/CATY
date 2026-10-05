// ============================================================
// KNOWLEDGE GRAPH ENGINE — Otak Graph untuk SIVT AI
// - Ringan, cepat, in-memory, persisten
// - Ekstraksi entitas via NLP lokal (tanpa API)
// - Graph traversal untuk konteks RAG
// - Auto-save ke JSON, auto-load saat restart
// - Support semantic triples dari LLM
// - Support incremental update dari jawaban admin
// - VERSI BERSIH: stopwords lengkap + filter ketat
// ============================================================

import fs from 'fs';
import path from 'path';
import Graph from 'graphology';
import compromise from 'compromise';

// ============================================================
// KONFIGURASI
// ============================================================
const MAX_NODES = 20000;
const MAX_EDGES = 60000;
const AUTO_SAVE_INTERVAL = 60000;
const MAX_NEIGHBORS_PER_QUERY = 30;
const MIN_ENTITY_LENGTH = 3;
const MAX_ENTITY_LENGTH = 60;

// ============================================================
// STOPWORDS LENGKAP — Bahasa Indonesia + Inggris umum
// ============================================================
const STOP_ENTITIES = new Set([
    // Kata sambung & umum
    'dan', 'atau', 'jika', 'yang', 'untuk', 'dengan', 'dari', 'ke', 'di',
    'pada', 'adalah', 'akan', 'sudah', 'belum', 'juga', 'saja', 'sangat',
    'bisa', 'dapat', 'harus', 'wajib', 'oleh', 'ini', 'itu', 'ada', 'tidak',
    'bukan', 'serta', 'agar', 'supaya', 'karena', 'sejak', 'melalui',
    'setelah', 'sebelum', 'saat', 'ketika', 'namun', 'tetapi', 'tapi',
    'sedang', 'masih', 'hanya', 'dll', 'dsb', 'dst', 'nya', 'kah', 'lah',
    'pun', 'para', 'suatu', 'sebuah', 'setiap', 'semua', 'beberapa',
    'banyak', 'lain', 'lainnya', 'hal', 'cara', 'orang', 'waktu', 'tempat',
    'hari', 'tahun', 'bulan', 'kata', 'bagian', 'nomor', 'pihak', 'info',
    'informasi', 'keterangan', 'catatan', 'penjelasan', 'bantuan', 'help',
    'syarat', 'ketentuan', 'aturan', 'prosedur', 'proses', 'langkah',
    'tahap', 'alur', 'hasil', 'akhir', 'awal', 'ya', 'tersedia', 'lengkap',
    'selesai', 'dibubuhi', 'melampirkan', 'mengisi', 'dimana', 'kapan',
    'mengapa', 'siapa', 'bagaimana', 'apa', 'berapa', 'mana',
    // Kata kerja umum yang tidak jadi topik
    'membuat', 'mengurus', 'mengambil', 'memberikan', 'mendapatkan',
    'membawa', 'mengisi', 'melampirkan', 'menyerahkan', 'menerima',
    'meminta', 'menjadi', 'melakukan', 'menggunakan', 'memerlukan',
    'mengajukan', 'dilakukan', 'dibuat', 'diisi', 'dibawa', 'diserahkan',
    'digunakan', 'diperlukan', 'diberikan', 'disetujui', 'ditandatangani',
    'diketahui', 'dibubuhi', 'terdapat', 'terdiri', 'termasuk', 'meliputi',
    // Kata ganti & tunjuk
    'saya', 'kamu', 'anda', 'kami', 'kita', 'mereka', 'dia', 'beliau',
    'sini', 'sana', 'situ', 'begini', 'begitu', 'demikian',
    // Inggris umum (untuk jaga-jaga)
    'the', 'and', 'or', 'if', 'then', 'a', 'an', 'is', 'are', 'was',
    'were', 'be', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with',
    // Lainnya
    'setempat', 'tersebut', 'berikut', 'berikutnya', 'sebelah', 'depan',
    'belakang', 'atas', 'bawah', 'kiri', 'kanan', 'luar', 'dalam',
    'baru', 'lama', 'kecil', 'besar', 'baik', 'buruk', 'penting',
]);

// ============================================================
// FILTER NODE — Ketat, hanya topik bermakna yang lolos
// ============================================================
const ONLY_SYMBOLS = /^[\s\-_=*#~`|+.,;:!?()\[\]{}<>/\\'"“”‘’]+$/;
const ONLY_NUMBERS = /^\d+$/;
const LETTER_NUMBER_SHORT = /^[a-z]\s*\d+$/;      // "a 1", "b 2", "e 12"
const ROMAN_NUMERAL = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/;
const MULTI_SPACE = /\s{2,}/;
const HAS_LETTER = /[a-z\u00C0-\u024F]/;

function isValidEntity(entity) {
    if (!entity || typeof entity !== 'string') return false;

    const e = entity.trim().toLowerCase();

    // Panjang
    if (e.length < MIN_ENTITY_LENGTH) return false;
    if (e.length > MAX_ENTITY_LENGTH) return false;

    // Hanya simbol / angka / strip
    if (ONLY_SYMBOLS.test(e)) return false;
    if (ONLY_NUMBERS.test(e)) return false;
    if (ROMAN_NUMERAL.test(e)) return false;
    if (LETTER_NUMBER_SHORT.test(e)) return false;

    // Harus mengandung huruf
    if (!HAS_LETTER.test(e)) return false;

    // Jangan ada double space (artinya potongan aneh)
    if (MULTI_SPACE.test(e)) return false;

    // Stopword
    if (STOP_ENTITIES.has(e)) return false;

    // Terlalu banyak karakter non-alfanumerik (misal "------")
    const alnum = (e.match(/[a-z0-9]/g) || []).length;
    const total = e.length;
    if (alnum / total < 0.5) return false;

    return true;
}

// ============================================================
// KELAS UTAMA
// ============================================================
class GraphEngine {
    constructor(options = {}) {
        this.graph = new Graph({ multi: false, type: 'undirected' });
        this.savePath = options.savePath || null;
        this.dirty = false;
        this.stats = {
            totalAdded: 0,
            lastSaveAt: null,
            loadTimeMs: 0
        };

        if (this.savePath) {
            this._autoSaveTimer = setInterval(() => this._autoSave(), AUTO_SAVE_INTERVAL);
            if (this._autoSaveTimer.unref) this._autoSaveTimer.unref();
        }
    }

    // ============================================================
    // NORMALISASI
    // ============================================================
    _normalize(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .replace(/[^\w\s\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ============================================================
    // VALIDASI (pakai fungsi global)
    // ============================================================
    _isValidEntity(entity) {
        return isValidEntity(this._normalize(entity));
    }

    // ============================================================
    // EKSTRAKSI ENTITAS
    // - Ambil noun (kata benda) via compromise
    // - Filter ketat
    // - Tambah juga frasa noun (noun phrase) jika ada
    // ============================================================
    _extractEntities(text) {
        if (!text || typeof text !== 'string') return [];

        try {
            const doc = compromise(text);
            const entities = new Set();

            // 1. Noun tunggal
            const nouns = doc.nouns().out('array');
            for (const noun of nouns) {
                const norm = this._normalize(noun);
                if (this._isValidEntity(norm)) {
                    entities.add(norm);
                }
            }

            // 2. Noun phrase (kalau ada 2-3 kata benda berurutan)
            try {
                const phrases = doc.match('#Noun+').out('array');
                for (const phrase of phrases) {
                    const norm = this._normalize(phrase);
                    // Batasi 2-4 kata
                    const wordCount = norm.split(' ').length;
                    if (wordCount >= 2 && wordCount <= 4 && this._isValidEntity(norm)) {
                        entities.add(norm);
                    }
                }
            } catch (_) {}

            return [...entities];
        } catch (err) {
            console.warn('[GRAPH] Ekstraksi gagal:', err.message);
            return [];
        }
    }

    // ============================================================
    // EKSTRAKSI RELASI (co-occurrence dalam 1 kalimat)
    // ============================================================
    _extractRelations(text, maxRelationsPerSentence = 5) {
        if (!text) return [];

        try {
            const doc = compromise(text);
            const sentences = doc.sentences().out('array');
            const relations = [];

            for (const sentence of sentences) {
                const sDoc = compromise(sentence);
                const nouns = sDoc.nouns().out('array')
                    .map(n => this._normalize(n))
                    .filter(n => this._isValidEntity(n));

                const uniqueNouns = [...new Set(nouns)];

                for (let i = 0; i < uniqueNouns.length - 1; i++) {
                    for (let j = i + 1; j < uniqueNouns.length && j <= i + 2; j++) {
                        if (relations.length >= maxRelationsPerSentence) break;
                        relations.push({
                            source: uniqueNouns[i],
                            target: uniqueNouns[j],
                            weight: 1
                        });
                    }
                }
            }
            return relations;
        } catch (err) {
            return [];
        }
    }

    // ============================================================
    // TAMBAH PENGETAHUAN (dari file .md)
    // ============================================================
    addKnowledge(text, sourceId = 'unknown') {
        if (!text || text.length < 10) return { added: 0, edges: 0 };

        const entities = this._extractEntities(text);
        if (entities.length === 0) return { added: 0, edges: 0 };

        let nodesAdded = 0;

        for (const entity of entities) {
            if (this.graph.order >= MAX_NODES) break;

            if (!this.graph.hasNode(entity)) {
                this.graph.addNode(entity, {
                    label: entity,
                    sources: new Set([sourceId]),
                    degree: 0,
                    createdAt: Date.now()
                });
                nodesAdded++;
            } else {
                const attrs = this.graph.getNodeAttributes(entity);
                if (!attrs.sources) attrs.sources = new Set();
                attrs.sources.add(sourceId);
            }
        }

        const relations = this._extractRelations(text);
        let edgesAdded = 0;

        for (const rel of relations) {
            if (this.graph.size >= MAX_EDGES) break;
            if (!this.graph.hasNode(rel.source) || !this.graph.hasNode(rel.target)) continue;
            if (rel.source === rel.target) continue;

            if (this.graph.hasEdge(rel.source, rel.target)) {
                const cw = this.graph.getEdgeAttribute(rel.source, rel.target, 'weight') || 1;
                this.graph.setEdgeAttribute(rel.source, rel.target, 'weight', cw + 1);
            } else {
                this.graph.addEdge(rel.source, rel.target, {
                    weight: rel.weight,
                    source: sourceId,
                    createdAt: Date.now()
                });
                edgesAdded++;
            }
        }

        if (nodesAdded > 0 || edgesAdded > 0) {
            this.dirty = true;
            this.stats.totalAdded++;
        }

        return { added: nodesAdded, edges: edgesAdded };
    }

    // ============================================================
    // TAMBAH TRIPLES SEMANTIK (dari LLM)
    // ============================================================
    addTriples(triples, sourceId = 'llm') {
        if (!Array.isArray(triples) || triples.length === 0) {
            return { added: 0, edges: 0 };
        }

        let nodesAdded = 0;
        let edgesAdded = 0;

        for (const t of triples) {
            if (!t.subject || !t.predicate || !t.object) continue;

            const subj = this._normalize(t.subject);
            const pred = this._normalize(t.predicate);
            const obj = this._normalize(t.object);

            if (!this._isValidEntity(subj) || !this._isValidEntity(obj)) continue;

            // Tambah node subject
            if (!this.graph.hasNode(subj)) {
                if (this.graph.order >= MAX_NODES) break;
                this.graph.addNode(subj, {
                    label: t.subject,
                    sources: new Set([sourceId]),
                    degree: 0,
                    createdAt: Date.now()
                });
                nodesAdded++;
            } else {
                const attrs = this.graph.getNodeAttributes(subj);
                if (!attrs.sources) attrs.sources = new Set();
                attrs.sources.add(sourceId);
            }

            // Tambah node object
            if (!this.graph.hasNode(obj)) {
                if (this.graph.order >= MAX_NODES) break;
                this.graph.addNode(obj, {
                    label: t.object,
                    sources: new Set([sourceId]),
                    degree: 0,
                    createdAt: Date.now()
                });
                nodesAdded++;
            } else {
                const attrs = this.graph.getNodeAttributes(obj);
                if (!attrs.sources) attrs.sources = new Set();
                attrs.sources.add(sourceId);
            }

            if (this.graph.size >= MAX_EDGES) break;
            if (subj === obj) continue;

            // Tambah edge
            if (this.graph.hasEdge(subj, obj)) {
                const cw = this.graph.getEdgeAttribute(subj, obj, 'weight') || 1;
                this.graph.setEdgeAttribute(subj, obj, 'weight', cw + 2);

                const curLabel = this.graph.getEdgeAttribute(subj, obj, 'label') || '';
                if (pred && !curLabel.includes(pred)) {
                    const newLabel = curLabel ? `${curLabel}, ${pred}` : pred;
                    this.graph.setEdgeAttribute(subj, obj, 'label', newLabel.slice(0, 100));
                }
            } else {
                this.graph.addEdge(subj, obj, {
                    weight: 2,
                    label: pred,
                    source: sourceId,
                    semantic: true,
                    createdAt: Date.now()
                });
                edgesAdded++;
            }
        }

        if (nodesAdded > 0 || edgesAdded > 0) this.dirty = true;

        return { added: nodesAdded, edges: edgesAdded };
    }

    // ============================================================
    // UPDATE DARI JAWABAN ADMIN
    // ============================================================
    updateFromAnswer(question, answer, category = '') {
        if (!question || !answer) return { nodes: 0, edges: 0 };

        const combined = `${question} ${answer} ${category || ''}`;
        const sourceId = `admin:${Date.now()}`;

        const result = this.addKnowledge(combined, sourceId);
        this.dirty = true;

        try {
            const entities = this._extractEntities(combined);
            for (const entity of entities) {
                if (this.graph.hasNode(entity)) {
                    const deg = this.graph.degree(entity);
                    this.graph.setNodeAttribute(entity, 'degree', deg);
                }
            }
        } catch (_) {}

        console.log(`[GRAPH] updateFromAnswer: +${result.added} nodes, +${result.edges} edges`);
        return result;
    }

    // ============================================================
    // HAPUS NODE
    // ============================================================
    removeNode(nodeId) {
        if (!this.graph.hasNode(nodeId)) return false;
        this.graph.dropNode(nodeId);
        this.dirty = true;
        return true;
    }

    // ============================================================
    // QUERY KONTEKS (untuk RAG di /api/chat)
    // ============================================================
    queryContext(question, options = {}) {
        const maxDepth = options.maxDepth || 1;
        const maxNodes = options.maxNodes || 20;

        if (!question || this.graph.order === 0) {
            return { context: '', nodes: [], matchedEntities: [] };
        }

        const queryEntities = this._extractEntities(question);
        if (queryEntities.length === 0) {
            return { context: '', nodes: [], matchedEntities: [] };
        }

        const matchedNodes = new Set();
        const nodeKeys = this.graph.nodes();

        for (const qe of queryEntities) {
            if (this.graph.hasNode(qe)) {
                matchedNodes.add(qe);
                continue;
            }
            for (const node of nodeKeys) {
                if (node.includes(qe) || qe.includes(node)) {
                    if (qe.length >= 4 && node.length >= 4) {
                        matchedNodes.add(node);
                        if (matchedNodes.size >= maxNodes) break;
                    }
                }
            }
            if (matchedNodes.size >= maxNodes) break;
        }

        if (matchedNodes.size === 0) {
            return { context: '', nodes: [], matchedEntities: queryEntities };
        }

        const visited = new Set();
        const queue = [...matchedNodes].map(id => ({ id, depth: 0 }));
        const collected = [];

        while (queue.length > 0 && collected.length < maxNodes) {
            const { id, depth } = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            if (!this.graph.hasNode(id)) continue;

            const attrs = this.graph.getNodeAttributes(id);
            const neighbors = this.graph.neighbors(id);

            collected.push({
                id,
                label: attrs.label || id,
                degree: neighbors.length,
                sources: attrs.sources ? [...attrs.sources] : [],
                neighbors: neighbors.slice(0, MAX_NEIGHBORS_PER_QUERY)
            });

            if (depth < maxDepth) {
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push({ id: neighbor, depth: depth + 1 });
                    }
                }
            }
        }

        const contextLines = [];
        for (const node of collected.slice(0, maxNodes)) {
            const neighborLabels = node.neighbors
                .filter(n => this.graph.hasNode(n))
                .map(n => this.graph.getNodeAttributes(n).label)
                .slice(0, 8);

            if (neighborLabels.length > 0) {
                contextLines.push(`• ${node.label} → terkait dengan: ${neighborLabels.join(', ')}`);
            } else {
                contextLines.push(`• ${node.label}`);
            }
        }

        return {
            context: contextLines.join('\n'),
            nodes: collected.map(n => n.label),
            matchedEntities: queryEntities
        };
    }

    // ============================================================
    // STATISTIK
    // ============================================================
    getStats() {
        return {
            nodes: this.graph.order,
            edges: this.graph.size,
            totalAdded: this.stats.totalAdded,
            lastSaveAt: this.stats.lastSaveAt,
            loadTimeMs: this.stats.loadTimeMs,
            dirty: this.dirty
        };
    }

    // ============================================================
    // SIMPAN — format rapi (indent 2 spasi)
    // ============================================================
    save() {
        if (!this.savePath) return false;
        try {
            const exportData = {
                version: 2,
                savedAt: new Date().toISOString(),
                stats: {
                    nodes: this.graph.order,
                    edges: this.graph.size
                },
                nodes: [],
                edges: []
            };

            this.graph.forEachNode((node, attrs) => {
                exportData.nodes.push({
                    id: node,
                    label: attrs.label,
                    sources: attrs.sources ? [...attrs.sources] : [],
                    degree: attrs.degree || 0,
                    createdAt: attrs.createdAt
                });
            });

            // Sort nodes A-Z biar rapi
            exportData.nodes.sort((a, b) => a.id.localeCompare(b.id));

            this.graph.forEachEdge((edge, attrs, source, target) => {
                exportData.edges.push({
                    source,
                    target,
                    weight: attrs.weight || 1,
                    label: attrs.label || '',
                    semantic: attrs.semantic || false,
                    sourceFile: attrs.source
                });
            });

            // Sort edges by weight desc
            exportData.edges.sort((a, b) => (b.weight || 0) - (a.weight || 0));

            // 🔥 JSON.stringify dengan indent 2 = file rapi
            const tmpPath = this.savePath + '.tmp';
            fs.writeFileSync(tmpPath, JSON.stringify(exportData, null, 2), 'utf-8');
            fs.renameSync(tmpPath, this.savePath);

            this.dirty = false;
            this.stats.lastSaveAt = new Date().toISOString();
            return true;
        } catch (err) {
            console.error('[GRAPH] Gagal save:', err.message);
            return false;
        }
    }

    // ============================================================
    // LOAD
    // ============================================================
    load() {
        if (!this.savePath || !fs.existsSync(this.savePath)) return false;
        const t0 = Date.now();

        try {
            const raw = fs.readFileSync(this.savePath, 'utf-8');
            const data = JSON.parse(raw);

            if (!data.nodes || !Array.isArray(data.nodes)) return false;

            this.graph = new Graph({ multi: false, type: 'undirected' });

            let skippedNodes = 0;
            for (const node of data.nodes) {
                if (this.graph.order >= MAX_NODES) break;

                // 🔥 Validasi ulang saat load (kalau file lama masih kotor)
                if (!isValidEntity(node.id)) {
                    skippedNodes++;
                    continue;
                }

                this.graph.addNode(node.id, {
                    label: node.label || node.id,
                    sources: new Set(node.sources || []),
                    degree: node.degree || 0,
                    createdAt: node.createdAt || Date.now()
                });
            }

            let skippedEdges = 0;
            for (const edge of data.edges) {
                if (this.graph.size >= MAX_EDGES) break;
                if (!this.graph.hasNode(edge.source) || !this.graph.hasNode(edge.target)) {
                    skippedEdges++;
                    continue;
                }
                if (this.graph.hasEdge(edge.source, edge.target)) continue;

                this.graph.addEdge(edge.source, edge.target, {
                    weight: edge.weight || 1,
                    label: edge.label || '',
                    semantic: edge.semantic || false,
                    source: edge.sourceFile || 'unknown'
                });
            }

            this.stats.loadTimeMs = Date.now() - t0;
            this.dirty = false;

            console.log(`[GRAPH] Loaded: ${this.graph.order} nodes, ${this.graph.size} edges (${this.stats.loadTimeMs}ms)`);
            if (skippedNodes > 0 || skippedEdges > 0) {
                console.log(`[GRAPH] Skipped: ${skippedNodes} invalid nodes, ${skippedEdges} invalid edges`);
            }
            return true;
        } catch (err) {
            console.error('[GRAPH] Gagal load:', err.message);
            this.graph = new Graph({ multi: false, type: 'undirected' });
            return false;
        }
    }

    // ============================================================
    // AUTO SAVE
    // ============================================================
    _autoSave() {
        if (this.dirty) this.save();
    }

    destroy() {
        if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
        if (this.dirty) this.save();
    }
}

export default GraphEngine;