import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiSave,
  FiAlertCircle,
  FiUser,
  FiTruck,
  FiBox,
  FiCalendar,
  FiTag,
  FiFileText,
  FiInfo
} from 'react-icons/fi';
import { User } from '@/utils/types';
import { InventoryItem } from '@/inventoryTypes';
import { CreateAssignmentDTO, ItemCondition, RecipientType } from '@/types/toolAssignment.types';
import { useEmployees } from '@/hooks/useEmployees';
import { getVehicleCatalog } from '@/modules/inventario/bodegas_vehiculares/services/vehicleWarehouseService';
import { subscribeToProjects } from '@/modules/project_management/services/projectService';
import { Project } from '@/modules/project_management/types';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { ActionButton, IconButton, Select } from '@/design-system';

interface NewAssignmentModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateAssignmentDTO) => Promise<any>;
  currentUser: User | null;
  inventoryItems: InventoryItem[];
}

export const NewAssignmentModal: React.FC<NewAssignmentModalProps> = ({
  show,
  onClose,
  onSubmit,
  currentUser,
  inventoryItems
}) => {
  const { activeEmployees, loading: loadingEmployees } = useEmployees();
  const [projects, setProjects] = useState<Project[]>([]);
  const vehicles = useMemo(() => getVehicleCatalog(), []);

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [recipientType, setRecipientType] = useState<RecipientType>('colaborador');
  const [recipientId, setRecipientId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [assignedDate, setAssignedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [initialCondition, setInitialCondition] = useState<ItemCondition>('Bueno');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [assignedBy, setAssignedBy] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useLockBodyScroll(show);

  useEffect(() => {
    if (show) {
      const unsubscribe = subscribeToProjects((projs) => {
        setProjects(projs.filter((p) => p.status !== 'cancelado'));
      });
      return () => unsubscribe();
    }
  }, [show]);

  useEffect(() => {
    if (show) {
      setSelectedItemId('');
      setRecipientType('colaborador');
      setRecipientId('');
      setQuantity('1');
      setAssignedDate(new Date().toISOString().split('T')[0]);
      setInitialCondition('Bueno');
      setSelectedProjectId('');
      setObservations('');
      setAssignedBy(currentUser?.name || currentUser?.displayName || currentUser?.email || '');
      setError(null);
    }
  }, [show, currentUser]);

  // Lista de items disponibles (priorizando Herramientas, Equipos y artículos con stock > 0)
  const selectableItems = useMemo(() => {
    return inventoryItems
      .filter((item) => item && item.id && item.code)
      .map((item) => {
        const availableStock = Math.max(0, (item.stock || 0) - (item.reserved || 0));
        return {
          ...item,
          availableStock,
          label: `[${item.code}] ${item.description} (Stock: ${availableStock} ${item.unit || 'unid'})`
        };
      })
      .sort((a, b) => {
        // Poner herramientas primero
        const aIsTool = (a.category || '').toLowerCase().includes('herramienta');
        const bIsTool = (b.category || '').toLowerCase().includes('herramienta');
        if (aIsTool && !bIsTool) return -1;
        if (!aIsTool && bIsTool) return 1;
        return a.description.localeCompare(b.description);
      });
  }, [inventoryItems]);

  const selectedItem = useMemo(() => {
    return selectableItems.find((i) => i.id === selectedItemId);
  }, [selectableItems, selectedItemId]);

  const maxAvailableStock = selectedItem ? selectedItem.availableStock : 0;

  // Manejo de cambio de tipo de destinatario
  const handleRecipientTypeChange = (type: RecipientType) => {
    setRecipientType(type);
    setRecipientId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItemId || !selectedItem) {
      setError('Por favor selecciona una herramienta o equipo del inventario.');
      return;
    }

    const qtyNumber = parseInt(quantity, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setError('La cantidad a asignar debe ser un número entero mayor a cero.');
      return;
    }

    if (qtyNumber > maxAvailableStock) {
      setError(
        `La cantidad ingresada (${qtyNumber}) excede el stock disponible actual (${maxAvailableStock} ${selectedItem.unit || 'unid'}).`
      );
      return;
    }

    if (!recipientId) {
      setError(`Por favor selecciona el ${recipientType === 'colaborador' ? 'colaborador' : 'vehículo/unidad'} destinatario.`);
      return;
    }

    let recipientName = '';
    let recipientDetail = '';

    if (recipientType === 'colaborador') {
      const emp = activeEmployees.find((e) => e.id === recipientId);
      if (!emp) {
        setError('Colaborador seleccionado no válido.');
        return;
      }
      recipientName = emp.name;
      recipientDetail = 'Colaborador';
    } else {
      const veh = vehicles.find((v) => v.id === recipientId);
      if (!veh) {
        setError('Unidad vehicular seleccionada no válida.');
        return;
      }
      recipientName = veh.displayName || veh.name || veh.id;
      recipientDetail = `Placa: ${veh.placa || 'N/A'}`;
    }

    const selectedProj = projects.find((p) => p.id === selectedProjectId);

    const dto: CreateAssignmentDTO = {
      itemId: selectedItem.id,
      itemCode: selectedItem.code,
      itemDescription: selectedItem.description,
      itemCategory: selectedItem.category,
      itemUnit: selectedItem.unit || 'unid',
      quantity: qtyNumber,
      recipientType,
      recipientId,
      recipientName,
      recipientDetail,
      assignedDate,
      initialCondition,
      projectId: selectedProj?.id,
      projectNumber: selectedProj?.projectNumber,
      projectName: selectedProj?.name,
      observations: observations.trim(),
      assignedBy: assignedBy.trim() || currentUser?.email || 'Sistema'
    };

    try {
      setIsSubmitting(true);
      await onSubmit(dto);
      onClose();
    } catch (err: any) {
      console.error('[NewAssignmentModal] Error al crear asignación:', err);
      setError(err?.message || 'Ocurrió un error al registrar la asignación. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 md:p-6 bg-blue-900 text-white flex justify-between items-center flex-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-blue-200">
              <FiBox className="text-xl" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight">Nueva Asignación</h3>
              <p className="text-[11px] text-blue-200 font-medium">
                Asignar herramientas o equipos a colaboradores y unidades vehiculares
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 md:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
            {/* 1. SELECCIÓN DEL ARTÍCULO */}
            <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FiTag className="text-blue-600" /> 1. Herramienta o Equipo a Asignar
                </label>
                {selectedItem && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      maxAvailableStock > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    Stock Disponible: {maxAvailableStock} {selectedItem.unit || 'unid'}
                  </span>
                )}
              </div>

              <div>
                <Select
                  options={[
                    { label: '-- Selecciona un artículo del catálogo --', value: '' },
                    ...selectableItems.map((item) => ({
                      label: item.label,
                      value: item.id
                    }))
                  ]}
                  value={selectedItemId}
                  onChange={(val) => {
                    setSelectedItemId(val);
                    setQuantity('1');
                  }}
                  isSearchable={true}
                  placeholder="Buscar por código o descripción..."
                />
              </div>

              {selectedItem && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">Código:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedItem.code}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">Categoría:</span>
                    <span className="font-bold text-slate-700">{selectedItem.category || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase">Ubicación Bodega:</span>
                    <span className="font-bold text-slate-700">{selectedItem.location || 'General'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. CANTIDAD Y CONDICIÓN INICIAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                  Cantidad a Asignar
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxAvailableStock > 0 ? maxAvailableStock : 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!selectedItemId || maxAvailableStock <= 0}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
                  required
                />
                {selectedItem && maxAvailableStock <= 0 && (
                  <p className="text-[10px] text-red-600 font-bold mt-1">
                    Este artículo no cuenta con stock disponible para asignar.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                  Estado/Condición Inicial
                </label>
                <Select
                  options={[
                    { label: 'Bueno (Óptimo funcionamiento)', value: 'Bueno' },
                    { label: 'Nuevo (A estrenar)', value: 'Nuevo' },
                    { label: 'Regular (Con desgaste pero funcional)', value: 'Regular' }
                  ]}
                  value={initialCondition}
                  onChange={(val) => setInitialCondition(val as ItemCondition)}
                  isSearchable={false}
                />
              </div>
            </div>

            {/* 3. TIPO DE DESTINATARIO Y DESTINATARIO */}
            <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <FiUser className="text-blue-600" /> 2. Destinatario de la Asignación
              </label>

              {/* Selector tipo: Colaborador vs Unidad */}
              <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleRecipientTypeChange('colaborador')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    recipientType === 'colaborador'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FiUser className="text-sm" /> Colaborador
                </button>
                <button
                  type="button"
                  onClick={() => handleRecipientTypeChange('unidad')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    recipientType === 'unidad'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FiTruck className="text-sm" /> Unidad Vehicular
                </button>
              </div>

              {/* Selector dinámico */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {recipientType === 'colaborador'
                    ? 'Seleccionar Colaborador'
                    : 'Seleccionar Unidad Vehicular'}
                </label>
                {recipientType === 'colaborador' ? (
                  <Select
                    options={[
                      { label: '-- Selecciona un colaborador activo --', value: '' },
                      ...activeEmployees.map((emp) => ({
                        label: `${emp.name}${emp.status ? ` (${emp.status})` : ''}`,
                        value: emp.id
                      }))
                    ]}
                    value={recipientId}
                    onChange={(val) => setRecipientId(val)}
                    isSearchable={true}
                    placeholder="Buscar colaborador por nombre..."
                  />
                ) : (
                  <Select
                    options={[
                      { label: '-- Selecciona una unidad vehicular --', value: '' },
                      ...vehicles.map((v) => ({
                        label: v.displayName || v.name || v.id,
                        value: v.id
                      }))
                    ]}
                    value={recipientId}
                    onChange={(val) => setRecipientId(val)}
                    isSearchable={true}
                    placeholder="Buscar unidad vehicular..."
                  />
                )}
              </div>
            </div>

            {/* 4. FECHA, PROYECTO Y RESPONSABLE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                  <FiCalendar className="text-blue-600" /> Fecha de Asignación
                </label>
                <input
                  type="date"
                  value={assignedDate}
                  onChange={(e) => setAssignedDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                  <FiFileText className="text-blue-600" /> Proyecto / Trabajo Asociado (Opcional)
                </label>
                <Select
                  options={[
                    { label: '-- Ningún proyecto específico --', value: '' },
                    ...projects.map((p) => ({
                      label: `${p.projectNumber || 'PROY'} - ${p.name}`,
                      value: p.id
                    }))
                  ]}
                  value={selectedProjectId}
                  onChange={(val) => setSelectedProjectId(val)}
                  isSearchable={true}
                  placeholder="Vincular a proyecto..."
                />
              </div>
            </div>

            {/* Responsable de entrega */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                Responsable que entrega / registra
              </label>
              <input
                type="text"
                value={assignedBy}
                onChange={(e) => setAssignedBy(e.target.value)}
                placeholder="Nombre de quien autoriza y entrega la herramienta"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Observaciones */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                Observaciones o Notas Adicionales
              </label>
              <textarea
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Detalles sobre el uso, accesorios incluidos, número de serie o condición especial..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-2xl border border-red-200 flex items-center gap-2.5 animate-in shake duration-200">
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
              disabled={isSubmitting || !selectedItemId || maxAvailableStock <= 0}
              isLoading={isSubmitting}
              label={isSubmitting ? 'Registrando...' : 'Confirmar Asignación'}
              icon={<FiSave />}
              variant="primary"
              className="flex-1 !py-3 !text-xs !font-black !uppercase !tracking-normal !rounded-xl"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
