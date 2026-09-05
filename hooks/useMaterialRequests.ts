import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, limit, doc, getDoc, getDocs, deleteDoc, orderBy, runTransaction, increment } from 'firebase/firestore';
import { MaterialRequest, RequestStatus } from '../dispatchTypes';
import { User } from '../utils/types';
import { hasPermission, isAdmin } from '../utils/permissions';
import { updateVersionedDoc } from '../core/versionControl';
import { useUserContext } from '../contexts/UserContext';

import { logger } from '../utils/logger';

export const useMaterialRequests = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination State
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canView = authReady && currentUser?.uid && (
      isAdmin(currentUser.role) || 
      hasPermission(currentUser, 'inventario', 'solicitudes') ||
      hasPermission(currentUser, 'inventario', 'reportes')
    );

    if (!canView || (!auth.currentUser && navigator.onLine)) {
      setIsLoading(false);
      return;
    }

    if (requests.length === 0) {
      setIsLoading(true);
    }
    
    const isDevMode = window.self !== window.top;

    // 2) Sync with Firestore
    const materialRequestsCollectionName = "material_reports";
    const canViewAll = isAdmin(currentUser?.role) || 
                       hasPermission(currentUser, 'inventario', 'solicitudes') ||
                       hasPermission(currentUser, 'inventario', 'reportes');
    
    const baseRef = collection(db, materialRequestsCollectionName);
    let q;
    if (isDevMode) {
        q = baseRef;
    } else if (canViewAll) {
        q = query(baseRef, orderBy("createdAt", "desc"), limit(currentLimit));
    } else {
        q = query(baseRef, where("requestedBy", "==", currentUser?.uid || currentUser?.id), orderBy("createdAt", "desc"), limit(currentLimit));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // logger.log("Material requests loaded:", snapshot.size);
      
      const serverItems = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id
        } as MaterialRequest;
      });

      // Garantizar orden descendente por createdAt
      const sortedItems = [...serverItems].sort((a, b) => {
        const dateA = a.createdAt || a.date || '';
        const dateB = b.createdAt || b.date || '';
        return dateB.localeCompare(dateA);
      });

      setRequests(sortedItems);
      setHasMore(snapshot.docs.length === currentLimit);
      setLoadingMore(false);

      setIsLoading(false);
    }, (err: any) => {
      if (err.code === 'permission-denied') {
        logger.warn("Acceso restringido a solicitudes de material");
        setIsLoading(false);
        return;
      }
      logger.error("Error fetching material requests:", err);
      console.error(err);
      setError("Error al cargar solicitudes.");
      setIsLoading(false);
      setLoadingMore(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.role, currentLimit, authReady]);

  const loadMore = useCallback(() => {
     if (!hasMore || loadingMore) return;
     setLoadingMore(true);
     setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  const sanitizeData = (data: any) => {
    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        sanitized[key] = null;
      }
    });
    return sanitized;
  };

  const createRequest = useCallback(async (requestData: Omit<MaterialRequest, 'id' | 'createdAt' | 'status'>) => {
    if (!currentUser) throw new Error("No autenticado");
    
    const id = crypto.randomUUID();
    // REPARACIÓN DE IDS: Asegurar que usamos IDs de documento reales
    const inventorySnap = await getDocs(collection(db, "inventory_items"));
    const inventoryMap = new Map(inventorySnap.docs.map(d => [d.data().code.trim().toUpperCase(), d.id]));

    const repairedItems = requestData.items.map(item => {
        const realId = inventoryMap.get(item.code.trim().toUpperCase());
        if (realId && realId !== item.inventoryItemId) {
            return { ...item, inventoryItemId: realId };
        }
        return item;
    });

    const isVehicleTransfer = (requestData as any).destinationType === 'vehicle';

    const newRequestData = sanitizeData({
        ...requestData,
        id,
        items: repairedItems,
        status: (requestData as any).status || ('Pendiente' as RequestStatus),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email,
        syncStatus: 'synced',
        createdOffline: false
    });

    /* (DESACTIVADO EN FASE 3 - Firestore maneja offline nativamente)
    */

    // 1. Generate dispatchId and requestNumber
    const lastRequestQuery = query(collection(db, "material_reports"), orderBy("createdAt", "desc"), limit(1));
    const lastRequestSnap = await getDocs(lastRequestQuery);
    
    let nextDispatchNumber = 1;
    const currentYear = new Date().getFullYear();
    
    if (!lastRequestSnap.empty) {
        const lastRequest = lastRequestSnap.docs[0].data();
        
        // Dispatch ID logic
        if (lastRequest.dispatchId) {
            const parts = lastRequest.dispatchId.split('-');
            if (parts.length === 3) {
                const lastYear = parseInt(parts[2]);
                if (lastYear === currentYear) {
                    nextDispatchNumber = parseInt(parts[1]) + 1;
                }
            }
        }
    }
    
    const dispatchId = `DSP-${String(nextDispatchNumber).padStart(4, '0')}-${currentYear}`;

    // Transactional creation with reservation and requestNumber generation
    let finalRequestNumber = '';
    await runTransaction(db, async (transaction) => {
        // 1. READS (ALL)
        
        // A. Read counter
        const counterRef = doc(db, "counters", "requestNumber");
        const counterSnap = await transaction.get(counterRef);
        
        // B. Read all inventory items
        const itemSnaps = [];
        for (const item of repairedItems) {
            const itemRef = doc(db, "inventory_items", item.inventoryItemId);
            const itemSnap = await transaction.get(itemRef);
            if (!itemSnap.exists()) {
                throw new Error(`El ítem con ID ${item.inventoryItemId} (${item.code}) no existe en inventario.`);
            }
            itemSnaps.push({ item, itemSnap });
        }

        // 2. CALCULATIONS
        
        // Counter calculation
        let lastNumber = 0;
        if (counterSnap.exists()) {
            lastNumber = counterSnap.data().lastNumber || 0;
        }
        const newNumber = lastNumber + 1;
        finalRequestNumber = `SOL-${String(newNumber).padStart(4, '0')}`;

        // 3. ESCRITURAS (transaction.update, transaction.set)
        
        // Update counter
        transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });

        // Update inventory items
        const updatedItems = [...repairedItems];
        for (let i = 0; i < itemSnaps.length; i++) {
            const { item, itemSnap } = itemSnaps[i];
            const itemRef = doc(db, "inventory_items", item.inventoryItemId);
            const currentStock = itemSnap.data().stock || 0;
            const currentReserved = itemSnap.data().reserved || 0;
            const available = Math.max(0, currentStock - currentReserved);
            
            if (isVehicleTransfer) {
                // En traslados a bodega vehicular, descontamos stock físico directamente
                const qtyToDeduct = Math.min(item.quantityRequested, currentStock);
                updatedItems[i] = {
                    ...item,
                    shortageQty: 0
                };
                if (qtyToDeduct > 0) {
                    transaction.update(itemRef, {
                        stock: increment(-qtyToDeduct)
                    });
                }
            } else {
                // Solicitud normal de proyecto: reservamos solo lo disponible
                const qtyToReserve = Math.min(item.quantityRequested, available);
                updatedItems[i] = {
                    ...item,
                    shortageQty: Math.max(0, item.quantityRequested - qtyToReserve)
                };

                if (qtyToReserve > 0) {
                    transaction.update(itemRef, {
                        reserved: increment(qtyToReserve)
                    });
                }
            }
        }

        // Create the request
        const reqRef = doc(db, "material_reports", id);
        transaction.set(reqRef, { ...newRequestData, items: updatedItems, dispatchId, requestNumber: finalRequestNumber });
    });
    
    setRequests(prev => [{ ...newRequestData, dispatchId, requestNumber: finalRequestNumber }, ...prev]);

    return { id, requestNumber: finalRequestNumber };
  }, [currentUser]);

  const updateRequest = useCallback(async (id: string, updates: Partial<MaterialRequest>) => {
      if (!currentUser) throw new Error("No autenticado");

      const reqRef = doc(db, "material_reports", id);
      const reqSnap = await getDoc(reqRef);

      if (!reqSnap.exists()) {
          setRequests(prev => prev.filter(req => req.id !== id));
          logger.warn("Solicitud no encontrada en servidor (update). Eliminada de vista local.");
          return; // Silently return instead of throwing
      }
      
      const currentData = reqSnap.data() as MaterialRequest;

      if (currentData.status === 'Eliminada') {
          throw new Error("No se puede editar una solicitud ya eliminada.");
      }

      if (currentData.status !== 'Pendiente') {
          throw new Error("Solo se pueden editar solicitudes en estado 'Pendiente'.");
      }

      const sanitizedUpdates = sanitizeData(updates);

      if (sanitizedUpdates.items) {
          // REPARACIÓN DE IDS: Antes de procesar, nos aseguramos de que todos los items tengan el ID de documento correcto
          // Esto es necesario para solicitudes antiguas que guardaron el ID de los datos.
          // Necesitamos el inventario actual para esto.
          const inventorySnap = await getDocs(collection(db, "inventory_items"));
          const inventoryMap = new Map(inventorySnap.docs.map(d => [d.data().code.trim().toUpperCase(), d.id]));

          const repairItems = (items: any[]) => items.map(item => {
              const realId = inventoryMap.get(item.code.trim().toUpperCase());
              if (realId && realId !== item.inventoryItemId) {
                  return { ...item, inventoryItemId: realId };
              }
              return item;
          });

          await runTransaction(db, async (transaction) => {
              const currentItems = repairItems(currentData.items || []);
              const newItems = repairItems(sanitizedUpdates.items || []);
              
              const inventoryUpdates: Record<string, number> = {};
              
              // Restar reservas anteriores (considerando faltantes)
              for (const item of currentItems) {
                  const reservedBefore = Math.max(0, item.quantityRequested - (item.shortageQty || 0));
                  inventoryUpdates[item.inventoryItemId] = (inventoryUpdates[item.inventoryItemId] || 0) - reservedBefore;
              }
              
              // Sumar nuevas reservas (calculando faltantes sobre el stock actual)
              const preparedItems = [...newItems];
              for (let i = 0; i < preparedItems.length; i++) {
                  const item = preparedItems[i];
                  const itemRef = doc(db, "inventory_items", item.inventoryItemId);
                  const itemDoc = await transaction.get(itemRef);
                  
                  if (!itemDoc.exists()) {
                      throw new Error(`El ítem con ID ${item.inventoryItemId} no existe en inventario.`);
                  }

                  const currentStock = itemDoc.data().stock || 0;
                  const currentReserved = itemDoc.data().reserved || 0;
                  const available = Math.max(0, currentStock - currentReserved);

                  // Calculamos cuánto podemos reservar ahora
                  const qtyToReserve = Math.min(item.quantityRequested, available);
                  
                  // Actualizamos el item con el nuevo shortageQty
                  preparedItems[i] = {
                      ...item,
                      shortageQty: Math.max(0, item.quantityRequested - qtyToReserve)
                  };

                  inventoryUpdates[item.inventoryItemId] = (inventoryUpdates[item.inventoryItemId] || 0) + qtyToReserve;
              }
              
              // Leer items de inventario de nuevo para aplicar cambios finales (o usar cache de transaction.get)
              const itemsToUpdate = [];
              for (const itemId of Object.keys(inventoryUpdates)) {
                  const delta = inventoryUpdates[itemId];
                  if (delta !== 0) {
                      const itemRef = doc(db, "inventory_items", itemId);
                      // Realizamos un fresh get para seguridad
                      const itemDoc = await transaction.get(itemRef);
                      itemsToUpdate.push({ itemRef, itemDoc, delta });
                  }
              }
              
              // Aplicar las escrituras una vez realizadas todas las lecturas
              for (const { itemRef, itemDoc, delta } of itemsToUpdate) {
                  const currentReserved = itemDoc.data().reserved || 0;
                  const newReserved = Math.max(0, currentReserved + delta);
                  
                  transaction.update(itemRef, {
                      reserved: newReserved
                  });
              }
              
              transaction.update(reqRef, {
                  ...sanitizedUpdates,
                  items: preparedItems,
                  updatedAt: new Date().toISOString(),
                  updatedBy: currentUser.email
              });
          });
      } else {
          await updateVersionedDoc(reqRef, {
              ...sanitizedUpdates,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.email
          });
      }
  }, [currentUser]);

  const deleteRequest = useCallback(async (id: string) => {
      if (!currentUser) throw new Error("No autenticado");

      const reqRef = doc(db, "material_reports", id);
      const reqSnap = await getDoc(reqRef);

      if (!reqSnap.exists()) {
          setRequests(prev => prev.filter(req => req.id !== id));
          logger.warn("Solicitud no encontrada en servidor (delete). Eliminada de vista local.");
          return; // Silently return
      }
      
      const currentData = reqSnap.data() as MaterialRequest;

      // VALIDACIÓN DE INTEGRIDAD: Si ya está eliminada, borrarla permanentemente
      if (currentData.status === 'Eliminada') {
          await deleteDoc(reqRef);
          return;
      }

      // REGLA DE NEGOCIO: No borrar si está en proceso crítico
      if (currentData.status === 'Aprobada') {
          throw new Error("No se pueden eliminar solicitudes Aprobadas. Debe Rechazar primero si desea descartarla.");
      }

      // Verificar permisos: Admin o usuario con permiso de solicitudes (o el propio solicitante si está pendiente)
      const isCreator = currentData.requestedBy === currentUser.id;
      const isAdminOrPermitted = isAdmin(currentUser.role) || hasPermission(currentUser, 'inventario', 'solicitudes');
      
      if (!isAdminOrPermitted && !isCreator) {
          throw new Error("No tienes permiso para eliminar esta solicitud.");
      }

      if (isCreator && !isAdminOrPermitted && currentData.status !== 'Pendiente' && currentData.status !== 'Rechazada') {
           throw new Error("Solo puedes eliminar tus propias solicitudes si están Pendientes o Rechazadas.");
      }

      // Borrado lógico oficial
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
                  const reservedByThisItem = Math.max(0, item.quantityRequested - (item.shortageQty || 0));
                  const newReserved = Math.max(0, currentReserved - reservedByThisItem);
                  
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

  const updateRequestStatus = useCallback(async (requestId: string, status: RequestStatus) => {
      if (!currentUser) throw new Error("No autenticado");
      
      if (!isAdmin(currentUser.role)) {
          throw new Error("Solo un administrador puede aprobar o rechazar solicitudes.");
      }

      const reqRef = doc(db, "material_reports", requestId);
      const reqSnap = await getDoc(reqRef);
      if (reqSnap.exists() && reqSnap.data().status === 'Eliminada') {
          throw new Error("No se puede cambiar el estado de una solicitud eliminada.");
      }

      const updateData: any = { 
          status,
          updatedAt: new Date().toISOString()
      };
      if (status === 'Aprobada' || status === 'Rechazada') {
          updateData.approvalDate = new Date().toISOString();
          updateData.approvedBy = currentUser.email;
      }

      await runTransaction(db, async (transaction) => {
          const freshSnap = await transaction.get(reqRef);
          if (!freshSnap.exists()) throw new Error("Solicitud no encontrada.");
          const currentStatus = freshSnap.data().status;
          const RESERVATION_STATES = ['Pendiente', 'Aprobada'];

          // Si se rechaza y estaba Pendiente o Aprobada, liberar reserva
          if (status === 'Rechazada' && RESERVATION_STATES.includes(currentStatus)) {
              const itemsToRelease = freshSnap.data().items || [];
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
                  const reservedByThisItem = Math.max(0, item.quantityRequested - (item.shortageQty || 0));
                  const newReserved = Math.max(0, currentReserved - reservedByThisItem);
                  
                  const itemRef = doc(db, "inventory_items", item.inventoryItemId);
                  transaction.update(itemRef, {
                      reserved: newReserved
                  });
              }
          }

          transaction.update(reqRef, updateData);
      });
  }, [currentUser]);

  return {
    requests: Array.isArray(requests) ? requests : [],
    isLoading,
    error,
    createRequest,
    updateRequest,
    deleteRequest,
    updateRequestStatus,
    loadMore,
    hasMore,
    loadingMore,
    loading: isLoading
  };
};