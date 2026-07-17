import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectTimeline() {
  const tlIds = [
    "d4cc56f1-acad-47cb-92f6-cfa44a582a1b",
    "bdfca984-2868-4588-b671-6b828dd6d894",
    "44729922-4a88-464c-b499-a84cc20605f8"
  ];
  
  for (const tlId of tlIds) {
    console.log(`\n================ INSPECTING TIMELINE: ${tlId} ================`);
    
    const tlRef = doc(db, "operational_timelines", tlId);
    const tlSnap = await getDoc(tlRef);
    
    if (!tlSnap.exists()) {
      console.log("Timeline doc: NOT FOUND in Firestore!");
    } else {
      console.log("Timeline doc: FOUND");
      console.log(JSON.stringify(tlSnap.data(), null, 2));
    }
    
    const eventsRef = collection(db, "operational_timelines", tlId, "events");
    const eventsSnap = await getDocs(eventsRef);
    
    console.log(`Events found in Firestore: ${eventsSnap.size}`);
    eventsSnap.forEach(d => {
      console.log(`- Event ID: ${d.id}`);
      console.log(JSON.stringify(d.data(), null, 2));
    });
  }
  
  console.log("\n========================= END =========================\n");
}

inspectTimeline().catch(console.error);
