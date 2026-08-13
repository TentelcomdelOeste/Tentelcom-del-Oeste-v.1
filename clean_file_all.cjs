const fs = require('fs');
let content = fs.readFileSync('modules/job_scheduling/jobService.ts', 'utf8');

const regexGenerate = /export const generateOTCode = async \([\s\S]*?\}\s*catch \([\s\S]*?\}\s*\n\};\n\n/g;
let matchesGenerate = content.match(regexGenerate) || [];

// Oh no, the previous replacements mangled the file structure! Let's do this more cleanly.

// Reset file from git and apply patches carefully
