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

// 1. Endpoint para intercambiar public_token por link_token y guardarlo
app.post('/api/fintoc/exchange', async (req, res) => {
  try {
    const { public_token } = req.body;

    // Intercambiar token con Fintoc
    const link = await fintocClient.links.exchange(public_token);
    
    // Guardar en Supabase
    const { error } = await supabase.from('fintoc_links').insert({
      link_token: link.id,
      holder_id: link.holderId,
      institution_id: link.institution.id,
      institution_name: link.institution.name
    });

    if (error) throw error;

    res.json({ success: true, message: 'Cuenta vinculada exitosamente', link_id: link.id });
  } catch (error) {
    console.error('Error en exchange:', error);
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

// 2. Endpoint directo — usa el link token guardado en .env
//    Obtiene movimientos de Fintoc, los guarda automáticamente en Supabase
//    y los devuelve al cliente. Solo para desarrollo/uso local.
//    Query param: ?days=30  (default 30, máx 365)
app.get('/api/fintoc/movements', async (req, res) => {
  try {
    if (!FINTOC_LINK_TOKEN) return res.status(500).json({ error: 'FINTOC_LINK_TOKEN no configurado en .env' });
    const { accountsData } = await fetchAndSync(FINTOC_LINK_TOKEN, req.query.days ?? 30);
    res.json(accountsData);
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2b. Endpoint para trigger manual desde la UI (equivalente a ejecutar el script Python)
//     Query param: ?days=90  (default 90, máx 365)
app.post('/api/fintoc/sync', async (req, res) => {
  try {
    if (!FINTOC_LINK_TOKEN) return res.status(500).json({ error: 'FINTOC_LINK_TOKEN no configurado en .env' });
    const { rows, since, accountsData } = await fetchAndSync(FINTOC_LINK_TOKEN, req.query.days ?? 90);
    res.json({
      synced:   rows.length,
      since,
      accounts: accountsData.length,
      message:  `${rows.length} transacciones sincronizadas en Supabase.`
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
