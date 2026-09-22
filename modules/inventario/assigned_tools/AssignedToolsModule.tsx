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
  FiFileText,
  FiChevronRight
} from 'react-icons/fi';
import { User } from '@/utils/types';
import { useToolAssignments } from '@/hooks/useToolAssignments';
import { useInventory } from '@/hooks/useInventory';
import { useEmployees } from '@/hooks/useEmployees';
import { getVehicleCatalog } from '@/modules/inventario/bodegas_vehiculares/services/vehicleWarehouseService';
import { ToolAssignment, RecipientType } from '@/types/toolAssignment.types';
import { ModulePage } from '@/components/ui/ModulePage';
import { ModuleToolbar } from '@/components/ui/ModuleToolbar';
import {
  DataTable,
  TableColumn,
  SearchInput,
  Select,
  ActionButton,
  IconButton,
  useConfirm
} from '@/design-system';
import { exportToExcel, exportToPDF } from '@/utils/exportUtils';
import { isAdmin } from '@/utils/permissions';

import { NewAssignmentModal } from './modals/NewAssignmentModal';
import { ReturnAssignmentModal } from './modals/ReturnAssignmentModal';
import { IncidentReportModal } from './modals/IncidentReportModal';
import { AssignmentDetailModal } from './modals/AssignmentDetailModal';
import { RecipientDetailModal } from './modals/RecipientDetailModal';

export interface GroupedRecipient {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientType: RecipientType;
  recipientDetail?: string;
  count: number;
  assignments: ToolAssignment[];
}

interface AssignedToolsModuleProps {
  currentUser?: User | null;
}

export const AssignedToolsModule: React.FC<AssignedToolsModuleProps> = ({ currentUser = null }) => {
  const confirm = useConfirm();
  const { items: inventoryItems } = useInventory(currentUser, { fetchAll: true });
  const { activeEmployees } = useEmployees();
  const vehicles = useMemo(() => getVehicleCatalog(), []);

  const {
    assignments,
    isLoading,
    error,
    kpis,
    addAssignment,
    addAssignmentBatch,
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
  const [selectedRecipientGroupId, setSelectedRecipientGroupId] = useState<string | null>(null);

  // Mapa maestro de catálogo de inventario general para garantizar fuente única de verdad
  const masterInventoryMap = useMemo(() => {
    const mapById = new Map<string, any>();
    const mapByCode = new Map<string, any>();
    if (Array.isArray(inventoryItems)) {
      inventoryItems.forEach((item) => {
        if (item) {
          if (item.id) mapById.set(item.id, item);
          if (item.code) mapByCode.set(item.code, item);
        }
      });
    }
    return { mapById, mapByCode };
  }, [inventoryItems]);

  // Enriquecer asignaciones con la información del inventario maestro en tiempo real
  const enrichedAssignments = useMemo(() => {
    return assignments.map((a) => {
      const master = masterInventoryMap.mapById.get(a.itemId) || masterInventoryMap.mapByCode.get(a.itemCode);
      if (!master) return a;
      return {
        ...a,
        itemCategory: master.category || a.itemCategory,
        itemDescription: master.description || a.itemDescription,
        itemCode: master.code || a.itemCode,
        itemUnit: master.unit || a.itemUnit
      };
    });
  }, [assignments, masterInventoryMap]);

  // Lista única de categorías de los artículos asignados
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    enrichedAssignments.forEach((a) => {
      if (a.itemCategory) cats.add(a.itemCategory);
    });
    return Array.from(cats);
  }, [enrichedAssignments]);

  // Estadísticas y Métricas alineadas a Destinatarios y Asignaciones (Opción 2)
  const stats = useMemo(() => {
    let totalItemsQuantity = 0;
    let totalActiveAssignmentsCount = 0;
    let pendingReturnAssignmentsCount = 0;
    let incidentCount = 0;

    const activeColaboradorIds = new Set<string>();
    const activeUnidadIds = new Set<string>();

    enrichedAssignments.forEach((a) => {
      const isDevuelto = a.status === 'Devuelto';
      const recipientKey = a.recipientId || `${a.recipientType}_${a.recipientName}`;

      if (!isDevuelto) {
        totalActiveAssignmentsCount += 1;
        totalItemsQuantity += a.quantity || 1;
        pendingReturnAssignmentsCount += 1;

        if (a.recipientType === 'colaborador') {
          activeColaboradorIds.add(recipientKey);
        } else {
          activeUnidadIds.add(recipientKey);
        }
      }

      if (
        a.status === 'Con incidencia' ||
        (a.incidentReport && a.incidentReport.status === 'Abierta')
      ) {
        incidentCount += 1;
      }
    });

    return {
      activeDestinatariosCount: activeColaboradorIds.size + activeUnidadIds.size,
      activeColaboradoresCount: activeColaboradorIds.size,
      activeUnidadesCount: activeUnidadIds.size,
      totalActiveAssignmentsCount,
      totalItemsQuantity,
      pendingReturnAssignmentsCount,
      incidentCount
    };
  }, [enrichedAssignments]);

  // Filtrado de asignaciones
  const filteredAssignments = useMemo(() => {
    return enrichedAssignments.filter((item) => {
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
      if (filterRecipientId !== 'all') {
        const itemKey = item.recipientId === 'externo' 
          ? `colaborador_${item.recipientName}` 
          : (item.recipientId || `${item.recipientType}_${item.recipientName}`);
        
        if (
          item.recipientId !== filterRecipientId &&
          item.recipientName !== filterRecipientId &&
          itemKey !== filterRecipientId &&
          `ext_${item.recipientName}` !== filterRecipientId
        ) {
          return false;
        }
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
  }, [enrichedAssignments, searchTerm, filterType, filterRecipientId, filterStatus, filterCategory]);

  // Agrupación por Destinatario (una fila por colaborador, unidad vehicular o destinatario externo)
  const groupedRecipients = useMemo(() => {
    const groupsMap = new Map<string, GroupedRecipient>();

    filteredAssignments.forEach((item) => {
      const key = item.recipientId === 'externo' 
        ? `colaborador_${item.recipientName}` 
        : (item.recipientId || `${item.recipientType}_${item.recipientName}`);

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          id: key,
          recipientId: item.recipientId,
          recipientName: item.recipientName,
          recipientType: item.recipientType,
          recipientDetail: item.recipientDetail,
          count: 0,
          assignments: []
        });
      }
      const group = groupsMap.get(key)!;
      group.assignments.push(item);
      group.count += 1;
    });

    return Array.from(groupsMap.values());
  }, [filteredAssignments]);

  const activeGroup = useMemo(() => {
    if (!selectedRecipientGroupId) return null;
    return groupedRecipients.find((g) => g.id === selectedRecipientGroupId) || null;
  }, [selectedRecipientGroupId, groupedRecipients]);

  const recipientAllAssignments = useMemo(() => {
    if (!selectedRecipientGroupId) return [];
    return enrichedAssignments.filter((item) => {
      const key = item.recipientId === 'externo' 
        ? `colaborador_${item.recipientName}` 
        : (item.recipientId || `${item.recipientType}_${item.recipientName}`);
      return key === selectedRecipientGroupId;
    });
  }, [selectedRecipientGroupId, enrichedAssignments]);

  // Opciones de destinatarios dinámicos según el tipo seleccionado
  const recipientOptions = useMemo(() => {
    const externalRecipients = Array.from(
      new Set(
        enrichedAssignments
          .filter(
            (a) =>
              a.recipientType === 'colaborador' &&
              (a.isExternalRecipient || !a.recipientId || a.recipientId === 'externo' || !activeEmployees.some((e) => e.id === a.recipientId))
          )
          .map((a) => a.recipientName)
      )
    ).filter(Boolean);

    if (filterType === 'colaborador') {
      return [
        { label: 'Todos los colaboradores', value: 'all' },
        ...activeEmployees.map((e) => ({ label: e.name, value: e.id })),
        ...externalRecipients.map((name) => ({ label: `👤 ${name} (Externo)`, value: `ext_${name}` }))
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
      ...externalRecipients.map((name) => ({ label: `👤 ${name} (Externo)`, value: `ext_${name}` })),
      ...vehicles.map((v) => ({ label: `🚚 ${v.displayName || v.name || v.id}`, value: v.id }))
    ];
  }, [filterType, activeEmployees, vehicles, enrichedAssignments]);

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
      `Control_Asignaciones_${new Date().toISOString().split('T')[0]}`,
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
      { header: 'Condición', dataKey: 'initialCondition', width: 70, align: 'center' as const }
    ];

    const data = filteredAssignments.map((a) => ({
      itemCode: a.itemCode,
      itemDescription: a.itemDescription,
      recipientTypeFormatted: a.recipientType === 'colaborador' ? 'Colaborador' : 'Unidad',
      recipientName: a.recipientName,
      quantity: `${a.quantity} ${a.itemUnit || 'unid'}`,
      assignedDate: a.assignedDate,
      initialCondition: a.initialCondition
    }));

    exportToPDF({
      title: 'Control de Asignaciones',
      subtitle: `Total Registros: ${filteredAssignments.length} | Fecha: ${new Date().toLocaleDateString('es-CR')}`,
      fileName: `Control_Asignaciones_${new Date().toISOString().split('T')[0]}`,
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

  // Definición de columnas de la tabla principal agrupada por Destinatario
  const groupColumns: TableColumn<GroupedRecipient>[] = [
    {
      key: 'recipientName',
      header: 'Destinatario',
      className: 'min-w-[220px]',
      render: (group) => (
        <div
          className="flex items-center gap-3 w-full cursor-pointer py-1"
          onClick={() => setSelectedRecipientGroupId(group.id)}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none font-bold ${
              group.recipientType === 'colaborador'
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}
          >
            {group.recipientType === 'colaborador' ? (
              <FiUser className="text-base" />
            ) : (
              <FiTruck className="text-base" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-xs md:text-sm text-slate-900 leading-tight">
              {group.recipientName}
            </h4>
            {group.recipientDetail && (
              <span className="text-[11px] text-slate-500 font-medium block">
                {group.recipientDetail}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'recipientType',
      header: 'Tipo',
      width: '180px',
      render: (group) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            group.recipientType === 'colaborador'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {group.recipientType === 'colaborador' ? 'COLABORADOR' : 'UNIDAD VEHICULAR'}
        </span>
      )
    },
    {
      key: 'count',
      header: 'Asignaciones',
      align: 'center',
      width: '140px',
      render: (group) => (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-200">
          {group.count} {group.count === 1 ? 'asignación' : 'asignaciones'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      width: '100px',
      render: (group) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton
            icon={<FiChevronRight className="text-lg text-slate-600" />}
            variant="ghost"
            title="Ver asignaciones del destinatario"
            onClick={() => setSelectedRecipientGroupId(group.id)}
          />
        </div>
      )
    }
  ];

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage
        title="Control de Asignaciones"
        subtitle="Control de entrega, recepción y trazabilidad de herramientas y equipos asignados a colaboradores y unidades vehiculares."
        rightContent={
          <ActionButton
            label="Nueva Asignación"
            onClick={() => setShowNewModal(true)}
            variant="primary"
          />
        }
      >
      {/* KPI STAT CARDS (Opción 2: Alineadas a Destinatarios y Asignaciones) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
        {/* 1. Destinatarios Activos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiUser />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight">
              Destinatarios Activos
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900 mt-0.5 leading-none">
              {stats.activeDestinatariosCount}
            </h4>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">
              {stats.activeColaboradoresCount} colab. • {stats.activeUnidadesCount} vehíc.
            </span>
          </div>
        </div>

        {/* 2. Asignaciones en Custodia (Coincide con la suma de asignaciones en la tabla) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiBox />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight">
              Asignaciones en Custodia
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900 mt-0.5 leading-none">
              {stats.totalActiveAssignmentsCount}
              <span className="text-xs font-bold text-slate-400 ml-1">asig.</span>
            </h4>
            <span className="text-[10px] font-bold text-blue-600 block mt-1">
              En poder de destinatarios
            </span>
          </div>
        </div>

        {/* 3. Artículos / Ítems Totales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiTruck />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight">
              Artículos / Ítems Totales
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900 mt-0.5 leading-none">
              {stats.totalItemsQuantity}
              <span className="text-xs font-bold text-slate-400 ml-1">unid.</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">
              Suma de unidades físicas
            </span>
          </div>
        </div>

        {/* 4. Pendientes Retorno */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg flex-none font-bold">
            <FiClock />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight">
              Pendientes Retorno
            </p>
            <h4 className="text-lg md:text-xl font-black text-slate-900 mt-0.5 leading-none">
              {stats.pendingReturnAssignmentsCount}
              <span className="text-xs font-bold text-slate-400 ml-1">asig.</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">
              Por ser reintegradas
            </span>
          </div>
        </div>

        {/* 5. Con Incidencias */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 col-span-2 sm:col-span-1 hover:border-slate-300 transition-colors">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-none font-bold ${
              stats.incidentCount > 0
                ? 'bg-rose-50 text-rose-600 animate-pulse'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            <FiAlertTriangle />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight">
              Con Incidencias
            </p>
            <h4
              className={`text-lg md:text-xl font-black mt-0.5 leading-none ${
                stats.incidentCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {stats.incidentCount}
              <span className="text-xs font-bold text-slate-400 ml-1">reg.</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">
              {stats.incidentCount > 0 ? 'Requiere atención' : 'Sin alertas activas'}
            </span>
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
      {groupedRecipients.length === 0 && !isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-3">
            <FiBox />
          </div>
          <h4 className="text-base font-bold text-slate-800 mb-1">
            No se encontraron destinatarios con asignaciones
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
          data={groupedRecipients}
          columns={groupColumns}
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
        onSubmitBatch={addAssignmentBatch}
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
        allAssignments={enrichedAssignments}
        onSelectAssignment={(a) => setSelectedAssignment(a)}
        onOpenReturn={handleOpenReturn}
        onOpenIncident={handleOpenIncident}
      />

      {activeGroup && (
        <RecipientDetailModal
          show={!!activeGroup}
          onClose={() => setSelectedRecipientGroupId(null)}
          recipientName={activeGroup.recipientName}
          recipientType={activeGroup.recipientType}
          recipientDetail={activeGroup.recipientDetail}
          assignments={recipientAllAssignments}
          currentUser={currentUser}
          onOpenIndividualDetail={handleOpenDetail}
          onOpenReturn={handleOpenReturn}
          onOpenIncident={handleOpenIncident}
          onDeleteAssignment={handleDelete}
        />
      )}
    </ModulePage>
    </div>
  );
};
