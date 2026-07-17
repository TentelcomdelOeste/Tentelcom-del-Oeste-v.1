import React from 'react';
import { UI_TOKENS } from '../UI_TOKENS';

interface ModuleContainerProps {
  children: React.ReactNode;
}

/**
 * Contenedor Maestro de Módulo (Tarjeta Principal).
 * Proporciona el fondo blanco, bordes, sombras y padding corporativo.
 */
export const ModuleContainer: React.FC<ModuleContainerProps> = ({ children }) => {
  return (
    <div className={`
      w-full 
      bg-white
      overflow-hidden
      rounded-xl 
      shadow-sm 
      p-4 md:px-4 md:py-8
      border ${UI_TOKENS.COLORS.border} 
      animate-in 
      cursor-default
      select-none
    `}>
      {children}
    </div>
  );
};