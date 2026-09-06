const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace('isOpen={!!projectToDelete}', 'show={!!projectToDelete}');
data = data.replace('message={', 'description={');

fs.writeFileSync(file, data);
