import React, { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Employee, AbsenceRecord, PayStub } from '../../../financeTypes';
import { formatCurrency } from '../../../utils/formatCurrency';
import { StatusBadge, IconButton, ACTION_ICONS, ActionButton, useConfirm } from '@/design-system';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';
import { FiX, FiDollarSign, FiMonitor, FiArrowUpCircle, FiArrowDownCircle, FiRepeat, FiAward, FiFileText, FiUploadCloud, FiTrash2 } from "react-icons/fi";
import { generatePaystubPDF } from '../../../utils/pdfGenerator';
import { useEmployeeHistory } from '../payroll/services/useEmployeeHistory';
import { useUserContext } from '../../../contexts/UserContext';
import { isAdmin } from '../../../utils/permissions';
import { triggerFileDownload } from '../../../utils/fileUtils';

interface EmployeeRecordModalProps {
  show: boolean;
  onClose: () => void;
  employee: Employee | null;
  absenceRecords?: AbsenceRecord[];
  payStubs?: PayStub[];
}

export const EmployeeRecordModal: React.FC<EmployeeRecordModalProps> = ({ 
  show, 
  onClose, 
  employee, 
  absenceRecords = [],
  payStubs = []
}) => {
  // 1. Los hooks siempre deben ejecutarse al inicio y en el mismo orden
  
  const confirm = useConfirm() || (() => Promise.resolve(false));
  const { currentUser } = useUserContext();

  const userIsAdmin = isAdmin(currentUser?.role) || currentUser?.role === 'rrhh';
  useLockBodyScroll(show);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const historyData = useEmployeeHistory(show ? employee?.id : null);
  const { 
    workHistory = [], 
    adminLogs = [], 
    employeeFiles = [], 
    loadingHistory = false, 
    uploadEmployeeFile, 
    deleteEmployeeFile 
  } = historyData || {};

  const [uploadingFile, setUploadingFile] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filtrado de ausencias para este colaborador específico
  const employeeAbsences = useMemo(() => {
    if (!employee || !Array.isArray(absenceRecords)) return [];
    
    return absenceRecords
      .filter(abs => abs && abs.employeeId === employee.id)
      .sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
      });
  }, [absenceRecords, employee]);

  // Filtrado de colillas para este colaborador
  const employeePayStubs = useMemo(() => {
    if (!employee || !Array.isArray(payStubs)) return [];
    return payStubs
      .filter(stub => stub && stub.employeeId === employee.id)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.fortnight === 'Segunda' ? -1 : 1;
      });
  }, [payStubs, employee]);

  // Fallback for stats
  const safeEmployeeAbsences = employeeAbsences || [];
  const safeEmployeePayStubs = employeePayStubs || [];
  const safeWorkHistory = workHistory || [];
  const safeAdminLogs = adminLogs || [];
  const safeEmployeeFiles = employeeFiles || [];

  // Consolidación de estadísticas
  const stats = useMemo(() => {
    return employeeAbsences.reduce((acc, curr) => {
        if (!curr) return acc;
        if (curr.type === 'Incapacidad') acc.incapacidades++;
        if (curr.type === 'Ausencia') acc.ausencias++;
        if (curr.type === 'Permiso') acc.permisos++;
        return acc;
    }, { incapacidades: 0, ausencias: 0, permisos: 0 });
  }, [employeeAbsences]);

  const handleDeleteFile = async (file: any) => {
      setDeleteError(null);
      const isConfirmed = await confirm({
          title: '¿Desea eliminar este archivo?',
          description: 'El archivo será eliminado permanentemente de Firebase Storage y del expediente digital. Esta acción no se puede deshacer.',
          confirmLabel: 'Eliminar Archivo',
          variant: 'danger'
      });

      if (!isConfirmed) return;

      try {
          await deleteEmployeeFile(file);
      } catch (err: any) {
          console.error("Error eliminando archivo:", err);
          setDeleteError(`No fue posible eliminar el archivo.`);
          setTimeout(() => setDeleteError(null), 5000);
      }
  };

  // 2. El retorno temprano (Early Return) DEBE ir después de todos los hooks
  if (!show || !employee) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '---';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '---';
    
    return date.toLocaleDateString('es-CR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getMonthName = (monthNum?: number) => {
    if (!monthNum) return '---';
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return monthNames[monthNum - 1] || monthNum.toString();
  };

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[250] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Corporativo */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 flex-none">
          <div className="flex gap-6 items-center">
            <div className="w-16 h-16 bg-blue-900 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-blue-100 shrink-0">
              {employee.name ? employee.name.charAt(0) : '?'}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-widest">
                  Expediente Digital
                </span>
                <span className="text-slate-400 font-mono text-xs font-bold">
                  ID: {employee.employeeCode}
                </span>
              </div>
              <h2 className="text-2xl font-black text-blue-950 uppercase tracking-tight">
                {employee.name}
              </h2>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                {employee.position}
              </p>
            </div>
          </div>
          <IconButton 
            icon={<FiX className="text-lg" />}
            onClick={onClose}
            variant="secondary"
            className="w-10 h-10 rounded-full border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 flex items-center justify-center transition-all shadow-sm shrink-0"
            title="Cerrar"
          />
        </div>

        {/* Cuerpo del Expediente */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-12">
          
          {/* Grid de Información General */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                Información de Contacto
              </h4>
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Correo Electrónico</span>
                  <span className="text-sm font-bold text-slate-700">{employee.email || 'No registrado'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</span>
                  <span className="text-sm font-bold text-slate-700">{employee.phone || 'No registrado'}</span>
                </div>
                <div className="flex flex-col pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado de Cuenta</span>
                  <StatusBadge 
                    label={employee.isActive ? 'ACTIVO' : 'INACTIVO'} 
                    variant={employee.isActive ? 'success' : 'danger'} 
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                Detalle Laboral
              </h4>
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha de Ingreso</span>
                  <span className="text-sm font-black text-blue-900">{formatDate(employee.hireDate)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Salario Bruto Mensual</span>
                  <span className="text-lg font-black text-slate-700">{formatCurrency(employee.baseSalary)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Deducción CCSS (Estimada)</span>
                  <span className="text-sm font-bold text-red-500">{formatCurrency(employee.ccssDeduction)}</span>
                </div>
              </div>
            </section>
          </div>

          <hr className="border-slate-100" />

          {/* Historial de Colillas */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Historial de Colillas
            </h4>
            
            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                {employeePayStubs.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Fecha / Período</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-right">Salario Bruto</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-right">Deducciones</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-right">Salario Neto</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {employeePayStubs.map(stub => {
                                  const rawBasePay = (stub.netPay || 0) + (stub.totalDeductions || 0);
                                  return (
                                    <tr key={stub.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3">
                                            <p className="text-[10px] font-mono text-slate-600 font-bold">{getMonthName(stub.month)} {stub.year}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">{stub.fortnight} Quincena</p>
                                        </td>
                                        <td className="p-3 text-right text-[11px] font-mono font-medium text-slate-500">
                                            {formatCurrency(rawBasePay)}
                                        </td>
                                        <td className="p-3 text-right text-[11px] font-mono font-bold text-red-500">
                                            -{formatCurrency(stub.totalDeductions || 0)}
                                        </td>
                                        <td className="p-3 text-right text-[11px] font-mono font-black text-emerald-600">
                                            {formatCurrency(stub.netPay || 0)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <IconButton 
                                                icon={<ACTION_ICONS.pdf />} 
                                                onClick={async () => {
                                                    const { fileBlob, fileName } = await generatePaystubPDF(stub, employee);
                                                    triggerFileDownload(fileBlob, fileName);
                                                }} 
                                                variant="danger" 
                                                title="Descargar Colilla PDF"
                                            />
                                        </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center bg-white">
                        <p className="text-xs font-bold text-slate-400 italic">No se registran colillas de pago para este colaborador.</p>
                    </div>
                )}
            </div>
          </section>

          {/* Archivos del Colaborador */}
          <section className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                <div className="flex flex-col gap-1">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Archivos del Colaborador
                    </h4>
                    {deleteError && (
                        <span className="text-[10px] text-white bg-red-500 font-medium px-2 py-0.5 rounded-full inline-flex max-w-max">
                            {deleteError}
                        </span>
                    )}
                </div>
                <div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                setUploadingFile(true);
                                try {
                                    await uploadEmployeeFile(e.target.files[0], 'documentos_rrhh');
                                } catch (err) {
                                    console.error("Error subiendo archivo:", err);
                                    alert("Error al subir archivo");
                                } finally {
                                    setUploadingFile(false);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }
                            }
                        }}
                    />
                    <ActionButton 
                        label={uploadingFile ? "Subiendo..." : "Subir Documento"} 
                        onClick={() => fileInputRef.current?.click()} 
                        variant="primary" 
                        disabled={uploadingFile}
                    />
                </div>
            </div>
            
            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                {employeeFiles.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Documento</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Categoría</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Resubido por</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {employeeFiles.map(file => (
                                    <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3">
                                            <p className="text-[10px] font-bold text-blue-900 truncate max-w-[200px]" title={file.name}>{file.name}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">{formatDate(((file.date || '') as string).split('T')[0])}</p>
                                        </td>
                                        <td className="p-3">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                                                {file.category.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-[10px] font-bold text-slate-600 truncate max-w-[150px]">{file.uploadedByName}</p>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <IconButton 
                                                    icon={<FiUploadCloud />} 
                                                    onClick={async () => {
                                                        try {
                                                            const response = await fetch(file.downloadUrl);
                                                            const blob = await response.blob();
                                                            await triggerFileDownload(blob, file.name);
                                                        } catch(e) {
                                                            console.error("Error downloading file:", e);
                                                            if (typeof window !== 'undefined' && !(window as any).Capacitor?.isNativePlatform()) {
                                                                const link = document.createElement('a');
                                                                link.href = file.downloadUrl;
                                                                link.download = file.name;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                            } else {
                                                                alert(`No se pudo descargar el archivo: ${e}`);
                                                            }
                                                        }
                                                    }} 
                                                    variant="secondary" 
                                                    title="Descargar / Ver"
                                                />
                                                {userIsAdmin && (
                                                    <IconButton 
                                                        icon={<FiTrash2 />} 
                                                        onClick={() => handleDeleteFile(file)} 
                                                        variant="danger" 
                                                        title="Eliminar Archivo"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center bg-white border-dashed">
                        <FiMonitor className="text-4xl text-slate-300 mx-auto mb-3" />
                        <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Sin Documentos</h5>
                        <p className="text-[10px] text-slate-400 max-w-sm mx-auto">No hay contratos, cédulas ni certificaciones anexas a este expediente.</p>
                    </div>
                )}
            </div>
          </section>

          {/* Historial Laboral & Administrativo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Historial Laboral
                  </h4>
                  <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-6 flex flex-col h-full min-h-[300px]">
                      {loadingHistory ? (
                          <div className="flex-1 flex justify-center items-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                          </div>
                      ) : workHistory.length > 0 ? (
                          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent flex-1 overflow-y-auto pr-2 custom-scrollbar">
                              {workHistory.map((event, idx) => (
                                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 transition-transform group-hover:scale-110">
                                          {event.eventType === 'salary_increase' && <FiArrowUpCircle className="text-emerald-500 text-xl" />}
                                          {event.eventType === 'salary_decrease' && <FiArrowDownCircle className="text-red-500 text-xl" />}
                                          {event.eventType === 'promotion' && <FiAward className="text-purple-500 text-xl" />}
                                          {event.eventType === 'position_change' && <FiRepeat className="text-blue-500 text-xl" />}
                                          {event.eventType === 'status_change' && <FiFileText className="text-amber-500 text-xl" />}
                                          {['permission_change', 'admin_modification', 'other'].includes(event.eventType) && <FiMonitor className="text-slate-500 text-xl" />}
                                      </div>
                                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                          <div className="flex items-center justify-between mb-2">
                                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{formatDate(((event.date || '') as string).split('T')[0])}</span>
                                          </div>
                                          <p className="text-xs font-bold text-blue-950 mb-1">
                                              {event.eventType === 'salary_increase' && 'Aumento Salarial'}
                                              {event.eventType === 'salary_decrease' && 'Reducción Salarial'}
                                              {event.eventType === 'promotion' && 'Ascenso'}
                                              {event.eventType === 'position_change' && 'Cambio de Puesto'}
                                              {event.eventType === 'status_change' && 'Cambio de Estado'}
                                              {event.eventType === 'permission_change' && 'Cambios de Permisos'}
                                              {event.eventType === 'admin_modification' && 'Modificación Administrativa'}
                                              {event.eventType === 'other' && 'Otro evento'}
                                          </p>
                                          
                                          {/* Valores Anteriores -> Nuevos */}
                                          {event.newValue !== undefined && event.oldValue !== undefined && (
                                              <div className="flex flex-col text-[11px] font-mono text-slate-600 mt-2 bg-slate-50 p-2 rounded-xl">
                                                  <span className="text-slate-400 line-through decoration-red-400/50">
                                                      {typeof event.oldValue === 'number' ? formatCurrency(event.oldValue) : event.oldValue}
                                                  </span>
                                                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                                                      → {typeof event.newValue === 'number' ? formatCurrency(event.newValue) : event.newValue}
                                                      {event.percentageChange ? (
                                                          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full ml-1 font-sans font-black">
                                                              {event.percentageChange > 0 ? '+' : ''}{event.percentageChange}%
                                                          </span>
                                                      ) : null}
                                                  </span>
                                              </div>
                                          )}
                                          
                                          {event.observation && (
                                              <p className="mt-2 text-[10px] text-slate-500 italic border-l-2 border-amber-300 pl-2">&quot;{event.observation}&quot;</p>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                              <FiAward className="text-4xl text-slate-300 mb-3" />
                              <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Sin historial</h5>
                              <p className="text-[9px] text-slate-400 max-w-[200px]">No se han registrado eventos laborales para este colaborador.</p>
                          </div>
                      )}
                  </div>
              </section>
              <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Bitácora Administrativa
                  </h4>
                  <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-0 flex flex-col h-full min-h-[300px] overflow-hidden">
                      {loadingHistory ? (
                          <div className="flex-1 flex justify-center items-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
                          </div>
                      ) : adminLogs.length > 0 ? (
                          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 max-h-[400px]">
                              {adminLogs.map(log => (
                                  <div key={log.id} className="p-4 bg-white hover:bg-slate-50/80 transition-colors">
                                      <div className="flex justify-between items-start mb-1">
                                          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                              <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[8px] font-black">
                                                  {(log.adminName || '').charAt(0)}
                                              </div>
                                              {log.adminName}
                                          </div>
                                          <span className="text-[9px] font-mono text-slate-400">
                                              {new Date(log.date).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}
                                          </span>
                                      </div>
                                      <p className="text-[11px] text-slate-600 font-medium pl-5 mb-1">{log.action}</p>
                                      {(log.oldValue || log.newValue) && (
                                          <div className="pl-5 mt-1 border-l-2 border-slate-200 ml-1">
                                              <p className="text-[10px] font-mono text-slate-400 truncate w-full" title={String(log.oldValue)}>Anterior: {String(log.oldValue)}</p>
                                              <p className="text-[10px] font-mono text-slate-600 truncate w-full font-semibold" title={String(log.newValue)}>Nuevo: {String(log.newValue)}</p>
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-50">
                              <FiMonitor className="text-4xl text-slate-300 mb-3" />
                              <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Auditoría Limpia</h5>
                              <p className="text-[9px] text-slate-400 max-w-[200px]">No se han registrado modificaciones administrativas recientes.</p>
                          </div>
                      )}
                  </div>
              </section>
          </div>

          <hr className="border-slate-100" />

          {/* Resumen Laboral (Incidencias) */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Resumen Laboral (Incidencias)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-[9px] font-black text-red-400 uppercase mb-1">Incapacidades</span>
                    <span className="text-2xl font-black text-red-600">{stats.incapacidades}</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-[9px] font-black text-amber-400 uppercase mb-1">Ausencias</span>
                    <span className="text-2xl font-black text-amber-600">{stats.ausencias}</span>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-[9px] font-black text-blue-400 uppercase mb-1">Permisos</span>
                    <span className="text-2xl font-black text-blue-600">{stats.permisos}</span>
                </div>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                {employeeAbsences.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Periodo</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Tipo</th>
                                    <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Motivo / Justificación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {employeeAbsences.map(abs => (
                                    <tr key={abs.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                                            {abs.startDate} / {abs.endDate}
                                        </td>
                                        <td className="p-3">
                                            <StatusBadge 
                                                label={abs.type} 
                                                variant={abs.type === 'Incapacidad' ? 'danger' : abs.type === 'Ausencia' ? 'warning' : 'info'} 
                                            />
                                        </td>
                                        <td className="p-3 text-[10px] font-bold text-slate-600 leading-tight">
                                            {abs.justification || 'Sin detalle'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center bg-white">
                        <p className="text-xs font-bold text-slate-400 italic">No se registran incidencias laborales para este colaborador.</p>
                    </div>
                )}
            </div>
          </section>

          {/* Sección de Cesantía */}
          <section className="bg-slate-50 border border-slate-200 rounded-3xl p-6 relative overflow-hidden group mt-4">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <FiDollarSign className="text-6xl text-blue-900"  />
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                <FiMonitor className="text-blue-400"  /> Cesantía y Prestaciones
              </h4>
              <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full tracking-tighter uppercase">
                Próxima Integración
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/60 border border-slate-100 p-4 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Años Laborados</p>
                <p className="text-xl font-black text-slate-300">--</p>
              </div>
              <div className="bg-white/60 border border-slate-100 p-4 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Acumulado Estimado</p>
                <p className="text-xl font-black text-slate-300">¢0.00</p>
              </div>
              <div className="bg-white/60 border border-slate-100 p-4 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Pre-aviso (Días)</p>
                <p className="text-xl font-black text-slate-300">--</p>
              </div>
            </div>
            
            <p className="mt-4 text-[10px] font-medium text-slate-400 italic">
              * El motor de cálculo de prestaciones legales se encuentra en fase de validación técnica.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end flex-none">
          <ActionButton 
            label="Cerrar Expediente"
            onClick={onClose}
            variant="primary"
            className="px-8 py-3 font-black uppercase text-xs rounded-xl shadow-lg shadow-blue-100 active:scale-95"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};