import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuotes } from '../../hooks/useQuotes';
import { useInvoices } from '../finance/invoices/useInvoices';
import { useCashflow } from '../../hooks/useCashflow';
import { useMaterialReports } from '../../hooks/useMaterialReports';
import { getTrabajos } from '../job_scheduling/jobService';
import { Trabajo } from '../job_scheduling/types';
import { QuoteModal } from '../../modules/QuoteModal';
import { QuoteStatusModal } from './QuoteStatusModal';
import { AttachmentUploader } from '../attachments/AttachmentUploader'; // Restaurado
import { QuoteOcPopover } from './QuoteOcPopover'; // Componente Actualizado
import { User, Quote } from '../../utils/types';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { ActionButtons } from '../../components/ui/ActionButtons';
import { 
  useConfirm, 
  DataTable, 
  TableColumn, 
  SearchInput, 
  ActionButton, 
  StatusBadge,
} from '../../design-system';
import { generateQuotePDF } from '../../utils/pdfGenerator';
import { triggerFileDownload } from '../../utils/fileUtils';
import { formatCurrency } from '../../utils/formatCurrency';
import { hasPermission } from '../../utils/permissions';
import { FiAlertTriangle, FiLink } from 'react-icons/fi';

interface QuotesModuleProps {
  currentUser: User;
  selectedId?: string;
  selectedKey?: string;
  onClearSelectedId?: () => void;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const QuotesModule: React.FC<QuotesModuleProps> = ({ currentUser, selectedId, selectedKey, onClearSelectedId }) => {
  const now = new Date();
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState<string>((now.getMonth() + 1).toString());

  const { quotes, deleteQuote, approveQuote, setQuotePending, loading, error, loadMore, hasMore } = useQuotes(currentUser, filterYear, filterMonth);
  
  // Hooks para Validación de Integridad
  const { invoices } = useInvoices(currentUser);
  const { entries } = useCashflow(currentUser);
  const { reports } = useMaterialReports(currentUser);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);

  useEffect(() => {
    const unsubscribe = getTrabajos(setTrabajos);
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);
  
  const confirm = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredQuotes = useMemo(() => {
    const safeQuotes = Array.isArray(quotes) ? quotes : [];
    if (safeQuotes.length === 0) return [];
    
    // Si hay un ID seleccionado de la búsqueda y tenemos datos
    if (selectedId && selectedKey) {
      // Dynamic lookup using the selectedKey
      const target = safeQuotes.find(q => (q as any)[selectedKey] === selectedId);
      if (target) return [target];
      // Si no se encuentra, mostramos la lista completa (fallback)
    }

    if (!searchTerm) return safeQuotes;
    const lower = searchTerm.toLowerCase();
    return safeQuotes.filter(q => {
        if (!q) return false;
        const empresa = (q.empresa || '').toLowerCase();
        const contacto = (q.contacto || '').toLowerCase();
        const id = (q.id || '').toString();
        const correo = (q.correo || '').toLowerCase();
        
        return empresa.includes(lower) ||
               contacto.includes(lower) ||
               id.includes(lower) ||
               correo.includes(lower);
    });
  }, [quotes, searchTerm, selectedId, selectedKey]);

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  
  // Estado para gestión de archivos (Restaurado)
  const [attachmentQuote, setAttachmentQuote] = useState<Quote | null>(null);

  // Estado para el Modal de Status y Eliminación Bloqueada
  const [statusModal, setStatusModal] = useState<{
      show: boolean;
      type: 'approve' | 'revert' | 'delete' | 'add_oc' | 'manage'; // Agregado manage
      quote: Quote | null;
      risks: { type: 'invoice' | 'movement' | 'oc'; count: number; label: string }[];
  }>({ show: false, type: 'approve', quote: null, risks: [] });

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear]);
    
    // Añadir años pasados por defecto para navegación
    for (let i = 1; i <= 3; i++) {
        years.add(currentYear - i);
    }

    // Si hay cotizaciones cargadas, añadir sus años también
    if (quotes && Array.isArray(quotes)) {
        quotes.forEach(q => {
            if (!q) return;
            const y = q.year || (q.fecha && typeof q.fecha === 'string' ? (q.fecha.includes('/') ? parseInt(q.fecha.split('/')[2]) : new Date(q.fecha).getFullYear()) : null);
            if (y && !isNaN(y)) years.add(y);
        });
    }
    
    return Array.from(years).sort((a, b) => b - a);
  }, [quotes]);

  const handleEdit = useCallback((quote: Quote) => {
    setEditingQuote(quote);
    setShowModal(true);
  }, []);

  // --- AUTO-OPEN AND HIGHLIGHT FROM SEARCH ---
  const autoOpenedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const safeQuotes = Array.isArray(quotes) ? quotes : [];
    if (selectedId && safeQuotes.length > 0) {
      if (autoOpenedIdRef.current !== selectedId) {
        const target = safeQuotes.find(q => q.docId === selectedId || q.id?.toString() === selectedId);
        if (target) {
          autoOpenedIdRef.current = selectedId;
          handleEdit(target);
        }
      }
    }
  }, [selectedId, quotes, handleEdit]);

  // --- LÓGICA DE ELIMINACIÓN SEGURA ---
  const handleDelete = useCallback(async (quote: Quote) => {
    // 1. Verificar Dependencias (Validación Inteligente)
    const risks: { type: 'invoice' | 'movement' | 'oc' | 'job' | 'report'; count: number; label: string }[] = [];

    const safeInvoices = Array.isArray(invoices) ? invoices : [];
    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeTrabajos = Array.isArray(trabajos) ? trabajos : [];
    const safeReports = Array.isArray(reports) ? reports : [];

    // Check Facturas
    const qIdStr = quote.id !== undefined && quote.id !== null ? quote.id.toString() : '';
    const linkedInvoices = safeInvoices.filter(inv => inv && inv.projectId === qIdStr && inv.status !== 'Anulada');
    if (linkedInvoices.length > 0) {
        risks.push({ type: 'invoice', count: linkedInvoices.length, label: 'Facturas Activas vinculadas' });
    }

    // Check Movimientos
    const linkedMovements = safeEntries.filter(ent => ent && ent.projectId === qIdStr);
    if (linkedMovements.length > 0) {
        risks.push({ type: 'movement', count: linkedMovements.length, label: 'Movimientos Financieros registrados' });
    }

    // Check Trabajos (Jobs)
    const linkedJobs = safeTrabajos.filter(job => (job as any).projectId === qIdStr || (job as any).quoteId === qIdStr);
    if (linkedJobs.length > 0) {
        risks.push({ type: 'job', count: linkedJobs.length, label: 'Trabajos programados asociados' });
    }

    // Check Reportes de Materiales
    const linkedReports = safeReports.filter(rep => rep && rep.project && rep.project.id === qIdStr);
    if (linkedReports.length > 0) {
        risks.push({ type: 'report', count: linkedReports.length, label: 'Reportes de materiales generados' });
    }

    // Check OCs internas (si aplica)
    if (quote.ocNumbers && quote.ocNumbers.length > 0) {
        risks.push({ type: 'oc', count: quote.ocNumbers.length, label: 'Órdenes de Compra asociadas' });
    }

    // 2. Proceder con Confirmación Estándar (Incluyendo advertencias si hay riesgos)
    const risksContent = risks.length > 0 ? (
        <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100 text-left">
            <p className="text-[10px] font-black text-red-800 uppercase mb-2 flex items-center gap-1">
                <FiAlertTriangle className="text-red-500" /> Advertencia de Integrity:
            </p>
            <ul className="space-y-1">
                {risks.map((r, i) => (
                    <li key={i} className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                        <FiLink className="opacity-50" /> {r.label}
                    </li>
                ))}
            </ul>
            <p className="text-[9px] text-red-400 font-medium mt-2 leading-tight">
                La cotización se ocultará pero los registros vinculados permanecerán en el sistema.
            </p>
        </div>
    ) : null;

    const shouldDelete = await confirm({
        title: "¿Eliminar Cotización?",
        description: (
            <div className="space-y-2">
                <p>¿Está seguro de eliminar la cotización <strong>#{quote.id}</strong>? Esta acción no se puede deshacer.</p>
                {risksContent}
            </div>
        ),
        confirmLabel: "Eliminar",
        variant: "danger"
    });

    if (shouldDelete && quote.docId) {
        await deleteQuote(quote.docId);
    }
  }, [invoices, entries, reports, trabajos, confirm, deleteQuote]);

  const handleStatusClick = useCallback((e: React.MouseEvent | React.KeyboardEvent, quote: Quote) => {
      e.stopPropagation();

      if (quote.estado === 'Pendiente') {
          setStatusModal({
              show: true,
              type: 'approve',
              quote: quote,
              risks: []
          });
      } else {
          // Lógica de Gestión/Reversión
          // Calculamos riesgos preventivamente para tenerlos listos en caso de que se solicite reversión
          const risks: { type: 'invoice' | 'movement' | 'oc' | 'job' | 'report'; count: number; label: string }[] = [];

          const safeInvoices = Array.isArray(invoices) ? invoices : [];
          const safeEntries = Array.isArray(entries) ? entries : [];
          const safeTrabajos = Array.isArray(trabajos) ? trabajos : [];
          const safeReports = Array.isArray(reports) ? reports : [];

          const qIdStr = quote.id !== undefined && quote.id !== null ? quote.id.toString() : '';
          const linkedInvoices = safeInvoices.filter(inv => inv && inv.projectId === qIdStr && inv.status !== 'Anulada');
          if (linkedInvoices.length > 0) risks.push({ type: 'invoice', count: linkedInvoices.length, label: 'Facturas Activas' });

          const linkedMovements = safeEntries.filter(ent => ent && ent.projectId === qIdStr);
          if (linkedMovements.length > 0) risks.push({ type: 'movement', count: linkedMovements.length, label: 'Movimientos Financieros' });

          const linkedJobs = safeTrabajos.filter(job => (job as any).projectId === qIdStr || (job as any).quoteId === qIdStr);
          if (linkedJobs.length > 0) risks.push({ type: 'job', count: linkedJobs.length, label: 'Trabajos Programados' });

          const linkedReports = safeReports.filter(rep => rep && rep.project && rep.project.id === qIdStr);
          if (linkedReports.length > 0) risks.push({ type: 'report', count: linkedReports.length, label: 'Reportes de Materiales' });

          // Abrir en modo 'manage' (Gestión) por defecto
          // El usuario podrá ver OCs, agregarlas, o hacer click en "Revertir" dentro del modal
          setStatusModal({
              show: true,
              type: 'manage',
              quote: quote,
              risks: risks
          });
      }
  }, [invoices, entries, reports, trabajos]);

  const handleStatusConfirm = useCallback(async (ocs?: string[]) => {
      const { quote, type } = statusModal;
      if (!quote) return;

      if (type === 'approve' || type === 'manage' || type === 'add_oc') {
          // Guardar OCs y confirmar Aprobación (o mantenerla)
          await approveQuote(quote.docId || '', ocs);
      } 
      // El caso 'revert' se maneja por handleRevertConfirm
      setStatusModal(prev => ({ ...prev, show: false }));
  }, [statusModal, approveQuote]);

  const handleRevertConfirm = useCallback(async () => {
      const { quote } = statusModal;
      if (!quote) {
          return;
      }
      try {
          await setQuotePending(quote.docId || '');
          setStatusModal(prev => ({ ...prev, show: false }));
      } catch (e) {
          console.error("❌ Error en handleRevertConfirm:", e);
      }
  }, [statusModal, setQuotePending]);

  const handleSave = useCallback(async (_quoteData: Quote) => {
      setEditingQuote(null);
      setShowModal(false);
  }, []);

  const columns = useMemo<TableColumn<Quote>[]>(() => [
    { 
        header: "N°", 
        accessorKey: "id", 
        width: "110px",
        align: "center",
        className: "font-black text-slate-700",
        mobileGrid: "left",
        mobileOrder: 1,
        render: (q) => {
            const year = q.fecha 
                ? (q.fecha.includes('/') ? q.fecha.split('/')[2] : new Date(q.fecha).getFullYear()) 
                : new Date().getFullYear();
            return (
                <span 
                    className="font-black text-blue-950 text-[11px] whitespace-nowrap"
                >
                    #{String(q.id).padStart(3, '0')}-{year}
                </span>
            );
        }
    },
    { 
        header: "Cliente / Contacto", 
        width: "250px",
        mobileGrid: "full",
        mobileOrder: 3,
        render: (q) => (
          <div className="flex flex-col truncate">
            <span 
                className="font-black text-blue-900 text-xs truncate"
                title={q.empresa}
            >
                {q.empresa}
            </span>
            <span className="text-[10px] text-slate-500 font-bold truncate opacity-70" title={q.contacto}>{q.contacto}</span>
          </div>
        ) 
    },
    { 
        header: "Fecha", 
        accessorKey: "fecha", 
        align: "center", 
        width: "110px",
        className: "font-mono font-bold text-slate-500 text-[11px]",
        mobileGrid: "left",
        mobileOrder: 4
    },
    { 
        header: "Monto Total", 
        align: "right",
        width: "140px",
        mobileGrid: "right",
        mobileOrder: 2,
        render: (q) => <span className="font-black text-slate-700 text-xs">{formatCurrency(q.monto, q.moneda)}</span>
    },
    { 
        header: "Estado", 
        align: "center",
        mobileGrid: "right",
        mobileOrder: 5,
        render: (q) => (
            <div className="flex items-center justify-center md:justify-center lg:justify-center gap-1 group relative">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleStatusClick(e, q)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatusClick(e, q); }}
                    className="hover:scale-105 active:scale-95 transition-transform cursor-pointer focus:outline-none inline-block"
                    title={q.estado === 'Pendiente' ? "Clic para Aprobar" : "Gestionar OCs / Revertir"}
                >
                    <StatusBadge 
                        label={q.estado} 
                        variant={q.estado === 'Aprobada' ? 'success' : 'warning'} 
                    />
                </div>
                
                {/* Popover Interactivo para OCs (Renderiza solo si hay OCs) */}
                {q.estado === 'Aprobada' && q.ocNumbers && q.ocNumbers.length > 0 && (
                    <QuoteOcPopover ocs={q.ocNumbers} />
                )}
            </div>
        )
    },
    {
        header: "Acciones",
        align: "center",
        mobileGrid: "full",
        mobileOrder: 6,
        render: (q) => (
            <div className="flex justify-center md:justify-center items-center gap-2">
                <ActionButtons 
                    onEdit={() => handleEdit(q)}
                    onDelete={hasPermission(currentUser, 'cotizaciones') ? () => handleDelete(q) : undefined}
                    onPdf={async () => {
                        const { fileBlob, fileName } = await generateQuotePDF(q);
                        triggerFileDownload(fileBlob, fileName);
                    }}
                    // Restauración de botón de archivos
                    onAttachments={() => setAttachmentQuote(q)}
                    attachmentsTitle="Adjuntar OCs / Facturas"
                />
            </div>
        )
    }
  ], [currentUser, handleDelete, handleStatusClick, handleEdit]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
    <ModulePage title="Cotizaciones" subtitle="Administración de cotizaciones comerciales.">
      
      <ModuleToolbar>
            <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
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
                    <div className="flex gap-2 w-full md:w-auto">
                        <select 
                            value={filterYear} 
                            onChange={(e) => setFilterYear(Number(e.target.value))} 
                            className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none w-full md:w-auto cursor-pointer"
                        >
                            <option value={0}>Todos los años</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select 
                            value={filterMonth} 
                            onChange={(e) => setFilterMonth(e.target.value)} 
                            className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none w-full md:w-auto cursor-pointer"
                        >
                            <option value="all">Todo el Año</option>
                            {MONTH_NAMES.map((m, i) => <option key={m} value={(i + 1).toString()}>{m}</option>)}
                        </select>
                    </div>
                )}
                <SearchInput 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    placeholder="Buscar por cliente, contacto o ID..." 
                    className="w-full md:w-72" 
                />
            </div>
            <ActionButton onClick={() => { setEditingQuote(null); setShowModal(true); }} label="Nueva Cotización" />
        </ModuleToolbar>

        {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <FiAlertTriangle className="text-red-500 text-lg flex-none" />
                <div className="flex-1">
                    <p className="text-xs font-black text-red-800 uppercase tracking-tighter">Error de Sincronización Remota</p>
                    <p className="text-[10px] text-red-600 font-bold opacity-80">{error}</p>
                </div>
            </div>
        )}

        <DataTable<Quote> 
            data={filteredQuotes} 
            columns={columns} 
            keyExtractor={(q) => q.docId || q.id.toString()} 
            emptyMessage={searchTerm ? "No se encontraron cotizaciones con ese criterio." : "No hay cotizaciones en el periodo seleccionado."}
            hasMore={hasMore}
            onLoadMore={loadMore}
            isLoadingMore={loading}
            enableVirtualization={true}
            virtualHeight={600}
            highlightedId={selectedId}
        />

        {/* --- MODALES --- */}
        
        <QuoteModal 
            show={showModal} 
            onClose={() => { setShowModal(false); setEditingQuote(null); onClearSelectedId?.(); }} 
            onSave={handleSave} 
            quote={editingQuote} 
            currentUser={currentUser} 
        />

        <QuoteStatusModal 
            show={statusModal.show}
            onClose={() => setStatusModal(prev => ({ ...prev, show: false }))}
            onConfirm={handleStatusConfirm}
            onRevert={handleRevertConfirm}
            quote={statusModal.quote}
            type={statusModal.type}
            risks={statusModal.risks}
        />

        {/* Modal de Archivos Restaurado */}
        {attachmentQuote && createPortal(
            <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[700] p-4 animate-in fade-in duration-300">
                <AttachmentUploader 
                    entityType="invoices"
                    entityId={attachmentQuote.docId || attachmentQuote.id}
                    title="Expediente de Cotización"
                    subtitle={`Archivos para #${attachmentQuote.id} - ${attachmentQuote.empresa}`}
                    onClose={() => setAttachmentQuote(null)}
                />
            </div>,
            document.body
        )}

      </ModulePage>
    </div>
  );
};