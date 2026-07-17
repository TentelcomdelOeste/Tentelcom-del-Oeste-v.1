import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrderCalculated, POApplication } from './types';
import { Invoice } from '../invoices/invoice.types';
import { formatCurrency } from '../../../utils/formatCurrency';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';
import { FiEdit, FiAlertTriangle, FiLoader } from "react-icons/fi";

interface EditApplicationModalProps {
  show: boolean;
  onClose: () => void;
  onUpdate: (appId: string, newAmount: number) => Promise<void>;
  application: POApplication;
  invoice: Invoice;
  order: PurchaseOrderCalculated;
  allApplications: POApplication[];
}

export const EditApplicationModal: React.FC<EditApplicationModalProps> = ({
  show,
  onClose,
  onUpdate,
  application,
  invoice,
  order,
  allApplications
}) => {
  useLockBodyScroll(show);

  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (show && application) {
      setAmount(application.appliedAmount.toString());
      setError(null);
    }
  }, [show, application]);

  // --- CÁLCULO DE LÍMITES FINANCIEROS (TECHOS) ---

  // 1. Capacidad Real de la Factura:
  // Saldo Global Actual de la Factura + El monto que esta aplicación está ocupando actualmente.
  // Esto nos dice cuánto podríamos poner en esta aplicación si usáramos todo el saldo restante de la factura.
  const maxInvoiceLimit = useMemo(() => {
    // Suma de todo lo aplicado a esta factura en CUALQUIER orden, EXCLUYENDO la aplicación actual (porque la estamos editando)
    const otherApplicationsSum = allApplications
      .filter(a => a.invoiceId === invoice.id && a.id !== application.id && a.status !== 'deleted' && a.status !== 'voided')
      .reduce((sum, a) => sum + (a.appliedAmount || 0), 0);
    
    // Total Factura - Usado en otros lados
    const limit = (invoice.total || 0) - otherApplicationsSum;
    return Math.max(0, limit); // Nunca negativo
  }, [allApplications, invoice, application]);

  // 2. Capacidad Real de la Orden de Compra:
  // Saldo Disponible Actual de la OC + El monto que esta aplicación está ocupando actualmente.
  // (Porque al editar, "liberamos" virtualmente el monto actual y tratamos de aplicar uno nuevo).
  const maxOrderLimit = useMemo(() => {
    return (order.availableBalance || 0) + (application.appliedAmount || 0);
  }, [order, application]);

  // El límite efectivo es el menor de los dos techos
  const effectiveLimit = Math.min(maxInvoiceLimit, maxOrderLimit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const newAmount = parseFloat(amount);
    
    // Validaciones Defensivas
    if (isNaN(newAmount) || newAmount <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }

    // Validación de Techo OC
    if (newAmount > maxOrderLimit + 0.01) { // Tolerancia de centavos
      setError(`Fondos insuficientes en la OC. Máximo posible: ${formatCurrency(maxOrderLimit, order.currency)}`);
      return;
    }

    // Validación de Techo Factura
    if (newAmount > maxInvoiceLimit + 0.01) {
      setError(`Saldo insuficiente en la Factura. Máximo posible: ${formatCurrency(maxInvoiceLimit, order.currency)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(application.id, newAmount);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al actualizar el monto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[350] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-1">
             <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <FiEdit className="text-xs"  />
             </div>
             <h3 className="text-lg font-black text-blue-950 uppercase tracking-tight">Modificar Monto</h3>
          </div>
          <p className="text-xs font-bold text-slate-500 pl-11">
            Factura <span className="text-blue-600">#{invoice.consecutivo}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                Nuevo Monto a Aplicar
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                {order.currency === 'USD' ? '$' : '¢'}
              </span>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                max={effectiveLimit}
                value={amount}
                onChange={e => {
                    setAmount(e.target.value);
                    setError(null);
                }}
                className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white border font-black text-xl outline-none focus:ring-4 transition-all ${
                    parseFloat(amount) > effectiveLimit + 0.01 
                    ? 'border-red-300 text-red-600 focus:ring-red-100' 
                    : 'border-slate-200 text-slate-700 focus:ring-blue-100'
                }`}
                placeholder="0.00"
                autoFocus
              />
            </div>
            
            {/* Feedback Visual de Límites */}
            <div className="flex justify-between items-center mt-3 px-1">
               <div className="text-left">
                   <p className="text-[9px] font-bold text-slate-400 uppercase">Monto Actual</p>
                   <p className="text-xs font-bold text-slate-600">{formatCurrency(application.appliedAmount, order.currency)}</p>
               </div>
               <div className="text-right">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Máximo Permitido</p>
                   <p className={`text-xs font-black ${parseFloat(amount) > effectiveLimit + 0.01 ? 'text-red-600' : 'text-emerald-600'}`}>
                       {formatCurrency(effectiveLimit, order.currency)}
                   </p>
               </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs font-bold animate-pulse text-center flex items-center justify-center gap-2">
              <FiAlertTriangle  />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs hover:bg-slate-100 rounded-xl transition-colors"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || parseFloat(amount) <= 0 || parseFloat(amount) > effectiveLimit + 0.01}
              className="flex-1 py-3 bg-blue-600 text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                  <>
                    <FiLoader className="animate-spin"  /> Guardando...
                  </>
              ) : (
                  'Actualizar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};