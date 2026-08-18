const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

// 1. Add states
const statesRegex = /const \[configHolidayMultiplier, setConfigHolidayMultiplier\] = useState\('2'\);/g;
const newStates = `const [configHolidayMultiplier, setConfigHolidayMultiplier] = useState('2');
  const [configBaseSalary, setConfigBaseSalary] = useState('');
  const [configReportadoCCSS, setConfigReportadoCCSS] = useState('');
  const [configCcssType, setConfigCcssType] = useState<'percentage' | 'fixed'>('percentage');
  const [configCcssPercentage, setConfigCcssPercentage] = useState('10.83');
  const [configCcssFixedAmount, setConfigCcssFixedAmount] = useState('');
  const [configCcssDivideByTwo, setConfigCcssDivideByTwo] = useState(true);
  
  const [showSalaryConfirmModal1, setShowSalaryConfirmModal1] = useState(false);
  const [showSalaryConfirmModal2, setShowSalaryConfirmModal2] = useState(false);
  const [showCcssConfirmModal, setShowCcssConfirmModal] = useState(false);`;
code = code.replace(statesRegex, newStates);

// 2. Add handlers & values
const handlersRegex = /const configValHoraBase =.*?handleSaveConfig = async \(\) => \{.*?\n  \};\n/s;
const newHandlers = `const parsedConfigBaseSalary = parseFloat(configBaseSalary) || 0;
  const configValHoraBase = parsedConfigBaseSalary / (parseFloat(configSalaryDivisor) || 300);
  const configValHoraOrg = configValHoraBase * (parseFloat(configOrdinaryMultiplier) || 1);
  const configValHoraExt = configValHoraBase * (parseFloat(configExtraMultiplier) || 1.5);
  const configValHoraFeriado = configValHoraBase * (parseFloat(configHolidayMultiplier) || 2);

  const parsedReportado = parseFloat(configReportadoCCSS) || 0;
  const parsedPercentage = parseFloat(configCcssPercentage) || 0;
  const parsedFixed = parseFloat(configCcssFixedAmount) || 0;

  const calculatedCcssMonthly = configCcssType === 'percentage' 
    ? (parsedReportado * parsedPercentage / 100) 
    : parsedFixed;
  
  const calculatedCcssFortnightly = configCcssDivideByTwo 
    ? calculatedCcssMonthly / 2 
    : calculatedCcssMonthly;

  const handleOpenConfigModal = () => {
    if (selectedEmployee) {
      const config = selectedEmployee.salaryConfiguration || {};
      setConfigOrdinaryHours((config.ordinaryHours ?? 150).toString());
      setConfigSalaryDivisor((config.salaryDivisor ?? 300).toString());
      setConfigOrdinaryMultiplier((config.ordinaryMultiplier ?? 1).toString());
      setConfigExtraMultiplier((config.extraMultiplier ?? 1.5).toString());
      setConfigHolidayMultiplier((config.holidayMultiplier ?? 2).toString());
      
      setConfigBaseSalary((selectedEmployee.baseSalary || 0).toString());
      setConfigReportadoCCSS((selectedEmployee.reportadoCCSS || selectedEmployee.baseSalary || 0).toString());
      setConfigCcssType(config.ccssType || 'percentage');
      setConfigCcssPercentage((config.ccssPercentage ?? 10.83).toString());
      setConfigCcssFixedAmount((selectedEmployee.ccssDeduction || 0).toString());
      setConfigCcssDivideByTwo(config.ccssDivideByTwo ?? true);
    }
    setShowConfigModal(true);
  };

  const executeSaveConfig = async () => {
    if (!selectedEmployee || !updateEmployee) return;
    try {
      await updateEmployee({
        baseSalary: parsedConfigBaseSalary,
        reportadoCCSS: parsedReportado,
        ccssDeduction: calculatedCcssMonthly,
        ccssDeductionQuincenal: calculatedCcssFortnightly,
        salaryConfiguration: {
          salaryDivisor: parseFloat(configSalaryDivisor) || 300,
          ordinaryHours: parseFloat(configOrdinaryHours) || 150,
          ordinaryMultiplier: parseFloat(configOrdinaryMultiplier) || 1,
          extraHours: parseFloat(extraHoursCount) || 0,
          extraMultiplier: parseFloat(configExtraMultiplier) || 1.5,
          holidayHours: parseFloat(holidayHoursCount) || 0,
          holidayMultiplier: parseFloat(configHolidayMultiplier) || 2,
          ccssType: configCcssType,
          ccssPercentage: parsedPercentage,
          ccssDivideByTwo: configCcssDivideByTwo,
        }
      }, selectedEmployee.id);
      setShowConfigModal(false);
      setShowSalaryConfirmModal1(false);
      setShowSalaryConfirmModal2(false);
      setShowCcssConfirmModal(false);
    } catch (err) {
      console.error("Error saving config:", err);
      alert("Error al guardar la configuración.");
    }
  };

  const handleSaveConfig = () => {
    if (!selectedEmployee) return;
    const isSalaryChanged = parsedConfigBaseSalary !== (selectedEmployee.baseSalary || 0);
    const isCcssChanged = 
      parsedReportado !== (selectedEmployee.reportadoCCSS || selectedEmployee.baseSalary || 0) ||
      configCcssType !== (selectedEmployee.salaryConfiguration?.ccssType || 'percentage') ||
      (configCcssType === 'percentage' && parsedPercentage !== (selectedEmployee.salaryConfiguration?.ccssPercentage ?? 10.83)) ||
      (configCcssType === 'fixed' && parsedFixed !== (selectedEmployee.ccssDeduction || 0)) ||
      configCcssDivideByTwo !== (selectedEmployee.salaryConfiguration?.ccssDivideByTwo ?? true);

    if (isSalaryChanged) {
      setShowSalaryConfirmModal1(true);
    } else if (isCcssChanged) {
      setShowCcssConfirmModal(true);
    } else {
      executeSaveConfig();
    }
  };
`;
code = code.replace(handlersRegex, newHandlers);


// 3. UI Changes inside modal
const configModalRegex = /<h3 className="font-bold text-slate-800 text-sm tracking-wide">CONFIGURACIÓN DEL CÁLCULO<\/h3>.*?<h4 className="text-\[11px\] font-bold text-blue-600 mb-3 border-b border-blue-100 pb-2 uppercase tracking-wider flex items-center gap-2">/s;
const newConfigModal = `<h3 className="font-bold text-slate-800 text-sm tracking-wide">CONFIGURACIÓN DEL CÁLCULO</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors shadow-sm">
                <FiX />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Colaborador seleccionado:</p>
                <p className="text-base font-bold text-slate-800">{selectedEmployee?.name}</p>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-slate-600 mb-3 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                  <span>Salario</span>
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Salario base actual:</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₡</span>
                      <input type="number" value={configBaseSalary} onChange={e => setConfigBaseSalary(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-blue-600 mb-3 border-b border-blue-100 pb-2 uppercase tracking-wider flex items-center gap-2">`;
code = code.replace(configModalRegex, newConfigModal);

const summaryRegex = /<h4 className="text-\[11px\] font-bold text-emerald-600 mb-3 border-b border-emerald-100 pb-2 uppercase tracking-wider flex items-center gap-2">.*?<div className="bg-slate-50 p-4 rounded-xl border border-slate-100">/s;
const newSummary = `<h4 className="text-[11px] font-bold text-emerald-600 mb-3 border-b border-emerald-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                  <span>Horas Feriado</span>
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Multiplicador:</label>
                  <input type="number" step="0.01" value={configHolidayMultiplier} onChange={e => setConfigHolidayMultiplier(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors p-2" />
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-slate-600 mb-3 border-b border-slate-200 pb-2 uppercase tracking-wider flex items-center gap-2">
                  <span>Configuración CCSS</span>
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Salario reportado a CCSS:</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₡</span>
                      <input type="number" value={configReportadoCCSS} onChange={e => setConfigReportadoCCSS(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo de deducción:</label>
                    <select value={configCcssType} onChange={e => setConfigCcssType(e.target.value as 'percentage'|'fixed')} className="w-full p-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors">
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Monto fijo</option>
                    </select>
                  </div>
                  {configCcssType === 'percentage' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Porcentaje (%):</label>
                      <input type="number" step="0.01" value={configCcssPercentage} onChange={e => setConfigCcssPercentage(e.target.value)} className="w-full p-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Monto fijo:</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₡</span>
                        <input type="number" value={configCcssFixedAmount} onChange={e => setConfigCcssFixedAmount(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={configCcssDivideByTwo} onChange={e => setConfigCcssDivideByTwo(e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                      <span className="text-xs font-semibold text-slate-700">Dividir deducción entre 2 para pago quincenal</span>
                    </label>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
                      <span>Deducción mensual:</span>
                      <span className="font-bold">₡{calculatedCcssMonthly.toLocaleString('es-CR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <span>Deducción quincenal:</span>
                      <span className="font-bold">₡{calculatedCcssFortnightly.toLocaleString('es-CR', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">`;
code = code.replace(summaryRegex, newSummary);

const summaryValuesRegex = /<span className="font-bold text-slate-800">₡\{\(selectedEmployee\?\.baseSalary \|\| 0\)\.toLocaleString\('es-CR'\)\}<\/span>/g;
code = code.replace(summaryValuesRegex, '<span className="font-bold text-slate-800">₡{parsedConfigBaseSalary.toLocaleString(\'es-CR\', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>');


const endModalsRegex = /    \<\/div\>\n    \{showConfigModal && \(/s;
const endModalsNew = `    </div>
    {showConfigModal && (`;
// Wait, better to append the ConfirmModals at the very end of the file before `</>, document.body)`

const footerRegex = /      \)\}\n    <\/>,\n    document\.body/s;
const footerNew = `      )}
      <ConfirmModal
          show={showSalaryConfirmModal1}
          onClose={() => setShowSalaryConfirmModal1(false)}
          onConfirm={() => {
              setShowSalaryConfirmModal1(false);
              setShowSalaryConfirmModal2(true);
          }}
          title="¿Deseas modificar el salario base de este colaborador?"
          description={\`Salario actual: ₡\${(selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\\nNuevo salario: ₡\${parsedConfigBaseSalary.toLocaleString('es-CR')}\`}
          confirmLabel="CONTINUAR"
          variant="warning"
      />
      <ConfirmModal
          show={showSalaryConfirmModal2}
          onClose={() => setShowSalaryConfirmModal2(false)}
          onConfirm={() => {
              const isCcssChanged = 
                  parsedReportado !== (selectedEmployee?.reportadoCCSS || selectedEmployee?.baseSalary || 0) ||
                  configCcssType !== (selectedEmployee?.salaryConfiguration?.ccssType || 'percentage') ||
                  (configCcssType === 'percentage' && parsedPercentage !== (selectedEmployee?.salaryConfiguration?.ccssPercentage ?? 10.83)) ||
                  (configCcssType === 'fixed' && parsedFixed !== (selectedEmployee?.ccssDeduction || 0)) ||
                  configCcssDivideByTwo !== (selectedEmployee?.salaryConfiguration?.ccssDivideByTwo ?? true);

              if (isCcssChanged) {
                  setShowSalaryConfirmModal2(false);
                  setShowCcssConfirmModal(true);
              } else {
                  executeSaveConfig();
              }
          }}
          title="CONFIRMACIÓN FINAL"
          description={\`Esta modificación cambiará el salario base registrado en el módulo Colaboradores y será utilizado para futuros cálculos de nómina.\\n\\nAnterior: ₡\${(selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}\\nNuevo: ₡\${parsedConfigBaseSalary.toLocaleString('es-CR')}\`}
          confirmLabel="CONFIRMAR CAMBIO"
          variant="danger"
      />
      <ConfirmModal
          show={showCcssConfirmModal}
          onClose={() => setShowCcssConfirmModal(false)}
          onConfirm={executeSaveConfig}
          title="Confirmar cambios en CCSS"
          description="Se modificarán los parámetros de CCSS del colaborador. ¿Deseas continuar?"
          confirmLabel="CONFIRMAR CAMBIO"
          variant="warning"
      />
    </>,
    document.body`;

code = code.replace(footerRegex, footerNew);


fs.writeFileSync('modules/PaystubModal.tsx', code);
