const fs = require('fs');
const file = 'modules/project_management/components/ProjectFormModal.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "Cotización {findSelectedQuote(initialData.quoteId)?.id ? `#${String(findSelectedQuote(initialData.quoteId)?.id).padStart(3, '0')}` : `#${initialData.quoteId.slice(-6)}`}",
  "Cotización {initialData.quoteCommercialId ? `#${String(initialData.quoteCommercialId).padStart(3, '0')}` : (findSelectedQuote(initialData.quoteId)?.id ? `#${String(findSelectedQuote(initialData.quoteId)?.id).padStart(3, '0')}` : `#${initialData.quoteId.slice(-6)}`)}"
);

fs.writeFileSync(file, data);
