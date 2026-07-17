import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  writeBatch,
  addDoc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db, auth } from "@/firebase";
import { useUserContext } from "@/contexts/UserContext";

export interface NotificationDoc {
  id: string;
  type: "mention" | "reply" | "assignment" | "comment" | "important_edit";
  targetUserId: string;
  triggeredBy: string;
  triggeredByName: string;
  trabajoId: string;
  parentCollection?: string | null;
  trabajoTitle?: string;
  comentarioId?: string;
  comentarioTexto?: string;
  read: boolean;
  createdAt: any;
}

export function useNotifications() {
  const { currentUser, authReady } = useUserContext();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !currentUser?.id || (!auth.currentUser && navigator.onLine)) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("targetUserId", "==", currentUser.id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: NotificationDoc[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as NotificationDoc);
        });
        setNotifications(list);
        setLoading(false);
      },
      (error) => {
        console.error("🔔 [useNotifications] Error listening to notifications:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, authReady]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const docRef = doc(db, "notifications", id);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.id || notifications.length === 0) return;
    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach((n) => {
        const docRef = doc(db, "notifications", n.id);
        batch.update(docRef, { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [currentUser?.id, notifications]);

  const notifyUser = useCallback(async (payload: Omit<NotificationDoc, "id" | "read" | "createdAt">) => {
    try {
      const notificationsRef = collection(db, "notifications");
      await addDoc(notificationsRef, {
        ...payload,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating notification document:", error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    notifyUser
  };
}
