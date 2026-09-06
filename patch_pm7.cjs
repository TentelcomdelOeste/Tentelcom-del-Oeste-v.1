const fs = require('fs');
const file = 'modules/project_management/ProjectManagementModule.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "{project.quoteId.length > 20 ? `#${project.quoteId.slice(-6)}` : `#${project.quoteId}`}",
  "{project.quoteCommercialId ? `#${String(project.quoteCommercialId).padStart(3, '0')}` : (project.quoteId.length > 20 ? `#${project.quoteId.slice(-6)}` : `#${project.quoteId}`)}"
);
fs.writeFileSync(file, data);

const file2 = 'modules/project_management/ProjectExpediente.tsx';
let data2 = fs.readFileSync(file2, 'utf8');
data2 = data2.replace(
  "{(project.origin === \"Cotización\" && project.quoteId) ? (project.quoteId.length > 20 ? `#${project.quoteId.slice(-6)}` : `#${project.quoteId}`) : \"N/A\"}",
  "{(project.origin === \"Cotización\" && project.quoteId) ? (project.quoteCommercialId ? `#${String(project.quoteCommercialId).padStart(3, '0')}` : (project.quoteId.length > 20 ? `#${project.quoteId.slice(-6)}` : `#${project.quoteId}`)) : \"N/A\"}"
);
fs.writeFileSync(file2, data2);
