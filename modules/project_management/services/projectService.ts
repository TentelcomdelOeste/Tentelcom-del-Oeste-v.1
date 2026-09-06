import { collection, doc, getDoc, getDocs, query, orderBy, where, addDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Project } from '../types';
import { Quote } from '../../../utils/types';

const COLLECTION_NAME = 'projects';

export const getProjects = async (): Promise<Project[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
  } catch (error) {
    console.error("Error fetching projects:", error);
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
