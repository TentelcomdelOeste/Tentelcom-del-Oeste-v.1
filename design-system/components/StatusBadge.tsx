import React from 'react';
import { COLORS } from '../tokens/colors';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  label, 
  variant = 'neutral',
  icon,
  className = ''
}) => {
  const colorClass = COLORS.badge[variant] || COLORS.badge.neutral;

  return (
    <span className={`
      ${colorClass}
      px-2 py-1 
      rounded-lg 
      text-[9px] 
      font-black 
      uppercase 
      tracking-widest
      inline-flex items-center gap-1
      overflow-hidden
      truncate
      ${className}
    `}>
      {icon && <span className="text-[10px]">{icon}</span>}
      {label}
    </span>
  );
};