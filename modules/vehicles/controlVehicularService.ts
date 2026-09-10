import { db } from '../../firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  Vehicle,
  VehicleDocument,
  VehicleMaintenance,
  VehicleControlAlert
} from '../../types/vehicle.types';

const DOCS_COLLECTION = 'control_vehicular_documentos';
const MAINT_COLLECTION = 'control_vehicular_mantenimientos';

/**
 * Normaliza etiquetas de unidad para consistencia
 */
export const formatUnitLabel = (v: Vehicle | { id: string; alias?: string; marca?: string; modelo?: string; placa?: string }): string => {
  const unidadCode = v.alias || v.id || 'Unidad';
  const detalles = [v.marca, v.modelo, v.placa].filter(Boolean).join(' — ');
  return detalles ? `${unidadCode} — ${detalles}` : unidadCode;
};

/**
 * Carga el catálogo existente de vehículos desde la colección 'vehicles'
 */
export async function getVehiclesCatalog(): Promise<Vehicle[]> {
  try {
    const snap = await getDocs(collection(db, 'vehicles'));
    const list: Vehicle[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.isActive !== false && !data.isDeleted) {
        list.push({
          id: d.id,
          placa: data.placa || '',
          alias: data.alias || d.id,
          marca: data.marca || '',
          modelo: data.modelo || '',
          isActive: data.isActive !== false,
          photoPolicy: data.photoPolicy,
          photoPolicyLastCompletedAt: data.photoPolicyLastCompletedAt
        });
      }
    });
    // Ordenar por alias / id
    return list.sort((a, b) => (a.alias || a.id).localeCompare(b.alias || b.id, undefined, { numeric: true }));
  } catch (err) {
    console.error('Error fetching vehicles catalog:', err);
    return [];
  }
}

/**
 * Carga documentos de control vehicular
 */
export async function getVehicleDocuments(vehiculoId?: string): Promise<VehicleDocument[]> {
  try {
    const colRef = collection(db, DOCS_COLLECTION);
    const snap = await getDocs(colRef);
    const list: VehicleDocument[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.isDeleted) {
        if (!vehiculoId || data.vehiculoId === vehiculoId || data.unidad === vehiculoId) {
          list.push({
            id: d.id,
            ...data
          } as VehicleDocument);
        }
      }
    });
    return list.sort((a, b) => (b.fechaVencimiento || '').localeCompare(a.fechaVencimiento || ''));
  } catch (err) {
    console.error('Error fetching vehicle documents:', err);
    return [];
  }
}

/**
 * Suscribirse a documentos en tiempo real
 */
export function subscribeVehicleDocuments(callback: (docs: VehicleDocument[]) => void) {
  const colRef = collection(db, DOCS_COLLECTION);
  return onSnapshot(colRef, (snap) => {
    const list: VehicleDocument[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.isDeleted) {
        list.push({
          id: d.id,
          ...data
        } as VehicleDocument);
      }
    });
    list.sort((a, b) => (b.fechaVencimiento || '').localeCompare(a.fechaVencimiento || ''));
    callback(list);
  }, (error) => {
    console.error('Error in vehicle documents snapshot:', error);
  });
}

/**
 * Guarda o actualiza un documento de vehículo
 */
export async function saveVehicleDocument(docData: Partial<VehicleDocument>): Promise<string> {
  const now = new Date().toISOString();
  if (docData.id) {
    const docRef = doc(db, DOCS_COLLECTION, docData.id);
    const updatePayload = {
      ...docData,
      updatedAt: now
    };
    delete updatePayload.id;
    await updateDoc(docRef, updatePayload);
    return docData.id;
  } else {
    const colRef = collection(db, DOCS_COLLECTION);
    const newDoc = {
      ...docData,
      createdAt: docData.createdAt || now,
      updatedAt: now,
      isDeleted: false
    };
    const res = await addDoc(colRef, newDoc);
    return res.id;
  }
}

/**
 * Elimina un documento de vehículo
 */
export async function deleteVehicleDocument(id: string): Promise<void> {
  const docRef = doc(db, DOCS_COLLECTION, id);
  await updateDoc(docRef, { isDeleted: true, updatedAt: new Date().toISOString() });
}

/**
 * Carga registros de mantenimiento de control vehicular
 */
export async function getVehicleMaintenances(vehiculoId?: string): Promise<VehicleMaintenance[]> {
  try {
    const colRef = collection(db, MAINT_COLLECTION);
    const snap = await getDocs(colRef);
    const list: VehicleMaintenance[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.isDeleted) {
        if (!vehiculoId || data.vehiculoId === vehiculoId || data.unidad === vehiculoId) {
          list.push({
            id: d.id,
            ...data
          } as VehicleMaintenance);
        }
      }
    });
    return list.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  } catch (err) {
    console.error('Error fetching vehicle maintenances:', err);
    return [];
  }
}

/**
 * Suscribirse a mantenimientos en tiempo real
 */
export function subscribeVehicleMaintenances(callback: (maints: VehicleMaintenance[]) => void) {
  const colRef = collection(db, MAINT_COLLECTION);
  return onSnapshot(colRef, (snap) => {
    const list: VehicleMaintenance[] = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.isDeleted) {
        list.push({
          id: d.id,
          ...data
        } as VehicleMaintenance);
      }
    });
    list.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    callback(list);
  }, (error) => {
    console.error('Error in vehicle maintenances snapshot:', error);
  });
}

/**
 * Guarda o actualiza un registro de mantenimiento
 */
export async function saveVehicleMaintenance(maintData: Partial<VehicleMaintenance>): Promise<string> {
  const now = new Date().toISOString();
  if (maintData.id) {
    const docRef = doc(db, MAINT_COLLECTION, maintData.id);
    const updatePayload = {
      ...maintData,
      updatedAt: now
    };
    delete updatePayload.id;
    await updateDoc(docRef, updatePayload);
    return maintData.id;
  } else {
    const colRef = collection(db, MAINT_COLLECTION);
    const newDoc = {
      ...maintData,
      createdAt: maintData.createdAt || now,
      updatedAt: now,
      isDeleted: false
    };
    const res = await addDoc(colRef, newDoc);
    return res.id;
  }
}

/**
 * Elimina un registro de mantenimiento
 */
export async function deleteVehicleMaintenance(id: string): Promise<void> {
  const docRef = doc(db, MAINT_COLLECTION, id);
  await updateDoc(docRef, { isDeleted: true, updatedAt: new Date().toISOString() });
}

/**
 * Calcula las alertas por fecha de vencimiento y por kilometraje
 */
export function calculateControlAlerts(
  vehicles: Vehicle[],
  documents: VehicleDocument[],
  maintenances: VehicleMaintenance[],
  latestKmsMap: Record<string, number> // Map from vehiculoId or unidad -> latest kilometraje
): VehicleControlAlert[] {
  const alerts: VehicleControlAlert[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Alertas por Documentación (Fecha de Vencimiento)
  documents.forEach((d) => {
    if (d.isDeleted || !d.fechaVencimiento) return;

    // Normalizar unidad
    const matchedVeh = vehicles.find((v) => v.id === d.vehiculoId || v.alias === d.unidad || v.id === d.unidad);
    const unidadCode = matchedVeh?.alias || d.unidad || d.vehiculoId || 'Unidad';
    const unidadLabel = d.unidadLabel || (matchedVeh ? formatUnitLabel(matchedVeh) : unidadCode);

    const [year, month, day] = d.fechaVencimiento.split('-').map(Number);
    if (!year || !month || !day) return;

    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const diffMs = targetDate.getTime() - today.getTime();
    const restanDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const thresholdDays = d.diasAnticipacionAlerta ?? 30;

    if (restanDias <= 0) {
      alerts.push({
        id: `alert_doc_${d.id}`,
        vehiculoId: d.vehiculoId || matchedVeh?.id || d.unidad,
        unidad: unidadCode,
        unidadLabel,
        tipoAlerta: 'documento_vencimiento',
        titulo: 'DOCUMENTO VENCIDO',
        nivel: 'danger',
        targetNombre: d.tipoDocumento,
        detalle: `El documento ${d.tipoDocumento} venció el ${day}/${month}/${year}${restanDias < 0 ? ` (hace ${Math.abs(restanDias)} días)` : ' (Hoy)'}.`,
        fechaOVencimiento: d.fechaVencimiento,
        restanDias,
        recordId: d.id
      });
    } else if (restanDias <= thresholdDays) {
      alerts.push({
        id: `alert_doc_${d.id}`,
        vehiculoId: d.vehiculoId || matchedVeh?.id || d.unidad,
        unidad: unidadCode,
        unidadLabel,
        tipoAlerta: 'documento_vencimiento',
        titulo: 'DOCUMENTO PRÓXIMO A VENCER',
        nivel: 'warning',
        targetNombre: d.tipoDocumento,
        detalle: `El documento ${d.tipoDocumento} vence el ${day}/${month}/${year}. Restan: ${restanDias} días.`,
        fechaOVencimiento: d.fechaVencimiento,
        restanDias,
        recordId: d.id
      });
    }
  });

  // 2. Alertas por Mantenimiento (Kilometraje)
  maintenances.forEach((m) => {
    if (m.isDeleted || !m.proximoKilometraje) return;

    const matchedVeh = vehicles.find((v) => v.id === m.vehiculoId || v.alias === m.unidad || v.id === m.unidad);
    const unidadCode = matchedVeh?.alias || m.unidad || m.vehiculoId || 'Unidad';
    const unidadLabel = m.unidadLabel || (matchedVeh ? formatUnitLabel(matchedVeh) : unidadCode);

    const key1 = matchedVeh?.id || '';
    const key2 = matchedVeh?.alias || '';
    const key3 = m.unidad || '';
    const key4 = m.vehiculoId || '';

    const currentKm = Math.max(
      latestKmsMap[key1] || 0,
      latestKmsMap[key2] || 0,
      latestKmsMap[key3] || 0,
      latestKmsMap[key4] || 0,
      m.kilometrajeActual || 0
    );

    const proximoKm = m.proximoKilometraje;
    const restanKm = proximoKm - currentKm;
    const thresholdKm = m.kilometrajeAlerta ?? 1000;

    if (currentKm >= proximoKm) {
      alerts.push({
        id: `alert_maint_${m.id}`,
        vehiculoId: m.vehiculoId || matchedVeh?.id || m.unidad,
        unidad: unidadCode,
        unidadLabel,
        tipoAlerta: 'mantenimiento_kilometraje',
        titulo: 'MANTENIMIENTO REQUERIDO / SOBREPASADO',
        nivel: 'danger',
        targetNombre: m.tipoMantenimiento,
        detalle: `${m.tipoMantenimiento} sobrepasado. Km actual: ${currentKm.toLocaleString()} km | Próximo: ${proximoKm.toLocaleString()} km.`,
        kilometrajeActual: currentKm,
        proximoKilometraje: proximoKm,
        restanKm,
        recordId: m.id
      });
    } else if (restanKm <= thresholdKm) {
      alerts.push({
        id: `alert_maint_${m.id}`,
        vehiculoId: m.vehiculoId || matchedVeh?.id || m.unidad,
        unidad: unidadCode,
        unidadLabel,
        tipoAlerta: 'mantenimiento_kilometraje',
        titulo: 'MANTENIMIENTO PRÓXIMO',
        nivel: 'warning',
        targetNombre: m.tipoMantenimiento,
        detalle: `${m.tipoMantenimiento} próximo. Km actual: ${currentKm.toLocaleString()} km | Próximo: ${proximoKm.toLocaleString()} km | Restan: ${restanKm.toLocaleString()} km.`,
        kilometrajeActual: currentKm,
        proximoKilometraje: proximoKm,
        restanKm,
        recordId: m.id
      });
    }
  });

  return alerts;
}
