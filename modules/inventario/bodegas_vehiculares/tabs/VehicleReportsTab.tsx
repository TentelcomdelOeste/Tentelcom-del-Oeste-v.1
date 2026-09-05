import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';
import { mockConsumptions } from '../mockData';
import { DataTable, TableColumn } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { VehicleProjectConsumption } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  consumptions?: VehicleProjectConsumption[];
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

export const VehicleReportsTab: React.FC<Props> = ({
  currentUser: _currentUser,
  consumptions: externalConsumptions,
  activeTab = 'reports',
  onTabChange
}) => {
  const [localConsumptions] = useState<VehicleProjectConsumption[]>(mockConsumptions);
  const rawConsumptions = externalConsumptions || localConsumptions;

  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rawConsumptions.forEach((cons) => {
      const d = new Date(cons.closedAt);
      if (!isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [rawConsumptions]);

  const filteredConsumptions = useMemo(() => {
    return rawConsumptions.filter((cons) => {
      const d = new Date(cons.closedAt);
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
  }, [rawConsumptions, selectedMonth, selectedYear]);

  const columns: TableColumn<VehicleProjectConsumption>[] = [
    {
      header: 'Fecha Cierre',
      render: (cons) => <span className="text-xs text-slate-600">{format(new Date(cons.closedAt), 'dd/MM/yyyy HH:mm')}</span>
    },
    {
      header: 'Proyecto',
      render: (cons) => (
        <div>
          <p className="font-bold text-xs text-slate-700">{cons.projectCode}</p>
          <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{cons.projectName}</p>
        </div>
      )
    },
    {
      header: 'Vehículo',
      render: (cons) => <span className="font-bold text-slate-600">{cons.vehiculoAlias}</span>
    },
    {
      header: 'Materiales Utilizados',
      render: (cons) => (
        <div className="flex flex-col gap-2 max-w-[300px]">
          {cons.items.map((item, i) => (
            <div key={i} className="bg-slate-50 p-2 rounded border border-slate-100 text-xs">
              <p className="font-bold text-slate-700">{item.code}</p>
              <div className="flex justify-between mt-1 text-[10px]">
                <span className="text-slate-500">Uso Real: <strong className="text-slate-700">{item.consumed} {item.unit}</strong></span>
                {item.surplus > 0 && <span className="text-emerald-600 font-bold">Sobró: {item.surplus} {item.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Acciones',
      width: '120px',
      align: 'center',
      className: '!px-2',
      render: () => (
        <div className="flex justify-center items-center w-full">
          <ActionButtons
            onView={() => {}}
            viewTitle="Visualizar reporte"
            onPdf={() => {}}
            pdfTitle="Generar PDF"
          />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. Título, Subtítulo y Filtros Desktop */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-800">Reportes de Consumo</h3>
          <p className="text-sm text-slate-500">Liquidaciones finales por proyecto y vehículo.</p>
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

      {/* 3. Tabla / Tarjetas de Consumos */}
      {filteredConsumptions.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-100">
          No hay consumos registrados.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              data={filteredConsumptions}
              columns={columns}
              keyExtractor={(cons) => cons.id}
              emptyMessage="No hay consumos registrados."
            />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredConsumptions.map(cons => (
              <div key={cons.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{cons.projectName}</p>
                    <p className="font-mono text-[10px] text-slate-500">{cons.projectCode}</p>
                  </div>
                  <span className="text-[10px] text-slate-500">{format(new Date(cons.closedAt), 'dd/MM/yyyy')}</span>
                </div>

                <p className="text-xs text-slate-600 mb-3"><span className="font-bold">Vehículo:</span> {cons.vehiculoAlias}</p>

                <div className="space-y-2">
                  {cons.items.map((item, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <p className="text-xs font-bold text-slate-700">{item.code}</p>
                      <div className="flex justify-between items-center mt-1 text-[10px]">
                        <span className="text-slate-500">Uso: <strong className="text-slate-800">{item.consumed} {item.unit}</strong></span>
                        {item.surplus > 0 && <span className="text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded">Sobró: {item.surplus} {item.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-end pt-3 mt-3 border-t border-slate-100">
                  <ActionButtons
                    onView={() => {}}
                    viewTitle="Visualizar reporte"
                    onPdf={() => {}}
                    pdfTitle="Generar PDF"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
