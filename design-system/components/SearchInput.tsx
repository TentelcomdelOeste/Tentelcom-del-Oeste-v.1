import React from 'react';
import { UI_TOKENS } from '../UI_TOKENS';
import { IconButton } from './IconButton';
import { FiX, FiSearch } from 'react-icons/fi';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  onSearch?: (term: string) => void; // Opcional si se usa onChange directo
}

export const SearchInput: React.FC<SearchInputProps> = ({ 
  placeholder = "Buscar...", 
  className = "", 
  value,
  onChange,
  ...props 
}) => {
  const handleClear = () => {
    if (onChange) {
      const event = {
        target: { value: '' },
        currentTarget: { value: '' }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <FiSearch className={`absolute left-3 top-1/2 -translate-y-1/2 ${UI_TOKENS.COLORS.textMuted} text-xs`} />
      <input 
        type="text" 
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`
          w-full 
          pl-9 ${value ? 'pr-10' : 'pr-4'} 
          ${UI_TOKENS.SPACING.inputPadding} 
          ${UI_TOKENS.SHAPE.roundedInput} 
          ${UI_TOKENS.COLORS.bgHeader} 
          border ${UI_TOKENS.COLORS.border} 
          ${UI_TOKENS.TYPOGRAPHY.body} 
          outline-none 
          focus:ring-2 focus:ring-blue-100 
          transition-all
        `}
        {...props}
      />
      {value && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <IconButton 
            icon={<FiX />} 
            variant="ghost" 
            onClick={handleClear} 
            title="Limpiar"
          />
        </div>
      )}
    </div>
  );
};