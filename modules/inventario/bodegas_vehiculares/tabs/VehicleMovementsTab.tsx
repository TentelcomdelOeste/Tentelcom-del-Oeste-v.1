import React, { useState } from 'react';
import { User } from '../../../../types';
import { mockMovements } from '../mockData';
import { DataTable, TableColumn, StatusBadge } from '../../../../design-system';
import { VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  movements?: VehicleMovement[];
}

export const VehicleMovementsTab: React.FC<Props> = ({ movements: externalMovements }) => {
  const [internalMovements] = useState<VehicleMovement[]>(mockMovements);
  const movements = externalMovements || internalMovements;

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'Traslado_Entrada':
        return 'success';
      case 'Traslado_Salida':
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
      header: 'Vehículo / Detalle',
      accessor: (mov) => (
        <div>
          <span className="font-bold text-slate-700 text-xs">{mov.vehiculoPlaca}</span>
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
      accessor: (mov) =>
        mov.projectName ? (
          <span className="text-xs text-slate-600 truncate max-w-[180px] block">{mov.projectName}</span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        )
    },
    {
      header: 'Ítems Afectados',
      accessor: (mov) => (
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
      accessor: 'performedByName'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-slate-800">Historial de Movimientos</h3>
          <p className="text-sm text-slate-500">
            Auditoría de traslados entre bodegas vehiculares, abastecimientos y consumos.
          </p>
        </div>
      </div>

      {/* Tabla / Tarjetas de Movimientos */}
      {movements.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-100">
          No hay movimientos registrados.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              data={movements}
              columns={columns}
              keyExtractor={(mov) => mov.id}
              emptyMessage="No hay movimientos registrados."
            />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {movements.map((mov) => (
              <div
                key={mov.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    mov.type === 'Traslado_Entrada'
                      ? 'bg-emerald-500'
                      : mov.type === 'Traslado_Salida'
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
                    {mov.reason ? (
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
