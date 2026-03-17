import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Menu, X, LogOut, FileText, Database, BarChart3, Landmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { loadScript, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import Auth from './views/Auth';
import Dashboard from './views/Dashboard';
import InvoiceForm from './views/InvoiceForm';
import SIIView from './views/SIIView';
import ConfirmModal from './components/ConfirmModal';
import InvoiceDetailModal from './components/InvoiceDetailModal';
import DataManagement from './views/DataManagement';
import ControlPanel from './views/ControlPanel';
import BankView from './views/BankView';
import { InvoicesProvider, useInvoices } from './context/InvoicesContext';
import { ToastProvider } from './context/ToastContext';
import Toast from './components/Toast';

// ── Authenticated app shell (can use useInvoices) ────────────────────────────
function AppContent({ supabaseClient, session }) {
  const { invoices, refetch } = useInvoices();

  const [currentView,    setCurrentView]    = useState('controlPanel');
  const [invoiceToEdit,  setInvoiceToEdit]  = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
  const [isCollapsed,    setIsCollapsed]    = useState(() => { try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; } });
  const [confirmModal,   setConfirmModal]   = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'info' });

  const toggleCollapse = () => setIsCollapsed(prev => { const next = !prev; localStorage.setItem('sidebar_collapsed', String(next)); return next; });

  const todayStr = new Date().toISOString().split('T')[0];
  const addDays  = (str, n) => { const d = new Date(str); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().split('T')[0]; };

  // Badge: pending docs due within 7 days OR already overdue
  const urgentCount = useMemo(() =>
    invoices.filter(i =>
      i.status_pago === 'PENDIENTE' && (i.fecha_venc ?? '') <= addDays(todayStr, 7)
    ).length,
    [invoices, todayStr]
  );

  const nav = (view) => { setCurrentView(view); setIsSidebarOpen(false); };

  return (
    <div className="h-screen bg-slate-50 flex flex-col lg:flex-row font-sans overflow-hidden text-slate-800">

      {/* HEADER MOBILE */}
      <header className="lg:hidden flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 z-[100] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">AGRICURA</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
          <Menu size={22} />
        </button>
      </header>

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-0 z-[200] transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-20
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'lg:w-16' : 'lg:w-64'} w-64 bg-slate-900 text-white flex flex-col shadow-2xl lg:shadow-none shrink-0 overflow-hidden
      `}>
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden absolute top-4 right-4 p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all active:scale-[0.98] z-30">
          <X size={18} />
        </button>

        <div className={`hidden lg:flex flex-col items-center shrink-0 border-b border-white/5 transition-all duration-300 ${isCollapsed ? 'p-3' : 'p-6'}`}>
          <div className={`bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 ${isCollapsed ? 'w-9 h-9' : 'w-10 h-10 mb-3'}`}>
            <LayoutDashboard size={isCollapsed ? 18 : 20} className="text-white" />
          </div>
          {!isCollapsed && <h1 className="text-base font-bold tracking-[0.15em] uppercase">AGRICURA</h1>}
        </div>

        <nav className={`flex-1 mt-16 lg:mt-3 overflow-y-auto scrollbar-hide py-3 space-y-1 transition-all duration-300 ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
          <div className="px-1 pb-1">
            {!isCollapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-2.5">gastos</p>}

            {/* Panel de Control — con badge de urgentes */}
            <button
              onClick={() => nav('controlPanel')}
              title="Panel de Control"
              className={`w-full flex items-center rounded-lg transition-all duration-200 text-sm font-medium relative ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'} ${currentView === 'controlPanel' ? 'bg-blue-600 shadow-md shadow-blue-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <BarChart3 size={18} className="shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left">Panel de Control</span>}
              {!isCollapsed && urgentCount > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  currentView === 'controlPanel' ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
                }`}>
                  {urgentCount > 99 ? '99+' : urgentCount}
                </span>
              )}
              {isCollapsed && urgentCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>

            <button
              onClick={() => nav('dashboard')}
              title="Datos Agricura"
              className={`w-full flex items-center rounded-lg transition-all duration-200 text-sm font-medium ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'} ${currentView === 'dashboard' ? 'bg-blue-600 shadow-md shadow-blue-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <LayoutDashboard size={18} className="shrink-0" />{!isCollapsed && <span>Datos Agricura</span>}
            </button>
            <button
              onClick={() => nav('sii')}
              title="Datos SII"
              className={`w-full flex items-center rounded-lg transition-all duration-200 text-sm font-medium ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'} ${currentView === 'sii' ? 'bg-violet-600 shadow-md shadow-violet-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <FileText size={18} className="shrink-0" />{!isCollapsed && <span>Datos SII</span>}
            </button>
          </div>

          <div className="px-1 pb-1 mt-2">
            {!isCollapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-2.5">Banco</p>}
            <button
              onClick={() => nav('bank')}
              title="Datos Bancarios"
              className={`w-full flex items-center rounded-lg transition-all duration-200 text-sm font-medium ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'} ${currentView === 'bank' ? 'bg-emerald-600 shadow-md shadow-emerald-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Landmark size={18} className="shrink-0" />{!isCollapsed && <span>Datos Bancarios</span>}
            </button>
          </div>
        </nav>

        {/* Manejo de Datos — separado en la parte inferior */}
        <div className={`shrink-0 transition-all duration-300 ${isCollapsed ? 'px-1.5 py-2' : 'px-4 py-2'}`}>
          <button
            onClick={() => nav('dataManagement')}
            title="Manejo de Datos"
            className={`w-full flex items-center rounded-lg transition-all duration-200 text-sm font-medium ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'} ${currentView === 'dataManagement' ? 'bg-blue-600 shadow-md shadow-blue-600/20 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
          >
            <Database size={18} className="shrink-0" />{!isCollapsed && <span>Manejo de Datos</span>}
          </button>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleCollapse}
          className={`hidden lg:flex items-center justify-center gap-2 mx-3 mb-2 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all active:scale-[0.97] ${isCollapsed ? 'mx-1.5' : ''}`}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span className="text-xs font-medium"></span></>}
        </button>

        <div className={`bg-slate-950/50 border-t border-white/5 flex flex-col gap-3 shrink-0 transition-all duration-300 ${isCollapsed ? 'p-2 items-center' : 'p-4'}`}>
          {isCollapsed ? (
            <>
              <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-300" title={session?.user?.email}>
                {session?.user?.email?.[0].toUpperCase()}
              </div>
              <button
                onClick={() => supabaseClient.auth.signOut()}
                title="Cerrar Sesión"
                className="p-2 bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-500 rounded-lg transition-all active:scale-[0.98]"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-300">
                  {session?.user?.email?.[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{session?.user?.email?.split('@')[0]}</p>
                  <p className="text-xs font-medium text-slate-500 truncate">Administrador</p>
                </div>
              </div>
              <button
                onClick={() => supabaseClient.auth.signOut()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-500 rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
              >
                <LogOut size={14} /> Cerrar Sesion
              </button>
            </>
          )}
        </div>
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main className="flex-1 overflow-auto h-full relative bg-slate-50 flex flex-col">
        <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8">
          {currentView === 'controlPanel' && (
            <ControlPanel supabase={supabaseClient} />
          )}
          {currentView === 'dashboard' && (
            <Dashboard
              supabase={supabaseClient}
              onEdit={(inv) => { setInvoiceToEdit(inv); setCurrentView('form'); }}
              onViewDetail={(inv) => setViewingInvoice(inv)}
              onShowConfirm={(cfg) => setConfirmModal({ ...cfg, isOpen: true })}
            />
          )}
          {currentView === 'form' && (
            <InvoiceForm
              supabase={supabaseClient}
              invoiceToEdit={invoiceToEdit}
              onSuccess={() => { refetch(); setCurrentView('dashboard'); setInvoiceToEdit(null); }}
              onShowConfirm={(cfg) => setConfirmModal({ ...cfg, isOpen: true })}
            />
          )}
          {currentView === 'dataManagement' && (
            <DataManagement
              supabase={supabaseClient}
              onNewDocument={() => { setInvoiceToEdit(null); setCurrentView('form'); }}
              onShowConfirm={(cfg) => setConfirmModal({ ...cfg, isOpen: true })}
              onNavigateToPanel={() => { refetch(); setCurrentView('controlPanel'); }}
            />
          )}
          {currentView === 'sii' && (
            <SIIView
              supabase={supabaseClient}
              onShowConfirm={(cfg) => setConfirmModal({ ...cfg, isOpen: true })}
              onViewDetail={(inv) => setViewingInvoice(inv)}
            />
          )}
          {currentView === 'bank' && (
            <BankView supabase={supabaseClient} />
          )}
        </div>

        {viewingInvoice && (
          <InvoiceDetailModal
            invoice={viewingInvoice}
            onClose={() => setViewingInvoice(null)}
            onEdit={(inv) => { setViewingInvoice(null); setInvoiceToEdit(inv); setCurrentView('form'); }}
            supabase={supabaseClient}
          />
        )}
      </main>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [session,        setSession]        = useState(null);
  const [isReady,        setIsReady]        = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
        const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        setSupabaseClient(client);
        client.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setIsReady(true);
        });
        client.auth.onAuthStateChange((_event, session) => setSession(session));
      } catch (err) {
        console.error('Error al cargar dependencias contables:', err);
      }
    };
    initApp();
  }, []);

  if (!isReady) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white gap-5">
      <div className="w-12 h-12 border-[3px] border-blue-500/30 border-t-blue-400 rounded-full animate-spin"></div>
      <div className="text-center">
        <h1 className="text-lg font-bold tracking-[0.2em] uppercase">Agricura</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">Cargando sistema...</p>
      </div>
    </div>
  );

  if (!session) return (
    <Auth supabase={supabaseClient} />
  );

  return (
    <ToastProvider>
      <InvoicesProvider supabase={supabaseClient}>
        <AppContent supabaseClient={supabaseClient} session={session} />
      </InvoicesProvider>
      <Toast />
    </ToastProvider>
  );
}
