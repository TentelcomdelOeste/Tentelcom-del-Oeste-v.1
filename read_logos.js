
const fs = require('fs');
const path = require('path');

const dir = './Publico/logotipos_clientes/';
const logo13 = fs.readFileSync(path.join(dir, 'LOGO13.png'), 'base64');
const logo14 = fs.readFileSync(path.join(dir, 'LOGO14.png'), 'base64');

fs.writeFileSync('./logo13_base64.txt', logo13);
fs.writeFileSync('./logo14_base64.txt', logo14);
console.log('Done');
