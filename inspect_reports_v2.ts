import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspectReports() {
  const q = query(collection(db, 'material_reports_log'), limit(5));
  const snapshot = await getDocs(q);
  
  console.log("--- INSPECTING MATERIAL REPORTS ---");
  snapshot.docs.forEach(doc => {
    console.log("ID:", doc.id);
    console.log("Data:", JSON.stringify(doc.data(), null, 2));
  });
  console.log("--- END INSPECTION ---");
}

inspectReports().catch(console.error);
