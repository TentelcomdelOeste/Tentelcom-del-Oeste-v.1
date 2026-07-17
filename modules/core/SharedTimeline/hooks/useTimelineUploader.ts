import { useState, useEffect, RefObject } from 'react';
import { collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { User } from '@/utils/types';
import { detectMentionsInText } from '@/modules/job_scheduling/jobNotificationDispatcher';
import { storeBlob, getBlob } from '@/services/offlineMediaStore';
import { enqueueUpload, updateUploadStatus, syncPendingUploads, getPendingUploads, OfflineUploadTask } from '@/services/offlineQueueService';

export const localBlobCache = new Map<string, string[]>();

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type.includes("gif")) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const outputType = file.type === "image/png" ? "image/jpeg" : file.type;
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, "") + ".jpg",
                {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                },
              );
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          outputType,
          0.75,
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function compressImageToThumbnail(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type.includes("gif")) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const outputType = "image/jpeg";
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                "thumb_" + file.name.replace(/\.[^/.]+$/, "") + ".jpg",
                {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                },
              );
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          outputType,
          0.80,
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export function useLogUploader(
  parentId: string,
  currentUser: User | undefined,
  setOptimisticComments: React.Dispatch<React.SetStateAction<any[]>>,
  setNewMessage: (msg: string) => void,
  setShowAttachMenu: (show: boolean) => void,
  setReplyingTo: (reply: any) => void,
  replyingTo: any,
  scrollRef: RefObject<HTMLDivElement>,
  cameraRef: RefObject<HTMLInputElement>,
  galleryRef: RefObject<HTMLInputElement>,
  fileRef: RefObject<HTMLInputElement>,
  employees: { id: string, name: string; email?: string }[] = [],
  jobTitle?: string,
  cuadrilla?: string[],
  parentCollection: string = "trabajos",
  timelineId?: string
) {
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    files: File[];
    previewUrls: string[];
    type: "image" | "file";
  } | null>(null);

  // Load local IndexedDB blob Cache so pending uploads keep displaying images after app restart
  useEffect(() => {
    const restoreLocalCache = async () => {
      try {
        const tasks = await getPendingUploads();
        for (const task of tasks) {
          if (timelineId) {
            if (task.timelineId !== timelineId) continue;
          } else {
            if ((task.parentId || task.trabajoId) !== parentId) continue;
          }
          const urls: string[] = [];
          for (const key of task.fileKeys) {
            const blob = await getBlob(key);
            if (blob) {
              urls.push(URL.createObjectURL(blob));
            }
          }
          if (urls.length > 0) {
            localBlobCache.set(task.id, urls);
          }
        }
      } catch (err) {
        console.error("[useLogUploader] Failed to restore local blob cache:", err);
      }
    };
    restoreLocalCache();
  }, [parentId]);

  const uploadMediaAndSend = async (
    files: File[],
    type: "image" | "file",
    caption: string,
  ) => {
    if (!currentUser) return;
    setIsUploading(true);

    const optimisticId = "opt-" + Math.random().toString(36).substring(2, 9);
    const previewUrls = files.map((f) =>
      type === "image" ? URL.createObjectURL(f) : "",
    );

    if (type === "image") {
      localBlobCache.set(optimisticId, previewUrls);
    }

    const optComment: any = {
      id: optimisticId,
      tipo: type === "image" ? "imagen" : "archivo",
      mensaje: caption,
      usuarioId: currentUser.id,
      usuarioNombre: currentUser.name || currentUser.email,
      timestamp: new Date(),
      fileUrls: type === "image" ? previewUrls : [],
      fileNames: files.map((f) => f.name),
      fileSizes: files.map((f) => f.size),
      progress: 0,
      isOptimistic: true,
      error: null,
      optimisticId: optimisticId,
    };

    if (replyingTo) {
      optComment.replyToId = replyingTo.id;
      optComment.replyPreview =
        replyingTo.mensaje ||
        (replyingTo.tipo === "imagen"
          ? "Evidencia fotográfica"
          : "Archivo adjunto");
      optComment.replyType = replyingTo.tipo;
    }

    setOptimisticComments((prev) => [...prev, optComment]);
    const captureReply = replyingTo;

    setNewMessage("");
    setPendingAttachment(null);
    setShowAttachMenu(false);
    setReplyingTo(null);

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);

    const timelineRef = timelineId
      ? collection(db, "operational_timelines", timelineId, "events")
      : collection(db, parentCollection, parentId, "timeline");
    const mentions = detectMentionsInText(caption.trim(), employees);

    const dbPayload: any = {
      tipo: caption.trim() ? "comentario" : (type === "image" ? "imagen" : "archivo"),
      mensaje: caption.trim(),
      mentions: mentions,
      usuarioId: currentUser.id,
      usuarioNombre: currentUser.name || currentUser.email,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      editado: false,
      eliminado: false,
      fileUrls: [],
      fileNames: [],
      fileSizes: [],
      thumbnailUrls: [],
      optimisticId: optimisticId,
      uploadStatus: 'pending'
    };

    if (captureReply) {
      dbPayload.replyToId = captureReply.id;
      dbPayload.replyPreview = captureReply.mensaje || (captureReply.tipo === "imagen" ? "Evidencia fotográfica" : "Archivo adjunto");
      dbPayload.replyType = captureReply.tipo;
      dbPayload.replyToUserId = captureReply.usuarioId;
    }

    let docRef: any = null;

    try {
      // 1. Save Blobs Locally (Offline Media Staging)
      const fileKeys: string[] = [];
      const fileNames: string[] = [];
      const fileTypes: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let processedFile = file;
        let fileType = file.type;
        if (type === "image") {
          try {
            processedFile = await compressImageIfNeeded(file);
            fileType = processedFile.type || "image/jpeg";
          } catch (compErr) {
            fileType = "image/jpeg";
          }
        } else {
          fileType = processedFile.type || "application/octet-stream";
        }

        let fileName = processedFile.name;
        if (type === "image" && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fileName)) {
          const extension = fileType === "image/png" ? ".png" : ".jpg";
          fileName = fileName + extension;
          processedFile = new File([processedFile], fileName, { type: fileType });
        }

        const fileKey = `${optimisticId}_file_${i}`;
        await storeBlob(fileKey, processedFile);

        // Thumbnail pre-generation for offline resilience
        if (type === "image" && !file.type.includes("gif")) {
          try {
            const thumbFile = await compressImageToThumbnail(file);
            const thumbKey = `${optimisticId}_thumb_${i}`;
            await storeBlob(thumbKey, thumbFile);
          } catch (thumbErr) {
            console.error("Failed to generate/store thumbnail locally:", thumbErr);
          }
        }

        fileKeys.push(fileKey);
        fileNames.push(fileName);
        fileTypes.push(fileType);
      }

      // 2. Enqueue in Persistent Local Queue
      const task: OfflineUploadTask = {
        id: optimisticId,
        trabajoId: parentId, // keep for backward compatibility
        parentId,
        parentCollection,
        timelineId: timelineId || null,
        caption,
        fileKeys,
        fileNames,
        fileTypes,
        type,
        currentUser: {
          id: currentUser.id,
          name: currentUser.name || currentUser.email || "Usuario"
        },
        replyToId: captureReply?.id,
        replyPreview: captureReply?.mensaje || (captureReply?.tipo === "imagen" ? "Evidencia fotográfica" : "Archivo adjunto"),
        replyType: captureReply?.tipo,
        replyToUserId: captureReply?.usuarioId,
        createdAt: Date.now(),
        status: 'pending' as const,
        docId: null
      };
      await enqueueUpload(task);

      // 3. Create optimistic Firestore document
      try {
        docRef = await addDoc(timelineRef, dbPayload);
        await updateUploadStatus(optimisticId, 'pending', docRef.id);
      } catch (firestoreErr) {
        console.warn("[LogUploader] Firestore offline write cached successfully:", firestoreErr);
      }

      // 4. Trigger Instant Upload Sync if Online
      if (navigator.onLine) {
        syncPendingUploads((taskId, progress) => {
          if (taskId === optimisticId) {
            setOptimisticComments((prev) =>
              prev.map((opt) =>
                opt.id === optimisticId
                  ? { ...opt, progress: Math.min(Math.round(progress), 99) }
                  : opt,
              ),
            );
          }
        }).then(() => {
          setOptimisticComments((prev) =>
            prev.map((opt) => opt.id === optimisticId ? { ...opt, progress: 100 } : opt),
          );
        }).catch((err) => {
          console.error("Immediate upload sync error:", err);
        });
      } else {
        console.info("[LogUploader] Internet is offline. Staged media locally. Ready to auto-sync upon reconnection.");
      }

    } catch (error: any) {
      console.error("[LogUploader] Critical failure, rolling back optimistic comment:", error);
      // Revertir el array local eliminando el item optimista que falló
      setOptimisticComments((prev) => prev.filter((opt) => opt.id !== optimisticId));
      
      if (docRef) {
        await updateDoc(docRef, { uploadStatus: 'failed' });
      }
      
      // Opcional: podrías mostrar una notificación o alerta al usuario aquí si no existiera una global
    } finally {
      setIsUploading(false);
    }
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && currentUser) {
      await uploadMediaAndSend(files, "image", "");
      e.target.value = "";
    }
  };

  const handleSendAttachment = async (newMessageVal: string) => {
    if (!pendingAttachment || !currentUser || isUploading) return;
    await uploadMediaAndSend(pendingAttachment.files, pendingAttachment.type, newMessageVal);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingAttachment({
        files,
        previewUrls: files.map((f) => type === "image" ? URL.createObjectURL(f) : ""),
        type,
      });
      setShowAttachMenu(false);
    }
  };

  const handleCancelAttachment = () => {
    if (pendingAttachment?.previewUrls) {
      pendingAttachment.previewUrls.forEach(url => URL.revokeObjectURL(url));
    }
    setPendingAttachment(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  return {
    isUploading,
    pendingAttachment,
    setPendingAttachment,
    uploadMediaAndSend,
    handleCameraChange,
    handleSendAttachment,
    handleFileChange,
    handleCancelAttachment
  };
}
