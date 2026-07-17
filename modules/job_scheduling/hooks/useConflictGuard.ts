import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/firebase';

interface ConflictGuardOptions {
  collectionName: string;
  docId: string;
  clientTimestamp: Date | null;
  updates: Record<string, unknown>;
  onConflict: () => void;
  onSuccess: () => void;
  onError: (err: Error) => void;
}

export async function runWithConflictGuard(options: ConflictGuardOptions): Promise<void> {
  const {
    collectionName,
    docId,
    clientTimestamp,
    updates,
    onConflict,
    onSuccess,
    onError
  } = options;

  const ref = doc(db, collectionName, docId);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error('Document not found');

      const data = snap.data();
      let serverTimestamp = null;
      if (data?.actualizado_en) {
         serverTimestamp = typeof data.actualizado_en.toDate === 'function' ? data.actualizado_en.toDate() : new Date(data.actualizado_en);
      } else if (data?.updatedAt) {
         serverTimestamp = typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(data.updatedAt);
      }

      if (
        clientTimestamp &&
        serverTimestamp &&
        serverTimestamp.getTime() > clientTimestamp.getTime()
      ) {
        // Conflicto detectado — abortar transacción
        onConflict();
        throw new Error('CONFLICT_DETECTED');
      }

      transaction.update(ref, {
        ...updates,
        actualizado_en: new Date()
      });
    });
    onSuccess();
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONFLICT_DETECTED') return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
