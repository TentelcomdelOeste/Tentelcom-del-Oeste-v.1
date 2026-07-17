import fs from 'fs';
import path from 'path';

const dir = './Publico/logotipos_clientes/';
const logo13 = fs.readFileSync(path.join(dir, 'LOGO13.png'), 'base64');
const logo14 = fs.readFileSync(path.join(dir, 'LOGO14.png'), 'base64');

fs.writeFileSync('LOGO13_BASE64.txt', logo13);
fs.writeFileSync('LOGO14_BASE64.txt', logo14);
