import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UI_TOKENS } from '../UI_TOKENS';

interface SelectProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  options: any[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  isSearchable?: boolean;
  error?: boolean | string;
  usePortal?: boolean;
}

export const Select: React.FC<SelectProps> = ({ 
  label, 
  options = [], 
  value, 
  onChange, 
  placeholder,
  isSearchable = true,
  className = "",
  error,
  usePortal = false,
  ...props 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalStyles, setPortalStyles] = useState<React.CSSProperties>({});

  const getOptionLabel = (opt: any): string => {
    try {
      if (opt === undefined || opt === null) return "";
      if (typeof opt === "string") return opt;
      if (typeof opt === "number") return String(opt);
      if (opt?.label) return String(opt.label);
      if (opt?.name) return String(opt.name);
      if (opt?.value) return String(opt.value);
      return "";
    } catch (e) {
      console.warn("Select: getOptionLabel error", e);
      return "";
    }
  };

  const filteredOptions = useMemo(() => {
    try {
        if (!options || !Array.isArray(options)) {
            console.warn("Select: options is not an array", options);
            return [];
        }
        if (!isSearchable || !searchText) return options;
        const search = searchText.toLowerCase();
        return options.filter(opt => {
          const l = getOptionLabel(opt).toLowerCase();
          return l.includes(search);
        });
    } catch (e) {
        console.error("Select: filteredOptions useMemo error", e);
        return [];
    }
  }, [options, searchText, isSearchable]);

  const updatePortalStyles = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      
      setPortalStyles({
        position: 'fixed',
        top: `${rect.bottom + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        zIndex: 9999
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const isInsideContainer = containerRef.current?.contains(event.target as Node);
      const isInsideDropdown = dropdownRef.current?.contains(event.target as Node);
      
      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
        setSearchText("");
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('mousedown', handleClickOutside); // Fallback para desktop
    document.addEventListener('touchstart', handleClickOutside, { passive: true }); // Fallback para iOS
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && usePortal) {
      const update = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setPortalStyles({
            position: 'fixed',
            top: `${rect.bottom}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            zIndex: 9999
          });
        }
      };
      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }
  }, [isOpen, usePortal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSearchable) {
      setSearchText(e.target.value);
    }
    setIsOpen(true);
  };

  const handleOptionClick = (option: any) => {
    // Para mobile: usar un pequeño timeout si se disparó por pointerdown 
    // evita destruir el DOM antes de que React termine el ciclo
    setTimeout(() => {
      const val = typeof option === 'object' && option !== null && 'value' in option ? option.value : option;
      onChange(val);
      setSearchText("");
      setIsOpen(false);
    }, 0);
  };

  const displayValue = useMemo(() => {
    try {
        if (isOpen && isSearchable) return searchText;
        if (value === undefined || value === null || value === "") return "";
        if (!Array.isArray(options)) return String(value);

        if (typeof value === 'string' || typeof value === 'number') {
          const option = options.find(opt => {
              if (typeof opt === 'object' && opt !== null) {
                  return String(opt.value) === String(value);
              }
              return String(opt) === String(value);
          });
          return option ? getOptionLabel(option) : String(value);
        }
        return getOptionLabel(value);
    } catch (e) {
        console.error("Select: displayValue useMemo error", e);
        return String(value || "");
    }
  }, [value, options, isOpen, isSearchable, searchText]);

  const dropdownMenu = (
    <div 
        ref={dropdownRef}
        className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-1 duration-200"
        style={{
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
            transform: 'translateZ(0)',
            ...(usePortal ? portalStyles : {})
        }}
    >
      {filteredOptions.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-400 text-center">Sin resultados</div>
      ) : (
        filteredOptions.map((option, index) => (
          <div
            key={index}
            onClick={(e) => {
              e.preventDefault();
              handleOptionClick(option);
            }}
            // Eliminado onPointerDown para evitar conflictos con scroll
            className={`
              px-4 py-3 
              cursor-pointer select-none
              text-[11px] font-bold uppercase tracking-wider
              ${getOptionLabel(option) === getOptionLabel(value) ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'}
              transition-colors border-b border-slate-50 last:border-0
            `}
          >
            {typeof option === "string" ? option : option?.label || option?.value}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1.5"}>
          {label}
        </label>
      )}
      <div 
        className={`
          relative group cursor-pointer
          ${UI_TOKENS.SHAPE.roundedInput} 
          overflow-hidden
          transition-all duration-200
          ${isOpen ? 'ring-2 ring-blue-100 border-blue-400' : 'hover:border-slate-300'}
        `}
        onPointerDown={(e) => {
          if (!isOpen && !isSearchable) e.preventDefault(); // Evita foco indeseado
        }}
        onClick={() => !isSearchable && setIsOpen(!isOpen)}
      >
        <input
          {...props}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => isSearchable && setIsOpen(true)}
          readOnly={!isSearchable}
          placeholder={placeholder}
          className={`
            w-full 
            ${UI_TOKENS.SPACING.inputPadding} 
            ${UI_TOKENS.COLORS.bgHeader} 
            border-0
            ${UI_TOKENS.TYPOGRAPHY.body} 
            text-[16px] md:text-xs
            outline-none 
            appearance-none
            cursor-pointer
            ${isOpen ? 'bg-white' : ''}
            transition-colors
          `}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'group-hover:text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {isOpen && (
        usePortal
          ? createPortal(dropdownMenu, document.body)
          : (
            <div className="absolute top-full left-0 w-full mt-1 z-[60]">
              {dropdownMenu}
            </div>
          )
      )}
    </div>
  );
};
