import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';
import { mockMovements } from '../mockData';
import { DataTable, TableColumn, StatusBadge } from '../../../../design-system';
import { VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  movements?: VehicleMovement[];
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
  movements: externalMovements,
  activeTab = 'movements',
  onTabChange
}) => {
  const [internalMovements] = useState<VehicleMovement[]>(mockMovements);
  const rawMovements = externalMovements || internalMovements;

  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

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
      render: (mov) => (
        <div>
          <p className="font-mono text-xs font-bold text-slate-700">{mov.movementNumber}</p>
          <p className="text-[10px] text-slate-500">{format(new Date(mov.createdAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      )
    },
    {
      header: 'Tipo',
      render: (mov) => (
        <StatusBadge status={getMovementLabel(mov.type)} variant={getMovementColor(mov.type) as any} />
      )
    },
    {
      header: 'Vehículo / Detalle',
      render: (mov) => (
        <div>
          {mov.type === 'Traslado_Entre_Vehiculos' && mov.targetVehiculoPlaca ? (
            <p className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <span>{mov.vehiculoPlaca}</span>
              <span className="text-blue-600 font-extrabold">→</span>
              <span>{mov.targetVehiculoPlaca}</span>
            </p>
          ) : (
            <span className="font-bold text-slate-700 text-xs">{mov.vehiculoPlaca}</span>
          )}
          {mov.reason && (
            <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[220px]" title={mov.reason}>
              {mov.reason}
            </p>
          )}
        </div>
      )
    },
    {
      header: 'Proyecto (si aplica)',
      render: (mov) =>
        mov.projectName ? (
          <span className="text-xs text-slate-600 truncate max-w-[180px] block">{mov.projectName}</span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        )
    },
    {
      header: 'Ítems Afectados',
      render: (mov) => (
        <div className="flex flex-col gap-1">
          {mov.items.map((item, i) => (
            <div key={i} className="text-xs">
              <span className="font-bold text-slate-700">{item.quantity}</span> x{' '}
              <span className="text-slate-500 font-mono">{item.code}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Realizado por',
      accessorKey: 'performedByName'
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. Título y Subtítulo */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-800">Historial de Movimientos</h3>
          <p className="text-sm text-slate-500">
            Auditoría de traslados entre bodegas vehiculares, abastecimientos y consumos.
          </p>
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:flex items-center gap-3">
          <div className="w-44">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Mes
            </label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-7"
              >
                <option value="all">Todos</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx} value={String(idx)}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          <div className="w-32">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Año
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-7"
              >
                <option value="all">Todos</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Fila Móvil: [ Selector de Sección ] [ Mes ] [ Año ] */}
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 md:hidden">
        {/* Selector de Sección */}
        <div className="col-span-5 min-w-0">
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => onTabChange?.(e.target.value as any)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-5 truncate"
            >
              <option value="inventory">📦 Inventario</option>
              <option value="requests">📋 Solicitudes</option>
              <option value="movements">🔄 Movimientos</option>
              <option value="reports">📊 Reportes</option>
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* Filtro de Mes */}
        <div className="col-span-4 min-w-0">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-5 truncate"
            >
              <option value="all">Todos</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx} value={String(idx)}>
                  {m}
                </option>
              ))}
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* Filtro de Año */}
        <div className="col-span-3 min-w-0">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-5 truncate"
            >
              <option value="all">Todos</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
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
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
