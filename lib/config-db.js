import { many, query, transaction } from './db.js';

export async function loadConfigFromDB(DEFAULT_CONFIG) {
  const rows = await many('SELECT key, value FROM config');
  const cfg = { ...DEFAULT_CONFIG };
  for (const row of rows) cfg[row.key] = row.value;
  cfg.theme = { ...DEFAULT_CONFIG.theme, ...(cfg.theme || {}) };
  return cfg;
}

export async function saveConfigToDB(CONFIG) {
  const keys = Object.keys(CONFIG);
  await transaction(async (client) => {
    for (const key of keys) {
      await client.query(
        `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(CONFIG[key])]
      );
    }
  });
}