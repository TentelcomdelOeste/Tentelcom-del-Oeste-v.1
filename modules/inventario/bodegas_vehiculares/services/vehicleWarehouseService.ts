import {
  VehicleWarehouseItem,
  VehicleMovement,
  VehicleMaterialRequest,
  VehicleProjectConsumption,
  VehicleProjectConsumptionItem
} from '../../../../types/vehicleWarehouse.types';
import { mockVehicles } from '../mockData';

export const vehicleWarehouseService = {
  // 1. Transfer item between vehicles
  transferItem(
    items: VehicleWarehouseItem[],
    movements: VehicleMovement[],
    originVehicleId: string,
    targetVehicleId: string,
    inventoryItemId: string,
    quantity: number,
    currentUser?: { id: string; name?: string; email?: string } | null
  ): { items: VehicleWarehouseItem[]; movements: VehicleMovement[] } {
    if (quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0.');
    }
    if (originVehicleId === targetVehicleId) {
      throw new Error('El vehículo de origen y destino no pueden ser el mismo.');
    }

    const originItemIndex = items.findIndex(
      i => i.vehiculoId === originVehicleId && i.inventoryItemId === inventoryItemId
    );

    if (originItemIndex === -1) {
      throw new Error('El material no existe en el vehículo de origen.');
    }

    const originItem = items[originItemIndex];
    const available = originItem.physicalStock - originItem.committedStock;

    if (quantity > available) {
      throw new Error(`Cantidad (${quantity}) supera el stock disponible transferible (${available} ${originItem.unit}).`);
    }

    const targetVeh = mockVehicles.find(v => v.id === targetVehicleId);
    const originVeh = mockVehicles.find(v => v.id === originVehicleId);

    const now = new Date().toISOString();
    const userName = currentUser?.name || currentUser?.email || 'Usuario Sistema';
    const userId = currentUser?.id || 'system';

    const newItems = [...items];

    // Update origin item
    const updatedOriginPhysical = originItem.physicalStock - quantity;
    const updatedOriginAvailable = updatedOriginPhysical - originItem.committedStock;
    if (updatedOriginAvailable < 0 || updatedOriginPhysical < 0) {
      throw new Error('La transferencia generaría inventario o disponibilidad negativa en origen.');
    }

    newItems[originItemIndex] = {
      ...originItem,
      physicalStock: updatedOriginPhysical,
      availableStock: updatedOriginAvailable,
      updatedAt: now,
      updatedBy: userName
    };

    // Update or create target item
    const targetItemIndex = newItems.findIndex(
      i => i.vehiculoId === targetVehicleId && i.inventoryItemId === inventoryItemId
    );

    if (targetItemIndex !== -1) {
      const targetItem = newItems[targetItemIndex];
      const updatedTargetPhysical = targetItem.physicalStock + quantity;
      const updatedTargetAvailable = updatedTargetPhysical - targetItem.committedStock;
      newItems[targetItemIndex] = {
        ...targetItem,
        physicalStock: updatedTargetPhysical,
        availableStock: updatedTargetAvailable,
        updatedAt: now,
        updatedBy: userName
      };
    } else {
      const newItemId = `${targetVehicleId}_${inventoryItemId}`;
      newItems.push({
        id: newItemId,
        vehiculoId: targetVehicleId,
        vehiculoPlaca: targetVeh?.placa || 'PLACA',
        vehiculoAlias: targetVeh?.alias || targetVeh?.name || 'Vehículo',
        inventoryItemId,
        code: originItem.code,
        description: originItem.description,
        category: originItem.category,
        unit: originItem.unit,
        physicalStock: quantity,
        committedStock: 0,
        availableStock: quantity,
        updatedAt: now,
        updatedBy: userName
      });
    }

    const movementNumber = `MOV-${Math.floor(100000 + Math.random() * 900000)}`;

    const transferMovement: VehicleMovement = {
      id: `mov-${Date.now()}`,
      movementNumber,
      type: 'Traslado_Entre_Vehiculos',
      vehiculoId: originVehicleId,
      vehiculoPlaca: originVeh?.alias || originVeh?.placa || originVehicleId,
      targetVehiculoId: targetVehicleId,
      targetVehiculoPlaca: targetVeh?.alias || targetVeh?.placa || targetVehicleId,
      items: [
        {
          inventoryItemId,
          code: originItem.code,
          description: originItem.description,
          quantity,
          previousPhysicalStock: originItem.physicalStock,
          newPhysicalStock: updatedOriginPhysical,
          previousCommittedStock: originItem.committedStock,
          newCommittedStock: originItem.committedStock
        }
      ],
      date: now,
      reason: `Traslado de ${originVeh?.alias || originVehicleId} hacia ${targetVeh?.alias || targetVehicleId}`,
      performedBy: userId,
      performedByName: userName,
      createdAt: now
    };

    const newMovements = [transferMovement, ...movements];

    return { items: newItems, movements: newMovements };
  },

  // 2. Create Request (Commit stock)
  createRequest(
    requests: VehicleMaterialRequest[],
    items: VehicleWarehouseItem[],
    newRequest: VehicleMaterialRequest
  ): { requests: VehicleMaterialRequest[]; items: VehicleWarehouseItem[] } {
    const newItems = [...items];
    const vehiculoId = newRequest.vehiculoId;

    for (const reqItem of newRequest.items) {
      const idx = newItems.findIndex(
        i => i.vehiculoId === vehiculoId && i.inventoryItemId === reqItem.inventoryItemId
      );
      if (idx !== -1) {
        const current = newItems[idx];
        const newCommitted = current.committedStock + reqItem.quantityCommitted;
        const newAvailable = current.physicalStock - newCommitted;
        if (newAvailable < 0) {
          throw new Error(`Stock insuficiente para comprometer ${reqItem.quantityCommitted} de ${reqItem.code}. Disponible: ${current.availableStock}`);
        }
        newItems[idx] = {
          ...current,
          committedStock: newCommitted,
          availableStock: newAvailable
        };
      } else {
        throw new Error(`El material ${reqItem.code} no existe en el inventario del vehículo seleccionado.`);
      }
    }

    const updatedRequests = [newRequest, ...requests];
    return { requests: updatedRequests, items: newItems };
  },

  // 3. Update Request
  updateRequest(
    requests: VehicleMaterialRequest[],
    items: VehicleWarehouseItem[],
    updatedRequest: VehicleMaterialRequest
  ): { requests: VehicleMaterialRequest[]; items: VehicleWarehouseItem[] } {
    const oldRequest = requests.find(r => r.id === updatedRequest.id);
    const newItems = [...items];

    // Release old commitment if it was open
    if (oldRequest && oldRequest.status === 'Abierta') {
      for (const oldItem of oldRequest.items) {
        const idx = newItems.findIndex(
          i => i.vehiculoId === oldRequest.vehiculoId && i.inventoryItemId === oldItem.inventoryItemId
        );
        if (idx !== -1) {
          const current = newItems[idx];
          const newCommitted = Math.max(0, current.committedStock - oldItem.quantityCommitted);
          newItems[idx] = {
            ...current,
            committedStock: newCommitted,
            availableStock: current.physicalStock - newCommitted
          };
        }
      }
    }

    // Apply new commitment if open
    if (updatedRequest.status === 'Abierta') {
      for (const reqItem of updatedRequest.items) {
        const idx = newItems.findIndex(
          i => i.vehiculoId === updatedRequest.vehiculoId && i.inventoryItemId === reqItem.inventoryItemId
        );
        if (idx !== -1) {
          const current = newItems[idx];
          const newCommitted = current.committedStock + reqItem.quantityCommitted;
          const newAvailable = current.physicalStock - newCommitted;
          if (newAvailable < 0) {
            throw new Error(`Stock insuficiente para comprometer ${reqItem.quantityCommitted} de ${reqItem.code}.`);
          }
          newItems[idx] = {
            ...current,
            committedStock: newCommitted,
            availableStock: newAvailable
          };
        } else {
          throw new Error(`El material ${reqItem.code} no existe en el inventario del vehículo.`);
        }
      }
    }

    const updatedRequests = requests.map(r => (r.id === updatedRequest.id ? updatedRequest : r));
    return { requests: updatedRequests, items: newItems };
  },

  // 4. Cancel Request
  cancelRequest(
    requests: VehicleMaterialRequest[],
    items: VehicleWarehouseItem[],
    requestId: string
  ): { requests: VehicleMaterialRequest[]; items: VehicleWarehouseItem[] } {
    const req = requests.find(r => r.id === requestId);
    if (!req) return { requests, items };

    const newItems = [...items];
    if (req.status === 'Abierta') {
      for (const reqItem of req.items) {
        const idx = newItems.findIndex(
          i => i.vehiculoId === req.vehiculoId && i.inventoryItemId === reqItem.inventoryItemId
        );
        if (idx !== -1) {
          const current = newItems[idx];
          const newCommitted = Math.max(0, current.committedStock - reqItem.quantityCommitted);
          newItems[idx] = {
            ...current,
            committedStock: newCommitted,
            availableStock: current.physicalStock - newCommitted
          };
        }
      }
    }

    const updatedRequests = requests.map(r => (r.id === requestId ? { ...r, status: 'Cancelada' as const } : r));
    return { requests: updatedRequests, items: newItems };
  },

  // 5. Close Request (Liquidation / Consumption)
  closeRequest(
    requests: VehicleMaterialRequest[],
    items: VehicleWarehouseItem[],
    consumptions: VehicleProjectConsumption[],
    movements: VehicleMovement[],
    closedRequest: VehicleMaterialRequest,
    currentUser?: { id: string; name?: string; email?: string } | null
  ): {
    requests: VehicleMaterialRequest[];
    items: VehicleWarehouseItem[];
    consumptions: VehicleProjectConsumption[];
    movements: VehicleMovement[];
  } {
    const newItems = [...items];
    const vehiculoId = closedRequest.vehiculoId;
    const now = new Date().toISOString();
    const userName = currentUser?.name || currentUser?.email || closedRequest.closedByName || 'Usuario';
    const userId = currentUser?.id || closedRequest.closedBy || 'system';

    const consumptionItems: VehicleProjectConsumptionItem[] = [];
    const movementItems = [];

    for (const reqItem of closedRequest.items) {
      const used = reqItem.quantityUsed ?? 0;
      const committed = reqItem.quantityCommitted;
      const surplus = reqItem.quantitySurplus ?? (committed - used);

      const idx = newItems.findIndex(
        i => i.vehiculoId === vehiculoId && i.inventoryItemId === reqItem.inventoryItemId
      );

      if (idx !== -1) {
        const current = newItems[idx];
        const newPhysical = Math.max(0, current.physicalStock - used);
        const newCommitted = Math.max(0, current.committedStock - committed);
        const newAvailable = newPhysical - newCommitted;

        newItems[idx] = {
          ...current,
          physicalStock: newPhysical,
          committedStock: newCommitted,
          availableStock: newAvailable,
          updatedAt: now,
          updatedBy: userName
        };

        consumptionItems.push({
          inventoryItemId: reqItem.inventoryItemId,
          code: reqItem.code,
          description: reqItem.description,
          unit: reqItem.unit,
          committed,
          consumed: used,
          surplus
        });

        if (used > 0) {
          movementItems.push({
            inventoryItemId: reqItem.inventoryItemId,
            code: reqItem.code,
            description: reqItem.description,
            quantity: used,
            previousPhysicalStock: current.physicalStock,
            newPhysicalStock: newPhysical,
            previousCommittedStock: current.committedStock,
            newCommittedStock: newCommitted
          });
        }
      }
    }

    const newConsumption: VehicleProjectConsumption = {
      id: `cons-${Date.now()}`,
      requestId: closedRequest.id,
      requestNumber: closedRequest.requestNumber,
      projectId: closedRequest.projectId,
      projectCode: closedRequest.projectCode,
      projectName: closedRequest.projectName,
      vehiculoId: closedRequest.vehiculoId,
      vehiculoAlias: closedRequest.vehiculoAlias,
      responsibleId: closedRequest.responsibleId,
      responsibleName: closedRequest.responsibleName,
      closedAt: now,
      closedBy: userId,
      items: consumptionItems,
      totalItemsConsumed: consumptionItems.reduce((acc, ci) => acc + ci.consumed, 0)
    };

    const newMovement: VehicleMovement = {
      id: `mov-${Date.now()}-cons`,
      movementNumber: `MOV-${Math.floor(100000 + Math.random() * 900000)}`,
      type: 'Consumo_Proyecto',
      vehiculoId: closedRequest.vehiculoId,
      vehiculoPlaca: closedRequest.vehiculoPlaca,
      requestId: closedRequest.id,
      projectId: closedRequest.projectId,
      projectName: closedRequest.projectName,
      items: movementItems,
      date: now,
      reason: `Consumo por cierre de solicitud ${closedRequest.requestNumber} - Proyecto ${closedRequest.projectCode}`,
      performedBy: userId,
      performedByName: userName,
      createdAt: now
    };

    const updatedRequests = requests.map(r => (r.id === closedRequest.id ? closedRequest : r));
    const updatedConsumptions = [newConsumption, ...consumptions];
    const updatedMovements = movementItems.length > 0 ? [newMovement, ...movements] : movements;

    return {
      requests: updatedRequests,
      items: newItems,
      consumptions: updatedConsumptions,
      movements: updatedMovements
    };
  }
};
