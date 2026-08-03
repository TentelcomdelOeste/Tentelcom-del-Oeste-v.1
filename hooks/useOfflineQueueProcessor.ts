import { useEffect, useCallback } from 'react'
import {
  getPendingActions,
  removeAction,
  incrementRetry,
  OfflineAction
} from './useOfflineQueue'
import {
  doc, updateDoc, addDoc, setDoc,
  collection, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { eventBus } from '../modules/core/eventBus'

const MAX_RETRIES = 3

// Ejecutar una acción individual contra Firestore
async function executeAction(
  action: OfflineAction
): Promise<void> {

  const { type, payload } = action

  switch (type) {

    case 'CAMBIO_ESTADO_TRABAJO': {
      // payload: { trabajoId: string, nuevoEstado: string }
      const ref = doc(
        db, 'trabajos', payload.trabajoId as string
      )
      await updateDoc(ref, {
        estado:    payload.nuevoEstado,
        actualizado_en: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      break
    }

    case 'MENSAJE_BITACORA': {
      // payload: { trabajoId: string, texto: string, autorNombre: string, autorId: string, commentPayload?: object, timelineId?: string }
      const commentPay = (payload.commentPayload as any) || {};
      const msgTexto = (payload.texto as string) || commentPay.mensaje || '';
      const uId = (payload.autorId as string) || commentPay.usuarioId || '';
      const uName = (payload.autorNombre as string) || commentPay.usuarioNombre || '';
      
      const timelineId = payload.timelineId as string | undefined;

      const timelineRef = timelineId
        ? collection(db, "operational_timelines", timelineId, "events")
        : collection(
            db,
            (payload.parentCollection as string) || 'trabajos',
            (payload.parentId as string) || (payload.trabajoId as string),
            'timeline'
          );

      await addDoc(
        timelineRef,
        {
          ...commentPay,
          tipo: commentPay.tipo || "comentario",
          mensaje: msgTexto,
          usuarioId: uId,
          usuarioNombre: uName,
          timestamp: (commentPay as any).timestamp || serverTimestamp(),
          editado: false,
          eliminado: false,
          texto: msgTexto,
          autorNombre: uName,
          autorId: uId,
          createdAt: (commentPay as any).createdAt || serverTimestamp(),
          fromOfflineQueue: true
        }
      )
      break
    }

    case 'REGISTRO_MATERIAL': {
      // payload: { trabajoId?: string, material?: object, report?: object, userEmail?: string }
      const reportObj = (payload.report as any) || (payload.material as any) || {};
      const userMail = (payload.userEmail as string) || reportObj.user || '';

      await addDoc(
        collection(db, 'material_reports_log'),
        {
          ...reportObj,
          user: userMail,
          createdAt: reportObj.createdAt || serverTimestamp(),
          syncedAt: serverTimestamp(),
          fromOfflineQueue: true
        }
      )
      break
    }

    case 'SYSTEM_EVENT': {
      const timelineId = payload.timelineId as string;
      const eventData: any = payload.eventData;
      const eventId = payload.eventId as string;

      console.log(`[PROCESSOR_START] ActionId: ${action.id}, Type: SYSTEM_EVENT`);
      console.log(`[PROCESSOR_EVENT_TYPE] ${eventData.systemAction}`);
      console.log(`[PROCESSOR_TIMELINE_ID] ${timelineId}`);
      console.log(`[PROCESSOR_EVENT_ID] ${eventId}`);

      const eventTime = eventData.createdAtMs ? Timestamp.fromMillis(eventData.createdAtMs as number) : serverTimestamp();
      
      const firestorePath = `operational_timelines/${timelineId}/events/${eventId}`;
      console.log(`[PROCESSOR_FIRESTORE_PATH] ${firestorePath}`);

      const docRef = doc(db, "operational_timelines", timelineId, "events", eventId);
      
      try {
        console.log(`[PROCESSOR_SETDOC_START] Attempting write to Firestore: ${eventId}`);
        
        await setDoc(docRef, {
          ...eventData,
          timestamp: eventTime,
          fromOfflineQueue: true
        }, { merge: true });
        console.log(`[PROCESSOR_SETDOC_SUCCESS] Event ${eventId} persisted to Firestore.`);
      } catch (firestoreErr: any) {
        console.error(`[PROCESSOR_SETDOC_ERROR] CRITICAL FAIL writing ${eventId}`, {
          code: firestoreErr?.code,
          message: firestoreErr?.message,
          stack: firestoreErr?.stack,
          path: firestorePath
        });
        throw firestoreErr; // Re-throw to trigger retry/incrementRetry logic
      }
      break;
    }

    default:
      console.warn('[QueueProcessor] Unknown action type:', type)
  }
}

// ── Hook principal ────────────────────────────────────

export function useOfflineQueueProcessor(
  isAuthenticated: boolean
): void {

  const processQueue = useCallback(async () => {
    if (!isAuthenticated) return
    if (!navigator.onLine) return

    const actions = await getPendingActions()
    if (actions.length === 0) return

    console.info(
      `[QueueProcessor] Processing ${actions.length} actions`
    )

    for (const action of actions) {
      try {
        await executeAction(action)
        await removeAction(action.id)
        console.info('[QueueProcessor] Action executed:', action.type)
      } catch (err: any) {
        // Clasificación de errores para evitar bucles zombis
        const isTemporaryError = ['unavailable', 'network-request-failed', 'timeout', 'deadline-exceeded'].includes(err.code) || err.message?.includes('Timeout');

        if (action.retries >= MAX_RETRIES || !isTemporaryError) {
          console.error(
            '[QueueProcessor] CRITICAL:', 
            action.retries >= MAX_RETRIES ? 'Max retries reached' : 'Permanent error',
            'for action:', action.id,
            'Type:', action.type,
            'Error:', err
          );

          if (!isTemporaryError) {
              // Si es permanente, eliminar para no bloquear la cola
              console.warn('[QueueProcessor] Acción eliminada por error permanente:', action.id);
              await removeAction(action.id);
          }
          
          continue
        }

        await incrementRetry(action.id);
        console.warn(
          '[QueueProcessor] Action failed, will retry:',
          action.id, err
        );
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    // Procesar al recuperar conexión
    window.addEventListener('online', processQueue)

    // Procesar también al montar (por si hay cola pendiente de una sesión anterior)
    processQueue()

    const unsubscribe = eventBus.subscribe('OFFLINE_QUEUE_UPDATED', () => {
      console.log('[QueueProcessor] New action enqueued, triggering processing...');
      processQueue();
    });

    return () => {
      window.removeEventListener('online', processQueue)
      unsubscribe();
    }
  }, [isAuthenticated, processQueue])
}
