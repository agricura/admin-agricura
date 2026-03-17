-- Tabla para registros del libro de ventas del SII
-- Ejecutar en Supabase Dashboard → SQL Editor

CREATE TABLE sii_ventas_records (
  id            BIGSERIAL PRIMARY KEY,
  nro           INTEGER,
  tipo_doc      INTEGER,
  tipo_compra   TEXT,          -- SII usa "Tipo Compra" incluso en ventas
  rut_proveedor TEXT,          -- En ventas es el RUT del cliente
  razon_social  TEXT,
  folio         TEXT,
  fecha_docto   TEXT,
  fecha_recepcion TEXT,
  fecha_acuse   TEXT,
  monto_exento  NUMERIC,
  monto_neto    NUMERIC,
  monto_iva_recuperable    NUMERIC,
  monto_iva_no_recuperable NUMERIC,
  codigo_iva_no_rec        TEXT,
  monto_total   NUMERIC,
  monto_neto_activo_fijo   NUMERIC,
  iva_activo_fijo          NUMERIC,
  iva_uso_comun            NUMERIC,
  impto_sin_derecho_credito NUMERIC,
  iva_no_retenido          NUMERIC,
  tabacos_puros            NUMERIC,
  tabacos_cigarrillos      NUMERIC,
  tabacos_elaborados       NUMERIC,
  nce_nde_fact_compra      NUMERIC,
  codigo_otro_impuesto     TEXT,
  valor_otro_impuesto      NUMERIC,
  tasa_otro_impuesto       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS: solo usuarios autenticados pueden leer/escribir
ALTER TABLE sii_ventas_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do everything on sii_ventas_records"
  ON sii_ventas_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
