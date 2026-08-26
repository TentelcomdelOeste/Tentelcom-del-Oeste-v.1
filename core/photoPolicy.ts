import { db } from "../firebase";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

export interface VehiclePhotoPolicyOverride {
  intervalDaysOverride?: number | null;
  disabled?: boolean;
}

/**
 * Calculates deadline adding a specific number of BUSINESS DAYS (Monday to Friday).
 * If startDate is on a weekend (Saturday/Sunday), counting starts on the next Monday.
 * If businessDays is 0, the deadline is the current date (or next Monday if weekend).
 * The resulting deadline will ALWAYS fall on a weekday (Monday to Friday).
 */
export function calculateBusinessDaysDeadline(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate.getTime());
  
  if (businessDays <= 0) {
    // If weekend, move to next Monday
    const dow = result.getDay();
    if (dow === 6) {
      result.setDate(result.getDate() + 2);
    } else if (dow === 0) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    // Monday(1) to Friday(5) are business days. Saturday(6) and Sunday(0) are skipped.
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }

  return result;
}

/**
 * Counts the number of remaining BUSINESS DAYS between two dates (fromDate -> toDate).
 * Excludes weekends. Returns 0 if fromDate is already past or equal to toDate.
 */
export function calculateRemainingBusinessDays(fromDate: Date, toDate: Date): number {
  if (fromDate.getTime() >= toDate.getTime()) {
    return 0;
  }
  
  const current = new Date(fromDate.getTime());
  // Normalize current date to start of next day for counting
  current.setHours(0, 0, 0, 0);
  const target = new Date(toDate.getTime());
  target.setHours(0, 0, 0, 0);

  let businessDays = 0;
  while (current < target) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      businessDays++;
    }
  }
  return businessDays;
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
    let policyEnabled = true;
    try {
      const configDoc = await getDoc(doc(db, "config", "photo_policy"));
      if (configDoc.exists()) {
        const data = configDoc.data();
        if (typeof data.intervalDays === "number") {
          intervalDays = data.intervalDays;
        }
        if (typeof data.enabled === "boolean") {
          policyEnabled = data.enabled;
        }
      }
    } catch (e) {
      console.warn("[photoPolicy] Could not load config/photo_policy, using default 15:", e);
    }

    // If global policy is disabled, vehicle never expires and photo is not mandatory
    if (!policyEnabled) {
      return { vencida: false, intervalDays, disabled: true, ultimaFotoDate: null, fechaLimite: null };
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
    const fechaLimite = calculateBusinessDaysDeadline(ultimaFotoDate, effectiveInterval);

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
