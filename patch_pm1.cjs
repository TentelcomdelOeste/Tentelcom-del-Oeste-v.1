const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

// Update permissions checking
data = data.replace(
  "const canAdmin = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.administrar');\n  const canCreate = canAdmin || can(currentUser, 'gestion_proyectos.crear');",
  "const canViewExpediente = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.ver_expediente');\n  const canCreate = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.crear');\n  const canEdit = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.editar');\n  const canDelete = isAdmin(currentUser?.role) || can(currentUser, 'gestion_proyectos.eliminar');"
);

// Toolbar layout (search bar and button in one row)
data = data.replace(
  `<ModuleToolbar>\n          <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">\n            <SearchInput \n               value={search} \n               onChange={(e) => setSearch(e.target.value)} \n               placeholder="Buscar por nombre, número o cliente..." \n               className="w-full md:w-72" \n             />\n          </div>\n          {canCreate && (\n          <ActionButton \n             onClick={() => {\n              setProjectToEdit(null);\n              setShowModal(true);\n            }} \n             label="NUEVO PROYECTO" \n           />\n          )}\n        </ModuleToolbar>`,
  `<ModuleToolbar>\n          <div className="flex flex-col md:flex-row gap-4 items-center w-full justify-between">\n            <div className="w-full md:w-auto flex-1">\n              <SearchInput \n                 value={search} \n                 onChange={(e) => setSearch(e.target.value)} \n                 placeholder="Buscar por nombre, número o cliente..." \n                 className="w-full md:max-w-md" \n               />\n            </div>\n            {canCreate && (\n            <div className="w-full md:w-auto shrink-0">\n              <ActionButton \n                 onClick={() => {\n                  setProjectToEdit(null);\n                  setShowModal(true);\n                }} \n                 label="NUEVO PROYECTO" \n               />\n            </div>\n            )}\n          </div>\n        </ModuleToolbar>`
);

// Card logic updates
data = data.replace(
  "onClick={() => { if (canAdmin) setCurrentProject(project); }}",
  "onClick={() => { if (canViewExpediente) setCurrentProject(project); }}"
);

data = data.replace(
  "onEdit={canAdmin ? () => handleEdit(project) : undefined}",
  "onEdit={canEdit ? () => handleEdit(project) : undefined}"
);

data = data.replace(
  "onDelete={canAdmin ? () => setProjectToDelete(project) : undefined}",
  "onDelete={canDelete ? () => setProjectToDelete(project) : undefined}"
);

// Remove Ref. Cotización block from the card
data = data.replace(
  `                  {project.quoteId && (\n                    <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">\n                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ref. Cotización</div>\n                      <div className="font-bold text-indigo-600 truncate">\n                        {project.quoteCommercialId ? \`#\${String(project.quoteCommercialId).padStart(3, '0')}\` : (project.quoteId.length > 20 ? \`#\${project.quoteId.slice(-6)}\` : \`#\${project.quoteId}\`)}\n                      </div>\n                    </div>\n                  )}`,
  ""
);

data = data.replace(
  "{canAdmin ? <><span className=\"mr-1\">Ver Expediente</span> <FiChevronRight /></> : <span className=\"text-slate-400\">Sin acceso al expediente</span>}",
  "{canViewExpediente ? <><span className=\"mr-1\">Ver Expediente</span> <FiChevronRight /></> : <span className=\"text-slate-400\">Sin acceso al expediente</span>}"
);

fs.writeFileSync(file, data);
