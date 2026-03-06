import React from 'react';

const DateInput = ({ value, onChange, className, ...rest }) => (
  <div className="relative">
    <input
      type="date"
      value={value}
      onChange={onChange}
      className={`${className} ${!value ? '[color:transparent]' : ''}`}
      {...rest}
    />
    {!value && (
      <span className="absolute inset-0 flex items-center px-4 text-slate-400 text-sm font-medium pointer-events-none select-none">
        dd/mm/yyyy
      </span>
    )}
  </div>
);

export default DateInput;
