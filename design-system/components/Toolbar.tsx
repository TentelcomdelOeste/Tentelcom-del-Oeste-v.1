import React from 'react';

interface ToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  center?: React.ReactNode;
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  left, 
  right, 
  center,
  className = "" 
}) => {
  return (
    <div className={`
      flex flex-col md:flex-row items-center justify-between gap-4 w-full mb-6
      ${className}
    `}>
      {/* Zona Izquierda (Buscadores / Filtros principales) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
        {left}
      </div>

      {/* Zona Central (Filtros secundarios / Toggles) */}
      {center && (
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-center">
          {center}
        </div>
      )}

      {/* Zona Derecha (Acciones / Botones) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto justify-end">
        {right}
      </div>
    </div>
  );
};