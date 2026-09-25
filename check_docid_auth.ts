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

function parseFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(parseFirestoreValue);
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const obj: any = {};
    for (const k of Object.keys(fields)) obj[k] = parseFirestoreValue(fields[k]);
    return obj;
  }
  return val;
}

function parseFirestoreDoc(doc: any): any {
  if (!doc || !doc.name) return null;
  const parts = doc.name.split('/');
  const id = parts[parts.length - 1];
  const fields = doc.fields || {};
  const obj: any = { id };
  for (const k of Object.keys(fields)) obj[k] = parseFirestoreValue(fields[k]);
  return obj;
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
  const signUpAnon = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { returnSecureToken: true });
  const idToken = signUpAnon.idToken;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/employees?pageSize=300`;
  const res: any = await new Promise((resolve) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${idToken}` } }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve(JSON.parse(data)));
    });
  });

  const employees = (res.documents || []).map(parseFirestoreDoc);
  console.log(`Checking all ${employees.length} employees...\n`);

  for (const emp of employees) {
    console.log(`ID: ${emp.id} | Name: ${emp.name} | Email: ${emp.email} | Role: ${emp.role}`);
  }
}

run().catch(console.error);
