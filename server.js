import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Fintoc } from 'fintoc';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// Configuración
const FINTOC_SECRET_KEY = process.env.FINTOC_SECRET_KEY;
const FINTOC_LINK_TOKEN = process.env.FINTOC_LINK_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const fintocClient = new Fintoc(FINTOC_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Extrae link_id de un link_token (formato: link_XXX_token_YYY → link_XXX)
function extractLinkId(linkToken) {
  if (!linkToken) return linkToken;
  const idx = linkToken.indexOf('_token_');
  return idx > 0 ? linkToken.substring(0, idx) : linkToken;
}

// 1. Endpoint para intercambiar public_token por link_token y guardarlo
app.post('/api/fintoc/exchange', async (req, res) => {
  try {
    const { public_token } = req.body;

    // Intercambiar token con Fintoc
    const link = await fintocClient.links.exchange(public_token);

    // Obtener metadata del link (nombre institución, titular)
    const linkId = extractLinkId(link.id);

    // Guardar en Supabase
    const { error } = await supabase.from('fintoc_links').insert({
      link_token: link.id,
      link_id: linkId,
      holder_id: link.holderId ?? null,
      holder_name: link.holderName ?? null,
      institution_name: link.institution?.name ?? null,
    });

    if (error) throw error;

    res.json({ success: true, message: 'Cuenta vinculada exitosamente', link_id: linkId });
  } catch (error) {
    console.error('Error en exchange:', error);
    res.status(500).json({ error: error.message });
  }
});

// 1b. Listar cuentas vinculadas (auto-seed cuenta legacy si tabla vacía)
app.get('/api/fintoc/links', async (req, res) => {
  try {
    await seedLegacyLink();
    const { data, error } = await supabase
      .from('fintoc_links')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) {
    console.error('Error listando links:', error);
    res.status(500).json({ error: error.message });
  }
});

// 1c. Desvincular cuenta bancaria
app.delete('/api/fintoc/links/:link_id', async (req, res) => {
  try {
    const { link_id } = req.params;
    const deleteTransactions = req.body?.deleteTransactions === true;

    // 1. Eliminar el link en Fintoc
    const fintocRes = await fetch(`https://api.fintoc.com/v1/links/${link_id}`, {
      method: 'DELETE',
      headers: { Authorization: FINTOC_SECRET_KEY },
    });
    // 404 = ya no existe en Fintoc, seguimos limpiando local
    if (!fintocRes.ok && fintocRes.status !== 404) {
      const errBody = await fintocRes.text();
      throw new Error(`Fintoc API error ${fintocRes.status}: ${errBody}`);
    }

    // 2. Obtener el link_token antes de borrar (para limpiar transacciones si hace falta)
    const { data: linkData } = await supabase
      .from('fintoc_links')
      .select('link_token')
      .eq('link_id', link_id)
      .single();

    // 3. Eliminar transacciones asociadas si se pidió
    if (deleteTransactions && linkData?.link_token) {
      // Obtener account_ids de este link para borrar sus transacciones
      try {
        const accounts = await fintocClient.accounts.list({ link_token: linkData.link_token, lazy: false });
        const accountIds = accounts.map(a => a.id);
        if (accountIds.length > 0) {
          await supabase.from('bank_transactions').delete().in('account_id', accountIds);
        }
      } catch {
        // Si el link ya fue eliminado en Fintoc, no podemos listar cuentas
        // Intentar borrar por account_number pattern (best effort)
        console.warn('[unlink] No se pudieron obtener cuentas del link eliminado');
      }
    }

    // 4. Eliminar de fintoc_links en Supabase
    const { error: delErr } = await supabase.from('fintoc_links').delete().eq('link_id', link_id);
    if (delErr) throw delErr;

    res.json({ success: true, message: 'Cuenta desvinculada exitosamente' });
  } catch (error) {
    console.error('Error desvinculando:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

// Calcula la fecha 'since' según los días solicitados (máx. 365)
function sinceDate(days) {
  const d = Math.min(Math.max(parseInt(days) || 30, 1), 365);
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// Convierte un movimiento de Fintoc en una fila para bank_transactions
function buildRow(mov, account) {
  return {
    id:               mov.id,
    account_id:       account.id,
    account_name:     account.name,
    account_number:   account.number,
    amount:           mov.amount,
    currency:         account.currency ?? 'CLP',
    date:             mov.post_date ?? mov.transaction_date,
    description:      mov.description ?? null,
    reference_id:     mov.id,
    transaction_type: mov.type ?? null,
    balance:          mov.balance ?? null,
    sender_name:      mov.sender_account?.holder_name ?? null,
    recipient_name:   mov.recipient_account?.holder_name ?? null,
    synced_at:        new Date().toISOString()
  };
}

// Hace upsert en Supabase en lotes de 500. Devuelve { upserted, error }
async function upsertToSupabase(rows) {
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('bank_transactions')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'id', ignoreDuplicates: false });
    if (error) return { upserted, error };
    upserted += Math.min(BATCH, rows.length - i);
  }
  return { upserted, error: null };
}

// Obtiene movimientos de Fintoc para un link_token y los devuelve junto con
// los metadatos de cuenta. También hace upsert automático en Supabase.
async function fetchAndSync(linkToken, days) {
  const since = sinceDate(days);
  const accounts = await fintocClient.accounts.list({ link_token: linkToken, lazy: false });
  const accountsData = [];
  const rows = [];

  for (const account of accounts) {
    const movements = await fintocClient.accounts.movements.list({
      account_id: account.id,
      link_token: linkToken,
      lazy: false,
      since
    });
    for (const mov of movements) rows.push(buildRow(mov, account));
    accountsData.push({
      account_id:     account.id,
      account_name:   account.name,
      account_number: account.number,
      currency:       account.currency,
      movements
    });
  }

  // Auto-upsert: guarda cualquier transacción nueva en Supabase
  if (rows.length > 0) {
    const { error } = await upsertToSupabase(rows);
    if (error) console.error('[sync] Error en upsert a Supabase:', error.message);
    else console.log(`[sync] ${rows.length} transacciones sincronizadas en Supabase (${since}).`);
  }

  return { accountsData, rows, since };
}

// Auto-seed: si fintoc_links está vacía y hay un FINTOC_LINK_TOKEN en .env,
// inserta automáticamente ese link en la tabla (migración de cuenta legacy).
async function seedLegacyLink() {
  if (!FINTOC_LINK_TOKEN) return;
  try {
    const { data } = await supabase.from('fintoc_links').select('id').limit(1);
    if (data?.length > 0) return; // ya hay registros
    const linkId = extractLinkId(FINTOC_LINK_TOKEN);
    // Intentar obtener metadata del link desde Fintoc
    let institutionName = null;
    let holderName = null;
    try {
      const res = await fetch(`https://api.fintoc.com/v1/links/${linkId}`, {
        headers: { Authorization: FINTOC_SECRET_KEY },
      });
      if (res.ok) {
        const linkData = await res.json();
        institutionName = linkData.institution?.name ?? null;
        holderName = linkData.holder_name ?? linkData.username ?? null;
      }
    } catch { /* metadata is optional */ }
    await supabase.from('fintoc_links').upsert({
      link_token: FINTOC_LINK_TOKEN,
      link_id: linkId,
      institution_name: institutionName,
      holder_name: holderName,
    }, { onConflict: 'link_token' });
    console.log(`[seed] Cuenta legacy migrada a fintoc_links (${linkId})`);
  } catch (e) {
    console.warn('[seed] No se pudo migrar cuenta legacy:', e.message);
  }
}

// Helper: obtiene todos los link_tokens activos (de BD + fallback env)
async function getAllLinkTokens() {
  await seedLegacyLink();
  const tokens = [];
  try {
    const { data } = await supabase.from('fintoc_links').select('link_token');
    if (data?.length) tokens.push(...data.map(r => r.link_token));
  } catch (e) {
    console.warn('[sync] No se pudo leer fintoc_links:', e.message);
  }
  // Fallback último recurso
  if (tokens.length === 0 && FINTOC_LINK_TOKEN) tokens.push(FINTOC_LINK_TOKEN);
  return tokens;
}

// 2. Endpoint directo — sincroniza TODAS las cuentas vinculadas
//    Query param: ?days=30  (default 30, máx 365)
app.get('/api/fintoc/movements', async (req, res) => {
  try {
    const tokens = await getAllLinkTokens();
    if (tokens.length === 0) return res.status(500).json({ error: 'No hay cuentas vinculadas ni FINTOC_LINK_TOKEN configurado' });
    const allAccounts = [];
    for (const token of tokens) {
      const { accountsData } = await fetchAndSync(token, req.query.days ?? 30);
      allAccounts.push(...accountsData);
    }
    res.json(allAccounts);
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2b. Endpoint para trigger manual — sincroniza TODAS las cuentas vinculadas
//     Query param: ?days=90  (default 90, máx 365)
app.post('/api/fintoc/sync', async (req, res) => {
  try {
    const tokens = await getAllLinkTokens();
    if (tokens.length === 0) return res.status(500).json({ error: 'No hay cuentas vinculadas ni FINTOC_LINK_TOKEN configurado' });
    let totalRows = 0;
    let totalAccounts = 0;
    let lastSince = '';
    for (const token of tokens) {
      const { rows, since, accountsData } = await fetchAndSync(token, req.query.days ?? 90);
      totalRows += rows.length;
      totalAccounts += accountsData.length;
      lastSince = since;
    }
    res.json({
      synced:   totalRows,
      since:    lastSince,
      accounts: totalAccounts,
      links:    tokens.length,
      message:  `${totalRows} transacciones sincronizadas de ${tokens.length} cuenta(s).`
    });
  } catch (error) {
    console.error('[sync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Endpoint para extraer movimientos por link_id dinámico (desde el widget)
app.get('/api/fintoc/movements/:link_id', async (req, res) => {
  try {
    const { accountsData } = await fetchAndSync(req.params.link_id, req.query.days ?? 30);
    res.json(accountsData);
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
