import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

const MultiSelect = ({ label, options, selectedValues, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredOptions = useMemo(
    () => options.filter(opt => String(opt).toLowerCase().includes(searchTerm.toLowerCase())),
    [options, searchTerm]
  );

  const displayText =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
      ? selectedValues[0]
      : `${selectedValues.length} seleccionados`;

  return (
    <div className="relative text-left w-full">
      <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block tracking-wide px-1">{label}</label>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={18} className={`ml-2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div ref={dropdownRef} style={dropdownStyle} className="max-h-72 bg-white border border-slate-200/60 rounded-xl shadow-lg shadow-slate-200/50 flex flex-col p-1 animate-in fade-in zoom-in duration-150">
          <div className="p-1.5 sticky top-0 bg-white z-10">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48 scrollbar-hide p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500 text-center font-medium">Sin resultados</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (selectedValues.includes(opt)) onChange(selectedValues.filter((v) => v !== opt));
                    else onChange([...selectedValues, opt]);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left mb-0.5"
                >
                  <div className={`w-4 h-4 border rounded-sm mr-3 flex items-center justify-center transition-colors ${selectedValues.includes(opt) ? 'bg-blue-600 border-blue-600' : 'bg-slate-100 border-slate-300'}`}>
                    {selectedValues.includes(opt) && <Check size={12} className="text-white" />}
                  </div>
                  <span className={selectedValues.includes(opt) ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}>{opt}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
