const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

const handlersCode = `
  const configValHoraBase = selectedEmployee ? (selectedEmployee.baseSalary || 0) / (parseFloat(configSalaryDivisor) || 300) : 0;
  const configValHoraOrg = configValHoraBase * (parseFloat(configOrdinaryMultiplier) || 1);
  const configValHoraExt = configValHoraBase * (parseFloat(configExtraMultiplier) || 1.5);
  const configValHoraFeriado = configValHoraBase * (parseFloat(configHolidayMultiplier) || 2);

  const handleOpenConfigModal = () => {
    if (selectedEmployee) {
      const config = selectedEmployee.salaryConfiguration || {};
      setConfigOrdinaryHours((config.ordinaryHours ?? 150).toString());
      setConfigSalaryDivisor((config.salaryDivisor ?? 300).toString());
      setConfigOrdinaryMultiplier((config.ordinaryMultiplier ?? 1).toString());
      setConfigExtraMultiplier((config.extraMultiplier ?? 1.5).toString());
      setConfigHolidayMultiplier((config.holidayMultiplier ?? 2).toString());
    }
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedEmployee || !updateEmployee) return;
    try {
      await updateEmployee({
        salaryConfiguration: {
          salaryDivisor: parseFloat(configSalaryDivisor) || 300,
          ordinaryHours: parseFloat(configOrdinaryHours) || 150,
          ordinaryMultiplier: parseFloat(configOrdinaryMultiplier) || 1,
          extraHours: parseFloat(extraHoursCount) || 0,
          extraMultiplier: parseFloat(configExtraMultiplier) || 1.5,
          holidayHours: parseFloat(holidayHoursCount) || 0,
          holidayMultiplier: parseFloat(configHolidayMultiplier) || 2,
        }
      }, selectedEmployee.id);
      setShowConfigModal(false);
    } catch (err) {
      console.error("Error saving config:", err);
      alert("Error al guardar la configuración.");
    }
  };
`;

code = code.replace(
  /  const valHoraBase = selectedEmployee \? \(selectedEmployee\.baseSalary \|\| 0\) \/ salaryConfig\.salaryDivisor : 0;/g,
  handlersCode + '\n  const valHoraBase = selectedEmployee ? (selectedEmployee.baseSalary || 0) / salaryConfig.salaryDivisor : 0;'
);

fs.writeFileSync('modules/PaystubModal.tsx', code);
