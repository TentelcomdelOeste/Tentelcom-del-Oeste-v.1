import React, { useMemo } from 'react';
import { FiUsers, FiUser } from 'react-icons/fi';
import { StatusBadge } from '../../../../design-system';

interface ExpedientePersonalTabProps {
  jobs: any[];
}

export const ExpedientePersonalTab: React.FC<ExpedientePersonalTabProps> = ({ jobs }) => {
  const personnelList = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      role: string;
      jobsCount: number;
      otCodes: string[];
      jobTitles: string[];
    }>();

    jobs.forEach((job: any) => {
      const ot = job.otCode || (job.id ? `#${job.id.substring(0, 8)}` : 'OT');
      const jobTitle = job.titulo || job.tipo_trabajo || 'Trabajo';

      if (Array.isArray(job.empleados)) {
        job.empleados.forEach((emp: any) => {
          const empId = emp.empleadoId || emp.id || emp.nombre;
          if (!empId) return;
          const existing = map.get(empId) || {
            id: empId,
            name: emp.nombre || emp.name || emp.displayName || 'Personal Operativo',
            role: emp.rol || emp.cargo || emp.puesto || 'Técnico Asignado',
            jobsCount: 0,
            otCodes: [],
            jobTitles: []
          };
          existing.jobsCount += 1;
          if (!existing.otCodes.includes(ot)) existing.otCodes.push(ot);
          if (!existing.jobTitles.includes(jobTitle)) existing.jobTitles.push(jobTitle);
          map.set(empId, existing);
        });
      }

      if (Array.isArray(job.cuadrilla)) {
        job.cuadrilla.forEach((c: any) => {
          const cId = typeof c === 'string' ? c : (c.id || c.nombre || c.name);
          if (!cId) return;
          const name = typeof c === 'string' ? c : (c.nombre || c.name || 'Personal');
          const existing = map.get(cId) || {
            id: cId,
            name: name,
            role: (typeof c === 'object' && c.rol) ? c.rol : 'Cuadrilla Operativa',
            jobsCount: 0,
            otCodes: [],
            jobTitles: []
          };
          existing.jobsCount += 1;
          if (!existing.otCodes.includes(ot)) existing.otCodes.push(ot);
          if (!existing.jobTitles.includes(jobTitle)) existing.jobTitles.push(jobTitle);
          map.set(cId, existing);
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
            Personal Asignado al Proyecto
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Colaboradores y cuadrillas vinculadas a los trabajos programados de este proyecto.
          </p>
        </div>
        <span className="text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg">
          {personnelList.length} {personnelList.length === 1 ? 'colaborador' : 'colaboradores'}
        </span>
      </div>

      {personnelList.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FiUsers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">No hay personal asignado a este proyecto.</p>
          <p className="text-slate-400 text-xs mt-1">
            Al asignar personal en las cuadrillas de los trabajos programados, aparecerán listados aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Vista Escritorio: Tabla con patrón idéntico a Gestión de Proyectos / Cotizaciones */}
          <div className="hidden md:block overflow-x-auto">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-w-[850px]">
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[80px] shrink-0">
                  <span className="w-full text-center truncate">N°</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[220px]">
                  <span className="w-full text-left truncate">Colaborador / Técnico</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[200px] shrink-0">
                  <span className="w-full text-left truncate">Rol / Especialidad</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[200px]">
                  <span className="w-full text-left truncate">Trabajos Vinculados (OTs)</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Asignaciones</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Estado</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                {personnelList.map((person, index) => {
                  const isEven = index % 2 === 0;
                  return (
                    <div
                      key={person.id}
                      className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group ${
                        isEven ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                      style={{ minHeight: '56px' }}
                    >
                      {/* N° */}
                      <div className="text-xs font-bold text-center justify-center flex items-center text-slate-400 px-3 py-3 border-r border-slate-200/40 w-[80px] shrink-0 font-mono">
                        {index + 1}
                      </div>

                      {/* Colaborador */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2.5 truncate w-full">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 font-bold text-xs">
                            <FiUser />
                          </div>
                          <span className="font-black text-blue-900 text-xs truncate" title={person.name}>
                            {person.name}
                          </span>
                        </div>
                      </div>

                      {/* Rol */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-slate-700 px-3 py-3 border-r border-slate-200/40 w-[200px] shrink-0">
                        <span className="font-medium text-slate-700 text-xs truncate" title={person.role}>
                          {person.role}
                        </span>
                      </div>

                      {/* Trabajos / OTs */}
                      <div className="text-xs font-bold text-left justify-start flex items-center px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[200px]">
                        <div className="flex flex-wrap gap-1 max-w-full">
                          {person.otCodes.slice(0, 3).map((ot, i) => (
                            <span key={i} className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded uppercase">
                              {ot}
                            </span>
                          ))}
                          {person.otCodes.length > 3 && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              +{person.otCodes.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Asignaciones */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0 font-mono">
                        <span className="font-bold text-slate-800 text-xs bg-slate-100 px-2.5 py-0.5 rounded-md">
                          {person.jobsCount} {person.jobsCount === 1 ? 'trabajo' : 'trabajos'}
                        </span>
                      </div>

                      {/* Estado */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[120px] shrink-0">
                        <StatusBadge label="Activo" variant="success" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vista Móvil: Tarjetas Móviles */}
          <div className="md:hidden grid grid-cols-1 gap-3.5">
            {personnelList.map((person) => (
              <div
                key={person.id}
                className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      <FiUser />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{person.name}</h4>
                      <p className="text-xs text-slate-500">{person.role}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                    {person.jobsCount} {person.jobsCount === 1 ? 'trabajo' : 'trabajos'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    OTs Asociadas:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {person.otCodes.map((ot, i) => (
                      <span key={i} className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                        {ot}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
