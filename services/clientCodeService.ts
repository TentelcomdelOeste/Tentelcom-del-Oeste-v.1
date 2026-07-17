import { doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const generateNextClientCode = async (): Promise<string> => {
  const counterRef = doc(db, "metadata", "counters");
  
  try {
    const nextCode = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let nextNumber = 1;
      if (counterDoc.exists() && counterDoc.data().clientCounter) {
        nextNumber = counterDoc.data().clientCounter + 1;
      }
      
      transaction.set(counterRef, { clientCounter: nextNumber }, { merge: true });
      return nextNumber;
    });
    
    return `CLI-${String(nextCode).padStart(3, '0')}`;
  } catch (error) {
    console.error("Error generating client code:", error);
    throw new Error("No se pudo generar el código de cliente.");
  }
};

export const getNextClientCodePreview = async (): Promise<string> => {
  const counterRef = doc(db, "metadata", "counters");
  
  try {
    const counterDoc = await getDoc(counterRef);
    
    let nextNumber = 1;
    if (counterDoc.exists() && counterDoc.data().clientCounter) {
      nextNumber = counterDoc.data().clientCounter + 1;
    }
    
    return `CLI-${String(nextNumber).padStart(3, '0')}`;
  } catch (error) {
    console.error("Error previewing client code:", error);
    return "CLI-???"; // Fallback
  }
};
