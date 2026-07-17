import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Quote } from '../utils/types';
import { CashflowEntry, MovementType, ExpenseSubtype } from '../cashflowTypes';
import { FiX, FiAlertCircle, FiSave } from "react-icons/fi";
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { getYearFromDateString } from '../utils/dateUtils';
import { ActionButton, IconButton } from '../design-system';

interface CashflowModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  quotes: Quote[];
  currentUser: User;
  initialData?: CashflowEntry | null;
}

export const CashflowModal: React.FC<CashflowModalProps> = ({ 
    show, onClose, onSubmit, quotes, currentUser, initialData 
}) => {
  useLockBodyScroll(show);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<MovementType>('Egreso');
  const [subtype, setSubtype] = useState<ExpenseSubtype | ''>('');
  const [projectId, setProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'CRC'>('CRC');
  const [description, setDescription] = useState('');
  const [invoice, setInvoice] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
        if (initialData) {
            setDate(initialData.date);
            setType(initialData.type);
            setSubtype(initialData.subtype || '');
            setProjectId(initialData.projectId || '');
            setAmount(initialData.amount.toString());
            setCurrency(initialData.currency);
            setDescription(initialData.description);
            setInvoice(initialData.invoice || '');
        } else {
            setDate(new Date().toISOString().split('T')[0]);
            setType('Egreso');
            setSubtype('');
            setProjectId('');
            setAmount('');
            setCurrency('CRC');
            setDescription('');
            setInvoice('');
        }
        setError(null);
    }
  }, [show, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date || !type || !amount || !description) {
        setError("Los campos marcados con * son obligatorios.");
        return;
    }

    if (type === 'Egreso' && !subtype) {
        setError("Debe seleccionar una categoría para los egresos.");
        return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        setError("El monto debe ser un número mayor a 0.");
        return;
    }

    setIsSubmitting(true);
    try {
        const payload = {
            date,
            type,
            subtype: type === 'Egreso' ? subtype : null,
            projectId: projectId || null,
            amount: amountNum,
            currency,
            description,
            invoice: invoice.trim() || null,
            createdBy: currentUser.id,
            createdAt: initialData ? initialData.createdAt : new Date().toISOString()
        };

        await onSubmit(payload);
        onClose();
    } catch (err: any) {
        setError(err.message || "Error al guardar el movimiento.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-[32px] flex-none">
                <div>
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">{initialData ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestión de Caja y Flujo</p>
                </div>
                <IconButton 
                    variant="neutral" 
                    icon={<FiX />} 
                    onClick={onClose} 
                    title="Cerrar"
                />
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar bg-white">
                
                <div className="grid grid-cols-2 gap-4">
                    {/* Fecha */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha *</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                        />
                    </div>

                    {/* Tipo */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo de Movimiento *</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <ActionButton 
                                type="button"
                                label="Ingreso"
                                onClick={() => { setType('Ingreso'); setSubtype(''); }}
                                variant={type === 'Ingreso' ? 'primary' : 'secondary'}
                                className={`!flex-1 !py-2 !text-[10px] !font-black !uppercase !rounded-lg !transition-all ${type === 'Ingreso' ? '!bg-emerald-500 !text-white !shadow-md' : '!bg-transparent !text-slate-400 hover:!text-slate-600'}`}
                            />
                            <ActionButton 
                                type="button"
                                label="Egreso"
                                onClick={() => setType('Egreso')}
                                variant={type === 'Egreso' ? 'primary' : 'secondary'}
                                className={`!flex-1 !py-2 !text-[10px] !font-black !uppercase !rounded-lg !transition-all ${type === 'Egreso' ? '!bg-rose-500 !text-white !shadow-md' : '!bg-transparent !text-slate-400 hover:!text-slate-600'}`}
                            />
                        </div>
                    </div>

                    {/* Subtipo (Solo para Egreso) */}
                    {type === 'Egreso' && (
                        <div className="col-span-2 animate-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Categoría de Gasto *</label>
                            <select
                                value={subtype}
                                onChange={e => setSubtype(e.target.value as ExpenseSubtype)}
                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                            >
                                <option value="">-- Seleccione Categoría --</option>
                                <option value="Gasto Operativo">Gasto Operativo</option>
                                <option value="Gasto Administrativo">Gasto Administrativo</option>
                                <option value="Costo de Proyecto">Costo de Proyecto</option>
                                <option value="Otro Egreso">Otro Egreso</option>
                            </select>
                        </div>
                    )}

                    {/* Proyecto Asociado */}
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Proyecto / Cotización (Opcional)</label>
                        <select
                            value={projectId}
                            onChange={e => setProjectId(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            <option value="">-- Sin Proyecto Asociado --</option>
                            {quotes.map(q => (
                                <option key={q.id} value={q.id}>
                                    #{q.id.toString().padStart(3, '0')}-{getYearFromDateString(q.fecha)} | {q.empresa}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Monto */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Monto *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                                {currency === 'USD' ? '$' : '₡'}
                            </span>
                            <input 
                                type="number" 
                                step="0.01"
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full pl-8 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Moneda */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Moneda</label>
                        <select
                            value={currency}
                            onChange={e => setCurrency(e.target.value as 'USD' | 'CRC')}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            <option value="CRC">Colones (CRC)</option>
                            <option value="USD">Dólares (USD)</option>
                        </select>
                    </div>

                    {/* Factura */}
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Número de Factura (Opcional)</label>
                        <input 
                            type="text" 
                            value={invoice} 
                            onChange={e => setInvoice(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            placeholder="Ej: FAC-12345"
                        />
                    </div>

                    {/* Descripción */}
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Descripción / Detalle *</label>
                        <textarea 
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 h-20 resize-none outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                            placeholder="Detalle del movimiento..."
                        ></textarea>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 text-center animate-pulse">
                        <FiAlertCircle className="mr-1 inline"  /> {error}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-100 flex-none">
                <ActionButton 
                    variant="neutral" 
                    label="Cancelar" 
                    onClick={onClose} 
                    className="flex-1 !py-3 !text-xs !font-bold !uppercase !rounded-xl"
                />
                <ActionButton 
                    type="submit" 
                    disabled={isSubmitting} 
                    isLoading={isSubmitting}
                    label={initialData ? 'Guardar' : 'Registrar Movimiento'}
                    icon={FiSave}
                    variant="primary"
                    className="flex-1 !py-3 !text-xs !font-black !uppercase !tracking-wider !rounded-xl"
                />
            </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
