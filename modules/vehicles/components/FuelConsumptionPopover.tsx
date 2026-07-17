import React from 'react';
import { AnalysisPopover } from './AnalysisPopover';

interface FuelConsumptionPopoverProps {
  totalLitros: number;
  desktopAlignment?: 'left' | 'center' | 'right';
}

/**
 * Popover que muestra el detalle del consumo de combustible.
 * Utiliza AnalysisPopover para un posicionamiento consistente.
 */
export const FuelConsumptionPopover: React.FC<FuelConsumptionPopoverProps> = ({ 
  totalLitros, 
  desktopAlignment = 'center' 
}) => {
  const totalGalones = totalLitros / 3.785;

  return (
    <AnalysisPopover desktopAlignment={desktopAlignment}>
      <div className="p-4 sm:p-5">
        <div className="mb-3 sm:mb-4">
          <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">
            Consumo Total
          </h4>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
              {totalGalones.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">galones</span>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tight mb-1">Equivale a:</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-slate-800">
                {totalLitros.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">litros</span>
            </div>
          </div>

          <div className="bg-blue-50/50 p-2.5 sm:p-3 rounded-lg border border-blue-100/50">
            <span className="text-[7px] sm:text-[8px] font-bold text-blue-600/70 uppercase tracking-wider block mb-1 sm:mb-1.5">Base de conversión</span>
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <p className="text-[9px] sm:text-[10px] font-bold text-blue-900/80">1 galón = 3.785 litros</p>
            </div>
          </div>

          <div>
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tight mb-1 block">Nota Informativa</span>
            <p className="text-[9px] sm:text-[10px] text-slate-500 leading-relaxed">
              El consumo mostrado corresponde al histórico acumulado registrado para esta unidad según los filtros de fecha seleccionados.
            </p>
          </div>
        </div>
      </div>
    </AnalysisPopover>
  );
};
