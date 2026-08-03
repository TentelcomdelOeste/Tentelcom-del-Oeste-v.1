const fs = require('fs');
let code = fs.readFileSync('modules/CashflowModule.tsx', 'utf8');

if (code.includes('currentUser={currentUser}')) {
  console.log('CashflowModule.tsx has currentUser props correctly');
}
