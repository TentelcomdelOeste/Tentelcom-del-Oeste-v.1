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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="w-full md:w-1/3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vehículo Seleccionado</label>
          <div className="relative">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full p-3 pl-10 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              {mockVehicles.map(v => (
                <option key={v.id} value={v.id}>{v.alias} - {v.placa}</option>
              ))}
            </select>
            <FiTruck className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 text-lg" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto mt-2 md:mt-0">
          <ActionButton
            label="Traslado a Vehículo"
            icon={<FiUploadCloud />}
            variant="primary"
            onClick={() => setShowTransferModal(true)}
            className="w-full md:w-auto justify-center"
          />
        </div>
      </div>

      {/* Tabla/Tarjetas de Inventario */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-3 border-b border-slate-100 bg-slate-50/50">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar material..."
          />
        </div>
        <div className="flex-1 overflow-auto bg-slate-50/30 p-2 md:p-0">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium">No hay inventario registrado.</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block h-full">
                <DataTable
                  data={filteredItems}
                  columns={columns}
                  keyExtractor={(item) => item.id}
                  emptyMessage="No hay inventario registrado en este vehículo."
                />
              </div>

              {/* Mobile Cards */}
              <div className="flex flex-col gap-2 md:hidden">
                {filteredItems.map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="mb-3">
                      <p className="font-bold text-slate-800 text-sm">{item.description}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="font-mono text-[10px] text-slate-500">{item.code} • {item.category}</p>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{item.unit}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-2">
                      <div className="text-center">
                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Físico</p>
                        <p className="text-sm font-black text-slate-700">{item.physicalStock}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] uppercase font-bold text-amber-500 mb-0.5">Comprom.</p>
                        <p className="text-sm font-black text-amber-600">{item.committedStock}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] uppercase font-bold text-emerald-500 mb-0.5">Disponib.</p>
                        <p className="text-sm font-black text-emerald-600">{item.availableStock}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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
