import React, { useState, useMemo } from 'react';
import {
  FiBox,
  FiUser,
  FiTruck,
  FiAlertTriangle,
  FiRotateCcw,
  FiDownload,
  FiEye,
  FiTrash2,
  FiCornerDownLeft,
  FiCheckCircle,
  FiClock,
  FiFileText
} from 'react-icons/fi';
import { User } from '@/utils/types';
import { useToolAssignments } from '@/hooks/useToolAssignments';
import { useInventory } from '@/hooks/useInventory';
import { useEmployees } from '@/hooks/useEmployees';
import { getVehicleCatalog } from '@/modules/inventario/bodegas_vehiculares/services/vehicleWarehouseService';
import { ToolAssignment, RecipientType, AssignmentStatus } from '@/types/toolAssignment.types';
import { ModulePage } from '@/components/ui/ModulePage';
import { ModuleToolbar } from '@/components/ui/ModuleToolbar';
import {
  DataTable,
  TableColumn,
  SearchInput,
  Select,
  ActionButton,
  IconButton,
  StatusBadge,
  useConfirm
} from '@/design-system';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { exportToExcel, exportToPDF } from '@/utils/exportUtils';
import { isAdmin } from '@/utils/permissions';

import { NewAssignmentModal } from './modals/NewAssignmentModal';
import { ReturnAssignmentModal } from './modals/ReturnAssignmentModal';
import { IncidentReportModal } from './modals/IncidentReportModal';
import { AssignmentDetailModal } from './modals/AssignmentDetailModal';

interface AssignedToolsModuleProps {
  currentUser?: User | null;
}

export const AssignedToolsModule: React.FC<AssignedToolsModuleProps> = ({ currentUser = null }) => {
  const confirm = useConfirm();
  const { items: inventoryItems } = useInventory(currentUser);
  const { activeEmployees } = useEmployees();
  const vehicles = useMemo(() => getVehicleCatalog(), []);

  const {
    assignments,
    isLoading,
    error,
    kpis,
    addAssignment,
    returnAssignment,
    reportIncident,
    resolveIncident,
    deleteAssignment
  } = useToolAssignments(currentUser);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRecipientId, setFilterRecipientId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Modales
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [showIncidentModal, setShowIncidentModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ToolAssignment | null>(null);

  // Lista única de categorías de los artículos asignados
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    assignments.forEach((a) => {
      if (a.itemCategory) cats.add(a.itemCategory);
    });
    return Array.from(cats);
  }, [assignments]);

  // Filtrado de asignaciones
  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      // 1. Texto de búsqueda
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesCode = (item.itemCode || '').toLowerCase().includes(query);
        const matchesDesc = (item.itemDescription || '').toLowerCase().includes(query);
        const matchesRecipient = (item.recipientName || '').toLowerCase().includes(query);
        const matchesProject = (item.projectName || '').toLowerCase().includes(query) || (item.projectNumber || '').toLowerCase().includes(query);
        const matchesObs = (item.observations || '').toLowerCase().includes(query);
        const matchesCategory = (item.itemCategory || '').toLowerCase().includes(query);

        if (!matchesCode && !matchesDesc && !matchesRecipient && !matchesProject && !matchesObs && !matchesCategory) {
          return false;
        }
      }

      // 2. Tipo de destinatario
      if (filterType !== 'all' && item.recipientType !== filterType) {
        return false;
      }

      // 3. Destinatario específico
      if (filterRecipientId !== 'all' && item.recipientId !== filterRecipientId) {
        return false;
      }

      // 4. Estado
      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false;
      }

      // 5. Categoría
      if (filterCategory !== 'all' && item.itemCategory !== filterCategory) {
        return false;
      }

      return true;
    });
  }, [assignments, searchTerm, filterType, filterRecipientId, filterStatus, filterCategory]);

  // Opciones de destinatarios dinámicos según el tipo seleccionado
  const recipientOptions = useMemo(() => {
    if (filterType === 'colaborador') {
      return [
        { label: 'Todos los colaboradores', value: 'all' },
        ...activeEmployees.map((e) => ({ label: e.name, value: e.id }))
      ];
    }
    if (filterType === 'unidad') {
      return [
        { label: 'Todas las unidades', value: 'all' },
        ...vehicles.map((v) => ({ label: v.displayName || v.name || v.id, value: v.id }))
      ];
    }
    return [
      { label: 'Todos los destinatarios', value: 'all' },
      ...activeEmployees.map((e) => ({ label: `👤 ${e.name}`, value: e.id })),
      ...vehicles.map((v) => ({ label: `🚚 ${v.displayName || v.name || v.id}`, value: v.id }))
    ];
  }, [filterType, activeEmployees, vehicles]);

  // Manejo de exportación a Excel
  const handleExportExcel = () => {
    const dataToExport = filteredAssignments.map((a) => ({
      'Código': a.itemCode,
      'Descripción': a.itemDescription,
      'Categoría': a.itemCategory || 'Herramientas',
      'Cantidad': a.quantity,
      'Unidad': a.itemUnit || 'unid',
      'Tipo Destinatario': a.recipientType === 'colaborador' ? 'Colaborador' : 'Unidad Vehicular',
      'Destinatario': a.recipientName,
      'Detalle Destinatario': a.recipientDetail || '',
      'Fecha Asignación': a.assignedDate,
      'Condición Inicial': a.initialCondition,
      'Estado': a.status,
      'Fecha Devolución': a.returnDate || 'Pendiente',
      'Condición Devolución': a.returnCondition || '',
      'Recibido Por': a.returnHandledBy || '',
      'Proyecto': a.projectName ? `[${a.projectNumber || 'PROY'}] ${a.projectName}` : 'Sin proyecto',
      'Entregado Por': a.assignedBy,
      'Observaciones': a.observations || '',
      'Incidencia': a.incidentReport ? `${a.incidentReport.severity}: ${a.incidentReport.description}` : 'Sin incidencia'
    }));

    exportToExcel(
      dataToExport,
      `Herramientas_Asignadas_${new Date().toISOString().split('T')[0]}`,
      'Asignaciones'
    );
  };

  // Manejo de exportación a PDF
  const handleExportPDF = () => {
    const columns = [
      { header: 'Código', dataKey: 'itemCode', width: 60 },
      { header: 'Herramienta / Equipo', dataKey: 'itemDescription', width: 140 },
      { header: 'Tipo', dataKey: 'recipientTypeFormatted', width: 60 },
      { header: 'Destinatario', dataKey: 'recipientName', width: 120 },
      { header: 'Cant.', dataKey: 'quantity', width: 40, align: 'center' as const },
      { header: 'Fecha Asig.', dataKey: 'assignedDate', width: 60, align: 'center' as const },
      { header: 'Estado', dataKey: 'status', width: 70, align: 'center' as const }
    ];

    const data = filteredAssignments.map((a) => ({
      itemCode: a.itemCode,
      itemDescription: a.itemDescription,
      recipientTypeFormatted: a.recipientType === 'colaborador' ? 'Colaborador' : 'Unidad',
      recipientName: a.recipientName,
      quantity: `${a.quantity} ${a.itemUnit || 'unid'}`,
      assignedDate: a.assignedDate,
      status: a.status
    }));

    exportToPDF({
      title: 'Reporte de Herramientas y Equipos Asignados',
      subtitle: `Total Registros: ${filteredAssignments.length} | Fecha: ${new Date().toLocaleDateString('es-CR')}`,
      fileName: `Herramientas_Asignadas_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      orientation: 'l'
    });
  };

  // Manejo de eliminación
  const handleDelete = async (assignment: ToolAssignment) => {
    const confirmed = await confirm({
      title: '¿Eliminar registro de asignación?',
      description: `¿Está seguro de eliminar la asignación de ${assignment.itemDescription} a ${assignment.recipientName}? Si la herramienta no fue devuelta, su stock será reintegrado automáticamente al inventario.`,
      confirmLabel: 'Eliminar Registro',
      variant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteAssignment(assignment.id);
      } catch (err: any) {
        console.error('Error al eliminar asignación:', err);
        await confirm({
          title: 'Error al eliminar',
          description: err?.message || 'Ocurrió un error al intentar eliminar la asignación.',
          confirmLabel: 'Aceptar',
          variant: 'danger'
        });
      }
    }
  };

  // Handlers para abrir modales
  const handleOpenDetail = (assignment: ToolAssignment) => {
    setSelectedAssignment(assignment);
    setShowDetailModal(true);
  };

  const handleOpenReturn = (assignment: ToolAssignment) => {
    setSelectedAssignment(assignment);
    setShowReturnModal(true);
  };

  const handleOpenIncident = (assignment: ToolAssignment) => {
    setSelectedAssignment(assignment);
    setShowIncidentModal(true);
  };

  // Status variant helper
  const getStatusVariant = (status: AssignmentStatus) => {
    switch (status) {
      case 'Devuelto':
        return 'success';
      case 'Con incidencia':
        return 'danger';
      case 'En uso':
      case 'Asignado':
      default:
        return 'info';
    }
  };

  // Definición de columnas de DataTable
  const columns: TableColumn<ToolAssignment>[] = [
    {
      key: 'item',
      header: 'Herramienta / Equipo',
      render: (assignment) => (
        <div className="space-y-0.5 max-w-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-black bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
              {assignment.itemCode}
            </span>
            {assignment.itemCategory && (
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                {assignment.itemCategory}
              </span>
            )}
          </div>
          <p className="font-bold text-xs text-slate-900 leading-tight">
            {assignment.itemDescription}
          </p>
        </div>
      )
    },
    {
      key: 'recipient',
      header: 'Destinatario',
      render: (assignment) => (
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-none text-xs font-bold ${
              assignment.recipientType === 'colaborador'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {assignment.recipientType === 'colaborador' ? (
              <FiUser className="text-sm" />
            ) : (
              <FiTruck className="text-sm" />
            )}
          </div>
          <div>
            <p className="font-bold text-xs text-slate-900 leading-tight">
              {assignment.recipientName}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              {assignment.recipientType === 'colaborador' ? 'Colaborador' : 'Unidad Vehicular'}
              {assignment.recipientDetail ? ` • ${assignment.recipientDetail}` : ''}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'center',
      render: (assignment) => (
        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-200">
          {assignment.quantity} {assignment.itemUnit || 'unid'}
        </div>
      )
    },
    {
      key: 'assignedDate',
      header: 'Fecha Entrega',
      align: 'center',
      render: (assignment) => (
        <span className="text-xs font-bold text-slate-700">
          {assignment.assignedDate}
        </span>
      )
    },
    {
      key: 'condition',
      header: 'Condición',
      render: (assignment) => (
        <div className="text-xs space-y-0.5">
          <span className="text-slate-600 font-medium block">
            Inicial: <strong>{assignment.initialCondition}</strong>
          </span>
          {assignment.status === 'Devuelto' && assignment.returnCondition && (
            <span className="text-emerald-700 font-medium block text-[11px]">
              Devuelto: <strong>{assignment.returnCondition}</strong>
            </span>
          )}
        </div>
      )
    },
    {
      key: 'project',
      header: 'Proyecto / Trabajo',
      render: (assignment) => (
        assignment.projectName ? (
          <div className="text-xs max-w-[180px]">
            <span className="font-mono text-[10px] font-bold text-blue-700 block truncate">
              {assignment.projectNumber || 'PROY'}
            </span>
            <span className="text-slate-800 font-medium truncate block" title={assignment.projectName}>
              {assignment.projectName}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">No asignado</span>
        )
      )
    },
    {
      key: 'status',
      header: 'Estado',
      align: 'center',
      render: (assignment) => (
        <StatusBadge
          status={assignment.status}
          variant={getStatusVariant(assignment.status)}
          size="sm"
        />
      )
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (assignment) => {
        const isReturned = assignment.status === 'Devuelto';
        const isUserAdmin = currentUser ? isAdmin(currentUser.role) : false;

        return (
          <div className="flex items-center justify-end gap-1">
            <IconButton
              icon={<FiEye />}
              variant="ghost"
              size="sm"
              title="Ver detalle y trazabilidad"
              onClick={() => handleOpenDetail(assignment)}
              className="text-slate-600 hover:text-blue-600 hover:bg-blue-50"
            />
            {!isReturned && (
              <IconButton
                icon={<FiCornerDownLeft />}
                variant="ghost"
                size="sm"
                title="Registrar devolución"
                onClick={() => handleOpenReturn(assignment)}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              />
            )}
            {!isReturned && (
              <IconButton
                icon={<FiAlertTriangle />}
                variant="ghost"
                size="sm"
                title={
                  assignment.incidentReport && assignment.incidentReport.status === 'Abierta'
                    ? 'Resolver Incidencia'
                    : 'Reportar Incidencia'
                }
                onClick={() => handleOpenIncident(assignment)}
                className={
                  assignment.incidentReport && assignment.incidentReport.status === 'Abierta'
                    ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                    : 'text-rose-500 hover:text-rose-600 hover:bg-rose-50'
                }
              />
            )}
            {isUserAdmin && (
              <IconButton
                icon={<FiTrash2 />}
                variant="ghost"
                size="sm"
                title="Eliminar asignación"
                onClick={() => handleDelete(assignment)}
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              />
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage
        title="Herramientas y Equipos Asignados"
        subtitle="Control de entrega, recepción y trazabilidad de herramientas y equipos asignados a colaboradores y unidades vehiculares."
        rightContent={
          <ActionButton
            label="Nueva Asignación"
            onClick={() => setShowNewModal(true)}
            variant="primary"
          />
        }
      >
      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
        {/* Total Asignados Activos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiBox />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              En Custodia Activa
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900">
              {kpis.totalAssignedUnits}
              <span className="text-xs font-bold text-slate-400 ml-1">unid.</span>
            </h4>
          </div>
        </div>

        {/* A Colaboradores */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiUser />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              A Colaboradores
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900">
              {kpis.toEmployeesUnits}
              <span className="text-xs font-bold text-slate-400 ml-1">unid.</span>
            </h4>
          </div>
        </div>

        {/* A Unidades */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiTruck />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              A Unidades Flota
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900">
              {kpis.toVehiclesUnits}
              <span className="text-xs font-bold text-slate-400 ml-1">unid.</span>
            </h4>
          </div>
        </div>

        {/* Pendientes de Devolución */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiClock />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Pendientes Retorno
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900">
              {kpis.pendingReturnCount}
              <span className="text-xs font-bold text-slate-400 ml-1">reg.</span>
            </h4>
          </div>
        </div>

        {/* Con Incidencias */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 col-span-2 sm:col-span-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-none font-bold ${
              kpis.activeIncidentsCount > 0
                ? 'bg-rose-50 text-rose-600 animate-pulse'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            <FiAlertTriangle />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Con Incidencias
            </p>
            <h4
              className={`text-lg md:text-xl font-black ${
                kpis.activeIncidentsCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {kpis.activeIncidentsCount}
              <span className="text-xs font-bold text-slate-400 ml-1">reg.</span>
            </h4>
          </div>
        </div>
      </div>

      {/* TOOLBAR & FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 mb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por artículo, código, colaborador, placa, proyecto..."
            />
          </div>

          {/* Filtros Dropdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-wrap">
            {/* Tipo */}
            <Select
              options={[
                { label: 'Todos los tipos', value: 'all' },
                { label: '👤 Colaborador', value: 'colaborador' },
                { label: '🚚 Unidad Vehicular', value: 'unidad' }
              ]}
              value={filterType}
              onChange={(val) => {
                setFilterType(val);
                setFilterRecipientId('all');
              }}
              isSearchable={false}
            />

            {/* Destinatario */}
            <Select
              options={recipientOptions}
              value={filterRecipientId}
              onChange={setFilterRecipientId}
              isSearchable={true}
              placeholder="Destinatario"
            />

            {/* Estado */}
            <Select
              options={[
                { label: 'Todos los estados', value: 'all' },
                { label: '🔵 Asignado / En uso', value: 'Asignado' },
                { label: '🟢 Devuelto', value: 'Devuelto' },
                { label: '🔴 Con incidencia', value: 'Con incidencia' }
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              isSearchable={false}
            />

            {/* Categoría */}
            <Select
              options={[
                { label: 'Todas las categorías', value: 'all' },
                ...uniqueCategories.map((c) => ({ label: c, value: c }))
              ]}
              value={filterCategory}
              onChange={setFilterCategory}
              isSearchable={true}
              placeholder="Categoría"
            />
          </div>

          {/* Botones de Exportación */}
          <div className="flex items-center gap-2">
            <ActionButton
              type="button"
              variant="secondary"
              label="Excel"
              icon={<FiDownload />}
              onClick={handleExportExcel}
              className="!py-2.5 !px-3 !text-xs !font-bold"
            />
            <ActionButton
              type="button"
              variant="secondary"
              label="PDF"
              icon={<FiFileText />}
              onClick={handleExportPDF}
              className="!py-2.5 !px-3 !text-xs !font-bold"
            />
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      {filteredAssignments.length === 0 && !isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-3">
            <FiBox />
          </div>
          <h4 className="text-base font-bold text-slate-800 mb-1">
            No se encontraron asignaciones
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            {searchTerm || filterType !== 'all' || filterStatus !== 'all' || filterCategory !== 'all'
              ? 'No hay registros que coincidan con los filtros aplicados. Intenta restablecer o modificar la búsqueda.'
              : 'Aún no hay herramientas o equipos asignados. Puedes registrar la primera entrega utilizando el botón de Nueva Asignación.'}
          </p>
          <ActionButton
            label="Nueva Asignación"
            onClick={() => setShowNewModal(true)}
            variant="primary"
          />
        </div>
      ) : (
        <DataTable
          data={filteredAssignments}
          columns={columns}
          isLoading={isLoading}
          keyExtractor={(item) => item.id}
          showItemCount={true}
        />
      )}

      {/* MODALES */}
      <NewAssignmentModal
        show={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={addAssignment}
        currentUser={currentUser}
        inventoryItems={inventoryItems}
      />

      <ReturnAssignmentModal
        show={showReturnModal}
        onClose={() => {
          setShowReturnModal(false);
          setSelectedAssignment(null);
        }}
        onSubmit={returnAssignment}
        assignment={selectedAssignment}
        currentUser={currentUser}
      />

      <IncidentReportModal
        show={showIncidentModal}
        onClose={() => {
          setShowIncidentModal(false);
          setSelectedAssignment(null);
        }}
        onReportIncident={reportIncident}
        onResolveIncident={resolveIncident}
        assignment={selectedAssignment}
        currentUser={currentUser}
      />

      <AssignmentDetailModal
        show={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedAssignment(null);
        }}
        assignment={selectedAssignment}
        onOpenReturn={handleOpenReturn}
        onOpenIncident={handleOpenIncident}
      />
    </ModulePage>
    </div>
  );
};
