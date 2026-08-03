
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAudit() {
  const otCode = "OT-2026-138";
  console.log(`OT: ${otCode}`);

  const jobsRef = collection(db, "trabajos");
  const qJob = query(jobsRef, where("otCode", "==", otCode));
  const jobSnap = await getDocs(qJob);

  if (jobSnap.empty) {
    console.log("JOB: NOT_FOUND");
    return;
  }

  const jobDoc = jobSnap.docs[0];
  const jobData = jobDoc.data();
  console.log(`JOB_ID: ${jobDoc.id}`);
  console.log(`JOB_TIMELINE_ID: ${jobData.timelineId || "NULL"}`);
  console.log(`JOB_BITACORA_IDS: ${JSON.stringify(jobData.bitacoraIds || [])}`);

  const bitacoraRef = collection(db, "bitacora_vehiculos");
  const qBit = query(bitacoraRef, where("trabajoId", "==", jobDoc.id));
  const bitSnap = await getDocs(qBit);
  
  if (bitSnap.empty) {
     console.log("BITACORAS: NONE_FOUND_BY_JOB_ID");
  }

  for (const d of bitSnap.docs) {
    const bData = d.data();
    console.log(`BITACORA_ID: ${d.id}`);
    console.log(`BITACORA_TIMELINE_ID: ${bData.timelineId || "NULL"}`);
    
    if (bData.timelineId) {
       const eventsRef = collection(db, "operational_timelines", bData.timelineId, "events");
       const evSnap = await getDocs(query(eventsRef, limit(1)));
       console.log(`TIMELINE_${bData.timelineId}_EVENTS: ${evSnap.size > 0 ? "HAS_EVENTS" : "EMPTY"}`);
    }
  }
}

runAudit().catch(console.error);
