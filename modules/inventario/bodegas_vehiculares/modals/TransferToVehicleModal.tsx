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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-full md:h-auto md:max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800">Transferir a Vehículo</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6 overflow-y-auto flex-1">
          
          <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl text-xs md:text-sm font-medium">
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
            <div className="relative">
              <select 
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="w-full p-4 md:p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none pr-10"
              >
                <option value="item-4">Tubería PVC 3/4" (Stock: 500 m)</option>
                <option value="item-5">Cinta Aislante (Stock: 120 und)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                ▼
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad a Transferir</label>
            <div className="flex flex-col gap-2">
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                className="w-full p-4 bg-white border border-slate-200 rounded-xl text-2xl font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-center w-1/3">
              <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-500 mb-1">Bodega</p>
              <p className="text-base md:text-lg font-black text-slate-700">- {qty || 0}</p>
            </div>
            <FiArrowRight className="text-xl md:text-2xl text-slate-300 w-1/3 text-center" />
            <div className="text-center w-1/3">
              <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-500 mb-1">Vehículo</p>
              <p className="text-base md:text-lg font-black text-emerald-600">+ {qty || 0}</p>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-end gap-3">
          <ActionButton label="Cancelar" variant="secondary" onClick={onClose} className="w-full md:w-auto justify-center order-2 md:order-1" />
          <ActionButton label="Confirmar Traslado" icon={<FiCheck/>} variant="primary" onClick={handleTransfer} className="w-full md:w-auto justify-center order-1 md:order-2" />
        </div>
      </div>
    </div>
  );
};
