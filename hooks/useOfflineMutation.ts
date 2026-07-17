import { useState } from 'react';
import { setVersionedDocOffline, updateVersionedDocOffline } from '../core/versionControl';

export function useOfflineMutation() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (collection: string, docId: string, data: any, operation: 'create' | 'update') => {
    setIsSaving(true);
    try {
      if (operation === 'create') {
        const enriched = await setVersionedDocOffline(collection, docId, data);
        return enriched;
      } else {
        const enriched = await updateVersionedDocOffline(collection, docId, data);
        return enriched;
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar mutación offline");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { mutate, isSaving, error };
}
