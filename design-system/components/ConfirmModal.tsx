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
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[1000] p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md sm:max-w-lg rounded-[32px] shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] text-center animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="shrink-0 mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            <Icon className="text-2xl" />
          </div>
          <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">{title}</h3>
        </div>
        
        <div className="overflow-y-auto flex-1 my-2 pr-1 text-slate-500 text-sm font-bold leading-relaxed break-words custom-scrollbar text-left sm:text-center">
          {description}
        </div>

        <div className="shrink-0 pt-4 mt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <ActionButton 
            label="Cancelar"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 w-full"
          />
          <ActionButton 
            label={confirmLabel}
            variant={variant}
            onClick={onConfirm}
            isLoading={isLoading}
            className="flex-1 w-full"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};