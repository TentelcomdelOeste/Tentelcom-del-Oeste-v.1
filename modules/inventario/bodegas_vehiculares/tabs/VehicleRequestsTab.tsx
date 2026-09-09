import React, { useState } from 'react';
import { getVehicleCatalog, vehicleWarehouseService, isVehicleDeleteAuthorized } from '../services/vehicleWarehouseService';
import { User } from '../../../../types';

import { ActionButton, DataTable, TableColumn, StatusBadge, useConfirm } from '../../../../design-system';
import { ActionButtons } from '../../../../components/ui/ActionButtons';
import { FiCheckCircle, FiTruck, FiBox, FiUser, FiEye, FiEdit2, FiTrash2, FiChevronRight } from 'react-icons/fi';
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
  onCreateRequest?: (payload: any) => Promise<void> | void;
  onUpdateRequest?: (payload: any) => Promise<void> | void;
  onCancelRequest?: (payload: { requestId: string; observations?: string }) => Promise<void> | void;
  onDeleteRequest?: (requestId: string) => Promise<void> | void;
  onCloseRequest?: (payload: any) => Promise<void> | void;
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
  onDeleteRequest,
  onCloseRequest,
  activeTab = 'requests',
  onTabChange
}) => {
  const confirm = useConfirm();
  const canDelete = isVehicleDeleteAuthorized(_currentUser);
  
  const requests = externalRequests || [];

  const [showNewModal, setShowNewModal] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<VehicleMaterialRequest | null>(null);
  const [requestToView, setRequestToView] = useState<VehicleMaterialRequest | null>(null);
  const [requestToClose, setRequestToClose] = useState<VehicleMaterialRequest | null>(null);
  const [vehicles] = useState<any[]>(getVehicleCatalog());

  const formatCreatorName = (name?: string): string => {
    if (!name || !name.trim()) return 'Sin asignar';
    
    let clean = name.trim();
    if (clean.includes('@')) {
      clean = clean.split('@')[0].replace(/[._-]/g, ' ');
    }
    
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'Sin asignar';
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
    }
    
    const first = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
    const second = words[1];
    const secondInitial = second.replace(/\./g, '').charAt(0).toUpperCase();
    
    return `${first} ${secondInitial}.`;
  };

  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'Abierta' && b.status !== 'Abierta') return -1;
    if (a.status !== 'Abierta' && b.status === 'Abierta') return 1;
    return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
  });

  const handleDelete = async (req: VehicleMaterialRequest) => {
    const confirmed = await confirm({
      title: '¿Eliminar Solicitud?',
      description: `¿Está seguro de eliminar permanentemente la solicitud ${req.requestNumber} (${req.projectName})? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (confirmed) {
      try {
        if (onDeleteRequest) {
          await onDeleteRequest(req.id);
        } else {
          await vehicleWarehouseService.deleteRequest(req.id, _currentUser);
        }
      } catch (err: any) {
        console.error('Error al eliminar solicitud:', err);
        await confirm({
          title: 'Error al eliminar solicitud',
          description: err?.message || 'Ocurrió un error al procesar la eliminación de la solicitud.',
          confirmLabel: 'Aceptar',
          variant: 'danger'
        });
      }
    }
  };

  const columns: TableColumn<VehicleMaterialRequest>[] = [
    {
      header: 'N° Solicitud',
      align: 'center',
      width: '130px',
      render: (req) => (
        <div className="text-center">
          <span className="font-mono text-xs font-bold text-slate-800">#{req.requestNumber}</span>
          <p className="text-[10px] text-slate-400 font-medium">{format(new Date(req.openedAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      )
    },
    {
      header: 'Vehículo',
      align: 'center',
      width: '130px',
      render: (req) => (
        <span className="font-bold text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
          {req.vehiculoAlias}
        </span>
      )
    },
    {
      header: 'Proyecto',
      className: 'flex-1 min-w-[200px]',
      render: (req) => (
        <div className="min-w-0 truncate">
          <div className="font-bold text-xs text-slate-900 truncate" title={req.projectName}>
            {req.projectName}
          </div>
          <span className="text-[10px] font-mono font-semibold text-blue-600 truncate block">
            {req.projectCode}
          </span>
        </div>
      )
    },
    {
      header: 'Responsable',
      width: '160px',
      render: (req) => (
        <span className="text-xs text-slate-600 font-medium truncate block" title={req.responsibleName}>
          {req.responsibleName || '-'}
        </span>
      )
    },
    {
      header: 'Estado',
      align: 'center',
      width: '120px',
      render: (req) => (
        <StatusBadge 
          status={req.status} 
          variant={req.status === 'Abierta' ? 'warning' : req.status === 'Cerrada' ? 'success' : 'default'} 
        />
      )
    },
    {
      header: 'Ítems',
      align: 'center',
      width: '90px',
      render: (req) => (
        <span className="font-black text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full inline-block">
          {req.items?.length || 0}
        </span>
      )
    },
    {
      header: 'Acciones',
      align: 'center',
      width: '160px',
      render: (req) => (
        <div className="flex items-center justify-center gap-1.5 w-full">
          <ActionButtons
            onView={() => setRequestToView(req)}
            onEdit={req.status === 'Abierta' ? () => setRequestToEdit(req) : undefined}
            onDelete={canDelete ? () => handleDelete(req) : undefined}
          />
          {req.status === 'Abierta' && (
            <button
              type="button"
              onClick={() => setRequestToClose(req)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
              title="Cerrar y Liquidar Solicitud"
            >
              <FiCheckCircle className="w-3 h-3 text-emerald-600" />
              <span>Cerrar</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* Controls Container Header Box */}
      <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Selector de Sección Solicitudes (Mobile) */}
          <div className="relative flex-1 min-w-0 block md:hidden">
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

          {/* Desktop Title & Subtitle */}
          <div className="hidden md:block">
            <h3 className="text-base sm:text-lg font-black text-slate-800 leading-tight">Solicitudes de Proyectos</h3>
            <p className="text-xs text-slate-500">Gestión de materiales asignados a proyectos.</p>
          </div>

          {/* Botón Nueva Solicitud */}
          <ActionButton 
            label="NUEVA SOLICITUD" 
            variant="primary" 
            onClick={() => setShowNewModal(true)}
            className="!w-auto flex-none shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap text-xs sm:text-sm rounded-lg shadow-sm"
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
            {sortedRequests.map(req => {
              const creatorName = formatCreatorName(req.responsibleName);
              const isAbierta = req.status === 'Abierta';
              const reqCode = req.requestNumber?.startsWith('SV-') 
                ? req.requestNumber 
                : req.requestNumber 
                  ? `SV-${req.requestNumber}` 
                  : (req.projectCode || 'SV-0000');

              return (
                <div 
                  key={req.id} 
                  className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col gap-2.5 transition-all hover:border-slate-300"
                >
                  {/* 1. Encabezado de la solicitud */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 
                        className="font-black text-xs sm:text-sm text-slate-900 tracking-tight leading-snug truncate uppercase"
                        title={req.projectName}
                      >
                        {req.projectName}
                      </h4>
                      <span className="text-[10px] sm:text-[11px] font-mono font-medium text-slate-500 block mt-0.5">
                        {reqCode}
                      </span>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge 
                        status={isAbierta ? 'PENDIENTE' : req.status === 'Cerrada' ? 'CERRADA' : req.status} 
                        variant={isAbierta ? 'warning' : req.status === 'Cerrada' ? 'success' : 'default'} 
                      />
                    </div>
                  </div>

                  {/* 2. Información Principal (Fila horizontal compacta de 3 secciones) */}
                  <div className="grid grid-cols-12 items-center py-2 px-1 border-t border-b border-slate-100 gap-1.5 sm:gap-2">
                    {/* Vehículo */}
                    <div className="col-span-5 min-w-0 flex items-center gap-1.5 sm:gap-2">
                      <FiTruck className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-400 leading-none block">Vehículo</span>
                        <p className="text-[11px] sm:text-xs font-bold text-slate-700 truncate mt-0.5 leading-tight" title={req.vehiculoAlias || req.vehiculoPlaca}>
                          {req.vehiculoAlias || req.vehiculoPlaca}
                        </p>
                      </div>
                    </div>

                    {/* Materiales */}
                    <div className="col-span-3 min-w-0 flex items-center gap-1.5 sm:gap-2 border-l border-slate-100 pl-2">
                      <FiBox className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-400 leading-none block">Materiales</span>
                        <p className="text-[11px] sm:text-xs font-black text-slate-800 mt-0.5 leading-tight">
                          {req.items?.length || 0}
                        </p>
                      </div>
                    </div>

                    {/* Creado por */}
                    <div className="col-span-4 min-w-0 flex items-center gap-1.5 sm:gap-2 border-l border-slate-100 pl-2">
                      <FiUser className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-400 leading-none block">Creado por</span>
                        <p className="text-[11px] sm:text-xs font-bold text-slate-700 truncate mt-0.5 leading-tight" title={req.responsibleName}>
                          {creatorName}
                        </p>
                      </div>
                      <FiChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-auto hidden sm:block" />
                    </div>
                  </div>

                  {/* 3. Acciones & Cerrar y Liquidar */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    {/* Botones de Iconos (Ver, Editar, Eliminar) */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setRequestToView(req)}
                        title="Ver detalles de solicitud"
                        className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 transition-colors shadow-xs"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>

                      {isAbierta && (
                        <button
                          type="button"
                          onClick={() => setRequestToEdit(req)}
                          title="Editar solicitud"
                          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors shadow-xs"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(req)}
                          title="Eliminar solicitud"
                          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors shadow-xs"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Cerrar y Liquidar (Si está abierta) */}
                    {isAbierta && (
                      <button
                        type="button"
                        onClick={() => setRequestToClose(req)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 border-1.5 border-emerald-500 rounded-lg text-xs font-bold tracking-wide transition-all shadow-xs ml-auto"
                      >
                        <FiCheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                        <span className="whitespace-nowrap">CERRAR Y LIQUIDAR</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
                setShowNewModal(false);
              } catch (err: any) {
                console.error('Error al crear solicitud:', err);
                await confirm({
                  title: 'Error al crear solicitud',
                  description: err?.message || 'Ocurrió un error al procesar la creación de la solicitud.',
                  confirmLabel: 'Aceptar',
                  variant: 'danger'
                });
                return;
              }
            } else {
              setShowNewModal(false);
            }
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
                setRequestToEdit(null);
              } catch (err: any) {
                console.error('Error al actualizar solicitud:', err);
                await confirm({
                  title: 'Error al actualizar solicitud',
                  description: err?.message || 'Ocurrió un error al procesar la actualización de la solicitud.',
                  confirmLabel: 'Aceptar',
                  variant: 'danger'
                });
                return;
              }
            } else {
              setRequestToEdit(null);
            }
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
                setRequestToClose(null);
              } catch (err: any) {
                console.error('Error al cerrar solicitud:', err);
                await confirm({
                  title: 'Error al cerrar solicitud',
                  description: err?.message || 'Ocurrió un error al procesar el cierre de la solicitud.',
                  confirmLabel: 'Aceptar',
                  variant: 'danger'
                });
                return;
              }
            } else {
              setRequestToClose(null);
            }
          }}
        />
      )}
    </div>
  );
};
