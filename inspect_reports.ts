import { db } from './firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

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
