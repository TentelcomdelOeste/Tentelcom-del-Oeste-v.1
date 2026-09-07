import React, { useState, useEffect } from 'react';
import { 
  FiArrowLeft, 
  FiChevronDown, 
  FiBriefcase, 
  FiUsers, 
  FiTruck, 
  FiCalendar, 
  FiTag,
  FiMapPin,
  FiClock,
  FiEye
} from 'react-icons/fi';
import { User } from '../../utils/types';
import { Project } from './types';
import { 
  subscribeToProjectJobs, 
  subscribeToProjectMaterialRequests, 
  subscribeToProjectVehicleRequests,
  subscribeToProjectVehicleConsumptions,
  subscribeToProjectInvoices, 
  subscribeToProjectPurchases 
} from './services/projectRelationsService';
import { ActionButton } from '../../design-system';
import { ViewJobModal } from '../job_scheduling/ViewJobModal';
import { Trabajo } from '../job_scheduling/types';
import { ExpedienteResumenTab } from './components/expediente/ExpedienteResumenTab';
import { ExpedientePersonalTab } from './components/expediente/ExpedientePersonalTab';
import { ExpedienteUnidadesTab } from './components/expediente/ExpedienteUnidadesTab';
import { ExpedienteMaterialesTab } from './components/expediente/ExpedienteMaterialesTab';
import { ExpedienteBodegasTab } from './components/expediente/ExpedienteBodegasTab';
import { ExpedienteConsumosTab } from './components/expediente/ExpedienteConsumosTab';
import { ExpedienteFacturacionTab } from './components/expediente/ExpedienteFacturacionTab';
import { ExpedienteComprasTab } from './components/expediente/ExpedienteComprasTab';
import { ExpedienteGenericTab } from './components/expediente/ExpedienteGenericTab';

interface ProjectExpedienteProps {
  project: Project;
  onBack: () => void;
  currentUser: User;
}

type TabKey = 'resumen' | 'trabajos' | 'personal' | 'unidades' | 'materiales' | 'bodegas' | 'consumos' | 'facturacion' | 'compras' | 'documentacion' | 'cierre';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'trabajos', label: 'Trabajos' },
  { id: 'personal', label: 'Personal' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'materiales', label: 'Materiales' },
  { id: 'bodegas', label: 'Bodegas Vehiculares' },
  { id: 'consumos', label: 'Consumos' },
  { id: 'facturacion', label: 'Facturación' },
  { id: 'compras', label: 'Compras / Gastos' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'cierre', label: 'Cierre' }
];

const formatJobDate = (dateVal: any): string => {
  if (!dateVal) return '';
  try {
    let d: Date;
    if (typeof dateVal?.toDate === 'function') {
      d = dateVal.toDate();
    } else if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else if (dateVal?.seconds) {
      d = new Date(dateVal.seconds * 1000);
    } else if (typeof dateVal === 'string') {
      d = new Date(dateVal);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
};

const formatJobDateRange = (startDateVal: any, endDateVal?: any): string => {
  const startStr = formatJobDate(startDateVal);
  const endStr = formatJobDate(endDateVal);
  if (!startStr) return 'Sin fecha registrada';
  if (!endStr || startStr === endStr) return startStr;
  return `${startStr} — ${endStr}`;
};

const getJobStatusVariant = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'completado' || s === 'finalizado') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'en_proceso' || s === 'en proceso' || s === 'ejecucion') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (s === 'cancelado') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (s === 'en_espera' || s === 'espera') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const getJobStatusLabel = (status?: string) => {
  if (!status) return 'PROGRAMADO';
  const s = status.toLowerCase();
  if (s === 'en_proceso') return 'EN PROCESO';
  if (s === 'en_espera') return 'EN ESPERA';
  return status.toUpperCase().replace(/_/g, ' ');
};

type DatasetKey = 'jobs' | 'materialRequests' | 'vehicleRequests' | 'vehicleConsumptions' | 'invoices' | 'purchases';

const getRequiredDatasetsForTab = (tab: TabKey): DatasetKey[] => {
  switch (tab) {
    case 'resumen':
      return ['jobs', 'materialRequests', 'invoices', 'purchases'];
    case 'trabajos':
    case 'personal':
    case 'unidades':
      return ['jobs'];
    case 'materiales':
      return ['materialRequests'];
    case 'bodegas':
      return ['vehicleRequests'];
    case 'consumos':
      return ['vehicleConsumptions'];
    case 'facturacion':
      return ['invoices'];
    case 'compras':
      return ['purchases'];
    case 'documentacion':
    case 'cierre':
    default:
      return [];
  }
};

const ProjectExpediente: React.FC<ProjectExpedienteProps> = ({ project, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  
  // Relations State
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [vehicleRequests, setVehicleRequests] = useState<any[]>([]);
  const [vehicleConsumptions, setVehicleConsumptions] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selectedJobForModal, setSelectedJobForModal] = useState<Trabajo | null>(null);

  // Set of datasets that have completed their initial snapshot fetch
  const [loadedDatasets, setLoadedDatasets] = useState<Set<DatasetKey>>(new Set());
  
  // Ref to hold active unsubscribe functions per dataset key
  const activeSubsRef = React.useRef<Map<DatasetKey, () => void>>(new Map());
  const lastProjectIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const currentProjectId = project.id;
    const currentProjectNumber = project.projectNumber;

    // Reset subscriptions and state if project changed
    if (lastProjectIdRef.current && lastProjectIdRef.current !== currentProjectId) {
      activeSubsRef.current.forEach((unsub) => unsub());
      activeSubsRef.current.clear();
      setLoadedDatasets(new Set());
      setJobs([]);
      setInvoices([]);
      setMaterialRequests([]);
      setVehicleRequests([]);
      setVehicleConsumptions([]);
      setPurchases([]);
    }
    lastProjectIdRef.current = currentProjectId;

    const requiredKeys = getRequiredDatasetsForTab(activeTab);
    const requiredSet = new Set(requiredKeys);

    // 1. Unsubscribe subscriptions no longer required by the active tab
    activeSubsRef.current.forEach((unsub, key) => {
      if (!requiredSet.has(key)) {
        unsub();
        activeSubsRef.current.delete(key);
      }
    });

    // 2. Subscribe required datasets that are not yet active
    requiredKeys.forEach((key) => {
      if (activeSubsRef.current.has(key)) {
        return; // Already actively subscribed
      }

      const markLoaded = () => {
        setLoadedDatasets((prev) => {
          if (prev.has(key)) return prev;
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      };

      let unsub: () => void = () => {};

      switch (key) {
        case 'jobs':
          unsub = subscribeToProjectJobs(
            currentProjectId,
            (data) => {
              setJobs(data);
              markLoaded();
            },
            currentProjectNumber
          );
          break;

        case 'materialRequests':
          unsub = subscribeToProjectMaterialRequests(
            currentProjectId,
            (data) => {
              setMaterialRequests(data);
              markLoaded();
            },
            currentProjectNumber
          );
          break;

        case 'vehicleRequests':
          unsub = subscribeToProjectVehicleRequests(
            currentProjectId,
            (data) => {
              setVehicleRequests(data);
              markLoaded();
            },
            currentProjectNumber
          );
          break;

        case 'vehicleConsumptions':
          unsub = subscribeToProjectVehicleConsumptions(
            currentProjectId,
            (data) => {
              setVehicleConsumptions(data);
              markLoaded();
            },
            currentProjectNumber
          );
          break;

        case 'invoices':
          unsub = subscribeToProjectInvoices(
            currentProjectId,
            (data) => {
              setInvoices(data);
              markLoaded();
            }
          );
          break;

        case 'purchases':
          unsub = subscribeToProjectPurchases(
            currentProjectId,
            (data) => {
              setPurchases(data);
              markLoaded();
            }
          );
          break;
      }

      activeSubsRef.current.set(key, unsub);
    });

  }, [project.id, project.projectNumber, activeTab]);

  // Cleanup all listeners on component unmount
  useEffect(() => {
    const subsMap = activeSubsRef.current;
    return () => {
      subsMap.forEach((unsub) => unsub());
      subsMap.clear();
    };
  }, []);

  // Determine if the current tab is waiting for initial dataset loading
  const requiredForActiveTab = getRequiredDatasetsForTab(activeTab);
  const loading = requiredForActiveTab.length > 0 && requiredForActiveTab.some((key) => !loadedDatasets.has(key));

  // Extract unique elements
  const uniquePersonnel = Array.from(new Set(jobs.flatMap(j => j.empleados || []).map((e: any) => e.empleadoId)));
  const uniqueVehicles = Array.from(new Set(jobs.map(j => j.unidadId).filter(Boolean)));

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString.substring(0, 10);
      return d.toLocaleDateString('es-CR', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden md:h-auto md:overflow-visible md:bg-transparent">
      {/* 1. Header Móvil (oculto en desktop) */}
      <div className="md:hidden flex-none bg-white border-b border-slate-200 px-3.5 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {project.projectNumber || project.id}
                </span>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                  {project.status}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-slate-800 leading-tight">{project.name}</h2>
            </div>
          </div>
        </div>

        {/* Mobile Controls Row: [ ← VOLVER ] + [ Section Selector ▼ ] */}
        <div className="flex items-center gap-2 mt-2.5">
          <ActionButton 
            variant="secondary"
            onClick={onBack}
            label="VOLVER"
            icon={<FiArrowLeft />}
            className="!w-auto flex-none shrink-0"
          />
          <div className="relative flex-1 min-w-0">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabKey)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-indigo-100 truncate"
            >
              {TABS.map(tab => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </select>
            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs" />
          </div>
        </div>
      </div>

      {/* 2. Área con scroll vertical para todo el contenido */}
      <div className="flex-1 overflow-auto p-4 md:p-0 md:overflow-visible md:flex-none">
        {/* Contenedor Unificado: En móvil transparente/sin marco; en escritorio caja unificada blanca con sombra suave y ancho completo */}
        <div className="md:bg-white md:border md:border-slate-200 md:rounded-xl md:shadow-sm md:overflow-hidden w-full">
          
          {/* Header Escritorio (integrado en la parte superior del contenedor) */}
          <div className="hidden md:block p-6 pb-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <ActionButton 
                  variant="secondary"
                  onClick={onBack}
                  label="VOLVER"
                  icon={<FiArrowLeft />}
                  className="shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      {project.projectNumber || project.id}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase">
                      {project.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-800 leading-tight">{project.name}</h2>
                </div>
              </div>
            </div>
          </div>

          {/* Selector de Sección Escritorio (integrado bajo el header dentro del mismo contenedor) */}
          <div className="hidden md:flex border-t border-slate-200/80 bg-slate-50/50 px-6 py-3.5 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Sección:</span>
              <div className="relative min-w-[280px]">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as TabKey)}
                  className="w-full appearance-none bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all shadow-xs"
                >
                  {TABS.map(tab => (
                    <option key={tab.id} value={tab.id}>{tab.label}</option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">
                Mostrando: <strong className="text-indigo-600 font-bold">{TABS.find(t => t.id === activeTab)?.label}</strong>
              </span>
            </div>
          </div>

          {/* Contenedor de contenido activo: en escritorio con divisor y padding integrado */}
          <div className="md:border-t md:border-slate-200/80 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'resumen' && (
              <ExpedienteResumenTab
                project={project}
                jobs={jobs}
                uniquePersonnel={uniquePersonnel}
                uniqueVehicles={uniqueVehicles}
                materialRequests={materialRequests}
                invoices={invoices}
                purchases={purchases}
              />
            )}
            
            {activeTab === 'trabajos' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:bg-transparent md:p-0 md:border-0 md:shadow-none md:rounded-none">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Trabajos Relacionados</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Trabajos programados asociados a este proyecto desde el módulo de Programación de Trabajos.
                    </p>
                  </div>
                  <span className="text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg">
                    {jobs.length} {jobs.length === 1 ? 'trabajo programado' : 'trabajos programados'}
                  </span>
                </div>

                {jobs.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FiBriefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 font-bold text-sm">No hay trabajos asociados a este proyecto.</p>
                    <p className="text-slate-400 text-xs mt-1">
                      Al crear un trabajo en &quot;Programación de Trabajos&quot; asignado a este proyecto, aparecerá reflejado aquí.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Vista Escritorio: Tabla con mismo patrón visual que Gestión de Proyectos / Cotizaciones */}
                    <div className="hidden md:block overflow-x-auto">
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-w-[1050px]">
                        {/* Header */}
                        <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[110px] shrink-0">
                            <span className="w-full text-center truncate">N° / OT</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[200px]">
                            <span className="w-full text-left truncate">Trabajo</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[130px] shrink-0">
                            <span className="w-full text-left truncate">Tipo</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[130px] shrink-0">
                            <span className="w-full text-center truncate">Fecha</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[110px] shrink-0">
                            <span className="w-full text-center truncate">Horario</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[150px] shrink-0">
                            <span className="w-full text-left truncate">Ubicación</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[100px] shrink-0">
                            <span className="w-full text-center truncate">Cuadrilla</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[90px] shrink-0">
                            <span className="w-full text-center truncate">Unidad</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                            <span className="w-full text-center truncate">Estado</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[110px] shrink-0">
                            <span className="w-full text-center truncate">Acciones</span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                          {jobs.map((job: any, index: number) => {
                            const isEven = index % 2 === 0;
                            const displayTitle = job.titulo || job.tipo_trabajo || 'TRABAJO SIN TÍTULO';
                            const displayType = job.tipo_trabajo || 'No especificado';
                            const displayDesc = job.descripcion;
                            const displayDates = formatJobDateRange(job.fecha_inicio || job.fechaInicio, job.fecha_fin || job.fechaFin);
                            const displayLocation = job.ubicacion;
                            const displayStatus = job.estado || 'programado';
                            const cuadrillaCount = Array.isArray(job.cuadrilla) ? job.cuadrilla.length : 0;
                            const unidadesCount = Array.isArray(job.unidades) ? job.unidades.length : 0;

                            return (
                              <div
                                key={job.id}
                                onClick={() => setSelectedJobForModal(job)}
                                className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group cursor-pointer ${
                                  isEven ? 'bg-white' : 'bg-slate-50/40'
                                }`}
                                style={{ minHeight: '60px' }}
                              >
                                {/* N° / OT */}
                                <div className="text-xs font-bold text-center justify-center flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[110px] shrink-0">
                                  {job.otCode ? (
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wider truncate">
                                      {job.otCode}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[10px] text-slate-400 font-bold truncate">
                                      #{job.id.substring(0, 8)}
                                    </span>
                                  )}
                                </div>

                                {/* Trabajo */}
                                <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[200px]">
                                  <div className="flex flex-col truncate w-full">
                                    <span className="font-black text-blue-900 text-xs truncate" title={displayTitle}>
                                      {displayTitle}
                                    </span>
                                    {displayDesc && (
                                      <span className="text-[10px] text-slate-500 font-normal truncate opacity-80" title={displayDesc}>
                                        {displayDesc}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Tipo */}
                                <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[130px] shrink-0">
                                  <span className="font-bold text-slate-700 text-xs truncate" title={displayType}>
                                    {displayType}
                                  </span>
                                </div>

                                {/* Fecha */}
                                <div className="text-xs font-bold text-center justify-center font-mono text-slate-600 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[130px] shrink-0">
                                  <span className="font-mono font-bold text-slate-600 text-[11px] whitespace-nowrap" title={displayDates}>
                                    {displayDates}
                                  </span>
                                </div>

                                {/* Horario */}
                                <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[110px] shrink-0">
                                  <span className="font-medium text-slate-600 text-[11px] whitespace-nowrap">
                                    {job.hora_inicio ? `${job.hora_inicio} - ${job.hora_fin || 'N/D'}` : '—'}
                                  </span>
                                </div>

                                {/* Ubicación */}
                                <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[150px] shrink-0">
                                  <span className="font-medium text-slate-700 text-xs truncate" title={displayLocation || 'Sin ubicación'}>
                                    {displayLocation || '—'}
                                  </span>
                                </div>

                                {/* Cuadrilla */}
                                <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[100px] shrink-0">
                                  {cuadrillaCount > 0 ? (
                                    <span className="flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                      <FiUsers className="text-slate-500 text-xs" />
                                      {cuadrillaCount}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs font-normal">—</span>
                                  )}
                                </div>

                                {/* Unidad */}
                                <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[90px] shrink-0">
                                  {unidadesCount > 0 ? (
                                    <span className="flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                      <FiTruck className="text-slate-500 text-xs" />
                                      {unidadesCount}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs font-normal">—</span>
                                  )}
                                </div>

                                {/* Estado */}
                                <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0">
                                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-wider truncate ${getJobStatusVariant(displayStatus)}`}>
                                    {getJobStatusLabel(displayStatus)}
                                  </span>
                                </div>

                                {/* Acciones */}
                                <div 
                                  className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[110px] shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ActionButton
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setSelectedJobForModal(job)}
                                    label="Visualizar"
                                    icon={<FiEye />}
                                    className="h-7 px-2.5 text-[10px] font-bold"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Vista Móvil: Tarjetas Móviles Intactas */}
                    <div className="md:hidden grid grid-cols-1 gap-4">
                      {jobs.map((job: any) => {
                        const displayTitle = job.titulo || job.tipo_trabajo || 'TRABAJO SIN TÍTULO';
                        const displayType = job.tipo_trabajo || 'No especificado';
                        const displayDesc = job.descripcion;
                        const displayDates = formatJobDateRange(job.fecha_inicio || job.fechaInicio, job.fecha_fin || job.fechaFin);
                        const displayLocation = job.ubicacion;
                        const displayStatus = job.estado || 'programado';
                        const cuadrillaCount = Array.isArray(job.cuadrilla) ? job.cuadrilla.length : 0;
                        const unidadesCount = Array.isArray(job.unidades) ? job.unidades.length : 0;

                        return (
                          <div 
                            key={job.id} 
                            className="bg-slate-50/90 hover:bg-slate-50 border border-slate-200 rounded-xl p-5 transition-all duration-200 shadow-sm hover:shadow flex flex-col justify-between gap-4"
                          >
                            {/* Header de la tarjeta */}
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {job.otCode && (
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wider block w-fit mb-1">
                                      {job.otCode}
                                    </span>
                                  )}
                                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2">
                                    {displayTitle}
                                  </h4>
                                </div>
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-wider shrink-0 ${getJobStatusVariant(displayStatus)}`}>
                                  {getJobStatusLabel(displayStatus)}
                                </span>
                              </div>

                              {/* Tipo de Trabajo Badge / Tag */}
                              <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50/80 border border-indigo-100/80 px-2.5 py-1 rounded-lg w-fit">
                                <FiTag className="text-indigo-500 text-xs shrink-0" />
                                <span className="truncate">Tipo: {displayType}</span>
                              </div>

                              {/* Descripción (si existe) */}
                              {displayDesc && (
                                <p className="text-xs text-slate-600 line-clamp-2 pt-1 font-normal leading-relaxed">
                                  {displayDesc}
                                </p>
                              )}
                            </div>

                            {/* Información Secundaria (Fechas, Ubicación, Recursos) */}
                            <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                              <div className="flex items-center gap-2">
                                <FiCalendar className="text-slate-400 shrink-0 text-xs" />
                                <span className="font-bold text-slate-500">Fecha:</span>
                                <span className="font-semibold text-slate-800 truncate">{displayDates}</span>
                                {job.hora_inicio && (
                                  <span className="text-[11px] text-slate-500 font-medium ml-auto">
                                    <FiClock className="inline mr-1 text-slate-400" />
                                    {job.hora_inicio} - {job.hora_fin || 'N/D'}
                                  </span>
                                )}
                              </div>

                              {displayLocation && (
                                <div className="flex items-center gap-2">
                                  <FiMapPin className="text-slate-400 shrink-0 text-xs" />
                                  <span className="font-bold text-slate-500">Ubicación:</span>
                                  <span className="font-medium text-slate-800 truncate">{displayLocation}</span>
                                </div>
                              )}

                              {(cuadrillaCount > 0 || unidadesCount > 0) && (
                                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                                  {cuadrillaCount > 0 && (
                                    <span className="flex items-center gap-1 font-semibold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded">
                                      <FiUsers className="text-slate-500 text-xs" />
                                      {cuadrillaCount} {cuadrillaCount === 1 ? 'persona' : 'personas'}
                                    </span>
                                  )}
                                  {unidadesCount > 0 && (
                                    <span className="flex items-center gap-1 font-semibold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded">
                                      <FiTruck className="text-slate-500 text-xs" />
                                      {unidadesCount} {unidadesCount === 1 ? 'unidad' : 'unidades'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Footer con Botón y Referencia Técnica Secundarios */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={`ID técnico: ${job.id}`}>
                                Ref: #{job.id.substring(0, 8)}...
                              </span>
                              <ActionButton
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedJobForModal(job)}
                                className="flex items-center gap-1.5 text-xs font-bold"
                              >
                                <FiEye className="text-slate-500" />
                                Ver trabajo
                              </ActionButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Modal para ver detalle completo del trabajo */}
                {selectedJobForModal && (
                  <ViewJobModal
                    isOpen={!!selectedJobForModal}
                    onClose={() => setSelectedJobForModal(null)}
                    trabajo={selectedJobForModal}
                  />
                )}
              </div>
            )}

            {activeTab === 'personal' && (
              <ExpedientePersonalTab jobs={jobs} />
            )}

            {activeTab === 'unidades' && (
              <ExpedienteUnidadesTab jobs={jobs} />
            )}

            {activeTab === 'materiales' && (
              <ExpedienteMaterialesTab materialRequests={materialRequests} />
            )}

            {activeTab === 'bodegas' && (
              <ExpedienteBodegasTab vehicleRequests={vehicleRequests} formatDate={formatDate} />
            )}

            {activeTab === 'consumos' && (
              <ExpedienteConsumosTab vehicleConsumptions={vehicleConsumptions} project={project} formatDate={formatDate} />
            )}

            {activeTab === 'facturacion' && (
              <ExpedienteFacturacionTab invoices={invoices} />
            )}

            {activeTab === 'compras' && (
              <ExpedienteComprasTab purchases={purchases} />
            )}

            {(activeTab === 'documentacion' || activeTab === 'cierre') && (
              <ExpedienteGenericTab
                tabKey={activeTab}
                tabLabel={TABS.find(t => t.id === activeTab)?.label || 'Sección'}
                project={project}
              />
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectExpediente;

