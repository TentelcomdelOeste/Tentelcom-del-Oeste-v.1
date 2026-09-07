import { collection, doc, getDoc, getDocs, query, orderBy, where, limit, QueryConstraint, addDoc, updateDoc, deleteDoc, deleteField, onSnapshot } from 'firebase/firestore';
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
  if (typeof createdAt === 'string') return new Date(createdAt);
  if (typeof createdAt.toDate === 'function') return createdAt.toDate();
  if (createdAt.seconds) return new Date(createdAt.seconds * 1000);
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
    return [];
  }
};

export const subscribeToProjects = (
  callback: (projects: Project[], hasMore: boolean) => void,
  limitSize: number = 60,
  filters?: ProjectFilterOptions
): () => void => {
  const yearNum = filters?.year ? parseInt(filters.year, 10) : NaN;
  const monthNum = filters?.month ? parseInt(filters.month, 10) : NaN;

  // CASO A: Mes especificado sin año (Todos los años + Mes específico)
  if (isNaN(yearNum) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
    const currentYear = new Date().getFullYear();
    const candidateYears: number[] = [];
    for (let y = currentYear + 1; y >= 2020; y--) {
      candidateYears.push(y);
    }

    const yearDocsMap = new Map<number, Project[]>();
    const unsubscribes: (() => void)[] = [];
    const monthStr = String(monthNum).padStart(2, '0');

    candidateYears.forEach(y => {
      const nextYear = monthNum === 12 ? y + 1 : y;
      const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
      const nextMonthStr = String(nextMonthNum).padStart(2, '0');

      const startStr = `${y}-${monthStr}-01`;
      const endStr = `${nextYear}-${nextMonthStr}-01`;

      const q = query(
        collection(db, COLLECTION_NAME),
        where('createdAt', '>=', startStr),
        where('createdAt', '<', endStr),
        orderBy('createdAt', 'desc'),
        limit(limitSize)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const yearProjects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
        yearDocsMap.set(y, yearProjects);

        const combinedMap = new Map<string, Project>();
        yearDocsMap.forEach(arr => {
          arr.forEach(p => combinedMap.set(p.id, p));
        });

        const combinedProjects = Array.from(combinedMap.values()).sort((a, b) => {
          const dA = parseCreatedAtDate(a.createdAt)?.getTime() || 0;
          const dB = parseCreatedAtDate(b.createdAt)?.getTime() || 0;
          return dB - dA;
        });

        const anyYearHitLimit = Array.from(yearDocsMap.values()).some(arr => arr.length >= limitSize);
        const hasMore = limitSize > 0 ? (combinedProjects.length >= limitSize || anyYearHitLimit) : false;

        const sliced = limitSize > 0 ? combinedProjects.slice(0, limitSize) : combinedProjects;
        callback(sliced, hasMore);
      }, (error) => {
        console.error(`Error listening to projects for year ${y} month ${monthNum}:`, error);
      });

      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }

  // CASO B: Año especificado (con o sin mes) o Sin filtros (Todos los años + Todos los meses)
  const constraints: QueryConstraint[] = [];

  if (!isNaN(yearNum)) {
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      const monthStr = String(monthNum).padStart(2, '0');
      const nextYear = monthNum === 12 ? yearNum + 1 : yearNum;
      const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
      const nextMonthStr = String(nextMonthNum).padStart(2, '0');

      const startStr = `${yearNum}-${monthStr}-01`;
      const endStr = `${nextYear}-${nextMonthStr}-01`;

      constraints.push(where('createdAt', '>=', startStr));
      constraints.push(where('createdAt', '<', endStr));
    } else {
      const startStr = `${yearNum}-01-01`;
      const endStr = `${yearNum + 1}-01-01`;

      constraints.push(where('createdAt', '>=', startStr));
      constraints.push(where('createdAt', '<', endStr));
    }
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (limitSize > 0) {
    constraints.push(limit(limitSize));
  }

  const q = query(collection(db, COLLECTION_NAME), ...constraints);

  return onSnapshot(q, (snapshot) => {
    let projects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));

    if (isNaN(yearNum) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      projects = projects.filter(p => {
        const d = parseCreatedAtDate(p.createdAt);
        if (!d || isNaN(d.getTime())) return false;
        return d.getMonth() + 1 === monthNum;
      });
    }

    const hasMore = limitSize > 0 ? snapshot.docs.length >= limitSize : false;
    callback(projects, hasMore);
  }, (error) => {
    console.error("Error listening to projects:", error);
    callback([], false);
  });
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
    } else if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      const currentYear = new Date().getFullYear();
      const monthStr = String(monthNum).padStart(2, '0');
      for (let y = currentYear + 1; y >= 2020; y--) {
        const nextYear = monthNum === 12 ? y + 1 : y;
        const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
        const nextMonthStr = String(nextMonthNum).padStart(2, '0');
        const startStr = `${y}-${monthStr}-01`;
        const endStr = `${nextYear}-${nextMonthStr}-01`;
        const qF = query(
          collection(db, COLLECTION_NAME),
          where('createdAt', '>=', startStr),
          where('createdAt', '<', endStr),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        fallbackPromises.push(getDocs(qF));
      }
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
    const quotes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        docId: doc.id,
        id: data.id !== undefined ? data.id : doc.id,
      } as Quote;
    });

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
    throw error;
  }
};

export const checkQuoteHasProject = async (quoteIdOrDocId: string): Promise<Project | null> => {
  if (!quoteIdOrDocId) return null;
  return getProjectByQuoteId(quoteIdOrDocId);
};

export const generateNextProjectNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `TTC-${year}-`;
  
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    
    const occupiedNumbers = new Set<number>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const pNumber = data.projectNumber;
      if (pNumber && typeof pNumber === 'string' && pNumber.startsWith(prefix)) {
        const numPart = parseInt(pNumber.replace(prefix, ''), 10);
        if (!isNaN(numPart)) {
          occupiedNumbers.add(numPart);
        }
      }
    });
    
    let nextNum = 1;
    while (occupiedNumbers.has(nextNum)) {
      nextNum++;
    }
    
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error generating project number:", error);
    return `${prefix}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }
};

export const createProjectWithQuoteHandling = async ({
  projectData,
  selectedQuoteId,
  selectedQuoteCommercialId,
  createdBy,
  createdByDisplayName,
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
}): Promise<{ newProject: Project; unlinkedProjectId?: string }> => {
  let unlinkedProjectId: string | undefined;

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

  const projectNumber = await generateNextProjectNumber();
  const now = new Date().toISOString();

  const newProjectData: Omit<Project, 'id'> = {
    ...projectData,
    projectNumber,
    origin: selectedQuoteId ? 'Cotización' : 'Manual',
    quoteId: selectedQuoteId || undefined,
    quoteCommercialId: selectedQuoteId ? selectedQuoteCommercialId : undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy,
    createdByDisplayName,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), newProjectData);

  return {
    newProject: {
      ...newProjectData,
      id: docRef.id,
    } as Project,
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
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};
