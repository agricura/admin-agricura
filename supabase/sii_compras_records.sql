-- ══════════════════════════════════════════════════════════════════════════════
-- Tabla: sii_compras_records
-- Registros del libro de compras del SII, importados desde archivo Excel (.xlsx).
-- Se vinculan con invoices mediante rut_proveedor + folio.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.sii_compras_records (
  id                         bigserial   primary key,

  -- ── Datos principales ──────────────────────────────────────────────────────
  nro                        integer,                     -- Número de fila en el libro
  tipo_doc                   integer,                     -- Código tipo documento (33=Factura, 34, 56, 61, etc.)
  tipo_compra                text,                        -- Tipo de compra
  rut_proveedor              text,                        -- RUT del proveedor
  razon_social               text,                        -- Razón social del proveedor
  folio                      text,                        -- Folio del documento

  -- ── Fechas ─────────────────────────────────────────────────────────────────
  fecha_docto                text,                        -- Fecha del documento (formato yyyy/mm/dd)
  fecha_recepcion            text,                        -- Fecha de recepción
  fecha_acuse                text,                        -- Fecha de acuse de recibo

  -- ── Montos principales ─────────────────────────────────────────────────────
  monto_exento               numeric,                     -- Monto exento de IVA
  monto_neto                 numeric,                     -- Monto neto
  monto_iva_recuperable      numeric,                     -- IVA recuperable
  monto_iva_no_recuperable   numeric,                     -- IVA no recuperable
  codigo_iva_no_rec          text,                        -- Código de IVA no recuperable
  monto_total                numeric,                     -- Monto total

  -- ── Activo fijo / uso común ────────────────────────────────────────────────
  monto_neto_activo_fijo     numeric,                     -- Neto de activo fijo
  iva_activo_fijo            numeric,                     -- IVA de activo fijo
  iva_uso_comun              numeric,                     -- IVA de uso común
  impto_sin_derecho_credito  numeric,                     -- Impuesto sin derecho a crédito

  -- ── Retenciones y otros ────────────────────────────────────────────────────
  iva_no_retenido            numeric,                     -- IVA no retenido
  tabacos_puros              numeric,                     -- Impuesto tabacos puros
  tabacos_cigarrillos        numeric,                     -- Impuesto cigarrillos
  tabacos_elaborados         numeric,                     -- Impuesto tabacos elaborados
  nce_nde_fact_compra        numeric,                     -- NCE o NDE sobre factura de compra

  -- ── Otros impuestos ────────────────────────────────────────────────────────
  codigo_otro_impuesto       text,                        -- Código de otro impuesto
  valor_otro_impuesto        numeric,                     -- Valor de otro impuesto
  tasa_otro_impuesto         text,                        -- Tasa de otro impuesto

  -- ── Control ────────────────────────────────────────────────────────────────
  created_at                 timestamptz default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists sii_compras_records_folio_idx         on public.sii_compras_records(folio);
create index if not exists sii_compras_records_rut_idx           on public.sii_compras_records(rut_proveedor);
create index if not exists sii_compras_records_fecha_idx         on public.sii_compras_records(fecha_docto desc);
create index if not exists sii_compras_records_tipo_doc_idx      on public.sii_compras_records(tipo_doc);
create index if not exists sii_compras_records_rut_folio_idx     on public.sii_compras_records(rut_proveedor, folio);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.sii_compras_records enable row level security;

drop policy if exists "Authenticated users full access" on public.sii_compras_records;
create policy "Authenticated users full access"
  on public.sii_compras_records
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
