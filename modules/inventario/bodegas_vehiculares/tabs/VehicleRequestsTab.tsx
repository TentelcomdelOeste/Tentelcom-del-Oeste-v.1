import React, { useState } from 'react';
import { getVehicleCatalog } from '../services/vehicleWarehouseService';
import { User } from '../../../../types';

import { ActionButton, DataTable, TableColumn, StatusBadge, useConfirm } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { FiCheckCircle } from 'react-icons/fi';
import { VehicleMaterialRequest, VehicleWarehouseItem } from '../../../../types/vehicleWarehouse.types';
import { VehicleRequestModal } from '../modals/VehicleRequestModal';
import { VehicleRequestDetailModal } from '../modals/VehicleRequestDetailModal';
import { CloseVehicleRequestModal } from '../modals/CloseVehicleRequestModal';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  selectedVehicleId?: string;
  requests?: VehicleMaterialRequest[];
  items?: VehicleWarehouseItem[];
  onCreateRequest?: (payload: any) => void;
  onUpdateRequest?: (payload: any) => void;
  onCancelRequest?: (requestId: string) => void;
  onCloseRequest?: (payload: any) => void;
  activeTab?: 'inventory' | 'requests' | 'movements' | 'reports';
  onTabChange?: (tab: 'inventory' | 'requests' | 'movements' | 'reports') => void;
}

export const VehicleRequestsTab: React.FC<Props> = ({
  currentUser: _currentUser,
  selectedVehicleId,
  requests: externalRequests,
  items,
  onCreateRequest,
  onUpdateRequest,
  onCancelRequest,
  onCloseRequest,
  activeTab: _activeTab = 'requests',
  onTabChange: _onTabChange
}) => {
  const confirm = useConfirm();
  
  const requests = externalRequests || [];

  const [showNewModal, setShowNewModal] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<VehicleMaterialRequest | null>(null);
  const [requestToView, setRequestToView] = useState<VehicleMaterialRequest | null>(null);
  const [requestToClose, setRequestToClose] = useState<VehicleMaterialRequest | null>(null);
  const [vehicles] = useState<any[]>(getVehicleCatalog());

  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'Abierta' && b.status !== 'Abierta') return -1;
    if (a.status !== 'Abierta' && b.status === 'Abierta') return 1;
    return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
  });

  const handleDelete = async (req: VehicleMaterialRequest) => {
    const confirmed = await confirm({
      title: '¿Eliminar solicitud?',
      description: 'Esta acción cancelará la solicitud y liberará el stock comprometido. ¿Desea continuar?',
      confirmLabel: 'Continuar',
      variant: 'danger'
    });
    if (confirmed) {
      if (onCancelRequest) {
        try {
          await onCancelRequest(req.id);
        } catch (err: any) {
          alert(err.message || 'Error al cancelar solicitud');
        }
      }
    }
  };

  const columns: TableColumn<VehicleMaterialRequest>[] = [
    {
      header: 'Solicitud',
      render: (req) => (
        <div>
          <p className="font-mono text-xs font-bold text-slate-700">{req.requestNumber}</p>
          <p className="text-[10px] text-slate-500">{format(new Date(req.openedAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      )
    },
    {
      header: 'Vehículo',
      render: (req) => <span className="font-bold text-slate-600">{req.vehiculoAlias}</span>
    },
    {
      header: 'Proyecto',
      render: (req) => (
        <div>
          <p className="font-bold text-xs text-slate-700">{req.projectCode}</p>
          <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{req.projectName}</p>
        </div>
      )
    },
    {
      header: 'Responsable',
      accessorKey: 'responsibleName'
    },
    {
      header: 'Estado',
      render: (req) => (
        <StatusBadge 
          status={req.status} 
          variant={req.status === 'Abierta' ? 'warning' : req.status === 'Cerrada' ? 'success' : 'default'} 
        />
      )
    },
    {
      header: 'Ítems',
      render: (req) => <span className="font-bold text-slate-600">{req.items.length}</span>
    },
    {
      header: 'Acciones',
      align: 'center',
      render: (req) => (
        <ActionButtons
          onView={() => setRequestToView(req)}
          onEdit={req.status === 'Abierta' ? () => setRequestToEdit(req) : undefined}
          onDelete={req.status === 'Abierta' ? () => handleDelete(req) : undefined}
        />
      )
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-800">Solicitudes de Proyectos</h3>
          <p className="text-sm text-slate-500">Gestión de materiales asignados a proyectos.</p>
        </div>
        <div>
          <ActionButton 
            label="Nueva Solicitud" 
            variant="primary" 
            onClick={() => setShowNewModal(true)}
            className="w-auto justify-center"
          />
        </div>
      </div>

      {/* Tabla / Tarjetas de Solicitudes */}
      {sortedRequests.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-100">
          No hay solicitudes registradas.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              data={sortedRequests}
              columns={columns}
              keyExtractor={(req) => req.id}
              emptyMessage="No hay solicitudes registradas."
            />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {sortedRequests.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{req.projectName}</p>
                    <p className="font-mono text-[10px] text-slate-500">{req.requestNumber}</p>
                  </div>
                  <StatusBadge 
                    status={req.status} 
                    variant={req.status === 'Abierta' ? 'warning' : req.status === 'Cerrada' ? 'success' : 'default'} 
                  />
                </div>
                
                <div className="text-xs text-slate-600 space-y-1">
                  <p><span className="font-bold text-slate-400">Vehículo:</span> {req.vehiculoAlias}</p>
                  <p><span className="font-bold text-slate-400">Materiales:</span> {req.items.length}</p>
                </div>

                <div className="mt-2 pt-3 border-t border-slate-100 flex gap-2 justify-center">
                  <ActionButtons
                    onView={() => setRequestToView(req)}
                    onEdit={req.status === 'Abierta' ? () => setRequestToEdit(req) : undefined}
                    onDelete={req.status === 'Abierta' ? () => handleDelete(req) : undefined}
                  />
                </div>
                
                {req.status === 'Abierta' && (
                  <ActionButton 
                    label="Cerrar y Liquidar" 
                    icon={<FiCheckCircle/>} 
                    variant="secondary" 
                    className="w-full justify-center text-emerald-600 hover:bg-emerald-50 border-emerald-200 mt-2"
                    onClick={() => setRequestToClose(req)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showNewModal && (
        <VehicleRequestModal 
          show={showNewModal} 
          initialVehicleId={selectedVehicleId}
          warehouseItems={items}
          currentUser={_currentUser}
          onClose={() => setShowNewModal(false)}
          onSave={async (newReq) => {
            if (onCreateRequest) {
              try {
                await onCreateRequest({
                  vehiculoId: newReq.vehiculoId,
                  projectId: newReq.projectId,
                  items: newReq.items.map(i => ({
                    inventoryItemId: i.inventoryItemId,
                    quantity: (i as any).quantity || (i as any).quantityCommitted || 0,
                    code: i.code,
                    description: i.description,
                    unit: i.unit
                  })),
                  observations: (newReq as any).observations
                });
              } catch (err: any) {
                alert(err.message || 'Error al crear solicitud');
                return;
              }
            }
            setShowNewModal(false);
          }}
        />
      )}
      
      {requestToEdit && (
        <VehicleRequestModal 
          show={true}
          initialData={requestToEdit}
          initialVehicleId={requestToEdit.vehiculoId || selectedVehicleId}
          warehouseItems={items}
          currentUser={_currentUser}
          onClose={() => setRequestToEdit(null)}
          onSave={async (updatedReq) => {
            if (onUpdateRequest) {
              try {
                await onUpdateRequest({
                  requestId: updatedReq.id,
                  newItems: updatedReq.items.map(i => ({
                    inventoryItemId: i.inventoryItemId,
                    quantity: (i as any).quantity || (i as any).quantityCommitted || 0,
                    code: i.code,
                    description: i.description,
                    unit: i.unit
                  })),
                  observations: (updatedReq as any).observations
                });
              } catch (err: any) {
                alert(err.message || 'Error al actualizar solicitud');
                return;
              }
            }
            setRequestToEdit(null);
          }}
        />
      )}

      {requestToView && (
        <VehicleRequestDetailModal
          show={true}
          request={requestToView}
          onClose={() => setRequestToView(null)}
          onEdit={() => {
            setRequestToView(null);
            setRequestToEdit(requestToView);
          }}
          onCloseRequest={() => {
            setRequestToView(null);
            setRequestToClose(requestToView);
          }}
        />
      )}

      {requestToClose && (
        <CloseVehicleRequestModal
          show={true}
          request={requestToClose}
          currentUser={_currentUser}
          onClose={() => setRequestToClose(null)}
          onCloseConfirm={async (payload) => {
            if (onCloseRequest) {
              try {
                await onCloseRequest(payload);
              } catch (err: any) {
                alert(err.message || 'Error al cerrar solicitud');
                return;
              }
            }
            setRequestToClose(null);
          }}
        />
      )}
    </div>
  );
};
