import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiActivity, FiClock, FiDollarSign, FiInfo } from "react-icons/fi";
import { IconButton, ActionButton, DataTable } from '../../../design-system';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';
import { AutomaticAdjustment } from './automaticAdjustments.types';
import { PayStub } from '../../../financeTypes';
import { generateAutomaticAdjustmentPDF } from '../../../utils/pdfGenerator';
import { useState } from 'react';

interface AutomaticAdjustmentDetailModalProps {
    show: boolean;
    onClose: () => void;
    adjustment: AutomaticAdjustment | null;
    payStubs: PayStub[];
}

export const AutomaticAdjustmentDetailModal: React.FC<AutomaticAdjustmentDetailModalProps> = ({
    show, onClose, adjustment, payStubs
}) => {
    useLockBodyScroll(show);
    const [isGenerating, setIsGenerating] = useState(false);

    if (!show || !adjustment) return null;

    // Filter paystubs that used this adjustment
    const history = payStubs
        .filter(stub => stub.employeeId === adjustment.employeeId && stub.customFields?.some(field => field.automaticAdjustmentId === adjustment.id))
        .map(stub => {
            const field = stub.customFields?.find(f => f.automaticAdjustmentId === adjustment.id);
            return {
                id: stub.id,
                date: stub.generatedDate, 
                period: stub.periodo,
                planillaId: stub.planillaId,
                amount: field?.amount || 0,
                type: adjustment.type,
                status: 'Aplicado'
            };
        })
        .sort((a, b) => {
            const dateA = typeof a.date === 'number' ? a.date : (a.date as any)?.seconds || 0;
            const dateB = typeof b.date === 'number' ? b.date : (b.date as any)?.seconds || 0;
            return dateB - dateA;
        });

    const formatDate = (date: any) => {
        if (!date) return '---';
        if (typeof date === 'number') return new Date(date).toLocaleDateString();
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
        return new Date(date).toLocaleDateString();
    };

    const historyColumns = [
        { 
            header: "Fecha", 
            render: (item: any) => <span className="text-xs font-bold text-slate-600">{formatDate(item.date)}</span> 
        },
        { 
            header: "Planilla / Colilla", 
            render: (item: any) => (
                <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800">{item.planillaId}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.period}</span>
                </div>
            )
        },
        { 
            header: "Monto", 
            render: (item: any) => <span className="text-xs font-black text-blue-900">₡{item.amount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
        },
        { 
            header: "Estado", 
            render: (item: any) => (
                <span className="px-2 py-1 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700 uppercase tracking-tighter">
                    {item.status}
                </span>
            )
        }
    ];

    return createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[250] p-4">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-[32px] flex-none">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${adjustment.type === 'ingreso' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            <FiActivity size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                                DETALLE DE AJUSTE
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Vista de solo lectura del ajuste automático</p>
                        </div>
                    </div>
                    <IconButton 
                        variant="neutral" 
                        icon={<FiX />} 
                        onClick={onClose} 
                        title="Cerrar"
                    />
                </div>

                {/* Body */}
                <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar bg-white">
                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                        <DetailItem label="Colaborador" value={adjustment.employeeName} icon={<FiInfo />} />
                        <DetailItem 
                            label="Tipo" 
                            value={adjustment.type === 'ingreso' ? 'INGRESO (+)' : 'DEDUCCIÓN (-)'} 
                            badgeClassName={adjustment.type === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}
                        />
                        <DetailItem label="Concepto" value={adjustment.conceptName} valueClassName="italic" />
                        <DetailItem 
                            label="Estado" 
                            value={adjustment.status.toUpperCase()} 
                            badgeClassName={
                                adjustment.status === 'activo' ? 'bg-blue-100 text-blue-700' : 
                                adjustment.status === 'pausado' ? 'bg-amber-100 text-amber-700' : 
                                'bg-slate-100 text-slate-600'
                            }
                        />
                        <div className="col-span-1 sm:col-span-2">
                            <DetailItem label="Comentario / Observación" value={adjustment.comment || 'Sin observaciones'} />
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FiDollarSign className="text-blue-500" /> Resumen Financiero
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto Total</p>
                                <p className="text-lg font-black text-blue-950">₡{adjustment.totalAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cuota Quincenal</p>
                                <p className="text-lg font-black text-blue-900">₡{adjustment.fortnightlyQuota.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Pendiente</p>
                                <p className="text-lg font-black text-rose-600">₡{adjustment.pendingBalance.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                <FiClock size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Inicio</p>
                                <p className="font-black text-slate-700 text-sm">{adjustment.startDate}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100">
                            <div className="p-2 rounded-lg bg-slate-50 text-slate-500">
                                <FiClock size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Final</p>
                                <p className="font-black text-slate-700 text-sm">{adjustment.endDate || 'Indefinida'}</p>
                            </div>
                        </div>
                    </div>

                    {/* History Section */}
                    <div>
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-5 h-px bg-blue-200"></span> HISTORIAL DE APLICACIONES
                        </h4>
                        
                        <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                            <DataTable
                                data={history}
                                columns={historyColumns}
                                keyExtractor={(item) => item.id}
                                emptyMessage="No se registran aplicaciones para este ajuste aún."
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50 rounded-b-[32px] flex-none">
                    <ActionButton 
                        type="button" 
                        onClick={async () => {
                            setIsGenerating(true);
                            await generateAutomaticAdjustmentPDF(adjustment, history);
                            setIsGenerating(false);
                        }}
                        label={isGenerating ? "GENERANDO..." : "DESCARGAR PDF"}
                        variant="primary"
                        disabled={isGenerating}
                    />
                    <ActionButton 
                        type="button" 
                        onClick={onClose} 
                        label="Cerrar Vista"
                        variant="secondary"
                        className="px-8"
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};

interface DetailItemProps {
    label: string;
    value: string;
    icon?: React.ReactNode;
    badgeClassName?: string;
    valueClassName?: string;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, icon, badgeClassName, valueClassName }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{label}</label>
        <div className="flex items-center gap-2">
            {icon && <span className="text-slate-300">{icon}</span>}
            {badgeClassName ? (
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${badgeClassName}`}>
                    {value}
                </span>
            ) : (
                <span className={`text-sm font-black text-slate-800 ${valueClassName || ''}`}>{value}</span>
            )}
        </div>
    </div>
);
