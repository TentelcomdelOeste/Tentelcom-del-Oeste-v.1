import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';
import { mockVehicles, mockWarehouseItems } from '../mockData';
import { ActionButton, DataTable, TableColumn, SearchInput } from '../../../../design-system';
import { FiTruck, FiUploadCloud } from 'react-icons/fi';
import { VehicleWarehouseItem } from '../../../../types/vehicleWarehouse.types';
import { TransferToVehicleModal } from '../modals/TransferToVehicleModal';

interface Props {
  currentUser?: User | null;
}

export const VehicleInventoryTab: React.FC<Props> = ({ currentUser }) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(mockVehicles[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Mock state to allow simulating transfers visually without touching DB
  const [localItems, setLocalItems] = useState<VehicleWarehouseItem[]>(mockWarehouseItems);

  const selectedVehicle = mockVehicles.find(v => v.id === selectedVehicleId);

  const filteredItems = useMemo(() => {
    return localItems.filter(item => {
      if (item.vehiculoId !== selectedVehicleId) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return item.code.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [localItems, selectedVehicleId, searchTerm]);

  const columns: TableColumn<VehicleWarehouseItem>[] = [
    {
      header: 'Código',
      accessor: (item) => <span className="font-mono text-xs text-slate-500">{item.code}</span>
    },
    {
      header: 'Descripción',
      accessor: 'description'
    },
    {
      header: 'Categoría',
      accessor: (item) => <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">{item.category}</span>
    },
    {
      header: 'Unidad',
      accessor: (item) => <span className="text-slate-500">{item.unit}</span>
    },
    {
      header: 'Físico (Real)',
      accessor: (item) => (
        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md">{item.physicalStock}</span>
      )
    },
    {
      header: 'Comprometido',
      accessor: (item) => (
        <span className="font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">{item.committedStock}</span>
      )
    },
    {
      header: 'Disponible',
      accessor: (item) => (
        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{item.availableStock}</span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Selector de Vehículo y Acciones */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
          {mockVehicles.map(v => (
            <button
              key={v.id}
              onClick={() => setSelectedVehicleId(v.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all whitespace-nowrap
                ${selectedVehicleId === v.id 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <FiTruck className={selectedVehicleId === v.id ? 'text-white' : 'text-slate-400'} />
              {v.alias} - {v.placa}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            label="Traslado a Vehículo"
            icon={<FiUploadCloud />}
            variant="primary"
            onClick={() => setShowTransferModal(true)}
          />
        </div>
      </div>

      {/* Resumen del Vehículo Seleccionado */}
      {selectedVehicle && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">Inventario: {selectedVehicle.alias}</h3>
            <p className="text-sm text-slate-500 font-medium">Placa: {selectedVehicle.placa}</p>
          </div>
          <div className="flex flex-wrap gap-4">
             <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center min-w-[120px]">
               <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Total Ítems</p>
               <p className="text-2xl font-black text-slate-800 mt-1">{filteredItems.length}</p>
             </div>
             <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center min-w-[120px]">
               <p className="text-[10px] uppercase font-black text-emerald-600 tracking-wider">Con Disponible</p>
               <p className="text-2xl font-black text-emerald-700 mt-1">{filteredItems.filter(i => i.availableStock > 0).length}</p>
             </div>
          </div>
        </div>
      )}

      {/* Tabla de Inventario */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por código o descripción..."
          />
        </div>
        <div className="flex-1 overflow-auto">
          <DataTable
            data={filteredItems}
            columns={columns}
            keyExtractor={(item) => item.id}
            emptyMessage="No hay inventario registrado en este vehículo."
          />
        </div>
      </div>

      <TransferToVehicleModal 
        show={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        selectedVehicle={selectedVehicle}
        onSimulateTransfer={(newItem) => {
          setLocalItems(prev => {
            const existsIndex = prev.findIndex(i => i.id === newItem.id);
            if (existsIndex >= 0) {
              const clone = [...prev];
              clone[existsIndex] = {
                ...clone[existsIndex],
                physicalStock: clone[existsIndex].physicalStock + newItem.physicalStock,
                availableStock: clone[existsIndex].availableStock + newItem.physicalStock
              };
              return clone;
            }
            return [...prev, newItem];
          });
        }}
      />

    </div>
  );
};
