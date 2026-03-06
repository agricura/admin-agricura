import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const SelectInput = ({ label, options, value, onChange, name, required, placeholder = 'Seleccionar...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const openDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) setIsOpen(false);
    };
    const handleScroll = (event) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleSelect = (opt) => {
    onChange({ target: { name, value: opt } });
    setIsOpen(false);
  };

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
        className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-lg font-semibold text-sm text-slate-800 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400 font-normal'}>{value || placeholder}</span>
        <ChevronDown size={16} className={`ml-2 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-slate-200/60 rounded-xl shadow-lg shadow-slate-200/50 py-1.5 animate-in fade-in zoom-in duration-150 overflow-hidden"
        >
          <div className="overflow-y-auto max-h-56 scrollbar-hide px-1.5">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left mb-0.5 hover:bg-slate-50"
              >
                <span className={value === opt ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}>
                  {opt}
                </span>
                {value === opt && <Check size={15} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectInput;
