// c:\Users\curam\index\admin-agricura\src\views\DataManagement.jsx
import React, { useState, useEffect } from 'react';
import { Upload, Plus, FileSpreadsheet, FileText, X, ChevronRight, Database, CheckCircle2, Landmark } from 'lucide-react';
import ExcelImportModal from '../components/ExcelImportModal';
import SIIImportModal from '../components/SIIImportModal';
import { loadScript } from '../lib/supabase';

export default function DataManagement({ supabase, onNewDocument, onShowConfirm, onNavigateToPanel }) {
  const [showChooser, setShowChooser] = useState(false);
  const [showAgricuraImport, setShowAgricuraImport] = useState(false);
  const [showSIIImport, setShowSIIImport] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successType, setSuccessType] = useState(''); // 'Agricura' | 'SII'
  const [countdown, setCountdown] = useState(3);

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

  const openChooser = () => setShowChooser(true);
  const closeChooser = () => setShowChooser(false);

  const handleSelectAgricura = () => { closeChooser(); setShowAgricuraImport(true); };
  const handleSelectSII      = () => { closeChooser(); setShowSIIImport(true); };

  const handleConnectFintoc = async () => {
    closeChooser();
    try {
      await loadScript('https://js.fintoc.com/v1/');
      
      if (!window.Fintoc) throw new Error('Fintoc SDK no cargó correctamente');

      const widget = window.Fintoc.create({
        publicKey: import.meta.env.VITE_FINTOC_PUBLIC_KEY,
        holderType: 'individual',
        product: 'movements',
        webhookUrl: '', // Opcional
        onSuccess: async (publicToken) => {
          // Enviar public_token a tu servidor NodeJS
          try {
            const response = await fetch('http://localhost:3001/api/fintoc/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ public_token: publicToken }),
            });
            
            if (!response.ok) throw new Error('Error al vincular cuenta en el servidor');
            
            handleImported('Banco Santander (Fintoc)');
          } catch (err) {
            onShowConfirm({ title: 'Error de Vinculación', message: err.message, type: 'danger', onConfirm: () => {} });
          }
        },
        onExit: () => { console.log('Widget cerrado'); },
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <header className="px-1">
        <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Database size={28} className="text-blue-600" />
          Manejo de Datos
        </h2>
        <p className="text-slate-400 text-sm font-medium mt-1">Gestiona el ingreso y la carga de documentos al sistema.</p>
      </header>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">

        {/* Card: Importar Datos */}
        <button
          onClick={openChooser}
          className="group relative bg-white border border-slate-200 rounded-2xl p-7 text-left hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 active:scale-[0.99]"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Upload size={22} className="text-emerald-600" />
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400 transition-colors mt-1" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Importar Datos</h3>
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Carga documentos desde un archivo Excel. Elige entre datos de <span className="text-slate-600 font-semibold">Agricura</span> o del <span className="text-slate-600 font-semibold">SII</span>.
          </p>
        </button>

        {/* Card: Registrar Documento */}
        <button
          onClick={onNewDocument}
          className="group relative bg-white border border-slate-200 rounded-2xl p-7 text-left hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 active:scale-[0.99]"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Plus size={22} className="text-blue-600" />
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400 transition-colors mt-1" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Registrar Documento</h3>
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Ingresa manualmente una factura, boleta u otro tipo de documento al sistema.
          </p>
        </button>

      </div>

      {/* ── Chooser popup ─────────────────────────────────────────────────── */}
      {showChooser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Upload size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Importar Datos</h3>
                  <p className="text-xs text-slate-400 font-medium">Selecciona la fuente de los datos</p>
                </div>
              </div>
              <button
                onClick={closeChooser}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-lg transition-all active:scale-[0.97]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Options */}
            <div className="p-5 space-y-3">
              <button
                onClick={handleSelectAgricura}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all duration-150 active:scale-[0.99] text-left group"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <FileSpreadsheet size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Importar datos de Agricura</p>
                  <p className="text-xs text-slate-400 mt-0.5">Carga facturas desde el archivo Excel interno.</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 ml-auto shrink-0 transition-colors" />
              </button>

              <button
                onClick={handleSelectSII}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 transition-all duration-150 active:scale-[0.99] text-left group"
              >
                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                  <FileText size={20} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Importar datos del SII</p>
                  <p className="text-xs text-slate-400 mt-0.5">Carga el libro de compras exportado desde el SII.</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-violet-500 ml-auto shrink-0 transition-colors" />
              </button>

              <button
                onClick={handleConnectFintoc}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 transition-all duration-150 active:scale-[0.99] text-left group"
              >
                <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                  <Landmark size={20} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Conectar Banco (Fintoc)</p>
                  <p className="text-xs text-slate-400 mt-0.5">Vincula Santander para extraer movimientos.</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-rose-500 ml-auto shrink-0 transition-colors" />
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
          onImported={() => { setShowSIIImport(false); handleImported('SII'); }}
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
