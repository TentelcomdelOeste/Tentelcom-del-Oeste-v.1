const fs = require('fs');
const file = 'modules/vehicles/VehicleLogModal.tsx';
let data = fs.readFileSync(file, 'utf8');

// Replace standard
data = data.replace(/className="w-full p-2 border border-slate-200 rounded-lg bg-white text-\[16px\] md:text-sm"/g, 'className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none"');
// Replace specific time
data = data.replace(/className="w-full py-\[10px\] px-\[12px\] text-\[16px\] md:text-sm border border-slate-200 rounded-lg bg-white min-w-0 max-w-full"/g, 'className="w-full py-[10px] px-[12px] text-[16px] md:text-sm border border-slate-200 rounded-lg bg-white min-w-0 max-w-full outline-none focus:ring-2 focus:ring-blue-100 appearance-none"');

fs.writeFileSync(file, data);
console.log('Update focus styles');
