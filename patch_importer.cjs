const fs = require('fs');
let code = fs.readFileSync('modules/finance/cashflow/import/services/CashflowBatchImporter.ts', 'utf8');
code = code.replace("import { db } from '../../../../firebase';", "import { db } from '../../../../../firebase';");
fs.writeFileSync('modules/finance/cashflow/import/services/CashflowBatchImporter.ts', code);
console.log('Patched importer');
