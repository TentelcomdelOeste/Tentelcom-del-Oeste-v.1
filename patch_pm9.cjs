const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "import { hasPermission, isAdmin } from '../../utils/permissions';",
  "import { can, isAdmin } from '../../utils/permissions';"
);
data = data.replace(
  "hasPermission(currentUser, 'gestion_proyectos.administrar')",
  "can(currentUser, 'gestion_proyectos.administrar')"
);
data = data.replace(
  "hasPermission(currentUser, 'gestion_proyectos.crear')",
  "can(currentUser, 'gestion_proyectos.crear')"
);

fs.writeFileSync(file, data);
