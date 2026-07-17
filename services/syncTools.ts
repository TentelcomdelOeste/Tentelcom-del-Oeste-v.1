import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Función temporal para sincronizar el contador de cotizaciones.
 * Debe ejecutarse manualmente desde la consola del navegador.
 */
export const syncQuoteCounter = async () => {
  try {
    const quotesSnap = await getDocs(collection(db, "quotes"));
    let maxId = 0;
    
    quotesSnap.forEach(docSnap => {
      const data = docSnap.data();
      // El ID puede venir como número o string
      const idVal = data.id;
      const idNum = typeof idVal === 'number' ? idVal : parseInt(idVal);
      
      if (!isNaN(idNum) && idNum > maxId) {
        maxId = idNum;
      }
    });
    
    const counterRef = doc(db, "metadata", "counters");
    const counterSnap = await getDoc(counterRef);
    const currentCounter = counterSnap.exists() ? (counterSnap.data().quoteCounter || 0) : 0;
    
    if (maxId > currentCounter) {
      await setDoc(counterRef, { quoteCounter: maxId }, { merge: true });
      return `Contador actualizado a ${maxId}`;
    } else {
      return `Contador ya está actualizado (${currentCounter})`;
    }
  } catch (error) {
    console.error("❌ [Sync] Error sincronizando contador:", error);
    throw error;
  }
};
