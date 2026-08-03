const fs = require('fs');
const file = '/app/applet/modules/job_scheduling/jobService.ts';
let content = fs.readFileSync(file, 'utf8');

const importStatement = `import { globalSearchEngine, jobSearchPlugin } from '../../core/search';\n`;
if (!content.includes('globalSearchEngine')) {
  content = content.replace(/(import .* from "\.\.\/\.\.\/core\/versionControl";)/, `$1\n${importStatement}`);
}

const searchLogic = `
    try {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          globalSearchEngine.removeDocument(\`job_\${change.doc.id}\`);
        } else {
          const job = mapDocToTrabajo(change.doc);
          globalSearchEngine.upsertDocument(jobSearchPlugin.mapToSearchableItem(job));
        }
      });
    } catch (e) {
       console.warn("[GlobalSearchEngine] Error en jobs:", e);
    }
`;

content = content.replace(
  /const serverTrabajos = snapshot\.docs\.map\(mapDocToTrabajo\);/,
  `${searchLogic}\n    const serverTrabajos = snapshot.docs.map(mapDocToTrabajo);`
);

fs.writeFileSync(file, content);
