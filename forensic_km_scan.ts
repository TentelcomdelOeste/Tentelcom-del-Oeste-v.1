
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as fs from 'fs';

// Load config from the environment or file
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function runForensicScan() {
    console.log("Starting Forensic Scan...");
    const colRef = collection(db, "bitacora_vehiculos");
    
    // We'll fetch all records to compare logic
    const snapshot = await getDocs(colRef);
    const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    console.log(`Total documents in bitacora_vehiculos: ${allDocs.length}`);

    const extraerUnidad = (unidadId) => {
        if (!unidadId) return '';
        const parts = String(unidadId).split(' - ');
        return parts.length > 0 ? parts[0]?.trim() || '' : '';
    };

    // We need to identify which unit is the one with 3115 km.
    // I'll group them as the Summary View does.
    const summaryGroups = {};
    allDocs.forEach(log => {
        if (log.isDeleted) return;
        const uid = log.unidad || extraerUnidad(log.unidadId);
        if (!uid) return;

        if (!summaryGroups[uid]) summaryGroups[uid] = { totalKm: 0, count: 0, docs: [] };
        
        const km = log.totalKm || ((log.kmLlegada != null && log.kmSalida != null && log.kmLlegada >= log.kmSalida) ? (log.kmLlegada - log.kmSalida) : 0);
        summaryGroups[uid].totalKm += km;
        summaryGroups[uid].count++;
        summaryGroups[uid].docs.push({ id: log.id, unidad: log.unidad, unidadId: log.unidadId, km });
    });

    console.log("\n--- Summary View Logic Results ---");
    Object.keys(summaryGroups).forEach(uid => {
        console.log(`Unit: ${uid} | Total KM: ${summaryGroups[uid].totalKm} | Count: ${summaryGroups[uid].count}`);
    });

    // Now simulate Detail View logic for each unit
    console.log("\n--- Detail View Logic Discrepancy Check ---");
    Object.keys(summaryGroups).forEach(uid => {
        const detailDocs = allDocs.filter(log => log.unidad === uid);
        let detailKm = 0;
        detailDocs.forEach(log => {
            const km = log.totalKm || ((log.kmLlegada != null && log.kmSalida != null && log.kmLlegada >= log.kmSalida) ? (log.kmLlegada - log.kmSalida) : 0);
            detailKm += km;
        });

        if (summaryGroups[uid].totalKm !== detailKm) {
            console.log(`!!! DISCREPANCY FOUND for Unit: ${uid} !!!`);
            console.log(`Summary: ${summaryGroups[uid].totalKm} km`);
            console.log(`Detail (Strict Query): ${detailKm} km`);
            console.log(`Difference: ${summaryGroups[uid].totalKm - detailKm} km`);
            
            // Find specific docs causing the difference
            const excludedDocs = summaryGroups[uid].docs.filter(d => !detailDocs.find(dd => dd.id === d.id));
            console.log("Excluded Documents (Present in Summary, Absent in Detail):");
            excludedDocs.forEach(d => {
                console.log(` - ID: ${d.id} | unidad field: "${d.unidad}" | unidadId field: "${d.unidadId}" | KM: ${d.km}`);
            });
        }
    });
}

runForensicScan().catch(console.error);
