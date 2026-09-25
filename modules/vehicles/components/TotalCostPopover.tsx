import React from 'react';
import { AnalysisPopover } from './AnalysisPopover';

export interface CostCategoryItem {
  name: string;
  amount: number;
}

interface TotalCostPopoverProps {
  totalCost: number;
  breakdown?: Record<string, number>;
  desktopAlignment?: 'left' | 'center' | 'right';
}

/**
 * Popover informativo que muestra el desglose del Costo Total por categoría.
 * Utiliza AnalysisPopover para un posicionamiento inteligente y consistente.
 */
export const TotalCostPopover: React.FC<TotalCostPopoverProps> = ({
  totalCost,
  breakdown = {},
  desktopAlignment = 'center'
}) => {
  // Convertimos el desglose en array ordenado por monto descendente
  const categories: CostCategoryItem[] = Object.entries(breakdown)
    .filter(([_, amount]) => amount > 0)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <AnalysisPopover desktopAlignment={desktopAlignment}>
      <div className="p-4 sm:p-5">
        <div className="mb-3 sm:mb-4">
          <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">
            Costo Total
          </h4>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-orange-600 tracking-tight">
              ₡{totalCost.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-slate-100">
          <div>
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tight mb-1.5 sm:mb-2 block">
              Desglose de Costos
            </span>

            {categories.length === 0 ? (
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-100 text-center">
                <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 italic">
                  No hay gastos ni recargas registrados en este período.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-100">
                {categories.map(({ name, amount }) => (
                  <div key={name} className="flex justify-between items-center text-[10px] sm:text-[11px]">
                    <span className="text-slate-600 font-medium truncate pr-2">{name}</span>
                    <span className="font-bold text-slate-800 whitespace-nowrap">₡{amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="pt-1.5 border-t border-slate-200 mt-1 sm:mt-1.5 flex justify-between items-center">
                  <span className="text-[8px] sm:text-[9px] font-black text-slate-700 uppercase">TOTAL</span>
                  <span className="text-[11px] sm:text-[12px] font-black text-orange-600">₡{totalCost.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tight mb-1 block">
              Nota Informativa
            </span>
            <p className="text-[9px] sm:text-[10px] text-slate-500 leading-relaxed">
              El costo corresponde a los gastos y recargas registrados para esta unidad según el período y filtros seleccionados.
            </p>
          </div>
        </div>
      </div>
    </AnalysisPopover>
  );
};
