import { db, auth } from '@/firebase';
import { collection, doc, runTransaction, deleteDoc } from 'firebase/firestore';
import {
  VehicleWarehouseItem,
  VehicleMovement,
  VehicleMovementItem,
  VehicleMaterialRequest,
  VehicleProjectConsumption
} from '@/types/vehicleWarehouse.types';
import { VEHICLES } from '@/modules/job_scheduling/JobForm';
import { extraerPlaca } from '@/types/vehicle.types';

export const AUTHORIZED_VEHICLE_DELETE_EMAIL = 'jenamorado@tentelcom.com';

export const isVehicleDeleteAuthorized = (user?: { email?: string | null } | null): boolean => {
  const emailFromProp = user?.email?.toLowerCase().trim();
  const emailFromAuth = typeof auth !== 'undefined' && auth.currentUser?.email ? auth.currentUser.email.toLowerCase().trim() : undefined;
  return emailFromProp === AUTHORIZED_VEHICLE_DELETE_EMAIL.toLowerCase() || emailFromAuth === AUTHORIZED_VEHICLE_DELETE_EMAIL.toLowerCase();
};

export const BODEGA_EXCLUDED_VEHICLES = ['U3', 'U7'];

export const formatVehicleOptionLabel = (label: string): string => {
  const parts = label.split(' - ');
  if (parts.length >= 2) {
    return `${parts[0].trim()} - ${parts[1].trim()}`;
  }
  return label;
};

export const getVehicleCatalog = () => {
  return VEHICLES
    .filter(v => !BODEGA_EXCLUDED_VEHICLES.includes(v.value))
    .map(v => {
      const displayLabel = formatVehicleOptionLabel(v.label);
      return {
        id: v.value,
        placa: extraerPlaca(v.label) || v.label,
        alias: displayLabel,
        displayName: displayLabel,
        label: displayLabel,
        name: displayLabel
      };
    });
};

export const vehicleWarehouseService = {
  // 1. Transfer item between vehicles
  async transferItem(
    originVehicleId: string,
    targetVehicleId: string,
    inventoryItemId: string,
    quantity: number,
    currentUser?: { id: string; name?: string; email?: string } | null
  ): Promise<void> {
    return this.transferMultipleItems(
      originVehicleId,
      targetVehicleId,
      [{ inventoryItemId, quantity }],
      currentUser
    );
  },

  // 1b. Transfer multiple items between vehicles
  async transferMultipleItems(
    originVehicleId: string,
    targetVehicleId: string,
    transferItems: { inventoryItemId: string; quantity: number }[],
    currentUser?: { id: string; name?: string; email?: string } | null,
    reason?: string
  ): Promise<void> {
    if (!transferItems || transferItems.length === 0) {
      throw new Error('Debe incluir al menos un material para transferir.');
    }
    if (originVehicleId === targetVehicleId) {
      throw new Error('El vehículo de origen y destino no pueden ser el mismo.');
    }

    const vehicles = getVehicleCatalog();
    const originVeh = vehicles.find(v => v.id === originVehicleId);
    const targetVeh = vehicles.find(v => v.id === targetVehicleId);
    
    if (!originVeh || !targetVeh) throw new Error("Vehículos no encontrados en el catálogo");

    const movementRef = doc(collection(db, 'vehicle_movements'));
    const now = new Date().toISOString();
    const userName = currentUser?.name || currentUser?.email || 'Usuario Sistema';
    const userId = currentUser?.id || 'system';

    await runTransaction(db, async (transaction) => {
      const movementItems: VehicleMovementItem[] = [];

      for (const item of transferItems) {
        if (item.quantity <= 0) {
          throw new Error('Todas las cantidades a transferir deben ser mayores a 0.');
        }

        const originDocRef = doc(db, 'vehicle_warehouse_items', `${originVehicleId}_${item.inventoryItemId}`);
        const targetDocRef = doc(db, 'vehicle_warehouse_items', `${targetVehicleId}_${item.inventoryItemId}`);

        const originSnap = await transaction.get(originDocRef);
        if (!originSnap.exists()) {
          throw new Error(`El material no existe en la bodega de origen (${originVeh.alias}).`);
        }

        const originData = originSnap.data() as VehicleWarehouseItem;
        const availableReal = originData.physicalStock - originData.committedStock;

        if (item.quantity > availableReal) {
          throw new Error(
            `No hay suficiente stock disponible para transferir "${originData.description}" (${originData.code}). ` +
            `Físico: ${originData.physicalStock}, Comprometido: ${originData.committedStock}, Disponible real: ${availableReal} ${originData.unit}. ` +
            `Cantidad solicitada: ${item.quantity}. La disponibilidad de inventario ha cambiado.`
          );
        }

        const targetSnap = await transaction.get(targetDocRef);
        
        const newOriginPhysical = originData.physicalStock - item.quantity;
        const newOriginAvailable = newOriginPhysical - originData.committedStock;

        if (newOriginPhysical < 0) {
          throw new Error(`La transferencia generaría inventario físico negativo para ${originData.code}.`);
        }

        transaction.update(originDocRef, {
          physicalStock: newOriginPhysical,
          availableStock: newOriginAvailable,
          updatedAt: now,
          updatedBy: currentUser?.email || 'Usuario Sistema'
        });

        if (targetSnap.exists()) {
          const targetData = targetSnap.data() as VehicleWarehouseItem;
          const newTargetPhysical = targetData.physicalStock + item.quantity;
          const newTargetAvailable = newTargetPhysical - targetData.committedStock;

          transaction.update(targetDocRef, {
            physicalStock: newTargetPhysical,
            availableStock: newTargetAvailable,
            updatedAt: now,
            updatedBy: currentUser?.email || 'Usuario Sistema'
          });
        } else {
          const newTargetItem: VehicleWarehouseItem = {
            id: `${targetVehicleId}_${item.inventoryItemId}`,
            vehiculoId: targetVehicleId,
            vehiculoPlaca: targetVeh.placa,
            vehiculoAlias: targetVeh.alias,
            inventoryItemId: originData.inventoryItemId,
            code: originData.code,
            description: originData.description,
            category: originData.category,
            unit: originData.unit,
            physicalStock: item.quantity,
            committedStock: 0,
            availableStock: item.quantity,
            updatedAt: now,
            updatedBy: currentUser?.email || 'Usuario Sistema'
          };
          transaction.set(targetDocRef, newTargetItem);
        }

        movementItems.push({
          inventoryItemId: originData.inventoryItemId,
          code: originData.code,
          description: originData.description,
          quantity: item.quantity,
          previousPhysicalStock: originData.physicalStock,
          newPhysicalStock: newOriginPhysical,
          previousCommittedStock: originData.committedStock,
          newCommittedStock: originData.committedStock
        });
      }

      const movementNumber = `MOV-${Math.floor(100000 + Math.random() * 900000)}`;

      const movementData: VehicleMovement = {
        id: movementRef.id,
        movementNumber,
        type: 'Traslado_Entre_Vehiculos',
        origin: `${originVeh.alias} - ${originVeh.placa}`,
        destination: `${targetVeh.alias} - ${targetVeh.placa}`,
        originVehiculoId: originVehicleId,
        originVehiculoPlaca: originVeh.placa,
        originVehiculoAlias: originVeh.alias,
        vehiculoId: originVehicleId,
        vehiculoPlaca: originVeh.placa,
        targetVehiculoId: targetVehicleId,
        targetVehiculoPlaca: targetVeh.placa,
        targetVehiculoAlias: targetVeh.alias,
        items: movementItems,
        date: now,
        reason: reason || `Traslado múltiple (${movementItems.length} materiales) de ${originVeh.alias} a ${targetVeh.alias}`,
        performedBy: userId,
        performedByName: userName,
        createdAt: now
      };

      transaction.set(movementRef, movementData);
    });
  },

  // 2. Create material request from vehicle (commit stock)
  async createRequest(
    vehiculoId: string,
    projectId: string,
    requestItems: any[],
    currentUser?: { id: string; name?: string; email?: string } | null,
    observations?: string
  ): Promise<void> {
    if (!requestItems || requestItems.length === 0) {
      throw new Error('La solicitud debe contener al menos un material.');
    }

    const vehicles = getVehicleCatalog();
    const veh = vehicles.find(v => v.id === vehiculoId);
    if (!veh) throw new Error('Vehículo no encontrado');

    const reqRef = doc(collection(db, 'vehicle_material_requests'));
    const requestNumber = `SV-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
      // Leer items
      const itemDocs = [];
      for (const reqItem of requestItems) {
        const itemRef = doc(db, 'vehicle_warehouse_items', `${vehiculoId}_${reqItem.inventoryItemId}`);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
          throw new Error(`El material ${reqItem.code} no existe en el inventario del vehículo.`);
        }
        const reqQty = Number(reqItem.quantity ?? reqItem.quantityCommitted ?? 0);
        itemDocs.push({ itemSnap, itemRef, reqQty });
      }

      let projectCode = 'P-DESC';
      let projectName = 'Proyecto Desconocido';

      if (projectId) {
        const projRef = doc(db, 'projects', projectId);
        const projSnap = await transaction.get(projRef);
        if (projSnap.exists()) {
          projectCode = projSnap.data().projectNumber || 'P-DESC';
          projectName = projSnap.data().name || 'Proyecto Desconocido';
        }
      }

      // Validar disponibilidades y preparar updates
      for (const docInfo of itemDocs) {
        const data = docInfo.itemSnap.data() as VehicleWarehouseItem;
        const available = data.physicalStock - data.committedStock;
        if (docInfo.reqQty > available) {
          throw new Error(`No hay suficiente disponibilidad para ${data.code}. Físico: ${data.physicalStock}, Comprometido: ${data.committedStock}, Disponible: ${available}, Solicitado: ${docInfo.reqQty}`);
        }
        const newCommitted = data.committedStock + docInfo.reqQty;
        const newAvailable = data.physicalStock - newCommitted;
        
        transaction.update(docInfo.itemRef, {
          committedStock: newCommitted,
          availableStock: newAvailable,
          updatedAt: now,
          updatedBy: currentUser?.email || 'Usuario'
        });
      }

      const finalItems = itemDocs.map(docInfo => {
        const data = docInfo.itemSnap.data() as VehicleWarehouseItem;
        return {
          inventoryItemId: data.inventoryItemId,
          code: data.code,
          description: data.description,
          unit: data.unit,
          quantityCommitted: docInfo.reqQty,
          notes: ''
        };
      });

      const newRequest: VehicleMaterialRequest = {
        id: reqRef.id,
        requestNumber,
        vehiculoId,
        vehiculoAlias: veh.alias,
        vehiculoPlaca: veh.placa,
        projectId,
        projectCode,
        projectName,
        responsibleId: currentUser?.id || 'system',
        responsibleName: currentUser?.name || currentUser?.email || 'Usuario',
        status: 'Abierta',
        openedAt: now,
        items: finalItems,
        additionsLog: [],
        observations: observations || '',
        createdAt: now,
        createdBy: currentUser?.email || 'Usuario',
        updatedAt: now,
        updatedBy: currentUser?.email || 'Usuario'
      };

      transaction.set(reqRef, newRequest);
    });
  },

  // 3. Update existing material request
  async updateRequest(
    requestId: string,
    newItems: any[],
    currentUser?: { id: string; name?: string; email?: string } | null,
    observations?: string
  ): Promise<void> {
    const reqRef = doc(db, 'vehicle_material_requests', requestId);
    const now = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error('Solicitud no encontrada');
      const request = reqSnap.data() as VehicleMaterialRequest;

      if (request.status !== 'Abierta') {
        throw new Error(`No se puede modificar una solicitud en estado ${request.status}.`);
      }

      // Necesitamos liberar los viejos y comprometer los nuevos.
      // 1. Obtener todos los items involucrados (viejos y nuevos)
      const allItemIds = new Set<string>();
      request.items.forEach(i => allItemIds.add(i.inventoryItemId));
      newItems.forEach(i => allItemIds.add(i.inventoryItemId));

      const itemDocs = new Map();
      for (const id of Array.from(allItemIds)) {
        const itemRef = doc(db, 'vehicle_warehouse_items', `${request.vehiculoId}_${id}`);
        const itemSnap = await transaction.get(itemRef);
        if (itemSnap.exists()) {
          itemDocs.set(id, { itemSnap, itemRef });
        }
      }

      // 2. Liberar compromiso anterior
      const tempStock = new Map<string, { physical: number, committed: number }>();
      request.items.forEach(oldItem => {
        const docInfo = itemDocs.get(oldItem.inventoryItemId);
        if (docInfo) {
          const data = docInfo.itemSnap.data() as VehicleWarehouseItem;
          const current = tempStock.get(oldItem.inventoryItemId) || { physical: data.physicalStock, committed: data.committedStock };
          tempStock.set(oldItem.inventoryItemId, {
            physical: current.physical,
            committed: current.committed - oldItem.quantityCommitted
          });
        }
      });

      // 3. Aplicar nuevo compromiso y validar
      newItems.forEach(newItem => {
        const docInfo = itemDocs.get(newItem.inventoryItemId);
        if (!docInfo) throw new Error(`El material ${newItem.code} no existe en la bodega vehicular.`);
        
        const data = docInfo.itemSnap.data() as VehicleWarehouseItem;
        const current = tempStock.get(newItem.inventoryItemId) || { physical: data.physicalStock, committed: data.committedStock };
        
        const reqQty = Number(newItem.quantity ?? newItem.quantityCommitted ?? 0);
        const available = current.physical - current.committed;
        if (reqQty > available) {
          throw new Error(`Stock insuficiente para ${newItem.code}. Físico: ${current.physical}, Disponible simulado: ${available}, Requerido: ${reqQty}.`);
        }

        tempStock.set(newItem.inventoryItemId, {
          physical: current.physical,
          committed: current.committed + reqQty
        });
      });

      // 4. Actualizar inventarios
      for (const [itemId, stock] of Array.from(tempStock.entries())) {
        const docInfo = itemDocs.get(itemId);
        if (docInfo) {
          transaction.update(docInfo.itemRef, {
            committedStock: stock.committed,
            availableStock: stock.physical - stock.committed,
            updatedAt: now,
            updatedBy: currentUser?.email || 'Usuario'
          });
        }
      }

      // 5. Actualizar la solicitud
      const finalItems = newItems.map(ni => {
        const docInfo = itemDocs.get(ni.inventoryItemId);
        const data = docInfo.itemSnap.data() as VehicleWarehouseItem;
        return {
          inventoryItemId: ni.inventoryItemId,
          code: data.code,
          description: data.description,
          unit: data.unit,
          quantityCommitted: ni.quantity,
          notes: ''
        };
      });

      transaction.update(reqRef, {
        items: finalItems,
        observations: observations !== undefined ? observations : request.observations,
        updatedAt: now,
        updatedBy: currentUser?.email || 'Usuario'
      });
    });
  },

  // 4. Cancel material request
  async cancelRequest(
    requestId: string,
    currentUser?: { id: string; name?: string; email?: string } | null,
    observations?: string
  ): Promise<void> {
    const reqRef = doc(db, 'vehicle_material_requests', requestId);
    const now = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error('Solicitud no encontrada');
      const request = reqSnap.data() as VehicleMaterialRequest;

      if (request.status !== 'Abierta') {
        throw new Error(`No se puede cancelar una solicitud que ya está ${request.status}.`);
      }

      // Liberar compromisos
      for (const item of request.items) {
        const itemRef = doc(db, 'vehicle_warehouse_items', `${request.vehiculoId}_${item.inventoryItemId}`);
        const itemSnap = await transaction.get(itemRef);
        if (itemSnap.exists()) {
          const data = itemSnap.data() as VehicleWarehouseItem;
          const newCommitted = Math.max(0, data.committedStock - item.quantityCommitted);
          const newAvailable = data.physicalStock - newCommitted;
          transaction.update(itemRef, {
            committedStock: newCommitted,
            availableStock: newAvailable,
            updatedAt: now,
            updatedBy: currentUser?.email || 'Usuario'
          });
        }
      }

      transaction.update(reqRef, {
        status: 'Cancelada',
        closedAt: now,
        closedBy: currentUser?.id || 'system',
        closedByName: currentUser?.name || currentUser?.email || 'Usuario',
        observations: observations ? `${request.observations || ''}\n\nCancelación: ${observations}` : request.observations,
        updatedAt: now,
        updatedBy: currentUser?.email || 'Usuario'
      });
    });
  },

  // 5. Close material request (Consume)
  async closeRequest(
    requestId: string,
    usedItems: { inventoryItemId: string; usedQuantity: number }[],
    currentUser?: { id: string; name?: string; email?: string } | null,
    observations?: string
  ): Promise<void> {
    const reqRef = doc(db, 'vehicle_material_requests', requestId);
    const movementRef = doc(collection(db, 'vehicle_movements'));
    const consumptionRef = doc(collection(db, 'vehicle_consumptions'));
    const now = new Date().toISOString();
    const userName = currentUser?.name || currentUser?.email || 'Usuario';
    const userId = currentUser?.id || 'system';

    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error('Solicitud no encontrada');
      const request = reqSnap.data() as VehicleMaterialRequest;

      if (request.status !== 'Abierta') {
        throw new Error(`La solicitud ya está ${request.status} y no se puede cerrar nuevamente.`);
      }

      const itemDocs = new Map();
      for (const item of request.items) {
        const itemRef = doc(db, 'vehicle_warehouse_items', `${request.vehiculoId}_${item.inventoryItemId}`);
        const itemSnap = await transaction.get(itemRef);
        if (itemSnap.exists()) {
          itemDocs.set(item.inventoryItemId, { itemSnap, itemRef });
        }
      }

      const finalItemsList: any[] = [];
      const movementItemsList: any[] = [];

      for (const reqItem of request.items) {
        const used = usedItems.find(u => u.inventoryItemId === reqItem.inventoryItemId)?.usedQuantity ?? 0;
        const committed = reqItem.quantityCommitted;
        const surplus = committed - used;

        const docInfo = itemDocs.get(reqItem.inventoryItemId);
        if (docInfo) {
          const data = docInfo.itemSnap.data() as VehicleWarehouseItem;
          
          if (used > data.physicalStock) {
            throw new Error(`Inventario inconsistente: ${data.code} tiene ${data.physicalStock} unidades físicas pero se intenta consumir ${used}.`);
          }
          if (committed > data.committedStock) {
             throw new Error(`Inventario inconsistente: ${data.code} tiene ${data.committedStock} comprometidas pero se intenta liberar ${committed}.`);
          }

          const newPhysical = data.physicalStock - used;
          const newCommitted = data.committedStock - committed;
          const newAvailable = newPhysical - newCommitted;

          transaction.update(docInfo.itemRef, {
            physicalStock: newPhysical,
            committedStock: newCommitted,
            availableStock: newAvailable,
            updatedAt: now,
            updatedBy: currentUser?.email || 'Usuario'
          });

          finalItemsList.push({
            inventoryItemId: reqItem.inventoryItemId,
            code: reqItem.code,
            description: reqItem.description,
            unit: reqItem.unit,
            committed,
            consumed: used,
            surplus
          });

          if (used > 0) {
            movementItemsList.push({
              inventoryItemId: reqItem.inventoryItemId,
              code: reqItem.code,
              description: reqItem.description,
              quantity: used,
              previousPhysicalStock: data.physicalStock,
              newPhysicalStock: newPhysical,
              previousCommittedStock: data.committedStock,
              newCommittedStock: newCommitted
            });
          }
        }
      }

      // Cerrar Solicitud
      const requestItemsToSave = request.items.map(reqItem => {
        const used = usedItems.find(u => u.inventoryItemId === reqItem.inventoryItemId)?.usedQuantity ?? 0;
        return {
          ...reqItem,
          quantityUsed: used,
          quantitySurplus: reqItem.quantityCommitted - used
        };
      });

      transaction.update(reqRef, {
        status: 'Cerrada',
        closedAt: now,
        closedBy: userId,
        closedByName: userName,
        observations: observations ? `${request.observations || ''}\n\nCierre: ${observations}` : request.observations,
        items: requestItemsToSave,
        updatedAt: now,
        updatedBy: currentUser?.email || 'Usuario'
      });

      // Crear Consumo
      const consumptionData: VehicleProjectConsumption = {
        id: consumptionRef.id,
        requestId: request.id,
        requestNumber: request.requestNumber,
        projectId: request.projectId,
        projectCode: request.projectCode,
        projectName: request.projectName,
        vehiculoId: request.vehiculoId,
        vehiculoAlias: request.vehiculoAlias,
        responsibleId: request.responsibleId,
        responsibleName: request.responsibleName,
        closedAt: now,
        closedBy: userId,
        items: finalItemsList,
        totalItemsConsumed: finalItemsList.reduce((acc, i) => acc + i.consumed, 0)
      };
      transaction.set(consumptionRef, consumptionData);

      // Crear Movimiento si hubo consumo
      if (movementItemsList.length > 0) {
        const movementData: VehicleMovement = {
          id: movementRef.id,
          movementNumber: `MOV-${Math.floor(100000 + Math.random() * 900000)}`,
          type: 'Consumo_Proyecto',
          vehiculoId: request.vehiculoId,
          vehiculoPlaca: request.vehiculoPlaca,
          requestId: request.id,
          projectId: request.projectId,
          projectName: request.projectName,
          items: movementItemsList,
          date: now,
          reason: `Consumo por cierre de solicitud ${request.requestNumber} - Proyecto ${request.projectCode}`,
          performedBy: userId,
          performedByName: userName,
          createdAt: now
        };
        transaction.set(movementRef, movementData);
      }
    });
  },

  // 5. Delete Inventory Item from a vehicle warehouse (Exclusive for authorized admin)
  async deleteInventoryItem(
    itemId: string,
    currentUser?: { id?: string; name?: string; email?: string } | null
  ): Promise<void> {
    if (!isVehicleDeleteAuthorized(currentUser)) {
      throw new Error('No tiene permisos para eliminar registros de inventario vehicular. Acción exclusiva para jenamorado@tentelcom.com.');
    }
    const docRef = doc(db, 'vehicle_warehouse_items', itemId);
    await deleteDoc(docRef);
  },

  // 6. Delete Material Request (Exclusive for authorized admin)
  async deleteRequest(
    requestId: string,
    currentUser?: { id?: string; name?: string; email?: string } | null
  ): Promise<void> {
    if (!isVehicleDeleteAuthorized(currentUser)) {
      throw new Error('No tiene permisos para eliminar solicitudes de bodega vehicular. Acción exclusiva para jenamorado@tentelcom.com.');
    }
    const docRef = doc(db, 'vehicle_material_requests', requestId);
    await deleteDoc(docRef);
  },

  // 7. Delete Movement record (Exclusive for authorized admin)
  async deleteMovement(
    movementId: string,
    currentUser?: { id?: string; name?: string; email?: string } | null
  ): Promise<void> {
    if (!isVehicleDeleteAuthorized(currentUser)) {
      throw new Error('No tiene permisos para eliminar movimientos de bodega vehicular. Acción exclusiva para jenamorado@tentelcom.com.');
    }
    const docRef = doc(db, 'vehicle_movements', movementId);
    await deleteDoc(docRef);
  },

  // 8. Delete Consumption record (Exclusive for authorized admin)
  async deleteConsumption(
    consumptionId: string,
    currentUser?: { id?: string; name?: string; email?: string } | null
  ): Promise<void> {
    if (!isVehicleDeleteAuthorized(currentUser)) {
      throw new Error('No tiene permisos para eliminar reportes de consumo vehicular. Acción exclusiva para jenamorado@tentelcom.com.');
    }
    const docRef = doc(db, 'vehicle_consumptions', consumptionId);
    await deleteDoc(docRef);
  }
};
