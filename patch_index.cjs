const fs = require('fs');
const file = '/app/applet/core/search/index.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('CashflowSearchPlugin')) {
  content = content.replace(
    /import { VehicleLogSearchPlugin } from '\.\/plugins\/VehicleLogSearchPlugin';/,
    `import { VehicleLogSearchPlugin } from './plugins/VehicleLogSearchPlugin';\nimport { CashflowSearchPlugin } from './plugins/CashflowSearchPlugin';\nimport { MaterialRequestSearchPlugin } from './plugins/MaterialRequestSearchPlugin';`
  );
  
  content = content.replace(
    /export const vehicleLogSearchPlugin = new VehicleLogSearchPlugin\(\);/,
    `export const vehicleLogSearchPlugin = new VehicleLogSearchPlugin();\nexport const cashflowSearchPlugin = new CashflowSearchPlugin();\nexport const materialRequestSearchPlugin = new MaterialRequestSearchPlugin();`
  );
  
  content = content.replace(
    /globalSearchEngine\.registerPlugin\(vehicleLogSearchPlugin\);/,
    `globalSearchEngine.registerPlugin(vehicleLogSearchPlugin);\nglobalSearchEngine.registerPlugin(cashflowSearchPlugin);\nglobalSearchEngine.registerPlugin(materialRequestSearchPlugin);`
  );
  
  fs.writeFileSync(file, content);
}
