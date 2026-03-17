-- ══════════════════════════════════════════════════════════════════════════════
-- Tabla: bank_transactions
-- Guarda los movimientos bancarios obtenidos desde Fintoc.
-- Permite vincularlos con documentos de "Agricura Docs" (invoices)
-- y "datos sii" (sii_compras_records) para conciliación bancaria.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.bank_transactions (

  -- ── Campos de Fintoc ────────────────────────────────────────────────────────
  id               text        primary key,          -- ID único de Fintoc (ej: "mo_abc123")
  account_id       text,                             -- ID de cuenta Fintoc
  account_name     text,                             -- Nombre de la cuenta (ej: "Cuenta Corriente")
  account_number   text,                             -- Número de cuenta bancaria
  amount           bigint      not null,             -- Monto en CLP; positivo=ingreso, negativo=egreso
  currency         text        not null default 'CLP',
  date             date        not null,             -- Fecha de la transacción
  description      text,                             -- Descripción del movimiento
  reference_id     text,                             -- Referencia interna de Fintoc
  transaction_type text,                             -- transfer_in, transfer_out, charge, etc.
  balance          bigint,                           -- Saldo post-transacción (si lo entrega Fintoc)
  sender_name      text,                             -- Nombre del emisor (transferencias)
  recipient_name   text,                             -- Nombre del receptor (transferencias)

  -- ── Vinculación con documentos ──────────────────────────────────────────────
  -- Referencia a tabla "invoices" (Agricura Docs)
  invoice_id       text,                             -- UUID o ID del documento en invoices
  -- Referencia a tabla "sii_compras_records" (compras SII)
  sii_folio        text,                             -- Folio del documento SII relacionado
  sii_tipo_doc     integer,                          -- Tipo de documento SII (ej: 33=Factura)

  -- ── Conciliación manual ─────────────────────────────────────────────────────
  status           text        not null default 'pendiente'
                               check (status in ('pendiente','conciliado','revisado','ignorado')),
  notes            text,                             -- Notas del operador
  conciliado_por   text,                             -- Email del usuario que concilió

  -- ── Control ─────────────────────────────────────────────────────────────────
  synced_at        timestamptz not null default now(),   -- Última vez que se sincronizó desde Fintoc
  updated_at       timestamptz not null default now()    -- Última modificación del registro
);

-- ── Índices ────────────────────────────────────────────────────────────────────
create index if not exists bank_transactions_date_idx        on public.bank_transactions(date desc);
create index if not exists bank_transactions_status_idx      on public.bank_transactions(status);
create index if not exists bank_transactions_invoice_id_idx  on public.bank_transactions(invoice_id);
create index if not exists bank_transactions_sii_folio_idx   on public.bank_transactions(sii_folio);
create index if not exists bank_transactions_account_idx     on public.bank_transactions(account_number);
create index if not exists bank_transactions_amount_idx      on public.bank_transactions(amount);

-- ── Trigger: updated_at automático ────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bank_transactions_updated_at on public.bank_transactions;
create trigger bank_transactions_updated_at
  before update on public.bank_transactions
  for each row execute function public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────────
alter table public.bank_transactions enable row level security;

-- Usuarios autenticados pueden leer y escribir (igual que las demás tablas del proyecto)
drop policy if exists "Authenticated users full access" on public.bank_transactions;
create policy "Authenticated users full access"
  on public.bank_transactions
  for all
  to authenticated
  using (true)
  with check (true);

-- El service_role del backend (server.js) puede hacer todo sin restricciones RLS
-- (el service_role bypasses RLS por defecto en Supabase, no necesita policy explícita)

-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES:
-- 1. Abre Supabase Dashboard → SQL Editor
-- 2. Pega este script y ejecuta con "Run"
-- 3. Verifica que la tabla aparece en Table Editor
-- ══════════════════════════════════════════════════════════════════════════════
