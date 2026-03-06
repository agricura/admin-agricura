import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle, Clock, FileText, Wallet, Search,
  ChevronLeft, ChevronRight, Trash2, Pencil,
  Settings2, ChevronUp, ChevronDown, RotateCcw,
  Eye, EyeOff, X,
} from 'lucide-react';
import MultiSelect from '../components/MultiSelect';
import DateInput from '../components/DateInput';
import MobileActionMenu from '../components/MobileActionMenu';
import { formatCLP, formatDate } from '../utils/formatters';

const DASH_COL_KEY = 'dashboard_visible_columns';

const ALL_COLUMNS = [
  { key: 'rut',           label: 'RUT',              type: 'text',   defaultVisible: true  },
  { key: 'tipo_doc',      label: 'Tipo Doc.',         type: 'text',   defaultVisible: false },
  { key: 'fecha_emision', label: 'Emisión',           type: 'date',   defaultVisible: true  },
  { key: 'fecha_venc',    label: 'Vencimiento',       type: 'date',   defaultVisible: true  },
  { key: 'fecha_pago',    label: 'Fecha Pago',        type: 'date',   defaultVisible: false },
  { key: 'centro_costo',  label: 'Centro Costo',      type: 'text',   defaultVisible: true  },
  { key: 'item',          label: 'Categoría',         type: 'text',   defaultVisible: false },
  { key: 'total_bruto',   label: 'Total Neto',        type: 'money',  defaultVisible: false },
  { key: 'iva',           label: 'IVA',               type: 'money',  defaultVisible: false },
  { key: 'total_a_pagar', label: 'Monto',             type: 'money',  defaultVisible: true  },
  { key: 'status_pago',   label: 'Estado',            type: 'status', defaultVisible: true  },
  { key: 'cuenta_pago',   label: 'Cuenta Pago',       type: 'text',   defaultVisible: false },
];

function Dashboard({ supabase, onEdit, onViewDetail, onShowConfirm }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [showColPanel, setShowColPanel] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(DASH_COL_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
  });
  const saveVisibleCols = (cols) => { setVisibleCols(cols); localStorage.setItem(DASH_COL_KEY, JSON.stringify(cols)); };
  const toggleCol = (key) => {
    saveVisibleCols(visibleCols.includes(key) ? visibleCols.filter(k => k !== key) : [...visibleCols, key]);
  };
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [sortKey, setSortKey]   = useState('fecha_emision');
  const [sortDir, setSortDir]   = useState('desc');
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const [filters, setFilters] = useState({
    search: '', providers: [], costCenters: [], types: [], status: [], startDate: '', endDate: '',
  });

  useEffect(() => { fetchInvoices(); }, []);
  useEffect(() => { setCurrentPage(1); }, [sortKey, sortDir]);

  const fetchInvoices = async () => {
    setLoading(true);
    let allInvoices = [];
    let from = 0;
    try {
      while (true) {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .order('fecha_emision', { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        allInvoices = [...allInvoices, ...data];
        if (data.length < 1000) break;
        else from += 1000;
      }
      setInvoices(allInvoices);
    } catch (e) {
      console.error('Error fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'PENDIENTE' ? 'PAGADO' : 'PENDIENTE';
    const newFechaPago = newStatus === 'PAGADO' ? new Date().toISOString() : null;
    onShowConfirm({
      title: 'Actualizar Estado',
      message: `¿Cambiar el estado del documento a ${newStatus}?`,
      onConfirm: async () => {
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === id ? { ...inv, status_pago: newStatus, fecha_pago: newFechaPago } : inv))
        );
        const { error } = await supabase
          .from('invoices')
          .update({ status_pago: newStatus, fecha_pago: newFechaPago })
          .eq('id', id);
        if (error) { console.error('Error backend:', error); fetchInvoices(); }
      },
    });
  };

  const clearFilters = () => {
    setFilters({ search: '', providers: [], costCenters: [], types: [], status: [], startDate: '', endDate: '' });
    setCurrentPage(1);
  };

  const filterOptions = useMemo(() => ({
    providers: [...new Set(invoices.map((i) => i.proveedor).filter(Boolean))].sort(),
    costCenters: [...new Set(invoices.map((i) => i.centro_costo).filter(Boolean))].sort(),
    types: [...new Set(invoices.map((i) => i.tipo_doc).filter(Boolean))].sort(),
    status: ['PENDIENTE', 'PAGADO', 'VENCIDA'],
  }), [invoices]);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch = !filters.search || inv.proveedor?.toLowerCase().includes(filters.search.toLowerCase()) || inv.folio?.toString().includes(filters.search);
      const matchesStatus = filters.status.length === 0 || filters.status.some((s) => {
        if (s === 'PAGADO') return inv.status_pago === 'PAGADO';
        if (s === 'VENCIDA') return inv.status_pago === 'PENDIENTE' && todayStr > inv.fecha_venc;
        if (s === 'PENDIENTE') return inv.status_pago === 'PENDIENTE' && todayStr <= inv.fecha_venc;
        return false;
      });
      const matchesDate = (!filters.startDate || inv.fecha_emision >= filters.startDate) && (!filters.endDate || inv.fecha_emision <= filters.endDate);
      const matchesProvider = filters.providers.length === 0 || filters.providers.includes(inv.proveedor);
      const matchesCostCenter = filters.costCenters.length === 0 || filters.costCenters.includes(inv.centro_costo);
      const matchesType = filters.types.length === 0 || filters.types.includes(inv.tipo_doc);
      return matchesSearch && matchesStatus && matchesDate && matchesProvider && matchesCostCenter && matchesType;
    }).sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      const colType = sortKey === 'proveedor' ? 'text' : (ALL_COLUMNS.find(c => c.key === sortKey)?.type ?? 'text');
      if (colType === 'date') { av = av || ''; bv = bv || ''; }
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'es') : String(bv).localeCompare(String(av), 'es');
    });
  }, [invoices, filters, todayStr, sortKey, sortDir]);

  const stats = useMemo(() => ({
    pend: filteredInvoices.filter((inv) => inv.status_pago === 'PENDIENTE').reduce((s, i) => s + Number(i.total_a_pagar), 0),
    paid: filteredInvoices.filter((inv) => inv.status_pago === 'PAGADO').reduce((s, i) => s + Number(i.total_a_pagar), 0),
  }), [filteredInvoices]);

  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredInvoices, currentPage]
  );
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  return (
    <div className="space-y-6 flex flex-col min-h-full">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Datos Agricura
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {invoices.length > 0 ? `${invoices.length} documentos cargados` : 'Sin datos cargados aún'}
          </p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Total Pendiente', val: stats.pend, color: 'rose', icon: <Clock size={18} /> },
          { label: 'Total Pagado', val: stats.paid, color: 'emerald', icon: <CheckCircle size={18} /> },
          { label: 'Docs Filtrados', val: filteredInvoices.length, color: 'blue', raw: true, icon: <FileText size={18} /> },
          { label: 'Sistema', val: 'Conectado', color: 'emerald', text: true, icon: <Wallet size={18} /> },
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

      {/* FILTROS */}
      <div className="bg-white rounded-xl border border-slate-200/60">
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="lg:hidden w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5 text-slate-700 font-semibold text-sm"><Settings2 size={18} className="text-blue-500" /> Filtros de Búsqueda</div>
          {isFiltersOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </button>

        <div className={`transition-all duration-300 ${isFiltersOpen ? 'max-h-[1200px] opacity-100 overflow-visible' : 'max-h-0 lg:max-h-none opacity-0 lg:opacity-100 hidden lg:block overflow-hidden'}`}>
          <div className="p-5 lg:p-6 lg:pb-8 space-y-6">

            <div className="lg:hidden flex justify-end">
              <button onClick={clearFilters} className="text-xs font-semibold text-blue-600 flex items-center gap-1.5 py-2 px-4 bg-blue-50 rounded-lg active:scale-[0.98] transition-all">
                <RotateCcw size={14} /> Reiniciar
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                value={filters.search}
                onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setCurrentPage(1); }}
                placeholder="Buscar por Proveedor, Folio..."
                className="w-full pl-11 pr-5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <MultiSelect label="Proveedor" options={filterOptions.providers} selectedValues={filters.providers} onChange={(vals) => { setFilters({ ...filters, providers: vals }); setCurrentPage(1); }} placeholder="Todos" />
              <MultiSelect label="Centro de Costo" options={filterOptions.costCenters} selectedValues={filters.costCenters} onChange={(vals) => { setFilters({ ...filters, costCenters: vals }); setCurrentPage(1); }} placeholder="Todos" />
              <MultiSelect label="Tipo Documento" options={filterOptions.types} selectedValues={filters.types} onChange={(vals) => { setFilters({ ...filters, types: vals }); setCurrentPage(1); }} placeholder="Todos" />
              <MultiSelect label="Estado" options={['PAGADO', 'PENDIENTE', 'VENCIDA']} selectedValues={filters.status} onChange={(vals) => { setFilters({ ...filters, status: vals }); setCurrentPage(1); }} placeholder="Todos" />
            </div>

            <div className="pt-5 border-t border-slate-100">
              <div className="flex flex-col md:flex-row items-end gap-5 w-full">
                <div className="w-full md:w-64 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Desde</label>
                  <DateInput value={filters.startDate} onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setCurrentPage(1); }} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all" />
                </div>
                <div className="w-full md:w-64 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Hasta</label>
                  <DateInput value={filters.endDate} onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setCurrentPage(1); }} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all" />
                </div>
                <div className="hidden md:block ml-auto">
                  <button onClick={clearFilters} className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98] text-sm font-medium">
                    <RotateCcw size={16} /> Limpiar Filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL SELECTOR DE COLUMNAS */}
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${
                    active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
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

      {/* TABLA */}
      <div className="bg-white rounded-xl border border-slate-200/60 flex flex-col flex-1 overflow-hidden min-h-[450px]">
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-sm font-semibold text-slate-500">Mostrando <span className="text-slate-800">{filteredInvoices.length}</span> de <span className="text-slate-800">{invoices.length}</span> documentos</p>
          <button
            onClick={() => setShowColPanel(p => !p)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${
              showColPanel ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
            }`}
          >
            <Settings2 size={14} />
            <span className="hidden sm:inline">Columnas</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              showColPanel ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
            }`}>{visibleCols.length}</span>
          </button>
        </div>
        {/* Vista Escritorio */}
        <div className="hidden lg:block overflow-x-auto flex-1 scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
              <tr className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <th
                  onClick={() => handleSort('proveedor')}
                  className="px-6 py-4 whitespace-nowrap cursor-pointer select-none hover:text-slate-600 transition-colors"
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
                    className={`px-6 py-4 whitespace-nowrap cursor-pointer select-none hover:text-slate-600 transition-colors${col.type === 'money' ? ' text-right' : col.type === 'status' ? ' text-center' : ''}`}
                  >
                    <span className={`flex items-center gap-1${col.type === 'money' ? ' justify-end' : col.type === 'status' ? ' justify-center' : ''}`}>
                      {col.label}
                      {sortKey === col.key
                        ? sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />
                        : <ChevronUp size={12} className="opacity-20" />}
                    </span>
                  </th>
                ))}
                <th className="px-6 py-4 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedInvoices.map((inv) => {
                const isOverdue = inv.status_pago === 'PENDIENTE' && todayStr > inv.fecha_venc;
                const hasItems = inv.items && Array.isArray(inv.items) && inv.items.length > 0;
                return (
                  <tr key={inv.id} className={`hover:bg-blue-50/30 transition-colors group ${isOverdue ? 'bg-rose-50/20' : ''}`}>
                    {/* Columna fija: Proveedor / Folio */}
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 truncate max-w-[200px] mb-1">{inv.proveedor}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-slate-500 text-xs">#{inv.folio}</span>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase">{inv.tipo_doc}</span>
                      </div>
                    </td>

                    {/* Columnas dinámicas */}
                    {ALL_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => {
                      const v = inv[col.key];

                      if (col.key === 'status_pago') return (
                        <td key={col.key} className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
                            isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            v === 'PAGADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isOverdue ? 'bg-rose-500' : v === 'PAGADO' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`} />
                            {isOverdue ? 'VENCIDA' : (v || '—')}
                          </span>
                        </td>
                      );

                      if (col.key === 'total_a_pagar') return (
                        <td key={col.key} className="px-6 py-4 text-right">
                          <span className={`font-bold font-mono text-base tabular-nums ${
                            isOverdue ? 'text-rose-500' :
                            inv.status_pago === 'PAGADO' ? 'text-emerald-600' :
                            Number(v) < 0 ? 'text-rose-500' : 'text-amber-600'
                          }`}>${formatCLP(v)}</span>
                        </td>
                      );

                      if (col.key === 'total_bruto' || col.key === 'iva') return (
                        <td key={col.key} className="px-6 py-4 text-right">
                          <span className="font-mono text-sm text-slate-600 tabular-nums">${formatCLP(v)}</span>
                        </td>
                      );

                      if (col.key === 'fecha_venc') return (
                        <td key={col.key} className={`px-6 py-4 font-medium whitespace-nowrap ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                          {v ? formatDate(v) : '—'}
                        </td>
                      );

                      if (col.key === 'centro_costo') return (
                        <td key={col.key} className="px-6 py-4">
                          <span className="text-slate-600 text-xs font-medium bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap">{v || 'N/A'}</span>
                        </td>
                      );

                      if (col.key === 'rut') return (
                        <td key={col.key} className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-600">{v || '—'}</span>
                        </td>
                      );

                      // Genérico: texto / fecha / número
                      return (
                        <td key={col.key} className="px-6 py-4 text-slate-600 whitespace-nowrap">
                          {v !== null && v !== undefined && v !== '' ? (col.type === 'date' ? formatDate(String(v)) : String(v)) : '—'}
                        </td>
                      );
                    })}

                    {/* Acciones */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button onClick={() => onViewDetail(inv)} className={`p-1.5 rounded-lg transition-all ${hasItems ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`} title="Ver Detalle">
                          <Search size={16} />
                        </button>
                        <button onClick={() => toggleStatus(inv.id, inv.status_pago)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Cambiar Estado"><CheckCircle size={16} /></button>
                        <button onClick={() => onEdit(inv)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Editar"><Pencil size={16} /></button>
                        <button onClick={() => onShowConfirm({ title: 'Eliminar Documento', message: '¿Confirmas la eliminación permanente?', onConfirm: async () => { await supabase.from('invoices').delete().eq('id', inv.id); fetchInvoices(); }, type: 'danger' })} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Vista Móvil */}
        <div className="lg:hidden flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-hide">
          {paginatedInvoices.map((inv) => {
            const isOverdue = inv.status_pago === 'PENDIENTE' && todayStr > inv.fecha_venc;
            const displayProvider = inv.proveedor.length > 20 ? inv.proveedor.substring(0, 20) + '...' : inv.proveedor;
            return (
              <div key={inv.id} className={`p-4 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors ${isOverdue ? 'bg-rose-50/20' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-rose-500 animate-pulse' : inv.status_pago === 'PAGADO' ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                    <h4 className="font-bold text-slate-900 text-sm truncate">{displayProvider}</h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-slate-500 font-medium">#{inv.folio}</span>
                    <span className="text-xs uppercase px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">{inv.tipo_doc}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold font-mono text-base ${
                    isOverdue ? 'text-rose-500' :
                    inv.status_pago === 'PAGADO' ? 'text-emerald-600' :
                    Number(inv.total_a_pagar) < 0 ? 'text-rose-500' : 'text-amber-600'
                  }`}>${formatCLP(inv.total_a_pagar)}</p>
                  <p className={`text-xs font-semibold mt-1 uppercase ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>{formatDate(inv.fecha_venc)}</p>
                </div>
                <div className="shrink-0 pl-1">
                  <MobileActionMenu
                    invoice={inv}
                    onEdit={onEdit}
                    onView={onViewDetail}
                    onToggleStatus={toggleStatus}
                    onDelete={() => onShowConfirm({ title: 'Eliminar Registro', message: '¿Eliminar este registro?', onConfirm: async () => { await supabase.from('invoices').delete().eq('id', inv.id); fetchInvoices(); }, type: 'danger' })}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* PAGINACIÓN */}
        {totalPages > 1 && (
          <div className="px-5 py-3 lg:px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <span className="text-sm font-medium text-slate-500">Página {currentPage} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => { setCurrentPage((p) => Math.max(p - 1, 1)); window.scrollTo(0, 0); }} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 active:scale-[0.98] transition-all text-slate-600"><ChevronLeft size={18} /></button>
              <button onClick={() => { setCurrentPage((p) => Math.min(p + 1, totalPages)); window.scrollTo(0, 0); }} disabled={currentPage === totalPages} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 active:scale-[0.98] transition-all text-slate-600"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
