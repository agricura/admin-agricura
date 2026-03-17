import React, { useState, useEffect, useCallback } from 'react';
import { Plus, FileSpreadsheet, FileText, Database, CheckCircle2, Landmark, Trash2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import ExcelImportModal from '../components/ExcelImportModal';
import SIIImportModal from '../components/SIIImportModal';
import SIIVentasImportModal from '../components/SIIVentasImportModal';
import { loadScript } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

const IS_DEV = import.meta.env.DEV;
const SERVER_URL = 'http://localhost:3001';

export default function DataManagement({ supabase, onNewDocument, onShowConfirm, onNavigateToPanel }) {
  const { toast } = useToast();
  const [showAgricuraImport, setShowAgricuraImport] = useState(false);
  const [showSIIImport, setShowSIIImport] = useState(false);
  const [showSIIVentasImport, setShowSIIVentasImport] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successType, setSuccessType] = useState('');
  const [countdown, setCountdown] = useState(3);

  // Linked accounts state
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [deleteTransactions, setDeleteTransactions] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchLinkedAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from('fintoc_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLinkedAccounts(data ?? []);
    } catch {
      setLinkedAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [supabase]);

  useEffect(() => { fetchLinkedAccounts(); }, [fetchLinkedAccounts]);

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      if (IS_DEV) {
        const res = await fetch(`${SERVER_URL}/api/fintoc/links/${unlinkTarget.link_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleteTransactions }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      } else {
        const res = await fetch('/api/unlink-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link_id: unlinkTarget.link_id, deleteTransactions }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      }
      toast({ type: 'success', message: 'Cuenta desvinculada exitosamente' });
      setUnlinkTarget(null);
      setDeleteTransactions(false);
      fetchLinkedAccounts();
    } catch (err) {
      toast({ type: 'error', message: err.message || 'Error al desvincular' });
    } finally {
      setUnlinking(false);
    }
  };

  useEffect(() => {
    if (!showSuccess) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowSuccess(false);
          onNavigateToPanel?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showSuccess]);

  const handleConnectFintoc = async () => {
    try {
      await loadScript('https://js.fintoc.com/v1/');
      if (!window.Fintoc) throw new Error('Fintoc SDK no cargó correctamente');

      const widget = window.Fintoc.create({
        publicKey: import.meta.env.VITE_FINTOC_PUBLIC_KEY,
        holderType: 'individual',
        product: 'movements',
        webhookUrl: '',
        onSuccess: async (publicToken) => {
          try {
            const exchangeUrl = IS_DEV ? `${SERVER_URL}/api/fintoc/exchange` : '/api/fintoc/exchange';
            const response = await fetch(exchangeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ public_token: publicToken }),
            });
            if (!response.ok) throw new Error('Error al vincular cuenta en el servidor');
            toast({ type: 'success', message: 'Cuenta bancaria vinculada exitosamente' });
            fetchLinkedAccounts();
          } catch (err) {
            toast({ type: 'error', message: err.message || 'Error al vincular cuenta' });
          }
        },
        onExit: () => {},
      });

      widget.open();
    } catch (err) {
      onShowConfirm({ title: 'Error', message: 'No se pudo iniciar el widget de Fintoc.', type: 'danger', onConfirm: () => {} });
    }
  };

  const handleImported = (type) => {
    setSuccessType(type);
    setShowSuccess(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <header className="px-1">
        <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Database size={28} className="text-blue-600" />
          Manejo de Datos
        </h2>
        <p className="text-slate-400 text-sm font-medium mt-1">Gestiona el ingreso y la carga de documentos al sistema.</p>
      </header>

      {/* ── Sección: Documentos ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Documentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">

          {/* Card: Importar Agricura */}
          <button
            onClick={() => setShowAgricuraImport(true)}
            className="group relative bg-white border border-slate-200 rounded-2xl p-6 text-left hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 active:scale-[0.99]"
          >
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
              <FileSpreadsheet size={20} className="text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Importar Agricura</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Carga facturas desde el archivo Excel interno.
            </p>
          </button>

          {/* Card: Importar SII Compras */}
          <button
            onClick={() => setShowSIIImport(true)}
            className="group relative bg-white border border-slate-200 rounded-2xl p-6 text-left hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200 active:scale-[0.99]"
          >
            <div className="w-11 h-11 bg-violet-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
              <FileText size={20} className="text-violet-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Importar SII Compras</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Carga el libro de compras exportado desde el SII.
            </p>
          </button>

          {/* Card: Importar SII Ventas */}
          <button
            onClick={() => setShowSIIVentasImport(true)}
            className="group relative bg-white border border-slate-200 rounded-2xl p-6 text-left hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-200 active:scale-[0.99]"
          >
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
              <FileText size={20} className="text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Importar SII Ventas</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Carga el libro de ventas exportado desde el SII.
            </p>
          </button>

          {/* Card: Registrar Documento */}
          <button
            onClick={onNewDocument}
            className="group relative bg-white border border-slate-200 rounded-2xl p-6 text-left hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 active:scale-[0.99]"
          >
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
              <Plus size={20} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Registrar Documento</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Ingresa manualmente una factura u otro documento.
            </p>
          </button>

        </div>
      </div>

      {/* ── Sección: Cuentas Bancarias ──────────────────────────────────── */}
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cuentas Bancarias</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnectFintoc}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <Plus size={14} />
              Vincular Cuenta
            </button>
            <button
              onClick={fetchLinkedAccounts}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              title="Recargar"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loadingAccounts ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center">
            <Loader2 size={20} className="text-slate-400 animate-spin" />
          </div>
        ) : linkedAccounts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <Landmark size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500">No hay cuentas vinculadas</p>
            <p className="text-xs text-slate-400 mt-1">Vincula una cuenta bancaria para sincronizar movimientos automáticamente.</p>
            <button
              onClick={handleConnectFintoc}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <Plus size={14} />
              Vincular Cuenta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedAccounts.map(account => (
              <div key={account.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                  <Landmark size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {account.institution_name || 'Cuenta bancaria'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {account.holder_name && (
                      <p className="text-xs text-slate-400 truncate">{account.holder_name}</p>
                    )}
                    <p className="text-xs text-slate-300">
                      {new Date(account.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setUnlinkTarget(account); setDeleteTransactions(false); }}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                  title="Desvincular"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal Confirmar Desvinculación ─────────────────────────────── */}
      {unlinkTarget && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-rose-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Desvincular cuenta</h3>
              <p className="text-sm text-slate-500">
                ¿Deseas desvincular <span className="font-semibold text-slate-700">{unlinkTarget.institution_name || 'esta cuenta'}</span>? Esta acción eliminará el acceso a los movimientos de esta cuenta.
              </p>

              <label className="flex items-start gap-3 mt-4 p-3 bg-rose-50/50 border border-rose-100 rounded-xl cursor-pointer hover:bg-rose-50 transition-colors">
                <input
                  type="checkbox"
                  checked={deleteTransactions}
                  onChange={(e) => setDeleteTransactions(e.target.checked)}
                  className="mt-0.5 accent-rose-500"
                />
                <div>
                  <p className="text-xs font-semibold text-rose-700">También eliminar transacciones históricas</p>
                  <p className="text-xs text-rose-500/70 mt-0.5">Se borrarán todos los movimientos bancarios asociados a esta cuenta.</p>
                </div>
              </label>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => { setUnlinkTarget(null); setDeleteTransactions(false); }}
                disabled={unlinking}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUnlink}
                disabled={unlinking}
                className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {unlinking ? (
                  <><Loader2 size={14} className="animate-spin" /> Desvinculando...</>
                ) : 'Desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAgricuraImport && (
        <ExcelImportModal
          supabase={supabase}
          onClose={() => setShowAgricuraImport(false)}
          onImported={() => { setShowAgricuraImport(false); handleImported('Agricura'); }}
        />
      )}

      {showSIIImport && (
        <SIIImportModal
          supabase={supabase}
          onClose={() => setShowSIIImport(false)}
          onImported={() => { setShowSIIImport(false); handleImported('SII Compras'); }}
        />
      )}

      {showSIIVentasImport && (
        <SIIVentasImportModal
          supabase={supabase}
          onClose={() => setShowSIIVentasImport(false)}
          onImported={() => { setShowSIIVentasImport(false); handleImported('SII Ventas'); }}
        />
      )}

      {/* ── Success popup ───────────────────────────────────────────────── */}
      {showSuccess && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-sm overflow-hidden">
            <div className="flex flex-col items-center px-8 pt-10 pb-8 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5">
                <CheckCircle2 size={36} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">¡Carga Exitosa!</h3>
              <p className="text-sm text-slate-500 font-medium">
                Los datos de <span className="text-slate-700 font-semibold">{successType}</span> fueron importados correctamente.
              </p>
              <p className="text-xs text-slate-400 mt-4">
                Redirigiendo al Panel de Control en <span className="font-bold text-slate-600">{countdown}</span>s…
              </p>
            </div>
            <div className="px-8 pb-7 flex gap-3">
              <button
                onClick={() => { setShowSuccess(false); onNavigateToPanel?.(); }}
                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
              >
                Ir al Panel
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
              >
                Quedarme
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
