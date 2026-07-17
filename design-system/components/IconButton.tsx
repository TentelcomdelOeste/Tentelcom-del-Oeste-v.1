import React from 'react';
import { COLORS } from '../tokens/colors';
import { RADIUS } from '../tokens/radius';

type IconVariant = 'primary' | 'danger' | 'success' | 'neutral' | 'warning';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: IconVariant;
  title?: string;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const IconButton: React.FC<IconButtonProps> = ({ 
  icon, 
  onClick, 
  variant = 'neutral', 
  title,
  disabled = false,
  className = '',
  type = 'button'
}) => {
  const getVariantClasses = (v: string) => {
    switch (v) {
      case 'primary': return COLORS.infoGhost;
      case 'danger': return COLORS.dangerGhost;
      case 'success': return COLORS.successGhost;
      case 'neutral': return COLORS.neutralGhost;
      case 'warning': return "text-amber-500 hover:bg-amber-50 hover:text-amber-600";
      default: return COLORS.neutralGhost;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (type !== 'submit') {
      e.preventDefault(); // Prevent form submission if not submit type
    }
    e.stopPropagation(); // Stop event bubbling to rows/parents
    if (onClick && !disabled) {
      onClick(e);
    }
  };

  return (
    /* eslint-disable-next-line no-restricted-syntax */
    <button 
      type={type}
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={`
        p-2.5 md:p-1.5
        min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0
        ${RADIUS.sm} 
        transition-all 
        flex items-center justify-center
        text-lg md:text-base
        ${getVariantClasses(variant)}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {icon}
    </button>
  );
};