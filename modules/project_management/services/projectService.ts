import { collection, doc, getDoc, getDocs, query, orderBy, where, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Project } from '../types';
import { Quote } from '../../../utils/types';

const COLLECTION_NAME = 'projects';

export const getProjects = async (): Promise<Project[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
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

export const generateNextProjectId = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `TTC-${year}-`;
  
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    let maxNumber = 0;
    
    snapshot.docs.forEach(doc => {
      const id = doc.id;
      if (id.startsWith(prefix)) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNumber) {
          maxNumber = numPart;
        }
      }
    });
    
    const nextNumber = maxNumber + 1;
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error generating project ID:", error);
    return `${prefix}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }
};

export const createProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>, createdBy: string): Promise<Project> => {
  try {
    const id = await generateNextProjectId();
    const now = new Date().toISOString();
    
    const newProject: Project = {
      ...projectData,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };
    
    const docRef = doc(db, COLLECTION_NAME, id);
    await setDoc(docRef, newProject);
    
    return newProject;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};
