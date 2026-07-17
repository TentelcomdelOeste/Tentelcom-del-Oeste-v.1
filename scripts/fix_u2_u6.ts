
import { db } from "../firebase";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";

async function run() {
    const u2Id = "xqJZru0WSLq6buFdU3Uk";
    const u6Id = "MmL1k6nOS36aAzu0ZgHp";

    const fix = async (id: string, name: string, ts: string, formattedHora: string) => {
        const docRef = doc(db, "bitacora_vehiculos", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const tlId = snap.data().timelineId;
            console.log(`${name} timelineId: ${tlId}`);
            
            const eventId = `iniciada_${tlId}_${name}`; 
            const eventRef = doc(db, "operational_timelines", tlId, "events", eventId);
            
            const eventSnap = await getDoc(eventRef);
            if (eventSnap.exists()) {
                const date = new Date(ts);
                await updateDoc(eventRef, {
                    timestamp: Timestamp.fromDate(date),
                    "metadata.fechaHora": formattedHora
                });
                console.log(`FIXED ${name}`);
            }
        }
    };
    
    await fix(u2Id, "U2", "2026-06-04T10:58:38.841Z", "04/jun./2026 04:58:38 AM");
    await fix(u6Id, "U6", "2026-06-04T11:03:34.073Z", "04/jun./2026 05:03:34 AM");
}
run();
