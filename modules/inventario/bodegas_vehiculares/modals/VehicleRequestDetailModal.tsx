import React from 'react';
import { ActionButton, StatusBadge } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { FiX, FiCheckCircle } from 'react-icons/fi';
import { VehicleMaterialRequest } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

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
      <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
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

        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Materiales Comprometidos</h3>
            {request.items.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-slate-100">No hay materiales en esta solicitud.</p>
            ) : (
              <div className="space-y-3">
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
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col-reverse md:flex-row justify-between gap-3">
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
