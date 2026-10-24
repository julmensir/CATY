import { many, query } from './db.js';

export async function loadProvidersFromDB(PROVIDERS, decryptFn, normalizeRoles) {
  const rows = await many(`SELECT id, name, display_name, api_key_enc, roles, models, embedding_models, custom_endpoint, enabled FROM providers ORDER BY id ASC`);
  return rows.map((row, idx) => {
    const apiKey = decryptFn(row.api_key_enc) || '';
    const def = PROVIDERS[row.name];
    return {
      index: idx, id: row.id, name: row.name, displayName: row.display_name || def?.name || row.name,
      apiKey, roles: normalizeRoles(row.roles || ['chat']),
      models: (row.models && row.models.length > 0) ? row.models : (def?.models || []),
      embeddingModels: (row.embedding_models && row.embedding_models.length > 0) ? row.embedding_models : (def?.embeddingModels || []),
      customEndpoint: row.custom_endpoint || null, enabled: row.enabled !== false, isCustom: !!row.custom_endpoint
    };
  });
}

export async function insertProvider(p, encryptFn) {
  const res = await query(`INSERT INTO providers (name, display_name, api_key_enc, roles, models, embedding_models, custom_endpoint, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [p.name, p.displayName || null, encryptFn(p.apiKey), p.roles || ['chat'], p.models || [], p.embeddingModels || [], p.customEndpoint || null, p.enabled !== false]);
  return res.rows[0].id;
}

export async function updateProviderKey(id, apiKey, encryptFn) {
  await query(`UPDATE providers SET api_key_enc=$1, updated_at=NOW() WHERE id=$2`, [encryptFn(apiKey), id]);
}
export async function updateProviderModels(id, models, embeddingModels) {
  await query(`UPDATE providers SET models=$1, embedding_models=$2, updated_at=NOW() WHERE id=$3`, [models, embeddingModels, id]);
}
export async function updateProviderRoles(id, roles) {
  await query(`UPDATE providers SET roles=$1, updated_at=NOW() WHERE id=$2`, [roles, id]);
}
export async function toggleProviderDB(id) {
  const res = await query(`UPDATE providers SET enabled=NOT enabled, updated_at=NOW() WHERE id=$1 RETURNING enabled`, [id]);
  return res.rows[0]?.enabled;
}
export async function deleteProviderDB(id) {
  await query('DELETE FROM providers WHERE id=$1', [id]);
}