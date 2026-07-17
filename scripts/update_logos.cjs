const fs = require('fs');
const logo13 = fs.readFileSync('LOGO13_BASE64.txt', 'utf8').trim();
const logo14 = fs.readFileSync('LOGO14_BASE64.txt', 'utf8').trim();

const content = `export const LOGO_BASE64 = "${logo13}";\nexport const LOGO14_BASE64 = "${logo14}";\n`;
fs.writeFileSync('utils/logoBase64.ts', content);
console.log('Done');
