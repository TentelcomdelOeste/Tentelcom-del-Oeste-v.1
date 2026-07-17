import React from 'react';
import { AnalysisPopover } from './AnalysisPopover';

interface CostPerKmPopoverProps {
  totalCost: number;
  totalKm: number;
  costPerKm: number;
  desktopAlignment?: 'left' | 'center' | 'right';
}

/**
 * Popover que muestra el detalle del costo por kilómetro.
 * Utiliza AnalysisPopover para un posicionamiento consistente.
 */
export const CostPerKmPopover: React.FC<CostPerKmPopoverProps> = ({ 
  totalCost, 
  totalKm, 
  costPerKm,
  desktopAlignment = 'center'
}) => {
  return (
    <AnalysisPopover desktopAlignment={desktopAlignment}>
      <div className="p-4 sm:p-5">
        <div className="mb-3 sm:mb-4">
          <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">
            Costo por Kilómetro
          </h4>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
              ₡{costPerKm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">por km</span>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-slate-100">
          <div>
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tight mb-1.5 sm:mb-2 block">¿Cómo se calcula?</span>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 leading-relaxed italic">
              Costo Total ÷ Total de Kilómetros Recorridos
            </p>
          </div>

          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-100">
            <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 sm:mb-2">Ejemplo para esta unidad:</span>
            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[10px] gap-0.5 sm:gap-2">
                <span className="text-slate-500">Costo Total:</span>
                <span className="font-bold text-slate-700">₡{totalCost.toLocaleString()}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[10px] gap-0.5 sm:gap-2">
                <span className="text-slate-500">Kilómetros:</span>
                <span className="font-bold text-slate-700">{totalKm.toLocaleString()} km</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 mt-1 sm:mt-1.5 flex justify-between items-center">
                <span className="text-[8px] sm:text-[9px] font-black text-blue-600 uppercase">Resultado:</span>
                <span className="text-[10px] sm:text-[11px] font-black text-blue-900">₡{costPerKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} / km</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tight mb-1 block">Interpretación</span>
            <p className="text-[9px] sm:text-[10px] text-slate-500 leading-relaxed">
              Este indicador representa el costo promedio histórico de recorrer un kilómetro con esta unidad, considerando todos los gastos registrados.
            </p>
          </div>
        </div>
      </div>
    </AnalysisPopover>
  );
};
