
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { Client, User } from '../types';
import { setVersionedDocOffline, updateVersionedDocOffline } from '../core/versionControl';
import { generateNextClientCode, getNextClientCodePreview } from '../services/clientCodeService';
import { useUserContext } from '../contexts/UserContext';
import { globalSearchEngine, clientSearchPlugin } from '../core/search';

export const useClients = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [savedClients, setSavedClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLimit, setCurrentLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const isDevMode = window.self !== window.top;
    if (!authReady || !currentUser) {
        setSavedClients([]);
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    
    const clientsCollectionName = "clients";
    const baseRef = collection(db, clientsCollectionName);
    const q = isDevMode 
        ? baseRef 
        : query(baseRef, orderBy("empresa"), limit(currentLimit));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const docs = snapshot.docs || [];
        let clients = docs.map(doc => {
            const data = doc.data() || {};
            return {
                ...data,
                id: doc.id,
                empresa: String(data.empresa || "Sin Empresa"),
                contacto: String(data.contacto || "Sin contacto"),
                codigoCliente: String(data.codigoCliente || ""),
                isActive: data.isActive ?? true
            } as Client;
        });
        
        if (!isDevMode) {
          clients = clients.filter(c => c && c.isActive !== false);
        }
        
        const safeClients = Array.isArray(clients) ? clients : [];
        setSavedClients(safeClients);
        setHasMore(docs.length === currentLimit);
        setLoadingMore(false);
        setIsLoading(false);

        // Feed Global Search Engine Incrementally
        try {
          snapshot.docChanges().forEach(change => {
            const data = change.doc.data() as any;
            const client: Client = {
                  ...data,
                  id: change.doc.id,
                  empresa: String(data.empresa || "Sin Empresa"),
                  contacto: String(data.contacto || "Sin contacto"),
                  codigoCliente: String(data.codigoCliente || ""),
                  isActive: data.isActive ?? true
            };
            
            if (change.type === 'removed' || client.isActive === false) {
               globalSearchEngine.removeDocument(`client_${client.id}`);
            } else {
               globalSearchEngine.upsertDocument(clientSearchPlugin.mapToSearchableItem(client));
            }
          });
        } catch (searchError) {
          console.warn("[GlobalSearchEngine] Error alimentando índice:", searchError);
        }

      } catch (innerError) {
        console.warn("Error procesando clientes de Firestore:", innerError);
        setIsLoading(false);
      }
    }, (error) => {
      console.warn("Error fetching clients:", error);
      setIsLoading(false);
      setLoadingMore(false);
    });

    return () => unsubscribe();
  }, [authReady, currentUser?.uid, currentLimit]);


  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setCurrentLimit(prev => prev + 50);
  };

  const getNextClientCode = async (): Promise<string> => {
    return await generateNextClientCode();
  };

  const validateClientCode = (code: string, excludeId?: string): boolean => {
    const formattedCode = code.trim().toUpperCase();
    return !savedClients.some(c => c.codigoCliente?.trim().toUpperCase() === formattedCode && c.id !== excludeId);
  };

  const formatClientCode = (code: string): string => {
    return code.trim().toUpperCase();
  };

  const addClient = async (clientData: Omit<Client, 'id'>) => {
    const docId = crypto.randomUUID();
    const formattedData = {
        ...clientData,
        codigoCliente: clientData.codigoCliente ? formatClientCode(clientData.codigoCliente) : await getNextClientCode()
    };
    await setVersionedDocOffline("clients", docId, formattedData);
    return { ...formattedData, id: docId };
  };

  const updateClient = async (id: string, clientData: Partial<Client>) => {
    const formattedData = {
        ...clientData,
        ...(clientData.codigoCliente && { codigoCliente: formatClientCode(clientData.codigoCliente) })
    };
    return await updateVersionedDocOffline("clients", id, formattedData);
  };

  const deactivateClient = async (id: string) => {
    return await updateVersionedDocOffline("clients", id, { isActive: false });
  };

  return {
    savedClients,
    getNextClientCode,
    getNextClientCodePreview,
    validateClientCode,
    formatClientCode,
    addClient,
    updateClient,
    deactivateClient,
    loadMore,
    hasMore,
    loadingMore,
    loading: isLoading
  };
};
