const fs = require('fs');
const file = '/app/applet/modules/vehicles/VehicleLogs.tsx';
let content = fs.readFileSync(file, 'utf8');

const importStatement = `import { globalSearchEngine, vehicleLogSearchPlugin } from '../../core/search';\n`;
if (!content.includes('globalSearchEngine')) {
  content = content.replace(/(import .* from "\.\.\/\.\.\/types\/vehicle\.types";)/, `$1\n${importStatement}`);
}

const searchLogic = `
        // Detectar cambios incrementales (especialmente eliminaciones físicas)
        try {
          for (const change of snapshot.docChanges()) {
            if (change.type === "removed") {
              await localDocStore.removeLocalDoc("bitacora_vehiculos", change.doc.id);
              globalSearchEngine.removeDocument(\`vehicleLog_\${change.doc.id}\`);
            } else {
              const data = change.doc.data();
              const log = { ...data, id: change.doc.id } as VehicleLog;
              if (!log.isDeleted) {
                globalSearchEngine.upsertDocument(vehicleLogSearchPlugin.mapToSearchableItem(log));
              } else {
                globalSearchEngine.removeDocument(\`vehicleLog_\${change.doc.id}\`);
              }
            }
          }
        } catch(searchErr) {
          console.warn("[GlobalSearchEngine] Error en vehicles:", searchErr);
        }
`;

content = content.replace(
  /\/\/ Detectar cambios incrementales[\s\S]*?for \(const change of snapshot\.docChanges\(\)\) {[\s\S]*?await localDocStore\.removeLocalDoc\("bitacora_vehiculos", change\.doc\.id\);\n          }\n        }/,
  searchLogic
);

fs.writeFileSync(file, content);
