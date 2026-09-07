import React, { useState, useEffect, useMemo } from 'react';
import { ModulePage } from '../../components/ui/ModulePage';
import { ActionButton, SearchInput, ConfirmModal } from '../../design-system';
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
import { FiUser, FiBriefcase, FiCalendar, FiFilter } from 'react-icons/fi';

interface ProjectManagementModuleProps {
  currentUser: User;
  selectedId?: string;
  onClearSelectedId?: () => void;
}

const PAGE_SIZE = 60;

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
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [searchExtraProjects, setSearchExtraProjects] = useState<Project[]>([]);
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Lista de años disponibles basados en rango histórico (2020 a año actual + 1) y proyectos cargados
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    const currentYear = new Date().getFullYear();

    for (let y = currentYear + 1; y >= 2020; y--) {
      yearsSet.add(y);
    }

    projects.forEach(p => {
      const d = parseCreatedAtDate(p.createdAt);
      if (d && !isNaN(d.getFullYear())) {
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

  const isFilterActive = !!(selectedYear || selectedMonth || search);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <ModulePage title="Gestión de Proyectos" subtitle="Expediente 360°">
        {/* Barra superior de Búsqueda y Filtros */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 sm:gap-3 w-full mb-4">
          {/* Búsqueda */}
          <div className="flex-1 min-w-0 relative">
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

          {/* Filtros de Fecha (Año / Mes) y Acciones */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Filtro de Año */}
            <div className="relative flex items-center">
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentLimit(PAGE_SIZE);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm h-[38px] transition-all"
              >
                <option value="">Todos los años</option>
                {availableYears.map(yr => (
                  <option key={yr} value={String(yr)}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Filtro de Mes */}
            <div className="relative flex items-center">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentLimit(PAGE_SIZE);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm h-[38px] transition-all"
              >
                <option value="">Todos los meses</option>
                <option value="01">Enero</option>
                <option value="02">Febrero</option>
                <option value="03">Marzo</option>
                <option value="04">Abril</option>
                <option value="05">Mayo</option>
                <option value="06">Junio</option>
                <option value="07">Julio</option>
                <option value="08">Agosto</option>
                <option value="09">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
            </div>

            {/* Botón Limpiar Filtros */}
            {isFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear('');
                  setSelectedMonth('');
                  setSearch('');
                  setCurrentLimit(PAGE_SIZE);
                }}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors h-[38px] flex items-center gap-1"
                title="Limpiar filtros"
              >
                <FiFilter size={12} />
                <span>Limpiar</span>
              </button>
            )}

            {canCreate && (
              <ActionButton 
                onClick={() => {
                  setProjectToEdit(null);
                  setShowModal(true);
                }} 
                label="NUEVO" 
                variant="primary"
                className="!w-auto shrink-0 whitespace-nowrap px-4 sm:px-6 h-[38px]" 
              />
            )}
          </div>
        </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <div>
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
