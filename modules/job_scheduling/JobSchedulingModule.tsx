import React, { useState, useEffect, useMemo } from 'react';

import { Calendar, dateFnsLocalizer, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears, endOfWeek, isSameDay, isWithinInterval, isSameMonth } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { es } from 'date-fns/locale';
import { getTrabajos, migrateExistingTrabajos, renameExistingOTCodes } from './jobService';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { VehicleLog } from '@/types/vehicle.types';
import { getJobTypes, JobType } from './jobTypeService';
import { Trabajo } from './types';
import { JobForm } from './JobForm';
import { MobileJobView } from './MobileJobView';
import { OperativoView } from './OperativoView';
import OperationalLogView from './OperationalLogView';
import { Modal, ActionButton, IconButton, ACTION_ICONS, SearchInput } from '@/design-system';
import { ModulePage } from '@/components/ui/ModulePage';
import { ModuleToolbar } from '@/components/ui/ModuleToolbar';
import { FiAlertCircle, FiPlus, FiChevronLeft, FiChevronRight, FiActivity } from 'react-icons/fi';
import { exportToPDF, exportToExcel } from '@/utils/exportUtils';

const locales = {
  'es': es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const STATUS_PRIORITY: Record<string, number> = {
  'en_espera': 1,
  'programado': 2,
  'en_proceso': 3,
  'finalizado': 4,
};

const sortTrabajos = (a: Trabajo, b: Trabajo) => {
  const priorityA = STATUS_PRIORITY[a.estado] || 5;
  const priorityB = STATUS_PRIORITY[b.estado] || 5;
  
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  
  const timeA = a.hora_inicio || '00:00';
  const timeB = b.hora_inicio || '00:00';
  return timeA.localeCompare(timeB);
};

const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const VEHICLE_MAP: Record<string, string> = {
  'U1': 'NISSAN PATHFINDER 532995',
  'U2': 'KIA BONGO 420101',
  'U3': 'MERCEDES BENZ MBZ-375',
  'U4': 'KIA MORNING AAE-026',
  'U5': 'NISSAN UD 1400 CL 254711',
  'U6': 'HYUNDAI HD CL 255409',
  'U7': 'VOLKSWAGEN CROSS BVQ-651',
  'U8': 'SUZUKI GRAN VITARA 578994'
};

const MobileWeekView = ({ events, onSelect, onSetActiveModule, currentDate, agendaViewMode, isLoading }: {
  events: any[];
  onSelect: (t: Trabajo) => void;
  onSetActiveModule?: (moduleData: string | { 
    module: string; 
    selectedId?: string; 
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
  }) => void;
  currentDate: Date;
  agendaViewMode: string;
  isLoading: boolean;
}) => {
  
  const dailyPreparedJobs = useMemo(() => {
    return events.filter(e => {
      const eDate = new Date(e.start);

      if (agendaViewMode === 'day') {
        return isSameDay(eDate, currentDate);
      }

      if (agendaViewMode === 'week') {
        return isWithinInterval(eDate, {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        });
      }

      if (agendaViewMode === 'month') {
        return isSameMonth(eDate, currentDate);
      }

      return true;
    }).map(e => ({
      ...e.resource,
      // Ensure the ID is unique for the list to avoid React key warnings if multiple instances of same job appear
      uniqueId: e.id 
    }));
  }, [events, currentDate, agendaViewMode]);

  return (
    <div className="flex flex-col">
      <div className="p-4">
        <h2 className="text-sm font-black text-blue-950 uppercase mb-4">
          {agendaViewMode === 'day' 
            ? format(currentDate, "EEEE d 'de' MMMM", { locale: es })
            : agendaViewMode === 'week'
              ? `Semana del ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d 'de' MMMM", { locale: es })}`
              : format(currentDate, "MMMM yyyy", { locale: es })
          }
        </h2>
        <MobileJobView 
          trabajos={dailyPreparedJobs}
          onSelect={onSelect}
          onSetActiveModule={onSetActiveModule}
          isAgendaView={true}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

interface JobSchedulingModuleProps {
  onSetActiveModule?: (moduleData: string | { 
    module: string; 
    selectedId?: string; 
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
    state?: any;
  }) => void;
  currentUser?: any;
  selectedId?: string;
  selectedKey?: string;
  onClearSelectedId?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  'programado': { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' }, // blue-100, blue-700, blue-200
  'en_proceso': { bg: '#d1fae5', text: '#047857', border: '#a7f3d0' }, // emerald-100, emerald-700, emerald-200
  'finalizado': { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' }, // slate-100, slate-700, slate-200
  'cancelado': { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },  // red-100, red-700, red-200
  'reprogramado': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' } // amber-100, amber-700, amber-200
};

export const JobSchedulingModule: React.FC<JobSchedulingModuleProps> = ({
  onSetActiveModule,
  currentUser,
  selectedId,
  selectedKey: _selectedKey,
  onClearSelectedId
}) => {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [vehicleLogs, setVehicleLogs] = useState<VehicleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const autoOpenedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (selectedId && trabajos.length > 0) {
      if (autoOpenedIdRef.current !== selectedId) {
        const target = trabajos.find(t => 
          t.id === selectedId || 
          t.id?.toString() === selectedId || 
          (t as any).otCode === selectedId || 
          (t as any).ot_code === selectedId
        );
        if (target) {
          autoOpenedIdRef.current = selectedId;
          setSelectedTrabajo(target);
          setFormMode('edit');
          setIsModalOpen(true);
        }
      }
    }
  }, [selectedId, trabajos]);
  
  const [activeTimelineJobId, setActiveTimelineJobId] = useState<string | null>(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  useEffect(() => {
    console.log("[TRACE][JobSchedulingModule] RENDER");
  });
  const [mountedJobId, setMountedJobId] = useState<string | null>(null);
  useEffect(() => {
    let frameId: number;
    if (activeTimelineJobId) {
      frameId = requestAnimationFrame(() => {
        setMountedJobId(activeTimelineJobId);
      });
    } else {
      setMountedJobId(null);
    }
    return () => cancelAnimationFrame(frameId);
  }, [activeTimelineJobId]);
  const [activeTimelineCollection, setActiveTimelineCollection] = useState<string>('trabajos');
  const [activeTimelineState, setActiveTimelineState] = useState<any>(null);

  const handleSetActiveModule = (moduleData: string | { 
    module: string; 
    selectedId?: string; 
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
    state?: any;
  }) => {
    const isLg = window.innerWidth >= 768; // tablet/desktop threshold
    const moduleObj = typeof moduleData === 'string' ? { module: moduleData } : moduleData;
    
    if (isLg && moduleObj?.module === 'operational_log' && moduleObj?.selectedId) {
      setActiveTimelineJobId(moduleObj.selectedId);
      setActiveTimelineCollection(moduleObj.state?.parentCollection || 'trabajos');
      setActiveTimelineState(moduleObj.state || null);
    } else {
      onSetActiveModule?.(moduleData);
    }
  };
  
  const waitingJobs = useMemo(() => trabajos.filter(t => t.estado === 'en_espera'), [trabajos]);
  const [selectedTrabajo, setSelectedTrabajo] = useState<Trabajo | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'continuacion'>('create');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [continuarJob, setContinuarJob] = useState<Trabajo | null>(null);

  const handleOpenContinuar = (t: Trabajo) => {
    setContinuarJob(t);
    setSelectedTrabajo(null);
    setFormMode('continuacion');
    setDefaultStart(new Date(new Date().setHours(0,0,0,0)));
    setDefaultEnd(new Date(new Date().setHours(0,0,0,0)));
    setIsModalOpen(true);
  };
  const [dayDetailJobs, setDayDetailJobs] = useState<Trabajo[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [defaultEnd, setDefaultEnd] = useState<Date | undefined>();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'waiting' | 'operativo'>(window.innerWidth < 768 ? 'operativo' : 'calendar');
  const [agendaViewMode] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = normalizeText(searchTerm.trim());
    
    // 1. Encuentra los trabajos que coinciden directamente 
    const matchingJobs = trabajos.filter(t => {
      // Obtener bitácoras relacionadas
      const linkedLogIds = new Set<string>([
        ...(t.bitacoraIds || []),
        ...(t.bitacorasRelacionadas?.map(b => b.bitacoraId) || [])
      ].filter(Boolean));

      const linkedLogs = vehicleLogs.filter(log => linkedLogIds.has(log.id));
      const logTexts = linkedLogs.flatMap(log => [
        log.observaciones,
        log.conductorName,
        log.unidadName,
        log.unidad
      ]);

      const searchStrings = [
        t.otCode,
        t.titulo,
        t.tipo_trabajo,
        t.descripcion,
        t.estado,
        t.observaciones,
        ...(t.cuadrilla || []),
        ...(t.unidades || []).map(u => VEHICLE_MAP[u] || u),
        ...logTexts
      ].filter(Boolean).map(s => normalizeText(s as string));

      return searchStrings.some(s => s.includes(term));
    });

    // 2. Extraer rootIds correspondientes
    const rootIds = new Set<string>();
    matchingJobs.forEach(t => {
      rootIds.add(t.parentId || t.id);
    });

    // 3. Obtener todos los familiares (mismo rootId)
    const group = trabajos.filter(t => rootIds.has(t.id) || (t.parentId && rootIds.has(t.parentId)));

    return group.sort(sortTrabajos);
  }, [searchTerm, trabajos, vehicleLogs]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = getTrabajos((data) => {
      setTrabajos(data);
      setIsLoading(false);
    });
    
    getJobTypes().then(setJobTypes);

    const unsubLogs = onSnapshot(collection(db, "bitacora_vehiculos"), (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as VehicleLog);
      setVehicleLogs(logsData);
    }, (error) => {
      console.warn("Could not load vehicle logs inside search module:", error);
    });
    
    // Maintenance tasks - deferred to avoid blocking mount
    setTimeout(() => {
      renameExistingOTCodes().catch(console.error);
      migrateExistingTrabajos().catch(console.error);
    }, 1000);
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      unsubLogs();
    };
  }, []);

  const safeSetCurrentDate = (date: Date) => {
    if (date instanceof Date && !isNaN(date.getTime())) {
      setCurrentDate(date);
    } else {
      console.error('Intento de establecer fecha inválida:', date);
      setCurrentDate(new Date());
    }
  };

  useEffect(() => {
    if (!(currentDate instanceof Date) || isNaN(currentDate.getTime())) {
      setCurrentDate(new Date());
    }
  }, [currentDate]);

  const handleAgendaPrev = () => {
    const date = new Date(currentDate);
    if (isNaN(date.getTime())) return;
    switch (agendaViewMode) {
      case 'day': safeSetCurrentDate(subDays(date, 1)); break;
      case 'week': safeSetCurrentDate(subWeeks(date, 1)); break;
      case 'month': safeSetCurrentDate(subMonths(date, 1)); break;
      case 'year': safeSetCurrentDate(subYears(date, 1)); break;
    }
  };

  const handleAgendaNext = () => {
    const date = new Date(currentDate);
    if (isNaN(date.getTime())) return;
    switch (agendaViewMode) {
      case 'day': safeSetCurrentDate(addDays(date, 1)); break;
      case 'week': safeSetCurrentDate(addWeeks(date, 1)); break;
      case 'month': safeSetCurrentDate(addMonths(date, 1)); break;
      case 'year': safeSetCurrentDate(addYears(date, 1)); break;
    }
  };

  const handleAgendaToday = () => {
    safeSetCurrentDate(new Date());
  };

  const agendaHeaderText = useMemo(() => {
    const date = new Date(currentDate);
    if (isNaN(date.getTime())) return '';
    switch (agendaViewMode) {
      case 'day':
        return format(date, "dd MMMM yyyy", { locale: es });
      case 'week': {
        const start = startOfWeek(date, { weekStartsOn: 1 });
        const end = endOfWeek(date, { weekStartsOn: 1 });
        if (start.getMonth() === end.getMonth()) {
          return `${format(start, "dd")} - ${format(end, "dd MMMM", { locale: es })}`;
        }
        return `${format(start, "dd MMM", { locale: es })} - ${format(end, "dd MMM", { locale: es })}`;
      }
      case 'month':
        return format(date, "MMMM yyyy", { locale: es });
      case 'year':
        return format(date, "yyyy", { locale: es });
      default:
        return '';
    }
  }, [agendaViewMode, currentDate]);

  const events = useMemo(() => {
    // Helper para normalización nominal local
    const getNominalDay = (date: any): Date => {
      if (!date) return new Date();
      const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    return trabajos.flatMap((t) => {
      const days = t.dias_detalle || [];
      if (days.length === 0) {
        return [{
          id: t.id,
          title: t.titulo || t.tipo_trabajo,
          start: getNominalDay(t.fecha_inicio),
          end: getNominalDay(t.fecha_fin || t.fecha_inicio),
          resource: { ...t, estado: t.estado },
        }];
      }

      return days.map((dia, index) => {
        const diaDate = getNominalDay(dia.fecha);
        
        return {
          id: `${t.id}-${index}`,
          title: t.titulo || t.tipo_trabajo,
          start: diaDate,
          end: diaDate,
          resource: { 
            ...t, 
            estado: dia.estado || t.estado,
            cuadrilla: dia.recursos_ajustados && dia.cuadrilla_diaria ? dia.cuadrilla_diaria : t.cuadrilla,
            unidades: dia.recursos_ajustados && dia.unidades_diarias ? dia.unidades_diarias : t.unidades,
            hora_inicio: dia.hora_inicio || t.hora_inicio,
            hora_fin: dia.hora_fin || t.hora_fin,
          },
        };
      });
    });
  }, [trabajos]);

  const uniqueJobTypes = useMemo(() => {
    const types = new Set<string>();
    trabajos.forEach(t => {
      if (t.tipo_trabajo && t.tipo_trabajo !== 'Otro') {
        types.add(t.tipo_trabajo);
      }
    });
    jobTypes.forEach(jt => types.add(jt.name));
    return Array.from(types);
  }, [trabajos, jobTypes]);

  const handleAddJob = () => {
    setSelectedTrabajo(null);
    setContinuarJob(null);
    setFormMode('create');
    setDefaultStart(new Date(new Date().setHours(0,0,0,0)));
    setDefaultEnd(new Date(new Date().setHours(0,0,0,0)));
    setIsModalOpen(true);
  };

  const calcularHoras = (t: Trabajo) => {
    const [h1, m1] = t.hora_inicio.split(':').map(Number);
    const [h2, m2] = t.hora_fin.split(':').map(Number);
    const start = new Date(0, 0, 0, h1, m1);
    const end = new Date(0, 0, 0, h2, m2);
    const diffInMs = end.getTime() - start.getTime();
    return Math.max(0, diffInMs / (1000 * 60 * 60));
  };

  const getExpandedJobsData = () => {
    const list: any[] = [];
    
    let sourceData = trabajos; // Default to all jobs, will filter inside
    if (searchTerm.trim().length > 0) {
      sourceData = searchResults;
    } else if (viewMode === 'waiting') {
      sourceData = waitingJobs;
    }

    sourceData.forEach((job) => {
      // Find days in this job that fall into the current view
      const jobDays = job.dias_detalle || [];
      jobDays.forEach((dia) => {
        const diaDate = new Date(dia.fecha);
        let include = false;
        
        if (searchTerm.trim().length > 0 || viewMode === 'waiting') {
          include = true;
        } else if (agendaViewMode === 'day') {
          include = isSameDay(diaDate, currentDate);
        } else if (agendaViewMode === 'week') {
          include = isWithinInterval(diaDate, {
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 })
          });
        } else if (agendaViewMode === 'month') {
          include = isSameMonth(diaDate, currentDate);
        } else {
          include = true;
        }

        if (include) {
          const cuadrilla = dia.recursos_ajustados && dia.cuadrilla_diaria ? dia.cuadrilla_diaria : job.cuadrilla;
          const unidades = dia.recursos_ajustados && dia.unidades_diarias ? dia.unidades_diarias : job.unidades;
          const [h1, m1] = (dia.hora_inicio || job.hora_inicio).split(':').map(Number);
          const [h2, m2] = (dia.hora_fin || job.hora_fin).split(':').map(Number);
          const start = new Date(0, 0, 0, h1, m1);
          const end = new Date(0, 0, 0, h2, m2);
          const horas = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

          list.push({
            id: `${job.id}-${format(diaDate, 'yyyyMMdd')}`,
            Número: job.otCode || '',
            Proyecto: job.tipo_trabajo,
            Cliente: 'N/D',
            Fecha: new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(diaDate),
            'Hora Inicio': dia.hora_inicio || job.hora_inicio,
            'Hora Fin': dia.hora_fin || job.hora_fin,
            'Horas Totales': horas, // stored as number to sum up later
            Personal: cuadrilla.length > 0 ? cuadrilla.join(', ') : 'Sin personal asignado',
            Unidad: unidades.length > 0 ? unidades.join(', ') : 'Sin unidad asignada',
            Ubicación: job.ubicacion,
            Estado: dia.estado || job.estado,
            Descripción: job.descripcion || 'Sin descripción',
            Observaciones: job.observaciones || ''
          });
        }
      });

      // Fallback if no dias_detalle exist for older jobs
      if (jobDays.length === 0) {
        let includeFallback = false;
        const jobDate = new Date(job.fecha_inicio);
        
        if (searchTerm.trim().length > 0 || viewMode === 'waiting') {
          includeFallback = true;
        } else if (agendaViewMode === 'day') {
          includeFallback = isSameDay(jobDate, currentDate);
        } else if (agendaViewMode === 'week') {
          includeFallback = isWithinInterval(jobDate, {
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 })
          });
        } else if (agendaViewMode === 'month') {
          includeFallback = isSameMonth(jobDate, currentDate);
        } else {
          includeFallback = true;
        }

        if (includeFallback) {
          list.push({
            id: job.id,
            Número: job.otCode || '',
            Proyecto: job.tipo_trabajo,
            Cliente: 'N/D',
            Fecha: new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(job.fecha_inicio)),
            'Hora Inicio': job.hora_inicio,
            'Hora Fin': job.hora_fin,
            'Horas Totales': calcularHoras(job),
            Personal: job.cuadrilla.length > 0 ? job.cuadrilla.join(', ') : 'Sin personal asignado',
            Unidad: job.unidades.length > 0 ? job.unidades.join(', ') : 'Sin unidad asignada',
            Ubicación: job.ubicacion,
            Estado: job.estado,
            Descripción: job.descripcion || 'Sin descripción',
            Observaciones: job.observaciones || ''
          });
        }
      }
    });

    return list.sort((a, b) => {
        const dateA = a.Fecha.split('/').reverse().join('');
        const dateB = b.Fecha.split('/').reverse().join('');
        return dateA.localeCompare(dateB) || a['Hora Inicio'].localeCompare(b['Hora Inicio']);
    });
  };

  const getExportData = () => {
    const list = getExpandedJobsData();
    const totalHours = list.reduce((acc, row) => acc + (row['Horas Totales'] as number), 0);
    const dataFormatted = list.map(row => ({
      ...row,
      'Horas Totales': (row['Horas Totales'] as number).toFixed(2)
    }));
    return {
      data: dataFormatted,
      totalHours,
      fileName: `Agenda_${format(currentDate, 'yyyy-MM-dd')}`
    };
  };

  const handleExportPDF = () => {
    console.log('[TRACE][PDF] BUTTON_CLICK');
    const exportData = getExportData();
    if (!exportData || !exportData.data || exportData.data.length === 0) {
      console.warn('[TRACE][PDF] NO_DATA_TO_EXPORT', exportData);
      return;
    }
    const { data, totalHours, fileName } = exportData;
    console.log('[TRACE][PDF] GET_EXPORT_DATA_FINISHED', { dataCount: data.length, fileName });
    
    console.log('[TRACE][PDF] EXPORT_PDF_START');
    console.log('[TRACE][PDF] DOWNLOAD_START');
    
    // Removing await to make it fully synchronous just like InventoryModule
    exportToPDF({
      title: 'Reporte de Agenda',
      subtitle: `Día: ${format(currentDate, 'dd/MM/yyyy')} | Resumen operativo diario de personal, unidades y ejecución de trabajos programados`,
      fileName,
      orientation: 'l',
      columns: [
        { header: 'OT', dataKey: 'Número' },
        { header: 'Proyecto', dataKey: 'Proyecto' },
        { header: 'Fecha', dataKey: 'Fecha' },
        { header: 'H. Inicio', dataKey: 'Hora Inicio' },
        { header: 'H. Fin', dataKey: 'Hora Fin' },
        { header: 'Horas', dataKey: 'Horas Totales' },
        { header: 'Personal', dataKey: 'Personal' },
        { header: 'Unidad', dataKey: 'Unidad' },
        { header: 'Descripción', dataKey: 'Descripción' }
      ],
      data,
      totals: { 'Total General de Horas': totalHours.toFixed(2) }
    });
    console.log('[TRACE][PDF] EXPORT_PDF_FINISHED');
    console.log('[TRACE][PDF] DOWNLOAD_FINISHED');
  };

  const handleExportExcel = () => {
    const { data, totalHours, fileName } = getExportData();
    exportToExcel([...data, { 'Número': 'TOTAL GENERAL', 'Horas Totales': totalHours.toFixed(2) }], fileName, 'Agenda');
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const jobsOnDay = events
      .filter(e => isSameDay(new Date(e.start), slotInfo.start))
      .map(e => e.resource)
      .sort(sortTrabajos);
    setDayDetailJobs(jobsOnDay);
    safeSetCurrentDate(slotInfo.start as Date);
    setIsDayDetailOpen(true);
  };

  const handleSelectEvent = (event: any) => {
    const eventDate = new Date(event.start);
    const jobsOnDay = events
      .filter(e => isSameDay(new Date(e.start), eventDate))
      .map(e => e.resource)
      .sort(sortTrabajos);
    setDayDetailJobs(jobsOnDay);
    safeSetCurrentDate(eventDate);
    setIsDayDetailOpen(true);
  };

  const eventPropGetter = (event: any) => {
    const estado = event.resource.estado;
    const config = STATUS_COLORS[estado as keyof typeof STATUS_COLORS] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    return {
      style: {
        backgroundColor: config.bg,
        opacity: 1,
        borderRadius: '6px',
        border: `1px solid ${config.border}`,
        color: config.text,
        fontSize: '0.75rem',
        fontWeight: 'bold',
        padding: '2px 4px',
      }
    };
  };

  const getJobsCountOnDay = (date: Date) => {
    return events.filter(e => isSameDay(new Date(e.start), date)).length;
  };

  const CustomHeader = ({ date }: any) => {
    const dayNameShort = format(date, 'EEEEE', { locale: es });
    const dayNameFull = format(date, 'EEEE', { locale: es });
    
    return (
      <div className="flex flex-col items-center py-0 px-1 min-w-0">
        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest truncate w-full text-center">
          <span className="md:hidden">{dayNameShort}</span>
          <span className="hidden md:inline">{dayNameFull}</span>
        </span>
      </div>
    );
  };

  const handleDrillDown = (date: Date) => {
    const jobsOnDay = events
      .filter(e => isSameDay(new Date(e.start), date))
      .map(e => e.resource)
      .sort(sortTrabajos);
    setDayDetailJobs(jobsOnDay);
    safeSetCurrentDate(date);
    setIsDayDetailOpen(true);
  };

  const renderCalendar = () => (
    <div className="flex flex-col w-full">
      <style>{`
        /* Global */
        .rbc-calendar {
          width: 100% !important;
          max-width: 100% !important;
          font-size: 11px;
        }
        .rbc-calendar-container {
          width: 100%;
          overflow-x: hidden;
        }

        /* Vista MES */
        .rbc-month-view .rbc-date-cell {
          padding: 0px 4px !important;
          z-index: 2;
          position: relative;
        }
        .rbc-month-view .rbc-date-cell > * {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          width: 100% !important;
        }
        .rbc-month-view .rbc-day-bg {
          position: relative;
        }
        .rbc-month-view .rbc-row-content {
          margin-top: 0 !important;
        }
        .rbc-month-view .rbc-event {
          font-size: 9px !important;
          padding: 1px 4px !important;
          margin-top: 1px !important;
          border-radius: 3px !important;
          z-index: 1 !important;
          height: 16px !important;
          min-height: 16px !important;
          line-height: 14px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          display: block !important;
        }
        .rbc-month-view .rbc-event-content {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-size: 9px !important;
          line-height: 14px !important;
        }
        .rbc-month-view .rbc-row-segment {
          min-height: 16px;
        }
        .rbc-month-row {
          min-height: 94px;
          border-bottom: 1px solid #e2e8f0; /* Separador sutil */
        }
        .rbc-show-more {
          font-size: 9px !important;
          font-weight: 800 !important;
          color: #475569 !important; /* slate-600 */
          text-transform: uppercase !important;
          padding-left: 45%; /* Centered display for more label */
          padding-left: 4px !important;
          margin-top: 0px !important;
          background: transparent !important;
        }

        /* Vista SEMANA */
        .rbc-time-view {
          display: flex;
          flex-direction: column;
        }
        .rbc-time-header {
          position: relative;
          z-index: 3;
          background: white;
          min-height: 22px;
          height: auto;
          overflow: visible;
        }
        .rbc-header {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 0px 0 !important;
          line-height: normal;
          overflow: visible;
        }
        .rbc-header span {
          font-size: 12px;
          line-height: 1.1;
        }
        .rbc-time-content {
          position: relative;
          z-index: 1;
          overflow: visible !important;
        }
        .rbc-day-slot {
          position: relative;
        }
        .rbc-event {
          z-index: 2;
        }

        /* Estilo para destacar el MES/Toolbar */
        .rbc-toolbar-label {
          font-weight: 900 !important;
          color: #172554 !important; /* blue-950 */
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 16px !important;
          padding: 0 15px !important;
        }

        .rbc-toolbar button {
          font-weight: 700 !important;
          text-transform: uppercase;
          font-size: 10px !important;
        }
      `}</style>
      <div className="rbc-calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          date={currentDate instanceof Date ? currentDate : new Date()}
          onNavigate={(date) => safeSetCurrentDate(date)}
          startAccessor="start"
          endAccessor="end"
          selectable
          popup={true}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onDrillDown={handleDrillDown}
          eventPropGetter={eventPropGetter}
          style={{ height: 'auto', minHeight: isMobile ? '380px' : '480px' }}
          defaultView="month"
          views={['month', 'week', 'day', 'agenda']}
          step={60}
          timeslots={1}
          dayLayoutAlgorithm="no-overlap"
          culture="es"
          messages={{
            next: "Sig.",
            previous: "Ant.",
            today: "Hoy",
            month: "Mes",
            week: "Sem.",
            day: "Día",
            agenda: "Agenda",
            showMore: (total) => `+${total} más`,
          }}
          components={{
            header: CustomHeader,
            month: {
              dateHeader: ({ label, date, onDrillDown }: any) => {
                const count = getJobsCountOnDay(date);
                const isSaturated = count >= 3;
                const formattedLabel = label.padStart(2, '0');
                return (
                  <div className="flex items-center justify-between w-full select-none px-1 py-0">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDrillDown) {
                          onDrillDown(date);
                        } else {
                          handleDrillDown(date);
                        }
                      }}
                      className="text-xs md:text-sm font-black text-slate-800 hover:text-blue-700 font-sans tracking-tight"
                    >
                      {formattedLabel}
                    </button>
                    {count > 0 && (
                      <div 
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none border transition-all ${
                          isSaturated 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                        title={isSaturated ? "Día con alta carga de trabajo" : "Trabajos programados"}
                      >
                        <span>{count}</span>
                        {isSaturated && <FiAlertCircle size={10} className="shrink-0" />}
                      </div>
                    )}
                  </div>
                );
              }
            },
            dateCellWrapper: (props: any) => {
              return (
                <div className="rbc-day-bg relative">
                  {props.children}
                </div>
              );
            }
          }}
        />
      </div>
    </div>
  );

  const [openedViewModes, setOpenedViewModes] = useState<Set<string>>(new Set([viewMode]));

  useEffect(() => {
    setOpenedViewModes(prev => {
      if (prev.has(viewMode)) return prev;
      const next = new Set(prev);
      next.add(viewMode);
      return next;
    });
  }, [viewMode]);

  const renderViewContent = () => {
    return (
      <>
        {Array.from(openedViewModes).map(mode => {
          if (mode === 'operativo') {
            return (
              <div key="operativo" className={viewMode !== 'operativo' ? 'hidden' : ''}>
                <OperativoView 
                  trabajos={trabajos}
                  onSelect={(t) => { setSelectedTrabajo(t); setFormMode('edit'); setIsModalOpen(true); }}
                  currentDate={currentDate}
                  onSetActiveModule={handleSetActiveModule}
                  isLoading={isLoading}
                />
              </div>
            );
          }
          if (mode === 'list') {
            return (
              <div key="list" className={viewMode !== 'list' ? 'hidden' : ''}>
                <div className="w-full">
                  <MobileWeekView 
                    events={events} 
                    onSelect={(t: Trabajo) => { setSelectedTrabajo(t); setFormMode('edit'); setIsModalOpen(true); }}
                    onSetActiveModule={handleSetActiveModule}
                    currentDate={currentDate}
                    agendaViewMode={agendaViewMode}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            );
          }
          if (mode === 'calendar') {
             return (
               <div key="calendar" className={viewMode !== 'calendar' ? 'hidden' : ''}>
                 {isLoading ? (
                    <div className="p-4 space-y-4">
                      <div className="h-64 bg-slate-100 rounded-2xl animate-pulse"></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse"></div>
                        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse"></div>
                      </div>
                    </div>
                  ) : renderCalendar()}
               </div>
             );
          }
          return null;
        })}
      </>
    );
  };

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage title="Programación de Trabajos" subtitle="Gestión operativa y asignación de cuadrillas">
        
        <div className={(!isMobile && activeTimelineJobId) ? "grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch" : "w-full"}>
          
          {/* Panel Izquierdo / Contenido Principal */}
          {(!isLogExpanded || isMobile || !mountedJobId || isDayDetailOpen) && (
          <div className={(!isMobile && mountedJobId && !isDayDetailOpen) ? "md:col-span-6 lg:col-span-7 xl:col-span-8 flex flex-col h-[calc(100vh-160px)] min-h-[500px] overflow-y-auto pr-2 custom-scrollbar" : "w-full"}>
            <ModuleToolbar>
              <div className="flex flex-col w-full gap-2 md:gap-2.5 p-0.5">
                {/* Desktop layout: Unified Toolbar Row */}
                <div className="flex flex-col md:flex-row items-center gap-2 w-full">
                  <div className="flex items-center gap-2 w-full md:flex-1">
                    <SearchInput 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      placeholder="Buscar OT..." 
                      className="flex-1 md:flex-none md:w-60 lg:w-64 !h-9 md:!h-10 !text-sm !rounded-xl"                
                    />
                    
                    {/* View Selectors - Desktop integrated */}
                    <div className="hidden md:flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200 gap-0.5 h-10">
                      <ActionButton
                        label="Operativo"
                        variant={viewMode === 'operativo' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('operativo')}
                        className="!py-1.5 !px-3 !text-[10px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none h-full"
                      />
                      <ActionButton
                        label="Agenda"
                        variant={viewMode === 'list' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('list')}
                        className="!py-1.5 !px-3 !text-[10px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none h-full"
                      />
                      <ActionButton
                        label="Calendario"
                        variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('calendar')}
                        className="!py-1.5 !px-3 !text-[10px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none h-full"
                      />
                      <ActionButton
                        label="En Espera"
                        variant={viewMode === 'waiting' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('waiting')}
                        className="!py-1.5 !px-3 !text-[10px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none h-full"
                      />
                    </div>

                    {/* Weekly Selector - Desktop integrated */}
                    <div className="hidden md:flex items-center bg-white px-2 py-0.5 rounded-xl border border-slate-200 shadow-sm h-10 gap-2">
                      <div className="flex items-center gap-1">
                        <IconButton 
                          icon={<FiChevronLeft size={18} />} 
                          onClick={handleAgendaPrev} 
                          variant="secondary" 
                          className="!w-8 !h-8 !rounded-lg !border-none hover:bg-slate-50 transition-colors" 
                          title="Semana Anterior"
                        />
                        <IconButton 
                          icon={<FiActivity size={16} className="text-blue-600" />} 
                          onClick={handleAgendaToday} 
                          variant="secondary" 
                          className="!w-8 !h-8 !rounded-lg !border-slate-100 hover:bg-slate-50" 
                          title="Ir a Hoy / Sincronizar"
                        />
                      </div>
                      
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">
                          {agendaHeaderText}
                        </span>
                        <span className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.1em] leading-none">
                          {viewMode === 'operativo' || agendaViewMode === 'week' ? 'Semana Actual' : 'Vista Temporal'}
                        </span>
                      </div>

                      <IconButton 
                        icon={<FiChevronRight size={18} />} 
                        onClick={handleAgendaNext} 
                        variant="secondary" 
                        className="!w-8 !h-8 !rounded-lg !border-none hover:bg-slate-50 transition-colors" 
                        title="Semana Siguiente"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-between md:justify-start">
                    {/* View Selectors - Mobile only (stacked) */}
                    <div className="flex md:hidden grid grid-cols-4 bg-slate-100/80 p-1 rounded-xl border border-slate-200 gap-1 flex-1 mr-2">
                      <ActionButton
                        label="Op."
                        variant={viewMode === 'operativo' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('operativo')}
                        className="!py-2 !px-0.5 !text-[8.5px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none"
                      />
                      <ActionButton
                        label="Ag."
                        variant={viewMode === 'list' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('list')}
                        className="!py-2 !px-0.5 !text-[8.5px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none"
                      />
                      <ActionButton
                        label="Cal."
                        variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('calendar')}
                        className="!py-2 !px-0.5 !text-[8.5px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none"
                      />
                      <ActionButton
                        label="Esp."
                        variant={viewMode === 'waiting' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('waiting')}
                        className="!py-2 !px-0.5 !text-[8.5px] !rounded-lg uppercase font-black tracking-tighter whitespace-nowrap !border-none shadow-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <IconButton 
                        icon={<FiPlus size={18} />} 
                        onClick={handleAddJob} 
                        variant="primary" 
                        className="!w-9 !h-9 md:!w-10 md:!h-10 !rounded-xl shadow-sm" 
                        title="Nuevo Trabajo"
                      />
                      <IconButton 
                        icon={<ACTION_ICONS.pdf size={16} />} 
                        onClick={handleExportPDF} 
                        variant="danger" 
                        className="!w-9 !h-9 md:!w-10 md:!h-10 !rounded-xl shadow-sm" 
                        title="Exportar PDF"
                      />
                      <IconButton 
                        icon={<ACTION_ICONS.excel size={16} />} 
                        onClick={handleExportExcel} 
                        variant="success" 
                        className="!w-9 !h-9 md:!w-10 md:!h-10 !rounded-xl shadow-sm" 
                        title="Exportar Excel"
                      />
                    </div>
                  </div>
                </div>

                {/* Weekly Navigation Bar - Mobile Only */}
                <div className="flex md:hidden items-center justify-between px-2 py-1 bg-white rounded-xl border border-slate-150 shadow-sm">
                  <div className="flex items-center gap-1">
                    <IconButton 
                      icon={<FiChevronLeft size={18} />} 
                      onClick={handleAgendaPrev} 
                      variant="secondary" 
                      className="!w-8 !h-8 md:!w-9 md:!h-9 !rounded-lg !border-none hover:bg-slate-50 transition-colors" 
                    />
                    <IconButton 
                      icon={<FiActivity size={16} className="text-blue-600" />} 
                      onClick={handleAgendaToday} 
                      variant="secondary" 
                      className="!w-8 !h-8 md:!w-9 md:!h-9 !rounded-lg !border-slate-200 hover:bg-slate-50" 
                      title="Hoy"
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] md:text-[12px] font-black text-slate-900 uppercase tracking-tight">
                      {agendaHeaderText}
                    </span>
                    <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-none mt-0.5 md:mt-1">
                      {viewMode === 'operativo' || agendaViewMode === 'week' ? 'Semana Actual' : 'Vista Temporal'}
                    </span>
                  </div>
                  <IconButton 
                    icon={<FiChevronRight size={18} />} 
                    onClick={handleAgendaNext} 
                    variant="secondary" 
                    className="!w-8 !h-8 md:!w-9 md:!h-9 !rounded-lg !border-none hover:bg-slate-50 transition-colors" 
                  />
                </div>
              </div>
            </ModuleToolbar>

            {searchTerm.trim().length > 0 ? (
              <div className="p-4 bg-white min-h-[400px]">
                 <div className="flex items-center justify-between mb-4">
                   <h2 className="text-sm font-black text-blue-950 uppercase">
                      Resultados para &quot;{searchTerm}&quot; ({searchResults.length})
                   </h2>
                   <ActionButton label="Limpiar" onClick={() => setSearchTerm('')} variant="secondary" className="!py-1 !px-2 !text-[10px]" />
                 </div>
                 {searchResults.length > 0 ? (
                   <MobileJobView 
                     trabajos={searchResults} 
                     onSelect={(t: Trabajo) => { setSelectedTrabajo(t); setFormMode('edit'); setIsModalOpen(true); }}
                     onContinuar={handleOpenContinuar}
                     onSetActiveModule={handleSetActiveModule}
                     isLoading={isLoading}
                   />
                 ) : (
                    <p className="text-sm text-slate-500 font-medium">No se encontraron trabajos ligados a esta OT.</p>
                 )}
              </div>
            ) : viewMode === 'waiting' ? (
              <div className="p-4 bg-white min-h-[400px]">
                 <h2 className="text-sm font-black text-blue-950 uppercase mb-4">Trabajos en espera</h2>
                 {waitingJobs.length > 0 ? (
                   <MobileJobView 
                     trabajos={waitingJobs} 
                     onSelect={(t: Trabajo) => { setSelectedTrabajo(t); setFormMode('edit'); setIsModalOpen(true); }}
                     onContinuar={handleOpenContinuar}
                     onSetActiveModule={handleSetActiveModule}
                     isLoading={isLoading}
                   />
                 ) : (
                    <p className="text-sm text-slate-500">No hay trabajos en espera.</p>
                 )}
              </div>
            ) : (
              <>
                {viewMode === 'list' && (
                  <div className="p-2 md:hidden">
                    <div className="text-center py-2 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-black text-blue-950 uppercase tracking-widest">
                        {agendaHeaderText}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="relative">
                  {renderViewContent()}
                </div>
              </>
            )}
          </div>
          )}

          {/* Panel Derecho / Split-View Timeline - SOLO si el modal de detalle de día no está tapando la vista */}
          {!isMobile && mountedJobId && !isDayDetailOpen && (
            <div className={`${isLogExpanded ? "md:col-span-12" : "md:col-span-6 lg:col-span-5 xl:col-span-4"} border border-slate-200 bg-white flex flex-col h-[calc(100vh-160px)] min-h-[500px] overflow-hidden shadow-md rounded-2xl animate-in fade-in duration-300 relative`}>
              <div className="absolute inset-0 flex flex-col">
                <OperationalLogView 
                  key={mountedJobId}
                  trabajoId={mountedJobId} 
                  parentId={activeTimelineState?.parentId || mountedJobId}
                  parentCollection={activeTimelineState?.parentCollection || "trabajos"}
                  onBack={() => { setActiveTimelineJobId(null); setIsLogExpanded(false); }} 
                  currentUser={currentUser} 
                  isExpanded={isLogExpanded}
                  onExpandToggle={() => setIsLogExpanded(!isLogExpanded)}
                />
              </div>
            </div>
          )}

        </div>

      </ModulePage>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTrabajo(null);
          setContinuarJob(null);
          onClearSelectedId?.();
        }}
        title={selectedTrabajo ? 'Editar Trabajo' : 'Nuevo Trabajo'}
        maxWidth="max-w-2xl"
        desktopMaxWidth="max-w-5xl"
      >
        <JobForm
          key={selectedTrabajo?.id || (continuarJob?.id ? `cont-${continuarJob.id}` : `new-${defaultStart?.getTime() || 'initial'}`)}
          trabajo={selectedTrabajo}
          mode={formMode}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTrabajo(null);
            setContinuarJob(null);
            onClearSelectedId?.();
          }}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          existingJobTypes={uniqueJobTypes}
          parentId={continuarJob?.id || undefined}
          parentData={continuarJob || undefined}
        />
      </Modal>

      <Modal
        isOpen={isDayDetailOpen}
        onClose={() => {
          setIsDayDetailOpen(false);
          setActiveTimelineJobId(null);
          setIsLogExpanded(false);
        }}
        title={
          <div className="flex items-center justify-between gap-4 w-full mr-4">
            <span className="truncate">Trabajos - {format(currentDate || new Date(), "d 'de' MMMM", { locale: es })}</span>
            {!isMobile && (
              <ActionButton 
                label="Nuevo Trabajo" 
                icon={<FiPlus />} 
                onClick={() => {
                  setSelectedTrabajo(null);
                  setContinuarJob(null);
                  setFormMode('create');
                  setDefaultStart(currentDate || new Date());
                  setDefaultEnd(currentDate || new Date());
                  setIsDayDetailOpen(false);
                  setIsModalOpen(true);
                }}
                variant="primary"
                className="shrink-0"
              />
            )}
          </div>
        }
        maxWidth={(!isMobile && activeTimelineJobId) ? "max-w-7xl" : "max-w-xl"}
        desktopMaxWidth={(!isMobile && activeTimelineJobId) ? "max-w-[95vw]" : "max-w-6xl"}
        footer={isMobile ? (
          <ActionButton 
            label="Nuevo Trabajo" 
            icon={<FiPlus />} 
            onClick={() => {
              setSelectedTrabajo(null);
              setContinuarJob(null);
              setFormMode('create');
              setDefaultStart(currentDate || new Date());
              setDefaultEnd(currentDate || new Date());
              setIsDayDetailOpen(false);
              setIsModalOpen(true);
            }}
            variant="primary"
            className="w-full"
          />
        ) : null}
      >
        <div className={(!isMobile && activeTimelineJobId) ? "flex h-[85vh] min-h-[600px] overflow-hidden" : "p-0 -mt-4 lg:-mt-6"}>
          {!isLogExpanded && (
          <div className={(!isMobile && activeTimelineJobId) ? "flex-1 border-r border-slate-100 overflow-y-auto custom-scrollbar bg-white p-8" : ""}>
            <MobileJobView 
              trabajos={dayDetailJobs} 
              onSelect={(t) => { 
                setSelectedTrabajo(t); 
                setFormMode('edit');
                setIsDayDetailOpen(false);
                setIsModalOpen(true); 
              }}
              onSetActiveModule={(data) => {
                const moduleObj = typeof data === 'string' ? { module: data } : data;
                // No cerrar modal si se abre log operacional en desktop/tablet, permitiendo vista dual
                if (window.innerWidth >= 768 && moduleObj?.module === 'operational_log') {
                  handleSetActiveModule(data);
                } else {
                  setIsDayDetailOpen(false);
                  handleSetActiveModule(data);
                }
              }}
            />
          </div>
          )}

          {!isMobile && activeTimelineJobId && (
            <div className={isLogExpanded ? "flex-1 bg-white flex flex-col overflow-hidden animate-in fade-in duration-300" : "w-[350px] md:w-[380px] shrink-0 bg-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"}>
              <div className="flex-1 overflow-hidden relative">
                <OperationalLogView 
                  key={activeTimelineJobId}
                  parentId={activeTimelineState?.parentId || activeTimelineJobId}
                  parentCollection={activeTimelineCollection}
                  initialState={activeTimelineState}
                  onBack={() => { setActiveTimelineJobId(null); setIsLogExpanded(false); }}
                  currentUser={currentUser}
                  isExpanded={isLogExpanded}
                  onExpandToggle={() => setIsLogExpanded(!isLogExpanded)}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
