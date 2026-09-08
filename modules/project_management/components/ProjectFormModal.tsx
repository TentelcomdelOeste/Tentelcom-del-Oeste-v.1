import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import { getProjects, getApprovedQuotes, createProjectWithQuoteHandling, updateProjectWithQuoteHandling } from '../services/projectService';
import { Project } from '../types';
import { Client, Quote, User } from '../../../utils/types';
import { useClients } from '../../../hooks/useClients';
import { Modal, ActionButton, IconButton } from '../../../design-system';
import { ClientDirectoryModal } from '../../quotes/ClientDirectoryModal';

interface ProjectFormModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (p: Project, unlinkedProjectId?: string) => void;
  currentUser: User;
  initialData?: Project | null;
}

type ProjectOrigin = 'quote' | 'manual';

const getTodayLocalDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ show, onClose, onSave, currentUser, initialData }) => {
  const isEditing = !!initialData;
  const [originSelection, setOriginSelection] = useState<ProjectOrigin>('manual');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Project['status']>('Planificación');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [startDate, setStartDate] = useState(getTodayLocalDate());
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const [approvedQuotes, setApprovedQuotes] = useState<Quote[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  const { 
    savedClients, 
    hasMore: hasMoreClients,
    loadMore: loadMoreClients,
    loadingMore: loadingMoreClients,
    addClient
  } = useClients(currentUser);

  useEffect(() => {
    if (!show) {
      setOriginSelection('manual');
      setName('');
      setStatus('Planificación');
      setClientId('');
      setClientName('');
      setShowClientModal(false);
      setStartDate(getTodayLocalDate());
      setSelectedQuoteId('');
      setQuotesError(null);
      setErrorMsg(null);
      setIdempotencyKey('');
      return;
    }

    if (initialData) {
      setName(initialData.name);
      setStatus(initialData.status);
      setClientId(initialData.clientId || '');
      setClientName(initialData.clientName || '');
      setStartDate(initialData.startDate || getTodayLocalDate());
      setSelectedQuoteId(initialData.quoteId || '');
      setOriginSelection(initialData.origin === 'Cotización' && initialData.quoteId ? 'quote' : 'manual');
      setIdempotencyKey('');
    } else {
      setName('');
      setStatus('Planificación');
      setClientId('');
      setClientName('');
      setStartDate(getTodayLocalDate());
      setSelectedQuoteId('');
      setOriginSelection('manual');
      
      // Generate a new idempotency key on mount/open of a new project form.
      const key = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      setIdempotencyKey(key);
    }

    const loadFormOptions = async () => {
      setLoadingQuotes(true);
      setQuotesError(null);
      try {
        const [quotes, projects] = await Promise.all([
          getApprovedQuotes(),
          getProjects(100)
        ]);
        setApprovedQuotes(quotes);
        setAllProjects(projects);
      } catch (error) {
        console.error('Error loading approved quotes:', error);
        setQuotesError('No fue posible cargar las cotizaciones aprobadas.');
        setApprovedQuotes([]);
      } finally {
        setLoadingQuotes(false);
      }
    };

    loadFormOptions();
  }, [show, initialData]);

  const findSelectedQuote = (quoteId: string) =>
    approvedQuotes.find(
      quote => (quote.docId && quote.docId === quoteId) || quote.id?.toString() === quoteId
    );

  const findClientForQuote = (quote: Quote): Client | null => {
    if (quote.clientId) {
      const byId = savedClients.find(client => client.id === quote.clientId);
      if (byId) return byId;
    }

    if (quote.codigoCliente) {
      const byCode = savedClients.find(
        client => client.codigoCliente?.trim().toUpperCase() === quote.codigoCliente?.trim().toUpperCase()
      );
      if (byCode) return byCode;
    }

    if (quote.empresa) {
      const byCompany = savedClients.find(
        client => client.empresa.trim().toLowerCase() === quote.empresa.trim().toLowerCase()
      );
      if (byCompany) return byCompany;
    }

    return null;
  };

  const handleQuoteSelect = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    if (!quoteId) {
      setOriginSelection('manual');
      setClientId('');
      setClientName('');
      return;
    }

    setOriginSelection('quote');
    const quote = findSelectedQuote(quoteId);
    if (!quote) return;

    const client = findClientForQuote(quote);

    if (client) {
      setClientId(client.id);
      setClientName(client.empresa);
    } else {
      setClientId(quote.clientId || quote.codigoCliente || 'CLIENT_QUOTE');
      setClientName(quote.empresa || 'Cliente de Cotización');
    }
  };

  const handleClientSelect = (client: Client) => {
    setClientId(client.id);
    setClientName(client.empresa);
    setShowClientModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMsg('El nombre del proyecto es requerido.');
      return;
    }

    if (originSelection === 'quote') {
      if (!clientId.trim() || !clientName.trim()) {
        setErrorMsg('Debe seleccionar un cliente del directorio.');
        return;
      }
    } else {
      if (!clientName.trim()) {
        setErrorMsg('Debe ingresar un cliente.');
        return;
      }
    }

    if (!startDate) {
      setErrorMsg('La fecha de inicio es obligatoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalClientId = clientId.trim();
      let finalClientName = clientName.trim().toUpperCase();

      if (originSelection === 'manual') {
        const existingClient = savedClients.find(
          c => c.empresa.trim().toUpperCase() === finalClientName
        );

        if (existingClient) {
          finalClientId = existingClient.id;
          finalClientName = existingClient.empresa;
        } else {
          // Create the new client in the directory!
          const created = await addClient({
            empresa: finalClientName,
            contacto: 'Contacto Manual',
            telefono: '',
            correo: '',
            isActive: true
          });
          finalClientId = created.id;
          finalClientName = created.empresa;
        }
      }

      let quoteCommercialId: string | undefined;
      if (selectedQuoteId) {
        const q = findSelectedQuote(selectedQuoteId);
        if (q && q.id !== undefined) {
          quoteCommercialId = String(q.id);
        }
      }

      if (isEditing && initialData) {
        const { updatedProject, unlinkedProjectId } = await withTimeout(
          updateProjectWithQuoteHandling({
            id: initialData.id,
            projectData: {
              name: trimmedName,
              status,
              clientId: finalClientId,
              clientName: finalClientName,
              startDate,
            },
            selectedQuoteId: selectedQuoteId || undefined,
            selectedQuoteCommercialId: quoteCommercialId,
          }),
          15000,
          'El tiempo de espera para actualizar el proyecto ha expirado. Verifique su conexión a internet e inténtelo nuevamente.'
        );

        onSave(updatedProject, unlinkedProjectId);
        onClose();
        return;
      } else {
        // Enforce network connection status check at client level before transaction call
        if (typeof window !== 'undefined' && 'navigator' in window && !window.navigator.onLine) {
          throw new Error('Sin conexión a internet. Se requiere una conexión activa para generar el número de proyecto de forma segura.');
        }

        const { newProject, unlinkedProjectId } = await withTimeout(
          createProjectWithQuoteHandling({
            projectData: {
              name: trimmedName,
              status: 'Planificación',
              clientId: finalClientId,
              clientName: finalClientName,
              startDate,
            },
            selectedQuoteId: selectedQuoteId || undefined,
            selectedQuoteCommercialId: quoteCommercialId,
            createdBy: currentUser?.uid || currentUser?.id || 'unknown',
            createdByDisplayName: currentUser?.name || currentUser?.displayName || currentUser?.email || 'Usuario',
            idempotencyKey: idempotencyKey || undefined,
          }),
          15000,
          'El tiempo de espera para registrar el proyecto ha expirado. Verifique su conexión a internet e inténtelo de nuevo (los datos introducidos han sido conservados).'
        );

        onSave(newProject, unlinkedProjectId);
        onClose();
      }
    } catch (error: any) {
      console.error("Error saving project:", error);
      setErrorMsg(error.message || 'Error al guardar el proyecto');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  const clientIsLockedByQuote = originSelection === 'quote' && !!selectedQuoteId;

  return (
    <>
      <Modal
        isOpen={show}
        onClose={onClose}
        title={isEditing ? "Editar Proyecto" : "Nuevo Proyecto"}
        subtitle={isEditing ? `Expediente: ${initialData?.projectNumber}` : "Módulo de Gestión Operativa"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cotización de origen</label>
            <div className="relative">
              <select
                value={selectedQuoteId}
                onChange={e => handleQuoteSelect(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
                disabled={loadingQuotes}
              >
                <option value="">Ninguna (Proyecto Manual)</option>
                {approvedQuotes.map(q => {
                  const qDocId = q.docId || q.id?.toString() || '';
                  const commercialId = q.id !== undefined && !isNaN(Number(q.id))
                    ? `#${String(q.id).padStart(3, '0')}`
                    : `#${qDocId.slice(-4)}`;
                  
                  const linkedProj = allProjects.find(
                    p => p.quoteId === qDocId || (q.id && p.quoteCommercialId === String(q.id))
                  );
                  const isOtherProject = linkedProj && linkedProj.id !== initialData?.id;

                  return (
                    <option key={qDocId} value={qDocId}>
                      Cotización {commercialId} — {q.empresa || 'Sin Cliente'}{isOtherProject ? ` (Vinculada a ${linkedProj.projectNumber})` : ''}
                    </option>
                  );
                })}
              </select>
              <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {loadingQuotes && (
              <p className="text-[11px] text-slate-400 mt-1 animate-pulse">Cargando cotizaciones aprobadas...</p>
            )}
            {quotesError && (
              <p className="text-[11px] text-red-500 font-medium mt-1">{quotesError}</p>
            )}
          </div>

          {isEditing && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado del proyecto *</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as Project['status'])}
                  className="w-full appearance-none px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
                >
                  <option value="Planificación">Planificación</option>
                  <option value="En Ejecución">En Ejecución</option>
                  <option value="En Pausa">En Pausa</option>
                  <option value="Entregado">Entregado</option>
                  <option value="Facturado">Facturado</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
                <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del proyecto *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
              placeholder="Ej. Instalación de Red"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente asociado *</label>
            <div className="flex gap-2">
              {clientIsLockedByQuote ? (
                <div
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium transition-all truncate bg-slate-100 text-slate-700"
                >
                  {clientName}
                </div>
              ) : (
                <input
                  type="text"
                  value={clientName}
                  onChange={e => {
                    const upperValue = e.target.value.toUpperCase();
                    setClientName(upperValue);
                    setClientId('');
                  }}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
                  placeholder="Escriba o busque un cliente..."
                  required
                />
              )}
              {!clientIsLockedByQuote && (
                <IconButton
                  type="button"
                  onClick={() => setShowClientModal(true)}
                  icon={<FiSearch size={20} />}
                  variant="primary"
                  title="Buscar en Directorio"
                  className="flex-none h-[46px] w-[46px] rounded-xl"
                />
              )}
            </div>
            {clientIsLockedByQuote ? (
              <p className="text-[11px] text-slate-400 mt-1">Bloqueado porque proviene de la cotización seleccionada.</p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">Escriba el nombre del cliente o selecciónelo del directorio.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de inicio *</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
              required
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] font-bold text-red-600 animate-in fade-in slide-in-from-top-1">
              {errorMsg}
            </div>
          )}

          <div className="pt-6 flex gap-3">
            <ActionButton
              type="button"
              variant="secondary"
              onClick={onClose}
              label="CANCELAR"
              className="flex-1"
            />
            <ActionButton
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              label="GUARDAR"
              variant="primary"
              className="flex-1"
            />
          </div>
        </form>
      </Modal>

      <ClientDirectoryModal 
        show={showClientModal}
        onClose={() => setShowClientModal(false)}
        clients={savedClients}
        onSelect={handleClientSelect}
        hasMore={hasMoreClients}
        onLoadMore={loadMoreClients}
        isLoadingMore={loadingMoreClients}
      />
    </>
  );
};
