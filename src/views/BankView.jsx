import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Landmark, RefreshCw, TrendingUp, TrendingDown, CreditCard,
  AlertCircle, Loader2, ArrowUpRight, ArrowDownLeft, Database, Clock,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search, Filter, X, Download
} from 'lucide-react';
import { formatDate } from '../utils/formatters';
import MultiSelect from '../components/MultiSelect';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { useToast } from '../context/ToastContext';

const PAGE_SIZE = 20;
const IS_DEV = import.meta.env.DEV;
const SERVER_URL = 'http://localhost:3001';

const formatCLP = (amount) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount ?? 0);

const RANGE_OPTIONS = [
  { label: '30 días',  days: 30  },
  { label: '60 días',  days: 60  },
  { label: '90 días',  days: 90  },
  { label: '180 días', days: 180 },
  { label: '365 días', days: 365 },
];


const BANK_COLUMNS = [
  { key: 'date',        label: 'Fecha',       type: 'date' },
  { key: 'description', label: 'Descripción', type: 'text' },
  { key: 'amount',      label: 'Monto',       type: 'money' },
  { key: 'type',        label: 'Tipo',        type: 'tag' },
];

const EMPTY_BANK_FILTERS = { tipo: [], descripcion: '' };

function groupByAccount(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.account_number ?? row.account_id ?? 'unknown';
    if (!map.has(key)) {
      map.set(key, {
        account_id:     row.account_id,
        account_name:   row.account_name,
        account_number: row.account_number,
        currency:       row.currency,
        movements:      [],
      });
    }
    map.get(key).movements.push(row);
  }
  return Array.from(map.values());
}

function sinceISO(days) {
  const d = Math.min(Math.max(parseInt(days) || 30, 1), 365);
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

export default function BankView({ supabase }) {
  const { toast } = useToast();
  const [accounts, setAccounts]               = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [days, setDays]                       = useState(30);
  const [lastSyncedAt, setLastSyncedAt]       = useState(null);
  const [syncing, setSyncing]                 = useState(false);
  const [page, setPage]                       = useState(1);
  const [search, setSearch]                   = useState('');
  const [sortKey, setSortKey]                 = useState('date');
  const [sortDir, setSortDir]                 = useState('desc');
  const [filters, setFilters]                 = useState(EMPTY_BANK_FILTERS);
  const [showFilters, setShowFilters]         = useState(false);

  const loadFromSupabase = useCallback(async (daysParam) => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const since = sinceISO(daysParam ?? days);
      const { data, error: sbErr } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('date', since)
        .order('date', { ascending: false });
      if (sbErr) throw sbErr;
      const grouped = groupByAccount(data ?? []);
      setAccounts(grouped);
      setSelectedAccount(prev => {
        const match = grouped.find(a => a.account_number === prev?.account_number);
        return match ?? grouped[0] ?? null;
      });
      if (data?.length > 0) {
        const latest = [...data].sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at))[0];
        setLastSyncedAt(latest.synced_at);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, days]);

  const triggerSync = async () => {
    try {
      if (IS_DEV) {
        // Dev: call local server directly (instant sync + upsert)
        const res = await fetch(`${SERVER_URL}/api/fintoc/sync?days=${days}`, {
          method: 'POST',
          signal: AbortSignal.timeout(60000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return { ok: true, message: data.message };
      }
      // Production: trigger GitHub Action via Netlify function
      const res = await fetch('/api/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return { ok: true, message: data.message };
    } catch (err) {
      const msg = err.name === 'TimeoutError'
        ? 'Tiempo de espera agotado — el servidor tardó demasiado.'
        : IS_DEV && (err.message?.includes('fetch') || err.message?.includes('Failed'))
          ? 'No se pudo conectar al servidor local (puerto 3001). ¿Está corriendo `npm run server`?'
          : (err.message ?? 'Error desconocido al sincronizar.');
      return { ok: false, message: msg };
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    const result = await triggerSync();
    await loadFromSupabase();
    setSyncing(false);
    if (result.ok) {
      toast({ type: 'success', message: result.message });
    } else {
      toast({ type: 'error', message: result.message });
    }
  };

  const handleRangeChange = (newDays) => {
    setDays(newDays);
    loadFromSupabase(newDays);
  };

  useEffect(() => { loadFromSupabase(30); }, [supabase]);

  // Reset page when account, search, or filters change
  useEffect(() => { setPage(1); }, [selectedAccount?.account_number, days, search, filters]);

  const activeMovements = selectedAccount?.movements ?? [];

  const activeFilterCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : v !== '').length;
  const isFiltered = search.trim() !== '' || activeFilterCount > 0;

  const filtered = useMemo(() => {
    let rows = activeMovements;

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        String(r.description || '').toLowerCase().includes(q) ||
        String(r.sender_name || '').toLowerCase().includes(q) ||
        String(r.recipient_name || '').toLowerCase().includes(q)
      );
    }

    // Filters
    if (filters.tipo.length > 0) {
      rows = rows.filter(r => {
        const t = r.amount > 0 ? 'Ingreso' : 'Egreso';
        return filters.tipo.includes(t);
      });
    }
    if (filters.descripcion) {
      const q = filters.descripcion.trim().toLowerCase();
      rows = rows.filter(r => String(r.description || '').toLowerCase().includes(q));
    }

    // Sort
    return [...rows].sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (sortKey === 'amount') return sortDir === 'asc' ? (av - bv) : (bv - av);
      if (sortKey === 'type') { av = a.amount > 0 ? 'ingreso' : 'egreso'; bv = b.amount > 0 ? 'ingreso' : 'egreso'; }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [activeMovements, search, filters, sortKey, sortDir]);

  const totalIngresos   = filtered.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const totalEgresos    = filtered.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const clearFilters = () => setFilters(EMPTY_BANK_FILTERS);

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) { toast({ type: 'error', message: 'La librería Excel aún no ha cargado. Intenta en un momento.' }); return; }

    const data = filtered.map(row => ({
      'Fecha': row.date ? formatDate(row.date) : '',
      'Descripción': row.description ?? '',
      'Monto': Number(row.amount) || 0,
      'Tipo': row.amount > 0 ? 'Ingreso' : 'Egreso',
      'Remitente': row.sender_name ?? '',
      'Destinatario': row.recipient_name ?? '',
      'Cuenta': selectedAccount?.account_name ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banco');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `banco_${today}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <header className="px-1 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Landmark size={28} className="text-emerald-600" />
            Datos Bancarios
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1 flex items-center gap-2">
            Banco Santander Chile · sincronizado automáticamente cada 6h.
            {lastSyncedAt && (
              <span className="inline-flex items-center gap-1 text-slate-300 text-xs">
                <Clock size={11} />
                Última sync: {new Date(lastSyncedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Error de Supabase */}
      {error && !loading && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">Error al leer datos</p>
            <p className="text-rose-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <p className="text-sm font-medium">Cargando desde Supabase...</p>
        </div>
      )}

      {/* Sin datos */}
      {!loading && !error && accounts.length === 0 && (
        <EmptyState
          icon={Landmark}
          title={`Sin transacciones en los últimos ${days} días`}
          subtitle="Los datos se sincronizan automáticamente cada 6h via GitHub Actions."
          action={{ label: 'Sincronizar ahora', onClick: handleRefresh, disabled: syncing, icon: RefreshCw }}
        />
      )}

      {!loading && !error && accounts.length > 0 && (
        <>
          {/* Account selector tabs */}
          {accounts.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {accounts.map((acc) => (
                <button
                  key={acc.account_number}
                  onClick={() => setSelectedAccount(acc)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    selectedAccount?.account_number === acc.account_number
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {acc.account_name}
                </button>
              ))}
            </div>
          )}

          {selectedAccount && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={16} className="text-slate-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuenta</p>
                  </div>
                  <p className="text-base font-bold text-slate-900">{selectedAccount.account_name}</p>
                  <p className="text-sm text-slate-400 font-medium mt-0.5">
                    {selectedAccount.account_number} · {selectedAccount.currency}
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 lg:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Ingresos{isFiltered ? ' (filtrado)' : ''}</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-700">{formatCLP(totalIngresos)}</p>
                  <p className="text-xs text-emerald-500 font-medium mt-0.5">
                    {filtered.filter(m => m.amount > 0).length} transacciones
                  </p>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 lg:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={16} className="text-rose-500" />
                    <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Egresos{isFiltered ? ' (filtrado)' : ''}</p>
                  </div>
                  <p className="text-xl font-bold text-rose-700">{formatCLP(totalEgresos)}</p>
                  <p className="text-xs text-rose-500 font-medium mt-0.5">
                    {filtered.filter(m => m.amount < 0).length} transacciones
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Buscar por descripción, remitente o destinatario..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
              </div>

              {/* Filters toggle + days selector + Actualizar */}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowFilters(p => !p)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${showFilters ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
                  >
                    <Filter size={15} />
                    <span>Filtros</span>
                    {activeFilterCount > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${showFilters ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{activeFilterCount}</span>
                    )}
                  </button>

                  {/* Selector de rango */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {RANGE_OPTIONS.map(opt => (
                      <button
                        key={opt.days}
                        onClick={() => handleRangeChange(opt.days)}
                        disabled={loading || syncing}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          days === opt.days
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        } disabled:opacity-50`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Exportar Excel + Actualizar — alineados a la derecha */}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={handleExportExcel}
                      disabled={filtered.length === 0}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 bg-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Exportar movimientos filtrados a Excel"
                    >
                      <Download size={15} />
                      <span>Exportar Excel</span>
                    </button>
                    <button
                      onClick={handleRefresh}
                      disabled={loading || syncing}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                      {syncing
                        ? <Loader2 size={15} className="animate-spin" />
                        : <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
                      Actualizar
                    </button>
                  </div>
                </div>

                {showFilters && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-3">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Filter size={14} className="text-emerald-500" /> Filtros
                        {activeFilterCount > 0 && <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{activeFilterCount} activo{activeFilterCount !== 1 ? 's' : ''}</span>}
                      </h3>
                      <div className="flex items-center gap-2">
                        {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs text-rose-500 font-medium hover:underline">Limpiar todo</button>}
                        <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={15} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <MultiSelect
                        label="Tipo"
                        options={['Ingreso', 'Egreso']}
                        selectedValues={filters.tipo}
                        onChange={(vals) => setFilters(f => ({ ...f, tipo: vals }))}
                        placeholder="Todos"
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wide px-1">Descripción</label>
                        <input type="text" placeholder="Buscar en descripción..." value={filters.descripcion}
                          onChange={e => setFilters(f => ({ ...f, descripcion: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Movements table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs font-medium text-slate-500">
                    {filtered.length} movimiento{filtered.length !== 1 ? 's' : ''} — últimos {days} días
                    {isFiltered ? ' (filtrado)' : ''}
                    {filtered.length > 0 && ` — pág. ${safePage}/${totalPages}`}
                  </span>
                  <Pagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} color="emerald" position="top" />
                </div>

                {filtered.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm font-medium">
                    {(search || activeFilterCount > 0)
                      ? 'No hay movimientos que coincidan con los filtros aplicados.'
                      : `No hay movimientos en los últimos ${days} días.`}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          {BANK_COLUMNS.map(col => {
                            const align = col.type === 'money' ? 'text-right' : col.type === 'tag' ? 'text-center' : 'text-left';
                            return (
                              <th key={col.key} onClick={() => handleSort(col.key)}
                                className={`${align} px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 whitespace-nowrap select-none`}>
                                <div className={`flex items-center gap-1 ${col.type === 'money' ? 'justify-end' : col.type === 'tag' ? 'justify-center' : ''}`}>
                                  {col.label}
                                  {sortKey === col.key
                                    ? sortDir === 'asc' ? <ChevronUp size={12} className="text-emerald-500" /> : <ChevronDown size={12} className="text-emerald-500" />
                                    : <ChevronUp size={12} className="opacity-0" />}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pageRows.map((mov) => {
                          const isCredit = mov.amount > 0;
                          return (
                            <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                                {mov.date ? formatDate(mov.date) : '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-medium max-w-xs">
                                <p className="truncate">{mov.description ?? '—'}</p>
                                {(mov.sender_name || mov.recipient_name) && (
                                  <p className="text-xs text-slate-400 truncate mt-0.5">
                                    {isCredit ? `De: ${mov.sender_name}` : `A: ${mov.recipient_name}`}
                                  </p>
                                )}
                              </td>
                              <td className={`px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap ${
                                isCredit ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {isCredit ? '+' : ''}{formatCLP(mov.amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {isCredit
                                    ? <><ArrowDownLeft size={11} />Ingreso</>
                                    : <><ArrowUpRight size={11} />Egreso</>}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} color="emerald" position="bottom" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
