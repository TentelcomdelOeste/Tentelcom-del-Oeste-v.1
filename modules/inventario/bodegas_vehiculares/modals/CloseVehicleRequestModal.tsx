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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-800">CERRAR SOLICITUD</h2>
            <p className="text-xs text-slate-500 font-bold">{request.projectName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1">
          <div className="bg-amber-50 border border-amber-100 text-amber-800 p-4 rounded-xl text-xs md:text-sm font-medium mb-6">
            <p>Indique la cantidad <strong>REALMENTE UTILIZADA</strong> por cada material. El sobrante volverá a estar disponible en el vehículo.</p>
          </div>

          <div className="space-y-4">
            {request.items.map(item => {
              const used = usedQuantities[item.inventoryItemId] ?? 0;
              const surplus = item.quantityCommitted - used;

              return (
                <div key={item.inventoryItemId} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-4">
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{item.description}</p>
                    <p className="text-[10px] font-mono text-slate-500">{item.code}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-white p-2 rounded-lg border border-slate-100">
                      <p className="text-[9px] uppercase font-bold text-slate-500">Solicitado</p>
                      <p className="text-sm font-black text-slate-700">{item.quantityCommitted} {item.unit}</p>
                    </div>

                    <div className="text-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                      <p className="text-[9px] uppercase font-bold text-blue-600 mb-1">Utilizado</p>
                      <input
                        type="number"
                        min={0}
                        max={item.quantityCommitted}
                        value={used}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(item.quantityCommitted, Number(e.target.value)));
                          setUsedQuantities(prev => ({ ...prev, [item.inventoryItemId]: val }));
                        }}
                        className="w-full p-2 bg-white border border-slate-300 rounded text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="text-center bg-white p-2 rounded-lg border border-slate-100">
                      <p className="text-[9px] uppercase font-bold text-slate-500">Sobrante</p>
                      <p className={`text-sm font-black ${surplus > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {surplus} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Resumen de Cierre</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 mb-1">CONSUMO FINAL</p>
                {request.items.map(item => {
                  const used = usedQuantities[item.inventoryItemId] ?? 0;
                  if (used === 0) return null;
                  return <p key={`cons-${item.inventoryItemId}`} className="text-xs font-bold text-slate-800">{used} {item.unit} <span className="text-slate-500 font-normal truncate inline-block max-w-[80px] align-bottom">{item.description}</span></p>
                })}
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 mb-1">SOBRANTES</p>
                {request.items.map(item => {
                  const used = usedQuantities[item.inventoryItemId] ?? 0;
                  const surplus = item.quantityCommitted - used;
                  if (surplus === 0) return null;
                  return <p key={`surp-${item.inventoryItemId}`} className="text-xs font-bold text-emerald-700">{surplus} {item.unit} <span className="opacity-75 font-normal truncate inline-block max-w-[80px] align-bottom">{item.description}</span></p>
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-end gap-3">
          <ActionButton label="Cancelar" variant="secondary" onClick={onClose} className="w-full md:w-auto justify-center order-2 md:order-1" />
          <ActionButton label="CONFIRMAR CIERRE" icon={<FiCheck/>} variant="primary" onClick={handleClose} className="w-full md:w-auto justify-center order-1 md:order-2" />
        </div>
      </div>
    </div>
  );
};
