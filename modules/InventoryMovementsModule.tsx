import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import { useInventory } from '../hooks/useInventory';
import { useQuotes } from '../hooks/useQuotes';
import { useMaterialRequests } from '../hooks/useMaterialRequests';
import { User } from '../utils/types';
import { InventoryMovementModal } from './InventoryMovementModal';
import { ProjectConsumptionModule } from './ProjectConsumptionModule';
import { DispatchModule } from './DispatchModule';
import { hasPermission } from '../utils/permissions';
import { InventoryMovement } from '../inventoryMovementTypes';
import { ModulePage } from '../components/ui/ModulePage';
import { ModuleToolbar } from '../components/ui/ModuleToolbar';
import { FiList, FiPieChart, FiTruck } from "react-icons/fi";
import { exportMovementToExcel, exportMovementToPdf } from '../utils/export/inventoryExport';
import { normalizeOrigin } from '../utils/originUtils';
import { 
  DataTable, 
  TableColumn, 
  SearchInput, 
  ActionButton, 
  ACTION_ICONS, 
  ConfirmModal,
  IconButton,
  StatusBadge,
  Select
} from '../design-system';

interface InventoryMovementsModuleProps {
  currentUser: User;
  selectedId?: string;
  selectedKey?: string;
  onClearSelectedId?: () => void;
}

const InventoryMovementsModule: React.FC<InventoryMovementsModuleProps> = ({ currentUser, selectedId, selectedKey, onClearSelectedId }) => {
  const { 
    movements, 
    isLoading, 
    error, 
    addMovement, 
    updateMovement, 
    deleteMovement,
    loadMore,
    hasMore,
    loadingMore
  } = useInventoryMovements(currentUser);
  const { items: inventoryItems } = useInventory(currentUser);
  const { quotes } = useQuotes(currentUser);
  const { requests } = useMaterialRequests(currentUser);

  // Estado para las pestañas
  const [activeTab, setActiveTab] = useState<'history' | 'consumption' | 'dispatch'>('history');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Todos' | 'Entrada' | 'Salida' | 'Devolución'>('Todos');
  const [projectFilter, setProjectFilter] = useState('Todos');
  const [dateFilter, setDateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMovement, setEditingMovement] = useState<InventoryMovement | null>(null);

  // --- AUTO-OPEN AND HIGHLIGHT FROM SEARCH ---
  const autoOpenedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedId && movements.length > 0) {
      if (autoOpenedIdRef.current !== selectedId) {
        const target = movements.find(m => m.id === selectedId);
        if (target) {
          autoOpenedIdRef.current = selectedId;
          setEditingMovement(target);
          setShowModal(true);
        }
      }
    }
  }, [selectedId, movements]);
  
  // Estado para modal de confirmación de eliminación
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ show: boolean, movement: InventoryMovement | null }>({ show: false, movement: null });

  // Filtrar solo cotizaciones aprobadas para el selector de proyecto
  const approvedQuotes = useMemo(() => quotes.filter(q => q.estado === 'Aprobada'), [quotes]);

  // Proyectos únicos presentes en los movimientos para el filtro
  const projectsInHistory = useMemo(() => {
      const projects = new Map<string, string>();
      (movements || []).forEach(m => {
          if (m.projectId && m.projectName) {
              projects.set(m.projectId, m.projectName);
          }
      });
      return Array.from(projects.entries());
  }, [movements]);

  // Proveedores únicos para el autocompletado (Desde Inventario General)
  const uniqueProviders = useMemo(() => {
      const providers = new Set<string>();
      inventoryItems.forEach(item => {
          if (item.providers) {
              item.providers.forEach(p => {
                  if (p.name) providers.add(p.name);
              });
          }
      });
      return Array.from(providers).sort();
  }, [inventoryItems]);

  const filteredMovements = useMemo(() => {
    // Si hay un ID seleccionado de la búsqueda y tenemos datos
    if (selectedId && movements.length > 0) {
      const target = movements.find(m => m.id === selectedId);
      if (target) return [target];
      // Si no se encuentra, mostramos la lista completa (fallback)
    }

    return (movements || []).filter(m => {
        const itemsMatch = m.items 
            ? m.items.some(i => (i.inventoryItemCode || "").toLowerCase().includes(searchTerm.toLowerCase()) || (i.inventoryItemName || "").toLowerCase().includes(searchTerm.toLowerCase()))
            : (m.inventoryItemCode || "").toLowerCase().includes(searchTerm.toLowerCase()) || (m.inventoryItemName || "").toLowerCase().includes(searchTerm.toLowerCase());

        const search = searchTerm.toLowerCase();
        const matchesSearch = itemsMatch || 
            (m.observations && m.observations.toLowerCase().includes(search)) ||
            (m.projectName && m.projectName.toLowerCase().includes(search)) ||
            (m.requestNumber && m.requestNumber.toLowerCase().includes(search)) ||
            (m.fdh && m.fdh.toLowerCase().includes(search)) ||
            (m.torre && m.torre.toLowerCase().includes(search));
        const matchesType = typeFilter === 'Todos' || m.type === typeFilter;
        const matchesProject = projectFilter === 'Todos' || m.projectId === projectFilter;
        const matchesDate = !dateFilter || m.date === dateFilter;

        return matchesSearch && matchesType && matchesProject && matchesDate;
    });
  }, [movements, searchTerm, typeFilter, projectFilter, dateFilter, selectedId]);

  const handleEdit = useCallback((movement: InventoryMovement) => {
      setEditingMovement(movement);
      setShowModal(true);
  }, []);

  const handleModalSubmit = useCallback(async (data: any) => {
      if (editingMovement) {
          await updateMovement(editingMovement.id, data);
      } else {
          await addMovement(data);
      }
      setEditingMovement(null);
  }, [editingMovement, updateMovement, addMovement]);

  const handleDeleteClick = useCallback((movement: InventoryMovement) => {
      setConfirmDeleteModal({ show: true, movement });
  }, []);

  const confirmDelete = useCallback(async () => {
      if (confirmDeleteModal.movement) {
          try {
              await deleteMovement(confirmDeleteModal.movement.id);
              setConfirmDeleteModal({ show: false, movement: null });
          } catch (error) {
              alert("Error al eliminar el movimiento.");
          }
      }
  }, [confirmDeleteModal.movement, deleteMovement]);

  const handleCloseModal = useCallback(() => {
      setShowModal(false);
      setEditingMovement(null);
      onClearSelectedId?.();
  }, [onClearSelectedId]);

  const canViewDispatch = hasPermission(currentUser, 'inventario', 'solicitudes');

  // Definición de Columnas para DataTable
  const columns = useMemo<TableColumn<InventoryMovement>[]>(() => [
    {
        header: 'Tipo',
        align: 'center',
        width: '120px',
        render: (m) => {
            const badgeVariant = m.type === 'Entrada' ? 'success' : m.type === 'Devolución' ? 'warning' : 'danger';
            const typeLabel = m.type === 'Entrada' ? '+ ENTRADA' : m.type === 'Devolución' ? '↺ DEVOLUCIÓN' : '- SALIDA';
            return (
                <div className="flex flex-col items-center">
                    <StatusBadge label={typeLabel} variant={badgeVariant} />
                </div>
            );
        }
    },
    {
        header: 'FDH',
        accessorKey: 'fdh',
        width: '80px'
    },
    {
        header: 'ID Solicitud',
        render: (m) => (
            <div className="flex flex-col">
                <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">
                    {m.requestNumber || 'SOL-XXXX'}
                </span>
                <span className="text-[9px] text-slate-400 font-medium mt-1">{m.date || '---'}</span>
            </div>
        )
    },
    {
        header: 'PROYECTO / ORIGEN',
        render: (m) => (
            <span className="text-xs font-medium text-slate-700">
                {normalizeOrigin(m.origin || '---')}
            </span>
        )
    },
    {
        header: 'Acciones',
        align: 'center',
        width: '180px',
        render: (m) => (
            <div className="flex justify-center items-center gap-2">
                <IconButton 
                    icon={<ACTION_ICONS.excel />} 
                    onClick={() => exportMovementToExcel(m)} 
                    variant="success" 
                    title="Exportar Excel" 
                />
                <IconButton 
                    icon={<ACTION_ICONS.pdf />} 
                    onClick={() => exportMovementToPdf(m)} 
                    variant="danger" 
                    title="Exportar PDF" 
                />
                <IconButton 
                    icon={<ACTION_ICONS.edit />} 
                    onClick={() => handleEdit(m)} 
                    variant="primary" 
                    title="Editar Movimiento" 
                />
                <IconButton 
                    icon={<ACTION_ICONS.delete />} 
                    onClick={() => handleDeleteClick(m)} 
                    variant="danger" 
                    title="Eliminar Movimiento" 
                />
            </div>
        )
    }
  ], [handleEdit, handleDeleteClick]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
    <ModulePage 
      title="Movimientos de Inventario" 
      subtitle="Trazabilidad completa de entradas, salidas y devoluciones de materiales."
    >
          <ModuleToolbar>
              <div className="flex border-b border-slate-200 overflow-x-auto w-full md:w-auto">
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
                      <ActionButton 
                          onClick={() => setActiveTab('history')} 
                          className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap rounded-none bg-transparent shadow-none min-h-0 ${activeTab === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                          variant="secondary"
                          label="Historial"
                          icon={<FiList />}
                      />
                      <ActionButton 
                          onClick={() => setActiveTab('consumption')} 
                          className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap rounded-none bg-transparent shadow-none min-h-0 ${activeTab === 'consumption' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                          variant="secondary"
                          label="Consumo por Proyecto"
                          icon={<FiPieChart />}
                      />
                      {canViewDispatch && (
                          <ActionButton 
                              onClick={() => setActiveTab('dispatch')} 
                              className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap rounded-none bg-transparent shadow-none min-h-0 ${activeTab === 'dispatch' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                              variant="secondary"
                              label="Despacho"
                              icon={<FiTruck />}
                          />
                      )}
                    </>
                  )}
              </div>

              <ActionButton onClick={() => { setEditingMovement(null); setShowModal(true); }} label="Registrar Movimiento" />
          </ModuleToolbar>

          <div className="mt-6">
              {activeTab === 'history' && (
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <SearchInput placeholder="Buscar por Proyecto, ID (SOL-XXXX), FDH o Torre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                          <Select
                              options={[
                                  { label: 'Todos los Tipos', value: 'Todos' },
                                  { label: 'Entradas', value: 'Entrada' },
                                  { label: 'Salidas', value: 'Salida' },
                                  { label: 'Devoluciones', value: 'Devolución' }
                              ]}
                              value={typeFilter}
                              onChange={val => setTypeFilter(val as any)}
                              className="w-full"
                              isSearchable={false}
                          />
                          <Select
                              options={[
                                  { label: 'Todos los Proyectos', value: 'Todos' },
                                  ...projectsInHistory.map(([id, name]) => ({ label: name, value: id }))
                              ]}
                              value={projectFilter}
                              onChange={val => setProjectFilter(val)}
                              className="w-full"
                              isSearchable={false}
                          />
                          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none text-slate-500" />
                      </div>

                      <DataTable 
                        data={filteredMovements} 
                        columns={columns} 
                        keyExtractor={(m: InventoryMovement) => m.id} 
                        isLoading={isLoading} 
                        emptyMessage="No se encontraron movimientos registrados." 
                        hasMore={hasMore}
                        onLoadMore={loadMore}
                        isLoadingMore={loadingMore}
                        enableVirtualization={true}
                        virtualHeight={600}
                        highlightedId={selectedId}
                      />
                  </div>
              )}

              {activeTab === 'consumption' && <ProjectConsumptionModule movements={movements} inventoryItems={inventoryItems} currentUser={currentUser} />}
              {activeTab === 'dispatch' && canViewDispatch && <DispatchModule currentUser={currentUser} inventoryItems={inventoryItems} />}
          </div>

          <InventoryMovementModal 
              show={showModal} 
              onClose={handleCloseModal} 
              onSubmit={handleModalSubmit} 
              currentUser={currentUser} 
              inventoryItems={inventoryItems} 
              approvedQuotes={approvedQuotes}
              requests={requests}
              initialData={editingMovement}
              uniqueProviders={uniqueProviders}
          />
          
          <ConfirmModal show={confirmDeleteModal.show} onClose={() => setConfirmDeleteModal({ show: false, movement: null })} onConfirm={confirmDelete} title="¿Eliminar Movimiento?" description="Esta acción eliminará el registro del movimiento. ¿Deseas continuar?" />
      </ModulePage>
    </div>
  );
};

export default InventoryMovementsModule;