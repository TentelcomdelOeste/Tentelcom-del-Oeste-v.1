const fs = require('fs');
let file = fs.readFileSync('modules/job_scheduling/jobService.ts', 'utf8');
const counts = file.match(/export const recordBitacoraUnlinkedEvent/g) || [];
console.log("Count:", counts.length);
