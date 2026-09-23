import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiUser,
  FiTruck,
  FiBox,
  FiEye,
  FiCornerDownLeft,
  FiAlertTriangle,
  FiTrash2,
  FiCheckCircle,
  FiClock,
  FiSearch,
  FiLayers,
  FiArchive,
  FiRepeat,
  FiFileText
} from 'react-icons/fi';
import { ToolAssignment, RecipientType } from '@/types/toolAssignment.types';
import { User } from '@/utils/types';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { IconButton, StatusBadge, ACTION_ICONS } from '@/design-system';
import { isAdmin } from '@/utils/permissions';
import {
  exportRecipientAssignmentsPDF,
  exportSingleAssignmentPDF
} from '@/utils/export/recipientAssignmentsExport';

interface RecipientDetailModalProps {
  show: boolean;
  onClose: () => void;
  recipientName: string;
  recipientType: RecipientType;
  recipientDetail?: string;
  assignments: ToolAssignment[];
  currentUser: User | null;
  onOpenIndividualDetail: (assignment: ToolAssignment) => void;
  onOpenReturn: (assignment: ToolAssignment) => void;
  onOpenIncident: (assignment: ToolAssignment) => void;
  onOpenTransfer?: (assignment: ToolAssignment) => void;
  onDeleteAssignment: (assignment: ToolAssignment) => void;
}

export const getAssignmentBatchId = (a: ToolAssignment): string | null => {
  if (a.movementId) return a.movementId;
  if (a.requestNumber) return a.requestNumber;
  if (a.history && a.history.length > 0) {
    for (const h of a.history) {
      if (!h.details) continue;
      const matchMov = h.details.match(/MOV-\d+/i);
      if (matchMov) return matchMov[0].toUpperCase();
      const matchBatch = h.details.match(/batch_\d+/i);
      if (matchBatch) return matchBatch[0];
    }
  }
  return null;
};

export const RecipientDetailModal: React.FC<RecipientDetailModalProps> = ({
  show,
  onClose,
  recipientName,
  recipientType,
  recipientDetail,
  assignments,
  currentUser,
  onOpenIndividualDetail,
  onOpenReturn,
  onOpenIncident,
  onOpenTransfer,
  onDeleteAssignment
}) => {
  useLockBodyScroll(show);

  const [statusTab, setStatusTab] = useState<'active' | 'returned' | 'incident' | 'all'>('active');
  const [modalSearch, setModalSearch] = useState<string>('');

  const isUserAdmin = currentUser ? isAdmin(currentUser.role) : false;
  const isColaborador = recipientType === 'colaborador';

  const handleExportPDF = async () => {
    const delivererName =
      assignments.find((a) => a.assignedBy && a.assignedBy.trim() !== '')?.assignedBy ||
      currentUser?.name ||
      'Responsable de Entrega';
    await exportRecipientAssignmentsPDF(
      recipientName,
      recipientType,
      recipientDetail,
      assignments,
      delivererName
    );
  };

  const handleExportSinglePDF = async (assignment: ToolAssignment) => {
    const delivererName =
      assignment.assignedBy ||
      currentUser?.name ||
      'Responsable de Entrega';
    await exportSingleAssignmentPDF(
      recipientName,
      recipientType,
      recipientDetail,
      assignment,
      delivererName
    );
  };

  // Métricas del destinatario
  const metrics = useMemo(() => {
    let active = 0;
    let returned = 0;
    let incidents = 0;

    assignments.forEach((a) => {
      if (a.status === 'Devuelto') {
        returned += 1;
      } else {
        active += 1;
      }
      if (
        a.status === 'Con incidencia' ||
        (a.incidentReport && a.incidentReport.status === 'Abierta')
      ) {
        incidents += 1;
      }
    });

    return {
      active,
      returned,
      incidents,
      total: assignments.length
    };
  }, [assignments]);

  // Filtrado de asignaciones según pestaña y búsqueda
  const filteredModalAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Filtro por pestaña de estado
      if (statusTab === 'active' && a.status === 'Devuelto') return false;
      if (statusTab === 'returned' && a.status !== 'Devuelto') return false;
      if (statusTab === 'incident') {
        const hasOpenInc =
          a.status === 'Con incidencia' ||
          (a.incidentReport && a.incidentReport.status === 'Abierta');
        if (!hasOpenInc) return false;
      }

      // Búsqueda por código, descripción, categoría o movimiento
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim();
        const batchId = getAssignmentBatchId(a) || '';
        const matchCode = a.itemCode.toLowerCase().includes(q);
        const matchDesc = a.itemDescription.toLowerCase().includes(q);
        const matchCat = (a.itemCategory || '').toLowerCase().includes(q);
        const matchBatch = batchId.toLowerCase().includes(q);
        const matchProject = (a.projectName || '').toLowerCase().includes(q);
        return matchCode || matchDesc || matchCat || matchBatch || matchProject;
      }

      return true;
    });
  }, [assignments, statusTab, modalSearch]);

  if (!show) return null;

  const getStatusVariant = (status: string) => {
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

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-2 md:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl md:rounded-[28px] shadow-2xl w-full max-w-[96vw] xl:max-w-[1400px] overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header Principal */}
        <div className="p-4 md:p-5 bg-slate-900 text-white flex justify-between items-center flex-none">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl font-bold ${
                isColaborador ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isColaborador ? <FiUser /> : <FiTruck />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base md:text-lg font-black uppercase tracking-tight">
                  ASIGNACIONES — {recipientName}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-full">
                  {isColaborador ? (recipientDetail?.toLowerCase().includes('externo') ? 'Destinatario Externo' : 'Colaborador') : 'Unidad Vehicular'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Custodia integral de herramientas y equipos {recipientDetail ? `• ${recipientDetail}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              variant="danger"
              icon={<ACTION_ICONS.pdf />}
              onClick={handleExportPDF}
              title="Generar PDF de Asignaciones"
            />
            <IconButton
              variant="ghost"
              icon={<FiX className="text-xl text-white/80 hover:text-white" />}
              onClick={onClose}
              className="hover:bg-white/10"
            />
          </div>
        </div>

        {/* Tarjetas de Métricas KPI y Pestañas */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 flex-none">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div
              onClick={() => setStatusTab('active')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                statusTab === 'active'
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-900 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>En Custodia</span>
                <FiBox className="text-blue-600" />
              </div>
              <p className="text-lg md:text-xl font-black mt-1 text-slate-900">{metrics.active}</p>
            </div>

            <div
              onClick={() => setStatusTab('returned')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                statusTab === 'returned'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>Devueltas</span>
                <FiCheckCircle className="text-emerald-600" />
              </div>
              <p className="text-lg md:text-xl font-black mt-1 text-slate-900">{metrics.returned}</p>
            </div>

            <div
              onClick={() => setStatusTab('incident')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                statusTab === 'incident'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 ring-2 ring-rose-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>Incidencias</span>
                <FiAlertTriangle className="text-rose-600" />
              </div>
              <p className="text-lg md:text-xl font-black mt-1 text-slate-900">{metrics.incidents}</p>
            </div>

            <div
              onClick={() => setStatusTab('all')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                statusTab === 'all'
                  ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-slate-900/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider opacity-70">
                <span>Total Histórico</span>
                <FiArchive />
              </div>
              <p className="text-lg md:text-xl font-black mt-1">{metrics.total}</p>
            </div>
          </div>

          {/* Barra de Búsqueda Interna y Pestañas */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-1">
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setStatusTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  statusTab === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                En Custodia Activa ({metrics.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('returned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  statusTab === 'returned'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Devueltas ({metrics.returned})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('incident')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  statusTab === 'incident'
                    ? 'bg-rose-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Incidencias ({metrics.incidents})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  statusTab === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Histórico Completo ({metrics.total})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Buscar código, descripción, lote..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>
              <IconButton
                variant="danger"
                icon={<ACTION_ICONS.pdf />}
                onClick={handleExportPDF}
                title="Generar PDF de Asignaciones"
              />
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {filteredModalAssignments.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200 my-4">
              <FiBox className="text-4xl text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">
                {modalSearch
                  ? 'No se encontraron artículos con la búsqueda especificada'
                  : statusTab === 'active'
                  ? 'El destinatario no posee herramientas/equipos en custodia activa'
                  : statusTab === 'returned'
                  ? 'No hay registros de devoluciones previas para este destinatario'
                  : statusTab === 'incident'
                  ? 'No hay incidencias registradas'
                  : 'No hay asignaciones registradas'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {modalSearch ? 'Intente ajustar los términos de búsqueda' : 'Utilice las pestañas para cambiar la vista de filtro'}
              </p>
            </div>
          ) : (
            <>
              {/* Vista Móvil: Tarjetas optimizadas sin scroll horizontal (md:hidden) */}
              <div className="space-y-3 md:hidden">
                {filteredModalAssignments.map((assignment) => {
                  const isReturned = assignment.status === 'Devuelto';
                  const batchId = getAssignmentBatchId(assignment);
                  const isTransferred = Array.isArray(assignment.history) && assignment.history.some((h) => h.action === 'Transferencia');

                  return (
                    <div
                      key={assignment.id}
                      className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3 transition-shadow hover:shadow-sm"
                    >
                      {/* Cabecera: Código, Categoría y Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                            {assignment.itemCode}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                            {assignment.itemCategory || 'Herramienta'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <StatusBadge
                            status={assignment.status}
                            variant={getStatusVariant(assignment.status)}
                            size="sm"
                          />
                          {isTransferred && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              <FiRepeat className="text-[9px]" /> Traspasado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Descripción */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                          {assignment.itemDescription}
                        </h4>
                        {isTransferred && (
                          <p className="text-[10px] text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                            <FiRepeat className="text-[10px]" /> Recibido por Traspaso de Custodia
                          </p>
                        )}
                      </div>

                      {/* Grid de Datos Clave */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50/80 rounded-lg p-2.5 text-[11px] border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Cantidad</span>
                          <span className="font-black text-slate-800">
                            {assignment.quantity} {assignment.itemUnit || 'unid'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Fecha Entrega</span>
                          <span className="font-medium text-slate-700">
                            {assignment.assignedDate || '—'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Condición</span>
                          <span className="font-bold text-slate-800">
                            {assignment.initialCondition || 'Bueno'}
                          </span>
                          {isReturned && assignment.returnCondition && (
                            <span className="block text-[9.5px] text-emerald-700 font-medium">
                              Ret: {assignment.returnCondition}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">N° Mov. / Lote</span>
                          {batchId ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-blue-700 truncate max-w-full">
                              <FiLayers className="text-[10px] flex-shrink-0" />
                              <span className="truncate">{batchId}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </div>
                      </div>

                      {/* Botones de Acción Táctiles */}
                      <div className="pt-1 flex items-center justify-end gap-1.5 border-t border-slate-100 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          icon={<FiEye />}
                          variant="primary"
                          title="Ver detalle de trazabilidad"
                          onClick={() => onOpenIndividualDetail(assignment)}
                        />
                        <IconButton
                          icon={<FiFileText />}
                          variant="danger"
                          title={isTransferred ? "Descargar comprobante de traspaso PDF" : "Descargar comprobante de asignación PDF"}
                          onClick={() => handleExportSinglePDF(assignment)}
                        />
                        {!isReturned && onOpenTransfer && (
                          <IconButton
                            icon={<FiRepeat />}
                            variant="secondary"
                            title="Transferir / Reasignar a otro custodio"
                            onClick={() => onOpenTransfer(assignment)}
                          />
                        )}
                        {!isReturned && (
                          <IconButton
                            icon={<FiCornerDownLeft />}
                            variant="success"
                            title="Registrar devolución"
                            onClick={() => onOpenReturn(assignment)}
                          />
                        )}
                        {!isReturned && (
                          <IconButton
                            icon={<FiAlertTriangle />}
                            variant={
                              assignment.incidentReport && assignment.incidentReport.status === 'Abierta'
                                ? 'warning'
                                : 'danger'
                            }
                            title={
                              assignment.incidentReport && assignment.incidentReport.status === 'Abierta'
                                ? 'Resolver Incidencia'
                                : 'Reportar Incidencia'
                            }
                            onClick={() => onOpenIncident(assignment)}
                          />
                        )}
                        {isUserAdmin && (
                          <IconButton
                            icon={<FiTrash2 />}
                            variant="danger"
                            title="Eliminar asignación"
                            onClick={() => onDeleteAssignment(assignment)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vista Escritorio: Tabla tradicional (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3 min-w-[90px]">Código</th>
                      <th className="py-3 px-3 min-w-[220px]">Descripción</th>
                      <th className="py-3 px-3 min-w-[130px]">Tipo / Categoría</th>
                      <th className="py-3 px-3 text-center min-w-[120px]">N° Mov. / Lote</th>
                      <th className="py-3 px-3 text-center min-w-[100px]">Cantidad</th>
                      <th className="py-3 px-3 text-center min-w-[110px]">Fecha Entrega</th>
                      <th className="py-3 px-3 min-w-[100px]">Condición</th>
                      <th className="py-3 px-3 text-center min-w-[130px]">Estado / Origen</th>
                      <th className="py-3 px-3 text-center min-w-[190px] bg-slate-100/90">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredModalAssignments.map((assignment) => {
                      const isReturned = assignment.status === 'Devuelto';
                      const batchId = getAssignmentBatchId(assignment);
                      const isTransferred = Array.isArray(assignment.history) && assignment.history.some((h) => h.action === 'Transferencia');

                      return (
                        <tr key={assignment.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-black text-slate-800 whitespace-nowrap">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                              {assignment.itemCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 min-w-[220px]">
                            {assignment.itemDescription}
                            {isTransferred && (
                              <span className="block text-[10px] text-indigo-600 font-semibold mt-0.5">
                                Recibido por Traspaso de Custodia
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                            {assignment.itemCategory || 'Herramienta'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {batchId ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                                <FiLayers className="text-[10px]" />
                                {batchId}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
                              {assignment.quantity} {assignment.itemUnit || 'unid'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-slate-700 whitespace-nowrap">
                            {assignment.assignedDate}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 text-[11px] whitespace-nowrap">
                            <strong>{assignment.initialCondition}</strong>
                            {isReturned && assignment.returnCondition && (
                              <span className="block text-[10px] text-emerald-700 font-medium">
                                Retorno: {assignment.returnCondition}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-0.5">
                              <StatusBadge
                                status={assignment.status}
                                variant={getStatusVariant(assignment.status)}
                                size="sm"
                              />
                              {isTransferred && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                  <FiRepeat className="text-[10px]" /> Traspasado
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200/80 shadow-2xs" onClick={(e) => e.stopPropagation()}>
                              <IconButton
                                icon={<FiEye />}
                                variant="primary"
                                title="Ver detalle de trazabilidad"
                                onClick={() => onOpenIndividualDetail(assignment)}
                              />
                              <IconButton
                                icon={<FiFileText />}
                                variant="danger"
                                title={isTransferred ? "Descargar comprobante de traspaso PDF" : "Descargar comprobante de asignación PDF"}
                                onClick={() => handleExportSinglePDF(assignment)}
                              />
                              {!isReturned && onOpenTransfer && (
                                <IconButton
                                  icon={<FiRepeat />}
                                  variant="secondary"
                                  title="Transferir / Reasignar a otro custodio"
                                  onClick={() => onOpenTransfer(assignment)}
                                />
                              )}
                              {!isReturned && (
                                <IconButton
                                  icon={<FiCornerDownLeft />}
                                  variant="success"
                                  title="Registrar devolución"
                                  onClick={() => onOpenReturn(assignment)}
                                />
                              )}
                              {!isReturned && (
                                <IconButton
                                  icon={<FiAlertTriangle />}
                                  variant={
                                    assignment.incidentReport && assignment.incidentReport.status === 'Abierta'
                                      ? 'warning'
                                      : 'danger'
                                  }
                                  title={
                                    assignment.incidentReport && assignment.incidentReport.status === 'Abierta'
                                      ? 'Resolver Incidencia'
                                      : 'Reportar Incidencia'
                                  }
                                  onClick={() => onOpenIncident(assignment)}
                                />
                              )}
                              {isUserAdmin && (
                                <IconButton
                                  icon={<FiTrash2 />}
                                  variant="danger"
                                  title="Eliminar asignación"
                                  onClick={() => onDeleteAssignment(assignment)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

