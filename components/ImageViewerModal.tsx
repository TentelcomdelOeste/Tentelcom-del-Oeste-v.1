import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { ZoomViewer } from './ZoomViewer';

interface ImageViewerModalProps {
  images: string[];
  initialIndex?: number;
  title?: string;
  code?: string;
  onClose: (lastIndex: number) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  images,
  initialIndex = 0,
  title,
  code,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose(currentIndex);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, currentIndex]);

  const handlePrevImage = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    if (images.length <= 1) return;
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    if (images.length <= 1) return;
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  if (!images || images.length === 0) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => onClose(currentIndex)}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-[95vw] md:w-[90vw] lg:w-[85vw] max-w-6xl h-[85vh] md:h-[90vh] flex flex-col p-4 md:p-6 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="font-bold text-sm text-slate-900 truncate leading-tight">
              {title || 'Visor de Imagen'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {code && (
                <span className="inline-block text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                  {code}
                </span>
              )}
              {images.length > 1 && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {currentIndex + 1} / {images.length}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose(currentIndex)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors shrink-0 cursor-pointer"
            title="Cerrar vista de imagen"
            aria-label="Cerrar"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Area de Imagen centrada y proporcional con soporte Swipe y Flechas */}
        <div 
          className="relative w-full flex-1 flex items-center justify-center overflow-hidden bg-slate-50/50 rounded-xl select-none border border-slate-100"
        >
          {/* Flecha Izquierda (Anterior) */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute left-2 z-10 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all shadow-md active:scale-95 cursor-pointer"
              title="Imagen anterior"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Imagen actual con Zoom */}
          <div className="absolute inset-0">
            <ZoomViewer
              src={images[currentIndex]}
              alt={`${title} ${currentIndex + 1}`}
              onSwipeLeft={handleNextImage}
              onSwipeRight={handlePrevImage}
            />
          </div>

          {/* Flecha Derecha (Siguiente) */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-2 z-10 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all shadow-md active:scale-95 cursor-pointer"
              title="Siguiente imagen"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Indicador inferior de navegación si hay múltiples imágenes */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-1 shrink-0">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex 
                    ? 'w-6 bg-blue-600' 
                    : 'w-2 bg-slate-200 hover:bg-slate-300'
                }`}
                title={`Ir a imagen ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
