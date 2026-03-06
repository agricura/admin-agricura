import React from 'react';
import { Trash2, CheckCircle, Info } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', type = 'info' }) => {
  if (!isOpen) return null;

  const colors = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 focus:ring-rose-100',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 focus:ring-emerald-100',
    info: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 focus:ring-blue-100',
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center animate-in zoom-in duration-200 border border-slate-200/60">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${type === 'danger' ? 'bg-rose-50 text-rose-600' : type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
          {type === 'danger' ? <Trash2 size={22} /> : type === 'success' ? <CheckCircle size={22} /> : <Info size={22} />}
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">{message}</p>
        <div className="flex flex-col gap-2.5">
          <button onClick={() => { onConfirm(); onClose(); }} className={`w-full py-2.5 px-5 text-sm font-semibold rounded-lg shadow-sm outline-none transition-all active:scale-[0.98] ${colors[type] || colors.info}`}>{confirmText}</button>
          <button onClick={onClose} className="w-full py-2.5 px-5 text-sm font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-[0.98] outline-none">{cancelText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
