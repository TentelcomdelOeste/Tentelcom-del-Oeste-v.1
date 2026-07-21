import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Quote, QuoteItem, Client, Product, User } from '../utils/types';
import { useClients } from '../hooks/useClients';
import { useCatalog } from '../hooks/useCatalog';
import { useAllQuotes } from '../hooks/useQuotes';
import { generateQuotePDF } from '../utils/pdfGenerator';
import { triggerFileDownload } from '../utils/fileUtils';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { useConfirm, ActionButton, IconButton, StatusBadge, ConfirmModal, ConflictModal, DataTable, TableColumn } from '../design-system';
import { FiCheck, FiTrash2, FiAlertTriangle, FiFileText, FiSearch, FiX, FiBookOpen, FiPlus, FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi";
import { getNextQuoteIdPreview, guardarCotizacionSeguro } from '../services/quoteService';
import { useOfflineMutation } from '../hooks/useOfflineMutation';

import { useAuditPermanence } from '../hooks/useAuditPermanence';

interface QuoteModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  quote?: Quote | null;
  currentUser: User;
}

interface DescriptionCellProps {
    item: QuoteItem;
    updateItem: (id: string, field: keyof QuoteItem, value: any) => void;
    catalogMap: { byCode: Map<string, Product>, byName: Map<string, Product> };
}

const DescriptionCell = React.memo(({ item, updateItem, catalogMap }: DescriptionCellProps) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Ajuste de altura inicial y al cambiar contenido
    React.useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [item.descripcion]);

    // Ajuste de altura al redimensionar la ventana/columna (Layout Thrashing Fix)
    React.useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;

        const observer = new ResizeObserver(() => {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const descMatch = React.useMemo(() => 
        item.descripcion ? catalogMap.byName.get((item.descripcion ?? '').trim().toLowerCase()) : null
    , [item.descripcion, catalogMap]);

    const codeMatch = React.useMemo(() => 
        item.codigo ? catalogMap.byCode.get((item.codigo ?? '').trim().toUpperCase()) : null
    , [item.codigo, catalogMap]);

    const exactMatch = codeMatch && descMatch && codeMatch.id === descMatch.id;

    return (
        <div className="relative w-full">
            <textarea
                ref={textareaRef}
                value={item.descripcion ?? ''}
                onChange={e => updateItem(item.id, 'descripcion', e.target.value)}
                className={`w-full p-2 bg-transparent border-b outline-none text-xs font-bold resize-none overflow-hidden block transition-colors leading-normal break-words whitespace-normal ${descMatch ? 'border-amber-300 text-amber-800' : 'border-transparent focus:border-blue-300 text-blue-900'}`}
                rows={1}
                placeholder="Descripción del item..."
                style={{ minHeight: '32px', height: '32px' }}
            />
            {descMatch && !exactMatch && (
                <div className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-100 inline-block mt-1 self-start">
                    Descripción ya existe en catálogo
                </div>
            )}
        </div>
    );
});

DescriptionCell.displayName = 'DescriptionCell';

const CodeCell = React.memo(({ item, updateItem, catalogMap }: DescriptionCellProps) => {
    const codeMatch = React.useMemo(() => 
        item.codigo ? catalogMap.byCode.get((item.codigo ?? '').trim().toUpperCase()) : null
    , [item.codigo, catalogMap]);

    const descMatch = React.useMemo(() => 
        item.descripcion ? catalogMap.byName.get((item.descripcion ?? '').trim().toLowerCase()) : null
    , [item.descripcion, catalogMap]);

    const exactMatch = codeMatch && descMatch && codeMatch.id === descMatch.id;

    return (
        <div className="relative">
            <input 
                type="text" 
                value={item.codigo ?? ''} 
                onChange={e => updateItem(item.id, 'codigo', e.target.value)} 
                className={`w-full p-2 bg-transparent border-b outline-none text-xs font-bold font-mono placeholder:text-red-300 transition-colors ${codeMatch ? 'border-amber-300 text-amber-700' : 'border-transparent focus:border-blue-300 text-slate-600'}`} 
                placeholder="REQ*" 
            />
            {codeMatch && !exactMatch && (
                <div className="absolute top-full left-0 text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-100 whitespace-nowrap z-10">
                    Código existente
                </div>
            )}
            {exactMatch && (
                <FiCheck className="absolute right-1 top-1/2 -translate-y-1/2 text-emerald-500 text-[10px]" title="Coincidencia exacta con catálogo" />
            )}
        </div>
    );
});

CodeCell.displayName = 'CodeCell';

export const QuoteModal: React.FC<QuoteModalProps> = ({ show, onClose, onSave, onDelete, quote, currentUser }) => {
  useAuditPermanence({
    module: 'Cotizaciones',
    submodule: quote ? 'Editar Cotización' : 'Nueva Cotización',
    recordId: quote?.id,
    recordCode: quote?.codigo,
    enabled: show
  });
  useLockBodyScroll(show);
  const confirm = useConfirm();
  const { mutate: mutateQuote } = useOfflineMutation();

  const { 
    savedClients, 
    addClient, 
    deactivateClient, 
    updateClient,
    getNextClientCodePreview,
    loadMore: loadMoreClients,
    hasMore: hasMoreClients,
    loadingMore: loadingMoreClients
  } = useClients(currentUser);
  // Se pasa currentUser al hook actualizado
  const { 
    catalog, 
    addProduct, 
    deactivateProduct,
    loadMore: loadMoreCatalog,
    hasMore: hasMoreCatalog,
    loadingMore: loadingMoreCatalog
  } = useCatalog(currentUser); 
  
  // Obtener TODAS las cotizaciones para validación global y numeración
  const { allQuotes, loading: loadingAllQuotes } = useAllQuotes(currentUser);
  
  // Estado del Formulario
  const [clientData, setClientData] = useState({
    empresa: '',
    contacto: '',
    telefono: '',
    correo: '',
    codigoCliente: ''
  });
  const [originalClientData, setOriginalClientData] = useState<any>(null);
  const [isClientModified, setIsClientModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [metaData, setMetaData] = useState({
    fecha: new Date().toLocaleDateString('es-GB'), // Initial date in DD/MM/YYYY
    moneda: 'USD' as 'USD' | 'CRC',
    descuento: 0,
    formaPago: 'Contado',
    vigencia: '15 días',
    notas: 'Precios sujetos a cambios sin previo aviso. Tiempo de entrega a convenir.'
  });

  // Estado para control fiscal (IVA)
  const [applyTax, setApplyTax] = useState(true);

  // Estado para el ID personalizado
  const [customId, setCustomId] = useState('');
  // Optimización: Cálculo determinista durante render para evitar flicker y desaparición de frames
  const lastQuoteNumber = React.useMemo(() => {
    if (loadingAllQuotes && (!allQuotes || allQuotes.length === 0)) return null;
    const safeQuotes = allQuotes || [];
    const numericIds = safeQuotes
      .map(q => parseInt(q.id.toString()))
      .filter(id => !isNaN(id));
    return numericIds.length > 0 ? Math.max(...numericIds) : 0;
  }, [allQuotes, loadingAllQuotes]);

  const [idError, setIdError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateQuoteInfo, setDuplicateQuoteInfo] = useState<string | null>(null);
  
  // Estado para conflicto de catálogo (Nuevo requerimiento)
  const [catalogConflict, setCatalogConflict] = useState<{
      show: boolean;
      item: QuoteItem;
      existingProduct: Product;
  } | null>(null);
  const [conflictResolver, setConflictResolver] = useState<((decision: 'use' | 'change' | 'cancel') => void) | null>(null);

  // Optimización: Mapa de catálogo para búsqueda O(1)
  const catalogMap = React.useMemo(() => {
      const byCode = new Map<string, Product>();
      const byName = new Map<string, Product>();
      
      const safeCatalog = Array.isArray(catalog) ? catalog : [];
      
      for (const p of safeCatalog) {
          if (!p || p.isActive === false) continue;
          
          if (p.codigo) {
              const codeKey = p.codigo.trim().toUpperCase();
              if (!byCode.has(codeKey)) {
                  byCode.set(codeKey, p);
              }
          }
          
          if (p.nombre) {
              const nameKey = p.nombre.trim().toLowerCase();
              if (!byName.has(nameKey)) {
                  byName.set(nameKey, p);
              }
          }
      }
      
      return { byCode, byName };
  }, [catalog]);

  // Estado para validación visual de cliente (Nuevo requerimiento)
  const [clientStatus, setClientStatus] = useState<{
      status: 'new' | 'update' | 'match' | 'idle';
      message: string;
      existingId?: string;
  }>({ status: 'idle', message: '' });

  // Estados de Modales Internos
  const [showClientModal, setShowClientModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Estado para creación de productos en el modal
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
      codigo: '',
      nombre: '',
      precioBase: ''
  });
  const [duplicateProductError, setDuplicateProductError] = useState<string | null>(null);

  // Estado para confirmación de eliminación en directorios
  const [itemToDelete, setItemToDelete] = useState<{ type: 'client' | 'product', id: string, name: string } | null>(null);

  // Helper para año: Asegura devolver siempre número
  const getYear = (dateStr?: string): number => {
      if (dateStr) {
          if (dateStr.includes('/')) return parseInt(dateStr.split('/')[2]);
          return new Date(dateStr).getFullYear();
      }
      return new Date().getFullYear();
  };

  // Carga de datos al abrir
  useEffect(() => {
    if (show) {
      setIdError(false);
      setFormError(null);
      setCatalogConflict(null); // Resetear conflicto al abrir
      setClientStatus({ status: 'idle', message: '' });
      setIsClientModified(false);
      if (quote) {
        const data = {
          empresa: quote.empresa ?? '',
          contacto: quote.contacto ?? '',
          telefono: quote.telefono ?? '',
          correo: quote.correo ?? '',
          codigoCliente: quote.codigoCliente || ''
        };
        setClientData(data);
        setOriginalClientData(data);
        // IMPORTANTE: Al cargar partidas existentes, marcarlas como NO nuevas y NO editadas
        // Esto evita que se validen contra el catálogo innecesariamente al guardar sin cambios.
        setItems((quote.items || []).map(i => ({ 
            ...i, 
            codigo: i.codigo ?? '',
            descripcion: i.descripcion ?? '',
            isNewLine: false, 
            isEdited: false 
        })));
        setMetaData({
          fecha: quote.fecha ?? new Date().toLocaleDateString('es-GB'),
          moneda: quote.moneda ?? 'USD',
          descuento: quote.descuento || 0,
          formaPago: quote.formaPago ?? '',
          vigencia: quote.vigencia ?? '15 días',
          notas: quote.observaciones ?? 'Precios sujetos a cambios sin previo aviso. Tiempo de entrega a convenir.'
        });
        // Carga estado de IVA, default true si no existe
        setApplyTax(quote.applyTax ?? true);
        setCustomId(quote.id.toString().padStart(3, '0'));
      } else {
        // Reset para nueva cotización
        (async () => {
          const nextClientCode = await getNextClientCodePreview();
          setClientData({ empresa: '', contacto: '', telefono: '', correo: '', codigoCliente: nextClientCode });
        })();
        setItems([]); 
        setMetaData({ 
            fecha: new Date().toLocaleDateString('es-GB'),
            moneda: 'USD', 
            descuento: 0, 
            formaPago: 'Contado', 
            vigencia: '15 días',
            notas: 'Precios sujetos a cambios sin previo aviso. Tiempo de entrega a convenir.'
        });
        setApplyTax(true);
      }
    }
  }, [show, quote, getNextClientCodePreview]);

  // Cálculo de ID sugerido (Solo para nuevas cotizaciones y solo si el campo está vacío para evitar sobrescribir)
  useEffect(() => {
    if (show && !quote && lastQuoteNumber !== null && customId === '') {
        setCustomId((lastQuoteNumber + 1).toString().padStart(3, '0'));
    }
  }, [show, quote, lastQuoteNumber, customId]);

  // Validación de modificación de cliente
  useEffect(() => {
    if (originalClientData) {
        const isModified = 
            clientData.empresa !== originalClientData.empresa ||
            clientData.contacto !== originalClientData.contacto ||
            clientData.telefono !== originalClientData.telefono ||
            clientData.correo !== originalClientData.correo;
        setIsClientModified(isModified);
        // NO borrar código si ya fue asignado (según requerimiento)
        // Solo marcamos como modificado para que handleSave sepa que debe validar/generar si es necesario
    }
  }, [clientData, originalClientData]);

  // --- VALIDACIÓN DE CLIENTE EN TIEMPO REAL (LÓGICA MEJORADA) ---
  useEffect(() => {
      if (!clientData.empresa.trim()) {
          setClientStatus({ status: 'idle', message: '' });
          return;
      }

      const empresaInput = clientData.empresa.trim().toLowerCase();
      const contactoInput = clientData.contacto.trim().toLowerCase();
      const telefonoInput = clientData.telefono.trim().toLowerCase();
      const correoInput = clientData.correo.trim().toLowerCase();

      // 1. Buscar todas las coincidencias de empresa
      const safeClients = Array.isArray(savedClients) ? savedClients : [];
      const companyMatches = safeClients.filter(c => 
          c && c.isActive !== false && c.empresa.trim().toLowerCase() === empresaInput
      );

      if (companyMatches.length > 0) {
          // 2. Verificar si el contacto ESPECÍFICO ya existe para esa empresa
          const exactMatch = companyMatches.find(c => c.contacto.trim().toLowerCase() === contactoInput);
          
          if (exactMatch) {
              // Caso 3: Empresa y contacto existen, verificar si teléfono o email son nuevos
              const phoneNew = (exactMatch.telefono ?? '').trim().toLowerCase() !== telefonoInput;
              const emailNew = (exactMatch.correo ?? '').trim().toLowerCase() !== correoInput;

              if (phoneNew || emailNew) {
                  setClientStatus({
                      status: 'update',
                      message: 'La empresa y el contacto ya existen, se agregarán nuevos datos de contacto.',
                      existingId: exactMatch.id
                  });
              } else {
                  setClientStatus({
                      status: 'match',
                      message: 'Cliente existente: Registro completo encontrado en directorio.',
                      existingId: exactMatch.id
                  });
              }
          } else {
              // Caso 2: La empresa existe, pero el contacto es nuevo
              setClientStatus({
                  status: 'new', 
                  message: 'La empresa ya existe, se creará un nuevo contacto asociado.',
              });
          }
      } else {
          // Caso 1: Cliente completamente nuevo
          setClientStatus({
              status: 'new',
              message: 'Cliente completamente nuevo: Se creará automáticamente al guardar.',
          });
      }

  }, [clientData.empresa, clientData.contacto, clientData.telefono, clientData.correo, savedClients]);


  // Validación de Duplicados de Producto en Tiempo Real
  useEffect(() => {
      if (isCreatingProduct) {
          const safeCatalog = Array.isArray(catalog) ? catalog : [];
          // Fix: Check isActive !== false para compatibilidad
          const codeExists = safeCatalog.some(p => p && p.isActive !== false && p.codigo.trim().toUpperCase() === newProductForm.codigo.trim().toUpperCase());
          const nameExists = safeCatalog.some(p => p && p.isActive !== false && p.nombre.trim().toLowerCase() === newProductForm.nombre.trim().toLowerCase());

          if (codeExists) {
              setDuplicateProductError(`El código "${newProductForm.codigo}" ya existe en el catálogo.`);
          } else if (nameExists) {
              setDuplicateProductError(`El producto/servicio "${newProductForm.nombre}" ya existe.`);
          } else {
              setDuplicateProductError(null);
          }
      } else {
          setDuplicateProductError(null);
      }
  }, [newProductForm, catalog, isCreatingProduct]);


  // Validación de Duplicados en Tiempo Real (Cotizaciones - GLOBAL)
  useEffect(() => {
      const safeQuotes = Array.isArray(allQuotes) ? allQuotes : [];
      if (customId && safeQuotes.length > 0) {
          const parsedInput = parseInt(customId);
          
          if (isNaN(parsedInput)) {
              setIdError(false);
              setDuplicateQuoteInfo(null);
              return;
          }

          const duplicate = safeQuotes.find(q => {
              if (!q) return false;
              // Si estamos editando, ignorar la cotización actual
              if (quote?.docId && q.docId === quote.docId) return false;
              // Ignorar eliminadas
              if (q.isDeleted) return false;
              
              const isUuid = q.id.toString().includes('-') || /[a-zA-Z]/.test(q.id.toString());
              if (isUuid) {
                  return q.id.toString() === customId;
              }
              
              const qIdParsed = parseInt(q.id.toString());
              const match = !isNaN(qIdParsed) && qIdParsed === parsedInput;
              
              return match;
          });
          
          if (duplicate) {
              console.log("Duplicate quote:", duplicate);
              setIdError(true);
              const dYear = duplicate.year || getYear(duplicate.fecha);
              setDuplicateQuoteInfo(`Ya existe en el año ${dYear} (${duplicate.fecha})`);
          } else {
              setIdError(false);
              setDuplicateQuoteInfo(null);
          }
      } else {
          setIdError(false);
          setDuplicateQuoteInfo(null);
      }
  }, [customId, allQuotes, quote, show]);

  // Cálculos Financieros (Centralizados)
  const subtotal = (Array.isArray(items) ? items : []).reduce((acc, item) => acc + (item?.total || 0), 0);
  const discountAmount = subtotal * (metaData.descuento / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  // Lógica condicional de IVA: Si applyTax es false, el IVA es 0.
  const iva = applyTax ? subtotalAfterDiscount * 0.13 : 0;
  const total = subtotalAfterDiscount + iva;

  // Manejadores de Items - CORREGIDOS CON FUNCTIONAL UPDATES Y SOPORTE PARTIDAS LIBRES
  const handleAddItem = React.useCallback(() => {
    setItems(prevItems => [
        ...prevItems, 
        { 
            id: Date.now().toString(), 
            codigo: '', 
            descripcion: '', 
            cantidad: 1, 
            precioUnitario: 0, 
            total: 0,
            source: 'manual',
            isCustom: true,
            productId: null,
            isNewLine: true, // Marcamos como nueva para que se valide al guardar
            isEdited: false
        }
    ]);
  }, []);

  const handleRemoveItem = React.useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    const confirmed = await confirm({
        title: "¿Eliminar partida?",
        description: `¿Está seguro de eliminar la partida "${item?.descripcion || item?.codigo || 'seleccionada'}"?`,
        confirmLabel: "Eliminar",
        variant: "danger"
    });
    
    if (confirmed) {
        setItems(prevItems => prevItems.filter(i => i.id !== id));
    }
  }, [items, confirm]);

  const updateItem = React.useCallback((id: string, field: keyof QuoteItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // Recalcular total si cambia cantidad o precio
        if (field === 'cantidad' || field === 'precioUnitario') {
          const qty = field === 'cantidad' ? Number(value) : Number(item.cantidad);
          const price = field === 'precioUnitario' ? Number(value) : Number(item.precioUnitario);
          updated.total = (isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price);
        }

        // Si se edita código o descripción, marcar para validación
        if (field === 'codigo' || field === 'descripcion') {
            updated.isEdited = true;
        }

        return updated;
      }
      return item;
    }));
  }, []);

  const handleClientSelect = (client: Client) => {
    const data = {
      empresa: client.empresa,
      contacto: client.contacto,
      telefono: client.telefono,
      correo: client.correo,
      codigoCliente: client.codigoCliente || ''
    };
    setClientData(data);
    setOriginalClientData(data);
    setIsClientModified(false);
    setShowClientModal(false);
  };

  const handleDeleteClient = (e: React.MouseEvent, client: Client) => {
      e.stopPropagation();
      setItemToDelete({ type: 'client', id: client.id, name: client.empresa });
  };

  const handleDeleteProduct = (e: React.MouseEvent, product: Product) => {
      e.stopPropagation();
      setItemToDelete({ type: 'product', id: product.id, name: product.nombre });
  };

  const confirmItemDelete = async () => {
      if (!itemToDelete) return;
      
      try {
          if (itemToDelete.type === 'client') {
              await deactivateClient(itemToDelete.id);
          } else {
              await deactivateProduct(itemToDelete.id);
          }
          setItemToDelete(null);
      } catch (err: any) {
          console.error("Error al eliminar:", err);
          await confirm({
              title: "Error",
              description: "Error al eliminar: " + err.message,
              confirmLabel: "Entendido",
              variant: "danger"
          });
      }
  };

  const handleCatalogSelect = (product: Product) => {
    setItems(prevItems => [...prevItems, {
      id: Date.now().toString(),
      codigo: product.codigo,
      descripcion: product.nombre,
      cantidad: 1,
      precioUnitario: product.precioBase,
      total: product.precioBase,
      source: 'catalog',
      isCustom: false,
      productId: product.id,
      isNewLine: true // Técnicamente es nueva en la cotización, pero al tener productId se omite en la validación de duplicados
    }]);
    setShowCatalogModal(false);
  };

  const handleCreateProduct = async () => {
      if (!newProductForm.codigo || !newProductForm.nombre || !newProductForm.precioBase) {
          await confirm({
              title: "Campos Incompletos",
              description: "Todos los campos son obligatorios para registrar un producto.",
              confirmLabel: "Entendido",
              variant: "warning"
          });
          return;
      }

      if (duplicateProductError) {
          await confirm({
              title: "Producto Duplicado",
              description: "No se puede guardar: El producto o código ya existe.",
              confirmLabel: "Entendido",
              variant: "warning"
          });
          return;
      }

      // Creamos el objeto
      const newProduct: Product = {
          id: Date.now().toString(),
          codigo: newProductForm.codigo.toUpperCase(),
          nombre: newProductForm.nombre,
          precioBase: parseFloat(newProductForm.precioBase),
          isActive: true,
          moneda: metaData.moneda // Guardar con la moneda de la cotización actual
      };

      addProduct(newProduct);
      handleCatalogSelect(newProduct); // Agregar a la cotización usando la versión funcional
      
      // Reset
      setIsCreatingProduct(false);
      setNewProductForm({ codigo: '', nombre: '', precioBase: '' });
  };

  const handleSave = async () => {
    if (isSaving) {
        console.warn("[QUOTE_SAVE_BLOCKED] Intento de guardado concurrente detectado en QuoteModal.");
        return;
    }
    console.log("[QUOTE_SAVE_START] Iniciando proceso de guardado de cotización.");
    setIsSaving(true);
    try {
        setFormError(null);
        
        // 1. Validaciones de UI (que requieren interacción o feedback inmediato)
        if (!clientData.empresa.trim()) {
            setFormError("EL NOMBRE DE LA EMPRESA ES OBLIGATORIO.");
            return;
        }

        if (items.length === 0) {
            const approved = await confirm({
                title: "Cotización Vacía",
                description: "La cotización no tiene items. ¿Desea guardarla así?",
                confirmLabel: "Guardar",
                variant: "warning"
            });
            if (!approved) return;
        } else {
            const missingCode = items.some(i => !i.codigo || !i.codigo.trim());
            if (missingCode) {
                setFormError("ERROR: TODAS LAS PARTIDAS DEBEN TENER UN CÓDIGO.");
                return;
            }

            const codes = items.map(i => i.codigo.trim().toLowerCase());
            const uniqueCodes = new Set(codes);
            if (codes.length !== uniqueCodes.size) {
                setFormError("ERROR: CÓDIGOS DE SERVICIO DUPLICADOS EN LAS PARTIDAS.");
                return;
            }
        }

        // 2. Gestión de Conflictos de Catálogo (Requiere UI)
        const itemsToUpdate = [...items];
        for (let i = 0; i < itemsToUpdate.length; i++) {
            const item = itemsToUpdate[i];
            const isManual = (item.source === 'manual' || item.isCustom === true || !item.productId) && 
                             (item.codigo ?? '').trim() && (item.descripcion ?? '').trim() && (item.isNewLine || item.isEdited);
            
            if (isManual) {
                const codeMatch = catalogMap.byCode.get((item.codigo ?? '').trim().toUpperCase());
                if (codeMatch) {
                    const decision = await new Promise<'use' | 'change' | 'cancel'>((resolve) => {
                        setConflictResolver(() => resolve);
                        setCatalogConflict({ show: true, item, existingProduct: codeMatch });
                    });

                    if (decision === 'use') {
                        itemsToUpdate[i] = { ...item, productId: codeMatch.id, isCustom: false, source: 'catalog' };
                    } else if (decision === 'change') {
                        setFormError("Por favor, cambie el código del producto y guarde de nuevo.");
                        return;
                    } else {
                        return;
                    }
                }
            }
        }

        // 3. Gestión de Contactos de Cliente (Requiere UI)
        const exactClientMatch = savedClients.find(c => 
            c.isActive !== false && 
            c.empresa.trim().toLowerCase() === clientData.empresa.trim().toLowerCase() &&
            c.contacto.trim().toLowerCase() === clientData.contacto.trim().toLowerCase()
        );

        if (!exactClientMatch) {
            const companyExists = savedClients.some(c => 
                c.isActive !== false && 
                c.empresa.trim().toLowerCase() === clientData.empresa.trim().toLowerCase()
            );

            if (companyExists) {
                const proceed = await confirm({
                    title: "Nuevo Contacto",
                    description: "La empresa ya existe, se creará un nuevo contacto asociado. ¿Desea continuar?",
                    confirmLabel: "Continuar",
                    variant: "info"
                });
                if (!proceed) return;
            }
        } else {
            const phoneNew = (exactClientMatch.telefono ?? '').trim().toLowerCase() !== clientData.telefono.trim().toLowerCase();
            const emailNew = (exactClientMatch.correo ?? '').trim().toLowerCase() !== clientData.correo.trim().toLowerCase();

            if (phoneNew || emailNew) {
                const proceed = await confirm({
                    title: "Actualizar Datos de Contacto",
                    description: "La empresa y el contacto ya existen, se agregarán nuevos datos de contacto. ¿Desea continuar?",
                    confirmLabel: "Continuar",
                    variant: "info"
                });
                if (!proceed) return;
            }
        }

        // 4. Delegar el guardado pesado al servicio centralizado de forma segura y bloqueante
        try {
            const savedQuoteResult = await guardarCotizacionSeguro({
                quote: { ...quote as any, fecha: metaData.fecha },
                originalId: quote?.id,
                originalDate: quote?.fecha,
                clientData,
                items: itemsToUpdate,
                metaData,
                applyTax,
                total,
                isNewClient: !exactClientMatch,
                isClientModified,
                savedClients,
                catalogMap,
                currentUser,
                addClient,
                updateClient,
                addProduct,
                newId: customId
            });

            if (onSave) onSave(savedQuoteResult);
            console.log("[QUOTE_SAVE_FINISHED] Cotización guardada con éxito.");
            onClose();

        } catch (e: any) {
            console.error("❌ [QuoteModal] Error al guardar cotización:", e);
            setFormError(e.message || "Error al guardar el proyecto");
        } finally {
            setIsSaving(false);
        }

    } catch (error) {
        console.error("❌ [QuoteModal] UNHANDLED ERROR in handleSave:", error);
        setFormError("Ocurrió un error inesperado al procesar la solicitud.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = () => {
      if (quote && onDelete) {
          onDelete(quote);
      }
  };

  const handleGenerateDraft = async () => {
      const draftId = customId ? (parseInt(customId) || customId) : (quote?.id || 0);
      const draftQuote: any = {
          id: draftId,
          fecha: new Date().toLocaleDateString(),
          ...clientData,
          items,
          moneda: metaData.moneda,
          descuento: metaData.descuento,
          formaPago: metaData.formaPago,
          vigencia: metaData.vigencia,
          observaciones: metaData.notas,
          applyTax: applyTax, // Incluir en borrador para que PDF lo lea
          montoLetras: 'BORRADOR - SIN VALOR COMERCIAL'
      };
      const { fileBlob, fileName } = await generateQuotePDF(draftQuote);
      triggerFileDownload(fileBlob, fileName);
  };

  const columns = React.useMemo<TableColumn<QuoteItem>[]>(() => [
    {
        header: "Código",
        width: "120px",
        mobileGrid: "full",
        mobileOrder: 1,
        render: (item) => (
            <CodeCell item={item} updateItem={updateItem} catalogMap={catalogMap} />
        )
    },
    {
        header: "Descripción",
        mobileGrid: "full",
        mobileOrder: 2,
        render: (item) => (
            <DescriptionCell item={item} updateItem={updateItem} catalogMap={catalogMap} />
        )
    },
    {
        header: "Cant.",
        width: "80px",
        align: "center",
        mobileGrid: "left",
        mobileOrder: 3,
        render: (item) => (
            <input 
                type="number" 
                min="1" 
                value={isNaN(item.cantidad) ? '' : item.cantidad} 
                onChange={e => updateItem(item.id, 'cantidad', parseFloat(e.target.value))} 
                className="w-full p-2 bg-transparent border-b border-transparent focus:border-blue-300 outline-none text-xs font-bold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
            />
        )
    },
    {
        header: "Precio",
        width: "115px",
        align: "right",
        mobileGrid: "right",
        mobileOrder: 4,
        render: (item) => (
            <input 
                type="number" 
                min="0" 
                step="0.01" 
                value={isNaN(item.precioUnitario) ? '' : item.precioUnitario} 
                onChange={e => updateItem(item.id, 'precioUnitario', parseFloat(e.target.value))} 
                className="w-full p-2 bg-transparent border-b border-transparent focus:border-blue-300 outline-none text-xs font-bold text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
            />
        )
    },
    {
        header: "Total",
        width: "165px",
        align: "right",
        mobileGrid: "full",
        mobileOrder: 5,
        render: (item) => (
            <span className="text-xs font-black text-slate-700 block p-2 truncate text-right max-w-full" title={(item.total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}>
                {(item.total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
            </span>
        )
    },
    {
        header: "",
        width: "50px",
        align: "center",
        mobileGrid: "full",
        mobileOrder: 6,
        render: (item) => (
            <IconButton 
                onClick={() => handleRemoveItem(item.id)} 
                icon={<FiTrash2  />}
                variant="danger"
                title="Eliminar Item"
            />
        )
    }
  ], [catalogMap, updateItem, handleRemoveItem]);

  if (!show) return null;

  return createPortal(
    <>
      <div className={`fixed inset-0 bg-blue-950/90 backdrop-blur-sm flex justify-center items-start z-[200] custom-scrollbar p-0 ${showClientModal || showCatalogModal ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className="bg-white w-full max-w-7xl shadow-2xl flex flex-col min-h-[100dvh] md:min-h-0 md:rounded-[32px] md:my-6 relative">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start p-4 md:p-6 border-b border-slate-100 bg-white gap-4 flex-none sticky top-0 z-50 md:rounded-t-[32px]">
          <div className="flex flex-col gap-1 md:gap-2 w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <h2 className="text-lg md:text-3xl font-black text-blue-950 uppercase tracking-tighter">
                    COTIZACIÓN
                </h2>
                
                <div className={`flex items-center px-[10px] py-[6px] md:px-4 md:py-2 rounded-[10px] md:rounded-full border-2 transition-colors ${idError ? 'bg-red-50 border-red-500' : 'bg-blue-50/50 border-blue-100'}`}>
                    <span className={`font-black text-[16px] md:text-lg mr-1 md:mr-2 ${idError ? 'text-red-500' : 'text-blue-400'}`}>#</span>
                    <input
                    type="text"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value.replace(/\D/g, ''))}
                    className={`bg-transparent border-none outline-none text-[16px] md:text-xl font-black w-10 md:w-16 text-center ${idError ? 'text-red-600 placeholder-red-300' : 'text-blue-600 placeholder-blue-300'}`}
                    placeholder="000"
                    disabled={false}
                    autoFocus={!quote}
                    />
                    <span className={`font-black text-[12px] md:text-lg ml-1 select-none opacity-70 ${idError ? 'text-red-300' : 'text-blue-300'}`}>
                    - {quote ? getYear(quote.fecha) : new Date().getFullYear()}
                    </span>
                </div>
                
                {(lastQuoteNumber !== null || loadingAllQuotes) && (
                    <span className="text-[11px] md:text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg min-w-[32px] inline-flex items-center justify-center">
                        {loadingAllQuotes && lastQuoteNumber === null ? (
                            <span className="animate-pulse">...</span>
                        ) : (
                            <>
                                <span className="md:hidden">Últ. Reg.: </span>
                                <span className="hidden md:inline">Último número registrado: </span>
                                {lastQuoteNumber !== null ? lastQuoteNumber.toString().padStart(3, '0') : '...'}
                            </>
                        )}
                    </span>
                )}
            </div>
            
            {idError && (
                <div className="flex items-center gap-2 text-red-600 animate-pulse mt-1">
                    <FiAlertTriangle className="text-[10px]"  />
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">
                        Número de proyecto ya existe {duplicateQuoteInfo && `- ${duplicateQuoteInfo}`}
                    </span>
                </div>
            )}
          </div>

          <div className="flex gap-2 md:gap-3 items-center w-full md:w-auto">
             <ActionButton 
                onClick={handleGenerateDraft} 
                variant="secondary"
                label="BORRADOR"
                icon={<FiFileText  />}
                className="!text-[10px] !px-2 md:!text-xs md:!px-4"
             />
             <ActionButton 
                onClick={() => setShowClientModal(true)} 
                variant="primary"
                label="CLIENTE"
                icon={<FiSearch  />}
                className="!text-[10px] !px-2 md:!text-xs md:!px-4"
             />
             <IconButton 
                onClick={onClose} 
                icon={<FiX  />}
                variant="neutral"
                title="Cerrar"
             />
          </div>
        </div>

        {/* Body Area */}
        <div className="flex-1 p-4 md:p-6 bg-white flex flex-col gap-4 md:gap-6">
            
            {/* Cliente Section */}
            <div className="rounded-3xl border border-slate-100/80 bg-slate-50/30 p-4 md:p-6 relative overflow-hidden">
                {/* Visual Feedback Bar for Client Status */}
                {clientStatus.status !== 'idle' && (
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${
                        clientStatus.status === 'match' ? 'bg-emerald-500' : 
                        clientStatus.status === 'update' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}></div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 pt-2">
                    <div className="col-span-2 md:col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Empresa</label>
                        <input type="text" value={clientData.empresa} onChange={e => setClientData({...clientData, empresa: e.target.value})} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-blue-900 outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Nombre de la empresa" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Contacto</label>
                        <input type="text" value={clientData.contacto} onChange={e => setClientData({...clientData, contacto: e.target.value})} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Nombre completo" />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Teléfono</label>
                        <input type="text" value={clientData.telefono} onChange={e => setClientData({...clientData, telefono: e.target.value})} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Número" />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                        <input type="text" value={clientData.correo} onChange={e => setClientData({...clientData, correo: e.target.value})} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="email@ejemplo.com" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cód. Cliente</label>
                        <input 
                            type="text" 
                            value={clientData.codigoCliente || ''} 
                            readOnly 
                            className={`w-full p-2.5 rounded-xl border border-slate-200 font-bold text-xs outline-none transition-all cursor-not-allowed ${clientData.codigoCliente ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-500'}`} 
                            placeholder={clientData.codigoCliente ? "CLI-XXX" : "Se asignará automáticamente"} 
                        />
                    </div>
                </div>

                {/* Mensaje de Estado del Cliente (Non-blocking UI) */}
                {clientStatus.status !== 'idle' && (
                    <div className="mt-3 flex items-center gap-2 px-1 animate-in fade-in slide-in-from-top-1">
                        <StatusBadge 
                            label={clientStatus.message}
                            variant={
                                clientStatus.status === 'match' ? 'success' : 
                                clientStatus.status === 'update' ? 'warning' : 'info'
                            }
                            icon={
                                clientStatus.status === 'match' ? <FiCheckCircle /> : 
                                clientStatus.status === 'update' ? <FiAlertCircle /> : <FiInfo />
                            }
                            className="!whitespace-normal !break-words [overflow-wrap:anywhere] !leading-[1.3] !text-[12px] !px-[10px] !py-[8px] !rounded-[8px] line-clamp-2 md:!whitespace-nowrap md:!text-[9px] md:!px-2 md:!py-1 md:!rounded-lg md:!line-clamp-none md:!leading-normal"
                        />
                    </div>
                )}
            </div>

            {/* Items Section */}
            <div className="rounded-3xl border border-slate-100/80 bg-slate-50/30 p-4 md:p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Partidas</h3>
                    <div className="flex gap-2">
                        <ActionButton 
                            onClick={() => setShowCatalogModal(true)} 
                            variant="secondary"
                            label="Catálogo"
                            icon={<FiBookOpen  />}
                            className="!text-[10px] !px-2 md:!text-xs md:!px-4"
                        />
                        <ActionButton 
                            onClick={handleAddItem} 
                            variant="primary"
                            label="Línea"
                            icon={<FiPlus  />}
                            className="!text-[10px] !px-2 md:!text-xs md:!px-4"
                        />
                    </div>
                </div>

                {/* Desktop View (Table) and Mobile View (Cards) replaced by DataTable */}
                <div className="rounded-xl border border-slate-100">
                    <DataTable<QuoteItem>
                        data={items}
                        columns={columns}
                        keyExtractor={(item) => item.id}
                        emptyMessage="No hay partidas en esta cotización."
                    />
                </div>
            </div>

            {/* Footer Calculation Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Left: Meta Data & Settings */}
                <div className="rounded-3xl border border-slate-100/80 bg-slate-50/30 p-4 md:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
                        <div className="col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Moneda</label>
                            <select value={metaData.moneda} onChange={e => setMetaData({...metaData, moneda: e.target.value as any})} className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none cursor-pointer h-10 transition-all focus:ring-2 focus:ring-blue-100">
                                <option value="USD">USD ($)</option>
                                <option value="CRC">CRC (¢)</option>
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Fecha</label>
                            <input 
                                type="date" 
                                value={metaData.fecha.split('/').reverse().join('-')} 
                                onChange={e => setMetaData({...metaData, fecha: e.target.value.split('-').reverse().join('/')})} 
                                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none h-10 transition-all focus:ring-2 focus:ring-blue-100" 
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Desc %</label>
                            <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                value={isNaN(metaData.descuento) ? '' : metaData.descuento} 
                                onChange={e => setMetaData({...metaData, descuento: parseFloat(e.target.value)})} 
                                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none h-10 transition-all focus:ring-2 focus:ring-blue-100" 
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Forma de Pago</label>
                            <textarea
                                value={metaData.formaPago}
                                onChange={e => setMetaData({...metaData, formaPago: e.target.value})}
                                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none h-auto min-h-[40px] transition-all focus:ring-2 focus:ring-blue-100 resize-y"
                                placeholder="Ej: Contado"
                                rows={3}
                            />
                        </div>
                    </div>
                    
                    {/* Control de IVA - Desktop Version (Detailed) */}
                    <div className="mb-6 relative z-10 w-full hidden md:block">
                        <label className="flex w-full items-center justify-between gap-4 cursor-pointer group p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-300 transition-all shadow-sm active:scale-[0.99] touch-manipulation min-h-[64px]">
                            <div className="flex items-start gap-4">
                                <div className="flex-none pt-0.5">
                                    <input 
                                        type="checkbox" 
                                        checked={applyTax} 
                                        onChange={e => setApplyTax(e.target.checked)} 
                                        className="w-5 h-5 accent-blue-600 rounded-md cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-xs font-black text-slate-700 group-hover:text-blue-700 transition-colors truncate w-full">
                                        Aplicar Impuesto (IVA 13%)
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400 leading-tight break-words mt-0.5">
                                        {applyTax ? 'Cálculo automático habilitado' : 'Documento exento de impuestos'}
                                    </span>
                                </div>
                            </div>
                            <div className={`flex-none text-[10px] font-black px-3 py-1 rounded-lg ${applyTax ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                {applyTax ? 'ON' : 'OFF'}
                            </div>
                        </label>
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Notas / Condiciones</label>
                        <textarea value={metaData.notas} onChange={e => setMetaData({...metaData, notas: e.target.value})} className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium outline-none h-20 resize-none transition-all focus:ring-2 focus:ring-blue-100" placeholder="Condiciones, garantías..." />
                    </div>
                </div>

                {/* Right: Totals */}
                <div className="rounded-3xl border border-slate-100/80 bg-slate-50/30 p-4 md:p-6 flex flex-col justify-center">
                    
                    {formError && (
                        <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center justify-center gap-2 animate-pulse shadow-sm">
                            <FiAlertCircle className="text-sm"  />
                            {formError}
                        </div>
                    )}

                    {/* ALERTA DE CONFLICTO DE CATÁLOGO (NUEVA) */}
                    {catalogConflict && (
                        <div className="mb-4 bg-amber-50 text-amber-800 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <FiAlertTriangle className="text-lg"  />
                            <span>Conflicto de código: {catalogConflict.item.codigo}</span>
                        </div>
                    )}

                    <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                            <span className="uppercase tracking-wider">Subtotal:</span>
                            <span className="font-mono">{subtotal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {discountAmount > 0 && (
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-600">
                                <span className="uppercase tracking-wider">Descuento ({metaData.descuento}%):</span>
                                <span className="font-mono">- {discountAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        
                        {/* Control de IVA Mobile (Solo visible en <md) */}
                        <div className="md:hidden pt-1 pb-1">
                            <ActionButton 
                                onClick={() => setApplyTax(!applyTax)}
                                variant={applyTax ? 'primary' : 'secondary'}
                                label={applyTax ? 'IVA ACTIVADO (13%)' : 'PROYECTO EXENTO'}
                                icon={applyTax ? <FiCheckCircle /> : <FiAlertCircle />}
                                fullWidth
                                className={`border-2 font-black text-[10px] uppercase tracking-widest ${
                                    !applyTax && 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                            />
                        </div>

                        <div className={`flex justify-between items-center text-xs font-bold ${applyTax ? 'text-blue-500' : 'text-slate-400'}`}>
                            <span className="uppercase tracking-wider">{applyTax ? 'IVA (13%):' : 'IVA (EXENTO):'}</span>
                            <span className="font-mono">{applyTax ? '+' : ''} {iva.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-px bg-slate-100 my-3"></div>
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Oferta</span>
                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-400 mr-1">{metaData.moneda}</span>
                                <span className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight font-mono">{total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 flex gap-3">
                        {quote && onDelete && (
                            <IconButton 
                                onClick={handleDelete} 
                                icon={<FiTrash2  />}
                                variant="danger"
                                title="Eliminar Cotización"
                                className="w-12 h-12 flex-none"
                            />
                        )}
                        <ActionButton 
                            onClick={onClose} 
                            variant="secondary"
                            label="Cancelar"
                            className="flex-1"
                        />
                        <ActionButton 
                            onClick={handleSave} 
                            variant="primary"
                            label={isSaving ? "Guardando..." : "Guardar"}
                            disabled={isSaving}
                            className="flex-[2]"
                        />
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>

    {showClientModal && (
          <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm z-[250] flex justify-center items-center p-4 animate-in fade-in duration-200 overscroll-contain">
              <div className="bg-white w-full max-w-2xl rounded-[32px] md:rounded-[40px] shadow-2xl p-6 md:p-8 border border-slate-100 flex flex-col max-h-[90vh] md:max-h-[85vh] animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-start mb-6 flex-none">
                      <div>
                          <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Directorio Corporativo</span>
                          <h3 className="text-2xl md:text-3xl font-black text-blue-950 uppercase tracking-tight">Directorio de Clientes</h3>
                      </div>
                      <IconButton 
                          onClick={() => setShowClientModal(false)} 
                          icon={<FiX  />}
                          variant="neutral"
                          title="Cerrar"
                      />
                  </div>
                  
                  <div className="relative mb-6 flex-none">
                      <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"  />
                      <input 
                          type="text" 
                          placeholder="Filtrar por empresa, contacto o código..." 
                          value={clientSearch} 
                          onChange={e => setClientSearch(e.target.value)} 
                          className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-400" 
                          autoFocus 
                      />
                  </div>

                  <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-2 space-y-3">
                      {(Array.isArray(savedClients) ? savedClients : [])
                        .filter(c => 
                            c && (c.isActive !== false) && (
                            c.empresa.toLowerCase().includes(clientSearch.toLowerCase()) || 
                            c.contacto.toLowerCase().includes(clientSearch.toLowerCase()) ||
                            (c.codigoCliente && c.codigoCliente.toLowerCase().includes(clientSearch.toLowerCase()))
                            )
                        )
                        .map(client => (
                          <div key={client.id} className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:border-blue-300 transition-all bg-white group shadow-sm hover:shadow-md">
                              <div>
                                  <span className="text-xs font-bold text-slate-400 mb-1 block uppercase tracking-wider">{client.codigoCliente || 'S/C'}</span>
                                  <h4 className="text-lg font-black text-blue-950 leading-none mb-1">{client.empresa}</h4>
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">ATENCIÓN: {client.contacto}</p>
                              </div>
                              <div className="flex gap-2">
                                  <IconButton 
                                      onClick={(e) => handleDeleteClient(e, client)}
                                      icon={<FiTrash2  />}
                                      variant="danger"
                                      title="Eliminar Cliente"
                                  />
                                  <IconButton 
                                      onClick={() => handleClientSelect(client)}
                                      icon={<FiCheck  />}
                                      variant="primary"
                                      title="Seleccionar Cliente"
                                  />
                              </div>
                          </div>
                      ))}

                      {loadingMoreClients && (
                          <div className="py-4 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              Cargando más...
                          </div>
                      )}

                      {!loadingMoreClients && hasMoreClients && (
                          <div className="py-4">
                              <ActionButton 
                                  onClick={loadMoreClients}
                                  label="Cargar más clientes"
                                  variant="secondary"
                                  fullWidth={true}
                                  className="!py-3 !text-[10px] !rounded-2xl !font-black !uppercase !tracking-widest"
                              />
                          </div>
                      )}

                      {savedClients.filter(c => c.isActive !== false).length === 0 && !loadingMoreClients && (
                          <div className="text-center py-10 text-slate-400 font-bold">
                              No hay clientes registrados.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showCatalogModal && (
          <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm z-[250] flex justify-center items-center p-2 md:p-4 animate-in fade-in duration-200 overscroll-contain">
              <div className="bg-white w-full max-w-4xl rounded-[32px] md:rounded-[40px] shadow-2xl p-5 md:p-8 border border-slate-100 flex flex-col max-h-[95vh] md:max-h-[85vh] animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-start mb-4 md:mb-6 flex-none">
                      <div>
                          <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Directorio Maestro</span>
                          <h3 className="text-xl md:text-3xl font-black text-blue-950 uppercase tracking-tight">Catálogo de Productos</h3>
                      </div>
                      <IconButton 
                          onClick={() => { setShowCatalogModal(false); setIsCreatingProduct(false); }} 
                          icon={<FiX  />}
                          variant="neutral"
                          title="Cerrar"
                      />
                  </div>
                  
                  {isCreatingProduct ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 mb-6 animate-in slide-in-from-top-4 flex-none">
                          <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-4">Registrar Nuevo Ítem</h4>
                          
                          {duplicateProductError && (
                              <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center justify-center gap-2 animate-pulse">
                                  <FiAlertTriangle  />
                                  {duplicateProductError}
                              </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Código</label>
                                  <input 
                                      type="text" 
                                      value={newProductForm.codigo} 
                                      onChange={e => setNewProductForm({...newProductForm, codigo: e.target.value.toUpperCase()})}
                                      placeholder="Ej: FO-001"
                                      className={`w-full p-3 rounded-xl bg-white border text-sm font-bold outline-none focus:ring-2 transition-all ${duplicateProductError && duplicateProductError.includes('código') ? 'border-red-200 ring-red-50 focus:ring-red-100 text-red-600' : 'border-slate-200 focus:ring-blue-100'}`}
                                      autoFocus
                                  />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nombre / Descripción</label>
                                  <input 
                                      type="text" 
                                      value={newProductForm.nombre} 
                                      onChange={e => setNewProductForm({...newProductForm, nombre: e.target.value})}
                                      placeholder="Descripción del servicio o producto"
                                      className={`w-full p-3 rounded-xl bg-white border text-sm font-bold outline-none focus:ring-2 transition-all ${duplicateProductError && duplicateProductError.includes('producto') ? 'border-red-200 ring-red-50 focus:ring-red-100 text-red-600' : 'border-slate-200 focus:ring-blue-100'}`}
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Precio Base ($)</label>
                                  <input 
                                      type="number" 
                                      min="0"
                                      step="0.01"
                                      value={newProductForm.precioBase} 
                                      onChange={e => setNewProductForm({...newProductForm, precioBase: e.target.value})}
                                      placeholder="0.00"
                                      className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                  />
                              </div>
                          </div>
                          <div className="flex justify-end gap-3">
                              <ActionButton 
                              onClick={() => setIsCreatingProduct(false)} 
                              variant="secondary"
                              label="Cancelar"
                          />
                          <ActionButton 
                              onClick={handleCreateProduct}
                              disabled={!!duplicateProductError}
                              variant="primary"
                              label="Guardar y Seleccionar"
                          />
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-6 flex-none">
                          <div className="relative w-full md:flex-1">
                              <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"  />
                              <input 
                                  type="text" 
                                  placeholder="Buscar por nombre o código de producto..." 
                                  value={catalogSearch} 
                                  onChange={e => setCatalogSearch(e.target.value)} 
                                  className="w-full h-[44px] md:h-auto pl-12 pr-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-400" 
                                  autoFocus 
                              />
                          </div>
                          <ActionButton 
                              onClick={() => setIsCreatingProduct(true)}
                              variant="primary"
                              label="Nuevo"
                              icon={<FiPlus  />}
                              className="w-full md:w-auto !h-[40px] !px-3 !text-[12px] !rounded-[10px] md:!h-auto md:!px-4 md:!text-xs md:!rounded-xl"
                          />
                      </div>
                  )}

                  <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-2 space-y-3">
                      {(Array.isArray(catalog) ? catalog : [])
                        // Fix: Check isActive !== false
                        .filter(p => p && p.isActive !== false && (p.nombre.toLowerCase().includes(catalogSearch.toLowerCase()) || p.codigo.toLowerCase().includes(catalogSearch.toLowerCase())))
                        .map(product => (
                          <div key={product.id} className="border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between hover:border-blue-300 transition-all bg-white group shadow-sm hover:shadow-md gap-1.5 md:gap-0">
                              <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 min-w-0 md:pr-4">
                                <span className="self-start md:flex-none text-xs md:text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 md:px-3 md:py-1 rounded-lg uppercase tracking-wider md:min-w-[80px] text-center">{product.codigo}</span>
                                <span className="font-bold text-blue-950 text-sm break-words flex-1 min-w-0 leading-tight whitespace-normal w-full">{product.nombre}</span>
                              </div>
                              <div className="flex-none flex items-center justify-between md:justify-end gap-6 md:pl-4 md:border-l border-slate-100">
                                  <span className="font-black text-blue-600 text-lg whitespace-nowrap">${product.precioBase.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                                  <div className="flex gap-2">
                                      <IconButton 
                                          onClick={(e) => handleDeleteProduct(e, product)}
                                          icon={<FiTrash2  />}
                                          variant="danger"
                                          title="Eliminar Producto"
                                      />
                                      <IconButton 
                                          onClick={() => handleCatalogSelect(product)}
                                          icon={<FiPlus  />}
                                          variant="primary"
                                          title="Seleccionar Producto"
                                      />
                                  </div>
                              </div>
                          </div>
                      ))}

                      {loadingMoreCatalog && (
                          <div className="py-4 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              Cargando más...
                          </div>
                      )}

                      {!loadingMoreCatalog && hasMoreCatalog && (
                          <div className="py-4">
                              <ActionButton 
                                  onClick={loadMoreCatalog}
                                  label="Cargar más productos"
                                  variant="secondary"
                                  fullWidth={true}
                                  className="!py-3 !text-[10px] !rounded-2xl !font-black !uppercase !tracking-widest"
                              />
                          </div>
                      )}

                      {catalog.filter(p => p.isActive !== false).length === 0 && !loadingMoreCatalog && (
                          <div className="text-center py-10 text-slate-400 font-bold">
                              No hay productos en el catálogo.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      <ConfirmModal 
          show={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={confirmItemDelete}
          title="¿Eliminar Registro?"
          description={`Se eliminará "${itemToDelete?.name}" de la lista. ¿Desea continuar?`}
          confirmLabel="Confirmar"
          variant="danger"
      />
      {catalogConflict && (
        <ConflictModal
          show={catalogConflict.show}
          onClose={() => {
            conflictResolver?.('cancel');
            setCatalogConflict(null);
          }}
          onUseExisting={() => {
            conflictResolver?.('use');
            setCatalogConflict(null);
          }}
          onChangeCode={() => {
            conflictResolver?.('change');
            setCatalogConflict(null);
          }}
          title={`Conflicto de Código: ${catalogConflict.item.codigo}`}
          description={`El código "${catalogConflict.item.codigo}" ya pertenece al producto "${catalogConflict.existingProduct.nombre}". ¿Qué desea hacer?`}
        />
      )}

    </>,
    document.body
  );
};