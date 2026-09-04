import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, memoryLocalCache, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, onMessage, isSupported } from "firebase/messaging";
import firebaseConfigJson from './firebase-applet-config.json'; // Import config

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId
};

const app = initializeApp(firebaseConfig);

// Safely initialize Auth with fallbacks for environments where IndexedDB is blocked (e.g. cross-origin iframes)
let auth;
try {
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
  });
} catch (error) {
  console.warn("[Firebase] initializeAuth with indexedDB failed. Falling back to getAuth().", error);
  auth = getAuth(app);
}

// Safely initialize Firestore with fallback to memory cache if persistent cache (IndexedDB) is blocked
let db: any;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache()
  }, firebaseConfigJson.firestoreDatabaseId || "(default)");
} catch (error) {
  console.warn("[Firebase] initializeFirestore with persistentLocalCache failed. Falling back to memoryLocalCache.", error);
  try {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache()
    }, firebaseConfigJson.firestoreDatabaseId || "(default)");
  } catch (error2) {
    console.warn("[Firebase] initializeFirestore fallback failed. Falling back to getFirestore().", error2);
    db = getFirestore(app);
  }
}

const storage = getStorage(app);

let messaging: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        messaging = getMessaging(app);
      } catch (e) {
        console.warn("[Firebase] Could not initialize messaging:", e);
      }
    }
  }).catch((e) => {
    console.warn("[Firebase] FCM is not supported in this environment:", e);
  });
}

export { auth, db, storage, messaging, onMessage, firebaseConfig };
