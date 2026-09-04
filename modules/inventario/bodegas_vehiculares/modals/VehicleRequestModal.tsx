import React, { useState } from 'react';
import { ActionButton } from '../../../../design-system';
import { FiX, FiCheck } from 'react-icons/fi';
import { mockVehicles, mockProjects, mockWarehouseItems } from '../mockData';
import { VehicleMaterialRequest } from '../../../../types/vehicleWarehouse.types';

interface Props {
  show: boolean;
  onClose: () => void;
  onSimulateCreate: (req: VehicleMaterialRequest) => void;
}

export const VehicleRequestModal: React.FC<Props> = ({ show, onClose, onSimulateCreate }) => {
  const [selectedVehicle, setSelectedVehicle] = useState(mockVehicles[0].id);
  const [selectedProject, setSelectedProject] = useState(mockProjects[0].id);

  if (!show) return null;

  const handleCreate = () => {
    const v = mockVehicles.find(x => x.id === selectedVehicle);
    const p = mockProjects.find(x => x.id === selectedProject);
    
    if (!v || !p) return;

    const newReq: VehicleMaterialRequest = {
      id: `req-${Date.now()}`,
      requestNumber: `SOL-VEH-000${Math.floor(Math.random() * 1000)}`,
      vehiculoId: v.id,
      vehiculoAlias: v.alias,
      vehiculoPlaca: v.placa,
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      responsibleId: 'sim-user',
      responsibleName: 'Usuario Simulado',
      status: 'Abierta',
      openedAt: new Date().toISOString(),
      items: [
        {
          inventoryItemId: 'item-1',
          code: 'CBL-UTP-CAT6',
          description: 'Cable UTP Cat 6 (Simulado)',
          unit: 'm',
          quantityCommitted: 20
        }
      ],
      additionsLog: [
        {
          additionId: `add-${Date.now()}`,
          date: new Date().toISOString(),
          addedBy: 'sim-user',
          addedByName: 'Usuario Simulado',
          items: [{ inventoryItemId: 'item-1', quantity: 20 }]
        }
      ],
      createdAt: new Date().toISOString(),
      createdBy: 'sim-user',
      updatedAt: new Date().toISOString(),
      updatedBy: 'sim-user'
    };

    onSimulateCreate(newReq);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800">Nueva Solicitud de Vehículo</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vehículo Origen</label>
            <select 
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {mockVehicles.map(v => (
                <option key={v.id} value={v.id}>{v.alias} - {v.placa}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Proyecto Destino</label>
            <select 
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {mockProjects.map(p => (
                <option key={p.id} value={p.id}>{p.code} | {p.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-sm text-slate-600">Al simular la creación, se añadirá automáticamente un ítem de prueba con 20 unidades comprometidas para demostrar la funcionalidad.</p>
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <ActionButton label="Cancelar" variant="secondary" onClick={onClose} />
          <ActionButton label="Crear Solicitud" icon={<FiCheck/>} variant="primary" onClick={handleCreate} />
        </div>
      </div>
    </div>
  );
};
