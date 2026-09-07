import React, { useState, useEffect, useMemo } from 'react';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { ActionButton, SearchInput, ConfirmModal, StatusBadge } from '../../design-system';
import { ActionButtons } from '../../components/ui/ActionButtons';
import { User } from '../../utils/types';
import { can, isAdmin } from '../../utils/permissions';
import { Project } from './types';
import { ProjectFormModal } from './components/ProjectFormModal';
import { 
  deleteProject, 
  subscribeToProjects, 
  searchProjectsInFirestore, 
  getProjectById, 
  getProjectByQuoteId,
  parseCreatedAtDate
} from './services/projectService';
import ProjectExpediente from './ProjectExpediente';
import { FiUser, FiBriefcase, FiCalendar } from 'react-icons/fi';

interface ProjectManagementModuleProps {
  currentUser: User;
  selectedId?: string;
  onClearSelectedId?: () => void;
}

const PAGE_SIZE = 60;

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const now = new Date();
const defaultYear = now.getFullYear().toString();
const defaultMonth = (now.getMonth() + 1).toString().padStart(2, '0');

const ProjectManagementModule: React.FC<ProjectManagementModuleProps> = ({ currentUser, selectedId, onClearSelectedId }) => {
  const [showModal, setShowModal] = useState(false);

  const canViewExpediente = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.ver_expediente');
  const canCreate = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.crear');
  const canEdit = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.editar');
  const canDelete = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.eliminar');

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentLimit, setCurrentLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [searchExtraProjects, setSearchExtraProjects] = useState<Project[]>([]);
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Lista de años disponibles basados en rango válido a partir de 2026
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    const baseYear = 2026;
    const currentYear = new Date().getFullYear();

    yearsSet.add(baseYear);
    if (currentYear >= baseYear) {
      yearsSet.add(currentYear);
    }

    projects.forEach(p => {
      const d = parseCreatedAtDate(p.createdAt);
      if (d && !isNaN(d.getFullYear()) && d.getFullYear() >= baseYear) {
        yearsSet.add(d.getFullYear());
      }
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [projects]);

  // 1. Suscripción en tiempo real paginada y filtrada por Año/Mes en Firestore
  useEffect(() => {
    if (currentLimit === PAGE_SIZE) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const unsubscribe = subscribeToProjects(
      (data, more) => {
        setProjects(data);
        setHasMore(more);
        setLoading(false);
        setLoadingMore(false);
      },
      currentLimit,
      { year: selectedYear, month: selectedMonth }
    );

    return () => unsubscribe();
  }, [currentLimit, selectedYear, selectedMonth]);

  // 2. Búsqueda asistida en Firestore con debounce que respeta filtros de fecha
  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setSearchExtraProjects([]);
      setIsSearchingFirestore(false);
      return;
    }

    setIsSearchingFirestore(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchProjectsInFirestore(term, { year: selectedYear, month: selectedMonth });
        setSearchExtraProjects(results);
      } catch (err) {
        console.error("Error searching projects in Firestore:", err);
      } finally {
        setIsSearchingFirestore(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, selectedYear, selectedMonth]);

  // 3. Selección directa por ID o número de proyecto (ej. desde notificaciones/enlaces)
  useEffect(() => {
    if (!selectedId) return;

    const allCurrent = [...projects, ...searchExtraProjects];
    const found = allCurrent.find(x => x.id === selectedId || x.projectNumber === selectedId);
    if (found) {
      setCurrentProject(found);
    } else {
      getProjectById(selectedId).then(p => {
        if (p) {
          setCurrentProject(p);
        } else {
          getProjectByQuoteId(selectedId).then(pQuote => {
            if (pQuote) setCurrentProject(pQuote);
          });
        }
      }).catch(console.error);
    }
  }, [selectedId, projects, searchExtraProjects]);

  const handleLoadMore = () => {
    if (loadingMore) return;
    setCurrentLimit(prev => prev + PAGE_SIZE);
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setSearchExtraProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (project: Project) => {
    setProjectToEdit(project);
    setShowModal(true);
  };

  // Combinar proyectos paginados en tiempo real y resultados extra de búsqueda deduplicando por ID
  const combinedMap = new Map<string, Project>();
  projects.forEach(p => combinedMap.set(p.id, p));
  searchExtraProjects.forEach(p => {
    if (!combinedMap.has(p.id)) {
      combinedMap.set(p.id, p);
    }
  });

  const allAvailable = Array.from(combinedMap.values());
  const searchTrim = search.trim().toLowerCase();
  const yearNum = selectedYear ? parseInt(selectedYear, 10) : NaN;
  const monthNum = selectedMonth ? parseInt(selectedMonth, 10) : NaN;

  const filteredProjects = allAvailable.filter(p => {
    // Coincidencia con término de búsqueda
    if (searchTrim) {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTrim) ||
        p.projectNumber.toLowerCase().includes(searchTrim) ||
        (p.clientName || '').toLowerCase().includes(searchTrim);
      if (!matchesSearch) return false;
    }

    // Coincidencia con filtros de Año y Mes
    if (!isNaN(yearNum) || !isNaN(monthNum)) {
      const d = parseCreatedAtDate(p.createdAt);
      if (!d || isNaN(d.getTime())) return false;
      if (!isNaN(yearNum) && d.getFullYear() !== yearNum) return false;
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 && d.getMonth() + 1 !== monthNum) return false;
    }

    return true;
  });

  if (currentProject) {
    return (
      <ProjectExpediente 
        project={currentProject} 
        onBack={() => {
          setCurrentProject(null);
          if (onClearSelectedId) onClearSelectedId();
        }}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage title="Gestión de Proyectos" subtitle="Expediente 360°">
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
                value={selectedYear} 
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentLimit(PAGE_SIZE);
                }} 
                className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none w-full md:w-auto cursor-pointer"
              >
                <option value="">Todos los años</option>
                {availableYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <select 
                value={selectedMonth} 
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentLimit(PAGE_SIZE);
                }} 
                className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none w-full md:w-auto cursor-pointer"
              >
                <option value="all">Todo el Año</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <div className="w-full md:w-72 relative">
            <SearchInput 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Buscar por nombre, número o cliente..." 
              className="w-full" 
            />
            {isSearchingFirestore && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              </div>
            )}
          </div>
        </div>
        {canCreate && (
          <ActionButton 
            onClick={() => { 
              setProjectToEdit(null); 
              setShowModal(true); 
            }} 
            label="NUEVO" 
            variant="primary"
          />
        )}
      </ModuleToolbar>

        <div className="flex-1 overflow-auto py-2">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center text-slate-500 mt-10 py-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
            No se encontraron proyectos con los criterios de búsqueda o filtros seleccionados.
          </div>
        ) : (
          <>
            {/* Vista Escritorio: Tabla alineada con el patrón visual de Cotizaciones */}
            <div className="hidden md:block">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-30 rounded-t-2xl relative shadow-xs isolate before:content-[''] before:absolute before:-top-6 before:-left-px before:-right-px before:h-6 before:bg-slate-50 before:z-30 before:pointer-events-none">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[130px] shrink-0">
                    <span className="w-full text-center truncate">N°</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center px-3 border-r border-slate-200/70 flex-1 min-w-[220px]">
                    <span className="w-full text-left truncate">Proyecto</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center px-3 border-r border-slate-200/70 w-[200px] shrink-0">
                    <span className="w-full text-left truncate">Cliente / Empresa</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center px-3 border-r border-slate-200/70 w-[150px] shrink-0">
                    <span className="w-full text-left truncate">Creado por</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[110px] shrink-0">
                    <span className="w-full text-center truncate">Fecha</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 border-r border-slate-200/70 w-[130px] shrink-0">
                    <span className="w-full text-center truncate">Estado</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 h-12 flex items-center justify-center px-3 w-[110px] shrink-0">
                    <span className="w-full text-center truncate">Acciones</span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 relative z-0 rounded-b-2xl overflow-hidden">
                  {filteredProjects.map((project, index) => {
                    const isHighlighted = selectedId && (project.id === selectedId || project.projectNumber === selectedId);
                    const isEven = index % 2 === 0;
                    const projectDate = project.startDate || (project.createdAt ? (() => {
                      const d = parseCreatedAtDate(project.createdAt);
                      return d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-CR') : 'N/A';
                    })() : 'N/A');

                    return (
                      <div
                        key={project.id}
                        onClick={() => { if (canViewExpediente) setCurrentProject(project); }}
                        className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group cursor-pointer ${
                          isHighlighted
                            ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-200/50 z-10 relative animate-in fade-in duration-500'
                            : isEven ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                        style={{ minHeight: '60px' }}
                      >
                        {/* N° */}
                        <div className="text-xs font-bold text-center justify-center flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[130px] shrink-0">
                          <span className="font-black text-blue-950 text-[11px] whitespace-nowrap">
                            {project.projectNumber}
                          </span>
                        </div>

                        {/* Proyecto */}
                        <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 flex-1 min-w-[220px]">
                          <div className="flex flex-col truncate w-full">
                            <span className="font-black text-blue-900 text-xs truncate" title={project.name}>
                              {project.name}
                            </span>
                            {project.origin === 'Cotización' && project.quoteCommercialId && (
                              <span className="text-[10px] text-indigo-600 font-bold truncate opacity-80" title={`Origen: Cotización #${project.quoteCommercialId}`}>
                                Origen: Cotización #{project.quoteCommercialId}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Cliente / Empresa */}
                        <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[200px] shrink-0">
                          <div className="flex flex-col truncate w-full">
                            <span className="font-bold text-slate-700 text-xs truncate" title={project.clientName || 'Sin cliente asignado'}>
                              {project.clientName || 'Sin cliente asignado'}
                            </span>
                          </div>
                        </div>

                        {/* Creado por */}
                        <div className="text-xs font-bold text-left justify-start flex items-center text-blue-950 px-3 py-3 border-r border-slate-200/40 w-[150px] shrink-0">
                          <div className="flex items-center gap-1.5 truncate text-slate-600 w-full">
                            <FiUser className="text-slate-400 text-xs shrink-0" />
                            <span className="font-bold text-[11px] text-slate-600 truncate" title={project.createdByDisplayName || 'Usuario'}>
                              {project.createdByDisplayName || 'Usuario'}
                            </span>
                          </div>
                        </div>

                        {/* Fecha */}
                        <div className="text-xs font-bold text-center justify-center font-mono text-slate-500 text-[11px] flex items-center px-3 py-3 border-r border-slate-200/40 w-[110px] shrink-0">
                          <span className="font-mono font-bold text-slate-500 text-[11px] whitespace-nowrap">
                            {projectDate}
                          </span>
                        </div>

                        {/* Estado */}
                        <div className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 border-r border-slate-200/40 w-[130px] shrink-0">
                          <div className="flex items-center justify-center w-full">
                            <StatusBadge 
                              label={project.status} 
                              variant={
                                project.status === 'Cerrado' ? 'neutral' :
                                project.status === 'En Ejecución' ? 'success' :
                                'info'
                              } 
                            />
                          </div>
                        </div>

                        {/* Acciones */}
                        <div 
                          className="text-xs font-bold text-center justify-center flex items-center px-3 py-3 w-[110px] shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center items-center gap-2 w-full">
                            <ActionButtons 
                              onEdit={canEdit ? () => handleEdit(project) : undefined}
                              onDelete={canDelete ? () => setProjectToDelete(project) : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Vista Móvil: Tarjetas Móviles Intactas */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {filteredProjects.map(project => (
                <div
                  key={project.id}
                  onClick={() => { if (canViewExpediente) setCurrentProject(project); }}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow relative flex flex-col cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-50 text-indigo-700 w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                              <FiBriefcase size={20} />
                          </div>
                          <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Proyecto</div>
                              <div className="font-black text-indigo-700">{project.projectNumber}</div>
                          </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ActionButtons
                          onEdit={canEdit ? () => handleEdit(project) : undefined}
                          onDelete={canDelete ? () => setProjectToDelete(project) : undefined}
                        />
                      </div>
                  </div>
                  
                  {/* Body */}
                  <div className="flex-1">
                    <div className="mb-4">
                      <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2 mb-2">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          project.status === 'Cerrado' ? 'bg-slate-100 text-slate-500' :
                          project.status === 'En Ejecución' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {project.status}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1"><FiUser size={10} /> Creado por</div>
                        <div className="font-semibold text-slate-700 truncate">{project.createdByDisplayName || 'Usuario'}</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1"><FiCalendar size={10} /> Fecha</div>
                        <div className="font-semibold text-slate-700 truncate">{project.startDate || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Cliente / Empresa</div>
                      <div className="font-bold text-slate-700 truncate">{project.clientName || 'No especificado'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!search.trim() && hasMore && (
              <div className="flex justify-center mt-6">
                <ActionButton
                  onClick={handleLoadMore}
                  label={loadingMore ? "CARGANDO..." : "CARGAR MÁS PROYECTOS"}
                  variant="secondary"
                  disabled={loadingMore}
                  className="!w-auto px-6"
                />
              </div>
            )}
          </>
        )}
        </div>
      </ModulePage>
      <ProjectFormModal 
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setProjectToEdit(null);
        }}
        onSave={(p, unlinkedProjectId) => {
          setProjects(prev => {
            let list = prev;
            if (unlinkedProjectId) {
              list = list.map(item => {
                if (item.id === unlinkedProjectId) {
                  const copy = { ...item, origin: 'Manual' as const };
                  delete copy.quoteId;
                  delete copy.quoteCommercialId;
                  return copy;
                }
                return item;
              });
            }
            const exists = list.some(x => x.id === p.id);
            if (exists) {
              return list.map(x => x.id === p.id ? p : x);
            } else {
              return [p, ...list];
            }
          });
          if (!projectToEdit) {
            setCurrentProject(p);
          }
        }}
        currentUser={currentUser}
        initialData={projectToEdit}
      />

      {projectToDelete && (
        <ConfirmModal 
          show={!!projectToDelete}
          onClose={() => setProjectToDelete(null)}
          onConfirm={handleDelete}
          title="¿Eliminar Proyecto?"
          description={
            <div className="space-y-3">
              <p>¿Está seguro de eliminar físicamente el proyecto de la base de datos?</p>
              <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                <p className="text-xs font-black text-red-800 uppercase mb-1">Datos del Registro:</p>
                <p className="text-sm font-bold text-red-700">{projectToDelete.projectNumber} — {projectToDelete.name}</p>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                Esta acción es irreversible. El número de proyecto <strong>{projectToDelete.projectNumber}</strong> quedará liberado para ser reutilizado en futuros registros. Los datos vinculados en otros módulos (cotizaciones, trabajos, etc.) NO serán eliminados.
              </p>
            </div>
          }
          confirmLabel="ELIMINAR"
          variant="danger"
          isLoading={deleting}
        />
      )}
    </div>
  );
};

export default ProjectManagementModule;
