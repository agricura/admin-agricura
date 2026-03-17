-- ══════════════════════════════════════════════════════════════════════════════
-- Tabla: invoices
-- Documentos contables (facturas, boletas, notas de crédito/débito, etc.)
-- ingresados manualmente o importados desde Excel (Agricura Docs).
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.invoices (
  id              uuid        default gen_random_uuid() primary key,

  -- ── Datos del documento ────────────────────────────────────────────────────
  tipo_doc        text,                                   -- "Factura", "Boleta", "Nota de Crédito", "Nota de Débito", "Otro"
  folio           text        not null,                   -- Número de folio del documento
  proveedor       text        not null,                   -- Nombre del proveedor
  rut             text,                                   -- RUT del proveedor
  fecha_emision   date        not null,                   -- Fecha de emisión del documento
  fecha_venc      date        not null,                   -- Fecha de vencimiento

  -- ── Montos ─────────────────────────────────────────────────────────────────
  total_bruto     numeric     default 0,                  -- Monto neto (antes de IVA)
  iva             numeric     default 0,                  -- Monto del IVA
  total_a_pagar   numeric     default 0,                  -- Total a pagar (bruto + IVA)
  moneda          text,                                   -- Moneda (CLP, USD, UF, etc.)

  -- ── Clasificación ──────────────────────────────────────────────────────────
  centro_costo    text,                                   -- Centro de costo
  item            text,                                   -- Categoría contable

  -- ── Detalle de ítems ───────────────────────────────────────────────────────
  items           jsonb       default '[]'::jsonb,        -- Array de {detalle, cantidad, total_item}

  -- ── Pago ───────────────────────────────────────────────────────────────────
  forma_pago      text,                                   -- Forma de pago
  status_pago     text        default 'PENDIENTE',        -- PENDIENTE, PAGADO, PARCIAL, etc.
  fecha_pago      date,                                   -- Fecha efectiva de pago
  medio_pago      text,                                   -- Medio de pago (transferencia, cheque, etc.)
  cuenta_pago     text,                                   -- Cuenta bancaria utilizada

  -- ── Otros ──────────────────────────────────────────────────────────────────
  comentarios     text,                                   -- Notas o comentarios libres
  document_url    text,                                   -- URL pública del documento adjunto (PDF/imagen)

  -- ── Control ────────────────────────────────────────────────────────────────
  created_by      uuid,                                   -- ID del usuario que creó el registro
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists invoices_folio_idx         on public.invoices(folio);
create index if not exists invoices_rut_idx           on public.invoices(rut);
create index if not exists invoices_proveedor_idx     on public.invoices(proveedor);
create index if not exists invoices_fecha_emision_idx on public.invoices(fecha_emision desc);
create index if not exists invoices_fecha_venc_idx    on public.invoices(fecha_venc);
create index if not exists invoices_status_pago_idx   on public.invoices(status_pago);
create index if not exists invoices_rut_folio_idx     on public.invoices(rut, folio);

-- ── Trigger: updated_at automático ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.invoices enable row level security;

drop policy if exists "Authenticated users full access" on public.invoices;
create policy "Authenticated users full access"
  on public.invoices
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
