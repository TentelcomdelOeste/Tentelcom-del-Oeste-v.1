import React from 'react';
import { useAuditPermanence } from '../../../hooks/useAuditPermanence';
import { VehicleLog, extraerPlaca } from '../../../types/vehicle.types';

interface VehicleEventModalProps {
    show: boolean;
    onClose: () => void;
    log: VehicleLog | null;
}

export const VehicleEventModal: React.FC<VehicleEventModalProps> = ({ show, onClose, log }) => {
    useAuditPermanence({
        module: 'Bitácora de Vehículos',
        submodule: 'Visor de Evento',
        recordId: log?.id,
        recordCode: log?.unidad,
        enabled: show && !!log
    });
    if (!show || !log) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Detalle del Evento</h2>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Bitácora ID: {log.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors">
                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-4 md:p-6 overflow-y-auto max-h-[70vh] space-y-6">
                    {/* Header Info */}
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md flex-1">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fecha / Hora</span>
                            <span className="block text-sm font-bold text-slate-900">
                                {log.fecha ? new Date(log.fecha).toLocaleDateString() : '---'} {log.horaSalida ? ` - ${log.horaSalida}` : ''}
                            </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md flex-1">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Unidad / Placa</span>
                            <span className="block text-sm font-bold text-slate-900">
                                {log.unidad || 'N/A'} {log.placa || extraerPlaca(log.unidadId) || ''}
                            </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md flex-1">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Conductor</span>
                            <span className="block text-sm font-bold text-slate-900">
                                {(log as any)._resolvedName || log.conductorName || 'N/A'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad / Destino</label>
                            <div className="text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {log.destino || (log as any).ruta || 'Sin Actividad'}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kilometraje (Salida)</label>
                            <div className="text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {log.kmSalida != null ? `${log.kmSalida} km` : '---'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones Completas</label>
                        <div className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-wrap">
                            {log.observaciones || 'Sin observaciones detalladas registradas en la bitácora.'}
                        </div>
                    </div>

                    {(log.monto != null || log.litros != null) && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Combustible Recargado</label>
                                <div className="text-sm font-bold text-slate-800 mt-1">
                                    {log.litros != null ? `${log.litros} L` : '---'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Reportado</label>
                                <div className="text-sm font-bold text-slate-800 mt-1">
                                    {log.monto != null ? `₡${log.monto.toLocaleString()}` : '---'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 text-white rounded-md text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
