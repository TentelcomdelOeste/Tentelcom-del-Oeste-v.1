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
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}?pageSize=100`;
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
  const signUpRes = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    returnSecureToken: true
  });
  const idToken = signUpRes.idToken;

  const collections = [
    'employees',
    'inventory_items',
    'material_reports',
    'materialRequests',
    'vehicles',
    'control_vehicular_documentos',
    'vehicle_warehouse_items'
  ];

  for (const c of collections) {
    const res = await fetchCol(idToken, c);
    const docsCount = res.body?.documents ? res.body.documents.length : 0;
    console.log(`Collection '${c}': status=${res.status}, docsCount=${docsCount}`);
    if (res.body?.error) {
      console.log(`  Error:`, res.body.error);
    } else if (docsCount > 0) {
      console.log(`  First doc sample:`, res.body.documents[0].name.split('/').pop());
    }
  }
}

run().catch(console.error);
