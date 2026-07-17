import { getToken, onMessage } from "firebase/messaging";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { messaging, db, auth } from "@/firebase";

const MAX_TOKENS_PER_USER = 5;

/**
 * Silently syncs the FCM token if permissions are already granted.
 * This satisfies the "when authenticated and permissions granted" requirement.
 */
export const subscribeUserToPush = async (userId: string) => {
  if (!messaging || typeof window === "undefined" || !('Notification' in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    let registration;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      }
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      const userRef = doc(db, "employees", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        let tokens: any[] = userData.fcmTokens || [];
        tokens = tokens.map(t => typeof t === 'string' ? { token: t, lastUpdated: Date.now(), platform: 'unknown' } : t);

        const now = Date.now();
        const existingTokenIndex = tokens.findIndex(t => t.token === token);

        if (existingTokenIndex > -1) {
          tokens[existingTokenIndex] = {
            ...tokens[existingTokenIndex],
            lastUpdated: now,
            platform: navigator.userAgent.substring(0, 100)
          };
        } else {
          tokens.push({
            token,
            lastUpdated: now,
            platform: navigator.userAgent.substring(0, 100)
          });
        }

        tokens.sort((a, b) => b.lastUpdated - a.lastUpdated);
        if (tokens.length > MAX_TOKENS_PER_USER) {
          tokens = tokens.slice(0, MAX_TOKENS_PER_USER);
        }

        await updateDoc(userRef, { fcmTokens: tokens });
      }
    }
  } catch (error) {
    console.error("❌ [FCM] Error en subscribeUserToPush:", error);
  }
};

export const requestNotificationPermission = async () => {
  if (!messaging || typeof window === "undefined") return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted" && auth.currentUser) {
      await subscribeUserToPush(auth.currentUser.uid);
    }
    return permission;
  } catch (error) {
    console.error("❌ [FCM] Error en requestNotificationPermission:", error);
    return Notification.permission;
  }
};

export const onMessageListener = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};
