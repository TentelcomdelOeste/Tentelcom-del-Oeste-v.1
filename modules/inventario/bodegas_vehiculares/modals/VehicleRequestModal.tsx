import React, { useState, useEffect } from 'react';
import { ActionButton, IconButton } from '../../../../design-system';
import { FiX, FiCheck, FiPlus, FiTrash2 } from 'react-icons/fi';
import { mockVehicles, mockProjects, mockWarehouseItems } from '../mockData';
import { VehicleMaterialRequest } from '../../../../types/vehicleWarehouse.types';

interface Props {
  show: boolean;
  onClose: () => void;
  onSave: (req: VehicleMaterialRequest) => void;
  initialData?: VehicleMaterialRequest;
}

export const VehicleRequestModal: React.FC<Props> = ({ show, onClose, onSave, initialData }) => {
  const [selectedVehicle, setSelectedVehicle] = useState(mockVehicles[0].id);
  const [selectedProject, setSelectedProject] = useState(mockProjects[0].id);
  
  // state for items
  const [items, setItems] = useState<{
    id: string;
    inventoryItemId: string;
    quantity: number;
  }[]>([]);

  useEffect(() => {
    if (show) {
      if (initialData) {
        setSelectedVehicle(initialData.vehiculoId);
        setSelectedProject(initialData.projectId);
        setItems(initialData.items.map((i, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantityCommitted
        })));
      } else {
        setSelectedVehicle(mockVehicles[0].id);
        setSelectedProject(mockProjects[0].id);
        setItems([]);
      }
    }
  }, [show, initialData]);

  const availableMaterials = mockWarehouseItems.filter(i => i.vehiculoId === selectedVehicle);

  const handleAddItem = () => {
    setItems([...items, {
      id: `item-${Date.now()}`,
      inventoryItemId: availableMaterials.length > 0 ? availableMaterials[0].inventoryItemId : '',
      quantity: 1
    }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: 'inventoryItemId' | 'quantity', value: any) => {
    setItems(items.map(i => {
      if (i.id === id) {
        const updated = { ...i, [field]: value };
        // Ensure quantity doesn't exceed available stock
        if (field === 'inventoryItemId' || field === 'quantity') {
          const mat = availableMaterials.find(m => m.inventoryItemId === updated.inventoryItemId);
          if (mat) {
            // In a real app we'd need to consider if we are editing an existing item, 
            // the available stock includes the previously committed amount. 
            // For mock purposes we will just check availableStock.
            const max = mat.availableStock + (initialData?.items.find(x => x.inventoryItemId === mat.inventoryItemId)?.quantityCommitted || 0);
            if (updated.quantity > max) updated.quantity = max;
          }
        }
        return updated;
      }
      return i;
    }));
  };

  const handleSave = () => {
    const v = mockVehicles.find(x => x.id === selectedVehicle);
    const p = mockProjects.find(x => x.id === selectedProject);
    
    if (!v || !p) return;

    // Map items back to request items
    const requestItems = items.map(i => {
      const mat = mockWarehouseItems.find(m => m.inventoryItemId === i.inventoryItemId);
      if (!mat) return null;
      return {
        inventoryItemId: i.inventoryItemId,
        code: mat.code,
        description: mat.description,
        unit: mat.unit,
        quantityCommitted: i.quantity
      };
    }).filter(Boolean) as any[];

    if (initialData) {
      const updatedReq = {
        ...initialData,
        vehiculoId: v.id,
        vehiculoAlias: v.alias,
        vehiculoPlaca: v.placa,
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        items: requestItems,
        updatedAt: new Date().toISOString()
      };
      onSave(updatedReq);
    } else {
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
        items: requestItems,
        additionsLog: [
          {
            additionId: `add-${Date.now()}`,
            date: new Date().toISOString(),
            addedBy: 'sim-user',
            addedByName: 'Usuario Simulado',
            items: requestItems.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantityCommitted }))
          }
        ],
        createdAt: new Date().toISOString(),
        createdBy: 'sim-user',
        updatedAt: new Date().toISOString(),
        updatedBy: 'sim-user'
      };
      onSave(newReq);
    }
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[95vh] md:h-auto md:max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800">{initialData ? 'Editar Solicitud' : 'Nueva Solicitud'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vehículo Origen</label>
              <div className="relative">
                <select 
                  value={selectedVehicle}
                  onChange={(e) => {
                    setSelectedVehicle(e.target.value);
                    setItems([]); // Reset items when vehicle changes because inventory changes
                  }}
                  className="w-full p-4 md:p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-10"
                >
                  {mockVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.alias} - {v.placa}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Proyecto Destino</label>
              <div className="relative">
                <select 
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full p-4 md:p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-10"
                >
                  {mockProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.code} | {p.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Materiales Asignados</h3>
              <ActionButton label="Agregar Material" icon={<FiPlus/>} variant="primary" onClick={handleAddItem} className="!text-[10px] !px-2 md:!text-xs md:!px-3" />
            </div>

            {items.length === 0 ? (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed text-center">
                <p className="text-sm font-medium text-slate-500">Agregue los materiales que necesita asignar al proyecto.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const currentMat = availableMaterials.find(m => m.inventoryItemId === item.inventoryItemId);
                  const maxAvail = currentMat ? currentMat.availableStock + (initialData?.items.find(x => x.inventoryItemId === currentMat.inventoryItemId)?.quantityCommitted || 0) : 0;
                  
                  return (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3 shadow-sm">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Material</label>
                        <select
                          value={item.inventoryItemId}
                          onChange={(e) => handleItemChange(item.id, 'inventoryItemId', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500 truncate"
                        >
                          <option value="" disabled>Seleccione un material...</option>
                          {availableMaterials.map(m => (
                            <option key={m.id} value={m.inventoryItemId}>
                              {m.code} - {m.description}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            max={maxAvail}
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="w-24 pb-2 text-[9px] font-bold text-slate-400 text-center">
                          Disp: <span className="text-slate-700">{maxAvail}</span>
                        </div>
                        <div className="pb-1">
                          <IconButton icon={<FiTrash2/>} variant="danger" onClick={() => handleRemoveItem(item.id)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-end gap-3">
          <ActionButton label="Cancelar" variant="secondary" onClick={onClose} className="w-full md:w-auto justify-center order-2 md:order-1" />
          <ActionButton label={initialData ? "Guardar Cambios" : "Crear Solicitud"} icon={<FiCheck/>} variant="primary" onClick={handleSave} className="w-full md:w-auto justify-center order-1 md:order-2" />
        </div>
      </div>
    </div>
  );
};
