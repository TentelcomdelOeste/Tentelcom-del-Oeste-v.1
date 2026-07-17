import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';

import { auth, db } from '../firebase';

import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  updatePassword
} from 'firebase/auth';

import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';

import { User } from '../utils/types';
import { Employee } from '../financeTypes';
import { isAdmin } from '../utils/permissions';
import { UserContext } from './UserContextInstance';
import { logger } from '../utils/logger';
import { networkProbe } from '../core/offline/networkProbe';
import { auditService } from '../services/auditService';

export const useUserContext = () => useContext(UserContext)!;

const LATEST_USER_SESSION_KEY = 'tentelcom_user_session';

const safeGetCachedUser = (): User | null => {
  try {
    const raw = localStorage.getItem(LATEST_USER_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && (data.id || data.uid)) {
      return {
        ...data,
        uid: data.uid || data.id,
        id: data.id || data.uid
      } as User;
    }
  } catch (err) {
    console.warn("[UserContext] Hydration error:", err);
  }
  return null;
};

const safeSetCachedUser = (user: User | null) => {
  try {
    if (user) {
      localStorage.setItem(LATEST_USER_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LATEST_USER_SESSION_KEY);
    }
  } catch (err) {
    console.warn("[UserContext] Cache storage error:", err);
  }
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    logger.log("🧊 [UserProvider] Initializing from cache...");
    return safeGetCachedUser();
  });

  const [isLoggedIn, setIsLoggedIn] = useState(!!currentUser);
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(!currentUser);
  const [isAuthResolving, setIsAuthResolving] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showForcePasswordChangeModal, setShowForcePasswordChangeModal] = useState(false);
  const [userPermisos, setUserPermisos] = useState<any>(currentUser?.permissions || null);
  const authReadyRef = React.useRef(false);

  const logout = useCallback(async () => {
    try {
      logger.log("🚪 [UserContext] Logout initiated...");
      if (currentUser) {
        await auditService.logEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          action: 'logout',
          module: 'Session',
          route: '/logout'
        });
      }
      await signOut(auth);
      setIsLoggedIn(false);
      setCurrentUser(null);
      safeSetCachedUser(null);
      setUserPermisos(null);
      setShowForcePasswordChangeModal(false);
      setIsAuthResolving(false);
      setAuthReady(false);
      authReadyRef.current = false;
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    setLoginError(null);
    const identifier = emailOrUsername.trim().toLowerCase();
    try {
      let email = identifier;
      if (!identifier.includes('@')) {
        const usersRef = collection(db, "employees");
        const q = query(usersRef, where("username", "==", identifier));
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        );
        try {
          const querySnapshot = await Promise.race([getDocs(q), timeoutPromise]) as any;
          if (querySnapshot.empty) throw new Error("Credenciales inválidas");
          email = querySnapshot.docs[0].data().email;
        } catch (qError: any) {
          if (qError.code === 'permission-denied') {
            throw new Error("El inicio de sesión por nombre de usuario requiere permisos previos. Por favor use su correo electrónico.");
          }
          throw qError;
        }
      }
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (
        error.code !== 'auth/invalid-credential' &&
        error.code !== 'auth/user-not-found' &&
        error.code !== 'auth/wrong-password'
      ) {
        logger.error("❌ AUTH ERROR FULL:", error);
      }
      let message = "Error al iniciar sesión";
      if (error.message === 'timeout') message = "Tiempo de espera agotado al buscar usuario";
      else if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) message = "CREDENCIALES INVÁLIDAS";
      else if (error.code === 'auth/invalid-email') message = "Correo electrónico inválido";
      else if (error.code === 'auth/too-many-requests') message = "Demasiados intentos. Inténtelo más tarde.";
      else if (error.code === 'auth/network-request-failed') message = `Error de red: ${error.message}. Verifique su conexión.`;
      else if (error.code === 'auth/unauthorized-domain') message = `Dominio no autorizado para esta aplicación.`;
      else message = error.message || `Error Firebase: ${error.code}`;
      setLoginError(message);
    }
  }, []);

  const updatePasswordSecurely = useCallback(async (newPassword: string): Promise<{ success: boolean; message?: string }> => {
    const user = auth.currentUser;
    if (!user) return { success: false, message: "No autenticado." };
    try {
      await updatePassword(user, newPassword);
      await updateDoc(doc(db, "employees", user.uid), { forcePasswordChange: false });
      setShowForcePasswordChangeModal(false);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, []);

  // --- AUTH EFFECT ---
  useEffect(() => {
    logger.log("⚡ [UserProvider] Auth system mounting.");

    let isMounted = true;
    let fallbackTimeout: NodeJS.Timeout;
    let unsubscribeAuth: (() => void) | null = null;

    const configureAuth = async () => {
      logger.log("✅ [UserProvider] Auth system configured via Firebase Init");

      if (!isMounted) return;

      unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (!isMounted) return;

        console.log('[AUTH TEST] onAuthStateChanged ejecutado');
        console.log('[AUTH TEST] user recibido:', firebaseUser);
        console.log('[AUTH TEST] auth.currentUser:', auth.currentUser);

        // Resetear ambos flags al inicio de cada ciclo de auth
        setAuthReady(false);
        authReadyRef.current = false;

        logger.log("🔐 [UserProvider] Firebase auth state changed:", firebaseUser ? "In" : "Out");

        if (firebaseUser) {
          // Firebase confirmó sesión real.
          // authReady=true se establecerá ÚNICAMENTE en el hydration effect
          // después de cargar perfil + claims. NO establecer aquí.
          if (fallbackTimeout) clearTimeout(fallbackTimeout);
          logger.log("✅ [UserProvider] onAuthStateChanged: Got user:", firebaseUser.uid);
          setFirebaseAuthUser(firebaseUser);
          setIsLoggedIn(true);
          setIsAuthLoading(false);
          setIsAuthResolving(false);
        } else {
          const hasCache = !!safeGetCachedUser();
          logger.log("❌ [UserProvider] onAuthStateChanged: Got null. Has cache:", hasCache);

          if (hasCache) {
            logger.log("🏃 [UserProvider] Sustaining session with cache, awaiting stable validation");
            setIsAuthResolving(true);
            setAuthReady(false);
            if (fallbackTimeout) clearTimeout(fallbackTimeout);

            fallbackTimeout = setTimeout(() => {
              if (!isMounted) return;
              const fUser = auth.currentUser;
              if (fUser) {
                // Firebase tiene usuario real — el hydration effect lo procesará
                setIsAuthResolving(false);
                setIsAuthLoading(false);
              } else {
                // Firebase no restauró sesión en 8 segundos, pero mantenemos sesión de caché
                console.warn('[Auth] Firebase session restore taking longer than expected');
                setIsAuthResolving(false);
                setIsAuthLoading(false);
                setAuthReady(true); // Permitir carga de módulos con el usuario de caché
              }
            }, 8000);
          } else {
            logger.log("🚪 [UserProvider] No cache available, confirming logout");
            setFirebaseAuthUser(null);
            setIsLoggedIn(false);
            setCurrentUser(null);
            safeSetCachedUser(null);
            setIsAuthLoading(false);
            setIsAuthResolving(false);
            setAuthReady(true); // Auth resolvió como "no hay sesión" → mostrar login
          }
        }
      });
    };

    configureAuth();

    return () => {
      isMounted = false;
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  // --- HYDRATION & PROFILE SYNC ---
  useEffect(() => {
    logger.log("🔄 [UserProvider] Hydration effect triggered");

    if (!isLoggedIn) return;

    if (!firebaseAuthUser) {
      if (currentUser) setIsAuthLoading(false);
      return;
    }

    const firebaseUser = firebaseAuthUser;

    // Iniciar obtención de claims en paralelo
    const claimsPromise = firebaseUser.getIdTokenResult(true).catch((err: any) => {
      // Claims failure - silenced per user request
      logger.error("🔥 [UserProvider] Custom claims load failed, silenced:", err);
      return null;
    });

    if (!currentUser) {
      const fallbackUser: User = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || '',
        role: 'empleado',
        active: true,
        permissions: { home: true }
      };
      setCurrentUser(fallbackUser);
    }

    logger.log("📡 [UserProvider] Attaching profile listener");
    const userDocRef = doc(db, "employees", firebaseUser.uid);

    const unsubscribeProfile = onSnapshot(
      userDocRef,
      { includeMetadataChanges: true },
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as Employee;
          const isActiveUser = userData.status === "activo" || userData.isActive === true;

          const fullUser: User = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: userData.name || firebaseUser.displayName || '',
            role: userData.role || 'empleado',
            active: isActiveUser,
            forcePasswordChange: userData.forcePasswordChange || false,
            canUseOperationalLog: isAdmin(userData.role) || userData.canUseOperationalLog || false,
            permissions: userData.permissions,
          };

          setCurrentUser(prev => {
            if (prev && JSON.stringify(prev) === JSON.stringify(fullUser)) return prev;
            safeSetCachedUser(fullUser);
            return fullUser;
          });

          setUserPermisos(prev => {
            const newPerms = userData.permissions || {};
            if (prev && JSON.stringify(prev) === JSON.stringify(newPerms)) return prev;
            return newPerms;
          });

          if (!isActiveUser && !docSnap.metadata.fromCache && networkProbe.isOnline()) {
            logger.log("⚠️ [UserProvider] Account inactive (confirmed by server), logging out.");
            logout();
            setLoginError("Usuario sin acceso");
          }

          setShowForcePasswordChangeModal(
            !!userData.forcePasswordChange && !isAdmin(userData.role)
          );

          // authReady=true inmediatamente después de perfil cargado (Optimización)
          if (!authReadyRef.current) {
            logger.log("🔑 [UserProvider] Profile loaded. Marks authReady = true (Optimized)");
            authReadyRef.current = true;
            setAuthReady(true);
            setIsAuthLoading(false);

            // Audit login se dispara en segundo plano sin bloquear el render
            claimsPromise.then(() => {
              auditService.logEvent({
                userId: fullUser.id,
                userName: fullUser.name,
                email: fullUser.email,
                role: fullUser.role,
                action: 'login',
                module: 'Auth',
                route: window.location.pathname
              });
            });
          }

        } else {
          if (!docSnap.metadata.fromCache && networkProbe.isOnline()) {
            logger.log("⚠️ [UserProvider] User not found in Firestore (confirmed by server).");
            logout();
            setLoginError("Usuario no encontrado");
          } else {
            logger.log("⚠️ [UserProvider] User doc from cache or offline.");
            if (!authReadyRef.current) {
              authReadyRef.current = true;
              setAuthReady(true);
            }
          }
          setIsAuthLoading(false);
        }
      },
      (error) => {
        logger.error("🔥 [UserProvider] Profile sync error:", error);
        if (currentUser) {
          setIsAuthLoading(false);
          if (!authReadyRef.current) {
            authReadyRef.current = true;
            setAuthReady(true);
          }
        } else {
          setLoginError("Error de sincronización de perfil");
          setIsAuthLoading(false);
        }
      }
    );

    return () => unsubscribeProfile();
  }, [currentUser?.id, firebaseAuthUser?.uid]);

  const contextValue = useMemo(() => ({
    currentUser,
    isLoggedIn,
    isAuthLoading,
    isAuthResolving,
    loginError,
    showForcePasswordChangeModal,
    userPermisos,
    login,
    logout,
    updatePasswordSecurely,
    setLoginError,
    authReady,
    isAuthResolved: authReady,
    sessionHydrated: authReady
  }), [
    currentUser,
    isLoggedIn,
    isAuthLoading,
    isAuthResolving,
    loginError,
    showForcePasswordChangeModal,
    userPermisos,
    login,
    logout,
    updatePasswordSecurely,
    authReady
  ]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};