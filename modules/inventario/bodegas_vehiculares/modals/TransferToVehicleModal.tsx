import React, { useState } from 'react';
import { ActionButton, SearchInput } from '../../../../design-system';
import { FiX, FiCheck, FiArrowRight } from 'react-icons/fi';
import { mockVehicles } from '../mockData';
import { VehicleWarehouseItem } from '../../../../types/vehicleWarehouse.types';

interface Props {
  show: boolean;
  onClose: () => void;
  selectedVehicle?: typeof mockVehicles[0];
  onSimulateTransfer: (item: VehicleWarehouseItem) => void;
}

export const TransferToVehicleModal: React.FC<Props> = ({ show, onClose, selectedVehicle, onSimulateTransfer }) => {
  const [qty, setQty] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('item-4'); // Mock selected

  if (!show) return null;

  const handleTransfer = () => {
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) {
      alert("Ingrese una cantidad válida");
      return;
    }

    // Mock transfer
    const newItem: VehicleWarehouseItem = {
      id: `${selectedVehicle?.id}_${selectedMaterial}`,
      vehiculoId: selectedVehicle?.id || '',
      vehiculoPlaca: selectedVehicle?.placa || '',
      vehiculoAlias: selectedVehicle?.alias || '',
      inventoryItemId: selectedMaterial,
      code: 'MOCK-NEW-ITEM',
      description: 'Material Nuevo Transferido (Simulación)',
      category: 'Simulación',
      unit: 'und',
      physicalStock: Number(qty),
      committedStock: 0,
      availableStock: Number(qty),
      updatedAt: new Date().toISOString(),
      updatedBy: 'sim-user'
    };

    onSimulateTransfer(newItem);
    setQty('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800">Transferir a Vehículo</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl text-sm font-medium">
            <p><strong>Modo Simulación:</strong> Esta acción no descontará inventario real de la bodega principal. Es solo para demostrar el flujo visual.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vehículo Destino</label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700">
              {selectedVehicle?.alias} - {selectedVehicle?.placa}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Material (Simulado)</label>
            <select 
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="item-4">Tubería PVC 3/4" (Stock Bodega: 500 m)</option>
              <option value="item-5">Cinta Aislante (Stock Bodega: 120 und)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad a Transferir</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center"
              />
              <span className="text-slate-400 font-bold">Unidades</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500">Bodega Principal</p>
              <p className="text-lg font-black text-slate-700">- {qty || 0}</p>
            </div>
            <FiArrowRight className="text-2xl text-slate-300" />
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500">Vehículo {selectedVehicle?.alias}</p>
              <p className="text-lg font-black text-emerald-600">+ {qty || 0}</p>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <ActionButton label="Cancelar" variant="secondary" onClick={onClose} />
          <ActionButton label="Simular Transferencia" icon={<FiCheck/>} variant="primary" onClick={handleTransfer} />
        </div>
      </div>
    </div>
  );
};
