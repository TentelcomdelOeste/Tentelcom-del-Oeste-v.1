const fs = require('fs');
const file = 'index.css';
let data = fs.readFileSync(file, 'utf8');
if (!data.includes('-webkit-tap-highlight-color: transparent')) {
    data += '\n\n* {\n  -webkit-tap-highlight-color: transparent;\n}\n';
    fs.writeFileSync(file, data);
}
console.log('Update css');
