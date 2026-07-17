import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';
import { FiX } from "react-icons/fi";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  desktopMaxWidth?: string;
  preventCloseOnOverlayClick?: boolean;
  containerClassName?: string;
  contentClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  subtitle, 
  children, 
  footer,
  maxWidth = 'max-w-lg',
  desktopMaxWidth,
  preventCloseOnOverlayClick = true,
  containerClassName = "",
  contentClassName = ""
}) => {
  
  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className={`fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4 ${containerClassName}`}
      onClick={(e) => {
        if (!preventCloseOnOverlayClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`bg-white w-full ${maxWidth} ${desktopMaxWidth ? `md:${desktopMaxWidth}` : ''} rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden ${contentClassName}`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-none bg-white">
          <div>
            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs font-bold text-slate-400 mt-1">{subtitle}</p>
            )}
          </div>
          <IconButton 
            icon={<FiX className="text-xl"  />} 
            onClick={onClose} 
            variant="neutral"
            title="Cerrar"
          />
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar bg-white">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
