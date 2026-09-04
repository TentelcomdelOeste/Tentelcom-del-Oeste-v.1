import React, { useState } from 'react';
import { User } from '../../../../types';
import { mockMaterialRequests, mockVehicles, mockProjects } from '../mockData';
import { ActionButton, DataTable, TableColumn, StatusBadge } from '../../../../design-system';
import { FiPlus, FiEye, FiCheckCircle } from 'react-icons/fi';
import { VehicleMaterialRequest } from '../../../../types/vehicleWarehouse.types';
import { VehicleRequestModal } from '../modals/VehicleRequestModal';
import { CloseVehicleRequestModal } from '../modals/CloseVehicleRequestModal';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
}

export const VehicleRequestsTab: React.FC<Props> = ({ currentUser }) => {
  const [localRequests, setLocalRequests] = useState<VehicleMaterialRequest[]>(mockMaterialRequests);
  const [showNewModal, setShowNewModal] = useState(false);
  const [requestToClose, setRequestToClose] = useState<VehicleMaterialRequest | null>(null);

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
      accessor: (req) => (
        <div className="flex items-center gap-2">
          {req.status === 'Abierta' && (
            <ActionButton 
              label="Cerrar y Liquidar" 
              icon={<FiCheckCircle/>} 
              variant="secondary" 
              className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => setRequestToClose(req)}
            />
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-slate-800">Solicitudes de Proyectos</h3>
          <p className="text-sm text-slate-500">Gestión de materiales por vehículo asignados a proyectos.</p>
        </div>
        <ActionButton 
          label="Nueva Solicitud (Simular)" 
          icon={<FiPlus />} 
          variant="primary" 
          onClick={() => setShowNewModal(true)}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto">
          <DataTable
            data={localRequests}
            columns={columns}
            keyExtractor={(req) => req.id}
            emptyMessage="No hay solicitudes registradas."
          />
        </div>
      </div>

      <VehicleRequestModal 
        show={showNewModal} 
        onClose={() => setShowNewModal(false)}
        onSimulateCreate={(newReq) => {
          setLocalRequests([newReq, ...localRequests]);
        }}
      />

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
