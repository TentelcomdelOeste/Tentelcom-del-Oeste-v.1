import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, onMessage } from "firebase/messaging";
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

const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence
});

const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
}, firebaseConfigJson.firestoreDatabaseId || "(default)");

const storage = getStorage(app);
const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

export { auth, db, storage, messaging, onMessage, firebaseConfig };
