import { db } from "../firebase";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { localDocStore } from "./offline/localDocStore";

export interface VehiclePhotoPolicyOverride {
  intervalDaysOverride?: number | null;
  disabled?: boolean;
}

export interface PhotoPolicyConfig {
  enabled: boolean;
  intervalDays: number;
  policyActivatedAt?: string;
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
  policyEnabled: boolean;
  policyActivatedAt: Date | null;
}> {
  try {
    // 1. Get global config /config/photo_policy
    let intervalDays = 15;
    let policyEnabled = true;
    let policyActivatedAtStr: string | null = null;

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
        if (data.policyActivatedAt) {
          policyActivatedAtStr = String(data.policyActivatedAt);
        }
      }
    } catch (e) {
      console.warn("[photoPolicy] Could not load config/photo_policy, using default 15:", e);
    }

    // REGLA 1: Si la política global está desactivada (enabled = false),
    // NINGUNA unidad está obligada, no se exigen fotos ni revisión.
    if (!policyEnabled) {
      return {
        vencida: false,
        intervalDays,
        disabled: true,
        ultimaFotoDate: null,
        fechaLimite: null,
        policyEnabled: false,
        policyActivatedAt: null,
      };
    }

    const policyActivatedAtDate = policyActivatedAtStr ? new Date(policyActivatedAtStr) : null;
    const policyActivatedAtMs = policyActivatedAtDate && !isNaN(policyActivatedAtDate.getTime()) 
      ? policyActivatedAtDate.getTime() 
      : 0;

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

    // REGLA 8: Si la unidad individual está excluida, no participa en la política.
    if (disabled) {
      return {
        vencida: false,
        intervalDays: effectiveInterval,
        disabled: true,
        ultimaFotoDate: null,
        fechaLimite: null,
        policyEnabled: true,
        policyActivatedAt: policyActivatedAtDate,
      };
    }

    // 3. Buscar fecha del último cumplimiento VÁLIDO (posterior o igual a policyActivatedAtMs)
    let ultimaFotoMs: number | null = null;
    const unitNamesToQuery = [unidadIdOrCode];
    if (vehicleData && vehicleData.unidad && vehicleData.unidad !== unidadIdOrCode) {
      unitNamesToQuery.push(vehicleData.unidad);
    }

    // Helper para verificar y registrar cumplimiento si es >= policyActivatedAtMs
    const recordCandidateTimestamp = (rawTs: any) => {
      if (!rawTs) return;
      const ts = typeof rawTs === "number" ? rawTs : new Date(rawTs).getTime();
      if (!isNaN(ts)) {
        // Solo cuenta si ocurrió en o después de la última activación de la política
        if (policyActivatedAtMs === 0 || ts >= policyActivatedAtMs) {
          if (!ultimaFotoMs || ts > ultimaFotoMs) {
            ultimaFotoMs = ts;
          }
        }
      }
    };

    // 3.1. Verificar en vehicleData
    if (vehicleData) {
      recordCandidateTimestamp(vehicleData.photoPolicyLastCompletedAt);
    }

    // 3.2. Verificar en localDocStore (reactividad inmediata local)
    try {
      const localLogs = await localDocStore.getLocalCollection("bitacora_vehiculos");
      if (Array.isArray(localLogs)) {
        for (const entry of localLogs) {
          const lData = entry.data || entry;
          if (unitNamesToQuery.includes(lData.unidad) || unitNamesToQuery.includes(lData.unidadId)) {
            recordCandidateTimestamp(lData.photoPolicyLastCompletedAt);
            recordCandidateTimestamp(lData.photoTimestamp);
            if (lData.oneDriveUrl && lData.fecha) {
              recordCandidateTimestamp(lData.fecha);
            }
          }
        }
      }
    } catch {
      // Ignorar error de localDocStore
    }

    // 3.3. Verificar en Firestore remoto bitacora_vehiculos
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
          recordCandidateTimestamp(lData.photoPolicyLastCompletedAt);
          recordCandidateTimestamp(lData.photoTimestamp);
          if (lData.oneDriveUrl && lData.fecha) {
            recordCandidateTimestamp(lData.fecha);
          }
        }
      } catch (err) {
        console.warn("[photoPolicy] Error querying bitacora_vehiculos for unit:", uName, err);
      }
    }

    // REGLA 2 y 5: Si no existe ningún cumplimiento válido después de la última activación,
    // la unidad queda PENDIENTE inmediatamente.
    if (!ultimaFotoMs) {
      return {
        vencida: true,
        intervalDays: effectiveInterval,
        disabled: false,
        ultimaFotoDate: null,
        fechaLimite: new Date(),
        policyEnabled: true,
        policyActivatedAt: policyActivatedAtDate,
      };
    }

    // Si tiene cumplimiento en el ciclo actual, calculamos la fecha límite sumando los días laborales
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
      policyEnabled: true,
      policyActivatedAt: policyActivatedAtDate,
    };
  } catch (e) {
    console.error("[photoPolicy] Error checking photo policy:", e);
    return {
      vencida: false,
      intervalDays: 15,
      disabled: false,
      ultimaFotoDate: null,
      fechaLimite: null,
      policyEnabled: true,
      policyActivatedAt: null,
    };
  }
}
