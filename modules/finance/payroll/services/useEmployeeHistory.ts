import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { pdfOfflineQueue, calculateBlobChecksum } from '../../../../core/pdf/pdfOfflineQueue';
import { pdfFileEngine } from '../../../../core/pdf/pdfFileEngine';
import { networkProbe } from '../../../../core/offline/networkProbe';
import { runPdfSyncCycle } from '../../../../core/pdf/pdfStorageSync';
import { db, storage, auth } from '../../../../firebase';
import { useAuth } from '../../../../hooks/useAuth';
import { WorkHistoryEvent, AdminLogEvent, EmployeeFile } from '../../../../financeTypes';

export const logWorkHistoryEvent = async (employeeId: string, eventData: Omit<WorkHistoryEvent, 'id' | 'timestamp' | 'date' | 'employeeId'>) => {
    try {
      const historyRef = collection(db, 'employees', employeeId, 'work_history');
      const docRef = await addDoc(historyRef, {
        employeeId,
        ...eventData,
        date: new Date().toISOString(),
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("[WORK_HISTORY] Error creating document:", e);
      throw e;
    }
};

export const logAdminEvent = async (employeeId: string, logData: Omit<AdminLogEvent, 'id' | 'timestamp' | 'date' | 'employeeId'>) => {
    try {
      const logsRef = collection(db, 'employees', employeeId, 'admin_log');
      const docRef = await addDoc(logsRef, {
        employeeId,
        ...logData,
        date: new Date().toISOString(),
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("[ADMIN_LOG] Error creating document:", e);
      throw e;
    }
};

export function useEmployeeHistory(employeeId: string | null | undefined) {
  const { authReady, currentUser } = useAuth();
  const [workHistory, setWorkHistory] = useState<WorkHistoryEvent[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLogEvent[]>([]);
  const [employeeFiles, setEmployeeFiles] = useState<EmployeeFile[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!authReady || !currentUser || !employeeId) {
      setWorkHistory([]);
      setAdminLogs([]);
      setEmployeeFiles([]);
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);

    const historyRef = collection(db, 'employees', employeeId, 'work_history');
    const logsRef = collection(db, 'employees', employeeId, 'admin_log');
    const filesRef = collection(db, 'employees', employeeId, 'employee_files');

    const unsubHistory = onSnapshot(historyRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkHistoryEvent));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setWorkHistory(data);
    }, (err) => {
        console.error("[WORK_HISTORY] Error loading work history:", err);
    });

    const unsubLogs = onSnapshot(logsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminLogEvent));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAdminLogs(data);
    }, (err) => {
        console.error("[ADMIN_LOG] Error loading admin logs:", err);
    });

    const unsubFiles = onSnapshot(filesRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeeFile));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEmployeeFiles(data);
    }, (err) => {
        console.error("[EMPLOYEE_FILES] Error loading employee files:", err);
    });

    setLoadingHistory(false);

    return () => {
      unsubHistory();
      unsubLogs();
      unsubFiles();
    };
  }, [authReady, currentUser, employeeId]);

  const addWorkHistoryEvent = async (eventData: Omit<WorkHistoryEvent, 'id' | 'timestamp' | 'date'>) => {
    if (!employeeId) return;
    await logWorkHistoryEvent(employeeId, eventData);
  };

  const addAdminLog = async (logData: Omit<AdminLogEvent, 'id' | 'timestamp' | 'date'>) => {
    if (!employeeId) return;
    await logAdminEvent(employeeId, logData);
  };

  const uploadEmployeeFile = async (file: File, category: string) => {
    if (!employeeId || !auth.currentUser) {
      console.error("[EMPLOYE_FILES] upload failed: missing employeeId or auth");
      return;
    }
    
    try {
      const fileId = crypto.randomUUID();
      const filePath = `employees/${employeeId}/files/${fileId}-${file.name}`;

      // 1. Guardar localmente primero (Filesystem First)
      let physicalPath = file.name;
      try {
        physicalPath = await pdfFileEngine.savePdfToDevice(file.name, file);
      } catch (saveErr) {
        console.warn("[EMPLOYE_FILES] Error guardando PDF físico en dispositivo", saveErr);
      }

      // 2. Calcular Checksum SHA-256
      const checksum = await calculateBlobChecksum(file);

      // 3. Crear metadatos optimistas en Firestore para visibilidad inmediata offline
      const filesRef = collection(db, 'employees', employeeId, 'employee_files');
      const docRef = doc(filesRef, fileId);

      await setDoc(docRef, {
        employeeId,
        name: file.name,
        size: file.size,
        type: file.type,
        category,
        date: new Date().toISOString(),
        timestamp: serverTimestamp(),
        uploadedByName: auth.currentUser.displayName || auth.currentUser.email || 'Admin',
        uploadedByUid: auth.currentUser.uid,
        downloadUrl: "", // Se llenará tras sincronizarse en segundo plano
        imageUrl: "", // redundancy for compatibility
        downloadURL: "",
        url: "",
        storagePath: filePath,
        checksum: checksum,
        isOffline: true
      });

      // 4. Encolar upload en SQLite (Queue Second)
      const targetColl = `employees/${employeeId}/employee_files`;
      await pdfOfflineQueue.enqueuePdfUpload(
        physicalPath,
        file.name,
        file.type,
        'payroll', // module
        targetColl, // targetCollection
        fileId, // targetDocId
        checksum
      );

      // 5. Si está online, disparar el ciclo de sincronización en segundo plano (Sync Third)
      if (networkProbe.isOnline()) {
        runPdfSyncCycle().catch((err) => {
          console.error("[EMPLOYE_FILES] Error al correr runPdfSyncCycle posterior a encolar", err);
        });
      }

    } catch (e) {
      console.error("[EMPLOYE_FILES] Error generating file:", e);
      throw e; // re-throw to let the caller handle it (e.g. stop uploading state)
    }
  };

  const deleteEmployeeFile = async (file: EmployeeFile) => {
    if (!employeeId || !auth.currentUser) {
      throw new Error("Missing employeeId or auth");
    }

    try {
      // 1. Delete from Storage
      // Prefer using storagePath if available (new files), fallback to downloadUrl logic (legacy)
      const fileRef = file.storagePath 
        ? ref(storage, file.storagePath) 
        : ref(storage, file.downloadUrl);
        
      await deleteObject(fileRef);

      // 2. Delete from Firestore
      const docRef = doc(db, 'employees', employeeId, 'employee_files', file.id);
      await deleteDoc(docRef);

      // 3. Log Admin Event
      await addAdminLog({
        employeeId,
        adminName: auth.currentUser.displayName || auth.currentUser.email || 'Admin',
        adminUid: auth.currentUser.uid,
        action: `Eliminó archivo adjunto`,
        oldValue: file.name,
        newValue: 'Archivo Eliminado'
      });
      
    } catch (e) {
      console.error("[EMPLOYE_FILES] Error deleting file:", e);
      throw e;
    }
  };

  return {
    workHistory,
    adminLogs,
    employeeFiles,
    loadingHistory,
    addWorkHistoryEvent,
    addAdminLog,
    uploadEmployeeFile,
    deleteEmployeeFile
  };
}
