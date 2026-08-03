import React, { useMemo, useState } from 'react';
import { Trabajo } from './types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiClock, FiUser, FiTruck, FiBox, FiChevronDown, FiUsers, FiCalendar } from 'react-icons/fi';
import { ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, hasPermission } from '@/utils/permissions';
import { IconButton } from '@/design-system';

interface OperativoViewProps {
  trabajos: Trabajo[];
  onSelect: (t: Trabajo) => void;
  currentDate: Date;
  onSetActiveModule?: (moduleData: string | { module: string; selectedId?: string }) => void;
  isLoading?: boolean;
}

const SkeletonJobCard = () => (
  <div className="flex flex-col bg-slate-50/50 rounded-[10px] border border-slate-100/50 p-2 px-3 gap-2 animate-pulse">
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
      <div className="h-2 w-16 bg-slate-200 rounded"></div>
    </div>
    <div className="h-3 w-3/4 bg-slate-200 rounded"></div>
    <div className="flex gap-2">
      <div className="h-2 w-10 bg-slate-100 rounded"></div>
      <div className="h-2 w-10 bg-slate-100 rounded"></div>
    </div>
  </div>
);

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; border: string }> = {
  'programado': { label: 'PROGRAMADO', color: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  'en_proceso': { label: 'EN PROCESO', color: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  'finalizado': { label: 'FINALIZADO', color: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' },
  'en_espera': { label: 'EN ESPERA', color: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  'cancelado': { label: 'CANCELADO', color: 'text-red-700', dot: 'bg-red-400', border: 'border-red-200' },
  'reprogramado': { label: 'REPROGRAMADO', color: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
};

const JobCard = React.memo(({ job, onSelect, onSetActiveModule }: { job: Trabajo; onSelect: (t: Trabajo) => void; onSetActiveModule?: (m: any) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[job.estado] || STATUS_CONFIG['programado'];
  const { currentUser } = useAuth();
  
  // Helper to get First Name + First Last Name
  const formatShortName = (fullName: string) => {
    if (!fullName) return 'S/A';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    return `${parts[0]} ${parts[1]}`;
  };

  const formatUnitName = (unitValue: string) => {
    if (!unitValue) return 'N/A';
    
    // Exact mapping from code (value) to summarized name
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

    // If it's a code, return mapped name
    if (codeToName[unitValue]) return codeToName[unitValue];

    // Fallback logic if it's already a full label "UX - NAME - PIN/PLATE"
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

  const leader = job.cuadrilla?.[0] ? formatShortName(job.cuadrilla[0]) : 'S/A';
  const unit = job.unidades?.[0] ? formatUnitName(job.unidades[0]) : 'N/A';

  return (
    <div 
      onClick={() => onSelect(job)}
      className="group relative flex flex-col bg-white hover:bg-slate-50/80 active:bg-slate-100/50 transition-colors cursor-pointer rounded-[10px] border border-slate-100/80 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.05)]"
    >
      {/* Acento lateral delgado */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 opacity-80 ${config.dot}`}></div>

      <div className="flex items-center p-2 px-3 gap-3">
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          {/* Status Line */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></div>
            <span className={`text-[8px] font-black tracking-widest ${config.color} uppercase truncate overflow-hidden`}>
              {config.label}
            </span>
          </div>
          
          {/* Title Line */}
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight leading-tight truncate">
            {job.titulo || job.tipo_trabajo}
          </h3>

          {/* Metadata Row - Only show redundant info if NOT expanded */}
          <div className="flex items-center gap-2 text-slate-500 whitespace-nowrap overflow-hidden h-4 transition-all">
            {!expanded && (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  <FiUser size={10} className="text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-600 truncate max-w-[80px]">{leader || 'S/A'}</span>
                </div>
                <span className="text-slate-200">|</span>
                <div className="flex items-center gap-1 shrink-0">
                  <FiTruck size={10} className="text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-600 tracking-tight">{unit || 'N/A'}</span>
                </div>
                <span className="text-slate-200">|</span>
              </>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <FiClock size={10} className="text-slate-400" />
              <span className="text-[9px] font-bold text-slate-600 tracking-tight">{job.hora_inicio} - {job.hora_fin}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(isAdmin(currentUser?.role) || currentUser?.canUseOperationalLog || hasPermission(currentUser, 'trabajos')) && (
            <div className="mr-2">
              <IconButton 
                icon={<ClipboardList size={11} />} 
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
                variant="neutral"
                title={job.registroBitacoraId || job.bitacoraIds?.length || job.bitacorasRelacionadas?.length ? "Ver Bitácora de Unidad" : "Bitácora Operativa"}
                className={`!w-[22px] !h-[22px] !p-0 !rounded-md ${job.registroBitacoraId || job.bitacoraIds?.length || job.bitacorasRelacionadas?.length ? 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200'}`}
              />
            </div>
          )}

          {/* Botón de Expansión Secundario */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className={`p-1.5 rounded-lg transition-all ${expanded ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-100' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
          >
            <FiChevronDown size={14} className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-slate-50 bg-slate-50/30"
          >
            <div className="p-3 pt-2 pl-4 md:pl-10 flex flex-col gap-3 pb-3">
              {/* Cuadrilla */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <FiUsers size={10} className="text-slate-400" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cuadrilla Asignada</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {job.cuadrilla && job.cuadrilla.length > 0 ? (
                    job.cuadrilla.map((member, idx) => (
                      <div key={idx} className="bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs flex items-center gap-1">
                        <span className="text-[10px]">👷</span>
                        <span className="text-[9px] font-bold text-slate-700 whitespace-nowrap">{formatShortName(member)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[9px] font-medium text-slate-400 italic">Sin colaboradores asignados</span>
                  )}
                </div>
              </div>

              {/* Unidades */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <FiTruck size={10} className="text-slate-400" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Unidades</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {job.unidades && job.unidades.length > 0 ? (
                    job.unidades.map((u, idx) => (
                      <div key={idx} className="bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs flex items-center gap-1">
                        <span className="text-[10px]">🚘</span>
                        <span className="text-[9px] font-bold text-slate-700">{formatUnitName(u)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[9px] font-medium text-slate-400 italic">Sin unidades asignadas</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

JobCard.displayName = 'JobCard';


export const OperativoView: React.FC<OperativoViewProps> = ({ trabajos, onSelect, currentDate, onSetActiveModule, isLoading }) => {
  const [renderedDays, setRenderedDays] = useState(1);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Progressive rendering for days to improve perceived speed
  React.useEffect(() => {
    if (renderedDays < 7) {
      const timeout = setTimeout(() => setRenderedDays(prev => prev + 2), 50);
      return () => clearTimeout(timeout);
    }
  }, [renderedDays]);

  // Reset progressive rendering when date changes
  React.useEffect(() => {
    setRenderedDays(1);
  }, [currentDate]);

  const groupedByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    // Normalización robusta para agrupar por día nominal (local)
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
        
        // 1. Si tiene días detalle, buscar coincidencia nominal
        if (t.dias_detalle && t.dias_detalle.length > 0) {
          return t.dias_detalle.some(d => getNominalDay(d.fecha) === dayKey);
        }
        
        // 2. Fallback para rangos (trabajos legacy)
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
            if (dia.recursos_ajustados) {
              dailyCuadrilla = dia.cuadrilla_diaria || t.cuadrilla;
              dailyUnidades = dia.unidades_diarias || t.unidades;
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

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-100/50 min-h-screen pb-20">
      {/* Grupos por Día */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4 items-start">
        {groupedByDay.map(({ day, jobs }, index) => {
          if (index >= renderedDays && !isLoading) return null;
          
          return (
            <div key={day.toISOString()} className="flex flex-col bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
              {/* Header del Día */}
              <div className="relative flex items-center justify-between px-3 py-2.5 bg-slate-50/80 border-b border-slate-100/80">
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-500/70 rounded-r-full"></div>
                <div className="flex items-center gap-2 pl-1.5">
                  <FiCalendar size={14} className="text-slate-400" />
                  <h2 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                    {format(day, "EEEE d MMMM", { locale: es })}
                  </h2>
                </div>
                <div className="flex items-center">
                  {!isLoading && (
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider opacity-80">
                      {jobs.length} {jobs.length === 1 ? 'trabajo' : 'trabajos'}
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de Trabajos */}
              <div className="flex flex-col p-1.5 gap-1.5 bg-slate-50/20">
                {isLoading ? (
                  <>
                    <SkeletonJobCard />
                    <SkeletonJobCard />
                  </>
                ) : (
                  jobs.map(job => (
                    <JobCard key={job.id} job={job} onSelect={onSelect} onSetActiveModule={onSetActiveModule} />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {!isLoading && groupedByDay.every(g => g.jobs.length === 0) && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <FiBox size={24} className="opacity-40" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sin actividad programada</p>
          </div>
        )}
      </div>
    </div>
  );
};
