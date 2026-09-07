import React from 'react';
import { FiLayers, FiCalendar, FiUser, FiTruck, FiBriefcase } from 'react-icons/fi';
import { Project } from '../../types';
import { StatusBadge } from '../../../../design-system';

interface ExpedienteConsumosTabProps {
  vehicleConsumptions: any[];
  project: Project;
  formatDate: (isoString?: string) => string;
}

export const ExpedienteConsumosTab: React.FC<ExpedienteConsumosTabProps> = ({
  vehicleConsumptions,
  project,
  formatDate
}) => {
  return (
    <div className="bg-white p-5 md:p-0 rounded-2xl md:rounded-none border md:border-0 border-slate-200 shadow-sm md:shadow-none">
      {/* Header del Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Consumos y Cierres de Materiales
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Registro de materiales consumidos y sobrantes liquidados desde las bodegas vehiculares para este proyecto.
          </p>
        </div>
        <span className="text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg">
          {vehicleConsumptions.length} {vehicleConsumptions.length === 1 ? 'cierre registrado' : 'cierres registrados'}
        </span>
      </div>

      {vehicleConsumptions.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FiLayers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">No hay consumos liquidados aún para este proyecto.</p>
          <p className="text-slate-400 text-xs mt-1">
            Al cerrar solicitudes en Bodegas Vehiculares, los consumos y sobrantes reales aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Vista Escritorio: Tabla de Cierres y Consumos */}
          <div className="hidden md:block space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-w-[950px]">
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[140px] shrink-0">
                  <span className="w-full text-center truncate">N° Cierre / Req.</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 w-[160px] shrink-0">
                  <span className="w-full text-left truncate">Vehículo Asignado</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Fecha Cierre</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[180px]">
                  <span className="w-full text-left truncate">Responsable</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[140px] shrink-0">
                  <span className="w-full text-center truncate">Total Consumido</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[110px] shrink-0">
                  <span className="w-full text-center truncate">Estado</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden divide-y divide-slate-200">
                {vehicleConsumptions.map((consumption, index) => {
                  const isEven = index % 2 === 0;
                  const reqNum = consumption.requestNumber || consumption.requestId || consumption.id;
                  const vehiculo = consumption.vehiculoAlias || 'Vehículo';
                  const responsible = consumption.responsibleName || 'N/A';
                  const totalConsumed = consumption.totalItemsConsumed ?? 0;

                  return (
                    <div key={consumption.id} className={isEven ? 'bg-white' : 'bg-slate-50/30'}>
                      {/* Fila Principal del Cierre */}
                      <div
                        className="flex items-stretch px-4 hover:bg-blue-50/20 transition-colors"
                        style={{ minHeight: '56px' }}
                      >
                        {/* N° Cierre */}
                        <div className="text-xs font-bold text-center justify-center flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[140px] shrink-0 font-mono">
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded truncate">
                            {reqNum}
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

                        {/* Fecha Cierre */}
                        <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0">
                          <span className="whitespace-nowrap">{formatDate(consumption.closedAt)}</span>
                        </div>

                        {/* Responsable */}
                        <div className="text-xs font-bold text-left justify-start flex items-center text-slate-800 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[180px]">
                          <span className="text-xs font-medium text-slate-700 truncate" title={responsible}>
                            {responsible}
                          </span>
                        </div>

                        {/* Total Consumido */}
                        <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[140px] shrink-0">
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-md">
                            {totalConsumed} {totalConsumed === 1 ? 'unidad' : 'unidades'}
                          </span>
                        </div>

                        {/* Estado */}
                        <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[110px] shrink-0">
                          <StatusBadge label="Liquidado" variant="success" />
                        </div>
                      </div>

                      {/* Desglose de Materiales Consumidos (Desktop Subtabla) */}
                      {Array.isArray(consumption.items) && consumption.items.length > 0 && (
                        <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-200/60">
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                            <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-[10px] font-black text-slate-600 uppercase tracking-wider">
                              <span>Detalle de Materiales Liquidados</span>
                              <span>Comprometido / Consumido / Sobrante</span>
                            </div>
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                                <tr>
                                  <th className="px-4 py-2">Código</th>
                                  <th className="px-4 py-2">Descripción</th>
                                  <th className="px-4 py-2 text-center">Unidad</th>
                                  <th className="px-4 py-2 text-right">Comprometido</th>
                                  <th className="px-4 py-2 text-right text-emerald-700 font-black">Consumido</th>
                                  <th className="px-4 py-2 text-right text-amber-700 font-black">Sobrante</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {consumption.items.map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2 font-mono font-bold text-indigo-600">{item.code}</td>
                                    <td className="px-4 py-2 font-medium text-slate-800">{item.description}</td>
                                    <td className="px-4 py-2 text-center text-slate-500 font-bold">{item.unit}</td>
                                    <td className="px-4 py-2 text-right font-medium text-slate-600">{item.committed ?? 0}</td>
                                    <td className="px-4 py-2 text-right font-black text-emerald-700 bg-emerald-50/30">{item.consumed ?? 0}</td>
                                    <td className="px-4 py-2 text-right font-black text-amber-700 bg-amber-50/30">
                                      {item.surplus !== undefined ? item.surplus : ((item.committed ?? 0) - (item.consumed ?? 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vista Móvil: Tarjetas Móviles Intactas */}
          <div className="md:hidden space-y-4">
            {vehicleConsumptions.map(consumption => (
              <div key={consumption.id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200/70 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black text-emerald-700">
                      Cierre Solicitud: {consumption.requestNumber || consumption.requestId || consumption.id}
                    </span>
                    <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                      <FiTruck className="w-3.5 h-3.5" />
                      {consumption.vehiculoAlias || 'Vehículo'}
                    </span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
                      Total Consumido: {consumption.totalItemsConsumed ?? 0} unidades
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <FiCalendar className="text-slate-400" />
                    <span className="font-bold text-slate-400">Fecha Cierre:</span>
                    <span className="font-medium text-slate-700">{formatDate(consumption.closedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FiUser className="text-slate-400" />
                    <span className="font-bold text-slate-400">Responsable:</span>
                    <span className="font-medium text-slate-700">{consumption.responsibleName || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FiBriefcase className="text-slate-400" />
                    <span className="font-bold text-slate-400">Proyecto:</span>
                    <span className="font-medium text-slate-700">{consumption.projectCode || project.projectNumber || project.name}</span>
                  </div>
                </div>

                {/* Tabla de Materiales Consumidos y Sobrantes */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Descripción</th>
                          <th className="px-3 py-2 text-center">Unidad</th>
                          <th className="px-3 py-2 text-right">Comprometido</th>
                          <th className="px-3 py-2 text-right text-emerald-700 font-black">Consumido</th>
                          <th className="px-3 py-2 text-right text-amber-700 font-black">Sobrante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(consumption.items || []).map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-mono font-bold text-indigo-600">{item.code}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{item.description}</td>
                            <td className="px-3 py-2 text-center text-slate-500 font-bold">{item.unit}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-600">{item.committed ?? 0}</td>
                            <td className="px-3 py-2 text-right font-black text-emerald-700 bg-emerald-50/30">{item.consumed ?? 0}</td>
                            <td className="px-3 py-2 text-right font-black text-amber-700 bg-amber-50/30">
                              {item.surplus !== undefined ? item.surplus : ((item.committed ?? 0) - (item.consumed ?? 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
