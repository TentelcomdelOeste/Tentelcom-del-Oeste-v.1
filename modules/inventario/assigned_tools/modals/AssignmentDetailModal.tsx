import React from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiBox,
  FiUser,
  FiTruck,
  FiCalendar,
  FiTag,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiFileText,
  FiCornerDownLeft
} from 'react-icons/fi';
import { ToolAssignment } from '@/types/toolAssignment.types';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { ActionButton, IconButton, StatusBadge } from '@/design-system';

interface AssignmentDetailModalProps {
  show: boolean;
  onClose: () => void;
  assignment: ToolAssignment | null;
  onOpenReturn?: (assignment: ToolAssignment) => void;
  onOpenIncident?: (assignment: ToolAssignment) => void;
}

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  show,
  onClose,
  assignment,
  onOpenReturn,
  onOpenIncident
}) => {
  useLockBodyScroll(show);

  if (!show || !assignment) return null;

  const isReturned = assignment.status === 'Devuelto';
  const hasIncident =
    assignment.status === 'Con incidencia' ||
    (assignment.incidentReport && assignment.incidentReport.status === 'Abierta');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 md:p-6 bg-slate-900 text-white flex justify-between items-center flex-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-blue-300">
              <FiBox className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-black uppercase tracking-tight">
                  Detalle de Asignación
                </h3>
                <span className="font-mono text-xs bg-white/10 text-white px-2 py-0.5 rounded">
                  {assignment.itemCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Trazabilidad integral y registro de custodia
              </p>
            </div>
          </div>
          <IconButton
            variant="ghost"
            icon={<FiX className="text-lg text-white/80 hover:text-white" />}
            onClick={onClose}
            className="hover:bg-white/10"
          />
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {/* Header Card con Estado y Datos Clave */}
          <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Artículo / Herramienta
              </span>
              <StatusBadge
                status={assignment.status}
                variant={getStatusVariant(assignment.status)}
                size="sm"
              />
            </div>
            <h4 className="text-base font-bold text-slate-900 leading-snug">
              {assignment.itemDescription}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Cantidad</span>
                <span className="font-black text-slate-900">
                  {assignment.quantity} {assignment.itemUnit || 'unid'}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Categoría</span>
                <span className="font-bold text-slate-700">
                  {assignment.itemCategory || 'Herramientas'}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Cond. Inicial</span>
                <span className="font-bold text-slate-700">{assignment.initialCondition}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Fecha Entrega</span>
                <span className="font-bold text-slate-700">{assignment.assignedDate}</span>
              </div>
            </div>
          </div>

          {/* Destinatario y Custodia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-2">
              <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                {assignment.recipientType === 'colaborador' ? (
                  <FiUser className="text-blue-600" />
                ) : (
                  <FiTruck className="text-blue-600" />
                )}
                Destinatario / Asignado A
              </span>
              <p className="text-sm font-black text-blue-950">{assignment.recipientName}</p>
              <p className="text-[11px] text-blue-700 font-medium">
                {assignment.recipientType === 'colaborador' ? 'Colaborador de la empresa' : 'Unidad Vehicular'}
                {assignment.recipientDetail ? ` • ${assignment.recipientDetail}` : ''}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FiInfo className="text-slate-600" /> Autorización y Proyecto
              </span>
              <p className="text-xs text-slate-800">
                <strong className="text-slate-500">Entregado por:</strong> {assignment.assignedBy}
              </p>
              {assignment.projectName ? (
                <p className="text-xs text-slate-800">
                  <strong className="text-slate-500">Proyecto:</strong> {assignment.projectNumber ? `[${assignment.projectNumber}] ` : ''}{assignment.projectName}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">Sin proyecto específico asignado</p>
              )}
            </div>
          </div>

          {/* Observaciones generales si existen */}
          {assignment.observations && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                Observaciones Generales
              </span>
              <p className="text-slate-700 font-medium">{assignment.observations}</p>
            </div>
          )}

          {/* Sección de Devolución si ya se devolvió */}
          {isReturned && (
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
              <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <FiCheckCircle className="text-emerald-600" /> Datos de Devolución
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[9px] font-bold text-emerald-700/80 uppercase block">Fecha Devolución</span>
                  <span className="font-bold text-emerald-950">{assignment.returnDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-emerald-700/80 uppercase block">Condición Recibida</span>
                  <span className="font-bold text-emerald-950">{assignment.returnCondition || 'Bueno'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-emerald-700/80 uppercase block">Recibido Por</span>
                  <span className="font-bold text-emerald-950">{assignment.returnHandledBy || 'Bodega'}</span>
                </div>
              </div>
              {assignment.returnObservations && (
                <p className="text-xs text-emerald-900 pt-1 border-t border-emerald-200/60 font-medium">
                  <strong>Notas de retorno:</strong> {assignment.returnObservations}
                </p>
              )}
            </div>
          )}

          {/* Sección de Incidencia si existe */}
          {assignment.incidentReport && (
            <div
              className={`p-4 rounded-2xl border space-y-2 ${
                assignment.incidentReport.status === 'Abierta'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    assignment.incidentReport.status === 'Abierta'
                      ? 'text-rose-900'
                      : 'text-amber-900'
                  }`}
                >
                  <FiAlertTriangle /> Incidencia ({assignment.incidentReport.status})
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    assignment.incidentReport.severity === 'Alta'
                      ? 'bg-rose-200 text-rose-900'
                      : assignment.incidentReport.severity === 'Media'
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  Severidad: {assignment.incidentReport.severity}
                </span>
              </div>
              <p className="text-xs text-slate-800 font-medium">{assignment.incidentReport.description}</p>
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
                <span>Reportado por: {assignment.incidentReport.reportedBy}</span>
                <span>Fecha: {assignment.incidentReport.date}</span>
              </div>
              {assignment.incidentReport.resolutionNotes && (
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100 text-xs">
                  <span className="text-[9px] font-black text-amber-900 uppercase block mb-0.5">
                    Resolución:
                  </span>
                  <p className="text-slate-800">{assignment.incidentReport.resolutionNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* LÍNEA DE TIEMPO / TRAZABILIDAD */}
          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <FiClock className="text-blue-600" /> Historial de Trazabilidad
            </span>

            {(!assignment.history || assignment.history.length === 0) ? (
              <p className="text-xs text-slate-400 italic">No hay registros adicionales en el historial.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {assignment.history.map((h, index) => {
                  let badgeColor = 'bg-blue-600 text-white';
                  if (h.action === 'Devolución') badgeColor = 'bg-emerald-600 text-white';
                  if (h.action === 'Incidencia') badgeColor = 'bg-rose-600 text-white';
                  if (h.action === 'Resolución') badgeColor = 'bg-amber-600 text-white';

                  const dateFormatted = new Date(h.date).toLocaleString('es-CR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={h.id || index} className="relative group">
                      <div
                        className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-xs ${badgeColor}`}
                      />
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-900">{h.action}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{dateFormatted}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{h.details}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Por: <span className="text-slate-600 font-bold">{h.performedBy}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2.5 justify-between items-center flex-none">
          <div className="flex gap-2">
            {!isReturned && onOpenReturn && (
              <ActionButton
                type="button"
                variant="primary"
                label="Registrar Devolución"
                icon={<FiCornerDownLeft />}
                onClick={() => {
                  onClose();
                  onOpenReturn(assignment);
                }}
                className="!py-2.5 !text-xs !font-bold !bg-emerald-600 hover:!bg-emerald-700 !rounded-xl"
              />
            )}
            {!isReturned && onOpenIncident && (
              <ActionButton
                type="button"
                variant="secondary"
                label={hasIncident ? 'Resolver Incidencia' : 'Reportar Incidencia'}
                icon={<FiAlertTriangle />}
                onClick={() => {
                  onClose();
                  onOpenIncident(assignment);
                }}
                className="!py-2.5 !text-xs !font-bold !rounded-xl"
              />
            )}
          </div>

          <ActionButton
            type="button"
            variant="neutral"
            label="Cerrar"
            onClick={onClose}
            className="!py-2.5 !text-xs !font-bold !rounded-xl min-w-[100px]"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
