import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { InventoryItem } from '../inventoryTypes';
import { User } from '../utils/types';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { DataTable, TableColumn, IconButton } from '../design-system';
import { formatCurrency } from '../utils/formatCurrency';
import { InventoryMovement } from '../inventoryMovementTypes';
import { FiX, FiMapPin, FiBox, FiDatabase, FiTag, FiClock } from "react-icons/fi";

interface InventoryDetailModalProps {
  show: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  currentUser: User;
}

export const InventoryDetailModal: React.FC<InventoryDetailModalProps> = ({ show, onClose, item, currentUser }) => {
  useLockBodyScroll(show);
  const { movements, isLoading } = useInventoryMovements(currentUser);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (show) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [show, onClose]);

  const itemMovements = useMemo(() => {
    if (!item) return [];
    return movements.filter(m => {
        // Legacy check
        if (m.inventoryItemId === item.id) return true;
        // Multi-item check
        if (m.items && m.items.some(i => i.inventoryItemId === item.id)) return true;
        return false;
    });
  }, [movements, item]);

  if (!show || !item) return null;

  const providerColumns: TableColumn<{ name: string; price: number }>[] = [
    {
      header: 'Proveedor',
      accessor: 'name',
      className: 'font-bold text-slate-700 pl-4'
    },
    {
      header: 'Precio Unit. (Sin IVA)',
      accessor: (p) => formatCurrency(p.price, item.currency || 'USD'),
      align: 'right',
      className: 'font-mono font-bold text-slate-600'
    },
    {
      header: 'IVA (13%)',
      accessor: (p) => formatCurrency(p.price * 0.13, item.currency || 'USD'),
      align: 'right',
      className: 'font-mono text-slate-500'
    },
    {
      header: 'Total',
      accessor: (p) => formatCurrency(p.price * 1.13, item.currency || 'USD'),
      align: 'right',
      className: 'font-mono font-black text-emerald-600 pr-4'
    }
  ];

  const columns: TableColumn<InventoryMovement>[] = [
      {
          header: 'Fecha',
          accessorKey: 'createdAt',
          render: (m) => {
              const date = new Date(m.createdAt);
              return (
                  <div className="flex flex-col">
                      <span className="font-bold text-slate-700">{date.toLocaleDateString()}</span>
                      <span className="text-[10px] text-slate-400">{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
              );
          }
      },
      {
          header: 'Tipo',
          accessorKey: 'type',
          render: (m) => (
              <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                  m.type === 'Entrada' ? 'bg-emerald-100 text-emerald-700' :
                  m.type === 'Salida' ? 'bg-rose-100 text-rose-700' :
                  'bg-blue-100 text-blue-700'
              }`}>
                  {m.type}
              </span>
          )
      },
      {
          header: 'Proveedor',
          render: (m) => {
              if (m.type === 'Entrada' && m.origin === 'Proveedor' && m.provider) {
                  return <span className="text-[10px] font-bold text-slate-600">{m.provider}</span>;
              }
              return <span className="text-[10px] text-slate-300 font-bold">-</span>;
          }
      },
      {
          header: 'Cant.',
          align: 'right',
          render: (m) => {
              let qty = 0;
              if (m.items && m.items.length > 0) {
                  const detail = m.items.find(i => i.inventoryItemId === item.id);
                  qty = detail ? detail.quantity : 0;
              } else {
                  qty = m.quantity;
              }
              return <span className="font-mono font-black text-slate-800">{qty}</span>;
          }
      },
      {
          header: 'Precio Unit.',
          align: 'right',
          render: (m) => {
              let price: number | undefined;
              if (m.items && m.items.length > 0) {
                  const detail = m.items.find(i => i.inventoryItemId === item.id);
                  price = detail ? detail.unitPrice : undefined;
              } else {
                  // Legacy support or direct mapping if available in future
                  price = undefined; 
              }
              
              return (
                  <span className="font-mono font-bold text-slate-600 text-xs">
                      {price !== undefined ? formatCurrency(price, item.currency || 'USD') : '-'}
                  </span>
              );
          }
      },
      {
          header: 'Referencia',
          render: (m) => (
              <div className="flex flex-col max-w-[150px]">
                  {m.projectCode && <span className="text-xs font-bold text-blue-600">{m.projectCode}</span>}
                  <span className="text-[10px] text-slate-500 truncate" title={m.projectName || m.observations}>
                      {m.projectName || m.observations || '-'}
                  </span>
              </div>
          )
      }
  ];

  return createPortal(
    <div 
        className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
        onClick={onClose}
    >
        <div 
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
                <div>
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Detalle del Material</h3>
                    <p className="text-xs text-slate-500 font-bold font-mono mt-1">{item.code}</p>
                </div>
                <IconButton 
                    onClick={onClose} 
                    icon={<FiX  />}
                    variant="neutral"
                    title="Cerrar"
                />
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 space-y-6">
                {/* Product Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Descripción</label>
                        <p className="text-sm font-bold text-slate-800 leading-relaxed">{item.description}</p>
                    </div>
                    
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Ubicación</label>
                         <div className="flex items-center gap-2">
                            <FiMapPin className="text-slate-300"  />
                            <p className="text-sm font-bold text-slate-800">{item.location || 'No asignada'}</p>
                         </div>
                    </div>

                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10">
                            <FiBox className="text-6xl text-blue-600"  />
                        </div>
                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Stock Actual</label>
                        <div className="flex flex-col">
                            <p className="text-3xl font-black text-blue-900 tracking-tight">
                                {(item.stock || 0) - (item.reserved || 0)} <span className="text-sm font-bold text-blue-400 ml-1">Disponible</span>
                            </p>
                            <div className="flex gap-3 mt-2">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                    Total: {item.stock} {item.unit}
                                </span>
                                {(item.reserved || 0) > 0 && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-lg border border-amber-200">
                                        Reservado: {item.reserved} {item.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10">
                            <FiDatabase className="text-6xl text-emerald-600"  />
                        </div>
                        <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Valor Total</label>
                        <p className="text-3xl font-black text-emerald-900 tracking-tight">
                            {formatCurrency((item.price || 0) * item.stock, item.currency || 'USD')}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-bold mt-2 bg-emerald-100/50 inline-block px-2 py-1 rounded-lg">
                            Unitario: {formatCurrency(item.price || 0, item.currency || 'USD')}
                        </p>
                    </div>
                </div>

                {/* Precios por Proveedor Section */}
                {item.providers && item.providers.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                <FiTag className="text-slate-400"  /> Precios por Proveedor
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                                {item.providers.length} proveedores
                            </span>
                        </div>
                        <DataTable<{ name: string; price: number }>
                            data={item.providers}
                            columns={providerColumns}
                            keyExtractor={(p, idx) => `${p.name}-${idx}`}
                        />
                    </div>
                )}

                {/* History Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <FiClock className="text-slate-400"  /> Historial de Movimientos
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                            {itemMovements.length} registros
                        </span>
                    </div>
                    <div className="flex-1">
                        <DataTable
                            data={itemMovements}
                            columns={columns}
                            keyExtractor={(m) => m.id}
                            isLoading={isLoading}
                            emptyMessage="No hay movimientos registrados para este material."
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>,
    document.body
  );
};
