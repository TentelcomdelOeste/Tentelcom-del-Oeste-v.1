import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePurchaseOrders } from './usePurchaseOrders';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';
import { PurchaseOrderCalculated, PurchaseOrder } from './types';
import { User } from '../../../utils/types';
import { ModuleHeader } from '../../../components/ui/ModuleHeader';
import { 
  Toolbar, 
  ActionButton, 
  SearchInput, 
  DataTable, 
  TableColumn, 
  StatusBadge, 
  IconButton, 
  ACTION_ICONS, 
  useConfirm 
} from '../../../design-system';
import { formatCurrency } from '../../../utils/formatCurrency';
import { AttachmentUploader } from '../../attachments/AttachmentUploader';

import { FiSlash, FiFileText } from "react-icons/fi";

interface PurchaseOrderModuleProps {
  currentUser: User;
}

const PurchaseOrderModule: React.FC<PurchaseOrderModuleProps> = ({ currentUser }) => {
  const { 
    orders, 
    isLoading, 
    createOrder, 
    updateOrder, 
    deleteOrder,
    linkInvoiceToOrder,
    unlinkInvoice,
    updateInvoiceLink,
    applications,
    allApplicationsRaw,
    hasMoreOrders,
    loadMore,
    loading
  } = usePurchaseOrders(currentUser);
  
  const hasMore = hasMoreOrders;
  const loadingMore = loading; // Map loading to loadingMore for DataTable compatibility
  
  const confirm = useConfirm();

  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<'USD' | 'CRC' | 'AMBAS'>('AMBAS');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrderCalculated | null>(null);
  
  const [showAttachments, setShowAttachments] = useState(false);
  const [orderForAttachments, setOrderForAttachments] = useState<PurchaseOrder | null>(null);

  const [blockedDeleteModal, setBlockedDeleteModal] = useState<{
      show: boolean;
      order: PurchaseOrder | null;
      linkedInvoices: any[]; // Using any[] to avoid import issues if POApplication is not exported or complex
  }>({ show: false, order: null, linkedInvoices: [] });

  const years = useMemo(() => {
    const uniqueYears = new Set<string>();
    orders.forEach(o => uniqueYears.add(o.issueDate.split('-')[0]));
    return Array.from(uniqueYears).sort().reverse();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = 
        o.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.ocNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const year = o.issueDate.split('-')[0];
      const matchesYear = filterYear === 'all' || year === filterYear;
      const matchesCurrency = filterCurrency === 'AMBAS' || o.currency === filterCurrency;

      return matchesSearch && matchesYear && matchesCurrency;
    });
  }, [orders, searchTerm, filterYear, filterCurrency]);

  const handleSaveOrder = async (data: any) => {
    try {
      if (editingOrder) {
        await updateOrder(editingOrder.id, data);
      } else {
        await createOrder(data);
      }
      setShowCreateModal(false);
      setEditingOrder(null);
    } catch (error: any) {
      console.error(error.message);
    }
  };

  const handleDeleteOrder = React.useCallback(async (order: PurchaseOrder) => {
    // 1. Validar si tiene facturas ligadas (Activas o Legacy)
    const linkedApps = applications.filter(app => 
        app.purchaseOrderId === order.id && 
        (app.status === 'active' || !app.status)
    );

    if (linkedApps.length > 0) {
        setBlockedDeleteModal({
            show: true,
            order,
            linkedInvoices: linkedApps
        });
        return;
    }

    // 2. Si no tiene facturas, proceder con confirmación estándar
    try {
        const approved = await confirm({
            title: "¿Eliminar Orden de Compra?",
            description: `Se eliminará la OC ${order.ocNumber}. Esta acción no se puede deshacer.`,
            confirmLabel: "Eliminar",
            variant: "danger"
        });

        if (approved) {
            await deleteOrder(order.id);
        }
    } catch (error: any) {
        console.error(error.message);
    }
  }, [applications, confirm, deleteOrder]);

  const columns = useMemo<TableColumn<PurchaseOrderCalculated>[]>(() => [
    {
      header: 'OC #',
      width: '120px',
      render: (o) => (
        <div className="flex flex-col">
          <p className="font-black text-blue-900 text-xs">{o.ocNumber}</p>
          <p className="text-[10px] font-mono text-slate-400 font-bold">{o.issueDate}</p>
        </div>
      )
    },
    {
      header: 'Proveedor',
      accessorKey: 'provider',
      width: '240px',
      className: 'font-black text-blue-950 text-xs truncate block'
    },
    {
      header: 'Total',
      align: 'right',
      width: '130px',
      render: (o) => <span className="font-bold text-slate-700 text-xs">{formatCurrency(o.totalAmount, o.currency)}</span>
    },
    {
      header: 'Disponible',
      align: 'right',
      width: '130px',
      render: (o) => (
        <span className={`font-black text-xs ${o.availableBalance <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
          {formatCurrency(o.availableBalance, o.currency)}
        </span>
      )
    },
    {
      header: 'Estado',
      align: 'center',
      width: '120px',
      render: (o) => <StatusBadge label={o.status} variant={o.status === 'ABIERTA' ? 'success' : 'neutral'} />
    },
    {
      header: 'Acciones',
      align: 'center',
      width: '180px',
      render: (o) => (
        <div className="flex justify-center gap-1.5">
          <IconButton 
            icon={<ACTION_ICONS.view />} 
            onClick={() => setViewingOrder(o)} 
            variant="primary" 
            title="Ver Detalle" 
            className="scale-90"
          />
          <IconButton 
            icon={<ACTION_ICONS.edit />} 
            onClick={() => { setEditingOrder(o); setShowCreateModal(true); }} 
            variant="primary" 
            title="Editar" 
            className="scale-90"
          />
          <IconButton 
            icon={<ACTION_ICONS.files />} 
            onClick={() => { setOrderForAttachments(o); setShowAttachments(true); }} 
            variant="warning" 
            title="Archivos" 
            className="scale-90"
          />
          <IconButton 
            icon={<ACTION_ICONS.delete />} 
            onClick={() => handleDeleteOrder(o)} 
            variant="danger" 
            title="Eliminar" 
            className="scale-90"
          />
        </div>
      )
    }
  ], [handleDeleteOrder]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4">
        <ModuleHeader 
          title="Órdenes de Compra" 
          subtitle="Gestión de compras y control presupuestario por proveedor."
        />

        <Toolbar
          left={
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full md:w-auto px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none cursor-pointer">
                <option value="all">Todos los Años</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value as any)} className="w-full md:w-auto px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none cursor-pointer">
                <option value="AMBAS">Todas las Monedas</option>
                <option value="USD">Dólares (USD)</option>
                <option value="CRC">Colones (CRC)</option>
              </select>
              <div className="w-full md:w-64">
                <SearchInput placeholder="Buscar OC..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
          }
          right={
            <ActionButton label="Nueva OC" onClick={() => { setEditingOrder(null); setShowCreateModal(true); }} />
          }
        />

        <div className="mt-6">
          <DataTable 
            data={filteredOrders} 
            columns={columns} 
            keyExtractor={(o: PurchaseOrderCalculated) => o.id} 
            isLoading={isLoading} 
            emptyMessage="No se encontraron Órdenes de Compra."
            hasMore={hasMore}
            onLoadMore={loadMore}
            isLoadingMore={loadingMore}
            enableVirtualization={true}
            virtualHeight={600}
          />
        </div>
      </div>

      <PurchaseOrderModal 
        show={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        onSubmit={handleSaveOrder} 
        initialData={editingOrder} 
      />

      {viewingOrder && (
        <PurchaseOrderDetail 
          order={viewingOrder}
          applications={applications.filter(app => app.purchaseOrderId === viewingOrder.id)}
          allApplications={allApplicationsRaw}
          onClose={() => setViewingOrder(null)}
          currentUser={currentUser}
          onLinkInvoice={(invoiceId, invoiceNumber, amount, invoiceTotal) => 
            linkInvoiceToOrder(viewingOrder.id, invoiceId, invoiceNumber, amount, invoiceTotal)
          }
          onUnlinkInvoice={unlinkInvoice}
          onUpdateApplication={updateInvoiceLink}
        />
      )}

      {showAttachments && orderForAttachments && createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[700] p-4 animate-in fade-in duration-300">
          <AttachmentUploader 
            entityType="purchase_orders"
            entityId={orderForAttachments.id}
            title="Archivos de Orden de Compra"
            subtitle={`Documentos vinculados a ${orderForAttachments.ocNumber} - ${orderForAttachments.provider}`}
            onClose={() => {
              setShowAttachments(false);
              setOrderForAttachments(null);
            }} 
          />
        </div>,
        document.body
      )}

      {blockedDeleteModal.show && blockedDeleteModal.order && createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[800] p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 text-center border-4 border-red-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-lg shadow-red-100">
                    <FiSlash className="text-2xl animate-pulse"  />
                </div>

                <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">No se puede eliminar</h3>
                <p className="text-xs font-bold text-slate-500 mb-6">
                    La Orden de Compra <span className="text-blue-600">{blockedDeleteModal.order.ocNumber}</span> tiene facturas ligadas activas.
                </p>
                
                <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left border border-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Detalle de Facturas Ligadas:</p>
                    <div className="space-y-2">
                        {blockedDeleteModal.linkedInvoices.map((app, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <FiFileText className="text-xs"  />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Factura</p>
                                        <p className="text-xs font-bold text-slate-700">{app.invoiceNumber}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Monto</p>
                                    <p className="text-xs font-black text-emerald-600">{formatCurrency(app.appliedAmount)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Total Comprometido</span>
                        <span className="text-sm font-black text-slate-800">
                            {formatCurrency(blockedDeleteModal.linkedInvoices.reduce((sum, item) => sum + item.appliedAmount, 0))}
                        </span>
                    </div>
                </div>

                <button 
                    onClick={() => setBlockedDeleteModal({ show: false, order: null, linkedInvoices: [] })} 
                    className="w-full py-3.5 bg-slate-100 text-slate-600 font-black uppercase text-xs rounded-xl hover:bg-slate-200 transition-all"
                >
                    Entendido, Cerrar
                </button>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PurchaseOrderModule;