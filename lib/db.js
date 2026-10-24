import pg from 'pg';
const { Pool } = pg;

let poolConfig;

if (process.env.DATABASE_URL) {
  // Digunakan saat online (Neon.tech / Back4app)
  const connStr = process.env.DATABASE_URL.includes('?')
    ? process.env.DATABASE_URL + '&uselibpqcompat=true'
    : process.env.DATABASE_URL + '?uselibpqcompat=true';
  poolConfig = {
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  };
} else {
  // Digunakan saat offline (laptop Anda)
  poolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'db_caty',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
  };
}

// Opsi tambahan pool
poolConfig.max = 10;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 5000;

const pool = new Pool(poolConfig);

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) console.warn(`[DB] Slow query (${duration}ms): ${text.slice(0, 100)}`);
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    throw err;
  }
}

export async function one(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

export async function many(text, params) {
  const res = await query(text, params);
  return res.rows;
}

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initSchema() {
  // Fungsi ini hanya dipanggil sekali di startup, 
  // pastikan tabel sudah dibuat oleh migrate.js
  return true;
}

export async function healthCheck() {
  try {
    const res = await pool.query('SELECT NOW() AS now');
    return { ok: true, now: res.rows[0].now };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function closePool() {
  await pool.end();
}

export default pool;