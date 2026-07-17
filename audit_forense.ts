
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getCountFromServer } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAudit() {
  console.log("Iniciando auditoría de operational_timelines...");

  const timelinesRef = collection(db, "operational_timelines");
  const timelinesSnap = await getDocs(timelinesRef);
  
  console.log(`Total de timelines encontrados: ${timelinesSnap.size}`);

  const afectados = [];
  const noAfectados = [];

  for (const doc of timelinesSnap.docs) {
    const data = doc.data();
    const timelineId = doc.id;
    
    const eventsRef = collection(db, "operational_timelines", timelineId, "events");
    const snapshot = await getCountFromServer(eventsRef);
    const count = snapshot.data().count;

    const info = {
        timelineId,
        unidad: data.unidad || 'N/A',
        fechaCreacion: data.fechaCreacion || data.createdAt || 'N/A',
        estado: data.estado || 'N/A',
        eventCount: count
    };

    if (count === 0) {
      afectados.push(info);
    } else {
      noAfectados.push(info);
    }
  }

  console.log("\n--- TIMELINES AFECTADOS (0 eventos) ---");
  for (const item of afectados) {
    console.log(JSON.stringify(item));
  }

  console.log("\n--- RESUMEN ---");
  console.log(`Total afectados: ${afectados.length}`);
  console.log(`Total no afectados: ${noAfectados.length}`);
}

runAudit().catch(console.error);
