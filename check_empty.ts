
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runCheck() {
  const timelineId = "15b77cb1-9a94-4733-ba94-b95b5c0a6586";
  const eventsRef = collection(db, "operational_timelines", timelineId, "events");
  const q = query(eventsRef, limit(1));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("EMPTY");
  } else {
    console.log("NOT_EMPTY");
  }
}

runCheck().catch(console.error);
