import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';
import { getVehicleCatalog, vehicleWarehouseService } from '../services/vehicleWarehouseService';
import { ActionButton, DataTable, TableColumn } from '../../../../design-system';
import { FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import { VehicleWarehouseItem, VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { TransferToVehicleModal } from '../modals/TransferToVehicleModal';

interface Props {
  currentUser?: User | null;
  items?: VehicleWarehouseItem[];
  setItems?: React.Dispatch<React.SetStateAction<VehicleWarehouseItem[]>>;
  onRegisterMovement?: (movement: VehicleMovement) => void;
  onTransfer?: (data: {
    originVehicleId: string;
    targetVehicleId: string;
    inventoryItemId: string;
    quantity: number;
  }) => void;
  onMultipleTransfer?: (data: {
    originVehicleId: string;
    targetVehicleId: string;
    items: { inventoryItemId: string; quantity: number }[];
  }) => Promise<void>;
  selectedVehicleId?: string;
  onSelectVehicleId?: (id: string) => void;
  activeTab?: 'inventory' | 'requests' | 'movements' | 'reports';
  onTabChange?: (tab: 'inventory' | 'requests' | 'movements' | 'reports') => void;
}

export const VehicleInventoryTab: React.FC<Props> = ({
  currentUser,
  items: externalItems,
  onTransfer,
  onMultipleTransfer,
  selectedVehicleId: externalSelectedVehicleId,
  onSelectVehicleId,
  activeTab = 'inventory',
  onTabChange
}) => {
  const items = externalItems || [];
  const vehicles = getVehicleCatalog();
  const selectedVehicleId = externalSelectedVehicleId || (vehicles.length > 0 ? vehicles[0].id : '');

  const setSelectedVehicleId = onSelectVehicleId || (() => {});

  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  }, [selectedVehicleId, vehicles]);

  const filteredItems = useMemo(() => {
    let result = items.filter(item => item.vehiculoId === selectedVehicleId);
    
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.code.toLowerCase().includes(lower) || 
        item.description.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower)
      );
    }
    
    return result;
  }, [items, selectedVehicleId, searchTerm]);

  // Modal state for multiple transfer
  const [showTransferModal, setShowTransferModal] = useState(false);

  const columns = useMemo<TableColumn<VehicleWarehouseItem>[]>(() => [
    {
      header: 'Código',
      accessor: 'code',
      mobileGrid: 'left',
      mobileOrder: 1,
      render: (item) => (
        <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
          {item.code}
        </span>
      )
    },
    {
      header: 'Material / Descripción',
      accessor: 'description',
      mobileGrid: 'full',
      mobileOrder: 2,
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-[12px] font-semibold text-slate-900 leading-tight">{item.description}</span>
          <span className="text-[10px] text-slate-500">{item.category}</span>
        </div>
      )
    },
    {
      header: 'Stock',
      accessor: 'physicalStock',
      mobileGrid: 'right',
      mobileOrder: 3,
      render: (item) => (
        <div className="flex flex-col items-end">
          <span className="text-[14px] font-bold text-slate-800">
            {item.physicalStock} <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
          </span>
          <div className="flex items-center gap-2 text-[10px] mt-0.5">
            <span className="text-orange-600 font-medium" title="Comprometido en solicitudes abiertas">
              Comp: {item.committedStock}
            </span>
            <span className="text-emerald-600 font-bold" title="Disponible real para transferir o consumir">
              Disp: {item.physicalStock - item.committedStock}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Última Act.',
      accessor: 'updatedAt',
      hideOnMobile: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-600">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</span>
          <span className="text-[9px] text-slate-400">{item.updatedBy?.split('@')[0] || '-'}</span>
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Controls Container Header Box */}
      <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2 sm:space-y-2.5">
        
        {/* ROW 1: SELECTOR DE SECCIÓN + SELECTOR DE UNIDAD */}
        <div className="grid grid-cols-2 md:flex md:justify-end gap-2 sm:gap-3">
          {/* Selector de Sección (Mobile) */}
          <div className="relative min-w-0 block md:hidden">
            <select
              value={activeTab}
              onChange={(e) => onTabChange && onTabChange(e.target.value as any)}
              className="w-full p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 sm:pr-7 truncate"
            >
              <option value="inventory">📦 Inventario</option>
              <option value="requests">📋 Solicitudes</option>
              <option value="movements">🔄 Movimientos</option>
              <option value="reports">📊 Reportes</option>
            </select>
            <div className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px] sm:text-xs">
              ▼
            </div>
          </div>

          {/* Selector de Unidad / Vehículo */}
          <div className="relative min-w-0 md:w-72">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 sm:pr-7 truncate"
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.alias} ({v.placa})
                </option>
              ))}
            </select>
            <div className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px] sm:text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* ROW 2: BÚSQUEDA + BOTÓN TRANSFERIR */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Buscador de Material */}
          <div className="relative flex-1 min-w-0">
            <FiSearch className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 sm:pl-9 pr-7 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
              >
                <FiX className="text-xs" />
              </button>
            )}
          </div>

          {/* Botón Transferir */}
          <ActionButton
            label="TRANSFERIR"
            icon={<FiRefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            variant="primary"
            onClick={() => setShowTransferModal(true)}
            className="!w-auto flex-none shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap text-xs sm:text-sm rounded-lg shadow-sm"
          />
        </div>
      </div>

      {/* Inventory Table directly below */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          data={filteredItems}
          columns={columns}
          keyField="id"
          emptyMessage={`No hay inventario registrado en ${selectedVehicle?.alias || 'este vehículo'}.`}
        />
      </div>

      {/* Multiple Transfer Modal */}
      {showTransferModal && (
        <TransferToVehicleModal
          show={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          defaultOriginVehicleId={selectedVehicleId}
          allVehicles={vehicles}
          allItems={items}
          currentUser={currentUser}
          onConfirmTransfer={async (data) => {
            if (onMultipleTransfer) {
              await onMultipleTransfer(data);
            } else if (onTransfer) {
              await vehicleWarehouseService.transferMultipleItems(
                data.originVehicleId,
                data.targetVehicleId,
                data.items,
                currentUser
              );
            } else {
              await vehicleWarehouseService.transferMultipleItems(
                data.originVehicleId,
                data.targetVehicleId,
                data.items,
                currentUser
              );
            }
            setShowTransferModal(false);
          }}
        />
      )}
    </div>
  );
};
