-- ══════════════════════════════════════════════════════════════════════════════
-- Tabla: fintoc_links
-- Almacena las cuentas bancarias vinculadas via Fintoc.
-- Permite gestionar múltiples cuentas y desvincularlas desde la app.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.fintoc_links (
  id                uuid        default gen_random_uuid() primary key,
  link_token        text        not null unique,           -- Token completo de Fintoc (link_XXX_token_YYY)
  link_id           text        not null,                  -- ID del link (link_XXX) — usado para API calls
  institution_name  text,                                  -- Nombre del banco (ej: "Banco Santander")
  holder_name       text,                                  -- Nombre del titular
  holder_id         text,                                  -- RUT u otro ID del titular
  created_at        timestamptz default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists fintoc_links_link_id_idx on public.fintoc_links(link_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.fintoc_links enable row level security;

drop policy if exists "Authenticated users full access" on public.fintoc_links;
create policy "Authenticated users full access"
  on public.fintoc_links
  for all
  to authenticated
  using (true)
  with check (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES:
-- 1. Abre Supabase Dashboard → SQL Editor
-- 2. Pega este script y ejecuta con "Run"
-- 3. Verifica que la tabla aparece en Table Editor
-- ══════════════════════════════════════════════════════════════════════════════
