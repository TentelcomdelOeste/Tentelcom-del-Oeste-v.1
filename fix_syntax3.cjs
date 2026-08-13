const fs = require('fs');
let content = fs.readFileSync('modules/job_scheduling/jobService.ts', 'utf8');

const regex3 = /  \} catch \(e\) \{\n  \}\n\};\n\nexport const generateOTCode/g;
content = content.replace(/  \}\n\};\n\nexport const generateOTCode/g, '  } catch (err) {\n    console.error("Error creating bitacora_vinculada event:", err);\n  }\n};\n\nexport const generateOTCode');

fs.writeFileSync('modules/job_scheduling/jobService.ts', content);
