
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PurchaseOrderCalculated, POApplication } from './types';
import { User } from '@/utils/types';
import { useAttachments } from '../../attachments/useAttachments';
import { useInvoices } from '../invoices/useInvoices';
import { useConfirm, StatusBadge, ActionButton, IconButton, ACTION_ICONS, DataTable, TableColumn } from '../../../design-system';
import { formatCurrency } from '../../../utils/formatCurrency';
import { LinkInvoiceModal } from './LinkInvoiceModal';
import { useAuditPermanence } from '@/hooks/useAuditPermanence';
import { EditApplicationModal } from './EditApplicationModal';
import { FiX, FiDownload, FiFolder, FiFileText } from "react-icons/fi";
import { FaFileInvoice } from "react-icons/fa";
import { triggerFileDownload } from '../../../utils/fileUtils';

// Fix: Added missing interface for PurchaseOrderDetail
interface PurchaseOrderDetailProps {
  order: PurchaseOrderCalculated;
  applications: POApplication[];
  allApplications: POApplication[];
  onClose: () => void;
  currentUser: User;
  onLinkInvoice: (invoiceId: string, invoiceNumber: string, amount: number, invoiceTotal: number) => Promise<void>;
  onUnlinkInvoice: (applicationId: string) => Promise<void>;
  onUpdateApplication: (appId: string, newAmount: number) => Promise<void>;
}

export const PurchaseOrderDetail: React.FC<PurchaseOrderDetailProps> = ({ 
  order, applications, allApplications, onClose, currentUser, onLinkInvoice, onUnlinkInvoice, onUpdateApplication 
}) => {
  useAuditPermanence({
    module: 'Finanzas',
    submodule: 'Detalle de Orden de Compra',
    recordId: order.id,
    recordCode: order.ocNumber,
    enabled: true
  });
  const { all: attachments } = useAttachments('purchase_orders', order.id);
  const { invoices: allInvoices } = useInvoices(currentUser);
  const confirm = useConfirm();

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingApp, setEditingApp] = useState<POApplication | null>(null);

  const handleUnlink = async (app: POApplication) => {
    const approved = await confirm({
      title: "¿Desvincular Factura?",
      description: `Se desvinculará la factura #${app.invoiceNumber} de esta OC.`,
      confirmLabel: "Desvincular",
      variant: "danger"
    });

    if (approved) {
      await onUnlinkInvoice(app.id);
    }
  };

  const columns: TableColumn<POApplication>[] = [
    { 
      header: 'Factura', 
      render: (app) => <span className="font-bold text-blue-900">#{app.invoiceNumber}</span> 
    },
    { 
      header: 'Fecha Vínculo', 
      render: (app) => <span className="text-slate-500">{new Date(app.date).toLocaleDateString()}</span> 
    },
    { 
      header: 'Monto Aplicado', 
      align: 'right', 
      render: (app) => <span className="font-black text-slate-700">{formatCurrency(app.appliedAmount, order.currency)}</span> 
    },
    { 
      header: 'Estado', 
      align: 'center', 
      render: (app) => <StatusBadge label={app.status === 'voided' ? 'Anulada' : 'Activa'} variant={app.status === 'voided' ? 'danger' : 'success'} /> 
    },
    {
      header: 'Acciones',
      align: 'center',
      render: (app) => (
        <div className="flex justify-center gap-2">
          {app.status !== 'voided' && (
            <IconButton icon={<ACTION_ICONS.edit />} onClick={() => setEditingApp(app)} variant="primary" title="Editar Monto" />
          )}
          <IconButton icon={<ACTION_ICONS.delete />} onClick={() => handleUnlink(app)} variant="danger" title="Desvincular" />
        </div>
      )
    }
  ];

  return createPortal(
    <div className="fixed inset-0 bg-slate-50 z-[250] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-none shadow-sm flex justify-between items-center z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
              Detalle de Orden de Compra
            </span>
            <span className="text-slate-400 font-mono text-xs font-bold">#{order.ocNumber}</span>
          </div>
          <h2 className="text-xl font-black text-blue-950 uppercase tracking-tight">{order.provider}</h2>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all">
          <FiX className="text-lg"  />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50/50">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Total Orden</p>
              <p className="text-2xl font-black text-slate-700">{formatCurrency(order.totalAmount, order.currency)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Monto Utilizado</p>
              <p className="text-2xl font-black text-blue-600">{formatCurrency(order.usedAmount, order.currency)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Saldo Disponible</p>
              <p className={`text-2xl font-black ${order.availableBalance <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {formatCurrency(order.availableBalance, order.currency)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Estado</p>
              <div className="mt-1">
                <StatusBadge label={order.status} variant={order.status === 'ABIERTA' ? 'success' : 'neutral'} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Facturas Vinculadas</h3>
              <ActionButton label="Vincular Factura" onClick={() => setShowLinkModal(true)} disabled={order.status === 'CERRADA' || order.availableBalance <= 0} />
            </div>
            <DataTable data={applications} columns={columns} keyExtractor={(app) => app.id} emptyMessage="No hay facturas ligadas a esta orden." />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Archivos y Documentos</h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">Expediente digital vinculado a esta OC</p>
              </div>
            </div>

            <div className="p-6">
              {attachments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attachments.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                           {file.type === 'Factura' ? <FaFileInvoice /> : <FiFileText />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-blue-950 truncate" title={file.name}>{file.name}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase">{file.type} • {new Date(file.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                            try {
                                const response = await fetch(file.url);
                                const blob = await response.blob();
                                await triggerFileDownload(blob, file.name);
                            } catch(e) {
                                console.error("Error downloading file:", e);
                                if (typeof window !== 'undefined' && !(window as any).Capacitor?.isNativePlatform()) {
                                    const link = document.createElement('a');
                                    link.href = file.url;
                                    link.download = file.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                } else {
                                    alert(`No se pudo descargar el archivo: ${e}`);
                                }
                            }
                        }}
                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-sm border border-slate-100 transition-all"
                        title="Descargar"
                      >
                        <FiDownload className="text-xs"  />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                   <FiFolder className="text-slate-200 text-4xl mb-3"  />
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay archivos adjuntos en esta orden.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {showLinkModal && (
        <LinkInvoiceModal 
          show={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          onSubmit={onLinkInvoice}
          order={order}
          allInvoices={allInvoices}
          allApplications={allApplications}
        />
      )}

      {editingApp && (
        <EditApplicationModal 
          show={!!editingApp}
          onClose={() => setEditingApp(null)}
          onUpdate={onUpdateApplication}
          application={editingApp}
          invoice={allInvoices.find(i => i.id === editingApp.invoiceId)!}
          order={order}
          allApplications={allApplications}
        />
      )}
    </div>,
    document.body
  );
};
