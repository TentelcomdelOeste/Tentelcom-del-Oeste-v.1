const fs = require('fs');
const file = 'modules/project_management/types/index.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  "quoteId?: string;",
  "quoteId?: string;\n  quoteCommercialId?: string;"
);
fs.writeFileSync(file, data);

const file2 = 'modules/project_management/components/ProjectFormModal.tsx';
let data2 = fs.readFileSync(file2, 'utf8');
data2 = data2.replace(
  "quoteId: quoteIdToSave,",
  "quoteId: quoteIdToSave,\n        quoteCommercialId: originSelection === 'quote' ? findSelectedQuote(selectedQuoteId)?.id?.toString() : undefined,"
);
fs.writeFileSync(file2, data2);
