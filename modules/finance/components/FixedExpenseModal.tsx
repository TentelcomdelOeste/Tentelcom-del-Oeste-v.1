import React, { useState, useEffect } from 'react';
import { FixedExpense, ExpenseSubtype } from '../../../cashflowTypes';
import { ActionButton, Modal } from '../../../design-system';

interface FixedExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: FixedExpense | null;
  onSave: (expense: Omit<FixedExpense, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
}

export const FixedExpenseModal: React.FC<FixedExpenseModalProps> = ({ isOpen, onClose, expenseToEdit, onSave }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'CRC'>('CRC');
  const [frequency, setFrequency] = useState<'Mensual' | 'Trimestral' | 'Anual'>('Mensual');
  const [day, setDay] = useState<number>(1);
  const [subtype, setSubtype] = useState<ExpenseSubtype>('Gasto Operativo');
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>('Activo');
  const [generationMode, setGenerationMode] = useState<'Automático' | 'Manual'>('Automático');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (expenseToEdit) {
      setName(expenseToEdit.name);
      setAmount(expenseToEdit.amount.toString());
      setCurrency(expenseToEdit.currency);
      setFrequency(expenseToEdit.frequency);
      setDay(expenseToEdit.day);
      setSubtype(expenseToEdit.subtype);
      setStatus(expenseToEdit.status);
      setGenerationMode(expenseToEdit.generationMode || 'Automático');
    } else {
      // Reset form
      setName('');
      setAmount('');
      setCurrency('CRC');
      setFrequency('Mensual');
      setDay(1);
      setSubtype('Gasto Operativo');
      setStatus('Activo');
      setGenerationMode('Automático');
    }
  }, [expenseToEdit, isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name || !amount || isNaN(day)) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name,
        amount: parseFloat(amount),
        currency,
        frequency,
        day,
        subtype,
        status,
        generationMode
      });
      onClose();
    } catch (error) {
      console.error("Error saving fixed expense:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const footerContent = (
    <>
      <ActionButton
        label="Cancelar"
        onClick={onClose}
        variant="secondary"
        disabled={isSubmitting}
      />
      <ActionButton
        label={expenseToEdit ? 'Actualizar Gasto' : 'Crear Gasto'}
        onClick={handleSubmit}
        variant="primary"
        isLoading={isSubmitting}
      />
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expenseToEdit ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
      subtitle="Configuración de recurrencia"
      footer={footerContent}
    >
      <form className="space-y-4">
        {/* Nombre */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nombre del Gasto</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 mt-1 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 text-slate-700"
            placeholder="Ej: Alquiler Oficina, Internet, Planilla..."
            required
          />
        </div>

        {/* Monto y Moneda */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Monto</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-7 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 mt-1 font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Moneda</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'CRC' | 'USD')}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 mt-1 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 text-slate-700"
            >
              <option value="CRC">CRC (₡)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>

        {/* Frecuencia y Día */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Frecuencia</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 mt-1 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 text-slate-700"
            >
              <option value="Mensual">Mensual</option>
              <option value="Trimestral">Trimestral</option>
              <option value="Anual">Anual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Día de Aplicación</label>
            <input
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => setDay(parseInt(e.target.value))}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 mt-1 font-mono font-bold text-slate-700 text-center outline-none focus:ring-2 focus:ring-blue-100"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1 text-center">Día del mes (1-31)</p>
          </div>
        </div>

        {/* Subtipo */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Categoría</label>
          <select
            value={subtype}
            onChange={(e) => setSubtype(e.target.value as ExpenseSubtype)}
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 mt-1 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 text-slate-700"
          >
            <option value="Gasto Operativo">Gasto Operativo</option>
            <option value="Gasto Administrativo">Gasto Administrativo</option>
            <option value="Costo de Proyecto">Costo de Proyecto</option>
            <option value="Otro Egreso">Otro Egreso</option>
          </select>
        </div>

        {/* Estado y Modo de Generación */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${status === 'Activo' ? 'bg-emerald-500' : 'bg-slate-300'}`} onClick={() => setStatus(status === 'Activo' ? 'Inactivo' : 'Activo')}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${status === 'Activo' ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className={`text-xs font-bold uppercase ${status === 'Activo' ? 'text-emerald-600' : 'text-slate-400'}`}>
              {status === 'Activo' ? 'Gasto Activo' : 'Gasto Inactivo'}
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${generationMode === 'Automático' ? 'bg-blue-500' : 'bg-slate-300'}`} onClick={() => setGenerationMode(generationMode === 'Automático' ? 'Manual' : 'Automático')}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${generationMode === 'Automático' ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className={`text-xs font-bold uppercase ${generationMode === 'Automático' ? 'text-blue-600' : 'text-slate-400'}`}>
              {generationMode === 'Automático' ? 'Automático' : 'Manual'}
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
};
