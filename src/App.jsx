import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Menu, X, LogOut, FileText, Database, BarChart3, Landmark } from 'lucide-react';
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

export default function App() {
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState('controlPanel');
  const [invoiceToEdit, setInvoiceToEdit] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'info' });

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
    <Auth
      supabase={supabaseClient}
      onShowAlert={(m) => setConfirmModal({ isOpen: true, title: 'Error de Acceso', message: m, type: 'danger', onConfirm: () => {} })}
    />
  );

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
        fixed inset-0 z-[200] transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-20
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64 bg-slate-900 text-white flex flex-col shadow-2xl lg:shadow-none shrink-0
      `}>
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden absolute top-4 right-4 p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all active:scale-[0.98] z-30">
          <X size={18} />
        </button>

        <div className="p-6 hidden lg:flex flex-col items-center shrink-0 border-b border-white/5">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <h1 className="text-base font-bold tracking-[0.15em] uppercase">AGRICURA</h1>
        </div>

        <nav className="flex-1 px-3 mt-16 lg:mt-3 overflow-y-auto scrollbar-hide py-3 space-y-1">

          <div className="px-1 pb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-2.5">Facturas</p>
            <button
              onClick={() => { setCurrentView('controlPanel'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${currentView === 'controlPanel' ? 'bg-blue-600 shadow-md shadow-blue-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <BarChart3 size={18} /><span>Panel de Control</span>
            </button>
            <button
              onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${currentView === 'dashboard' ? 'bg-blue-600 shadow-md shadow-blue-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <LayoutDashboard size={18} /><span>Datos Agricura</span>
            </button>
            <button
              onClick={() => { setCurrentView('sii'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${currentView === 'sii' ? 'bg-violet-600 shadow-md shadow-violet-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <FileText size={18} /><span>Datos SII</span>
            </button>
            <div className="my-2 mx-2.5 border-t border-white/10" />
            <button
              onClick={() => { setCurrentView('dataManagement'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${currentView === 'dataManagement' ? 'bg-blue-600 shadow-md shadow-blue-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Database size={18} /><span>Manejo de Datos</span>
            </button>
          </div>

          <div className="px-1 pb-1 mt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-2.5">Banco</p>
            <button
              onClick={() => { setCurrentView('bank'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${currentView === 'bank' ? 'bg-emerald-600 shadow-md shadow-emerald-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Landmark size={18} /><span>Datos Bancarios</span>
            </button>
          </div>

        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-white/5 flex flex-col gap-3 shrink-0">
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
              onSuccess={() => { setCurrentView('dashboard'); setInvoiceToEdit(null); }}
              onShowConfirm={(cfg) => setConfirmModal({ ...cfg, isOpen: true })}
            />
          )}
          {currentView === 'dataManagement' && (
            <DataManagement
              supabase={supabaseClient}
              onNewDocument={() => { setInvoiceToEdit(null); setCurrentView('form'); }}
              onShowConfirm={(cfg) => setConfirmModal({ ...cfg, isOpen: true })}
              onNavigateToPanel={() => setCurrentView('controlPanel')}
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
            <BankView />
          )}
        </div>

        {viewingInvoice && (
          <InvoiceDetailModal
            invoice={viewingInvoice}
            onClose={() => setViewingInvoice(null)}
            onEdit={(inv) => { setViewingInvoice(null); setInvoiceToEdit(inv); setCurrentView('form'); }}
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
