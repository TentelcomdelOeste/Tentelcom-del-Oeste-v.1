import { db } from "../firebase";
import { doc, getDoc, collection, query, where, limit, getDocs, setDoc } from "firebase/firestore";
import { getUnitCode } from "../types/vehicle.types";

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export const WEEK_DAYS: { id: WeekDay; label: string; shortLabel: string; dayIndex: number }[] = [
  { id: 'monday', label: 'Lunes', shortLabel: 'Lun', dayIndex: 1 },
  { id: 'tuesday', label: 'Martes', shortLabel: 'Mar', dayIndex: 2 },
  { id: 'wednesday', label: 'Miércoles', shortLabel: 'Mié', dayIndex: 3 },
  { id: 'thursday', label: 'Jueves', shortLabel: 'Jue', dayIndex: 4 },
  { id: 'friday', label: 'Viernes', shortLabel: 'Vie', dayIndex: 5 },
];

export interface PolicySchedule {
  enabled: boolean;
  days: WeekDay[];
}

export interface VehicleWeeklyPolicyConfig {
  enabled: boolean; // Master switch / legacy compat
  photos: PolicySchedule;
  inspection: PolicySchedule;
  // Legacy compatibility fields
  intervalDays?: number;
  policyActivatedAt?: string;
}

export interface VehiclePhotoPolicyOverride {
  disabled?: boolean;
  photosEnabled?: boolean | null;
  photosDays?: WeekDay[] | null;
  inspectionEnabled?: boolean | null;
  inspectionDays?: WeekDay[] | null;
  intervalDaysOverride?: number | null; // Legacy
}

export interface VehiclePolicyEvaluation {
  requiresPhotos: boolean;
  requiresInspection: boolean;
  disabled: boolean;
  photosEnabled: boolean;
  inspectionEnabled: boolean;
  todayDay: WeekDay | null;
  todayLabel: string;
  isPhotoDay: boolean;
  isInspectionDay: boolean;
  // Legacy compatibility fields
  vencida: boolean;
  intervalDays: number;
  ultimaFotoDate: Date | null;
  fechaLimite: Date | null;
  policyEnabled: boolean;
  policyActivatedAt: Date | null;
}

export interface PhotoPolicyConfig extends VehicleWeeklyPolicyConfig {}

/**
 * Returns the current day of the week as a WeekDay ('monday'..'friday') or null for weekends.
 */
export function getTodayWeekDay(date: Date = new Date()): WeekDay | null {
  const day = date.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  switch (day) {
    case 1: return 'monday';
    case 2: return 'tuesday';
    case 3: return 'wednesday';
    case 4: return 'thursday';
    case 5: return 'friday';
    default: return null;
  }
}

/**
 * Returns human-readable label for a WeekDay.
 */
export function getWeekDayLabel(day: WeekDay | null): string {
  if (!day) return 'Fin de semana';
  const found = WEEK_DAYS.find(w => w.id === day);
  return found ? found.label : day;
}

/**
 * Default fallback policy: Photos on Mon & Fri, Inspection on Mon & Fri.
 */
export function getDefaultPolicyConfig(): VehicleWeeklyPolicyConfig {
  return {
    enabled: true,
    photos: {
      enabled: true,
      days: ['monday', 'friday'],
    },
    inspection: {
      enabled: true,
      days: ['monday', 'friday'],
    },
    intervalDays: 15,
  };
}

let cachedGlobalConfig: VehicleWeeklyPolicyConfig | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

export function clearPolicyConfigCache(): void {
  cachedGlobalConfig = null;
  lastCacheFetchTime = 0;
}

/**
 * Retrieves the global policy config with in-memory caching to prevent repeated Firestore reads.
 */
export async function getGlobalPolicyConfig(forceRefresh = false): Promise<VehicleWeeklyPolicyConfig> {
  const now = Date.now();
  if (!forceRefresh && cachedGlobalConfig && (now - lastCacheFetchTime < CACHE_TTL_MS)) {
    return cachedGlobalConfig;
  }

  try {
    const configSnap = await getDoc(doc(db, "config", "photo_policy"));
    if (configSnap.exists()) {
      const data = configSnap.data();
      const masterEnabled = typeof data.enabled === "boolean" ? data.enabled : true;

      // Parse photos policy
      const photosData = data.photos || {};
      const photosEnabled = typeof photosData.enabled === "boolean" 
        ? photosData.enabled 
        : masterEnabled;
      const photosDays: WeekDay[] = Array.isArray(photosData.days) 
        ? (photosData.days.filter((d: string) => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d)) as WeekDay[])
        : ['monday', 'friday'];

      // Parse inspection policy
      const inspectionData = data.inspection || {};
      const inspectionEnabled = typeof inspectionData.enabled === "boolean" 
        ? inspectionData.enabled 
        : masterEnabled;
      const inspectionDays: WeekDay[] = Array.isArray(inspectionData.days) 
        ? (inspectionData.days.filter((d: string) => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d)) as WeekDay[])
        : ['monday', 'friday'];

      cachedGlobalConfig = {
        enabled: masterEnabled,
        photos: {
          enabled: photosEnabled,
          days: photosDays,
        },
        inspection: {
          enabled: inspectionEnabled,
          days: inspectionDays,
        },
        intervalDays: typeof data.intervalDays === "number" ? data.intervalDays : 15,
        policyActivatedAt: data.policyActivatedAt,
      };
      lastCacheFetchTime = now;
      return cachedGlobalConfig;
    }
  } catch (e) {
    console.warn("[photoPolicy] Error reading config/photo_policy from Firestore:", e);
  }

  cachedGlobalConfig = getDefaultPolicyConfig();
  lastCacheFetchTime = now;
  return cachedGlobalConfig;
}

/**
 * Saves the global policy config to Firestore and updates in-memory cache.
 */
export async function saveGlobalPolicyConfig(config: Partial<VehicleWeeklyPolicyConfig>): Promise<void> {
  const current = await getGlobalPolicyConfig(true);
  const updated: VehicleWeeklyPolicyConfig = {
    ...current,
    ...config,
    photos: {
      ...current.photos,
      ...(config.photos || {}),
    },
    inspection: {
      ...current.inspection,
      ...(config.inspection || {}),
    },
  };

  await setDoc(doc(db, "config", "photo_policy"), updated, { merge: true });
  cachedGlobalConfig = updated;
  lastCacheFetchTime = Date.now();
}

/**
 * Synchronous, fast evaluation of vehicle policy based on weekly days and vehicle exceptions.
 */
export function evaluateVehiclePolicy(
  globalConfig: VehicleWeeklyPolicyConfig,
  vehicleData?: any,
  targetDate: Date = new Date()
): VehiclePolicyEvaluation {
  const todayDay = getTodayWeekDay(targetDate);
  const todayLabel = getWeekDayLabel(todayDay);

  const pol = vehicleData?.photoPolicy as VehiclePhotoPolicyOverride | undefined;
  const isVehicleExcluded = Boolean(pol?.disabled);

  // If vehicle is explicitly excluded, never require photos or inspection
  if (isVehicleExcluded) {
    return {
      requiresPhotos: false,
      requiresInspection: false,
      disabled: true,
      photosEnabled: false,
      inspectionEnabled: false,
      todayDay,
      todayLabel,
      isPhotoDay: false,
      isInspectionDay: false,
      vencida: false,
      intervalDays: 15,
      ultimaFotoDate: null,
      fechaLimite: null,
      policyEnabled: globalConfig.enabled,
      policyActivatedAt: null,
    };
  }

  // 1. Photos policy resolution
  const effectivePhotosEnabled = typeof pol?.photosEnabled === "boolean"
    ? pol.photosEnabled
    : globalConfig.photos.enabled;

  const effectivePhotosDays: WeekDay[] = Array.isArray(pol?.photosDays) && pol.photosDays.length > 0
    ? pol.photosDays
    : globalConfig.photos.days;

  const isPhotoDay = todayDay !== null && effectivePhotosDays.includes(todayDay);
  const requiresPhotos = effectivePhotosEnabled && isPhotoDay;

  // 2. Inspection policy resolution
  const effectiveInspectionEnabled = typeof pol?.inspectionEnabled === "boolean"
    ? pol.inspectionEnabled
    : globalConfig.inspection.enabled;

  const effectiveInspectionDays: WeekDay[] = Array.isArray(pol?.inspectionDays) && pol.inspectionDays.length > 0
    ? pol.inspectionDays
    : globalConfig.inspection.days;

  const isInspectionDay = todayDay !== null && effectiveInspectionDays.includes(todayDay);
  const requiresInspection = effectiveInspectionEnabled && isInspectionDay;

  const vencida = requiresPhotos || requiresInspection;

  return {
    requiresPhotos,
    requiresInspection,
    disabled: !effectivePhotosEnabled && !effectiveInspectionEnabled,
    photosEnabled: effectivePhotosEnabled,
    inspectionEnabled: effectiveInspectionEnabled,
    todayDay,
    todayLabel,
    isPhotoDay,
    isInspectionDay,
    vencida,
    intervalDays: 15,
    ultimaFotoDate: null,
    fechaLimite: null,
    policyEnabled: globalConfig.enabled,
    policyActivatedAt: null,
  };
}

/**
 * Fast check for a vehicle's policy status for today.
 * Does NOT perform heavy history queries, resulting in instant response.
 */
export async function checkVehiclePhotoPolicy(
  unidadIdOrCode: string,
  providedVehicleData?: any
): Promise<VehiclePolicyEvaluation> {
  try {
    const globalConfig = await getGlobalPolicyConfig();
    const unitCode = getUnitCode(unidadIdOrCode) || unidadIdOrCode;

    let vehicleData = providedVehicleData;
    const hasExplicitPhotoPolicy = vehicleData && typeof vehicleData === 'object' && vehicleData.photoPolicy !== undefined;

    if (!hasExplicitPhotoPolicy && (unitCode || unidadIdOrCode)) {
      try {
        // 1. Direct lookup by canonical unit code (e.g. "U1")
        if (unitCode) {
          const vehDocRef = doc(db, "vehiculos", unitCode);
          const vehSnap = await getDoc(vehDocRef);
          if (vehSnap.exists() && vehSnap.data()?.photoPolicy !== undefined) {
            vehicleData = vehSnap.data();
          }
        }

        // 2. Direct lookup by raw string if different
        if (!vehicleData?.photoPolicy && unidadIdOrCode && unidadIdOrCode !== unitCode) {
          const vehDocRefRaw = doc(db, "vehiculos", unidadIdOrCode);
          const vehSnapRaw = await getDoc(vehDocRefRaw);
          if (vehSnapRaw.exists() && vehSnapRaw.data()?.photoPolicy !== undefined) {
            vehicleData = vehSnapRaw.data();
          }
        }

        // 3. Query collection by 'unidad' field matching unitCode
        if (!vehicleData?.photoPolicy && unitCode) {
          const qVeh = query(collection(db, "vehiculos"), where("unidad", "==", unitCode), limit(5));
          const qSnap = await getDocs(qVeh);
          if (!qSnap.empty) {
            const disabledDoc = qSnap.docs.find(d => d.data()?.photoPolicy?.disabled === true);
            vehicleData = (disabledDoc || qSnap.docs[0]).data();
          }
        }

        // 4. Query collection by raw string matching
        if (!vehicleData?.photoPolicy && unidadIdOrCode && unidadIdOrCode !== unitCode) {
          const qVehRaw = query(collection(db, "vehiculos"), where("unidad", "==", unidadIdOrCode), limit(5));
          const qSnapRaw = await getDocs(qVehRaw);
          if (!qSnapRaw.empty) {
            const disabledDoc = qSnapRaw.docs.find(d => d.data()?.photoPolicy?.disabled === true);
            vehicleData = (disabledDoc || qSnapRaw.docs[0]).data();
          }
        }
      } catch (err) {
        console.warn("[photoPolicy] Could not fetch vehicle document:", unidadIdOrCode, err);
      }
    }

    return evaluateVehiclePolicy(globalConfig, vehicleData, new Date());
  } catch (e) {
    console.error("[photoPolicy] Error checking vehicle policy:", e);
    return evaluateVehiclePolicy(getDefaultPolicyConfig(), null, new Date());
  }
}

/**
 * Legacy business days helper functions kept for backwards compatibility.
 */
export function calculateBusinessDaysDeadline(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate.getTime());
  if (businessDays <= 0) {
    const dow = result.getDay();
    if (dow === 6) result.setDate(result.getDate() + 2);
    else if (dow === 0) result.setDate(result.getDate() + 1);
    return result;
  }

  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

export function calculateRemainingBusinessDays(fromDate: Date, toDate: Date): number {
  if (fromDate.getTime() >= toDate.getTime()) return 0;
  const current = new Date(fromDate.getTime());
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
