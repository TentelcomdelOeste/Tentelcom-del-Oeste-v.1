import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';
import { getVehicleCatalog, vehicleWarehouseService } from '../services/vehicleWarehouseService';
import { ActionButton } from '../../../../design-system';
import { FiRefreshCw, FiSearch, FiX, FiBox, FiChevronRight } from 'react-icons/fi';
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

      {/* Grilla de Tarjetas de Materiales */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
          No hay inventario registrado en {selectedVehicle?.alias || 'este vehículo'}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 animate-fade-in">
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 sm:p-3.5 flex flex-col justify-between hover:shadow-sm hover:border-slate-300 transition-all duration-200"
            >
              {/* AREA SUPERIOR: Imagen + Detalles del Material */}
              <div className="flex gap-3 items-start">
                {/* Espacio reservado para la imagen (limpio/neutral) */}
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center shrink-0">
                  <FiBox className="w-6 h-6 text-slate-300" />
                </div>

                {/* Detalles textuales */}
                <div className="flex-1 min-w-0">
                  {/* Fila superior: Código + Última Actualización */}
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="inline-block text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded leading-none shrink-0">
                      {item.code}
                    </span>
                    <div className="text-right text-[9px] text-slate-400 leading-tight">
                      <div className="font-medium">Últ. act. {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</div>
                      <div className="truncate max-w-[90px] sm:max-w-[110px] ml-auto font-normal text-slate-400" title={item.updatedBy}>
                        {item.updatedBy?.split('@')[0] || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Nombre/Descripción del Material */}
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight leading-snug mt-1 line-clamp-2" title={item.description}>
                    {item.description}
                  </h4>

                  {/* Categoría */}
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5 truncate">
                    {item.category}
                  </span>
                </div>
              </div>

              {/* Divisor delgado */}
              <div className="border-t border-slate-100 my-2.5" />

              {/* AREA INFERIOR: Indicadores de Cantidades */}
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  {/* Indicador 1: Stock */}
                  <div className="flex items-center min-w-0 shrink-0">
                    <FiBox className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="ml-1.5 leading-none">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stock</div>
                      <div className="text-xs sm:text-sm font-black text-slate-800 mt-0.5">
                        {item.physicalStock} <span className="text-[9px] text-slate-400 font-normal">{item.unit || 'Unid.'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Divisor Vertical */}
                  <div className="border-r border-slate-200 h-6 mx-2 sm:mx-3 shrink-0" />

                  {/* Indicador 2: Comprometido */}
                  <div className="flex items-center min-w-0 shrink-0">
                    <FiBox className="w-4 h-4 text-orange-500 shrink-0" />
                    <div className="ml-1.5 leading-none">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Comp.</div>
                      <div className="text-xs sm:text-sm font-black text-orange-600 mt-0.5">
                        {item.committedStock}
                      </div>
                    </div>
                  </div>

                  {/* Divisor Vertical */}
                  <div className="border-r border-slate-200 h-6 mx-2 sm:mx-3 shrink-0" />

                  {/* Indicador 3: Disponible */}
                  <div className="flex items-center min-w-0 shrink-0">
                    <FiBox className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="ml-1.5 leading-none">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Disp.</div>
                      <div className="text-xs sm:text-sm font-black text-emerald-600 mt-0.5">
                        {item.physicalStock - item.committedStock}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Icono de Navegación discreto */}
                <div className="text-slate-300 hover:text-slate-400 ml-2 shrink-0">
                  <FiChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
