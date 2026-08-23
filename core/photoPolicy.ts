import { db } from "../firebase";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

export interface VehiclePhotoPolicyOverride {
  intervalDaysOverride?: number | null;
  disabled?: boolean;
}

export async function checkVehiclePhotoPolicy(unidadIdOrCode: string): Promise<{
  vencida: boolean;
  intervalDays: number;
  disabled: boolean;
  ultimaFotoDate: Date | null;
  fechaLimite: Date | null;
}> {
  try {
    // 1. Get global config /config/photo_policy
    let intervalDays = 15;
    try {
      const configDoc = await getDoc(doc(db, "config", "photo_policy"));
      if (configDoc.exists()) {
        const data = configDoc.data();
        if (typeof data.intervalDays === "number") {
          intervalDays = data.intervalDays;
        }
      }
    } catch (e) {
      console.warn("[photoPolicy] Could not load config/photo_policy, using default 15:", e);
    }

    // 2. Get vehicle document
    let vehicleData: any = null;
    let effectiveInterval = intervalDays;
    let disabled = false;

    try {
      const vehDocRef = doc(db, "vehiculos", unidadIdOrCode);
      const vehSnap = await getDoc(vehDocRef);
      if (vehSnap.exists()) {
        vehicleData = vehSnap.data();
      } else {
        const qVeh = query(collection(db, "vehiculos"), where("unidad", "==", unidadIdOrCode), limit(1));
        const qSnap = await getDocs(qVeh);
        if (!qSnap.empty) {
          vehicleData = qSnap.docs[0].data();
        }
      }
    } catch (e) {
      console.warn("[photoPolicy] Could not load vehicle document for:", unidadIdOrCode, e);
    }

    if (vehicleData && vehicleData.photoPolicy) {
      const pol = vehicleData.photoPolicy as VehiclePhotoPolicyOverride;
      if (pol.disabled) {
        disabled = true;
      }
      if (typeof pol.intervalDaysOverride === "number" && pol.intervalDaysOverride >= 0) {
        effectiveInterval = pol.intervalDaysOverride;
      }
    }

    if (disabled) {
      return { vencida: false, intervalDays: effectiveInterval, disabled: true, ultimaFotoDate: null, fechaLimite: null };
    }

    if (effectiveInterval === 0) {
      return { vencida: true, intervalDays: 0, disabled: false, ultimaFotoDate: null, fechaLimite: new Date() };
    }

    // 3. Find most recent bitacora record with oneDriveUrl or photoTimestamp
    let ultimaFotoMs: number | null = null;
    const unitNamesToQuery = [unidadIdOrCode];
    if (vehicleData && vehicleData.unidad && vehicleData.unidad !== unidadIdOrCode) {
      unitNamesToQuery.push(vehicleData.unidad);
    }

    for (const uName of unitNamesToQuery) {
      try {
        const qLogs = query(
          collection(db, "bitacora_vehiculos"),
          where("unidad", "==", uName),
          orderBy("fecha", "desc"),
          limit(20)
        );
        const logsSnap = await getDocs(qLogs);
        for (const d of logsSnap.docs) {
          const lData = d.data();
          if (lData.photoTimestamp) {
            const ts = typeof lData.photoTimestamp === "number" ? lData.photoTimestamp : new Date(lData.photoTimestamp).getTime();
            if (!isNaN(ts) && (!ultimaFotoMs || ts > ultimaFotoMs)) {
              ultimaFotoMs = ts;
            }
          }
          if (lData.oneDriveUrl && lData.fecha) {
            const fDate = new Date(lData.fecha).getTime();
            if (!isNaN(fDate) && (!ultimaFotoMs || fDate > ultimaFotoMs)) {
              ultimaFotoMs = fDate;
            }
          }
        }
      } catch (err) {
        console.warn("[photoPolicy] Error querying bitacora_vehiculos for unit:", uName, err);
      }
    }

    if (!ultimaFotoMs) {
      return { vencida: true, intervalDays: effectiveInterval, disabled: false, ultimaFotoDate: null, fechaLimite: new Date() };
    }

    const ultimaFotoDate = new Date(ultimaFotoMs);
    const fechaLimite = new Date(ultimaFotoMs);
    fechaLimite.setDate(fechaLimite.getDate() + effectiveInterval);

    // If fechaLimite falls on Saturday (6) or Sunday (0), adjust to next Monday
    const dayOfWeek = fechaLimite.getDay();
    if (dayOfWeek === 6) {
      fechaLimite.setDate(fechaLimite.getDate() + 2);
    } else if (dayOfWeek === 0) {
      fechaLimite.setDate(fechaLimite.getDate() + 1);
    }

    const today = new Date();
    const vencida = today.getTime() >= fechaLimite.getTime();

    return {
      vencida,
      intervalDays: effectiveInterval,
      disabled: false,
      ultimaFotoDate,
      fechaLimite,
    };
  } catch (e) {
    console.error("[photoPolicy] Error checking photo policy:", e);
    return { vencida: false, intervalDays: 15, disabled: false, ultimaFotoDate: null, fechaLimite: null };
  }
}
