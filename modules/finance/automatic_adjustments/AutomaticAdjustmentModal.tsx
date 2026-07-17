import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiSave } from "react-icons/fi";
import { ActionButton, IconButton, Select } from '../../../design-system';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';
import { Employee } from '../../../financeTypes';
import { AutomaticAdjustment } from './automaticAdjustments.types';
import { User } from '../../../utils/types';

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.split(' ').map(word => {
        if (!word) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

interface AutomaticAdjustmentModalProps {
    show: boolean;
    onClose: () => void;
    employees: Employee[];
    onSave: (data: any, id?: string) => Promise<{success: boolean; message?: string}>;
    editingAdjustment?: AutomaticAdjustment | null;
    currentUser: User | null;
}

export const AutomaticAdjustmentModal: React.FC<AutomaticAdjustmentModalProps> = ({
    show, onClose, employees, onSave, editingAdjustment, currentUser
}) => {
    useLockBodyScroll(show);

    const [employeeId, setEmployeeId] = useState('');
    const [type, setType] = useState<'ingreso' | 'deduccion'>('ingreso');
    const [conceptName, setConceptName] = useState('');
    const [comment, setComment] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [fortnightlyQuota, setFortnightlyQuota] = useState('');
    const [pendingBalance, setPendingBalance] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState<'activo' | 'pausado' | 'finalizado'>('activo');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (show) {
            setError(null);
            if (editingAdjustment) {
                setEmployeeId(editingAdjustment.employeeId);
                setType(editingAdjustment.type);
                setConceptName(editingAdjustment.conceptName);
                setComment(editingAdjustment.comment || '');
                setTotalAmount(editingAdjustment.totalAmount.toString());
                setFortnightlyQuota(editingAdjustment.fortnightlyQuota.toString());
                setPendingBalance(editingAdjustment.pendingBalance.toString());
                setStartDate(editingAdjustment.startDate);
                setEndDate(editingAdjustment.endDate || '');
                setStatus(editingAdjustment.status);
            } else {
                setEmployeeId('');
                setType('ingreso');
                setConceptName('');
                setComment('');
                setTotalAmount('');
                setFortnightlyQuota('');
                setPendingBalance('');
                setStartDate(new Date().toISOString().split('T')[0]);
                setEndDate('');
                setStatus('activo');
            }
        }
    }, [show, editingAdjustment]);

    // Sync pendingBalance with totalAmount ONLY for new entries - REMOVED useEffect in favor of direct onChange sync
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        // Final sanity check for pendingBalance if it was somehow skipped
        let currentPendingBalance = pendingBalance;
        if (!editingAdjustment && !currentPendingBalance && totalAmount) {
            currentPendingBalance = totalAmount;
            setPendingBalance(totalAmount);
        }
        
        if (!employeeId || !type || !conceptName || !totalAmount || !fortnightlyQuota || !currentPendingBalance || !startDate || !status) {
            setError('Por favor complete todos los campos requeridos.');
            return;
        }

        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) return;

        setIsSubmitting(true);
        try {
            const dataToSave = {
                employeeId,
                employeeName: employee.name,
                type,
                conceptName,
                comment,
                totalAmount: parseFloat(totalAmount),
                fortnightlyQuota: parseFloat(fortnightlyQuota),
                pendingBalance: parseFloat(currentPendingBalance),
                startDate,
                endDate: endDate || null,
                status,
                creatorId: currentUser?.id
            };

            const result = await onSave(dataToSave, editingAdjustment?.id);
            if (result.success) {
                onClose();
            } else {
                setError(result.message || 'Error al guardar el ajuste automático.');
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!show) return null;

    return createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
                <form id="adjustment-form" onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-[32px] flex-none">
                        <div>
                            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                                {editingAdjustment ? 'EDITAR AJUSTE AUTOMÁTICO' : 'NUEVO AJUSTE AUTOMÁTICO'}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Configuración de ingresos y deducciones recurrentes</p>
                        </div>
                        <IconButton 
                            variant="neutral" 
                            icon={<FiX />} 
                            onClick={onClose} 
                            title="Cerrar"
                        />
                    </div>

                    {/* Form Body */}
                    <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
                        {error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                                <FiX className="shrink-0" />
                                {error}
                            </div>
                        )}
                        {/* 1. INFORMACIÓN GENERAL */}
                        <div>
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-5 h-px bg-blue-200"></span> 1. Información General
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="col-span-1 sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Colaborador</label>
                                    <Select
                                        value={employeeId}
                                        onChange={(val: any) => setEmployeeId(val)}
                                        options={[
                                            { label: 'Seleccione un colaborador', value: '' },
                                            ...[...employees].sort((a,b) => a.name.localeCompare(b.name)).map(emp => ({ label: emp.name, value: emp.id }))
                                        ]}
                                        placeholder="Seleccione..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo</label>
                                    <Select
                                        value={type}
                                        onChange={(val: any) => setType(val)}
                                        options={[
                                            { label: 'Ingreso (+)', value: 'ingreso' },
                                            { label: 'Deducción (-)', value: 'deduccion' }
                                        ]}
                                        isSearchable={false}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Nombre del Concepto</label>
                                    <input
                                        type="text"
                                        value={conceptName}
                                        onChange={e => setConceptName(toTitleCase(e.target.value))}
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        required
                                        placeholder="Ej: Bono Especial"
                                    />
                                </div>
                                <div className="col-span-1 sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Comentario / Observación</label>
                                    <input
                                        type="text"
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        placeholder="Comentarios adicionales opcionales..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. CONFIGURACIÓN FINANCIERA */}
                        <div>
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-5 h-px bg-blue-200"></span> 2. Configuración Financiera
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Monto Total</label>
                                    <input
                                        id="totalAmount"
                                        name="totalAmount"
                                        type="number"
                                        value={totalAmount}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setTotalAmount(val);
                                            if (!editingAdjustment) {
                                                setPendingBalance(val);
                                            }
                                        }}
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Cuota Quincenal</label>
                                    <input
                                        id="fortnightlyQuota"
                                        name="fortnightlyQuota"
                                        type="number"
                                        value={fortnightlyQuota}
                                        onChange={e => setFortnightlyQuota(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Saldo Pendiente (Lectura)</label>
                                    <input
                                        id="pendingBalance"
                                        name="pendingBalance"
                                        type="number"
                                        value={pendingBalance}
                                        readOnly
                                        className="w-full p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-slate-500 outline-none cursor-not-allowed"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. CONTROL */}
                        <div>
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-5 h-px bg-blue-200"></span> 3. Control
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha Final (Opcional)</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Estado</label>
                                    <Select
                                        value={status}
                                        onChange={(val: any) => setStatus(val)}
                                        options={[
                                            { label: 'Activo', value: 'activo' },
                                            { label: 'Pausado', value: 'pausado' },
                                            { label: 'Finalizado', value: 'finalizado' }
                                        ]}
                                        isSearchable={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-[32px] flex-none mt-auto">
                        <ActionButton type="button" onClick={onClose} label="Cancelar" variant="secondary" />
                        <ActionButton 
                            type="submit" 
                            label={isSubmitting ? "Guardando..." : "Guardar Ajuste"} 
                            variant="primary" 
                            icon={<FiSave />} 
                            disabled={isSubmitting}
                            isLoading={isSubmitting}
                        />
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
