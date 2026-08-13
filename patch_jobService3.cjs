const fs = require('fs');
const file = 'modules/job_scheduling/jobService.ts';
let content = fs.readFileSync(file, 'utf8');

const strToFind = 'export const migrateTimeline = async (oldTimelineId: string, newTimelineId: string) => {';

if (content.indexOf(strToFind) === -1) {
  console.log("Could not find migrateTimeline!");
  process.exit(1);
}

const newMigrate = `export const migrateTimeline = async (oldTimelineId: string, newTimelineId: string) => {
  if (oldTimelineId === newTimelineId) return;
  
  const oldEventsRef = collection(db, "operational_timelines", oldTimelineId, "events");
  const newEventsRef = collection(db, "operational_timelines", newTimelineId, "events");
  
  const snapshot = await getDocs(oldEventsRef);
  
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    const newDocRef = doc(newEventsRef, docSnap.id);
    batch.set(newDocRef, docSnap.data(), { merge: true }); // Prevent overwriting existing identical events during migration
  });
  
  await batch.commit();
};`;

content = content.replace(/export const migrateTimeline = async \(oldTimelineId: string, newTimelineId: string\) => {[\s\S]*?await batch\.commit\(\);\n};/, newMigrate);

fs.writeFileSync(file, content);
console.log("Patched migrateTimeline in jobService.ts");
