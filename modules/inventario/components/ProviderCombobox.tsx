import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FiTrash2, FiChevronDown, FiPlusCircle, FiCheck, FiTruck } from 'react-icons/fi';
import { UI_TOKENS } from '../../../design-system/UI_TOKENS';
import { ConfirmModal } from '../../../design-system/components/ConfirmModal';

interface ProviderComboboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onDeleteOption?: (providerName: string) => Promise<void> | void;
  placeholder?: string;
  error?: boolean | string;
  required?: boolean;
}

export const ProviderCombobox: React.FC<ProviderComboboxProps> = ({
  label = "Nombre del Proveedor",
  value = "",
  onChange,
  options = [],
  onDeleteOption,
  placeholder = "Escribe o selecciona un proveedor...",
  error,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Opciones filtradas basadas en el texto actual
  const filteredOptions = useMemo(() => {
    const trimmedVal = (value || "").trim().toLowerCase();
    if (!trimmedVal) return options;
    return options.filter(opt => opt.toLowerCase().includes(trimmedVal));
  }, [options, value]);

  // Determinar si el valor escrito es exactamente igual a alguno existente
  const exactMatchExists = useMemo(() => {
    const trimmedVal = (value || "").trim().toLowerCase();
    if (!trimmedVal) return false;
    return options.some(opt => opt.trim().toLowerCase() === trimmedVal);
  }, [options, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    onChange(nextVal);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    e.preventDefault();
    setProviderToDelete(option);
  };

  const confirmDelete = async () => {
    if (!providerToDelete || !onDeleteOption) return;
    setIsDeleting(true);
    try {
      await onDeleteOption(providerToDelete);
      // Si el valor actual era el que se eliminó, podemos mantenerlo o dejarlo libre
      setProviderToDelete(null);
    } catch (err) {
      console.error("Error al eliminar proveedor:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1.5 flex items-center justify-between"}>
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            (Selecciona o escribe uno nuevo)
          </span>
        </label>
      )}

      <div 
        className={`
          relative flex items-center
          ${UI_TOKENS.SHAPE.roundedInput} 
          ${UI_TOKENS.COLORS.bgHeader} 
          border 
          ${error ? 'border-red-400 ring-2 ring-red-100' : isOpen ? 'border-blue-500 ring-2 ring-blue-100 bg-white' : 'border-slate-200 hover:border-slate-300'}
          transition-all duration-200
        `}
      >
        <div className="pl-3.5 text-slate-400 flex items-center pointer-events-none">
          <FiTruck className="text-sm text-slate-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`
            w-full py-2.5 px-3
            bg-transparent border-0
            ${UI_TOKENS.TYPOGRAPHY.body} 
            text-[14px] md:text-xs font-bold text-slate-800
            outline-none 
            placeholder:text-slate-400 placeholder:font-normal
          `}
          autoComplete="off"
          required={required}
        />

        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen && inputRef.current) {
              inputRef.current.focus();
            }
          }}
          className="p-2.5 mr-1 text-slate-400 hover:text-blue-600 transition-colors rounded-lg focus:outline-none"
          title="Ver opciones de proveedores"
        >
          <FiChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Dropdown de opciones */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto custom-scrollbar z-[70] animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Opción de crear si no coincide exactamente */}
          {value && value.trim() !== "" && !exactMatchExists && (
            <div
              onClick={() => handleSelectOption(value.trim())}
              className="px-4 py-2.5 bg-blue-50/60 hover:bg-blue-100/70 border-b border-blue-100 cursor-pointer flex items-center gap-2.5 transition-colors group"
            >
              <FiPlusCircle className="text-blue-600 text-sm flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] font-black text-blue-900 truncate">
                  Usar &ldquo;{value.trim()}&rdquo;
                </span>
                <span className="text-[9px] text-blue-600 font-medium">
                  Se guardará como nuevo proveedor al registrar el movimiento
                </span>
              </div>
            </div>
          )}

          {/* Listado de proveedores existentes */}
          {filteredOptions.length === 0 && (!value || exactMatchExists) ? (
            <div className="px-4 py-6 text-center text-slate-400 text-xs font-medium">
              No hay proveedores registrados. Escribe uno nuevo arriba.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOptions.map((opt, idx) => {
                const isSelected = (value || "").trim().toLowerCase() === opt.trim().toLowerCase();
                return (
                  <div
                    key={`${opt}-${idx}`}
                    onClick={() => handleSelectOption(opt)}
                    className={`
                      px-4 py-2.5 flex items-center justify-between gap-3
                      cursor-pointer select-none transition-colors group
                      ${isSelected ? 'bg-blue-50 text-blue-950 font-bold' : 'hover:bg-slate-50 text-slate-700'}
                    `}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {isSelected ? (
                        <FiCheck className="text-blue-600 text-xs flex-shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0 group-hover:bg-blue-400 transition-colors" />
                      )}
                      <span className="text-xs font-bold truncate tracking-tight uppercase">
                        {opt}
                      </span>
                    </div>

                    {onDeleteOption && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, opt)}
                        className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title={`Eliminar "${opt}" del catálogo`}
                        aria-label={`Eliminar proveedor ${opt}`}
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación para eliminar proveedor */}
      <ConfirmModal
        show={Boolean(providerToDelete)}
        onClose={() => setProviderToDelete(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar Proveedor del Catálogo?"
        description={
          <div className="space-y-2 text-xs">
            <p>
              ¿Estás seguro de que deseas eliminar a <strong className="text-slate-900">&ldquo;{providerToDelete}&rdquo;</strong> de la lista de proveedores disponibles?
            </p>
            <p className="text-slate-400 text-[11px] font-normal">
              Esta acción no modificará ni borrará los movimientos históricos ya registrados con este proveedor.
            </p>
          </div>
        }
        confirmLabel="Eliminar Proveedor"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
