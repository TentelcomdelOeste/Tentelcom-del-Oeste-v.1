
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Attachment, AttachmentType } from './attachment.types';
import { uploadFileAndCreateAttachmentDoc, deleteFileAndAttachmentDoc } from './attachment.service';

export const useAttachments = (entityType: string | null, entityId: string | number | null) => {
  const { authReady, currentUser } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !currentUser) return;
    if (!entityType || !entityId) {
      setAttachments([]);
      return;
    }

    const attachmentsCollectionRef = collection(db, entityType, entityId.toString(), 'attachments');
    const q = query(attachmentsCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attachmentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Attachment));
      setAttachments(attachmentList);
    }, (err) => {
      console.error("Error al escuchar adjuntos:", err);
      setError("No se pudieron cargar los adjuntos.");
    });

    return () => unsubscribe();
  }, [authReady, currentUser, entityType, entityId]);

  const uploadFile = useCallback(async (file: File, type: AttachmentType) => {
    if (!entityType || !entityId) return;

    setIsLoading(`uploading-${type}`);
    setError(null);
    try {
      await uploadFileAndCreateAttachmentDoc(entityType, entityId, file, type);
      setIsLoading(null);
    } catch (err: any) {
      console.error("Error al subir archivo:", err);
      setError(err.message || 'Error al subir el archivo.');
      setIsLoading(null);
    }
  }, [entityType, entityId]);

  const deleteAttachment = useCallback(async (attachment: Attachment) => {
    if (!entityType || !entityId) return;

    setIsLoading(`deleting-${attachment.id}`);
    setError(null);
    try {
      await deleteFileAndAttachmentDoc(entityType, entityId, attachment);
      setIsLoading(null);
    } catch (err: any) {
      console.error("Error al eliminar archivo:", err);
      setError(err.message || 'Error al eliminar el archivo.');
      setIsLoading(null);
    }
  }, [entityType, entityId]);

  const attachmentLists = useMemo(() => {
    const ocs = attachments.filter(a => a.type === 'OC');
    const facturas = attachments.filter(a => a.type === 'Factura');
    return { ocs, facturas, all: attachments };
  }, [attachments]);

  return {
    ...attachmentLists,
    isLoading,
    error,
    uploadFile,
    deleteAttachment,
  };
};
