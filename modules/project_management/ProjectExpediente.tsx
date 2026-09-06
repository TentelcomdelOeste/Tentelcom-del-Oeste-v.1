import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiChevronDown, FiBriefcase, FiUsers, FiTruck, FiBox, FiDollarSign, FiFileText, FiCheckCircle, FiCalendar, FiUser, FiPackage } from 'react-icons/fi';
import { User } from '../../utils/types';
import { Project } from './types';
import { getProjectJobs, getProjectMaterialRequests, getProjectInvoices, getProjectPurchases, subscribeToProjectJobs, subscribeToProjectMaterialRequests, subscribeToProjectInvoices, subscribeToProjectPurchases } from './services/projectRelationsService';
import { ActionButton } from '../../design-system';

interface ProjectExpedienteProps {
  project: Project;
  onBack: () => void;
  currentUser: User;
}

type TabKey = 'resumen' | 'trabajos' | 'personal' | 'unidades' | 'materiales' | 'bodegas' | 'consumos' | 'facturacion' | 'compras' | 'documentacion' | 'cierre';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'trabajos', label: 'Trabajos' },
  { id: 'personal', label: 'Personal' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'materiales', label: 'Materiales' },
  { id: 'bodegas', label: 'Bodegas Vehiculares' },
  { id: 'consumos', label: 'Consumos' },
  { id: 'facturacion', label: 'Facturación' },
  { id: 'compras', label: 'Compras / Gastos' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'cierre', label: 'Cierre' }
];

const ProjectExpediente: React.FC<ProjectExpedienteProps> = ({ project, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  
  // Relations State
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let loadedCount = 0;
    const TOTAL_SUBSCRIPTIONS = 4;

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= TOTAL_SUBSCRIPTIONS) {
        setLoading(false);
      }
    };

    const unsubJobs = subscribeToProjectJobs(project.id, (data) => {
      setJobs(data);
      checkLoaded();
    });

    const unsubInvoices = subscribeToProjectInvoices(project.id, (data) => {
      setInvoices(data);
      checkLoaded();
    });

    const unsubRequests = subscribeToProjectMaterialRequests(project.id, (data) => {
      setMaterialRequests(data);
      checkLoaded();
    });

    const unsubPurchases = subscribeToProjectPurchases(project.id, (data) => {
      setPurchases(data);
      checkLoaded();
    });

    return () => {
      unsubJobs();
      unsubInvoices();
      unsubRequests();
      unsubPurchases();
    };
  }, [project.id]);

  // Extract unique elements
  const uniquePersonnel = Array.from(new Set(jobs.flatMap(j => j.empleados || []).map((e: any) => e.empleadoId)));
  const uniqueVehicles = Array.from(new Set(jobs.map(j => j.unidadId).filter(Boolean)));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-4">
        <ActionButton 
          variant="secondary"
          onClick={onBack}
          label="VOLVER A PROYECTOS"
          icon={<FiArrowLeft />}
          className="mb-4"
        />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                {project.projectNumber || project.id}
              </span>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                {project.status}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-800">{project.name}</h2>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden md:flex gap-1 mt-6 overflow-x-auto custom-scrollbar pb-1">
          {TABS.map(tab => (
            <ActionButton
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant={activeTab === tab.id ? 'primary' : 'secondary'}
              label={tab.label}
              className={`rounded-b-none py-2 px-4 h-auto ${activeTab === tab.id ? 'border-b-2 border-indigo-600' : ''}`}
            />
          ))}
        </div>

        {/* Mobile Dropdown */}
        <div className="md:hidden mt-4 relative">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as TabKey)}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {TABS.map(tab => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'resumen' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                <h3 className="text-lg font-black text-slate-800 mb-4">Resumen del Proyecto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Número de Proyecto</p>
                    <p className="text-sm font-bold text-slate-700">{project.projectNumber || project.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Cotización de origen</p>
                    <p className="text-sm font-bold text-slate-700">{(project.origin === "Cotización" && project.quoteId) ? (project.quoteCommercialId ? `#${String(project.quoteCommercialId).padStart(3, '0')}` : (project.quoteId.length > 20 ? `#${project.quoteId.slice(-6)}` : `#${project.quoteId}`)) : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Cliente</p>
                    <p className="text-sm font-bold text-slate-700">{project.clientName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">OC Principal</p>
                    <p className="text-sm font-bold text-slate-700">{project.mainOcNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Fecha de inicio</p>
                    <p className="text-sm font-bold text-slate-700">{project.startDate || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Creado por</p>
                    <p className="text-sm font-bold text-slate-700">{project.createdByDisplayName || 'Usuario'}</p>
                  </div>
                </div>
                
                <h3 className="text-lg font-black text-slate-800 mb-4">Indicadores 360°</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-4">
                    <div className="bg-indigo-200 p-2 rounded-lg text-indigo-700"><FiBriefcase className="w-5 h-5" /></div>
                    <div>
                      <p className="text-2xl font-black text-indigo-900">{jobs.length}</p>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">Trabajos</p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center gap-4">
                    <div className="bg-emerald-200 p-2 rounded-lg text-emerald-700"><FiUsers className="w-5 h-5" /></div>
                    <div>
                      <p className="text-2xl font-black text-emerald-900">{uniquePersonnel.length}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Personal Involucrado</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-center gap-4">
                    <div className="bg-amber-200 p-2 rounded-lg text-amber-700"><FiTruck className="w-5 h-5" /></div>
                    <div>
                      <p className="text-2xl font-black text-amber-900">{uniqueVehicles.length}</p>
                      <p className="text-[10px] font-bold text-amber-600 uppercase">Unidades (Vehículos)</p>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4">
                    <div className="bg-blue-200 p-2 rounded-lg text-blue-700"><FiBox className="w-5 h-5" /></div>
                    <div>
                      <p className="text-2xl font-black text-blue-900">{materialRequests.length}</p>
                      <p className="text-[10px] font-bold text-blue-600 uppercase">Solicitudes Mat.</p>
                    </div>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex items-center gap-4">
                    <div className="bg-rose-200 p-2 rounded-lg text-rose-700"><FiDollarSign className="w-5 h-5" /></div>
                    <div>
                      <p className="text-2xl font-black text-rose-900">{invoices.length}</p>
                      <p className="text-[10px] font-bold text-rose-600 uppercase">Facturas</p>
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center gap-4">
                    <div className="bg-purple-200 p-2 rounded-lg text-purple-700"><FiFileText className="w-5 h-5" /></div>
                    <div>
                      <p className="text-2xl font-black text-purple-900">{purchases.length}</p>
                      <p className="text-[10px] font-bold text-purple-600 uppercase">Órdenes de Compra</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'trabajos' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 mb-4">Trabajos Relacionados</h3>
                {jobs.length === 0 ? (
                  <p className="text-slate-400 font-medium">No hay trabajos asociados a este proyecto.</p>
                ) : (
                  <div className="space-y-3">
                    {jobs.map(job => (
                      <div key={job.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-indigo-700">{job.id}</span>
                          <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md uppercase">{job.estado}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800">{job.descripcion}</p>
                        <p className="text-xs text-slate-500 mt-2">Fecha: {job.fechaInicio}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'facturacion' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 mb-4">Facturas Asociadas</h3>
                {invoices.length === 0 ? (
                  <p className="text-slate-400 font-medium">No hay facturas asociadas a este proyecto.</p>
                ) : (
                  <div className="space-y-3">
                    {invoices.map(invoice => (
                      <div key={invoice.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="font-bold text-indigo-700">Factura: {invoice.invoiceNumber || invoice.id}</p>
                          <p className="text-xs text-slate-500 mt-1">Fecha: {invoice.issueDate}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{invoice.currency} {invoice.totalAmount}</p>
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-md uppercase mt-1 inline-block">{invoice.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'materiales' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 mb-4">Solicitudes de Materiales</h3>
                {materialRequests.length === 0 ? (
                  <p className="text-slate-400 font-medium">No hay solicitudes de materiales asociadas a este proyecto.</p>
                ) : (
                  <div className="space-y-4">
                    {materialRequests.map(req => (
                      <div key={req.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                              <p className="font-bold text-blue-700">Solicitud {req.requestNumber || req.id}</p>
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider">{req.origin}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                              <div className="flex items-center gap-1.5"><FiCalendar /> {req.date}</div>
                              <div className="flex items-center gap-1.5"><FiUser /> {req.requestedByName}</div>
                              <div className="flex items-center gap-1.5"><FiPackage /> {req.items?.length || 0} materiales</div>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider ${
                            req.status === 'Pendiente' ? 'bg-amber-100 text-amber-700' :
                            req.status === 'Aprobada' ? 'bg-indigo-100 text-indigo-700' :
                            req.status === 'Parcial' ? 'bg-cyan-100 text-cyan-700' :
                            req.status === 'Despachada' ? 'bg-green-100 text-green-700' :
                            req.status === 'Rechazada' ? 'bg-red-100 text-red-700' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Secciones en desarrollo para demostrar arquitectura modular sin duplicar */}
            {!['resumen', 'trabajos', 'facturacion', 'materiales'].includes(activeTab) && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
                  <FiCheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-2">Gestión de {TABS.find(t => t.id === activeTab)?.label}</h3>
                <p className="text-slate-500 text-sm text-center max-w-md">
                  Esta sección consulta la información del módulo original de {TABS.find(t => t.id === activeTab)?.label} filtrando por el ID de este proyecto ({project.projectNumber || project.id}). 
                  <br /><br />
                  Los datos permanecen en sus respectivos módulos sin duplicarse.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectExpediente;
