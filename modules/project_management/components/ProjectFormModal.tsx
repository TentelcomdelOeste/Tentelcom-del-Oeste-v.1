import React, { useEffect, useMemo, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { createProject, getApprovedQuotes, checkQuoteHasProject } from '../services/projectService';
import { Project } from '../types';
import { Client, Quote, User } from '../../../utils/types';
import { formatCurrency } from '../../../utils/formatCurrency';
import { useClients } from '../../../hooks/useClients';
import { Modal, ActionButton } from '../../../design-system';

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
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [startDate, setStartDate] = useState(getTodayLocalDate());
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [approvedQuotes, setApprovedQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  const { savedClients, loading: loadingClients } = useClients(currentUser);

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) return savedClients.filter(client => client.isActive !== false).slice(0, 8);

    return savedClients
      .filter(client => client.isActive !== false)
      .filter(client =>
        client.empresa.toLowerCase().includes(term) ||
        client.codigoCliente?.toLowerCase().includes(term) ||
        client.contacto.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [savedClients, clientSearch]);

  useEffect(() => {
    if (!show) {
      setOriginSelection('manual');
      setName('');
      setStatus('Planificación');
      setClientId('');
      setClientSearch('');
      setSelectedClient(null);
      setIsClientDropdownOpen(false);
      setStartDate(getTodayLocalDate());
      setSelectedQuoteId('');
      setQuotesError(null);
      return;
    }

    if (initialData) {
      setName(initialData.name);
      setStatus(initialData.status);
      setClientId(initialData.clientId || '');
      setStartDate(initialData.startDate || getTodayLocalDate());
      setSelectedQuoteId(initialData.quoteId || '');
      setOriginSelection(initialData.origin === 'Cotización' ? 'quote' : 'manual');
      
      if (initialData.clientId) {
        const client = savedClients.find(c => c.id === initialData.clientId);
        if (client) {
          setSelectedClient(client);
          setClientSearch(client.empresa);
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

  const handleOriginChange = (origin: ProjectOrigin) => {
    setOriginSelection(origin);

    if (origin === 'manual') {
      setSelectedQuoteId('');
      setSelectedClient(null);
      setClientId('');
      setClientSearch('');
      setIsClientDropdownOpen(false);
    }
  };

  const handleQuoteSelect = (quoteId: string) => {
    // The quote selector is the single source of truth for the project origin.
    // Selecting a quote switches the client field to read-only; selecting the
    // empty option returns the form to manual mode.
    const isManual = !quoteId;
    setOriginSelection(isManual ? 'manual' : 'quote');
    setSelectedQuoteId(quoteId);

    if (isManual) {
      setSelectedClient(null);
      setClientId('');
      setClientSearch('');
      setIsClientDropdownOpen(false);
      return;
    }

    const quote = findSelectedQuote(quoteId);
    if (!quote) {
      setSelectedClient(null);
      setClientId('');
      setClientSearch('');
      setIsClientDropdownOpen(false);
      return;
    }

    const client = findClientForQuote(quote);

    if (client) {
      setSelectedClient(client);
      setClientId(client.id);
      setClientSearch(client.empresa);
    } else {
      setSelectedClient(null);
      setClientId(quote.clientId || quote.codigoCliente || '');
      setClientSearch(quote.empresa || '');
    }

    // Never show the manual client directory when the client comes from a quote.
    setIsClientDropdownOpen(false);
  };

  const handleManualClientInput = (value: string) => {
    setClientSearch(value);
    setSelectedClient(null);
    setClientId('');
    setIsClientDropdownOpen(true);
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientId(client.id);
    setClientSearch(client.empresa);
    setIsClientDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      alert('El nombre del proyecto es requerido.');
      return;
    }

    if (!clientId.trim()) {
      alert('Debe seleccionar un cliente del directorio.');
      return;
    }

    if (!startDate) {
      alert('La fecha de inicio es obligatoria.');
      return;
    }

    if (!isEditing && originSelection === 'quote' && !selectedQuoteId) {
      alert('Debe seleccionar una cotización aprobada.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && initialData) {
        const updateData: Partial<Project> = {
          name: trimmedName,
          status,
          clientId: clientId.trim(),
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
          throw new Error('La cotización seleccionada ya no está disponible. Recargue la lista e inténtelo nuevamente.');
        }

        const stableQuoteId = quote.docId || quote.id?.toString() || selectedQuoteId;
        const existingByDocId = quote.docId ? await checkQuoteHasProject(quote.docId) : null;
        const existingByQuoteId = quote.id?.toString() && quote.id?.toString() !== quote.docId
          ? await checkQuoteHasProject(quote.id.toString())
          : null;
        const existingProject = existingByDocId || existingByQuoteId;

        if (existingProject) {
          alert(`Esta cotización ya está asociada al proyecto ${existingProject.projectNumber}.`);
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
        quoteId: quoteIdToSave,
        startDate,
      };

      const newProject = await createProject(projectData, currentUser?.name || 'Sistema');
      onSave(newProject);
      onClose();
    } catch (error: any) {
      alert(error.message || 'Error al guardar el proyecto');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  const clientIsLockedByQuote = originSelection === 'quote' && !!selectedQuoteId;
  const showManualClientResults = originSelection === 'manual' && isClientDropdownOpen && clientSearch.trim().length > 0;

  return (
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
                {approvedQuotes.map(q => (
                  <option key={q.docId || q.id} value={q.docId || q.id?.toString()}>
                    #{q.id} - {q.empresa || 'Sin Cliente'} ({formatCurrency(q.monto, q.moneda)})
                  </option>
                ))}
              </select>
              <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {loadingQuotes && (
              <p className="text-[11px] text-slate-400 mt-1">Cargando cotizaciones aprobadas...</p>
            )}
            {quotesError && (
              <p className="text-[11px] text-red-500 font-medium mt-1">{quotesError}</p>
            )}
            {!loadingQuotes && !quotesError && approvedQuotes.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-1">No hay cotizaciones aprobadas disponibles.</p>
            )}
          </div>
        ) : (
          initialData?.quoteId && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cotización de origen (Referencia)</label>
              <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700">
                Cotización #{initialData.quoteId}
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
          {clientIsLockedByQuote ? (
            <div
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700"
              aria-readonly="true"
            >
              {selectedClient?.empresa || clientSearch || 'Cliente de la cotización'}
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={clientSearch}
                onChange={e => handleManualClientInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
                placeholder="Escriba código o nombre, ej. CNFL"
                required
                aria-required="true"
                autoComplete="off"
                onFocus={() => {
                  if (clientSearch.trim()) setIsClientDropdownOpen(true);
                }}
              />

              {showManualClientResults && (
                <div className="absolute left-0 right-0 top-full mt-1 z-[80] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {loadingClients ? (
                    <div className="px-4 py-3 text-sm text-slate-400">Cargando clientes...</div>
                  ) : filteredClients.length > 0 ? (
                    filteredClients.map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleClientSelect(client)}
                        className="block w-full text-left px-4 py-3 hover:bg-indigo-50 active:bg-indigo-100 border-b last:border-b-0 border-slate-100 transition-colors cursor-pointer"
                      >
                        <span className="block text-sm font-bold text-slate-800">{client.empresa}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">{client.codigoCliente || 'Sin código'} · {client.contacto || 'Sin contacto'}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-400">No se encontró un cliente en el directorio.</div>
                  )}
                </div>
              )}
            </div>
          )}
          {clientIsLockedByQuote && (
            <p className="text-[11px] text-slate-400 mt-1">Cliente obtenido automáticamente de la cotización seleccionada.</p>
          )}
          {!clientIsLockedByQuote && selectedClient && (
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Cliente seleccionado del directorio.</p>
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
  );
};
