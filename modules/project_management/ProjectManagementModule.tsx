import React, { useState, useEffect } from 'react';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { ActionButton, SearchInput, IconButton, ConfirmModal } from '../../design-system';
import { User } from '../../utils/types';
import { Project } from './types';
import { ProjectFormModal } from './components/ProjectFormModal';
import { getProjects, deleteProject } from './services/projectService';
import ProjectExpediente from './ProjectExpediente';
import { FiChevronRight, FiEdit2, FiTrash2 } from 'react-icons/fi';

interface ProjectManagementModuleProps {
  currentUser: User;
  selectedId?: string;
  onClearSelectedId?: () => void;
}

const ProjectManagementModule: React.FC<ProjectManagementModuleProps> = ({ currentUser, selectedId, onClearSelectedId }) => {
  const [showModal, setShowModal] = useState(false);
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
      // Look for technical ID first, then projectNumber as fallback
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
      alert("No se pudo eliminar el proyecto.");
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
    p.projectNumber.toLowerCase().includes(search.toLowerCase())
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
        <ModuleToolbar>
          <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
            <SearchInput 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Buscar proyecto por nombre o ID..." 
              className="w-full md:w-72" 
            />
          </div>
          <ActionButton 
            onClick={() => {
              setProjectToEdit(null);
              setShowModal(true);
            }} 
            label="NUEVO PROYECTO" 
          />
        </ModuleToolbar>

        <div className="flex-1 overflow-auto py-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">No se encontraron proyectos.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <div 
                key={project.id} 
                onClick={() => setCurrentProject(project)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">
                    {project.projectNumber}
                  </div>
                  <div className="flex gap-1 items-center">
                    <IconButton 
                      icon={<FiEdit2 />} 
                      variant="primary" 
                      title="Editar" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(project);
                      }} 
                    />
                    <IconButton 
                      icon={<FiTrash2 />} 
                      variant="danger" 
                      title="Eliminar" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }} 
                    />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-800 line-clamp-2">{project.name}</h3>
                  </div>
                  <div className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded uppercase mb-2">
                    {project.status}
                  </div>
                  {project.quoteId && (
                    <p className="text-[11px] text-slate-500 mb-3 font-medium">Ref. Cotización: #{project.quoteId}</p>
                  )}
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {project.startDate ? `Inicio: ${project.startDate}` : 'Sin fecha inicio'}
                  </span>
                  <div className="flex items-center text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    EXPEDIENTE <FiChevronRight className="ml-1" />
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
        onSave={(p) => {
          if (projectToEdit) {
            setProjects(prev => prev.map(x => x.id === p.id ? p : x));
          } else {
            setProjects([p, ...projects]);
            setCurrentProject(p);
          }
        }}
        currentUser={currentUser}
        initialData={projectToEdit}
      />

      {projectToDelete && (
        <ConfirmModal 
          isOpen={!!projectToDelete}
          onClose={() => setProjectToDelete(null)}
          onConfirm={handleDelete}
          title="Eliminar Proyecto"
          message={`¿Está seguro que desea eliminar el proyecto "${projectToDelete.name}"? Esta acción retirará el proyecto de la lista activa y permitirá reutilizar el número ${projectToDelete.projectNumber}.`}
          confirmLabel="ELIMINAR"
          variant="danger"
          isLoading={deleting}
        />
      )}
    </div>
  );
};

export default ProjectManagementModule;
