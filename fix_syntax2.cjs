const fs = require('fs');
let content = fs.readFileSync('modules/job_scheduling/jobService.ts', 'utf8');

const regex2 = /\}\);\n  \}\n\};\n\nexport const generateOTCode/g;
let matches2 = content.match(regex2) || [];
console.log("Found generateOTCode fixes needed:", matches2.length);

if (matches2.length > 1) {
    let replacedFirst = false;
    content = content.replace(regex2, (match) => {
        if (!replacedFirst) {
            replacedFirst = true;
            return match; // Keep the first one which is correct (or vice versa)
        }
        return ''; // Remove duplicates
    });
}
// Clean up all the duplicate generateOTCode blocks...

const regexGen1 = /export const generateOTCode = async \([\s\S]*?\}\n\};\n\nexport const getTrabajos = async/g;

fs.writeFileSync('modules/job_scheduling/jobService.ts', content);
