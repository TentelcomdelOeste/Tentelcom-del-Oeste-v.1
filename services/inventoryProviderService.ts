import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryProvider } from '../types/inventoryProvider.types';

const COLLECTION_NAME = 'inventory_providers';

export const normalizeProviderName = (name: string): string => {
  return (name || '').trim().toLowerCase();
};

export const getProviderDocId = (name: string): string => {
  const normalized = normalizeProviderName(name);
  // Reemplazar caracteres especiales para un ID seguro en Firestore
  return `prov_${normalized.replace(/[^a-z0-9]/gi, '_')}`;
};

/**
 * Escucha en tiempo real la lista de proveedores registrados en el catálogo
 */
export const subscribeInventoryProviders = (
  onUpdate: (providers: InventoryProvider[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const list: InventoryProvider[] = snapshot.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          normalizedName: data.normalizedName || normalizeProviderName(data.name || ''),
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          isDeleted: data.isDeleted === true
        } as InventoryProvider;
      })
      .filter(p => !p.isDeleted && p.name.trim() !== '');

    onUpdate(list);
  }, (err) => {
    console.error("Error al escuchar proveedores de inventario:", err);
    onError?.(err);
  });
};

/**
 * Registra un nuevo proveedor en el catálogo si no existe previamente
 */
export const addInventoryProvider = async (
  name: string, 
  currentUser?: { email?: string; name?: string; uid?: string } | null
): Promise<InventoryProvider | null> => {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const docId = getProviderDocId(trimmed);
  const docRef = doc(db, COLLECTION_NAME, docId);

  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      const data = existing.data();
      // Si estaba marcado como eliminado, lo reactivamos
      if (data.isDeleted) {
        await setDoc(docRef, {
          name: trimmed,
          normalizedName: normalizeProviderName(trimmed),
          isDeleted: false,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.email || currentUser?.name || 'Sistema'
        }, { merge: true });
      }
      return {
        id: docId,
        name: trimmed,
        normalizedName: normalizeProviderName(trimmed)
      };
    }

    const newProvider: InventoryProvider = {
      id: docId,
      name: trimmed,
      normalizedName: normalizeProviderName(trimmed),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.email || currentUser?.name || 'Sistema',
      isDeleted: false
    };

    await setDoc(docRef, newProvider);
    return newProvider;
  } catch (error) {
    console.error("Error al registrar proveedor en Firestore:", error);
    throw error;
  }
};

/**
 * Elimina un proveedor del catálogo (soft delete / remove from catalog)
 * Sin afectar ningún movimiento histórico
 */
export const deleteInventoryProvider = async (providerIdOrName: string): Promise<void> => {
  if (!providerIdOrName) return;

  const docId = providerIdOrName.startsWith('prov_') 
    ? providerIdOrName 
    : getProviderDocId(providerIdOrName);
    
  const docRef = doc(db, COLLECTION_NAME, docId);

  try {
    // Marcamos como eliminado para evitar que se vuelva a agregar por bootstrapping y lo eliminamos
    await setDoc(docRef, {
      isDeleted: true,
      deletedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error("Error al eliminar proveedor del catálogo:", error);
    throw error;
  }
};

/**
 * Carga inicial / sincronización de proveedores preexistentes
 */
export const seedInitialProviders = async (
  names: string[],
  currentUser?: { email?: string; name?: string } | null
): Promise<void> => {
  if (!names || names.length === 0) return;

  try {
    const existingSnap = await getDocs(collection(db, COLLECTION_NAME));
    const existingMap = new Map<string, any>();
    existingSnap.docs.forEach(d => {
      existingMap.set(d.id, d.data());
    });

    const writes: Promise<void>[] = [];

    for (const rawName of names) {
      const trimmed = (rawName || '').trim();
      if (!trimmed) continue;
      const docId = getProviderDocId(trimmed);
      
      // Solo insertamos si no existe en absoluto (ni siquiera como borrado)
      if (!existingMap.has(docId)) {
        const docRef = doc(db, COLLECTION_NAME, docId);
        writes.push(
          setDoc(docRef, {
            id: docId,
            name: trimmed,
            normalizedName: normalizeProviderName(trimmed),
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.email || 'Sistema (Inventario)',
            isDeleted: false
          })
        );
      }
    }

    if (writes.length > 0) {
      await Promise.all(writes);
    }
  } catch (error) {
    console.warn("Advertencia al sincronizar proveedores existentes:", error);
  }
};
