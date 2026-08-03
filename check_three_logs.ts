import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkLogs() {
  console.log("--- BUSCANDO BITACORAS RECIENTES ---");
  const colRef = collection(db, "bitacora_vehiculos");
  const snap = await getDocs(colRef);
  
  console.log(`Total bitacoras encontradas: ${snap.size}`);
  
  // Filtrar las creadas hoy (22 de junio de 2026) o cercanas
  const todayLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log("\nRegistros encontrados:");
  todayLogs.forEach((log: any) => {
    // Filtrar para mostrar solo las relevantes a la consulta del usuario
    if (log.unidad === "U2" || log.unidad === "U4" || log.unidad === "U6" || log.fecha?.includes("22/6/2026") || log.fecha?.includes("2026-06-22")) {
      console.log(`\n==================================================`);
      console.log(`ID: ${log.id}`);
      console.log(`Unidad: ${log.unidad} (${log.placa})`);
      console.log(`Conductor: ${log.conductorName}`);
      console.log(`Fecha/Hora: ${log.fecha} ${log.horaSalida}`);
      console.log(`TimelineId: ${log.timelineId}`);
      console.log(`CreatedAt: ${log.createdAt}`);
      console.log(`TrabajoId: ${log.trabajoId}`);
    }
  });

  console.log("\n--- FIN BUSQUEDA ---");
}

checkLogs().catch(console.error);
