const fs = require('fs');
let code = fs.readFileSync('modules/finance/cashflow/import/services/CashflowImportService.ts', 'utf8');
code = code.replace("importData(\n    entries: ValidatedEntry[], \n    currentUser: any,\n    onProgress?: (progress: any) => void\n  )", "importData(\n    entries: ValidatedEntry[], \n    currentUser: User,\n    onProgress?: (progress: any) => void\n  )");
fs.writeFileSync('modules/finance/cashflow/import/services/CashflowImportService.ts', code);
console.log('Patched again');
