import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import { createProject, getApprovedQuotes, checkQuoteHasProject, updateProject } from '../services/projectService';
import { Project } from '../types';
import { Client, Quote, User } from '../../../utils/types';
import { useClients } from '../../../hooks/useClients';
import { Modal, ActionButton, IconButton } from '../../../design-system';
import { ClientDirectoryModal } from '../../quotes/ClientDirectoryModal';

interface ProjectFormModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (p: Project) => void;
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

  const [approvedQuotes, setApprovedQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  const { 
    savedClients, 
    hasMore: hasMoreClients,
    loadMore: loadMoreClients,
    loadingMore: loadingMoreClients
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
      return;
    }

    if (initialData) {
      setName(initialData.name);
      setStatus(initialData.status);
      setClientId(initialData.clientId || '');
      setClientName(initialData.clientName || '');
      setStartDate(initialData.startDate || getTodayLocalDate());
      setSelectedQuoteId(initialData.quoteId || '');
      setOriginSelection(initialData.origin === 'Cotización' ? 'quote' : 'manual');
      
      if (initialData.clientId) {
        const client = savedClients.find(c => c.id === initialData.clientId);
        if (client) {
          setClientName(client.empresa);
        }
      }
    } else {
      setStartDate(getTodayLocalDate());
    }

    const loadQuotes = async () => {
      setLoadingQuotes(true);
      setQuotesError(null);
      try {
        const quotes = await getApprovedQuotes();
        setApprovedQuotes(quotes);
      } catch (error) {
        console.error('Error loading approved quotes:', error);
        setQuotesError('No fue posible cargar las cotizaciones aprobadas.');
        setApprovedQuotes([]);
      } finally {
        setLoadingQuotes(false);
      }
    };

    loadQuotes();
  }, [show, initialData, savedClients]);

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
    const isManual = !quoteId;
    setOriginSelection(isManual ? 'manual' : 'quote');
    setSelectedQuoteId(quoteId);

    if (isManual) {
      setClientId('');
      setClientName('');
      return;
    }

    const quote = findSelectedQuote(quoteId);
    if (!quote) {
      setClientId('');
      setClientName('');
      return;
    }

    const client = findClientForQuote(quote);

    if (client) {
      setClientId(client.id);
      setClientName(client.empresa);
    } else {
      setClientId(quote.clientId || quote.codigoCliente || '');
      setClientName(quote.empresa || '');
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

    if (!clientId.trim()) {
      setErrorMsg('Debe seleccionar un cliente del directorio.');
      return;
    }

    if (!startDate) {
      setErrorMsg('La fecha de inicio es obligatoria.');
      return;
    }

    if (!isEditing && originSelection === 'quote' && !selectedQuoteId) {
      setErrorMsg('Debe seleccionar una cotización aprobada.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && initialData) {
        const updateData: Partial<Project> = {
          name: trimmedName,
          status,
          clientId: clientId.trim(),
          clientName: clientName.trim(),
          startDate,
        };
        await updateProject(initialData.id, updateData);
        onSave({ ...initialData, ...updateData });
        onClose();
        return;
      }

      let origin: Project['origin'] = 'Manual';
      let quoteIdToSave: string | undefined;

      if (originSelection === 'quote') {
        const quote = findSelectedQuote(selectedQuoteId);
        if (!quote) {
          throw new Error('La cotización seleccionada ya no está disponible.');
        }

        const stableQuoteId = quote.docId || quote.id?.toString() || selectedQuoteId;
        const existingProject = await checkQuoteHasProject(stableQuoteId);

        if (existingProject) {
          setErrorMsg(`Esta cotización ya está asociada al proyecto ${existingProject.projectNumber}.`);
          setIsSubmitting(false);
          return;
        }

        origin = 'Cotización';
        quoteIdToSave = stableQuoteId;
      }

      const projectData: Omit<Project, 'id' | 'projectNumber' | 'isActive' | 'createdAt' | 'updatedAt'> = {
        name: trimmedName,
        status: 'Planificación',
        origin,
        clientId: clientId.trim(),
        clientName: clientName.trim(),
        quoteId: quoteIdToSave,
        quoteCommercialId: originSelection === 'quote' ? findSelectedQuote(selectedQuoteId)?.id?.toString() : undefined,
        startDate,
      };

      const newProject = await createProject(
        projectData, 
        currentUser?.uid || currentUser?.id || 'unknown',
        currentUser?.name || currentUser?.displayName || currentUser?.email || 'Usuario'
      );
      onSave(newProject);
      onClose();
    } catch (error: any) {
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
          {!isEditing ? (
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
                    const commercialId = q.id !== undefined ? `#${String(q.id).padStart(3, '0')}` : `#${q.docId?.slice(-4)}`;
                    return (
                      <option key={q.docId || q.id} value={q.docId || q.id?.toString()}>
                        {commercialId} — {q.empresa || 'Sin Cliente'}
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
          ) : (
            initialData?.quoteId && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cotización de origen (Referencia)</label>
                <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700">
                  {/* For display, we can try to find the quote or just show the ID */}
                  Cotización {initialData.quoteCommercialId ? `#${String(initialData.quoteCommercialId).padStart(3, '0')}` : (findSelectedQuote(initialData.quoteId)?.id ? `#${String(findSelectedQuote(initialData.quoteId)?.id).padStart(3, '0')}` : `#${initialData.quoteId.slice(-6)}`)}
                </div>
              </div>
            )
          )}

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
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
              placeholder="Ej. Instalación de Red"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente asociado *</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 px-4 py-3 border rounded-xl text-sm font-medium transition-all truncate ${
                  clientIsLockedByQuote 
                    ? 'bg-slate-100 border-slate-200 text-slate-700' 
                    : clientName 
                      ? 'bg-blue-50 border-blue-200 text-blue-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {clientName || 'Seleccione un cliente...'}
              </div>
              {!clientIsLockedByQuote && (
                <IconButton
                  onClick={() => setShowClientModal(true)}
                  icon={<FiSearch size={20} />}
                  variant="primary"
                  title="Buscar en Directorio"
                  className="flex-none h-[46px] w-[46px] rounded-xl"
                />
              )}
            </div>
            {clientIsLockedByQuote && (
              <p className="text-[11px] text-slate-400 mt-1">Bloqueado por cotización.</p>
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
