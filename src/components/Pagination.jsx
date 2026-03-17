import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const COLOR_MAP = {
  blue:    'bg-blue-600',
  violet:  'bg-violet-600',
  emerald: 'bg-emerald-600',
};

export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, color = 'blue', position = 'top' }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…'); acc.push(p); return acc; }, []);

  const activeClass = COLOR_MAP[color] || COLOR_MAP.blue;

  if (position === 'bottom') return (
    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">
        Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} de {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all">
          <ChevronLeft size={13} /> Anterior
        </button>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all">
          Siguiente <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );

  // top position — numbered buttons
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onPageChange(1)} disabled={page === 1}
        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
        <ChevronLeft size={13} />
      </button>
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
        className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
        Anterior
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="px-1 text-slate-300 text-xs">…</span>
          : <button key={p} onClick={() => onPageChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${page === p ? `${activeClass} text-white shadow-sm` : 'text-slate-500 hover:bg-slate-100'}`}>
              {p}
            </button>
      )}
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
        Siguiente
      </button>
      <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages}
        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all">
        <ChevronRight size={13} />
      </button>
    </div>
  );
}
