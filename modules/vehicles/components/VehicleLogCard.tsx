
import React from 'react';
import { VehicleLog, VehicleExpense } from '../../../types/vehicle.types';
import { FaTruck, FaCalendar, FaUser, FaMapPin, FaTachometerAlt, FaCreditCard } from 'react-icons/fa';
import { ActionButtons } from '../../../components/ui/ActionButtons';
import { SovereignVehicleImage } from './SovereignVehicleImage';

interface Props {
    log: VehicleLog;
    expenses?: VehicleExpense[];
    onEdit: () => void;
    onDelete: () => void;
    onPdf: () => void;
    onTimeline?: () => void;
    onCostAnalysis?: () => void;
}

export const VehicleLogCard = React.memo(({ log, expenses = [], onEdit, onDelete, onPdf, onTimeline, onCostAnalysis }: Props) => {
    const isIncomplete = !log.horaLlegada || !log.kmLlegada;
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.monto || 0), 0);

    return (
        <div className={`bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow relative ${
            isIncomplete 
                ? 'border-l-[5px] border-l-[#FFA500] bg-orange-50/20 animate-pulso-naranja outline outline-1 outline-orange-500/20' 
                : 'border-slate-100'
        }`}>
            {isIncomplete && (
                <div className="absolute -top-2 right-2 bg-[#FFA500] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-md z-10 border border-white uppercase tracking-wider animate-bounce-subtle">
                    Incompleto
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-3">
                    {(() => {
                        const uName = ((log as any)._resolvedUnidad || log.unidadName || '').toUpperCase();
                        const uId = (log.unidadId || '').toUpperCase();
                        const isU6 = uName.includes('U6') || uId.includes('U6');
                        const isU8 = uName.includes('U8') || uId.includes('U8');
                        const isU4 = uName.includes('U4') || uId.includes('U4');
                        const isU5 = uName.includes('U5') || uId.includes('U5');
                        const isU1 = (uName.includes('U1') || uId.includes('U1')) && 
                                     !(uName.includes('U10') || uId.includes('U10') || 
                                       uName.includes('U11') || uId.includes('U11') || 
                                       uName.includes('U12') || uId.includes('U12'));
                        const isU2 = uName.includes('U2') || uId.includes('U2') || uName.includes('BONGO') || uId.includes('BONGO');

                        if (isU6) {
                            return (
                                <div className="bg-white border border-slate-200/60 p-0.5 rounded-lg w-14 h-9 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                    <SovereignVehicleImage 
                                        src="/kia_bongo_u6.png?v=hd65white" 
                                        alt="Hyundai HD65 U6" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            );
                        }

                        if (isU8) {
                            return (
                                <div className="bg-white border border-slate-200/60 p-0.5 rounded-lg w-14 h-9 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                    <SovereignVehicleImage 
                                        src="/u8_real.png?v=2005champagne" 
                                        alt="Suzuki Vitara U8" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            );
                        }

                        if (isU4) {
                            return (
                                <div className="bg-white border border-slate-200/60 p-0.5 rounded-lg w-14 h-9 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                    <SovereignVehicleImage 
                                        src="/kia_morning_u4.png?v=2014white" 
                                        alt="Kia Morning U4" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            );
                        }

                        if (isU5) {
                            return (
                                <div className="bg-white border border-slate-200/60 p-0.5 rounded-lg w-14 h-9 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                    <SovereignVehicleImage 
                                        src="/nissan_ud_u5.png?v=1998white_elongated" 
                                        alt="Nissan UD 1400 U5" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            );
                        }

                        if (isU1) {
                            return (
                                <div className="bg-white border border-slate-200/60 p-0.5 rounded-lg w-14 h-9 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                    <SovereignVehicleImage 
                                        src="/nissan_pathfinder_u1.png?v=2001black" 
                                        alt="Nissan Pathfinder U1" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            );
                        }

                        if (isU2) {
                            return (
                                <div className="bg-white border border-slate-200/60 p-0.5 rounded-lg w-14 h-9 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                    <SovereignVehicleImage 
                                        src="/kia_bongo.png" 
                                        alt="Kia Bongo U2" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            );
                        }

                        return (
                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                                <FaTruck size={20} />
                            </div>
                        );
                    })()}
                    <div>
                        <div className="text-lg font-bold text-slate-900">{(log as any)._resolvedUnidad || log.unidadName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">
                            {(() => {
                                const resolvedPlaca = (log as any)._resolvedPlaca;
                                const extraerPlaca = (val: string) => {
                                    if (!val || typeof val !== 'string') return '';
                                    const parts = val.split(' - ');
                                    return parts.length > 2 ? parts[2]?.trim() || '' : (parts.length > 1 ? parts[1]?.trim() || '' : '');
                                };
                                const placa = resolvedPlaca?.trim() 
                                    ? resolvedPlaca 
                                    : extraerPlaca(log.unidadId || '');
                                return placa ? placa : "SIN PLACA";
                            })()}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2 py-1 rounded-md text-xs font-medium">
                    <FaCalendar size={14} />
                    {(() => {
                        const dateStr = log.fecha || log.createdAt || '';
                        if (!dateStr) return '---';
                        if (dateStr.includes('T')) {
                            return new Date(dateStr).toLocaleDateString();
                        }
                        const [year, month, day] = dateStr.split('-').map(Number);
                        return new Date(year, month - 1, day).toLocaleDateString();
                    })()}
                </div>
            </div>

            {/* Body */}
            <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="text-blue-500 bg-blue-50 p-1.5 rounded-full">
                        <FaUser size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-800">{(log as any)._resolvedName || 'Sin Conductor'}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Conductor</div>
                    </div>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                         <div className="text-blue-500 bg-blue-50 p-1.5 rounded-full shrink-0">
                            <FaMapPin size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider block truncate" title={log.destino || 'Sin Actividad'}>{log.destino || 'Sin Actividad'}</span>
                            <div className="text-[10px] text-slate-400 font-bold">Ruta / Actividad</div>
                        </div>
                    </div>

                    {/* COSTOS OPERATIVOS - Oculto en Bitácoras */}
                    {false && (
                        totalExpenses > 0 ? (
                            <button 
                                onClick={onCostAnalysis}
                                className="flex items-center gap-2 border-l border-slate-100 pl-4 shrink-0 hover:bg-slate-50 transition-colors rounded-lg pr-2 active:scale-95"
                                title="Ver Análisis de Costos"
                            >
                                <div className="text-emerald-500 bg-emerald-50 p-1.5 rounded-full">
                                    <FaCreditCard size={14} />
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-emerald-600">₡{totalExpenses.toLocaleString()}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{expenses.length} Gastos</div>
                                </div>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-4 shrink-0 opacity-40">
                                <div className="text-slate-400 bg-slate-50 p-1.5 rounded-full">
                                    <FaCreditCard size={14} />
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-slate-400">₡0</div>
                                    <div className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">Sin Gastos</div>
                                </div>
                            </div>
                        )
                    )}

                    <div className="flex items-center gap-2 border-l border-slate-100 pl-4 shrink-0">
                        <div className="text-emerald-500 bg-emerald-50 p-1.5 rounded-full">
                            <FaTachometerAlt size={16} />
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-black text-slate-800">{log.totalKm || 0} km</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase">Kilometraje</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
                <ActionButtons 
                    onPdf={onPdf}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onTimeline={onTimeline}
                />
            </div>
        </div>
    );
});

VehicleLogCard.displayName = "VehicleLogCard";
