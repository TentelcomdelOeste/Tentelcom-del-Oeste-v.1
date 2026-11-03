import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  runTransaction, 
  doc,
  deleteDoc,
  onSnapshot,
  limit,
  where,
  getDocs
} from 'firebase/firestore';
import { InventoryMovement, MovementItemDetail } from '../inventoryMovementTypes';
import { User } from '../utils/types';
import { guardedWrite } from '../core/writeGuard';
import { useUserContext } from '../contexts/UserContext';
import { 
  InventoryCostLayer, 
  FifoLayerConsumption 
} from '../types/fifoCostTypes';
import { 
  prepareEntryCostLayer, 
  calculateFifoConsumption, 
  calculateFifoReturnRestoration 
} from '../services/fifoCostService';

export const useInventoryMovements = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Pagination State
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!authReady || !currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    if (movements.length === 0) {
      setIsLoading(true);
    }
    
    const q = query(collection(db, "inventory_movements"), orderBy("createdAt", "desc"), limit(currentLimit));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id
        } as InventoryMovement;
      });
      
      setMovements(list);
      setHasMore(snapshot.docs.length === currentLimit);
      setIsLoading(false);
      setLoadingMore(false);
    }, (err) => {
      console.error("Error fetching movements:", err);
      setError("No se pudieron cargar los movimientos.");
      setIsLoading(false);
      setLoadingMore(false);
    });
    
    return () => unsubscribe();
  }, [currentUser?.uid, currentLimit, authReady]);

  const loadMore = useCallback(() => {
     if (!hasMore || loadingMore) return;
     setLoadingMore(true);
     setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  // Transacción: Crear Movimiento + Actualizar Stock + Trazabilidad + Costeo PEPS (FIFO)
  // Soporta payload con múltiples items en `itemsData`
  const addMovement = useCallback(async (movementData: any) => {
    if (!currentUser) throw new Error("No autenticado");
    
    const itemsToProcess: any[] = movementData.items || [];
    if (itemsToProcess.length === 0) throw new Error("No hay items en el movimiento.");

    try {
      // 0. Pre-fetch dispatch data if it's a return
      let preFetchedDispatchRef: any = null;
      if (movementData.type === 'Devolución' && movementData.dispatchId) {
          preFetchedDispatchRef = doc(db, "material_dispatches", movementData.dispatchId);
      }

      // Pre-fetch active cost layers if it's a Salida
      const preFetchedLayersByItem = new Map<string, any[]>();
      if (movementData.type === 'Salida') {
        await Promise.all(
          itemsToProcess.map(async (item) => {
            const q = query(
              collection(db, "inventory_cost_layers"),
              where("inventoryItemId", "==", item.inventoryItemId),
              where("status", "==", "active")
            );
            const snap = await getDocs(q);
            preFetchedLayersByItem.set(item.inventoryItemId, snap.docs);
          })
        );
      }

      // Pre-fetch layers if Devolución to restore
      const preFetchedReturnLayers = new Map<string, any>();
      if (movementData.type === 'Devolución' && movementData.dispatchId) {
        const qMov = query(
          collection(db, "inventory_movements"),
          where("dispatchId", "==", movementData.dispatchId),
          limit(1)
        );
        const movSnap = await getDocs(qMov);
        if (!movSnap.empty) {
          const origMov = movSnap.docs[0].data();
          const allLayerIds: string[] = [];
          if (origMov.items) {
            origMov.items.forEach((it: any) => {
              if (it.fifoLayersConsumed) {
                it.fifoLayersConsumed.forEach((c: any) => {
                  if (c.layerId && !allLayerIds.includes(c.layerId)) allLayerIds.push(c.layerId);
                });
              }
            });
          }
          await Promise.all(
            allLayerIds.map(async (lId) => {
              const lRef = doc(db, "inventory_cost_layers", lId);
              preFetchedReturnLayers.set(lId, lRef);
            })
          );
        }
      }

      await guardedWrite(() => runTransaction(db, async (transaction) => {
        // =========================
        // 1. TODAS LAS LECTURAS
        // =========================

        let dispatchDoc: any = null;
        if (movementData.type === 'Devolución' && preFetchedDispatchRef) {
            dispatchDoc = await transaction.get(preFetchedDispatchRef);
            if (!dispatchDoc.exists()) {
                throw new Error("La entrega (dispatch) no existe");
            }
        }

        let counterRef: any = null;
        let counterSnap: any = null;
        const needsDevCounter = movementData.type === 'Devolución';
        const needsMovCounter = movementData.type !== 'Devolución' && !movementData.requestNumber;
        
        if (needsDevCounter) {
            counterRef = doc(db, "counters", "returnNumber");
            counterSnap = await transaction.get(counterRef);
        } else if (needsMovCounter) {
            counterRef = doc(db, "counters", "movementNumber");
            counterSnap = await transaction.get(counterRef);
        }

        // Leer todos los items de inventario
        const itemRefs = itemsToProcess.map(item => 
            doc(db, "inventory_items", item.inventoryItemId)
        );
        const itemDocs = await Promise.all(
            itemRefs.map(ref => transaction.get(ref))
        );

        // Si es Salida: leer capas activas para asegurar bloqueo de concurrencia
        const readLayersByItem = new Map<string, InventoryCostLayer[]>();
        if (movementData.type === 'Salida') {
          for (const [itemId, layerDocs] of preFetchedLayersByItem.entries()) {
            const layers: InventoryCostLayer[] = [];
            for (const lDoc of layerDocs) {
              const layerSnap = await transaction.get(lDoc.ref);
              if (layerSnap.exists()) {
                layers.push({ ...layerSnap.data(), id: layerSnap.id } as InventoryCostLayer);
              }
            }
            readLayersByItem.set(itemId, layers);
          }
        }

        // Si es Devolución: leer capas a restaurar si existen
        const readReturnLayersMap = new Map<string, InventoryCostLayer>();
        if (movementData.type === 'Devolución' && preFetchedReturnLayers.size > 0) {
          for (const [lId, lRef] of preFetchedReturnLayers.entries()) {
            const lSnap = await transaction.get(lRef);
            if (lSnap.exists()) {
              readReturnLayersMap.set(lId, { ...lSnap.data(), id: lSnap.id } as InventoryCostLayer);
            }
          }
        }

        // =========================
        // 2. VALIDACIONES Y CÁLCULOS
        // =========================
        
        let finalRequestNumber = movementData.requestNumber || null;
        let nextNumber = 1;
        if (needsDevCounter || needsMovCounter) {
            if (counterSnap && counterSnap.exists()) {
                nextNumber = (counterSnap.data().lastNumber || 0) + 1;
            }
            if (needsDevCounter) {
                finalRequestNumber = `DEV-${String(nextNumber).padStart(4, '0')}`;
            } else if (needsMovCounter) {
                finalRequestNumber = `MOV-${String(nextNumber).padStart(4, '0')}`;
            }
        }

        const processedItems: MovementItemDetail[] = [];
        const dispatchItems = dispatchDoc?.data()?.items || [];
        const costLayersToCreate: InventoryCostLayer[] = [];
        const costLayersToUpdate: { ref: any; data: any }[] = [];
        const newMovementRef = doc(collection(db, "inventory_movements"));
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        
        itemDocs.forEach((itemDoc, index) => {
            const itemRequest = itemsToProcess[index];
            if (!itemDoc.exists()) {
                throw new Error(`El producto ${itemRequest.inventoryItemCode || 'desconocido'} ya no existe en el inventario.`);
            }

            const itemData = itemDoc.data();
            const currentStock = itemData.stock || 0;
            const catalogPrice = itemData.price || 0;
            const currency = itemRequest.currency || itemData.currency || 'USD';
            const quantity = Number(itemRequest.quantity);
            
            if (isNaN(quantity) || quantity <= 0) throw new Error(`Cantidad inválida para ${itemData.description || 'ítem'}.`);
            
            let newStock = currentStock;

            if (movementData.type === 'Entrada' || movementData.type === 'Devolución') {
                newStock = currentStock + quantity;
            } else {
                if (currentStock < quantity) {
                    throw new Error(`Stock insuficiente para ${itemData.description}. Disponible: ${currentStock}, Solicitado: ${quantity}`);
                }
                newStock = currentStock - quantity;
            }

            if (movementData.type === 'Devolución' && movementData.dispatchId && dispatchDoc) {
                const dispatchItem = dispatchItems.find((i: any) => i.inventoryItemId === itemRequest.inventoryItemId);
                if (!dispatchItem) throw new Error(`El ítem ${itemRequest.inventoryItemCode || 'seleccionado'} no fue parte de la entrega original.`);
                
                const delivered = Number(dispatchItem.quantity || 0);
                const returned = Number(dispatchItem.quantityReturned || 0);
                const disponible = delivered - returned;
                
                if (quantity > disponible) {
                    throw new Error(`No se puede devolver más de lo entregado. Entregado: ${delivered}, Devuelto previamente: ${returned}, Disponible: ${disponible}`);
                }
                
                dispatchItem.quantityReturned = returned + quantity;
            }

            // PEPS (FIFO) LOGIC:
            let unitPrice = itemRequest.unitPrice || catalogPrice;
            let subtotal = quantity * unitPrice;
            let total = itemRequest.total || (subtotal + (subtotal * 0.13));
            let fifoLayersConsumed: FifoLayerConsumption[] | undefined = undefined;
            let costMethod: 'FIFO' | 'CATALOG_FALLBACK' | undefined = undefined;
            let costingStatus: 'CONFIRMED' | 'PENDING_COSTING' | undefined = undefined;
            let isFullyCoveredByLayers: boolean | undefined = undefined;
            let uncoveredQuantity: number | undefined = undefined;

            if (movementData.type === 'Entrada') {
                // Entrada: crear capa de costo independiente vinculada al movimiento
                const unitCostEntry = Number(itemRequest.unitPrice !== undefined ? itemRequest.unitPrice : catalogPrice);
                const costLayer = prepareEntryCostLayer({
                    movementId: newMovementRef.id,
                    movementRequestNumber: finalRequestNumber,
                    itemId: itemRequest.inventoryItemId,
                    itemCode: itemData.code || itemRequest.inventoryItemCode || '',
                    itemName: itemData.description || itemRequest.inventoryItemName || '',
                    quantity,
                    unitPrice: unitCostEntry,
                    currency,
                    provider: movementData.provider,
                    invoiceReference: movementData.factura || movementData.reference || finalRequestNumber,
                    date: movementData.date,
                    userEmail: currentUser.email || currentUser.name || 'Sistema',
                    index
                });
                costLayersToCreate.push(costLayer);

                unitPrice = unitCostEntry;
                subtotal = quantity * unitCostEntry;
                total = itemRequest.total || (subtotal + (subtotal * 0.13));
                costMethod = 'FIFO';
                costingStatus = isOnline ? 'CONFIRMED' : 'PENDING_COSTING';
            } else if (movementData.type === 'Salida') {
                // Salida: consumir capas PEPS
                const availableLayers = readLayersByItem.get(itemRequest.inventoryItemId) || [];
                const fifoCalc = calculateFifoConsumption({
                    availableLayers,
                    requestedQuantity: quantity,
                    catalogFallbackPrice: catalogPrice,
                    itemCurrency: currency,
                    isOnline
                });

                fifoCalc.layerUpdates.forEach(upd => {
                    costLayersToUpdate.push({
                        ref: doc(db, "inventory_cost_layers", upd.layerId),
                        data: {
                            quantityRemaining: upd.newRemaining,
                            status: upd.newStatus,
                            updatedAt: new Date().toISOString()
                        }
                    });
                });

                unitPrice = fifoCalc.result.weightedUnitCost;
                subtotal = fifoCalc.result.totalCost;
                total = Math.round((subtotal * 1.13) * 100) / 100;
                fifoLayersConsumed = fifoCalc.result.layersConsumed;
                costMethod = fifoCalc.result.costMethod;
                costingStatus = fifoCalc.result.costingStatus;
                isFullyCoveredByLayers = fifoCalc.result.isFullyCoveredByLayers;
                uncoveredQuantity = fifoCalc.result.uncoveredQuantity;
            } else if (movementData.type === 'Devolución' && readReturnLayersMap.size > 0) {
                // Devolución: restaurar capas si existen en la salida vinculada
                const originConsumed: FifoLayerConsumption[] = [];
                readReturnLayersMap.forEach(l => {
                    const consumedAmount = l.quantityOriginal - l.quantityRemaining;
                    if (consumedAmount > 0) {
                        originConsumed.push({
                            layerId: l.id,
                            movementId: l.movementId,
                            date: l.date,
                            quantityConsumed: consumedAmount,
                            unitCost: l.unitCost,
                            currency: l.currency,
                            subtotal: consumedAmount * l.unitCost
                        });
                    }
                });

                if (originConsumed.length > 0) {
                    const restored = calculateFifoReturnRestoration({
                        consumedLayers: originConsumed,
                        quantityToReturn: quantity,
                        currentLayersMap: readReturnLayersMap
                    });

                    restored.layerUpdates.forEach(upd => {
                        costLayersToUpdate.push({
                            ref: doc(db, "inventory_cost_layers", upd.layerId),
                            data: {
                                quantityRemaining: upd.newRemaining,
                                status: upd.newStatus,
                                updatedAt: new Date().toISOString()
                            }
                        });
                    });

                    fifoLayersConsumed = restored.restoredLayers;
                    costMethod = 'FIFO';
                    costingStatus = isOnline ? 'CONFIRMED' : 'PENDING_COSTING';
                }
            }

            processedItems.push({
                inventoryItemId: itemRequest.inventoryItemId,
                inventoryItemCode: itemData.code || 'N/A',
                inventoryItemName: itemData.description || 'N/A',
                quantity: quantity,
                previousStock: currentStock,
                newStock: newStock,
                unitPrice: unitPrice,
                unitCost: unitPrice,
                costTotal: subtotal,
                iva: itemRequest.iva || (subtotal * 0.13),
                total: total,
                subtotal: subtotal,
                currency: currency,
                notes: itemRequest.notes || null,
                costMethod,
                costingStatus,
                fifoLayersConsumed,
                isFullyCoveredByLayers,
                uncoveredQuantity
            });
        });

        // =========================
        // 3. ESCRITURAS
        // =========================

        // Actualizar items de inventario
        itemDocs.forEach((itemDoc, index) => {
            transaction.update(itemDoc.ref, { 
                stock: processedItems[index].newStock,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.email 
            });
        });

        // Crear capas de costo de Entrada
        costLayersToCreate.forEach(layer => {
            const layerRef = doc(db, "inventory_cost_layers", layer.id);
            transaction.set(layerRef, layer);
        });

        // Actualizar capas de costo consumidas o restauradas
        costLayersToUpdate.forEach(({ ref, data }) => {
            transaction.update(ref, data);
        });

        // Actualizar dispatch si es Devolución y tiene dispatchId
        if (movementData.type === 'Devolución' && preFetchedDispatchRef) {
            transaction.update(preFetchedDispatchRef, { items: dispatchItems });
        }

        // Actualizar el contador si fue utilizado
        if (counterRef) {
            transaction.set(counterRef, {
                lastNumber: nextNumber,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }

        // Crear el documento de movimiento
        const mainItem = processedItems[0];
        const isMultiple = processedItems.length > 1;
        const totalMovementCost = processedItems.reduce((acc, it) => acc + (it.costTotal || it.subtotal || 0), 0);
        const totalMovementQty = processedItems.reduce((acc, it) => acc + it.quantity, 0);
        const weightedMovementCost = totalMovementQty > 0 ? (totalMovementCost / totalMovementQty) : mainItem.unitPrice;

        transaction.set(newMovementRef, {
            ...movementData,
            requestNumber: finalRequestNumber,
            // Datos legacy (usamos el primero o un resumen)
            inventoryItemId: mainItem.inventoryItemId,
            inventoryItemCode: mainItem.inventoryItemCode,
            inventoryItemName: isMultiple ? `${mainItem.inventoryItemName} (+${processedItems.length - 1})` : mainItem.inventoryItemName,
            quantity: isMultiple ? 0 : mainItem.quantity,
            unitPrice: mainItem.unitPrice,
            subtotal: totalMovementCost,
            currency: mainItem.currency,
            previousStock: mainItem.previousStock,
            newStock: mainItem.newStock,
            
            // Metadatos PEPS (FIFO)
            costMethod: mainItem.costMethod || 'FIFO',
            costingStatus: mainItem.costingStatus || (isOnline ? 'CONFIRMED' : 'PENDING_COSTING'),
            totalCost: totalMovementCost,
            weightedUnitCost: weightedMovementCost,
            fifoLayersConsumed: mainItem.fifoLayersConsumed,

            // Nueva estructura detallada
            items: processedItems,
            
            createdAt: new Date().toISOString()
        });
      }));
      
      return { success: true };

    } catch (e: any) {
      console.error("Transaction failed: ", e);
      throw new Error(e.message || "Error al registrar el movimiento.");
    }
  }, [currentUser]);

  /**
   * ACTUALIZACIÓN DE MOVIMIENTO (MODO SEGURO CON AJUSTE DE STOCK)
   * Permite actualizar metadatos y también la lista de items.
   * Si se cambian items o cantidades, se ajusta el stock actual del inventario basado en la diferencia.
   */
  const updateMovement = useCallback(async (id: string, movementData: any) => {
    if (!currentUser) throw new Error("No autenticado");

    try {
        await guardedWrite(() => runTransaction(db, async (transaction) => {
            const movementRef = doc(db, "inventory_movements", id);
            const movementDoc = await transaction.get(movementRef);
            
            if (!movementDoc.exists()) {
                throw new Error("El movimiento no existe.");
            }

            const oldData = movementDoc.data() as InventoryMovement;
            const newItemsData = movementData.items || [];
            
            // 1. Identificar todos los productos involucrados (viejos y nuevos)
            const allItemIds = new Set<string>();
            const oldItems = oldData.items || [];
            oldItems.forEach(i => allItemIds.add(i.inventoryItemId));
            newItemsData.forEach((i: any) => allItemIds.add(i.inventoryItemId));

            // 2. Leer estado actual de stock para todos los productos
            const itemRefs = Array.from(allItemIds).map(itemId => doc(db, "inventory_items", itemId));
            const itemDocs = await Promise.all(itemRefs.map(ref => transaction.get(ref)));
            const inventoryState = new Map<string, any>();
            itemDocs.forEach(doc => {
                if (doc.exists()) inventoryState.set(doc.id, doc.data());
            });

            // 3. Procesar diferenciales de stock
            // Revertir stock antiguo
            oldItems.forEach(item => {
                const invItem = inventoryState.get(item.inventoryItemId);
                if (invItem) {
                    if (oldData.type === 'Entrada' || oldData.type === 'Devolución') {
                        invItem.stock = (invItem.stock || 0) - item.quantity;
                    } else {
                        invItem.stock = (invItem.stock || 0) + item.quantity;
                    }
                }
            });

            // Aplicar nuevo stock
            const processedItems: MovementItemDetail[] = [];
            newItemsData.forEach((item: any) => {
                const invItem = inventoryState.get(item.inventoryItemId);
                if (!invItem) throw new Error(`El producto ${item.inventoryItemCode} no existe.`);

                const quantity = Number(item.quantity);
                if (movementData.type === 'Entrada' || movementData.type === 'Devolución') {
                    invItem.stock = (invItem.stock || 0) + quantity;
                } else {
                    if ((invItem.stock || 0) < quantity) {
                        throw new Error(`Stock insuficiente para ${item.inventoryItemName}. Disponible: ${invItem.stock}, Requerido: ${quantity}`);
                    }
                    invItem.stock = (invItem.stock || 0) - quantity;
                }

                processedItems.push({
                    ...item,
                    currency: item.currency || (inventoryState.get(item.inventoryItemId)?.currency) || 'USD',
                    previousStock: (invItem.stock || 0) + (movementData.type === 'Entrada' || movementData.type === 'Devolución' ? -quantity : quantity),
                    newStock: invItem.stock || 0
                });
            });

            // 4. Actualizar inventario
            itemDocs.forEach(doc => {
                const updatedItem = inventoryState.get(doc.id);
                if (updatedItem) {
                    transaction.update(doc.ref, { 
                        stock: updatedItem.stock,
                        updatedAt: new Date().toISOString(),
                        updatedBy: currentUser.email
                    });
                }
            });

            // 5. Actualizar movimiento
            const mainItem = processedItems[0] || ({} as any);
            const isMultiple = processedItems.length > 1;

            transaction.update(movementRef, {
                items: processedItems,
                // Mantener legacy fields actualizados
                inventoryItemId: mainItem.inventoryItemId || oldData.inventoryItemId,
                inventoryItemCode: mainItem.inventoryItemCode || oldData.inventoryItemCode,
                inventoryItemName: isMultiple ? `${mainItem.inventoryItemName} (+${processedItems.length - 1})` : (mainItem.inventoryItemName || oldData.inventoryItemName),
                quantity: isMultiple ? 0 : (mainItem.quantity || 0),
                unitPrice: mainItem.unitPrice || oldData.unitPrice || 0,
                currency: mainItem.currency || oldData.currency || 'USD',
                subtotal: mainItem.subtotal !== undefined ? mainItem.subtotal : (oldData.subtotal || 0),
                
                // Metadatos mutables
                date: movementData.date,
                projectId: movementData.projectId || null,
                projectCode: movementData.projectCode || null,
                projectName: movementData.projectName || null,
                observations: movementData.observations || '',
                origin: movementData.origin || '',
                fdh: movementData.fdh || null,
                torre: movementData.torre || null,
                locationDetails: movementData.locationDetails || null,
                factura: movementData.factura || null,
                linkedRequestId: movementData.linkedRequestId || null,
                requestNumber: movementData.requestNumber || null,
                dispatchId: movementData.dispatchId || null,

                updatedAt: new Date().toISOString(),
                updatedBy: currentUser.email,
                version: (oldData.version || 0) + 1
            });
        }));
    } catch (e: any) {
        console.error("Error updating movement:", e);
        throw new Error(e.message || "No se pudo actualizar el movimiento.");
    }
  }, [currentUser]);

  const deleteMovement = useCallback(async (id: string) => {
    if (!currentUser) throw new Error("No autenticado");
    // Eliminación directa del registro sin revertir stock (según requerimiento de no alterar cálculos)
    await guardedWrite(() => deleteDoc(doc(db, "inventory_movements", id)));
  }, [currentUser]);

  return {
    movements,
    isLoading,
    error,
    addMovement,
    updateMovement,
    deleteMovement,
    loadMore,
    hasMore,
    loadingMore,
    loading: isLoading
  };
};
