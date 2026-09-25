
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MovementType, InventoryMovement } from '../inventoryMovementTypes';
import { User, Quote } from '../utils/types';
import { InventoryItem } from '../inventoryTypes';
import { MaterialRequest } from '../dispatchTypes';
import { getYearFromDateString } from '../utils/dateUtils';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { useAuditPermanence } from '../hooks/useAuditPermanence';
import { FiX, FiLogOut, FiLogIn, FiRotateCcw, FiInfo, FiPlusCircle, FiSearch, FiAlertCircle, FiTrash2 } from "react-icons/fi";
import { DataTable, TableColumn, ActionButton, IconButton, Select } from '../design-system';
import { formatCurrency } from '../utils/formatCurrency';
import { ProviderCombobox } from './inventario/components/ProviderCombobox';

import { sanitizeObject } from '../utils/security';

interface InventoryMovementModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  currentUser: User;
  inventoryItems: InventoryItem[];
  approvedQuotes: Quote[];
  requests: MaterialRequest[]; // Nueva prop
  initialData?: InventoryMovement | null;
  uniqueProviders?: string[];
  onAddProvider?: (name: string) => Promise<any>;
  onDeleteProvider?: (name: string) => Promise<any>;
}

interface TempItem {
    id: string; // timestamp
    inventoryItemId: string;
    code: string;
    description: string;
    quantity: number;
    unit: string;
    stock: number;
    unitPrice?: number;
    iva?: number;
    total?: number;
    currency?: 'USD' | 'CRC';
    notes?: string;
}

export const InventoryMovementModal: React.FC<InventoryMovementModalProps> = ({ 
    show, 
    onClose, 
    onSubmit, 
    currentUser, 
    inventoryItems, 
    approvedQuotes, 
    requests, 
    initialData, 
    uniqueProviders = [],
    onAddProvider,
    onDeleteProvider
}) => {
  useAuditPermanence({
    module: 'Inventario',
    submodule: 'Movimiento de Inventario',
    recordId: initialData?.id,
    recordCode: initialData?.otCode,
    enabled: show
  });
  useLockBodyScroll(show);

  // Datos Generales del Movimiento
  const [formData, setFormData] = useState({
    type: 'Salida' as MovementType,
    date: new Date().toISOString().split('T')[0],
    projectId: '',
    projectCode: '',
    projectName: '',
    observations: '',
    origin: '' as 'IBUX-CLARO' | 'CNFL' | 'PRIVADO' | 'Proveedor' | '',
    provider: '',
    fdh: '',
    torre: '',
    locationDetails: '',
    factura: '',
    linkedRequestId: '',
    linkedRequestNumber: '',
    dispatchId: ''
  });

  // Lista de Items Agregados
  const [addedItems, setAddedItems] = useState<TempItem[]>([]);

  const handleRemoveItem = useCallback((id: string) => {
      setAddedItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const itemColumns: TableColumn<TempItem>[] = useMemo(() => {
    const base: TableColumn<TempItem>[] = [
      {
        header: 'Código',
        accessorKey: 'code',
        className: 'font-bold text-slate-600'
      },
      {
        header: 'Descripción',
        accessorKey: 'description',
        className: 'text-slate-500 truncate max-w-[150px]'
      },
      {
        header: 'Cant.',
        render: (item) => `${item.quantity} ${item.unit}`,
        align: 'right',
        className: 'font-black text-slate-700'
      }
    ];

    if (formData.type === 'Entrada' && formData.origin === 'Proveedor') {
      base.push({
        header: 'Precio U.',
        render: (item) => item.unitPrice ? formatCurrency(item.unitPrice, item.currency || 'USD') : '-',
        align: 'right',
        className: 'font-bold text-slate-600'
      });
      base.push({
        header: 'Subtotal',
        render: (item) => {
          const sub = (item.unitPrice || 0) * item.quantity;
          return formatCurrency(sub, item.currency || 'USD');
        },
        align: 'right',
        className: 'text-slate-600'
      });
      base.push({
        header: 'IVA',
        render: (item) => item.iva ? formatCurrency(item.iva, item.currency || 'USD') : '-',
        align: 'right',
        className: 'text-slate-500'
      });
      base.push({
        header: 'Total',
        render: (item) => item.total ? formatCurrency(item.total, item.currency || 'USD') : '-',
        align: 'right',
        className: 'font-bold text-emerald-600'
      });
    }

    if (formData.type === 'Devolución') {
      base.push({
        header: 'Comentarios / Notas',
        render: (item) => (
          <input
            type="text"
            value={item.notes || ''}
            onChange={(e) => {
              const val = e.target.value;
              setAddedItems(prev => prev.map(i => i.id === item.id ? { ...i, notes: val } : i));
            }}
            placeholder="Observaciones de este material..."
            className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-100 bg-white text-slate-700"
          />
        ),
        className: 'w-48 sm:w-64'
      });
    }

    base.push({
      header: '',
      render: (item) => (
        <IconButton
          icon={<FiTrash2 />}
          onClick={() => handleRemoveItem(item.id)}
          variant="danger"
          size="sm"
        />
      ),
      align: 'right',
      className: 'w-8'
    });

    return base;
  }, [formData.type, formData.origin, handleRemoveItem]);

  // Campos Temporales para Agregar Item
  const [tempItemId, setTempItemId] = useState('');
  const [tempQty, setTempQty] = useState('');
  const [tempPrice, setTempPrice] = useState(''); // Nuevo estado para precio unitario
  const [tempBolt4Price, setTempBolt4Price] = useState(''); // Precio Perno 4
  const [tempBolt3Price, setTempBolt3Price] = useState(''); // Precio Perno 3
  const [tempCurrency, setTempCurrency] = useState<'USD'|'CRC'>('CRC'); // Moneda por defecto CRC
  const [tempNotes, setTempNotes] = useState(''); // Notas del ítem individual para Devolución
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);

  const lastHydratedIdRef = useRef<string | null>(null);
  
  const isIBUXOrigin = useMemo(() => 
    formData.origin === 'IBUX-CLARO',
  [formData.origin]);

  // Resetear o Hidratar formulario al abrir
  useEffect(() => {
    if (show) {
        const idToHydrate = initialData?.id || 'new';
        
        // Solo hidratamos si es un ID diferente o si acabamos de abrir
        if (lastHydratedIdRef.current !== idToHydrate) {
          if (initialData) {
              // Modo Edición
              setFormData({
                  type: initialData.type,
                  date: initialData.date,
                  projectId: initialData.projectId || '',
                  projectCode: initialData.projectCode || '',
                  projectName: initialData.projectName || '',
                  observations: initialData.observations || '',
                  origin: (initialData.origin as any) || '',
                  provider: initialData.provider || '',
                  fdh: initialData.fdh || '',
                  torre: initialData.torre || '',
                  locationDetails: initialData.locationDetails || '',
                  factura: (initialData as any).factura || '',
                  linkedRequestId: (initialData as any).linkedRequestId || '',
                  linkedRequestNumber: (initialData as any).linkedRequestNumber || '',
                  dispatchId: (initialData as any).dispatchId || ''
              });

              // Reconstruir lista de items
              let itemsToHydrate: TempItem[] = [];
              
              if (initialData.items && initialData.items.length > 0) {
                  // Nuevo formato: Array de items
                  itemsToHydrate = initialData.items.map((i, idx) => {
                      const invItem = inventoryItems.find(it => it.id === i.inventoryItemId);
                      return {
                          id: `item-${i.inventoryItemId}-${idx}`,
                          inventoryItemId: i.inventoryItemId,
                          code: i.inventoryItemCode,
                          description: i.inventoryItemName,
                          quantity: i.quantity,
                          unit: invItem?.unit || 'Unidad',
                          stock: invItem?.stock || 0,
                          unitPrice: i.unitPrice,
                          iva: i.iva,
                          total: i.total,
                          currency: i.currency,
                          notes: i.notes || ''
                      };
                  });
              } else if (initialData.inventoryItemId) {
                  // Formato Legacy: Items planos en la raíz
                  const invItem = inventoryItems.find(it => it.id === initialData.inventoryItemId);
                  itemsToHydrate = [{
                      id: `legacy-${initialData.inventoryItemId}`,
                      inventoryItemId: initialData.inventoryItemId,
                      code: initialData.inventoryItemCode,
                      description: initialData.inventoryItemName,
                      quantity: initialData.quantity,
                      unit: invItem?.unit || 'Unidad',
                      stock: invItem?.stock || 0,
                      unitPrice: (initialData as any).unitPrice,
                      iva: (initialData as any).iva,
                      total: (initialData as any).total,
                      currency: (initialData as any).currency
                  }];
              }
              setAddedItems(itemsToHydrate);

          } else {
              // Modo Nuevo
              setFormData({
                  type: 'Salida',
                  date: new Date().toISOString().split('T')[0],
                  projectId: '',
                  projectCode: '',
                  projectName: '',
                  observations: '',
                  origin: '',
                  provider: '',
                  fdh: '',
                  torre: '',
                  locationDetails: '',
                  factura: '',
                  linkedRequestId: '',
                  linkedRequestNumber: '',
                  dispatchId: ''
              });
              setAddedItems([]);
          }
          
          setTempItemId('');
          setTempQty('');
          setTempPrice('');
          setTempBolt4Price('');
          setTempBolt3Price('');
          setTempCurrency('CRC');
          setTempNotes('');
          setItemSearch('');
          setError(null);
          
          lastHydratedIdRef.current = idToHydrate;
        }
    } else {
        lastHydratedIdRef.current = null;
    }
  }, [show, initialData, inventoryItems]);

  // Helper de normalización para búsqueda insensible a acentos y mayúsculas
  const normalizeSearch = (str: string) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  // Filtrado de productos para el autocompletado
  const filteredItems = useMemo(() => {
      if (!itemSearch || !itemSearch.trim()) return inventoryItems.slice(0, 15);
      const term = normalizeSearch(itemSearch);
      if (!term) return inventoryItems.slice(0, 15);

      const tokens = term.split(/\s+/).filter(Boolean);
      return inventoryItems.filter(i => {
          const normCode = normalizeSearch(i.code);
          const normDesc = normalizeSearch(i.description);
          const normCat = normalizeSearch(i.category || '');
          const combined = `${normCode} ${normDesc} ${normCat}`;
          return tokens.every(token => combined.includes(token));
      }).slice(0, 50);
  }, [inventoryItems, itemSearch]);

  const selectedItem = useMemo(() => 
      inventoryItems.find(i => i.id === tempItemId), 
  [inventoryItems, tempItemId]);

  const selectedProject = useMemo(() => 
      approvedQuotes.find(q => q.id.toString() === formData.projectId?.toString()),
  [approvedQuotes, formData.projectId]);

  // Proyectos únicos derivados de solicitudes despachadas para Devoluciones
  const dispatchedProjects = useMemo(() => {
    const dispatched = (requests || []).filter(r => r.status === 'Despachada');
    const map = new Map<string, {
      key: string;
      projectId: string;
      projectName: string;
      projectCode?: string;
      origin?: string;
      fdh?: string;
      torre?: string;
      locationDetails?: string;
      planta?: string;
      label: string;
    }>();

    dispatched.forEach(r => {
      const rawName = (r.projectName || '').trim();
      const rawId = (r.projectId || '').trim();
      const rawCode = (r.projectCode || '').trim();

      if (!rawName && !rawId) return;

      const isGenericId = !rawId || rawId === 'SIN PROYECTO' || rawId === 'N/A' || rawId === 'IBUX-CLARO';
      const key = isGenericId ? rawName.toUpperCase() : rawId;

      if (!map.has(key)) {
        const hasCodeInName = rawCode && rawName.toUpperCase().includes(rawCode.toUpperCase());
        const displayLabel = (rawCode && !hasCodeInName)
          ? `${rawCode} - ${rawName}`
          : (rawName || rawCode || rawId);

        map.set(key, {
          key,
          projectId: rawId || key,
          projectName: rawName || rawCode || rawId,
          projectCode: rawCode || undefined,
          origin: r.origin || undefined,
          fdh: r.fdh || undefined,
          torre: r.torre || undefined,
          locationDetails: r.locationDetails || undefined,
          planta: r.planta || undefined,
          label: displayLabel
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [requests]);

  // Efecto para cargar precio automático si es Entrada de Proveedor
  const isClampCondition = useMemo(() => {
      if (!formData.provider || !selectedItem?.description) return false;
      
      const providerNormal = formData.provider.toUpperCase().replace(/\s+/g, '');
      const isSummatel = providerNormal.includes('CORPORACIONSUMMATEL');
      const isAbrazadera = selectedItem.description.toUpperCase().includes('ABRAZADERA');
      
      return formData.type === 'Entrada' && formData.origin === 'Proveedor' && isSummatel && isAbrazadera;
  }, [formData.type, formData.origin, formData.provider, selectedItem]);

  const liveAdjustedPrice = useMemo(() => {
      let p = parseFloat(tempPrice.replace(',', '.')) || 0;
      if (isClampCondition) {
          const b4 = parseFloat(tempBolt4Price.replace(',', '.')) || 0;
          const b3 = parseFloat(tempBolt3Price.replace(',', '.')) || 0;
          p = p - (b4 * 2) - b3;
      }
      return p;
  }, [tempPrice, isClampCondition, tempBolt4Price, tempBolt3Price]);

  // Validaciones del item temporal
  const isIntegerUnit = useMemo(() => {
      if (!selectedItem) return false;
      const unit = (selectedItem.unit || "").toLowerCase();
      return ['unidad', 'kit', 'pieza', 'caja', 'rollo', 'paquete'].includes(unit); 
  }, [selectedItem]);

  const projectedStock = useMemo(() => {
      if (!selectedItem) return 0;
      const qty = parseFloat(tempQty.replace(',', '.')) || 0;
      if (formData.type === 'Entrada' || formData.type === 'Devolución') {
          return selectedItem.stock + qty;
      } else {
          return selectedItem.stock - qty;
      }
  }, [selectedItem, tempQty, formData.type]);

  useEffect(() => {
      if (formData.type === 'Entrada' && formData.origin === 'Proveedor' && selectedItem) {
          const providerConfig = selectedItem.providers?.find(p => (p.name || "").toLowerCase().trim() === (formData.provider || "").toLowerCase().trim());
          if (providerConfig) {
              setTempPrice(providerConfig.price.toString());
          } else if (selectedItem.price !== undefined && selectedItem.price !== null) {
              setTempPrice(selectedItem.price.toString());
          } else {
              setTempPrice('');
          }
      } else {
          setTempPrice('');
      }
  }, [formData.type, formData.origin, formData.provider, selectedItem]);

  const handleAddItem = () => {
      setError(null);
      if (!selectedItem) {
          setError("Seleccione un producto válido.");
          return;
      }
      
      const qty = parseFloat(tempQty.replace(',', '.'));
      if (isNaN(qty) || qty <= 0) {
          setError("La cantidad debe ser mayor a 0.");
          return;
      }

      if (formData.type !== 'Devolución' && isIntegerUnit && !Number.isInteger(qty)) {
          setError(`La unidad '${selectedItem.unit}' no permite decimales.`);
          return;
      }

      // Validar si ya existe en la lista (excepto para pernos que queremos permitir acumular)
      const isBolt = selectedItem.description?.toUpperCase().includes('PERNO') && 
                    (selectedItem.description?.toUpperCase().includes('3"') || selectedItem.description?.toUpperCase().includes('4"'));

      if (!isClampCondition && !isBolt && addedItems.some(i => i.inventoryItemId === selectedItem.id)) {
          setError("Este producto ya está en la lista.");
          return;
      }

      // Validar Stock si es salida
      if (formData.type === 'Salida' && selectedItem.stock < qty) {
          setError(`Stock insuficiente. Disponible: ${selectedItem.stock}`);
          return;
      }

      // Lógica de Precios
      let itemPrice: number | undefined = selectedItem.price;
      
      let bolt4Price = 0;
      let bolt3Price = 0;

      if (formData.type === 'Entrada' && formData.origin === 'Proveedor') {
          if (!formData.provider) {
              setError("Debe seleccionar un proveedor antes de agregar materiales.");
              return;
          }

          const parsedPrice = parseFloat(tempPrice.replace(',', '.'));
          if (isNaN(parsedPrice) || parsedPrice < 0) {
              setError("Ingrese un precio unitario válido.");
              return;
          }
          itemPrice = parsedPrice;

          // Lógica Especial SUMMATEL
          if (isClampCondition) {
              if (!tempBolt4Price || !tempBolt3Price) {
                  setError("Los precios de los pernos son obligatorios.");
                  return;
              }
              bolt4Price = parseFloat(tempBolt4Price.replace(',', '.'));
              bolt3Price = parseFloat(tempBolt3Price.replace(',', '.'));
              
              if (isNaN(bolt4Price) || bolt4Price <= 0 || isNaN(bolt3Price) || bolt3Price <= 0) {
                  setError("Precios de pernos inválidos.");
                  return;
              }

              // precioUnitarioFinal = precioUnitarioOriginal - (precioPerno4 * 2) - (precioPerno3)
              itemPrice = itemPrice - (bolt4Price * 2) - bolt3Price;
          }
      }

      // IVA y Totales (Calculados por unidad para precisión)
      const unitIva = (itemPrice || 0) * 0.13;
      const itemIva = unitIva * qty;
      const itemTotal = ((itemPrice || 0) + unitIva) * qty;

      const itemsToAdd: TempItem[] = [];

      // Función Helper para Upsert
      const upsertItems = (currentList: TempItem[], newItems: TempItem[]) => {
          const updatedList = [...currentList];
          newItems.forEach(newItem => {
              const existingIdx = updatedList.findIndex(i => i.inventoryItemId === newItem.inventoryItemId);
              if (existingIdx > -1) {
                  const existing = updatedList[existingIdx];
                  const totalQty = existing.quantity + newItem.quantity;
                  const uIva = (newItem.unitPrice || 0) * 0.13;
                  updatedList[existingIdx] = {
                      ...existing,
                      quantity: totalQty,
                      unitPrice: newItem.unitPrice,
                      iva: uIva * totalQty,
                      total: ((newItem.unitPrice || 0) + uIva) * totalQty
                  };
              } else {
                  updatedList.push(newItem);
              }
          });
          return updatedList;
      };

      const clampItem: TempItem = {
          id: Date.now().toString(),
          inventoryItemId: selectedItem.id,
          code: selectedItem.code,
          description: selectedItem.description,
          quantity: qty,
          unit: selectedItem.unit,
          stock: selectedItem.stock,
          unitPrice: itemPrice,
          iva: itemIva,
          total: itemTotal,
          currency: tempCurrency,
          notes: tempNotes
      };
      itemsToAdd.push(clampItem);

      if (isClampCondition) {
          // Buscar pernos en inventario
          const findBolt = (size: string) => inventoryItems.find(i => {
              const d = i.description.toUpperCase();
              // Buscamos "PERNO" y que contenga el tamaño seguido de comilla para ser exactos (ej: "4\"")
              // y nos aseguramos que no sea precedido por otro número
              return d.includes("PERNO") && d.includes(size + "\"") && !d.includes("1" + size + "\"") && !d.includes("2" + size + "\"");
          });

          const p4 = findBolt("4");
          const p3 = findBolt("3");

          if (p4) {
              const uIva = bolt4Price * 0.13;
              itemsToAdd.push({
                  id: (Date.now() + 1).toString(),
                  inventoryItemId: p4.id,
                  code: p4.code,
                  description: p4.description,
                  quantity: qty * 2,
                  unit: p4.unit,
                  stock: p4.stock,
                  unitPrice: bolt4Price,
                  iva: uIva * (qty * 2),
                  total: (bolt4Price + uIva) * (qty * 2),
                  currency: tempCurrency
              });
          }
          if (p3) {
              const uIva = bolt3Price * 0.13;
              itemsToAdd.push({
                  id: (Date.now() + 2).toString(),
                  inventoryItemId: p3.id,
                  code: p3.code,
                  description: p3.description,
                  quantity: qty * 1,
                  unit: p3.unit,
                  stock: p3.stock,
                  unitPrice: bolt3Price,
                  iva: uIva * qty,
                  total: (bolt3Price + uIva) * qty,
                  currency: tempCurrency
              });
          }
      }

      setAddedItems(prev => upsertItems(prev, itemsToAdd));
      
      // Limpiar inputs temporales
      setTempItemId('');
      setTempQty('');
      setTempPrice('');
      setTempBolt4Price('');
      setTempBolt3Price('');
      setTempCurrency('CRC');
      setTempNotes('');
      setItemSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validar Items
    if (addedItems.length === 0) {
        setError("Debe agregar al menos un material a la lista.");
        return;
    }

    // 2. Validar Origen del Movimiento
    // Si es Devolución, el origen puede ser inferido o seleccionado, lo dejaremos obligatorio igual que los otros
    if (!formData.origin) {
        setError("Debe seleccionar el Origen del Movimiento.");
        return;
    }

    // Validar Proveedor si el origen es Proveedor
    if (formData.origin === 'Proveedor' && !formData.provider.trim()) {
        setError("Debe ingresar el nombre del Proveedor.");
        return;
    }

    // 3. Validar Proyecto (Regla Condicional Extendida)
    // Si es Salida Y el origen NO es IBUX (CLARO/CLQRO), el proyecto es obligatorio.
    // Para Devolución, el proyecto es OPCIONAL (permite devolución general sin proyecto).
    const isProjectRequired = formData.type === 'Salida' && !isIBUXOrigin;
    if (isProjectRequired && !formData.projectId) {
        setError("Es obligatorio asociar un proyecto para este tipo de movimiento.");
        return;
    }

    // 4. Validar Campos Condicionales de IBUX
    if (isIBUXOrigin) {
        if (!formData.fdh.trim()) {
            setError("Para IBUX, el campo FDH es obligatorio.");
            return;
        }
        if (!formData.torre.trim()) {
            setError("Para IBUX, el campo TORRE es obligatorio.");
            return;
        }
        if (!formData.locationDetails.trim()) {
            setError("Para IBUX, el campo Lugar / Distrito es obligatorio.");
            return;
        }
    }

    setIsSubmitting(true);
    try {
        // Preparar payload y sanitizar
        const sanitizedFormData = sanitizeObject(formData);
        
        const extraFields = {
            fdh: sanitizedFormData.fdh.trim(),
            torre: sanitizedFormData.torre.trim(),
            locationDetails: sanitizedFormData.locationDetails.trim()
        };

        // FIX: Ensure projectCode generation checks if selectedProject exists first
        const projectCodeValue = selectedProject 
          ? `#${selectedProject.id.toString().padStart(3, '0')}-${getYearFromDateString(selectedProject.fecha)}` 
          : null;

        // Registrar nuevo proveedor en catálogo si es necesario
        if (sanitizedFormData.origin === 'Proveedor' && sanitizedFormData.provider && sanitizedFormData.provider.trim() !== '') {
            const provName = sanitizedFormData.provider.trim();
            if (onAddProvider) {
                try {
                    await onAddProvider(provName);
                } catch (pErr) {
                    console.warn("No se pudo registrar el proveedor en catálogo:", pErr);
                }
            }
        }

        try {
            await onSubmit({
                items: addedItems.map(item => {
                    // Intentar obtener precio si no está definido (para Salidas)
                    const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
                    const price = item.unitPrice || (invItem?.price || 0);
                    const iva = (price * item.quantity) * 0.13;
                    const total = (price * item.quantity) * 1.13;

                    return {
                        inventoryItemId: item.inventoryItemId,
                        inventoryItemCode: item.code,
                        inventoryItemName: item.description,
                        quantity: item.quantity,
                        unitPrice: price,
                        iva: item.iva !== undefined ? item.iva : iva,
                        total: item.total !== undefined ? item.total : total,
                        currency: item.currency || 'USD',
                        notes: item.notes || null
                    };
                }),
                type: sanitizedFormData.type,
                date: sanitizedFormData.date,
                projectId: sanitizedFormData.projectId || null,
                projectCode: sanitizedFormData.projectCode || projectCodeValue,
                projectName: sanitizedFormData.projectName || (selectedProject ? selectedProject.empresa.replace(" MANTENIMIENTO", "") : null),
                userId: currentUser.id,
                userName: currentUser.email,
                observations: sanitizedFormData.observations,
                origin: sanitizedFormData.origin ? sanitizedFormData.origin.replace(" MANTENIMIENTO", "") : null,
                provider: sanitizedFormData.origin === 'Proveedor' ? sanitizedFormData.provider : null,
                factura: sanitizedFormData.factura || null,
                linkedRequestId: sanitizedFormData.linkedRequestId || null,
                requestNumber: sanitizedFormData.linkedRequestId 
                    ? requests.find(r => r.id === sanitizedFormData.linkedRequestId)?.requestNumber || null 
                    : null,
                dispatchId: sanitizedFormData.dispatchId || null,
                ...extraFields // Siempre se envían
            });
            onClose();
        } catch (error) {
            console.error("ERROR CONTROLADO EN DEVOLUCIÓN:", error);
            setError(error instanceof Error ? error.message : "Error desconocido");
        }
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!show) return null;

  // Helper para determinar si el proyecto es visualmente requerido
  const isProjectVisuallyRequired = formData.type === 'Salida' && !isIBUXOrigin;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
      <div className="bg-white w-full max-w-lg md:max-w-5xl rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden" noValidate>
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                {initialData ? 'Editar Movimiento' : 'Nuevo Movimiento'}
            </h3>
            <IconButton 
              icon={<FiX />} 
              onClick={onClose} 
              variant="neutral" 
              title="Cerrar"
            />
          </div>
          
          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white" onClick={() => setShowItemSuggestions(false)}>
            
            {/* 1. Selector de Tipo y Fecha */}
            <div className="flex gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl flex-1 gap-1">
                    <button
                        type="button"
                        onClick={() => { setFormData({...formData, type: 'Salida', projectId: '', projectName: '', projectCode: ''}); setAddedItems([]); }}
                        className={`flex-1 py-2 rounded-lg text-[9px] sm:text-xs font-black transition-all ${formData.type === 'Salida' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        disabled={!!initialData} // Deshabilitar cambio de tipo en edición
                    >
                        <FiLogOut className="mr-1"  /> SALIDA
                    </button>
                    <button
                        type="button"
                        onClick={() => { setFormData({...formData, type: 'Entrada', projectId: '', projectName: '', projectCode: ''}); setAddedItems([]); }}
                        className={`flex-1 py-2 rounded-lg text-[9px] sm:text-xs font-black transition-all ${formData.type === 'Entrada' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        disabled={!!initialData}
                    >
                        <FiLogIn className="mr-1"  /> ENTRADA
                    </button>
                    <button
                        type="button"
                        onClick={() => { setFormData({...formData, type: 'Devolución', projectId: '', projectName: '', projectCode: ''}); setAddedItems([]); }}
                        className={`flex-1 py-2 rounded-lg text-[9px] sm:text-xs font-black transition-all ${formData.type === 'Devolución' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        disabled={!!initialData}
                    >
                        <FiRotateCcw className="mr-1"  /> DEVOLUCIÓN
                    </button>
                </div>
                <div className="w-1/4">
                    <input 
                        type="date" 
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full h-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none text-center"
                        required
                    />
                </div>
            </div>

            {/* MENSAJE INFORMATIVO PARA DEVOLUCIÓN */}
            {formData.type === 'Devolución' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <FiInfo className="text-amber-600 text-lg"  />
                    <p className="text-[10px] font-bold text-amber-800 leading-tight">
                        Este material será devuelto al inventario y descontado del consumo del proyecto seleccionado.
                    </p>
                </div>
            )}

            {/* 1.5 Selector de Proyecto de Origen (Solo para Devolución) */}
            {formData.type === 'Devolución' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <Select
                        label="Proyecto de Origen (Opcional)"
                        placeholder="Buscar proyecto..."
                        isSearchable={true}
                        options={[
                            { label: '-- Ninguno (Devolución General) --', value: '' },
                            ...dispatchedProjects.map(p => ({
                                label: p.label,
                                value: p.key
                            }))
                        ]}
                        value={
                            dispatchedProjects.find(p => p.key === formData.projectId || p.projectId === formData.projectId || p.projectName === formData.projectName)?.key 
                            || formData.projectId 
                            || ''
                        }
                        onChange={opt => {
                            const val = typeof opt === 'string' ? opt : opt?.value;
                            if (!val) {
                                setFormData(prev => ({
                                    ...prev,
                                    projectId: '',
                                    projectName: '',
                                    projectCode: '',
                                    linkedRequestId: '',
                                    linkedRequestNumber: '',
                                    dispatchId: ''
                                }));
                                return;
                            }

                            const proj = dispatchedProjects.find(p => p.key === val || p.projectId === val);
                            if (proj) {
                                setFormData(prev => ({
                                    ...prev,
                                    projectId: proj.projectId,
                                    projectName: proj.projectName,
                                    projectCode: proj.projectCode || '',
                                    origin: (proj.origin as any) || prev.origin || 'IBUX-CLARO',
                                    fdh: proj.fdh || prev.fdh || '',
                                    torre: proj.torre || prev.torre || '',
                                    locationDetails: proj.locationDetails || prev.locationDetails || '',
                                    linkedRequestId: '',
                                    linkedRequestNumber: '',
                                    dispatchId: ''
                                }));
                            }
                        }}
                    />
                </div>
            )}

            {/* 2. Origen del Movimiento (REORDENADO - Antes que Proyecto) */}
            <Select
                label="Origen del Movimiento"
                options={[
                    { label: '-- Seleccione Origen --', value: '' },
                    { label: 'IBUX-CLARO', value: 'IBUX-CLARO' },
                    { label: 'CNFL', value: 'CNFL' },
                    { label: 'PRIVADO', value: 'PRIVADO' },
                    ...(formData.type === 'Entrada' ? [{ label: 'Proveedor', value: 'Proveedor' }] : [])
                ]}
                value={formData.origin}
                onChange={val => setFormData({...formData, origin: val as any})}
                error={!formData.origin}
                required
            />

            {/* Campo Factura (Opcional) */}
            <div className="animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    Factura / Documento Ref. <span className="text-slate-300">(Opcional)</span>
                </label>
                <input 
                    type="text"
                    placeholder="Ej: FAC-12345"
                    value={formData.factura}
                    onChange={e => setFormData({...formData, factura: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none font-bold focus:ring-2 focus:ring-blue-100"
                />
            </div>

            {/* Campo Proveedor (Condicional) */}
            {formData.origin === 'Proveedor' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <ProviderCombobox
                        label="Nombre del Proveedor"
                        value={formData.provider}
                        onChange={val => setFormData(prev => ({ ...prev, provider: val }))}
                        options={uniqueProviders}
                        onDeleteOption={onDeleteProvider}
                        error={!formData.provider && error !== null}
                        required
                    />
                </div>
            )}

            {/* 3. Proyecto Asociado (Solo para Salida de Cotizaciones) */}
            {formData.type === 'Salida' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <Select
                        label={`Proyecto Asociado ${isProjectVisuallyRequired ? '' : '(Opcional)'}`}
                        options={[
                            { label: `-- Seleccione Proyecto ${isProjectVisuallyRequired ? '' : '(Opcional)'} --`, value: '' },
                            ...approvedQuotes.map(q => ({
                                label: `#${q.id.toString().padStart(3, '0')}-${getYearFromDateString(q.fecha)} | ${q.empresa}`,
                                value: q.id.toString()
                            }))
                        ]}
                        value={formData.projectId}
                        onChange={val => setFormData({...formData, projectId: val})}
                        disabled={!!formData.linkedRequestId}
                        error={isProjectVisuallyRequired && !formData.projectId}
                        required={isProjectVisuallyRequired}
                    />
                </div>
            )}

            {/* 4. Campos Dinámicos IBUX */}
            {isIBUXOrigin && (
                <div className="grid grid-cols-2 gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <div className="col-span-2">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 border-b border-blue-200 pb-1">
                            Datos Requeridos IBUX
                        </p>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">FDH <span className="text-red-500">*</span></label>
                        <input 
                            type="text"
                            placeholder="Ej: FDH-001"
                            value={formData.fdh}
                            onChange={e => setFormData({...formData, fdh: e.target.value})}
                            className={`w-full p-2.5 rounded-lg bg-white border text-xs outline-none font-bold ${!formData.fdh ? 'border-red-200' : 'border-slate-200'}`}
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">TORRE <span className="text-red-500">*</span></label>
                        <input 
                            type="text"
                            placeholder="Ej: Torre A"
                            value={formData.torre}
                            onChange={e => setFormData({...formData, torre: e.target.value})}
                            className={`w-full p-2.5 rounded-lg bg-white border text-xs outline-none font-bold ${!formData.torre ? 'border-red-200' : 'border-slate-200'}`}
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Lugar / Distrito <span className="text-red-500">*</span></label>
                        <input 
                            type="text"
                            placeholder="Ej: San Pedro / Montes de Oca"
                            value={formData.locationDetails}
                            onChange={e => setFormData({...formData, locationDetails: e.target.value})}
                            className={`w-full p-2.5 rounded-lg bg-white border text-xs outline-none font-bold ${!formData.locationDetails ? 'border-red-200' : 'border-slate-200'}`}
                        />
                    </div>
                </div>
            )}

            {/* 5. Zona de Carga de Materiales */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FiPlusCircle  /> Agregar Materiales
                </p>
                
                {/* Buscador */}
                <div className="relative mb-2" onClick={e => e.stopPropagation()}>
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
                        placeholder="Buscar material por código, descripción o categoría..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    {showItemSuggestions && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 z-50 max-h-56 overflow-y-auto custom-scrollbar">
                            {filteredItems.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 font-medium">
                                    No se encontraron materiales que coincidan con &quot;{itemSearch}&quot;
                                </div>
                            ) : (
                                filteredItems.map(item => (
                                    <div 
                                        key={item.id}
                                        onClick={() => {
                                            setTempItemId(item.id);
                                            setItemSearch(`${item.code} - ${item.description}`);
                                            setShowItemSuggestions(false);
                                        }}
                                        className="p-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <p className="text-[10px] font-black text-slate-700">{item.code}</p>
                                            <span className={`text-[9px] font-bold ${item.stock > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                                Stock: {item.stock} {item.unit}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 line-clamp-1">{item.description}</p>
                                        {item.category && (
                                            <span className="text-[8.5px] text-blue-600 font-semibold uppercase">{item.category}</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Cantidad</label>
                        <div className="relative">
                            <input 
                                type="text"
                                value={tempQty}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                                    setTempQty(val);
                                }}
                                className="w-full pl-3 pr-8 py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold outline-none"
                                placeholder="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 uppercase">{selectedItem?.unit}</span>
                        </div>
                    </div>

                    {/* Campo Comentarios / Notas (Solo Devolución) */}
                    {formData.type === 'Devolución' && (
                        <div className="flex-[2] min-w-[150px]">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Comentarios / Notas</label>
                            <input 
                                type="text"
                                value={tempNotes}
                                onChange={e => setTempNotes(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-bold outline-none text-slate-700 focus:ring-2 focus:ring-blue-100"
                                placeholder="Ej: Material sobrante, buen estado..."
                            />
                        </div>
                    )}

                    {/* Campos de Costo (Solo Entrada Proveedor) */}
                    {formData.type === 'Entrada' && formData.origin === 'Proveedor' && (
                        <>
                            <div className="w-16">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Moneda</label>
                                <select 
                                    value={tempCurrency}
                                    onChange={e => setTempCurrency(e.target.value as 'USD' | 'CRC')}
                                    className="w-full px-2 py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-600 outline-none"
                                >
                                    <option value="CRC">CRC</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>

                            <div className="w-24">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Precio U.</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">{tempCurrency === 'USD' ? '$' : '₡'}</span>
                                    <input 
                                        type="text"
                                        value={tempPrice}
                                        onChange={e => {
                                            // Allow number, dot, comma
                                            const val = e.target.value.replace(/[^0-9.,]/g, '');
                                            setTempPrice(val)
                                        }}
                                        className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-600 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {isClampCondition && (
                                <>
                                    <div className="w-20">
                                        <label className="text-[9px] font-bold text-blue-500 uppercase">Perno 4&quot;</label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 text-[10px] font-bold">{tempCurrency === 'USD' ? '$' : '₡'}</span>
                                            <input 
                                                type="text"
                                                value={tempBolt4Price}
                                                onChange={e => setTempBolt4Price(e.target.value.replace(/[^0-9.,]/g, ''))}
                                                className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-black text-blue-600 outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[9px] font-bold text-blue-500 uppercase">Perno 3&quot;</label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 text-[10px] font-bold">{tempCurrency === 'USD' ? '$' : '₡'}</span>
                                            <input 
                                                type="text"
                                                value={tempBolt3Price}
                                                onChange={e => setTempBolt3Price(e.target.value.replace(/[^0-9.,]/g, ''))}
                                                className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-black text-blue-600 outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="w-20">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">IVA (U.)</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">{tempCurrency === 'USD' ? '$' : '₡'}</span>
                                    <input 
                                        type="text"
                                        value={tempPrice ? (liveAdjustedPrice * 0.13).toFixed(2) : '-'}
                                        readOnly
                                        className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-black text-slate-500 outline-none cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            <div className="w-24">
                                <label className="text-[9px] font-bold text-emerald-500 uppercase">Total (U.)</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-500 text-[10px] font-bold">{tempCurrency === 'USD' ? '$' : '₡'}</span>
                                    <input 
                                        type="text"
                                        value={tempPrice ? (liveAdjustedPrice * 1.13).toFixed(2) : '-'}
                                        readOnly
                                        className="w-full pl-5 pr-2 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-600 outline-none cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Indicador Stock (Solo visual) */}
                    {selectedItem && (
                        <div className="bg-white border border-slate-200 px-3 py-1 rounded-lg h-[38px] flex flex-col justify-center min-w-[70px]">
                            <span className="text-[8px] text-slate-400 font-bold uppercase">Stock</span>
                            <span className={`text-[10px] font-black ${projectedStock < 0 ? 'text-red-500' : 'text-slate-700'}`}>{`${selectedItem.stock} → ${projectedStock}`}</span>
                        </div>
                    )}
                    <ActionButton 
                        onClick={handleAddItem}
                        disabled={!selectedItem || !tempQty}
                        label="AGREGAR"
                        variant="primary"
                    />
                </div>
            </div>

            {/* 6. Lista de Items */}
            <div className="border border-slate-100 rounded-xl">
                <DataTable<TempItem>
                    data={addedItems}
                    columns={itemColumns}
                    keyExtractor={(item) => item.id}
                    emptyMessage="No hay materiales en la lista."
                />
                
                {addedItems.length > 0 && formData.type === 'Entrada' && formData.origin === 'Proveedor' && (
                    <div className="bg-slate-50/50 p-4 border-t border-slate-100 rounded-b-xl flex justify-end gap-12">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</span>
                            <span className="text-sm font-black text-slate-700">
                                {formatCurrency(addedItems.reduce((acc, i) => acc + ((i.unitPrice || 0) * i.quantity), 0), addedItems[0].currency || 'USD')}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">IVA</span>
                            <span className="text-sm font-black text-slate-500">
                                {formatCurrency(addedItems.reduce((acc, i) => acc + (i.iva || 0), 0), addedItems[0].currency || 'USD')}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Gran Total</span>
                            <span className="text-lg font-black text-emerald-600">
                                {formatCurrency(addedItems.reduce((acc, i) => acc + (i.total || 0), 0), addedItems[0].currency || 'USD')}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Observaciones Generales</label>
                <textarea 
                    value={formData.observations}
                    onChange={e => setFormData({...formData, observations: e.target.value})}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Detalles adicionales del movimiento..."
                ></textarea>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 text-center animate-pulse">
                    <FiAlertCircle className="mr-1"  /> {error}
                </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 flex-none">
            <ActionButton 
              type="button" 
              onClick={onClose} 
              label="Cancelar" 
              variant="secondary" 
              className="flex-1"
            />
            <ActionButton 
              type="submit" 
              disabled={isSubmitting || addedItems.length === 0}
              isLoading={isSubmitting}
              label="CONFIRMAR"
              variant={formData.type === 'Entrada' ? 'success' : formData.type === 'Devolución' ? 'warning' : 'danger'}
              className="flex-1"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};