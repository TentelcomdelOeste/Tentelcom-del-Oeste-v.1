const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

const executeSaveRegex = /await updateEmployee\(\{\n\s*baseSalary: parsedConfigBaseSalary,\n\s*reportadoCCSS: parsedReportado,/g;
code = code.replace(executeSaveRegex, "await updateEmployee({");

fs.writeFileSync('modules/PaystubModal.tsx', code);
