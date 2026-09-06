const fs = require('fs');
const file = 'modules/project_management/components/ProjectFormModal.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "currentUser?.name || 'Sistema'",
  "currentUser?.name || currentUser?.displayName || currentUser?.email || 'Usuario'"
);

fs.writeFileSync(file, data);

const file2 = 'modules/project_management/ProjectExpediente.tsx';
let data2 = fs.readFileSync(file2, 'utf8');
data2 = data2.replace(
  "{project.createdByDisplayName || 'Sistema'}",
  "{project.createdByDisplayName || 'Usuario'}"
);
// Also fix quote ID display logic
data2 = data2.replace(
  "{(project.origin === \"Cotización\" && project.quoteId) ? `#${project.quoteId}` : \"N/A\"}",
  "{(project.origin === \"Cotización\" && project.quoteId) ? (project.quoteId.length > 20 ? `#${project.quoteId.slice(-6)}` : `#${project.quoteId}`) : \"N/A\"}"
);

// Fix client name
data2 = data2.replace(
  "{project.clientName || project.clientId || 'N/A'}",
  "{project.clientName || 'N/A'}"
);
fs.writeFileSync(file2, data2);
