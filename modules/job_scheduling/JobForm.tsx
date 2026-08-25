import React, { useState, useEffect, useMemo, useCallback } from 'react';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import { es } from 'date-fns/locale';
import { Trabajo, EstadoTrabajo } from './types';
import { createTrabajo, updateTrabajo, deleteTrabajo } from './jobService';
import { createOrUpdateJobType } from './jobTypeService';
import { createOrUpdateJobTitle } from './jobTitleService';
import { ActionButton, Select, UI_TOKENS, useConfirm } from '@/design-system';
import { localDocStore } from '@/core/offline/localDocStore';
import { JobTitleAutocomplete } from './components/JobTitleAutocomplete';
import { JobTypeSelect } from './components/JobTypeSelect';
import { useAuditPermanence } from '@/hooks/useAuditPermanence';
import { FiTrash2, FiCheck, FiUsers, FiTruck, FiClock, FiAlertTriangle, FiSearch, FiMapPin } from 'react-icons/fi';
import { db } from '@/firebase';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

interface JobFormProps {
  trabajo?: Trabajo | null;
  onClose: () => void;
  defaultStart?: Date;
  defaultEnd?: Date;
  existingJobTypes?: string[];
  parentId?: string;
  parentData?: Partial<Trabajo>;
  mode: 'create' | 'edit' | 'continuacion';
}

export const VEHICLES = [
  { value: 'U1', label: 'U1 - NISSAN PATHFINDER - 532995' },
  { value: 'U2', label: 'U2 - KIA BONGO - 420101' },
  { value: 'U3', label: 'U3 - MERCEDES BENZ - MBZ-375' },
  { value: 'U4', label: 'U4 - KIA MORNING - AAE-026' },
  { value: 'U5', label: 'U5 - NISSAN UD 1400 - CL 254711' },
  { value: 'U6', label: 'U6 - HYUNDAI HD - CL 255409' },
  { value: 'U7', label: 'U7 - VOLKSWAGEN CROSS - BVQ-651' },
  { value: 'U8', label: 'U8 - SUZUKI GRAN VITARA - 578994' },
];

const toUpperCase = (text: string) => text ? text.toUpperCase() : '';
const toTitleCase = (text: string) => {
  if (!text) return '';
  return text.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

const isMidnight = (date: Date | null | undefined) => {
  if (!date) return true;
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
};

export const JobForm: React.FC<JobFormProps> = ({ 
  trabajo, 
  onClose, 
  defaultStart, 
  defaultEnd, 
  existingJobTypes: _existingJobTypes = [], 
  parentId, 
  parentData,
  mode
}) => {
  useAuditPermanence({
    module: 'Programación de Trabajos',
    submodule: mode === 'create' ? 'Crear Trabajo' : 'Editar Trabajo',
    recordId: trabajo?.id,
    recordCode: trabajo?.id, // Trabajos don't seem to have a separately visible code, using ID as fallback
    enabled: true
  });
  const confirm = useConfirm();
  const [showForceDeleteModal, setShowForceDeleteModal] = useState(false);
  const [confirmarEliminacion, setConfirmarEliminacion] = useState(false);
  const [employees, setEmployees] = useState<{ id: string, name: string }[]>([]);
  const [vehicleLogs, setVehicleLogs] = useState<{ id: string, label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTermEmployees, setSearchTermEmployees] = useState('');
  const [searchTermLogs, setSearchTermLogs] = useState('');
  const [isLinkingSelectorOpen, setIsLinkingSelectorOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<Trabajo>>(
    trabajo ? {
        ...trabajo,
        titulo: trabajo.titulo ? toUpperCase(trabajo.titulo) : '',
        tipo_trabajo: trabajo.tipo_trabajo ? toUpperCase(trabajo.tipo_trabajo) : '',
        ubicacion: trabajo.ubicacion ? toTitleCase(trabajo.ubicacion) : '',
        bitacorasRelacionadas: trabajo.bitacorasRelacionadas || (trabajo.registroBitacoraId ? [{ bitacoraId: trabajo.registroBitacoraId, fecha: 'legacy' }] : []),
    } : {
      titulo: parentData?.titulo ? toUpperCase(parentData.titulo) : '',
      tipo_trabajo: parentData?.tipo_trabajo ? toUpperCase(parentData.tipo_trabajo) : '',
      descripcion: parentData?.descripcion || '',
      fecha_inicio: defaultStart || new Date(),
      fecha_fin: defaultEnd || new Date(),
      hora_inicio: defaultStart ? (isMidnight(defaultStart) ? '06:00' : format(defaultStart, 'HH:mm')) : '06:00',
      hora_fin: defaultEnd ? (isMidnight(defaultEnd) ? '16:00' : format(defaultEnd, 'HH:mm')) : '16:00',
      cuadrilla: [],
      unidades: [],
      ubicacion: parentData?.ubicacion ? toTitleCase(parentData.ubicacion) : '',
      observaciones: '',
      estado: 'programado',
      progreso: 0,
      parentId: parentId || null,
      bitacorasRelacionadas: [],
    }
  );

  const toISODateString = (date: any) => {
    if (!date) return format(new Date(), 'yyyy-MM-dd');
    const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
    if (isNaN(d.getTime())) return format(new Date(), 'yyyy-MM-dd');
    // Usar formato local para extraer la fecha nominal y evitar saltos por desfase UTC
    return format(d, 'yyyy-MM-dd');
  };

  const [fechaInicio, setFechaInicio] = useState<string>(
    toISODateString(formData.fecha_inicio)
  );
  const [fechaFin, setFechaFin] = useState<string>(
    toISODateString(formData.fecha_fin)
  );

  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(null);
  const [dayEmployeeSearch, setDayEmployeeSearch] = useState('');
  const [dayVehicleSearch, setDayVehicleSearch] = useState('');

  // Helper for generating daily details
  const generateDiasDetalle = useCallback((start: Date, end: Date, existing?: any[]) => {
    const dias = [];
    // Normalizar a medianoche local para la iteración
    const currentDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    
    const defaultStart = formData?.hora_inicio || '06:00';
    const defaultEnd = formData?.hora_fin || '16:00';

    // Helper para comparar llaves nominales (YYYY-MM-DD local)
    const getNominalKey = (date: any) => {
      if (!date) return '';
      const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
      if (!d || isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    while (currentDate <= endDate) {
      const currentKey = getNominalKey(currentDate);
      
      const found = existing?.find(d => getNominalKey(d.fecha) === currentKey);
      
      dias.push({
        fecha: new Date(currentDate.getTime()), // Guardar medianoche local
        completado: found ? found.completado : false,
        completado_en: found?.completado_en ? found.completado_en : undefined,
        hora_inicio: found?.recursos_ajustados ? (found?.hora_inicio || defaultStart) : defaultStart,
        hora_fin: found?.recursos_ajustados ? (found?.hora_fin || defaultEnd) : defaultEnd,
        recursos_ajustados: found?.recursos_ajustados || false,
        cuadrilla_diaria: found?.cuadrilla_diaria || [],
        unidades_diarias: found?.unidades_diarias || [],
        estado: found?.estado || 'programado'
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dias;
  }, [formData?.hora_inicio, formData?.hora_fin]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [error, setError] = useState<string | null>(null);

  // Time helper functions
  const getTimeParts = (time24: string) => {
    const [h, m] = (time24 || '06:00').split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return { 
      hour: h12.toString().padStart(2, '0'), 
      minute: m.toString().padStart(2, '0'), 
      period 
    };
  };

  const updateTimeFromParts = (field: 'hora_inicio' | 'hora_fin', part: 'hour' | 'minute' | 'period', value: string) => {
    const current = getTimeParts(formData[field] || (field === 'hora_inicio' ? '06:00' : '16:00'));
    const newParts = { ...current, [part]: value };
    
    let h = parseInt(newParts.hour);
    if (newParts.period === 'PM' && h < 12) h += 12;
    if (newParts.period === 'AM' && h === 12) h = 0;
    
    const time24 = `${h.toString().padStart(2, '0')}:${newParts.minute}`;
    setFormData({ ...formData, [field]: time24 });
  };

  useEffect(() => {
    if (!trabajo && mode === 'create') {
      setFormData(prev => ({
        ...prev,
        hora_inicio: '06:00',
        hora_fin: '16:00'
      }));
    }
  }, [trabajo, mode]);

  useEffect(() => {
    if (!fechaInicio || !fechaFin) return;
    
    try {
      const start = parse(fechaInicio, 'yyyy-MM-dd', new Date());
      const end = parse(fechaFin, 'yyyy-MM-dd', new Date());
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        // Usamos el detalle actual para intentar preservar lo que ya esté marcado como completado
        const nuevosDias = generateDiasDetalle(start, end, formData.dias_detalle || []);
        
        const currentLength = formData.dias_detalle?.length || 0;
        const currentStart = formData.dias_detalle?.[0]?.fecha;
        const currentEnd = formData.dias_detalle?.[currentLength - 1]?.fecha;

        const startChanged = !currentStart || format(new Date(currentStart), 'yyyy-MM-dd') !== fechaInicio;
        const endChanged = !currentEnd || format(new Date(currentEnd), 'yyyy-MM-dd') !== fechaFin;

        if (startChanged || endChanged || nuevosDias.length !== currentLength) {
           setFormData(prev => ({
             ...prev,
             dias_detalle: nuevosDias,
             dias_programados: nuevosDias.length
           }));
        }
      }
    } catch (e) {
      console.error("Error updating dias_detalle:", e);
    }
  }, [fechaInicio, fechaFin, formData.dias_detalle, generateDiasDetalle]);



  const clearError = () => {
    if (error) setError(null);
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "employees"));
        const empList = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(emp => emp.status !== 'archivado' && !emp.isArchived)
          .map(emp => ({
            id: emp.id,
            name: emp.displayName || emp.name || emp.id
          }));
        setEmployees(empList);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchVehicleLogs = async () => {
      try {
        // Obtenemos bitácoras recientes (últimos 3 meses para no saturar)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];
        
        const q = query(
          collection(db, "bitacora_vehiculos"),
          where("fecha", ">=", threeMonthsAgoStr)
        );
        
        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const placa = data._resolvedPlaca || data.placa || "SIN PLACA";
          const conductor = data._resolvedName || data.conductorName || "DESCONOCIDO";
          const fecha = data.fecha || (data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : "");
          
          return {
            id: doc.id,
            label: `${placa} - ${conductor} (${fecha})`
          };
        });
        
        // Si ya tiene uno seleccionado que no está en los "recientes", intentamos traerlo específicamente
        if (formData.registroBitacoraId && !logs.find(l => l.id === formData.registroBitacoraId)) {
          // Opcional: Podrías hacer un getDoc aquí si es necesario
        }

        setVehicleLogs(logs.sort((a, b) => b.label.localeCompare(a.label)));
      } catch (error) {
        console.error("Error fetching vehicle logs:", error);
      }
    };
    fetchVehicleLogs();
  }, [formData.registroBitacoraId]);

  const filteredVehicleLogs = useMemo(() => {
    let logs = [...vehicleLogs];
    
    // Si hay búsqueda, filtrar por término
    if (searchTermLogs) {
      const term = searchTermLogs.toLowerCase();
      logs = logs.filter(l => l.label.toLowerCase().includes(term));
    }

    // Ordenar por relevancia (Fecha y Unidad)
    return logs.sort((a, b) => {
      // Prioridad 1: Coincidencia exacta de fecha (yyyy-MM-dd)
      const isADateMatch = a.label.includes(fechaInicio);
      const isBDateMatch = b.label.includes(fechaInicio);
      
      // Prioridad 2: Coincidencia de unidad seleccionada
      const isAUnitMatch = formData.unidades?.some(u => a.label.includes(u));
      const isBUnitMatch = formData.unidades?.some(u => b.label.includes(u));

      // Scoring
      const scoreA = (isADateMatch ? 10 : 0) + (isAUnitMatch ? 5 : 0);
      const scoreB = (isBDateMatch ? 10 : 0) + (isBUnitMatch ? 5 : 0);

      if (scoreA !== scoreB) return scoreB - scoreA;
      
      // Fallback: Alfabetico/Fecha descendente
      return b.label.localeCompare(a.label);
    });
  }, [vehicleLogs, searchTermLogs, fechaInicio, formData.unidades]);

  // Reset form when trabajo changes
  useEffect(() => {
    if (trabajo) {
      setFormData({
        ...trabajo,
        bitacorasRelacionadas: trabajo.bitacorasRelacionadas || [],
        bitacoraIds: trabajo.bitacoraIds || []
      });
      setFechaInicio(format(trabajo.fecha_inicio instanceof Date ? trabajo.fecha_inicio : (trabajo.fecha_inicio as any)?.toDate?.() || new Date(trabajo.fecha_inicio), 'yyyy-MM-dd'));
      setFechaFin(format(trabajo.fecha_fin instanceof Date ? trabajo.fecha_fin : (trabajo.fecha_fin as any)?.toDate?.() || new Date(trabajo.fecha_fin), 'yyyy-MM-dd'));
    } else if (mode === 'create') {
      setFormData({
        estado: 'programado',
        tipo_trabajo: '',
        descripcion: '',
        cuadrilla: [],
        unidades: [],
        hora_inicio: defaultStart ? (isMidnight(defaultStart) ? '06:00' : format(defaultStart, 'HH:mm')) : '06:00',
        hora_fin: defaultEnd ? (isMidnight(defaultEnd) ? '16:00' : format(defaultEnd, 'HH:mm')) : '16:00',
        bitacorasRelacionadas: [],
        bitacoraIds: []
      });
      const startStr = toISODateString(defaultStart || new Date());
      const endStr = toISODateString(defaultEnd || new Date());
      setFechaInicio(startStr);
      setFechaFin(endStr);
    }
  }, [trabajo, mode, defaultStart, defaultEnd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    // Initial Manual Validations
    let validationError = null;
    if (!formData.titulo?.trim()) validationError = 'El título del trabajo es obligatorio';
    else if (!formData.tipo_trabajo?.trim()) validationError = 'El tipo de trabajo es obligatorio';
    else if (!formData.descripcion?.trim()) validationError = 'La descripción es obligatoria';
    else if (!fechaInicio || !fechaFin) validationError = 'Las fechas son obligatorias';
    else if (!formData.hora_inicio || !formData.hora_fin) validationError = 'Las horas son obligatorias';
    else if (!formData.ubicacion?.trim()) validationError = 'La ubicación es obligatoria';
    else if (!formData.cuadrilla || formData.cuadrilla.length === 0) validationError = "Debe asignar al menos una persona en la cuadrilla";

    if (validationError) {
      setError(validationError);
      await confirm({
        title: 'Información Faltante',
        description: validationError,
        confirmLabel: 'Entendido',
        variant: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      // Obtener el documento MÁS reciente del local store para evitar sobrescritura por estado stale
      let latestTrabajo = trabajo;
      if (mode === 'edit' && trabajo?.id) {
        const docFromStore = await localDocStore.getLocalDoc('trabajos', trabajo.id);
        if (docFromStore && docFromStore.data) {
           latestTrabajo = { ...docFromStore.data, id: trabajo.id } as Trabajo;
        }
      }

      if (formData.tipo_trabajo && formData.tipo_trabajo.trim() !== '') {
        try {
          await createOrUpdateJobType(formData.tipo_trabajo.trim());
        } catch (err) {
          console.warn("Could not update job type catalog:", err);
        }
      }

      if (formData.titulo && formData.titulo.trim() !== '') {
        try {
          await createOrUpdateJobTitle(formData.titulo.trim());
        } catch (err) {
          console.warn("Could not update job title catalog:", err);
        }
      }

      // Combine dates and hours
      const baseStartDate = parse(fechaInicio, 'yyyy-MM-dd', new Date());
      const baseEndDate = parse(fechaFin, 'yyyy-MM-dd', new Date());

      if (isNaN(baseStartDate.getTime()) || isNaN(baseEndDate.getTime())) {
        throw new Error(`Las fechas son inválidas. Inicio: ${fechaInicio}, Fin: ${fechaFin}`);
      }
      
      const [hStart, mStart] = (formData.hora_inicio || '06:00').split(':').map(Number);
      const [hEnd, mEnd] = (formData.hora_fin || '16:00').split(':').map(Number);

      if (isNaN(hStart) || isNaN(mStart) || isNaN(hEnd) || isNaN(mEnd)) {
        throw new Error('Las horas son inválidas. Por favor verifique el formato (ej: 08:30).');
      }

      const fecha_inicio = new Date(baseStartDate);
      fecha_inicio.setHours(hStart, mStart, 0, 0);

      const fecha_fin = new Date(baseEndDate);
      fecha_fin.setHours(hEnd, mEnd, 0, 0);

      const finalData: any = {
        ...(latestTrabajo || {}),
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        ubicacion: formData.ubicacion,
        cuadrilla: formData.cuadrilla,
        unidades: formData.unidades,
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
        observaciones: formData.observaciones,
        dias_detalle: formData.dias_detalle,
        progreso: formData.progreso,
        tipo_trabajo: formData.tipo_trabajo,
        fecha_inicio,
        fecha_fin,
        estado: formData.estado || 'programado',
      };

      // Limpieza explícita: asegurar que bitacorasRelacionadas se actualice correctamente en finalData
      finalData.bitacorasRelacionadas = formData.bitacorasRelacionadas || [];
      finalData.bitacoraIds = formData.bitacorasRelacionadas?.map((b: any) => b.bitacoraId) || [];

      const syncSingleDayStatus = (data: any) => {
        if (data.dias_detalle && data.dias_detalle.length === 1) {
          data.dias_detalle = data.dias_detalle.map((dia: any) => ({
            ...dia,
            estado: data.estado,
            completado: data.estado === 'finalizado',
            completado_en: data.estado === 'finalizado' ? (dia.completado_en || new Date()) : undefined
          }));
          data.progreso = data.estado === 'finalizado' ? 100 : 0;
        }
      };

      if (mode === 'create' || mode === 'continuacion') {
        const dias_detalle = generateDiasDetalle(baseStartDate, baseEndDate);
        finalData.dias_detalle = dias_detalle;
        finalData.dias_programados = dias_detalle.length;
        
        if (parentId) {
            finalData.parentId = parentId;
            finalData.esSubTrabajo = true;
        }

        syncSingleDayStatus(finalData);
        await createTrabajo(finalData as Omit<Trabajo, "id" | "creado_en" | "actualizado_en">);
      } else if (mode === 'edit' && latestTrabajo) {
        // Detect dates changes
        const currentFechaInicio = latestTrabajo.fecha_inicio instanceof Date ? latestTrabajo.fecha_inicio : (latestTrabajo.fecha_inicio as any)?.toDate?.() || new Date(latestTrabajo.fecha_inicio);
        const currentFechaFin = latestTrabajo.fecha_fin instanceof Date ? latestTrabajo.fecha_fin : (latestTrabajo.fecha_fin as any)?.toDate?.() || new Date(latestTrabajo.fecha_fin);
        
        const fechasModificadas = 
          finalData.fecha_inicio.getTime() !== currentFechaInicio.getTime() ||
          finalData.fecha_fin.getTime() !== currentFechaFin.getTime();

        if (fechasModificadas) {
          const nuevosDias = generateDiasDetalle(baseStartDate, baseEndDate, formData.dias_detalle);
          // Propagar horas nuevas en días que no hayan sido editados manualmente
          finalData.dias_detalle = nuevosDias.map((dia: any) => {
            if (dia.recursos_ajustados) {
              return dia;
            }
            return {
              ...dia,
              hora_inicio: finalData.hora_inicio,
              hora_fin: finalData.hora_fin,
            };
          });
          finalData.dias_programados = finalData.dias_detalle.length;
          const completedCount = finalData.dias_detalle.filter((d: any) => d.completado).length;
          finalData.progreso = finalData.dias_detalle.length > 0 ? Math.round((completedCount / finalData.dias_detalle.length) * 100) : 0;
          
          syncSingleDayStatus(finalData);

          const isReprogramar = await confirm({
            title: 'Reprogramar Trabajo',
            description: 'Se detectó un cambio en las fechas del trabajo. ¿Desea reprogramar este trabajo o guardar los cambios normalmente?',
            confirmLabel: 'Reprogramar',
            cancelLabel: 'Guardar normal',
            variant: 'primary'
          });

          if (isReprogramar) {
            finalData.reprogramado = true;
            finalData.fecha_reprogramacion = new Date();
            await updateTrabajo(latestTrabajo.id, finalData, latestTrabajo.actualizado_en?.toDate?.() || latestTrabajo.actualizado_en);
          } else {
            await updateTrabajo(latestTrabajo.id, finalData, latestTrabajo.actualizado_en?.toDate?.() || latestTrabajo.actualizado_en);
          }
        } else {
          // Propagar horas nuevas en días que no hayan sido editados manualmente si las fechas no se modificaron
          if (finalData.dias_detalle && Array.isArray(finalData.dias_detalle)) {
            finalData.dias_detalle = finalData.dias_detalle.map((dia: any) => {
              if (dia.recursos_ajustados) {
                return dia;
              }
              return {
                ...dia,
                hora_inicio: finalData.hora_inicio,
                hora_fin: finalData.hora_fin,
              };
            });
          }
          syncSingleDayStatus(finalData);
          await updateTrabajo(latestTrabajo.id, finalData, latestTrabajo.actualizado_en?.toDate?.() || latestTrabajo.actualizado_en);
        }
      } else if (mode === 'edit') {
        throw new Error("No se pudo identificar el trabajo para editar.");
      }
      
      onClose();
    } catch (saveError: any) {
      console.error("Error saving job:", saveError);
      setError(saveError?.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!trabajo) return;
    
    const isConfirmed = await confirm({
      title: 'Eliminar Trabajo',
      description: '¿Está seguro de que desea eliminar este trabajo? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });

    if (isConfirmed) {
      setLoading(true);
      try {
        const result = await deleteTrabajo(trabajo);
        
        if (result.blocked) {
          setShowForceDeleteModal(true);
          setLoading(false);
          return;
        }
        
        onClose();
      } catch (error) {
        console.error("Error deleting job:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleForceDelete = async () => {
    if (!trabajo || !confirmarEliminacion) return;
    
    setLoading(true);
    try {
      const q = query(collection(db, "material_reports_log"), where("jobId", "==", trabajo.id));
      const snapshot = await getDocs(q);
      
      for (const reportDoc of snapshot.docs) {
        await deleteDoc(doc(db, "material_reports_log", reportDoc.id));
      }
      
      await deleteTrabajo(trabajo);
      setShowForceDeleteModal(false);
      onClose();
    } catch (error) {
      console.error("Error force deleting job:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (list: string[], item: string) => {
    return list.includes(item) 
      ? list.filter(i => i !== item) 
      : [...list, item];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <JobTypeSelect
            label={
              <span>
                Tipo de Trabajo <span className="text-red-500">*</span>
              </span>
            }
            value={formData.tipo_trabajo || ''}
            onChange={(val) => {
              clearError();
              setFormData({ ...formData, tipo_trabajo: toUpperCase(val) });
            }}
            placeholder="Seleccione o escriba tipo..."
          />

          <div>
            <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1"}>
              TÍTULO DEL TRABAJO <span className="text-red-500">*</span>
            </label>
            <JobTitleAutocomplete
              value={formData.titulo || ''}
              onChange={(val) => {
                clearError();
                setFormData({ ...formData, titulo: toUpperCase(val) });
              }}
            />
            <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-tight">
              Nombre corto para visualización rápida (máx 40-60 caracteres)
            </p>
          </div>

          <div>
            <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1"}>
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => {
                clearError();
                setFormData({ ...formData, descripcion: e.target.value });
              }}
              className={`w-full ${UI_TOKENS.SPACING.inputPadding} ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none focus:ring-2 focus:ring-blue-100 transition-all min-h-[100px] text-sm`}
              placeholder="Detalles del trabajo..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1"}>
                Fecha Inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  clearError();
                  setFechaInicio(e.target.value);
                }}
                className={`w-full ${UI_TOKENS.SPACING.inputPadding} ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none focus:ring-2 focus:ring-blue-100 text-sm`}
                required
              />
            </div>
            <div>
              <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1"}>
                Fecha Fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  clearError();
                  setFechaFin(e.target.value);
                }}
                min={fechaInicio}
                className={`w-full ${UI_TOKENS.SPACING.inputPadding} ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none focus:ring-2 focus:ring-blue-100 text-sm`}
                required
              />
            </div>
          </div>

          <div>
            <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1"}>
              Ubicación <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.ubicacion || ''}
                onChange={(e) => {
                  clearError();
                  setFormData({ ...formData, ubicacion: toTitleCase(e.target.value) });
                }}
                className={`w-full pl-10 pr-3 py-2 ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none focus:ring-2 focus:ring-blue-100 text-sm`}
                placeholder="Dirección o coordenadas..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1.5"}>
                Hora Inicio <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                {isMobileDevice ? (
                  <input
                    type="time"
                    value={formData.hora_inicio || '06:00'}
                    onChange={(e) => {
                      clearError();
                      setFormData({ ...formData, hora_inicio: e.target.value });
                    }}
                    className={`w-full pl-10 pr-3 py-2.5 ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all text-sm`}
                    required
                  />
                ) : (
                  <div className={`flex items-center gap-1 pl-10 pr-3 py-1.5 ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all`}>
                    <select
                      value={getTimeParts(formData.hora_inicio || '06:00').hour}
                      onChange={(e) => updateTimeFromParts('hora_inicio', 'hour', e.target.value)}
                      className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-slate-400">:</span>
                    <select
                      value={getTimeParts(formData.hora_inicio || '06:00').minute}
                      onChange={(e) => updateTimeFromParts('hora_inicio', 'minute', e.target.value)}
                      className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer"
                    >
                      {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={getTimeParts(formData.hora_inicio || '06:00').period}
                      onChange={(e) => updateTimeFromParts('hora_inicio', 'period', e.target.value)}
                      className="bg-transparent border-none outline-none text-sm font-bold text-blue-600 cursor-pointer ml-1"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1.5"}>
                Hora Fin <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                {isMobileDevice ? (
                  <input
                    type="time"
                    value={formData.hora_fin || '16:00'}
                    onChange={(e) => {
                      clearError();
                      setFormData({ ...formData, hora_fin: e.target.value });
                    }}
                    className={`w-full pl-10 pr-3 py-2.5 ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all text-sm`}
                    required
                  />
                ) : (
                  <div className={`flex items-center gap-1 pl-10 pr-3 py-1.5 ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all`}>
                    <select
                      value={getTimeParts(formData.hora_fin || '16:00').hour}
                      onChange={(e) => updateTimeFromParts('hora_fin', 'hour', e.target.value)}
                      className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-slate-400">:</span>
                    <select
                      value={getTimeParts(formData.hora_fin || '16:00').minute}
                      onChange={(e) => updateTimeFromParts('hora_fin', 'minute', e.target.value)}
                      className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer"
                    >
                      {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={getTimeParts(formData.hora_fin || '16:00').period}
                      onChange={(e) => updateTimeFromParts('hora_fin', 'period', e.target.value)}
                      className="bg-transparent border-none outline-none text-sm font-bold text-blue-600 cursor-pointer ml-1"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>


        </div>

        <div className="space-y-4">
          <div>
            <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1 flex items-center gap-2"}>
              <FiUsers size={14} /> Cuadrilla Asignada
            </label>
            
            <div className="relative mb-2">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={searchTermEmployees}
                onChange={(e) => setSearchTermEmployees(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 border ${UI_TOKENS.COLORS.border} rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-blue-100 transition-all`}
              />
            </div>

            <div className={`border ${UI_TOKENS.COLORS.border} rounded-xl p-3 max-h-[150px] overflow-y-auto bg-slate-50 space-y-1 custom-scrollbar`}>
              {employees
                .filter(emp => emp.name.toLowerCase().includes(searchTermEmployees.toLowerCase()))
                .sort((a, b) => {
                    const isASelected = formData.cuadrilla?.includes(a.name) || formData.cuadrilla?.includes(a.id);
                    const isBSelected = formData.cuadrilla?.includes(b.name) || formData.cuadrilla?.includes(b.id);
                    
                    if (isASelected && !isBSelected) return -1;
                    if (!isASelected && isBSelected) return 1;
                    return a.name.localeCompare(b.name);
                })
                .map(emp => (
                <label key={emp.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={formData.cuadrilla?.includes(emp.name) || formData.cuadrilla?.includes(emp.id)}
                    onChange={() => {
                        let newCuadrilla = [...(formData.cuadrilla || [])];
                        const hasId = newCuadrilla.includes(emp.id);
                        const hasName = newCuadrilla.includes(emp.name);
                        
                        if (hasId || hasName) {
                            newCuadrilla = newCuadrilla.filter(i => i !== emp.id && i !== emp.name);
                        } else {
                            newCuadrilla.push(emp.name);
                        }
                        setFormData({ ...formData, cuadrilla: newCuadrilla });
                        setSearchTermEmployees(''); // Clear search after selection
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {emp.name}
                </label>
              ))}
              {employees.filter(emp => emp.name.toLowerCase().includes(searchTermEmployees.toLowerCase())).length === 0 && (
                <div className="text-center py-2 text-[10px] text-slate-400 font-bold uppercase italic">
                  No se encontraron resultados
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1 flex items-center gap-2"}>
              <FiTruck size={14} /> Unidades / Vehículos
            </label>
            <div className={`border ${UI_TOKENS.COLORS.border} rounded-xl p-3 max-h-[120px] overflow-y-auto bg-slate-50 space-y-1 custom-scrollbar`}>
              {[...VEHICLES].sort((a, b) => {
                const isASelected = formData.unidades?.includes(a.value);
                const isBSelected = formData.unidades?.includes(b.value);
                
                if (isASelected && !isBSelected) return -1;
                if (!isASelected && isBSelected) return 1;
                return a.label.localeCompare(b.label);
              }).map(v => (
                <label key={v.value} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={formData.unidades?.includes(v.value)}
                    onChange={() => setFormData({ ...formData, unidades: toggleItem(formData.unidades || [], v.value) })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {v.label}
                </label>
              ))}
            </div>
          </div>

          <Select
            label="Estado del Trabajo"
            options={[
              { value: 'programado', label: 'Programado' },
              { value: 'en_proceso', label: 'En Proceso' },
              { value: 'finalizado', label: 'Finalizado' },
              { value: 'cancelado', label: 'Cancelado' },
            ]}
            value={formData.estado}
            onChange={(val) => setFormData({ ...formData, estado: val as EstadoTrabajo })}
            required
          />

          <div className="pt-2 border-t border-slate-100">
            <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-2 flex items-center gap-2"}>
              <FiTruck size={14} className="text-blue-500" /> VINCULAR BITÁCORA DE VEHÍCULO
            </label>
            
            {!isLinkingSelectorOpen ? (
              <div 
                onClick={() => setIsLinkingSelectorOpen(true)}
                className={`flex items-center justify-between p-3 border ${UI_TOKENS.COLORS.border} rounded-xl bg-white cursor-pointer hover:border-blue-300 transition-all select-none shadow-sm`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FiTruck className="text-blue-600" size={14} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    {formData.bitacorasRelacionadas && formData.bitacorasRelacionadas.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {formData.bitacorasRelacionadas.map(b => (
                          <span key={b.bitacoraId} className="text-[10px] font-black text-slate-800 truncate">
                            {vehicleLogs.find(l => l.id === b.bitacoraId)?.label.split('(')[0] || 'Bitácora'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 italic">-- Sin vincular --</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg">CAMBIAR</span>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 shadow-xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Seleccionar Registro</h4>
                  <button 
                    type="button"
                    onClick={() => setIsLinkingSelectorOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <FiCheck size={16} className="text-green-500" />
                  </button>
                </div>
                
                <div className="relative mb-3">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input
                    type="text"
                    placeholder="Filtrar por placa, conductor o fecha..."
                    value={searchTermLogs}
                    onChange={(e) => setSearchTermLogs(e.target.value)}
                    autoFocus
                    className={`w-full pl-8 pr-3 py-2 border ${UI_TOKENS.COLORS.border} rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50/50`}
                  />
                </div>

                <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  <label 
                    className={`flex items-center gap-2 p-3 rounded-xl transition-all cursor-pointer text-[10px] font-black uppercase tracking-wider ${formData.bitacorasRelacionadas?.length === 0 ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-500 border border-transparent'}`}
                    onClick={() => setFormData({ ...formData, bitacorasRelacionadas: [] })}
                  >
                    <input
                      type="checkbox"
                      checked={formData.bitacorasRelacionadas?.length === 0}
                      onChange={() => {}} 
                      className="hidden"
                    />
                    {formData.bitacorasRelacionadas?.length === 0 ? <FiCheck size={14} /> : <div className="w-3.5" />}
                    -- Limpiar selección --
                  </label>

                  {filteredVehicleLogs.map(log => {
                    const isSelected = formData.bitacorasRelacionadas?.some(b => b.bitacoraId === log.id);
                    const isSuggested = log.label.includes(fechaInicio) || formData.unidades?.some(u => log.label.includes(u));
                    
                    return (
                      <div 
                        key={log.id} 
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-all cursor-pointer border ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 hover:border-blue-200 text-slate-600'}`}
                        onClick={() => {
                            if (isSelected) {
                                setFormData({ ...formData, bitacorasRelacionadas: formData.bitacorasRelacionadas?.filter(b => b.bitacoraId !== log.id) });
                            } else {
                                setFormData({ ...formData, bitacorasRelacionadas: [...(formData.bitacorasRelacionadas || []), { bitacoraId: log.id, fecha: new Date().toISOString() }] });
                            }
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} 
                            className="hidden"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className={`text-[11px] font-black truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                              {log.label.split('(')[0]}
                            </span>
                            <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              ({log.label.split('(')[1] || ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSuggested && !isSelected && (
                              <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">SUGERIDO</span>
                          )}
                          {isSelected && <FiCheck size={16} className="shrink-0 animate-in zoom-in-50" />}
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredVehicleLogs.length === 0 && (
                    <div className="text-center py-8 text-[11px] text-slate-400 font-bold uppercase italic">
                      No se encontraron resultados
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold tracking-tight px-1 italic">
              Vincula este trabajo a una bitácora de vehículo para compartir evidencias y timeline.
            </p>
          </div>

          {trabajo && trabajo.dias_detalle && trabajo.dias_detalle.length > 0 && (
            <div>
              <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-2"}>
                Seguimiento por Día ({trabajo.dias_detalle.filter(d => d.completado).length} de {trabajo.dias_programados} días completados)
              </label>
              <div className="space-y-2">
                {formData.dias_detalle?.map((dia, index) => (
                  <div key={index}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors gap-2">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={dia.completado}
                        onChange={(e) => {
                          const newDiasDetalle = [...(formData.dias_detalle || [])];
                          newDiasDetalle[index] = {
                            ...dia,
                            completado: e.target.checked,
                            completado_en: e.target.checked ? new Date() : undefined
                          };
                          
                          // Calculate new progress
                          const completedCount = newDiasDetalle.filter(d => d.completado).length;
                          const totalDays = newDiasDetalle.length;
                          const newProgress = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
                          
                          setFormData({ 
                            ...formData, 
                            dias_detalle: newDiasDetalle,
                            progreso: newProgress
                          });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-sm font-bold text-slate-700 capitalize mb-1">
                          {format(dia.fecha, "EEEE d 'de' MMM", { locale: es })}
                        </span>
                        {formData.dias_detalle && formData.dias_detalle.length >= 2 && (
                          <div className="flex items-center gap-2 mb-1">
                            <select
                              value={dia.estado || formData.estado || 'programado'}
                              onChange={(e) => {
                                const newDiasDetalle = [...(formData.dias_detalle || [])];
                                const isFinalizado = e.target.value === 'finalizado';
                                
                                newDiasDetalle[index] = { 
                                  ...dia, 
                                  estado: e.target.value as EstadoTrabajo,
                                  completado: isFinalizado ? true : dia.completado,
                                  completado_en: isFinalizado && !dia.completado ? new Date() : dia.completado_en
                                };
                                
                                const completedCount = newDiasDetalle.filter(d => d.completado).length;
                                const totalDays = newDiasDetalle.length;
                                const newProgress = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
                                
                                setFormData({ ...formData, dias_detalle: newDiasDetalle, progreso: newProgress });
                              }}
                              className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 max-w-[120px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="programado">Programado</option>
                              <option value="en_proceso">En Proceso</option>
                              <option value="finalizado">Finalizado</option>
                              <option value="cancelado">Cancelado</option>
                            </select>
                          </div>
                        )}
                        {dia.completado && dia.completado_en && (
                          <span className="text-[9px] text-blue-500 font-bold">
                            Completado el {format(dia.completado_en, "d/MM HH:mm")}
                          </span>
                        )}
                        {dia.recursos_ajustados && (
                          <span className="text-[9px] text-amber-500 font-bold mt-0.5 flex flex-col">
                            <span>{dia.cuadrilla_diaria?.length || 0} personas, {dia.unidades_diarias?.length || 0} unidades</span>
                          </span>
                        )}
                      </div>
                    </label>

                    <div className="flex items-center gap-1 sm:self-center self-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setExpandedDayIndex(expandedDayIndex === index ? null : index);
                          setDayEmployeeSearch('');
                          setDayVehicleSearch('');
                        }}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${dia.recursos_ajustados ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} mr-2`}
                      >
                        {dia.recursos_ajustados ? 'Ajustes' : 'Ajustar'}
                      </button>
                      <div className="flex bg-white p-1 rounded-md border border-slate-100 shadow-sm">
                        <input
                          type="time"
                          value={dia.hora_inicio || '06:00'}
                          onChange={(e) => {
                            const newDiasDetalle = [...(formData.dias_detalle || [])];
                            newDiasDetalle[index] = { ...dia, hora_inicio: e.target.value };
                            setFormData({ ...formData, dias_detalle: newDiasDetalle });
                          }}
                          className="text-[10px] font-bold text-slate-600 border-none bg-transparent p-0 w-16 focus:ring-0 outline-none"
                          title="Hora inicio este día"
                        />
                        <span className="text-slate-300">-</span>
                        <input
                          type="time"
                          value={dia.hora_fin || '16:00'}
                          onChange={(e) => {
                            const newDiasDetalle = [...(formData.dias_detalle || [])];
                            newDiasDetalle[index] = { ...dia, hora_fin: e.target.value };
                            setFormData({ ...formData, dias_detalle: newDiasDetalle });
                          }}
                          className="text-[10px] font-bold text-slate-600 border-none bg-transparent p-0 w-16 focus:ring-0 outline-none"
                          title="Hora fin este día"
                        />
                      </div>
                    </div>
                  </div>
                  {expandedDayIndex === index && (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg ml-6 mt-1 mb-3 space-y-3 shadow-inner">
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                        <span className="text-[11px] font-bold text-slate-600">Habilitar recursos específicos para este día</span>
                        <input 
                          type="checkbox"
                          checked={dia.recursos_ajustados || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const newDiasDetalle = [...(formData.dias_detalle || [])];
                            newDiasDetalle[index] = { 
                              ...dia, 
                              recursos_ajustados: checked,
                              cuadrilla_diaria: checked ? (dia.cuadrilla_diaria || [...(formData.cuadrilla || [])]) : [],
                              unidades_diarias: checked ? (dia.unidades_diarias || [...(formData.unidades || [])]) : [],
                            };
                            setFormData({ ...formData, dias_detalle: newDiasDetalle });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </div>

                      {dia.recursos_ajustados && (() => {
                        const currentEmpList = dia.cuadrilla_diaria || [];
                        const filteredEmps = employees.filter(emp => emp.name.toLowerCase().includes(dayEmployeeSearch.toLowerCase()));
                        const selectedEmps = filteredEmps.filter(emp => currentEmpList.includes(emp.name) || currentEmpList.includes(emp.id));
                        const unselectedEmps = filteredEmps.filter(emp => !(currentEmpList.includes(emp.name) || currentEmpList.includes(emp.id)));
                        unselectedEmps.sort((a, b) => a.name.localeCompare(b.name));
                        const displayEmps = [...selectedEmps, ...unselectedEmps];

                        const currentVehList = dia.unidades_diarias || [];
                        const filteredVehs = VEHICLES.filter(v => v.label.toLowerCase().includes(dayVehicleSearch.toLowerCase()));
                        const selectedVehs = filteredVehs.filter(v => currentVehList.includes(v.value));
                        const unselectedVehs = filteredVehs.filter(v => !currentVehList.includes(v.value));
                        unselectedVehs.sort((a, b) => a.label.localeCompare(b.label));
                        const displayVehs = [...selectedVehs, ...unselectedVehs];

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                Personal Presente
                              </label>
                              <div className="relative mb-2">
                                <input
                                  type="text"
                                  placeholder="Buscar personal..."
                                  value={dayEmployeeSearch}
                                  onChange={(e) => setDayEmployeeSearch(e.target.value)}
                                  className="w-full text-[11px] border border-slate-200 rounded p-1.5 focus:outline-none focus:border-blue-400 bg-white"
                                />
                              </div>
                              <div className="max-h-[160px] overflow-y-auto border border-slate-100 rounded-md p-1 bg-slate-50 space-y-1 custom-scrollbar">
                                {displayEmps.map(emp => {
                                  const isChecked = currentEmpList.includes(emp.name) || currentEmpList.includes(emp.id);
                                  return (
                                    <label key={`emp-${emp.id}`} className={`flex items-center gap-2 text-[11px] font-medium cursor-pointer p-1.5 rounded transition-colors ${isChecked ? 'bg-amber-50 text-amber-900 border border-amber-100' : 'text-slate-700 hover:bg-slate-100 border border-transparent'}`}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          let newList = [...currentEmpList];
                                          if (isChecked) {
                                            newList = newList.filter(i => i !== emp.name && i !== emp.id);
                                          } else {
                                            newList.push(emp.name);
                                            setDayEmployeeSearch(''); // clear search on selection
                                          }
                                          const newDiasDetalle = [...(formData.dias_detalle || [])];
                                          newDiasDetalle[index] = { ...dia, cuadrilla_diaria: newList };
                                          setFormData({ ...formData, dias_detalle: newDiasDetalle });
                                        }}
                                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                                      />
                                      {emp.name}
                                    </label>
                                  );
                                })}
                                {displayEmps.length === 0 && (
                                  <div className="p-2 text-center text-[10px] text-slate-400">No se encontraron resultados</div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                Unidades Presentes
                              </label>
                              <div className="relative mb-2">
                                <input
                                  type="text"
                                  placeholder="Buscar unidad..."
                                  value={dayVehicleSearch}
                                  onChange={(e) => setDayVehicleSearch(e.target.value)}
                                  className="w-full text-[11px] border border-slate-200 rounded p-1.5 focus:outline-none focus:border-blue-400 bg-white"
                                />
                              </div>
                              <div className="max-h-[160px] overflow-y-auto border border-slate-100 rounded-md p-1 bg-slate-50 space-y-1 custom-scrollbar">
                                {displayVehs.map(v => {
                                  const isChecked = currentVehList.includes(v.value);
                                  return (
                                    <label key={`veh-${v.value}`} className={`flex items-center gap-2 text-[11px] font-medium cursor-pointer p-1.5 rounded transition-colors ${isChecked ? 'bg-amber-50 text-amber-900 border border-amber-100' : 'text-slate-700 hover:bg-slate-100 border border-transparent'}`}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          let newList = [...currentVehList];
                                          if (isChecked) {
                                            newList = newList.filter(i => i !== v.value);
                                          } else {
                                            newList.push(v.value);
                                            setDayVehicleSearch(''); // clear search
                                          }
                                          const newDiasDetalle = [...(formData.dias_detalle || [])];
                                          newDiasDetalle[index] = { ...dia, unidades_diarias: newList };
                                          setFormData({ ...formData, dias_detalle: newDiasDetalle });
                                        }}
                                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                                      />
                                      {v.label}
                                    </label>
                                  );
                                })}
                                {displayVehs.length === 0 && (
                                  <div className="p-2 text-center text-[10px] text-slate-400">No se encontraron resultados</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  </div>
                ))}
              </div>
              <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${formData.progreso || 0}%` }}
                ></div>
              </div>
            </div>
          )}

          <div>
            <label className={UI_TOKENS.TYPOGRAPHY.label + " text-slate-500 block mb-1"}>Observaciones</label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              className={`w-full ${UI_TOKENS.SPACING.inputPadding} ${UI_TOKENS.SHAPE.roundedInput} border ${UI_TOKENS.COLORS.border} outline-none focus:ring-2 focus:ring-blue-100 transition-all min-h-[60px] text-sm`}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-4 border-t border-slate-100 gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {mode === 'edit' && trabajo && (
            <>
              <ActionButton
                label="Eliminar"
                variant="danger"
                icon={<FiTrash2 />}
                onClick={handleDelete}
                disabled={loading}
                className="w-full sm:w-auto"
              />
              {trabajo.estado !== 'finalizado' && trabajo.estado !== 'cancelado' && (
                <ActionButton
                  label="Finalizar"
                  variant="warning"
                  icon={<FiCheck />}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await updateTrabajo(trabajo.id, {
                        estado: 'finalizado',
                        fecha_fin_real: new Date(),
                        cerrado_manualmente: true
                      });
                      onClose();
                    } catch (error) {
                      console.error("Error finalizando trabajo:", error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full sm:w-auto"
                />
              )}
            </>
          )}
        </div>
        
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          {error && (
            <div className="bg-[#fdecea] text-[#b71c1c] p-[10px_12px] rounded-lg text-[13px] text-center font-bold animate-shake">
              {error}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <ActionButton
              label="Cancelar"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            />
            <ActionButton
              label={loading ? 'Guardando...' : 'Aceptar'}
              variant="primary"
              icon={<FiCheck />}
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto"
            />
          </div>
        </div>
      </div>
      {showForceDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <FiAlertTriangle size={24} />
              <h2 className="text-lg font-black">Reportes ligados detectados</h2>
            </div>
            <p className="text-sm text-slate-600">
              Este trabajo tiene reportes de materiales asociados. Por defecto no puede eliminarse para mantener la integridad del sistema.
            </p>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmarEliminacion}
                onChange={(e) => setConfirmarEliminacion(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Confirmo que deseo eliminar este reporte manualmente
            </label>
            <p className="text-[10px] text-slate-400">
              Esta acción eliminará el reporte incluso si está ligado a un trabajo.
            </p>
            <div className="flex gap-2 pt-4">
              <ActionButton label="Entendido" variant="secondary" onClick={() => setShowForceDeleteModal(false)} className="flex-1" />
              <ActionButton 
                label={confirmarEliminacion ? "ELIMINAR" : "Entendido"}
                variant="danger" 
                onClick={handleForceDelete} 
                disabled={!confirmarEliminacion || loading}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
