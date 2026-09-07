import { useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../utils/types';
import { hasPermission } from '../utils/permissions';
import { useAuth } from './useAuth';

interface InitialSyncOptions {
  userId: string | null;
  userName?: string | null;
  currentUser: User | null;
}

export function useInitialSync({ userId, userName, currentUser }: InitialSyncOptions): void {
  const { authReady } = useAuth();

  // Ref que indica si la sincronización inicial ya se completó exitosamente para el usuario actual
  const syncCompletedRef = useRef(false);
  // Ref para prevenir ejecuciones concurrentes / dobles
  const isSyncingRef = useRef(false);
  // Ref para rastrear el ID del usuario actual y resetear la sincronización si cambia de sesión
  const lastUserIdRef = useRef<string | null>(null);

  // Guardar temporizadores para limpieza en desmontaje
  const timerHandlesRef = useRef<number[]>([]);

  const scheduleIdleTask = useCallback((task: () => Promise<void> | void, timeout = 3000): number => {
    let handle: number;
    if ('requestIdleCallback' in window) {
      handle = (window as any).requestIdleCallback(() => {
        task();
      }, { timeout });
    } else {
      handle = window.setTimeout(() => {
        task();
      }, 500);
    }
    timerHandlesRef.current.push(handle);
    return handle;
  }, []);

  const performProgressiveSync = useCallback(async () => {
    if (!navigator.onLine) {
      console.info('[InitialSync] Dispositivo offline — sincronización diferida hasta recuperar conexión');
      return;
    }

    if (isSyncingRef.current || syncCompletedRef.current) {
      return;
    }

    if (!userId || !currentUser) {
      return;
    }

    isSyncingRef.current = true;
    console.info('[InitialSync] Iniciando sincronización progresiva inicial...');

    try {
      let activeJobDocs: QueryDocumentSnapshot<DocumentData>[] = [];

      // ── PRIORIDAD 2 — DATOS CRÍTICOS: Trabajos activos asignados al usuario ──
      if (hasPermission(currentUser, 'trabajos')) {
        try {
          const qTrabajos = userName
            ? query(
                collection(db, 'trabajos'),
                where('cuadrilla', 'array-contains', userName),
                where('estado', 'in', ['programado', 'en_proceso', 'reprogramado']),
                limit(25)
              )
            : query(
                collection(db, 'trabajos'),
                where('estado', 'in', ['programado', 'en_proceso', 'reprogramado']),
                limit(25)
              );

          const trabajosSnap = await getDocs(qTrabajos);
          activeJobDocs = trabajosSnap.docs;
          console.info(`[InitialSync] Prioridad 2: ${activeJobDocs.length} trabajos activos sincronizados`);
        } catch (err) {
          console.warn('[InitialSync] Error en Prioridad 2 (Trabajos):', err);
        }
      } else {
        console.info('[InitialSync] Prioridad 2 omitida (sin permisos de trabajos)');
      }

      // Recomprobar conectividad antes de continuar con etapas diferidas
      if (!navigator.onLine) {
        console.info('[InitialSync] Conexión perdida durante sincronización de datos críticos');
        return;
      }

      // ── PRIORIDAD 3 — DATOS DIFERIBLES: Inventario general crítico ──
      if (hasPermission(currentUser, 'inventario', 'general')) {
        try {
          const qInventory = query(
            collection(db, 'inventory_items'),
            limit(60)
          );
          const inventorySnap = await getDocs(qInventory);
          console.info(`[InitialSync] Prioridad 3: ${inventorySnap.size} items de inventario sincronizados`);
        } catch (err) {
          console.warn('[InitialSync] Error en Prioridad 3 (Inventario):', err);
        }
      } else {
        console.info('[InitialSync] Prioridad 3 omitida (sin permisos de inventario)');
      }

      // Recomprobar conectividad antes de la etapa final
      if (!navigator.onLine) {
        console.info('[InitialSync] Conexión perdida antes de sincronizar bitácoras');
        return;
      }

      // ── PRIORIDAD 4 — TIMELINES: Bitácoras progresivas de trabajos prioritarios ──
      if (hasPermission(currentUser, 'trabajos') && activeJobDocs.length > 0) {
        try {
          // Filtrar primero los trabajos 'en_proceso', o tomar los primeros 4 trabajos
          const inProgressJobs = activeJobDocs.filter(d => d.data()?.estado === 'en_proceso');
          const targetJobsForTimeline = (inProgressJobs.length > 0 ? inProgressJobs : activeJobDocs).slice(0, 4);

          // Cargar bitácoras con límite reducido por trabajo (10 eventos max)
          await Promise.allSettled(
            targetJobsForTimeline.map(jobDoc =>
              getDocs(
                query(
                  collection(db, 'trabajos', jobDoc.id, 'timeline'),
                  limit(10)
                )
              ).catch(err =>
                console.warn(`[InitialSync] Bitácora del trabajo ${jobDoc.id} falló:`, err)
              )
            )
          );
          console.info(`[InitialSync] Prioridad 4: Bitácoras precargadas para ${targetJobsForTimeline.length} trabajos prioritarios`);
        } catch (err) {
          console.warn('[InitialSync] Error en Prioridad 4 (Bitácoras):', err);
        }
      }

      // Si llegamos aquí con conexión, marcar la sincronización como completada con éxito
      syncCompletedRef.current = true;
      console.info('[InitialSync] Sincronización progresiva inicial completada exitosamente');
    } catch (err) {
      console.warn('[InitialSync] Error general durante sincronización inicial:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [userId, userName, currentUser]);

  useEffect(() => {
    // Resetear sincronización si cambió el usuario
    if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
      syncCompletedRef.current = false;
      isSyncingRef.current = false;
    }
    lastUserIdRef.current = userId;

    if (!authReady || !userId || !currentUser) {
      return;
    }

    // 1. Programar la sincronización en segundo plano de forma no bloqueante
    if (!syncCompletedRef.current && !isSyncingRef.current) {
      scheduleIdleTask(() => {
        performProgressiveSync();
      }, 3000);
    }

    // 2. Manejar reconexión a Internet
    const handleOnline = () => {
      console.info('[InitialSync] Reconexión detectada. Evaluando sincronización pendiente...');
      if (!syncCompletedRef.current && !isSyncingRef.current) {
        scheduleIdleTask(() => {
          performProgressiveSync();
        }, 1000);
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      // Limpiar callbacks diferidos
      timerHandlesRef.current.forEach(handle => {
        if ('cancelIdleCallback' in window) {
          try { (window as any).cancelIdleCallback(handle); } catch { /* ignore */ }
        }
        clearTimeout(handle);
      });
      timerHandlesRef.current = [];
    };
  }, [authReady, userId, currentUser, performProgressiveSync, scheduleIdleTask]);
}

