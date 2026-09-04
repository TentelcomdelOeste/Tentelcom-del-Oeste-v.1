import React, { useState } from 'react';
import { User } from '../../../../types';
import { mockConsumptions } from '../mockData';
import { DataTable, TableColumn } from '../../../../design-system';
import { VehicleProjectConsumption } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
}

export const VehicleReportsTab: React.FC<Props> = ({ currentUser }) => {
  const [localConsumptions] = useState<VehicleProjectConsumption[]>(mockConsumptions);

  const columns: TableColumn<VehicleProjectConsumption>[] = [
    {
      header: 'Fecha Cierre',
      accessor: (cons) => <span className="text-xs text-slate-600">{format(new Date(cons.closedAt), 'dd/MM/yyyy HH:mm')}</span>
    },
    {
      header: 'Proyecto',
      accessor: (cons) => (
        <div>
          <p className="font-bold text-xs text-slate-700">{cons.projectCode}</p>
          <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{cons.projectName}</p>
        </div>
      )
    },
    {
      header: 'Vehículo',
      accessor: (cons) => <span className="font-bold text-slate-600">{cons.vehiculoAlias}</span>
    },
    {
      header: 'Materiales Utilizados',
      accessor: (cons) => (
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto">
          <DataTable
            data={localConsumptions}
            columns={columns}
            keyExtractor={(cons) => cons.id}
            emptyMessage="No hay consumos registrados."
          />
        </div>
      </div>
    </div>
  );
};
