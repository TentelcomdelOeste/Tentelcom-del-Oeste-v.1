import React, { useMemo } from 'react';
import { useAuditPermanence } from '../../../hooks/useAuditPermanence';
import { VehicleLog } from '../../../types/vehicle.types';
import { IconButton } from '../../../design-system';
import { FiX } from 'react-icons/fi';

interface FuelDetailModalProps {
    show: boolean;
    onClose: () => void;
    logs: VehicleLog[];
}

export const FuelDetailModal: React.FC<FuelDetailModalProps> = ({ show, onClose, logs }) => {
    useAuditPermanence({
        module: 'Bitácora de Vehículos',
        submodule: 'Detalle de Combustible',
        enabled: show
    });
    const fuelLogs = useMemo(() => {
        return logs.filter(log => log.litros != null && log.litros !== "").sort((a, b) => 
            new Date(b.fecha || b.createdAt || 0).getTime() - new Date(a.fecha || a.createdAt || 0).getTime()
        );
    }, [logs]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Historial de Combustible</h2>
                    <IconButton 
                        icon={<FiX className="text-slate-600" />}
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    />
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    {fuelLogs.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">No hay registros de combustible.</div>
                    ) : (
                        <div className="space-y-2">
                            {fuelLogs.map((log) => {
                                const litros = parseFloat(String(log.litros)) || 0;
                                const galones = litros / 3.785;
                                const monto = log.monto || (log as any).costo || 0;
                                const precioPorLitro = litros > 0 ? monto / litros : 0;
                                
                                return (
                                    <div key={log.id} className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase">Fecha</div>
                                            <div className="text-xs font-bold text-slate-900">{log.fecha ? new Date(log.fecha).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase">Litros / Galones</div>
                                            <div className="text-xs font-bold text-slate-900">{litros.toFixed(1)} L / {galones.toFixed(1)} G</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase">Monto / Precio x L</div>
                                            <div className="text-xs font-bold text-slate-900">₡{monto.toLocaleString()} / ₡{precioPorLitro.toFixed(0)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase">Colaborador</div>
                                            <div className="text-xs font-bold text-slate-900">{log._resolvedName || log.conductorName || 'N/A'}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
