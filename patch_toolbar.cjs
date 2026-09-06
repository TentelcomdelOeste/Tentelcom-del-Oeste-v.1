const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

const regexToolbar = /<ModuleToolbar>.*?<\/ModuleToolbar>/s;
const newToolbar = `<ModuleToolbar>
          <div className="flex flex-col md:flex-row gap-4 items-center w-full justify-between">
            <div className="w-full md:w-auto flex-1">
              <SearchInput 
                 value={search} 
                 onChange={(e) => setSearch(e.target.value)} 
                 placeholder="Buscar por nombre, número o cliente..." 
                 className="w-full md:max-w-md" 
               />
            </div>
            {canCreate && (
            <div className="w-full md:w-auto shrink-0">
              <ActionButton 
                 onClick={() => {
                  setProjectToEdit(null);
                  setShowModal(true);
                }} 
                 label="NUEVO PROYECTO" 
               />
            </div>
            )}
          </div>
        </ModuleToolbar>`;

data = data.replace(regexToolbar, newToolbar);
fs.writeFileSync(file, data);
