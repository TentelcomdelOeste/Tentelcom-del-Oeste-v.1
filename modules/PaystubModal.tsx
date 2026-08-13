import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Employee, PayStub, Fortnight, CustomPaystubField } from '../financeTypes';
import { User } from '../utils/types';
import { canGeneratePaystub } from '../utils/paystubValidation';
import { FiX, FiAlertCircle, FiSave, FiDollarSign, FiPlus, FiTrash2 } from "react-icons/fi";
import { ActionButton, IconButton, Select, ConfirmModal } from '../design-system';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.split(' ').map(word => {
        if (!word) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

import { AutomaticAdjustment } from './finance/automatic_adjustments/automaticAdjustments.types';

interface PaystubModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any, id?: string) => Promise<void>;
  employees: Employee[];
  currentUser: User;
  payStubs: PayStub[];
  payStubToEdit?: PayStub | null;
  automaticAdjustments?: AutomaticAdjustment[];
}

export const PaystubModal: React.FC<PaystubModalProps> = ({ 
    show, onClose, onSubmit, employees, currentUser, payStubs, payStubToEdit, automaticAdjustments = []
}) => {
  useLockBodyScroll(show);

  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [fortnight, setFortnight] = useState<Fortnight>('Primera');
  
  const [ordinaryHours, setOrdinaryHours] = useState('150');
  const [extraHoursCount, setExtraHoursCount] = useState('0');
  const [holidayHoursCount, setHolidayHoursCount] = useState('0');
  const [bonuses, setBonuses] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [legalEmbargos, setLegalEmbargos] = useState('');
  const [travelExpenses, setTravelExpenses] = useState('');
  const [availabilityBonus, setAvailabilityBonus] = useState('');
  
  const [customFields, setCustomFields] = useState<CustomPaystubField[]>([]);
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const isAdminRole = currentUser.role === 'admin';

  // Compute calculated amounts dynamically
  const selectedEmployee = useMemo(() => employees.find(e => e.id === employeeId), [employees, employeeId]);
  
  const valHoraOrg = selectedEmployee ? (selectedEmployee.baseSalary || 0) / 300 : 0;
  const valHoraExt = valHoraOrg * 1.5;

  const currentOrdinaryHours = ordinaryHours ? parseFloat(ordinaryHours) : 0;
  const currentExtraHoursCount = extraHoursCount ? parseFloat(extraHoursCount) : 0;
  const currentHolidayHoursCount = holidayHoursCount ? parseFloat(holidayHoursCount) : 0;

  const currentBonuses = bonuses ? parseFloat(bonuses) : 0;
  const currentAdvancePayment = advancePayment ? parseFloat(advancePayment) : 0;
  const currentLegalEmbargos = legalEmbargos ? parseFloat(legalEmbargos) : 0;
  const currentTravelExpenses = travelExpenses ? parseFloat(travelExpenses) : 0;
  const currentAvailabilityBonus = availabilityBonus ? parseFloat(availabilityBonus) : 0;

  const computedOrdinarySalary = Math.round(valHoraOrg * currentOrdinaryHours * 100) / 100;
  const computedExtraSalary = Math.round(valHoraExt * currentExtraHoursCount * 100) / 100;
  const computedHolidaySalary = Math.round(valHoraOrg * currentHolidayHoursCount * 2 * 100) / 100;

  const employeeOptions = useMemo(() => {
    return employees
      .filter(emp => {
          const isValid = emp.status === 'activo' && emp.name && emp.email && emp.employeeCode;
          if (!isAdminRole) {
              return isValid && emp.email === currentUser.email;
          }
          return isValid;
      })
      .map(emp => ({
        label: `${emp.name} (${emp.employeeCode})`,
        value: emp.id
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employees, isAdminRole, currentUser.email]);

  const initializedRef = React.useRef<{ show: boolean, editId: string | null | undefined }>({ show: false, editId: undefined });

  useEffect(() => {
    const currentEditId = payStubToEdit ? payStubToEdit.id : null;
    // Only initialize when show transitions to true OR payStubToEdit changes
    if (show && (!initializedRef.current.show || initializedRef.current.editId !== currentEditId)) {
        if (payStubToEdit) {
            setEmployeeId(payStubToEdit.employeeId);
            setYear(payStubToEdit.year);
            setMonth(payStubToEdit.month);
            setFortnight(payStubToEdit.fortnight);
            setOrdinaryHours((payStubToEdit.ordinaryHours || 0).toString());
            setExtraHoursCount((payStubToEdit.extraHoursCount || 0).toString());
            setHolidayHoursCount((payStubToEdit.holidayHoursCount || 0).toString());
            setBonuses((payStubToEdit.bonuses || 0).toString());
            setAdvancePayment((payStubToEdit.advancePayment || 0).toString());
            setLegalEmbargos((payStubToEdit.legalEmbargos || 0).toString() || '');
            setTravelExpenses((payStubToEdit.travelExpenses || 0).toString());
            setAvailabilityBonus((payStubToEdit.availabilityBonus || 0).toString());
            setCustomFields(payStubToEdit.customFields || []);
        } else if (isAdminRole) {
            setEmployeeId('');
            setYear(new Date().getFullYear());
            setMonth(new Date().getMonth() + 1);
            setFortnight(new Date().getDate() <= 15 ? 'Primera' : 'Segunda');
            setOrdinaryHours('150');
            setExtraHoursCount('0');
            setHolidayHoursCount('0');
            setBonuses('');
            setAdvancePayment('');
            setLegalEmbargos('');
            setTravelExpenses('');
            setAvailabilityBonus('');
            setCustomFields([]);
        } else {
            const me = employees.find(e => e.email === currentUser.email);
            if (me) {
                setEmployeeId(me.id);
            }
            setYear(new Date().getFullYear());
            setMonth(new Date().getMonth() + 1);
            setFortnight(new Date().getDate() <= 15 ? 'Primera' : 'Segunda');
            setOrdinaryHours('150');
            setExtraHoursCount('0');
            setHolidayHoursCount('0');
            setBonuses('');
            setAdvancePayment('');
            setLegalEmbargos('');
            setTravelExpenses('');
            setAvailabilityBonus('');
            setCustomFields([]);
        }
        setError(null);
        initializedRef.current = { show: true, editId: currentEditId };
    } else if (!show && initializedRef.current.show) {
        initializedRef.current = { show: false, editId: undefined };
    }
  }, [show, employees, currentUser, isAdminRole, payStubToEdit]);

  useEffect(() => {
     if (show && !payStubToEdit && employeeId && year && month && fortnight) {
         // Determine if there are active automatic adjustments for this employee and period
         const dateOfStub = new Date(year, month - 1, fortnight === 'Primera' ? 15 : 28);
         
         const activeAdjustments = automaticAdjustments.filter(adj => {
             if (adj.employeeId !== employeeId) return false;
             if (adj.status !== 'activo') return false;
             if (adj.pendingBalance <= 0) return false;
             
             const startDateObj = new Date(adj.startDate);
             if (dateOfStub < startDateObj) return false;
             
             if (adj.endDate) {
                 const endDateObj = new Date(adj.endDate);
                 if (dateOfStub > endDateObj) return false;
             }
             
             return true;
         });

         const newCustomFields = activeAdjustments.map(adj => {
             let amountToApply = adj.fortnightlyQuota;
             if (adj.pendingBalance < amountToApply) {
                 amountToApply = adj.pendingBalance;
             }

             return {
                 id: "auto_" + adj.id,
                 type: adj.type,
                 name: adj.conceptName,
                 amount: amountToApply,
                 isAutomatic: true,
                 automaticAdjustmentId: adj.id,
                 comment: adj.comment
             };
         });

         // Only update customFields if we have active adjustments and haven't already added them
         setCustomFields(prev => {
             const manualFields = prev.filter(f => !f.isAutomatic);
             // Prevent infinite re-renders or duplicating
             return [...manualFields, ...newCustomFields];
         });
     }
  }, [employeeId, year, month, fortnight, show, payStubToEdit, automaticAdjustments]);

  const addCustomField = () => {
      if (!isAdminRole) return;
      setCustomFields([...customFields, { id: Math.random().toString(36).substr(2, 9), type: 'ingreso', name: '', amount: 0 }]);
  };

  const updateCustomField = (id: string, key: keyof CustomPaystubField, value: any) => {
      if (!isAdminRole) return;
      setCustomFields(customFields.map(cf => cf.id === id ? { ...cf, [key]: value } : cf));
  };

  const removeCustomField = (id: string) => {
      if (!isAdminRole) return;
      setCustomFields(customFields.filter(cf => cf.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!employeeId || !year || !month || !fortnight) {
        setError("Los campos marcados con * son obligatorios.");
        return;
    }

    // Verificar si ya existe una colilla para este periodo, pero permitir si es la misma que estamos editando
    const exists = payStubs.some(p => 
        p.employeeId === employeeId && 
        p.year === year && 
        p.month === month && 
        p.fortnight === fortnight &&
        (!payStubToEdit || p.id !== payStubToEdit.id)
    );

    if (exists) {
        setError("Ya existe una colilla generada para este colaborador en el periodo seleccionado.");
        return;
    }

    // --- VALIDACIÓN EMPRESARIAL TEMPORAL ---
    const validation = canGeneratePaystub(year, month, fortnight);
    if (!validation.allowed) {
        setError(`${validation.message}\n\n${validation.details || ''}`);
        return;
    }
    // ----------------------------------------

    setIsSubmitting(true);
    try {
        const payload = {
            creatorId: currentUser.id,
            createdByRole: currentUser.role,
            employeeId,
            employeeEmail: employees.find(e => e.id === employeeId)?.email || '',
            year,
            month,
            fortnight,
            ordinaryHours: currentOrdinaryHours,
            extraHoursCount: currentExtraHoursCount,
            extraHours: computedExtraSalary,
            baseSalary: computedOrdinarySalary,
            holidayHoursCount: currentHolidayHoursCount,
            holidays: computedHolidaySalary,
            bonuses: bonuses ? parseFloat(bonuses) : 0,
            advancePayment: advancePayment ? parseFloat(advancePayment) : 0,
            legalEmbargos: legalEmbargos ? parseFloat(legalEmbargos) : 0,
            travelExpenses: travelExpenses ? parseFloat(travelExpenses) : 0,
            availabilityBonus: availabilityBonus ? parseFloat(availabilityBonus) : 0,
            customFields
        };

        if (payStubToEdit) {
            await onSubmit(payload, payStubToEdit.id);
        } else {
            await onSubmit(payload);
        }
        onClose();
    } catch (err: any) {
        setError(err.message || "Error al guardar la colilla.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-[32px] flex-none">
                <div>
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                        {payStubToEdit ? 'Editar Colilla' : 'Generar Colilla'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cálculo de Nómina</p>
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
                    {/* Colaborador */}
                    <div className="col-span-2">
                        <Select
                            label="Colaborador *"
                            options={employeeOptions}
                            value={employeeId}
                            onChange={setEmployeeId}
                            placeholder="-- Seleccione Colaborador --"
                            isSearchable={isAdminRole}
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Periodo */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Año *</label>
                        <select
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value))}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Mes *</label>
                        <select
                            value={month}
                            onChange={e => setMonth(parseInt(e.target.value))}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                    </div>

                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Quincena *</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <ActionButton 
                                type="button"
                                label="Primera (1-15)"
                                onClick={() => setFortnight('Primera')}
                                variant={fortnight === 'Primera' ? 'primary' : 'secondary'}
                                className={`!flex-1 !py-2 !text-[10px] !font-black !uppercase !rounded-lg !transition-all ${fortnight === 'Primera' ? '!bg-white !text-blue-900 !shadow-md' : '!bg-transparent !text-slate-400 hover:!text-slate-600'}`}
                            />
                            <ActionButton 
                                type="button"
                                label="Segunda (16-Fin)"
                                onClick={() => setFortnight('Segunda')}
                                variant={fortnight === 'Segunda' ? 'primary' : 'secondary'}
                                className={`!flex-1 !py-2 !text-[10px] !font-black !uppercase !rounded-lg !transition-all ${fortnight === 'Segunda' ? '!bg-white !text-blue-900 !shadow-md' : '!bg-transparent !text-slate-400 hover:!text-slate-600'}`}
                            />
                        </div>
                    </div>

                    {/* Advertencia de Periodo Futuro */}
                    {(() => {
                        const v = canGeneratePaystub(year, month, fortnight);
                        if (!v.allowed && !error) {
                            return (
                                <div className="col-span-2 bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-2 shadow-sm animate-in fade-in slide-in-from-top-1">
                                    <FiAlertCircle className="text-amber-500 mt-0.5 shrink-0" size={16} />
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-tight">{v.message}</p>
                                        <p className="text-[9px] text-amber-600 font-medium leading-tight mt-0.5">{v.details}</p>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div className="col-span-2">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 mb-1 flex items-center gap-2">
                            <FiDollarSign className="text-blue-500" /> Ajustes de Nómina
                        </h4>
                    </div>

                    {/* Horas Ordinarias */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Horas Ordinarias</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={ordinaryHours} 
                            onChange={e => setOrdinaryHours(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="150"
                            disabled={!isAdminRole}
                        />
                        {isAdminRole && (
                            <div className="mt-1.5 text-xs font-semibold text-slate-500 transition-all duration-300">
                                ₡{computedOrdinarySalary.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>

                    {/* Horas Extra */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Horas Extra</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={extraHoursCount} 
                            onChange={e => setExtraHoursCount(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0"
                            disabled={!isAdminRole}
                        />
                        {isAdminRole && (
                            <div className="mt-1.5 text-xs font-semibold text-slate-500 transition-all duration-300">
                                ₡{computedExtraSalary.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>

                    {/* Horas Feriado */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Horas Feriado</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={holidayHoursCount} 
                            onChange={e => setHolidayHoursCount(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0"
                            disabled={!isAdminRole}
                        />
                        {isAdminRole && (
                            <div className="mt-1.5 text-xs font-semibold text-slate-500 transition-all duration-300">
                                ₡{computedHolidaySalary.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                    
                    {/* Bonificaciones */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Bonos / Incentivos</label>
                        <input 
                            type="number" 
                            value={bonuses} 
                            onChange={e => setBonuses(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Adelantos */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Adelantos de Salario</label>
                        <input 
                            type="number" 
                            value={advancePayment} 
                            onChange={e => setAdvancePayment(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Embargos Legales */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Embargos Legales</label>
                        <input 
                            type="number" 
                            value={legalEmbargos} 
                            onChange={e => setLegalEmbargos(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Viáticos */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Viáticos</label>
                        <input 
                            type="number" 
                            value={travelExpenses} 
                            onChange={e => setTravelExpenses(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Disponibilidad */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Plus Disponibilidad</label>
                        <input 
                            type="number" 
                            value={availabilityBonus} 
                            onChange={e => setAvailabilityBonus(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                            placeholder="0.00"
                            disabled={!isAdminRole}
                        />
                    </div>

                    {/* Conceptos Personalizados */}
                    <div className="col-span-2">
                        <div className="flex justify-between items-center mt-4 mb-3">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-4 h-px bg-blue-200"></span> Conceptos Personalizados
                            </h4>
                            {isAdminRole && (
                                <button type="button" onClick={addCustomField} className="text-blue-500 hover:text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors">
                                    <FiPlus /> Nuevo Concepto
                                </button>
                            )}
                        </div>
                        
                        {customFields.length > 0 ? (
                            <div className="space-y-3">
                                {customFields.map((cf) => (
                                    <div key={cf.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <select 
                                            value={cf.type} 
                                            onChange={e => updateCustomField(cf.id, 'type', e.target.value as 'ingreso' | 'deduccion')}
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none w-1/4 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!isAdminRole}
                                        >
                                            <option value="ingreso">Ingreso (+)</option>
                                            <option value="deduccion">Deducción (-)</option>
                                        </select>
                                        <input 
                                            type="text" 
                                            value={cf.name} 
                                            onChange={e => updateCustomField(cf.id, 'name', toTitleCase(e.target.value))}
                                            placeholder="Nombre del concepto"
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!isAdminRole}
                                        />
                                        <input 
                                            type="number" 
                                            value={cf.amount || ''} 
                                            onChange={e => updateCustomField(cf.id, 'amount', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none w-1/4 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!isAdminRole}
                                        />
                                        {isAdminRole && !cf.isAutomatic && (
                                            <button type="button" onClick={() => setFieldToDelete(cf.id)} className="p-2 text-red-500 hover:text-red-700 transition-colors" title="Eliminar Concepto">
                                                <FiTrash2 />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 font-medium italic text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                No hay conceptos personalizados agregados.
                            </div>
                        )}
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
                    type="button" 
                    onClick={onClose} 
                    label="Cancelar"
                    variant="secondary"
                    className="flex-1 !py-3 !text-xs !font-bold !uppercase !rounded-xl"
                />
                <ActionButton 
                    type="submit" 
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    label={payStubToEdit ? "Guardar Cambios" : "Generar Colilla"}
                    icon={<FiSave />}
                    variant="primary"
                    className="flex-1 !py-3 !text-xs !font-black !uppercase !tracking-wider !rounded-xl"
                />
            </div>
        </form>
        <ConfirmModal
            show={!!fieldToDelete}
            onClose={() => setFieldToDelete(null)}
            onConfirm={() => {
                if (fieldToDelete) {
                    removeCustomField(fieldToDelete);
                    setFieldToDelete(null);
                }
            }}
            title="¿Desea eliminar este concepto personalizado?"
            description="Esta acción eliminará el concepto. ¿Deseas continuar?"
            confirmLabel="CONFIRMAR"
            variant="danger"
        />
      </div>
    </div>,
    document.body
  );
};
