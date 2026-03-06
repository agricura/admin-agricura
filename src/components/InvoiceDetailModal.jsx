import React from 'react';
import { Package, X, Pencil } from 'lucide-react';
import { formatCLP, formatDate } from '../utils/formatters';

const InvoiceDetailModal = ({ invoice, onClose, onEdit }) => {
  if (!invoice) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/60">
        <div className="bg-white border-b border-slate-100 p-5 lg:p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><Package size={20} /></div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                #{invoice.folio}
                <span className="text-xs uppercase font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md tracking-wide">{invoice.tipo_doc}</span>
              </h3>
              <p className="text-slate-500 text-sm font-medium truncate max-w-[200px] lg:max-w-none mt-0.5">{invoice.proveedor}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(invoice)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              >
                <Pencil size={14} /> Editar
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all active:scale-[0.98]"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 lg:p-6 overflow-y-auto space-y-6 bg-slate-50/30">
          <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">Fecha Emisión</p>
              <p className="font-mono text-sm font-semibold text-slate-800">{formatDate(invoice.fecha_emision)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">Vencimiento</p>
              <p className={`font-mono text-sm font-semibold ${todayStr > invoice.fecha_venc && invoice.status_pago === 'PENDIENTE' ? 'text-rose-600' : 'text-slate-800'}`}>{formatDate(invoice.fecha_venc)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">RUT Proveedor</p>
              <p className="font-mono text-sm font-semibold text-slate-800">{invoice.rut || '—'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-2">Desglose de Productos</h4>
            <div className="space-y-3">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-semibold text-slate-800 truncate mb-0.5">{it.detalle}</p>
                      <p className="text-xs text-slate-500 font-medium">Cant: {it.cantidad}</p>
                    </div>
                    <p className="font-bold text-slate-900 text-base font-mono">${formatCLP(it.total_item)}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm font-medium">Sin detalle de productos registrado.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl text-white space-y-3 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500 rounded-full opacity-15 blur-3xl"></div>
            <div className="flex justify-between items-center text-sm font-medium opacity-80 border-b border-white/10 pb-3">
              <span>Subtotal Neto</span><span>${formatCLP(invoice.total_bruto)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-medium opacity-80 border-b border-white/10 pb-3">
              <span>IVA (19%)</span><span>${formatCLP(invoice.iva)}</span>
            </div>
            <div className="pt-2 flex justify-between items-end relative z-10">
              <span className="text-xs font-semibold uppercase text-blue-300 tracking-wide">Total a Pagar</span>
              <span className="text-xl font-bold font-mono tracking-tight">${formatCLP(invoice.total_a_pagar)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailModal;
