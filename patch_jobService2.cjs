const fs = require('fs');
const file = 'modules/job_scheduling/jobService.ts';
let content = fs.readFileSync(file, 'utf8');

const startStr = '    linkedBitacoraIds.forEach(async (bitacoraId) => {';
const endStr = '    });\n  }';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find block in updateTrabajo!");
  process.exit(1);
}

const replacement = `    linkedBitacoraIds.forEach(async (bitacoraId) => {
        try {
            const bitacoraSnap = await getDoc(doc(db, "bitacora_vehiculos", bitacoraId));
            if (bitacoraSnap.exists()) {
                const bitacoraTimelineId = bitacoraSnap.data().timelineId;
                if (bitacoraTimelineId && bitacoraTimelineId !== oldTimelineId) {
                    await migrateTimeline(bitacoraTimelineId, oldTimelineId);
                }
            }

            await updateDoc(doc(db, "bitacora_vehiculos", bitacoraId), {
                trabajoId: id,
                timelineId: oldTimelineId
            });
            await recordBitacoraLinkedEvent(oldTimelineId, bitacoraId, oldOtCode);
        } catch (e) {
            console.error("Error linking bitacora", e);
        }
    });
  }`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log("Patched updateTrabajo in jobService.ts");
