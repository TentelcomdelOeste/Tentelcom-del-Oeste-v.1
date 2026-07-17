
import { db, auth, firebaseConfig } from '../firebase';
import { 
  collection, 
  addDoc,
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where, 
  updateDoc, 
  getDoc,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
  Unsubscribe 
} from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  setPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { Employee, AbsenceRecord, PayStub, PayStubData } from '../financeTypes';
import { isAdmin } from '../utils/permissions';
import { canGeneratePaystub } from '../utils/paystubValidation';

// Helper interno para generar emails (Lógica movida aquí para encapsulamiento)
const generateInternalEmail = (name: string, attempt: number = 1): string => {
    // Safeguard: Ensure name is not empty
    const safeName = name.trim() || 'Usuario';
    const nameParts = safeName.toLowerCase().split(' ').filter(p => p);
    
    if (nameParts.length === 0) return `usuario${Date.now()}@tentelcom.internal`;

    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : firstName;

    const firstInitial = firstName.charAt(0);
    const baseUsername = `${firstInitial}${lastName}`;
    
    const suffix = attempt > 1 ? attempt.toString() : '';

    return `${baseUsername}${suffix}@tentelcom.internal`;
};

export const financeRepository = {
  
  // --- SUBSCRIPCIONES (READ) ---

  subscribeToEmployees: (
    onUpdate: (data: Employee[]) => void, 
    onError: (error: Error) => void
  ): Unsubscribe => {
    const authInstance = getAuth();
    if (!authInstance.currentUser) {
      console.warn('[financeRepository] subscribeToEmployees abortado: sin usuario');
      return () => {};
    }
    const _isDevMode = typeof window !== 'undefined' && window.self !== window.top;
    const employeesCollection = collection(db, "employees");
    
    return onSnapshot(
      employeesCollection, 
      (snapshot: QuerySnapshot<DocumentData>) => {
        const _rawData = snapshot.docs.map(doc => doc.data());
        
        const employees = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id
          } as Employee;
        });
        
        onUpdate(employees);
      }, 
      (err: any) => {
        if (err.code === 'permission-denied') {
          console.warn("Acceso restringido a empleados");
          return;
        }
        onError(err);
      }
    );
  },

  subscribeToAbsences: (
    onUpdate: (data: AbsenceRecord[]) => void
  ): Unsubscribe => {
    const authInstance = getAuth();
    if (!authInstance.currentUser) {
      console.warn('[financeRepository] subscribeToAbsences abortado: sin usuario');
      return () => {};
    }
    const isDevMode = typeof window !== 'undefined' && window.self !== window.top;
    const absencesCollection = collection(db, "absence_records");
    const q = isDevMode 
      ? absencesCollection 
      : query(absencesCollection, orderBy("startDate", "desc"));
    
    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const _rawData = snapshot.docs.map(doc => doc.data());
      
      const absences = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id
        } as AbsenceRecord;
      });
      
      onUpdate(absences);
    }, (err: any) => {
      if (err.code === 'permission-denied') {
        console.warn("Acceso restringido a ausencias");
        return;
      }
      console.error("Error fetching absences:", err);
    });
  },

  subscribeToPayStubs: (
    userEmail: string,
    role: string,
    filters: { year?: string; month?: string; fortnight?: string; employeeEmail?: string } | null,
    onUpdate: (data: PayStub[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe => {
    const authInstance = getAuth();
    if (!authInstance.currentUser) {
      console.warn('[financeRepository] subscribeToPayStubs abortado: sin usuario');
      return () => {};
    }
    const isDevMode = typeof window !== 'undefined' && window.self !== window.top;

    const stubsCollection = collection(db, "pay_stubs");
    const canViewAllStubs = isAdmin(role) || isDevMode;
    
    const queryConstraints: any[] = [];
    
    // Si el usuario no es admin/dev o si se filtra específicamente por un email
    if (!canViewAllStubs) {
      queryConstraints.push(where("employeeEmail", "==", userEmail));
    } else if (filters?.employeeEmail && filters.employeeEmail !== 'all') {
      queryConstraints.push(where("employeeEmail", "==", filters.employeeEmail));
    }

    // Filtros de Partición Temporal (Lazy Loading Seguro)
    if (filters?.year && filters.year !== 'all') {
      const yearNum = parseInt(filters.year, 10);
      if (!isNaN(yearNum)) queryConstraints.push(where("year", "==", yearNum));
    }
    
    if (filters?.month && filters.month !== 'all') {
      const monthNum = parseInt(filters.month, 10);
      if (!isNaN(monthNum)) queryConstraints.push(where("month", "==", monthNum));
    }
    
    if (filters?.fortnight && filters.fortnight !== 'all') {
       queryConstraints.push(where("fortnight", "==", filters.fortnight));
    }

    const q = queryConstraints.length > 0 
        ? query(stubsCollection, ...queryConstraints)
        : stubsCollection;

    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const stubs = snapshot.docs.map(doc => {
        const data = doc.data();

        // ----------------------------------------------------
        // MANEJO SEGURO DE TIMESTAMPS PARA COLILLAS (HÍBRIDO)
        // ----------------------------------------------------
        let generatedDateStr = data.generatedDate;
        if (generatedDateStr && typeof generatedDateStr.toDate === 'function') {
           generatedDateStr = generatedDateStr.toDate().toISOString();
        }

        let createdAtStr = data.createdAt;
        if (createdAtStr && typeof createdAtStr.toDate === 'function') {
           createdAtStr = createdAtStr.toDate().toISOString();
        }

        let updatedAtStr = data.updatedAt;
        if (updatedAtStr && typeof updatedAtStr.toDate === 'function') {
           updatedAtStr = updatedAtStr.toDate().toISOString();
        }

        return {
          ...data,
          id: doc.id,
          generatedDate: generatedDateStr || new Date().toISOString(),
          createdAt: createdAtStr || data.createdAt,
          updatedAt: updatedAtStr || data.updatedAt,
        } as PayStub;
      });
      
      const _totalDocs = stubs.length;
      const filteredStubs = stubs.filter(stub => !stub.isDeleted);
      
      // Ordenamiento se mantiene en cliente o hook por ahora para no romper lógica compleja de sort
      onUpdate(filteredStubs);
    }, (err: any) => {
      if (err.code === 'permission-denied') {
        console.warn("Acceso restringido a colillas de pago");
        return;
      }
      onError(err);
    });
  },

  subscribeToAutomaticAdjustments: (
    onUpdate: (data: any[]) => void, 
    onError: (error: Error) => void
  ): Unsubscribe => {
    const authInstance = getAuth();
    if (!authInstance.currentUser) {
      console.warn('[financeRepository] subscribeToAutomaticAdjustments abortado: sin usuario');
      return () => {};
    }
    const adjCollection = collection(db, "automatic_adjustments");
    return onSnapshot(adjCollection, (snapshot) => {
      const adjs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      onUpdate(adjs);
    }, (err: any) => {
      if (err.code === 'permission-denied') {
        console.warn("Acceso restringido a ajustes automáticos");
        return;
      }
      onError(err);
    });
  },

  getEmployeeById: async (id: string): Promise<Employee | null> => {
    try {
      const empDoc = await getDoc(doc(db, "employees", id));
      if (empDoc.exists()) {
        return { id: empDoc.id, ...empDoc.data() } as Employee;
      }
      return null;
    } catch (e) {
      console.error("Error fetching employee:", e);
      return null;
    }
  },

  getPayStubById: async (id: string): Promise<PayStub | null> => {
    const stubRef = doc(db, "pay_stubs", id);
    const stubSnap = await getDoc(stubRef);
    if (stubSnap.exists()) {
      const data = stubSnap.data();

      // ----------------------------------------------------
      // MANEJO SEGURO DE TIMESTAMPS PARA COLILLAS (HÍBRIDO)
      // ----------------------------------------------------
      let generatedDateStr = data.generatedDate;
      if (generatedDateStr && typeof generatedDateStr.toDate === 'function') {
         generatedDateStr = generatedDateStr.toDate().toISOString();
      }

      let createdAtStr = data.createdAt;
      if (createdAtStr && typeof createdAtStr.toDate === 'function') {
         createdAtStr = createdAtStr.toDate().toISOString();
      }

      let updatedAtStr = data.updatedAt;
      if (updatedAtStr && typeof updatedAtStr.toDate === 'function') {
         updatedAtStr = updatedAtStr.toDate().toISOString();
      }

      return {
        ...data,
        id: stubSnap.id,
        generatedDate: generatedDateStr || new Date().toISOString(),
        createdAt: createdAtStr || data.createdAt,
        updatedAt: updatedAtStr || data.updatedAt,
      } as PayStub;
    }
    return null;
  },

  // --- ESCRITURA (WRITE) - EMPLEADOS ---

  updateEmployee: async (id: string, data: Partial<Employee>): Promise<void> => {
    const employeeRef = doc(db, "employees", id);
    await updateDoc(employeeRef, data);
  },

  createEmployeeWithAuth: async (employeeData: Partial<Employee>, password: string): Promise<{ success: boolean; message?: string }> => {
    let userCredential;
    let finalEmail = employeeData.email && employeeData.email.trim() !== '' ? employeeData.email.trim() : '';
    
    // Crear instancia temporal de Auth para no desloguear al admin
    const tempAppName = `auth-worker-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    await setPersistence(tempAuth, inMemoryPersistence);

    try {
      if (finalEmail) {
        try {
          userCredential = await createUserWithEmailAndPassword(tempAuth, finalEmail, password);
        } catch (err: any) {
          console.error("❌ Error creando usuario Auth:", err);
          if (
            err.code === "auth/email-already-in-use" ||
            err.code === "auth/invalid-email" ||
            err.code === "auth/weak-password"
          ) {
            return { success: false, message: "Credenciales inválidas" };
          }
          throw err;
        }
      } else {
        // Generación de correo interno
        let attempt = 1;
        let created = false;
        // FIX TS2345: Use default 'User' if name is missing to satisfy strict check
        const baseName = employeeData.name || 'User';
        
        while (!created) {
          finalEmail = generateInternalEmail(baseName, attempt);
          try {
            userCredential = await createUserWithEmailAndPassword(tempAuth, finalEmail, password);
            created = true;
          } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
              attempt++;
            } else {
              console.error("❌ Error creando usuario Auth con email generado:", err);
              if (
                err.code === "auth/invalid-email" ||
                err.code === "auth/weak-password"
              ) {
                return { success: false, message: "Credenciales inválidas" };
              }
              throw err;
            }
          }
        }
      }

      if (!userCredential) {
          console.error("❌ No se pudo crear el usuario en Auth");
          return { success: false, message: "No se pudo crear el usuario en el sistema de autenticación." };
      }

      const newUserId = userCredential.user.uid;
      const finalFirestoreData = { ...employeeData, email: finalEmail, forcePasswordChange: true };

      // Guardar en Firestore
    try {
        await setDoc(doc(db, "employees", newUserId), finalFirestoreData);
    } catch (err: any) {
          console.error("❌ Error guardando en Firestore:", err);
          throw err;
      }
      
      return { success: true };
    } finally {
        await deleteApp(tempApp).catch(() => null);
    }
  },

  deleteEmployee: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, "employees", id));
  },

  setForcePasswordChange: async (id: string): Promise<void> => {
    const employeeRef = doc(db, "employees", id);
    await updateDoc(employeeRef, { forcePasswordChange: true });
  },

  sendPasswordReset: async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  },

  // --- ESCRITURA (WRITE) - AUSENCIAS ---

  saveAbsence: async (absence: Omit<AbsenceRecord, 'id'>, id?: string): Promise<void> => {
    const docId = id || doc(collection(db, "absence_records")).id;
    await setDoc(doc(db, "absence_records", docId), absence);
  },

  deleteAbsence: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, "absence_records", id));
  },

  // --- ESCRITURA (WRITE) - COLILLAS (PAY STUBS) ---

  savePayStub: async (docId: string, data: PayStubData): Promise<void> => {
    // Protección de Nivel Repositorio: Validar periodos futuros
    const validation = canGeneratePaystub(data.year, data.month, data.fortnight);
    if (!validation.allowed) {
      throw new Error(`${validation.message} ${validation.details || ''}`);
    }

    await setDoc(doc(db, "pay_stubs", docId), data);
  },

  deletePayStub: async (id: string, auditInfo?: { deletedBy?: string, deletedByUid?: string, deleteReason?: string }): Promise<void> => {
    const stubRef = doc(db, "pay_stubs", id);
    
    // FASE 3: Endurecimiento Empresarial - Soft Delete
    try {
      const updatePayload = {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: auditInfo?.deletedBy || 'System',
        deletedByUid: auditInfo?.deletedByUid || 'system',
        deleteReason: auditInfo?.deleteReason || 'Eliminación administrativa'
      };
      
      await updateDoc(stubRef, updatePayload);
    } catch (error) {
      console.error("❌ [SOFT DELETE] Error en updateDoc:", error);
      throw error;
    }
  },

  createAutomaticAdjustment: async (data: any): Promise<void> => {
    const defaultData = {
      ...data,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(collection(db, "automatic_adjustments"), defaultData);
  },

  updateAutomaticAdjustment: async (id: string, data: any): Promise<void> => {
    const adjRef = doc(db, "automatic_adjustments", id);
    const updatePayload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(adjRef, updatePayload);
  },

  deleteAutomaticAdjustment: async (id: string): Promise<void> => {
    const adjRef = doc(db, "automatic_adjustments", id);
    await deleteDoc(adjRef);
  }
};
