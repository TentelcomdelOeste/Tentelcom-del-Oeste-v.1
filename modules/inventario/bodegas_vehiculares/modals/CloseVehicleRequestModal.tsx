import React, { useState } from 'react';
import { ActionButton } from '../../../../design-system';
import { FiX, FiCheck } from 'react-icons/fi';
import { VehicleMaterialRequest } from '../../../../types/vehicleWarehouse.types';

interface Props {
  show: boolean;
  request: VehicleMaterialRequest;
  onClose: () => void;
  onSimulateClose: (updatedReq: VehicleMaterialRequest) => void;
}

export const CloseVehicleRequestModal: React.FC<Props> = ({ show, request, onClose, onSimulateClose }) => {
  const [usedQuantities, setUsedQuantities] = useState<Record<string, number>>(
    request.items.reduce((acc, item) => ({ ...acc, [item.inventoryItemId]: item.quantityCommitted }), {})
  );

  if (!show) return null;

  const handleClose = () => {
    // Validate
    for (const item of request.items) {
      const used = usedQuantities[item.inventoryItemId] ?? 0;
      if (used < 0 || used > item.quantityCommitted) {
        alert(`Cantidad utilizada inválida para ${item.code}. Debe estar entre 0 y ${item.quantityCommitted}.`);
        return;
      }
    }

    const updatedReq: VehicleMaterialRequest = {
      ...request,
      status: 'Cerrada',
      closedAt: new Date().toISOString(),
      closedBy: 'sim-user',
      closedByName: 'Usuario Simulado',
      items: request.items.map(item => {
        const used = usedQuantities[item.inventoryItemId] ?? 0;
        return {
          ...item,
          quantityUsed: used,
          quantitySurplus: item.quantityCommitted - used
        };
      })
    };

    onSimulateClose(updatedReq);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-800">Cerrar y Liquidar Solicitud</h2>
            <p className="text-xs text-slate-500 font-bold">{request.requestNumber} - {request.projectName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="bg-amber-50 border border-amber-100 text-amber-800 p-4 rounded-xl text-sm font-medium mb-6">
            <p><strong>Cierre Definitivo:</strong> Indique la cantidad <strong>REALMENTE UTILIZADA</strong> por cada material. El sobrante volverá a estar disponible en el vehículo automáticamente.</p>
          </div>

          <div className="space-y-4">
            {request.items.map(item => {
              const used = usedQuantities[item.inventoryItemId] ?? 0;
              const surplus = item.quantityCommitted - used;

              return (
                <div key={item.inventoryItemId} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-slate-700">{item.code}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-500">Solicitado</p>
                      <p className="text-sm font-black text-slate-700">{item.quantityCommitted} {item.unit}</p>
                    </div>

                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Utilizado Real</p>
                      <input
                        type="number"
                        min={0}
                        max={item.quantityCommitted}
                        value={used}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(item.quantityCommitted, Number(e.target.value)));
                          setUsedQuantities(prev => ({ ...prev, [item.inventoryItemId]: val }));
                        }}
                        className="w-20 p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center"
                      />
                    </div>

                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-500">Sobrante</p>
                      <p className={`text-sm font-black ${surplus > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {surplus} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <ActionButton label="Cancelar" variant="secondary" onClick={onClose} />
          <ActionButton label="Confirmar Cierre" icon={<FiCheck/>} variant="primary" onClick={handleClose} />
        </div>
      </div>
    </div>
  );
};
