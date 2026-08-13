const fs = require('fs');
let content = fs.readFileSync('modules/job_scheduling/jobService.ts', 'utf8');

const regexUnlinked = /export const recordBitacoraUnlinkedEvent = async \([\s\S]*?\}\s*catch \([\s\S]*?\}\s*\n\};\n\n/g;
let matchesUnlinked = content.match(regexUnlinked) || [];

if (matchesUnlinked.length > 1) {
  const keep = matchesUnlinked[0];
  content = content.replace(regexUnlinked, '');
  content = content.replace('export const migrateTimeline =', keep + '\nexport const migrateTimeline =');
}

const regexLinked = /export const recordBitacoraLinkedEvent = async \([\s\S]*?\}\s*catch \([\s\S]*?\}\s*\n\};\n\n/g;
let matchesLinked = content.match(regexLinked) || [];

if (matchesLinked.length > 1) {
  const keep = matchesLinked[0];
  content = content.replace(regexLinked, '');
  content = content.replace('export const migrateTimeline =', keep + '\nexport const migrateTimeline =');
}

fs.writeFileSync('modules/job_scheduling/jobService.ts', content);
console.log("Cleaned jobService.ts");
