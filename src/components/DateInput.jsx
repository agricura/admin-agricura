import React, { useState } from 'react';

const DateInput = ({ value, onChange, className, ...rest }) => {
  const [focused, setFocused] = useState(false);
  const showPlaceholder = !value && !focused;

  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`${className} ${showPlaceholder ? '[color:transparent]' : ''}`}
        {...rest}
      />
      {showPlaceholder && (
        <span className="absolute inset-0 flex items-center px-4 text-slate-400 text-sm font-medium pointer-events-none select-none">
          dd/mm/yyyy
        </span>
      )}
    </div>
  );
};

export default DateInput;
