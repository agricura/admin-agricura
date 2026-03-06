import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark, RefreshCw, TrendingUp, TrendingDown, CreditCard,
  AlertCircle, Loader2, ArrowUpRight, ArrowDownLeft, Database, Clock
} from 'lucide-react';
import { formatDate } from '../utils/formatters';

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

const STATUS_STYLES = {
  pendiente:  'bg-amber-50   text-amber-700  border-amber-200',
  conciliado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  revisado:   'bg-blue-50    text-blue-700   border-blue-200',
  ignorado:   'bg-slate-100  text-slate-500  border-slate-200',
};

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
  const [accounts, setAccounts]               = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [days, setDays]                       = useState(30);
  const [lastSyncedAt, setLastSyncedAt]       = useState(null);
  const [syncing, setSyncing]                 = useState(false);
  const [syncMsg, setSyncMsg]                 = useState(null);

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

  const triggerServerSync = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/fintoc/sync?days=${days}`, {
        method: 'POST',
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return { ok: true, message: data.message };
    } catch (err) {
      return { ok: false, message: null };
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const result = await triggerServerSync();
    await loadFromSupabase();
    setSyncing(false);
    if (result.ok) {
      setSyncMsg({ type: 'ok', text: result.message });
      setTimeout(() => setSyncMsg(null), 6000);
    }
  };

  const handleRangeChange = (newDays) => {
    setDays(newDays);
    loadFromSupabase(newDays);
  };

  useEffect(() => { loadFromSupabase(30); }, [supabase]);

  const activeMovements = selectedAccount?.movements ?? [];
  const totalIngresos   = activeMovements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const totalEgresos    = activeMovements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0);

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
        <div className="flex items-center gap-2 flex-wrap shrink-0">
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
          {/* Botón Actualizar */}
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
      </header>

      {/* Feedback sync */}
      {syncMsg && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
          <Database size={16} className="shrink-0 mt-0.5" />
          <p className="font-medium">{syncMsg.text}</p>
        </div>
      )}

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
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
          <Landmark size={40} className="text-slate-300" />
          <p className="text-sm font-semibold">Sin transacciones en los últimos {days} días</p>
          <p className="text-xs text-slate-300 max-w-sm text-center">
            Los datos se sincronizan automáticamente cada 6h via GitHub Actions.
            Para forzar una sincronización ahora, haz click en <strong className="text-slate-400">Actualizar</strong>{' '}
            (requiere que el servidor local esté corriendo).
          </p>
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all active:scale-[0.97] disabled:opacity-50 mt-2"
          >
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Sincronizar ahora
          </button>
        </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={16} className="text-slate-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuenta</p>
                  </div>
                  <p className="text-base font-bold text-slate-900">{selectedAccount.account_name}</p>
                  <p className="text-sm text-slate-400 font-medium mt-0.5">
                    {selectedAccount.account_number} · {selectedAccount.currency}
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Ingresos ({days}d)</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-700">{formatCLP(totalIngresos)}</p>
                  <p className="text-xs text-emerald-500 font-medium mt-0.5">
                    {activeMovements.filter(m => m.amount > 0).length} transacciones
                  </p>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={16} className="text-rose-500" />
                    <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Egresos ({days}d)</p>
                  </div>
                  <p className="text-xl font-bold text-rose-700">{formatCLP(totalEgresos)}</p>
                  <p className="text-xs text-rose-500 font-medium mt-0.5">
                    {activeMovements.filter(m => m.amount < 0).length} transacciones
                  </p>
                </div>
              </div>

              {/* Movements table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Movimientos — últimos {days} días
                    <span className="ml-2 text-xs font-semibold text-slate-400">({activeMovements.length})</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-medium hidden sm:block">
                    Datos desde Supabase · sync auto cada 6h
                  </span>
                </div>

                {activeMovements.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm font-medium">
                    No hay movimientos en los últimos {days} días.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Monto</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeMovements.map((mov) => {
                          const isCredit = mov.amount > 0;
                          const statusStyle = STATUS_STYLES[mov.status] ?? STATUS_STYLES.pendiente;
                          return (
                            <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-5 py-3.5 text-slate-500 font-medium whitespace-nowrap">
                                {mov.date ? formatDate(mov.date) : '—'}
                              </td>
                              <td className="px-5 py-3.5 text-slate-700 font-medium max-w-xs">
                                <p className="truncate">{mov.description ?? '—'}</p>
                                {(mov.sender_name || mov.recipient_name) && (
                                  <p className="text-xs text-slate-400 truncate mt-0.5">
                                    {isCredit ? `De: ${mov.sender_name}` : `A: ${mov.recipient_name}`}
                                  </p>
                                )}
                              </td>
                              <td className={`px-5 py-3.5 text-right font-bold tabular-nums whitespace-nowrap ${
                                isCredit ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {isCredit ? '+' : ''}{formatCLP(mov.amount)}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {isCredit
                                    ? <><ArrowDownLeft size={11} />Ingreso</>
                                    : <><ArrowUpRight size={11} />Egreso</>}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusStyle}`}>
                                  {mov.status ?? 'pendiente'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
