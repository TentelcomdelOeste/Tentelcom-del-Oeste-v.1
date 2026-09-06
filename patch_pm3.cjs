const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

const regex = /<div\s+key={project\.id}.*?<div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-50\/30 rounded-full blur-2xl group-hover:bg-indigo-100\/40 transition-colors"><\/div>\s+<\/div>/gs;

const newCard = `
              <div
                key={project.id}
                onClick={() => { if (canAdmin) setCurrentProject(project); }}
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
                        onEdit={canAdmin ? () => handleEdit(project) : undefined}
                        onDelete={canAdmin ? () => setProjectToDelete(project) : undefined}
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
                      <div className={\`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider \${
                        project.status === 'Cerrado' ? 'bg-slate-100 text-slate-500' :
                        project.status === 'En Ejecución' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-blue-100 text-blue-700'
                      }\`}>
                        {project.status}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 flex items-center gap-1"><FiUser size={10} /> Creado por</div>
                      <div className="font-semibold text-slate-700 truncate">{project.createdByDisplayName || 'Sistema'}</div>
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
                  
                  {project.quoteId && (
                    <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ref. Cotización</div>
                      <div className="font-bold text-indigo-600 truncate">
                        {project.quoteId.length > 20 ? \`#\${project.quoteId.slice(-6)}\` : \`#\${project.quoteId}\`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <div className="flex items-center text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                        {canAdmin ? <><span className="mr-1">Ver Expediente</span> <FiChevronRight /></> : <span className="text-slate-400">Sin acceso al expediente</span>}
                    </div>
                </div>
              </div>
`;

data = data.replace(regex, newCard);
fs.writeFileSync(file, data);
