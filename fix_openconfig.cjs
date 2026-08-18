const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

const regex = /const valBase = \(selectedEmployee\.baseSalary \|\| 0\) \/ \(config\.salaryDivisor \?\? 300\);/g;
code = code.replace(regex, `const valBase = (selectedEmployee.baseSalary || 0) / (config.salaryDivisor || 300);`);

fs.writeFileSync('modules/PaystubModal.tsx', code);
