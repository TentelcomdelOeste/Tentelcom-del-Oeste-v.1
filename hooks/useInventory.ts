import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit, where, getDocs } from 'firebase/firestore';
import { InventoryItem } from '../inventoryTypes';
import { User } from '../utils/types';
import { setVersionedDocOffline, updateVersionedDocOffline } from '../core/versionControl';
import { localDocStore } from '../core/offline/localDocStore';
import { useUserContext } from '../contexts/UserContext';
import { globalSearchEngine, inventorySearchPlugin } from '../core/search';

import { hasPermission } from '../utils/permissions';

import { logger } from '../utils/logger';

export const useInventory = (currentUser: User | null) => {
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
    const isSupervisorRole = currentUser?.role?.toLowerCase() === 'supervisor';
    const isEmpleadoRole = currentUser?.role?.toLowerCase() === 'empleado';

    const canViewInventory = authReady && currentUser?.uid && (
      currentUser.role === 'admin' || 
      isSupervisorRole ||
      hasPermission(currentUser, 'inventario', 'general') ||
      hasPermission(currentUser, 'inventario', 'solicitudes') ||
      hasPermission(currentUser, 'inventario', 'movimientos') ||
      hasPermission(currentUser, 'trabajos') ||
      can(currentUser, 'inventario.solicitudes') ||
      can(currentUser, 'solicitudes') ||
      isEmpleadoRole
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
      serverItems.forEach(item => itemsMap.set(item.id, item));
      
      // 2. Sobrescribir con locales si son sucios o nuevos
      localItems.forEach(item => {
        const remote = itemsMap.get(item.id);
        if (!remote || item.isDirty) {
          itemsMap.set(item.id, {
            ...remote,
            ...item
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
    const q = query(baseRef, orderBy("description"), limit(currentLimit));
    
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
  }, [authReady, currentUser?.uid, currentLimit]);


  const loadMore = useCallback(() => {
     if (!hasMore || loadingMore) return;
     setLoadingMore(true);
     setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  // Verificar si un código ya existe (para evitar duplicados)
  const checkCodeExists = useCallback(async (code: string, excludeId?: string): Promise<boolean> => {
    const normalizedCode = code.trim().toUpperCase();
    
    // Primero verificar en el estado actual (que es híbrido)
    const localMatch = items.find(i => 
      i.code?.trim().toUpperCase() === normalizedCode && 
      i.id !== excludeId &&
      (i as any).deleted !== true
    );
    
    if (localMatch) return true;

    // Si no estamos en línea, ya verificamos localmente todo lo que podemos
    if (!navigator.onLine) return false;

    if (!authReady || !currentUser) return false;

    try {
      const q = query(collection(db, "inventory_items"), where("code", "==", normalizedCode));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return false;
      
      if (excludeId) {
          return snapshot.docs.some(doc => String(doc.id) !== String(excludeId));
      }
      return true;
    } catch (err) {
      console.warn("Error verificando código en Firestore, usando fallback local:", err);
      return false;
    }
  }, [items, authReady, currentUser]);

  const normalizeItem = (item: any) => ({
    ...item,
    category: item.category ? item.category.toUpperCase() : item.category,
    description: item.description ? item.description.toUpperCase() : item.description,
    location: item.location ? item.location.toUpperCase() : item.location,
  });

  const addInventoryItem = useCallback(async (item: Omit<InventoryItem, 'id' | 'updatedAt' | 'updatedBy'>) => {
    if (!authReady || !currentUser) {
      console.warn('[INVENTORY] Firebase Auth aún no restaurado o sin usuario.');
      throw new Error("No autenticado");
    }
    
    const normalizedItem = normalizeItem(item);
    const exists = await checkCodeExists(normalizedItem.code);
    if (exists) {
        throw new Error(`El código "${normalizedItem.code}" ya existe en el inventario.`);
    }

    const id = crypto.randomUUID();
    const itemData = {
      ...normalizedItem,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.email || 'dev-user@tentelcom.com',
    };

    await setVersionedDocOffline("inventory_items", id, itemData);
    return { ...itemData, id };
  }, [currentUser, checkCodeExists]);

  const updateInventoryItem = useCallback(async (id: string, item: Partial<InventoryItem>) => {
    if (!authReady || !currentUser) {
      console.warn('[INVENTORY] Firebase Auth aún no restaurado o sin usuario.');
      throw new Error("No autenticado");
    }

    const normalizedItem = normalizeItem(item);
    const currentItem = items.find(i => i.id === id);
    
    if (normalizedItem.code && currentItem && normalizedItem.code !== currentItem.code) {
        const exists = await checkCodeExists(normalizedItem.code, id);
        if (exists) {
            throw new Error(`El código "${normalizedItem.code}" ya está en uso por otro material.`);
        }
    }

    const itemData = {
        ...normalizedItem,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || 'dev-user@tentelcom.com'
    };

    await updateVersionedDocOffline("inventory_items", id, itemData);
  }, [currentUser, items, checkCodeExists]);

  const deleteInventoryItem = useCallback(async (id: string) => {
    if (!authReady || !currentUser) {
      console.warn('[INVENTORY] Firebase Auth aún no restaurado o sin usuario.');
      throw new Error("No autenticado");
    }
    
    // Marcar como eliminado offline
    await updateVersionedDocOffline("inventory_items", id, { deleted: true });
    
    // Actualizar estado local inmediatamente para feedback visual
    setItems(prev => prev.filter(i => i.id !== id));
  }, [currentUser]);

  return {
    items: itemsWithReserved,
    isLoading,
    error,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    loadMore,
    hasMore,
    loadingMore,
    loading: isLoading
  };
};