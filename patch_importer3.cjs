const fs = require('fs');
let code = fs.readFileSync('modules/finance/cashflow/import/services/CashflowBatchImporter.ts', 'utf8');
code = code.replace("import { db } from '../../../../../firebase';", "import { db } from '../../../../../firebase';");
// Let's use absolute path in tsconfig mapping if possible, or just regular path relative to the root utils/firebase
// Wait, the project root has a `firebase.ts`!
// Path to CashflowBatchImporter.ts: modules/finance/cashflow/import/services/CashflowBatchImporter.ts
// So it is 5 levels down from root: 
// 1: modules
// 2: finance
// 3: cashflow
// 4: import
// 5: services
// So import { db } from '../../../../../firebase'; is correct.

fs.writeFileSync('modules/finance/cashflow/import/services/CashflowBatchImporter.ts', code);
console.log('Patched importer 3');
