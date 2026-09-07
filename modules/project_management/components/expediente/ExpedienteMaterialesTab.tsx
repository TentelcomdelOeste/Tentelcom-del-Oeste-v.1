import React from 'react';
import { FiBox, FiCalendar, FiUser, FiPackage } from 'react-icons/fi';
import { StatusBadge } from '../../../../design-system';

interface ExpedienteMaterialesTabProps {
  materialRequests: any[];
}

export const ExpedienteMaterialesTab: React.FC<ExpedienteMaterialesTabProps> = ({ materialRequests }) => {
  const getStatusVariant = (status?: string): 'warning' | 'info' | 'success' | 'danger' | 'neutral' => {
    const s = (status || '').toLowerCase();
    if (s === 'aprobada') return 'info';
    if (s === 'despachada' || s === 'cerrada') return 'success';
    if (s === 'rechazada' || s === 'cancelada') return 'danger';
    if (s === 'pendiente' || s === 'abierta') return 'warning';
    return 'neutral';
  };

  return (
    <div className="bg-white p-5 md:p-0 rounded-2xl md:rounded-none border md:border-0 border-slate-200 shadow-sm md:shadow-none">
      {/* Header del Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Solicitudes de Materiales
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Consolida las solicitudes tradicionales y de bodegas vehiculares vinculadas a este proyecto.
          </p>
        </div>
        <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg">
          {materialRequests.length} {materialRequests.length === 1 ? 'solicitud' : 'solicitudes'}
        </span>
      </div>

      {materialRequests.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FiBox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">No hay solicitudes de materiales asociadas a este proyecto.</p>
          <p className="text-slate-400 text-xs mt-1">
            Al registrar salidas o solicitudes para este proyecto desde Almacén o Bodegas, se mostrarán aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Vista Escritorio: Tabla con patrón idéntico a Gestión de Proyectos / Cotizaciones */}
          <div className="hidden md:block overflow-x-auto">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-w-[950px]">
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">N° Solicitud</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[140px] shrink-0">
                  <span className="w-full text-left truncate">Origen</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[160px] shrink-0">
                  <span className="w-full text-left truncate">Vehículo / Unidad</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[110px] shrink-0">
                  <span className="w-full text-center truncate">Fecha</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[180px]">
                  <span className="w-full text-left truncate">Solicitante / Responsable</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Materiales</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Estado</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                {materialRequests.map((req, index) => {
                  const isEven = index % 2 === 0;
                  const reqNumber = req.requestNumber || req.id;
                  const origin = req.origin || 'Despacho';
                  const dateStr = req.date || (req.createdAt ? req.createdAt.substring(0, 10) : '—');
                  const responsible = req.requestedByName || req.responsibleName || 'Responsable';
                  const itemsCount = req.items?.length || 0;
                  const status = req.status || 'Pendiente';

                  return (
                    <div
                      key={req.id}
                      className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group ${
                        isEven ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                      style={{ minHeight: '56px' }}
                    >
                      {/* N° Solicitud */}
                      <div className="text-xs font-bold text-center justify-center flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0 font-mono">
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded truncate">
                          {reqNumber}
                        </span>
                      </div>

                      {/* Origen */}
                      <div className="text-xs font-bold text-left justify-start flex items-center px-3 py-3 border-r border-slate-200/40 w-[140px] shrink-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          origin === 'Bodega Vehicular' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {origin}
                        </span>
                      </div>

                      {/* Vehículo */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-slate-700 px-3 py-3 border-r border-slate-200/40 w-[160px] shrink-0">
                        {req.vehiculoAlias ? (
                          <span className="text-xs font-semibold text-slate-800 truncate" title={req.vehiculoAlias}>
                            {req.vehiculoAlias}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">—</span>
                        )}
                      </div>

                      {/* Fecha */}
                      <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[110px] shrink-0">
                        <span className="whitespace-nowrap">{dateStr}</span>
                      </div>

                      {/* Responsable */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-slate-800 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[180px]">
                        <span className="text-xs font-medium text-slate-700 truncate" title={responsible}>
                          {responsible}
                        </span>
                      </div>

                      {/* Materiales */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0">
                        <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-md">
                          {itemsCount} {itemsCount === 1 ? 'ítem' : 'ítems'}
                        </span>
                      </div>

                      {/* Estado */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[120px] shrink-0">
                        <StatusBadge label={status} variant={getStatusVariant(status)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vista Móvil: Tarjetas Móviles Intactas */}
          <div className="md:hidden space-y-4">
            {materialRequests.map(req => (
              <div key={req.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-slate-300 transition-colors">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-blue-700">Solicitud {req.requestNumber || req.id}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      req.origin === 'Bodega Vehicular' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {req.origin || 'Despacho'}
                    </span>
                    {req.vehiculoAlias && (
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                        {req.vehiculoAlias}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5"><FiCalendar /> {req.date || (req.createdAt ? req.createdAt.substring(0, 10) : 'N/A')}</div>
                    <div className="flex items-center gap-1.5"><FiUser /> {req.requestedByName || req.responsibleName || 'Responsable'}</div>
                    <div className="flex items-center gap-1.5"><FiPackage /> {req.items?.length || 0} materiales</div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider ${
                    req.status === 'Pendiente' || req.status === 'Abierta' ? 'bg-amber-100 text-amber-700' :
                    req.status === 'Aprobada' ? 'bg-indigo-100 text-indigo-700' :
                    req.status === 'Parcial' ? 'bg-cyan-100 text-cyan-700' :
                    req.status === 'Despachada' || req.status === 'Cerrada' ? 'bg-green-100 text-green-700' :
                    req.status === 'Rechazada' || req.status === 'Cancelada' ? 'bg-red-100 text-red-700' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {req.status}
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
