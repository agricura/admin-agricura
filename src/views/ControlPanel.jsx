import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, CheckCircle, Clock, FileText,
  TrendingUp, AlertTriangle, BarChart3, Loader2, Calendar, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { formatCLP, formatDate } from '../utils/formatters';
import InvoiceDetailModal from '../components/InvoiceDetailModal';

// ── Helpers ───────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="h-7 bg-slate-100 rounded-lg animate-pulse w-28" />
);

const KpiCard = ({ label, value, prefix = '$', color, icon, loading }) => {
  const colors = {
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   icon: 'bg-amber-50 text-amber-600'   },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    icon: 'bg-rose-50 text-rose-600'     },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-50 text-emerald-600'},
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'bg-blue-50 text-blue-600'     },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  icon: 'bg-violet-50 text-violet-600' },
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  icon: 'bg-indigo-50 text-indigo-600' },
    slate:   { bg: 'bg-slate-100',  text: 'text-slate-700',   icon: 'bg-slate-100 text-slate-600'  },
  };
  const c = colors[color] ?? colors.blue;
  return (
    <div className="bg-white p-4 lg:p-5 rounded-xl border border-slate-200/60 flex items-start gap-3 hover:shadow-md transition-all duration-200">
      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${c.icon}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400 mb-1 truncate">{label}</p>
        {loading
          ? <Skeleton />
          : <p className={`text-xl font-bold font-mono truncate ${c.text}`}>
              {prefix}{prefix === '$' ? formatCLP(value) : value}
            </p>
        }
      </div>
    </div>
  );
};

const SectionHeading = ({ color, title, badge }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className={`w-2 h-5 rounded-full ${color}`} />
    <h3 className="text-base font-bold text-slate-800">{title}</h3>
    {badge && <span className="text-xs text-slate-400 font-medium">{badge}</span>}
  </div>
);

const SortTh = ({ label, colKey, sort, onSort, right = false }) => {
  const active = sort.key === colKey;
  return (
    <th
      onClick={() => onSort(colKey)}
      className={`px-5 py-3 ${right ? 'text-right' : 'text-left'} cursor-pointer select-none group`}
    >
      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''} ${
        active ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'
      } transition-colors`}>
        {label}
        <span className="text-xs">{active ? (sort.dir === 'asc' ? '▲' : '▼') : <span className="opacity-0 group-hover:opacity-40">▼</span>}</span>
      </span>
    </th>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ControlPanel({ supabase }) {
  const [invoices,    setInvoices]    = useState([]);
  const [siiRecords,  setSiiRecords]  = useState([]);
  const [loadingInv,  setLoadingInv]  = useState(true);
  const [loadingSII,  setLoadingSII]  = useState(true);
  const [weeklyModal,   setWeeklyModal]   = useState(null);
  const [upcomingPage,  setUpcomingPage]  = useState(1);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const UPCOMING_PAGE_SIZE = 7;

  const [siiTipoSort,  setSiiTipoSort]  = useState({ key: 'total', dir: 'desc' });
  const [siiMonthSort, setSiiMonthSort] = useState({ key: 'mes',   dir: 'desc' });
  const [siiMonthModal, setSiiMonthModal] = useState(null); // null | [mes, {neto,total,count,docs}]

  const fmtSiiDate = (v) => {
    if (!v) return '—';
    return formatDate(String(v).replace(/\//g, '-'));
  };

  const handleTipoSort  = (k) => setSiiTipoSort(s  => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }));
  const handleMonthSort = (k) => setSiiMonthSort(s => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }));

  useEffect(() => {
    const fetchAll = async (table, setter, setLoading) => {
      let all = [], from = 0;
      while (true) {
        const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
        if (error || !data) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      setter(all);
      setLoading(false);
    };
    fetchAll('invoices',    setInvoices,   setLoadingInv);
    fetchAll('sii_records', setSiiRecords, setLoadingSII);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Agricura stats ────────────────────────────────────────────────────────
  const agriStats = useMemo(() => {
    const pendList   = invoices.filter(i => i.status_pago === 'PENDIENTE' && (i.fecha_venc ?? '') >= todayStr);
    const overdueList= invoices.filter(i => i.status_pago === 'PENDIENTE' && (i.fecha_venc ?? '') <  todayStr);
    const paidList   = invoices.filter(i => i.status_pago === 'PAGADO');
    const sum = (arr, k) => arr.reduce((s, i) => s + Number(i[k] || 0), 0);

    // By tipo_doc
    const byTipo = {};
    invoices.forEach(inv => {
      const k = inv.tipo_doc || 'Otro';
      if (!byTipo[k]) byTipo[k] = { count: 0, total: 0 };
      byTipo[k].count += 1;
      byTipo[k].total += Number(inv.total_a_pagar || 0);
    });

    // Upcoming: all pending docs sorted by fecha_venc asc (soonest first)
    const upcoming = invoices
      .filter(i => i.status_pago === 'PENDIENTE' && (i.fecha_venc ?? ''))
      .sort((a, b) => (a.fecha_venc ?? '').localeCompare(b.fecha_venc ?? ''));

    // Recent 4
    const recent = [...invoices]
      .sort((a, b) => (b.fecha_emision ?? '').localeCompare(a.fecha_emision ?? ''))
      .slice(0, 4);

    // Weekly buckets for pending non-overdue
    const addDays = (str, n) => {
      const d = new Date(str); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().split('T')[0];
    };
    const d7  = addDays(todayStr, 7);
    const d14 = addDays(todayStr, 14);
    const d21 = addDays(todayStr, 21);
    const d28 = addDays(todayStr, 28);
    const weeklyBuckets = [
      { label: 'Próximos 7 días',  range: `Hasta ${d7}`,   from: todayStr, to: d7,  count: 0, total: 0, color: 'rose',   docs: [] },
      { label: '8 – 14 días',      range: `Hasta ${d14}`,  from: d7,       to: d14, count: 0, total: 0, color: 'amber',  docs: [] },
      { label: '15 – 21 días',     range: `Hasta ${d21}`,  from: d14,      to: d21, count: 0, total: 0, color: 'yellow', docs: [] },
      { label: '22 – 28 días',     range: `Hasta ${d28}`,  from: d21,      to: d28, count: 0, total: 0, color: 'slate',  docs: [] },
    ];
    invoices
      .filter(i => i.status_pago === 'PENDIENTE' && (i.fecha_venc ?? '') >= todayStr)
      .forEach(i => {
        const fv = i.fecha_venc ?? '';
        const b = weeklyBuckets.find(bk => fv >= bk.from && fv <= bk.to);
        if (b) { b.count++; b.total += Number(i.total_a_pagar || 0); b.docs.push(i); }
      });
    weeklyBuckets.forEach(b => b.docs.sort((a, z) => (a.fecha_venc ?? '').localeCompare(z.fecha_venc ?? '')));

    return {
      totalPending: sum(pendList,    'total_a_pagar'),
      totalOverdue: sum(overdueList, 'total_a_pagar'),
      totalPaid:    sum(paidList,    'total_a_pagar'),
      countPending: pendList.length,
      countOverdue: overdueList.length,
      countPaid:    paidList.length,
      byTipo, upcoming, recent, weeklyBuckets,
    };
  }, [invoices, todayStr]);

  // ── SII stats ─────────────────────────────────────────────────────────────
  const siiStats = useMemo(() => {
    const totalNeto  = siiRecords.reduce((s, r) => s + Number(r.monto_neto || 0), 0);
    const totalIVA   = siiRecords.reduce((s, r) => s + Number(r.monto_iva_recuperable || 0), 0);
    const totalMonto = siiRecords.reduce((s, r) => s + Number(r.monto_total || 0), 0);

    // By tipo_compra
    const byTipo = {};
    siiRecords.forEach(r => {
      const k = r.tipo_compra?.trim() || 'Sin Tipo';
      if (!byTipo[k]) byTipo[k] = { count: 0, neto: 0, total: 0 };
      byTipo[k].count += 1;
      byTipo[k].neto  += Number(r.monto_neto  || 0);
      byTipo[k].total += Number(r.monto_total || 0);
    });

    // Recent 5 by date
    const recent = [...siiRecords]
      .sort((a, b) => (b.fecha_docto ?? '').localeCompare(a.fecha_docto ?? ''))
      .slice(0, 5);

    // Monthly totals (last 6 months) based on fecha_docto
    const monthly = {};
    siiRecords.forEach(r => {
      const d = String(r.fecha_docto ?? '').slice(0, 7).replace('/', '-'); // "yyyy/mm" → "yyyy-mm"
      if (!d || d.length < 7) return;
      if (!monthly[d]) monthly[d] = { neto: 0, total: 0, count: 0, docs: [] };
      monthly[d].neto  += Number(r.monto_neto  || 0);
      monthly[d].total += Number(r.monto_total || 0);
      monthly[d].count += 1;
      monthly[d].docs.push(r);
    });
    Object.values(monthly).forEach(m =>
      m.docs.sort((a, b) => String(a.fecha_docto ?? '').localeCompare(String(b.fecha_docto ?? '')))
    );
    const monthlyTop = Object.entries(monthly)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .reverse();

    return { totalNeto, totalIVA, totalMonto, byTipo, recent, monthlyTop };
  }, [siiRecords]);

  const loading = loadingInv || loadingSII;

  // Map of "rut|folio" → invoice object from Agricura for SII cross-reference
  const invoiceMap = useMemo(() => {
    const m = new Map();
    invoices.forEach(inv => {
      if (inv.rut && inv.folio)
        m.set(`${String(inv.rut).trim()}|${String(inv.folio).trim()}`, inv);
    });
    return m;
  }, [invoices]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-1 flex items-center justify-between">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutDashboard size={28} className="text-blue-600" />
            Panel de Control
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1">Resumen ejecutivo de documentos Agricura y registros SII.</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
            <Loader2 size={16} className="animate-spin" /> Cargando datos…
          </div>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          DATOS AGRICURA
      ════════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeading
          color="bg-blue-500"
          title="Datos Agricura"
          badge={!loadingInv ? `${invoices.length} documentos` : null}
        />

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-6">
          <KpiCard label="Pendiente"   value={agriStats.totalPending} color="amber"   icon={<Clock size={18} />}          loading={loadingInv} />
          <KpiCard label="Vencido"     value={agriStats.totalOverdue} color="rose"    icon={<AlertTriangle size={18} />}  loading={loadingInv} />
          <KpiCard label="Pagado"      value={agriStats.totalPaid}    color="emerald" icon={<CheckCircle size={18} />}    loading={loadingInv} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Próximos Vencimientos */}
          {!loadingInv && agriStats.upcoming.length > 0 && (() => {
            const totalUpcomingPages = Math.ceil(agriStats.upcoming.length / UPCOMING_PAGE_SIZE);
            const safePage = Math.min(upcomingPage, totalUpcomingPages);
            const pageSlice = agriStats.upcoming.slice((safePage - 1) * UPCOMING_PAGE_SIZE, safePage * UPCOMING_PAGE_SIZE);
            return (
            <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-amber-500" />
                  <h4 className="text-sm font-bold text-slate-700">Próximos Vencimientos</h4>
                </div>
                <span className="text-xs text-slate-400 font-medium">{agriStats.upcoming.length} pendientes en total</span>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/60 text-xs text-slate-400 uppercase tracking-wider font-semibold sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-left">Proveedor</th>
                      <th className="px-5 py-3 text-left">Vence</th>
                      <th className="px-5 py-3 text-left">Centro</th>
                      <th className="px-5 py-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageSlice.map(inv => {
                      const isOverdue = (inv.fecha_venc ?? '') < todayStr;
                      const daysLeft = inv.fecha_venc
                        ? Math.ceil((new Date(inv.fecha_venc) - new Date(todayStr)) / 86400000)
                        : null;
                      const isImminent = !isOverdue && daysLeft !== null && daysLeft <= 7;
                      return (
                        <tr key={inv.id} onClick={() => setViewingInvoice(inv)} className={`cursor-pointer transition-colors ${
                          isOverdue ? 'bg-rose-50/30 hover:bg-rose-50/60' :
                          isImminent ? 'bg-amber-50/30 hover:bg-amber-50/60' :
                          'hover:bg-blue-50/30'
                        }`}>
                          <td className="px-5 py-3">
                            <p className="font-semibold text-slate-800 text-xs truncate max-w-[140px]">{inv.proveedor}</p>
                            <span className="font-mono text-xs text-slate-400">#{inv.folio}</span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <p className={`font-mono text-xs font-semibold ${
                              isOverdue ? 'text-rose-600' : isImminent ? 'text-amber-600' : 'text-slate-600'
                            }`}>{inv.fecha_venc ? formatDate(inv.fecha_venc) : '—'}</p>
                            {daysLeft !== null && (
                              <p className={`text-xs mt-0.5 font-medium ${
                                isOverdue ? 'text-rose-400' : isImminent ? 'text-amber-400' : 'text-slate-400'
                              }`}>
                                {isOverdue ? `Venció hace ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Vence hoy' : `En ${daysLeft}d`}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                              {inv.centro_costo || 'N/A'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-mono font-bold text-xs ${
                              isOverdue ? 'text-rose-600' : isImminent ? 'text-amber-600' : 'text-slate-700'
                            }`}>${formatCLP(inv.total_a_pagar)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalUpcomingPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/40 shrink-0">
                  <span className="text-xs text-slate-400 font-medium">
                    Pág. {safePage} de {totalUpcomingPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setUpcomingPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalUpcomingPages }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => setUpcomingPage(n)}
                        className={`w-6 h-6 rounded-md text-xs font-semibold transition-all ${
                          n === safePage
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >{n}</button>
                    ))}
                    <button
                      onClick={() => setUpcomingPage(p => Math.min(totalUpcomingPages, p + 1))}
                      disabled={safePage === totalUpcomingPages}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {/* RIGHT COLUMN: weekly buckets + últimos documentos */}
          {!loadingInv && (
            <div className="flex flex-col gap-5">

              {/* Vencimientos por Semana */}
              <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-blue-500" />
                    <h4 className="text-sm font-bold text-slate-700">Vencimientos por Semana</h4>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">próximos 28 días</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/60 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-5 py-3 text-left">Período</th>
                        <th className="px-5 py-3 text-right">Docs</th>
                        <th className="px-5 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {agriStats.weeklyBuckets.map(b => {
                        const colorMap = {
                          rose:   { badge: 'bg-rose-50 text-rose-600 border-rose-100',     mono: 'text-rose-600',   row: 'hover:bg-rose-50/40'   },
                          amber:  { badge: 'bg-amber-50 text-amber-600 border-amber-100',   mono: 'text-amber-600',  row: 'hover:bg-amber-50/40'  },
                          yellow: { badge: 'bg-yellow-50 text-yellow-700 border-yellow-100', mono: 'text-yellow-700', row: 'hover:bg-yellow-50/40' },
                          slate:  { badge: 'bg-slate-100 text-slate-600 border-slate-200',   mono: 'text-slate-600',  row: 'hover:bg-slate-50/60'  },
                        };
                        const c = colorMap[b.color];
                        const clickable = b.count > 0;
                        return (
                          <tr
                            key={b.label}
                            onClick={() => clickable && setWeeklyModal(b)}
                            className={`transition-colors ${c.row} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${c.badge}`}>{b.label}</span>
                            </td>
                            <td className="px-5 py-3 text-right font-mono text-slate-600 text-xs font-semibold">
                              {b.count > 0 ? b.count : <span className="text-slate-300">—</span>}
                            </td>
                            <td className={`px-5 py-3 text-right font-mono font-bold text-xs ${b.count > 0 ? c.mono : 'text-slate-300'}`}>
                              {b.count > 0 ? `$${formatCLP(b.total)}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Últimos Documentos */}
              {agriStats.recent.length > 0 && (
                <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <FileText size={15} className="text-blue-500" />
                    <h4 className="text-sm font-bold text-slate-700">Últimos Documentos</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {agriStats.recent.map(inv => {
                      const isOverdue = inv.status_pago === 'PENDIENTE' && (inv.fecha_venc ?? '') < todayStr;
                      return (
                        <div key={inv.id} onClick={() => setViewingInvoice(inv)} className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-blue-50/30 cursor-pointer transition-colors">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{inv.proveedor}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-xs text-slate-400">#{inv.folio}</span>
                              <span className="text-xs text-slate-400">{formatDate(inv.fecha_emision)}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-mono text-xs font-bold ${isOverdue ? 'text-rose-500' : inv.status_pago === 'PAGADO' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              ${formatCLP(inv.total_a_pagar)}
                            </p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isOverdue ? 'bg-rose-50 text-rose-600' : inv.status_pago === 'PAGADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              {isOverdue ? 'VENCIDA' : inv.status_pago}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          DATOS SII
      ════════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeading
          color="bg-violet-500"
          title="Datos SII"
          badge={!loadingSII ? `${siiRecords.length} registros` : null}
        />

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-6">
          <KpiCard label="Total Neto"       value={siiStats.totalNeto}  color="violet" icon={<TrendingUp size={18} />} loading={loadingSII} />
          <KpiCard label="IVA Recuperable"  value={siiStats.totalIVA}   color="indigo" icon={<TrendingUp size={18} />} loading={loadingSII} />
          <KpiCard label="Total Compras"    value={siiStats.totalMonto} color="slate"  icon={<TrendingUp size={18} />} loading={loadingSII} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* By tipo_compra */}
          {!loadingSII && Object.keys(siiStats.byTipo).length > 0 && (
            <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 size={15} className="text-violet-500" />
                <h4 className="text-sm font-bold text-slate-700">Por Tipo de Compra</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/60 text-xs uppercase tracking-wider font-semibold">
                    <tr>
                      <SortTh label="Tipo"  colKey="tipo"  sort={siiTipoSort} onSort={handleTipoSort} />
                      <SortTh label="Docs"  colKey="count" sort={siiTipoSort} onSort={handleTipoSort} right />
                      <SortTh label="Neto"  colKey="neto"  sort={siiTipoSort} onSort={handleTipoSort} right />
                      <SortTh label="Total" colKey="total" sort={siiTipoSort} onSort={handleTipoSort} right />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(siiStats.byTipo)
                      .sort(([ka, a], [kb, b]) => {
                        const { key, dir } = siiTipoSort;
                        let av = key === 'tipo' ? ka : a[key];
                        let bv = key === 'tipo' ? kb : b[key];
                        if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                        return dir === 'asc' ? av - bv : bv - av;
                      })
                      .map(([tipo, v]) => (
                        <tr key={tipo} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="bg-violet-50 text-violet-700 text-xs px-2.5 py-1 rounded-lg border border-violet-100 font-medium">{tipo}</span>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-500 font-medium text-xs">{v.count}</td>
                          <td className="px-5 py-3 text-right font-mono text-slate-600 text-xs">${formatCLP(v.neto)}</td>
                          <td className="px-5 py-3 text-right font-mono text-violet-700 font-semibold text-xs">${formatCLP(v.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Monthly SII */}
          {!loadingSII && siiStats.monthlyTop.length > 0 && (
            <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 size={15} className="text-violet-500" />
                <h4 className="text-sm font-bold text-slate-700">Resumen Mensual (últimos 6 meses)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/60 text-xs uppercase tracking-wider font-semibold">
                    <tr>
                      <SortTh label="Mes"   colKey="mes"   sort={siiMonthSort} onSort={handleMonthSort} />
                      <SortTh label="Docs"  colKey="count" sort={siiMonthSort} onSort={handleMonthSort} right />
                      <SortTh label="Neto"  colKey="neto"  sort={siiMonthSort} onSort={handleMonthSort} right />
                      <SortTh label="Total" colKey="total" sort={siiMonthSort} onSort={handleMonthSort} right />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...siiStats.monthlyTop]
                      .sort(([ma, va], [mb, vb]) => {
                        const { key, dir } = siiMonthSort;
                        let av = key === 'mes' ? ma : va[key];
                        let bv = key === 'mes' ? mb : vb[key];
                        if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                        return dir === 'asc' ? av - bv : bv - av;
                      })
                      .map(([mes, v]) => (
                      <tr key={mes} onClick={() => setSiiMonthModal([mes, v])} className="hover:bg-violet-50/30 cursor-pointer transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-700 text-xs font-mono">{mes}</td>
                        <td className="px-5 py-3 text-right text-slate-500 font-medium text-xs">{v.count}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600 text-xs">${formatCLP(v.neto)}</td>
                        <td className="px-5 py-3 text-right font-mono text-violet-700 font-semibold text-xs">${formatCLP(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SII Monthly drill-down modal ───────────────────────────────── */}
      {siiMonthModal && (() => {
        const [mes, v] = siiMonthModal;
        return (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in"
            onClick={() => setSiiMonthModal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                    <BarChart3 size={17} className="text-violet-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Documentos SII — {mes}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {v.count} documento{v.count !== 1 ? 's' : ''} · Total:&nbsp;
                      <span className="font-semibold text-slate-600">${formatCLP(v.total)}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSiiMonthModal(null)}
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-lg transition-all active:scale-[0.97]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Table */}
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-xs text-slate-400 uppercase tracking-wider font-semibold sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-center">Agricura</th>
                      <th className="px-5 py-3 text-left">Folio</th>
                      <th className="px-5 py-3 text-left">RUT Proveedor</th>
                      <th className="px-5 py-3 text-left">Razón Social</th>
                      <th className="px-5 py-3 text-left">Fecha Docto.</th>
                      <th className="px-5 py-3 text-right">Monto Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {v.docs.map((r, idx) => {
                      const matchKey = `${String(r.rut_proveedor || '').trim()}|${String(r.folio || '').trim()}`;
                      const matchedInv = invoiceMap.get(matchKey);
                      return (
                        <tr key={r.id ?? idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 text-center">
                            {matchedInv
                              ? <span
                                  onClick={() => setViewingInvoice(matchedInv)}
                                  className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-lg border border-emerald-200 font-semibold cursor-pointer hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                                  title="Ver detalles en Agricura"
                                ><CheckCircle size={11} /> Sí</span>
                              : <span className="text-slate-300 text-xs font-medium">—</span>
                            }
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-600">{r.folio || '—'}</td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{r.rut_proveedor || '—'}</td>
                          <td className="px-5 py-3 text-xs text-slate-800 font-medium max-w-[180px] truncate">{r.razon_social || '—'}</td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{fmtSiiDate(r.fecha_docto)}</td>
                          <td className="px-5 py-3 text-right font-mono font-bold text-xs text-violet-700">${formatCLP(r.monto_total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-400 font-medium">{v.count} registro{v.count !== 1 ? 's' : ''}</span>
                <span className="font-mono font-bold text-sm text-slate-800">${formatCLP(v.total)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Weekly bucket modal ───────────────────────────────────────────── */}
      {weeklyModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setWeeklyModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Calendar size={17} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{weeklyModal.label}</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {weeklyModal.count} documento{weeklyModal.count !== 1 ? 's' : ''} · Total:&nbsp;
                    <span className="font-semibold text-slate-600">${formatCLP(weeklyModal.total)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWeeklyModal(null)}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-lg transition-all active:scale-[0.97]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-xs text-slate-400 uppercase tracking-wider font-semibold sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left">Proveedor</th>
                    <th className="px-6 py-3 text-left">Vence</th>
                    <th className="px-6 py-3 text-left">Centro</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeklyModal.docs.map(inv => {
                    const daysLeft = inv.fecha_venc
                      ? Math.ceil((new Date(inv.fecha_venc) - new Date(todayStr)) / 86400000)
                      : null;
                    const isToday = daysLeft === 0;
                    return (
                      <tr key={inv.id} className={`transition-colors ${isToday ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">{inv.proveedor}</p>
                          <span className="font-mono text-xs text-slate-400">#{inv.folio}</span>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <p className={`font-mono text-xs font-semibold ${isToday ? 'text-rose-600' : 'text-slate-700'}`}>
                            {formatDate(inv.fecha_venc)}
                          </p>
                          {daysLeft !== null && (
                            <p className={`text-xs mt-0.5 font-medium ${isToday ? 'text-rose-400' : 'text-slate-400'}`}>
                              {isToday ? 'Vence hoy' : `En ${daysLeft}d`}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                            {inv.centro_costo || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="font-mono font-bold text-xs text-slate-700">${formatCLP(inv.total_a_pagar)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer total */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400 font-medium">{weeklyModal.count} documento{weeklyModal.count !== 1 ? 's' : ''} pendientes</span>
              <span className="font-mono font-bold text-sm text-slate-800">${formatCLP(weeklyModal.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Invoice detail modal */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
        />
      )}

      {/* Empty state */}
      {!loading && invoices.length === 0 && siiRecords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <LayoutDashboard size={28} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-600">Sin datos todavía</p>
          <p className="text-sm text-slate-400 mt-1">Importa datos desde <span className="font-medium text-slate-500">Manejo de Datos</span> para ver el resumen aquí.</p>
        </div>
      )}
    </div>
  );
}
