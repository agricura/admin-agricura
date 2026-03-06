import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, RefreshCw, TrendingUp, TrendingDown, CreditCard, AlertCircle, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatDate } from '../utils/formatters';

const SERVER_URL = 'http://localhost:3001';

const formatCLP = (amount) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount ?? 0);

export default function BankView() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/fintoc/movements`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setAccounts(data);
      setSelectedAccount(data[0] ?? null);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  const activeMovements = selectedAccount?.movements ?? [];
  const totalIngresos = activeMovements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const totalEgresos = activeMovements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <header className="px-1 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Landmark size={28} className="text-emerald-600" />
            Datos Bancarios
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Movimientos extraídos desde Banco Santander Chile via Fintoc.
            {lastFetch && (
              <span className="ml-2 text-slate-300">
                Actualizado {lastFetch.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchMovements}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all active:scale-[0.97] disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </header>

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">No se pudo conectar al servidor</p>
            <p className="text-rose-500 mt-0.5">{error}</p>
            <p className="text-rose-400 mt-1 text-xs">
              Asegúrate de que el servidor esté corriendo con <code className="bg-rose-100 px-1 rounded font-mono">npm run server</code>
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <p className="text-sm font-medium">Consultando Fintoc...</p>
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
                  <p className="text-sm text-slate-400 font-medium mt-0.5">{selectedAccount.account_number} · {selectedAccount.currency}</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Ingresos (30d)</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-700">{formatCLP(totalIngresos)}</p>
                  <p className="text-xs text-emerald-500 font-medium mt-0.5">
                    {activeMovements.filter(m => m.amount > 0).length} transacciones
                  </p>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={16} className="text-rose-500" />
                    <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Egresos (30d)</p>
                  </div>
                  <p className="text-xl font-bold text-rose-700">{formatCLP(totalEgresos)}</p>
                  <p className="text-xs text-rose-500 font-medium mt-0.5">
                    {activeMovements.filter(m => m.amount < 0).length} transacciones
                  </p>
                </div>
              </div>

              {/* Movements table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Movimientos — últimos 30 días
                    <span className="ml-2 text-xs font-semibold text-slate-400">({activeMovements.length})</span>
                  </h3>
                </div>

                {activeMovements.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm font-medium">
                    No hay movimientos en los últimos 30 días.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</th>
                          <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Monto</th>
                          <th className="text-center px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeMovements.map((mov, i) => {
                          const isCredit = mov.amount > 0;
                          return (
                            <tr key={mov.id ?? i} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-6 py-3.5 text-slate-500 font-medium whitespace-nowrap">
                                {formatDate(mov.post_date ?? mov.transaction_date)}
                              </td>
                              <td className="px-6 py-3.5 text-slate-700 font-medium max-w-xs truncate">
                                {mov.description ?? '—'}
                              </td>
                              <td className={`px-6 py-3.5 text-right font-bold tabular-nums whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isCredit ? '+' : ''}{formatCLP(mov.amount)}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  isCredit
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {isCredit
                                    ? <><ArrowDownLeft size={11} />Ingreso</>
                                    : <><ArrowUpRight size={11} />Egreso</>
                                  }
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

      {!loading && !error && accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Landmark size={40} className="text-slate-300" />
          <p className="text-sm font-semibold">No hay cuentas vinculadas</p>
          <p className="text-xs text-slate-300">Verifica que FINTOC_LINK_TOKEN esté configurado en .env</p>
        </div>
      )}

    </div>
  );
}
