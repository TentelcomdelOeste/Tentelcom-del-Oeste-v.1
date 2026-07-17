
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useQuotes } from '../../../hooks/useQuotes';
import { useClients } from '../../../hooks/useClients';
import { Invoice } from './invoice.types';
import { InvoiceOCViewer } from './InvoiceOCViewer';
import { getYearFromDateString } from '../../../utils/dateUtils';
import useLockBodyScroll from '../../../hooks/useLockBodyScroll';
import { ActionButton, ACTION_ICONS } from '../../../design-system';
import { ClientDirectoryModal } from '../../quotes/ClientDirectoryModal';
import { AttachmentUploader } from '../../attachments/AttachmentUploader';
import { FiX, FiLock, FiSearch, FiBriefcase, FiChevronDown, FiAlertCircle, FiUser, FiTruck } from "react-icons/fi";

// Compatibilidad
export type LocalInvoice = Invoice;

interface InvoiceModalProps {
  show: boolean;
  onClose: () => void;
  onSave?: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>, id?: string) => void;
  initialData?: Invoice | null; 
  isLinkedToOC?: boolean; // Nuevo prop para indicar si tiene enlaces activos
  existingProviders?: string[]; // Lista de proveedores existentes para autocompletado
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ show, onClose, onSave, initialData, isLinkedToOC = false, existingProviders = [] }) => {
  useLockBodyScroll(show);

  // Estado local mapeado al nuevo modelo
  const [type, setType] = useState<'CXC' | 'CXP'>('CXC');
  const [paymentMode, setPaymentMode] = useState<'CONTADO' | 'CREDITO'>('CREDITO');
  const [currency, setCurrency] = useState<'USD' | 'CRC'>('USD');
  
  const [consecutivo, setConsecutivo] = useState('');
  const [entityName, setEntityName] = useState('');
  
  const [subtotal, setSubtotal] = useState('');
  const [balance, setBalance] = useState('');
  
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const { currentUser } = useAuth();
  const { quotes } = useQuotes(currentUser);
  const { savedClients, deactivateClient } = useClients(currentUser);
  const [showClientDirectory, setShowClientDirectory] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectOptions, setShowProjectOptions] = useState(false);

  const [showProviderOptions, setShowProviderOptions] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);

  const subtotalNum = parseFloat(subtotal) || 0;
  const ivaNum = subtotalNum * 0.13;
  const totalNum = subtotalNum + ivaNum;

  const approvedProjects = useMemo(() => {
    return quotes.filter(q => q.estado === 'Aprobada');
  }, [quotes]);

  // Filtrado de proveedores para autocompletado
  const filteredProviders = useMemo(() => {
    if (!entityName.trim()) return existingProviders;
    const term = entityName.toLowerCase();
    return existingProviders.filter(p => p.toLowerCase().includes(term));
  }, [existingProviders, entityName]);

  useEffect(() => {
    if (show && initialData) {
        setType(initialData.type);
        setPaymentMode(initialData.paymentMode);
        setCurrency(initialData.currency);
        setConsecutivo(initialData.consecutivo || '');
        setEntityName(initialData.entityName || '');
        setSubtotal(initialData.subtotal?.toString() || '0');
        setBalance(initialData.balance?.toString() || '0');
        setIssueDate(initialData.issueDate || new Date().toISOString().split('T')[0]);
        setDueDate(initialData.dueDate || '');
        setNotes(initialData.notes || '');
        setSelectedProjectId(initialData.projectId || '');
    } else if (show && !initialData) {
        setType('CXC');
        setPaymentMode('CREDITO');
        setCurrency('USD');
        setConsecutivo('');
        setEntityName('');
        setSubtotal('');
        setIssueDate(new Date().toISOString().split('T')[0]);
        setDueDate('');
        setNotes('');
        setSelectedProjectId('');
        setProjectSearch('');
    }
  }, [show, initialData]);

  useEffect(() => {
    if (selectedProjectId && approvedProjects.length > 0) {
        const p = approvedProjects.find(p => p.id?.toString() === selectedProjectId);
        if (p) {
            const projectIdStr = p.id?.toString() || '';
            const yearStr = getYearFromDateString(p.fecha);
            const empresaStr = p.empresa || 'S/N';
            setProjectSearch(`#${projectIdStr.padStart(3, '0')}-${yearStr} | ${empresaStr}`);
        }
    } else if (!selectedProjectId) {
        setProjectSearch('');
    }
  }, [selectedProjectId, approvedProjects]);

  const filteredProjects = useMemo(() => {
      const term = projectSearch.toLowerCase();
      const currentSelected = approvedProjects.find(p => p.id?.toString() === selectedProjectId);
      if (currentSelected) {
          const projectIdStr = currentSelected.id?.toString() || '';
          const yearStr = getYearFromDateString(currentSelected.fecha);
          const empresaStr = currentSelected.empresa || 'S/N';
          const label = `#${projectIdStr.padStart(3, '0')}-${yearStr} | ${empresaStr}`;
          if (label.toLowerCase() === term) return approvedProjects;
      }

      if (!term.trim()) return approvedProjects;

      return (approvedProjects || []).filter(p => {
          const projectIdStr = p.id?.toString() || '';
          const yearStr = getYearFromDateString(p.fecha);
          const empresaStr = p.empresa || 'S/N';
          const label = `#${projectIdStr.padStart(3, '0')}-${yearStr} | ${empresaStr}`;
          return label.toLowerCase().includes(term);
      });
  }, [approvedProjects, projectSearch, selectedProjectId]);

  const handleSave = () => {
    setValidationError(null);

    if (!consecutivo.trim()) {
        setValidationError("El consecutivo de la factura es obligatorio.");
        return;
    }

    if (!entityName.trim()) {
        setValidationError(`El nombre del ${type === 'CXC' ? 'Cliente' : 'Proveedor'} es obligatorio.`);
        return;
    }

    if (subtotalNum <= 0) {
        setValidationError("El subtotal debe ser mayor a 0.");
        return;
    }

    if (!issueDate) {
        setValidationError("La fecha de emisión es obligatoria.");
        return;
    }

    if (paymentMode === 'CREDITO' && !dueDate) {
        setValidationError("La fecha de vencimiento es obligatoria para facturas a crédito.");
        return;
    }

    const selectedProject = (approvedProjects || []).find(p => p.id?.toString() === selectedProjectId);
    const projectName = selectedProject 
        ? `#${selectedProject.id || ''} - ${selectedProject.empresa || 'S/N'}` 
        : undefined;

    const invoicePayload: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
        consecutivo: consecutivo.trim(),
        type,
        paymentMode,
        currency,
        entityName: entityName.trim(),
        subtotal: subtotalNum,
        iva: ivaNum,
        total: totalNum,
        balance: initialData ? (parseFloat(balance) || 0) : (paymentMode === 'CONTADO' ? 0 : totalNum),
        issueDate,
        dueDate: paymentMode === 'CREDITO' ? dueDate : undefined,
        projectId: selectedProjectId || undefined,
        projectName,
        notes: notes.trim() || undefined,
        status: paymentMode === 'CONTADO' ? 'Pagada' : 'Pendiente'
    };

    if (onSave) {
        onSave(invoicePayload, initialData?.id);
    }

    handleClose();
  };

  const handleClose = () => {
      setValidationError(null);
      onClose();
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[200] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
          <div>
            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                {initialData ? 'Editar Factura' : 'Registro de Factura'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Gestión de Cuentas por Cobrar y Pagar
            </p>
          </div>
          <button 
            onClick={handleClose} 
            className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
          >
            <FiX className="text-lg"  />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white">

          {/* ALERTA DE BLOQUEO POR ENLACE A OC */}
          {isLinkedToOC && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                <FiLock className="text-amber-600 mt-0.5"  />
                <div>
                    <h4 className="text-xs font-black text-amber-800 uppercase tracking-wide">Edición Limitada</h4>
                    <p className="text-[11px] font-medium text-amber-700 mt-1">
                        Esta factura tiene consumos asociados a Órdenes de Compra.
                        <br/>
                        <span className="font-bold">Para mantener la trazabilidad contable, los montos no pueden ser modificados.</span>
                    </p>
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Flujo de Caja</label>
               <div className="flex gap-2">
                  <button
                    type="button" 
                    onClick={() => setType('CXC')}
                    disabled={isLinkedToOC}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${type === 'CXC' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 hover:text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Por Cobrar
                  </button>
                  <button
                    type="button" 
                    onClick={() => setType('CXP')}
                    disabled={isLinkedToOC}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${type === 'CXP' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-400 hover:text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Por Pagar
                  </button>
               </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Modalidad</label>
               <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setPaymentMode('CONTADO')}
                    disabled={isLinkedToOC}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentMode === 'CONTADO' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 hover:text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Contado
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPaymentMode('CREDITO')}
                    disabled={isLinkedToOC}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentMode === 'CREDITO' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-slate-400 hover:text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Crédito
                  </button>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    Consecutivo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">#</span>
                    <input 
                        type="text" 
                        value={consecutivo}
                        onChange={(e) => setConsecutivo(e.target.value)}
                        placeholder="00001"
                        className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 placeholder:text-slate-300"
                    />
                </div>
            </div>
            <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    {type === 'CXC' ? 'Cliente / Receptor' : 'Proveedor / Emisor'} <span className="text-red-500">*</span>
                </label>
                <div className="relative flex gap-2">
                    <div className="relative flex-1">
                        {type === 'CXC' ? <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" /> : <FiTruck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />}
                        <input 
                            type="text" 
                            value={entityName}
                            onChange={(e) => {
                                setEntityName(e.target.value);
                                if (type === 'CXP') setShowProviderOptions(true);
                            }}
                            onFocus={() => {
                                if (type === 'CXP') setShowProviderOptions(true);
                            }}
                            onBlur={() => setTimeout(() => setShowProviderOptions(false), 200)}
                            placeholder={type === 'CXC' ? 'Nombre del Cliente...' : 'Nombre del Proveedor...'}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all text-blue-900 placeholder:text-slate-400"
                            autoComplete="off"
                        />

                        {/* Autocompletado de Proveedores (Solo CXP) */}
                        {type === 'CXP' && showProviderOptions && filteredProviders.length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                                {filteredProviders.map((provider, index) => (
                                    <div 
                                        key={index}
                                        className="px-4 py-3 cursor-pointer text-xs font-bold transition-colors hover:bg-slate-50 text-slate-700"
                                        onClick={() => {
                                            setEntityName(provider);
                                            setShowProviderOptions(false);
                                        }}
                                    >
                                        {provider}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {type === 'CXC' && (
                        <button 
                            type="button"
                            onClick={() => setShowClientDirectory(true)}
                            className="w-12 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center active:scale-95"
                            title="Buscar en Directorio"
                        >
                            <FiSearch  />
                        </button>
                    )}
                </div>
            </div>
          </div>

          <ClientDirectoryModal 
            show={showClientDirectory}
            onClose={() => setShowClientDirectory(false)}
            clients={savedClients}
            onSelect={(client) => {
                setEntityName(client.empresa);
                setShowClientDirectory(false);
            }}
            onDelete={(e, client) => deactivateClient(client.id)}
          />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
             {/* Overlay de Bloqueo si está ligada */}
             {isLinkedToOC && (
                 <div className="absolute inset-0 bg-slate-100/50 rounded-xl z-10 cursor-not-allowed"></div>
             )}

             <div className="md:col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Moneda</label>
                <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'USD' | 'CRC')}
                    className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-black outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer text-slate-700 disabled:bg-white disabled:text-slate-500"
                    disabled={isLinkedToOC}
                >
                    <option value="USD">USD ($)</option>
                    <option value="CRC">CRC (¢)</option>
                </select>
             </div>
             <div className="md:col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subtotal <span className="text-red-500">*</span></label>
                <input 
                    type="number" 
                    min="0.01"
                    step="0.01"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-black outline-none focus:ring-2 focus:ring-blue-100 text-slate-700 disabled:bg-white disabled:text-slate-500"
                    disabled={isLinkedToOC}
                />
             </div>
             <div className="md:col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">IVA (13%)</label>
                <div className="w-full p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-black text-slate-500 cursor-not-allowed">
                    {currency === 'USD' ? '$' : '¢'}{ivaNum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
             </div>
             <div className="md:col-span-1">
                <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-1">Total Neto</label>
                <div className="w-full p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-xs font-black text-blue-700 cursor-not-allowed">
                    {currency === 'USD' ? '$' : '¢'}{totalNum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
             </div>
             <div className="md:col-span-1">
                <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">Saldo Pendiente</label>
                <input 
                    type="number" 
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-black outline-none focus:ring-2 focus:ring-amber-100 text-amber-700 disabled:bg-white disabled:text-slate-500"
                    disabled={isLinkedToOC || paymentMode === 'CONTADO'}
                />
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha Emisión</label>
                <input 
                    type="date" 
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 uppercase text-slate-600"
                />
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Fecha Vencimiento {paymentMode === 'CREDITO' && <span className="text-red-500">*</span>}</label>
                <input 
                    type="date" 
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={paymentMode === 'CONTADO'}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 uppercase text-slate-600 disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed"
                />
             </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Proyecto Asociado (Opcional)</label>
                <div className="relative">
                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs z-10"  />
                    
                    <input 
                        type="text"
                        className={`w-full pl-10 pr-10 py-3 rounded-xl border text-xs font-bold outline-none transition-all ${selectedProjectId ? 'bg-blue-50 border-blue-200 text-blue-800 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-2 focus:ring-blue-100'}`}
                        placeholder="Buscar proyecto..."
                        value={projectSearch}
                        onChange={(e) => {
                            setProjectSearch(e.target.value);
                            setShowProjectOptions(true);
                            if (e.target.value === '') setSelectedProjectId('');
                        }}
                        onFocus={() => !selectedProjectId && setShowProjectOptions(true)}
                        onBlur={() => setTimeout(() => setShowProjectOptions(false), 200)}
                        autoComplete="off"
                        readOnly={!!selectedProjectId}
                    />

                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                        {selectedProjectId ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedProjectId('');
                                    setProjectSearch('');
                                }}
                                className="text-slate-400 hover:text-red-500 transition-colors z-20 cursor-pointer"
                                title="Cambiar proyecto seleccionado"
                            >
                                <FiX className="text-sm"  />
                            </button>
                        ) : (
                            <FiChevronDown className="text-xs text-slate-400 pointer-events-none"  />
                        )}
                    </div>

                    {showProjectOptions && !selectedProjectId && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                            <div 
                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-500"
                                onClick={() => {
                                    setSelectedProjectId('');
                                    setProjectSearch('');
                                    setShowProjectOptions(false);
                                }}
                            >
                                -- Sin Proyecto / General --
                            </div>
                            
                            {filteredProjects.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-slate-400 italic">
                                    No se encontraron proyectos.
                                </div>
                            ) : (
                                filteredProjects.map(project => {
                                    const year = getYearFromDateString(project.fecha);
                                    const projectIdStr = project.id?.toString() || '';
                                    const empresaStr = project.empresa || 'S/N';
                                    const label = `#${projectIdStr.padStart(3, '0')}-${year} | ${empresaStr}`;
                                    return (
                                        <div 
                                            key={project.id}
                                            className="px-4 py-3 cursor-pointer text-xs font-bold transition-colors hover:bg-slate-50 text-slate-700"
                                            onClick={() => {
                                                setSelectedProjectId(project.id?.toString() || '');
                                                setProjectSearch(label);
                                                setShowProjectOptions(false);
                                            }}
                                        >
                                            {label}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Observaciones</label>
                <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalles adicionales de la factura..."
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium h-24 resize-none outline-none focus:ring-2 focus:ring-blue-100 text-slate-700 placeholder:text-slate-400"
                ></textarea>
            </div>

            {/* SECCIÓN DE ADJUNTOS */}
            {initialData && initialData.id && (
              <div className="pt-4 border-t border-slate-100 animate-in fade-in duration-500">
                <AttachmentUploader 
                    entityType="invoices"
                    entityId={initialData.id}
                    title="Comprobantes de Factura"
                    subtitle="Suba aquí el PDF o XML de la factura y otros archivos relacionados."
                    showTitle={true}
                />
              </div>
            )}

            {/* SECCIÓN VISUALIZACIÓN OCs (SOLO SI YA EXISTE) */}
            {initialData && initialData.id && (
              <InvoiceOCViewer invoiceId={initialData.id} />
            )}

          </div>

          {validationError && (
            <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 text-center animate-pulse">
                <FiAlertCircle className="mr-1"  /> {validationError}
            </div>
          )}

        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-none">
          <ActionButton 
            onClick={handleClose}
            label="Cancelar"
            variant="secondary"
          />
          <ActionButton 
            onClick={handleSave}
            label={initialData ? 'Actualizar' : 'Guardar'}
            variant="primary"
            icon={<ACTION_ICONS.save />}
          />
        </div>

      </div>
    </div>,
    document.body
  );
};
