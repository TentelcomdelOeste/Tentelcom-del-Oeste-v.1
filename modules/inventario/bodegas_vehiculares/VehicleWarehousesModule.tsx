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
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage title="Bodegas Vehiculares" subtitle="Gestión de inventario de flota y solicitudes por vehículo.">
        {/* Navegación por pestañas */}
        <div className="flex gap-4 mb-6 border-b border-slate-200 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-2 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === 'inventory'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Inventario por Vehículo
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-2 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === 'requests'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Solicitudes
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`pb-2 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === 'movements'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Movimientos
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-2 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === 'reports'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Reportes y Consumos
          </button>
        </div>

        {/* Contenido de la pestaña */}
        <div>
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
      </ModulePage>
    </div>
  );
};

export default VehicleWarehousesModule;
