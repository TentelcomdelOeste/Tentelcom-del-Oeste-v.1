import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiAlertTriangle, FiTruck, FiCalendar, FiUser } from 'react-icons/fi';
import { VehicleLog, evaluateVehicleInspectionAlerts, extraerPlaca, getUnitCode } from '../../../types/vehicle.types';
import { ActionButton, IconButton } from '../../../design-system';

interface InspectionAlertsModalProps {
    show: boolean;
    onClose: () => void;
    log: VehicleLog | null;
}

export const InspectionAlertsModal: React.FC<InspectionAlertsModalProps> = ({ show, onClose, log }) => {
    // Cerrar con tecla Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && show) {
                onClose();
            }
        };
        if (show) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [show, onClose]);

    if (!show || !log) return null;

    const alertInfo = evaluateVehicleInspectionAlerts(log.revisionUnidad, log);
    const alerts = (log.inspectionAlerts && log.inspectionAlerts.length > 0)
        ? log.inspectionAlerts
        : alertInfo.inspectionAlerts;

    const unitCode = getUnitCode(log.unidad, log.unidadId, log.unidadName);
    const unitDisplayName = log.unidad || log.unidadName || unitCode || 'Unidad';
    const plate = log.placa || extraerPlaca(log.unidadId) || '';
    const driverName = (log as any)._resolvedName || log.conductorName || 'No especificado';
    const dateFormatted = log.fecha 
        ? (log.fecha.includes('T') ? log.fecha.split('T')[0] : log.fecha)
        : (log.createdAt ? log.createdAt.split('T')[0] : '---');

    const totalAlerts = alerts.length;
    const deviationText = totalAlerts === 1
        ? 'Se detectó 1 parámetro diferente al valor establecido.'
        : `Se detectaron ${totalAlerts} parámetros diferentes a los valores establecidos.`;

    const modalContent = (
        <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 bg-amber-500/10 border-b border-amber-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center text-lg shrink-0 border border-amber-300/80 shadow-2xs">
                            <FiAlertTriangle className="text-amber-800" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide truncate flex items-center gap-1.5">
                                <span>Observaciones de Revisión</span>
                            </h2>
                            <p className="text-xs text-amber-900 font-semibold truncate">
                                Unidad: <span className="font-black text-slate-900">{unitDisplayName}</span>
                                {plate && <span className="text-slate-500 font-normal ml-1">({plate})</span>}
                            </p>
                        </div>
                    </div>
                    <IconButton
                        icon={<FiX size={18} />}
                        onClick={onClose}
                        className="!p-2 text-slate-500 hover:text-slate-900 hover:bg-white/80 rounded-xl transition-colors shrink-0"
                        title="Cerrar modal"
                    />
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                    {/* Metadata Context Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                        <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                            <FiTruck className="text-slate-400 shrink-0" />
                            <span className="truncate font-bold text-slate-800">{unitCode ? `Unidad ${unitCode}` : unitDisplayName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                            <FiCalendar className="text-slate-400 shrink-0" />
                            <span className="truncate font-medium">{dateFormatted}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 min-w-0 text-slate-600">
                            <FiUser className="text-slate-400 shrink-0" />
                            <span className="truncate font-medium">{driverName}</span>
                        </div>
                    </div>

                    {/* Summary Deviation Text */}
                    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs sm:text-sm text-amber-950 font-semibold flex items-center gap-2">
                        <span className="text-base shrink-0">⚠️</span>
                        <span>{deviationText}</span>
                    </div>

                    {/* Mobile Card List (< md) */}
                    <div className="block md:hidden space-y-2.5">
                        {alerts.map((item, index) => (
                            <div 
                                key={item.itemId || index} 
                                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2"
                            >
                                <div className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug">
                                    {item.label}
                                </div>
                                {item.category && (
                                    <span className="inline-block text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                        {item.category}
                                    </span>
                                )}
                                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                                    <div className="flex items-center gap-1 text-slate-600">
                                        <span>Esperado:</span>
                                        <span className="font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                                            {item.expectedValue}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-rose-900">
                                        <span>Registrado:</span>
                                        <span className="font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                                            {item.selectedValue}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table (>= md) */}
                    <div className="hidden md:block overflow-hidden border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="py-3 px-4">Parámetro de Revisión</th>
                                    <th className="py-3 px-3 text-center w-28">Esperado</th>
                                    <th className="py-3 px-3 text-center w-28">Registrado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {alerts.map((item, index) => (
                                    <tr key={item.itemId || index} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-3 px-4 font-semibold text-slate-800">
                                            <div>{item.label}</div>
                                            {item.category && (
                                                <div className="text-[10px] font-normal text-slate-400 mt-0.5">{item.category}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className="inline-block font-black text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-xs">
                                                {item.expectedValue}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className="inline-block font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded text-xs">
                                                {item.selectedValue}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer with Big Accessible Close Button */}
                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <ActionButton
                        variant="secondary"
                        label="CERRAR"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold shadow-xs min-h-[44px]"
                    />
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
