import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileText, Settings2, Search, RefreshCw, X, ChevronUp, ChevronDown, Eye, EyeOff, Filter, ChevronLeft, ChevronRight, CheckCircle2, Download } from 'lucide-react';
import MultiSelect from '../components/MultiSelect';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { formatDate, parseDate, toISODate } from '../utils/formatters';
import { useToast } from '../context/ToastContext';

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

// Mapa código → nombre de tipo de documento SII (defaults)
const DEFAULT_TIPO_DOC_MAP = {
  33: 'Factura',
  34: 'Factura no Afecta o Exenta',
  56: 'Nota Debito',
  61: 'Nota Credito',
};
const TIPO_DOC_STORAGE_KEY = 'sii_tipo_doc_map';
const loadTipoDocMap = () => {
  try {
    const saved = localStorage.getItem(TIPO_DOC_STORAGE_KEY);
    if (saved) return { ...DEFAULT_TIPO_DOC_MAP, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_TIPO_DOC_MAP };
};

// Date helpers imported from shared utils

const fmtMoney = (v) => {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
};

const fmtValue = (col, v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (col.type === 'money') return fmtMoney(v);
  if (col.type === 'date')  return formatDate(v);
  return String(v);
};

const EMPTY_FILTERS = { tipoCompra: [], tipoDoc: [], fechaDesde: '', fechaHasta: '', razonSocial: '' };

export default function SIIView({ supabase, onShowConfirm, onViewDetail }) {
  const { toast } = useToast();
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
  const [tipoDocMap, setTipoDocMap]     = useState(loadTipoDocMap);
  const [showTipoDocPanel, setShowTipoDocPanel] = useState(false);

  const getTipoDocLabel = useCallback((code) => tipoDocMap[Number(code)] || String(code), [tipoDocMap]);
  const saveTipoDocMap = (map) => {
    setTipoDocMap(map);
    localStorage.setItem(TIPO_DOC_STORAGE_KEY, JSON.stringify(map));
  };

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
        .from('sii_compras_records')
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

  const normalizeRut = (rut) => String(rut || '').trim().replace(/\./g, '').toUpperCase();

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
        if (r.rut && r.folio) map.set(`${normalizeRut(r.rut)}|${String(r.folio).trim()}`, r);
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
  const tipoDocOptions    = useMemo(() => [...new Set(records.map(r => r.tipo_doc).filter(v => v !== null && v !== undefined))].sort((a,b) => a-b).map(code => getTipoDocLabel(code)), [records, getTipoDocLabel]);

  // All known codes: from defaults + actual data
  const allTipoDocCodes = useMemo(() => {
    const codes = new Set(Object.keys(DEFAULT_TIPO_DOC_MAP).map(Number));
    records.forEach(r => { if (r.tipo_doc !== null && r.tipo_doc !== undefined) codes.add(Number(r.tipo_doc)); });
    return [...codes].sort((a, b) => a - b);
  }, [records]);
  const activeFilterCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : v !== '').length;

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
    if (filters.tipoCompra.length > 0)  rows = rows.filter(r => filters.tipoCompra.includes(r.tipo_compra));
    if (filters.tipoDoc.length > 0)    rows = rows.filter(r => filters.tipoDoc.includes(getTipoDocLabel(r.tipo_doc)));
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

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) { toast({ type: 'error', message: 'La librería Excel aún no ha cargado. Intenta en un momento.' }); return; }

    const data = filtered.map(row => {
      const obj = {};
      ALL_COLUMNS.forEach(col => {
        obj[col.label] = (col.type === 'money')
          ? (Number(row[col.key]) || 0)
          : (col.type === 'date')
            ? formatDate(row[col.key])
            : (row[col.key] ?? '');
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SII');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `sii_${today}.xlsx`);
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-violet-600" /> SII Compras
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {records.length > 0 ? `${records.length} registros importados` : 'Sin datos importados aún'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setShowTipoDocPanel(p => !p); setShowColPanel(false); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${showTipoDocPanel ? 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}>
            <Settings2 size={15} />
            <span className="hidden sm:inline">Tipos Doc.</span>
          </button>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 bg-white transition-all active:scale-[0.98]">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Panel editor de tipos de documento */}
      {showTipoDocPanel && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Settings2 size={15} className="text-violet-500" /> Tipos de Documento
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => { saveTipoDocMap({ ...DEFAULT_TIPO_DOC_MAP }); }} className="text-xs text-slate-400 font-medium hover:underline">Restablecer</button>
              <button onClick={() => setShowTipoDocPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={15} /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allTipoDocCodes.map(code => (
              <div key={code} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-10 text-right shrink-0">{code}</span>
                <input
                  type="text"
                  value={tipoDocMap[code] || ''}
                  placeholder={`Código ${code}`}
                  onChange={e => saveTipoDocMap({ ...tipoDocMap, [code]: e.target.value })}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

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
        <EmptyState icon={FileText} title="Sin datos SII" subtitle="Usa Manejo de Datos para importar el archivo Excel del libro de compras" />
      )}

      {/* Filtros — inmediatamente sobre la tabla */}
      {(loading || records.length > 0) && (
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowColPanel(p => !p); setShowFilters(false); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${showColPanel ? 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
              >
                <Settings2 size={15} />
                <span className="hidden sm:inline">Columnas</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${showColPanel ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>{visibleCols.length}</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 bg-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Exportar registros filtrados a Excel"
              >
                <Download size={15} />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

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
                <MultiSelect
                  label="Tipo Compra"
                  options={tipoCompraOptions}
                  selectedValues={filters.tipoCompra}
                  onChange={(vals) => setFilters(f => ({ ...f, tipoCompra: vals }))}
                  placeholder="Todos"
                />
                <MultiSelect
                  label="Tipo Documento"
                  options={tipoDocOptions}
                  selectedValues={filters.tipoDoc}
                  onChange={(vals) => setFilters(f => ({ ...f, tipoDoc: vals }))}
                  placeholder="Todos"
                />
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wide px-1">Razón Social</label>
                  <input type="text" placeholder="Buscar proveedor..." value={filters.razonSocial}
                    onChange={e => setFilters(f => ({ ...f, razonSocial: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wide px-1">Fecha Desde</label>
                  <input type="date" value={filters.fechaDesde} onChange={e => setFilters(f => ({ ...f, fechaDesde: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wide px-1">Fecha Hasta</label>
                  <input type="date" value={filters.fechaHasta} onChange={e => setFilters(f => ({ ...f, fechaHasta: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" />
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
            <Pagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} color="violet" position="top" />
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
                    const matchKey = `${normalizeRut(row.rut_proveedor)}|${String(row.folio || '').trim()}`;
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
                          {col.key === 'tipo_doc' ? getTipoDocLabel(row[col.key]) : fmtValue(col, row[col.key])}
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

          <Pagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} color="violet" position="bottom" />
        </div>
      )}


    </div>
  );
}
