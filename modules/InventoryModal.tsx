
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiSave, FiAlertCircle, FiPlus, FiTrash2 } from "react-icons/fi";
import { InventoryItem } from '../inventoryTypes';
import { User } from '../utils/types';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { addInventoryProvider } from '../services/inventoryProviderService';
import { ActionButton, IconButton, Select } from '../design-system';
import { ProviderCombobox } from './inventario/components/ProviderCombobox';

interface InventoryModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<InventoryItem>) => Promise<void>;
  checkCodeStatus?: (code: string, excludeId?: string) => Promise<import('../inventoryTypes').CodeStatusResult>;
  currentUser: User;
  initialData?: InventoryItem | null;
  uniqueProviders?: string[];
  uniqueCategories?: string[];
  uniqueLocations?: string[];
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ 
  show, 
  onClose, 
  onSubmit, 
  checkCodeStatus,
  currentUser, 
  initialData,
  uniqueProviders = [],
  uniqueCategories = [],
  uniqueLocations = []
}) => {
  const [formData, setFormData] = useState<any>({
    code: '',
    description: '',
    category: '',
    unit: 'unidad',
    stock: '',
    minStock: '',
    location: '',
    price: '',
    currency: 'USD',
    providers: [],
    reserved: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptReuse, setPromptReuse] = useState(false);
  const [reuseItemDesc, setReuseItemDesc] = useState<string>('');

  useLockBodyScroll(show);

  useEffect(() => {
    if (show) {
      if (initialData) {
        setFormData({
          ...initialData,
          stock: initialData.stock ?? '',
          minStock: initialData.minStock ?? '',
          price: initialData.price ?? '',
          providers: (initialData.providers || []).map(p => ({
            ...p,
            price: p.price ?? ''
          }))
        });
      } else {
        setFormData({
          code: '',
          description: '',
          category: '',
          unit: 'unidad',
          stock: '',
          minStock: '',
          location: 'BODEGA PRINCIPAL',
          price: '',
          currency: 'USD',
          providers: [],
          reserved: 0
        });
      }
      setError(null);
      setPromptReuse(false);
    }
  }, [show, initialData]);

  const handleAddProvider = () => {
    const providers = [...(formData.providers || [])];
    providers.push({ name: '', price: '' });
    setFormData({ ...formData, providers });
  };

  const handleRemoveProvider = (index: number) => {
    const providers = [...(formData.providers || [])];
    providers.splice(index, 1);
    setFormData({ ...formData, providers });
  };

  const handleProviderChange = (index: number, field: string, value: any) => {
    const providers = [...(formData.providers || [])];
    providers[index] = { ...providers[index], [field]: value };
    setFormData({ ...formData, providers });
  };

  const handleSubmit = async (e: React.FormEvent, forceReuse: boolean = false) => {
    e.preventDefault();
    setError(null);
    setPromptReuse(false);

    if (!formData.code?.trim()) {
      setError("El código es obligatorio.");
      return;
    }
    if (!formData.description?.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }

    const allowedCategories = ["FIBRA ÓPTICA", "CABLEADO ESTRUCTURADO", "EQUIPOS", "HERRAMIENTAS", "UNIFORMES"];
    if (!formData.category?.trim() || !allowedCategories.includes(formData.category.trim().toUpperCase())) {
      setError("La categoría es obligatoria y debe ser una opción válida.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (checkCodeStatus && !forceReuse) {
        const codeStatus = await checkCodeStatus(formData.code, initialData?.id);
        if (codeStatus.status === 'ACTIVE_EXISTS') {
           throw new Error(`El código "${formData.code}" ya está en uso por un material activo (${codeStatus.activeItem?.description || 'en inventario'}).`);
        }
        if (codeStatus.status === 'PREVIOUSLY_USED') {
           setReuseItemDesc(codeStatus.previousItem?.description || 'Desconocido');
           setPromptReuse(true);
           setIsSubmitting(false);
           return;
        }
      }

      // Register any new providers in the catalog
      for (const p of formData.providers || []) {
        if (p.name && p.name.trim()) {
          try {
            await addInventoryProvider(p.name, currentUser);
          } catch (e) {
            console.error("Failed to add provider:", e);
          }
        }
      }

      // Convert empty strings to 0 before submitting
      const dataToSubmit = {
        ...formData,
        category: formData.category?.toUpperCase(),
        description: formData.description?.toUpperCase(),
        location: formData.location?.toUpperCase(),
        stock: parseFloat(formData.stock) || 0,
        minStock: parseFloat(formData.minStock) || 0,
        price: parseFloat(formData.price) || 0,
        providers: (formData.providers || []).map((p: any) => ({
          ...p,
          price: parseFloat(p.price) || 0
        })),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
      };

      await onSubmit(dataToSubmit);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar el material.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
            <div>
              <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                {initialData ? 'Editar Material' : 'Nuevo Material'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Catálogo de Inventario</p>
            </div>
            <IconButton 
              variant="neutral" 
              icon={<FiX />} 
              onClick={onClose} 
              title="Cerrar"
            />
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Código */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Código *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: CAB-001"
                  required
                />
              </div>

              {/* Categoría */}
              <Select
                label="Categoría *"
                options={[
                  { label: "FIBRA ÓPTICA", value: "FIBRA ÓPTICA" },
                  { label: "CABLEADO ESTRUCTURADO", value: "CABLEADO ESTRUCTURADO" },
                  { label: "EQUIPOS", value: "EQUIPOS" },
                  { label: "HERRAMIENTAS", value: "HERRAMIENTAS" },
                  { label: "UNIFORMES", value: "UNIFORMES" }
                ]}
                value={formData.category}
                onChange={val => setFormData({ ...formData, category: val.toUpperCase() })}
                placeholder="Seleccione Categoría..."
              />

              {/* Descripción */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Descripción *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value.toUpperCase() })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Descripción completa del material"
                  required
                />
              </div>

              {/* Unidad */}
              <Select
                label="Unidad de Medida"
                options={[
                  { label: 'Unidad', value: 'unidad' },
                  { label: 'Metros (m)', value: 'm' },
                  { label: 'Kilómetros (km)', value: 'km' },
                  { label: 'Rollo', value: 'rollo' },
                  { label: 'Kit', value: 'kit' },
                  { label: 'Pieza', value: 'pieza' },
                  { label: 'Caja', value: 'caja' },
                  { label: 'Par', value: 'par' }
                ]}
                value={formData.unit}
                onChange={val => setFormData({ ...formData, unit: val })}
              />

              {/* Ubicación */}
              <Select
                label="Ubicación Física"
                options={uniqueLocations.map(l => ({ label: l, value: l }))}
                value={formData.location}
                onChange={val => setFormData({ ...formData, location: val.toUpperCase() })}
                placeholder="Ej: BODEGA PRINCIPAL"
                allowCustomValue={true}
              />

              {/* Stock Inicial / Actual */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Stock {initialData ? 'Actual' : 'Inicial'}</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  min="0"
                  step="0.01"
                  placeholder="Ingrese cantidad"
                />
              </div>

              {/* Punto de Reorden */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Mínimo (Reorden)</label>
                <input
                  type="number"
                  value={formData.minStock}
                  onChange={e => setFormData({ ...formData, minStock: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  min="0"
                  step="0.01"
                  placeholder="Ingrese mínimo"
                />
              </div>

              {/* Precio Base */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Precio Base (Sin IVA)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    {formData.currency === 'USD' ? '$' : '₡'}
                  </span>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    className="w-full pl-8 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Moneda */}
              <Select
                label="Moneda"
                options={[
                  { label: 'Dólares (USD)', value: 'USD' },
                  { label: 'Colones (CRC)', value: 'CRC' }
                ]}
                value={formData.currency}
                onChange={val => setFormData({ ...formData, currency: val as 'USD' | 'CRC' })}
              />

              {/* IVA y Total Automáticos */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">IVA (13%)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    {formData.currency === 'USD' ? '$' : '₡'}
                  </span>
                  <input
                    type="text"
                    value={formData.price ? (parseFloat(formData.price) * 0.13).toFixed(2) : '0.00'}
                    readOnly
                    className="w-full pl-8 pr-3 py-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Precio Total (Con IVA)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    {formData.currency === 'USD' ? '$' : '₡'}
                  </span>
                  <input
                    type="text"
                    value={formData.price ? (parseFloat(formData.price) * 1.13).toFixed(2) : '0.00'}
                    readOnly
                    className="w-full pl-8 pr-3 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs font-black text-blue-700 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Proveedores y Precios */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Precios por Proveedor</label>
                <ActionButton
                  type="button"
                  label="Agregar Proveedor"
                  icon={<FiPlus />}
                  onClick={handleAddProvider}
                  variant="ghost"
                  className="!text-[10px] !font-bold !uppercase !tracking-tighter"
                />
              </div>
              
              <div className="space-y-2">
                {formData.providers?.map((provider: any, index: number) => (
                  <div key={index} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 animate-in slide-in-from-left-2 relative">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <ProviderCombobox
                          label="Proveedor"
                          options={uniqueProviders}
                          value={provider.name}
                          onChange={val => handleProviderChange(index, 'name', val)}
                          placeholder="Nombre del proveedor"
                          required
                        />
                      </div>
                      <div className="pt-5">
                        <IconButton
                          variant="danger"
                          icon={<FiTrash2 />}
                          onClick={() => handleRemoveProvider(index)}
                          title="Eliminar"
                          className="!bg-red-50 !text-red-500 hover:!bg-red-500 hover:!text-white transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Base</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                            {formData.currency === 'USD' ? '$' : '₡'}
                          </span>
                          <input
                            type="number"
                            value={provider.price}
                            onChange={e => handleProviderChange(index, 'price', e.target.value)}
                            className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-100"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">IVA</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                            {formData.currency === 'USD' ? '$' : '₡'}
                          </span>
                          <input
                            type="text"
                            value={provider.price ? (parseFloat(provider.price) * 0.13).toFixed(2) : '0.00'}
                            readOnly
                            className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-500 outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                            {formData.currency === 'USD' ? '$' : '₡'}
                          </span>
                          <input
                            type="text"
                            value={provider.price ? (parseFloat(provider.price) * 1.13).toFixed(2) : '0.00'}
                            readOnly
                            className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-blue-100/50 border border-blue-200 text-[11px] font-black text-blue-700 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!formData.providers || formData.providers.length === 0) && (
                  <p className="text-center py-4 text-[10px] font-bold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 uppercase tracking-widest">
                    No hay precios específicos por proveedor
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-4 rounded-2xl border border-red-100 flex items-center gap-3 animate-pulse">
                <FiAlertCircle className="flex-none text-lg" />
                <p>{error}</p>
              </div>
            )}

            {promptReuse && (
              <div className="bg-amber-50 text-amber-700 text-xs font-bold p-4 rounded-2xl border border-amber-200 flex flex-col gap-3 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <FiAlertCircle className="flex-none text-lg mt-0.5" />
                  <div>
                    <p className="mb-1">El código <strong>{formData.code}</strong> fue utilizado anteriormente por el material:</p>
                    <p className="font-black text-amber-900 mb-2">"{reuseItemDesc}"</p>
                    <p className="text-[10px] text-amber-600/80 uppercase tracking-wider">Este material fue eliminado del inventario. ¿Deseas reutilizar el código para este nuevo registro manteniendo el historial intacto?</p>
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <ActionButton 
                    type="button"
                    variant="primary"
                    label="Reutilizar Código"
                    onClick={(e) => handleSubmit(e as any, true)}
                    className="!bg-amber-500 hover:!bg-amber-600 !text-white !py-2 !px-4 !rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 flex-none">
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
              label={initialData ? 'Actualizar Material' : 'Guardar Material'}
              icon={<FiSave />}
              variant="primary"
              className="flex-1 !py-2 !text-[9px] !font-black !uppercase !tracking-normal !rounded-xl"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
