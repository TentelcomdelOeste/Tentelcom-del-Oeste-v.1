import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  FiX,
  FiRepeat,
  FiUser,
  FiTruck,
  FiCalendar,
  FiFolder,
  FiCamera,
  FiAlertCircle,
  FiBox,
  FiArrowRight
} from 'react-icons/fi';
import { ToolAssignment, RecipientType, TransferAssignmentDTO } from '@/types/toolAssignment.types';
import { toolAssignmentService } from '@/services/toolAssignmentService';
import { User } from '@/utils/types';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { ActionButton, IconButton } from '@/design-system';

interface EmployeeOption {
  id: string;
  name: string;
  position?: string;
  department?: string;
}

interface ProjectOption {
  id: string;
  projectNumber?: string;
  name: string;
}

interface VehicleOption {
  id: string;
  plate: string;
  brandModel?: string;
}

interface TransferAssignmentModalProps {
  show: boolean;
  onClose: () => void;
  assignment: ToolAssignment | null;
  currentUser: User | null;
  onSuccess?: () => void;
}

export const TransferAssignmentModal: React.FC<TransferAssignmentModalProps> = ({
  show,
  onClose,
  assignment,
  currentUser,
  onSuccess
}) => {
  useLockBodyScroll(show);

  // Estados del formulario
  const [recipientType, setRecipientType] = useState<RecipientType>('colaborador');
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [isExternalRecipient, setIsExternalRecipient] = useState<boolean>(false);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState<boolean>(false);

  const [assignedBy, setAssignedBy] = useState<string>('');
  const [showAssignedByDropdown, setShowAssignedByDropdown] = useState<boolean>(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [observations, setObservations] = useState<string>('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Listas desde Firestore
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  // Inicializar/reiniciar formulario cuando abre el modal
  useEffect(() => {
    if (show && assignment) {
      setRecipientType('colaborador');
      setRecipientInput('');
      setSelectedEmployee(null);
      setSelectedVehicle(null);
      setIsExternalRecipient(false);
      setShowRecipientDropdown(false);

      const defaultDeliverer = currentUser?.name || currentUser?.email || '';
      setAssignedBy(defaultDeliverer);
      setShowAssignedByDropdown(false);

      setSelectedProjectId(assignment.projectId || '');
      setTransferDate(new Date().toISOString().split('T')[0]);
      setObservations('');
      setEvidencePhotos([]);
      setError(null);
      setLoading(false);

      // Cargar catálogos
      fetchCatalogs();
    }
  }, [show, assignment, currentUser]);

  const fetchCatalogs = async () => {
    try {
      // 1. Colaboradores de todo el sistema
      const empSnap = await getDocs(collection(db, 'employees'));
      const empList: EmployeeOption[] = empSnap.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: (data.fullName || data.displayName || data.name || data.nombre || docSnap.id).trim(),
            position: (data.position || data.jobTitle || data.cargo || '').trim(),
            department: (data.department || data.departamento || '').trim(),
            isArchived: Boolean(data.isArchived || data.status === 'archivado' || data.status === 'Inactivo')
          };
        })
        .filter((e) => !e.isArchived && e.name !== '');

      // Ordenar alfabéticamente
      empList.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setEmployees(empList);

      // 2. Proyectos
      const projSnap = await getDocs(collection(db, 'projects'));
      const projList: ProjectOption[] = projSnap.docs.map((doc) => ({
        id: doc.id,
        projectNumber: doc.data().projectNumber || doc.data().code || '',
        name: doc.data().name || doc.data().projectName || doc.id
      }));
      setProjects(projList);

      // 3. Vehículos
      const vehSnap = await getDocs(collection(db, 'vehicles'));
      const vehList: VehicleOption[] = vehSnap.docs.map((doc) => ({
        id: doc.id,
        plate: doc.data().licensePlate || doc.data().plate || doc.id,
        brandModel: `${doc.data().make || doc.data().brand || ''} ${doc.data().model || ''}`.trim()
      }));
      setVehicles(vehList);
    } catch (err) {
      console.error('[TransferAssignmentModal] Error al cargar catálogos:', err);
    }
  };

  // Filtrado de colaboradores para el destinatario
  const filteredEmployeesForRecipient = useMemo(() => {
    if (!recipientInput.trim()) return employees;
    const term = recipientInput.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        (e.position && e.position.toLowerCase().includes(term))
    );
  }, [employees, recipientInput]);

  // Filtrado de colaboradores para el responsable de entrega
  const filteredEmployeesForAssignedBy = useMemo(() => {
    if (!assignedBy.trim()) return employees;
    const term = assignedBy.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        (e.position && e.position.toLowerCase().includes(term))
    );
  }, [employees, assignedBy]);

  // Filtrado de vehículos
  const filteredVehicles = useMemo(() => {
    if (!recipientInput.trim()) return vehicles;
    const term = recipientInput.toLowerCase().trim();
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(term) ||
        (v.brandModel && v.brandModel.toLowerCase().includes(term))
    );
  }, [vehicles, recipientInput]);

  // Manejo de carga de fotografías
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - evidencePhotos.length;
    if (remainingSlots <= 0) {
      alert('Ha alcanzado el límite máximo de 5 fotografías por traspaso.');
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        alert(`El archivo ${file.name} no es una imagen válida.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setEvidencePhotos((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setEvidencePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assignment) return;

    if (!recipientInput.trim() && !selectedEmployee && !selectedVehicle) {
      setError('Por favor seleccione o ingrese el nuevo destinatario / custodio.');
      return;
    }

    if (!assignedBy.trim()) {
      setError('Por favor ingrese el nombre del responsable que entrega la transferencia.');
      return;
    }

    // Determinar nombre y detalles finales del destinatario
    let finalRecipientName = '';
    let finalRecipientId = '';
    let finalRecipientDetail = '';
    let isExternal = false;

    if (recipientType === 'colaborador') {
      if (selectedEmployee) {
        finalRecipientName = selectedEmployee.name;
        finalRecipientId = selectedEmployee.id;
        finalRecipientDetail = selectedEmployee.position || '';
        isExternal = false;
      } else {
        finalRecipientName = recipientInput.trim();
        finalRecipientId = `external_${Date.now()}`;
        finalRecipientDetail = 'Destinatario Externo / Personalizado';
        isExternal = true;
      }
    } else {
      if (selectedVehicle) {
        finalRecipientName = `Unidad ${selectedVehicle.plate}`;
        finalRecipientId = selectedVehicle.id;
        finalRecipientDetail = selectedVehicle.brandModel || 'Unidad Vehicular';
        isExternal = false;
      } else {
        finalRecipientName = recipientInput.startsWith('Unidad')
          ? recipientInput.trim()
          : `Unidad ${recipientInput.trim()}`;
        finalRecipientId = `vehicle_${Date.now()}`;
        finalRecipientDetail = 'Unidad Vehicular';
        isExternal = false;
      }
    }

    // Validar que el nuevo destinatario no sea exactamente el mismo actual
    if (finalRecipientName.toLowerCase() === assignment.recipientName.toLowerCase()) {
      setError('El nuevo destinatario es idéntico al custodio actual.');
      return;
    }

    const selectedProj = projects.find((p) => p.id === selectedProjectId);

    const dto: TransferAssignmentDTO = {
      assignmentId: assignment.id,
      newRecipientType: recipientType,
      newRecipientId: finalRecipientId,
      newRecipientName: finalRecipientName,
      newRecipientDetail: finalRecipientDetail,
      isExternalRecipient: isExternal,
      transferDate,
      assignedBy: assignedBy.trim(),
      projectId: selectedProj?.id,
      projectNumber: selectedProj?.projectNumber,
      projectName: selectedProj?.name,
      observations: observations.trim(),
      evidencePhotos
    };

    setLoading(true);
    try {
      await toolAssignmentService.transferAssignment(dto, currentUser);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[TransferAssignmentModal] Error al transferir:', err);
      setError(err.message || 'Error al procesar la transferencia de la asignación.');
    } finally {
      setLoading(false);
    }
  };

  if (!show || !assignment) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col my-auto">
        
        {/* Header Modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-blue-300">
              <FiRepeat className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Transferencia Directa de Custodia
              </h2>
              <p className="text-xs text-blue-200/80 font-medium">
                Reasignación de equipo o herramienta entre custodios
              </p>
            </div>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="!text-white/80 hover:!text-white hover:!bg-white/10 rounded-full"
            aria-label="Cerrar modal"
          >
            <FiX className="text-xl" />
          </IconButton>
        </div>

        {/* Cuerpos Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* Card Resumen de la Herramienta y Custodio Actual */}
          <div className="bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100/80 pb-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <FiBox className="text-blue-600" /> Datos del Equipo Actual
              </span>
              <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full">
                {assignment.requestNumber || assignment.itemCode || 'S/C'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Artículo</span>
                <span className="font-bold text-slate-800 text-sm leading-snug">
                  {assignment.itemDescription}
                </span>
                <span className="text-[11px] text-slate-500 block font-medium">
                  {assignment.quantity} {assignment.itemUnit || 'unid'} &bull; {assignment.itemCategory || 'Herramientas'}
                </span>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black text-amber-800 uppercase block">Custodio Actual</span>
                  <span className="font-bold text-slate-900">{assignment.recipientName}</span>
                  {assignment.recipientDetail && (
                    <span className="text-[10px] text-slate-500 block">{assignment.recipientDetail}</span>
                  )}
                </div>
                <FiArrowRight className="text-blue-500 text-lg shrink-0" />
              </div>
            </div>
          </div>

          {/* 1. SELECCIÓN DE TIPO Y NUEVO RECEPTOR */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                1. Nuevo Destinatario / Custodio
              </label>

              {/* Toggle Tipo de Receptores */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setRecipientType('colaborador');
                    setRecipientInput('');
                    setSelectedEmployee(null);
                    setSelectedVehicle(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    recipientType === 'colaborador'
                      ? 'bg-white text-blue-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FiUser className="text-xs" /> Colaborador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientType('unidad');
                    setRecipientInput('');
                    setSelectedEmployee(null);
                    setSelectedVehicle(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    recipientType === 'unidad'
                      ? 'bg-white text-blue-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FiTruck className="text-xs" /> Unidad Vehicular
                </button>
              </div>
            </div>

            {/* Input Buscador / Nombre Libre para Colaborador o Unidad */}
            <div className="relative">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  {recipientType === 'colaborador' ? <FiUser /> : <FiTruck />}
                </div>
                <input
                  type="text"
                  value={
                    selectedEmployee
                      ? selectedEmployee.name
                      : selectedVehicle
                      ? `Unidad ${selectedVehicle.plate}`
                      : recipientInput
                  }
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setSelectedEmployee(null);
                    setSelectedVehicle(null);
                    setShowRecipientDropdown(true);
                  }}
                  onFocus={() => setShowRecipientDropdown(true)}
                  placeholder={
                    recipientType === 'colaborador'
                      ? 'Buscar colaborador o ingresar nombre personalizado...'
                      : 'Buscar unidad vehicular por placa o nombre...'
                  }
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                {(recipientInput || selectedEmployee || selectedVehicle) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientInput('');
                      setSelectedEmployee(null);
                      setSelectedVehicle(null);
                      setShowRecipientDropdown(true);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <FiX className="text-sm" />
                  </button>
                )}
              </div>

              {/* Dropdown Lista de Selección */}
              {showRecipientDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowRecipientDropdown(false)}
                  />
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto custom-scrollbar min-w-[280px]">
                    {recipientType === 'colaborador' ? (
                      <>
                        {filteredEmployeesForRecipient.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setRecipientInput(emp.name);
                              setShowRecipientDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors focus:bg-slate-50 outline-none flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-900">{emp.name}</div>
                              {emp.position && (
                                <div className="text-[10px] text-slate-500 mt-0.5">{emp.position}</div>
                              )}
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              Colaborador
                            </span>
                          </button>
                        ))}

                        {/* Opción libre / personalizado */}
                        {recipientInput.trim() && !selectedEmployee && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsExternalRecipient(true);
                              setShowRecipientDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 bg-blue-50/70 hover:bg-blue-100/70 border-t border-slate-100 transition-colors flex items-center justify-between gap-2 outline-none"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-blue-900 truncate flex items-center gap-1.5">
                                <FiUser className="text-blue-600 shrink-0" />
                                <span>Usar &quot;{recipientInput.trim()}&quot;</span>
                              </div>
                              <div className="text-[10px] text-blue-700 font-medium">
                                Registrar como destinatario / custodio personalizado
                              </div>
                            </div>
                            <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded shrink-0">
                              Personalizado
                            </span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {filteredVehicles.map((veh) => (
                          <button
                            key={veh.id}
                            type="button"
                            onClick={() => {
                              setSelectedVehicle(veh);
                              setRecipientInput(`Unidad ${veh.plate}`);
                              setShowRecipientDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors focus:bg-slate-50 outline-none flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-900">Unidad {veh.plate}</div>
                              {veh.brandModel && (
                                <div className="text-[10px] text-slate-500 mt-0.5">{veh.brandModel}</div>
                              )}
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              Vehículo
                            </span>
                          </button>
                        ))}

                        {recipientInput.trim() && !selectedVehicle && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowRecipientDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 bg-blue-50/70 hover:bg-blue-100/70 border-t border-slate-100 transition-colors flex items-center justify-between gap-2 outline-none"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-blue-900 truncate flex items-center gap-1.5">
                                <FiTruck className="text-blue-600 shrink-0" />
                                <span>Usar &quot;{recipientInput.trim()}&quot;</span>
                              </div>
                              <div className="text-[10px] text-blue-700 font-medium">
                                Registrar como unidad personalizada
                              </div>
                            </div>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. RESPONSABLE DE ENTREGA Y PROYECTO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Responsable de la entrega del traspaso */}
            <div className="relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                2. Responsable que entrega traspaso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <FiUser />
                </div>
                <input
                  type="text"
                  value={assignedBy}
                  onChange={(e) => {
                    setAssignedBy(e.target.value);
                    setShowAssignedByDropdown(true);
                  }}
                  onFocus={() => setShowAssignedByDropdown(true)}
                  placeholder="Quien realiza o autoriza la entrega..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                {assignedBy && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignedBy('');
                      setShowAssignedByDropdown(true);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <FiX className="text-sm" />
                  </button>
                )}
              </div>

              {showAssignedByDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowAssignedByDropdown(false)}
                  />
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar min-w-[240px]">
                    {filteredEmployeesForAssignedBy.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setAssignedBy(emp.name);
                          setShowAssignedByDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors focus:bg-slate-50 outline-none"
                      >
                        <div className="font-bold text-xs text-slate-900">{emp.name}</div>
                        {emp.position && (
                          <div className="text-[10px] text-slate-500">{emp.position}</div>
                        )}
                      </button>
                    ))}
                    {assignedBy.trim() && (
                      <button
                        type="button"
                        onClick={() => setShowAssignedByDropdown(false)}
                        className="w-full text-left px-4 py-2 bg-blue-50/80 hover:bg-blue-100 border-t border-slate-100 transition-colors text-xs font-bold text-blue-900"
                      >
                        Usar &quot;{assignedBy.trim()}&quot;
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Fecha de Traspaso */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                Fecha del Traspaso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <FiCalendar />
                </div>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Proyecto Asociado */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
              Proyecto / Destino de la Operación (Opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FiFolder />
              </div>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
              >
                <option value="">Mantener proyecto actual o sin proyecto específico</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.projectNumber ? `[${proj.projectNumber}] ` : ''}{proj.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
              Observaciones o Motivo del Traspaso
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Razón del cambio de custodia, condición al momento de la entrega o notas adicionales..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* 3. FOTOS DE EVIDENCIA DE TRASPASO */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <FiCamera className="text-blue-600 text-sm" /> 3. Fotos de Evidencia del Traspaso (Opcional)
              </label>
              <span className="text-[10px] font-bold text-slate-400">
                {evidencePhotos.length} / 5 fotos
              </span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl bg-white hover:bg-blue-50/50 cursor-pointer transition-all text-xs font-bold text-slate-600 hover:text-blue-700 shadow-xs">
                <FiCamera className="text-base text-blue-600" />
                <span>Adjuntar Fotografías del Traspaso</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={evidencePhotos.length >= 5}
                />
              </label>

              {evidencePhotos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-1">
                  {evidencePhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-900 shadow-2xs"
                    >
                      <img
                        src={photo}
                        alt={`Evidencia traspaso ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-full hover:bg-red-700 transition-colors shadow-sm"
                        title="Eliminar foto"
                      >
                        <FiX className="text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-2xl border border-red-200 flex items-center gap-2.5 animate-in shake duration-200">
              <FiAlertCircle className="flex-none text-base text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Botones */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <ActionButton
              type="button"
              variant="neutral"
              label="Cancelar"
              onClick={onClose}
              disabled={loading}
              className="!py-2.5 !text-xs !font-bold !rounded-xl"
            />
            <ActionButton
              type="submit"
              variant="primary"
              label={loading ? 'Procesando...' : 'Confirmar Transferencia'}
              icon={<FiRepeat />}
              disabled={loading}
              className="!py-2.5 !text-xs !font-bold !bg-blue-600 hover:!bg-blue-700 !rounded-xl"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
