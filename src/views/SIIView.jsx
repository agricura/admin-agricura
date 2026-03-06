import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Settings2, Search, RefreshCw, X, ChevronUp, ChevronDown, Eye, EyeOff, Filter, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

const PAGE_SIZE = 20;

// ── Columnas disponibles ──────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'folio',                    label: 'Folio',                    type: 'text',    defaultVisible: true },
  { key: 'tipo_doc',                 label: 'Tipo Doc.',                type: 'number',  defaultVisible: true },
  { key: 'tipo_compra',              label: 'Tipo Compra',              type: 'text',    defaultVisible: true },
  { key: 'rut_proveedor',            label: 'RUT Proveedor',            type: 'text',    defaultVisible: true },
  { key: 'razon_social',             label: 'Razón Social',             type: 'text',    defaultVisible: true },
  { key: 'fecha_docto',              label: 'Fecha Docto.',             type: 'date',    defaultVisible: true },
  { key: 'fecha_recepcion',          label: 'Fecha Recepción',          type: 'date',    defaultVisible: false },
  { key: 'fecha_acuse',              label: 'Fecha Acuse',              type: 'date',    defaultVisible: false },
  { key: 'monto_exento',             label: 'Monto Exento',             type: 'money',   defaultVisible: false },
  { key: 'monto_neto',               label: 'Monto Neto',               type: 'money',   defaultVisible: true },
  { key: 'monto_iva_recuperable',    label: 'IVA Recuperable',          type: 'money',   defaultVisible: true },
  { key: 'monto_iva_no_recuperable', label: 'IVA No Recuperable',       type: 'money',   defaultVisible: false },
  { key: 'codigo_iva_no_rec',        label: 'Cód. IVA No Rec.',         type: 'text',    defaultVisible: false },
  { key: 'monto_total',              label: 'Monto Total',              type: 'money',   defaultVisible: true },
  { key: 'monto_neto_activo_fijo',   label: 'Neto Activo Fijo',         type: 'money',   defaultVisible: false },
  { key: 'iva_activo_fijo',          label: 'IVA Activo Fijo',          type: 'money',   defaultVisible: false },
  { key: 'iva_uso_comun',            label: 'IVA Uso Común',            type: 'money',   defaultVisible: false },
  { key: 'impto_sin_derecho_credito','label': 'Impto. S/Crédito',       type: 'money',   defaultVisible: false },
  { key: 'iva_no_retenido',          label: 'IVA No Retenido',          type: 'money',   defaultVisible: false },
  { key: 'codigo_otro_impuesto',     label: 'Cód. Otro Impto.',         type: 'text',    defaultVisible: false },
  { key: 'valor_otro_impuesto',      label: 'Valor Otro Impto.',        type: 'money',   defaultVisible: false },
  { key: 'tasa_otro_impuesto',       label: 'Tasa Otro Impto.',         type: 'text',    defaultVisible: false },
  { key: 'nro',                      label: 'Nro.',                     type: 'number',  defaultVisible: false },
];

const STORAGE_KEY = 'sii_visible_columns';

// ── Date helpers ──────────────────────────────────────────────────────────────
// Handles: Excel serial ints, JS Date objects, "dd-mm-yy", "dd-mm-yyyy", "yyyy/mm/dd"
const parseDate = (v) => {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400000);
    return isNaN(d) ? null : d;
  }
  const s = String(v).trim();
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m1) {
    let [, dd, mm, yy] = m1;
    if (yy.length === 2) yy = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
    return new Date(`${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T00:00:00`);
  }
  const m2 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (m2) return new Date(`${m2[1]}-${m2[2]}-${m2[3]}T00:00:00`);
  return null;
};

const SII_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fmtDate = (v) => {
  const d = parseDate(v);
  if (!d || isNaN(d)) return v ? String(v) : '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mes = SII_MESES[d.getMonth()];
  const y = d.getFullYear();
  return `${day}-${mes}-${y}`;
};

// Returns "yyyy-mm-dd" string for filter comparison
const toISODate = (v) => {
  const d = parseDate(v);
  if (!d || isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
// ── /Date helpers ─────────────────────────────────────────────────────────────

const fmtMoney = (v) => {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
};

const fmtValue = (col, v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (col.type === 'money') return fmtMoney(v);
  if (col.type === 'date')  return fmtDate(v);
  return String(v);
};

const EMPTY_FILTERS = { tipoCompra: '', tipoDoc: '', fechaDesde: '', fechaHasta: '', razonSocial: '' };

export default function SIIView({ supabase, onShowConfirm, onViewDetail }) {
  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [showColPanel, setShowColPanel]     = useState(false);
  const [showFilters, setShowFilters]       = useState(false);
  const [invoiceMap, setInvoiceMap]         = useState(new Map());
  const [filters, setFilters]           = useState(EMPTY_FILTERS);
  const [sortKey, setSortKey]           = useState('fecha_docto');
  const [sortDir, setSortDir]           = useState('desc');
  const [page, setPage]                 = useState(1);

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
  });

  const saveVisibleCols = (cols) => { setVisibleCols(cols); localStorage.setItem(STORAGE_KEY, JSON.stringify(cols)); };
  const toggleCol = (key) => {
    if (key === 'folio') return;
    saveVisibleCols(visibleCols.includes(key) ? visibleCols.filter(k => k !== key) : [...visibleCols, key]);
  };

  const fetchData = async () => {
    setLoading(true);
    const BATCH = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('sii_records')
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + BATCH - 1);
      if (error) {
        onShowConfirm?.({ title: 'Error', message: error.message, type: 'danger', onConfirm: () => {} });
        break;
      }
      all = all.concat(data || []);
      if (!data || data.length < BATCH) break; // no more pages
      from += BATCH;
    }
    setRecords(all);
    setLoading(false);
  };

  const fetchInvoiceKeys = async () => {
    let from = 0;
    const map = new Map();
    while (true) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .range(from, from + 999);
      if (error || !data) break;
      data.forEach(r => {
        if (r.rut && r.folio) map.set(`${String(r.rut).trim()}|${String(r.folio).trim()}`, r);
      });
      if (data.length < 1000) break;
      from += 1000;
    }
    setInvoiceMap(map);
  };

  useEffect(() => { fetchData(); fetchInvoiceKeys(); }, []);
  useEffect(() => { setPage(1); }, [search, filters]);

  const displayCols = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));

  const tipoCompraOptions = useMemo(() => [...new Set(records.map(r => r.tipo_compra).filter(Boolean))].sort(), [records]);
  const tipoDocOptions    = useMemo(() => [...new Set(records.map(r => r.tipo_doc).filter(v => v !== null && v !== undefined))].sort((a,b) => a-b), [records]);
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const filtered = useMemo(() => {
    let rows = records;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        String(r.folio || '').toLowerCase().includes(q) ||
        String(r.razon_social || '').toLowerCase().includes(q) ||
        String(r.rut_proveedor || '').toLowerCase().includes(q)
      );
    }
    if (filters.tipoCompra)  rows = rows.filter(r => r.tipo_compra === filters.tipoCompra);
    if (filters.tipoDoc)     rows = rows.filter(r => String(r.tipo_doc) === String(filters.tipoDoc));
    if (filters.razonSocial) { const q = filters.razonSocial.trim().toLowerCase(); rows = rows.filter(r => String(r.razon_social || '').toLowerCase().includes(q)); }
    if (filters.fechaDesde)  rows = rows.filter(r => toISODate(r.fecha_docto) >= filters.fechaDesde);
    if (filters.fechaHasta)  rows = rows.filter(r => { const d = toISODate(r.fecha_docto); return d && d <= filters.fechaHasta; });

    return [...rows].sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (ALL_COLUMNS.find(c => c.key === sortKey)?.type === 'date') { av = toISODate(av) || ''; bv = toISODate(bv) || ''; }
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [records, search, filters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const totals = useMemo(() => {
    const t = {};
    displayCols.forEach(c => { if (c.type === 'money') t[c.key] = filtered.reduce((s, r) => s + (Number(r[c.key]) || 0), 0); });
    return t;
  }, [filtered, displayCols]);

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // ── Pagination component ──────────────────────────────────────────────────
  const PaginationBar = ({ position }) => {
    if (totalPages <= 1) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
      .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…'); acc.push(p); return acc; }, []);

    if (position === 'bottom') return (
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all">
            <ChevronLeft size={13} /> Anterior
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all">
            Siguiente <ChevronRight size={13} />
          </button>
        </div>
      </div>
    );

    // top
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(1)} disabled={safePage === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
          <ChevronLeft size={13} />
        </button>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
          Anterior
        </button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="px-1 text-slate-300 text-xs">…</span>
            : <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${safePage === p ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                {p}
              </button>
        )}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
          Siguiente
        </button>
        <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
          <ChevronRight size={13} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-violet-600" /> Datos SII
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {records.length > 0 ? `${records.length} registros importados` : 'Sin datos importados aún'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowColPanel(p => !p); setShowFilters(false); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${showColPanel ? 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
          >
            <Settings2 size={15} />
            <span className="hidden sm:inline">Columnas</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${showColPanel ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>{visibleCols.length}</span>
          </button>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 bg-white transition-all active:scale-[0.98]">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

        </div>
      </div>

      {/* Panel selector de columnas */}
      {showColPanel && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Eye size={15} className="text-violet-500" /> Columnas visibles</h3>
            <button onClick={() => setShowColPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ALL_COLUMNS.map(col => {
              const active = visibleCols.includes(col.key);
              const locked = col.key === 'folio';
              return (
                <button key={col.key} onClick={() => toggleCol(col.key)} disabled={locked}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${locked ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : active ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {active ? <Eye size={12} /> : <EyeOff size={12} className="opacity-40" />}
                  <span>{col.label}</span>
                  {locked && <span className="ml-auto text-slate-300 text-[10px]">fijo</span>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button onClick={() => saveVisibleCols(ALL_COLUMNS.map(c => c.key))} className="text-xs text-violet-600 font-medium hover:underline">Mostrar todas</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => saveVisibleCols(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))} className="text-xs text-slate-400 font-medium hover:underline">Restablecer</button>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Buscar por folio, razón social o RUT..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      </div>

      {/* Sin datos */}
      {!loading && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
            <FileText size={26} className="text-violet-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">Sin datos SII</p>
          <p className="text-sm text-slate-400 mt-1">Usa <span className="font-medium text-slate-500">Manejo de Datos</span> para importar el archivo Excel del libro de compras</p>
        </div>
      )}

      {/* Filtros — inmediatamente sobre la tabla */}
      {(loading || records.length > 0) && (
        <div>
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${showFilters ? 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
          >
            <Filter size={15} />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${showFilters ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>{activeFilterCount}</span>
            )}
          </button>

          {showFilters && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Filter size={14} className="text-violet-500" /> Filtros
                  {activeFilterCount > 0 && <span className="bg-violet-100 text-violet-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{activeFilterCount} activo{activeFilterCount !== 1 ? 's' : ''}</span>}
                </h3>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs text-rose-500 font-medium hover:underline">Limpiar todo</button>}
                  <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={15} /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo Compra</label>
                  <select value={filters.tipoCompra} onChange={e => setFilters(f => ({ ...f, tipoCompra: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400">
                    <option value="">Todos</option>
                    {tipoCompraOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo Documento</label>
                  <select value={filters.tipoDoc} onChange={e => setFilters(f => ({ ...f, tipoDoc: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400">
                    <option value="">Todos</option>
                    {tipoDocOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Razón Social</label>
                  <input type="text" placeholder="Buscar proveedor..." value={filters.razonSocial}
                    onChange={e => setFilters(f => ({ ...f, razonSocial: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Desde</label>
                  <input type="date" value={filters.fechaDesde} onChange={e => setFilters(f => ({ ...f, fechaDesde: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Hasta</label>
                  <input type="date" value={filters.fechaHasta} onChange={e => setFilters(f => ({ ...f, fechaHasta: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      {(loading || records.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Barra superior */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-medium text-slate-500">
              {loading ? 'Cargando...' : `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}${(search || activeFilterCount > 0) ? ' (filtrado)' : ''}${!loading && filtered.length > 0 ? ` — pág. ${safePage}/${totalPages}` : ''}`}
            </span>
            <PaginationBar position="top" />
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap w-10">
                      Agricura
                    </th>
                    {displayCols.map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 whitespace-nowrap select-none">
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key
                            ? sortDir === 'asc' ? <ChevronUp size={12} className="text-violet-500" /> : <ChevronDown size={12} className="text-violet-500" />
                            : <ChevronUp size={12} className="opacity-0" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={displayCols.length + 1} className="px-4 py-12 text-center text-sm text-slate-400">No hay registros que coincidan con los filtros aplicados.</td></tr>
                  ) : pageRows.map((row, idx) => {
                    const matchKey = `${String(row.rut_proveedor || '').trim()}|${String(row.folio || '').trim()}`;
                    const matchedInvoice = invoiceMap.get(matchKey);
                    return (
                    <tr key={row.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2.5 text-center">
                        {matchedInvoice
                          ? <CheckCircle2 size={15} className="text-emerald-500 mx-auto cursor-pointer hover:text-emerald-600 active:scale-90 transition-transform" onClick={() => onViewDetail?.(matchedInvoice)} />
                          : <span className="w-3.5 h-3.5 rounded-full border border-slate-200 inline-block" />}
                      </td>
                      {displayCols.map(col => (
                        <td key={col.key} className={`px-4 py-2.5 whitespace-nowrap text-sm ${col.key === 'folio' ? 'font-semibold text-violet-700' : col.type === 'money' ? 'text-right font-mono text-slate-700 tabular-nums' : 'text-slate-600'}`}>
                          {fmtValue(col, row[col.key])}
                        </td>
                      ))}
                    </tr>
                  );})}
                </tbody>
                {Object.keys(totals).length > 0 && filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-violet-50 border-t-2 border-violet-100 font-semibold">
                      <td className="px-4 py-2.5" />
                      {displayCols.map((col, i) => (
                        <td key={col.key} className={`px-4 py-2.5 text-xs whitespace-nowrap ${col.type === 'money' ? 'text-right font-mono text-violet-800 tabular-nums' : ''}`}>
                          {i === 0
                            ? <span className="text-violet-500 font-bold uppercase tracking-wider text-[10px]">Total{activeFilterCount > 0 || search ? ' filtrado' : ''}</span>
                            : totals[col.key] !== undefined ? fmtMoney(totals[col.key]) : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          <PaginationBar position="bottom" />
        </div>
      )}


    </div>
  );
}
