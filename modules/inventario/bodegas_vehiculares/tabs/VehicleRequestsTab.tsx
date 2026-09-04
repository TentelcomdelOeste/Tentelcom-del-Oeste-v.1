import React, { useState } from 'react';
import { User } from '../../../../types';
import { mockMaterialRequests, mockVehicles, mockProjects } from '../mockData';
import { ActionButton, DataTable, TableColumn, StatusBadge, useConfirm } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { FiCheckCircle } from 'react-icons/fi';
import { VehicleMaterialRequest } from '../../../../types/vehicleWarehouse.types';
import { VehicleRequestModal } from '../modals/VehicleRequestModal';
import { VehicleRequestDetailModal } from '../modals/VehicleRequestDetailModal';
import { CloseVehicleRequestModal } from '../modals/CloseVehicleRequestModal';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  selectedVehicleId?: string;
}

export const VehicleRequestsTab: React.FC<Props> = ({ currentUser, selectedVehicleId }) => {
  const confirm = useConfirm();
  const [localRequests, setLocalRequests] = useState<VehicleMaterialRequest[]>(mockMaterialRequests);
  const [showNewModal, setShowNewModal] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<VehicleMaterialRequest | null>(null);
  const [requestToView, setRequestToView] = useState<VehicleMaterialRequest | null>(null);
  const [requestToClose, setRequestToClose] = useState<VehicleMaterialRequest | null>(null);

  const sortedRequests = [...localRequests].sort((a, b) => {
    if (a.status === 'Abierta' && b.status !== 'Abierta') return -1;
    if (a.status !== 'Abierta' && b.status === 'Abierta') return 1;
    return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
  });

  const handleDelete = async (req: VehicleMaterialRequest) => {
    const confirmed = await confirm({
      title: '¿Eliminar solicitud?',
      description: 'Esta acción eliminará la solicitud y sus materiales asociados. ¿Desea continuar?',
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (confirmed) {
      setLocalRequests(prev => prev.filter(r => r.id !== req.id));
    }
  };

  const columns: TableColumn<VehicleMaterialRequest>[] = [
    {
      header: 'Solicitud',
      accessor: (req) => (
        <div>
          <p className="font-mono text-xs font-bold text-slate-700">{req.requestNumber}</p>
          <p className="text-[10px] text-slate-500">{format(new Date(req.openedAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      )
    },
    {
      header: 'Vehículo',
      accessor: (req) => <span className="font-bold text-slate-600">{req.vehiculoAlias}</span>
    },
    {
      header: 'Proyecto',
      accessor: (req) => (
        <div>
          <p className="font-bold text-xs text-slate-700">{req.projectCode}</p>
          <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{req.projectName}</p>
        </div>
      )
    },
    {
      header: 'Responsable',
      accessor: 'responsibleName'
    },
    {
      header: 'Estado',
      accessor: (req) => (
        <StatusBadge 
          status={req.status} 
          variant={req.status === 'Abierta' ? 'warning' : req.status === 'Cerrada' ? 'success' : 'default'} 
        />
      )
    },
    {
      header: 'Ítems',
      accessor: (req) => <span className="font-bold text-slate-600">{req.items.length}</span>
    },
    {
      header: 'Acciones',
      align: 'center',
      accessor: (req) => (
        <ActionButtons
          onView={() => setRequestToView(req)}
          onEdit={req.status === 'Abierta' ? () => setRequestToEdit(req) : undefined}
          onDelete={req.status === 'Abierta' ? () => handleDelete(req) : undefined}
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-800">Solicitudes de Proyectos</h3>
          <p className="text-sm text-slate-500">Gestión de materiales asignados a proyectos.</p>
        </div>
        <ActionButton 
          label="Nueva Solicitud" 
          variant="primary" 
          onClick={() => setShowNewModal(true)}
          className="w-full md:w-auto justify-center"
        />
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

      <VehicleRequestModal 
        show={showNewModal} 
        initialVehicleId={selectedVehicleId}
        onClose={() => setShowNewModal(false)}
        onSave={(newReq) => {
          setLocalRequests([newReq, ...localRequests.filter(r => r.id !== newReq.id)]);
        }}
      />
      
      {requestToEdit && (
        <VehicleRequestModal 
          show={true}
          initialData={requestToEdit}
          initialVehicleId={requestToEdit.vehiculoId || selectedVehicleId}
          onClose={() => setRequestToEdit(null)}
          onSave={(updatedReq) => {
            setLocalRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
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
          onClose={() => setRequestToClose(null)}
          onSimulateClose={(updatedReq) => {
            setLocalRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
            setRequestToClose(null);
          }}
        />
      )}
    </div>
  );
};
