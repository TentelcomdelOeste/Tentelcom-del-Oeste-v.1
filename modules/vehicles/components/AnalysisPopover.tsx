import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  arrow,
  FloatingArrow,
  Placement,
} from '@floating-ui/react';
import { FiInfo } from 'react-icons/fi';
import { motion, AnimatePresence } from 'motion/react';
import { useAnalysisPopoverContext } from './AnalysisPopoverContext';

export interface AnalysisPopoverProps {
  children: React.ReactNode;
  desktopAlignment?: 'left' | 'center' | 'right';
}

/**
 * Componente de popover centralizado para el módulo de Análisis de Flota.
 * Utiliza @floating-ui/react para posicionamiento inteligente y coordinación entre instancias
 * para mantener alineación vertical y evitar superposiciones.
 */
export const AnalysisPopover: React.FC<AnalysisPopoverProps> = ({ 
  children, 
  desktopAlignment = 'center' 
}) => {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef(null);
  const contextData = useAnalysisPopoverContext();
  const register = contextData?.register;
  const unregister = contextData?.unregister;
  const getActivePopovers = contextData?.getActivePopovers;

  // Determinamos el posicionamiento inicial sugerido según la alineación de escritorio
  let initialPlacement: Placement = 'top';
  if (desktopAlignment === 'left') initialPlacement = 'top-start';
  if (desktopAlignment === 'right') initialPlacement = 'top-end';

  const { x, y, strategy, refs, context, placement, elements } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: initialPlacement,
    whileElementsMounted: autoUpdate,
    middleware: useMemo(() => [
      offset(12),
      flip({
        fallbackAxisSideDirection: 'end',
        padding: 10,
      }),
      shift({ padding: 10 }),
      // Middleware personalizado para coordinación de filas y evitar colisiones
      {
        name: 'fleetCoordination',
        fn({ x, y, rects, placement }) {
          if (!getActivePopovers || !rects || !rects.reference) return { x, y };

          const activePopovers = getActivePopovers();
          const triggerTop = rects.reference.y;
          const ROW_THRESHOLD = 50;
          const currentSide = placement.split('-')[0]; // top o bottom

          // 1. Alineación de Fila: Buscar otro popover ya posicionado en la misma fila
          const sameRowLeader = activePopovers.find(p => 
            p.id !== id && 
            p.floatingRect && 
            Math.abs(p.triggerRect.top - triggerTop) < ROW_THRESHOLD &&
            p.desiredPlacement.startsWith(currentSide)
          );

          let adjustedY = y;
          if (sameRowLeader && sameRowLeader.floatingRect) {
            adjustedY = sameRowLeader.floatingRect.top;
          }

          return { x, y: adjustedY };
        }
      },
      arrow({ element: arrowRef }),
    ], [id, getActivePopovers]),
  });

  // Registrar estado en el contexto para coordinación
  // Usamos useEffect para asegurar que el elemento de referencia esté montado
  useEffect(() => {
    if (register && elements.reference) {
      const triggerElement = elements.reference as HTMLElement;
      register({
        id,
        isOpen,
        triggerRect: triggerElement.getBoundingClientRect(),
        floatingRect: isOpen && x !== null && y !== null ? {
            top: y,
            left: x,
            width: 0,
            height: 0,
        } : null,
        desiredPlacement: placement
      });
    }
  }, [id, isOpen, elements.reference, x, y, placement, register]);

  useEffect(() => {
    return () => unregister?.(id);
  }, [id, unregister]);

  const hover = useHover(context, {
    enabled: typeof window !== 'undefined' && window.innerWidth >= 1024,
    move: false,
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
    dismiss,
    role,
  ]);

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: (e) => {
            e.stopPropagation();
            e.preventDefault();
          }
        })}
        className="text-slate-400 hover:text-amber-600 transition-colors focus:outline-none flex items-center justify-center p-0.5"
        type="button"
      >
        <FiInfo className="text-xs" />
      </button>

      <FloatingPortal>
        <AnimatePresence>
          {isOpen && (
            <div
              ref={refs.setFloating}
              style={{
                position: strategy,
                top: y ?? 0,
                left: x ?? 0,
                width: 'max-content',
                zIndex: 9999,
              }}
              {...getFloatingProps()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: placement.includes('top') ? 5 : -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: placement.includes('top') ? 5 : -5 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-visible"
                style={{ 
                  width: window.innerWidth < 1024 ? 'calc(100vw - 32px)' : 'auto',
                  maxWidth: '18rem'
                }}
              >
                <div className="relative z-10 bg-white rounded-xl overflow-hidden shadow-sm">
                    {children}
                </div>
                
                <FloatingArrow
                  ref={arrowRef}
                  context={context}
                  fill="white"
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  tipRadius={1}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
};

