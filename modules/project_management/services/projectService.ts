import { collection, doc, getDoc, getDocs, query, orderBy, where, limit, updateDoc, deleteDoc, deleteField, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Project } from '../types';
import { Quote } from '../../../utils/types';

const COLLECTION_NAME = 'projects';

export interface ProjectFilterOptions {
  year?: string;
  month?: string;
}

export const parseCreatedAtDate = (createdAt: any): Date | null => {
  if (!createdAt) return null;
  if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof createdAt.toDate === 'function') return createdAt.toDate();
  if (createdAt.seconds) return new Date(createdAt.seconds * 1000);
  if (typeof createdAt === 'number') return new Date(createdAt);
  if (createdAt instanceof Date) return createdAt;
  return null;
};

export const getProjects = async (limitSize: number = 60): Promise<Project[]> => {
  try {
    const q = limitSize > 0
      ? query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitSize))
      : query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
  } catch (error) {
    console.error("Error fetching projects:", error);
    try {
      const fallbackSnap = await getDocs(collection(db, COLLECTION_NAME));
      return fallbackSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
    } catch (fallbackError) {
      console.error("Error in fallback fetching projects:", fallbackError);
      return [];
    }
  }
};

export const subscribeToProjects = (
  callback: (projects: Project[], hasMore: boolean) => void,
  limitSize: number = 60,
  filters?: ProjectFilterOptions
): () => void => {
  const collectionRef = collection(db, COLLECTION_NAME);
  
  const handleDocs = (docs: any[]) => {
    const yearNum = filters?.year ? parseInt(filters.year, 10) : NaN;
    const monthNum = filters?.month && filters.month !== 'all' ? parseInt(filters.month, 10) : NaN;

    let projects = docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));

    // Sort descending by date in-memory
    projects.sort((a, b) => {
      const dateA = parseCreatedAtDate(a.createdAt)?.getTime() || 0;
      const dateB = parseCreatedAtDate(b.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });

    if (!isNaN(yearNum) || !isNaN(monthNum)) {
      projects = projects.filter(p => {
        const d = parseCreatedAtDate(p.createdAt);
        if (!d || isNaN(d.getTime())) return true;
        if (!isNaN(yearNum) && d.getFullYear() !== yearNum) return false;
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 && d.getMonth() + 1 !== monthNum) return false;
        return true;
      });
    }

    const hasMore = limitSize > 0 ? docs.length >= limitSize : false;
    callback(projects, hasMore);
  };

  const q = limitSize > 0
    ? query(collectionRef, orderBy('createdAt', 'desc'), limit(limitSize))
    : query(collectionRef, orderBy('createdAt', 'desc'));

  let unsubFallback: (() => void) | null = null;

  const unsubPrimary = onSnapshot(q, (snapshot) => {
    handleDocs(snapshot.docs);
  }, (error) => {
    console.warn("Error listening to projects with orderBy, using collection fallback:", error);
    unsubFallback = onSnapshot(collectionRef, (snapshot) => {
      handleDocs(snapshot.docs);
    }, (err) => {
      console.error("Error in fallback projects subscription:", err);
      callback([], false);
    });
  });

  return () => {
    unsubPrimary();
    if (unsubFallback) unsubFallback();
  };
};

export const searchProjectsInFirestore = async (
  searchTerm: string,
  filters?: ProjectFilterOptions
): Promise<Project[]> => {
  if (!searchTerm || !searchTerm.trim()) return [];
  const term = searchTerm.trim();
  const termUpper = term.toUpperCase();
  const searchLower = term.toLowerCase();

  try {
    const resultsMap = new Map<string, Project>();

    const qNum = query(
      collection(db, COLLECTION_NAME),
      where('projectNumber', '>=', termUpper),
      where('projectNumber', '<=', termUpper + '\uf8ff'),
      limit(50)
    );
    const qName = query(
      collection(db, COLLECTION_NAME),
      where('name', '>=', term),
      where('name', '<=', term + '\uf8ff'),
      limit(50)
    );
    const qClient = query(
      collection(db, COLLECTION_NAME),
      where('clientName', '>=', term),
      where('clientName', '<=', term + '\uf8ff'),
      limit(50)
    );

    const [snapNum, snapName, snapClient] = await Promise.all([
      getDocs(qNum),
      getDocs(qName),
      getDocs(qClient)
    ]);

    snapNum.docs.forEach(d => resultsMap.set(d.id, { ...d.data(), id: d.id } as Project));
    snapName.docs.forEach(d => resultsMap.set(d.id, { ...d.data(), id: d.id } as Project));
    snapClient.docs.forEach(d => resultsMap.set(d.id, { ...d.data(), id: d.id } as Project));

    const yearNum = filters?.year ? parseInt(filters.year, 10) : NaN;
    const monthNum = filters?.month ? parseInt(filters.month, 10) : NaN;

    const fallbackPromises: Promise<any>[] = [];

    if (!isNaN(yearNum)) {
      let startStr = `${yearNum}-01-01`;
      let endStr = `${yearNum + 1}-01-01`;
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        const monthStr = String(monthNum).padStart(2, '0');
        const nextYear = monthNum === 12 ? yearNum + 1 : yearNum;
        const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
        const nextMonthStr = String(nextMonthNum).padStart(2, '0');
        startStr = `${yearNum}-${monthStr}-01`;
        endStr = `${nextYear}-${nextMonthStr}-01`;
      }
      const qFallback = query(
        collection(db, COLLECTION_NAME),
        where('createdAt', '>=', startStr),
        where('createdAt', '<', endStr),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      fallbackPromises.push(getDocs(qFallback));
    } else {
      const qFallback = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(100));
      fallbackPromises.push(getDocs(qFallback));
    }

    const fallbackSnaps = await Promise.all(fallbackPromises);
    fallbackSnaps.forEach(snap => {
      snap.docs.forEach((d: any) => {
        const data = d.data();
        const p = { ...data, id: d.id } as Project;
        if (
          p.name.toLowerCase().includes(searchLower) ||
          p.projectNumber.toLowerCase().includes(searchLower) ||
          (p.clientName || '').toLowerCase().includes(searchLower)
        ) {
          resultsMap.set(d.id, p);
        }
      });
    });

    let results = Array.from(resultsMap.values());

    if (!isNaN(yearNum) || !isNaN(monthNum)) {
      results = results.filter(p => {
        const d = parseCreatedAtDate(p.createdAt);
        if (!d || isNaN(d.getTime())) return false;
        if (!isNaN(yearNum) && d.getFullYear() !== yearNum) return false;
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 && d.getMonth() + 1 !== monthNum) return false;
        return true;
      });
    }

    return results;
  } catch (error) {
    console.error("Error searching projects in Firestore:", error);
    return [];
  }
};

export const getProjectById = async (id: string): Promise<Project | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...docSnap.data(), id: docSnap.id } as Project;
    }
    return null;
  } catch (error) {
    console.error("Error fetching project:", error);
    return null;
  }
};

export const getProjectByQuoteId = async (quoteId: string): Promise<Project | null> => {
  if (!quoteId) return null;
  try {
    const q = query(collection(db, COLLECTION_NAME), where('quoteId', '==', quoteId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Project;
    }
    return null;
  } catch (error) {
    console.error("Error fetching project by quote:", error);
    return null;
  }
};

export const getApprovedQuotes = async (): Promise<Quote[]> => {
  try {
    const q = query(collection(db, "quotes"), where("estado", "==", "Aprobada"));
    const snapshot = await getDocs(q);
    const quotes = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          docId: doc.id,
          id: data.id !== undefined ? data.id : doc.id,
        } as Quote;
      })
      .filter(q => !q.isDeleted && (q.estado === 'Aprobada' || (q as any).status === 'Aprobada'));

    // In-memory sort by id descending
    quotes.sort((a, b) => {
      const numA = Number(a.id);
      const numB = Number(b.id);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    return quotes;
  } catch (error) {
    console.error("Error fetching approved quotes:", error);
    try {
      // Fallback in case of index/filter query issue
      const allSnap = await getDocs(collection(db, "quotes"));
      const fallbackQuotes = allSnap.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            docId: doc.id,
            id: data.id !== undefined ? data.id : doc.id,
          } as Quote;
        })
        .filter(q => !q.isDeleted && (q.estado === 'Aprobada' || (q as any).status === 'Aprobada'));

      fallbackQuotes.sort((a, b) => {
        const numA = Number(a.id);
        const numB = Number(b.id);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numB - numA;
        }
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      return fallbackQuotes;
    } catch (fallbackErr) {
      console.error("Fallback error fetching quotes:", fallbackErr);
      return [];
    }
  }
};

export const checkQuoteHasProject = async (quoteIdOrDocId: string): Promise<Project | null> => {
  if (!quoteIdOrDocId) return null;
  return getProjectByQuoteId(quoteIdOrDocId);
};

const getOccupiedProjectNumbers = async (year: number): Promise<Set<number>> => {
  const prefix = `TTC-${year}-`;
  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectNumber', '>=', prefix),
    where('projectNumber', '<=', prefix + '\uf8ff')
  );

  // Do NOT catch errors here. If Firestore read fails, propagate the error
  // so we never mistakenly return an empty set and assign TTC-YYYY-001.
  const snapshot = await getDocs(q);

  const occupied = new Set<number>();
  snapshot.docs.forEach(docSnap => {
    const pNumber = docSnap.data().projectNumber;
    if (pNumber && typeof pNumber === 'string' && pNumber.startsWith(prefix)) {
      const numPart = parseInt(pNumber.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > 0) {
        occupied.add(numPart);
      }
    }
  });

  return occupied;
};

export const generateNextProjectNumber = async (specifiedYear?: number): Promise<string> => {
  const year = specifiedYear || new Date().getFullYear();
  const prefix = `TTC-${year}-`;
  const counterRef = doc(db, 'counters', `project_${year}`);

  try {
    // 1. Fetch live occupied project numbers from the projects collection BEFORE running transaction
    // to keep the transaction extremely fast, predictable, and fully standard-compliant (no standard reads inside transaction).
    const occupiedInDb = await getOccupiedProjectNumbers(year);

    const assignedNumber = await runTransaction(db, async (transaction) => {
      // 2. Transactionally read the year counter lock document
      const counterSnap = await transaction.get(counterRef);

      let reservedMap: Record<string, number> = {};
      if (counterSnap.exists()) {
        reservedMap = counterSnap.data().reservedMap || {};
      }

      const now = Date.now();
      const CLEANUP_THRESHOLD_MS = 60000; // 60s threshold for in-flight reservations

      const activeOccupied = new Set<number>(occupiedInDb);
      const cleanedReservedMap: Record<string, number> = {};

      Object.entries(reservedMap).forEach(([numStr, timestamp]) => {
        const num = parseInt(numStr, 10);
        const isRecent = (now - timestamp) < CLEANUP_THRESHOLD_MS;
        if (activeOccupied.has(num) || isRecent) {
          activeOccupied.add(num);
          cleanedReservedMap[numStr] = timestamp;
        }
      });

      // 3. Find smallest available positive integer starting from 1
      let candidate = 1;
      while (activeOccupied.has(candidate)) {
        candidate++;
      }

      // 4. Reserve this candidate number in the counter document
      cleanedReservedMap[candidate.toString()] = now;

      if (counterSnap.exists()) {
        transaction.update(counterRef, {
          reservedMap: cleanedReservedMap,
          lastAssigned: candidate,
          updatedAt: new Date().toISOString(),
        });
      } else {
        transaction.set(counterRef, {
          type: 'project',
          year,
          reservedMap: cleanedReservedMap,
          lastAssigned: candidate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return candidate;
    });

    return `${prefix}${assignedNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error generating project number:", error);
    throw new Error(`Error al generar el número de proyecto para el año ${year}: ${(error as Error).message}`);
  }
};

export const createProjectWithQuoteHandling = async ({
  projectData,
  selectedQuoteId,
  selectedQuoteCommercialId,
  createdBy,
  createdByDisplayName,
  idempotencyKey,
}: {
  projectData: {
    name: string;
    status: Project['status'];
    clientId: string;
    clientName: string;
    startDate: string;
  };
  selectedQuoteId?: string;
  selectedQuoteCommercialId?: string;
  createdBy: string;
  createdByDisplayName?: string;
  idempotencyKey?: string;
}): Promise<{ newProject: Project; unlinkedProjectId?: string }> => {
  let unlinkedProjectId: string | undefined;

  // 1. Unlink legacy projects from this quote if needed
  if (selectedQuoteId) {
    const existingProject = await getProjectByQuoteId(selectedQuoteId);
    if (existingProject) {
      unlinkedProjectId = existingProject.id;
      const otherRef = doc(db, COLLECTION_NAME, existingProject.id);
      await updateDoc(otherRef, {
        quoteId: deleteField(),
        quoteCommercialId: deleteField(),
        origin: 'Manual',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 2. Enforce deterministic document ID using the idempotencyKey
  const finalIdempotencyKey = idempotencyKey || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
  const projectDocRef = doc(db, COLLECTION_NAME, finalIdempotencyKey);

  const year = projectData.startDate ? parseInt(projectData.startDate.substring(0, 4), 10) : new Date().getFullYear();
  const counterRef = doc(db, 'counters', `project_${year}`);
  const prefix = `TTC-${year}-`;

  // 3. Fetch live occupied project numbers from the projects collection BEFORE running the transaction
  // to keep the transaction extremely fast, predictable, and fully standard-compliant (no standard reads inside transaction).
  const occupiedInDb = await getOccupiedProjectNumbers(year);

  // 4. Run the atomic, fully idempotent transaction that binds counter increment AND project creation together
  const result = await runTransaction(db, async (transaction) => {
    // A. Read the project document first to see if it already exists
    const projectSnap = await transaction.get(projectDocRef);
    if (projectSnap.exists()) {
      console.warn(`[projectService] Idempotent creation triggered: project with key ${finalIdempotencyKey} already exists. Returning it.`);
      return {
        project: {
          ...projectSnap.data(),
          id: projectSnap.id,
        } as Project,
        isNew: false,
      };
    }

    // B. Read the counter document
    const counterSnap = await transaction.get(counterRef);

    let reservedMap: Record<string, number> = {};
    if (counterSnap.exists()) {
      reservedMap = counterSnap.data().reservedMap || {};
    }

    const now = Date.now();
    const CLEANUP_THRESHOLD_MS = 60000; // 60s threshold for in-flight reservations

    const activeOccupied = new Set<number>(occupiedInDb);
    const cleanedReservedMap: Record<string, number> = {};

    Object.entries(reservedMap).forEach(([numStr, timestamp]) => {
      const num = parseInt(numStr, 10);
      const isRecent = (now - timestamp) < CLEANUP_THRESHOLD_MS;
      if (activeOccupied.has(num) || isRecent) {
        activeOccupied.add(num);
        cleanedReservedMap[numStr] = timestamp;
      }
    });

    // C. Find smallest available positive integer starting from 1
    let candidate = 1;
    while (activeOccupied.has(candidate)) {
      candidate++;
    }

    const projectNumber = `${prefix}${candidate.toString().padStart(3, '0')}`;

    // D. Update counter reservedMap
    cleanedReservedMap[candidate.toString()] = now;

    if (counterSnap.exists()) {
      transaction.update(counterRef, {
        reservedMap: cleanedReservedMap,
        lastAssigned: candidate,
        updatedAt: new Date().toISOString(),
      });
    } else {
      transaction.set(counterRef, {
        type: 'project',
        year,
        reservedMap: cleanedReservedMap,
        lastAssigned: candidate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // E. Prepare project document write
    const nowIso = new Date().toISOString();
    const newProjectData: Omit<Project, 'id'> = {
      ...projectData,
      projectNumber,
      origin: selectedQuoteId ? 'Cotización' : 'Manual',
      quoteId: selectedQuoteId || undefined,
      quoteCommercialId: selectedQuoteId ? selectedQuoteCommercialId : undefined,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy,
      createdByDisplayName,
      idempotencyKey: finalIdempotencyKey,
    };

    // F. Commit the project creation atomically
    transaction.set(projectDocRef, newProjectData);

    return {
      project: {
        ...newProjectData,
        id: finalIdempotencyKey,
      } as Project,
      isNew: true,
    };
  });

  return {
    newProject: result.project,
    unlinkedProjectId,
  };
};

export const updateProjectWithQuoteHandling = async ({
  id,
  projectData,
  selectedQuoteId,
  selectedQuoteCommercialId,
}: {
  id: string;
  projectData: {
    name: string;
    status: Project['status'];
    clientId: string;
    clientName: string;
    startDate: string;
  };
  selectedQuoteId?: string;
  selectedQuoteCommercialId?: string;
}): Promise<{ updatedProject: Project; unlinkedProjectId?: string }> => {
  let unlinkedProjectId: string | undefined;

  if (selectedQuoteId) {
    const existingProject = await getProjectByQuoteId(selectedQuoteId);
    if (existingProject && existingProject.id !== id) {
      unlinkedProjectId = existingProject.id;
      const otherRef = doc(db, COLLECTION_NAME, existingProject.id);
      await updateDoc(otherRef, {
        quoteId: deleteField(),
        quoteCommercialId: deleteField(),
        origin: 'Manual',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const docRef = doc(db, COLLECTION_NAME, id);
  const now = new Date().toISOString();

  if (selectedQuoteId) {
    await updateDoc(docRef, {
      name: projectData.name,
      status: projectData.status,
      clientId: projectData.clientId,
      clientName: projectData.clientName,
      startDate: projectData.startDate,
      origin: 'Cotización',
      quoteId: selectedQuoteId,
      quoteCommercialId: selectedQuoteCommercialId || null,
      updatedAt: now,
    });
  } else {
    await updateDoc(docRef, {
      name: projectData.name,
      status: projectData.status,
      clientId: projectData.clientId,
      clientName: projectData.clientName,
      startDate: projectData.startDate,
      origin: 'Manual',
      quoteId: deleteField(),
      quoteCommercialId: deleteField(),
      updatedAt: now,
    });
  }

  const updatedSnap = await getDoc(docRef);
  const updatedProject = { ...updatedSnap.data(), id: updatedSnap.id } as Project;

  return {
    updatedProject,
    unlinkedProjectId,
  };
};

export const createProject = async (projectData: Omit<Project, 'id' | 'projectNumber' | 'isActive' | 'createdAt' | 'updatedAt'>, createdBy: string, createdByDisplayName?: string): Promise<Project> => {
  const res = await createProjectWithQuoteHandling({
    projectData: {
      name: projectData.name,
      status: projectData.status,
      clientId: projectData.clientId || '',
      clientName: projectData.clientName || '',
      startDate: projectData.startDate || new Date().toISOString().split('T')[0],
    },
    selectedQuoteId: projectData.quoteId,
    selectedQuoteCommercialId: projectData.quoteCommercialId,
    createdBy,
    createdByDisplayName,
  });
  return res.newProject;
};

export const updateProject = async (id: string, projectData: Partial<Project>): Promise<void> => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...projectData,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const pData = snap.data();
      const pNumber = pData?.projectNumber;
      if (pNumber && typeof pNumber === 'string') {
        const match = pNumber.match(/^TTC-(\d{4})-(\d+)$/);
        if (match) {
          const year = parseInt(match[1], 10);
          const numPart = parseInt(match[2], 10);
          const counterRef = doc(db, 'counters', `project_${year}`);
          try {
            await runTransaction(db, async (transaction) => {
              const counterSnap = await transaction.get(counterRef);
              if (counterSnap.exists()) {
                const reservedMap = { ...(counterSnap.data().reservedMap || {}) };
                if (reservedMap[numPart.toString()]) {
                  delete reservedMap[numPart.toString()];
                  transaction.update(counterRef, {
                    reservedMap,
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
            });
          } catch (e) {
            console.warn("Could not clean reservedMap on project deletion:", e);
          }
        }
      }
    }
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};
