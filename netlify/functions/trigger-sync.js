// Netlify serverless function — triggers the Fintoc sync GitHub Action.
// Requires GITHUB_PAT env var set in Netlify dashboard (fine-grained PAT with Actions:write).

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const GITHUB_PAT = process.env.GITHUB_PAT;
  if (!GITHUB_PAT) {
    return new Response(JSON.stringify({ error: 'GITHUB_PAT not configured' }), { status: 500 });
  }

  // Parse optional days parameter
  let days = '90';
  try {
    const body = await req.json();
    if (body.days) days = String(body.days);
  } catch { /* use default */ }

  const repo = 'agricura/admin-agricura';
  const workflow = 'sync_fintoc.yml';
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { days },
    }),
  });

  if (res.status === 204) {
    return new Response(JSON.stringify({
      ok: true,
      message: `Sincronización iniciada (últimos ${days} días). Los datos estarán disponibles en ~1-2 min.`,
    }), { status: 200 });
  }

  const errorText = await res.text();
  return new Response(JSON.stringify({
    ok: false,
    error: `GitHub API error ${res.status}: ${errorText}`,
  }), { status: res.status });
};

export const config = {
  path: '/api/trigger-sync',
};
