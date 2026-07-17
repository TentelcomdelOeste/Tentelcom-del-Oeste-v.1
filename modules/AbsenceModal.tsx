import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Employee, AbsenceRecord, AbsenceType } from '../financeTypes';
import { User } from '../utils/types';
import { FiX, FiAlertCircle, FiSave } from "react-icons/fi";
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { ActionButton, IconButton, Select } from '../design-system';

interface AbsenceModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  employees: Employee[];
  absenceData?: AbsenceRecord | null;
  currentUser: User;
}

export const AbsenceModal: React.FC<AbsenceModalProps> = ({ 
    show, onClose, onSubmit, employees, absenceData, currentUser
}) => {
  useLockBodyScroll(show);

  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<AbsenceType>('Ausencia');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [justification, setJustification] = useState('');
  const [missedHours, setMissedHours] = useState<number>(0);
  const [deductionAmount, setDeductionAmount] = useState('');
  const [errorSalary, setErrorSalary] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminRole = currentUser.role === 'admin';

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

  useEffect(() => {
    if (show) {
        if (absenceData) {
            setEmployeeId(absenceData.employeeId);
            setType(absenceData.type);
            setStartDate(absenceData.startDate);
            setEndDate(absenceData.endDate);
            setJustification(absenceData.justification);
            setDeductionAmount(absenceData.deductionAmount?.toString() || '');
        } else {
            setEmployeeId('');
            setType('Ausencia');
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate(new Date().toISOString().split('T')[0]);
            setJustification('');
            setDeductionAmount('');
        }
        setError(null);
        setErrorSalary(null);
    }
  }, [show, absenceData]);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const hours = diffDays * 8; // Calculate default missed hours (optional)

    // Solo actualizar las horas faltadas por defecto si el usuario no las ha modificado o es al inicio
    if (missedHours === 0) {
        setMissedHours(hours);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (employeeId && missedHours > 0) {
        const employee = employees.find(emp => emp.id === employeeId);
        if (employee) {
            if (employee.baseSalary && employee.baseSalary > 0) {
                // Cálculo exacto igual que en Generar Colilla
                const hourlyRate = employee.baseSalary / 192;
                setDeductionAmount((missedHours * hourlyRate).toFixed(2));
                setErrorSalary(null);
            } else {
                setDeductionAmount('0.00');
                setErrorSalary("No fue posible calcular automáticamente el monto porque el colaborador no tiene configuración salarial válida.");
            }
        }
    } else if (missedHours === 0) {
        setDeductionAmount('0.00');
        setErrorSalary(null);
    }
  }, [employeeId, missedHours, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!employeeId || !type || !startDate || !endDate || !justification) {
        setError("Los campos marcados con * son obligatorios.");
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
        return;
    }

    setIsSubmitting(true);
    try {
        const payload = {
            employeeId,
            type,
            startDate,
            endDate,
            justification,
            deductionAmount: deductionAmount ? parseFloat(deductionAmount) : 0
        };

        await onSubmit(payload);
        onClose();
    } catch (err: any) {
        setError(err.message || "Error al guardar la incidencia.");
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
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">{absenceData ? 'Editar Incidencia' : 'Nueva Incidencia'}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Control de Asistencia</p>
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

                    {/* Tipo */}
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo de Incidencia *</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value as AbsenceType)}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            <option value="Ausencia">Ausencia</option>
                            <option value="Permiso">Permiso</option>
                            <option value="Incapacidad">Incapacidad</option>
                        </select>
                    </div>

                    {/* Fechas */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Desde *</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Hasta *</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                        />
                    </div>
                    
                    {/* Horas Faltadas */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Horas Faltadas</label>
                        <input 
                            type="number" 
                            value={missedHours} 
                            onChange={e => {
                                const hours = parseFloat(e.target.value) || 0;
                                setMissedHours(hours);                
                            }}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                            min="0"
                            step="0.5"
                        />
                    </div>

                    {/* Monto Deducción */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Monto a Deducir</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₡</span>
                            <input 
                                type="number" 
                                value={deductionAmount} 
                                onChange={e => setDeductionAmount(e.target.value)} 
                                className="w-full pl-8 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                                placeholder="0.00"
                                step="0.01"
                            />
                        </div>
                    </div>
                    
                    {errorSalary && (
                        <div className="col-span-2 bg-amber-50 text-amber-700 text-[10px] font-bold p-2 rounded-xl border border-amber-100 text-center">
                            {errorSalary}
                        </div>
                    )}

                    {/* Justificación */}
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Justificación / Motivo *</label>
                        <textarea 
                            value={justification}
                            onChange={e => setJustification(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 h-24 resize-none outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                            placeholder="Detalle de la incidencia..."
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
                    type="button"
                />
                <ActionButton 
                    type="submit" 
                    disabled={isSubmitting} 
                    isLoading={isSubmitting}
                    label={absenceData ? 'Guardar' : 'Registrar Incidencia'}
                    icon={<FiSave />}
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

