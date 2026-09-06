const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "{project.createdByDisplayName || 'Sistema'}",
  "{project.createdByDisplayName || 'Usuario'}"
);
fs.writeFileSync(file, data);
