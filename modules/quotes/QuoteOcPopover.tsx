import React, { useState, useRef, useEffect } from 'react';
import { FiClipboard, FiCheck, FiCopy } from "react-icons/fi";

interface QuoteOcPopoverProps {
  ocs: string[];
}

export const QuoteOcPopover: React.FC<QuoteOcPopoverProps> = ({ ocs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndividual, setCopiedIndividual] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Cerrar con ESC
    const handleEsc = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (!isOpen && popoverRef.current) {
          // Calcular posición disponible
          const rect = popoverRef.current.getBoundingClientRect();
          const spaceAbove = rect.top;
          // Si hay menos de 300px arriba, abrir hacia abajo
          if (spaceAbove < 300) {
              setPosition('bottom');
          } else {
              setPosition('top');
          }
      }
      
      setIsOpen(!isOpen);
  };

  const handleCopyAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      const textToCopy = ocs.join('\n');
      navigator.clipboard.writeText(textToCopy).then(() => {
          setCopiedAll(true);
          setTimeout(() => setCopiedAll(false), 2000);
      });
  };

  const handleCopyOne = (e: React.MouseEvent, oc: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(oc).then(() => {
          setCopiedIndividual(oc);
          setTimeout(() => setCopiedIndividual(null), 2000);
      });
  };

  const hasOcs = ocs && ocs.length > 0;

  return (
    <div className="relative inline-block ml-2" ref={popoverRef}>
        {/* Trigger Button */}
        <button
            onClick={handleToggle}
            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all border ${isOpen ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-300'}`}
            title="Ver Órdenes de Compra asociadas"
        >
            <FiClipboard className="text-xs"  />
            <span className="sr-only">Ver OCs</span>
        </button>

        {/* Badge contador pequeño si hay muchas */}
        {hasOcs && ocs.length > 1 && !isOpen && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-black w-3 h-3 flex items-center justify-center rounded-full pointer-events-none">
                {ocs.length}
            </span>
        )}

        {/* Popover Panel */}
        {isOpen && (
            <div 
                className={`absolute left-1/2 -translate-x-1/2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-[500] animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden
                    ${position === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center flex-none">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Órdenes de Compra
                        </span>
                        <span className="text-[9px] font-bold text-blue-600">
                            {hasOcs ? `${ocs.length} Documento${ocs.length !== 1 ? 's' : ''}` : 'Sin documentos'}
                        </span>
                    </div>
                    {hasOcs && (
                        <button 
                            onClick={handleCopyAll}
                            className={`flex items-center gap-1.5 text-[9px] font-bold transition-colors px-2 py-1.5 rounded-md border ${copiedAll ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-200'}`}
                        >
                            {copiedAll ? (
                                <>
                                    <FiCheck  /> Copiado
                                </>
                            ) : (
                                <>
                                    <FiCopy  /> Copiar todas
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* List */}
                <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 bg-white">
                    {!hasOcs ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-bold">
                            Sin Órdenes de Compra asignadas
                        </div>
                    ) : (
                        ocs.map((oc, index) => (
                            <div 
                                key={`${oc}-${index}`} 
                                className="group flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 mb-0.5 last:mb-0"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-[9px] font-bold text-slate-400 w-4 text-center select-none">
                                        {index + 1}.
                                    </span>
                                    <span className="text-xs font-mono font-bold text-slate-700 select-all truncate">
                                        {oc}
                                    </span>
                                </div>
                                
                                <button
                                    onClick={(e) => handleCopyOne(e, oc)}
                                    className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100"
                                    title="Copiar número"
                                >
                                    {copiedIndividual === oc ? (
                                        <FiCheck className="text-emerald-500 text-xs"  />
                                    ) : (
                                        <FiCopy className="text-xs"  />
                                    )}
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Tip */}
                <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100 text-center">
                     <p className="text-[8px] text-slate-400 font-medium">Use ESC para cerrar</p>
                </div>

                {/* Arrow Indicator Dinámico */}
                <div className={`absolute left-1/2 -translate-x-1/2 border-8 border-transparent drop-shadow-sm
                    ${position === 'top' ? 'top-full -mt-[1px] border-t-white' : 'bottom-full -mb-[1px] border-b-white'}
                `}></div>
            </div>
        )}
    </div>
  );
};