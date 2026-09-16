import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  Truck, 
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Info
} from 'lucide-react';
import { VehicleWarehouseItem } from '../../../../types/vehicleWarehouse.types';
import { vehicleWarehouseService } from '../services/vehicleWarehouseService';
import { User } from '../../../../types';

interface Props {
  show: boolean;
  onClose: () => void;
  item: VehicleWarehouseItem | null;
  currentUser?: User | null;
  onSuccess?: () => void;
}

export const ADJUSTMENT_TYPES = [
  'Inventario cíclico',
  'Material dañado',
  'Material extraviado',
  'Material desechado',
  'Diferencia de inventario',
  'Otro'
] as const;

export const VehicleInventoryAdjustmentModal: React.FC<Props> = ({
  show,
  onClose,
  item,
  currentUser,
  onSuccess
}) => {
  const [adjustmentType, setAdjustmentType] = useState<string>('Inventario cíclico');
  const [action, setAction] = useState<'+' | '-'>( '+');
  const [rawQtyStr, setRawQtyStr] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (show) {
      setAdjustmentType('Inventario cíclico');
      setAction('+');
      setRawQtyStr('');
      setJustification('');
      setObservations('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [show, item]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    if (show) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [show, onClose, isSubmitting]);

  if (!show || !item) return null;

  const currentPhysicalStock = Number(item.physicalStock) || 0;
  const currentCommittedStock = Number(item.committedStock) || 0;
  
  const rawQtyNum = Math.abs(parseFloat(rawQtyStr));
  const isValidRawQty = !isNaN(rawQtyNum) && rawQtyNum > 0;
  const parsedQty = isValidRawQty ? (action === '+' ? rawQtyNum : -rawQtyNum) : 0;
  const isValidQty = isValidRawQty;

  const newPhysicalStock = currentPhysicalStock + parsedQty;
  const newAvailableStock = newPhysicalStock - currentCommittedStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidRawQty || rawQtyNum === 0) {
      setError('Por favor ingrese una cantidad a ajustar válida mayor a cero.');
      return;
    }

    if (newPhysicalStock < 0) {
      setError(`El stock físico resultante no puede ser negativo (${newPhysicalStock}). El stock actual es ${currentPhysicalStock}.`);
      return;
    }

    if (!justification.trim()) {
      setError('La justificación es obligatoria para realizar el ajuste de inventario.');
      return;
    }

    try {
      setIsSubmitting(true);
      await vehicleWarehouseService.adjustInventoryItem(
        item.vehiculoId,
        item.inventoryItemId,
        parsedQty,
        adjustmentType,
        justification.trim(),
        observations.trim(),
        currentUser
      );

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Error ajustando inventario vehicular:', err);
      setError(err?.message || 'Ocurrió un error al procesar el ajuste de inventario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs"
      onClick={() => { if (!isSubmitting) onClose(); }}
    >
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100/80 border border-blue-200/80 flex items-center justify-center text-blue-700 shrink-0 shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 leading-tight">
                Ajustar Inventario
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Bodega Vehicular — Reg. de auditoría
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 rounded-lg transition-colors shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Context Info Box */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Material</span>
                <p className="font-extrabold text-slate-800 text-sm truncate" title={item.description}>
                  {item.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-slate-500 font-mono text-[11px]">
                  <span>Código: <strong className="text-slate-700">{item.code}</strong></span>
                  <span>•</span>
                  <span>U. Medida: <strong className="text-slate-700">{item.unit || 'Und'}</strong></span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-medium">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                Unidad: <strong className="text-slate-800">{item.vehiculoAlias}</strong> ({item.vehiculoPlaca || 'Sin Placa'})
              </span>
            </div>
          </div>

          {/* Stock Calculation Preview Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-md space-y-3">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
              Proyección de Stock Físico
            </span>
            <div className="grid grid-cols-3 gap-2 text-center items-center">
              <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                <span className="text-[9px] text-slate-300 font-bold block uppercase">Stock Registrado</span>
                <span className="text-lg font-black block text-white mt-0.5">{currentPhysicalStock}</span>
                <span className="text-[9px] text-slate-400 block">{item.unit || 'und'}</span>
              </div>

              <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] font-extrabold text-blue-300 block mb-0.5">Ajuste</span>
                <div className={`px-2 py-1 rounded-md text-xs font-mono font-black border flex items-center justify-center gap-1 ${
                  parsedQty > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : parsedQty < 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-white/10 text-slate-300 border-white/10'
                }`}>
                  {parsedQty > 0 ? <ArrowDownLeft className="w-3 h-3" /> : parsedQty < 0 ? <ArrowUpRight className="w-3 h-3" /> : null}
                  {isValidQty ? (parsedQty > 0 ? `+${parsedQty}` : `${parsedQty}`) : '0'}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border ${
                newPhysicalStock < 0 
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-200' 
                  : 'bg-blue-600/30 border-blue-400/30 text-white'
              }`}>
                <span className="text-[9px] font-bold block uppercase text-slate-300">Stock Resultante</span>
                <span className={`text-lg font-black block mt-0.5 ${newPhysicalStock < 0 ? 'text-rose-400' : 'text-emerald-300'}`}>
                  {newPhysicalStock}
                </span>
                <span className="text-[9px] text-slate-300 block">{item.unit || 'und'}</span>
              </div>
            </div>

            {currentCommittedStock > 0 && (
              <div className="text-[10px] text-slate-300 pt-2 border-t border-white/10 flex items-center justify-between font-mono">
                <span>Stock Comprometido: <strong className="text-amber-300">{currentCommittedStock}</strong></span>
                <span>Disponible Resultante: <strong className={newAvailableStock < 0 ? 'text-rose-300' : 'text-emerald-300'}>{newAvailableStock}</strong></span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5">
            {/* Tipo de Ajuste */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Tipo de Ajuste <span className="text-rose-500">*</span>
              </label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value)}
                className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                disabled={isSubmitting}
              >
                {ADJUSTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad a Ajustar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-extrabold text-slate-700">
                  Cantidad a Ajustar <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  {action === '+' ? 'Sumar al stock' : 'Restar del stock'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Action Selector (+ / -) */}
                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAction('+')}
                    disabled={isSubmitting}
                    className={`px-3 py-2 text-center rounded-lg transition-all select-none text-sm font-black leading-none min-w-[42px] cursor-pointer ${
                      action === '+'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                    }`}
                    title="Agregar inventario (+)"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('-')}
                    disabled={isSubmitting}
                    className={`px-3 py-2 text-center rounded-lg transition-all select-none text-sm font-black leading-none min-w-[42px] cursor-pointer ${
                      action === '-'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                    }`}
                    title="Restar inventario (–)"
                  >
                    −
                  </button>
                </div>

                {/* Central Quantity Input */}
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={rawQtyStr}
                    onChange={(e) => {
                      const val = e.target.value.replace('-', '');
                      setRawQtyStr(val);
                    }}
                    placeholder="Ej: 20"
                    className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Justificación Obligatoria */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Justificación del Ajuste <span className="text-rose-500">* (Obligatoria)</span>
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Describa claramente la causa o motivo de la diferencia..."
                rows={2}
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Observaciones Opcionales */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Observaciones Adicionales <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Detalles complementarios, número de boleta, nota técnica, etc."
                rows={2}
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            CANCELAR
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>PROCESANDO...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>CONFIRMAR AJUSTE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
