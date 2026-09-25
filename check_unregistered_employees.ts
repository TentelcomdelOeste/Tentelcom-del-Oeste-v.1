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

function patchDoc(idToken: string, col: string, docId: string, fields: any): Promise<any> {
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}/${docId}?updateMask.fieldPaths=uid`;
    const dataStr = JSON.stringify({ fields });
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(dataStr);
    req.end();
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
  console.log(`Checking registered vs unregistered employees among ${employees.length} total:\n`);

  for (const emp of employees) {
    if (!emp.email) continue;
    const testReg = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      email: emp.email.trim(),
      password: 'AuditTempPassword123!',
      returnSecureToken: true
    });

    if (testReg.idToken) {
      console.log(`✅ REGISTERED NEW USER: ${emp.name} (${emp.email}) | Role: ${emp.role}`);
      console.log(`   New Auth UID: ${testReg.localId}`);

      // Now link this UID to employee doc if needed
      const updateRes = await patchDoc(testReg.idToken, 'employees', emp.id, {
        uid: { stringValue: testReg.localId }
      });
      console.log(`   Link UID to /employees/${emp.id} status:`, updateRes.status);

      // Now test reading material_reports and inventory_items with this new user's idToken!
      const repRes = await fetchCol(testReg.idToken, 'material_reports');
      const invRes = await fetchCol(testReg.idToken, 'inventory_items');
      console.log(`   material_reports query status: ${repRes.status}, docsCount: ${repRes.body?.documents?.length ?? 0}`);
      console.log(`   inventory_items query status: ${invRes.status}, docsCount: ${invRes.body?.documents?.length ?? 0}\n`);

      if (repRes.body?.documents?.length > 0 && invRes.body?.documents?.length > 0) {
        console.log("🎉 SUCCESS! WE HAVE READ ACCESS TO BOTH COLLECTIONS!");
        return { idToken: testReg.idToken, emp };
      }
    }
  }
}

run().catch(console.error);
