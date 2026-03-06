import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, Pencil, Search, Trash2, MoreVertical } from 'lucide-react';

const MobileActionMenu = ({ invoice, onEdit, onView, onToggleStatus, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasItems = invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0;

  return (
    <div className="relative lg:hidden" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-500 active:scale-[0.98]"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200/60 py-1 z-[150]">
          <button onClick={() => { onView(invoice); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors">
            <Search size={16} className={hasItems ? 'text-blue-500' : 'text-slate-400'} /> Ver Detalles
          </button>
          <button onClick={() => { onToggleStatus(invoice.id, invoice.status_pago); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            {invoice.status_pago === 'PAGADO' ? <Clock size={16} className="text-amber-500" /> : <CheckCircle size={16} className="text-emerald-500" />}
            {invoice.status_pago === 'PAGADO' ? 'Marcar Pendiente' : 'Marcar Pagado'}
          </button>
          <button onClick={() => { onEdit(invoice); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Pencil size={16} className="text-indigo-500" /> Editar Registro
          </button>
          <div className="h-px bg-slate-100 my-1 mx-3"></div>
          <button onClick={() => { onDelete(invoice.id); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
            <Trash2 size={16} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileActionMenu;
