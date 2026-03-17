// Netlify serverless function — lista las cuentas bancarias vinculadas.
// Auto-seed: si la tabla está vacía y existe FINTOC_LINK_TOKEN, migra la cuenta legacy.
// Requiere env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
// Opcionales: FINTOC_LINK_TOKEN, FINTOC_SECRET_KEY (para auto-seed)

import { createClient } from '@supabase/supabase-js';

function extractLinkId(linkToken) {
  if (!linkToken) return linkToken;
  const idx = linkToken.indexOf('_token_');
  return idx > 0 ? linkToken.substring(0, idx) : linkToken;
}

async function seedLegacyLink(supabase) {
  const linkToken = process.env.FINTOC_LINK_TOKEN;
  if (!linkToken) return;
  try {
    const { data } = await supabase.from('fintoc_links').select('id').limit(1);
    if (data?.length > 0) return;
    const linkId = extractLinkId(linkToken);
    let institutionName = null;
    let holderName = null;
    try {
      const secretKey = process.env.FINTOC_SECRET_KEY;
      if (secretKey) {
        const res = await fetch(`https://api.fintoc.com/v1/links/${linkId}`, {
          headers: { Authorization: secretKey },
        });
        if (res.ok) {
          const linkData = await res.json();
          institutionName = linkData.institution?.name ?? null;
          holderName = linkData.holder_name ?? linkData.username ?? null;
        }
      }
    } catch { /* metadata is optional */ }
    await supabase.from('fintoc_links').upsert({
      link_token: linkToken,
      link_id: linkId,
      institution_name: institutionName,
      holder_name: holderName,
    }, { onConflict: 'link_token' });
  } catch { /* best effort */ }
}

export default async (req) => {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    await seedLegacyLink(supabase);

    const { data, error } = await supabase
      .from('fintoc_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify(data ?? []), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const config = {
  path: '/api/bank-links',
};
