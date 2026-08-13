const fs = require('fs');
const file = 'modules/job_scheduling/jobService.ts';
let content = fs.readFileSync(file, 'utf8');

const startStr = '  if (data.bitacoraIds && data.bitacoraIds.length > 0) {';
const endStr = '    });\n  }';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find block in createTrabajo!");
  process.exit(1);
}

const replacement = `  if (data.bitacoraIds && data.bitacoraIds.length > 0) {
    data.bitacoraIds.forEach(async (bitacoraId: string) => {
      try {
        const bitacoraSnap = await getDoc(doc(db, "bitacora_vehiculos", bitacoraId));
        if (bitacoraSnap.exists()) {
           const bitacoraTimelineId = bitacoraSnap.data().timelineId;
           if (bitacoraTimelineId && bitacoraTimelineId !== id) {
               await migrateTimeline(bitacoraTimelineId, id);
           }
        }
        await updateDoc(doc(db, "bitacora_vehiculos", bitacoraId), {
          trabajoId: id,
          timelineId: id
        });
        await recordBitacoraLinkedEvent(id, bitacoraId, data.otCode || '');
      } catch (e) {
        console.error("Error linking bitacora on create", e);
      }
    });
  }`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log("Patched createTrabajo in jobService.ts");
