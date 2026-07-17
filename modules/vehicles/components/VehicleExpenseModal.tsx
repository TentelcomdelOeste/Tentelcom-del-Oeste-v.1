import React, { useState } from 'react';
import { Modal, ActionButton, Select } from '@/design-system';
import { VehicleExpense } from '@/types/vehicle.types';
import { User } from '@/utils/types';
import { saveVehicleExpense } from '../vehicleService';
import { FiCreditCard, FiCalendar, FiTag, FiFileText, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface Props {
  show: boolean;
  onClose: () => void;
  unidad: string;
  vehiculoId?: string;
  bitacoraId?: string;
  currentUser: User;
  onSuccess?: () => void;
  initialData?: VehicleExpense | null;
  defaultDate?: string;
  defaultMileage?: number;
}

const CATEGORIES = [
  'Combustible',
  'Mantenimiento',
  'Aceite',
  'Llantas',
  'Batería',
  'Seguro',
  'Marchamo',
  'RTV',
  'Reparación',
  'Gasto General',
  'Otros'
] as const;

export const VehicleExpenseModal: React.FC<Props> = ({
  show,
  onClose,
  unidad,
  vehiculoId,
  bitacoraId,
  currentUser,
  onSuccess,
  initialData,
  defaultDate,
  defaultMileage
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<VehicleExpense>>({});

  // Reset form when modal opens
  React.useEffect(() => {
    if (show) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          fecha: defaultDate || new Date().toISOString().split('T')[0],
          categoria: 'Mantenimiento',
          descripcion: '',
          monto: undefined,
          kilometraje: defaultMileage,
          observaciones: '',
          unidad,
          vehiculoId: vehiculoId || '',
          bitacoraId
        });
      }
    }
  }, [show, initialData, unidad, vehiculoId, bitacoraId, defaultDate, defaultMileage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descripcion || !formData.monto) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      const expenseToSave: Partial<VehicleExpense> = {
        ...formData,
        unidad,
        vehiculoId: formData.vehiculoId || vehiculoId || '',
        monto: Number(formData.monto) // Ensure it's a number
      };

      // Solo incluir bitacoraId si existe un valor válido
      const finalBitacoraId = formData.bitacoraId || bitacoraId;
      if (finalBitacoraId) {
        expenseToSave.bitacoraId = finalBitacoraId;
      }

      await saveVehicleExpense(expenseToSave, currentUser);
      toast.success(initialData ? 'Gasto actualizado' : 'Gasto registrado');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Error al guardar el gasto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={show} onClose={onClose} title={initialData ? "Editar Gasto" : "Registrar Gasto de Unidad"}>
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FiCalendar className="text-blue-500" /> Fecha
            </label>
            <input
              type="date"
              value={formData.fecha || ''}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FiTag className="text-blue-500" /> Categoría
            </label>
            <Select
              options={CATEGORIES as any}
              value={formData.categoria || ''}
              onChange={(val) => setFormData({ ...formData, categoria: val })}
              placeholder="Seleccionar categoría..."
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FiFileText className="text-blue-500" /> Descripción
          </label>
          <input
            placeholder="Ej: Cambio de aceite, Reparación de frenos..."
            value={formData.descripcion || ''}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FiCreditCard className="text-blue-500" /> Monto (₡)
            </label>
            <input
              type="number"
              placeholder="Ingrese el monto"
              value={formData.monto ?? ''}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value ? parseFloat(e.target.value) : undefined })}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FiMapPin className="text-blue-500" /> Kilometraje (Opcional)
            </label>
            <input
              type="number"
              placeholder="Km actual..."
              value={formData.kilometraje ?? ''}
              onChange={(e) => setFormData({ ...formData, kilometraje: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
            Observaciones
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            placeholder="Detalles adicionales..."
            value={formData.observaciones || ''}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
          />
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <ActionButton variant="ghost" onClick={onClose} disabled={loading} type="button" label="CANCELAR" />
          <ActionButton
            onClick={handleSubmit as any}
            loading={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl"
            label="GUARDAR"
          />
        </div>
      </form>
    </Modal>
  );
};
