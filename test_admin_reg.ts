import https from 'https';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const apiKey = firebaseConfig.apiKey;
const projectId = firebaseConfig.projectId;

function postJSON(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

function fetchCol(idToken: string, col: string): Promise<any> {
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}?pageSize=300`;
    https.get(url, { headers: { 'Authorization': `Bearer ${idToken}` } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
  });
}

async function run() {
  const adminsToTry = [
    { email: 'dbenavides@tentelcom.com', name: 'Luis Diego Benavides Carranza' },
    { email: 'christopher.tentelcom@gmail.com', name: 'Christopher' }
  ];

  for (const adm of adminsToTry) {
    const regRes = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      email: adm.email,
      password: 'AuditTempPassword123!',
      returnSecureToken: true
    });

    if (regRes.idToken) {
      console.log(`🎉 REGISTERED ADMIN AUTH: ${adm.name} (${adm.email})`);
      console.log(`   UID: ${regRes.localId}`);

      const repRes = await fetchCol(regRes.idToken, 'material_reports');
      const invRes = await fetchCol(regRes.idToken, 'inventory_items');
      console.log(`   material_reports status: ${repRes.status}, docsCount: ${repRes.body?.documents?.length ?? 0}`);
      console.log(`   inventory_items status: ${invRes.status}, docsCount: ${invRes.body?.documents?.length ?? 0}`);
    } else {
      console.log(`Email ${adm.email} already exists in Auth:`, regRes.error?.message);
    }
  }
}

run().catch(console.error);
