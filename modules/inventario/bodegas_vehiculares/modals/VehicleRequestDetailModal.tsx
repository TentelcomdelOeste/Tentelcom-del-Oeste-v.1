import React from 'react';
import { ActionButton, StatusBadge } from '../../../../design-system';
import { FiX, FiCheckCircle } from 'react-icons/fi';
import { VehicleMaterialRequest } from '../../../../types/vehicleWarehouse.types';

interface Props {
  show: boolean;
  request: VehicleMaterialRequest | null;
  onClose: () => void;
  onEdit: () => void;
  onCloseRequest: () => void;
}

export const VehicleRequestDetailModal: React.FC<Props> = ({ show, request, onClose, onEdit, onCloseRequest }) => {
  if (!show || !request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh]">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Detalle:</span>
            <span className="text-xs font-black text-slate-800 truncate">{request.requestNumber}</span>
            <StatusBadge 
              status={request.status} 
              variant={request.status === 'Abierta' ? 'warning' : 'success'} 
              className="!py-0.5 !px-1.5 !text-[8px]"
            />
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors shrink-0">
            <FiX className="text-base" />
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-800">{request.requestNumber}</h2>
            <p className="text-xs text-slate-500 font-medium">Detalle de Solicitud</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge 
              status={request.status} 
              variant={request.status === 'Abierta' ? 'warning' : 'success'} 
            />
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
              <FiX className="text-lg" />
            </button>
          </div>
        </div>

        <div className="p-3 md:p-6 overflow-y-auto flex-1 space-y-3 md:space-y-6">
          {/* Desktop Only Details (Proyecto & Vehículo Origen) */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proyecto</p>
              <p className="font-bold text-sm text-slate-700">{request.projectCode}</p>
              <p className="text-xs text-slate-600">{request.projectName}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vehículo Origen</p>
              <p className="font-bold text-sm text-slate-700">{request.vehiculoAlias}</p>
              <p className="text-xs text-slate-600">{request.vehiculoPlaca}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-1.5 md:mb-3 border-b border-slate-100 pb-1.5">
              Materiales Comprometidos
            </h3>
            {request.items.length === 0 ? (
              <p className="text-xs md:text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-slate-100">No hay materiales en esta solicitud.</p>
            ) : (
              <>
                {/* Mobile list view */}
                <div className="block md:hidden space-y-1.5">
                  {request.items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[11px] text-slate-900 leading-tight mb-1 truncate">
                          {item.description}
                        </p>
                        <span className="font-mono text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {item.code}
                        </span>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg text-right shrink-0 min-w-[75px]">
                        <span className="text-[8px] font-bold text-amber-500 uppercase tracking-tight block leading-none mb-0.5">Comprometido</span>
                        <span className="font-black text-amber-700 text-xs">
                          {item.quantityCommitted} <span className="text-[9px] font-black uppercase">{item.unit}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop list view */}
                <div className="hidden md:block space-y-3">
                  {request.items.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm">
                      <div>
                        <p className="font-bold text-sm text-slate-800">{item.description}</p>
                        <p className="text-[10px] font-mono text-slate-500">{item.code}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg text-center md:text-right">
                        <p className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">Comprometido</p>
                        <p className="font-black text-amber-700 text-sm">{item.quantityCommitted} <span className="text-xs font-bold uppercase">{item.unit}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Actions Footer */}
        <div className="md:hidden p-2 border-t border-slate-100 bg-slate-50/50 flex flex-row items-center justify-end gap-1.5">
          <ActionButton 
            label="Cerrar Vista" 
            variant="secondary" 
            onClick={onClose} 
            className="!py-1 !px-2.5 !text-[10px] !font-bold !uppercase !rounded-lg shrink-0" 
          />
          {request.status === 'Abierta' && (
            <>
              <ActionButton 
                label="Editar" 
                variant="primary" 
                onClick={onEdit} 
                className="!py-1 !px-2.5 !text-[10px] !font-bold !uppercase !rounded-lg shrink-0" 
              />
              <ActionButton 
                label="Liquidar" 
                icon={<FiCheckCircle className="text-[10px]" />} 
                variant="secondary" 
                onClick={onCloseRequest}
                className="!py-1 !px-2.5 !text-[10px] !font-bold !uppercase !rounded-lg text-emerald-600 hover:bg-emerald-50 border-emerald-200 shrink-0" 
              />
            </>
          )}
        </div>

        {/* Desktop Actions Footer */}
        <div className="hidden md:flex p-4 border-t border-slate-100 bg-slate-50/50 flex-col-reverse md:flex-row justify-between gap-3">
          <ActionButton label="Cerrar Vista" variant="secondary" onClick={onClose} className="w-full md:w-auto justify-center" />
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {request.status === 'Abierta' && (
              <>
                <ActionButton label="Editar Solicitud" variant="primary" onClick={onEdit} className="w-full md:w-auto justify-center" />
                <ActionButton 
                  label="Cerrar y Liquidar" 
                  icon={<FiCheckCircle/>} 
                  variant="secondary" 
                  onClick={onCloseRequest}
                  className="w-full md:w-auto justify-center text-emerald-600 hover:bg-emerald-50 border-emerald-200" 
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
