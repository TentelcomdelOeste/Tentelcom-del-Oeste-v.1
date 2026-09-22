import React from 'react';
import { ActionButton } from '../../../../design-system';
import { FiX, FiFileText } from 'react-icons/fi';
import { VehicleProjectConsumption } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface Props {
  show: boolean;
  consumption: VehicleProjectConsumption | null;
  onClose: () => void;
  onPdf?: () => void;
}

export const VehicleConsumptionDetailModal: React.FC<Props> = ({ show, consumption, onClose, onPdf }) => {
  if (!show || !consumption) return null;

  let closedAtDate = 'N/A';
  let closedAtTime = '';
  try {
    if (consumption.closedAt) {
      const d = new Date(consumption.closedAt);
      if (!isNaN(d.getTime())) {
        closedAtDate = format(d, 'dd/MM/yyyy');
        closedAtTime = format(d, 'HH:mm');
      }
    }
  } catch (e) {
    closedAtDate = consumption.closedAt || 'N/A';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]">
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FiFileText className="text-sm" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Reporte de Consumo</p>
              <p className="text-xs font-black text-slate-800 truncate leading-tight mt-0.5">{consumption.projectCode}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors shrink-0"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
              <FiFileText className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-tight">Reporte de Consumo y Liquidación</h2>
              <p className="text-xs text-slate-500 font-medium">Proyecto: <strong className="text-slate-700">{consumption.projectName}</strong> ({consumption.projectCode})</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 md:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 md:space-y-6">
          
          {/* Information Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4 bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-200/80">
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Proyecto</p>
              <p className="font-bold text-xs md:text-sm text-slate-800 truncate" title={consumption.projectName}>{consumption.projectName}</p>
              <p className="text-[10px] font-mono font-semibold text-blue-600">{consumption.projectCode}</p>
            </div>

            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Vehículo / Unidad</p>
              <p className="font-bold text-xs md:text-sm text-slate-800 truncate">{consumption.vehiculoAlias}</p>
            </div>

            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">N° Solicitud Ref.</p>
              <p className="font-bold text-xs md:text-sm text-blue-900 font-mono">{consumption.requestNumber || 'N/A'}</p>
            </div>

            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Fecha Cierre</p>
              <p className="font-semibold text-xs md:text-sm text-slate-700">{closedAtDate}</p>
              {closedAtTime && <p className="text-[10px] text-slate-400 font-medium">{closedAtTime} hs</p>}
            </div>

            <div className="col-span-2 md:col-span-2">
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Cerrado / Liquidado por</p>
              <p className="font-bold text-xs md:text-sm text-slate-800 truncate">{consumption.closedBy || consumption.responsibleName || 'Sistema'}</p>
            </div>
          </div>

          {/* Materials Section */}
          <div>
            <div className="flex items-center justify-between mb-2 md:mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">
                Materiales Liquidados
              </h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {consumption.items?.length || 0} ítems
              </span>
            </div>

            {!consumption.items || consumption.items.length === 0 ? (
              <p className="text-xs md:text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
                No hay ítems registrados en este consumo.
              </p>
            ) : (
              <div className="space-y-2">
                {consumption.items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/80">
                          {item.code}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {item.unit}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-slate-800 leading-snug">
                        {item.description || 'Sin descripción'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 justify-between md:justify-end">
                      {item.committed !== undefined && (
                        <div className="bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-center min-w-[65px]">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight block leading-none mb-0.5">Solicitado</span>
                          <span className="font-bold text-slate-700 text-xs">{item.committed}</span>
                        </div>
                      )}

                      <div className="bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg text-center min-w-[65px]">
                        <span className="text-[8px] font-bold text-blue-600 uppercase tracking-tight block leading-none mb-0.5">Consumido</span>
                        <span className="font-black text-blue-900 text-xs">{item.consumed}</span>
                      </div>

                      {item.surplus > 0 && (
                        <div className="bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-center min-w-[65px]">
                          <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tight block leading-none mb-0.5">Sobrante</span>
                          <span className="font-bold text-emerald-700 text-xs">+{item.surplus}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 md:p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <ActionButton 
            label="Cerrar" 
            variant="secondary" 
            onClick={onClose} 
            className="w-auto px-5" 
          />
          {onPdf && (
            <ActionButton 
              label="Generar PDF" 
              icon={<FiFileText className="text-sm" />} 
              variant="primary" 
              onClick={onPdf} 
              className="w-auto px-5" 
            />
          )}
        </div>
      </div>
    </div>
  );
};
