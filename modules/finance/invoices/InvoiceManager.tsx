import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { InvoiceModal } from './InvoiceModal';
import { InvoiceExportModal } from './InvoiceExportModal';
import { InvoiceLinkedOCsModal } from './InvoiceLinkedOCsModal';
import { useInvoices } from './useInvoices';
import { useAuth } from '../../../hooks/useAuth';
import { Invoice } from './invoice.types';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { POApplication, PurchaseOrder } from '../purchase_orders/types';
import { ModulePage } from '../../../components/ui/ModulePage';
import { Toolbar, ActionButton, IconButton, ACTION_ICONS, useConfirm, DataTable, TableColumn, StatusBadge, SearchInput } from '../../../design-system';
import { formatCurrency } from '../../../utils/formatCurrency';
import { FiDollarSign, FiFileText, FiShoppingBag, FiShield, FiInfo, FiLoader, FiLock, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

type InvoiceTab = 'CXC_CASH' | 'CXC_CREDIT' | 'CXP_CASH' | 'CXP_CREDIT';

interface EnrichedLink {
  id: string;
  ocNumber: string;
  provider: string;
  appliedAmount: number;
}

interface InvoiceManagerProps {
  selectedId?: string;
  onClearSelectedId?: () => void;
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ selectedId, onClearSelectedId }) => {
  const { currentUser } = useAuth();
  const { 
    invoices, 
    addInvoice, 
    updateInvoice, 
    removeInvoice, 
    isLoading,
    loadMore,
    hasMore,
    loadingMore
  } = useInvoices(currentUser);
  const confirm = useConfirm();
  
  const [mainFilter, setMainFilter] = useState<'CXC' | 'CXP' | 'ALL'>('CXC');
  const [subFilter, setSubFilter] = useState<'CONTADO' | 'CREDITO' | 'ALL'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isInvoiceLinked, setIsInvoiceLinked] = useState(false);
  
  const [viewingLinkedInvoice, setViewingLinkedInvoice] = useState<Invoice | null>(null);

  // --- AUTO-OPEN AND HIGHLIGHT FROM SEARCH ---
  React.useEffect(() => {
    const safeInvoices = Array.isArray(invoices) ? invoices : [];

    if (selectedId && safeInvoices.length > 0) {
      const target = safeInvoices.find(inv => inv.id === selectedId);
      if (target) {
        setEditingInvoice(target);
        setShowModal(true);
      }
    }
  }, [selectedId, invoices]);

  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [filterCurrency, setFilterCurrency] = useState<'CRC' | 'USD' | 'AMBAS'>('CRC');
  const [searchTerm, setSearchTerm] = useState('');

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    invoice: Invoice | null;
    linkedApps: EnrichedLink[];
    isProcessing: boolean;
    isValidating: boolean;
  }>({ show: false, invoice: null, linkedApps: [], isProcessing: false, isValidating: false });
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const availableYears = useMemo(() => {
    const years = new Set<string>([new Date().getFullYear().toString()]);
    invoices.forEach(inv => {
        if (inv.issueDate) {
            years.add(inv.issueDate.split('-')[0]);
        }
    });
    return Array.from(years).sort().reverse();
  }, [invoices]);

  // Obtener lista única de proveedores/emisores de facturas existentes
  const existingProviders = useMemo(() => {
    const providers = new Set<string>();
    invoices.forEach(inv => {
        // Solo considerar facturas CXP para la lista de proveedores
        if (inv.type === 'CXP' && inv.entityName) {
            providers.add(inv.entityName);
        }
    });
    return Array.from(providers).sort();
  }, [invoices]);

  const handleSaveInvoice = useCallback(async (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>, id?: string) => {
    try {
      if (id) {
        const appsRef = collection(db, 'purchase_order_applications');
        const q = query(appsRef, where('invoiceId', '==', id));
        const snapshot = await getDocs(q);
        
        const hasActiveLinks = snapshot.docs.some(d => {
            const appData = d.data();
            return appData.status !== 'deleted' && appData.status !== 'voided';
        });

        if (hasActiveLinks) {
            const originalInvoice = invoices.find(inv => inv.id === id);
            if (originalInvoice) {
                const isFinancialChange = 
                    Math.abs(originalInvoice.subtotal - data.subtotal) > 0.01 ||
                    Math.abs(originalInvoice.total - data.total) > 0.01 ||
                    originalInvoice.currency !== data.currency;

                if (isFinancialChange) {
                    await confirm({
                        title: "Bloqueo de Seguridad",
                        description: "No se pueden modificar montos ni moneda de una factura que tiene consumos activos en Órdenes de Compra.",
                        confirmLabel: "Entendido",
                        variant: "warning"
                    });
                    return;
                }
            }
        }

        await updateInvoice(id, data);
      } else {
        await addInvoice(data);
      }
      setEditingInvoice(null);
    } catch (error) {
      console.error("Error al guardar factura:", error);
      await confirm({
          title: "Error",
          description: "Error al guardar la factura. Verifique su conexión.",
          confirmLabel: "Cerrar",
          variant: "warning"
      });
    }
  }, [invoices, confirm, updateInvoice, addInvoice]);

  const handleEdit = useCallback(async (invoice: Invoice) => {
    if (invoice.status === 'Anulada') {
        await confirm({
            title: "Acción no permitida",
            description: "No se puede editar una factura anulada.",
            confirmLabel: "Entendido",
            variant: "warning"
        });
        return;
    }

    let isLinked = false;
    try {
        const appsRef = collection(db, 'purchase_order_applications');
        const q = query(appsRef, where('invoiceId', '==', invoice.id));
        const snapshot = await getDocs(q);
        
        const activeLinks = snapshot.docs.filter(d => {
            const data = d.data();
            return data.status !== 'deleted' && data.status !== 'voided';
        });
        
        isLinked = activeLinks.length > 0;
    } catch (e) {
        console.error("Error checking links", e);
        isLinked = true; 
    }

    setIsInvoiceLinked(isLinked);
    setEditingInvoice(invoice);
    setShowModal(true);
  }, [confirm]);

  const checkLinksAndPromptDelete = useCallback(async (invoice: Invoice) => {
    // MODIFICADO: Permitir eliminación definitiva si ya está anulada
    // if (invoice.status === 'Anulada') return;

    setDeleteConfirmation({
      show: true,
      invoice,
      linkedApps: [],
      isProcessing: false,
      isValidating: true
    });

    try {
      const appsRef = collection(db, 'purchase_order_applications');
      const q = query(appsRef, where('invoiceId', '==', invoice.id));
      const snapshot = await getDocs(q);
      
      const apps = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as POApplication))
        .filter(app => app.status !== 'voided' && app.status !== 'deleted');

      // Enriquecer la información de las OCs
      const enrichedLinks: EnrichedLink[] = await Promise.all(
        apps.map(async (app) => {
          const ocSnap = await getDoc(doc(db, 'purchase_orders', app.purchaseOrderId));
          const ocData = ocSnap.exists() ? (ocSnap.data() as PurchaseOrder) : null;
          return {
            id: app.id,
            ocNumber: ocData?.ocNumber ?? 'Desconocido',
            provider: ocData?.provider ?? 'Proveedor no encontrado',
            appliedAmount: app.appliedAmount
          };
        })
      );

      setDeleteConfirmation(prev => ({
        ...prev,
        linkedApps: enrichedLinks,
        isValidating: false
      }));

    } catch (error) {
      console.error("Error verificando enlaces:", error);
      setDeleteConfirmation(prev => ({
        ...prev,
        linkedApps: [],
        isValidating: false
      }));
    }
  }, []);

  const executeAnulacion = useCallback(async () => {
    const { invoice, linkedApps } = deleteConfirmation;
    if (!invoice || linkedApps.length > 0) return;

    setDeleteConfirmation(prev => ({ ...prev, isProcessing: true }));

    try {
      // Si ya está anulada, es eliminación definitiva (hard delete)
      if (invoice.status === 'Anulada') {
          await removeInvoice(invoice.id, true);
      } else {
          // Si no, es anulación (soft delete)
          await removeInvoice(invoice.id, false);
      }
      setDeleteConfirmation({ show: false, invoice: null, linkedApps: [], isProcessing: false, isValidating: false });
    } catch (error) {
      console.error("Error al anular:", error);
      await confirm({
          title: "Error",
          description: "No se pudo completar la anulación. Intente nuevamente.",
          confirmLabel: "Entendido",
          variant: "warning"
      });
      setDeleteConfirmation(prev => ({ ...prev, isProcessing: false }));
    }
  }, [deleteConfirmation, removeInvoice, confirm]);

  const handleMarkAsPaid = useCallback(async (invoice: Invoice) => {
    const approved = await confirm({
      title: "¿Marcar como Pagada?",
      description: `La factura #${invoice.consecutivo} se marcará como pagada y su saldo será 0.`,
      confirmLabel: "Confirmar",
      variant: "success"
    });

    if (approved) {
      try {
        await updateInvoice(invoice.id, { 
          status: 'Pagada',
          balance: 0
        });
      } catch (error) {
        console.error("Error al marcar como pagada:", error);
      }
    }
  }, [confirm, updateInvoice]);

  const handleNewInvoice = useCallback(() => {
    setEditingInvoice(null);
    setIsInvoiceLinked(false);
    setShowModal(true);
  }, []);

  const getTabConfig = useCallback(() => {
    const isCXP = mainFilter === 'CXP';
    const isAll = mainFilter === 'ALL';
    
    return { 
        title: isAll ? 'Todas las Facturas' : (isCXP ? 'Cuentas por Pagar' : 'Cuentas por Cobrar'), 
        subtitle: subFilter === 'ALL' ? 'Vista Consolidada' : (subFilter === 'CONTADO' ? 'Facturación al Contado' : 'Facturación a Crédito'), 
        color: isCXP ? 'red' : (isAll ? 'slate' : 'blue'), 
        showDueDate: subFilter !== 'CONTADO' 
    };
  }, [mainFilter, subFilter]);

  const config = getTabConfig();
  const filteredInvoices = useMemo(() => {
    const safeInvoices = Array.isArray(invoices) ? invoices : [];

    if (selectedId && safeInvoices.length > 0) {
      const target = safeInvoices.find(inv => inv.id === selectedId);
      if (target) return [target];
    }

    const uniqueInvoices = Array.from(new Map(safeInvoices.map(item => [item.id, item])).values());

    return uniqueInvoices.filter(inv => {
      // 1. Filtro Principal (CXC / CXP / ALL)
      if (mainFilter !== 'ALL' && inv.type !== mainFilter) return false;

      // 2. Filtro Subtipo (CONTADO / CREDITO / ALL)
      if (subFilter !== 'ALL' && inv.paymentMode !== subFilter) return false;

      // 3. Filtro por Moneda
      if (filterCurrency !== 'AMBAS' && inv.currency !== filterCurrency) return false;

      // 4. Filtro por Año
      if (filterYear !== 'all' && inv.issueDate) {
          const year = inv.issueDate.split('-')[0];
          if (year !== filterYear) return false;
      }

      // 5. Filtro por Mes
      if (filterMonth !== 'all' && inv.issueDate) {
          const month = parseInt(inv.issueDate.split('-')[1]).toString();
          if (month !== filterMonth) return false;
      }

      // 6. Filtro por Término de Búsqueda
      if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesConsecutivo = (inv.consecutivo || '').toLowerCase().includes(term);
          const matchesEntity = (inv.entityName || '').toLowerCase().includes(term);
          const matchesProject = (inv.projectName || '').toLowerCase().includes(term);
          const matchesNotes = (inv.notes || '').toLowerCase().includes(term);
          
          if (!matchesConsecutivo && !matchesEntity && !matchesProject && !matchesNotes) {
              return false;
          }
      }

      return true;
    });
  }, [invoices, selectedId, filterYear, filterMonth, filterCurrency, searchTerm, mainFilter, subFilter]);

  const formatMoney = useCallback((amount: number, currency: 'USD' | 'CRC') => {
    return (currency === 'USD' ? '$' : '¢') + amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }, []);

  const totalBlocked = useMemo(() => {
    return deleteConfirmation.linkedApps.reduce((acc, app) => acc + app.appliedAmount, 0);
  }, [deleteConfirmation.linkedApps]);

  const totals = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => {
        if (inv.status === 'Anulada') return acc;
        
        const amount = inv.total || 0;
        const bal = inv.balance || 0;
        
        if (inv.currency === 'USD') {
            acc.totalUSD += amount;
            acc.balanceUSD += bal;
        } else {
            acc.totalCRC += amount;
            acc.balanceCRC += bal;
        }
        return acc;
    }, { totalUSD: 0, balanceUSD: 0, totalCRC: 0, balanceCRC: 0 });
  }, [filteredInvoices]);

  // Mapeo de variantes para StatusBadge
  const getBadgeVariant = useCallback((status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
      switch(status) {
          case 'Pagada': return 'success';
          case 'Pendiente': return 'warning';
          case 'Anulada': return 'neutral';
          case 'Vencida': return 'danger';
          case 'Parcial': return 'info';
          default: return 'neutral';
      }
  }, []);

  const mappedInvoices = useMemo(() => {
    const safeFiltered = Array.isArray(filteredInvoices) ? filteredInvoices : [];
    return safeFiltered.map(doc => ({
      ...doc, // Conservamos todos los campos originales para el Modal
      id: doc.id,
      consecutivo: doc.consecutivo || "",
      cliente: doc.entityName || "", // Alias para la tabla
      fecha: doc.issueDate || "",
      vencimiento: doc.dueDate || "",
      subtotal: doc.subtotal || 0,
      iva: doc.iva || 0,
      total: doc.total || 0,
      balance: doc.balance || 0,
      estado: doc.status || "",
      moneda: doc.currency || "",
      projectName: doc.projectName || ""
    }));
  }, [filteredInvoices, invoices]);

  // Columnas tipadas para DataTable
  const columns = useMemo<TableColumn<any>[]>(() => {
    const cols: TableColumn<any>[] = [
        { 
            header: (
                <div className="flex flex-col leading-tight py-1">
                    <span className="text-[9px] text-slate-400">DOCUMENTO</span>
                    <span className="text-[10px]">{mainFilter === 'CXP' ? 'PROVEEDOR' : 'CLIENTE'}</span>
                </div>
            ),
            render: (inv) => (
                <div className="flex flex-col truncate leading-tight">
                    <span className="font-bold text-slate-400 text-[10px] leading-none mb-0.5 uppercase tracking-wider">#{inv.consecutivo}</span>
                    <span className="font-black text-blue-950 text-[11px] truncate block" title={inv.cliente}>{inv.cliente}</span>
                </div>
            ),
            width: "150px"
        },
        {
            header: 'Emisión',
            align: 'center',
            render: (inv) => <span className="text-[10px] font-mono font-bold text-slate-500">{inv.fecha}</span>,
            width: "80px"
        }
    ];

    if (config.showDueDate) {
        cols.push({
            header: 'Vence',
            align: 'center',
            render: (inv) => <span className="text-[10px] font-mono font-bold text-slate-500">{inv.vencimiento}</span>,
            width: "80px"
        });
    }
    
    cols.push(
        { header: 'Moneda', align: 'center', render: (inv) => <span className="font-black text-slate-300 text-[9px]">{inv.moneda}</span>, width: "65px" },
        { header: 'Subtotal', align: 'right', render: (inv) => <span className="font-bold text-slate-500 text-[11px]">{formatMoney(inv.subtotal, inv.moneda)}</span>, width: "90px" },
        { header: 'IVA', align: 'right', render: (inv) => <span className="font-bold text-slate-500 text-[11px]">{formatMoney(inv.iva, inv.moneda)}</span>, width: "80px" },
        { header: 'Total', align: 'right', render: (inv) => <span className="font-black text-blue-900 text-[11px]">{formatMoney(inv.total, inv.moneda)}</span>, width: "100px" },
        { header: 'Saldo', align: 'right', render: (inv) => <span className={`font-black text-[11px] ${inv.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatMoney(inv.balance, inv.moneda)}</span>, width: "100px" },
        { 
            header: 'Estado', 
            align: 'center',
            render: (inv) => <StatusBadge label={inv.estado} variant={getBadgeVariant(inv.estado)} />,
            width: "100px"
        },
        {
            header: 'Acciones',
            align: 'center',
            render: (inv) => (
                <div className="flex items-center justify-center gap-1.5">
                     {inv.estado === 'Pendiente' && (
                         <IconButton icon={<FiCheckCircle className="text-emerald-500" />} onClick={() => handleMarkAsPaid(inv)} title="Marcar como Pagada" variant="neutral" className="bg-white border border-slate-100 hover:border-emerald-200" />
                     )}
                     <IconButton icon={<ACTION_ICONS.view className="text-blue-500" />} onClick={() => setViewingLinkedInvoice(inv)} title="Ver Enlaces a OC" variant="neutral" className="bg-white border border-slate-100 hover:border-blue-200" />
                     <IconButton icon={<ACTION_ICONS.edit className="text-blue-600" />} onClick={() => handleEdit(inv)} disabled={inv.estado === 'Anulada'} title="Editar" variant="neutral" className="bg-white border border-slate-100 hover:border-blue-300" />
                     <IconButton icon={<ACTION_ICONS.delete className="text-red-500" />} onClick={() => checkLinksAndPromptDelete(inv)} title={inv.estado === 'Anulada' ? 'Eliminar Definitivamente' : 'Anular Factura'} variant="neutral" className="bg-white border border-slate-100 hover:border-red-200" />
                </div>
            ),
            width: "150px"
        }
    );

    return cols;
  }, [mainFilter, subFilter, config.showDueDate, formatMoney, getBadgeVariant, handleEdit, checkLinksAndPromptDelete, handleMarkAsPaid]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage 
        title="Gestión de Facturación" 
        subtitle="Control centralizado de documentos fiscales y comerciales."
      >
      
      <div className="flex items-center justify-between mb-6 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm transition-all gap-4">
            <div className="flex items-center gap-3 w-full">
                {/* GRUPO 1: TIPO PRINCIPAL */}
                <div className="flex bg-slate-100 p-1 rounded-lg flex-none h-9">
                    <button 
                        onClick={() => setMainFilter('CXC')} 
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center ${mainFilter === 'CXC' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <FiDollarSign className="mr-1.5" /> Cobrar
                    </button>
                    <button 
                        onClick={() => setMainFilter('CXP')} 
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center ${mainFilter === 'CXP' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <FiShoppingBag className="mr-1.5" /> Pagar
                    </button>
                    <button 
                        onClick={() => setMainFilter('ALL')} 
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center ${mainFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <FiFileText className="mr-1.5" /> Todas
                    </button>
                </div>

                <div className="h-6 w-[1px] bg-slate-100" />

                {/* GRUPO 2: SUBTIPO */}
                <div className="flex bg-slate-100 p-1 rounded-lg flex-none h-9">
                    <button 
                        onClick={() => setSubFilter('CONTADO')} 
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center ${subFilter === 'CONTADO' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Contado
                    </button>
                    <button 
                        onClick={() => setSubFilter('CREDITO')} 
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center ${subFilter === 'CREDITO' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Crédito
                    </button>
                    <button 
                        onClick={() => setSubFilter('ALL')} 
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all flex items-center ${subFilter === 'ALL' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Ambas
                    </button>
                </div>

                <div className="h-6 w-[1px] bg-slate-100" />

                {/* GRUPO 3: MONEDA */}
                <div className="flex bg-slate-100/50 p-1 rounded-lg flex-none border border-slate-200/50 h-9">
                    <button onClick={() => setFilterCurrency('CRC')} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${filterCurrency === 'CRC' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>CRC</button>
                    <button onClick={() => setFilterCurrency('USD')} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${filterCurrency === 'USD' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>USD</button>
                    <button onClick={() => setFilterCurrency('AMBAS')} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${filterCurrency === 'AMBAS' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Ambas</button>
                </div>
            </div>

            <ActionButton 
                onClick={() => setShowExportModal(true)} 
                variant="secondary"
                label="Exportar"
                icon={<ACTION_ICONS.excel />}
                className="h-9 px-4 shadow-sm rounded-lg border-slate-200 text-[9px] font-black uppercase tracking-wider flex-none"
            />
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex justify-between items-center">
              <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Facturado (USD)</p>
                  <p className="text-xl font-black text-blue-900">{formatMoney(totals.totalUSD, 'USD')}</p>
              </div>
              <div className="text-right">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Saldo Pendiente (USD)</p>
                  <p className="text-xl font-black text-red-600">{formatMoney(totals.balanceUSD, 'USD')}</p>
              </div>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex justify-between items-center">
              <div>
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Facturado (CRC)</p>
                  <p className="text-xl font-black text-emerald-900">{formatMoney(totals.totalCRC, 'CRC')}</p>
              </div>
              <div className="text-right">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Saldo Pendiente (CRC)</p>
                  <p className="text-xl font-black text-red-600">{formatMoney(totals.balanceCRC, 'CRC')}</p>
              </div>
          </div>
      </div>

      <Toolbar
        left={
            <div>
              {selectedId ? (
                <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-xl transition-all duration-300">
                    <span className="text-xs font-bold text-yellow-800">Mostrando resultado de búsqueda</span>
                    <ActionButton 
                        onClick={onClearSelectedId} 
                        label="Ver todos" 
                        variant="secondary" 
                        className="h-7 px-3 text-[10px] bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                    />
                </div>
              ) : (
                <h4 className={`text-lg font-black uppercase tracking-tight ${config.color === 'red' ? 'text-red-900' : (config.color === 'slate' ? 'text-slate-900' : 'text-blue-900')}`}>
                    {config.title} <span className="text-slate-300 mx-2">|</span> <span className="text-sm text-slate-500">{config.subtitle}</span>
                </h4>
              )}
            </div>
        }
        center={
            <div className="flex gap-2 w-full md:w-auto">
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer w-full md:w-auto">
                    <option value="all">Todos los Años</option>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer w-full md:w-auto">
                    <option value="all">Todos los Meses</option>
                    {monthNames.map((m, i) => <option key={m} value={(i+1).toString()}>{m}</option>)}
                </select>
            </div>
        }
        right={
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto items-center">
                <SearchInput 
                    placeholder="Buscar factura..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="flex-1 w-full md:w-64 transition-all duration-300 focus-within:md:w-80 lg:focus-within:w-96 z-10"
                />
                <ActionButton 
                    onClick={handleNewInvoice}
                    label="Nueva"
                    variant={config.color === 'blue' ? 'primary' : 'danger'}
                />
            </div>
        }
      />

      <div className="mt-6">
          <DataTable 
            data={mappedInvoices}
            columns={columns}
            keyExtractor={(inv: any) => inv.id} 
            isLoading={isLoading}
            emptyMessage="No hay facturas registradas."
            hasMore={hasMore}
            onLoadMore={loadMore}
            isLoadingMore={loadingMore}
            totalRecords={mappedInvoices.length}
            enableVirtualization={true}
            virtualHeight={600}
            highlightedId={selectedId}
          />
      </div>
      </ModulePage>

      {deleteConfirmation.show && deleteConfirmation.invoice && createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[400] p-4">
          <div className="bg-white w-full max-w-[650px] rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
            
            {/* Header / Icono */}
            <div className="p-8 text-center bg-white flex-none">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteConfirmation.linkedApps.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                {deleteConfirmation.linkedApps.length > 0 ? <FiLock className="text-2xl" /> : <FiAlertTriangle className="text-2xl" />}
                </div>
                
                <h3 className="text-xl font-black text-blue-950 mb-2">
                {deleteConfirmation.linkedApps.length > 0 ? (deleteConfirmation.invoice?.status === 'Anulada' ? 'Eliminación Bloqueada' : 'Anulación Bloqueada') : (deleteConfirmation.invoice?.status === 'Anulada' ? '¿Eliminar Definitivamente?' : '¿Anular Factura?')}
                </h3>
            </div>

            <div className="px-8 pb-8 overflow-y-auto custom-scrollbar flex-1">
                {deleteConfirmation.linkedApps.length > 0 ? (
                <div className="space-y-6 text-left">
                    {/* Banner de Advertencia Superior */}
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-4 items-start shadow-sm animate-in fade-in slide-in-from-top-2">
                        <FiShield className="text-red-600 text-lg mt-0.5"  />
                        <div>
                            <h4 className="text-xs font-black text-red-800 uppercase tracking-wide">Control de Integridad Contable</h4>
                            <p className="text-[11px] font-bold text-red-700 leading-relaxed mt-1">
                                Esta factura tiene movimientos financieros asociados y NO puede ser anulada para proteger la integridad del sistema.
                            </p>
                        </div>
                    </div>
                    
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Esta factura está ligada a los siguientes documentos financieros:</p>
                        
                        {/* Lista Profesional de Relaciones */}
                        <div className="space-y-2 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                            {deleteConfirmation.linkedApps.map(app => (
                                <div key={app.id} className="bg-white hover:bg-slate-50 p-4 border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-blue-900 uppercase">Orden de Compra #{app.ocNumber}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[300px]">{app.provider}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight block mb-0.5">Comprometido</span>
                                        <span className="font-mono font-black text-slate-700 text-sm">{formatCurrency(app.appliedAmount, deleteConfirmation.invoice?.currency ?? 'USD')}</span>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Footer de Total Bloqueado */}
                            <div className="bg-slate-50 p-4 flex justify-between items-center border-t border-slate-100">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Comprometido en OCs:</span>
                                <span className="font-mono font-black text-blue-900 text-lg">{formatCurrency(totalBlocked, deleteConfirmation.invoice?.currency ?? 'USD')}</span>
                            </div>
                        </div>
                        
                        <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[11px] font-bold text-slate-600 text-center leading-relaxed">
                                <FiInfo className="text-blue-400 mr-1"  /> No es posible anular esta factura mientras existan documentos financieros asociados.
                            </p>
                        </div>
                    </div>
                </div>
                ) : (
                <div className="text-center py-4">
                    {deleteConfirmation.isValidating ? (
                        <div className="flex flex-col items-center gap-3">
                            <FiLoader className="text-blue-500 text-2xl animate-spin"  />
                            <p className="text-xs font-bold text-slate-400 uppercase">Validando integridad financiera...</p>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm font-bold leading-relaxed">
                            {deleteConfirmation.invoice?.status === 'Anulada' ? (
                                <>
                                    Esta acción eliminará <span className="text-red-600 font-black uppercase">definitivamente</span> el registro de la base de datos.<br/>
                                    <span className="text-slate-400 font-bold text-xs">Esta acción no se puede deshacer.</span>
                                </>
                            ) : (
                                <>
                                    Esta acción marcará la factura como anulada. <br/>
                                    <span className="text-blue-600 font-black uppercase text-xs">Esta acción revertirá el impacto financiero de la factura.</span>
                                </>
                            )}
                        </p>
                    )}
                </div>
                )}
            </div>

            {/* Footer de Acciones */}
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3 flex-none">
              <button 
                onClick={() => setDeleteConfirmation({ show: false, invoice: null, linkedApps: [], isProcessing: false, isValidating: false })} 
                className="flex-1 py-4 text-slate-500 font-bold uppercase text-xs hover:bg-white hover:shadow-sm rounded-2xl transition-all"
                disabled={deleteConfirmation.isProcessing}
              >
                {deleteConfirmation.linkedApps.length > 0 ? 'Cerrar' : 'Cancelar'}
              </button>
              
              {deleteConfirmation.linkedApps.length === 0 && !deleteConfirmation.isValidating && (
                <button 
                  onClick={executeAnulacion} 
                  disabled={deleteConfirmation.isProcessing}
                  className="flex-[1.5] py-4 bg-red-600 text-white font-black uppercase text-xs rounded-xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {deleteConfirmation.isProcessing ? (
                    <>
                      <FiLoader className="animate-spin"  /> Procesando anulación...
                    </>
                  ) : (
                    'Confirmar Anulación'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <InvoiceModal 
        show={showModal} 
        onClose={() => setShowModal(false)} 
        onSave={handleSaveInvoice}
        initialData={editingInvoice}
        isLinkedToOC={isInvoiceLinked}
        existingProviders={existingProviders}
      />

      <InvoiceExportModal 
        show={showExportModal}
        onClose={() => setShowExportModal(false)}
        availableYears={availableYears}
      />

      <InvoiceLinkedOCsModal 
        show={!!viewingLinkedInvoice}
        onClose={() => setViewingLinkedInvoice(null)}
        invoice={viewingLinkedInvoice}
      />
    </div>
  );
};