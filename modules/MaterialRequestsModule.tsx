import React, { useState, useMemo, useCallback } from 'react';
import { useMaterialRequests } from '../hooks/useMaterialRequests';
import { useInventory } from '../hooks/useInventory';
import { useQuotes } from '../hooks/useQuotes';
import { MaterialRequestModal } from './MaterialRequestModal';
import { ShortagesView } from '../ShortagesView';
import { useShortages } from '../hooks/useShortages';
import { User } from '../utils/types';
import { MaterialRequest } from '../dispatchTypes';
import { ModulePage } from '../components/ui/ModulePage';
import { ModuleToolbar } from '../components/ui/ModuleToolbar';
import { ActionButtons } from '../components/ui/ActionButtons';
import { isAdmin, hasPermission } from '../utils/permissions';
import { FiLoader } from "react-icons/fi";
import { generateMaterialRequestPDF } from '../utils/pdfGenerator';
import { 
  useConfirm, 
  DataTable, 
  TableColumn, 
  SearchInput, 
  ActionButton, 
  StatusBadge,
  Select
} from '../design-system';

interface MaterialRequestsModuleProps {
  currentUser: User;
  selectedId?: string;
  selectedKey?: string;
  onClearSelectedId?: () => void;
}

const STATUS_OPTIONS = [
    { label: 'Todos los Estados', value: 'Todos' },
    { label: 'Pendientes', value: 'Pendiente' },
    { label: 'Aprobadas', value: 'Aprobada' },
    { label: 'Rechazadas', value: 'Rechazada' },
    { label: 'Despachadas', value: 'Despachada' }
];

const MaterialRequestsModule: React.FC<MaterialRequestsModuleProps> = ({ currentUser, selectedId, selectedKey, onClearSelectedId }) => {
  const { 
    requests, 
    createRequest, 
    updateRequest, 
    deleteRequest, 
    updateRequestStatus, 
    isLoading,
    loadMore,
    hasMore,
    loadingMore
  } = useMaterialRequests(currentUser);
  const { items: inventoryItems } = useInventory(currentUser);
  const { quotes } = useQuotes(currentUser);
  const { shortages, createShortage } = useShortages(currentUser);
  const confirm = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaterialRequest | null>(null);

  // --- AUTO-OPEN AND HIGHLIGHT FROM SEARCH ---
  const autoOpenedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (selectedId && requests.length > 0) {
      if (autoOpenedIdRef.current !== selectedId) {
        const target = requests.find(req => 
          (selectedKey && (req as any)[selectedKey] === selectedId) || 
          req.id === selectedId
        );
        if (target) {
          autoOpenedIdRef.current = selectedId;
          setEditingRequest(target);
          setShowModal(true);
        }
      }
    }
  }, [selectedId, selectedKey, requests]);
  const [view, setView] = useState<'Requests' | 'Shortages'>('Requests');

  const approvedQuotes = useMemo(() => quotes.filter(q => q.estado === 'Aprobada'), [quotes]);

  const filteredRequests = useMemo(() => {
    // Si hay un ID seleccionado de la búsqueda y tenemos datos
    if (selectedId && selectedKey && requests.length > 0) {
      const target = requests.find(req => (req as any)[selectedKey] === selectedId);
      if (target) return [target];
      // Si no se encuentra, mostramos la lista completa (fallback)
    }

    const baseFiltered = (requests || []).filter(req => {
      const projectName = (req.projectName || "").toLowerCase();
      const requestedByName = (req.requestedByName || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      
      const matchesSearch = projectName.includes(term) || requestedByName.includes(term);
      const matchesStatus = statusFilter === 'Todos' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Sort by createdAt descending (most recent first)
    return [...baseFiltered].sort((a, b) => {
      const dateA = a.createdAt || a.date || '';
      const dateB = b.createdAt || b.date || '';
      return dateB.localeCompare(dateA);
    });
  }, [requests, searchTerm, statusFilter, selectedId, selectedKey]);

  const handleEdit = useCallback(async (req: MaterialRequest) => {
    if (req.status !== 'Pendiente') {
        await confirm({
            title: "Edición no permitida",
            description: "Solo se pueden editar solicitudes pendientes.",
            confirmLabel: "Entendido",
            variant: "warning"
        });
        return;
    }
    setEditingRequest(req);
    setShowModal(true);
  }, [confirm]);

  const handleDelete = useCallback(async (req: MaterialRequest) => {
    if (req.status === 'Aprobada') {
        await confirm({
            title: "Eliminación Bloqueada",
            description: "No se pueden eliminar solicitudes Aprobadas.",
            confirmLabel: "Entendido",
            variant: "warning"
        });
        return;
    }
    
    const shouldDelete = await confirm({
        title: "¿Eliminar Solicitud?",
        description: "¿Eliminar solicitud del historial? Esta acción es irreversible.",
        confirmLabel: "Eliminar",
        variant: "danger"
    });

    if (shouldDelete) {
        try {
            await deleteRequest(req.id);
        } catch (error: any) {
            console.error("Error deleting request:", error);
            await confirm({
                title: "Error",
                description: error.message || "No se pudo eliminar la solicitud.",
                confirmLabel: "Entendido",
                variant: "danger"
            });
        }
    }
  }, [confirm, deleteRequest]);

  const handleSave = async (data: any) => {
      let requestId = editingRequest?.id;
      let requestNumber = editingRequest?.requestNumber;
      try {
          if (editingRequest) {
              await updateRequest(editingRequest.id, data);
          } else {
              const result = await createRequest(data);
              requestId = result.id;
              requestNumber = result.requestNumber;
          }
      } catch (error: any) {
          console.error("Error saving request:", error);
          throw error;
      }
  };

  const handleStatusChange = useCallback(async (req: MaterialRequest, newStatus: any) => {
      const shouldChange = await confirm({
          title: "Cambiar Estado",
          description: `¿Cambiar estado a ${newStatus}?`,
          confirmLabel: "Confirmar",
          variant: "warning"
      });

      if (shouldChange) {
          try {
              await updateRequestStatus(req.id, newStatus);
          } catch (error: any) {
              console.error("Error updating status:", error);
              await confirm({
                  title: "Error",
                  description: error.message || "No se pudo cambiar el estado.",
                  confirmLabel: "Entendido",
                  variant: "danger"
              });
          }
      }
  }, [confirm, updateRequestStatus]);

  const columns = useMemo<TableColumn<MaterialRequest>[]>(() => [
    { 
      header: 'ID Solicitud', 
      mobileGrid: 'left',
      mobileOrder: 0,
      render: (req) => (
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-blue-600 font-bold">{req.requestNumber || 'SOL-XXXX'}</span>
          <span className="text-[9px] text-slate-400 font-medium">{req.date || '---'}</span>
        </div>
      )
    },
    { 
      header: 'Proyecto / Origen',
      mobileGrid: 'full',
      mobileOrder: 2,
      render: (req) => {
        const isIBUX = req.origin === 'IBUX-CLARO' || (req.projectName || "").toUpperCase().includes('IBUX');
        const isCNFL = req.origin === 'CNFL';

        return (
          <div className="flex flex-col gap-1">
            <div>
              <p className="font-bold text-blue-900 leading-tight">{(req.projectName || "Sin Nombre").replace(" MANTENIMIENTO", "")}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded uppercase tracking-tight">
                  {(req.origin || "N/A").replace(" MANTENIMIENTO", "")}
                </span>
                {isIBUX && req.torre && (
                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded border border-blue-100">
                    TORRE: {req.torre}
                  </span>
                )}
              </div>
            </div>
            
            {(isIBUX && req.locationDetails) && (
              <p className="text-[10px] font-medium text-slate-500 italic">
                Distrito: <span className="font-bold text-slate-700">{req.locationDetails}</span>
              </p>
            )}
            
            {(isCNFL && req.planta) && (
              <p className="text-[10px] font-medium text-slate-500 italic">
                Plantel: <span className="font-bold text-slate-700">{req.planta}</span>
              </p>
            )}
          </div>
        );
      }
    },
    { 
      header: 'Solicitante', 
      mobileGrid: 'left',
      mobileOrder: 3,
      render: (req) => <span className="font-bold text-slate-600">{(req.requestedByName || "").split('@')[0]}</span> 
    },
    { 
      header: 'Items', 
      align: 'center',
      mobileGrid: 'right',
      mobileOrder: 4,
      render: (req) => <span className="font-black text-slate-700">{(req.items || []).length}</span> 
    },
    {
      header: 'Estado',
      align: 'center',
      mobileGrid: 'right',
      mobileOrder: 5,
      render: (req) => {
          let variant: 'warning' | 'success' | 'danger' | 'info' = 'info';
          if (req.status === 'Pendiente') variant = 'warning';
          else if (req.status === 'Aprobada') variant = 'success';
          else if (req.status === 'Rechazada') variant = 'danger';
          return <StatusBadge label={req.status} variant={variant} />;
      }
    },
    {
      header: 'Acciones',
      align: 'center',
      mobileGrid: 'full',
      mobileOrder: 6,
      render: (req) => {
          const canManage = isAdmin(currentUser.role) || hasPermission(currentUser, 'inventario', 'solicitudes');
          const isCreator = req.requestedBy === currentUser.id;
          const canDelete = canManage 
              ? req.status !== 'Aprobada' 
              : (isCreator && (req.status === 'Pendiente' || req.status === 'Rechazada'));

          return (
              <div className="flex flex-wrap justify-center gap-2 py-2 md:py-1 bg-slate-50/80 rounded-xl md:bg-transparent border border-slate-100 md:border-none mt-1 md:mt-0">
                  <ActionButtons 
                      onApprove={canManage && req.status === 'Pendiente' ? () => handleStatusChange(req, 'Aprobada') : undefined}
                      onReject={canManage && req.status === 'Pendiente' ? () => handleStatusChange(req, 'Rechazada') : undefined}
                      onEdit={req.status === 'Pendiente' ? () => handleEdit(req) : undefined}
                      onDelete={canDelete ? () => handleDelete(req) : undefined}
                      onPdf={() => generateMaterialRequestPDF(req)}
                  />
              </div>
          );
      }
    }
  ], [currentUser, handleDelete, handleEdit, handleStatusChange]);

  const keyExtractor = useCallback((req: MaterialRequest) => req.id, []);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage 
        title="Solicitudes de Material" 
        subtitle="Requisiciones de materiales para despliegue en campo y proyectos."
      >
          {/* Navegación de Vistas */}
          <div className="flex gap-4 mb-6 border-b border-slate-200">
              <button 
                  onClick={() => setView('Requests')}
                  className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${view === 'Requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  Solicitudes
              </button>
              <button 
                  onClick={() => setView('Shortages')}
                  className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${view === 'Shortages' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  Faltantes de Inventario
              </button>
          </div>

          {view === 'Requests' ? (
              <>
                  <ModuleToolbar>
                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                          {selectedId ? (
                            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-xl animate-in slide-in-from-top-2 duration-300">
                                <span className="text-xs font-bold text-yellow-800">Mostrando resultado de búsqueda</span>
                                <ActionButton 
                                    onClick={onClearSelectedId} 
                                    label="Ver todos" 
                                    variant="secondary" 
                                    className="h-7 px-3 text-[10px] bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                                />
                            </div>
                          ) : (
                            <>
                              <SearchInput value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar proyecto o solicitante..." className="w-full md:w-64" />
                             <Select
                                 options={STATUS_OPTIONS}
                                 value={statusFilter}
                                 onChange={val => setStatusFilter(val)}
                                 className="w-full md:w-48"
                                 isSearchable={false}
                             />
                            </>
                          )}
                      </div>
                      <ActionButton onClick={() => { setEditingRequest(null); setShowModal(true); }} label="Nueva Solicitud" />
                  </ModuleToolbar>

                  <div className="hidden md:block">
                    <DataTable 
                        data={filteredRequests} 
                        columns={columns} 
                        keyExtractor={keyExtractor} 
                        isLoading={isLoading} 
                        emptyMessage="No hay solicitudes registradas." 
                        hasMore={hasMore}
                        onLoadMore={loadMore}
                        isLoadingMore={loadingMore}
                        enableVirtualization={true}
                        virtualHeight={600}
                        highlightedId={selectedId}
                    />
                  </div>

                  <div className="md:hidden space-y-4 px-2">
                    {isLoading ? (
                      <div className="py-12 text-center text-slate-400">
                        <FiLoader className="mr-2 animate-spin"  /> Cargando datos...
                      </div>
                    ) : filteredRequests.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        No hay solicitudes registradas.
                      </div>
                    ) : (
                      <>
                        {filteredRequests.map((req) => {
                          const canManage = isAdmin(currentUser.role) || hasPermission(currentUser, 'inventario', 'solicitudes');
                          const isCreator = req.requestedBy === currentUser.id;
                          const canDelete = canManage 
                              ? req.status !== 'Aprobada' 
                              : (isCreator && (req.status === 'Pendiente' || req.status === 'Rechazada'));

                          let variant: 'warning' | 'success' | 'danger' | 'info' = 'info';
                          if (req.status === 'Pendiente') variant = 'warning';
                          else if (req.status === 'Aprobada') variant = 'success';
                          else if (req.status === 'Rechazada') variant = 'danger';

                          const isIBUX = req.origin === 'IBUX-CLARO' || (req.projectName || "").toUpperCase().includes('IBUX');
                          const isCNFL = req.origin === 'CNFL';

                          return (
                            <div key={req.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1 flex-1 min-w-0 pr-2">
                                  <p className="font-mono text-blue-800 font-bold text-[10px]">{req.requestNumber || "---"}</p>
                                  <p className="font-black text-blue-900 text-sm leading-tight uppercase tracking-tight break-words">{(req.projectName || "Sin Nombre").replace(" MANTENIMIENTO", "")}</p>
                                  
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-tighter">{(req.origin || "N/A").replace(" MANTENIMIENTO", "")}</span>
                                    {isIBUX && req.torre && (
                                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase">T: {req.torre}</span>
                                    )}
                                    <span className="text-[10px] font-mono text-slate-400">{req.date || "N/A"}</span>
                                  </div>

                                  {(isIBUX && req.locationDetails) && (
                                    <div className="pt-1">
                                      <p className="text-[10px] font-medium text-slate-500 bg-slate-50/50 px-2 py-1 rounded-lg border border-slate-100/50">
                                        Distrito: <span className="font-black text-slate-700 uppercase tracking-tighter">{req.locationDetails}</span>
                                      </p>
                                    </div>
                                  )}

                                  {(isCNFL && req.planta) && (
                                    <div className="pt-1">
                                      <p className="text-[10px] font-medium text-slate-500 bg-slate-50/50 px-2 py-1 rounded-lg border border-slate-100/50">
                                        Plantel: <span className="font-black text-slate-700 uppercase tracking-tighter">{req.planta}</span>
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <StatusBadge label={req.status || "Pendiente"} variant={variant} />
                              </div>

                              <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50">
                                <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Solicitante</p>
                                  <p className="text-xs font-bold text-slate-700">{(req.requestedByName || "").split('@')[0]}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Items</p>
                                  <p className="text-xs font-black text-blue-600">{(req.items || []).length} productos</p>
                                </div>
                              </div>

                              <div className="flex justify-end pt-1">
                                <ActionButtons 
                                  onApprove={canManage && req.status === 'Pendiente' ? () => handleStatusChange(req, 'Aprobada') : undefined}
                                  onReject={canManage && req.status === 'Pendiente' ? () => handleStatusChange(req, 'Rechazada') : undefined}
                                  onEdit={req.status === 'Pendiente' ? () => handleEdit(req) : undefined}
                                  onDelete={canDelete ? () => handleDelete(req) : undefined}
                                  onPdf={() => generateMaterialRequestPDF(req)}
                                />
                              </div>
                            </div>
                          );
                        })}
                        
                        {loadingMore && (
                            <div className="p-4 text-center text-slate-400">
                                <FiLoader className="inline-block mr-2 animate-spin" /> Cargando más...
                            </div>
                        )}
                        {!loadingMore && hasMore && (
                            <div className="p-4 text-center">
                                <ActionButton 
                                    onClick={loadMore}
                                    label="Cargar más"
                                    variant="neutral"
                                    fullWidth
                                />
                            </div>
                        )}
                      </>
                    )}
                  </div>
              </>
          ) : (
              <ShortagesView currentUser={currentUser} />
          )}

          <MaterialRequestModal show={showModal} onClose={() => { setShowModal(false); onClearSelectedId?.(); }} onSubmit={handleSave} currentUser={currentUser} inventoryItems={inventoryItems} approvedQuotes={approvedQuotes} initialData={editingRequest} />
      </ModulePage>
    </div>
  );
};

export default MaterialRequestsModule;