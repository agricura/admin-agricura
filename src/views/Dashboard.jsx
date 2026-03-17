import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle, Clock, FileText, Wallet, Search,
  ChevronLeft, ChevronRight, Trash2, Pencil,
  Settings2, ChevronUp, ChevronDown,
  Eye, EyeOff, X, Download, AlertCircle, AlertTriangle, Filter,
} from 'lucide-react';
import MultiSelect from '../components/MultiSelect';
import Pagination from '../components/Pagination';
import DateInput from '../components/DateInput';
import MobileActionMenu from '../components/MobileActionMenu';
import PaymentModal from '../components/PaymentModal';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import { formatCLP, formatDate } from '../utils/formatters';
import { useInvoices } from '../context/InvoicesContext';

const DASH_COL_KEY = 'dashboard_visible_columns';

const ALL_COLUMNS = [
  { key: 'rut',           label: 'RUT',              type: 'text',   defaultVisible: false },
  { key: 'tipo_doc',      label: 'Tipo Doc.',         type: 'text',   defaultVisible: false },
  { key: 'fecha_emision', label: 'Emisión',           type: 'date',   defaultVisible: true  },
  { key: 'fecha_venc',    label: 'Vencimiento',       type: 'date',   defaultVisible: true  },
  { key: 'fecha_pago',    label: 'Fecha Pago',        type: 'date',   defaultVisible: false },
  { key: 'centro_costo',  label: 'Centro Costo',      type: 'text',   defaultVisible: false },
  { key: 'item',          label: 'Categoría',         type: 'text',   defaultVisible: false },
  { key: 'total_bruto',   label: 'Total Neto',        type: 'money',  defaultVisible: false },
  { key: 'iva',           label: 'IVA',               type: 'money',  defaultVisible: false },
  { key: 'total_a_pagar', label: 'Monto',             type: 'money',  defaultVisible: true  },
  { key: 'status_pago',   label: 'Estado',            type: 'status', defaultVisible: true  },
  { key: 'cuenta_pago',   label: 'Cuenta Pago',       type: 'text',   defaultVisible: false },
];

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkeletonRow = ({ cols }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-3.5 bg-slate-100 rounded-lg animate-pulse" style={{ width: `${50 + (i * 17) % 45}%` }} />
      </td>
    ))}
  </tr>
);

function Dashboard({ supabase, onEdit, onViewDetail, onShowConfirm }) {
  // ── Shared invoices state via context ──────────────────────────────────────
  const { invoices, loading, error: ctxError, updateInvoice, deleteInvoice } = useInvoices();
  const { toast } = useToast();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [localError,     setLocalError]     = useState(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [showColPanel,   setShowColPanel]   = useState(false);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [sortKey,        setSortKey]        = useState('fecha_emision');
  const [sortDir,        setSortDir]        = useState('desc');
  const [paymentModal,   setPaymentModal]   = useState({ isOpen: false, invoiceIds: [] });
  const [simpleConfirm,  setSimpleConfirm]  = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const itemsPerPage = 8;

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(DASH_COL_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
  });

  const [filters, setFilters] = useState({
    search: '', providers: [], costCenters: [], types: [], status: [], startDate: '', endDate: '',
  });

  const saveVisibleCols = (cols) => { setVisibleCols(cols); localStorage.setItem(DASH_COL_KEY, JSON.stringify(cols)); };
  const toggleCol = (key) => saveVisibleCols(visibleCols.includes(key) ? visibleCols.filter(k => k !== key) : [...visibleCols, key]);
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  useEffect(() => { setCurrentPage(1); }, [sortKey, sortDir]);

  const clearFilters = () => {
    setFilters({ search: '', providers: [], costCenters: [], types: [], status: [], startDate: '', endDate: '' });
    setCurrentPage(1);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Toggle status ─────────────────────────────────────────────────────────
  const handleToggleStatus = (id, currentStatus) => {
    if (currentStatus === 'PENDIENTE') {
      // Open PaymentModal for PENDIENTE → PAGADO
      setPaymentModal({ isOpen: true, invoiceIds: [id] });
    } else {
      // Simple confirm for PAGADO → PENDIENTE
      setSimpleConfirm({
        isOpen: true,
        title: 'Revertir Estado',
        message: '¿Cambiar el estado del documento a PENDIENTE?',
        onConfirm: async () => {
          const { error } = await updateInvoice(id, { status_pago: 'PENDIENTE', fecha_pago: null, cuenta_pago: null });
          if (error) toast({ type: 'error', message: `Error al actualizar: ${error.message}` });
          else toast({ type: 'success', message: 'Estado revertido a PENDIENTE' });
        },
      });
    }
  };

  // Confirm payment (single or bulk)
  const handlePaymentConfirm = async ({ fecha_pago, cuenta_pago }) => {
    const ids = paymentModal.invoiceIds;
    const updates = { status_pago: 'PAGADO', fecha_pago, cuenta_pago: cuenta_pago || null };
    const results = await Promise.all(ids.map(id => updateInvoice(id, updates)));
    const failed = results.filter(r => r.error);
    if (failed.length > 0) toast({ type: 'error', message: `Error al actualizar ${failed.length} documento(s).` });
    else toast({ type: 'success', message: `${ids.length} documento${ids.length > 1 ? 's' : ''} marcado${ids.length > 1 ? 's' : ''} como PAGADO` });
  };

  // ── Excel Export (.xlsx) ──────────────────────────────────────────────────
  const handleExportCSV = () => {
    const XLSX = window.XLSX;
    if (!XLSX) { toast({ type: 'error', message: 'La librería Excel aún no ha cargado. Intenta en un momento.' }); return; }

    const data = filteredInvoices.map(inv => ({
      Folio:          inv.folio          ?? '',
      Proveedor:      inv.proveedor      ?? '',
      RUT:            inv.rut            ?? '',
      'Tipo Doc':     inv.tipo_doc       ?? '',
      Emisión:        inv.fecha_emision  ?? '',
      Vencimiento:    inv.fecha_venc     ?? '',
      'Fecha Pago':   inv.fecha_pago     ?? '',
      'Centro Costo': inv.centro_costo   ?? '',
      Monto:          Number(inv.total_a_pagar) || 0,
      Estado:         inv.status_pago    ?? '',
      'Cuenta Pago':  inv.cuenta_pago    ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    XLSX.writeFile(wb, `agricura_${todayStr}.xlsx`);
  };

  // ── Filter options ────────────────────────────────────────────────────────
  const filterOptions = useMemo(() => ({
    providers:   [...new Set(invoices.map(i => i.proveedor).filter(Boolean))].sort(),
    costCenters: [...new Set(invoices.map(i => i.centro_costo).filter(Boolean))].sort(),
    types:       [...new Set(invoices.map(i => i.tipo_doc).filter(Boolean))].sort(),
    status:      ['PENDIENTE', 'PAGADO', 'VENCIDA'],
  }), [invoices]);

  // Existing payment accounts for autocomplete in PaymentModal
  const existingAccounts = useMemo(() =>
    [...new Set(invoices.map(i => i.cuenta_pago).filter(Boolean))].sort(),
    [invoices]
  );

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch    = !filters.search || inv.proveedor?.toLowerCase().includes(filters.search.toLowerCase()) || inv.folio?.toString().includes(filters.search);
      const matchesStatus    = filters.status.length === 0 || filters.status.some(s => {
        if (s === 'PAGADO')    return inv.status_pago === 'PAGADO';
        if (s === 'VENCIDA')   return inv.status_pago === 'PENDIENTE' && todayStr > inv.fecha_venc;
        if (s === 'PENDIENTE') return inv.status_pago === 'PENDIENTE' && todayStr <= inv.fecha_venc;
        return false;
      });
      const matchesDate      = (!filters.startDate || inv.fecha_emision >= filters.startDate) && (!filters.endDate || inv.fecha_emision <= filters.endDate);
      const matchesProvider  = filters.providers.length   === 0 || filters.providers.includes(inv.proveedor);
      const matchesCostCenter = filters.costCenters.length === 0 || filters.costCenters.includes(inv.centro_costo);
      const matchesType      = filters.types.length       === 0 || filters.types.includes(inv.tipo_doc);
      return matchesSearch && matchesStatus && matchesDate && matchesProvider && matchesCostCenter && matchesType;
    }).sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'es') : String(bv).localeCompare(String(av), 'es');
    });
  }, [invoices, filters, todayStr, sortKey, sortDir]);

  const stats = useMemo(() => ({
    pend: filteredInvoices.filter(inv => inv.status_pago === 'PENDIENTE').reduce((s, i) => s + Number(i.total_a_pagar), 0),
    paid: filteredInvoices.filter(inv => inv.status_pago === 'PAGADO').reduce((s, i) => s + Number(i.total_a_pagar), 0),
  }), [filteredInvoices]);

  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredInvoices, currentPage]
  );
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  const displayError = localError || ctxError;

  // col count for skeleton = proveedor + visible + acciones
  const skeletonCols = 1 + visibleCols.length + 1;

  const activeFilterCount = [
    filters.providers.length > 0,
    filters.costCenters.length > 0,
    filters.types.length > 0,
    filters.status.length > 0,
    filters.startDate !== '',
    filters.endDate !== '',
  ].filter(Boolean).length;


  return (
    <div className="space-y-6 flex flex-col min-h-full">

      {/* ERROR BANNER */}
      {displayError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium">
          <AlertCircle size={16} className="shrink-0 text-rose-500" />
          <span className="flex-1">{displayError}</span>
          <button onClick={() => setLocalError(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
            <X size={15} />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Agricura Docs
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {invoices.length > 0 ? `${invoices.length} documentos cargados` : 'Sin datos cargados aún'}
          </p>
        </div>
      </div>

      {/* PANEL COLUMNAS */}
      {showColPanel && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Eye size={15} className="text-blue-500" /> Columnas visibles</h3>
            <button onClick={() => setShowColPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ALL_COLUMNS.map(col => {
              const active = visibleCols.includes(col.key);
              return (
                <button key={col.key} onClick={() => toggleCol(col.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {active ? <Eye size={12} /> : <EyeOff size={12} className="opacity-40" />}
                  <span>{col.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button onClick={() => saveVisibleCols(ALL_COLUMNS.map(c => c.key))} className="text-xs text-blue-600 font-medium hover:underline">Mostrar todas</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => saveVisibleCols(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))} className="text-xs text-slate-400 font-medium hover:underline">Restablecer</button>
          </div>
        </div>
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Total Pendiente', val: stats.pend, color: 'rose',    icon: <Clock size={18} /> },
          { label: 'Total Pagado',    val: stats.paid, color: 'emerald', icon: <CheckCircle size={18} /> },
          { label: 'Docs Filtrados',  val: filteredInvoices.length, color: 'blue', raw: true, icon: <FileText size={18} /> },
          { label: 'Sistema',         val: 'Conectado', color: 'emerald', text: true, icon: <Wallet size={18} /> },
        ].map((card, i) => (
          <div key={i} className="bg-white p-4 lg:p-5 rounded-xl border border-slate-200/60 flex items-start gap-3 hover:shadow-md hover:border-slate-200 transition-all duration-200 group">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : card.color === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-400 mb-0.5 truncate">{card.label}</p>
              <p className={`text-lg lg:text-xl font-bold truncate ${card.color === 'emerald' ? 'text-emerald-600' : card.color === 'rose' ? 'text-rose-600' : 'text-slate-800'}`}>
                {card.text ? card.val : card.raw ? formatCLP(card.val) : `$${formatCLP(card.val)}`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* BÚSQUEDA */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por proveedor, folio o RUT..."
          value={filters.search}
          onChange={e => { setFilters({ ...filters, search: e.target.value }); setCurrentPage(1); }}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
        {filters.search && (
          <button onClick={() => { setFilters({ ...filters, search: '' }); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* FILTROS — row + panel */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${showFilters ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
          >
            <Filter size={15} />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${showFilters ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>{activeFilterCount}</span>
            )}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowColPanel(p => !p); setShowFilters(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${showColPanel ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
            >
              <Settings2 size={15} />
              <span className="hidden sm:inline">Columnas</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${showColPanel ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>{visibleCols.length}</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredInvoices.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 bg-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              title={filteredInvoices.length === 0 ? 'No hay documentos para exportar' : 'Exportar registros filtrados a Excel'}
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
                <Filter size={14} className="text-blue-500" /> Filtros
                {activeFilterCount > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{activeFilterCount} activo{activeFilterCount !== 1 ? 's' : ''}</span>}
              </h3>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs text-rose-500 font-medium hover:underline">Limpiar todo</button>}
                <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={15} /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <MultiSelect label="Proveedor"       options={filterOptions.providers}   selectedValues={filters.providers}   onChange={v => { setFilters({ ...filters, providers: v });   setCurrentPage(1); }} placeholder="Todos" />
              <MultiSelect label="Centro de Costo" options={filterOptions.costCenters} selectedValues={filters.costCenters} onChange={v => { setFilters({ ...filters, costCenters: v }); setCurrentPage(1); }} placeholder="Todos" />
              <MultiSelect label="Tipo Documento"  options={filterOptions.types}       selectedValues={filters.types}       onChange={v => { setFilters({ ...filters, types: v });       setCurrentPage(1); }} placeholder="Todos" />
              <MultiSelect label="Estado"          options={['PAGADO','PENDIENTE','VENCIDA']} selectedValues={filters.status} onChange={v => { setFilters({ ...filters, status: v });   setCurrentPage(1); }} placeholder="Todos" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wide px-1">Fecha Desde</label>
                <DateInput value={filters.startDate} onChange={e => { setFilters({ ...filters, startDate: e.target.value }); setCurrentPage(1); }} className="w-full px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wide px-1">Fecha Hasta</label>
                <DateInput value={filters.endDate} onChange={e => { setFilters({ ...filters, endDate: e.target.value }); setCurrentPage(1); }} className="w-full px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLA */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-medium text-slate-500">
            {loading ? 'Cargando...' : `${filteredInvoices.length} documento${filteredInvoices.length !== 1 ? 's' : ''}${filteredInvoices.length !== invoices.length ? ' (filtrado)' : ''}${!loading && totalPages > 1 ? ` — pág. ${currentPage}/${totalPages}` : ''}`}
          </span>
          <Pagination page={currentPage} totalPages={totalPages} totalItems={filteredInvoices.length} pageSize={itemsPerPage} onPageChange={setCurrentPage} color="blue" position="top" />
        </div>

        {/* Vista Escritorio */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <th
                  onClick={() => handleSort('proveedor')}
                  className="px-4 py-3 text-left whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    Proveedor / Folio
                    {sortKey === 'proveedor'
                      ? sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />
                      : <ChevronUp size={12} className="opacity-20" />}
                  </span>
                </th>
                {ALL_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors${col.type === 'money' ? ' text-right' : col.type === 'status' ? ' text-center' : ''}`}
                  >
                    <span className={`flex items-center gap-1${col.type === 'money' ? ' justify-end' : col.type === 'status' ? ' justify-center' : ''}`}>
                      {col.label}
                      {sortKey === col.key
                        ? sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />
                        : <ChevronUp size={12} className="opacity-20" />}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading
                ? Array.from({ length: itemsPerPage }).map((_, i) => <SkeletonRow key={i} cols={skeletonCols} />)
                : paginatedInvoices.map(inv => {
                    const isOverdue  = inv.status_pago === 'PENDIENTE' && todayStr > inv.fecha_venc;
                    const hasItems   = inv.items && Array.isArray(inv.items) && inv.items.length > 0;
                    return (
                      <tr key={inv.id} className={`hover:bg-slate-50/70 transition-colors group ${isOverdue ? 'bg-rose-50/20' : ''}`}>
                        {/* Proveedor / Folio */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 truncate max-w-[200px] mb-1">{inv.proveedor}</p>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-slate-500 text-xs">#{inv.folio}</span>
                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase">{inv.tipo_doc}</span>
                          </div>
                        </td>
                        {/* Dynamic columns */}
                        {ALL_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => {
                          const v = inv[col.key];
                          if (col.key === 'status_pago') return (
                            <td key={col.key} className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200' : v === 'PAGADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                {isOverdue ? <AlertTriangle size={12} /> : v === 'PAGADO' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                {isOverdue ? 'VENCIDA' : (v || '—')}
                              </span>
                            </td>
                          );
                          if (col.key === 'total_a_pagar') return (
                            <td key={col.key} className="px-4 py-3 text-right">
                              <span className={`font-bold font-mono text-base tabular-nums ${isOverdue ? 'text-rose-500' : inv.status_pago === 'PAGADO' ? 'text-emerald-600' : Number(v) < 0 ? 'text-rose-500' : 'text-amber-600'}`}>${formatCLP(v)}</span>
                            </td>
                          );
                          if (col.key === 'total_bruto' || col.key === 'iva') return (
                            <td key={col.key} className="px-4 py-3 text-right">
                              <span className="font-mono text-sm text-slate-600 tabular-nums">${formatCLP(v)}</span>
                            </td>
                          );
                          if (col.key === 'fecha_venc') return (
                            <td key={col.key} className={`px-4 py-3 font-medium whitespace-nowrap ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                              {v ? formatDate(v) : '—'}
                            </td>
                          );
                          if (col.key === 'centro_costo') return (
                            <td key={col.key} className="px-4 py-3">
                              <span className="text-slate-600 text-xs font-medium bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap">{v || 'N/A'}</span>
                            </td>
                          );
                          if (col.key === 'rut') return (
                            <td key={col.key} className="px-4 py-3">
                              <span className="font-mono text-xs text-slate-600">{v || '—'}</span>
                            </td>
                          );
                          return (
                            <td key={col.key} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {v !== null && v !== undefined && v !== '' ? (col.type === 'date' ? formatDate(String(v)) : String(v)) : '—'}
                            </td>
                          );
                        })}
                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                            <button onClick={() => onViewDetail(inv)} className={`p-1.5 rounded-lg transition-all ${hasItems ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`} title="Ver Detalle">
                              <Search size={16} />
                            </button>
                            <button onClick={() => handleToggleStatus(inv.id, inv.status_pago)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Cambiar Estado">
                              <CheckCircle size={16} />
                            </button>
                            <button onClick={() => onEdit(inv)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Editar">
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => onShowConfirm({ title: 'Eliminar Documento', message: '¿Confirmas la eliminación permanente?', type: 'danger', onConfirm: async () => { const { error } = await deleteInvoice(inv.id); if (error) toast({ type: 'error', message: `Error al eliminar: ${error.message}` }); else toast({ type: 'success', message: 'Documento eliminado' }); }})} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Vista Móvil */}
        <div className="lg:hidden flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-hide">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-16" />
                </div>
              ))
            : paginatedInvoices.map(inv => {
                const isOverdue = inv.status_pago === 'PENDIENTE' && todayStr > inv.fecha_venc;
                const displayProvider = inv.proveedor.length > 20 ? inv.proveedor.substring(0, 20) + '...' : inv.proveedor;
                return (
                  <div key={inv.id} className={`p-4 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors ${isOverdue ? 'bg-rose-50/20' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`shrink-0 ${isOverdue ? 'text-rose-500' : inv.status_pago === 'PAGADO' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {isOverdue ? <AlertTriangle size={12} /> : inv.status_pago === 'PAGADO' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm truncate">{displayProvider}</h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-slate-500 font-medium">#{inv.folio}</span>
                        <span className="text-xs uppercase px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">{inv.tipo_doc}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold font-mono text-base ${isOverdue ? 'text-rose-500' : inv.status_pago === 'PAGADO' ? 'text-emerald-600' : Number(inv.total_a_pagar) < 0 ? 'text-rose-500' : 'text-amber-600'}`}>${formatCLP(inv.total_a_pagar)}</p>
                      <p className={`text-xs font-semibold mt-1 uppercase ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>{formatDate(inv.fecha_venc)}</p>
                    </div>
                    <div className="shrink-0 pl-1">
                      <MobileActionMenu
                        invoice={inv}
                        onEdit={onEdit}
                        onView={onViewDetail}
                        onToggleStatus={handleToggleStatus}
                        onDelete={() => onShowConfirm({ title: 'Eliminar Registro', message: '¿Eliminar este registro?', type: 'danger', onConfirm: async () => { const { error } = await deleteInvoice(inv.id); if (error) toast({ type: 'error', message: `Error al eliminar: ${error.message}` }); else toast({ type: 'success', message: 'Documento eliminado' }); }})}
                      />
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* PAGINACIÓN */}
        <Pagination page={currentPage} totalPages={totalPages} totalItems={filteredInvoices.length} pageSize={itemsPerPage} onPageChange={setCurrentPage} color="blue" position="bottom" />
      </div>

      {/* PAYMENT MODAL */}
      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ isOpen: false, invoiceIds: [] })}
        onConfirm={handlePaymentConfirm}
        count={paymentModal.invoiceIds?.length ?? 1}
        existingAccounts={existingAccounts}
      />

      {/* SIMPLE CONFIRM (revert-to-pending) */}
      <ConfirmModal
        isOpen={simpleConfirm.isOpen}
        onClose={() => setSimpleConfirm(c => ({ ...c, isOpen: false }))}
        onConfirm={simpleConfirm.onConfirm}
        title={simpleConfirm.title}
        message={simpleConfirm.message}
        confirmText="Confirmar"
        type="info"
      />
    </div>
  );
}

export default Dashboard;
