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

function fetchFirestoreCollection(token: string, collectionName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/tentelcom-del-oeste/databases/(default)/documents/${collectionName}?pageSize=300`;
    const req = https.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
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
  console.log("Token obtained. Querying material_reports via REST API...");
  const res = await fetchFirestoreCollection(token, 'material_reports');
  if (res.documents) {
    console.log(`✅ Success! Received ${res.documents.length} documents from material_reports!`);
  } else {
    console.log("REST Response:", JSON.stringify(res, null, 2));
  }
}

run().catch(console.error);
