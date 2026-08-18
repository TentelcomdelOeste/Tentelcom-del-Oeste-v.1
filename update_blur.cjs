const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

// 1. Rewrite handleSaveConfig to just save everything directly without modals
const handleSaveRegex = /const handleSaveConfig = \(\) => \{[\s\S]*?executeSaveConfig\(\);\n    \}\n  \};/g;
code = code.replace(handleSaveRegex, `const handleSaveConfig = () => {
    executeSaveConfig();
  };`);

// 2. Add blur handlers
const blurHandlers = `
  const handleBaseSalaryBlur = () => {
    if (!selectedEmployee) return;
    const isSalaryChanged = parsedConfigBaseSalary !== (selectedEmployee.baseSalary || 0);
    if (isSalaryChanged) {
      setShowSalaryConfirmModal1(true);
    }
  };

  const handleReportadoCCSSBlur = () => {
    if (!selectedEmployee) return;
    const isReportadoChanged = parsedReportado !== (selectedEmployee.reportadoCCSS || selectedEmployee.baseSalary || 0);
    if (isReportadoChanged) {
      setShowCcssConfirmModal(true);
    }
  };
`;
// Insert them before executeSaveConfig
code = code.replace('const executeSaveConfig = async () => {', blurHandlers + '\n  const executeSaveConfig = async () => {');

// 3. Update the inputs to have onBlur
const inputSalaryRegex = /<input type="number" value=\{configBaseSalary\} onChange=\{e => setConfigBaseSalary\(e\.target\.value\)\} className="w-full/g;
code = code.replace(inputSalaryRegex, '<input type="number" value={configBaseSalary} onChange={e => setConfigBaseSalary(e.target.value)} onBlur={handleBaseSalaryBlur} className="w-full');

const inputReportadoRegex = /<input type="number" value=\{configReportadoCCSS\} onChange=\{e => setConfigReportadoCCSS\(e\.target\.value\)\} className="w-full/g;
code = code.replace(inputReportadoRegex, '<input type="number" value={configReportadoCCSS} onChange={e => setConfigReportadoCCSS(e.target.value)} onBlur={handleReportadoCCSSBlur} className="w-full');

// 4. Update the confirm modals logic
// Modal 1: onClose should revert
const modal1Regex = /<ConfirmModal\s*show=\{showSalaryConfirmModal1\}\s*onClose=\{.*?\}\s*onConfirm=\{[\s\S]*?\}\s*title="¿Deseas modificar el salario base de este colaborador\?"\s*description=\{`Salario actual.*?`\}\s*confirmLabel="CONTINUAR"\s*variant="warning"\s*\/>/g;
const newModal1 = `<ConfirmModal
          show={showSalaryConfirmModal1}
          onClose={() => {
              setShowSalaryConfirmModal1(false);
              setConfigBaseSalary((selectedEmployee?.baseSalary || 0).toString());
          }}
          onConfirm={() => {
              setShowSalaryConfirmModal1(false);
              setShowSalaryConfirmModal2(true);
          }}
          title="¿Deseas modificar el salario base de este colaborador?"
          description={\`Salario actual: ₡\${(selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\\nNuevo salario: ₡\${parsedConfigBaseSalary.toLocaleString('es-CR')}\`}
          confirmLabel="CONTINUAR"
          variant="warning"
      />`;
code = code.replace(modal1Regex, newModal1);

// Modal 2: onClose should revert, onConfirm should save ONLY baseSalary
const modal2Regex = /<ConfirmModal\s*show=\{showSalaryConfirmModal2\}\s*onClose=\{.*?\}\s*onConfirm=\{[\s\S]*?\}\s*title="CONFIRMACIÓN FINAL"\s*description=\{`Esta modificación cambiará[\s\S]*?`\}\s*confirmLabel="CONFIRMAR CAMBIO"\s*variant="danger"\s*\/>/g;
const newModal2 = `<ConfirmModal
          show={showSalaryConfirmModal2}
          onClose={() => {
              setShowSalaryConfirmModal2(false);
              setConfigBaseSalary((selectedEmployee?.baseSalary || 0).toString());
          }}
          onConfirm={async () => {
              if (selectedEmployee && updateEmployee) {
                  try {
                      await updateEmployee({ baseSalary: parsedConfigBaseSalary }, selectedEmployee.id);
                      setShowSalaryConfirmModal2(false);
                  } catch (err) {
                      console.error("Error updating salary:", err);
                      alert("Error al actualizar el salario.");
                  }
              }
          }}
          title="CONFIRMACIÓN FINAL"
          description={\`Esta modificación cambiará el salario base registrado en el módulo Colaboradores y será utilizado para futuros cálculos de nómina.\\n\\nAnterior: ₡\${(selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\\nNuevo: ₡\${parsedConfigBaseSalary.toLocaleString('es-CR')}\`}
          confirmLabel="CONFIRMAR CAMBIO"
          variant="danger"
      />`;
code = code.replace(modal2Regex, newModal2);

// CCSS Modal: onClose should revert, onConfirm should save ONLY reportadoCCSS
const ccssModalRegex = /<ConfirmModal\s*show=\{showCcssConfirmModal\}\s*onClose=\{.*?\}\s*onConfirm=\{executeSaveConfig\}\s*title="Confirmar cambios en CCSS"\s*description="Se modificarán los parámetros de CCSS del colaborador\. ¿Deseas continuar\?"\s*confirmLabel="CONFIRMAR CAMBIO"\s*variant="warning"\s*\/>/g;
const newCcssModal = `<ConfirmModal
          show={showCcssConfirmModal}
          onClose={() => {
              setShowCcssConfirmModal(false);
              setConfigReportadoCCSS((selectedEmployee?.reportadoCCSS || selectedEmployee?.baseSalary || 0).toString());
          }}
          onConfirm={async () => {
              if (selectedEmployee && updateEmployee) {
                  try {
                      await updateEmployee({ reportadoCCSS: parsedReportado }, selectedEmployee.id);
                      setShowCcssConfirmModal(false);
                  } catch (err) {
                      console.error("Error updating CCSS salary:", err);
                      alert("Error al actualizar el salario reportado a CCSS.");
                  }
              }
          }}
          title="Confirmar cambio de salario reportado a CCSS"
          description={\`Se modificará el salario reportado a CCSS del colaborador.\\n\\nAnterior: ₡\${(selectedEmployee?.reportadoCCSS || selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\\nNuevo: ₡\${parsedReportado.toLocaleString('es-CR')}\\n\\n¿Deseas continuar?\`}
          confirmLabel="CONFIRMAR CAMBIO"
          variant="warning"
      />`;
code = code.replace(ccssModalRegex, newCcssModal);

fs.writeFileSync('modules/PaystubModal.tsx', code);
