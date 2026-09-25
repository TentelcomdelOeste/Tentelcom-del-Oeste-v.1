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

async function run() {
  const signUpRes = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    returnSecureToken: true
  });
  const idToken = signUpRes.idToken;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases`;
  const res: any = await new Promise((resolve) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${idToken}` } }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve(JSON.parse(data)));
    });
  });

  console.log("Databases response:", JSON.stringify(res, null, 2));
}

run().catch(console.error);
