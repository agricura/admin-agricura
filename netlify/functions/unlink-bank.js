// Netlify serverless function — desvincula una cuenta bancaria de Fintoc.
// Requiere env vars: FINTOC_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { FINTOC_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!FINTOC_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 });
  }

  let link_id, deleteTransactions;
  try {
    const body = await req.json();
    link_id = body.link_id;
    deleteTransactions = body.deleteTransactions === true;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  if (!link_id) {
    return new Response(JSON.stringify({ error: 'link_id is required' }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Eliminar el link en Fintoc
    const fintocRes = await fetch(`https://api.fintoc.com/v1/links/${link_id}`, {
      method: 'DELETE',
      headers: { Authorization: FINTOC_SECRET_KEY },
    });
    if (!fintocRes.ok && fintocRes.status !== 404) {
      const errBody = await fintocRes.text();
      throw new Error(`Fintoc API error ${fintocRes.status}: ${errBody}`);
    }

    // 2. Si se pidió borrar transacciones, obtener account_ids primero
    if (deleteTransactions) {
      const { data: linkData } = await supabase
        .from('fintoc_links')
        .select('link_token')
        .eq('link_id', link_id)
        .single();

      if (linkData?.link_token) {
        try {
          // Intentar obtener cuentas del link para borrar transacciones
          const accountsRes = await fetch(`https://api.fintoc.com/v1/accounts?link_token=${linkData.link_token}`, {
            headers: { Authorization: FINTOC_SECRET_KEY },
          });
          if (accountsRes.ok) {
            const accounts = await accountsRes.json();
            const accountIds = accounts.map(a => a.id);
            if (accountIds.length > 0) {
              await supabase.from('bank_transactions').delete().in('account_id', accountIds);
            }
          }
        } catch {
          console.warn('[unlink] Could not fetch accounts for transaction cleanup');
        }
      }
    }

    // 3. Eliminar de fintoc_links
    const { error: delErr } = await supabase.from('fintoc_links').delete().eq('link_id', link_id);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ success: true, message: 'Cuenta desvinculada exitosamente' }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const config = {
  path: '/api/unlink-bank',
};
