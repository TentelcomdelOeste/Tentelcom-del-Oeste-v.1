import React, { useState, useRef, useEffect } from 'react';
import { 
  FiFilePlus, FiArrowRight, FiArrowLeft, FiCheckCircle, 
  FiSettings, FiGrid, FiUploadCloud, FiX, FiAlertTriangle, FiInfo
} from 'react-icons/fi';
import { Modal, ActionButton } from '../../../../design-system';
import { ImportStep, ImportState } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { cashflowImportService } from './services/CashflowImportService';
import { Quote, CashflowEntry, User } from '../../../../utils/types';

interface CashflowImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  quotes?: Quote[];
  isDateClosed?: (date: string) => boolean;
  existingEntries?: CashflowEntry[];
  currentUser: User;
  onSuccess?: () => void;
}

export const CashflowImportWizard: React.FC<CashflowImportWizardProps> = ({ 
  isOpen, 
  onClose,
  quotes = [],
  isDateClosed = () => false,
  existingEntries = [],
  currentUser,
  onSuccess
}) => {
  const [state, setState] = useState<ImportState>({
    step: ImportStep.SELECT_FILE,
    file: null,
    parseInfo: null,
    rawData: [],
    mappedEntries: [],
    validatedEntries: [],
    validation: null,
    result: null,
    progress: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatically start parsing when file is selected and step is PARSE_FILE
  useEffect(() => {
    if (state.step === ImportStep.PARSE_FILE && state.file) {
      let isMounted = true;
      
      const processFile = async () => {
        try {
          const result = await cashflowImportService.parseAndMap(
             state.file!, 
             quotes, 
             isDateClosed, 
             existingEntries
          );
          
          if (isMounted) {
            setState(prev => ({
              ...prev,
              parseInfo: result.parseInfo,
              mappedEntries: result.mappedEntries,
              validatedEntries: result.validatedEntries,
              validation: result.validationResult,
              // Go to validation phase
              step: ImportStep.VALIDATE_DATA
            }));
          }
        } catch (error) {
          if (isMounted) {
            alert('Error al procesar el archivo: ' + (error as Error).message);
            setState(prev => ({ ...prev, step: ImportStep.SELECT_FILE, file: null }));
          }
        }
      };
      
      processFile();
      
      return () => { isMounted = false; };
    }
  }, [state.step, state.file, quotes, isDateClosed, existingEntries]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
        alert('Por favor, selecciona un archivo Excel (.xlsx, .xls) o CSV.');
        return;
      }
      setState(prev => ({ ...prev, file, step: ImportStep.PARSE_FILE }));
    }
  };

  const nextStep = () => {
    if (state.step === ImportStep.VALIDATE_DATA) {
      if (!state.validation?.isValid) {
         // Cannot proceed if invalid
         return;
      }
      setState(prev => ({ ...prev, step: ImportStep.PREVIEW }));
      return;
    }
    if (state.step === ImportStep.PREVIEW) {
      setState(prev => ({ ...prev, step: ImportStep.IMPORTING, progress: null }));
      
      const doImport = async () => {
        try {
           const result = await cashflowImportService.importData(
              state.validatedEntries,
              currentUser,
              (progress) => {
                 setState(prev => ({ ...prev, progress }));
              }
           );
           
           setState(prev => ({
              ...prev,
              step: ImportStep.RESULT,
              result
           }));
           
           if (result.success && onSuccess) {
              // We don't automatically close so the user can see the result, 
              // but we can call onSuccess to refresh lists in the background
              onSuccess();
           }
        } catch (err: any) {
           alert('Error grave durante la importación: ' + err.message);
           setState(prev => ({ ...prev, step: ImportStep.PREVIEW }));
        }
      };
      
      doImport();
      return;
    }

    setState(prev => ({
      ...prev,
      step: prev.step + 1
    }));
  };

  const prevStep = () => {
    if (state.step === ImportStep.VALIDATE_DATA) {
      setState(prev => ({
        ...prev,
        step: ImportStep.SELECT_FILE,
        file: null,
        parseInfo: null,
        mappedEntries: [],
        validatedEntries: [],
        validation: null
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    if (state.step === ImportStep.PREVIEW) {
      setState(prev => ({ ...prev, step: ImportStep.VALIDATE_DATA }));
      return;
    }
    setState(prev => ({
      ...prev,
      step: prev.step - 1
    }));
  };

  const renderStepContent = () => {
    switch (state.step) {
      case ImportStep.SELECT_FILE:
        return (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-2">
              <FiFilePlus size={40} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Seleccionar Archivo Excel</h3>
            <p className="text-sm text-slate-500 text-center max-w-xs">
              Sube tu archivo .xlsx o .csv con los movimientos financieros que deseas importar.
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleFileSelect}
            />
            <ActionButton 
              label="Elegir Archivo" 
              variant="primary" 
              onClick={() => fileInputRef.current?.click()}
            />
          </div>
        );
      case ImportStep.PARSE_FILE:
        return (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-2 animate-pulse">
              <FiSettings size={40} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Analizando Archivo</h3>
            <p className="text-sm text-slate-500">Extrayendo datos de las columnas...</p>
          </div>
        );
      case ImportStep.VALIDATE_DATA: {
        const total = state.validatedEntries.length;
        const errores = state.validation?.errors.length || 0;
        const advertencias = state.validation?.warnings.length || 0;
        
        let correctos = 0;
        let cerrados = 0;
        let duplicados = 0;
        let crc = 0;
        let usd = 0;

        state.validatedEntries.forEach(entry => {
          if (entry.isValid) correctos++;
          if (entry.isClosedMonth) cerrados++;
          if (entry.isDuplicate) duplicados++;
          if (entry.parsedCurrency === 'CRC') crc++;
          if (entry.parsedCurrency === 'USD') usd++;
        });

        return (
          <div className="flex flex-col space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Resultados de Validación</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 text-xs font-bold block uppercase">Total Registros</span>
                  <span className="text-xl font-black text-slate-700">{total}</span>
               </div>
               <div className="bg-emerald-50 p-3 rounded border border-emerald-200">
                  <span className="text-emerald-600 text-xs font-bold block uppercase">Correctos</span>
                  <span className="text-xl font-black text-emerald-700">{correctos}</span>
               </div>
               <div className="bg-amber-50 p-3 rounded border border-amber-200">
                  <span className="text-amber-600 text-xs font-bold block uppercase">Advertencias</span>
                  <span className="text-xl font-black text-amber-700">{advertencias}</span>
               </div>
               <div className="bg-rose-50 p-3 rounded border border-rose-200">
                  <span className="text-rose-600 text-xs font-bold block uppercase">Errores</span>
                  <span className="text-xl font-black text-rose-700">{errores}</span>
               </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
               <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                 <span className="text-slate-400 font-bold w-full">Duplicados:</span>
                 <span className="font-black text-slate-700">{duplicados}</span>
               </div>
               <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                 <span className="text-slate-400 font-bold w-full">Meses Cerrados:</span>
                 <span className="font-black text-slate-700">{cerrados}</span>
               </div>
               <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                 <span className="text-slate-400 font-bold w-full">Moneda CRC:</span>
                 <span className="font-black text-slate-700">{crc}</span>
               </div>
               <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                 <span className="text-slate-400 font-bold w-full">Moneda USD:</span>
                 <span className="font-black text-slate-700">{usd}</span>
               </div>
            </div>

            {((state.validation?.errors?.length ?? 0) > 0 || (state.validation?.warnings?.length ?? 0) > 0) && (
              <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                 <div className="bg-slate-100 p-3 font-semibold text-slate-700 flex gap-2 items-center text-sm">
                   <FiAlertTriangle className="text-amber-500" />
                   Panel de Observaciones
                 </div>
                 <div className="overflow-y-auto max-h-[250px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="p-2 border-b">Fila</th>
                          <th className="p-2 border-b">Severidad</th>
                          <th className="p-2 border-b">Campo</th>
                          <th className="p-2 border-b">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.validation?.errors.map((err, i) => (
                           <tr key={`err-${i}`} className="border-b border-slate-50 hover:bg-rose-50/30">
                              <td className="p-2 text-slate-500 font-mono">Fila {err.row}</td>
                              <td className="p-2"><span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">ERROR</span></td>
                              <td className="p-2 font-semibold text-slate-700">{err.column}</td>
                              <td className="p-2">
                                <span className="block text-slate-700">{err.message}</span>
                                <span className="block text-[10px] text-slate-400 mt-1 italic">Sug: Modifique este valor o asigne un formato compatible.</span>
                              </td>
                           </tr>
                        ))}
                        {state.validation?.warnings.map((warn, i) => (
                           <tr key={`warn-${i}`} className="border-b border-slate-50 hover:bg-amber-50/30">
                              <td className="p-2 text-slate-500 font-mono">Fila {warn.row}</td>
                              <td className="p-2"><span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">AVISO</span></td>
                              <td className="p-2 font-semibold text-slate-700">{warn.column}</td>
                              <td className="p-2">
                                <span className="block text-slate-700">{warn.message}</span>
                              </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            )}
            
            {!(state.validation?.isValid) && (
               <div className="bg-rose-50 text-rose-600 p-3 rounded text-sm font-semibold flex items-start gap-2 border border-rose-100">
                 <FiInfo className="mt-0.5 flex-shrink-0" />
                 Existen errores de validación. Debe corregir el archivo y volver a cargarlo para continuar.
               </div>
            )}
          </div>
        );
      }
      case ImportStep.PREVIEW:
        return (
          <div className="flex flex-col space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FiGrid /> Vista Previa de Datos
            </h3>
              
            {state.parseInfo && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
                   <span className="text-slate-500 block">Archivo</span>
                   <span className="font-semibold text-slate-800 truncate block" title={state.file?.name}>{state.file?.name}</span>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
                   <span className="text-slate-500 block">Hoja</span>
                   <span className="font-semibold text-slate-800 truncate block">{state.parseInfo.sheetName} ({state.parseInfo.sheetNames.length} hojas)</span>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
                   <span className="text-slate-500 block">Filas Leídas</span>
                   <span className="font-semibold text-slate-800 truncate block">{state.parseInfo.rows.length}</span>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
                   <span className="text-slate-500 block">Registros Detectados</span>
                   <span className="font-semibold text-slate-800 truncate block">{state.mappedEntries.length}</span>
                 </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[60vh] shadow-sm">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
                    <tr>
                      <th className="p-2 font-medium">Fila</th>
                      <th className="p-2 font-medium">Fecha</th>
                      <th className="p-2 font-medium">Consecutivo</th>
                      <th className="p-2 font-medium">Proveedor</th>
                      <th className="p-2 font-medium">Detalles Compra</th>
                      <th className="p-2 font-medium text-right">Subtotal</th>
                      <th className="p-2 font-medium text-right">Total Impuesto</th>
                      <th className="p-2 font-medium text-right">Total Comprobante</th>
                      <th className="p-2 font-medium">Forma Pago</th>
                      <th className="p-2 font-medium">Cuenta</th>
                      <th className="p-2 font-medium text-center">Moneda Detectada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {state.validatedEntries.slice(0, 50).map((entry, idx) => {
                       const formatDate = (dateStr: string | undefined, rawDate: any) => {
                          if (dateStr && dateStr.includes('-')) {
                             const parts = dateStr.split('-');
                             if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                          }
                          if (rawDate instanceof Date) {
                             return `${String(rawDate.getDate()).padStart(2, '0')}/${String(rawDate.getMonth() + 1).padStart(2, '0')}/${rawDate.getFullYear()}`;
                          }
                          return String(rawDate ?? '');
                       };
                       
                       const formatCurrencyAmount = (val: any, currency: string | undefined) => {
                          if (val === null || val === undefined || val === '') return '';
                          let num = Number(val);
                          if (isNaN(num) && typeof val === 'string') {
                             // Attempt to clean it if it's a string, removing spaces, currency symbols.
                             // This is a naive fallback if Excel didn't parse it as a number.
                             const cleanedStr = val.replace(/[^0-9.-]/g, '');
                             num = Number(cleanedStr);
                          }
                          if (isNaN(num)) return String(val);
                          return new Intl.NumberFormat('es-CR', { style: 'currency', currency: currency === 'USD' ? 'USD' : 'CRC' }).format(num);
                       };

                       return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-400">{entry.originalRowIndex}</td>
                          <td className="p-2">{formatDate(entry.parsedDate, entry.rawDate)}</td>
                          <td className="p-2">{String(entry.rawConsecutive ?? '')}</td>
                          <td className="p-2">{String(entry.rawProvider ?? '')}</td>
                          <td className="p-2 truncate max-w-[150px]" title={String(entry.rawDetails ?? '')}>{String(entry.rawDetails ?? '')}</td>
                          <td className="p-2 text-right">{formatCurrencyAmount(entry.rawSubtotal, entry.parsedCurrency)}</td>
                          <td className="p-2 text-right">{formatCurrencyAmount(entry.rawTax, entry.parsedCurrency)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrencyAmount(entry.rawTotal, entry.parsedCurrency)}</td>
                          <td className="p-2">{String(entry.rawMethod ?? '')}</td>
                          <td className="p-2">{String(entry.rawAccount ?? '')}</td>
                          <td className="p-2 text-center">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.parsedCurrency === 'USD' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                               {entry.parsedCurrency || 'CRC'}
                             </span>
                          </td>
                        </tr>
                       );
                    })}
                    {state.validatedEntries.length > 50 && (
                      <tr>
                        <td colSpan={11} className="p-3 text-center text-slate-400 italic">
                          Mostrando 50 de {state.validatedEntries.length} registros...
                        </td>
                      </tr>
                    )}
                    {state.validatedEntries.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-6 text-center text-slate-400">
                          No se encontraron datos interpretables en el archivo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
          </div>
        );
      case ImportStep.IMPORTING:
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
               <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${state.progress?.percentage || 0}%` }}></div>
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
        );
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (state.step) {
      case ImportStep.SELECT_FILE: return "Paso 1: Seleccionar archivo";
      case ImportStep.PARSE_FILE: return "Paso 2: Analizar archivo";
      case ImportStep.VALIDATE_DATA: return "Paso 3: Validar información";
      case ImportStep.PREVIEW: return "Paso 4: Vista previa";
      case ImportStep.IMPORTING: return "Paso 5: Importación";
      case ImportStep.RESULT: return "Paso 6: Resultado";
      default: return "";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Asistente de Importación de Movimientos"
      maxWidth="max-w-[95vw] 2xl:max-w-[90vw]"
    >
      <div className="flex flex-col min-h-[400px]">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
            <span>{getStepTitle()}</span>
            <span>{Math.round(((state.step + 1) / 6) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${((state.step + 1) / 6) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
          <ActionButton
            label="Cancelar"
            variant="ghost"
            onClick={onClose}
            icon={<FiX />}
            disabled={state.step === ImportStep.IMPORTING}
          />

          <div className="flex items-center gap-2">
            {state.step > ImportStep.SELECT_FILE && state.step < ImportStep.RESULT && (
              <ActionButton
                label="Anterior"
                variant="outline"
                onClick={prevStep}
                icon={<FiArrowLeft />}
                disabled={state.step === ImportStep.IMPORTING || state.step === ImportStep.PARSE_FILE}
              />
            )}
            
            {state.step < ImportStep.RESULT && state.step !== ImportStep.IMPORTING && state.step !== ImportStep.SELECT_FILE && state.step !== ImportStep.PARSE_FILE && (
              <ActionButton
                label={state.step === ImportStep.PREVIEW ? "Comenzar Importación" : "Siguiente"}
                variant="primary"
                onClick={nextStep}
                icon={state.step === ImportStep.PREVIEW ? <FiUploadCloud /> : <FiArrowRight />}
              />
            )}

            {state.step === ImportStep.RESULT && (
              <ActionButton
                label="Finalizar"
                variant="primary"
                onClick={() => {
                  if (state.result?.success && onSuccess) {
                     onSuccess();
                  }
                  onClose();
                }}
                icon={<FiCheckCircle />}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
