import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc, query, where, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAudit() {
  const targetId = '1780327322988';
  console.log(`--- AUDIT START FOR ID: ${targetId} ---`);

  try {
    // 1. Try to fetch by docId
    const docRef = doc(db, 'quotes', targetId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log(`[FOUND BY DOC ID]`);
      console.log(JSON.stringify({ docId: docSnap.id, ...docSnap.data() }, null, 2));
    } else {
      console.log(`[NOT FOUND BY DOC ID]`);
    }

    // 2. Try to fetch by 'id' field
    const qById = query(collection(db, 'quotes'), where('id', '==', targetId));
    const snapById = await getDocs(qById);
    if (!snapById.empty) {
      console.log(`[FOUND BY 'id' FIELD]`);
      snapById.docs.forEach(d => {
         console.log(JSON.stringify({ docId: d.id, ...d.data() }, null, 2));
      });
    } else {
      console.log(`[NOT FOUND BY 'id' FIELD]`);
    }

    // 3. Fetch a visible quote for comparison (isDeleted false, limit 1)
    const qVisible = query(collection(db, 'quotes'), where('isDeleted', '==', false), limit(1));
    const snapVisible = await getDocs(qVisible);
    if (!snapVisible.empty) {
      console.log(`[VISIBLE QUOTE FOR COMPARISON]`);
      console.log(JSON.stringify({ docId: snapVisible.docs[0].id, ...snapVisible.docs[0].data() }, null, 2));
    }
  } catch (err) {
    console.error("Error during audit:", err);
  }

  console.log('--- AUDIT END ---');
  process.exit(0);
}

runAudit();
