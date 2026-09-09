import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User } from '../utils/types';
import { InventoryProvider } from '../types/inventoryProvider.types';
import { 
  subscribeInventoryProviders, 
  addInventoryProvider, 
  deleteInventoryProvider, 
  seedInitialProviders 
} from '../services/inventoryProviderService';
import { useUserContext } from '../contexts/UserContext';

export const useInventoryProviders = (
  currentUser: User | null,
  initialProviderNames: string[] = []
) => {
  const { authReady } = useUserContext();
  const [providers, setProviders] = useState<InventoryProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!authReady || !currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeInventoryProviders(
      (updatedList) => {
        setProviders(updatedList);
        setIsLoading(false);
      },
      (err) => {
        setError("Error al cargar proveedores del catálogo");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, authReady]);

  // Sembrar proveedores existentes desde inventario si aún no se ha hecho
  useEffect(() => {
    if (authReady && currentUser?.uid && initialProviderNames.length > 0 && !seededRef.current) {
      seededRef.current = true;
      seedInitialProviders(initialProviderNames, currentUser);
    }
  }, [authReady, currentUser, initialProviderNames]);

  const addProvider = useCallback(async (name: string) => {
    try {
      return await addInventoryProvider(name, currentUser);
    } catch (err: any) {
      console.error("Error al añadir proveedor:", err);
      throw err;
    }
  }, [currentUser]);

  const deleteProvider = useCallback(async (providerIdOrName: string) => {
    try {
      await deleteInventoryProvider(providerIdOrName);
    } catch (err: any) {
      console.error("Error al eliminar proveedor:", err);
      throw err;
    }
  }, []);

  const providerNames = useMemo(() => {
    return providers.map(p => p.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [providers]);

  return {
    providers,
    providerNames,
    addProvider,
    deleteProvider,
    isLoading,
    error
  };
};
