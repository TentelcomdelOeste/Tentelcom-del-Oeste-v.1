const fs = require('fs');
let code = fs.readFileSync('modules/finance/cashflow/import/CashflowImportWizard.tsx', 'utf8');

const target = `      case ImportStep.IMPORTING:
        return (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-2 animate-spin">
              <FiUploadCloud size={40} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Importando Registros</h3>
            <p className="text-sm text-slate-500">Sincronizando con el servidor...</p>
          </div>
        );
      case ImportStep.RESULT:
        return (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2">
              <FiCheckCircle size={40} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Importación Completada</h3>
            <div className="bg-slate-50 p-4 rounded-lg w-full max-w-sm">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-slate-500">Procesados:</div>
                <div className="font-bold text-slate-800">0</div>
                <div className="text-slate-500">Importados:</div>
                <div className="font-bold text-emerald-600">0</div>
                <div className="text-slate-500">Errores:</div>
                <div className="font-bold text-rose-600">0</div>
              </div>
            </div>
          </div>
        );`;

const replacement = `      case ImportStep.IMPORTING:
        return (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center animate-pulse">
              <FiUploadCloud size={40} />
            </div>
            
            <div className="text-center">
               <h3 className="text-lg font-semibold text-slate-800">Importando Registros</h3>
               <p className="text-sm text-slate-500 mt-1">Escribiendo datos en Firestore (Lote {state.progress?.currentBatch || 1} de {state.progress?.totalBatches || 1})</p>
            </div>
            
            <div className="w-full max-w-md bg-slate-100 rounded-full h-3 overflow-hidden">
               <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: \`\${state.progress?.percentage || 0}%\` }}></div>
            </div>
            
            <div className="flex justify-between w-full max-w-md text-xs text-slate-500 font-medium">
               <span>{state.progress?.processed || 0} procesados</span>
               <span>{state.progress?.percentage || 0}%</span>
               <span>{state.progress ? state.progress.total - state.progress.processed : 0} restantes</span>
            </div>
          </div>
        );
      case ImportStep.RESULT:
        return (
          <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
            {state.result?.success ? (
               <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                 <FiCheckCircle size={40} />
               </div>
            ) : (
               <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-2">
                 <FiAlertTriangle size={40} />
               </div>
            )}
            
            <div>
               <h3 className="text-xl font-bold text-slate-800">
                  {state.result?.success ? 'Importación Completada' : 'Importación Finalizada con Errores'}
               </h3>
               <p className="text-sm text-slate-500 mt-1">
                  Se ha completado el procesamiento del archivo.
               </p>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-xl w-full max-w-lg border border-slate-100">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm text-left">
                <div className="text-slate-500">Registros Leídos:</div>
                <div className="font-semibold text-slate-800 text-right">{state.mappedEntries.length}</div>
                
                <div className="text-slate-500">Registros Válidos:</div>
                <div className="font-semibold text-slate-800 text-right">{state.validatedEntries.filter(e => e.isValid).length}</div>
                
                <div className="col-span-2 h-px bg-slate-200 my-1"></div>
                
                <div className="text-slate-500 font-medium">Total Procesados:</div>
                <div className="font-bold text-slate-800 text-right">{state.result?.statistics.processed}</div>
                
                <div className="text-emerald-600 font-medium">Importados con Éxito:</div>
                <div className="font-bold text-emerald-600 text-right">{state.result?.statistics.imported}</div>
                
                <div className="text-red-500 font-medium">Fallidos:</div>
                <div className="font-bold text-red-500 text-right">{state.result?.statistics.failed}</div>
              </div>
            </div>
            
            {!state.result?.success && state.result?.errors && state.result.errors.length > 0 && (
               <div className="w-full max-w-lg bg-red-50 border border-red-100 p-4 rounded-lg text-left overflow-y-auto max-h-[150px]">
                 <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2"><FiAlertTriangle /> Detalles del Error:</h4>
                 <ul className="text-xs text-red-600 space-y-1">
                   {state.result.errors.map((err, idx) => (
                      <li key={idx}>• {err.message}</li>
                   ))}
                 </ul>
               </div>
            )}
          </div>
        );`;

if(code.includes(target)) {
  fs.writeFileSync('modules/finance/cashflow/import/CashflowImportWizard.tsx', code.replace(target, replacement));
  console.log('Patched UI');
} else {
  console.log('Target not found');
}
