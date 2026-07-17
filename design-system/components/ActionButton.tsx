import React from 'react';
import { COLORS } from '../tokens/colors';
import { RADIUS } from '../tokens/radius';
import { SPACING } from '../tokens/spacing';

// Fix: Added 'warning' to ActionVariant to support components that require warning-level emphasis
type ActionVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';

interface ActionButtonProps {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: ActionVariant;
  disabled?: boolean;
  isLoading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  form?: string;
  fullWidth?: boolean;
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onClick,
  variant = 'primary',
  disabled = false,
  isLoading = false,
  type = 'button',
  form,
  fullWidth = false,
  className = ''
}) => {
  const getVariantClasses = (v: string) => {
    switch (v) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'danger': return COLORS.danger;
      case 'success': return COLORS.success;
      case 'warning': return COLORS.warning;
      case 'ghost': return COLORS.neutralGhost;
      default: return COLORS.primary;
    }
  };

  return (
    /* eslint-disable-next-line no-restricted-syntax */
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        ${getVariantClasses(variant)}
        ${RADIUS.md}
        ${SPACING.button}
        font-black text-xs uppercase tracking-widest
        transition-all active:opacity-80
        flex items-center justify-center gap-2
        min-h-[44px] md:min-h-0
        ${fullWidth ? 'w-full' : 'w-full sm:w-auto'}
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed shadow-none' : ''}
        ${className}
      `}
    >
      {isLoading ? (
        <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
      ) : icon}
      <div className="min-w-0 pointer-events-none whitespace-nowrap">{isLoading ? 'Procesando...' : label}</div>
    </button>
  );
};