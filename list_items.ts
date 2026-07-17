import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, limit, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBZClYso1SeEnWdqIjlkRPiN0oSQV47JPQ",
  authDomain: "tentelcom-del-oeste.firebaseapp.com",
  projectId: "tentelcom-del-oeste",
  storageBucket: "tentelcom-del-oeste.firebasestorage.app",
  messagingSenderId: "669263702822",
  appId: "1:669263702822:web:0dd30912a8cd4156062fe7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listItems() {
  const q = query(collection(db, "inventory_items"), limit(100));
  const snap = await getDocs(q);
  console.log("Total items found:", snap.size);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`Code: ${data.code}, ID: ${doc.id}, Data ID: ${data.id}`);
  });
}

listItems().catch(console.error);
