import React from 'react';
import { 
  FiBriefcase, 
  FiUsers, 
  FiTruck, 
  FiBox, 
  FiDollarSign, 
  FiFileText,
  FiInfo
} from 'react-icons/fi';
import { Project } from '../../types';
import { StatusBadge } from '../../../../design-system';

interface ExpedienteResumenTabProps {
  project: Project;
  jobs: any[];
  uniquePersonnel: any[];
  uniqueVehicles: any[];
  materialRequests: any[];
  invoices: any[];
  purchases: any[];
}

export const ExpedienteResumenTab: React.FC<ExpedienteResumenTabProps> = ({
  project,
  jobs,
  uniquePersonnel,
  uniqueVehicles,
  materialRequests,
  invoices,
  purchases
}) => {
  const quoteDisplay = (project.origin === "Cotización" && project.quoteId) 
    ? (project.quoteCommercialId ? `#${String(project.quoteCommercialId).padStart(3, '0')}` : (project.quoteId.length > 20 ? `#${project.quoteId.slice(-6)}` : `#${project.quoteId}`)) 
    : "N/A";

  const indicators = [
    { label: 'Trabajos', value: jobs.length, icon: <FiBriefcase className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50/80', border: 'border-indigo-100' },
    { label: 'Personal', value: uniquePersonnel.length, icon: <FiUsers className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50/80', border: 'border-emerald-100' },
    { label: 'Unidades', value: uniqueVehicles.length, icon: <FiTruck className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50/80', border: 'border-amber-100' },
    { label: 'Solicitudes Mat.', value: materialRequests.length, icon: <FiBox className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50/80', border: 'border-blue-100' },
    { label: 'Facturas', value: invoices.length, icon: <FiDollarSign className="w-5 h-5 text-rose-600" />, bg: 'bg-rose-50/80', border: 'border-rose-100' },
    { label: 'Órdenes de Compra', value: purchases.length, icon: <FiFileText className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50/80', border: 'border-purple-100' }
  ];

  return (
    <div className="space-y-6">
      {/* Sección 1: Datos Generales del Proyecto */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FiInfo className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
                Resumen Ejecutivo del Proyecto
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Metadatos e información general consolidada
              </p>
            </div>
          </div>
          <StatusBadge 
            label={project.status || 'Activo'} 
            variant={
              project.status === 'Cerrado' ? 'neutral' :
              project.status === 'En Ejecución' ? 'success' :
              'info'
            }
          />
        </div>

        {/* Grid de Metadatos con estilo corporativo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Número de Proyecto
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
              {project.projectNumber || project.id}
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Cotización de Origen
            </span>
            <span className="text-xs sm:text-sm font-bold text-indigo-700">
              {quoteDisplay}
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Cliente / Cuenta
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block" title={project.clientName}>
              {project.clientName || 'Sin cliente asignado'}
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Orden de Compra (OC)
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-800">
              {project.mainOcNumber || 'N/A'}
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Fecha de Inicio
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono">
              {project.startDate || 'N/A'}
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Responsable / Creador
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-800">
              {project.createdByDisplayName || 'Usuario'}
            </span>
          </div>
        </div>
      </div>

      {/* Sección 2: Indicadores 360° */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="pb-4 mb-5 border-b border-slate-100">
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Indicadores Clave 360°
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Resumen cuantitativo de los registros operativos y administrativos asociados
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {indicators.map((item, idx) => (
            <div 
              key={idx}
              className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl p-3.5 transition-all duration-150 flex flex-col justify-between gap-2.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${item.bg} ${item.border} border`}>
                  {item.icon}
                </div>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {item.value}
                </span>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
