import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  runTransaction, 
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  orderBy,
  increment
} from 'firebase/firestore';
import { MaterialRequest, DispatchRecord } from '../dispatchTypes';
import { User } from '../utils/types';
import { useUserContext } from '../contexts/UserContext';

import { logger } from '../utils/logger';

export const useDispatch = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Escuchar Solicitudes Aprobadas (Listas para despacho)
  useEffect(() => {
    if (!authReady || !currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Filtramos solo las que están listas para despachar
    const materialRequestsCollectionName = "material_reports";
    
    const baseRef = collection(db, materialRequestsCollectionName);
    const q = query(baseRef, where("status", "==", "Aprobada"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      logger.log("Dispatch requests loaded:", snapshot.size);
      
      const list = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as MaterialRequest));
      
      // Ordenamiento en cliente
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setRequests(list);
      setIsLoading(false);
    }, (err) => {
      logger.error("Error fetching requests:", err);
      setError("Error al cargar solicitudes.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, authReady]);

  // 2. Transacción de Despacho (CORE LOGIC)
  const processDispatch = useCallback(async (
    request: MaterialRequest, 
    dispatchData: { 
        dispatchDate: string; 
        responsibleName: string; 
        items: { itemId: string; dispatchQty: number }[] 
    }
  ) => {
    if (!currentUser) throw new Error("No autenticado");

    try {
        // ONLINE: Transacción normal con validación de stock
        await runTransaction(db, async (transaction) => {
            const movementItems: any[] = []; // Para el registro de inventory_movements
            
            // 1. LECTURAS (transaction.get)
            const itemDocs = [];
            
            // Leer TODOS los items de la solicitud original para poder liberar sus reservas
            for (const reqItem of request.items) {
                let itemRef = doc(db, "inventory_items", reqItem.inventoryItemId);
                let itemDoc = await transaction.get(itemRef);
                
                if (!itemDoc.exists()) {
                    // REPARACIÓN EN CALIENTE: Si el ID no existe, intentamos buscar por código
                    // Esto es necesario para solicitudes antiguas con IDs de datos en lugar de IDs de documento.
                    const q = query(collection(db, "inventory_items"), where("code", "==", reqItem.code));
                    const fallbackSnap = await getDocs(q);
                    
                    if (!fallbackSnap.empty) {
                        const realDoc = fallbackSnap.docs[0];
                        itemRef = doc(db, "inventory_items", realDoc.id);
                        itemDoc = await transaction.get(itemRef);
                        
                        // Actualizamos el ID en el objeto reqItem para el resto de la lógica
                        (reqItem as any).inventoryItemId = realDoc.id;
                    } else {
                        throw new Error(`El ítem con ID ${reqItem.inventoryItemId} (${reqItem.code}) no existe en inventario.`);
                    }
                }
                
                // Buscar si este item tiene cantidad a despachar
                const dispatchItem = dispatchData.items.find(i => i.itemId === reqItem.inventoryItemId || i.code === reqItem.code);
                const dispatchQty = dispatchItem ? dispatchItem.dispatchQty : 0;
                
                itemDocs.push({ 
                    item: { ...reqItem, itemId: reqItem.inventoryItemId, dispatchQty }, 
                    itemDoc 
                });
            }

            // 2. VALIDACIONES
            for (const { item, itemDoc } of itemDocs) {
                const currentStock = itemDoc.data().stock || 0;
                const newStock = currentStock - item.dispatchQty;
                const currentReserved = itemDoc.data().reserved || 0;

                if (newStock < 0) {
                    throw new Error(`Stock insuficiente para ${itemDoc.data().description}. Stock actual: ${currentStock}, Intento de despacho: ${item.dispatchQty}`);
                }

                if (currentReserved < item.quantityRequested) {
                    throw new Error(`Inconsistencia de reserva para ${itemDoc.data().description}. Reserva actual: ${currentReserved}, Solicitado: ${item.quantityRequested}`);
                }
            }

            // 3. ESCRITURAS (transaction.update, transaction.set)
            
            // A. Preparar actualizaciones de inventario y de la solicitud
            const inventoryUpdates: Record<string, any> = {};
            let allCompleted = true;
            const updatedRequestItems = request.items.map(reqItem => {
                const dispatchItem = dispatchData.items.find(i => i.itemId === reqItem.inventoryItemId);
                const dispatchQty = dispatchItem ? dispatchItem.dispatchQty : 0;
                
                const currentDispatched = Number(reqItem.quantityDispatched || 0);
                const newDispatchedQty = currentDispatched + dispatchQty;
                const newPendingQty = Math.max(0, reqItem.quantityRequested - newDispatchedQty);
                // El faltante se reduce solo si despachamos más de lo que había originalmente disponible
                const originalShortage = reqItem.shortageQty || 0;
                const newShortageQty = Math.min(originalShortage, newPendingQty);
                
                const itemStatus = newPendingQty <= 0 ? 'completed' : (newDispatchedQty > 0 ? 'partial' : 'pending');

                if (newPendingQty > 0) allCompleted = false;

                // Solo si hubo despacho en este turno actualizamos inventario
                if (dispatchQty > 0) {
                    const itemDoc = itemDocs.find(d => d.item.inventoryItemId === reqItem.inventoryItemId)?.itemDoc;
                    const currentStock = itemDoc?.data()?.stock || 0;
                    const newStock = currentStock - dispatchQty;
                    const unitPrice = itemDoc?.data()?.price || 0;
                    const currency = itemDoc?.data()?.currency || 'USD';
                    const subtotal = dispatchQty * unitPrice;

                    inventoryUpdates[reqItem.inventoryItemId] = {
                        reserved: increment(-dispatchQty),
                        stock: newStock,
                        updatedAt: new Date().toISOString(),
                        updatedBy: `Despacho: ${request.projectCode || request.projectId}`
                    };

                    movementItems.push({
                        inventoryItemId: reqItem.inventoryItemId,
                        inventoryItemCode: itemDoc?.data()?.code,
                        inventoryItemName: itemDoc?.data()?.description,
                        quantity: dispatchQty,
                        unitPrice: unitPrice,
                        subtotal: subtotal,
                        currency: currency,
                        previousStock: currentStock,
                        newStock: newStock
                    });
                }

                return {
                    ...reqItem,
                    quantityDispatched: newDispatchedQty,
                    quantityPending: newPendingQty,
                    shortageQty: newShortageQty,
                    status: itemStatus
                };
            });

            // Ejecutar actualizaciones de inventario
            for (const [itemId, updateData] of Object.entries(inventoryUpdates)) {
                const itemRef = doc(db, "inventory_items", itemId);
                transaction.update(itemRef, updateData);
            }

            // C. Crear Registro de Despacho (material_dispatches)
            const dispatchRef = doc(collection(db, "material_dispatches"));
            const dispatchRecord: DispatchRecord = {
                id: dispatchRef.id,
                requestId: request.id,
                projectId: request.projectId,
                projectName: request.projectName,
                dispatchDate: dispatchData.dispatchDate,
                dispatchedBy: dispatchData.responsibleName,
                recordedBy: currentUser.id,
                requestNumber: request.requestNumber,
                items: dispatchData.items.map(d => {
                    const reqItem = request.items.find(i => i.inventoryItemId === d.itemId);
                    return {
                        inventoryItemId: d.itemId,
                        code: reqItem?.code || '',
                        description: reqItem?.description || '',
                        quantity: d.dispatchQty
                    };
                }).filter(i => i.quantity > 0),
                createdAt: new Date().toISOString()
            };
            transaction.set(dispatchRef, dispatchRecord);

            // D. Generar Movimiento de Inventario
            if (movementItems.length > 0) {
                const movRef = doc(collection(db, "inventory_movements"));
                const mainItem = movementItems[0];
                
                transaction.set(movRef, {
                    type: 'Salida',
                    date: dispatchData.dispatchDate,
                    projectId: request.projectId === 'N/A' ? null : request.projectId,
                    projectCode: request.projectCode,
                    projectName: request.projectName,
                    userId: currentUser.id,
                    userName: currentUser.email,
                    observations: `Despacho automático Ref: ${dispatchRef.id} - Responsable: ${dispatchData.responsibleName}`,
                    origin: request.origin,
                    requestNumber: request.requestNumber,
                    fdh: request.fdh || null,
                    torre: request.torre || null,
                    locationDetails: request.locationDetails || null,
                    
                    inventoryItemId: mainItem.inventoryItemId,
                    inventoryItemCode: mainItem.inventoryItemCode,
                    inventoryItemName: movementItems.length > 1 ? `${mainItem.inventoryItemName} (+${movementItems.length - 1})` : mainItem.inventoryItemName,
                    quantity: movementItems.length > 1 ? 0 : mainItem.quantity,
                    unitPrice: mainItem.unitPrice,
                    subtotal: mainItem.subtotal,
                    currency: mainItem.currency,
                    previousStock: mainItem.previousStock,
                    newStock: mainItem.newStock,

                    items: movementItems,
                    createdAt: new Date().toISOString()
                });
            }

            // E. Actualizar Solicitud (material_reports)
            const requestRef = doc(db, "material_reports", request.id);
            transaction.update(requestRef, {
                status: allCompleted ? 'Despachada' : 'Parcial',
                items: updatedRequestItems,
                updatedAt: new Date().toISOString(),
                dispatchId: dispatchRef.id 
            });
        });

        // Guardar historial de responsable (Aislado)
        if (dispatchData.responsibleName) {
            const normalizedId = dispatchData.responsibleName.trim().toLowerCase();
            const respRef = doc(db, "dispatch_responsibles", normalizedId);
            try {
                const respDoc = await getDoc(respRef);
                if (respDoc.exists()) {
                    await updateDoc(respRef, {
                        lastUsed: new Date().toISOString(),
                        usageCount: increment(1)
                    });
                } else {
                    await setDoc(respRef, {
                        id: normalizedId,
                        name: dispatchData.responsibleName.trim(),
                        lastUsed: new Date().toISOString(),
                        usageCount: 1
                    });
                }
            } catch (e) {
                logger.warn("Error saving responsible history:", e);
            }
        }

        return { success: true };

    } catch (e: any) {
        logger.error("Error en transacción de despacho:", e);
        throw new Error(e.message || "Error al procesar el despacho.");
    }
  }, [currentUser]);

  const deleteRequest = useCallback(async (requestId: string) => {
      if (!currentUser) throw new Error("No autenticado");
      
      const reqRef = doc(db, "material_reports", requestId);
      const reqSnap = await getDoc(reqRef);
      
      if (!reqSnap.exists()) {
          throw new Error("La solicitud no existe.");
      }
      
      const currentData = reqSnap.data() as MaterialRequest;
      const RESERVATION_STATES = ['Pendiente', 'Aprobada'];

      await runTransaction(db, async (transaction) => {
          // Si estaba Pendiente o Aprobada, liberar reservas
          if (RESERVATION_STATES.includes(currentData.status)) {
              const itemsToRelease = currentData.items || [];
              const itemDocs = [];
              
              // 1. LECTURAS
              for (const item of itemsToRelease) {
                  const itemRef = doc(db, "inventory_items", item.inventoryItemId);
                  const itemDoc = await transaction.get(itemRef);
                  if (itemDoc.exists()) {
                      itemDocs.push({ item, itemDoc });
                  }
              }
              
              // 2. VALIDACIONES Y ESCRITURAS
              for (const { item, itemDoc } of itemDocs) {
                  const currentReserved = itemDoc.data().reserved || 0;
                  // Calculamos cuánto liberar: lo que se pidió menos lo que ya se despachó
                  const alreadyDispatched = Number(item.quantityDispatched || 0);
                  const stillReserved = Math.max(0, item.quantityRequested - alreadyDispatched);
                  
                  // Liberamos lo que este item tenga reservado, pero nunca más de lo que hay total en el item
                  const newReserved = Math.max(0, currentReserved - stillReserved);
                  
                  const itemRef = doc(db, "inventory_items", item.inventoryItemId);
                  transaction.update(itemRef, {
                      reserved: newReserved
                  });
              }
          }

          transaction.update(reqRef, {
              status: 'Eliminada',
              deletedAt: new Date().toISOString(),
              deletedBy: currentUser.email,
              updatedAt: new Date().toISOString()
          });
      });
  }, [currentUser]);

  const getResponsibleHistory = useCallback(async () => {
      try {
          const q = query(collection(db, "dispatch_responsibles"), orderBy("lastUsed", "desc"));
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.map(doc => ({
              label: doc.data().name,
              value: doc.data().name
          }));
      } catch (e) {
          logger.error("Error fetching responsible history:", e);
          return [];
      }
  }, []);

  return {
    requests,
    isLoading,
    error,
    processDispatch,
    deleteRequest,
    getResponsibleHistory
  };
};
