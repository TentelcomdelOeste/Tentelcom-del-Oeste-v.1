import React from 'react';
import { FiDollarSign } from 'react-icons/fi';
import { StatusBadge } from '../../../../design-system';

interface ExpedienteFacturacionTabProps {
  invoices: any[];
}

export const ExpedienteFacturacionTab: React.FC<ExpedienteFacturacionTabProps> = ({ invoices }) => {
  const getStatusVariant = (status?: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' => {
    const s = (status || '').toLowerCase();
    if (s === 'pagada' || s === 'cobrada' || s === 'aprobada') return 'success';
    if (s === 'pendiente' || s === 'emitida') return 'warning';
    if (s === 'anulada' || s === 'cancelada') return 'danger';
    return 'info';
  };

  return (
    <div className="bg-white p-5 md:p-0 rounded-2xl md:rounded-none border md:border-0 border-slate-200 shadow-sm md:shadow-none">
      {/* Header del Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Facturas Asociadas al Proyecto
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Facturas emitidas y registradas en el módulo de finanzas vinculadas a este proyecto.
          </p>
        </div>
        <span className="text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-lg">
          {invoices.length} {invoices.length === 1 ? 'factura' : 'facturas'}
        </span>
      </div>

      {invoices.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FiDollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">No hay facturas asociadas a este proyecto.</p>
          <p className="text-slate-400 text-xs mt-1">
            Al emitir o vincular facturas con este proyecto, se mostrarán reflejadas aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Vista Escritorio: Tabla con patrón idéntico a Gestión de Proyectos / Cotizaciones */}
          <div className="hidden md:block overflow-x-auto">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-w-[750px]">
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[140px] shrink-0">
                  <span className="w-full text-center truncate">N° Factura</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[140px] shrink-0">
                  <span className="w-full text-center truncate">Fecha Emisión</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[180px]">
                  <span className="w-full text-left truncate">Detalle / Cliente</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-end px-3 border-r border-slate-200/70 w-[160px] shrink-0">
                  <span className="w-full text-right truncate">Monto Total</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Estado</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                {invoices.map((invoice, index) => {
                  const isEven = index % 2 === 0;
                  const invNum = invoice.invoiceNumber || invoice.id;
                  const dateStr = invoice.issueDate || invoice.date || '—';
                  const detail = invoice.clientName || invoice.description || 'Facturación de servicios';
                  const currency = invoice.currency || 'CRC';
                  const total = invoice.totalAmount ?? invoice.amount ?? 0;
                  const status = invoice.status || 'Emitida';

                  return (
                    <div
                      key={invoice.id}
                      className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group ${
                        isEven ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                      style={{ minHeight: '56px' }}
                    >
                      {/* N° Factura */}
                      <div className="text-xs font-bold text-center justify-center flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[140px] shrink-0 font-mono">
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded truncate">
                          {invNum}
                        </span>
                      </div>

                      {/* Fecha */}
                      <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[140px] shrink-0">
                        <span className="whitespace-nowrap">{dateStr}</span>
                      </div>

                      {/* Detalle */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-slate-700 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[180px]">
                        <span className="text-xs font-medium text-slate-800 truncate" title={detail}>
                          {detail}
                        </span>
                      </div>

                      {/* Monto Total */}
                      <div className="text-xs font-bold text-right justify-end flex items-center text-slate-900 px-3 py-3 border-r border-slate-200/40 w-[160px] shrink-0 font-mono">
                        <span className="font-black text-slate-900 text-xs">
                          {currency} {typeof total === 'number' ? total.toLocaleString() : total}
                        </span>
                      </div>

                      {/* Estado */}
                      <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[120px] shrink-0">
                        <StatusBadge label={status} variant={getStatusVariant(status)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vista Móvil: Tarjetas Móviles Intactas */}
          <div className="md:hidden space-y-3">
            {invoices.map(invoice => (
              <div key={invoice.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-indigo-700">Factura: {invoice.invoiceNumber || invoice.id}</p>
                  <p className="text-xs text-slate-500 mt-1">Fecha: {invoice.issueDate || invoice.date || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{invoice.currency || 'CRC'} {invoice.totalAmount ?? invoice.amount ?? 0}</p>
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-md uppercase mt-1 inline-block">
                    {invoice.status || 'Emitida'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
