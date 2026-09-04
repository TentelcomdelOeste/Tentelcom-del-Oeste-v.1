import React, { useState } from 'react';
import { ModulePage } from '../../../components/ui/ModulePage';
import { ActionButton } from '../../../design-system';
import { FiBox, FiClipboard, FiRefreshCw, FiPieChart } from 'react-icons/fi';
import { User } from '../../../types';

import { VehicleInventoryTab } from './tabs/VehicleInventoryTab';
import { VehicleRequestsTab } from './tabs/VehicleRequestsTab';
import { VehicleMovementsTab } from './tabs/VehicleMovementsTab';
import { VehicleReportsTab } from './tabs/VehicleReportsTab';

interface VehicleWarehousesModuleProps {
  currentUser?: User | null;
}

const VehicleWarehousesModule: React.FC<VehicleWarehousesModuleProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'movements' | 'reports'>('inventory');

  return (
    <ModulePage title="Bodegas Vehiculares" subtitle="Gestión de inventario de flota y solicitudes por vehículo.">
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200">
        
        {/* Navegación por pestañas */}
        <div className="flex items-center overflow-x-auto border-b border-slate-100 bg-slate-50/50 p-2 gap-2 custom-scrollbar">
          <ActionButton
            label="Inventario por Vehículo"
            icon={<FiBox />}
            variant={activeTab === 'inventory' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('inventory')}
            className={`whitespace-nowrap ${activeTab !== 'inventory' && 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'}`}
          />
          <ActionButton
            label="Solicitudes de Proyecto"
            icon={<FiClipboard />}
            variant={activeTab === 'requests' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('requests')}
            className={`whitespace-nowrap ${activeTab !== 'requests' && 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'}`}
          />
          <ActionButton
            label="Historial de Movimientos"
            icon={<FiRefreshCw />}
            variant={activeTab === 'movements' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('movements')}
            className={`whitespace-nowrap ${activeTab !== 'movements' && 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'}`}
          />
          <ActionButton
            label="Reportes y Consumos"
            icon={<FiPieChart />}
            variant={activeTab === 'reports' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('reports')}
            className={`whitespace-nowrap ${activeTab !== 'reports' && 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none'}`}
          />
        </div>

        {/* Contenido de la pestaña */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30">
          {activeTab === 'inventory' && <VehicleInventoryTab currentUser={currentUser} />}
          {activeTab === 'requests' && <VehicleRequestsTab currentUser={currentUser} />}
          {activeTab === 'movements' && <VehicleMovementsTab currentUser={currentUser} />}
          {activeTab === 'reports' && <VehicleReportsTab currentUser={currentUser} />}
        </div>
      </div>
    </ModulePage>
  );
};

export default VehicleWarehousesModule;
