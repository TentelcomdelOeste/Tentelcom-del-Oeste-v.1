import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc, query, where, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const targetId = '1780327322988';
  console.log('TARGET:' + targetId);
  
  // Try docId
  const snap = await getDoc(doc(db, 'quotes', targetId));
  if (snap.exists()) {
    console.log('FOUND_DOC_ID:' + JSON.stringify(snap.data()));
  } else {
    // Try id field
    const q = query(collection(db, 'quotes'), where('id', '==', targetId), limit(1));
    const s = await getDocs(q);
    if (!s.empty) {
      console.log('FOUND_FIELD_ID:' + JSON.stringify(s.docs[0].data()));
    } else {
      console.log('NOT_FOUND');
    }
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
