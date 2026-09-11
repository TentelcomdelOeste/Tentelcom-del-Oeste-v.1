import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit, where, getDocs } from 'firebase/firestore';
import { InventoryItem, CodeStatusResult } from '../inventoryTypes';
import { User } from '../utils/types';
import { setVersionedDocOffline, updateVersionedDocOffline } from '../core/versionControl';
import { localDocStore } from '../core/offline/localDocStore';
import { useUserContext } from '../contexts/UserContext';
import { globalSearchEngine, inventorySearchPlugin } from '../core/search';

import { hasPermission, isAdmin } from '../utils/permissions';

import { logger } from '../utils/logger';

export const useInventory = (currentUser: User | null, options?: { fetchAll?: boolean }) => {
  const { authReady } = useUserContext();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination State
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const canViewRequests = authReady && currentUser?.uid && (
      currentUser.role === 'admin' || 
      hasPermission(currentUser, 'inventario', 'solicitudes')
    );
    if (!canViewRequests || !authReady || !currentUser?.uid) return;
    // Fetch material_reports for dynamic reserved stock calculation
    const q = query(collection(db, "material_reports"), where("status", "in", ["Pendiente", "Aprobada"]));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const docs = snapshot.docs || [];
        const requests = docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setMaterialRequests(Array.isArray(requests) ? requests : []);
      } catch (innerError) {
        console.warn("Error procesando reportes de materiales (Offline fallback activado):", innerError);
      }
    }, (err) => {
        logger.warn("Error fetching material requests for inventory (Offline fallback activado):", err);
    });
    return () => {
        unsubscribe();
    };
  }, [currentUser?.uid, currentUser?.role, authReady]);

  const getReservedByItem = useCallback((itemId: string) => {
    const safeRequests = Array.isArray(materialRequests) ? materialRequests : [];
    return safeRequests.reduce((sum, request) => {
      const itemsList = Array.isArray(request.items) ? request.items : [];
      const item = itemsList.find((i: any) => i.inventoryItemId === itemId);
      return sum + (item?.quantityRequested || 0);
    }, 0);
  }, [materialRequests]);

  const itemsWithReserved = useMemo(() => {
    // Ensure items is an array
    const safeItems = Array.isArray(items) ? items : [];

    // 1. Filtrar items inválidos o eliminados
    const validItems = safeItems.filter(item => 
      item && 
      item.id && 
      item.code && 
      (item as any).deleted !== true
    );

    // 2. Eliminar duplicados por código (priorizando el primero encontrado)
    const uniqueItemsMap = new Map<string, InventoryItem>();
    validItems.forEach(item => {
      if (!uniqueItemsMap.has(item.code)) {
        uniqueItemsMap.set(item.code, item);
      }
    });

    const finalItems = Array.from(uniqueItemsMap.values());

    return finalItems.map(item => ({
      ...item,
      reserved: getReservedByItem(item.id)
    }));
  }, [items, getReservedByItem]);

  useEffect(() => {
    const canViewInventory = authReady && currentUser?.uid && (
      isAdmin(currentUser.role) ||
      hasPermission(currentUser, 'inventario', 'general') ||
      hasPermission(currentUser, 'inventario', 'solicitudes') ||
      hasPermission(currentUser, 'inventario', 'movimientos') ||
      hasPermission(currentUser, 'inventario', 'reportes') ||
      hasPermission(currentUser, 'inventario', 'bodegas_vehiculares') ||
      hasPermission(currentUser, 'trabajos')
    );

    // Guard: Prevent queries if Auth is not completely ready and authenticated
    if (!authReady || !currentUser?.uid || !canViewInventory) {
      setIsLoading(false);
      return;
    }
    
    // Función para combinar datos locales y remotos
    const updateHybridItems = async (serverItems: InventoryItem[]) => {
      let localItems: InventoryItem[] = [];
      try {
        const localDocs = await localDocStore.getLocalCollection("inventory_items");
        localItems = localDocs.map(ld => ({
          ...ld.data,
          id: ld.docId,
          isOffline: true,
          isDirty: ld.isDirty
        } as InventoryItem));
      } catch (err) {
        console.warn("Error cargando inventario local:", err);
      }

      const itemsMap = new Map<string, InventoryItem>();
      
      // 1. Priorizar remotos base
      serverItems.forEach(item => {
        if (item && item.id) {
          itemsMap.set(item.id, item);
        }
      });
      
      // 2. Sobrescribir con locales si son sucios o nuevos
      localItems.forEach(item => {
        if (!item || !item.id) return;
        const remote = itemsMap.get(item.id);
        if (!remote || item.isDirty) {
          // Filtrar propiedades con valor undefined para evitar sobrescribir datos válidos del remoto
          const cleanLocal: any = {};
          Object.keys(item).forEach(key => {
            if ((item as any)[key] !== undefined) {
              cleanLocal[key] = (item as any)[key];
            }
          });

          itemsMap.set(item.id, {
            ...remote,
            ...cleanLocal
          });
        }
      });

      const mergedItems = Array.from(itemsMap.values());
      // Ordenar por descripción (mismo criterio que la query)
      mergedItems.sort((a, b) => (a.description || "").localeCompare(b.description || ""));
      
      setItems(mergedItems);
    };

    // Carga inicial local para respuesta inmediata
    updateHybridItems([]);
    
    if (items.length === 0) {
      setIsLoading(true);
    }
    
    // 2) Fetch from Firestore with limit using onSnapshot for real-time updates
    const inventoryCollectionName = "inventory_items";
    const baseRef = collection(db, inventoryCollectionName);
    const q = options?.fetchAll 
      ? query(baseRef, orderBy("description"))
      : query(baseRef, orderBy("description"), limit(currentLimit));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const docs = snapshot.docs || [];
        const fromLocal = snapshot.metadata.hasPendingWrites;
        const serverItems = docs.map(doc => {
          const data = doc.data() || {};
          return {
            ...data,
            id: doc.id,
            code: String(data.code || ""),
            description: String(data.description || "Sin descripción"),
            price: Number(data.price || 0),
            stock: Number(data.stock || 0),
            reserved: Number(data.reserved || 0),
            _sync: {
                status: fromLocal ? "pending" : "synced",
                updatedAt: new Date().toISOString()
            }
          } as InventoryItem;
        });

        const safeItems = Array.isArray(serverItems) ? serverItems : [];
        await updateHybridItems(safeItems);

        // Feed Global Search Engine Incrementally
        try {
          snapshot.docChanges().forEach(change => {
            const data = change.doc.data() || {};
            const item = {
              ...data,
              id: change.doc.id,
              code: String(data.code || ""),
              description: String(data.description || "Sin descripción"),
              price: Number(data.price || 0),
              stock: Number(data.stock || 0),
              reserved: Number(data.reserved || 0),
            } as InventoryItem;
            
            if (change.type === 'removed') {
               globalSearchEngine.removeDocument(`inventory_${item.id}`);
            } else {
               globalSearchEngine.upsertDocument(inventorySearchPlugin.mapToSearchableItem(item));
            }
          });
        } catch (searchError) {
          console.warn("[GlobalSearchEngine] Error alimentando índice inventario:", searchError);
        }

        setHasMore(docs.length === currentLimit);
        setLoadingMore(false);
        setIsLoading(false);
      } catch (innerError) {
        console.warn("Error procesando items de inventario de Firestore:", innerError);
        setIsLoading(false);
      }
    }, (err: any) => {
      if (err.code === 'permission-denied') {
        logger.warn("Acceso restringido al inventario");
      }
      console.warn("Error fetching inventory (Offline fallback activado):", err);
      setError("No se pudo cargar el inventario.");
      setIsLoading(false);
      setLoadingMore(false);
    });

    return () => {
        unsubscribe();
    };
  }, [authReady, currentUser?.uid, currentLimit, options?.fetchAll]);


  const loadMore = useCallback(() => {
     if (!hasMore || loadingMore) return;
     setLoadingMore(true);
     setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  // Verificar el estado detallado de disponibilidad de un código
  const checkCodeStatus = useCallback(async (code: string, excludeId?: string): Promise<CodeStatusResult> => {
    const normalizedCode = code?.trim().toUpperCase();
    if (!normalizedCode) return { status: 'AVAILABLE' };
    
    // 1. Verificar primero en el estado activo actual (híbrido)
    const localActive = items.find(i => 
      i.code?.trim().toUpperCase() === normalizedCode && 
      i.id !== excludeId &&
      (i as any).deleted !== true
    );
    
    if (localActive) {
      return {
        status: 'ACTIVE_EXISTS',
        activeItem: {
          id: localActive.id,
          code: localActive.code,
          description: localActive.description
        }
      };
    }

    // Si no estamos en línea o no hay auth, ya verificamos localmente
    if (!navigator.onLine || !authReady || !currentUser) {
      return { status: 'AVAILABLE' };
    }

    try {
      // 2. Consultar colección inventory_items en Firestore
      const q = query(collection(db, "inventory_items"), where("code", "==", normalizedCode));
      const snapshot = await getDocs(q);
      
      let activeDoc: any = null;
      let deletedDoc: any = null;

      snapshot.docs.forEach(docSnap => {
        if (excludeId && String(docSnap.id) === String(excludeId)) return;
        const data = docSnap.data() || {};
        if (data.deleted === true) {
          if (!deletedDoc) deletedDoc = { id: docSnap.id, ...data };
        } else {
          activeDoc = { id: docSnap.id, ...data };
        }
      });

      if (activeDoc) {
        return {
          status: 'ACTIVE_EXISTS',
          activeItem: {
            id: activeDoc.id,
            code: activeDoc.code || normalizedCode,
            description: activeDoc.description || 'Sin descripción'
          }
        };
      }

      if (deletedDoc) {
        return {
          status: 'PREVIOUSLY_USED',
          previousItem: {
            id: deletedDoc.id,
            code: deletedDoc.code || normalizedCode,
            description: deletedDoc.description,
            source: 'inventory_items'
          }
        };
      }

      // 3. Si no está en inventory_items, verificar en historial de asignaciones
      try {
        const assignQ = query(collection(db, "tool_assignments"), where("itemCode", "==", normalizedCode), limit(1));
        const assignSnap = await getDocs(assignQ);
        if (!assignSnap.empty) {
          const assignData = assignSnap.docs[0].data() || {};
          return {
            status: 'PREVIOUSLY_USED',
            previousItem: {
              id: assignData.itemId,
              code: assignData.itemCode || normalizedCode,
              description: assignData.itemDescription,
              source: 'assignments'
            }
          };
        }
      } catch (histErr) {
        // Fallback no bloqueante si no hay permisos de asignaciones
      }

      return { status: 'AVAILABLE' };
    } catch (err) {
      console.warn("Error verificando código en Firestore, usando fallback local:", err);
      return { status: 'AVAILABLE' };
    }
  }, [items, authReady, currentUser]);

  // Verificar si un código ya existe en materiales ACTIVOS (para compatibilidad)
  const checkCodeExists = useCallback(async (code: string, excludeId?: string): Promise<boolean> => {
    const result = await checkCodeStatus(code, excludeId);
    return result.status === 'ACTIVE_EXISTS';
  }, [checkCodeStatus]);

  const normalizeItem = <T extends Record<string, any>>(item: T): T => {
    const result: any = { ...item };
    if (typeof result.category === 'string') {
      result.category = result.category.toUpperCase();
    }
    if (typeof result.description === 'string') {
      result.description = result.description.toUpperCase();
    }
    if (typeof result.location === 'string') {
      result.location = result.location.toUpperCase();
    }
    return result;
  };

  const addInventoryItem = useCallback(async (item: Omit<InventoryItem, 'id' | 'updatedAt' | 'updatedBy'>) => {
    if (!authReady || !currentUser) {
      console.warn('[INVENTORY] Firebase Auth aún no restaurado o sin usuario.');
      throw new Error("No autenticado");
    }
    
    const normalizedItem = normalizeItem(item);
    const statusResult = await checkCodeStatus(normalizedItem.code);
    if (statusResult.status === 'ACTIVE_EXISTS') {
        throw new Error(`El código "${normalizedItem.code}" ya está en uso por un material activo (${statusResult.activeItem?.description || 'en inventario'}).`);
    }

    const id = crypto.randomUUID();
    const itemData = {
      ...normalizedItem,
      deleted: false,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.email || 'dev-user@tentelcom.com',
    };

    await setVersionedDocOffline("inventory_items", id, itemData);
    
    // Actualizar estado local inmediatamente
    setItems(prev => {
      const next = [...prev.filter(i => i.id !== id), { ...itemData, id } as InventoryItem];
      next.sort((a, b) => (a.description || "").localeCompare(b.description || ""));
      return next;
    });

    return { ...itemData, id };
  }, [currentUser, checkCodeStatus, authReady]);

  const updateInventoryItem = useCallback(async (id: string, item: Partial<InventoryItem>) => {
    if (!authReady || !currentUser) {
      console.warn('[INVENTORY] Firebase Auth aún no restaurado o sin usuario.');
      throw new Error("No autenticado");
    }

    // Depurar propiedades con valor undefined
    const cleanInput: any = {};
    Object.keys(item || {}).forEach(key => {
      const val = (item as any)[key];
      if (val !== undefined) {
        cleanInput[key] = val;
      }
    });

    const normalizedItem = normalizeItem(cleanInput);
    const currentItem = items.find(i => i.id === id);
    
    if (normalizedItem.code && currentItem && normalizedItem.code.trim().toUpperCase() !== currentItem.code.trim().toUpperCase()) {
        const statusResult = await checkCodeStatus(normalizedItem.code, id);
        if (statusResult.status === 'ACTIVE_EXISTS') {
            throw new Error(`El código "${normalizedItem.code}" ya está en uso por otro material activo (${statusResult.activeItem?.description || 'en inventario'}).`);
        }
    }

    const itemData = {
        ...normalizedItem,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || 'dev-user@tentelcom.com'
    };

    // Pasar currentItem como fallbackBaseData para que localDocStore tenga el documento completo si aún no existía en SQLite
    await updateVersionedDocOffline("inventory_items", id, itemData, currentItem);

    // Actualizar estado local preservando todos los campos previos
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        return {
          ...i,
          ...itemData
        };
      }
      return i;
    }));
  }, [currentUser, items, checkCodeStatus, authReady]);

  const deleteInventoryItem = useCallback(async (id: string) => {
    if (!authReady || !currentUser) {
      console.warn('[INVENTORY] Firebase Auth aún no restaurado o sin usuario.');
      throw new Error("No autenticado");
    }
    
    // Marcar como eliminado offline
    await updateVersionedDocOffline("inventory_items", id, { deleted: true });
    
    // Actualizar estado local inmediatamente para feedback visual
    setItems(prev => prev.filter(i => i.id !== id));
  }, [currentUser, authReady]);

  return {
    items: itemsWithReserved,
    isLoading,
    error,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    checkCodeStatus,
    checkCodeExists,
    loadMore,
    hasMore,
    loadingMore,
    loading: isLoading
  };
};