import React, { useState, useRef } from 'react';
import { FileSpreadsheet, X, CheckCircle, AlertCircle, Upload, ChevronRight, FileText } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const toStr = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Numeric values rounded to 2 decimals; null if empty/invalid
const toFloat = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
};

// Excel serial / "dd-mm-yyyy" / "dd-mm-yy" / "yyyy-mm-dd" → "yyyy-mm-dd"
const toISODate = (v) => {
  if (!v && v !== 0) return null;
  if (v instanceof Date) { if (isNaN(v)) return null; return v.toISOString().slice(0, 10); }
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400000);
    if (isNaN(d)) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  const s = String(v).trim();
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    let [, dd, mm, yy] = m1;
    if (yy.length === 2) yy = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const m2 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
};

// ── Columnas de la pestaña "documentos" → tabla invoices ─────────────────────
// type: 'str' | 'float' | 'date'
const DOC_COLUMNS = [
  { key: 'tipo_doc',      type: 'str'   },
  { key: 'folio',         type: 'str'   },
  { key: 'proveedor',     type: 'str'   },
  { key: 'rut',           type: 'str'   },
  { key: 'fecha_emision', type: 'date'  },
  { key: 'fecha_venc',    type: 'date'  },
  { key: 'moneda',        type: 'str'   },
  { key: 'forma_pago',    type: 'str'   },
  { key: 'total_a_pagar', type: 'float' },
  { key: 'total_bruto',   type: 'float' },
  { key: 'iva',           type: 'float' },
  { key: 'comentarios',   type: 'str'   },
  { key: 'centro_costo',  type: 'str'   },
  { key: 'item',          type: 'str'   },
  { key: 'status_pago',   type: 'str'   },
  { key: 'fecha_pago',    type: 'date'  },
  { key: 'medio_pago',    type: 'str'   },
  { key: 'cuenta_pago',   type: 'str'   },
];

const BATCH = 50;

// ── Component ─────────────────────────────────────────────────────────────────

const ExcelImportModal = ({ onClose, onImported, supabase }) => {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog]         = useState([]);
  const [mode, setMode]       = useState('append'); // 'append' | 'replace'
  const cancelledRef           = useRef(false);

  const addLog = (type, msg) => setLog(prev => [...prev, { type, msg }]);

  const handleCancel = () => {
    cancelledRef.current = true;
    addLog('warn', '⚠ Proceso cancelado por el usuario.');
  };

  const processExcel = async () => {
    if (!file || !window.XLSX) return;
    cancelledRef.current = false;
    setLoading(true);
    setLog([]);

    // Obtener el usuario autenticado (requerido por RLS)
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      addLog('error', 'No se pudo obtener el usuario autenticado. Recarga la página.');
      setLoading(false);
      return;
    }
    const userId = user.id;

    const reader = new FileReader();
    reader.onerror = () => { addLog('error', 'Error al leer el archivo'); setLoading(false); };

    reader.onload = async (e) => {
      try {
        const wb    = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const names = wb.SheetNames.map(n => n.toLowerCase());

        const getSheet = (key) => {
          const idx = names.findIndex(n => n === key || n.includes(key));
          return idx !== -1 ? window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx]], { defval: null }) : null;
        };

        const docRows = getSheet('documentos');
        const detRows = getSheet('detalle');

        if (!docRows && !detRows)
          throw new Error('El archivo no contiene pestañas "documentos" ni "detalle_documentos".');

        // ── MODO REEMPLAZAR ───────────────────────────────────────────────
        if (mode === 'replace') {
          addLog('info', 'Modo Reemplazar: eliminando registros existentes…');
          const { error: delErr } = await supabase.from('invoices').delete().neq('id', 0);
          if (delErr) throw new Error('Error al limpiar tabla: ' + delErr.message);
          addLog('ok', '✓ Tabla limpiada.');
        }

        // ── FASE 1: pestaña "documentos" ──────────────────────────────────
        if (docRows && docRows.length > 0) {
          addLog('info', `Pestaña "documentos": ${docRows.length} filas encontradas…`);

          // Helper: busca la clave exacta, UPPERCASE o Capitalized en la fila
          const get = (r, key) => r[key] ?? r[key.toUpperCase()] ?? r[key.toLowerCase()] ?? null;

          const payload = [];
          docRows.forEach((r, idx) => {
            const rut   = toStr(get(r, 'rut'));
            const folio = toStr(get(r, 'folio'));
            if (!rut || !folio) {
              addLog('warn', `  Fila ${idx + 2}: sin rut o folio — omitida.`);
              return;
            }
            const row = { created_by: userId };
            DOC_COLUMNS.forEach(({ key, type }) => {
              const raw = get(r, key);
              if      (type === 'date')  row[key] = toISODate(raw);
              else if (type === 'float') row[key] = toFloat(raw);
              else                       row[key] = toStr(raw) || null;
            });
            payload.push(row);
          });

          if (payload.length === 0) {
            addLog('warn', 'Ninguna fila válida en "documentos".');
          } else {
            let inserted = 0;
            for (let i = 0; i < payload.length; i += BATCH) {
              if (cancelledRef.current) { addLog('warn', `  Interrumpido en fila ~${inserted + 1}.`); break; }
              const { error } = await supabase
                .from('invoices')
                .upsert(payload.slice(i, i + BATCH), { onConflict: 'rut,folio', ignoreDuplicates: false });
              if (error) throw new Error(`Upsert documentos (fila ~${i + 1}): ${error.message}`);
              inserted += Math.min(BATCH, payload.length - i);
              addLog('info', `  Documentos: ${inserted}/${payload.length} filas procesadas…`);
            }
            if (!cancelledRef.current) addLog('ok', `✓ ${inserted} documentos sincronizados.`);
          }
        } else {
          addLog('warn', 'No se encontró la pestaña "documentos" o está vacía.');
        }

        // ── FASE 2: pestaña "detalle_documentos" ─────────────────────────
        if (detRows && detRows.length > 0) {
          addLog('info', `Pestaña "detalle_documentos": ${detRows.length} filas encontradas…`);

          const get = (r, key) => r[key] ?? r[key.toUpperCase()] ?? r[key.toLowerCase()] ?? null;

          // Dedup + group by rut+folio
          const seen   = new Set();
          const groups = {};
          detRows.forEach((r, idx) => {
            const rut   = toStr(get(r, 'rut'));
            const folio = toStr(get(r, 'folio'));
            if (!rut || !folio) { addLog('warn', `  Detalle fila ${idx + 2}: sin rut/folio — omitida.`); return; }
            const dedup = `${rut}|${folio}|${get(r,'detalle')}|${get(r,'cantidad')}|${get(r,'total_item')}`;
            if (seen.has(dedup)) return;
            seen.add(dedup);
            const k = `${rut}||${folio}`;
            if (!groups[k]) groups[k] = { rut, folio, items: [] };
            groups[k].items.push({
              detalle:    toStr(get(r, 'detalle') || get(r, 'descripcion')) || 'Producto',
              cantidad:   toFloat(get(r, 'cantidad'))  ?? 1,
              total_item: toFloat(get(r, 'total_item') || get(r, 'total_linea')) ?? 0,
            });
          });

          const keys   = Object.keys(groups);
          let updated  = 0;
          let warnings = 0;

          for (let i = 0; i < keys.length; i++) {
            if (cancelledRef.current) { addLog('warn', `  Interrumpido en detalle (${i}/${keys.length}).`); break; }
            const { rut, folio, items } = groups[keys[i]];
            const { error } = await supabase
              .from('invoices')
              .update({ items })
              .eq('rut', rut)
              .eq('folio', folio);
            if (error) { addLog('warn', `  Sin match: rut=${rut} folio=${folio} — ${error.message}`); warnings++; }
            else        { updated++; }
            if ((i + 1) % 10 === 0)
              addLog('info', `  Detalle: ${i + 1}/${keys.length} grupos procesados…`);
          }

          if (warnings > 0) addLog('warn', `  ${warnings} grupo(s) sin factura coincidente.`);
          addLog('ok', `✓ ${updated} facturas actualizadas con detalle de ítems.`);
        } else {
          addLog('warn', 'No se encontró la pestaña "detalle_documentos" o está vacía.');
        }

        if (!cancelledRef.current) {
          addLog('ok', '✓ Importación completada.');
          setTimeout(() => { onImported(); onClose(); }, 2000);
        }

      } catch (err) {
        addLog('error', `Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-slate-200/60 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><FileSpreadsheet size={20} /></div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Importar Datos Agricura</h3>
              <p className="text-xs text-slate-400 mt-0.5">Archivo .xlsx con 2 pestañas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Estructura esperada */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estructura esperada del archivo</p>

            <div className="space-y-2.5">
              {/* Hoja documentos */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={13} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">
                    Pestaña: <code className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono">documentos</code>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {DOC_COLUMNS.map(({ key }) => (
                    <span key={key} className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium border ${
                      key === 'rut' || key === 'folio'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>{key}</span>
                  ))}
                </div>
              </div>

              <div className="flex justify-center text-slate-300">
                <ChevronRight size={16} className="rotate-90" />
              </div>

              {/* Hoja detalle_documentos */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={13} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-700">
                    Pestaña: <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">detalle_documentos</code>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['rut', 'folio', 'detalle', 'cantidad', 'total_item'].map(c => (
                    <span key={c} className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium border ${
                      c === 'rut' || c === 'folio'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>{c}</span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <AlertCircle size={11} className="text-blue-400 shrink-0" />
                  <span><code className="font-mono text-slate-500">total_item</code> es valor <strong>neto sin IVA</strong>. El IVA se calcula automáticamente.</span>
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
              <span className="w-2 h-2 rounded-sm bg-amber-300 inline-block shrink-0"></span>
              <span><span className="font-semibold text-amber-600">rut</span> + <span className="font-semibold text-amber-600">folio</span> son la llave compuesta — ambas pestañas deben incluirlas.</span>
            </p>
          </div>

          {/* Modo de carga */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Modo de importación</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('append')}
                className={`p-3 rounded-lg border text-left transition-all ${mode === 'append' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                <p className="text-xs font-bold">Agregar</p>
                <p className="text-xs mt-0.5 opacity-70">Upsert — actualiza existentes y añade nuevos</p>
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

          {/* Drop zone */}
          <label className="relative flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-emerald-50/30 hover:border-emerald-300 transition-all cursor-pointer group">
            <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files[0]); setLog([]); }} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Upload className="text-slate-400 mb-1.5 group-hover:text-emerald-500 transition-colors" size={24} />
            <p className="text-sm font-medium text-slate-700 truncate px-4 max-w-full">{file ? file.name : 'Subir archivo Excel (.xlsx)'}</p>
            <p className="text-xs text-slate-400 mt-0.5">Arrastra o haz clic aquí</p>
          </label>

          {/* Log terminal */}
          {log.length > 0 && (
            <div className="bg-slate-900 rounded-xl p-4 space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
              {log.map((entry, i) => (
                <p key={i} className={
                  entry.type === 'ok'    ? 'text-emerald-400' :
                  entry.type === 'warn'  ? 'text-amber-400'   :
                  entry.type === 'error' ? 'text-rose-400'    :
                  'text-slate-400'
                }>{entry.msg}</p>
              ))}
              {loading && <p className="text-slate-500 animate-pulse">procesando…</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle size={13} className="text-emerald-500" />
            Upsert por <span className="font-semibold text-slate-600 font-mono">rut + folio</span>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <button
                onClick={handleCancel}
                className="py-2.5 px-4 rounded-lg border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
            )}
            <button
              disabled={!file || loading}
              onClick={processExcel}
              className="bg-emerald-600 text-white font-semibold py-2.5 px-6 rounded-lg shadow-sm shadow-emerald-600/20 hover:shadow-md hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm flex items-center gap-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando…</>
                : <><Upload size={15} /> Iniciar Carga</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
