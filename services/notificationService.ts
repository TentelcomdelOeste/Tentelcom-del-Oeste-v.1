import { Capacitor } from "@capacitor/core";
import { PushNotifications, type ActionPerformed, type Token } from "@capacitor/push-notifications";
import { getToken, onMessage } from "firebase/messaging";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { messaging, db, auth } from "@/firebase";

const MAX_TOKENS_PER_USER = 5;
let nativeListenersInitialized = false;

type StoredFcmToken = {
  token: string;
  lastUpdated: number;
  platform: string;
};

const normalizeTokens = (rawTokens: any[]): StoredFcmToken[] =>
  rawTokens.map((t) =>
    typeof t === "string"
      ? { token: t, lastUpdated: Date.now(), platform: "unknown" }
      : t
  );

const saveFcmToken = async (userId: string, token: string, platform: string) => {
  if (!userId || !token) return;

  try {
    const userRef = doc(db, "employees", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    let tokens = normalizeTokens((userData.fcmTokens as any[]) || []);
    const now = Date.now();
    const existingTokenIndex = tokens.findIndex((t) => t.token === token);

    const tokenData: StoredFcmToken = {
      token,
      lastUpdated: now,
      platform,
    };

    if (existingTokenIndex >= 0) {
      tokens[existingTokenIndex] = {
        ...tokens[existingTokenIndex],
        ...tokenData,
      };
    } else {
      tokens.push(tokenData);
    }

    tokens.sort((a, b) => b.lastUpdated - a.lastUpdated);
    tokens = tokens.slice(0, MAX_TOKENS_PER_USER);

    await updateDoc(userRef, { fcmTokens: tokens });
    console.info("[FCM] Token nativo/web sincronizado para", userId);
  } catch (error) {
    console.error("[FCM] Error guardando token:", error);
  }
};

/**
 * Inicializa FCM nativo para la APK Capacitor.
 * El token se guarda en employees/{userId}.fcmTokens, igual que los tokens web.
 */
export const initializeNativePushNotifications = async (userId: string) => {
  if (!userId || !Capacitor.isNativePlatform()) return false;

  try {
    if (!nativeListenersInitialized) {
      await PushNotifications.addListener("registration", async (token: Token) => {
        const activeUserId = auth.currentUser?.uid || userId;
        if (activeUserId) {
          await saveFcmToken(activeUserId, token.value, Capacitor.getPlatform());
        }
      });

      await PushNotifications.addListener(
        "registrationError",
        (error) => {
          console.error("[FCM] Error de registro nativo:", error);
        }
      );

      await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          window.dispatchEvent(
            new CustomEvent("tentelcom-push-received", {
              detail: notification,
            })
          );
        }
      );

      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action: ActionPerformed) => {
          const data = action.notification?.data || {};
          try {
            localStorage.setItem(
              "tentelcom_pending_push_navigation",
              JSON.stringify({
                trabajoId: data.trabajoId || "",
                parentId: data.parentId || data.trabajoId || "",
                timelineId: data.timelineId || "",
                projectName: data.projectName || "",
                projectNumber: data.projectNumber || "",
                comentarioId: data.comentarioId || "",
                parentCollection: data.parentCollection || "trabajos",
                notificationId: data.notificationId || "",
              })
            );
          } catch {
            // La navegación inmediata también se emite por evento.
          }

          window.dispatchEvent(new CustomEvent("tentelcom-push-action", { detail: data }));
        }
      );

      nativeListenersInitialized = true;
    }

    if (Capacitor.getPlatform() === "android") {
      await PushNotifications.createChannel({
        id: "tentelcom_mentions",
        name: "Menciones y notificaciones",
        description: "Notificaciones de menciones y actividad de Tentelcom",
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: "default",
      });
    }

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== "granted") {
      console.warn("[FCM] Permiso de notificaciones no concedido.");
      return false;
    }

    await PushNotifications.register();
    return true;
  } catch (error) {
    console.error("[FCM] Error inicializando Push Notifications nativas:", error);
    return false;
  }
};

/**
 * Silently syncs the web FCM token if permissions are already granted.
 */
export const subscribeUserToPush = async (userId: string) => {
  if (Capacitor.isNativePlatform()) {
    return initializeNativePushNotifications(userId);
  }

  if (!messaging || typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    let registration;
    if ("serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      if (!registration) {
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      }
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await saveFcmToken(userId, token, navigator.userAgent.substring(0, 100));
    }
  } catch (error) {
    console.error("❌ [FCM] Error en subscribeUserToPush:", error);
  }
};

export const requestNotificationPermission = async () => {
  if (Capacitor.isNativePlatform()) {
    if (auth.currentUser) {
      return initializeNativePushNotifications(auth.currentUser.uid);
    }
    return false;
  }

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
  if (Capacitor.isNativePlatform()) {
    const handler = (event: Event) => {
      callback((event as CustomEvent).detail);
    };
    window.addEventListener("tentelcom-push-received", handler);
    return () => window.removeEventListener("tentelcom-push-received", handler);
  }

  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};
