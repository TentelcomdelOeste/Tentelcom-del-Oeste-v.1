import React, { useMemo, useState } from 'react';
import { Trabajo } from './types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiClock, FiUser, FiTruck, FiChevronDown, FiCalendar, FiUsers, FiMapPin } from 'react-icons/fi';
import { ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/utils/permissions';

interface DetailedWeekViewProps {
  trabajos: Trabajo[];
  onSelect: (t: Trabajo) => void;
  currentDate: Date;
  onSetActiveModule?: (moduleData: string | { module: string; selectedId?: string; state?: any }) => void;
  isLoading?: boolean;
}

const ACCENT_COLORS: Record<string, { bar: string; border: string }> = {
  'programado': { bar: 'bg-blue-600', border: 'border-l-blue-600' },
  'en_proceso': { bar: 'bg-emerald-600', border: 'border-l-emerald-600' },
  'finalizado': { bar: 'bg-slate-400', border: 'border-l-slate-400' },
  'en_espera': { bar: 'bg-amber-500', border: 'border-l-amber-500' },
  'cancelado': { bar: 'bg-red-500', border: 'border-l-red-500' },
  'reprogramado': { bar: 'bg-orange-500', border: 'border-l-orange-500' },
};

const formatUnitName = (unitValue: string) => {
  if (!unitValue) return 'N/A';
  
  const codeToName: Record<string, string> = {
    'U1': 'PATHFINDER',
    'U2': 'KIA BONGO',
    'U3': 'MERCEDES',
    'U4': 'KIA MORNING',
    'U5': 'NISSAN UD',
    'U6': 'HYUNDAI HD',
    'U7': 'VOLKSWAGEN',
    'U8': 'SUZUKI'
  };

  if (codeToName[unitValue]) return codeToName[unitValue];

  const parts = unitValue.split(' - ');
  if (parts.length >= 2) {
    const name = parts[1].trim();
    const nameMaps: Record<string, string> = {
      'NISSAN PATHFINDER': 'PATHFINDER',
      'MERCEDES BENZ': 'MERCEDES',
      'VOLKSWAGEN CROSS': 'VOLKSWAGEN',
      'SUZUKI GRAN VITARA': 'SUZUKI',
      'NISSAN UD 1400': 'NISSAN UD'
    };
    return nameMaps[name] || name;
  }

  return unitValue;
};

const getVehicleBadgeStyle = (unitValue: string) => {
  const norm = (unitValue || '').toUpperCase();
  if (norm.includes('BONGO') || norm.includes('U2') || norm.includes('KIA')) {
    return 'bg-blue-100/90 text-blue-950 border-blue-200';
  }
  if (norm.includes('HILUX')) {
    return 'bg-amber-100/90 text-amber-950 border-amber-200';
  }
  if (norm.includes('NISSAN') || norm.includes('UD') || norm.includes('U5')) {
    return 'bg-emerald-100/90 text-emerald-950 border-emerald-200';
  }
  if (norm.includes('HYUNDAI') || norm.includes('HD') || norm.includes('U6')) {
    return 'bg-orange-100/90 text-orange-950 border-orange-200';
  }
  if (norm.includes('MITSUBISHI')) {
    return 'bg-sky-100/90 text-sky-950 border-sky-200';
  }
  if (norm.includes('PATHFINDER') || norm.includes('MERCEDES') || norm.includes('U1') || norm.includes('U3')) {
    return 'bg-purple-100/90 text-purple-950 border-purple-200';
  }
  return 'bg-slate-100 text-slate-800 border-slate-200';
};

const DetailedJobCard: React.FC<{
  job: Trabajo;
  onSelect: (t: Trabajo) => void;
  onSetActiveModule?: (m: any) => void;
}> = ({ job, onSelect, onSetActiveModule }) => {
  const [expanded, setExpanded] = useState(false);
  const { currentUser } = useAuth();

  const accent = ACCENT_COLORS[job.estado] || ACCENT_COLORS['programado'];

  return (
    <div 
      onClick={() => onSelect(job)}
      className={`group relative flex flex-col bg-white hover:bg-slate-50/90 transition-all cursor-pointer rounded-xl border border-slate-200 shadow-2xs overflow-hidden border-l-[3.5px] ${accent.border}`}
    >
      {/* Header: Title + Expand Button */}
      <div className="flex items-start justify-between p-2 pb-0.5 gap-1.5">
        <h3 
          className="text-[11px] font-black text-blue-950 uppercase tracking-tight leading-snug line-clamp-2 break-words"
          title={job.titulo || job.tipo_trabajo}
        >
          {job.titulo || job.tipo_trabajo || 'TRABAJO PROGRAMADO'}
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-500 transition-transform shrink-0"
          aria-label="Expandir detalle"
          title="Ver más información"
        >
          <FiChevronDown size={13} className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Horario */}
      <div className="px-2 py-0.5 flex items-center gap-1.5 text-[9.5px] font-bold text-slate-700">
        <FiClock size={10} className="text-slate-400 shrink-0" />
        <span className="leading-none">
          {job.hora_inicio && job.hora_fin ? `${job.hora_inicio} - ${job.hora_fin}` : 'Sin horario'}
        </span>
      </div>

      {/* Personal Asignado en 2 Columnas */}
      <div className="px-2 py-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-[8.5px] font-black text-slate-500 uppercase tracking-widest leading-none">
          <FiUsers size={10} className="text-slate-400 shrink-0" />
          <span>PERSONAL</span>
        </div>
        {job.cuadrilla && job.cuadrilla.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 pt-0.5">
            {job.cuadrilla.map((member, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-1 text-[9px] font-bold text-slate-800 leading-tight min-w-0"
                title={member}
              >
                <FiUser size={8.5} className="text-slate-400 shrink-0" />
                <span className="truncate">{member}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[8.5px] font-medium text-slate-400 italic">Sin personal</span>
        )}
      </div>

      {/* Unidades Vehiculares */}
      <div className="p-2 pt-0.5 flex flex-wrap gap-1">
        {job.unidades && job.unidades.length > 0 ? (
          job.unidades.map((u, idx) => {
            const formattedName = formatUnitName(u);
            const badgeClass = getVehicleBadgeStyle(formattedName);
            return (
              <div 
                key={idx} 
                className={`px-1.5 py-0.5 rounded border flex items-center gap-1 text-[8.5px] font-black tracking-tight ${badgeClass}`}
                title={formattedName}
              >
                <FiTruck size={9} className="shrink-0" />
                <span className="truncate uppercase">{formattedName}</span>
              </div>
            );
          })
        ) : (
          <div className="px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 flex items-center gap-1 text-[8.5px] font-bold">
            <FiTruck size={9} className="shrink-0 opacity-50" />
            <span>SIN UNIDAD</span>
          </div>
        )}
      </div>

      {/* Contenido Desplegable Completo */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/90 text-xs p-2 space-y-1.5"
          >
            {job.otCode && (
              <div className="flex items-center gap-1 text-[9px]">
                <span className="font-black text-slate-400 uppercase tracking-widest">OT:</span>
                <span className="font-mono font-bold text-blue-700">{job.otCode}</span>
              </div>
            )}

            {job.projectName && (
              <div className="flex items-center gap-1 text-[9px]">
                <span className="font-black text-slate-400 uppercase tracking-widest">Proyecto:</span>
                <span className="font-bold text-slate-800 truncate" title={job.projectName}>{job.projectName}</span>
              </div>
            )}

            {job.ubicacion && (
              <div className="flex items-center gap-1 text-slate-700 text-[9px]">
                <FiMapPin size={9} className="text-slate-400 shrink-0" />
                <span className="font-semibold truncate" title={job.ubicacion}>{job.ubicacion}</span>
              </div>
            )}

            {(job.descripcion || job.observaciones) && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Detalle</span>
                <p className="text-[9px] text-slate-600 font-medium italic bg-white p-1.5 rounded border border-slate-200">
                  {job.descripcion || job.observaciones}
                </p>
              </div>
            )}

            {(isAdmin(currentUser?.role) || currentUser?.canUseOperationalLog) && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    let actualParentId = job.registroBitacoraId;
                    if (!actualParentId && job.bitacoraIds && job.bitacoraIds.length > 0) {
                      actualParentId = job.bitacoraIds[job.bitacoraIds.length - 1];
                    }
                    if (!actualParentId && job.bitacorasRelacionadas && job.bitacorasRelacionadas.length > 0) {
                      actualParentId = job.bitacorasRelacionadas[job.bitacorasRelacionadas.length - 1].bitacoraId;
                    }

                    onSetActiveModule?.({
                      module: 'operational_log',
                      selectedId: job.id,
                      state: {
                        parentId: actualParentId || job.id,
                        parentCollection: actualParentId ? 'bitacora_vehiculos' : 'trabajos'
                      }
                    });
                  }}
                  className="w-full py-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold flex items-center justify-center gap-1 border border-indigo-200 transition-colors"
                >
                  <ClipboardList size={11} />
                  <span>BITÁCORA OPERATIVA</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DetailedWeekView: React.FC<DetailedWeekViewProps> = ({
  trabajos,
  onSelect,
  currentDate,
  onSetActiveModule,
  isLoading
}) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const allSevenDays = useMemo(() => {
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const getNominalDay = (date: any): string => {
      if (!date) return '';
      const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return days.map(day => {
      const dayKey = format(day, 'yyyy-MM-dd');

      const dayJobs = trabajos.filter(t => {
        if (!t.fecha_inicio) return false;

        if (t.dias_detalle && t.dias_detalle.length > 0) {
          return t.dias_detalle.some(d => getNominalDay(d.fecha) === dayKey);
        }

        const startKey = getNominalDay(t.fecha_inicio);
        const endKey = getNominalDay(t.fecha_fin || t.fecha_inicio);
        return dayKey >= startKey && dayKey <= endKey;
      }).map(t => {
        let dailyState = t.estado;
        let dailyCuadrilla = t.cuadrilla;
        let dailyUnidades = t.unidades;
        let dailyHoraInicio = t.hora_inicio;
        let dailyHoraFin = t.hora_fin;

        if (t.dias_detalle) {
          const dia = t.dias_detalle.find(d => getNominalDay(d.fecha) === dayKey);
          if (dia) {
            if (dia.estado) dailyState = dia.estado;
            if (dia.hora_inicio) dailyHoraInicio = dia.hora_inicio;
            if (dia.hora_fin) dailyHoraFin = dia.hora_fin;
            if (dia.cuadrilla_diaria && dia.cuadrilla_diaria.length > 0) {
              dailyCuadrilla = dia.cuadrilla_diaria;
            }
            if (dia.unidades_diarias && dia.unidades_diarias.length > 0) {
              dailyUnidades = dia.unidades_diarias;
            }
          }
        }

        return {
          ...t,
          estado: dailyState,
          cuadrilla: dailyCuadrilla,
          unidades: dailyUnidades,
          hora_inicio: dailyHoraInicio,
          hora_fin: dailyHoraFin
        };
      }).sort((a, b) => (a.hora_inicio || '00:00').localeCompare(b.hora_inicio || '00:00'));

      return { day, jobs: dayJobs };
    });
  }, [trabajos, weekStart, weekEnd]);

  // Regla dinámica:
  // Lunes a Viernes se muestran SIEMPRE.
  // Sábado y Domingo se ocultan automáticamente si no tienen trabajos.
  const visibleDays = useMemo(() => {
    return allSevenDays.filter(({ day, jobs }) => {
      const dayOfWeek = getDay(day); // 0 = Domingo, 6 = Sábado
      if (dayOfWeek === 6 || dayOfWeek === 0) {
        return jobs.length > 0;
      }
      return true;
    });
  }, [allSevenDays]);

  // Distribución del ancho disponible según cantidad de columnas activas (5, 6 o 7)
  const gridColsClass = useMemo(() => {
    const count = visibleDays.length;
    if (count <= 5) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
    if (count === 6) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7';
  }, [visibleDays.length]);

  return (
    <div className="w-full bg-slate-100/40 p-2 md:p-2.5 rounded-2xl border border-slate-200/80 overflow-x-auto custom-scrollbar">
      <div className={`grid ${gridColsClass} gap-2.5 min-w-[750px] lg:min-w-0 items-start`}>
        {visibleDays.map(({ day, jobs }) => {
          const dayName = format(day, "EEEE", { locale: es }).toUpperCase();
          const dayNumber = format(day, "d");
          const jobCountLabel = `${jobs.length} ${jobs.length === 1 ? 'TRABAJO' : 'TRABAJOS'}`;

          return (
            <div 
              key={day.toISOString()} 
              className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden h-[calc(100vh-215px)] min-h-[480px]"
            >
              {/* Header de la Columna Día - Compacto en 1 sola línea horizontal - Fijo / Sticky al tope */}
              <div className="flex items-center justify-center px-1 sm:px-2 py-1.5 bg-slate-50/95 border-b border-slate-200 text-center gap-1 sm:gap-1.5 shrink-0 sticky top-0 z-10 shadow-2xs whitespace-nowrap min-h-[30px] overflow-hidden">
                <span className="text-[10px] xl:text-[11px] font-black text-blue-950 uppercase tracking-tight">
                  {dayName} {dayNumber}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[8px] xl:text-[8.5px] font-bold uppercase tracking-wider bg-blue-100/90 text-blue-800 border border-blue-200 shrink-0 leading-none">
                  [{jobCountLabel}]
                </span>
              </div>

              {/* Lista de Trabajos con Scroll Vertical Independiente */}
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto custom-scrollbar bg-slate-50/20">
                {isLoading ? (
                  <div className="p-1.5 space-y-1.5 animate-pulse">
                    <div className="h-20 bg-slate-100 rounded-lg"></div>
                    <div className="h-20 bg-slate-100 rounded-lg"></div>
                  </div>
                ) : jobs.length > 0 ? (
                  jobs.map(job => (
                    <DetailedJobCard
                      key={job.id}
                      job={job}
                      onSelect={onSelect}
                      onSetActiveModule={onSetActiveModule}
                    />
                  ))
                ) : (
                  <div className="h-full min-h-[260px] flex flex-col items-center justify-center p-3 text-center border-2 border-dashed border-slate-200/70 rounded-xl my-1 bg-white/50 text-slate-400 gap-1.5 select-none">
                    <FiCalendar size={22} className="text-slate-300 stroke-[1.5]" />
                    <span className="text-[11px] font-black text-slate-600 tracking-tight block">
                      Sin trabajos
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium leading-tight max-w-[120px] block">
                      No hay trabajos asignados para este día
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
