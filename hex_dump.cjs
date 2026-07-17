const fs = require('fs');
const content = fs.readFileSync('firestore.rules');
console.log(content.toString('hex'));
