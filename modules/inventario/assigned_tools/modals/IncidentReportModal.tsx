import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiAlertTriangle,
  FiAlertCircle,
  FiCheckCircle,
  FiCalendar,
  FiUser
} from 'react-icons/fi';
import { User } from '@/utils/types';
import { ToolAssignment, IncidentReportDTO } from '@/types/toolAssignment.types';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { ActionButton, IconButton, Select } from '@/design-system';

interface IncidentReportModalProps {
  show: boolean;
  onClose: () => void;
  onReportIncident: (dto: IncidentReportDTO) => Promise<any>;
  onResolveIncident: (assignmentId: string, notes: string) => Promise<any>;
  assignment: ToolAssignment | null;
  currentUser: User | null;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  show,
  onClose,
  onReportIncident,
  onResolveIncident,
  assignment,
  currentUser
}) => {
  const hasOpenIncident =
    assignment?.incidentReport && assignment.incidentReport.status === 'Abierta';

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportedBy, setReportedBy] = useState<string>('');
  const [severity, setSeverity] = useState<'Baja' | 'Media' | 'Alta'>('Media');
  const [description, setDescription] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useLockBodyScroll(show);

  useEffect(() => {
    if (show && assignment) {
      setDate(new Date().toISOString().split('T')[0]);
      setReportedBy(currentUser?.name || currentUser?.displayName || currentUser?.email || '');
      setSeverity('Media');
      setDescription('');
      setResolutionNotes('');
      setError(null);
    }
  }, [show, assignment, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;

    try {
      setIsSubmitting(true);
      setError(null);

      if (hasOpenIncident) {
        // Resolver incidencia
        if (!resolutionNotes.trim()) {
          setError('Por favor describe las acciones o notas de resolución.');
          setIsSubmitting(false);
          return;
        }
        await onResolveIncident(assignment.id, resolutionNotes.trim());
      } else {
        // Reportar nueva incidencia
        if (!description.trim()) {
          setError('Por favor describe el motivo o daño del incidente.');
          setIsSubmitting(false);
          return;
        }

        const dto: IncidentReportDTO = {
          assignmentId: assignment.id,
          date,
          reportedBy: reportedBy.trim() || currentUser?.email || 'Sistema',
          description: description.trim(),
          severity
        };
        await onReportIncident(dto);
      }

      onClose();
    } catch (err: any) {
      console.error('[IncidentReportModal] Error:', err);
      setError(err?.message || 'Ocurrió un error al procesar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show || !assignment) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div
          className={`p-5 md:p-6 text-white flex justify-between items-center flex-none ${
            hasOpenIncident ? 'bg-amber-800' : 'bg-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
              <FiAlertTriangle className="text-xl" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight">
                {hasOpenIncident ? 'Resolver Incidencia' : 'Reportar Incidencia / Daño'}
              </h3>
              <p className="text-[11px] text-white/80 font-medium">
                {hasOpenIncident
                  ? 'Cierre y registro de solución de la novedad'
                  : 'Registro de daños, fallas o novedades de la herramienta'}
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 md:p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
            {/* Info del artículo */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md">
                  {assignment.itemCode}
                </span>
                <span className="text-xs text-slate-600 font-bold">
                  {assignment.recipientName}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 leading-snug">
                {assignment.itemDescription}
              </h4>
            </div>

            {hasOpenIncident && assignment.incidentReport ? (
              /* Mostrar detalle de la incidencia abierta y campo para resolver */
              <div className="space-y-3">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-900 uppercase text-[10px] tracking-wider">
                      Incidencia Abierta
                    </span>
                    <span className="font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[10px]">
                      Severidad: {assignment.incidentReport.severity}
                    </span>
                  </div>
                  <p className="text-amber-950 font-medium">{assignment.incidentReport.description}</p>
                  <div className="text-[10px] text-amber-800/80 pt-1 border-t border-amber-200/60 flex justify-between">
                    <span>Reportado por: {assignment.incidentReport.reportedBy}</span>
                    <span>Fecha: {assignment.incidentReport.date}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                    Acciones Tomadas y Notas de Resolución
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Especifique si se reparó, se reemplazó la pieza, se cobró deducible, etc..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all resize-none"
                    required
                  />
                </div>
              </div>
            ) : (
              /* Formulario para registrar nueva incidencia */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-1">
                      <FiCalendar className="text-rose-600" /> Fecha del Incidente
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Nivel de Severidad
                    </label>
                    <Select
                      options={[
                        { label: 'Baja (Desgaste menor / estético)', value: 'Baja' },
                        { label: 'Media (Afecta parcialmente / requiere ajuste)', value: 'Media' },
                        { label: 'Alta (Inoperativo / rotura total / pérdida)', value: 'Alta' }
                      ]}
                      value={severity}
                      onChange={(val) => setSeverity(val as 'Baja' | 'Media' | 'Alta')}
                      isSearchable={false}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-1">
                    <FiUser className="text-rose-600" /> Reportado por
                  </label>
                  <input
                    type="text"
                    value={reportedBy}
                    onChange={(e) => setReportedBy(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                    Descripción Detallada del Incidente
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describa el fallo ocurrido, daño observable o circunstancias del problema..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all resize-none"
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-2xl border border-red-200 flex items-center gap-2.5">
                <FiAlertCircle className="flex-none text-base text-red-600" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 flex gap-3 flex-none">
            <ActionButton
              type="button"
              variant="neutral"
              label="Cancelar"
              onClick={onClose}
              className="flex-1 !py-3 !text-xs !font-bold !uppercase !rounded-xl"
            />
            <ActionButton
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              label={
                hasOpenIncident
                  ? isSubmitting
                    ? 'Guardando...'
                    : 'Resolver Incidencia'
                  : isSubmitting
                  ? 'Registrando...'
                  : 'Registrar Incidencia'
              }
              icon={hasOpenIncident ? <FiCheckCircle /> : <FiAlertTriangle />}
              variant="primary"
              className={`flex-1 !py-3 !text-xs !font-black !uppercase !tracking-normal !rounded-xl ${
                hasOpenIncident
                  ? '!bg-amber-600 hover:!bg-amber-700'
                  : '!bg-rose-600 hover:!bg-rose-700'
              }`}
            />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
