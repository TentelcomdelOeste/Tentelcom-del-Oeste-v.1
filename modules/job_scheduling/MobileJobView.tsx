import React, { useState, useEffect } from 'react';
import { Trabajo } from './types';
import { StatusBadge, IconButton } from '@/design-system';
import { ClipboardList } from 'lucide-react';
import { FiMapPin, FiClock, FiCalendar, FiFileText, FiAlertCircle, FiEye } from 'react-icons/fi';
import { FaFilePdf } from 'react-icons/fa';
import { useMaterialReports } from '@/hooks/useMaterialReports';
import { useEmployees } from '@/hooks/useEmployees';
import { generateConsolidatedMaterialReportPDF } from '@/utils/materialReportPdf';
import { obtenerGrupoTrabajo, updateTrabajo } from './jobService';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/utils/permissions';
import { FiPauseCircle } from 'react-icons/fi';
import { ViewJobModal } from './ViewJobModal';

interface MobileJobViewProps {
  trabajos: Trabajo[];
  onSelect: (trabajo: Trabajo) => void;
  onSetActiveModule?: (moduleData: string | { 
    module: string; 
    selectedId?: string; 
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
    state?: any;
  }) => void;
  isAgendaView?: boolean;
  onContinuar?: (trabajo: Trabajo) => void;
  isLoading?: boolean;
}

const SkeletonMobileItem = () => (
  <div className="bg-white p-3 lg:p-2.5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full animate-pulse">
    <div className="flex justify-between items-start mb-2">
      <div className="flex-1 space-y-1.5">
        <div className="h-2 w-20 bg-slate-200 rounded"></div>
        <div className="h-3 w-3/4 bg-slate-200 rounded"></div>
      </div>
      <div className="h-5 w-14 bg-slate-100 rounded-full"></div>
    </div>
    <div className="space-y-1.5 mb-3">
      <div className="h-2 w-1/2 bg-slate-100 rounded"></div>
      <div className="h-2 w-1/2 bg-slate-100 rounded"></div>
      <div className="h-2 w-2/3 bg-slate-100 rounded"></div>
    </div>
    <div className="mt-auto pt-2 border-t border-slate-50 flex gap-2 justify-end">
      <div className="h-7 w-7 bg-slate-50 rounded-lg"></div>
      <div className="h-7 w-7 bg-slate-50 rounded-lg"></div>
    </div>
  </div>
);

const getTimestamp = (date: any) => {
  if (!date) return 0;

  if (typeof date.toMillis === "function") {
    return date.toMillis();
  }

  if (date.seconds) {
    return date.seconds * 1000;
  }

  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const getStatusVariant = (status: string) => {
  const s = typeof status === 'string' ? status : String(status);
  switch (s) {
    case 'programado': return 'info';
    case 'en_proceso': return 'success';
    case 'finalizado': return 'neutral';
    case 'cancelado': return 'danger';
    case 'reprogramado': return 'warning';
    default: return 'neutral';
  }
};

const getStatusLabel = (status: string) => {
  const s = typeof status === 'string' ? status : String(status);
  switch (s) {
    case 'programado': return 'En espera';
    case 'en_proceso': return 'En proceso';
    case 'finalizado': return 'Finalizado';
    case 'cancelado': return 'Cancelado';
    case 'reprogramado': return 'Reprogramado';
    default: return s;
  }
};

const JobItem = React.memo(({ 
  trabajo, 
  onSelect, 
  onSetActiveModule, 
  getCrewName, 
  getLatestReport, 
  handleDownloadPDF
}: { 
  trabajo: Trabajo; 
  onSelect: (t: Trabajo) => void;
  onSetActiveModule?: (data: any) => void;
  getCrewName: (id: string) => string;
  getLatestReport: (id: string) => any;
  handleDownloadPDF: (t: Trabajo, e: any) => void;
}) => {
  const [selectedTrabajoView, setSelectedTrabajoView] = useState<Trabajo | null>(null);
  const { currentUser } = useAuth();
  
  const { estado: displayEstado, cuadrilla: displayCuadrilla, unidades: displayUnidades } = {
    estado: trabajo.estado,
    cuadrilla: trabajo.cuadrilla || [],
    unidades: trabajo.unidades || []
  };
  const estadoNormalizado = (displayEstado || '').toLowerCase().trim();

  return (
    <>
      <div 
        className="bg-white p-3 lg:p-2.5 rounded-2xl shadow-sm border border-slate-100 active:scale-[0.98] transition-transform flex flex-col h-full" 
        onClick={() => onSelect(trabajo)}
      >
        <div className="flex justify-between items-start mb-0.5">
          <div className="flex flex-col flex-1 mr-2">
            {trabajo?.otCode && (
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest truncate max-w-[150px]">
                  {trabajo.otCode} • {trabajo?.tipo_trabajo || ""}
                </span>
                {trabajo.esSubTrabajo ? (
                  <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[7px] font-black tracking-wider shrink-0">HIJO</span>
                ) : (
                  <span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[7px] font-black tracking-wider shrink-0">PRINCIPAL</span>
                )}
              </div>
            )}
            <h3 className="font-black text-blue-950 text-xs lg:text-[13px] uppercase tracking-tight leading-tight line-clamp-2">
               {trabajo?.titulo || trabajo?.tipo_trabajo || ""}
            </h3>
          </div>
          <StatusBadge 
            label={getStatusLabel(displayEstado || '')} 
            variant={getStatusVariant(displayEstado || '') as any} 
            className="shrink-0 max-w-[75px] scale-90 origin-top-right"
          />
        </div>
        
        <div className="space-y-1 flex-1 mt-1.5">
          <div className="flex items-center gap-2 text-slate-500">
            <FiCalendar size={11} />
            <span className="text-[10px] font-bold uppercase">
              {(() => {
                const getUtcDate = (dateVal: any) => {
                  if (!dateVal) return null;
                  const ts = getTimestamp(dateVal);
                  if (ts <= 0) return null;
                  return new Date(ts);
                };

                const start = getUtcDate(trabajo.fecha_inicio);
                const end = getUtcDate(trabajo.fecha_fin);

                if (!start) return "";

                const startFmt = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", timeZone: "UTC" }).format(start);
                
                if (!end || start.getTime() === end.getTime()) {
                  return startFmt;
                }

                const endFmt = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", timeZone: "UTC" }).format(end);
                return `${startFmt} - ${endFmt}`;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <FiClock size={11} />
            <span className="text-[10px] font-bold">
              {trabajo?.hora_inicio || ""} - {trabajo?.hora_fin || ""}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <FiMapPin size={11} className="text-blue-500 flex-shrink-0" />
            <span className="text-[10px] font-bold truncate">
              {trabajo?.ubicacion || ""}
            </span>
          </div>
        </div>

        {trabajo?.dias_programados && trabajo.dias_programados > 1 && (
          <div className="mt-1.5">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] font-bold text-slate-500">Progreso</span>
              <span className="text-[9px] font-bold text-blue-600">
                {trabajo.dias_detalle?.filter(d => d.completado).length || 0} de {trabajo.dias_programados}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${trabajo.progreso || 0}%` }}
              ></div>
            </div>
          </div>
        )}
         <div className="mt-auto pt-2 border-t border-slate-50 flex flex-col gap-2">
          
          {/* Cuadrilla / Unidades */}
          <div className="space-y-1.5">
            {/* Cuadrilla */}
            {(!displayCuadrilla || displayCuadrilla.length === 0) ? (
              <span className="block text-[9px] text-slate-400 italic font-medium">Sin personal</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {displayCuadrilla.map((c: string, idx: number) => (
                  <span key={`crew-${idx}`} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[9px] font-bold truncate max-w-full">
                    {getCrewName(c)}
                  </span>
                ))}
              </div>
            )}

            {/* Unidades */}
            {(!displayUnidades || displayUnidades.length === 0) ? (
              <span className="block text-[9px] text-slate-400 italic font-medium">Sin unidades</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {displayUnidades.map((u: string, idx: number) => (
                  <span key={`unit-${idx}`} className="bg-purple-50 border border-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-bold truncate max-w-full">
                    {u}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Botones de accion */}
          <div className="flex gap-1 justify-end border-t border-slate-50 pt-1.5">
            {(isAdmin(currentUser?.role) || currentUser?.canUseOperationalLog) && (
              <IconButton 
                icon={<ClipboardList size={12} />} 
                onClick={(e) => {
                  e.stopPropagation();
                  
                  let actualParentId = trabajo.registroBitacoraId;
                  if (!actualParentId && trabajo.bitacoraIds && trabajo.bitacoraIds.length > 0) {
                      actualParentId = trabajo.bitacoraIds[trabajo.bitacoraIds.length - 1];
                  }
                  if (!actualParentId && trabajo.bitacorasRelacionadas && trabajo.bitacorasRelacionadas.length > 0) {
                      actualParentId = trabajo.bitacorasRelacionadas[trabajo.bitacorasRelacionadas.length - 1].bitacoraId;
                  }

                  onSetActiveModule?.({
                    module: 'operational_log',
                    selectedId: trabajo.id,
                    state: {
                      parentId: actualParentId || trabajo.id,
                      parentCollection: actualParentId ? 'bitacora_vehiculos' : 'trabajos'
                    }
                  });
                }}
                variant="neutral"
                title={trabajo.registroBitacoraId || trabajo.bitacoraIds?.length || trabajo.bitacorasRelacionadas?.length ? "Ver Bitácora de Unidad" : "Bitácora Operativa"}
                className={`!w-[26px] !h-[26px] !p-0 !rounded-md ${trabajo.registroBitacoraId || trabajo.bitacoraIds?.length || trabajo.bitacorasRelacionadas?.length ? 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200'}`}
              />
            )}
            <IconButton 
              icon={<FiEye />} 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTrabajoView(trabajo);
              }}
              variant="secondary"
              title="Visualizar trabajo"
              className="!w-8 !h-8 !p-0 !rounded-lg"
            />
            {estadoNormalizado !== 'finalizado' && estadoNormalizado !== 'cancelado' && estadoNormalizado !== 'en_espera' && (
              <IconButton 
                icon={<FiPauseCircle />} 
                onClick={async (e) => {
                  e.stopPropagation();
                  const previousEstado = trabajo.estado;
                  await updateTrabajo(trabajo.id, { estado: 'en_espera' });
                  
                  // Persistencia de evento operativo (Independiente de permisos visuales)
                  const { createSystemEvent } = await import('./jobService');
                  await createSystemEvent(
                    trabajo.timelineId || trabajo.id, 
                    "status_change", 
                    { 
                      previousEstado, 
                      newEstado: 'en_espera',
                      motivo: "Puesto en espera desde vista móvil" 
                    }
                  );
                }}
                variant="secondary"
                title="Poner en espera"
                className="!w-8 !h-8 !p-0 !rounded-lg"
              />
            )}
            <IconButton 
              icon={<FiFileText />} 
              onClick={(e) => {
                e.stopPropagation();
                const report = getLatestReport(trabajo.id);

                if (report && report.id) {
                  onSetActiveModule?.({
                    module: 'material_report',
                    selectedId: report.id,
                    jobId: trabajo.id,
                    state: { source: 'job_scheduling' }
                  });
                } else {
                  onSetActiveModule?.({
                    module: 'material_report',
                    jobId: trabajo.id,
                    otCode: trabajo.otCode,
                    selectedKey: trabajo.tipo_trabajo,
                    state: { source: 'job_scheduling' }
                  });
                }
              }}
              variant="primary"
              title="Crear/Editar Reporte de Materiales"
              className="!w-8 !h-8 !p-0 !rounded-lg"
            />
            {getLatestReport(trabajo.id) && (
              <IconButton 
                icon={<FaFilePdf />} 
                onClick={(e) => handleDownloadPDF(trabajo, e)}
                variant="danger"
                title="Descargar PDF de Reporte"
                className="!w-8 !h-8 !p-0 !rounded-lg"
              />
            )}
          </div>
        </div>
      </div>
      <ViewJobModal
        isOpen={!!selectedTrabajoView}
        onClose={() => setSelectedTrabajoView(null)}
        trabajo={selectedTrabajoView}
        onSetActiveModule={onSetActiveModule}
      />
    </>
  );
});

JobItem.displayName = 'JobItem';

export const MobileJobView: React.FC<MobileJobViewProps> = ({ trabajos = [], onSelect, onSetActiveModule, isAgendaView = false, isLoading }) => {
  const { currentUser } = useAuth();
  const { reports } = useMaterialReports(currentUser);
  const { employees } = useEmployees();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  // Progressive rendering for the list to improve perceived speed
  useEffect(() => {
    if (!isLoading && visibleCount < trabajos.length) {
      const timeout = setTimeout(() => setVisibleCount(prev => prev + 10), 50);
      return () => clearTimeout(timeout);
    }
  }, [visibleCount, trabajos.length, isLoading]);

  // Reset visible count when trabajos change significantly
  useEffect(() => {
    setVisibleCount(10);
  }, [trabajos.length]);

  const employeeMap = React.useMemo(() => {
    const map = new Map();
    if (Array.isArray(employees)) {
      employees.forEach(e => {
        if (e.id) map.set(e.id, e);
        if (e.name) map.set(e.name, e);
      });
    }
    return map;
  }, [employees]);

  const latestReports = React.useMemo(() => {
    if (!Array.isArray(reports)) return new Map();
    const map = new Map();
    
    reports.forEach(r => {
      if (r.jobId) map.set(String(r.jobId), r);
      if (r.otCode) map.set(String(r.otCode), r);
      if (r.project?.jobId) map.set(String(r.project.jobId), r);
    });
    return map;
  }, [reports]);

  const getLatestReport = React.useCallback((jobId: string) => {
    if (!jobId) return null;
    return latestReports.get(String(jobId)) || null;
  }, [latestReports]);

  const handleDownloadPDF = async (trabajo: Trabajo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!trabajo) return;
    
    setPdfError(null);
    
    try {
      if (!reports || !Array.isArray(reports)) {
        setPdfError("Reportes no cargados");
        return;
      }

      const grupoTrabajos = await obtenerGrupoTrabajo(trabajo.id);
      
      const consolidatedEntries = grupoTrabajos
        .map(t => {
          const report = getLatestReport(t.id);
          return report ? { trabajo: t, report } : null;
        })
        .filter((entry): entry is { trabajo: Trabajo; report: any } => entry !== null);
      
      if (consolidatedEntries.length === 0) {
        throw new Error("No se encontraron reportes para ninguno de los trabajos relacionados.");
      }
      
      await generateConsolidatedMaterialReportPDF(consolidatedEntries, currentUser);
    } catch (error: any) {
      console.error("PDF ERROR:", error);
      const errorMessage = error?.message || String(error);
      setPdfError(errorMessage);
      setTimeout(() => setPdfError(null), 5000);
    }
  };

  const getCrewName = React.useCallback((idOrName: string) => {
    const e = employeeMap.get(idOrName);
    return e?.name || idOrName;
  }, [employeeMap]);

  const safeTrabajos = Array.isArray(trabajos) ? trabajos : [];

  if (!isLoading && !safeTrabajos.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-slate-400">
        <p className="text-sm font-bold">No hay trabajos programados</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-50 w-full overflow-x-hidden">
      {pdfError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg flex items-center gap-2 animate-bounce">
          <FiAlertCircle />
          {pdfError}
        </div>
      )}
      <div className="w-full">
        <div className={isAgendaView ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonMobileItem key={i} />)
        ) : (
          safeTrabajos.slice(0, visibleCount).map((trabajo, idx) => (
            <JobItem 
              key={trabajo.id || idx}
              trabajo={trabajo}
              onSelect={onSelect}
              onSetActiveModule={onSetActiveModule}
              getCrewName={getCrewName}
              getLatestReport={getLatestReport}
              handleDownloadPDF={handleDownloadPDF}
            />
          ))
        )}
      </div>
    </div>
  </div>
);
};

