import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiRotateCcw,
  FiAlertCircle,
  FiCalendar,
  FiUser,
  FiBox,
  FiCheckCircle,
  FiTag
} from 'react-icons/fi';
import { User } from '@/utils/types';
import { ToolAssignment, ReturnAssignmentDTO, ItemCondition } from '@/types/toolAssignment.types';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { ActionButton, IconButton, Select } from '@/design-system';

interface ReturnAssignmentModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (dto: ReturnAssignmentDTO) => Promise<any>;
  assignment: ToolAssignment | null;
  currentUser: User | null;
}

export const ReturnAssignmentModal: React.FC<ReturnAssignmentModalProps> = ({
  show,
  onClose,
  onSubmit,
  assignment,
  currentUser
}) => {
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnCondition, setReturnCondition] = useState<ItemCondition>('Bueno');
  const [returnQuantity, setReturnQuantity] = useState<string>('1');
  const [returnObservations, setReturnObservations] = useState<string>('');
  const [returnHandledBy, setReturnHandledBy] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useLockBodyScroll(show);

  useEffect(() => {
    if (show && assignment) {
      setReturnDate(new Date().toISOString().split('T')[0]);
      setReturnCondition('Bueno');
      setReturnQuantity(String(assignment.quantity || 1));
      setReturnObservations('');
      setReturnHandledBy(
        currentUser?.name || currentUser?.displayName || currentUser?.email || ''
      );
      setError(null);
    }
  }, [show, assignment, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    const qty = parseInt(returnQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('La cantidad a devolver debe ser un número entero mayor a 0.');
      return;
    }

    if (qty > assignment.quantity) {
      setError(`No se puede devolver más de la cantidad asignada (${assignment.quantity}).`);
      return;
    }

    const dto: ReturnAssignmentDTO = {
      assignmentId: assignment.id,
      returnDate,
      returnCondition,
      returnQuantity: qty,
      returnObservations: returnObservations.trim(),
      returnHandledBy: returnHandledBy.trim() || currentUser?.email || 'Sistema'
    };

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(dto);
      onClose();
    } catch (err: any) {
      console.error('[ReturnAssignmentModal] Error registrando devolución:', err);
      setError(err?.message || 'Ocurrió un error al procesar la devolución.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show || !assignment) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-2 md:p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl md:rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 md:p-6 bg-emerald-800 text-white flex justify-between items-center flex-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-200">
              <FiRotateCcw className="text-xl" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight">
                Registrar Devolución
              </h3>
              <p className="text-[11px] text-emerald-200 font-medium">
                Reintegro de equipo al inventario general
              </p>
            </div>
          </div>
          <IconButton
            variant="ghost"
            icon={<FiX className="text-lg text-white/80 hover:text-white" />}
            onClick={onClose}
            className="hover:bg-white/10"
          />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 md:p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
            {/* Card resumen del artículo */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md">
                  {assignment.itemCode}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Asignado el {assignment.assignedDate}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 leading-snug">
                {assignment.itemDescription}
              </h4>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">
                  {assignment.recipientType === 'colaborador' ? '👤 Colaborador:' : '🚚 Unidad:'}{' '}
                  <strong className="text-slate-900">{assignment.recipientName}</strong>
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {assignment.quantity} {assignment.itemUnit || 'unid'}
                </span>
              </div>
            </div>

            {/* Cantidad y Fecha de Devolución */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                  Cantidad a Devolver
                </label>
                <input
                  type="number"
                  min="1"
                  max={assignment.quantity}
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-1">
                  <FiCalendar className="text-emerald-600" /> Fecha de Recepción
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* Condición de retorno */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Estado / Condición al Devolver
              </label>
              <Select
                options={[
                  { label: 'Bueno (Completo y operativo)', value: 'Bueno' },
                  { label: 'Regular (Con desgaste pero funcional)', value: 'Regular' },
                  { label: 'Dañado (Requiere reparación o mantenimiento)', value: 'Dañado' },
                  { label: 'Con faltante (Incompleto / accesorios perdidos)', value: 'Con faltante' }
                ]}
                value={returnCondition}
                onChange={(val) => setReturnCondition(val as ItemCondition)}
                isSearchable={false}
              />
            </div>

            {/* Recibido por */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Recibido por (Bodega / Responsable)
              </label>
              <input
                type="text"
                value={returnHandledBy}
                onChange={(e) => setReturnHandledBy(e.target.value)}
                placeholder="Nombre del custodio o bodeguero que recibe"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Observaciones de devolución */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Observaciones de Recepción
              </label>
              <textarea
                rows={2}
                value={returnObservations}
                onChange={(e) => setReturnObservations(e.target.value)}
                placeholder="Detalle el estado del equipo, limpieza, piezas entregadas..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-2xl border border-red-200 flex items-center gap-2.5">
                <FiAlertCircle className="flex-none text-base text-red-600" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 flex gap-3 flex-none">
            <ActionButton
              type="button"
              variant="neutral"
              label="Cancelar"
              onClick={onClose}
              className="flex-1 !py-3 !text-xs !font-bold !uppercase !rounded-xl"
            />
            <ActionButton
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              label={isSubmitting ? 'Procesando...' : 'Confirmar Devolución'}
              icon={<FiCheckCircle />}
              variant="primary"
              className="flex-1 !py-3 !text-xs !font-black !uppercase !tracking-normal !rounded-xl !bg-emerald-600 hover:!bg-emerald-700"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
