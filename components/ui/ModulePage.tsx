import React, { ReactNode } from 'react';
import { ModuleHeader } from './ModuleHeader';
import { ModuleContainer } from '../../design-system';

interface ModulePageProps {
  title?: string;
  subtitle?: string;
  rightContent?: ReactNode;
  children: ReactNode;
}

/**
 * Master Template para todos los módulos del sistema.
 * Gestiona la estructura base, el contenedor blanco y el encabezado.
 */
export const ModulePage: React.FC<ModulePageProps> = ({ title, subtitle, rightContent, children }) => {
  // Si no hay título, renderizamos el contenido crudo (útil para dashboards o vistas custom)
  if (!title) {
    return <div className="w-full">{children}</div>;
  }

  // Estructura estándar: Header y Contenido dentro del mismo contenedor visual
  return (
    <div className="w-full">
      <ModuleContainer>
        <ModuleHeader 
          title={title} 
          subtitle={subtitle} 
          rightContent={rightContent} 
        />
        <div className="mt-2 md:mt-3 w-full">
          {children}
        </div>
      </ModuleContainer>
    </div>
  );
};