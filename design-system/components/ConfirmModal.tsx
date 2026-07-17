import React from 'react';
import { createPortal } from 'react-dom';
import { ACTION_ICONS } from '../icons/actionIcons';
import { ActionButton } from './ActionButton';
import useLockBodyScroll from '../../hooks/useLockBodyScroll';

/**
 * ARCHITECTURAL RULE:
 * Any destructive action MUST be guarded by ConfirmModal.
 * Direct deletes are forbidden in the UI layer.
 * 
 * This component acts as the final safety gate before data loss.
 */

interface ConfirmModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
  icon?: React.ElementType;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  show,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  variant = "danger",
  isLoading = false,
  icon: Icon = ACTION_ICONS.delete
}) => {
  useLockBodyScroll(show);

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[1000] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
          <Icon className="text-2xl" />
        </div>
        
        <h3 className="text-xl font-black text-blue-950 mb-2 uppercase tracking-tight">{title}</h3>
        <div className="text-slate-500 text-sm font-bold mb-8 leading-relaxed break-words">
          {description}
        </div>

        <div className="flex gap-3">
          <ActionButton 
            label="Cancelar"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          />
          <ActionButton 
            label={confirmLabel}
            variant={variant}
            onClick={onConfirm}
            isLoading={isLoading}
            className="flex-1"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};