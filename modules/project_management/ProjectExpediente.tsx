import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiChevronDown, FiBriefcase, FiUsers, FiTruck, FiBox, FiDollarSign, FiFileText, FiCheckCircle, FiCalendar, FiUser, FiPackage, FiLayers } from 'react-icons/fi';
import { User } from '../../utils/types';
import { Project } from './types';
import { 
  subscribeToProjectJobs, 
  subscribeToProjectMaterialRequests, 
  subscribeToProjectVehicleRequests,
  subscribeToProjectVehicleConsumptions,
  subscribeToProjectInvoices, 
  subscribeToProjectPurchases 
} from './services/projectRelationsService';
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
  const [vehicleRequests, setVehicleRequests] = useState<any[]>([]);
  const [vehicleConsumptions, setVehicleConsumptions] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let loadedCount = 0;
    const TOTAL_SUBSCRIPTIONS = 6;

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
    }, project.projectNumber);

    const unsubVehicleRequests = subscribeToProjectVehicleRequests(project.id, (data) => {
      setVehicleRequests(data);
      checkLoaded();
    }, project.projectNumber);

    const unsubVehicleConsumptions = subscribeToProjectVehicleConsumptions(project.id, (data) => {
      setVehicleConsumptions(data);
      checkLoaded();
    }, project.projectNumber);

    const unsubPurchases = subscribeToProjectPurchases(project.id, (data) => {
      setPurchases(data);
      checkLoaded();
    });

    return () => {
      unsubJobs();
      unsubInvoices();
      unsubRequests();
      unsubVehicleRequests();
      unsubVehicleConsumptions();
      unsubPurchases();
    };
  }, [project.id, project.projectNumber]);

  // Extract unique elements
  const uniquePersonnel = Array.from(new Set(jobs.flatMap(j => j.empleados || []).map((e: any) => e.empleadoId)));
  const uniqueVehicles = Array.from(new Set(jobs.map(j => j.unidadId).filter(Boolean)));

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString.substring(0, 10);
      return d.toLocaleDateString('es-CR', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

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
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Solicitudes de Materiales</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Consolida las solicitudes tradicionales y de bodegas vehiculares vinculadas a este proyecto.
                    </p>
                  </div>
                  <span className="text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                    {materialRequests.length} {materialRequests.length === 1 ? 'solicitud' : 'solicitudes'}
                  </span>
                </div>

                {materialRequests.length === 0 ? (
                  <p className="text-slate-400 font-medium py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No hay solicitudes de materiales asociadas a este proyecto.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {materialRequests.map(req => (
                      <div key={req.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-slate-300 transition-colors">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                              <p className="font-bold text-blue-700">Solicitud {req.requestNumber || req.id}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                req.origin === 'Bodega Vehicular' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {req.origin || 'Despacho'}
                              </span>
                              {req.vehiculoAlias && (
                                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                                  {req.vehiculoAlias}
                                </span>
                              )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                              <div className="flex items-center gap-1.5"><FiCalendar /> {req.date || (req.createdAt ? req.createdAt.substring(0, 10) : 'N/A')}</div>
                              <div className="flex items-center gap-1.5"><FiUser /> {req.requestedByName || req.responsibleName || 'Responsable'}</div>
                              <div className="flex items-center gap-1.5"><FiPackage /> {req.items?.length || 0} materiales</div>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider ${
                            req.status === 'Pendiente' || req.status === 'Abierta' ? 'bg-amber-100 text-amber-700' :
                            req.status === 'Aprobada' ? 'bg-indigo-100 text-indigo-700' :
                            req.status === 'Parcial' ? 'bg-cyan-100 text-cyan-700' :
                            req.status === 'Despachada' || req.status === 'Cerrada' ? 'bg-green-100 text-green-700' :
                            req.status === 'Rechazada' || req.status === 'Cancelada' ? 'bg-red-100 text-red-700' :
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

            {activeTab === 'bodegas' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Bodegas Vehiculares — Solicitudes</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Solicitudes de materiales realizadas desde las bodegas móviles asignadas a este proyecto.
                    </p>
                  </div>
                  <span className="text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg">
                    {vehicleRequests.length} {vehicleRequests.length === 1 ? 'solicitud vehicular' : 'solicitudes vehiculares'}
                  </span>
                </div>

                {vehicleRequests.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FiTruck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 font-bold text-sm">No hay solicitudes de bodegas vehiculares para este proyecto.</p>
                    <p className="text-slate-400 text-xs mt-1">Las solicitudes creadas desde el módulo de Bodegas Vehiculares con este proyecto se sincronizarán en tiempo real.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vehicleRequests.map(req => (
                      <div key={req.id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200/70 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-black text-indigo-700">
                              {req.requestNumber || req.id}
                            </span>
                            <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                              <FiTruck className="w-3.5 h-3.5" />
                              {req.vehiculoAlias || req.vehiculoPlaca || req.vehiculoId || 'Vehículo'}
                            </span>
                          </div>
                          <div>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider ${
                              req.status === 'Abierta' ? 'bg-amber-100 text-amber-800' :
                              req.status === 'Cerrada' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <FiCalendar className="text-slate-400" />
                            <span className="font-bold text-slate-400">Fecha:</span>
                            <span className="font-medium text-slate-700">{formatDate(req.openedAt || req.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FiUser className="text-slate-400" />
                            <span className="font-bold text-slate-400">Responsable:</span>
                            <span className="font-medium text-slate-700">{req.responsibleName || req.createdBy || 'N/A'}</span>
                          </div>
                          {req.closedAt && (
                            <div className="flex items-center gap-1.5">
                              <FiCheckCircle className="text-emerald-500" />
                              <span className="font-bold text-slate-400">Cierre:</span>
                              <span className="font-medium text-slate-700">{formatDate(req.closedAt)}</span>
                            </div>
                          )}
                        </div>

                        {req.observations && (
                          <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/60 text-xs text-slate-600">
                            <span className="font-bold text-slate-500">Observaciones: </span>
                            {req.observations}
                          </div>
                        )}

                        {/* Materiales Solicitados */}
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="bg-slate-100/70 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center text-[11px] font-black text-slate-600 uppercase tracking-wider">
                            <span>Materiales Solicitados ({req.items?.length || 0})</span>
                            <span>Cant. Comprometida</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {(req.items || []).map((item: any, idx: number) => (
                              <div key={idx} className="px-3 py-2 flex justify-between items-center text-xs">
                                <div>
                                  <span className="font-mono font-bold text-indigo-600 mr-2">{item.code}</span>
                                  <span className="font-medium text-slate-800">{item.description}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-black text-slate-800">{item.quantityCommitted ?? item.quantity ?? 0}</span>
                                  <span className="text-slate-400 font-bold ml-1 text-[11px]">{item.unit}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'consumos' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Consumos y Cierres de Materiales</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Registro de materiales consumidos y sobrantes liquidados desde las bodegas vehiculares para este proyecto.
                    </p>
                  </div>
                  <span className="text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    {vehicleConsumptions.length} {vehicleConsumptions.length === 1 ? 'cierre registrado' : 'cierres registrados'}
                  </span>
                </div>

                {vehicleConsumptions.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FiLayers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 font-bold text-sm">No hay consumos liquidados aún para este proyecto.</p>
                    <p className="text-slate-400 text-xs mt-1">Al cerrar solicitudes en Bodegas Vehiculares, los consumos y sobrantes reales aparecerán aquí automáticamente.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vehicleConsumptions.map(consumption => (
                      <div key={consumption.id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200/70 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-black text-emerald-700">
                              Cierre Solicitud: {consumption.requestNumber || consumption.requestId || consumption.id}
                            </span>
                            <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                              <FiTruck className="w-3.5 h-3.5" />
                              {consumption.vehiculoAlias || 'Vehículo'}
                            </span>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
                              Total Consumido: {consumption.totalItemsConsumed ?? 0} unidades
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <FiCalendar className="text-slate-400" />
                            <span className="font-bold text-slate-400">Fecha Cierre:</span>
                            <span className="font-medium text-slate-700">{formatDate(consumption.closedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FiUser className="text-slate-400" />
                            <span className="font-bold text-slate-400">Responsable:</span>
                            <span className="font-medium text-slate-700">{consumption.responsibleName || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FiBriefcase className="text-slate-400" />
                            <span className="font-bold text-slate-400">Proyecto:</span>
                            <span className="font-medium text-slate-700">{consumption.projectCode || project.projectNumber || project.name}</span>
                          </div>
                        </div>

                        {/* Tabla de Materiales Consumidos y Sobrantes */}
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                <tr>
                                  <th className="px-3 py-2">Código</th>
                                  <th className="px-3 py-2">Descripción</th>
                                  <th className="px-3 py-2 text-center">Unidad</th>
                                  <th className="px-3 py-2 text-right">Comprometido</th>
                                  <th className="px-3 py-2 text-right text-emerald-700 font-black">Consumido</th>
                                  <th className="px-3 py-2 text-right text-amber-700 font-black">Sobrante</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(consumption.items || []).map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2 font-mono font-bold text-indigo-600">{item.code}</td>
                                    <td className="px-3 py-2 font-medium text-slate-800">{item.description}</td>
                                    <td className="px-3 py-2 text-center text-slate-500 font-bold">{item.unit}</td>
                                    <td className="px-3 py-2 text-right font-medium text-slate-600">{item.committed ?? 0}</td>
                                    <td className="px-3 py-2 text-right font-black text-emerald-700 bg-emerald-50/30">{item.consumed ?? 0}</td>
                                    <td className="px-3 py-2 text-right font-black text-amber-700 bg-amber-50/30">
                                      {item.surplus !== undefined ? item.surplus : ((item.committed ?? 0) - (item.consumed ?? 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Secciones en desarrollo para demostrar arquitectura modular sin duplicar */}
            {!['resumen', 'trabajos', 'facturacion', 'materiales', 'bodegas', 'consumos'].includes(activeTab) && (
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

