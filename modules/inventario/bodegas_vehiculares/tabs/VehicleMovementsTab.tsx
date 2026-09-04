import React, { useState } from 'react';
import { User } from '../../../../types';
import { mockMovements } from '../mockData';
import { DataTable, TableColumn, StatusBadge } from '../../../../design-system';
import { VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
}

export const VehicleMovementsTab: React.FC<Props> = ({ currentUser }) => {
  const [localMovements] = useState<VehicleMovement[]>(mockMovements);

  const getMovementColor = (type: string) => {
    switch(type) {
      case 'Traslado_Entrada': return 'success';
      case 'Consumo_Proyecto': return 'warning';
      case 'Devolucion_Bodega_Central': return 'default';
      default: return 'default';
    }
  };

  const getMovementLabel = (type: string) => {
    return type.replace(/_/g, ' ');
  };

  const columns: TableColumn<VehicleMovement>[] = [
    {
      header: 'Fecha / Ref',
      accessor: (mov) => (
        <div>
          <p className="font-mono text-xs font-bold text-slate-700">{mov.movementNumber}</p>
          <p className="text-[10px] text-slate-500">{format(new Date(mov.createdAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      )
    },
    {
      header: 'Tipo',
      accessor: (mov) => (
        <StatusBadge status={getMovementLabel(mov.type)} variant={getMovementColor(mov.type) as any} />
      )
    },
    {
      header: 'Vehículo',
      accessor: (mov) => <span className="font-bold text-slate-600">{mov.vehiculoPlaca}</span>
    },
    {
      header: 'Proyecto (si aplica)',
      accessor: (mov) => mov.projectName ? <span className="text-xs text-slate-600 truncate max-w-[200px] block">{mov.projectName}</span> : <span className="text-slate-400">-</span>
    },
    {
      header: 'Ítems afectados',
      accessor: (mov) => (
        <div className="flex flex-col gap-1">
          {mov.items.map((item, i) => (
            <div key={i} className="text-xs">
              <span className="font-bold text-slate-700">{item.quantity}</span> x <span className="text-slate-500">{item.code}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Realizado por',
      accessor: 'performedByName'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-slate-800">Historial de Movimientos</h3>
          <p className="text-sm text-slate-500">Auditoría de todos los traslados y consumos realizados.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px] md:h-[600px]">
        <div className="flex-1 overflow-auto bg-slate-50/30 p-2 md:p-0">
          {localMovements.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium">No hay movimientos registrados.</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block h-full">
                <DataTable
                  data={localMovements}
                  columns={columns}
                  keyExtractor={(mov) => mov.id}
                  emptyMessage="No hay movimientos registrados."
                />
              </div>

              {/* Mobile Cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {localMovements.map(mov => (
                  <div key={mov.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${mov.type === 'Traslado_Entrada' ? 'bg-emerald-500' : mov.type === 'Consumo_Proyecto' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <div className="ml-2 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <StatusBadge status={getMovementLabel(mov.type)} variant={getMovementColor(mov.type) as any} />
                        <p className="text-[10px] text-slate-500">{format(new Date(mov.createdAt), 'dd/MM/yyyy')}</p>
                      </div>
                      
                      <div className="text-sm">
                        {mov.type === 'Traslado_Entrada' && <p className="font-bold text-slate-700">Bodega Principal → {mov.vehiculoPlaca}</p>}
                        {mov.type === 'Consumo_Proyecto' && <p className="font-bold text-slate-700">{mov.vehiculoPlaca} → {mov.projectName || 'Proyecto'}</p>}
                        {mov.type === 'Devolucion_Bodega_Central' && <p className="font-bold text-slate-700">{mov.vehiculoPlaca} → Bodega Principal</p>}
                      </div>

                      <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 mt-1">
                        {mov.items.map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="text-slate-600 truncate max-w-[200px]">{item.description}</span>
                            <span className="font-bold text-slate-800">{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
