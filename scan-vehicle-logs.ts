import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function scan() {
  try {
    initializeApp({
      projectId: 'tentelcom-del-oeste'
    });

    const db = getFirestore();
    console.log("Scanning bitacora_vehiculos for unidad = 'U8'...");

    const snapshot = await db.collection('bitacora_vehiculos')
      .where('unidad', '==', 'U8')
      .get();

    console.log(`Found ${snapshot.size} documents for U8:`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nDocument ID: ${doc.id}`);
      console.log(`- Conductor: ${data.conductorName}`);
      console.log(`- Fecha: ${data.fecha}`);
      console.log(`- Estado: ${data.estado}`);
      console.log(`- kmSalida: ${data.kmSalida}`);
      console.log(`- kmLlegada: ${data.kmLlegada}`);
      console.log(`- isDeleted: ${data.isDeleted}`);
      console.log(`- createdBy: ${data.createdBy}`);
      console.log(`- timestamp/createdAt: ${data.createdAt || data.updatedAt}`);
    });

  } catch (error) {
    console.error("Error scanning:", error);
  }
}

scan();
