
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAudit() {
  const timelineId = "15b77cb1-9a94-4733-ba94-b95b5c0a6586";
  console.log(`Auditing timeline: ${timelineId}`);

  const eventsRef = collection(db, "operational_timelines", timelineId, "events");
  const q = query(eventsRef, orderBy("timestamp", "asc"));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("RESULT: EMPTY");
  } else {
    console.log(`RESULT: FOUND ${snap.size} EVENTS`);
    snap.forEach((doc) => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, TYPE: ${data.tipo || data.type || 'N/A'}, TIMESTAMP: ${data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : 'N/A'}`);
    });
  }
}

runAudit().catch(console.error);
