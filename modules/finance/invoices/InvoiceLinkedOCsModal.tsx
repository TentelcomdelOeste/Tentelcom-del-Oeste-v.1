import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Invoice } from './invoice.types';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { POApplication, PurchaseOrder } from '../purchase_orders/types';
import { formatCurrency } from '../../../utils/formatCurrency';
import { DataTable, TableColumn, StatusBadge } from '../../../design-system';
import { FiX } from "react-icons/fi";

interface InvoiceLinkedOCsModalProps {
  show: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export const InvoiceLinkedOCsModal: React.FC<InvoiceLinkedOCsModalProps> = ({ show, onClose, invoice }) => {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<{ app: POApplication; oc: PurchaseOrder | null }[]>([]);

  useEffect(() => {
    if (show && invoice) {
      setLoading(true);
      const fetchLinks = async () => {
        try {
          // 1. Buscar aplicaciones (enlaces) activos para esta factura
          const appsRef = collection(db, 'purchase_order_applications');
          const q = query(
            appsRef, 
            where('invoiceId', '==', invoice.id)
          );
          const appSnapshot = await getDocs(q);
          
          const rawApps = appSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as POApplication))
            .filter(app => app.status !== 'deleted'); // Filtrar eliminados lógicamente

          // 2. Buscar detalles de las OCs relacionadas
          const linksData = await Promise.all(rawApps.map(async (app) => {
            let ocData: PurchaseOrder | null = null;
            if (app.purchaseOrderId) {
              const ocRef = doc(db, 'purchase_orders', app.purchaseOrderId);
              const ocSnap = await getDoc(ocRef);
              if (ocSnap.exists()) {
                ocData = { id: ocSnap.id, ...ocSnap.data() } as PurchaseOrder;
              }
            }
            return { app, oc: ocData };
          }));

          setLinks(linksData);
        } catch (error) {
          console.error("Error cargando enlaces a OC:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchLinks();
    } else {
      setLinks([]);
    }
  }, [show, invoice]);

  // Cálculos de resumen
  const summary = useMemo(() => {
    if (!invoice) return { total: 0, applied: 0, remaining: 0 };
    
    const totalApplied = links.reduce((acc, curr) => acc + (curr.app.appliedAmount || 0), 0);
    const invoiceTotal = invoice.total || 0;
    const remaining = invoiceTotal - totalApplied;

    return {
        total: invoiceTotal,
        applied: totalApplied,
        remaining: remaining
    };
  }, [invoice, links]);

  // Definición de Columnas para DataTable
  const columns = useMemo<TableColumn<{ app: POApplication; oc: PurchaseOrder | null }>[]>(() => [
    {
      header: 'Número OC',
      render: ({ oc }) => (
        <span className="font-black text-blue-900">
          {oc ? oc.ocNumber : <span className="text-red-400">OC No encontrada</span>}
        </span>
      )
    },
    {
      header: 'Proveedor',
      render: ({ oc }) => <span className="font-bold text-slate-600 truncate max-w-[200px] block">{oc ? oc.provider : '---'}</span>
    },
    {
      header: 'Fecha OC',
      align: 'center',
      render: ({ oc }) => <span className="font-mono text-slate-500">{oc ? new Date(oc.issueDate).toLocaleDateString() : '---'}</span>
    },
    {
      header: 'Estado OC',
      align: 'center',
      render: ({ oc }) => oc ? (
        <StatusBadge label={oc.status} variant={oc.status === 'ABIERTA' ? 'success' : 'neutral'} />
      ) : <span className="text-slate-300">---</span>
    },
    {
      header: 'Monto Aplicado',
      align: 'right',
      render: ({ app, oc }) => (
        <span className="font-black text-slate-700">
          {formatCurrency(app.appliedAmount, oc?.currency || 'USD')}
        </span>
      )
    }
  ], []);

  if (!show || !invoice) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
          <div>
            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Detalle de Enlaces a Órdenes de Compra</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Factura #{invoice.consecutivo} - {invoice.entityName}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
          >
            <FiX className="text-lg"  />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
          
          {/* Resumen de Saldos */}
          {!loading && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Factura</p>
                    <p className="text-lg font-black text-slate-700">{formatCurrency(summary.total, invoice.currency)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Aplicado a OCs</p>
                    <p className="text-lg font-black text-blue-700">{formatCurrency(summary.applied, invoice.currency)}</p>
                </div>
                <div className={`p-4 rounded-2xl border ${summary.remaining > 0.01 ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-100 border-gray-200'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${summary.remaining > 0.01 ? 'text-emerald-600' : 'text-gray-500'}`}>Saldo Restante</p>
                    <p className={`text-lg font-black ${summary.remaining > 0.01 ? 'text-emerald-700' : 'text-gray-500'}`}>{formatCurrency(Math.max(0, summary.remaining), invoice.currency)}</p>
                </div>
            </div>
          )}

          <DataTable 
            data={links}
            columns={columns}
            keyExtractor={(item: { app: POApplication }) => item.app.id}
            isLoading={loading}
            emptyMessage="Esta factura no está ligada a ninguna Orden de Compra."
          />
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end flex-none">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};