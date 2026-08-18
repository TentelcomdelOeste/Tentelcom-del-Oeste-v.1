const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

// I also need to update the useEffect that initializes the config modal 
// to make sure setConfigExtraValueStr and setConfigHolidayValueStr are also called there.

const handleOpenConfigRegex = /const handleOpenConfigModal = \(\) => \{\n    if \(!selectedEmployee\) return;\n    \n    const config = selectedEmployee\.salaryConfiguration \|\| \{\};\n    setConfigBaseSalary\(\(selectedEmployee\.baseSalary \|\| 0\)\.toString\(\)\);\n    setConfigReportadoCCSS\(\(selectedEmployee\.reportadoCCSS \|\| selectedEmployee\.baseSalary \|\| 0\)\.toString\(\)\);\n    setConfigCcssType\(config\.ccssType \|\| 'percentage'\);\n    if \(config\.ccssType === 'fixed'\) \{\n      setConfigFixedCcss\(\(selectedEmployee\.ccssDeduction \|\| 0\)\.toString\(\)\);\n    \} else \{\n      setConfigCcssPercentage\(\(config\.ccssPercentage \?\? 10\.83\)\.toString\(\)\);\n      setConfigCcssDivideByTwo\(config\.ccssDivideByTwo \?\? true\);\n    \}\n    \n    setConfigSalaryDivisor\(\(config\.salaryDivisor \?\? 300\)\.toString\(\)\);\n    setConfigOrdinaryHours\(\(config\.ordinaryHours \?\? 150\)\.toString\(\)\);\n    setConfigOrdinaryMultiplier\(\(config\.ordinaryMultiplier \?\? 1\)\.toString\(\)\);\n    setConfigExtraMultiplier\(\(config\.extraMultiplier \?\? 1\.5\)\.toString\(\)\);\n    setConfigHolidayMultiplier\(\(config\.holidayMultiplier \?\? 2\)\.toString\(\)\);\n      \n    const valBase = \(selectedEmployee\.baseSalary \|\| 0\) \/ \(config\.salaryDivisor \?\? 300\);\n    setConfigExtraValueStr\(\(valBase \* \(config\.extraMultiplier \?\? 1\.5\)\)\.toFixed\(2\)\);\n    setConfigHolidayValueStr\(\(valBase \* \(config\.holidayMultiplier \?\? 2\)\)\.toFixed\(2\)\);\n    setShowConfigModal\(true\);\n  \};/g;

// Looks like I've already modified the handleOpenConfigModal correctly in my previous step.
// Wait, the previous step did modify it. Let me verify.

