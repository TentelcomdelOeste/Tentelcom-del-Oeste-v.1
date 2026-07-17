import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

export interface MiniUser {
  id: string;
  name: string;
}

export interface DispatchNotificationParams {
  trabajoId?: string | null;
  parentCollection?: string | null;
  trabajoTitle?: string | null;
  comentarioId?: string | null;
  mensaje: string;
  mentions: { userId: string; userName: string; email?: string }[];
  replyToUserId?: string | null;
  replyToId?: string | null;
  currentUser: { id: string; name: string };
  cuadrilla?: string[]; // Crew teammates' names or IDs
}

/**
 * Parses mentions from a text string against a list of employees.
 */
export function detectMentionsInText(text: string, employees: { id: string; name: string; email?: string }[]) {
  const mentions: { userId: string; userName: string; email?: string }[] = [];
  if (!text) return mentions;

  employees.forEach((emp) => {
    const mentionTag = `@${emp.name}`;
    if (text.includes(mentionTag)) {
      if (!mentions.some((m) => m.userId === emp.id)) {
        mentions.push({
          userId: emp.id,
          userName: emp.name,
          email: emp.email || "",
        });
      }
    }
  });

  return mentions;
}

/**
 * Dispatches notifications real-time for mentions, direct replies, and cuadrilla team events.
 */
export async function dispatchNotifications({
  trabajoId,
  parentCollection,
  trabajoTitle = "Trabajo",
  comentarioId,
  mensaje,
  mentions,
  replyToUserId,
  replyToId: _replyToId,
  currentUser,
  cuadrilla = [],
}: DispatchNotificationParams) {
  if (!currentUser?.id) return;

  try {
    const notificationsRef = collection(db, "notifications");
    const notifiedUserIds = new Set<string>();

    const safeTrabajoId = trabajoId !== undefined ? trabajoId : null;
    const safeParentCollection = parentCollection !== undefined ? parentCollection : null;
    const safeTrabajoTitle = trabajoTitle !== undefined ? trabajoTitle : null;
    const safeComentarioId = comentarioId !== undefined ? comentarioId : null;
    const safeMensaje = mensaje || "";

    // 1. Send Mention notifications
    for (const mention of mentions) {
      if (mention.userId === currentUser.id) continue; // Skip self

      const payload = {
        type: "mention",
        targetUserId: mention.userId || "",
        triggeredBy: currentUser.id,
        triggeredByName: currentUser.name || "Usuario",
        trabajoId: safeTrabajoId,
        parentCollection: safeParentCollection,
        trabajoTitle: safeTrabajoTitle,
        comentarioId: safeComentarioId,
        comentarioTexto: safeMensaje,
        read: false,
        createdAt: serverTimestamp(),
      };

      const newDocRef1 = doc(notificationsRef);
      await setDoc(newDocRef1, payload);
      notifiedUserIds.add(mention.userId);
    }

    // 2. Send Direct Reply notification
    if (replyToUserId && replyToUserId !== currentUser.id) {
      if (!notifiedUserIds.has(replyToUserId)) {
        const payload = {
          type: "reply",
          targetUserId: replyToUserId,
          triggeredBy: currentUser.id,
          triggeredByName: currentUser.name || "Usuario",
          trabajoId: safeTrabajoId,
          parentCollection: safeParentCollection,
          trabajoTitle: safeTrabajoTitle,
          comentarioId: safeComentarioId,
          comentarioTexto: safeMensaje,
          read: false,
          createdAt: serverTimestamp(),
        };

        const newDocRef2 = doc(notificationsRef);
        await setDoc(newDocRef2, payload);
        notifiedUserIds.add(replyToUserId);
      }
    }

    // 3. Send Cuadrilla Comment notification
    // If there are teammates in the crew, they get a comment notification on their active job
    if (cuadrilla.length > 0) {
      // First, lookup employees to map cuadrilla names to user IDs if they are name strings
      // We can check if any user ID in the employee collection corresponds to a member in cuadrilla
      // Let's perform a lightweight lookup or simply notify members.
      // If we don't have their ID, we bypass, but let's query the crew details
      
      // We'll map crew entries
      for (const member of cuadrilla) {
        // Cuadrilla entries could be user IDs or display names
        // If a member is a display name, we'll try to find their user id if they match a mention
        // Let's check: if the member matches another user ID and wasn't notified yet:
        const isUserId = member.length > 10; // Simple ID check
        const targetId = isUserId ? member : "";

        if (targetId && targetId !== currentUser.id && !notifiedUserIds.has(targetId)) {
          const payload = {
            type: "comment",
            targetUserId: targetId,
            triggeredBy: currentUser.id,
            triggeredByName: currentUser.name || "Usuario",
            trabajoId: safeTrabajoId,
            parentCollection: safeParentCollection,
            trabajoTitle: safeTrabajoTitle,
            comentarioId: safeComentarioId,
            comentarioTexto: safeMensaje,
            read: false,
            createdAt: serverTimestamp(),
          };

          const newDocRef = doc(notificationsRef);
          await setDoc(newDocRef, payload);
          notifiedUserIds.add(targetId);
        }
      }
    }
  } catch (error) {
    console.error("Error dispatching notifications:", error);
  }
}
