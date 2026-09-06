import React, { useState, useEffect } from 'react';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { ActionButton, SearchInput, ConfirmModal } from '../../design-system';
import { ActionButtons } from '../../components/ui/ActionButtons';
import { User } from '../../utils/types';
import { can, isAdmin } from '../../utils/permissions';
import { Project } from './types';
import { ProjectFormModal } from './components/ProjectFormModal';
import { getProjects, deleteProject } from './services/projectService';
import ProjectExpediente from './ProjectExpediente';
import { FiUser, FiBriefcase, FiCalendar } from 'react-icons/fi';

interface ProjectManagementModuleProps {
  currentUser: User;
  selectedId?: string;
  onClearSelectedId?: () => void;
}

const ProjectManagementModule: React.FC<ProjectManagementModuleProps> = ({ currentUser, selectedId, onClearSelectedId }) => {
  const [showModal, setShowModal] = useState(false);

  const canViewExpediente = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.ver_expediente');
  const canCreate = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.crear');
  const canEdit = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.editar');
  const canDelete = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.eliminar');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedId && projects.length > 0) {
      const p = projects.find(x => x.id === selectedId || x.projectNumber === selectedId);
      if (p) setCurrentProject(p);
    }
  }, [selectedId, projects]);

  const loadProjects = async () => {
    setLoading(true);
    const data = await getProjects();
    setProjects(data);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
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

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.projectNumber.toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName || '').toLowerCase().includes(search.toLowerCase())
  );

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
        <ModuleToolbar className="sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <SearchInput 
               value={search} 
               onChange={(e) => setSearch(e.target.value)} 
               placeholder="Buscar por nombre, número o cliente..." 
               className="w-full" 
             />
          </div>
          {canCreate && (
            <ActionButton 
               onClick={() => {
                setProjectToEdit(null);
                setShowModal(true);
              }} 
               label="NUEVO PROYECTO" 
               variant="primary"
               className="w-full sm:w-auto shrink-0 whitespace-nowrap" 
            />
          )}
        </ModuleToolbar>

        <div className="flex-1 overflow-auto py-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">No se encontraron proyectos activos en el sistema.</div>
        ) : (
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
