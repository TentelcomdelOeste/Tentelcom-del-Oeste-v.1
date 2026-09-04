import React, { useState } from 'react';
import { ModulePage } from '../../../components/ui/ModulePage';
import { ActionButton } from '../../../design-system';
import { FiBox, FiClipboard, FiRefreshCw, FiPieChart } from 'react-icons/fi';
import { User } from '../../../types';

import { VehicleInventoryTab } from './tabs/VehicleInventoryTab';
import { VehicleRequestsTab } from './tabs/VehicleRequestsTab';
import { VehicleMovementsTab } from './tabs/VehicleMovementsTab';
import { VehicleReportsTab } from './tabs/VehicleReportsTab';
import {
  mockWarehouseItems,
  mockMovements,
  mockMaterialRequests,
  mockConsumptions
} from './mockData';
import {
  VehicleWarehouseItem,
  VehicleMovement,
  VehicleMaterialRequest,
  VehicleProjectConsumption
} from '../../../types/vehicleWarehouse.types';

interface VehicleWarehousesModuleProps {
  currentUser?: User | null;
}

const VehicleWarehousesModule: React.FC<VehicleWarehousesModuleProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'movements' | 'reports'>('inventory');

  // Shared state across the tabs
  const [items, setItems] = useState<VehicleWarehouseItem[]>(mockWarehouseItems);
  const [movements, setMovements] = useState<VehicleMovement[]>(mockMovements);
  const [requests, setRequests] = useState<VehicleMaterialRequest[]>(mockMaterialRequests);
  const [consumptions, setConsumptions] = useState<VehicleProjectConsumption[]>(mockConsumptions);

  const handleRegisterMovement = (newMov: VehicleMovement) => {
    setMovements(prev => [newMov, ...prev]);
  };

  return (
    <ModulePage title="Bodegas Vehiculares" subtitle="Gestión de inventario de flota y solicitudes por vehículo.">
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200">
        {/* Navegación por pestañas: Dropdown en móvil, Botones en desktop */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50">
          <div className="block md:hidden relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-10"
            >
              <option value="inventory">📦 Inventario por vehículo</option>
              <option value="requests">📋 Solicitudes de proyecto</option>
              <option value="movements">🔄 Historial de Movimientos</option>
              <option value="reports">📊 Reportes y Consumos</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <ActionButton
              label="Inventario por Vehículo"
              icon={<FiBox />}
              variant={activeTab === 'inventory' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('inventory')}
              className={`whitespace-nowrap ${
                activeTab !== 'inventory'
                  ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'
                  : ''
              }`}
            />
            <ActionButton
              label="Solicitudes de Proyecto"
              icon={<FiClipboard />}
              variant={activeTab === 'requests' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('requests')}
              className={`whitespace-nowrap ${
                activeTab !== 'requests'
                  ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'
                  : ''
              }`}
            />
            <ActionButton
              label="Historial de Movimientos"
              icon={<FiRefreshCw />}
              variant={activeTab === 'movements' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('movements')}
              className={`whitespace-nowrap ${
                activeTab !== 'movements'
                  ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'
                  : ''
              }`}
            />
            <ActionButton
              label="Reportes y Consumos"
              icon={<FiPieChart />}
              variant={activeTab === 'reports' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('reports')}
              className={`whitespace-nowrap ${
                activeTab !== 'reports'
                  ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'
                  : ''
              }`}
            />
          </div>
        </div>

        {/* Contenido de la pestaña */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-slate-50/30">
          {activeTab === 'inventory' && (
            <VehicleInventoryTab
              currentUser={currentUser}
              items={items}
              setItems={setItems}
              onRegisterMovement={handleRegisterMovement}
            />
          )}
          {activeTab === 'requests' && (
            <VehicleRequestsTab
              currentUser={currentUser}
            />
          )}
          {activeTab === 'movements' && (
            <VehicleMovementsTab
              currentUser={currentUser}
              movements={movements}
            />
          )}
          {activeTab === 'reports' && (
            <VehicleReportsTab
              currentUser={currentUser}
            />
          )}
        </div>
      </div>
    </ModulePage>
  );
};

export default VehicleWarehousesModule;
