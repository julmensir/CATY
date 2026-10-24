import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'db_caty',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD
});

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
function decryptData(text) {
  try {
    const [ivHex, tagHex, dataHex] = text.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (e) { return null; }
}

async function main() {
  console.log('1. Membuat tabel database...');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf-8');
  await pool.query(schema);

  console.log('2. Migrasi Config...');
  if (fs.existsSync('./data/config.json')) {
    const cfg = JSON.parse(fs.readFileSync('./data/config.json', 'utf-8'));
    for (const [key, val] of Object.entries(cfg)) {
      await pool.query(`INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [key, JSON.stringify(val)]);
    }
    fs.renameSync('./data/config.json', './data/config.json.bak');
  }

  console.log('3. Migrasi Providers...');
  if (fs.existsSync('./data/providers.json.enc')) {
    const enc = fs.readFileSync('./data/providers.json.enc', 'utf-8').trim();
    const plain = decryptData(enc);
    if (plain) {
      const list = JSON.parse(plain);
      for (const p of list) {
        await pool.query(`INSERT INTO providers (name, display_name, api_key_enc, roles, models, embedding_models, custom_endpoint, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [p.name, p.displayName || null, p.apiKey, p.roles || ['chat'], p.models || [], p.embeddingModels || [], p.customEndpoint || null, p.enabled !== false]);
      }
      fs.renameSync('./data/providers.json.enc', './data/providers.json.enc.bak');
    }
  }

  console.log('4. Migrasi Memory...');
  if (fs.existsSync('./memory/memory.md')) {
    const content = fs.readFileSync('./memory/memory.md', 'utf-8');
    const blocks = content.split(/^## /m).slice(1);
    for (const block of blocks) {
      const lines = block.split('\n');
      const headerMatch = lines[0].match(/\[(.+?)\]\s*(.+)/);
      if (!headerMatch) continue;
      const getField = (name) => {
        const idx = lines.findIndex(l => l.startsWith(`**${name}:**`));
        if (idx === -1) return '';
        let val = lines[idx].replace(`**${name}:**`, '').trim();
        for (let i = idx + 1; i < lines.length; i++) {
          if (lines[i].startsWith('**') || lines[i].trim() === '') break;
          val += '\n' + lines[i];
        }
        return val.trim();
      };
      await pool.query(`INSERT INTO memory (timestamp, title, question, answer, variants, keywords, hit) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [headerMatch[1], headerMatch[2], getField('Pertanyaan'), getField('Jawaban'), getField('Variasi').split(',').filter(Boolean), getField('Kata kunci').split(',').filter(Boolean), parseInt(getField('Hit')) || 0]);
    }
    fs.renameSync('./memory/memory.md', './memory/memory.md.bak');
  }

  console.log('5. Migrasi Feedback & Analytics...');
  if (fs.existsSync('./data/feedback.json')) {
    const fb = JSON.parse(fs.readFileSync('./data/feedback.json', 'utf-8'));
    for (const f of fb) {
      await pool.query(`INSERT INTO feedback (question, answer, rating, session_id, provider, model, source, timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [f.question, f.answer, f.rating, f.sessionId, f.provider, f.model, f.source, f.timestamp]);
    }
    fs.renameSync('./data/feedback.json', './data/feedback.json.bak');
  }
  
  if (fs.existsSync('./data/analytics.json')) {
    const an = JSON.parse(fs.readFileSync('./data/analytics.json', 'utf-8'));
    for (const [date, stats] of Object.entries(an.dailyStats || {})) {
      for (let i = 0; i < (stats.chats || 0); i++) await pool.query(`INSERT INTO analytics_events (event_type, session_id, ts, date_key) VALUES ('answer', null, $1, $2)`, [new Date(date).getTime(), date]);
      for (let i = 0; i < (stats.good || 0); i++) await pool.query(`INSERT INTO analytics_events (event_type, session_id, ts, date_key) VALUES ('good', null, $1, $2)`, [new Date(date).getTime(), date]);
      for (let i = 0; i < (stats.bad || 0); i++) await pool.query(`INSERT INTO analytics_events (event_type, session_id, ts, date_key) VALUES ('bad', null, $1, $2)`, [new Date(date).getTime(), date]);
    }
    fs.renameSync('./data/analytics.json', './data/analytics.json.bak');
  }

  console.log('6. Migrasi Pertanyaan Tak Terjawab...');
  if (fs.existsSync('./data/unanswered.json')) {
    const uq = JSON.parse(fs.readFileSync('./data/unanswered.json', 'utf-8'));
    for (const u of uq) {
      await pool.query(`INSERT INTO unanswered_questions (id, question, session_id, count, first_asked, last_asked, resolved, resolved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [u.id, u.question, u.sessionId, u.count, u.firstAsked, u.lastAsked, u.resolved, u.resolvedAt]);
    }
    fs.renameSync('./data/unanswered.json', './data/unanswered.json.bak');
  }

  console.log('✅ MIGRASI SELESAI!');
  process.exit(0);
}
main().catch(console.error);