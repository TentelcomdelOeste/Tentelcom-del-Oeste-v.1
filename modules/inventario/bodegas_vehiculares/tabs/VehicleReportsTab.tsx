import React, { useState, useMemo } from 'react';
import { User } from '../../../../types';

import { DataTable, TableColumn, useConfirm } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { VehicleProjectConsumption } from '../../../../types/vehicleWarehouse.types';
import { isVehicleDeleteAuthorized, vehicleWarehouseService } from '../services/vehicleWarehouseService';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  consumptions?: VehicleProjectConsumption[];
  onDeleteConsumption?: (consumptionId: string) => Promise<void> | void;
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
  onDeleteConsumption,
  activeTab = 'reports',
  onTabChange
}) => {
  const confirm = useConfirm();
  const canDelete = isVehicleDeleteAuthorized(_currentUser);
  
  const rawConsumptions = externalConsumptions || [];

  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  const handleDeleteConsumption = async (cons: VehicleProjectConsumption) => {
    const confirmed = await confirm({
      title: '¿Eliminar Reporte de Consumo?',
      description: `¿Está seguro de eliminar permanentemente el reporte de consumo del proyecto ${cons.projectName} (${cons.projectCode})? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (confirmed) {
      try {
        if (onDeleteConsumption) {
          await onDeleteConsumption(cons.id);
        } else {
          await vehicleWarehouseService.deleteConsumption(cons.id, _currentUser);
        }
      } catch (err: any) {
        console.error('Error al eliminar consumo:', err);
        await confirm({
          title: 'Error al eliminar reporte',
          description: err?.message || 'Ocurrió un error al procesar la eliminación del reporte.',
          confirmLabel: 'Aceptar',
          variant: 'danger'
        });
      }
    }
  };

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
      align: 'center',
      width: '130px',
      render: (cons) => (
        <div className="text-center">
          <p className="text-xs font-semibold text-slate-700">{format(new Date(cons.closedAt), 'dd/MM/yyyy')}</p>
          <p className="text-[10px] text-slate-400 font-medium">{format(new Date(cons.closedAt), 'HH:mm')}</p>
        </div>
      )
    },
    {
      header: 'Proyecto',
      className: 'flex-1 min-w-[200px]',
      render: (cons) => (
        <div className="min-w-0 truncate">
          <div className="font-bold text-xs text-slate-900 truncate" title={cons.projectName}>
            {cons.projectName}
          </div>
          <span className="text-[10px] font-mono font-semibold text-blue-600 truncate block">
            {cons.projectCode}
          </span>
        </div>
      )
    },
    {
      header: 'Vehículo',
      align: 'center',
      width: '130px',
      render: (cons) => (
        <span className="font-bold text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
          {cons.vehiculoAlias}
        </span>
      )
    },
    {
      header: 'Materiales Utilizados',
      width: '280px',
      render: (cons) => (
        <div className="flex flex-col gap-1 max-h-16 overflow-y-auto pr-1">
          {cons.items.map((item, i) => (
            <div key={i} className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-xs flex items-center justify-between">
              <span className="font-mono text-[11px] text-slate-700 truncate max-w-[120px]" title={item.code}>{item.code}</span>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-slate-600 font-medium">Uso: <strong className="text-slate-800 font-bold">{item.consumed} {item.unit}</strong></span>
                {item.surplus > 0 && <span className="text-emerald-600 font-bold ml-1">(Sobró: {item.surplus})</span>}
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Acciones',
      width: canDelete ? '130px' : '90px',
      align: 'center',
      render: (cons) => (
        <div className="flex justify-center items-center w-full">
          <ActionButtons
            onView={() => {}}
            viewTitle="Visualizar reporte"
            onPdf={() => {}}
            pdfTitle="Generar PDF"
            onDelete={canDelete ? () => handleDeleteConsumption(cons) : undefined}
            deleteTitle="Eliminar reporte de consumo"
          />
        </div>
      )
    }
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
              <h3 className="text-base sm:text-lg font-black text-slate-800 leading-tight">Reportes de Consumo</h3>
              <p className="text-xs text-slate-500">Liquidaciones finales por proyecto y vehículo.</p>
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
                    onDelete={canDelete ? () => handleDeleteConsumption(cons) : undefined}
                    deleteTitle="Eliminar reporte de consumo"
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
