import http from 'http';
import https from 'https';

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

function fetchWithToken(token: string, urlStr: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = https.get(parsed.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Goog-User-Project': 'tentelcom-del-oeste'
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
  const token = await getMetadataToken();
  console.log("Testing Firestore Admin REST API with Bearer token...");
  
  // Try structured query endpoint or documents endpoint
  const url1 = `https://firestore.googleapis.com/v1/projects/tentelcom-del-oeste/databases/(default)/documents/material_reports`;
  const res1 = await fetchWithToken(token, url1);
  console.log("Result 1:", res1.documents ? `Found ${res1.documents.length} docs` : res1);

  const url2 = `https://firestore.googleapis.com/v1/projects/tentelcom-del-oeste/databases/(default)/documents/employees`;
  const res2 = await fetchWithToken(token, url2);
  console.log("Result 2:", res2.documents ? `Found ${res2.documents.length} docs` : res2);
}

run().catch(console.error);
