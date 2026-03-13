import React, { useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import DateInput from './DateInput';

/**
 * Modal para confirmar el pago de una o varias facturas.
 * Props:
 *   isOpen          boolean
 *   onClose         () => void
 *   onConfirm       ({ fecha_pago, cuenta_pago }) => void
 *   count           number  (1 por defecto — para acciones en lote poner >1)
 *   existingAccounts string[]  (opciones de autocompletado)
 */
const PaymentModal = ({ isOpen, onClose, onConfirm, count = 1, existingAccounts = [] }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [fechaPago,   setFechaPago]   = useState(todayStr);
  const [cuentaPago,  setCuentaPago]  = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({ fecha_pago: fechaPago, cuenta_pago: cuentaPago.trim() || null });
    // reset
    setFechaPago(new Date().toISOString().split('T')[0]);
    setCuentaPago('');
    onClose();
  };

  const title   = count > 1 ? `Confirmar Pago — ${count} Facturas` : 'Confirmar Pago';
  const btnText = count > 1 ? `Marcar ${count} como Pagadas` : 'Marcar como Pagado';

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 border border-slate-200/60 animate-in zoom-in duration-200">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Fecha de Pago
            </label>
            <DateInput
              value={fechaPago}
              onChange={e => setFechaPago(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
              Cuenta de Pago{' '}
              <span className="normal-case font-normal text-slate-300">(opcional)</span>
            </label>
            <input
              list="pay-accounts-datalist"
              value={cuentaPago}
              onChange={e => setCuentaPago(e.target.value)}
              placeholder="Ej: Banco Estado, BCI, Efectivo…"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
            />
            {existingAccounts.length > 0 && (
              <datalist id="pay-accounts-datalist">
                {existingAccounts.map(a => <option key={a} value={a} />)}
              </datalist>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleConfirm}
            className="w-full py-2.5 px-5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-[0.98]"
          >
            {btnText}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-5 text-sm font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-[0.98]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
