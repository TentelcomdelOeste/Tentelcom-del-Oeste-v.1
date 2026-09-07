import React from 'react';
import { FiShoppingCart } from 'react-icons/fi';
import { StatusBadge } from '../../../../design-system';

interface ExpedienteComprasTabProps {
  purchases: any[];
}

export const ExpedienteComprasTab: React.FC<ExpedienteComprasTabProps> = ({ purchases }) => {
  const getStatusVariant = (status?: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' => {
    const s = (status || '').toLowerCase();
    if (s === 'recibido' || s === 'completado' || s === 'aprobado' || s === 'pagado') return 'success';
    if (s === 'pendiente' || s === 'en proceso' || s === 'solicitado') return 'warning';
    if (s === 'cancelado' || s === 'rechazado') return 'danger';
    return 'info';
  };

  return (
    <div className="bg-white p-5 md:p-0 rounded-2xl md:rounded-none border md:border-0 border-slate-200 shadow-sm md:shadow-none">
      {/* Header del Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
            Compras y Gastos Asociados
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Órdenes de compra, facturas de proveedores y gastos imputados a este proyecto.
          </p>
        </div>
        <span className="text-xs font-black bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg">
          {purchases.length} {purchases.length === 1 ? 'registro de compra' : 'registros de compra'}
        </span>
      </div>

      {purchases.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FiShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-bold text-sm">No hay compras o gastos registrados para este proyecto.</p>
          <p className="text-slate-400 text-xs mt-1">
            Las órdenes de compra o gastos asignados a este proyecto en el módulo de compras se sincronizarán aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Vista Escritorio: Tabla con patrón idéntico a Gestión de Proyectos / Cotizaciones */}
          <div className="hidden md:block overflow-x-auto">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-w-[850px]">
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[140px] shrink-0">
                  <span className="w-full text-center truncate">N° OC / Compra</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[200px]">
                  <span className="w-full text-left truncate">Proveedor</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Fecha</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-start px-3 border-r border-slate-200/70 flex-1 min-w-[180px]">
                  <span className="w-full text-left truncate">Descripción / Categoría</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-end px-3 border-r border-slate-200/70 w-[150px] shrink-0">
                  <span className="w-full text-right truncate">Total</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[120px] shrink-0">
                  <span className="w-full text-center truncate">Estado</span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                {purchases.map((purchase, index) => {
                  const isEven = index % 2 === 0;
                  const ocNum = purchase.purchaseNumber || purchase.ocNumber || purchase.id;
                  const supplier = purchase.supplierName || purchase.proveedor || 'Proveedor General';
                  const dateStr = purchase.date || (purchase.createdAt ? purchase.createdAt.substring(0, 10) : '—');
                  const desc = purchase.description || purchase.category || 'Compra de insumos';
                  const currency = purchase.currency || 'CRC';
                  const total = purchase.totalAmount ?? purchase.total ?? purchase.amount ?? 0;
                  const status = purchase.status || 'Registrada';

                  return (
                    <div
                      key={purchase.id}
                      className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group ${
                        isEven ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                      style={{ minHeight: '56px' }}
                    >
                      {/* N° OC */}
                      <div className="text-xs font-bold text-center justify-center flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[140px] shrink-0 font-mono">
                        <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded truncate">
                          {ocNum}
                        </span>
                      </div>

                      {/* Proveedor */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[200px]">
                        <span className="font-bold text-slate-800 text-xs truncate" title={supplier}>
                          {supplier}
                        </span>
                      </div>

                      {/* Fecha */}
                      <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[120px] shrink-0">
                        <span className="whitespace-nowrap">{dateStr}</span>
                      </div>

                      {/* Descripción */}
                      <div className="text-xs font-bold text-left justify-start flex items-center text-slate-700 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[180px]">
                        <span className="text-xs font-medium text-slate-600 truncate" title={desc}>
                          {desc}
                        </span>
                      </div>

                      {/* Total */}
                      <div className="text-xs font-bold text-right justify-end flex items-center text-slate-900 px-3 py-3 border-r border-slate-200/40 w-[150px] shrink-0 font-mono">
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

          {/* Vista Móvil: Tarjetas */}
          <div className="md:hidden space-y-3">
            {purchases.map(purchase => (
              <div key={purchase.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-black text-purple-700 font-mono">
                      {purchase.purchaseNumber || purchase.ocNumber || purchase.id}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{purchase.supplierName || purchase.proveedor || 'Proveedor'}</h4>
                  </div>
                  <StatusBadge 
                    label={purchase.status || 'Registrada'} 
                    variant={getStatusVariant(purchase.status)} 
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                  <span>{purchase.date || (purchase.createdAt ? purchase.createdAt.substring(0, 10) : 'N/A')}</span>
                  <span className="font-black text-slate-900 font-mono">
                    {purchase.currency || 'CRC'} {purchase.totalAmount ?? purchase.total ?? 0}
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
