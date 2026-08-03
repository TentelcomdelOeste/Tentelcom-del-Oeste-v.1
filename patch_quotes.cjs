const fs = require('fs');
const file = '/app/applet/hooks/useQuotes.ts';
let content = fs.readFileSync(file, 'utf8');

const importStatement = `import { globalSearchEngine, quoteSearchPlugin } from '../core/search';\n`;
if (!content.includes('globalSearchEngine')) {
  content = content.replace(/(import .* from '..\/contexts\/UserContext';)/, `$1\n${importStatement}`);
}

const searchLogic = `
          try {
            for (const change of snapshot.docChanges()) {
              if (change.type === "removed") {
                await localDocStore.removeLocalDoc("quotes", change.doc.id);
                globalSearchEngine.removeDocument(\`quote_\${change.doc.id}\`);
              } else {
                const data = change.doc.data() || {};
                const quote = {
                  ...data,
                  docId: change.doc.id,
                  monto: Number(data.monto || 0),
                  estado: String(data.estado || 'Pendiente'),
                  status: String(data.estado || 'Pendiente'),
                  fecha: String(data.fecha || new Date().toISOString())
                } as Quote;
                globalSearchEngine.upsertDocument(quoteSearchPlugin.mapToSearchableItem(quote));
              }
            }
          } catch (searchError) {
             console.warn("[GlobalSearchEngine] Error en quotes:", searchError);
          }
`;

content = content.replace(
  /for \(const change of snapshot.docChanges\(\)\) {[\s\S]*?}/,
  searchLogic
);

fs.writeFileSync(file, content);
