import http from 'http';

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

getMetadataToken().then(token => {
  console.log("METADATA ACCESS TOKEN GOT, length:", token.length);
}).catch(err => {
  console.error("METADATA TOKEN ERROR:", err);
});
