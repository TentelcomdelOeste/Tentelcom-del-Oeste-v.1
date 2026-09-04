import React, { useState } from 'react';
import { User } from '../../../../types';
import { mockConsumptions } from '../mockData';
import { DataTable, TableColumn } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { VehicleProjectConsumption } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
}

export const VehicleReportsTab: React.FC<Props> = ({ currentUser: _currentUser }) => {
  const [localConsumptions] = useState<VehicleProjectConsumption[]>(mockConsumptions);

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-slate-800">Reportes de Consumo</h3>
          <p className="text-sm text-slate-500">Liquidaciones finales por proyecto y vehículo.</p>
        </div>
      </div>

      {/* Tabla / Tarjetas de Consumos */}
      {localConsumptions.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-100">
          No hay consumos registrados.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              data={localConsumptions}
              columns={columns}
              keyExtractor={(cons) => cons.id}
              emptyMessage="No hay consumos registrados."
            />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {localConsumptions.map(cons => (
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
