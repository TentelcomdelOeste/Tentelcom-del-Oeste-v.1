
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAuditBatch() {
  const timelinesRef = collection(db, "operational_timelines");
  const timelinesSnap = await getDocs(query(timelinesRef, limit(20))); // Smaller batch
  
  console.log(`Auditando lote de ${timelinesSnap.size} timelines...`);

  for (const doc of timelinesSnap.docs) {
    const data = doc.data();
    const timelineId = doc.id;
    
    // Using limit(1) to just check existence, if it's empty, we know count is 0
    const eventsRef = collection(db, "operational_timelines", timelineId, "events");
    const eventsSnap = await getDocs(query(eventsRef, limit(1)));
    
    if (eventsSnap.empty) {
      console.log(`AFECTADO: ID: ${timelineId}, UND: ${data.unidad || 'N/A'}, FEC: ${data.fechaCreacion || data.createdAt || 'N/A'}`);
    }
  }
}

runAuditBatch().catch(console.error);
