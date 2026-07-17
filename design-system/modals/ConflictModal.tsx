import React from 'react';
import { createPortal } from 'react-dom';
import { ActionButton } from '../components/ActionButton';
import useLockBodyScroll from '../../hooks/useLockBodyScroll';

interface ConflictModalProps {
  show: boolean;
  onClose: () => void;
  onUseExisting: () => void;
  onChangeCode: () => void;
  title: string;
  description: string;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  show,
  onClose,
  onUseExisting,
  onChangeCode,
  title,
  description
}) => {
  useLockBodyScroll(show);

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[1000] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-black text-blue-950 mb-4 uppercase tracking-tight">{title}</h3>
        <p className="text-slate-500 text-sm font-bold mb-8 leading-relaxed break-words">
          {description}
        </p>

        <div className="flex flex-col gap-3">
          <ActionButton label="Usar producto existente" variant="warning" onClick={onUseExisting} fullWidth />
          <ActionButton label="Cambiar código" variant="warning" onClick={onChangeCode} fullWidth />
          <ActionButton label="Cancelar" variant="ghost" onClick={onClose} fullWidth />
        </div>
      </div>
    </div>,
    document.body
  );
};
