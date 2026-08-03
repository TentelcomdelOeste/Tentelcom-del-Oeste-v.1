const fs = require('fs');
let code = fs.readFileSync('modules/finance/cashflow/import/services/CashflowBatchImporter.ts', 'utf8');
code = code.replace("import { db } from '../../../../../firebase';", "import { db } from '../../../../../firebase';");
// Let's check where firebase really is relative to modules/finance/cashflow/import/services
// root/firebase.ts -> from modules/finance/cashflow/import/services:
// services -> import -> cashflow -> finance -> modules -> root
// So it is ../../../../../firebase.ts
fs.writeFileSync('modules/finance/cashflow/import/services/CashflowBatchImporter.ts', code);
console.log('Patched importer 2');
