import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { InventoryCostLayer } from '../types/fifoCostTypes';
import { useUserContext } from '../contexts/UserContext';

export const useInventoryCostLayers = () => {
  const { authReady, currentUser } = useUserContext();
  const [costLayers, setCostLayers] = useState<InventoryCostLayer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'inventory_cost_layers'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const layers = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id
        })) as InventoryCostLayer[];

        setCostLayers(layers);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to inventory cost layers:', err);
        setError('No se pudieron cargar las capas de costo.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser?.uid]);

  return { costLayers, isLoading, error };
};
