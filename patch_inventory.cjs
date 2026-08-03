const fs = require('fs');
const file = '/app/applet/hooks/useInventory.ts';
let content = fs.readFileSync(file, 'utf8');

const importStatement = `import { globalSearchEngine, inventorySearchPlugin } from '../core/search';\n`;
if (!content.includes('globalSearchEngine')) {
  content = content.replace(/(import .* from '..\/contexts\/UserContext';)/, `$1\n${importStatement}`);
}

const searchLogic = `
        // Feed Global Search Engine Incrementally
        try {
          snapshot.docChanges().forEach(change => {
            const data = change.doc.data() || {};
            const item = {
              ...data,
              id: change.doc.id,
              code: String(data.code || ""),
              description: String(data.description || "Sin descripción"),
              price: Number(data.price || 0),
              stock: Number(data.stock || 0),
              reserved: Number(data.reserved || 0),
            } as InventoryItem;
            
            if (change.type === 'removed') {
               globalSearchEngine.removeDocument(\`inventory_\${item.id}\`);
            } else {
               globalSearchEngine.upsertDocument(inventorySearchPlugin.mapToSearchableItem(item));
            }
          });
        } catch (searchError) {
          console.warn("[GlobalSearchEngine] Error alimentando índice inventario:", searchError);
        }
`;

content = content.replace(/(await updateHybridItems\(safeItems\);)/, `$1\n${searchLogic}`);
fs.writeFileSync(file, content);
