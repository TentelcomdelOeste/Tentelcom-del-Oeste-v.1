import React, { useMemo } from 'react';
import { FiTruck } from 'react-icons/fi';
import { StatusBadge } from '../../../../design-system';

interface ExpedienteUnidadesTabProps {
  jobs: any[];
}

export const ExpedienteUnidadesTab: React.FC<ExpedienteUnidadesTabProps> = ({ jobs }) => {
  const vehiclesList = useMemo(() => {
    const map = new Map<string, {
      id: string;
      alias: string;
      placa: string;
      tipo: string;
      jobsCount: number;
      otCodes: string[];
    }>();

    jobs.forEach((job: any) => {
      const ot = job.otCode || (job.id ? `#${job.id.substring(0, 8)}` : 'OT');

      if (job.unidadId || job.vehiculoId || job.unidadPlaca || job.unidadAlias) {
        const uId = job.unidadId || job.vehiculoId || job.unidadPlaca || job.unidadAlias;
        const existing = map.get(uId) || {
          id: uId,
          alias: job.unidadAlias || job.vehiculoAlias || 'Unidad Asignada',
          placa: job.unidadPlaca || job.vehiculoPlaca || job.unidadId || 'N/D',
          tipo: job.unidadTipo || 'Vehículo Operativo',
          jobsCount: 0,
          otCodes: []
        };
        existing.jobsCount += 1;
        if (!existing.otCodes.includes(ot)) existing.otCodes.push(ot);
        map.set(uId, existing);
      }

      if (Array.isArray(job.unidades)) {
        job.unidades.forEach((u: any) => {
          const uId = typeof u === 'string' ? u : (u.id || u.placa || u.alias);
          if (!uId) return;
          const existing = map.get(uId) || {
            id: uId,
            alias: typeof u === 'object' ? (u.alias || u.nombre || 'Unidad') : u,
            placa: typeof u === 'object' ? (u.placa || 'N/D') : u,
            tipo: typeof u === 'object' ? (u.tipo || 'Vehículo Operativo') : 'Vehículo',
            jobsCount: 0,
            otCodes: []
          };
          existing.jobsCount += 1;
          if (!existing.otCodes.includes(ot)) existing.otCodes.push(ot);
          map.set(uId, existing);
        });
      }
    });

    return Array.from(map.values());
  }, [jobs]);

  return (
    <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
      {/* Header del Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Unidades y Vehículos Asignados
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Flota vehicular y unidades móviles operando en los trabajos de este proyecto.
          </p>
        </div>
        <span className="text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-lg">
          {vehiclesList.length} {vehiclesList.length === 1 ? 'unidad' : 'unidades'}
        </span>
      </div>

      {vehiclesList.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FiTruck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">No hay unidades asignadas a este proyecto.</p>
          <p className="text-slate-400 text-xs mt-1">
            Al registrar unidades vehiculares en los trabajos programados, aparecerán sincronizadas aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Vista Escritorio: Tabla con patrón idéntico a Gestión de Proyectos */}
          <div className="hidden md:block overflow-x-auto">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-w-[850px]">
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[80px] shrink-0">
                  <span className="w-full text-center truncate">N°</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[200px]">
                  <span className="w-full text-left truncate">Unidad / Vehículo</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[130px] shrink-0">
                  <span className="w-full text-center truncate">Placa</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[160px] shrink-0">
                  <span className="w-full text-left truncate">Tipo / Categoría</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[200px]">
                  <span className="w-full text-left truncate">Trabajos Vinculados (OTs)</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Asignaciones</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[110px] shrink-0">
                  <span className="w-full text-center truncate">Estado</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                {vehiclesList.map((vehicle, index) => {
                  const isEven = index % 2 === 0;
                  return (
                    <div
                      key={vehicle.id}
                      className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group ${
                        isEven ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                      style={{ minHeight: '56px' }}
                    >
                      {/* N° */}
                      <div className="text-xs font-bold text-center justify-center flex items-center text-slate-400 px-3 py-3 border-r border-slate-200/40 w-[80px] shrink-0 font-mono">
                        {index + 1}
                      </div>

                      {/* Unidad */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2.5 truncate w-full">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 font-bold text-xs">
                            <FiTruck />
                          </div>
                          <span className="font-black text-blue-900 text-xs truncate" title={vehicle.alias}>
                            {vehicle.alias}
                          </span>
                        </div>
                      </div>

                      {/* Placa */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[130px] shrink-0 font-mono">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px] font-bold">
                          {vehicle.placa}
                        </span>
                      </div>

                      {/* Tipo */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-slate-700 px-3 py-3 border-r border-slate-200/40 w-[160px] shrink-0">
                        <span className="font-medium text-slate-700 text-xs truncate" title={vehicle.tipo}>
                          {vehicle.tipo}
                        </span>
                      </div>

                      {/* OTs */}
                      <div className="text-xs font-bold text-left justify-start flex items-center px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[200px]">
                        <div className="flex flex-wrap gap-1 max-w-full">
                          {vehicle.otCodes.slice(0, 3).map((ot, i) => (
                            <span key={i} className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded uppercase">
                              {ot}
                            </span>
                          ))}
                          {vehicle.otCodes.length > 3 && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              +{vehicle.otCodes.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Asignaciones */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0 font-mono">
                        <span className="font-bold text-slate-800 text-xs bg-slate-100 px-2.5 py-0.5 rounded-md">
                          {vehicle.jobsCount} {vehicle.jobsCount === 1 ? 'trabajo' : 'trabajos'}
                        </span>
                      </div>

                      {/* Estado */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[110px] shrink-0">
                        <StatusBadge label="Operativa" variant="success" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vista Móvil: Tarjetas */}
          <div className="md:hidden grid grid-cols-1 gap-3.5">
            {vehiclesList.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                      <FiTruck />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{vehicle.alias}</h4>
                      <p className="text-xs text-slate-500">{vehicle.tipo}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                    {vehicle.placa}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Asignaciones:</span>
                  <span className="font-bold text-slate-800">
                    {vehicle.jobsCount} {vehicle.jobsCount === 1 ? 'trabajo' : 'trabajos'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
