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
  FiPlus,
  FiTrash2
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

export interface AssignmentItemEntry {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  itemCategory?: string;
  itemUnit?: string;
  quantity: number;
  initialCondition: ItemCondition;
}

interface NewAssignmentModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateAssignmentDTO) => Promise<any>;
  onSubmitBatch?: (dtos: CreateAssignmentDTO[]) => Promise<any>;
  currentUser: User | null;
  inventoryItems: InventoryItem[];
}

export const NewAssignmentModal: React.FC<NewAssignmentModalProps> = ({
  show,
  onClose,
  onSubmit,
  onSubmitBatch,
  currentUser,
  inventoryItems
}) => {
  const { activeEmployees } = useEmployees();
  const [projects, setProjects] = useState<Project[]>([]);
  const vehicles = useMemo(() => getVehicleCatalog(), []);

  // General assignment data
  const [recipientType, setRecipientType] = useState<RecipientType>('colaborador');
  const [recipientId, setRecipientId] = useState<string>('');
  const [assignedDate, setAssignedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [assignedBy, setAssignedBy] = useState<string>('');
  const [hasInitializedAssignedBy, setHasInitializedAssignedBy] = useState<boolean>(false);

  // Multi-item entry state
  const [assignedItems, setAssignedItems] = useState<AssignmentItemEntry[]>([]);
  const [currentItemId, setCurrentItemId] = useState<string>('');
  const [currentQuantity, setCurrentQuantity] = useState<string>('1');
  const [currentCondition, setCurrentCondition] = useState<ItemCondition>('Nuevo');
  const [showAssignedByDropdown, setShowAssignedByDropdown] = useState<boolean>(false);
  
  // Custom dropdown states
  const [recipientSearchText, setRecipientSearchText] = useState<string>('');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState<boolean>(false);
  
  const [itemSearchText, setItemSearchText] = useState<string>('');
  const [showItemDropdown, setShowItemDropdown] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useLockBodyScroll(show);

  const sortedEmployees = useMemo(() => {
    return [...activeEmployees].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
    );
  }, [activeEmployees]);

  const filteredEmployeesForAssignedBy = useMemo(() => {
    if (!assignedBy.trim()) return sortedEmployees;
    const q = assignedBy.toLowerCase().trim();
    return sortedEmployees.filter(
      (emp) =>
        (emp.name || '').toLowerCase().includes(q) ||
        (emp.position && emp.position.toLowerCase().includes(q)) ||
        (emp.identification && emp.identification.toLowerCase().includes(q))
    );
  }, [sortedEmployees, assignedBy]);

  const filteredEmployeesForRecipient = useMemo(() => {
    if (!recipientSearchText.trim()) return sortedEmployees;
    const q = recipientSearchText.toLowerCase().trim();
    return sortedEmployees.filter(
      (emp) =>
        (emp.name || '').toLowerCase().includes(q) ||
        (emp.position && emp.position.toLowerCase().includes(q)) ||
        (emp.identification && emp.identification.toLowerCase().includes(q))
    );
  }, [sortedEmployees, recipientSearchText]);

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
      setRecipientType('colaborador');
      setRecipientId('');
      setAssignedDate(new Date().toISOString().split('T')[0]);
      setSelectedProjectId('');
      setObservations('');
      
      const defaultName = currentUser?.name || currentUser?.displayName || '';
      setAssignedBy(defaultName);
      
      setAssignedItems([]);
      setCurrentItemId('');
      setCurrentQuantity('1');
      setCurrentCondition('Nuevo');
      setError(null);
      setShowAssignedByDropdown(false);
      
      setRecipientSearchText('');
      setShowRecipientDropdown(false);
      setItemSearchText('');
      setShowItemDropdown(false);
    }
  }, [show, currentUser]);

  const selectableItems = useMemo(() => {
    return inventoryItems
      .filter((item) => item && item.id && item.code)
      .map((item) => {
        const availableStock = Math.max(0, item.stock ?? 0);
        const itemDesc = (item.description || item.name || '').trim() || `Material ${item.code}`;
        return {
          ...item,
          itemDescription: itemDesc,
          availableStock,
          label: `[${item.code}] ${itemDesc} (Stock: ${availableStock} ${item.unit || 'unid'})`
        };
      })
      .sort((a, b) => {
        const descA = a.itemDescription || '';
        const descB = b.itemDescription || '';
        const descCompare = descA.localeCompare(descB, 'es', { sensitivity: 'base' });
        
        if (descCompare !== 0) return descCompare;
        
        const codeA = a.code || '';
        const codeB = b.code || '';
        return codeA.localeCompare(codeB, 'es', { sensitivity: 'base' });
      });
  }, [inventoryItems]);

  const filteredSelectableItems = useMemo(() => {
    if (!itemSearchText.trim()) return selectableItems;
    const q = itemSearchText.toLowerCase().trim();
    return selectableItems.filter(
      (item) =>
        (item.itemDescription || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.code || '').toLowerCase().includes(q)
    );
  }, [selectableItems, itemSearchText]);

  const currentSelectedItem = useMemo(() => {
    return selectableItems.find((i) => i.id === currentItemId);
  }, [selectableItems, currentItemId]);

  const maxAvailableStock = currentSelectedItem ? currentSelectedItem.availableStock : 0;

  const handleAddItem = () => {
    setError(null);
    if (!currentItemId || !currentSelectedItem) {
      setError('Por favor selecciona una herramienta o equipo del inventario para agregar.');
      return;
    }

    const qtyNumber = parseInt(currentQuantity, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setError('La cantidad a asignar debe ser un número entero mayor a cero.');
      return;
    }

    const alreadyAddedQty = assignedItems
      .filter((item) => item.itemId === currentItemId)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (qtyNumber + alreadyAddedQty > maxAvailableStock) {
      setError(
        `La cantidad total para "${currentSelectedItem.itemDescription}" (${qtyNumber + alreadyAddedQty}) excede el stock disponible (${maxAvailableStock}).`
      );
      return;
    }

    const newItemEntry: AssignmentItemEntry = {
      itemId: currentSelectedItem.id,
      itemCode: currentSelectedItem.code,
      itemDescription: currentSelectedItem.itemDescription,
      itemCategory: currentSelectedItem.category,
      itemUnit: currentSelectedItem.unit || 'unid',
      quantity: qtyNumber,
      initialCondition: currentCondition
    };

    setAssignedItems((prev) => [...prev, newItemEntry]);
    setCurrentItemId('');
    setItemSearchText('');
    setCurrentQuantity('1');
    setCurrentCondition('Nuevo');
    setShowItemDropdown(false);
  };

  const handleUpdateItemQuantity = (index: number, newQtyStr: string) => {
    setError(null);
    const targetEntry = assignedItems[index];
    if (!targetEntry) return;

    const stockItem = selectableItems.find((i) => i.id === targetEntry.itemId);
    const availableStock = stockItem ? stockItem.availableStock : targetEntry.quantity;

    const otherQtySum = assignedItems
      .filter((item, i) => i !== index && item.itemId === targetEntry.itemId)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const maxAllowed = availableStock - otherQtySum;

    if (newQtyStr === '') {
      setAssignedItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, quantity: '' as any } : item))
      );
      return;
    }

    const newQty = parseInt(newQtyStr, 10);

    if (isNaN(newQty) || newQty <= 0) {
      setError('La cantidad debe ser un número entero mayor a cero.');
      setAssignedItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, quantity: 1 } : item))
      );
      return;
    }

    if (newQty > maxAllowed) {
      setError(`La cantidad no puede superar el stock disponible (${maxAllowed} ${targetEntry.itemUnit || 'unidades'}).`);
      const validQty = Math.max(1, maxAllowed);
      setAssignedItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, quantity: validQty } : item))
      );
      return;
    }

    setAssignedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: newQty } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setAssignedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRecipientTypeChange = (type: RecipientType) => {
    setRecipientType(type);
    setRecipientId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (assignedItems.length === 0) {
      setError('Debes agregar al menos un artículo o material a la asignación.');
      return;
    }

    for (const entry of assignedItems) {
      const q = Number(entry.quantity);
      if (isNaN(q) || q <= 0) {
        setError(`La cantidad para "${entry.itemDescription}" debe ser un número entero mayor a cero.`);
        return;
      }
    }

    if (!recipientId) {
      setError(`Por favor selecciona el ${recipientType === 'colaborador' ? 'colaborador' : 'vehículo/unidad'} destinatario.`);
      return;
    }

    if (!assignedBy || !assignedBy.trim()) {
      setError('Por favor selecciona el responsable que entrega o registra.');
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

    try {
      setIsSubmitting(true);
      const dtos: CreateAssignmentDTO[] = assignedItems.map((entry) => ({
        itemId: entry.itemId,
        itemCode: entry.itemCode,
        itemDescription: entry.itemDescription,
        itemCategory: entry.itemCategory,
        itemUnit: entry.itemUnit || 'unid',
        quantity: Number(entry.quantity),
        recipientType,
        recipientId,
        recipientName,
        recipientDetail,
        assignedDate,
        initialCondition: entry.initialCondition,
        projectId: selectedProj?.id,
        projectNumber: selectedProj?.projectNumber,
        projectName: selectedProj?.name,
        observations: observations.trim(),
        assignedBy: assignedBy.trim()
      }));

      if (onSubmitBatch) {
        await onSubmitBatch(dtos);
      } else {
        for (const dto of dtos) {
          await onSubmit(dto);
        }
      }
      onClose();
    } catch (err: any) {
      console.error('[NewAssignmentModal] Error al crear asignaciones:', err);
      setError(err?.message || 'Ocurrió un error al registrar las asignaciones. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-2 md:p-4 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl md:rounded-[32px] shadow-2xl w-full max-w-3xl overflow-x-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 md:p-6 bg-blue-900 text-white flex justify-between items-center flex-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-blue-200">
              <FiBox className="text-xl" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight">Nueva Asignación Múltiple</h3>
              <p className="text-[11px] text-blue-200 font-medium">
                Asigna múltiples materiales, herramientas o equipos en una sola operación
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-x-hidden">
          <div className="p-5 md:p-6 overflow-y-auto overflow-x-hidden space-y-5 custom-scrollbar flex-1 w-full max-w-full">
            
            {/* 1. DESTINATARIO */}
            <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <FiUser className="text-blue-600" /> 1. Destinatario de la Asignación
              </label>

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

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {recipientType === 'colaborador' ? 'Seleccionar Colaborador' : 'Seleccionar Unidad Vehicular'}
                </label>
                {recipientType === 'colaborador' ? (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <FiUser />
                    </div>
                    <input
                      type="text"
                      value={recipientSearchText}
                      onChange={(e) => {
                        setRecipientSearchText(e.target.value);
                        setRecipientId('');
                        setShowRecipientDropdown(true);
                      }}
                      onFocus={() => setShowRecipientDropdown(true)}
                      placeholder="Buscar colaborador por nombre..."
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    {recipientSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientSearchText('');
                          setRecipientId('');
                          setShowRecipientDropdown(true);
                          // Needs a small delay to avoid focus loss immediately closing it
                          setTimeout(() => {
                             const input = document.activeElement as HTMLInputElement;
                             if(input) input.focus();
                          }, 10);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        <FiX className="text-sm" />
                      </button>
                    )}
                    {showRecipientDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowRecipientDropdown(false)}
                        />
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar min-w-[280px]">
                          {filteredEmployeesForRecipient.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-slate-500 text-center">
                              No se encontraron colaboradores
                            </div>
                          ) : (
                            filteredEmployeesForRecipient.map((emp) => (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setRecipientId(emp.id!);
                                  setRecipientSearchText(emp.name);
                                  setShowRecipientDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors focus:bg-slate-50 outline-none ${recipientId === emp.id ? 'bg-blue-50' : ''}`}
                              >
                                <div className="font-bold text-xs text-slate-900">{emp.name}</div>
                                {emp.position && (
                                  <div className="text-[10px] text-slate-500 mt-0.5">{emp.position}</div>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
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

            {/* 2. AGREGAR MATERIALES / HERRAMIENTAS A LA LISTA */}
            <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FiTag className="text-blue-600" /> 2. Seleccionar y Agregar Materiales / Herramientas
                </label>
                {currentSelectedItem && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      maxAvailableStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    Stock Disponible: {maxAvailableStock} {currentSelectedItem.unit || 'unid'}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <FiBox />
                  </div>
                  <input
                    type="text"
                    value={itemSearchText}
                    onChange={(e) => {
                      setItemSearchText(e.target.value);
                      setCurrentItemId('');
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    placeholder="Buscar por código o descripción..."
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  {itemSearchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setItemSearchText('');
                        setCurrentItemId('');
                        setShowItemDropdown(true);
                        setTimeout(() => {
                           const input = document.activeElement as HTMLInputElement;
                           if(input) input.focus();
                        }, 10);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <FiX className="text-sm" />
                    </button>
                  )}
                  {showItemDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowItemDropdown(false)}
                      />
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar min-w-[280px]">
                        {filteredSelectableItems.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-500 text-center">
                            No se encontraron artículos
                          </div>
                        ) : (
                          filteredSelectableItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setCurrentItemId(item.id!);
                                setItemSearchText(item.label);
                                setCurrentQuantity('1');
                                setShowItemDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors focus:bg-slate-50 outline-none ${currentItemId === item.id ? 'bg-blue-50' : ''}`}
                            >
                              <div className="font-bold text-xs text-slate-900">{item.itemDescription}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5 flex gap-2">
                                <span className="font-mono text-blue-700 bg-blue-50 px-1 rounded">{item.code}</span>
                                <span>Stock: {item.availableStock} {item.unit || 'unid'}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full max-w-full">
                  <div className="w-full sm:w-32 flex-none">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxAvailableStock > 0 ? maxAvailableStock : 1}
                      value={currentQuantity}
                      onChange={(e) => setCurrentQuantity(e.target.value)}
                      disabled={!currentItemId || maxAvailableStock <= 0}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>

                  <div className="w-full sm:w-44 flex-none">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                      Condición Inicial
                    </label>
                    <Select
                      options={[
                        { label: 'Nuevo', value: 'Nuevo' },
                        { label: 'Bueno', value: 'Bueno' },
                        { label: 'Regular', value: 'Regular' }
                      ]}
                      value={currentCondition}
                      onChange={(val) => setCurrentCondition(val as ItemCondition)}
                      isSearchable={false}
                    />
                  </div>

                  <div className="w-full sm:w-auto sm:flex-1 flex justify-end">
                    <ActionButton
                      type="button"
                      variant="primary"
                      onClick={handleAddItem}
                      disabled={!currentItemId || maxAvailableStock <= 0}
                      label="AGREGAR"
                      className="w-full sm:w-auto px-6 h-10 justify-center !font-black !uppercase !tracking-wider !text-xs !shadow-sm whitespace-nowrap !rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Lista / Tabla de artículos agregados */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Artículos en esta asignación ({assignedItems.length})
                </h4>
                {assignedItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center bg-white rounded-xl border border-dashed border-slate-200">
                    Ningún material agregado todavía. Selecciona arriba y presiona "Agregar a la Asignación".
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {assignedItems.map((entry, index) => (
                      <div
                        key={`${entry.itemId}-${index}`}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                              {entry.itemCode}
                            </span>
                            <span className="font-bold text-slate-800 truncate">{entry.itemDescription}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-3">
                            <span>Condición: <strong className="text-slate-700">{entry.initialCondition}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Cantidad:
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={entry.quantity ?? ''}
                              onChange={(e) => handleUpdateItemQuantity(index, e.target.value)}
                              onBlur={() => {
                                if (!entry.quantity || Number(entry.quantity) <= 0 || isNaN(Number(entry.quantity))) {
                                  handleUpdateItemQuantity(index, '1');
                                }
                              }}
                              className="w-16 px-2 py-1 rounded-lg border border-slate-300 font-bold text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-2xs"
                            />
                            <span className="text-[11px] font-medium text-slate-500">{entry.itemUnit}</span>
                          </div>

                          <IconButton
                            type="button"
                            variant="ghost"
                            icon={<FiTrash2 className="text-red-500 hover:text-red-700 text-sm" />}
                            onClick={() => handleRemoveItem(index)}
                            title="Quitar de la lista"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. FECHA, PROYECTO Y RESPONSABLE */}
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
            <div className="relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                Responsable que entrega / registra
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <FiUser />
                </div>
                <input
                  type="text"
                  value={assignedBy}
                  onChange={(e) => {
                    setAssignedBy(e.target.value);
                    setShowAssignedByDropdown(true);
                  }}
                  onFocus={() => setShowAssignedByDropdown(true)}
                  placeholder="Buscar responsable por nombre..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                {assignedBy && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignedBy('');
                      setShowAssignedByDropdown(true);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <FiX className="text-sm" />
                  </button>
                )}
              </div>

              {showAssignedByDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowAssignedByDropdown(false)}
                  />
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar min-w-[280px]">
                    {filteredEmployeesForAssignedBy.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-500 text-center">
                        No se encontraron responsables
                      </div>
                    ) : (
                      filteredEmployeesForAssignedBy.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setAssignedBy(emp.name);
                            setShowAssignedByDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors focus:bg-slate-50 outline-none"
                        >
                          <div className="font-bold text-xs text-slate-900">{emp.name}</div>
                          {emp.position && (
                            <div className="text-[10px] text-slate-500 mt-0.5">{emp.position}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
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
          <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 flex gap-3 flex-none justify-end">
            <ActionButton
              type="button"
              variant="neutral"
              label="Cancelar"
              onClick={onClose}
              className="flex-1 sm:flex-none sm:w-auto px-4 sm:px-6 !py-3 !text-xs !font-bold !uppercase !rounded-xl"
            />
            <ActionButton
              type="submit"
              disabled={isSubmitting || assignedItems.length === 0}
              isLoading={isSubmitting}
              label={isSubmitting ? 'REGISTRANDO...' : 'CONFIRMAR'}
              icon={<FiSave />}
              variant="primary"
              className="flex-1 sm:flex-none sm:w-auto px-4 sm:px-8 !py-3 !text-xs !font-black !uppercase !tracking-normal !rounded-xl"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
