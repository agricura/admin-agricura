import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const TYPE_CONFIG = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', iconColor: 'text-emerald-500' },
  error:   { icon: AlertCircle,  bg: 'bg-rose-50 border-rose-200',      text: 'text-rose-700',    iconColor: 'text-rose-500' },
  info:    { icon: Info,         bg: 'bg-blue-50 border-blue-200',      text: 'text-blue-700',    iconColor: 'text-blue-500' },
};

export default function Toast() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[500] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => {
        const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.info;
        const Icon = cfg.icon;
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${cfg.bg} animate-in slide-in-from-right-5 fade-in duration-300`}
          >
            <Icon size={18} className={`${cfg.iconColor} shrink-0 mt-0.5`} />
            <p className={`text-sm font-medium flex-1 ${cfg.text}`}>{t.message}</p>
            <button onClick={() => dismiss(t.id)} className={`${cfg.iconColor} hover:opacity-70 shrink-0 mt-0.5`}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
