import https from 'https';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const apiKey = firebaseConfig.apiKey;

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

function fetchCollection(idToken: string, colName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/tentelcom-del-oeste/databases/(default)/documents/${colName}?pageSize=300`;
    const req = https.get(url, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

async function run() {
  const signUpRes = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    returnSecureToken: true
  });
  const idToken = signUpRes.idToken;

  const empRes = await fetchCollection(idToken, 'employees');
  if (empRes.documents) {
    console.log(`Total employees found: ${empRes.documents.length}`);
    empRes.documents.forEach((doc: any) => {
      const docId = doc.name.split('/').pop();
      const fields = doc.fields || {};
      const name = fields.name?.stringValue || fields.username?.stringValue || '';
      const email = fields.email?.stringValue || '';
      const role = fields.role?.stringValue || '';
      const permissions = fields.permissions?.mapValue?.fields ? Object.keys(fields.permissions.mapValue.fields) : [];
      console.log(`DocID: ${docId} | Name: ${name} | Email: ${email} | Role: ${role} | Perms:`, permissions);
    });
  }
}

run().catch(console.error);
