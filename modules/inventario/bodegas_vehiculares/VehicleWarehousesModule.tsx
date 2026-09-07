import React, { useState, useEffect } from 'react';
import { ModulePage } from '../../../components/ui/ModulePage';
import { ActionButton } from '../../../design-system';
import { FiBox, FiClipboard, FiRefreshCw, FiPieChart } from 'react-icons/fi';
import { User } from '../../../types';
import { db } from '../../../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

import { VehicleInventoryTab } from './tabs/VehicleInventoryTab';
import { VehicleRequestsTab } from './tabs/VehicleRequestsTab';
import { VehicleMovementsTab } from './tabs/VehicleMovementsTab';
import { VehicleReportsTab } from './tabs/VehicleReportsTab';
import {
  VehicleWarehouseItem,
  VehicleMovement,
  VehicleMaterialRequest,
  VehicleProjectConsumption
} from '../../../types/vehicleWarehouse.types';
import { vehicleWarehouseService, getVehicleCatalog } from './services/vehicleWarehouseService';

interface VehicleWarehousesModuleProps {
  currentUser?: User | null;
}

const VehicleWarehousesModule: React.FC<VehicleWarehousesModuleProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'movements' | 'reports'>('inventory');
  
  const vehicles = getVehicleCatalog();
  const initialVehicleId = vehicles.length > 0 ? vehicles[0].id : '';

  // Shared state across the tabs
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicleId);
  const [items, setItems] = useState<VehicleWarehouseItem[]>([]);
  const [movements, setMovements] = useState<VehicleMovement[]>([]);
  const [requests, setRequests] = useState<VehicleMaterialRequest[]>([]);
  const [consumptions, setConsumptions] = useState<VehicleProjectConsumption[]>([]);

  useEffect(() => {
    // 1. Suscripción en tiempo real al inventario
    const unsubItems = onSnapshot(collection(db, 'vehicle_warehouse_items'), (snapshot) => {
      const firestoreItems: VehicleWarehouseItem[] = [];
      snapshot.forEach((docSnap) => {
        firestoreItems.push(docSnap.data() as VehicleWarehouseItem);
      });
      setItems(firestoreItems);
    }, (err) => {
      console.warn('Error suscribiendo a vehicle_warehouse_items:', err);
    });

    // 2. Suscripción en tiempo real a movimientos
    const movQuery = query(collection(db, 'vehicle_movements'), orderBy('createdAt', 'desc'));
    const unsubMovements = onSnapshot(movQuery, (snapshot) => {
      const firestoreMovements: VehicleMovement[] = [];
      snapshot.forEach((docSnap) => {
        firestoreMovements.push({ id: docSnap.id, ...docSnap.data() } as VehicleMovement);
      });
      setMovements(firestoreMovements);
    }, (err) => {
      console.warn('Error suscribiendo a vehicle_movements:', err);
    });

    // 3. Suscripción en tiempo real a solicitudes
    const reqQuery = query(collection(db, 'vehicle_material_requests'), orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(reqQuery, (snapshot) => {
      const firestoreRequests: VehicleMaterialRequest[] = [];
      snapshot.forEach((docSnap) => {
        firestoreRequests.push({ id: docSnap.id, ...docSnap.data() } as VehicleMaterialRequest);
      });
      setRequests(firestoreRequests);
    }, (err) => {
      console.warn('Error suscribiendo a vehicle_material_requests:', err);
    });

    // 4. Suscripción en tiempo real a consumos
    const consQuery = query(collection(db, 'vehicle_consumptions'), orderBy('closedAt', 'desc'));
    const unsubConsumptions = onSnapshot(consQuery, (snapshot) => {
      const firestoreCons = [];
      snapshot.forEach((docSnap) => {
        firestoreCons.push({ id: docSnap.id, ...docSnap.data() } as VehicleProjectConsumption);
      });
      setConsumptions(firestoreCons);
    }, (err) => {
      console.warn('Error suscribiendo a vehicle_consumptions:', err);
    });

    return () => {
      unsubItems();
      unsubMovements();
      unsubRequests();
      unsubConsumptions();
    };
  }, []);

  // Removed handleRegisterMovement as it's now handled by firestore
  const handleTransfer = async ({
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
    await vehicleWarehouseService.transferItem(
      originVehicleId,
      targetVehicleId,
      inventoryItemId,
      quantity,
      currentUser
    );
  };

  const handleMultipleTransfer = async ({
    originVehicleId,
    targetVehicleId,
    items
  }: {
    originVehicleId: string;
    targetVehicleId: string;
    items: { inventoryItemId: string; quantity: number }[];
  }) => {
    await vehicleWarehouseService.transferMultipleItems(
      originVehicleId,
      targetVehicleId,
      items,
      currentUser
    );
  };

  const handleCreateRequest = async (payload: any) => {
    await vehicleWarehouseService.createRequest(
      payload.vehiculoId,
      payload.projectId,
      payload.items,
      currentUser,
      payload.observations
    );
  };

  const handleUpdateRequest = async (payload: any) => {
    await vehicleWarehouseService.updateRequest(
      payload.requestId,
      payload.newItems,
      currentUser,
      payload.observations
    );
  };

  const handleCancelRequest = async (payload: { requestId: string; observations?: string }) => {
    await vehicleWarehouseService.cancelRequest(
      payload.requestId,
      currentUser,
      payload.observations
    );
  };

  const handleCloseRequest = async (payload: { requestId: string; usedItems: any[]; observations?: string }) => {
    await vehicleWarehouseService.closeRequest(
      payload.requestId,
      payload.usedItems,
      currentUser,
      payload.observations
    );
  };

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage
        title="Bodegas Vehiculares"
        subtitle="Gestión de inventario de flota y solicitudes por vehículo."
      >
        <div className="hidden md:flex items-center gap-2 mb-3 sm:mb-4">
          <ActionButton
            label="Inventario por Vehículo"
            icon={<FiBox />}
            variant={activeTab === 'inventory' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('inventory')}
            className={`whitespace-nowrap ${activeTab !== 'inventory' ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none' : ''}`}
          />
            <ActionButton
              label="Solicitudes de Proyecto"
              icon={<FiClipboard />}
              variant={activeTab === 'requests' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('requests')}
              className={`whitespace-nowrap ${activeTab !== 'requests' ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none' : ''}`}
            />
            <ActionButton
              label="Historial de Movimientos"
              icon={<FiRefreshCw />}
              variant={activeTab === 'movements' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('movements')}
              className={`whitespace-nowrap ${activeTab !== 'movements' ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none' : ''}`}
            />
            <ActionButton
              label="Reportes y Consumos"
              icon={<FiPieChart />}
              variant={activeTab === 'reports' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('reports')}
              className={`whitespace-nowrap ${activeTab !== 'reports' ? 'text-slate-500 bg-transparent hover:bg-slate-100 border-transparent shadow-none' : ''}`}
            />
          </div>

        <div>
          {activeTab === 'inventory' && (
            <VehicleInventoryTab
              currentUser={currentUser}
              items={items}
              onTransfer={handleTransfer}
              onMultipleTransfer={handleMultipleTransfer}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicleId={setSelectedVehicleId}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}

          {activeTab === 'requests' && (
            <VehicleRequestsTab
              currentUser={currentUser}
              selectedVehicleId={selectedVehicleId}
              requests={requests}
              items={items}
              onCreateRequest={handleCreateRequest}
              onUpdateRequest={handleUpdateRequest}
              onCancelRequest={handleCancelRequest}
              onCloseRequest={handleCloseRequest}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}

          {activeTab === 'movements' && (
            <VehicleMovementsTab
              currentUser={currentUser}
              movements={movements}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}

          {activeTab === 'reports' && (
            <VehicleReportsTab
              currentUser={currentUser}
              consumptions={consumptions}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </div>
      </ModulePage>
    </div>
  );
};

export default VehicleWarehousesModule;
