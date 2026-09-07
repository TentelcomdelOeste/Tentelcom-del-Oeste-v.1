import React from 'react';
import { FiFolder, FiCheckCircle, FiFileText } from 'react-icons/fi';
import { Project } from '../../types';

interface ExpedienteGenericTabProps {
  tabKey: string;
  tabLabel: string;
  project: Project;
}

export const ExpedienteGenericTab: React.FC<ExpedienteGenericTabProps> = ({
  tabKey,
  tabLabel,
  project
}) => {
  const isCierre = tabKey === 'cierre';

  return (
    <div className="bg-white p-6 md:p-0 rounded-2xl md:rounded-none border md:border-0 border-slate-200 shadow-sm md:shadow-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-5 mb-6 border-b border-slate-100">
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            {isCierre ? 'Cierre y Liquidación del Proyecto' : `Documentación y Archivos del Proyecto`}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            {isCierre 
              ? 'Verificación integral de entregables, finanzas y liquidación final del proyecto.'
              : 'Expediente documental, planos, especificaciones y contratos asociados.'}
          </p>
        </div>
        <span className="text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg">
          Proyecto {project.projectNumber || project.id}
        </span>
      </div>

      <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 max-w-2xl mx-auto p-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-indigo-600">
          {isCierre ? <FiCheckCircle className="w-7 h-7" /> : <FiFolder className="w-7 h-7" />}
        </div>
        <h4 className="text-base font-black text-slate-800 mb-2">
          {isCierre ? 'Expediente de Cierre' : `Gestión Documental: ${tabLabel}`}
        </h4>
        <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-4">
          Esta vista unificada recopila los registros y archivos generados para el proyecto{' '}
          <strong className="text-slate-800 font-bold">{project.projectNumber || project.name}</strong>.
          Toda la trazabilidad permanece sincronizada en tiempo real.
        </p>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
          <FiFileText className="text-slate-500" />
          Estado del Proyecto: <span className="font-bold text-slate-700 uppercase">{project.status || 'Activo'}</span>
        </div>
      </div>
    </div>
  );
};
