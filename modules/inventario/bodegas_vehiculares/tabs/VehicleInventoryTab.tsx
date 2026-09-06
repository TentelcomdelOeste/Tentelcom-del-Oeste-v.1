import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';
import { getVehicleCatalog } from '../services/vehicleWarehouseService';
import { ActionButton, DataTable, TableColumn } from '../../../../design-system';
import { FiUploadCloud, FiSearch, FiX } from 'react-icons/fi';
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
  selectedVehicleId?: string;
  onSelectVehicleId?: (id: string) => void;
  activeTab?: 'inventory' | 'requests' | 'movements' | 'reports';
  onTabChange?: (tab: 'inventory' | 'requests' | 'movements' | 'reports') => void;
}

export const VehicleInventoryTab: React.FC<Props> = ({
  currentUser: _currentUser,
  items: externalItems,
  onTransfer,
  selectedVehicleId: externalSelectedVehicleId,
  onSelectVehicleId,
  activeTab: _activeTab = 'inventory',
  onTabChange: _onTabChange
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
        item.description.toLowerCase().includes(lower)
      );
    }
    
    return result;
  }, [items, selectedVehicleId, searchTerm]);

  // Modals state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferItem, setTransferItem] = useState<VehicleWarehouseItem | null>(null);

  const handleOpenTransfer = (item: VehicleWarehouseItem) => {
    setTransferItem(item);
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = async (targetVehicleId: string, quantity: number) => {
    if (transferItem && onTransfer && selectedVehicleId) {
      await onTransfer({
        originVehicleId: selectedVehicleId,
        targetVehicleId,
        inventoryItemId: transferItem.inventoryItemId,
        quantity
      });
      setShowTransferModal(false);
      setTransferItem(null);
    }
  };

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
            <span className="text-orange-600 font-medium" title="Comprometido">
              ({item.committedStock})
            </span>
            <span className="text-emerald-600 font-bold" title="Disponible">
              Disp: {item.availableStock}
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
          <span className="text-[11px] text-slate-600">{new Date(item.updatedAt).toLocaleDateString()}</span>
          <span className="text-[9px] text-slate-400">{item.updatedBy?.split('@')[0]}</span>
        </div>
      )
    },
    {
      header: '',
      accessor: 'id',
      mobileGrid: 'right',
      mobileOrder: 4,
      render: (item) => (
        <ActionButton
          label="Transferir"
          icon={<FiUploadCloud />}
          variant="outline"
          size="sm"
          onClick={() => handleOpenTransfer(item)}
          disabled={item.availableStock <= 0}
        />
      )
    }
  ], []);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
        <div className="w-full sm:w-64">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Unidad / Vehículo
          </label>
          <div className="relative">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-10"
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.alias} ({v.placa})</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        </div>
        
        <div className="w-full sm:w-72">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
              >
                <FiX />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          data={filteredItems}
          columns={columns}
          keyField="id"
          emptyMessage={`No hay inventario registrado en ${selectedVehicle?.alias || 'este vehículo'}.`}
        />
      </div>

      {showTransferModal && transferItem && selectedVehicle && (
        <TransferToVehicleModal
          show={showTransferModal}
          onClose={() => {
            setShowTransferModal(false);
            setTransferItem(null);
          }}
          item={transferItem}
          originItems={items.filter(i => i.vehiculoId === selectedVehicle.id)}
          originVehicle={selectedVehicle}
          allVehicles={vehicles}
          allItems={items}
          onConfirm={handleConfirmTransfer}
          onTransfer={async (data) => {
            if (onTransfer) {
              await onTransfer(data);
            }
            setShowTransferModal(false);
            setTransferItem(null);
          }}
        />
      )}
    </div>
  );
};
