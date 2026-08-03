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
  limit
} from 'firebase/firestore';
import { InventoryMovement, MovementItemDetail } from '../inventoryMovementTypes';
import { User } from '../utils/types';
import { guardedWrite } from '../core/writeGuard';
import { useUserContext } from '../contexts/UserContext';

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

  // Transacción: Crear Movimiento + Actualizar Stock + Trazabilidad
  // Ahora soporta payload con múltiples items en `itemsData`
  const addMovement = useCallback(async (movementData: any) => {
    if (!currentUser) throw new Error("No autenticado");
    
    // Check handled by guardedWrite, but we can double check logic
    const itemsToProcess: any[] = movementData.items || [];
    if (itemsToProcess.length === 0) throw new Error("No hay items en el movimiento.");

    try {
      // 0. Pre-fetch dispatch data if it's a return
      let preFetchedDispatchRef: any = null;
      
      if (movementData.type === 'Devolución' && movementData.dispatchId) {
          // Referencia directa a la colección correcta solo si hay dispatchId
          preFetchedDispatchRef = doc(db, "material_dispatches", movementData.dispatchId);
      }

      await guardedWrite(() => runTransaction(db, async (transaction) => {
        // =========================
        // 1. TODAS LAS LECTURAS
        // =========================

        // Leer Dispatch si es Devolución y tiene dispatchId
        let dispatchDoc: any = null;
        if (movementData.type === 'Devolución' && preFetchedDispatchRef) {
            dispatchDoc = await transaction.get(preFetchedDispatchRef);
            if (!dispatchDoc.exists()) {
                throw new Error("La entrega (dispatch) no existe");
            }
        }

        // Leer todos los items de inventario
        const itemRefs = itemsToProcess.map(item => 
            doc(db, "inventory_items", item.inventoryItemId)
        );
        const itemDocs = await Promise.all(
            itemRefs.map(ref => transaction.get(ref))
        );

        // =========================
        // 2. VALIDACIONES Y CÁLCULOS
        // =========================
        const processedItems: MovementItemDetail[] = [];
        const dispatchItems = dispatchDoc?.data()?.items || [];
        
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

            const unitPrice = itemRequest.unitPrice || catalogPrice;
            const subtotal = quantity * unitPrice;
            
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

            processedItems.push({
                inventoryItemId: itemRequest.inventoryItemId,
                inventoryItemCode: itemData.code || 'N/A',
                inventoryItemName: itemData.description || 'N/A',
                quantity: quantity,
                previousStock: currentStock,
                newStock: newStock,
                unitPrice: unitPrice,
                iva: itemRequest.iva || 0,
                total: itemRequest.total || subtotal,
                subtotal: subtotal,
                currency: currency
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

        // Actualizar dispatch si es Devolución y tiene dispatchId
        if (movementData.type === 'Devolución' && preFetchedDispatchRef) {
            transaction.update(preFetchedDispatchRef, { items: dispatchItems });
        }

        // Crear el documento de movimiento
        const newMovementRef = doc(collection(db, "inventory_movements"));
        const mainItem = processedItems[0];
        const isMultiple = processedItems.length > 1;

        transaction.set(newMovementRef, {
            ...movementData,
            // Datos legacy (usamos el primero o un resumen)
            inventoryItemId: mainItem.inventoryItemId,
            inventoryItemCode: mainItem.inventoryItemCode,
            inventoryItemName: isMultiple ? `${mainItem.inventoryItemName} (+${processedItems.length - 1})` : mainItem.inventoryItemName,
            quantity: isMultiple ? 0 : mainItem.quantity, // 0 indica que se deben ver los detalles
            unitPrice: mainItem.unitPrice,
            subtotal: mainItem.subtotal,
            currency: mainItem.currency,
            previousStock: mainItem.previousStock,
            newStock: mainItem.newStock,
            
            // Nueva estructura
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
