import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  limit,
  where
} from 'firebase/firestore';
import { Quote, User } from '../types';
import { hasPermission } from '../utils/permissions';
import { getYearFromDateString, getMonthFromDateString } from '../utils/dateUtils';
// import { getCached } from '../core/dataCache'; (DESACTIVADO FASE 3)
import { updateVersionedDocOffline } from '../core/versionControl';
import { guardarCotizacionSeguro as guardarCotizacionSeguroService } from '../services/quoteService';
import { useUserContext } from '../contexts/UserContext';
import { localDocStore } from '../core/offline/localDocStore';
import { useLocalCollection } from './useLocalCollection';
import { logger } from '../utils/logger';

const getMsFromDate = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().getTime();
    } catch (_) {
      // ignore
    }
  }
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const useQuotes = (currentUser: User | null, filterYear: number = 0, filterMonth: string = 'all') => {
  const { authReady } = useUserContext();
  const [remoteQuotes, setRemoteQuotes] = useState<Quote[]>([]);
  const localDocuments = useLocalCollection("quotes");
  
  // Pagination State
  const [currentLimit, setCurrentLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // MIGRACIÓN FASE 9D: Merge Reactivo
  const quotes = useMemo(() => {
    const quotesMap = new Map<string, Quote>();
    
    // 1. Prioridad: Documentos remotos
    remoteQuotes.forEach(q => quotesMap.set(q.docId || "", q));
    
    // 2. Sobrescribir con documentos locales si son más nuevos o están sucios (cambios pendientes)
    localDocuments.forEach(ld => {
        const item = { ...ld.data, docId: ld.docId, isOffline: true, isDirty: ld.isDirty } as Quote;
        const docId = ld.docId;
        const remote = quotesMap.get(docId);
        
        if (!remote) {
            quotesMap.set(docId, item);
            return;
        }

        const localUpdatedAt = getMsFromDate(item.updatedAt);
        const remoteUpdatedAt = getMsFromDate(remote.updatedAt);

        // Si el registro local no está pendiente de sincronización, la versión remota debe prevalecer cuando:
        // - isDeleted difiere
        // - updatedAt remoto es más reciente
        if (!ld.isDirty) {
            const isDeletedDiffers = item.isDeleted !== remote.isDeleted;
            const remoteIsMoreRecent = remoteUpdatedAt > localUpdatedAt;

            if (isDeletedDiffers || remoteIsMoreRecent) {
                logger.debug('[QUOTE CONFLICT]', {
                    docId,
                    localUpdatedAt,
                    remoteUpdatedAt,
                    sourceSelected: 'remote'
                });
                // Remoto prevalece (no sobrescribimos el mapa)
                return;
            }
        }

        // Si el local está sucio (pendiente de sincronización) o su fecha/versión técnica es newer/equal:
        const shouldOverwrite = ld.isDirty || 
                                (item.version || 0) >= (remote.version || 0) || 
                                localUpdatedAt >= remoteUpdatedAt;

        if (shouldOverwrite) {
            // Si el remoto ya tiene isDeleted=true, lo respetamos siempre
            if (remote.isDeleted && !item.isDeleted) {
                logger.debug('[QUOTE CONFLICT]', {
                    docId,
                    localUpdatedAt,
                    remoteUpdatedAt,
                    sourceSelected: 'remote' // Respetamos delete en remoto
                });
                return;
            }

            logger.debug('[QUOTE CONFLICT]', {
                docId,
                localUpdatedAt,
                remoteUpdatedAt,
                sourceSelected: 'local'
            });
            quotesMap.set(docId, item);
        }
    });

    // 3. Filtrar Soft Delete y aplicar reglas de negocio
    let merged = Array.from(quotesMap.values()).filter(q => q && !q.isDeleted && q.docId && q.docId !== 'unknown');
    
    // Ordenamiento LÓGICO por ID DESC (069, 067, 064...)
    merged.sort((a, b) => {
        const idA = parseInt(a.id || '0') || 0;
        const idB = parseInt(b.id || '0') || 0;
        
        // Si los IDs son iguales (pasa en raras colisiones de año), desempatar por fecha
        if (idB !== idA) return idB - idA;
        
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return timeB - timeA;
    });

    if (filterYear !== 0) {
        merged = merged.filter(q => {
            if (!q) return false;
            const y = q.year || getYearFromDateString(q.fecha);
            return y === filterYear;
        });
    }
    
    if (filterMonth !== 'all') {
        const mTarget = parseInt(filterMonth);
        merged = merged.filter(q => {
            if (!q) return false;
            
            // Priority: q.month
            if (q.month !== undefined && q.month !== null) {
                return q.month === mTarget;
            }
            
            // Fallback: Parse fecha
            if (q.fecha && typeof q.fecha === 'string') {
                const month = getMonthFromDateString(q.fecha);
                if (!isNaN(month)) {
                    return month === mTarget;
                }
            }
            
            // If we can't determine month, do not filter out
            return true;
        });
    }

    return merged;
  }, [remoteQuotes, localDocuments, filterYear, filterMonth]);

  useEffect(() => {
    if (!authReady || !currentUser) {
      setRemoteQuotes([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    // UNIFICACIÓN DE PERMISOS: Solo permitir 'admin' o permiso explícito de 'cotizaciones'
    // para coincidir exactamente con firestore.rules
    const canViewQuotes = !!(currentUser && (
        currentUser.role === 'admin' ||
        hasPermission(currentUser, 'cotizaciones')
    ));

    if (!canViewQuotes) {
      setRemoteQuotes([]);
      setLoading(false);
      setError("No tiene permisos para visualizar este módulo.");
      return;
    }

    if (remoteQuotes.length === 0) {
      setLoading(true);
    }
    setError(null);
    
    const collectionName = "quotes";
    const baseRef = collection(db, collectionName);
    
    // MIGRACIÓN FASE 9D: Filtrado en SERVIDOR para mayor escala
    let qQuotes;
    const SERVER_LIMIT = 1000;
    const fetchLimit = (filterYear !== 0 || filterMonth !== 'all') ? SERVER_LIMIT : currentLimit;

    if (filterYear !== 0 && filterMonth !== 'all') {
        qQuotes = query(
            baseRef, 
            where("year", "==", filterYear), 
            where("month", "==", parseInt(filterMonth)),
            orderBy("updatedAt", "desc"), 
            limit(SERVER_LIMIT)
        );
    } else if (filterYear !== 0) {
        qQuotes = query(
            baseRef, 
            where("year", "==", filterYear), 
            orderBy("updatedAt", "desc"), 
            limit(SERVER_LIMIT)
        );
    } else {
        qQuotes = query(baseRef, orderBy("updatedAt", "desc"), limit(currentLimit));
    }
    
    const unsubscribe = onSnapshot(qQuotes, async (snapshot) => {
        try {
          // Detectar eliminaciones físicas para limpiar cache local
          for (const change of snapshot.docChanges()) {
            if (change.type === "removed") {
              await localDocStore.removeLocalDoc("quotes", change.doc.id);
            }
          }

          const docs = snapshot.docs || [];
          const remoteData = docs.map(doc => {
            const data = doc.data() || {};
            return {
              ...data,
              docId: doc.id,
              monto: Number(data.monto || 0),
              estado: String(data.estado || 'Pendiente'),
              status: String(data.estado || 'Pendiente'),
              fecha: String(data.fecha || new Date().toISOString())
            } as Quote;
          });
          
          setRemoteQuotes(remoteData);
          setHasMore(docs.length === fetchLimit);
          setLoading(false);
          setError(null);

          // Caching en segundo plano para soporte offline para otros usuarios
          localDocStore.saveLocalDocsBatch("quotes", remoteData).catch(e => {
            console.warn("Error caching quotes batch:", e);
          });
        } catch (innerError) {
            console.warn("Error procesando cotizaciones:", innerError);
            setLoading(false);
        }
    }, (error) => {
        console.warn("Firestore error:", error.message || error);
        
        // Manejo explícito de error de permisos
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          setError("Acceso denegado: No tiene permisos suficientes en Firestore para leer esta colección.");
        } else {
          setError(error.message || "Error al cargar cotizaciones remotas.");
        }
        setLoading(false);
    });
    
    return () => unsubscribe();
  }, [authReady, currentUser?.uid, currentLimit, filterYear, filterMonth]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    setLoading(true);
    setCurrentLimit(prev => prev + 50);
  };
  const saveQuote = async (
    quote: Quote, 
    originalId?: number, 
    originalDate?: string,
    clientData?: any,
    items?: QuoteItem[],
    metaData?: any,
    applyTax: boolean = true,
    total: number = 0,
    isNewClient: boolean = false,
    isClientModified: boolean = false
  ) => {
    
    // Preparar parámetros para el servicio centralizado
    const params: any = {
        quote,
        originalId,
        originalDate,
        clientData: clientData || { empresa: quote.empresa, contacto: quote.contacto, telefono: quote.telefono, correo: quote.correo, codigoCliente: quote.codigoCliente },
        items: items || quote.items,
        metaData: metaData || { moneda: quote.moneda, descuento: quote.descuento || 0, formaPago: quote.formaPago, vigencia: quote.vigencia, notas: quote.observaciones },
        applyTax,
        total,
        isNewClient,
        isClientModified,
        savedClients: [], 
        catalogMap: { byCode: new Map(), byName: new Map() },
        currentUser,
        addClient: async () => {},
        updateClient: async () => {},
        addProduct: async () => {}
    };

    return await guardarCotizacionSeguroService(params);
  };

  const deleteQuote = async (docId: string) => {
    if (!docId || docId === 'unknown') {
        throw new Error("Identificador de documento inválido.");
    }

    if (docId.startsWith('temp_')) {
        // Si es un documento temporal (solo local), simplemente lo eliminamos del store local
        try {
            await localDocStore.removeLocalDoc("quotes", docId);
            return;
        } catch (e) {
            console.error("Error al eliminar documento temporal:", e);
            throw e;
        }
    }
    
    try {
      // MIGRACIÓN FASE 9D: Usar updateVersionedDocOffline para Soft Delete
      await updateVersionedDocOffline("quotes", docId, { isDeleted: true });
    } catch(e) {
      console.error("DELETE ERROR:", e);
      throw e;
    }
  };

  // --- LÓGICA CENTRALIZADA DE ESTADO (CRUDO Y DETERMINISTA) ---
  const updateQuoteStatus = async (docId: string, newStatus: 'Aprobada' | 'Pendiente', ocs: string[] = []) => {
      // MIGRACIÓN FASE 9D: Recuperar la cotización actual para no perder campos críticos (year, month, fecha)
      // al guardar en el store local (SQLite merge logic fallback si no existe previamente local)
      const currentQuote = quotes.find(q => q.docId === docId);
      
      const updates: any = {
          ...(currentQuote || {}),
          estado: newStatus,
          ocNumbers: newStatus === 'Aprobada' ? ocs : [],
          ordenPrincipal: (newStatus === 'Aprobada' && ocs.length > 0) ? ocs[0] : null,
          updatedAt: new Date().toISOString(), // Forzar actualización de tiempo para el sorting
          approvedAt: newStatus === 'Aprobada' ? new Date().toISOString() : null,
          approvedBy: newStatus === 'Aprobada' ? currentUser?.email : null,
          rejectedAt: newStatus === 'Pendiente' ? new Date().toISOString() : null,
          rejectedBy: newStatus === 'Pendiente' ? currentUser?.email : null,
      };

      try {
          // MIGRACIÓN FASE 9D: Usar updateVersionedDocOffline
          await updateVersionedDocOffline("quotes", docId, updates);
      } catch (e) {
          console.error(`❌ Error en updateQuoteStatus (docId: ${docId}):`, e);
          throw e;
      }
  };

  // --- APROBAR (Wrapper) ---
  const approveQuote = async (docId: string, ocNumbers?: string[]) => {
      const validOcs = (ocNumbers || []).filter(oc => oc.trim() !== "");
      await updateQuoteStatus(docId, 'Aprobada', validOcs);
  };

  // --- MARCAR COMO PENDIENTE (Wrapper - EXACTA LÓGICA QUE APROBAR) ---
  const setQuotePending = async (docId: string) => {
      await updateQuoteStatus(docId, 'Pendiente');
  };

  const updateQuoteExchangeRate = async (idOrDocId: number | string, fechaOrRate: string | number | null, rate?: number | null) => {
    let docId: string;
    let finalRate: number | null;

    if (typeof idOrDocId === 'string' && (typeof fechaOrRate === 'number' || fechaOrRate === null) && rate === undefined) {
        docId = idOrDocId;
        finalRate = fechaOrRate as number | null;
    } else {
        const year = getYearFromDateString(fechaOrRate as string);
        docId = `${idOrDocId}-${year}`;
        finalRate = rate ?? null;
    }

    // MIGRACIÓN FASE 9D: Recuperar la cotización actual para no perder campos críticos (year, month, fecha)
    const currentQuote = quotes.find(q => q.docId === docId);

    // MIGRACIÓN FASE 9D: Usar updateVersionedDocOffline
    await updateVersionedDocOffline("quotes", docId, {
      ...(currentQuote || {}),
      exchangeRate: finalRate,
      exchangeRateDate: new Date().toISOString(),
      exchangeRateSource: 'User Manual Update',
      updatedAt: new Date().toISOString()
    });
  };

  const guardarCotizacionSeguro = async (params: any) => {
      return await guardarCotizacionSeguroService(params);
  };

  return {
    quotes,
    saveQuote,
    deleteQuote,
    approveQuote,
    setQuotePending,
    updateQuoteExchangeRate,
    guardarCotizacionSeguro,
    loading,
    error,
    loadMore,
    hasMore
  };
};

export const useAllQuotes = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [remoteQuotes, setRemoteQuotes] = useState<Quote[]>([]);
  const localDocuments = useLocalCollection("quotes");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allQuotes = useMemo(() => {
    const quotesMap = new Map<string, Quote>();
    remoteQuotes.forEach(q => quotesMap.set(q.docId || "", q));
    localDocuments.forEach(ld => {
        const item = { ...ld.data, docId: ld.docId, isOffline: true, isDirty: ld.isDirty } as Quote;
        const docId = ld.docId;
        const remote = quotesMap.get(docId);
        
        if (!remote) {
            quotesMap.set(docId, item);
            return;
        }

        const localUpdatedAt = getMsFromDate(item.updatedAt);
        const remoteUpdatedAt = getMsFromDate(remote.updatedAt);

        // Si el registro local no está pendiente de sincronización, la versión remota debe prevalecer cuando:
        // - isDeleted difiere
        // - updatedAt remoto es más reciente
        if (!ld.isDirty) {
            const isDeletedDiffers = item.isDeleted !== remote.isDeleted;
            const remoteIsMoreRecent = remoteUpdatedAt > localUpdatedAt;

            if (isDeletedDiffers || remoteIsMoreRecent) {
                logger.debug('[QUOTE CONFLICT]', {
                    docId,
                    localUpdatedAt,
                    remoteUpdatedAt,
                    sourceSelected: 'remote'
                });
                // Remoto prevalece (no sobrescribimos el mapa)
                return;
            }
        }

        // Si el local está sucio (pendiente de sincronización) o su fecha/versión técnica es newer/equal:
        const shouldOverwrite = ld.isDirty || 
                                (item.version || 0) >= (remote.version || 0) || 
                                localUpdatedAt >= remoteUpdatedAt;

        if (shouldOverwrite) {
            // Si el remoto ya tiene isDeleted=true, lo respetamos siempre
            if (remote.isDeleted && !item.isDeleted) {
                logger.debug('[QUOTE CONFLICT]', {
                    docId,
                    localUpdatedAt,
                    remoteUpdatedAt,
                    sourceSelected: 'remote' // Respetamos delete en remoto
                });
                return;
            }

            logger.debug('[QUOTE CONFLICT]', {
                docId,
                localUpdatedAt,
                remoteUpdatedAt,
                sourceSelected: 'local'
            });
            quotesMap.set(docId, item);
        }
    });

    const merged = Array.from(quotesMap.values()).filter(q => q && !q.isDeleted && q.docId && q.docId !== 'unknown');
    
    // Ordenamiento LÓGICO por ID DESC (069, 067, 064...)
    merged.sort((a, b) => {
        const idA = parseInt(a.id || '0') || 0;
        const idB = parseInt(b.id || '0') || 0;
        if (idB !== idA) return idB - idA;
        
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return timeB - timeA;
    });

    return merged;
  }, [remoteQuotes, localDocuments]);

  useEffect(() => {
    if (!authReady || !currentUser) return;
    
    // UNIFICACIÓN DE PERMISOS: Solo permitir 'admin' o permiso explícito de 'cotizaciones'
    const canViewQuotes = !!(currentUser && (
        currentUser.role === 'admin' ||
        hasPermission(currentUser, 'cotizaciones')
    ));

    if (!canViewQuotes) {
        setError("No tiene permisos para leer cotizaciones.");
        return;
    }

    setLoading(true);
    setError(null);
    
    const q = query(collection(db, "quotes"), orderBy("updatedAt", "desc"));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Detectar eliminaciones físicas para limpiar cache local
      for (const change of snapshot.docChanges()) {
        if (change.type === "removed") {
          await localDocStore.removeLocalDoc("quotes", change.doc.id);
        }
      }

      const remoteData = snapshot.docs.map(doc => {
          const data = doc.data() || {};
          return {
            ...data,
            docId: doc.id,
            monto: Number(data.monto || 0),
            estado: String(data.estado || 'Pendiente'),
            status: String(data.estado || 'Pendiente'),
            fecha: String(data.fecha || new Date().toISOString())
          } as Quote;
      });

      setRemoteQuotes(remoteData);
      setLoading(false);
      setError(null);

      // Caching en segundo plano
      localDocStore.saveLocalDocsBatch("quotes", remoteData).catch(e => {
        console.warn("Error caching useAllQuotes batch:", e);
      });
    }, (error) => {
      console.error("Error fetching all quotes:", error);
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        setError("Acceso denegado a Firestore: Cotizaciones.");
      } else {
        setError(error.message || "Error al cargar cotizaciones.");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, authReady]);

  return { allQuotes, loading, error };
};
