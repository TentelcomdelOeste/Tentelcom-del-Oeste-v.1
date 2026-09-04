import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User } from '../../../../types';
import { mockVehicles, mockWarehouseItems } from '../mockData';
import { ActionButton, DataTable, TableColumn, Select } from '../../../../design-system';
import { FiTruck, FiUploadCloud, FiSearch, FiX } from 'react-icons/fi';
import { VehicleWarehouseItem, VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { TransferToVehicleModal } from '../modals/TransferToVehicleModal';

interface Props {
  currentUser?: User | null;
  items?: VehicleWarehouseItem[];
  setItems?: React.Dispatch<React.SetStateAction<VehicleWarehouseItem[]>>;
  onRegisterMovement?: (movement: VehicleMovement) => void;
  selectedVehicleId?: string;
  onSelectVehicleId?: (id: string) => void;
  activeTab?: 'inventory' | 'requests' | 'movements' | 'reports';
  onTabChange?: (tab: 'inventory' | 'requests' | 'movements' | 'reports') => void;
}

export const VehicleInventoryTab: React.FC<Props> = ({
  currentUser,
  items: externalItems,
  setItems: externalSetItems,
  onRegisterMovement,
  selectedVehicleId: externalSelectedVehicleId,
  onSelectVehicleId,
  activeTab = 'inventory',
  onTabChange
}) => {
  // Local fallback if not provided by parent
  const [internalItems, setInternalItems] = useState<VehicleWarehouseItem[]>(mockWarehouseItems);
  const items = externalItems || internalItems;
  const setItems = externalSetItems || setInternalItems;

  const [internalVehicleId, setInternalVehicleId] = useState<string>(
    mockVehicles.length > 0 ? mockVehicles[0].id : ''
  );
  const selectedVehicleId = externalSelectedVehicleId ?? internalVehicleId;
  const setSelectedVehicleId = onSelectVehicleId ?? setInternalVehicleId;

  const [searchTerm, setSearchTerm] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Search logic states
  const [isMobileSearchFocused, setIsMobileSearchFocused] = useState(false);
  const [isDesktopSearchFocused, setIsDesktopSearchFocused] = useState(false);
  
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);

  // Clear search term when vehicle changes
  useEffect(() => {
    setSearchTerm('');
  }, [selectedVehicleId]);

  // Click outside handlers for search dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        setIsMobileSearchFocused(false);
      }
      if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target as Node)) {
        setIsDesktopSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedVehicle = useMemo(() => {
    return mockVehicles.find(v => v.id === selectedVehicleId) || mockVehicles[0];
  }, [selectedVehicleId]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (item.vehiculoId !== selectedVehicleId) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          item.code.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, selectedVehicleId, searchTerm]);

  const searchDropdownContent = (
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
      {filteredItems.length > 0 ? (
        filteredItems.map(m => (
          <button
            key={m.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSearchTerm(m.code);
              setIsMobileSearchFocused(false);
              setIsDesktopSearchFocused(false);
            }}
            className="w-full text-left p-2.5 border-b border-slate-100 last:border-b-0 hover:bg-blue-50 flex justify-between items-center transition-colors"
          >
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs font-bold text-slate-800 truncate">{m.code}</p>
              <p className="text-[11px] text-slate-600 truncate">{m.description}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
              {m.availableStock} {m.unit}
            </span>
          </button>
        ))
      ) : (
        <div className="p-3 text-xs text-slate-400 text-center">
          No se encontraron materiales.
        </div>
      )}
    </div>
  );

  const originItemsForModal = useMemo(() => {
    return items.filter(item => item.vehiculoId === selectedVehicleId);
  }, [items, selectedVehicleId]);

  const handleExecuteTransfer = ({
    originVehicleId,
    targetVehicleId,
    inventoryItemId,
    quantity
  }: {
    originVehicleId: string;
    targetVehicleId: string;
    inventoryItemId: string;
    quantity: number;
  }) => {
    const originItem = items.find(
      i => i.vehiculoId === originVehicleId && i.inventoryItemId === inventoryItemId
    );
    const originVeh = mockVehicles.find(v => v.id === originVehicleId);
    const targetVeh = mockVehicles.find(v => v.id === targetVehicleId);

    if (!originItem || !originVeh || !targetVeh) return;

    const availableToTransfer = originItem.physicalStock - originItem.committedStock;
    if (quantity <= 0 || quantity > availableToTransfer || originItem.physicalStock - quantity < 0) {
      alert('Operación no permitida: la cantidad excede la disponibilidad transferible.');
      return;
    }

    const previousOriginPhysical = originItem.physicalStock;
    const newOriginPhysical = originItem.physicalStock - quantity;

    // Update state
    setItems(prevItems => {
      const updated = [...prevItems];

      // 1. Descontar en vehículo origen
      const origIndex = updated.findIndex(
        i => i.vehiculoId === originVehicleId && i.inventoryItemId === inventoryItemId
      );
      if (origIndex >= 0) {
        const o = updated[origIndex];
        const newPhys = o.physicalStock - quantity;
        updated[origIndex] = {
          ...o,
          physicalStock: newPhys,
          committedStock: o.committedStock, // Mantiene intacto el stock comprometido
          availableStock: Math.max(0, newPhys - o.committedStock),
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.id || currentUser?.email || 'usuario'
        };
      }

      // 2. Aumentar en vehículo destino
      const destIndex = updated.findIndex(
        i => i.vehiculoId === targetVehicleId && i.inventoryItemId === inventoryItemId
      );
      if (destIndex >= 0) {
        const d = updated[destIndex];
        const newPhys = d.physicalStock + quantity;
        updated[destIndex] = {
          ...d,
          physicalStock: newPhys,
          availableStock: Math.max(0, newPhys - d.committedStock),
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.id || currentUser?.email || 'usuario'
        };
      } else {
        // Crear registro en destino si aún no existía
        const newItem: VehicleWarehouseItem = {
          id: `${targetVehicleId}_${originItem.inventoryItemId}`,
          vehiculoId: targetVehicleId,
          vehiculoPlaca: targetVeh.placa,
          vehiculoAlias: targetVeh.alias,
          inventoryItemId: originItem.inventoryItemId,
          code: originItem.code,
          description: originItem.description,
          category: originItem.category,
          unit: originItem.unit,
          physicalStock: quantity,
          committedStock: 0,
          availableStock: quantity,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.id || currentUser?.email || 'usuario'
        };
        updated.push(newItem);
      }

      return updated;
    });

    // 3. Registrar movimiento de trazabilidad
    if (onRegisterMovement) {
      const newMovement: VehicleMovement = {
        id: `mov-${Date.now()}`,
        movementNumber: `MOV-VEH-${Date.now().toString().slice(-4)}`,
        type: 'Traslado_Salida',
        vehiculoId: originVeh.id,
        vehiculoPlaca: originVeh.placa,
        targetVehiculoId: targetVeh.id,
        items: [
          {
            inventoryItemId: originItem.inventoryItemId,
            code: originItem.code,
            description: originItem.description,
            quantity: quantity,
            previousPhysicalStock: previousOriginPhysical,
            newPhysicalStock: newOriginPhysical,
            previousCommittedStock: originItem.committedStock,
            newCommittedStock: originItem.committedStock
          }
        ],
        date: new Date().toISOString().split('T')[0],
        reason: `Transferencia entre bodegas vehiculares: ${originVeh.alias} (${originVeh.placa}) → ${targetVeh.alias} (${targetVeh.placa})`,
        performedBy: currentUser?.id || 'usuario',
        performedByName: currentUser?.name || currentUser?.email || 'Usuario',
        createdAt: new Date().toISOString()
      };
      onRegisterMovement(newMovement);
    }
  };

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
      accessor: (item) => (
        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
          {item.category}
        </span>
      )
    },
    {
      header: 'Unidad',
      accessor: (item) => <span className="text-slate-500">{item.unit}</span>
    },
    {
      header: 'Físico (Real)',
      accessor: (item) => (
        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md">
          {item.physicalStock}
        </span>
      )
    },
    {
      header: 'Comprometido',
      accessor: (item) => (
        <span className="font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
          {item.committedStock}
        </span>
      )
    },
    {
      header: 'Disponible',
      accessor: (item) => (
        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
          {item.availableStock}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Controles Móvil: 2 Filas x 2 Columnas */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {/* Fila 1: Selector de Sección + Vehículo Seleccionado */}
        <div className="grid grid-cols-2 gap-2">
          <div className="w-full min-w-0">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
              Sección
            </label>
            <div className="relative">
              <select
                value={activeTab}
                onChange={(e) => onTabChange?.(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-7 truncate"
              >
                <option value="inventory">📦 Inventario por vehículo</option>
                <option value="requests">📋 Solicitudes de proyecto</option>
                <option value="movements">🔄 Historial de Movimientos</option>
                <option value="reports">📊 Reportes y Consumos</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          <div className="w-full min-w-0">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
              Vehículo Seleccionado
            </label>
            <div className="relative">
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-7 truncate"
              >
                {mockVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.displayName || v.alias}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Fila 2: Buscar Material + Traslado a Vehículo */}
        <div className="grid grid-cols-2 gap-2 items-end relative" ref={mobileSearchRef}>
          <div className="w-full min-w-0">
            <div className={`transition-all duration-200 ${isMobileSearchFocused ? 'absolute z-40 left-0 right-0 bg-white p-2 -m-2 rounded-xl shadow-lg border border-slate-100' : 'relative'}`}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                Buscar Material
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar código, descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsMobileSearchFocused(true)}
                  className="w-full p-2.5 pl-9 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none pr-8"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <FiSearch />
                </div>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title="Limpiar búsqueda"
                  >
                    <FiX />
                  </button>
                )}
              </div>
              {isMobileSearchFocused && searchDropdownContent}
            </div>
          </div>

          <div className="w-full min-w-0">
            <ActionButton
              label="Traslado a vehículo"
              icon={<FiUploadCloud />}
              variant="primary"
              onClick={() => setShowTransferModal(true)}
              className="w-full justify-center !text-xs !py-2.5 truncate"
            />
          </div>
        </div>
      </div>

      {/* Controles Desktop */}
      <div className="hidden md:flex md:items-end justify-between gap-3">
        <div className="flex items-end gap-3 flex-1 max-w-2xl">
          <div className="w-64">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Vehículo Seleccionado
            </label>
            <Select
              options={mockVehicles.map(v => ({
                value: v.id,
                label: v.displayName || v.alias
              }))}
              value={selectedVehicleId}
              onChange={(val) => setSelectedVehicleId(val)}
              placeholder="Buscar vehículo..."
            />
          </div>

          <div className="w-72 relative" ref={desktopSearchRef}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Buscar Material
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar código, descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsDesktopSearchFocused(true)}
                className="w-full p-2.5 pl-9 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none pr-8"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <FiSearch />
              </div>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title="Limpiar búsqueda"
                >
                  <FiX />
                </button>
              )}
            </div>
            {isDesktopSearchFocused && searchDropdownContent}
          </div>
        </div>

        <div>
          <ActionButton
            label="Traslado a Vehículo"
            icon={<FiUploadCloud />}
            variant="primary"
            onClick={() => setShowTransferModal(true)}
            className="justify-center"
          />
        </div>
      </div>

      {/* Tabla / Tarjetas de Inventario */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-100">
          No hay inventario registrado en la bodega del vehículo {selectedVehicle?.alias}.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              data={filteredItems}
              columns={columns}
              keyExtractor={(item) => item.id}
              emptyMessage="No hay inventario registrado en este vehículo."
            />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="mb-3">
                  <p className="font-bold text-slate-800 text-sm">{item.description}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="font-mono text-[10px] text-slate-500">
                      {item.code} • {item.category}
                    </p>
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

      {/* Modal de Transferencia entre Bodegas Vehiculares */}
      <TransferToVehicleModal
        show={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        originVehicle={selectedVehicle}
        originItems={originItemsForModal}
        allVehicles={mockVehicles}
        allItems={items}
        onTransfer={handleExecuteTransfer}
      />
    </div>
  );
};
