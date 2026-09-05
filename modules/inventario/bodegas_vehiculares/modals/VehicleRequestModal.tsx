import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ActionButton, IconButton } from '../../../../design-system';
import { FiX, FiCheck, FiTrash2, FiSearch, FiChevronDown } from 'react-icons/fi';
import { mockVehicles, mockProjects, mockWarehouseItems } from '../mockData';
import { VehicleMaterialRequest, VehicleWarehouseItem } from '../../../../types/vehicleWarehouse.types';

interface Props {
  show: boolean;
  onClose: () => void;
  onSave: (req: VehicleMaterialRequest) => void;
  initialData?: VehicleMaterialRequest;
  initialVehicleId?: string;
  warehouseItems?: VehicleWarehouseItem[];
}

export const VehicleRequestModal: React.FC<Props> = ({
  show,
  onClose,
  onSave,
  initialData,
  initialVehicleId,
  warehouseItems: externalWarehouseItems
}) => {
  const itemsList = externalWarehouseItems || mockWarehouseItems;
  // Vehicle Selection (pre-selected from inventory tab, but editable independently in modal)
  const [selectedVehicle, setSelectedVehicle] = useState<string>(
    initialData?.vehiculoId || initialVehicleId || (mockVehicles.length > 0 ? mockVehicles[0].id : '')
  );

  // Project Autocomplete / Free-text State
  const [projectInput, setProjectInput] = useState<string>('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState<boolean>(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // State for items in request
  const [items, setItems] = useState<{
    id: string;
    inventoryItemId: string;
    quantity: number;
  }[]>([]);

  // State for Material Adder
  const [adderMaterialId, setAdderMaterialId] = useState<string>('');
  const [adderQuantity, setAdderQuantity] = useState<number>(1);
  const [adderSearchTerm, setAdderSearchTerm] = useState<string>('');
  const [isAdderDropdownOpen, setIsAdderDropdownOpen] = useState<boolean>(false);
  const adderDropdownRef = useRef<HTMLDivElement>(null);

  // Form error message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available warehouse items for selected vehicle
  const availableMaterials = useMemo(() => {
    return itemsList.filter(i => i.vehiculoId === selectedVehicle);
  }, [itemsList, selectedVehicle]);

  // Combined list of projects for autocomplete
  const allProjects = useMemo(() => {
    return mockProjects;
  }, []);

  // Filtered projects for autocomplete dropdown
  const filteredProjects = useMemo(() => {
    const q = projectInput.trim().toLowerCase();
    if (!q) return allProjects;
    return allProjects.filter(p => 
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      `${p.code} ${p.name}`.toLowerCase().includes(q)
    );
  }, [allProjects, projectInput]);

  // Filtered materials for adder search
  const filteredAdderMaterials = useMemo(() => {
    const q = adderSearchTerm.trim().toLowerCase();
    if (!q) return availableMaterials;
    return availableMaterials.filter(m =>
      m.code.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  }, [availableMaterials, adderSearchTerm]);

  // Currently selected material in adder
  const currentAdderMaterial = useMemo(() => {
    return availableMaterials.find(m => m.inventoryItemId === adderMaterialId) || null;
  }, [availableMaterials, adderMaterialId]);

  // Max available for current adder material
  const maxAvailableForAdder = useMemo(() => {
    if (!currentAdderMaterial) return 0;
    const existingInItems = items.find(i => i.inventoryItemId === currentAdderMaterial.inventoryItemId);
    const alreadyCommittedInThisEdit = initialData?.items.find(
      x => x.inventoryItemId === currentAdderMaterial.inventoryItemId
    )?.quantityCommitted || 0;
    const remainingStock = currentAdderMaterial.availableStock + alreadyCommittedInThisEdit - (existingInItems ? existingInItems.quantity : 0);
    return Math.max(0, remainingStock);
  }, [currentAdderMaterial, items, initialData]);

  // Initialize form when opened
  useEffect(() => {
    if (show) {
      setErrorMessage(null);
      setAdderMaterialId('');
      setAdderQuantity(1);
      setAdderSearchTerm('');
      setIsProjectDropdownOpen(false);
      setIsAdderDropdownOpen(false);

      if (initialData) {
        setSelectedVehicle(initialData.vehiculoId);
        setProjectInput(
          initialData.projectName && initialData.projectCode !== initialData.projectName
            ? `${initialData.projectCode} | ${initialData.projectName}`
            : initialData.projectCode || initialData.projectName || ''
        );
        setItems(initialData.items.map((i, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantityCommitted
        })));
      } else {
        const defaultVehicle = initialVehicleId || (mockVehicles.length > 0 ? mockVehicles[0].id : '');
        setSelectedVehicle(defaultVehicle);
        setProjectInput('');
        setItems([]);
      }
    }
  }, [show, initialData, initialVehicleId]);

  // Handle outside click for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
      if (adderDropdownRef.current && !adderDropdownRef.current.contains(e.target as Node)) {
        setIsAdderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle vehicle change
  const handleVehicleChange = (newVehicleId: string) => {
    setSelectedVehicle(newVehicleId);
    setAdderMaterialId('');
    setAdderQuantity(1);
    setAdderSearchTerm('');
    // Remove any items that are not available in the new vehicle
    const newVehicleMaterials = itemsList.filter(i => i.vehiculoId === newVehicleId);
    setItems(prev => prev.filter(item => {
      const exists = newVehicleMaterials.find(m => m.inventoryItemId === item.inventoryItemId);
      return exists && exists.availableStock > 0;
    }));
  };

  // Add material from the adder
  const handleAddMaterialToRequest = () => {
    if (!currentAdderMaterial) {
      setErrorMessage('Por favor seleccione un material.');
      return;
    }
    if (adderQuantity <= 0) {
      setErrorMessage('La cantidad debe ser mayor a 0.');
      return;
    }
    if (adderQuantity > maxAvailableForAdder) {
      setErrorMessage(`La cantidad solicitada supera la disponibilidad (${maxAvailableForAdder} ${currentAdderMaterial.unit}).`);
      return;
    }

    setErrorMessage(null);

    // If item is already in request, accumulate quantity
    const existingIndex = items.findIndex(i => i.inventoryItemId === currentAdderMaterial.inventoryItemId);
    if (existingIndex >= 0) {
      setItems(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          return {
            ...item,
            quantity: item.quantity + adderQuantity
          };
        }
        return item;
      }));
    } else {
      setItems(prev => [
        ...prev,
        {
          id: `item-${Date.now()}`,
          inventoryItemId: currentAdderMaterial.inventoryItemId,
          quantity: adderQuantity
        }
      ]);
    }

    // Reset adder fields
    setAdderMaterialId('');
    setAdderQuantity(1);
    setAdderSearchTerm('');
    setIsAdderDropdownOpen(false);
  };

  // Remove material item from request
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Update item quantity in list
  const handleItemQuantityChange = (id: string, newQty: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const mat = availableMaterials.find(m => m.inventoryItemId === item.inventoryItemId);
        if (!mat) return item;
        const alreadyCommittedInThisEdit = initialData?.items.find(
          x => x.inventoryItemId === mat.inventoryItemId
        )?.quantityCommitted || 0;
        const maxAvail = mat.availableStock + alreadyCommittedInThisEdit;
        const boundedQty = Math.max(1, Math.min(newQty || 1, maxAvail));
        return { ...item, quantity: boundedQty };
      }
      return item;
    }));
  };

  // Save / Submit request
  const handleSave = () => {
    const v = mockVehicles.find(x => x.id === selectedVehicle);
    if (!v) {
      setErrorMessage('Por favor seleccione un vehículo origen válido.');
      return;
    }

    const trimmedProject = projectInput.trim();
    if (!trimmedProject) {
      setErrorMessage('Por favor introduzca o seleccione un proyecto destino.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Debe agregar al menos un material a la solicitud.');
      return;
    }

    // Validate quantities
    for (const item of items) {
      const mat = mockWarehouseItems.find(m => m.vehiculoId === v.id && m.inventoryItemId === item.inventoryItemId);
      if (!mat) {
        setErrorMessage('Uno o más materiales no pertenecen al vehículo seleccionado.');
        return;
      }
      const alreadyCommittedInThisEdit = initialData?.items.find(
        x => x.inventoryItemId === mat.inventoryItemId
      )?.quantityCommitted || 0;
      const maxAvail = mat.availableStock + alreadyCommittedInThisEdit;
      if (item.quantity <= 0 || item.quantity > maxAvail) {
        setErrorMessage(`Cantidad no válida para ${mat.description} (Disponible: ${maxAvail} ${mat.unit}).`);
        return;
      }
    }

    // Resolve project details
    let projectId = '';
    let projectCode = trimmedProject;
    let projectName = trimmedProject;

    // Check if matching existing project in mockProjects
    const matchedProject = mockProjects.find(
      p => p.code.toLowerCase() === trimmedProject.toLowerCase() ||
           `${p.code} | ${p.name}`.toLowerCase() === trimmedProject.toLowerCase() ||
           p.name.toLowerCase() === trimmedProject.toLowerCase()
    );

    if (matchedProject) {
      projectId = matchedProject.id;
      projectCode = matchedProject.code;
      projectName = matchedProject.name;
    } else if (trimmedProject.includes('|')) {
      const parts = trimmedProject.split('|');
      projectCode = parts[0].trim();
      projectName = parts.slice(1).join('|').trim() || parts[0].trim();
    } else if (trimmedProject.includes(' - ')) {
      const parts = trimmedProject.split(' - ');
      projectCode = parts[0].trim();
      projectName = parts.slice(1).join(' - ').trim() || parts[0].trim();
    }

    // Map request items
    const requestItems = items.map(i => {
      const mat = mockWarehouseItems.find(m => m.vehiculoId === v.id && m.inventoryItemId === i.inventoryItemId);
      if (!mat) return null;
      return {
        inventoryItemId: i.inventoryItemId,
        code: mat.code,
        description: mat.description,
        unit: mat.unit,
        quantityCommitted: i.quantity
      };
    }).filter(Boolean) as any[];

    if (initialData) {
      const updatedReq: VehicleMaterialRequest = {
        ...initialData,
        vehiculoId: v.id,
        vehiculoAlias: v.alias,
        vehiculoPlaca: v.placa,
        projectId: projectId || initialData.projectId,
        projectCode,
        projectName,
        items: requestItems,
        updatedAt: new Date().toISOString()
      };
      onSave(updatedReq);
    } else {
      const newReq: VehicleMaterialRequest = {
        id: `req-${Date.now()}`,
        requestNumber: `SOL-VEH-000${Math.floor(Math.random() * 1000)}`,
        vehiculoId: v.id,
        vehiculoAlias: v.alias,
        vehiculoPlaca: v.placa,
        projectId: projectId,
        projectCode,
        projectName,
        responsibleId: 'sim-user',
        responsibleName: 'Usuario Simulado',
        status: 'Abierta',
        openedAt: new Date().toISOString(),
        items: requestItems,
        additionsLog: [
          {
            additionId: `add-${Date.now()}`,
            date: new Date().toISOString(),
            addedBy: 'sim-user',
            addedByName: 'Usuario Simulado',
            items: requestItems.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: i.quantityCommitted }))
          }
        ],
        createdAt: new Date().toISOString(),
        createdBy: 'sim-user',
        updatedAt: new Date().toISOString(),
        updatedBy: 'sim-user'
      };
      onSave(newReq);
    }
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white md:rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[95vh] md:h-auto md:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800">
            {initialData ? 'Editar Solicitud' : 'Nueva Solicitud'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Error alert if any */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
              {errorMessage}
            </div>
          )}

          {/* Form Fields: Vehículo Origen & Proyecto Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehículo Origen */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Vehículo Origen
              </label>
              <div className="relative">
                <select 
                  value={selectedVehicle}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-10"
                >
                  {mockVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.alias} - {v.placa}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <FiChevronDown />
                </div>
              </div>
            </div>

            {/* Proyecto Destino — Editable Combobox con Autocompletado */}
            <div className="relative" ref={projectDropdownRef}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Proyecto Destino
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej: #106-2026 o Proyecto..."
                  value={projectInput}
                  onChange={(e) => {
                    setProjectInput(e.target.value);
                    setIsProjectDropdownOpen(true);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setIsProjectDropdownOpen(true)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setIsProjectDropdownOpen(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <FiChevronDown />
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {isProjectDropdownOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProjectInput(`${p.code} | ${p.name}`);
                          setIsProjectDropdownOpen(false);
                          setErrorMessage(null);
                        }}
                        className="w-full text-left p-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                      >
                        <p className="text-xs font-bold text-slate-800">{p.code}</p>
                        <p className="text-[11px] text-slate-500 truncate">{p.name}</p>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      Presiona fuera para usar <strong className="text-slate-700">&quot;{projectInput}&quot;</strong> como nuevo proyecto.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sección de Agregar Material */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Seleccionar y Agregar Material
            </h3>
            
            <div className="bg-slate-50 rounded-xl p-3 md:p-4 border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                {/* Selector / Buscador de Material */}
                <div className="md:col-span-7 relative" ref={adderDropdownRef}>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Material Disponible
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar código o descripción..."
                      value={adderMaterialId ? (currentAdderMaterial ? `${currentAdderMaterial.code} — ${currentAdderMaterial.description}` : adderSearchTerm) : adderSearchTerm}
                      onChange={(e) => {
                        setAdderMaterialId('');
                        setAdderSearchTerm(e.target.value);
                        setIsAdderDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setIsAdderDropdownOpen(true);
                        if (adderMaterialId) {
                          setAdderSearchTerm('');
                          setAdderMaterialId('');
                        }
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none pr-8 truncate"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      {adderSearchTerm || !adderMaterialId ? <FiSearch /> : <FiChevronDown />}
                    </div>
                  </div>

                  {/* Dropdown de Materiales */}
                  {isAdderDropdownOpen && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredAdderMaterials.length > 0 ? (
                        filteredAdderMaterials.map(m => {
                          const existingInItems = items.find(i => i.inventoryItemId === m.inventoryItemId);
                          const alreadyCommittedInThisEdit = initialData?.items.find(
                            x => x.inventoryItemId === m.inventoryItemId
                          )?.quantityCommitted || 0;
                          const usableStock = m.availableStock + alreadyCommittedInThisEdit - (existingInItems ? existingInItems.quantity : 0);

                          return (
                            <button
                              key={m.id}
                              type="button"
                              disabled={usableStock <= 0}
                              onClick={() => {
                                setAdderMaterialId(m.inventoryItemId);
                                setAdderSearchTerm(`${m.code} — ${m.description}`);
                                setIsAdderDropdownOpen(false);
                                setAdderQuantity(1);
                              }}
                              className={`w-full text-left p-2.5 border-b border-slate-100 last:border-b-0 flex justify-between items-center transition-colors ${
                                usableStock <= 0 
                                  ? 'opacity-40 bg-slate-50 cursor-not-allowed' 
                                  : 'hover:bg-blue-50'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-800">{m.code}</p>
                                <p className="text-[11px] text-slate-600 truncate max-w-[220px] md:max-w-[280px]">{m.description}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                usableStock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                              }`}>
                                Disp: {usableStock} {m.unit}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          No se encontraron materiales para este vehículo.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cantidad */}
                <div className="md:col-span-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Cantidad
                    </label>
                    {currentAdderMaterial && (
                      <span className="text-[10px] font-bold text-blue-600">
                        Disp: {maxAvailableForAdder} {currentAdderMaterial.unit}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={maxAvailableForAdder || 1}
                    value={adderQuantity || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setAdderQuantity(val);
                    }}
                    placeholder="1"
                    disabled={!currentAdderMaterial || maxAvailableForAdder <= 0}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                {/* Botón Agregar */}
                <div className="md:col-span-2">
                  <ActionButton
                    label="Agregar"
                    variant="primary"
                    disabled={!currentAdderMaterial || adderQuantity <= 0 || adderQuantity > maxAvailableForAdder}
                    onClick={handleAddMaterialToRequest}
                    className="w-full justify-center !text-xs !py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Materiales Asignados */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">
                Materiales en la Solicitud ({items.length})
              </h3>
            </div>

            {items.length === 0 ? (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed text-center">
                <p className="text-xs font-medium text-slate-500">
                  Aún no hay materiales en esta solicitud. Seleccione un material arriba y pulse &quot;Agregar&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const currentMat = availableMaterials.find(m => m.inventoryItemId === item.inventoryItemId);
                  const alreadyCommittedInThisEdit = initialData?.items.find(
                    x => x.inventoryItemId === item.inventoryItemId
                  )?.quantityCommitted || 0;
                  const maxAvail = currentMat 
                    ? currentMat.availableStock + alreadyCommittedInThisEdit
                    : item.quantity;
                  
                  return (
                    <div 
                      key={item.id} 
                      className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {currentMat?.code || 'MATERIAL'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {currentMat?.category}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mt-1">
                          {currentMat?.description || 'Material asignado'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                              Cantidad
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={maxAvail}
                              value={item.quantity || ''}
                              onChange={(e) => handleItemQuantityChange(item.id, parseInt(e.target.value) || 1)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="pt-3 text-[10px] text-slate-500 font-medium whitespace-nowrap">
                            {currentMat?.unit || 'und'} (Máx: {maxAvail})
                          </div>
                        </div>

                        <div className="pt-3">
                          <IconButton 
                            icon={<FiTrash2 />} 
                            variant="danger" 
                            onClick={() => handleRemoveItem(item.id)} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-end gap-3">
          <ActionButton 
            label="Cancelar" 
            variant="secondary" 
            onClick={onClose} 
            className="w-full md:w-auto justify-center order-2 md:order-1" 
          />
          <ActionButton 
            label={initialData ? "Guardar Cambios" : "Crear Solicitud"} 
            icon={<FiCheck />} 
            variant="primary" 
            onClick={handleSave} 
            className="w-full md:w-auto justify-center order-1 md:order-2" 
          />
        </div>
      </div>
    </div>
  );
};
