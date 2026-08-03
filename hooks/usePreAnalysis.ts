import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where, getDocs, limit } from 'firebase/firestore';
import { useClients } from './useClients';
import { PreAnalysis } from '../types/preAnalysis.types';
import { User } from '../utils/types';
import { guardedWrite } from '../core/writeGuard';
import { addVersionedDoc, updateVersionedDoc } from '../core/versionControl';
import { useUserContext } from '../contexts/UserContext';

export const usePreAnalysis = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const { addClient } = useClients(currentUser);
  const [simulations, setSimulations] = useState<PreAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!authReady || !currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, "pre_analysis_simulations"), orderBy("createdAt", "desc"), limit(currentLimit));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PreAnalysis));
      setSimulations(list);
      setHasMore(snapshot.docs.length === currentLimit);
      setLoadingMore(false);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, currentLimit, authReady]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setCurrentLimit(prev => prev + 50);
  }, [hasMore, loadingMore]);

  const savePreAnalysis = useCallback(async (data: Omit<PreAnalysis, 'id' | 'createdAt' | 'createdBy'> & { contact?: string }, id?: string) => {
    if (!currentUser) throw new Error("No autenticado");

    // Lógica para guardar nuevo contacto si ha cambiado
    if (data.client && data.contact) {
        const clientsRef = collection(db, "clients");
        const q = query(clientsRef, where("empresa", "==", data.client), where("contacto", "==", data.contact));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            // No existe, se crea un nuevo registro de cliente
            await addClient({ 
                empresa: data.client, 
                contacto: data.contact,
                isActive: true // Por defecto, el nuevo contacto está activo
            });
        }
    }
    
    const { contact: _contact, ...preAnalysisData } = data;

    if (id) {
        // Modo Edición: Actualizar documento existente
        const docRef = doc(db, "pre_analysis_simulations", id);
        await guardedWrite(() => updateVersionedDoc(docRef, {
            ...preAnalysisData,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email
        }));
    } else {
        // Modo Creación: Nuevo documento
        const payload = {
            ...preAnalysisData,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.email,
            status: 'Borrador' as const
        };
        await guardedWrite(() => addVersionedDoc(collection(db, "pre_analysis_simulations"), payload));
    }
  }, [currentUser, addClient]);

  const validateDeletion = useCallback(async (simulation: PreAnalysis): Promise<{ canDelete: boolean; reason?: string }> => {
    // 1. Check Status
    if (simulation.status === 'Convertido' || simulation.status === 'Enviado') {
        return { canDelete: false, reason: `La evaluación está en estado "${simulation.status}" y no puede ser eliminada. Debe revertir el estado o contactar a soporte.` };
    }

    // 2. Check Attachments
    try {
        const attachmentsRef = collection(db, "pre_analysis_simulations", simulation.id, "attachments");
        const snapshot = await getDocs(attachmentsRef);
        if (!snapshot.empty) {
            return { canDelete: false, reason: `La evaluación tiene ${snapshot.size} archivos adjuntos vinculados. Debe eliminar los archivos antes de borrar la evaluación.` };
        }
    } catch (error) {
        console.error("Error checking attachments:", error);
        return { canDelete: false, reason: "Error al verificar archivos adjuntos. Intente nuevamente." };
    }

    return { canDelete: true };
  }, []);

  const deletePreAnalysis = useCallback(async (id: string) => {
    await guardedWrite(() => deleteDoc(doc(db, "pre_analysis_simulations", id)));
  }, []);

  return { simulations, isLoading, savePreAnalysis, deletePreAnalysis, validateDeletion, loadMore, hasMore, loadingMore };
};
