import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

if (!getApps().length) {
  initializeApp({ projectId: firebaseConfig.projectId });
}

async function run() {
  console.log("Updating password for jenamorado@tentelcom.com (uid: zHULugx4V7eqgDWQlZeZ17WsZ683)...");
  try {
    const userRecord = await getAuth().updateUser('zHULugx4V7eqgDWQlZeZ17WsZ683', {
      password: 'AuditPassword123!'
    });
    console.log("SUCCESSFULLY updated password for user:", userRecord.email);
  } catch (err) {
    console.error("Error updating user password:", err);
  }
}

run().catch(console.error);
