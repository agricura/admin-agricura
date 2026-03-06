import React, { useState, useRef } from 'react';
import { FileText, X, Upload, CheckCircle, AlertCircle } from 'lucide-react';

// Fallback por si alguna celda numérica viene como string con puntos de miles
const parseNum = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  const cleaned = String(val).replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};

// Convierte fecha Excel (serial, Date obj, "dd-mm-yy", "dd-mm-yyyy") → "yyyy/mm/dd"
const parseExcelDate = (val) => {
  if (!val && val !== 0) return '';
  // JS Date object (XLSX.js a veces retorna esto directamente)
  if (val instanceof Date) {
    if (isNaN(val)) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  }
  // Serial numérico de Excel
  if (typeof val === 'number') {
    const utc = (val - 25569) * 86400000;
    const d = new Date(utc);
    if (!isNaN(d)) {
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dy = String(d.getUTCDate()).padStart(2, '0');
      return `${y}/${mo}/${dy}`;
    }
  }
  const s = String(val).trim();
  // dd-mm-yy o dd-mm-yyyy
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m1) {
    let [, dd, mm, yy] = m1;
    if (yy.length === 2) yy = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
    return `${yy}/${mm.padStart(2,'0')}/${dd.padStart(2,'0')}`;
  }
  // yyyy-mm-dd → yyyy/mm/dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  return s; // devuelve tal cual si no se puede interpretar
};

const DATE_FIELDS = new Set(['fecha_docto', 'fecha_recepcion', 'fecha_acuse']);

// Mapeo encabezado Excel → campo BD
const COL_MAP = {
  'Nro':                             'nro',
  'Tipo Doc':                        'tipo_doc',
  'Tipo Compra':                     'tipo_compra',
  'RUT Proveedor':                   'rut_proveedor',
  'Razon Social':                    'razon_social',
  'Folio':                           'folio',
  'Fecha Docto':                     'fecha_docto',
  'Fecha Recepcion':                 'fecha_recepcion',
  'Fecha Acuse':                     'fecha_acuse',
  'Monto Exento':                    'monto_exento',
  'Monto Neto':                      'monto_neto',
  'Monto IVA Recuperable':           'monto_iva_recuperable',
  'Monto Iva No Recuperable':        'monto_iva_no_recuperable',
  'Codigo IVA No Rec.':              'codigo_iva_no_rec',
  'Monto Total':                     'monto_total',
  'Monto Neto Activo Fijo':          'monto_neto_activo_fijo',
  'IVA Activo Fijo':                 'iva_activo_fijo',
  'IVA uso Comun':                   'iva_uso_comun',
  'Impto. Sin Derecho a Credito':    'impto_sin_derecho_credito',
  'IVA No Retenido':                 'iva_no_retenido',
  'Tabacos Puros':                   'tabacos_puros',
  'Tabacos Cigarrillos':             'tabacos_cigarrillos',
  'Tabacos Elaborados':              'tabacos_elaborados',
  'NCE o NDE sobre Fact. de Compra': 'nce_nde_fact_compra',
  'Codigo Otro Impuesto':            'codigo_otro_impuesto',
  'Valor Otro Impuesto':             'valor_otro_impuesto',
  'Tasa Otro Impuesto':              'tasa_otro_impuesto',
};

const NUM_FIELDS = new Set([
  'nro','tipo_doc','monto_exento','monto_neto','monto_iva_recuperable',
  'monto_iva_no_recuperable','monto_total','monto_neto_activo_fijo',
  'iva_activo_fijo','iva_uso_comun','impto_sin_derecho_credito',
  'iva_no_retenido','tabacos_puros','tabacos_cigarrillos',
  'tabacos_elaborados','nce_nde_fact_compra','valor_otro_impuesto',
]);

const SIIImportModal = ({ supabase, onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('append'); // 'append' | 'replace'
  const cancelledRef = useRef(false);

  const handleCancel = () => {
    cancelledRef.current = true;
    setStatus('⚠ Proceso cancelado por el usuario.');
  };

  const parseXLSX = (arrayBuffer) => {
    if (!window.XLSX) throw new Error('Librería Excel no cargada, recarga la página');
    const workbook = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (rawRows.length === 0) throw new Error('La hoja de Excel está vacía');
    const parsed = rawRows.map(raw => {
      const row = {};
      Object.entries(raw).forEach(([header, value]) => {
        const field = COL_MAP[String(header).trim()];
        if (!field) return;
        if (DATE_FIELDS.has(field))        row[field] = parseExcelDate(value);
        else if (NUM_FIELDS.has(field))    row[field] = parseNum(value);
        else                               row[field] = String(value ?? '').trim();
      });
      if (row.folio !== undefined) row.folio = String(row.folio).trim();
      return row;
    }).filter(r => r.folio);
    // Deduplicate by rut_proveedor+folio — each provider has its own folio sequence
    const seen = new Map();
    parsed.forEach(r => seen.set(`${r.rut_proveedor}|${r.folio}`, r));
    const rows = Array.from(seen.values());
    const dupes = parsed.length - rows.length;
    return { rows, dupes };
  };

  const processXLSX = async () => {
    if (!file) return;
    cancelledRef.current = false;
    setLoading(true);
    setStatus('Leyendo archivo...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { rows, dupes } = parseXLSX(e.target.result);

        if (rows.length === 0) throw new Error('No se encontraron registros válidos');
        const dupeMsg = dupes > 0 ? ` (${dupes} duplicado${dupes > 1 ? 's' : ''} eliminado${dupes > 1 ? 's' : ''})` : '';
        setStatus(`${rows.length} registros únicos${dupeMsg}. Subiendo...`);

        if (mode === 'replace') {
          const { error: delErr } = await supabase.from('sii_records').delete().neq('id', 0);
          if (delErr) throw new Error('Error al limpiar tabla: ' + delErr.message);
        }

        // Insertar en lotes de 200
        const BATCH = 200;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += BATCH) {
          if (cancelledRef.current) { setStatus(`⚠ Cancelado — ${inserted} registros insertados antes de interrumpir.`); break; }
          const batch = rows.slice(i, i + BATCH);
          const { error } = await supabase.from('sii_records').insert(batch);
          if (error) throw new Error(`Error en lote ${Math.ceil(i/BATCH)+1}: ${error.message}`);
          inserted += batch.length;
          setStatus(`Insertando... ${inserted}/${rows.length}`);
        }

        if (!cancelledRef.current) {
          setStatus(`✓ ${inserted} registro${inserted !== 1 ? 's' : ''} importados${dupeMsg}`);
          setTimeout(() => { onImported(); onClose(); }, 1800);
        }
      } catch (err) {
        setStatus(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => { setStatus('Error al leer el archivo'); setLoading(false); };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 lg:p-7 relative border border-slate-200/60 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-violet-50 p-2 rounded-lg text-violet-600"><FileText size={20} /></div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Importar Data SII</h3>
              <p className="text-xs text-slate-400 mt-0.5">Archivo Excel (.xlsx) del libro de compras SII</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-all active:scale-[0.98] text-slate-400"><X size={18} /></button>
        </div>

        {/* Info columnas */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 mb-5 space-y-3">
          <div className="flex items-center gap-2 text-violet-600">
            <CheckCircle size={15} className="shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-wide">Formato esperado</p>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Archivo <span className="font-semibold text-slate-700">.xlsx</span> con los encabezados del SII en la primera fila. Exporta el libro de compras desde el SII y ábrelo en Excel para guardarlo como <span className="font-semibold text-slate-700">.xlsx</span>. La columna <span className="font-bold text-slate-700">Folio</span> vincula con las facturas del sistema.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {['Folio','Razon Social','Monto Neto','Monto Total','Monto IVA Recuperable'].map(c => (
              <span key={c} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600">{c}</span>
            ))}
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-400">+22 más...</span>
          </div>
        </div>

        {/* Modo de carga */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Modo de importación</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('append')}
              className={`p-3 rounded-lg border text-left transition-all ${mode === 'append' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <p className="text-xs font-bold">Agregar</p>
              <p className="text-xs mt-0.5 opacity-70">Añade sin borrar datos existentes</p>
            </button>
            <button
              onClick={() => setMode('replace')}
              className={`p-3 rounded-lg border text-left transition-all ${mode === 'replace' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <p className="text-xs font-bold">Reemplazar</p>
              <p className="text-xs mt-0.5 opacity-70 flex items-center gap-1"><AlertCircle size={11} /> Borra todo y recarga</p>
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-violet-50/30 hover:border-violet-300 transition-all cursor-pointer group">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="text-slate-400 mb-2 group-hover:text-violet-500 transition-colors" size={26} />
            <p className="text-sm font-medium text-slate-700 truncate px-4 max-w-full">
              {file ? file.name : 'Subir archivo Excel (.xlsx)'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Arrastra o haz clic aquí</p>
          </label>

          {status && (
            <div className={`p-3.5 rounded-xl text-center text-sm font-medium ${
              status.startsWith('Error') ? 'bg-rose-50 text-rose-700 border border-rose-100'
              : status.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-violet-50 text-violet-700 border border-violet-100 animate-pulse'
            }`}>
              {status}
            </div>
          )}

          <div className="flex gap-2">
            {loading && (
              <button
                onClick={handleCancel}
                className="flex-none py-2.5 px-4 rounded-lg border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
            )}
            <button
              disabled={!file || loading}
              onClick={processXLSX}
              className="flex-1 bg-violet-600 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm shadow-violet-600/20 hover:shadow-md hover:bg-violet-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm flex justify-center items-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Importando...</>
              ) : 'Iniciar Importación SII'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SIIImportModal;
