const fs = require('fs');
const file = 'modules/vehicles/VehicleLogModal.tsx';
let data = fs.readFileSync(file, 'utf8');
data = data.replace(/className="w-full p-2 border border-slate-200 rounded-lg bg-white"/g, 'className="w-full p-2 border border-slate-200 rounded-lg bg-white text-[16px] md:text-sm"');
data = data.replace(/className="w-full py-\[10px\] px-\[12px\] text-\[15px\] border border-slate-200 rounded-lg bg-white min-w-0 max-w-full"/g, 'className="w-full py-[10px] px-[12px] text-[16px] md:text-sm border border-slate-200 rounded-lg bg-white min-w-0 max-w-full"');
data = data.replace(/className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 text-sm"/g, 'className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm"');
fs.writeFileSync(file, data);
