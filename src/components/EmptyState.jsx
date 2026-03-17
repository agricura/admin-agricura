import React from 'react';

export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      {Icon && (
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
          <Icon size={26} className="text-slate-400" />
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-slate-700">{title}</p>
        {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all active:scale-[0.97] disabled:opacity-50 mt-2"
        >
          {action.icon && <action.icon size={15} />}
          {action.label}
        </button>
      )}
    </div>
  );
}
