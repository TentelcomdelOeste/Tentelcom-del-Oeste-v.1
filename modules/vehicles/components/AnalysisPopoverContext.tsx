import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';

export interface PopoverInstance {
  id: string;
  triggerRect: DOMRect;
  floatingRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  desiredPlacement: string;
  isOpen: boolean;
}

interface AnalysisPopoverContextType {
  register: (instance: PopoverInstance) => void;
  unregister: (id: string) => void;
  getActivePopovers: () => PopoverInstance[];
}

const AnalysisPopoverContext = createContext<AnalysisPopoverContextType | null>(null);

export const useAnalysisPopoverContext = () => useContext(AnalysisPopoverContext);

/**
 * Proveedor de coordinación para popovers de Análisis de Flota.
 * Utiliza un ref para el registro de instancias para evitar ciclos de renderizado infinito
 * mientras permite la coordinación de posicionamiento inteligente.
 */
export const AnalysisPopoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const instancesRef = useRef<Record<string, PopoverInstance>>({});

  const register = useCallback((instance: PopoverInstance) => {
    instancesRef.current[instance.id] = instance;
  }, []);

  const unregister = useCallback((id: string) => {
    delete instancesRef.current[id];
  }, []);

  const getActivePopovers = useCallback(() => {
    return Object.values(instancesRef.current).filter(i => i.isOpen);
  }, []);

  const value = useMemo(() => ({
    register,
    unregister,
    getActivePopovers
  }), [register, unregister, getActivePopovers]);

  return (
    <AnalysisPopoverContext.Provider value={value}>
      {children}
    </AnalysisPopoverContext.Provider>
  );
};
