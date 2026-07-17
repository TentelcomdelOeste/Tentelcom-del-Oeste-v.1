import React, { useMemo } from 'react';
import { VehicleLog } from '../../../types/vehicle.types';
import { IconButton } from '../../../design-system';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

interface EventSummaryModalProps {
    show: boolean;
    onClose: () => void;
    logs: VehicleLog[];
    onSelectEvent: (log: VehicleLog) => void;
}

export const EventSummaryModal: React.FC<EventSummaryModalProps> = ({ show, onClose, logs, onSelectEvent }) => {
    const eventLogs = useMemo(() => {
        return logs.filter(log => log.eventosCarretera === 'Sí').sort((a, b) => 
            new Date(b.fecha || b.createdAt || 0).getTime() - new Date(a.fecha || a.createdAt || 0).getTime()
        );
    }, [logs]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <FiAlertTriangle className="text-amber-500" />
                        Historial de Eventos Registrados
                    </h2>
                    <IconButton 
                        icon={<FiX className="text-slate-600" />}
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    />
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    {eventLogs.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">No hay eventos registrados.</div>
                    ) : (
                        <div className="space-y-2">
                            {eventLogs.map((log) => (
                                <div 
                                    key={log.id} 
                                    onClick={() => onSelectEvent(log)}
                                    className="cursor-pointer grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-300 transition-colors group shadow-sm hover:shadow-md"
                                >
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase">Fecha</div>
                                        <div className="text-xs font-bold text-slate-900">{log.fecha ? new Date(log.fecha).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase">Conductor</div>
                                        <div className="text-xs font-bold text-slate-900">{log._resolvedName || log.conductorName || 'N/A'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase">Observaciones</div>
                                        <div className="text-xs font-bold text-slate-900 line-clamp-1">{log.observaciones || 'Sin observaciones'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
