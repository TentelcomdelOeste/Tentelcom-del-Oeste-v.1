import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';

import { DataTable, TableColumn, StatusBadge, useConfirm } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { isVehicleDeleteAuthorized, vehicleWarehouseService } from '../services/vehicleWarehouseService';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  movements?: VehicleMovement[];
  onDeleteMovement?: (movementId: string) => Promise<void> | void;
  activeTab?: 'inventory' | 'requests' | 'movements' | 'reports';
  onTabChange?: (tab: 'inventory' | 'requests' | 'movements' | 'reports') => void;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

export const VehicleMovementsTab: React.FC<Props> = ({
  currentUser,
  movements: externalMovements,
  onDeleteMovement,
  activeTab = 'movements',
  onTabChange
}) => {
  const confirm = useConfirm();
  const canDelete = isVehicleDeleteAuthorized(currentUser);
  
  const rawMovements = externalMovements || [];

  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  const handleDeleteMovement = async (mov: VehicleMovement) => {
    const confirmed = await confirm({
      title: '¿Eliminar Movimiento?',
      description: `¿Está seguro de eliminar permanentemente el registro de movimiento #${mov.movementNumber}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (confirmed) {
      try {
        if (onDeleteMovement) {
          await onDeleteMovement(mov.id);
        } else {
          await vehicleWarehouseService.deleteMovement(mov.id, currentUser);
        }
      } catch (err: any) {
        console.error('Error al eliminar movimiento:', err);
        await confirm({
          title: 'Error al eliminar movimiento',
          description: err?.message || 'Ocurrió un error al procesar la eliminación del movimiento.',
          confirmLabel: 'Aceptar',
          variant: 'danger'
        });
      }
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rawMovements.forEach((mov) => {
      const d = new Date(mov.createdAt || mov.date);
      if (!isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [rawMovements]);

  const filteredMovements = useMemo(() => {
    return rawMovements.filter((mov) => {
      const d = new Date(mov.createdAt || mov.date);
      if (isNaN(d.getTime())) return true;

      if (selectedMonth !== 'all') {
        const monthNum = parseInt(selectedMonth, 10);
        if (d.getMonth() !== monthNum) return false;
      }

      if (selectedYear !== 'all') {
        const yearNum = parseInt(selectedYear, 10);
        if (d.getFullYear() !== yearNum) return false;
      }

      return true;
    });
  }, [rawMovements, selectedMonth, selectedYear]);

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'Traslado_Entrada':
        return 'success';
      case 'Traslado_Salida':
        return 'info';
      case 'Traslado_Entre_Vehiculos':
        return 'info';
      case 'Consumo_Proyecto':
        return 'warning';
      case 'Devolucion_Bodega_Central':
        return 'default';
      default:
        return 'default';
    }
  };

  const getMovementLabel = (type: string) => {
    if (type === 'Traslado_Salida') return 'Transferencia Salida';
    if (type === 'Traslado_Entrada') return 'Abastecimiento Entrada';
    if (type === 'Traslado_Entre_Vehiculos') return 'Traslado Entre Unidades';
    return type.replace(/_/g, ' ');
  };

  const columns: TableColumn<VehicleMovement>[] = [
    {
      header: 'Fecha / Ref',
      align: 'center',
      width: '130px',
      render: (mov) => (
        <div className="text-center">
          <span className="font-mono text-xs font-bold text-slate-800">#{mov.movementNumber}</span>
          <p className="text-[10px] text-slate-400 font-medium">{format(new Date(mov.createdAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      )
    },
    {
      header: 'Tipo',
      align: 'center',
      width: '160px',
      render: (mov) => (
        <StatusBadge status={getMovementLabel(mov.type)} variant={getMovementColor(mov.type) as any} />
      )
    },
    {
      header: 'Vehículo / Detalle',
      className: 'flex-1 min-w-[190px]',
      render: (mov) => (
        <div className="min-w-0">
          {mov.type === 'Traslado_Entre_Vehiculos' && mov.targetVehiculoPlaca ? (
            <p className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{mov.vehiculoPlaca}</span>
              <span className="text-blue-600 font-extrabold">→</span>
              <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-mono">{mov.targetVehiculoPlaca}</span>
            </p>
          ) : mov.type === 'Traslado_Entrada' ? (
            <p className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">{mov.origin || 'Bodega Central'}</span>
              <span className="text-emerald-600 font-extrabold">→</span>
              <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-mono">{mov.destination || mov.targetVehiculoPlaca || mov.vehiculoPlaca}</span>
            </p>
          ) : (
            <span className="font-bold text-slate-700 text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{mov.vehiculoPlaca}</span>
          )}
          {mov.reason && (
            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[220px]" title={mov.reason}>
              {mov.reason}
            </p>
          )}
        </div>
      )
    },
    {
      header: 'Proyecto',
      width: '160px',
      render: (mov) =>
        mov.projectName ? (
          <div className="min-w-0 truncate" title={mov.projectName}>
            <span className="text-xs font-semibold text-slate-700 truncate block">{mov.projectName}</span>
            {mov.projectCode && <span className="text-[10px] text-blue-600 font-mono font-medium block">{mov.projectCode}</span>}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        )
    },
    {
      header: 'Ítems Afectados',
      width: '160px',
      render: (mov) => (
        <div className="flex flex-col gap-0.5 max-h-14 overflow-y-auto pr-1">
          {mov.items.map((item, i) => (
            <div key={i} className="text-xs flex items-center justify-between text-slate-700">
              <span className="font-mono text-[11px] text-slate-600 truncate max-w-[100px]" title={item.code}>{item.code}</span>
              <span className="font-black text-slate-800 ml-1">x{item.quantity}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Realizado por',
      width: '140px',
      render: (mov) => (
        <span className="text-xs text-slate-600 truncate block" title={mov.performedByName}>
          {mov.performedByName ? mov.performedByName.split('@')[0] : '-'}
        </span>
      )
    },
    ...(canDelete ? [{
      header: 'Acciones',
      align: 'center' as const,
      width: '80px',
      render: (mov: VehicleMovement) => (
        <div className="flex justify-center items-center">
          <ActionButtons
            onDelete={() => handleDeleteMovement(mov)}
            deleteTitle="Eliminar movimiento"
          />
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* Controls Container Header Box */}
      <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2 sm:space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3">
          {/* Section Selector (Mobile) + Desktop Heading */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0 md:hidden">
              <select
                value={activeTab}
                onChange={(e) => onTabChange && onTabChange(e.target.value as any)}
                className="w-full p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 sm:pr-7 truncate"
              >
                <option value="inventory">📦 Inventario</option>
                <option value="requests">📋 Solicitudes</option>
                <option value="movements">🔄 Movimientos</option>
                <option value="reports">📊 Reportes</option>
              </select>
              <div className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px] sm:text-xs">
                ▼
              </div>
            </div>

            <div className="hidden md:block">
              <h3 className="text-base sm:text-lg font-black text-slate-800 leading-tight">Historial de Movimientos</h3>
              <p className="text-xs text-slate-500">Auditoría de traslados entre bodegas vehiculares, abastecimientos y consumos.</p>
            </div>
          </div>

          {/* Month & Year Filters */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <div className="relative min-w-0 sm:w-36">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 truncate"
              >
                <option value="all">Todos los meses</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx} value={String(idx)}>{m}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
            </div>

            <div className="relative min-w-0 sm:w-32">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 truncate"
              >
                <option value="all">Todos los años</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={String(yr)}>{yr}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tabla / Tarjetas de Movimientos */}
      {filteredMovements.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-100">
          No hay movimientos registrados.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              data={filteredMovements}
              columns={columns}
              keyExtractor={(mov) => mov.id}
              emptyMessage="No hay movimientos registrados."
            />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredMovements.map((mov) => (
              <div
                key={mov.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    mov.type === 'Traslado_Entrada'
                      ? 'bg-emerald-500'
                      : mov.type === 'Traslado_Salida' || mov.type === 'Traslado_Entre_Vehiculos'
                      ? 'bg-blue-500'
                      : mov.type === 'Consumo_Proyecto'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                <div className="ml-2 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <StatusBadge
                      status={getMovementLabel(mov.type)}
                      variant={getMovementColor(mov.type) as any}
                    />
                    <p className="text-[10px] text-slate-500">{format(new Date(mov.createdAt), 'dd/MM/yyyy')}</p>
                  </div>

                  <div className="text-sm">
                    {mov.type === 'Traslado_Entre_Vehiculos' && mov.targetVehiculoPlaca ? (
                      <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{mov.vehiculoPlaca}</span>
                        <span className="text-blue-600 font-extrabold">→</span>
                        <span>{mov.targetVehiculoPlaca}</span>
                      </p>
                    ) : mov.type === 'Traslado_Entrada' ? (
                      <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500 font-medium">{mov.origin || 'Bodega Principal'}</span>
                        <span className="text-emerald-600 font-extrabold">→</span>
                        <span>{mov.destination || mov.targetVehiculoPlaca || mov.vehiculoPlaca}</span>
                      </p>
                    ) : mov.reason ? (
                      <p className="font-bold text-slate-700 text-xs">{mov.reason}</p>
                    ) : (
                      <p className="font-bold text-slate-700 text-xs">{mov.vehiculoPlaca}</p>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 mt-1">
                    {mov.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs py-0.5">
                        <span className="text-slate-600 truncate max-w-[200px]">{item.description}</span>
                        <span className="font-bold text-slate-800">
                          {item.quantity} ({item.code})
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>Ref: {mov.movementNumber}</span>
                    <span>{mov.performedByName}</span>
                  </div>

                  {canDelete && (
                    <div className="flex justify-end pt-1.5 border-t border-slate-100">
                      <ActionButtons
                        onDelete={() => handleDeleteMovement(mov)}
                        deleteTitle="Eliminar movimiento"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
