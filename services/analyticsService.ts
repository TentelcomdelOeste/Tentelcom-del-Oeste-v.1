import { db, auth } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';                
import { logger } from '@/utils/logger';

export type AnalyticsEvent = 
  | 'page_visit' 
  | 'service_click' 
  | 'contact_click' 
  | 'form_submit' 
  | 'login_attempt' 
  | 'login_success' 
  | 'login_failed';

const getSessionId = () => {
    let sid = localStorage.getItem('analytics_sessionId');
    if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem('analytics_sessionId', sid);
    }
    return sid;
};

export const trackEvent = async (
  eventType: AnalyticsEvent, 
  data: Record<string, any> = {}
) => {
  // 1. Validate Auth before writing
  if (!auth.currentUser) {
    logger.debug("Analytics skipped: user not authenticated", { eventType });
    return;
  }

  // Deterministic ID: prevents duplicate documents when the same event
  // is fired more than once per session (e.g. StrictMode double-invoke,
  // offline retry, or rapid re-login). Format: uid_sessionId_eventType_epochMs
  const eventId = `${auth.currentUser.uid}_${getSessionId()}_${eventType}_${Date.now()}`;

  try {
    await setDoc(doc(collection(db, 'analytics_events'), eventId), {
      eventType,
      ...data,
      sessionId: getSessionId(),
      userAgent: navigator.userAgent,
      timestamp: serverTimestamp(),
      uid: auth.currentUser.uid,
    });
  } catch (error: any) {
    // Silenciar errores de analytics — nunca deben interrumpir el flujo del usuario
    logger.debug("Analytics event skipped:", { eventType, code: error?.code });
  }
};