const fs = require('fs');
let code = fs.readFileSync('modules/PaystubModal.tsx', 'utf8');

const buttonCode = `                        <Select
                            label="Colaborador *"
                            options={employeeOptions}
                            value={employeeId}
                            onChange={setEmployeeId}
                            placeholder="-- Seleccione Colaborador --"
                            isSearchable={isAdminRole}
                            disabled={!isAdminRole}
                        />
                        {selectedEmployee && updateEmployee && isAdminRole && (
                            <div className="mt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleOpenConfigModal}
                                    className="text-[11px] flex items-center gap-1 text-slate-500 hover:text-slate-700 font-bold transition-colors uppercase tracking-wide"
                                >
                                    <span>⚙️</span> CONFIGURACIÓN DEL CÁLCULO
                                </button>
                            </div>
                        )}`;

code = code.replace(
  /<Select\s*label="Colaborador \*"\s*options=\{employeeOptions\}\s*value=\{employeeId\}\s*onChange=\{setEmployeeId\}\s*placeholder="-- Seleccione Colaborador --"\s*isSearchable=\{isAdminRole\}\s*disabled=\{\!isAdminRole\}\s*\/>/g,
  buttonCode
);

const modalCode = `
    if (!show) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
`;

code = code.replace(
  /    if \(!show\) return null;\n\n    return createPortal\(\n        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900\/50 backdrop-blur-sm">/g,
  modalCode
);

const configModalCode = `
            </div>
            {showConfigModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden border border-slate-100/50">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-sm tracking-wide">CONFIGURACIÓN DEL CÁLCULO</h3>
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
                      <h4 className="text-[11px] font-bold text-blue-600 mb-3 border-b border-blue-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                        <span>Horas Ordinarias</span>
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Horas predeterminadas:</label>
                          <input type="number" value={configOrdinaryHours} onChange={e => setConfigOrdinaryHours(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Divisor para cálculo de hora:</label>
                          <input type="number" value={configSalaryDivisor} onChange={e => setConfigSalaryDivisor(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Multiplicador:</label>
                          <input type="number" step="0.01" value={configOrdinaryMultiplier} onChange={e => setConfigOrdinaryMultiplier(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-amber-600 mb-3 border-b border-amber-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                        <span>Horas Extra</span>
                      </h4>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Multiplicador:</label>
                        <input type="number" step="0.01" value={configExtraMultiplier} onChange={e => setConfigExtraMultiplier(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-slate-50 focus:bg-white transition-colors" />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-emerald-600 mb-3 border-b border-emerald-100 pb-2 uppercase tracking-wider flex items-center gap-2">
                        <span>Horas Feriado</span>
                      </h4>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Multiplicador:</label>
                        <input type="number" step="0.01" value={configHolidayMultiplier} onChange={e => setConfigHolidayMultiplier(e.target.value)} className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" />
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-wider border-b border-slate-200/60 pb-2">Resumen (Auto-calculado)</h4>
                      <div className="space-y-2 text-[13px]">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Salario base utilizado:</span>
                          <span className="font-bold text-slate-800">₡{(selectedEmployee?.baseSalary || 0).toLocaleString('es-CR')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Valor hora base:</span>
                          <span className="font-bold text-slate-800">₡{configValHoraBase.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                          <span className="text-slate-600">Valor hora ordinaria:</span>
                          <span className="font-bold text-blue-700">₡{configValHoraOrg.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Valor hora extra:</span>
                          <span className="font-bold text-amber-700">₡{configValHoraExt.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Valor hora feriado:</span>
                          <span className="font-bold text-emerald-700">₡{configValHoraFeriado.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                    <ActionButton label="Cancelar" onClick={() => setShowConfigModal(false)} variant="secondary" />
                    <ActionButton label="Guardar Configuración" onClick={handleSaveConfig} variant="primary" />
                  </div>
                </div>
              </div>
            )}
        </>,
        document.body
    );
`;

code = code.replace(
  /            <\/div>\n        <\/div>,\n        document\.body\n    \);/g,
  `            </div>
        </div>
${configModalCode}`
);

fs.writeFileSync('modules/PaystubModal.tsx', code);
