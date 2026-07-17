import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAllQuotes } from '../../hooks/useQuotes';
import { useInventory } from '../../hooks/useInventory';
import { useMaterialReports } from '../../hooks/useMaterialReports';
import { ModuleHeader } from '../../components/ui/ModuleHeader';
import { useConfirm, IconButton, ActionButton, Select, DataTable, ACTION_ICONS } from '../../design-system';
import { FiUser, FiTool, FiAlertCircle, FiCheckCircle, FiPlus, FiTrash2, FiCalendar, FiSearch } from "react-icons/fi";
import { exportToExcel } from '../../utils/exportUtils';
import { generateMaterialReportPDF } from '../../utils/materialReportPdf';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
// import CreatableSelect from "react-select/creatable";

// Tipos locales para el manejo del formulario visual
interface MaterialRow {
  id: number;
  material: string;
  quantity: number | '';
  unit: string;
  observation: string;
  fromInventory: boolean;
  inventoryItemId?: string;
  inputValue?: string;
  isCustom?: boolean;
}

const UNITS = ['Metro', 'Unidad', 'Caja', 'Rollo', 'Kit', 'Bolsa', 'Juego'];

import { sanitizeObject } from '../../utils/security';
import { getYearFromDateString } from '../../utils/dateUtils';

import { MaterialSelectorModal } from './MaterialSelectorModal';

interface ReporteMaterialesProyectoProps {
  selectedId?: string;
  initialProjectName?: string;
  initialJobId?: string;
  initialOTCode?: string;
  onClearSelectedId?: () => void;
  onEditReport?: (id: string) => void;
  onBack?: (target?: string) => void;
}

const ReporteMaterialesProyecto: React.FC<ReporteMaterialesProyectoProps> = ({ 
  selectedId, 
  initialProjectName,
  initialJobId,
  initialOTCode,
  onClearSelectedId, 
  onEditReport,
  onBack
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const from = location.state?.from;
  const returnTo = location.state?.returnTo;
  const source = location.state?.source || null;

  const { currentUser } = useAuth();
  const confirm = useConfirm();
  const { allQuotes } = useAllQuotes(currentUser);
  const { items: inventoryItems } = useInventory(currentUser);
  const { reports, saveReport, deleteReport } = useMaterialReports(currentUser);
  
  // Estado del Formulario
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<{ 
    project: string; 
    projectCode?: string;
    referenceId: string | null; 
    type: string;
    jobId?: string;
    otCode?: string;
  }>({
    project: '',
    referenceId: null,
    type: 'manual'
  });
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<MaterialRow[]>([]);

  // Estados para el nuevo sistema de agregado de materiales (estilo Solicitudes)
  const [itemSearch, setItemSearch] = useState('');
  const [tempItemId, setTempItemId] = useState('');
  const [tempQty, setTempQty] = useState('');
  const [tempUnit, setTempUnit] = useState('Unidad');
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const qtyInputRef = React.useRef<HTMLInputElement>(null);

  const selectedInventoryItem = React.useMemo(() => 
    inventoryItems.find(i => i.id === tempItemId), 
  [inventoryItems, tempItemId]);

  const handleAddItem = () => {
    if (!itemSearch.trim()) return;

    const qty = parseFloat(tempQty as string);
    if (isNaN(qty) || qty <= 0) {
      setError("Ingrese una cantidad válida.");
      return;
    }

    const newRow: MaterialRow = {
      id: Date.now(),
      material: selectedInventoryItem ? selectedInventoryItem.description : itemSearch,
      quantity: qty,
      unit: selectedInventoryItem ? selectedInventoryItem.unit : tempUnit,
      observation: '',
      fromInventory: !!selectedInventoryItem,
      inventoryItemId: selectedInventoryItem?.id,
      isCustom: !selectedInventoryItem
    };

    setRows([...rows, newRow]);
    
    // Reset temp fields
    setItemSearch('');
    setTempItemId('');
    setTempQty('');
    setTempUnit('Unidad');
    setShowItemSuggestions(false);
    setError(null);
  };

  useEffect(() => {
    const fetchDispatches = async () => {
      try {
        const [dispatchesSnap, jobsSnap] = await Promise.all([
          getDocs(collection(db, 'material_dispatches')),
          getDocs(collection(db, 'trabajos'))
        ]);
        
        const dispatchesData = dispatchesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        const jobsData = jobsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        setDispatches(dispatchesData);
        setJobs(jobsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchDispatches();
  }, []);

  useEffect(() => {
    if (selectedId && reports.length > 0) {
      const report = reports.find(r => r.id === selectedId);
      if (report) {
        setEditingId(selectedId);
        setProjectData({
          project: report.project?.name || '',
          referenceId: report.project?.id === 'manual' ? null : report.project?.id,
          type: report.project?.id === 'manual' ? 'manual' : 'quote',
          jobId: report.jobId,
          otCode: report.otCode
        });
        setReportDate(report.date);
        setRows(report.items.map((item: any, index: number) => ({
          id: Date.now() + index,
          material: typeof item.material === 'object' ? item.material.name : item.material,
          quantity: item.quantity,
          unit: item.unit,
          observation: item.observation || '',
          fromInventory: item.fromInventory || false,
          inventoryItemId: item.inventoryItemId,
          inputValue: '',
          isCustom: typeof item.material === 'object' ? !!item.material.isCustom : false
        })));
        setActiveTab('form');
      }
    }
  }, [selectedId, reports]);

  const handleRemoveRow = (id: number) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const updateRow = (id: number, changes: Partial<MaterialRow>) => {
    setRows(prev => prev.map(row =>
      row.id === id ? { ...row, ...changes } : row
    ));
  };

  const handleCancel = async () => {
    const approved = await confirm({
        title: editingId ? "Cancelar Edición" : "Limpiar Formulario",
        description: editingId 
          ? "¿Está seguro de cancelar la edición? Se perderán los cambios realizados."
          : "¿Está seguro de limpiar el formulario? Se perderán los datos ingresados.",
        confirmLabel: editingId ? "Cancelar Edición" : "Limpiar",
        variant: "warning"
    });

    if (approved) {
      if (source === 'job_scheduling') {
        onBack?.('job_scheduling');
      } else if (from === 'jobScheduling' && returnTo) {
        navigate(returnTo);
      } else {
        setEditingId(null);
        if (onClearSelectedId) onClearSelectedId();
        setProjectData({ project: '', referenceId: null, type: 'manual' });
        setReportDate(new Date().toISOString().split('T')[0]);
        setRows([]);
        setItemSearch('');
        setTempItemId('');
        setTempQty('');
      }
    }
  };

  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    
    if (!projectData.project) {
        setError("Debe seleccionar o escribir un proyecto.");
        return;
    }
    
    if (rows.some(r => !r.material || !r.quantity || Number(r.quantity) <= 0)) {
        setError("Todos los materiales deben tener descripción y una cantidad mayor a 0.");
        return;
    }

    const isFromJob = source === 'job_scheduling';

    const reportDataToSave = sanitizeObject({
        referenceId: editingId ? reports.find(r => r.id === editingId)?.referenceId || `REP-${Date.now()}` : `REP-${Date.now()}`,
        type: 'Reporte de Materiales',
        project: {
            id: projectData.referenceId || 'manual',
            name: projectData.project,
            code: projectData.projectCode || ''
        },
        jobId: projectData.jobId || null,
        otCode: projectData.otCode || null,
        date: reportDate,
        user: currentUser?.email || 'Usuario Desconocido',
        isFromJob: isFromJob, 
        createdAt: editingId ? reports.find(r => r.id === editingId)?.createdAt : new Date().toISOString(),
        items: rows.map(r => {
            const invItem = r.inventoryItemId ? inventoryItems.find(i => i.id === r.inventoryItemId) : null;
            
            if (r.fromInventory && invItem) {
              return {
                material: {
                  id: invItem.id,
                  code: invItem.code,
                  name: invItem.description,
                  isCustom: false
                },
                quantity: Number(r.quantity),
                unit: r.unit,
                observation: r.observation,
                fromInventory: true,
                inventoryItemId: r.inventoryItemId
              };
            } else {
              return {
                material: {
                  name: r.material,
                  isCustom: true
                },
                quantity: Number(r.quantity),
                unit: r.unit,
                observation: r.observation,
                fromInventory: false
              };
            }
        })
    });

    // Validaciones obligatorias según prompt
    if (!reportDataToSave.project || typeof reportDataToSave.project !== 'object') {
      setError("Estructura de proyecto inválida.");
      return;
    }
    if (!reportDataToSave.project.name) {
      setError("El nombre del proyecto es obligatorio.");
      return;
    }
    if (!Array.isArray(reportDataToSave.items) || reportDataToSave.items.length === 0) {
      setError("El reporte debe tener al menos un material.");
      return;
    }
    
    // Validación de materiales individuales
    for (const item of reportDataToSave.items) {
      if (!item.material?.name) {
        setError("Uno o más materiales no tienen nombre válido.");
        return;
      }
    }

    try {
        await saveReport(reportDataToSave, editingId || undefined);
        setSuccess(editingId ? "Reporte actualizado exitosamente." : "Reporte guardado exitosamente.");
        
        setTimeout(() => {
            setSuccess(null);
            if (source === 'job_scheduling') {
                onBack?.('job_scheduling');
            } else if (from === 'jobScheduling' && returnTo) {
                navigate(returnTo);
            } else {
                setEditingId(null);
                if (onClearSelectedId) onClearSelectedId();
                setProjectData({ project: '', referenceId: null, type: 'manual' });
                setRows([]);
                setItemSearch('');
                setTempItemId('');
                setTempQty('');
                if (onBack) onBack();
            }
        }, 1500);
    } catch (err) {
        setError(editingId ? "Error al actualizar el reporte." : "Error al guardar el reporte.");
    }
  };

  useEffect(() => {
    if (initialProjectName && !selectedId) {
      setProjectData(prev => ({
        ...prev,
        project: initialProjectName,
        type: initialJobId ? 'job' : 'manual',
        jobId: initialJobId,
        otCode: initialOTCode
      }));
    }
  }, [initialProjectName, initialJobId, initialOTCode, selectedId]);

  const handleExportPDF = (report: any) => {
    generateMaterialReportPDF(report, currentUser, inventoryItems);
  };

  const handleExportExcel = (report: any) => {
    // Create inventory map for quick lookup
    const inventoryMap = (inventoryItems || []).reduce((acc: any, item: any) => {
      acc[item.id] = item;
      return acc;
    }, {});

    const data = (report.items || []).map((item: any) => {
      const invItem = item.inventoryItemId ? inventoryMap[item.inventoryItemId] : null;
      const code = invItem ? invItem.code : "TEMP";

      return {
        'ID Referencia': report.referenceId,
        'Proyecto': report.project?.name || '',
        'Fecha': report.date,
        'Usuario': report.user,
        'Código Material': code,
        'Descripción': item.material,
        'Cantidad': item.quantity,
        'Unidad': item.unit,
        'Observaciones': item.observation || ''
      };
    });
    
    exportToExcel(data, `Reporte_Materiales_${report.referenceId}`);
  };

  const handleDeleteReport = async (report: any) => {
    try {
      // 🔴 1. VALIDACIÓN BÁSICA (jobId en el reporte)
      if (report.jobId) {
        const forceDelete = await confirm({
          title: "Reporte ligado a un trabajo",
          description: "Este reporte está ligado a un trabajo programado. Eliminarlo podría afectar la integridad del sistema. ¿Desea continuar?",
          confirmLabel: "Eliminar reporte",
          cancelLabel: "Cancelar",
          variant: "danger"
        });

        if (!forceDelete) return;
      }

      // 🔍 2. CONFIRMACIÓN ESTÁNDAR
      const isConfirmed = await confirm({
        title: "¿Eliminar Reporte?",
        description: `¿Está seguro de que desea eliminar el reporte ${report.referenceId}? Esta acción no se puede deshacer.`,
        confirmLabel: "Eliminar",
        variant: "danger"
      });

      if (isConfirmed) {
        await deleteReport(report.id);
        setSuccess("Reporte eliminado correctamente.");
        setTimeout(() => setSuccess(null), 3000);
      }

    } catch (error) {
      console.error("Error eliminando reporte:", error);
      setError("Error al intentar eliminar el reporte.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleEdit = (report: any) => {
    if (onEditReport) {
      onEditReport(report.id);
    } else {
      setEditingId(report.id);
      setProjectData({
        project: report.project?.name || '',
        referenceId: report.project?.id === 'manual' ? null : report.project?.id,
        type: report.project?.id === 'manual' ? 'manual' : 'quote'
      });
      setReportDate(report.date);
      setRows(report.items.map((item: any, index: number) => ({
        id: Date.now() + index,
        material: item.material,
        quantity: item.quantity,
        unit: item.unit,
        observation: item.observation || '',
        fromInventory: item.fromInventory || false,
        inventoryItemId: item.inventoryItemId,
        inputValue: ''
      })));
      setActiveTab('form');
    }
  };

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <MaterialSelectorModal
        show={showSelectorModal}
        onClose={() => setShowSelectorModal(false)}
        onSelect={(item) => {
          setTempItemId(item.id);
          setItemSearch(item.description);
          setTempUnit(item.unit);
          setTimeout(() => qtyInputRef.current?.focus(), 100);
        }}
        inventoryItems={inventoryItems}
      />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 animate-in slide-in-from-top-4 fade-in duration-300">
        
        <ModuleHeader 
            title={editingId ? "Editar Reporte de Materiales" : "Reporte de Materiales por Proyecto"} 
            subtitle={editingId ? `Editando reporte ${reports.find(r => r.id === editingId)?.referenceId}` : "Registro de consumo diario de materiales en sitio."}
        />

        {projectData.otCode || projectData.project ? (
          <div className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
            {projectData.otCode && <p className="text-xs font-black text-blue-900 uppercase">OT: {projectData.otCode}</p>}
            <p className="text-xs font-bold text-blue-700 uppercase">Proyecto: {projectData.project}</p>
          </div>
        ) : null}

        <div className="flex gap-4 mb-6 border-b border-slate-200">
            <ActionButton 
                onClick={() => setActiveTab('form')}
                label="Nuevo Reporte"
                variant="secondary"
                className={`pb-2 text-xs font-black uppercase tracking-widest transition-colors rounded-none border-t-0 border-l-0 border-r-0 shadow-none min-h-0 bg-transparent ${activeTab === 'form' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'}`}
            />
            <ActionButton 
                onClick={() => setActiveTab('history')}
                label="Historial"
                variant="secondary"
                className={`pb-2 text-xs font-black uppercase tracking-widest transition-colors rounded-none border-t-0 border-l-0 border-r-0 shadow-none min-h-0 bg-transparent ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'}`}
            />
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3">
                <FiAlertCircle className="text-red-500 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-red-800">Error de Validación</h4>
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                </div>
            </div>
        )}
        {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl flex items-start gap-3">
                <FiCheckCircle className="text-green-500 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-green-800">Éxito</h4>
                    <p className="text-xs text-green-600 mt-1">{success}</p>
                </div>
            </div>
        )}

        {activeTab === 'form' ? (
            <>
                <div className="flex justify-end mb-6">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Actual</p>
                        <p className="text-sm font-black text-slate-600">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                {/* FORMULARIO: DATOS GENERALES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                  
                  {/* Selector de Proyecto */}
                  <div className="md:col-span-1">
                    <Select
                      label="Proyecto"
                      options={[
                        { label: '-- Escribir o Seleccionar --', value: '' },
                        ...allQuotes.filter(q => q.estado === 'Aprobada').map(q => ({
                          label: `COT-${q.id} – ${q.empresa}`,
                          value: q.id.toString(),
                          type: "quote"
                        })),
                        ...dispatches.map(d => ({
                          label: `SOL-${d.requestNumber} – ${d.origin} – ${d.fdh || ''} – ${d.torre || ''}`,
                          value: d.dispatchId || d.id,
                          type: "dispatch"
                        })),
                        ...jobs.map(j => ({
                          label: `${j.otCode || 'S/OT'} – ${j.tipo_trabajo}`,
                          value: j.id,
                          type: "job",
                          otCode: j.otCode
                        }))
                      ]}
                      value={
                        projectData.project
                          ? { label: projectData.project, value: projectData.referenceId || "manual" }
                          : null
                      }
                      onChange={(val) => {
                        const allOptions = [
                          ...allQuotes.filter(q => q.estado === 'Aprobada').map(q => ({
                            label: `COT-${q.id} – ${q.empresa}`,
                            value: q.id.toString(),
                            type: "quote",
                            projectCode: `#${q.id.toString().padStart(3, '0')}-${getYearFromDateString(q.fecha)}`
                          })),
                          ...dispatches.map(d => ({
                            label: `SOL-${d.requestNumber} – ${d.origin} – ${d.fdh || ''} – ${d.torre || ''}`,
                            value: d.dispatchId || d.id,
                            type: "dispatch"
                          })),
                          ...jobs.map(j => ({
                            label: `${j.otCode || 'S/OT'} – ${j.tipo_trabajo}`,
                            value: j.id,
                            type: "job",
                            otCode: j.otCode
                          }))
                        ];
                        const selectedOption = allOptions.find(opt => opt.value === val);
                        if (selectedOption) {
                          setProjectData({
                            project: selectedOption.label,
                            projectCode: (selectedOption as any).projectCode,
                            referenceId: selectedOption.value,
                            type: selectedOption.type as any,
                            jobId: selectedOption.type === 'job' ? selectedOption.value : undefined,
                            otCode: (selectedOption as any).otCode
                          });
                        }
                      }}
                      onInput={(e: React.FormEvent<HTMLInputElement>) => {
                        setProjectData({
                          project: e.currentTarget.value,
                          referenceId: null,
                          type: 'manual'
                        });
                      }}
                      required
                    />
                  </div>

                  {/* Fecha del Reporte */}
                  <div className="group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                      Fecha <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs md:hidden" />
                      <input 
                        type="date" 
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        className="w-full pl-10 md:pl-4 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>

                  {/* Responsable (Readonly) */}
                  <div className="group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                      Usuario
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"  />
                      <input 
                        type="text" 
                        value={currentUser?.email || 'Usuario Desconocido'}
                        readOnly
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-500 outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN DE AGREGADO DE MATERIALES (ESTILO SOLICITUDES) */}
                <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200 mb-8 shadow-sm">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FiPlus className="text-blue-500" /> Agregar Material al Reporte
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Buscador de Material */}
                    <div className="md:col-span-6 relative" onClick={e => e.stopPropagation()}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                        Material / Descripción
                      </label>
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                        <input 
                          type="text" 
                          value={itemSearch}
                          readOnly
                          onClick={() => setShowSelectorModal(true)}
                          placeholder="Haga clic para buscar en inventario..."
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Cantidad */}
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1 text-center">
                        Cantidad
                      </label>
                      <input 
                        type="number" 
                        ref={qtyInputRef}
                        value={tempQty}
                        onChange={e => setTempQty(e.target.value)}
                        placeholder="0"
                        className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-black text-center text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>

                    {/* Unidad */}
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                        Unidad
                      </label>
                      <select 
                        value={tempUnit}
                        onChange={e => setTempUnit(e.target.value)}
                        disabled={!!tempItemId}
                        className={`w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all ${tempItemId ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>

                    {/* Botón Agregar */}
                    <div className="md:col-span-2">
                      <ActionButton 
                        onClick={handleAddItem}
                        label="AGREGAR"
                        variant="primary"
                        className="w-full py-2.5 rounded-xl font-black text-[10px] tracking-widest shadow-md shadow-blue-100 active:scale-95 transition-all min-h-0"
                      />
                    </div>
                  </div>
                </div>

                {/* LISTA DE MATERIALES (ESTILO SOLICITUDES) */}
                <div className="mb-8" onClick={() => setShowItemSuggestions(false)}>
                  <div className="flex justify-between items-center mb-4 px-1">
                    <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight flex items-center gap-2">
                      <FiTool className="text-slate-400" /> Materiales en el Reporte ({rows.length})
                    </h4>
                  </div>

                  <div className="flex flex-col gap-2">
                    {rows.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <FiTool className="mx-auto text-slate-300 text-3xl mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay materiales agregados aún</p>
                        <p className="text-[10px] text-slate-400 mt-1">Use el buscador superior para añadir materiales.</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Header de la lista (Desktop) */}
                        <div className="hidden md:flex items-center px-6 py-3 bg-slate-50 border-b border-slate-100">
                          <span className="flex-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción del Material</span>
                          <span className="w-24 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Cantidad</span>
                          <span className="w-32 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidad</span>
                          <span className="w-12"></span>
                        </div>

                        {/* Filas de la lista */}
                        <div className="divide-y divide-slate-50">
                          {rows.map((row) => (
                            <div key={row.id} className="flex flex-col md:flex-row md:items-center px-4 md:px-6 py-3 hover:bg-slate-50/50 transition-colors group">
                              {/* Nombre / Descripción */}
                              <div className="flex-1 min-w-0 mb-2 md:mb-0">
                                <div className="flex items-center gap-2">
                                  {row.fromInventory && (
                                    <span className="hidden md:inline-block text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">INV</span>
                                  )}
                                  <p className="text-xs font-bold text-slate-700 truncate uppercase tracking-tight">
                                    {row.material}
                                  </p>
                                </div>
                                {row.fromInventory && row.inventoryItemId && (
                                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {inventoryItems.find(i => i.id === row.inventoryItemId)?.code}
                                  </p>
                                )}
                              </div>

                              {/* Controles de edición */}
                              <div className="flex items-center justify-between md:justify-end gap-4">
                                {/* Cantidad */}
                                <div className="flex items-center gap-2">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 uppercase">Cant:</span>
                                  <input 
                                    type="number" 
                                    value={row.quantity}
                                    onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                                    className="w-16 md:w-20 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-black text-center text-blue-600 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                  />
                                </div>

                                {/* Unidad */}
                                <div className="flex items-center gap-2">
                                  <span className="md:hidden text-[9px] font-bold text-slate-400 uppercase">Unid:</span>
                                  <select 
                                    value={row.unit}
                                    onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                                    disabled={row.fromInventory}
                                    className={`w-24 md:w-32 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 transition-all ${row.fromInventory ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                </div>

                                {/* Eliminar */}
                                <IconButton 
                                  onClick={() => handleRemoveRow(row.id)}
                                  icon={<FiTrash2 size={16} />}
                                  variant="ghost"
                                  className="text-slate-300 hover:text-red-500 transition-colors p-2"
                                  title="Eliminar Material"
                                />
                              </div>
                              
                              {/* Observaciones (Opcional) */}
                              <div className="mt-2 md:hidden">
                                <input 
                                  type="text" 
                                  value={row.observation}
                                  onChange={(e) => updateRow(row.id, { observation: e.target.value })}
                                  placeholder="Agregar nota..."
                                  className="w-full bg-transparent border-b border-slate-100 py-1 text-[10px] text-slate-400 italic outline-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                  <div className="flex flex-col md:flex-row justify-end gap-3 mt-8">
                    {editingId && (
                      <ActionButton 
                        onClick={() => handleExportPDF(reports.find(r => r.id === editingId))}
                        label="Descargar PDF"
                        variant="danger"
                        icon={<ACTION_ICONS.pdf />}
                        className="w-full md:w-auto px-6 py-4 md:py-3 font-black uppercase text-xs rounded-xl shadow-lg shadow-red-100 transition-all active:scale-95 min-h-[44px]"
                      />
                    )}
                    <ActionButton 
                      onClick={handleCancel}
                      label={editingId ? "Cancelar" : "Limpiar"}
                      variant="secondary"
                      className="w-full md:w-auto px-6 py-4 md:py-3 text-slate-500 font-bold uppercase text-xs hover:bg-slate-100 rounded-xl transition-colors border-none shadow-none min-h-[44px]"
                    />
                    <ActionButton 
                      onClick={handleSave}
                      label={editingId ? "Actualizar Reporte" : "Guardar Reporte"}
                      variant="primary"
                      className="w-full md:w-auto px-8 py-4 md:py-3 font-black uppercase text-xs rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95 min-h-[44px]"
                    />
                  </div>
            </>
        ) : (
            <div className="p-4">
                <DataTable 
                    columns={[
                      {
                        accessorKey: 'referenceId',
                        header: 'Referencia'
                      },
                      {
                        accessorKey: 'project',
                        header: 'Proyecto',
                        render: (row) => row.project?.name || '---'
                      },
                      {
                        accessorKey: 'date',
                        header: 'Fecha'
                      },
                      {
                        accessorKey: 'user',
                        header: 'Usuario'
                      },
                      {
                        accessorKey: 'actions',
                        header: 'Acciones',
                        align: 'center',
                        render: (row) => (
                          <div className="flex justify-center items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              icon={<ACTION_ICONS.edit />}
                              variant="ghost"
                              onClick={() => handleEdit(row)}
                              title="Editar Reporte"
                            />
                            <IconButton
                              icon={<ACTION_ICONS.pdf />}
                              variant="danger"
                              onClick={() => handleExportPDF(row)}
                              title="Exportar PDF"
                            />
                            <IconButton
                              icon={<ACTION_ICONS.excel />}
                              variant="success"
                              onClick={() => handleExportExcel(row)}
                              title="Exportar Excel"
                            />
                            <IconButton
                              icon={<FiTrash2 />}
                              variant="ghost"
                              onClick={() => handleDeleteReport(row)}
                              title="Eliminar Reporte"
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            />
                          </div>
                        )
                      }
                    ]}
                    data={reports.filter(r => r.isFromJob !== true)}
                />
            </div>
        )}
      </div>
    </div>
  );
};

export default ReporteMaterialesProyecto;