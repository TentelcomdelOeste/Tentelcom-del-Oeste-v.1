import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Box, 
  Tag, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CornerDownRight, 
  HelpCircle, 
  FileText, 
  Clock, 
  Truck,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { VehicleWarehouseItem, VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { DataTable, TableColumn, StatusBadge } from '../../../../design-system';
import { format } from 'date-fns';

interface Props {
  show: boolean;
  onClose: () => void;
  item: VehicleWarehouseItem | null;
  selectedVehicleId: string;
  movements: VehicleMovement[];
}

export const VehicleInventoryDetailModal: React.FC<Props> = ({
  show,
  onClose,
  item,
  selectedVehicleId,
  movements
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (show) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [show, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  const itemMovements = useMemo(() => {
    if (!item || !selectedVehicleId) return [];

    // Filter movements that involve this vehicle AND this specific material
    const filtered = movements.filter((m) => {
      const hasItem = m.items && m.items.some((i) => i.inventoryItemId === item.inventoryItemId);
      if (!hasItem) return false;

      const matchesVehicle =
        m.vehiculoId === selectedVehicleId ||
        m.originVehiculoId === selectedVehicleId ||
        m.targetVehiculoId === selectedVehicleId;
      return matchesVehicle;
    });

    // Map to unified display format
    return filtered.map((m) => {
      const matchedItem = m.items.find((i) => i.inventoryItemId === item.inventoryItemId);
      const qty = matchedItem ? matchedItem.quantity : 0;

      let displayType = '';
      let direction: 'ENTRADA' | 'SALIDA' | 'AJUSTE' = 'ENTRADA';
      let originDest = '';
      const refStr = m.reference || m.movementNumber || 'MOV-N/A';

      if (m.type === 'Traslado_Entrada') {
        displayType = 'Abastecimiento Entrada';
        direction = 'ENTRADA';
        originDest = `${m.origin || 'Bodega Central'} → ${m.destination || m.targetVehiculoAlias || m.vehiculoAlias || 'Esta Unidad'}`;
      } else if (m.type === 'Traslado_Salida') {
        displayType = 'Devolución Salida';
        direction = 'SALIDA';
        originDest = `${m.vehiculoAlias || 'Esta Unidad'} → ${m.destination || 'Bodega Central'}`;
      } else if (m.type === 'Traslado_Entre_Vehiculos') {
        if (m.originVehiculoId === selectedVehicleId) {
          displayType = 'Transferencia Salida';
          direction = 'SALIDA';
          originDest = `${m.originVehiculoAlias || m.vehiculoAlias || 'Esta Unidad'} → ${m.targetVehiculoAlias || m.targetVehiculoPlaca || 'Unidad Destino'}`;
        } else {
          displayType = 'Transferencia Entrada';
          direction = 'ENTRADA';
          originDest = `${m.originVehiculoAlias || m.originVehiculoPlaca || 'Unidad Origen'} → ${m.targetVehiculoAlias || m.vehiculoAlias || 'Esta Unidad'}`;
        }
      } else if (m.type === 'Consumo_Proyecto') {
        displayType = 'Consumo Proyecto';
        direction = 'SALIDA';
        originDest = `${m.vehiculoAlias || 'Esta Unidad'} → Proyecto ${m.projectName || m.projectId || ''}`;
      } else if (m.type === 'Devolucion_Bodega_Central') {
        displayType = 'Devolución Bodega Central';
        direction = 'SALIDA';
        originDest = `${m.vehiculoAlias || 'Esta Unidad'} → Bodega Central`;
      } else if (m.type === 'Ajuste') {
        displayType = 'Ajuste de Inventario';
        const isIncrease = matchedItem && matchedItem.newPhysicalStock > matchedItem.previousPhysicalStock;
        direction = isIncrease ? 'ENTRADA' : 'SALIDA';
        originDest = `Ajuste (${m.reason || 'S/R'})`;
      } else {
        displayType = m.type.replace(/_/g, ' ');
        direction = 'ENTRADA';
        originDest = '-';
      }

      return {
        id: m.id,
        date: m.createdAt || m.date,
        type: displayType,
        direction,
        quantity: qty,
        originDest,
        reference: refStr,
        reason: m.reason,
        performedByName: m.performedByName
      };
    });
  }, [movements, item, selectedVehicleId]);

  if (!show || !item) return null;

  const physicalStock = Number(item.physicalStock) || 0;
  const committedStock = Number(item.committedStock) || 0;
  const availableStock = physicalStock - committedStock;

  const columns: TableColumn<any>[] = [
    {
      header: 'Fecha',
      align: 'center',
      width: '120px',
      render: (m) => (
        <span className="font-mono text-slate-700 text-xs font-bold block text-center">
          {m.date ? format(new Date(m.date), 'dd/MM/yyyy HH:mm') : '-'}
        </span>
      )
    },
    {
      header: 'Movimiento',
      className: 'min-w-[150px] flex-1',
      render: (m) => (
        <div className="flex items-center gap-2">
          {m.direction === 'ENTRADA' ? (
            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
              <ArrowDownLeft className="w-3..5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <span className="font-bold text-slate-800 text-xs block">{m.type}</span>
            {m.reason && (
              <span className="text-[10px] text-slate-400 block truncate max-w-[200px]" title={m.reason}>
                {m.reason}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Cantidad',
      align: 'right',
      width: '90px',
      render: (m) => (
        <span className={`font-mono font-black text-xs ${m.direction === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {m.direction === 'ENTRADA' ? '+' : '-'}{m.quantity}
        </span>
      )
    },
    {
      header: 'Origen / Destino',
      className: 'min-w-[180px]',
      render: (m) => (
        <span className="text-xs text-slate-600 font-medium block truncate max-w-[220px]" title={m.originDest}>
          {m.originDest}
        </span>
      )
    },
    {
      header: 'Referencia',
      align: 'center',
      width: '110px',
      render: (m) => (
        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded leading-none">
          {m.reference}
        </span>
      )
    }
  ];

  return createPortal(
    <div 
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="bg-white md:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="min-w-0">
            <span className="inline-block text-[10px] font-mono font-extrabold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase leading-none mb-1">
              Detalle e Historial
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-800 truncate" title={item.description}>
              {item.description}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors shrink-0 ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 sm:space-y-6">
          {/* Section 1: Info Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Meta Info */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Especificación</span>
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Código: <span className="font-mono text-slate-900 font-black">{item.code}</span>
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1.5">
                  Categoría: <span className="font-bold text-slate-700">{item.category}</span>
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  U. Medida: <span className="font-bold text-slate-700">{item.unit || 'Unidad'}</span>
                </p>
              </div>
              <div className="border-t border-slate-200/50 pt-2 mt-3 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span>Últ. act: {item.updatedAt ? format(new Date(item.updatedAt), 'dd/MM/yyyy') : '-'}</span>
              </div>
            </div>

            {/* Warehouse Vehicle Info */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Bodega Consultada</span>
                <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-500" /> {item.vehiculoAlias || 'Sin Alias'}
                </p>
                <p className="text-xs font-mono font-bold text-slate-500 mt-1">
                  Placa: {item.vehiculoPlaca || '-'}
                </p>
              </div>
              <div className="bg-blue-50 text-blue-700 font-bold px-2.5 py-1.5 rounded-lg border border-blue-100/60 text-[10px] mt-3">
                Inventario exclusivo asignado a esta unidad vehicular.
              </div>
            </div>

            {/* Stock Quantities Summary */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-3 gap-2">
              <div className="text-center flex flex-col justify-between py-1 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Físico</span>
                <span className="text-base font-black text-slate-800 block mt-1">{physicalStock}</span>
                <span className="text-[9px] text-slate-400">{item.unit || 'und'}</span>
              </div>
              <div className="text-center flex flex-col justify-between py-1 bg-amber-50/50 border border-amber-100 rounded-lg">
                <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">Comp.</span>
                <span className={`text-base font-black block mt-1 ${committedStock > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {committedStock}
                </span>
                <span className="text-[9px] text-slate-400">reservado</span>
              </div>
              <div className="text-center flex flex-col justify-between py-1 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Disp.</span>
                <span className="text-base font-black text-emerald-600 block mt-1">{availableStock}</span>
                <span className="text-[9px] text-emerald-500 font-medium">disponible</span>
              </div>
            </div>
          </div>

          {/* Section 2: Historical Movement Records */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" /> HISTORIAL DE MOVIMIENTOS
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {itemMovements.length} movimientos
              </span>
            </div>

            {/* Desktop View Table */}
            <div className="hidden md:block flex-1">
              <DataTable<any>
                data={itemMovements}
                columns={columns}
                keyExtractor={(m) => m.id}
                emptyMessage="No hay movimientos registrados para este material en esta bodega vehicular."
              />
            </div>

            {/* Mobile View Card List */}
            <div className="block md:hidden divide-y divide-slate-100 flex-1 max-h-[40vh] overflow-y-auto">
              {itemMovements.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No hay movimientos registrados para este material en esta bodega vehicular.
                </div>
              ) : (
                itemMovements.map((m) => (
                  <div key={m.id} className="p-3.5 space-y-2 hover:bg-slate-50/40 transition-colors">
                    {/* Top row: Date + Ref */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {m.date ? format(new Date(m.date), 'dd/MM/yyyy HH:mm') : '-'}
                      </span>
                      <span className="font-mono text-[10px] font-extrabold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {m.reference}
                      </span>
                    </div>

                    {/* Middle row: Type + Quantity */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.direction === 'ENTRADA' ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-800 truncate">{m.type}</span>
                      </div>
                      <span className={`font-mono font-black text-xs whitespace-nowrap shrink-0 ${m.direction === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.direction === 'ENTRADA' ? '+' : '-'}{m.quantity}
                      </span>
                    </div>

                    {/* Bottom row: Origin / Dest */}
                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <CornerDownRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="truncate" title={m.originDest}>{m.originDest}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <button 
            type="button" 
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg shadow-xs transition-colors"
          >
            CERRAR VISTA
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
