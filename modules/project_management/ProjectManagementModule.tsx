import React, { useState, useEffect } from 'react';
import { FiChevronRight } from 'react-icons/fi';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { ActionButton, SearchInput } from '../../design-system';
import { User } from '../../utils/types';
import { Project } from './types';
import { ProjectFormModal } from './components/ProjectFormModal';
import { getProjects } from './services/projectService';
import ProjectExpediente from './ProjectExpediente';

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

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedId && projects.length > 0) {
      const p = projects.find(x => x.id === selectedId);
      if (p) setCurrentProject(p);
    }
  }, [selectedId, projects]);

  const loadProjects = async () => {
    setLoading(true);
    const data = await getProjects();
    setProjects(data);
    setLoading(false);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.id.toLowerCase().includes(search.toLowerCase())
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
          <ActionButton onClick={() => setShowModal(true)} label="NUEVO PROYECTO" />
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
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">
                    {project.id}
                  </div>
                  <div className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md uppercase">
                    {project.status}
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 mb-1 line-clamp-2">{project.name}</h3>
                {project.quoteId && (
                  <p className="text-xs text-slate-500 mb-3 font-medium">Cotización: {project.quoteId}</p>
                )}
                <div className="flex justify-between items-center mt-4">
                  <span className="text-xs text-slate-400 font-medium">
                    {project.startDate ? `Inicio: ${project.startDate}` : 'Sin fecha inicio'}
                  </span>
                  <FiChevronRight className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </ModulePage>
      <ProjectFormModal 
        show={showModal}
        onClose={() => setShowModal(false)}
        onSave={(p) => {
          setProjects([p, ...projects]);
          setCurrentProject(p);
        }}
        currentUser={currentUser}
      />
    </div>
  );
};

export default ProjectManagementModule;
