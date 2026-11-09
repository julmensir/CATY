import pg from 'pg';
const { Pool } = pg;

let pool = null;
let poolError = null;

function buildPoolConfig() {
  if (process.env.DATABASE_URL) {
    const connStr = process.env.DATABASE_URL.includes('?')
      ? process.env.DATABASE_URL + '&uselibpqcompat=true'
      : process.env.DATABASE_URL + '?uselibpqcompat=true';
    return {
      connectionString: connStr,
      ssl: { rejectUnauthorized: false }
    };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'db_caty',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
  };
}

function getPool() {
  if (poolError) throw poolError;
  if (!pool) {
    const config = buildPoolConfig();
    config.max = 10;
    config.idleTimeoutMillis = 30000;
    config.connectionTimeoutMillis = 5000;
    pool = new Pool(config);
    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err.message);
    });
  }
  return pool;
}

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.slice(0, 100)}`);
    }
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
  const client = await getPool().connect();
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
  return true;
}

export async function healthCheck() {
  try {
    const res = await getPool().query('SELECT NOW() AS now');
    return { ok: true, now: res.rows[0].now };
  } catch (err) {
    poolError = err;
    return { ok: false, error: err.message };
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { query, one, many, transaction, healthCheck, closePool };