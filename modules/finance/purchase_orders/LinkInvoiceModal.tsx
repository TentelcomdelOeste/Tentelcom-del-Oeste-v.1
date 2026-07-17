import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrderCalculated, POApplication } from './types';
import { Invoice } from '../invoices/invoice.types';
import { formatCurrency } from '../../../utils/formatCurrency';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';
import { FiX, FiAlertTriangle } from "react-icons/fi";

interface LinkInvoiceModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (invoiceId: string, invoiceNumber: string, amount: number, invoiceTotal: number) => Promise<void>;
  order: PurchaseOrderCalculated;
  allInvoices: Invoice[];
  allApplications: POApplication[];
}

export const LinkInvoiceModal: React.FC<LinkInvoiceModalProps> = ({
  show,
  onClose,
  onSubmit,
  order,
  allInvoices,
  allApplications
}) => {
  useLockBodyScroll(show);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
     setMounted(true);
  }, []);

  const safeInvoices = useMemo(() => {
    if (!Array.isArray(allInvoices)) return [];
    return allInvoices.filter(inv => inv && typeof inv === 'object' && inv.id);
  }, [allInvoices]);

  const safeApplications = useMemo(() => {
    if (!Array.isArray(allApplications)) return [];
    return allApplications.filter(app => app && typeof app === 'object' && app.invoiceId);
  }, [allApplications]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [amountToApply, setAmountToApply] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setSearchTerm('');
      setSelectedInvoice(null);
      setAmountToApply('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [show]);

  const getInvoiceStats = useCallback((invoice: Invoice) => {
    const totalApplied = safeApplications
      .filter(app => 
        app?.invoiceId === invoice.id && 
        app.status !== 'deleted'
      )
      .reduce((sum, app) => sum + (app?.appliedAmount || 0), 0);
    
    return {
        total: invoice.total || 0,
        applied: totalApplied,
        available: (invoice.total || 0) - totalApplied
    };
  }, [safeApplications]);

  const availableInvoices = useMemo(() => {
    if (!order?.id) return [];
    
    const term = searchTerm.toLowerCase();
    
    return safeInvoices.filter(inv => {
      const matchesSearch = 
        (inv.consecutivo || '').toLowerCase().includes(term) ||
        (inv.entityName || '').toLowerCase().includes(term);

      const matchesCurrency = inv.currency === order.currency;
      const isValidStatus = inv.status !== 'Anulada';

      const stats = getInvoiceStats(inv);
      const hasBalance = stats.available > 0.01; 

      const alreadyLinked = safeApplications.some(app => 
        app?.purchaseOrderId === order.id && 
        app?.invoiceId === inv.id && 
        app?.status !== 'deleted'
      );

      return matchesSearch && matchesCurrency && hasBalance && isValidStatus && !alreadyLinked;
    });
  }, [safeInvoices, searchTerm, order?.currency, safeApplications, order?.id, getInvoiceStats]);

  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setError(null);
    
    const stats = getInvoiceStats(inv);
    const ocBalance = order.availableBalance;
    const suggestAmount = Math.min(stats.available, ocBalance);
    
    setAmountToApply(suggestAmount.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedInvoice) {
      setError("Debe seleccionar una factura.");
      return;
    }

    const amount = parseFloat(amountToApply);

    if (isNaN(amount) || amount <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }

    const stats = getInvoiceStats(selectedInvoice);
    const ocBalance = order.availableBalance;

    if (amount > ocBalance + 0.01) {
      setError(`El monto excede el saldo disponible de la Orden de Compra (${formatCurrency(ocBalance, order.currency)}).`);
      return;
    }

    if (amount > stats.available + 0.01) {
      setError(`El monto excede el saldo disponible REAL de la Factura (${formatCurrency(stats.available, order.currency)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedInvoice.id, selectedInvoice.consecutivo, amount, stats.total);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al vincular.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show || !mounted) return null;
  if (typeof document === 'undefined' || !document.body) return null;

  const selectedStats = selectedInvoice ? getInvoiceStats(selectedInvoice) : null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-slate-200 bg-white flex-none">
          <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight mb-3">Ligar factura a Orden de Compra</h3>
          
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-black text-slate-800">
                      {order.ocNumber}
                  </span>
                  <span className={`text-sm font-black ${order.availableBalance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      Disp: {formatCurrency(order.availableBalance, order.currency)}
                  </span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span className="truncate max-w-[200px]" title={order.provider}>{order.provider}</span>
              </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-hidden flex flex-col">
          
          <div className="flex-1 flex flex-col min-h-0">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                Buscar Factura ({order.currency})
            </label>
            
            {selectedInvoice ? (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex justify-between items-center animate-in fade-in zoom-in-95">
                    <div>
                        <p className="text-xs font-black text-blue-900">Factura #{selectedInvoice.consecutivo}</p>
                        <p className="text-[10px] font-bold text-blue-700 uppercase">{selectedInvoice.entityName}</p>
                        {selectedStats && (
                            <p className="text-[10px] text-slate-500 mt-1">
                                Saldo en factura: <span className="font-bold">{formatCurrency(selectedStats.available, order.currency)}</span>
                            </p>
                        )}
                    </div>
                    <button 
                        type="button"
                        onClick={() => setSelectedInvoice(null)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <FiX className="text-lg"  />
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                        <input 
                            type="text"
                            placeholder="Filtrar por consecutivo o proveedor..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-none p-2 text-sm font-bold outline-none"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {availableInvoices.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 font-bold">
                                No se encontraron facturas disponibles en {order.currency}.
                            </div>
                        ) : (
                            availableInvoices.map(inv => {
                                const invStats = getInvoiceStats(inv);
                                return (
                                    <button
                                        key={inv.id}
                                        type="button"
                                        onClick={() => handleSelectInvoice(inv)}
                                        className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 flex justify-between items-center group"
                                    >
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors">#{inv.consecutivo}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[150px]">{inv.entityName}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-black text-slate-600 group-hover:text-blue-900">
                                                {formatCurrency(invStats.available, order.currency)}
                                            </span>
                                            <span className="text-[9px] text-slate-400">Disponible</span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
          </div>

          <div className="flex-none">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                Monto a Aplicar
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                {order.currency === 'USD' ? '$' : '¢'}
              </span>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                disabled={!selectedInvoice}
                value={amountToApply}
                onChange={e => {
                    setAmountToApply(e.target.value);
                    setError(null);
                }}
                className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white border font-black text-xl outline-none focus:ring-4 transition-all ${
                    !selectedInvoice ? 'bg-slate-100 text-slate-400' : 'border-slate-200 text-slate-700 focus:ring-blue-100'
                }`}
                placeholder="0.00"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs font-bold animate-pulse text-center flex items-center justify-center gap-2">
              <FiAlertTriangle  />
              {error}
            </div>
          )}

          <div className="flex gap-3 flex-none pt-2">
            <button 
                type="button"
                onClick={onClose} 
                className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs hover:bg-slate-100 rounded-xl transition-colors"
                disabled={isSubmitting}
            >
                Cancelar
            </button>
            <button 
                type="submit"
                className="flex-1 py-3 bg-blue-600 text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none transition-all"
                disabled={isSubmitting || !selectedInvoice}
            >
                {isSubmitting ? 'Procesando...' : 'Vincular'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};