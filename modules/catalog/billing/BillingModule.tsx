import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useBilling } from './useBilling';
import { BillingInvoice, BillingType, PaymentMode, CreateInvoiceDTO } from './billing.types';
import { User } from '@/types';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { formatCurrency } from '@/utils/formatCurrency';
import { ConfirmModal, DataTable, TableColumn, StatusBadge, SearchInput, IconButton, ActionButton, ACTION_ICONS } from '@/design-system';
import { FiDollarSign, FiFileText, FiX } from "react-icons/fi";

interface BillingModuleProps {
  currentUser: User;
}

export const BillingModule: React.FC<BillingModuleProps> = ({ currentUser }) => {
  const { invoices, isLoading, createInvoice, deleteInvoice, hasMore, loadMore, loadingMore } = useBilling(currentUser);
  
  // Estado de UI
  const [activeTab, setActiveTab] = useState<BillingType>('COBRAR');
  const [activeSubTab, setActiveSubTab] = useState<PaymentMode>('CREDITO');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Delete Guard State
  const [deleteGuard, setDeleteGuard] = useState<{ show: boolean, id: string | null }>({ show: false, id: null });

  // Estado del Formulario
  const [formData, setFormData] = useState<Partial<CreateInvoiceDTO>>({
    currency: 'USD',
    subtotal: 0,
    taxAmount: 0
  });

  // Filtrado de Datos
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchType = inv.type === activeTab;
      const matchMode = inv.mode === activeSubTab;
      const matchSearch = inv.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (inv.projectName && inv.projectName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchType && matchMode && matchSearch;
    });
  }, [invoices, activeTab, activeSubTab, searchTerm]);

  // Totales para Dashboard Rápido
  const totals = useMemo(() => {
    return filteredInvoices.reduce((acc, curr) => {
        if (curr.currency === 'USD') {
            acc.usdTotal += curr.totalAmount;
            acc.usdBalance += curr.balance;
        } else {
            acc.crcTotal += curr.totalAmount;
            acc.crcBalance += curr.balance;
        }
        return acc;
    }, { usdTotal: 0, usdBalance: 0, crcTotal: 0, crcBalance: 0 });
  }, [filteredInvoices]);

  const handleOpenModal = () => {
    setFormData({
      type: activeTab,
      mode: activeSubTab,
      currency: 'USD',
      subtotal: 0,
      taxAmount: 0,
      issueDate: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.entityName || !formData.issueDate || formData.subtotal === undefined) {
        alert("Complete los campos obligatorios");
        return;
    }

    try {
        await createInvoice(formData as CreateInvoiceDTO);
        setShowModal(false);
    } catch (error: any) {
        alert(error.message);
    }
  };

  const handleDeleteClick = (id: string) => {
      setDeleteGuard({ show: true, id });
  };

  const confirmDelete = async () => {
      if (deleteGuard.id) {
          await deleteInvoice(deleteGuard.id);
          setDeleteGuard({ show: false, id: null });
      }
  };

  const getBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
      switch(status) {
          case 'PAGADA': return 'success';
          case 'PENDIENTE': return 'warning';
          case 'VENCIDA': return 'danger';
          case 'PARCIAL': return 'info';
          case 'CANCELADA': return 'neutral';
          default: return 'neutral';
      }
  };

  // Definición de columnas
  const columns = useMemo<TableColumn<BillingInvoice>[]>(() => {
    const cols: TableColumn<BillingInvoice>[] = [
        {
            header: activeTab === 'COBRAR' ? 'Cliente' : 'Proveedor',
            render: (inv) => <span className="font-bold text-blue-950">{inv.entityName}</span>
        },
        {
            header: 'Proyecto / Referencia',
            render: (inv) => <span className="text-slate-500 font-medium">{inv.projectName || '---'}</span>
        },
        {
            header: 'Emisión',
            align: 'center',
            render: (inv) => <span className="font-mono text-slate-500">{inv.issueDate}</span>
        }
    ];

    if (activeSubTab === 'CREDITO') {
        cols.push({
            header: 'Vencimiento',
            align: 'center',
            render: (inv) => <span className="font-mono text-slate-500">{inv.dueDate || '---'}</span>
        });
    }

    cols.push(
        {
            header: 'Total',
            align: 'right',
            render: (inv) => <span className="font-black text-slate-700">{formatCurrency(inv.totalAmount, inv.currency)}</span>
        }
    );

    if (activeSubTab === 'CREDITO') {
        cols.push({
            header: 'Saldo',
            align: 'right',
            render: (inv) => <span className="font-black text-red-600">{formatCurrency(inv.balance, inv.currency)}</span>
        });
    }

    cols.push(
        {
            header: 'Estado',
            align: 'center',
            render: (inv) => <StatusBadge label={inv.status} variant={getBadgeVariant(inv.status)} />
        },
        {
            header: 'Acciones',
            align: 'center',
            render: (inv) => (
                <IconButton 
                    icon={<ACTION_ICONS.delete />} 
                    onClick={() => handleDeleteClick(inv.id)} 
                    variant="danger" 
                    title="Eliminar"
                />
            )
        }
    );

    return cols;
  }, [activeTab, activeSubTab]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <div className="w-full space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 animate-in fade-in">
        
        <ModuleHeader 
            title="Gestión de Facturación" 
            subtitle="Control de Cuentas por Cobrar y Pagar"
        />

        <div className="flex justify-end mb-6">
            <div className="bg-slate-100 p-1 rounded-xl flex w-full md:w-auto">
                <ActionButton 
                    onClick={() => setActiveTab('COBRAR')}
                    label="CXC (Ingresos)"
                    icon={<FiDollarSign />}
                    variant={activeTab === 'COBRAR' ? 'primary' : 'ghost'}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'COBRAR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                />
                <ActionButton 
                    onClick={() => setActiveTab('PAGAR')}
                    label="CXP (Gastos)"
                    icon={<FiFileText />}
                    variant={activeTab === 'PAGAR' ? 'danger' : 'ghost'}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'PAGAR' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                />
            </div>
        </div>

        {/* Sub-Tabs y Filtros */}
        <div className="flex flex-col md:flex-row gap-6 mb-6 justify-between items-end">
            <div className="flex gap-4">
                <ActionButton 
                    onClick={() => setActiveSubTab('CREDITO')}
                    label="Crédito (Pendientes)"
                    variant="ghost"
                    className={`pb-2 border-b-2 font-bold text-xs uppercase tracking-wide transition-all rounded-none ${activeSubTab === 'CREDITO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-500'}`}
                />
                <ActionButton 
                    onClick={() => setActiveSubTab('CONTADO')}
                    label="Contado (Histórico)"
                    variant="ghost"
                    className={`pb-2 border-b-2 font-bold text-xs uppercase tracking-wide transition-all rounded-none ${activeSubTab === 'CONTADO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-500'}`}
                />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <SearchInput 
                        placeholder={activeTab === 'COBRAR' ? "Buscar cliente..." : "Buscar proveedor..."}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <ActionButton 
                    onClick={handleOpenModal}
                    label="Nueva Factura"
                    icon={<ACTION_ICONS.add />}
                    variant="primary"
                />
            </div>
        </div>

        {/* Resumen Rápido */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total USD</p>
                <p className="text-lg font-bold text-slate-700">{formatCurrency(totals.usdTotal, 'USD')}</p>
            </div>
            <div className={`border rounded-xl p-3 ${activeTab === 'COBRAR' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest ${activeTab === 'COBRAR' ? 'text-blue-400' : 'text-red-400'}`}>Por Cobrar/Pagar USD</p>
                <p className={`text-lg font-bold ${activeTab === 'COBRAR' ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(totals.usdBalance, 'USD')}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total CRC</p>
                <p className="text-lg font-bold text-slate-700">{formatCurrency(totals.crcTotal, 'CRC')}</p>
            </div>
            <div className={`border rounded-xl p-3 ${activeTab === 'COBRAR' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest ${activeTab === 'COBRAR' ? 'text-blue-400' : 'text-red-400'}`}>Por Cobrar/Pagar CRC</p>
                <p className={`text-lg font-bold ${activeTab === 'COBRAR' ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(totals.crcBalance, 'CRC')}</p>
            </div>
        </div>

        <DataTable 
            data={filteredInvoices}
            columns={columns}
            keyExtractor={(inv: BillingInvoice) => inv.id}
            isLoading={isLoading}
            emptyMessage="No hay registros en esta categoría."
            hasMore={hasMore}
            onLoadMore={loadMore}
            isLoadingMore={loadingMore}
            enableVirtualization={true}
            virtualHeight={600}
        />
      </div>

      {/* Modal de Creación */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-none">
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Registrar Factura</h3>
                    <IconButton 
                        icon={<FiX />} 
                        onClick={() => setShowModal(false)} 
                        variant="ghost"
                        className="text-slate-400 hover:text-red-500"
                    />
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                        
                        {/* Tipo y Modalidad (Readonly visual context) */}
                        <div className="flex gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${activeTab === 'COBRAR' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{activeTab}</span>
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600">{activeSubTab}</span>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                                {activeTab === 'COBRAR' ? 'Cliente' : 'Proveedor'} <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                value={formData.entityName || ''}
                                onChange={e => setFormData({...formData, entityName: e.target.value})}
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Proyecto / Referencia</label>
                            <input 
                                type="text" 
                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                value={formData.projectName || ''}
                                onChange={e => setFormData({...formData, projectName: e.target.value})}
                                placeholder="Opcional"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha Emisión <span className="text-red-500">*</span></label>
                                <input 
                                    type="date" 
                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                    value={formData.issueDate}
                                    onChange={e => setFormData({...formData, issueDate: e.target.value})}
                                    required
                                />
                            </div>
                            {activeSubTab === 'CREDITO' && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha Vencimiento <span className="text-red-500">*</span></label>
                                    <input 
                                        type="date" 
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                        value={formData.dueDate || ''}
                                        onChange={e => setFormData({...formData, dueDate: e.target.value})}
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Moneda</label>
                                <select 
                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none"
                                    value={formData.currency}
                                    onChange={e => setFormData({...formData, currency: e.target.value as any})}
                                >
                                    <option value="USD">USD</option>
                                    <option value="CRC">CRC</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Subtotal <span className="text-red-500">*</span></label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                    value={formData.subtotal}
                                    onChange={e => setFormData({...formData, subtotal: parseFloat(e.target.value) || 0})}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Impuestos</label>
                            <input 
                                type="number" 
                                step="0.01"
                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                value={formData.taxAmount}
                                onChange={e => setFormData({...formData, taxAmount: parseFloat(e.target.value) || 0})}
                            />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl text-right">
                            <span className="text-xs font-bold text-slate-500 uppercase mr-4">Total General:</span>
                            <span className="text-xl font-black text-blue-900">
                                {formatCurrency((formData.subtotal || 0) + (formData.taxAmount || 0), formData.currency as any)}
                            </span>
                        </div>

                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 flex-none">
                        <ActionButton 
                            type="button" 
                            onClick={() => setShowModal(false)} 
                            label="Cancelar"
                            variant="ghost"
                            className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs hover:bg-slate-100 rounded-xl transition-colors"
                        />
                        <ActionButton 
                            type="submit" 
                            label="Guardar"
                            variant="primary"
                            className="flex-1 py-3 bg-blue-600 text-white font-black uppercase text-xs rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                        />
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {/* Delete Guard */}
      <ConfirmModal
        show={deleteGuard.show}
        onClose={() => setDeleteGuard({ show: false, id: null })}
        onConfirm={confirmDelete}
        title="¿Eliminar Factura?"
        description="Esta acción es irreversible y podría afectar el balance contable."
      />
    </div>
    </div>
  );
};