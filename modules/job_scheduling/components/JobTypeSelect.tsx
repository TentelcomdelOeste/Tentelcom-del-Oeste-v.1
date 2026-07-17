import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useConfirm, UI_TOKENS } from '@/design-system';
import { deactivateJobType } from '../jobTypeService';

interface Props {
  options: { value: string; label: string; id?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: React.ReactNode;
  onRefresh?: () => Promise<void>;
  onDelete?: (id: string, label: string) => Promise<void>;
}

export const JobTypeSelect: React.FC<Props> = ({ options, value, onChange, placeholder, label, onRefresh, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const confirm = useConfirm();

  const handleDelete = async (e: React.MouseEvent, typeId: string, label: string) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: 'Eliminar Tipo de Trabajo',
      description: `¿Está seguro de que desea eliminar "${label}"? No podrá volver a seleccionarlo en futuros trabajos.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (isConfirmed) {
      if (onDelete) {
        await onDelete(typeId, label);
      } else {
        await deactivateJobType(typeId);
      }
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="space-y-1">
      {label && <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block"}>{label}</label>}
      <div className="relative">
        <div 
          className={`w-full ${UI_TOKENS.SPACING.inputPadding} ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none cursor-pointer text-sm`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {value || <span className="text-slate-400">{placeholder}</span>}
        </div>
        {isOpen && (
          <div className="absolute z-50 w-full bg-white border border-slate-200 mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.map(option => (
              <div
                key={option.value}
                className="p-2 hover:bg-slate-50 cursor-pointer text-sm flex items-center justify-between"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.value !== 'Otro' && (
                  <button 
                    onClick={(e) => handleDelete(e, option.id || option.value, option.label)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <FiX />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
