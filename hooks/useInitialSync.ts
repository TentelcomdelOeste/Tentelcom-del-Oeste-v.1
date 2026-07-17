import { useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  limit
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
  const hasSynced = useRef(false);

  useEffect(() => {
    // Solo ejecutar una vez por sesión
    // Solo si hay usuario autenticado y perfil disponible
    if (!authReady || !userId || !currentUser || hasSynced.current) return;

    hasSynced.current = true;

    const performSync = async () => {
      if (!navigator.onLine) {
        console.info('[InitialSync] Offline detected - skipping network sync');
        return;
      }

      // ── 1. Perfil del usuario ──────────────────────
      // El perfil del usuario ya está siendo sincronizado por UserContext mediante onSnapshot.
      // Se eliminó la lectura redundante getDocs.

      // ── 2. Trabajos activos asignados al usuario ──
      // Solo sincronizar si el usuario tiene permisos de trabajos
      if (hasPermission(currentUser, 'trabajos')) {
        try {
          // La asignación se maneja mediante el array 'cuadrilla' que contiene nombres de usuario o IDs
          const qTrabajos = userName
            ? query(
                collection(db, 'trabajos'),
                where('cuadrilla', 'array-contains', userName),
                where('estado', 'in', ['programado', 'en_proceso', 'reprogramado']),
                limit(50)
              )
            : query(
                collection(db, 'trabajos'),
                where('estado', 'in', ['programado', 'en_proceso', 'reprogramado']),
                limit(50)
              );

          const trabajosSnap = await getDocs(qTrabajos);

          try {
            // ── 1b. Bitácoras ──
            // Obtener los trabajos activos recientes para precargar sus bitácoras
            // Evitamos rehacer el query, simplemente usamos los del paso anterior limitados a 10
            const trabajosRecientes = trabajosSnap.docs.slice(0, 10);
            await Promise.allSettled(
              trabajosRecientes.map(trabajoDoc =>
                getDocs(
                  query(
                    collection(db, 'trabajos', trabajoDoc.id, 'timeline'),
                    limit(20)
                  )
                ).catch(err =>
                  console.warn('[InitialSync] Bitácora sync failed:', trabajoDoc.id, err)
                )
              )
            );
          } catch (err) {
            console.warn('[InitialSync] Bitácora batch failed:', err);
          }
        } catch (err) {
          // Silencioso — sync es best-effort
          console.warn('[InitialSync] Trabajos sync failed:', err);
        }
      } else {
        console.info('[InitialSync] Skipping active jobs sync (no view permissions)');
      }

      // ── 3. Materiales/inventario crítico (deferred) ──────────
      if (hasPermission(currentUser, 'inventario', 'general')) {
        const syncMateriales = async () => {
          if (!navigator.onLine) return;
          try {
            await getDocs(
              query(
                collection(db, 'inventory_items'),
                limit(200)
              )
            );
          } catch (err) {
            console.warn('[InitialSync] Materiales sync failed:', err);
          }
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(syncMateriales, { timeout: 2000 });
        } else {
          syncMateriales();
        }
      } else {
        console.info('[InitialSync] Skipping Materiales sync (no view permissions)');
      }
    };

    let handle: number;
    // Esperar a que el navegador esté en estado idle
    if ('requestIdleCallback' in window) {
      handle = (window as any).requestIdleCallback(() => performSync(), { timeout: 3000 });
    } else {
      handle = window.setTimeout(() => performSync(), 100);
    }

    return () => {
      if ('cancelIdleCallback' in window && handle) {
        (window as any).cancelIdleCallback(handle);
      } else if (handle) {
        clearTimeout(handle);
      }
    };
  }, [authReady, userId, userName, currentUser]);
}
