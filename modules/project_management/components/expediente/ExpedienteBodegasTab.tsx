import React from 'react';
import { FiTruck, FiCalendar, FiUser, FiCheckCircle } from 'react-icons/fi';
import { StatusBadge } from '../../../../design-system';

interface ExpedienteBodegasTabProps {
  vehicleRequests: any[];
  formatDate: (isoString?: string) => string;
}

export const ExpedienteBodegasTab: React.FC<ExpedienteBodegasTabProps> = ({ vehicleRequests, formatDate }) => {
  const getStatusVariant = (status?: string): 'warning' | 'info' | 'success' | 'danger' | 'neutral' => {
    const s = (status || '').toLowerCase();
    if (s === 'cerrada') return 'success';
    if (s === 'abierta') return 'warning';
    if (s === 'cancelada' || s === 'rechazada') return 'danger';
    return 'neutral';
  };

  return (
    <div className="bg-white p-5 md:p-0 rounded-2xl md:rounded-none border md:border-0 border-slate-200 shadow-sm md:shadow-none">
      {/* Header del Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Bodegas Vehiculares — Solicitudes
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Solicitudes de materiales realizadas desde las bodegas móviles asignadas a este proyecto.
          </p>
        </div>
        <span className="text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-lg">
          {vehicleRequests.length} {vehicleRequests.length === 1 ? 'solicitud vehicular' : 'solicitudes vehiculares'}
        </span>
      </div>

      {vehicleRequests.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FiTruck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">No hay solicitudes de bodegas vehiculares para este proyecto.</p>
          <p className="text-slate-400 text-xs mt-1">
            Las solicitudes creadas desde el módulo de Bodegas Vehiculares con este proyecto se sincronizarán en tiempo real.
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
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[160px] shrink-0">
                  <span className="w-full text-left truncate">Vehículo / Placa</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Apertura</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[180px]">
                  <span className="w-full text-left truncate">Responsable</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Cierre</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Materiales</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[110px] shrink-0">
                  <span className="w-full text-center truncate">Estado</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                {vehicleRequests.map((req, index) => {
                  const isEven = index % 2 === 0;
                  const reqNumber = req.requestNumber || req.id;
                  const vehiculo = req.vehiculoAlias || req.vehiculoPlaca || req.vehiculoId || 'Vehículo';
                  const openDate = req.openedAt || req.createdAt;
                  const closeDate = req.closedAt;
                  const responsible = req.responsibleName || req.createdBy || 'N/A';
                  const itemsCount = req.items?.length || 0;
                  const status = req.status || 'Abierta';

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

                      {/* Vehículo */}
                      <div className="text-xs font-bold text-left justify-start flex items-center px-3 py-3 border-r border-slate-200/40 w-[160px] shrink-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <FiTruck className="text-slate-400 text-xs shrink-0" />
                          <span className="text-xs font-semibold text-slate-800 truncate" title={vehiculo}>
                            {vehiculo}
                          </span>
                        </div>
                      </div>

                      {/* Apertura */}
                      <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0">
                        <span className="whitespace-nowrap">{formatDate(openDate)}</span>
                      </div>

                      {/* Responsable */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-slate-800 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[180px]">
                        <span className="text-xs font-medium text-slate-700 truncate" title={responsible}>
                          {responsible}
                        </span>
                      </div>

                      {/* Cierre */}
                      <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0">
                        {closeDate ? (
                          <span className="whitespace-nowrap text-emerald-700 font-semibold">{formatDate(closeDate)}</span>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">—</span>
                        )}
                      </div>

                      {/* Materiales */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0">
                        <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-md">
                          {itemsCount} {itemsCount === 1 ? 'material' : 'materiales'}
                        </span>
                      </div>

                      {/* Estado */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[110px] shrink-0">
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
            {vehicleRequests.map(req => (
              <div key={req.id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200/70 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black text-indigo-700">
                      {req.requestNumber || req.id}
                    </span>
                    <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                      <FiTruck className="w-3.5 h-3.5" />
                      {req.vehiculoAlias || req.vehiculoPlaca || req.vehiculoId || 'Vehículo'}
                    </span>
                  </div>
                  <div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider ${
                      req.status === 'Abierta' ? 'bg-amber-100 text-amber-800' :
                      req.status === 'Cerrada' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <FiCalendar className="text-slate-400" />
                    <span className="font-bold text-slate-400">Fecha:</span>
                    <span className="font-medium text-slate-700">{formatDate(req.openedAt || req.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FiUser className="text-slate-400" />
                    <span className="font-bold text-slate-400">Responsable:</span>
                    <span className="font-medium text-slate-700">{req.responsibleName || req.createdBy || 'N/A'}</span>
                  </div>
                  {req.closedAt && (
                    <div className="flex items-center gap-1.5">
                      <FiCheckCircle className="text-emerald-500" />
                      <span className="font-bold text-slate-400">Cierre:</span>
                      <span className="font-medium text-slate-700">{formatDate(req.closedAt)}</span>
                    </div>
                  )}
                </div>

                {req.observations && (
                  <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/60 text-xs text-slate-600">
                    <span className="font-bold text-slate-500">Observaciones: </span>
                    {req.observations}
                  </div>
                )}

                {/* Materiales Solicitados */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100/70 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <span>Materiales Solicitados ({req.items?.length || 0})</span>
                    <span>Cant. Comprometida</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(req.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="px-3 py-2 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono font-bold text-indigo-600 mr-2">{item.code}</span>
                          <span className="font-medium text-slate-800">{item.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-800">{item.quantityCommitted ?? item.quantity ?? 0}</span>
                          <span className="text-slate-400 font-bold ml-1 text-[11px]">{item.unit}</span>
                        </div>
                      </div>
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
