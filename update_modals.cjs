const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

const updateReportadoOld = "await updateEmployee({ reportadoCCSS: parsedReportado }, selectedEmployee.id);";
const updateReportadoNew = "await updateEmployee({ reportadoCCSS: parsedReportado, ccssDeduction: calculatedCcssMonthly, ccssDeductionQuincenal: calculatedCcssFortnightly }, selectedEmployee.id);";

code = code.replace(updateReportadoOld, updateReportadoNew);
fs.writeFileSync('modules/PaystubModal.tsx', code);
