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

async function run() {
  console.log("Testing REST Auth with apiKey...");
  // Try signUp anonymously or with email
  const signUpRes = await postJSON(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    returnSecureToken: true
  });
  console.log("signUpRes:", JSON.stringify(signUpRes, null, 2));
}

run().catch(console.error);
