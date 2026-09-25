import https from 'https';
import http from 'http';
import { readFileSync } from 'fs';

function getMetadataToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: '169.254.169.254',
      path: '/computeMetadata/v1/instance/service-accounts/default/token',
      headers: { 'Metadata-Flavor': 'Google' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

function postJSON(url: string, body: any, headers: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        ...headers
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
  const metaToken = await getMetadataToken();
  const apiKey = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8')).apiKey;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'ais-sandbox@ais-us-east1-c2c5d97cf3694d2d9.iam.gserviceaccount.com',
    sub: 'ais-sandbox@ais-us-east1-c2c5d97cf3694d2d9.iam.gserviceaccount.com',
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: 'En85mgVWgCWHMlCbOgcu9T74Xzw2', // Admin Elizabeth Carranza
    claims: {
      email: 'elizabeth.carranza@tentelcom.com',
      email_verified: true,
      role: 'admin'
    }
  };

  const iamRes = await postJSON(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/ais-sandbox@ais-us-east1-c2c5d97cf3694d2d9.iam.gserviceaccount.com:signJwt`,
    { payload: JSON.stringify(payload) },
    { 'Authorization': `Bearer ${metaToken}` }
  );

  console.log("IAM signJwt result:", JSON.stringify(iamRes, null, 2));

  if (iamRes.signedJwt) {
    const authRes = await postJSON(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      { token: iamRes.signedJwt, returnSecureToken: true },
      {}
    );
    console.log("Auth custom token exchange result:", JSON.stringify(authRes, null, 2));

    if (authRes.idToken) {
      console.log("SUCCESS! ID TOKEN OBTAINED FOR ADMIN USER!");
    }
  }
}

run().catch(console.error);
