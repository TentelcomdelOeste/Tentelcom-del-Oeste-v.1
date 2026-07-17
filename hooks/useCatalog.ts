
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit, where, getDocs } from 'firebase/firestore';
import { Product, User } from '../types';
import { setVersionedDocOffline, updateVersionedDocOffline } from '../core/versionControl';
import { useUserContext } from '../contexts/UserContext';

export const useCatalog = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!authReady || !currentUser) {
      setCatalog([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Sync with Firestore (Persistent Mode)
    const q = query(collection(db, "products"), orderBy("nombre"), limit(currentLimit));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const fromLocal = snapshot.metadata.hasPendingWrites;
        const serverItems = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            _sync: {
                status: fromLocal ? "pending" : "synced",
                updatedAt: new Date().toISOString()
            }
          } as Product;
        });

        const safeItems = Array.isArray(serverItems) ? serverItems : [];
        setCatalog(safeItems);
        setHasMore(snapshot.docs.length === currentLimit);
        setLoadingMore(false);
        setIsLoading(false);
      } catch (innerError) {
        console.warn("Error procesando datos de catálogo de Firestore:", innerError);
        setIsLoading(false);
      }
    }, (error) => {
      console.warn("Error loading catalog from Firestore:", error);
      setIsLoading(false);
      setLoadingMore(false);
      // Mantener último estado válido
    });

    return () => unsubscribe();
  }, [currentUser, currentLimit, authReady]);


  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  const addProduct = useCallback(async (product: Product) => {
      const docId = crypto.randomUUID();
      const { id: _id, ...data } = product;
      await setVersionedDocOffline("products", docId, data);
      return { ...data, id: docId };
  }, []);

  const updateProduct = useCallback(async (docId: string, data: Partial<Product>) => {
      return await updateVersionedDocOffline("products", docId, data);
  }, []);
  
  // No usado pero mantenido por compatibilidad
  const addProducts = useCallback(async (products: Product[]) => {
      for (const p of products) {
          await addProduct(p);
      }
  }, [addProduct]);

  const deactivateProduct = useCallback(async (docId: string) => {
      await updateVersionedDocOffline("products", docId, { isActive: false });
  }, []);

  const checkCodeExists = useCallback(async (code: string, excludeId?: string) => {
      try {
        const formattedCode = code.trim().toUpperCase();
        
        // Primero verificamos en el estado local (memoria) que ya está sincronizado
        const localMatch = catalog.find(p => p.codigo?.trim().toUpperCase() === formattedCode && p.id !== excludeId);
        if (localMatch) return true;

        // Si no hay internet, no intentamos consultar Firestore para no bloquear
        if (!navigator.onLine) return false;

        const q = query(collection(db, "products"), where("codigo", "==", formattedCode));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs || [];
        if (excludeId) {
            return docs.some(doc => doc.id !== excludeId);
        }
        return docs.length > 0;
      } catch (error) {
        console.warn("Error verificando existencia de código (Offline fallback activado):", error);
        return false; // Asumimos que no existe para no bloquear la edición offline
      }
  }, [catalog]);

  return {
    catalog,
    setCatalog,
    addProduct,
    updateProduct,
    addProducts,
    deactivateProduct,
    checkCodeExists,
    loadMore,
    hasMore,
    loadingMore,
    loading: isLoading
  };
};
