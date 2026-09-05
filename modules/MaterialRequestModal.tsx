
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, Quote } from '@/utils/types';
import { InventoryItem } from '@/inventoryTypes';
import { ProjectOrigin, MaterialRequest, RequestDestinationType } from '@/dispatchTypes';
import { getYearFromDateString } from '@/utils/dateUtils';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { useAuditPermanence } from '@/hooks/useAuditPermanence';
import { FiX, FiCircle, FiSearch, FiAlertCircle, FiAlertTriangle } from "react-icons/fi";
import { ActionButton, IconButton, Select } from '../design-system';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ItemStatus } from '@/dispatchTypes';
import { mockVehicles } from './inventario/bodegas_vehiculares/mockData';
import { vehicleWarehouseService } from './inventario/bodegas_vehiculares/services/vehicleWarehouseService';

interface MaterialRequestModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  currentUser: User;
  inventoryItems: InventoryItem[];
  approvedQuotes: Quote[];
  initialData?: MaterialRequest | null;
}

interface TempRequestItem {
    id: string;
    inventoryItemId: string;
    code: string;
    description: string;
    quantity: string | number;
    unit: string;
    comment?: string; // Add comment to interface as it is used
    error?: string | null;
    quantityRequested: number;
    quantityDispatched: number;
    quantityPending: number;
    shortageQty?: number;
    status: ItemStatus;
}

export const MaterialRequestModal = ({ 
    show, onClose, onSubmit, currentUser, inventoryItems, approvedQuotes, initialData 
}: MaterialRequestModalProps) => {
  useAuditPermanence({
    module: 'Inventario',
    submodule: initialData ? 'Editar Solicitud Material' : 'Nueva Solicitud Material',
    recordId: initialData?.id,
    recordCode: initialData?.otCode,
    enabled: show
  });
  useLockBodyScroll(show);

  const [origin, setOrigin] = useState<ProjectOrigin | ''>('');
  const [destinationType, setDestinationType] = useState<RequestDestinationType>('project');
  const [targetVehicleId, setTargetVehicleId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [planta, setPlanta] = useState('');
  const [plantaSuggestions, setPlantaSuggestions] = useState<string[]>([]);
  const [observations, setObservations] = useState('');
  
  // Campos IBUX-CLARO
  const [fdh, setFdh] = useState('');
  const [torre, setTorre] = useState('');
  const [locationDetails, setLocationDetails] = useState('');

  // Items
  const [addedItems, setAddedItems] = useState<TempRequestItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [tempItemId, setTempItemId] = useState('');
  const [tempQty, setTempQty] = useState('');
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState(false);

  const [showMobileSelector, setShowMobileSelector] = useState(false);
  const [showMobileProjectSelector, setShowMobileProjectSelector] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const qtyInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const lastHydratedRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (show) {
        const hydrationId = initialData ? initialData.id : 'new';
        if (lastHydratedRef.current === hydrationId) {
            return;
        }
        lastHydratedRef.current = hydrationId;

        if (initialData) {
            // Modo Edición: Cargar datos existentes
            if (initialData.destinationType === 'vehicle' || initialData.targetVehiculoId) {
                setDestinationType('vehicle');
                setTargetVehicleId(initialData.targetVehiculoId || '');
                setOrigin(initialData.origin || 'BODEGA PRINCIPAL');
            } else {
                setDestinationType('project');
                setTargetVehicleId('');
                setOrigin(initialData.origin);
            }
            const proj = approvedQuotes.find(q => q.id.toString() === initialData.projectId);
            if (proj) {
                setProjectId(initialData.projectId);
                setProjectSearch(`#${proj.id.toString().padStart(3, '0')}-${getYearFromDateString(proj.fecha)} | ${proj.empresa}`);
            } else {
                setProjectId('');
                setProjectSearch(initialData.projectName && initialData.projectName !== 'SIN PROYECTO' && initialData.projectName !== 'IBUX-CLARO' && initialData.projectName !== 'N/A' ? initialData.projectName : '');
            }

            setPlanta(initialData.planta || (initialData as any).plantel || '');
            setObservations(initialData.observations || '');
            setFdh(initialData.fdh || '');
            setTorre(initialData.torre || '');
            setLocationDetails(initialData.locationDetails || '');
            
            // Mapear items existentes al formato temporal
            const items = initialData.items.map(i => ({
                id: Date.now().toString() + Math.random(), // ID temporal único
                inventoryItemId: i.inventoryItemId,
                code: i.code,
                description: i.description,
                unit: i.unit,
                quantity: i.quantityRequested || 0,
                quantityRequested: i.quantityRequested || 0,
                quantityDispatched: i.quantityDispatched || 0,
                quantityPending: i.quantityPending ?? (i.quantityRequested || 0),
                status: i.status || 'pending',
                comment: i.comment || '',
                error: null
            }));
            setAddedItems(items);
        } else {
            // Modo Creación: Resetear
            setDestinationType('project');
            setTargetVehicleId('');
            setOrigin('');
            setProjectId('');
            setObservations('');
            setFdh('');
            setTorre('');
            setLocationDetails('');
            setPlanta('');
            setAddedItems([]);
            setProjectSearch('');
        }
        setItemSearch('');
        setTempItemId('');
        setTempQty('');
        setError(null);
        setDuplicateError(false);
    } else {
        lastHydratedRef.current = null;
    }
  }, [show, initialData]); // Reduced dependencies to prevent accidental resets

  const selectedProject = useMemo(() => 
      approvedQuotes.find(q => q.id.toString() === projectId),
  [approvedQuotes, projectId]);

  const isIBUX = useMemo(() => {
    const projectName = selectedProject?.empresa || '';
    return origin === 'IBUX-CLARO' || projectName.toUpperCase().includes('IBUX');
  }, [origin, selectedProject]);

  const isCNFL = useMemo(() => origin === 'CNFL', [origin]);

  useEffect(() => {
    if (isCNFL) {
        const fetchPlantas = async () => {
            const q = query(collection(db, 'material_reports'), where('origin', '==', 'CNFL'));
            const snap = await getDocs(q);
            const plantas = new Set<string>();
            snap.forEach(doc => {
                const data = doc.data();
                if (data.planta) plantas.add(data.planta);
            });
            setPlantaSuggestions(Array.from(plantas));
        };
        fetchPlantas();
    }
  }, [isCNFL]);

  const filteredProjects = useMemo(() => {
      if (!projectSearch) return approvedQuotes.slice(0, 10);
      const term = projectSearch.toLowerCase();
      return approvedQuotes.filter(q => {
          const projectCode = `#${q.id.toString().padStart(3, '0')}-${getYearFromDateString(q.fecha)}`.toLowerCase();
          const company = q.empresa.toLowerCase();
          return projectCode.includes(term) || company.includes(term);
      }).slice(0, 20);
  }, [approvedQuotes, projectSearch]);

  const filteredItems = useMemo(() => {
      if (!itemSearch) return inventoryItems.slice(0, 10);
      const term = itemSearch.toLowerCase();
      return inventoryItems.filter(i => 
          i.code.toLowerCase().includes(term) || 
          i.description.toLowerCase().includes(term)
      ).slice(0, 20);
  }, [inventoryItems, itemSearch]);

  const selectedInventoryItem = useMemo(() => 
      inventoryItems.find(i => i.id === tempItemId), 
  [inventoryItems, tempItemId]);

  useEffect(() => {
    if (tempItemId && addedItems.some(i => i.inventoryItemId === tempItemId)) {
      setDuplicateError(true);
    } else {
      setDuplicateError(false);
    }
  }, [tempItemId, addedItems]);

  const availableStock = useMemo(() => {
    if (!selectedInventoryItem) return 0;
    const baseAvailable = (selectedInventoryItem.stock || 0) - (selectedInventoryItem.reserved || 0);
    
    // Si estamos editando, sumamos lo que ya estaba reservado por esta solicitud
    let originalQty = 0;
    if (initialData) {
        const originalItem = initialData.items.find(i => i.inventoryItemId === selectedInventoryItem.id);
        if (originalItem) originalQty = originalItem.quantityRequested;
    }
    
    return baseAvailable + originalQty;
  }, [selectedInventoryItem, initialData]);

  const remainingStock = useMemo(() => {
    const qty = parseFloat(tempQty);
    if (isNaN(qty)) return availableStock;
    return availableStock - qty;
  }, [availableStock, tempQty]);

  const handleAddItem = () => {
      setError(null);
      if (!selectedInventoryItem) {
          setError("Seleccione un material válido.");
          return;
      }
      const qty = parseFloat(tempQty);
      if (isNaN(qty) || qty <= 0) {
          setError("La cantidad debe ser mayor a 0.");
          return;
      }

      if (addedItems.some(i => i.inventoryItemId === selectedInventoryItem.id)) {
          setDuplicateError(true);
          return;
      }

      if (destinationType === 'vehicle' && qty > availableStock) {
          setError(`Stock insuficiente en Bodega Principal. Solo hay ${availableStock} ${selectedInventoryItem.unit} disponibles.`);
          return;
      }

      const shortageAtCreation = Math.max(0, qty - availableStock);

      setAddedItems([...addedItems, {
          id: Date.now().toString(),
          inventoryItemId: selectedInventoryItem.id,
          code: selectedInventoryItem.code,
          description: selectedInventoryItem.description,
          quantity: qty,
          quantityRequested: qty,
          quantityDispatched: 0,
          quantityPending: qty,
          shortageQty: shortageAtCreation,
          status: 'pending',
          unit: selectedInventoryItem.unit,
          comment: '',
          error: null
      }]);

      setTempItemId('');
      setTempQty('');
      setItemSearch('');
      setDuplicateError(false);
  };

  const handleUpdateQuantity = (id: string, val: string) => {
    const newQty = parseFloat(val);
    const item = addedItems.find(i => i.id === id);
    if (!item) return;

    const invItem = inventoryItems.find(ii => ii.id === item.inventoryItemId);
    if (!invItem) return;

    const baseAvailable = (invItem.stock || 0) - (invItem.reserved || 0);
    
    // Si estamos editando, recuperamos cuánto se había pedido originalmente para este material
    let originalQty = 0;
    if (initialData) {
        const originalItem = initialData.items.find(oi => oi.inventoryItemId === item.inventoryItemId);
        if (originalItem) {
            originalQty = originalItem.quantityRequested || 0;
        }
    }

    // El stock "editable" es lo que hay libre + lo que yo ya tengo apartado en esta solicitud
    const maxAllowed = baseAvailable + originalQty;
    
    const shortageAtCreation = Math.max(0, newQty - maxAllowed);
    
    let itemError = null;
    if (destinationType === 'vehicle' && newQty > maxAllowed) {
        itemError = `Supera el disponible (${maxAllowed} ${item.unit})`;
    }
    setAddedItems(addedItems.map(i => i.id === id ? { ...i, quantity: val, quantityRequested: isNaN(newQty) ? 0 : newQty, quantityPending: isNaN(newQty) ? 0 : newQty, shortageQty: shortageAtCreation, error: itemError } : i));
  };

  const handleUpdateComment = (id: string, comment: string) => {
    setAddedItems(addedItems.map(i => i.id === id ? { ...i, comment } : i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // CASO BODEGA VEHICULAR: Traslado directo desde Bodega Principal
      if (destinationType === 'vehicle') {
          if (!targetVehicleId) {
              setError("Debe seleccionar la Unidad Vehicular destino.");
              return;
          }

          if (addedItems.length === 0) {
              setError("Debe agregar al menos un material.");
              return;
          }

          if (addedItems.some(i => i.error)) {
              setError("Corrija los errores en el listado de materiales.");
              return;
          }

          // Validar disponibilidad de stock físico en Bodega Principal
          for (const item of addedItems) {
              const qty = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
              const invItem = inventoryItems.find(inv => 
                  inv.id === item.inventoryItemId || inv.code.trim().toUpperCase() === item.code.trim().toUpperCase()
              );
              const available = invItem ? Math.max(0, (invItem.stock || 0) - (invItem.reserved || 0)) : 0;
              if (qty > available) {
                  setError(`Stock insuficiente en Bodega Principal para el material ${item.code}. Disponible: ${available} ${item.unit}`);
                  return;
              }
          }

          setIsSubmitting(true);
          try {
              const targetVeh = mockVehicles.find(v => v.id === targetVehicleId);
              if (!targetVeh) {
                  throw new Error("El vehículo seleccionado no existe en el catálogo.");
              }

              // 1. Ejecutar traslado a Bodega Vehicular (actualiza mockWarehouseItems y genera 1 único movimiento atómico)
              const transferRes = vehicleWarehouseService.transferFromMainWarehouse(
                  targetVehicleId,
                  addedItems.map(i => {
                      const qty = typeof i.quantity === 'string' ? parseFloat(i.quantity) : i.quantity;
                      return {
                          inventoryItemId: i.inventoryItemId,
                          code: i.code,
                          description: i.description,
                          unit: i.unit,
                          quantity: isNaN(qty) ? 0 : qty
                      };
                  }),
                  observations || `Abastecimiento desde Bodega Principal hacia ${targetVeh.alias || targetVeh.placa}`,
                  currentUser
              );

              // 2. Construir payload para el registro de la solicitud/traslado
              const payload = {
                  destinationType: 'vehicle' as RequestDestinationType,
                  origin: 'BODEGA PRINCIPAL' as ProjectOrigin,
                  projectId: `VEH-${targetVehicleId}`,
                  projectName: `${targetVeh.alias} (${targetVeh.placa})`,
                  projectCode: targetVeh.placa,
                  targetVehiculoId: targetVehicleId,
                  targetVehiculoPlaca: targetVeh.placa,
                  targetVehiculoAlias: targetVeh.alias,
                  movementReference: transferRes.movement.movementNumber,
                  requestedBy: initialData ? initialData.requestedBy : currentUser.id,
                  requestedByName: initialData ? initialData.requestedByName : currentUser.email,
                  date: initialData ? initialData.date : new Date().toISOString().split('T')[0],
                  status: 'Despachada' as RequestStatus,
                  items: addedItems.map(i => {
                      const qty = typeof i.quantity === 'string' ? parseFloat(i.quantity) : i.quantity;
                      const invItem = inventoryItems.find(inv => 
                        inv.code.trim().toUpperCase() === i.code.trim().toUpperCase()
                      );
                      return {
                          inventoryItemId: invItem ? invItem.id : i.inventoryItemId,
                          code: i.code,
                          description: i.description,
                          unit: i.unit,
                          quantityRequested: isNaN(qty) ? 0 : qty,
                          quantityDispatched: isNaN(qty) ? 0 : qty,
                          quantityPending: 0,
                          shortageQty: 0,
                          status: 'completed' as ItemStatus,
                          comment: i.comment
                      };
                  }),
                  observations
              };

              await onSubmit(payload);
              onClose();
          } catch (err: any) {
              setError(err.message);
          } finally {
              setIsSubmitting(false);
          }
          return;
      }

      // CASO PROYECTO (Flujo existente intacto)
      if (!origin) {
          setError("Debe seleccionar el Origen del movimiento.");
          return;
      }

      if (addedItems.length === 0) {
          setError("Debe agregar al menos un material.");
          return;
      }

      // Validaciones Condicionales
      if (isIBUX) {
          if (!fdh.trim() || !torre.trim() || !locationDetails.trim()) {
              setError("Para proyectos IBUX, los campos FDH, Torre y Lugar son obligatorios.");
              return;
          }
      } else if (isCNFL) {
          if (!planta.trim()) {
              setError("Debe ingresar el LUGAR / PLANTEL.");
              return;
          }
      } else {
          if (!projectId && !projectSearch.trim()) {
              setError("Para este origen, el Proyecto Asociado es obligatorio.");
              return;
          }
      }

      if (addedItems.some(i => i.error)) {
          setError("Corrija los errores en el listado de materiales.");
          return;
      }

      setIsSubmitting(true);
      try {
        // FIX: Safe navigation for projectCode
        const projectCodeValue = selectedProject 
            ? `#${selectedProject.id.toString().padStart(3, '0')}-${getYearFromDateString(selectedProject.fecha)}` 
            : (origin === 'PRIVADO' ? 'PRIVADO' : 'S/C');

          const payload = {
              origin: origin.replace(" MANTENIMIENTO", ""),
              projectId: selectedProject ? selectedProject.id.toString() : (projectId || (origin === 'PRIVADO' ? 'MANUAL' : (isIBUX ? 'IBUX' : 'N/A'))),
              projectName: selectedProject ? selectedProject.empresa.replace(" MANTENIMIENTO", "") : (projectSearch.trim() || (isIBUX ? 'IBUX-CLARO' : 'SIN PROYECTO')),
              projectCode: projectCodeValue,
              // Mantenemos el solicitante original si estamos editando, o el actual si es nuevo
              requestedBy: initialData ? initialData.requestedBy : currentUser.id,
              requestedByName: initialData ? initialData.requestedByName : currentUser.email,
              // Fecha: Mantenemos la original si se edita, o la actual
              date: initialData ? initialData.date : new Date().toISOString().split('T')[0],
              items: addedItems.map(i => {
                  const qty = typeof i.quantity === 'string' ? parseFloat(i.quantity) : i.quantity;
                  
                  // REPARACIÓN DE IDS: Si el ID guardado no coincide con el del inventario actual (por código), usamos el del inventario.
                  const invItem = inventoryItems.find(inv => 
                    inv.code.trim().toUpperCase() === i.code.trim().toUpperCase()
                  );
                  
                  if (invItem && invItem.id !== i.inventoryItemId) {
                    // Log removed
                  }

                  return {
                      inventoryItemId: invItem ? invItem.id : i.inventoryItemId,
                      code: i.code,
                      description: i.description,
                      unit: i.unit,
                      quantityRequested: isNaN(qty) ? 0 : qty,
                      quantityDispatched: i.quantityDispatched,
                      quantityPending: isNaN(qty) ? 0 : qty - i.quantityDispatched,
                      shortageQty: i.shortageQty || 0,
                      status: i.status || 'pending',
                      comment: i.comment
                  };
              }),
              fdh, torre, locationDetails, observations,
              planta: isCNFL ? planta.toUpperCase() : null
          };

          await onSubmit(payload);
          onClose();
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
      <div className="bg-white w-full max-w-lg md:max-w-5xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-[32px] flex-none">
                <div>
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                        {initialData ? `Solicitud ${initialData.requestNumber || ''}` : 'Nueva Solicitud'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Requisición de Materiales</p>
                </div>
                <IconButton
                    icon={<FiX />}
                    onClick={onClose}
                    variant="ghost"
                    className="text-slate-400 hover:text-red-500 transition-colors"
                />
            </div>

            {/* Body */}
            <div 
                className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white" 
                onClick={(e) => {
                    // Solo cerrar si el click no viene de un selector o input que debería mantenerlos abiertos
                    if (!(e.target as HTMLElement).closest('.suggestions-container')) {
                        setShowItemSuggestions(false);
                        setShowProjectSuggestions(false);
                    }
                }}
            >
                
                {initialData && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID Solicitud</p>
                            <p className="text-sm font-black text-blue-900 font-mono">{initialData.requestNumber || 'SOL-XXXX'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dispatch ID</p>
                            <p className="text-[10px] font-bold text-slate-500 font-mono">{initialData.dispatchId || '---'}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Columna Izquierda: Configuración y Datos */}
                    <div className="space-y-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <FiCircle className="text-blue-500" /> Información General
                            </p>

                            {/* 0. Destino de la Solicitud */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                                    Destino de la Solicitud <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                    <ActionButton
                                        type="button"
                                        onClick={() => {
                                            setDestinationType('project');
                                            setError(null);
                                        }}
                                        variant={destinationType === 'project' ? 'primary' : 'ghost'}
                                        label="PROYECTO"
                                        className="!py-2 !text-xs !font-bold"
                                    />
                                    <ActionButton
                                        type="button"
                                        onClick={() => {
                                            setDestinationType('vehicle');
                                            setError(null);
                                        }}
                                        variant={destinationType === 'vehicle' ? 'primary' : 'ghost'}
                                        label="BODEGA VEHICULAR"
                                        className="!py-2 !text-xs !font-bold"
                                    />
                                </div>
                            </div>
                            
                            {destinationType === 'vehicle' ? (
                                <div className="space-y-4 pt-1">
                                    {/* Origen informativo */}
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Origen de Materiales</p>
                                        <p className="text-xs font-black text-slate-800 flex items-center gap-2 mt-0.5">
                                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                            BODEGA PRINCIPAL
                                        </p>
                                    </div>

                                    {/* Selector de Unidad Vehicular */}
                                    <div className="suggestions-container" onClick={e => e.stopPropagation()}>
                                        <Select
                                            label="Unidad Vehicular Destino"
                                            options={[
                                                { label: '-- Seleccione Unidad --', value: '' },
                                                ...mockVehicles.map(v => ({
                                                    label: `${v.alias} (${v.placa})`,
                                                    value: v.id
                                                }))
                                            ]}
                                            value={targetVehicleId}
                                            onChange={val => {
                                                setTargetVehicleId(val);
                                                setError(null);
                                            }}
                                            required
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Origen */}
                                    <div className="suggestions-container" onClick={e => e.stopPropagation()}>
                                        <Select
                                            label="Origen del Movimiento"
                                            options={[
                                                { label: '-- Seleccione Origen --', value: '' },
                                                { label: 'IBUX-CLARO', value: 'IBUX-CLARO' },
                                                { label: 'CNFL', value: 'CNFL' },
                                                { label: 'PRIVADO', value: 'PRIVADO' }
                                            ]}
                                            value={origin}
                                            onChange={val => setOrigin(val as ProjectOrigin)}
                                            required
                                        />
                                    </div>

                                    {/* 2. Proyecto (Searchable) */}
                                    {origin !== 'CNFL' && (
                                        <div className="relative suggestions-container" onClick={e => e.stopPropagation()}>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                                                Proyecto Asociado {!isIBUX && <span className="text-red-500">*</span>}
                                            </label>
                                            <div className="relative">
                                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                                <input 
                                                    type="text" 
                                                    value={projectSearch} 
                                                    onChange={e => {
                                                        setProjectSearch(e.target.value);
                                                        if (projectId) setProjectId('');
                                                        setShowProjectSuggestions(true);
                                                    }}
                                                    onFocus={() => setShowProjectSuggestions(true)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isMobile) setShowMobileProjectSelector(true);
                                                    }}
                                                    placeholder="Buscar proyecto..."
                                                    className={`w-full pl-9 pr-10 py-3 rounded-xl bg-white border text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all ${!projectId && !isIBUX && origin !== '' ? 'border-red-200 ring-1 ring-red-50' : 'border-slate-200 shadow-sm'}`}
                                                />
                                                {projectSearch && (
                                                    <IconButton 
                                                        icon={<FiX />}
                                                        onClick={() => {
                                                            setProjectId('');
                                                            setProjectSearch('');
                                                            setShowProjectSuggestions(false);
                                                        }}
                                                        variant="ghost"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                                                    />
                                                )}
                                            </div>
                                            
                                            {showProjectSuggestions && (
                                                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 z-[210] max-h-60 overflow-y-auto custom-scrollbar border-t-4 border-t-blue-500">
                                                    {filteredProjects.length === 0 ? (
                                                        <p className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No se encontraron proyectos</p>
                                                    ) : (
                                                        filteredProjects.map(q => (
                                                            <div 
                                                                key={q.id}
                                                                onClick={() => {
                                                                    setProjectId(q.id.toString());
                                                                    setProjectSearch(`#${q.id.toString().padStart(3, '0')}-${getYearFromDateString(q.fecha)} | ${q.empresa}`);
                                                                    setShowProjectSuggestions(false);
                                                                }}
                                                                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                                            >
                                                                <p className="text-[11px] font-black text-blue-600 uppercase tracking-tight">
                                                                    #{q.id.toString().padStart(3, '0')}-{getYearFromDateString(q.fecha)}
                                                                </p>
                                                                <p className="text-xs font-bold text-slate-700">{q.empresa}</p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 2.1 Lugar / Plantel (CNFL) */}
                                    {isCNFL && (
                                        <div className="relative suggestions-container" onClick={e => e.stopPropagation()}>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                                                Lugar / Plantel <span className="text-red-500">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                list="planta-list"
                                                value={planta}
                                                onChange={e => setPlanta(e.target.value.toUpperCase())}
                                                placeholder="Seleccione o escriba la planta..."
                                                className="w-full p-3 rounded-xl bg-white border border-slate-200 text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                                            />
                                            <datalist id="planta-list">
                                                {plantaSuggestions.map(p => <option key={p} value={p} />)}
                                            </datalist>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 3. Campos IBUX (Condicional) */}
                        {destinationType === 'project' && (isIBUX || (origin === 'IBUX-CLARO')) && (
                            <div className="grid grid-cols-2 gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in fade-in">
                                <div className="col-span-2 text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-200 pb-1 mb-2">
                                    Datos IBUX Requeridos
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase">FDH *</label>
                                    <input 
                                        type="text" 
                                        value={fdh} 
                                        onChange={e => setFdh(e.target.value.toUpperCase())} 
                                        className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100" 
                                        placeholder="Ej: FDH-01" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase">Torre *</label>
                                    <input 
                                        type="text" 
                                        value={torre} 
                                        onChange={e => setTorre(e.target.value.toUpperCase())} 
                                        className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100" 
                                        placeholder="Ej: T-05" 
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase">Lugar / Distrito *</label>
                                    <input 
                                        type="text" 
                                        value={locationDetails} 
                                        onChange={e => setLocationDetails(e.target.value.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()))} 
                                        className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100" 
                                        placeholder="Ej: San Pedro" 
                                    />
                                </div>
                            </div>
                        )}

                        <div className="suggestions-container" onClick={e => e.stopPropagation()}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Observaciones</label>
                            <textarea 
                                value={observations}
                                onChange={e => setObservations(e.target.value)}
                                className="w-full p-4 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 h-24 md:h-32 resize-none outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                                placeholder="Comentarios adicionales..."
                            ></textarea>
                        </div>
                    </div>

                    {/* Columna Derecha: Materiales */}
                    <div className="space-y-4 flex flex-col overflow-hidden">
                        {/* 4. Agregar Materiales */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex-none">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <FiCircle className="text-emerald-500" /> Selección de Materiales
                            </p>
                            <div className="relative mb-2 suggestions-container" onClick={e => e.stopPropagation()}>
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"  />
                                <input 
                                    type="text" 
                                    value={itemSearch}
                                    onChange={e => {
                                        setItemSearch(e.target.value);
                                        setTempItemId('');
                                        setShowItemSuggestions(true);
                                    }}
                                    onFocus={() => setShowItemSuggestions(true)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isMobile) setShowMobileSelector(true);
                                    }}
                                    placeholder="Buscar material..."
                                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                                />
                                {duplicateError && (
                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                        <FiAlertCircle className="text-amber-500 shrink-0" />
                                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">Este material ya está en la lista</p>
                                    </div>
                                )}
                                {showItemSuggestions && !isMobile && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 z-[210] max-h-48 overflow-y-auto custom-scrollbar border-t-4 border-t-emerald-500">
                                        {filteredItems.length === 0 ? (
                                            <div className="p-4 text-center">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">
                                                    {inventoryItems.length === 0 ? 'Cargando materiales o sin materiales disponibles' : 'No hay coincidencias para la búsqueda'}
                                                </p>
                                            </div>
                                        ) : (
                                            filteredItems.map(item => {
                                                const available = (item.stock || 0) - (item.reserved || 0);
                                                const isOutOfStock = available <= 0;
                                                
                                                return (
                                                    <div 
                                                        key={item.id}
                                                        onClick={() => {
                                                            setTempItemId(item.id);
                                                            setItemSearch(`${item.code} - ${item.description}`);
                                                            setShowItemSuggestions(false);
                                                            setTimeout(() => qtyInputRef.current?.focus(), 100);
                                                        }}
                                                        className={`p-2.5 border-b border-slate-50 last:border-0 transition-colors ${isOutOfStock ? 'bg-amber-50/30 hover:bg-amber-50 cursor-pointer' : 'hover:bg-blue-50 cursor-pointer'}`}
                                                    >
                                                        <p className="text-[10px] font-black text-slate-700">{item.code}</p>
                                                        <p className="text-[10px] text-slate-500 truncate">{item.description}</p>
                                                        <span className={`text-[9px] font-bold ${isOutOfStock ? 'text-amber-600' : 'text-blue-600'}`}>
                                                            {isOutOfStock ? 'Sin stock (Generará faltante)' : `Disponible: ${available} ${item.unit}`}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    ref={qtyInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*[.,]?[0-9]*"
                                    placeholder="Cant." 
                                    value={tempQty} 
                                    onChange={e => {
                                        const val = e.target.value.replace(',', '.');
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setTempQty(val);
                                        }
                                    }}
                                    className={`w-24 p-2.5 rounded-lg bg-white border text-xs font-bold text-center text-slate-700 outline-none focus:ring-2 transition-all ${parseFloat(tempQty) > availableStock ? 'border-amber-400 focus:ring-amber-100' : 'border-slate-200 focus:ring-blue-100'}`}
                                />
                                <ActionButton 
                                    type="button" 
                                    onClick={handleAddItem} 
                                    disabled={!tempItemId || isNaN(parseFloat(tempQty)) || parseFloat(tempQty) <= 0} 
                                    label="AGREGAR"
                                    variant="primary"
                                    className="flex-1 py-1"
                                />
                            </div>

                            {selectedInventoryItem && (
                                <div className="mt-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Control de Inventario</span>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                            {selectedInventoryItem.unit}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Disponible</p>
                                            <p className="text-xs font-black text-slate-700">{availableStock}</p>
                                        </div>
                                        <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                                            <p className="text-[8px] font-bold text-blue-400 uppercase">Solicitado</p>
                                            <p className="text-xs font-black text-blue-600">{parseFloat(tempQty) || 0}</p>
                                        </div>
                                        <div className={`text-center p-2 rounded-lg border ${remainingStock < 0 ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-green-50 border-green-100 text-green-600'}`}>
                                            <p className="text-[8px] font-bold uppercase opacity-70">Sobrante/Faltante</p>
                                            <p className="text-xs font-black">{remainingStock}</p>
                                        </div>
                                    </div>
                                    {remainingStock < 0 && (
                                        <p className="mt-2 text-[9px] font-bold text-amber-600 flex items-center gap-1 justify-center">
                                            <FiAlertTriangle /> {destinationType === 'vehicle' ? `Stock insuficiente en Bodega Principal (disponible: ${availableStock})` : `Se generará un faltante de ${Math.abs(remainingStock)} ${selectedInventoryItem.unit}`}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Lista de Materiales Agregados - Formato Compacto */}
                        <div className="flex-1 overflow-hidden flex flex-col min-h-[200px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Materiales en Solicitud ({addedItems.length})</p>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                                {addedItems.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin materiales agregados</p>
                                    </div>
                                ) : (
                                    addedItems.map(item => (
                                        <div key={item.id} className="flex flex-col py-1 border-b border-slate-100 last:border-0">
                                            <div 
                                                className="flex flex-col gap-2 p-2 hover:bg-slate-50 transition-colors group rounded-lg"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-bold text-slate-700 truncate uppercase tracking-tight">
                                                            {item.description}
                                                        </p>
                                                        <p className="text-[9px] font-mono text-slate-400">{item.code}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="flex flex-col items-end">
                                                            <input 
                                                                type="text"
                                                                inputMode="decimal"
                                                                pattern="[0-9]*[.,]?[0-9]*"
                                                                value={item.quantity === undefined || item.quantity === null ? '' : item.quantity}
                                                                onChange={e => {
                                                                    const val = e.target.value.replace(',', '.');
                                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                        handleUpdateQuantity(item.id, val);
                                                                    }
                                                                }}
                                                                className={`w-20 p-1.5 rounded-lg bg-slate-50 border text-[12px] font-black text-center outline-none focus:ring-2 transition-all ${item.error ? 'border-red-500 text-red-600 focus:ring-red-100' : 'border-slate-200 text-blue-600 focus:ring-blue-100'}`}
                                                            />
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{item.unit}</span>
                                                        </div>
                                                        <IconButton
                                                            icon={<FiX />}
                                                            onClick={() => setAddedItems(addedItems.filter(i => i.id !== item.id))}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="px-1">
                                                    <input 
                                                        type="text"
                                                        placeholder="Agregar comentario para este ítem..."
                                                        value={item.comment || ''}
                                                        onChange={e => handleUpdateComment(item.id, e.target.value)}
                                                        className="w-full p-1.5 rounded-lg bg-white border border-slate-100 text-[10px] font-bold text-slate-500 outline-none focus:ring-2 focus:ring-blue-50 transition-all italic"
                                                    />
                                                </div>
                                            </div>
                                            {item.error && (
                                                <div className="px-2 mt-0.5 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                                                    <FiAlertCircle className="text-[#d32f2f] text-[10px]" />
                                                    <span className="text-[10px] font-medium text-[#d32f2f] leading-none">
                                                        {item.error}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
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
                    type="button" 
                    onClick={onClose} 
                    label="Cancelar"
                    variant="secondary"
                    className="flex-1 !py-2.5 !text-[10px] !font-bold !uppercase !rounded-xl"
                />
                <ActionButton 
                    type="submit" 
                    disabled={isSubmitting} 
                    isLoading={isSubmitting}
                    label={initialData ? 'Guardar' : (destinationType === 'vehicle' ? 'Registrar Traslado' : 'Enviar Solicitud')}
                    variant="primary"
                    className="flex-1 !py-2.5 !text-[10px] !font-black !uppercase !rounded-xl"
                />
            </div>
        </form>
      </div>

      {/* Selector Móvil de Materiales */}
      <MobileMaterialSelector
        show={showMobileSelector}
        onClose={() => setShowMobileSelector(false)}
        items={filteredItems}
        onSelect={(item) => {
          setTempItemId(item.id);
          setItemSearch(`${item.code} - ${item.description}`);
          setShowMobileSelector(false);
          setTimeout(() => qtyInputRef.current?.focus(), 100);
        }}
        searchTerm={itemSearch}
        setSearchTerm={setItemSearch}
      />

      {/* Selector Móvil de Proyectos */}
      <MobileProjectSelector
        show={showMobileProjectSelector}
        onClose={() => setShowMobileProjectSelector(false)}
        projects={filteredProjects}
        onSelect={(q) => {
            setProjectId(q.id.toString());
            setProjectSearch(`#${q.id.toString().padStart(3, '0')}-${getYearFromDateString(q.fecha)} | ${q.empresa}`);
            setShowMobileProjectSelector(false);
        }}
        searchTerm={projectSearch}
        setSearchTerm={setProjectSearch}
      />
    </div>,
    document.body
  );
};

// Componente auxiliar para el selector móvil de proyectos
const MobileProjectSelector: React.FC<{
  show: boolean;
  onClose: () => void;
  projects: Quote[];
  onSelect: (project: Quote) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}> = ({ show, onClose, projects, onSelect, searchTerm, setSearchTerm }) => {
  useLockBodyScroll(show);
  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-white z-[300] flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="sticky top-0 bg-white p-4 border-b border-slate-100 z-10 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-blue-950 uppercase tracking-tight">Seleccionar Proyecto</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Listado de Proyectos Aprobados</p>
          </div>
          <IconButton
            icon={<FiX />}
            onClick={onClose}
            variant="ghost"
            className="text-slate-400 hover:text-red-500 transition-colors"
          />
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por código o empresa..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {projects.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-2">
            <FiAlertCircle className="text-slate-200 text-4xl" />
            <p className="text-slate-400 text-sm font-bold">No se encontraron proyectos.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {projects.map((q) => (
              <div
                key={q.id}
                onClick={() => onSelect(q)}
                className="p-4 active:bg-blue-50 transition-colors flex flex-col gap-1 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-blue-600 uppercase tracking-wider">
                    #{q.id.toString().padStart(3, '0')}-{getYearFromDateString(q.fecha)}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-700 leading-tight">{q.empresa}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// Componente auxiliar para el selector móvil
const MobileMaterialSelector: React.FC<{
  show: boolean;
  onClose: () => void;
  items: InventoryItem[];
  onSelect: (item: InventoryItem) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}> = ({ show, onClose, items, onSelect, searchTerm, setSearchTerm }) => {
  useLockBodyScroll(show);
  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-white z-[300] flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="sticky top-0 bg-white p-4 border-b border-slate-100 z-10 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-blue-950 uppercase tracking-tight">Seleccionar Material</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Catálogo de Inventario</p>
          </div>
          <IconButton
            icon={<FiX />}
            onClick={onClose}
            variant="ghost"
            className="text-slate-400 hover:text-red-500 transition-colors"
          />
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por código o descripción..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {items.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-2">
            <FiAlertCircle className="text-slate-200 text-4xl" />
            <p className="text-slate-400 text-sm font-bold">No se encontraron materiales.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map((item) => {
              const available = (item.stock || 0) - (item.reserved || 0);
              const isOutOfStock = available <= 0;
              
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                  }}
                  className={`p-4 transition-colors flex flex-col gap-1 ${isOutOfStock ? 'bg-amber-50/30 active:bg-amber-50 cursor-pointer' : 'active:bg-blue-50 cursor-pointer'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-blue-600 uppercase tracking-wider">{item.code}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOutOfStock ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      {isOutOfStock ? 'Sin stock (Faltante)' : `Disponible: ${available}`}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 leading-tight">{item.description}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{item.unit}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
