const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "import { Project } from './types';",
  "import { hasPermission, isAdmin } from '../../utils/permissions';\nimport { Project } from './types';"
);

data = data.replace(
  "const [showModal, setShowModal] = useState(false);",
  "const [showModal, setShowModal] = useState(false);\n\n  const canAdmin = isAdmin(currentUser?.role) || hasPermission(currentUser, 'gestion_proyectos.administrar');\n  const canCreate = canAdmin || hasPermission(currentUser, 'gestion_proyectos.crear');"
);

data = data.replace(
  "<ActionButton \n            onClick={() => {\n              setProjectToEdit(null);\n              setShowModal(true);\n            }} \n            label=\"NUEVO PROYECTO\" \n          />",
  "{canCreate && (\n          <ActionButton \n            onClick={() => {\n              setProjectToEdit(null);\n              setShowModal(true);\n            }} \n            label=\"NUEVO PROYECTO\" \n          />\n          )}"
);

// Disable click on card if not admin
data = data.replace(
  "onClick={() => setCurrentProject(project)}",
  "onClick={() => { if (canAdmin) setCurrentProject(project); }}"
);

// Hide edit/delete if not admin
data = data.replace(
  "onEdit={() => handleEdit(project)}",
  "onEdit={canAdmin ? () => handleEdit(project) : undefined}"
);
data = data.replace(
  "onDelete={() => setProjectToDelete(project)}",
  "onDelete={canAdmin ? () => setProjectToDelete(project) : undefined}"
);

// Hide ver expediente button
data = data.replace(
  "Ver Expediente <FiChevronRight className=\"ml-0.5\" />",
  "{canAdmin ? <><span className=\"mr-1\">Ver Expediente</span> <FiChevronRight /></> : <span className=\"text-slate-400\">Sin acceso al expediente</span>}"
);

fs.writeFileSync(file, data);
