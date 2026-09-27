import { db } from '../../firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  Vehicle,
  VehicleDocument,
  VehicleMaintenance,
  VehicleControlAlert,
  VehicleExpense,
  VehicleLog,
  extraerUnidad,
  getUnitCode
} from '../../types/vehicle.types';
import { saveVehicleExpense, deleteVehicleExpense } from './vehicleService';
import { updateVersionedDocOffline } from '../../core/versionControl';
import { localDocStore } from '../../core/offline/localDocStore';
import { User } from '../../utils/types';

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
      updatedAt: now,
      isDeleted: docData.isDeleted ?? false
    };
    delete updatePayload.id;
    await setDoc(docRef, updatePayload, { merge: true });
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
 * Normaliza cualquier formato de fecha (ISO con T, YYYY-MM-DD, DD/MM/YYYY) a formato canónico 'YYYY-MM-DD'
 */
export function normalizeDateToCanonical(dateVal?: string | null): string {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (!str) return '';

  // Caso ISO string: "2026-09-25T14:30:00.000Z" o "2026-09-25T..."
  if (str.includes('T')) {
    return str.split('T')[0];
  }

  // Caso "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Caso "DD/MM/YYYY" o "DD-MM-YYYY"
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback con Date parsing
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {}

  return str;
}

/**
 * Mapea el tipo de mantenimiento a la categoría de gasto adecuada en Análisis de Flota
 */
export function mapMaintTypeToExpenseCategory(tipoMaint: string): VehicleExpense['categoria'] {
  const lower = (tipoMaint || '').toLowerCase();
  if (lower.includes('aceite')) return 'Aceite';
  if (lower.includes('llanta') || lower.includes('alineaci')) return 'Llantas';
  if (lower.includes('bater')) return 'Batería';
  if (lower.includes('freno') || lower.includes('reparaci') || lower.includes('mecánic') || lower.includes('mecanic')) return 'Reparación';
  return 'Mantenimiento';
}

/**
 * Busca el registro de bitácora correspondiente a un vehículo, fecha y kilometraje.
 * Utiliza Offline-First con fallback a Firestore remoto.
 */
export async function findMatchingBitacoraLog(
  unidad: string,
  vehiculoId: string,
  fecha: string,
  kilometraje?: number
): Promise<string | undefined> {
  try {
    const targetDate = normalizeDateToCanonical(fecha);
    const targetUCode = getUnitCode(unidad, vehiculoId) || extraerUnidad(unidad);

    // 1. Obtener logs desde localDocStore
    let rawDocs = await localDocStore.getLocalCollection('bitacora_vehiculos');
    let logs = rawDocs
      .map((d) => ({ ...d.data, id: d.docId }) as VehicleLog)
      .filter((l) => !l.isDeleted);

    let matchingUnitLogs = logs.filter((l) => {
      const logUCode = getUnitCode(l.unidad, l.unidadId, l.unidadName) || extraerUnidad(l.unidadId);
      return (
        (targetUCode && logUCode === targetUCode) ||
        l.unidad === unidad ||
        l.unidadId === vehiculoId ||
        extraerUnidad(l.unidadId) === unidad
      );
    });

    let exactDateLogs = matchingUnitLogs.filter((l) => normalizeDateToCanonical(l.fecha) === targetDate);

    // Si la caché local no tiene registros o no encontró la fecha exacta, consultar Firebase Firestore
    if (exactDateLogs.length === 0) {
      try {
        const { getDocs, query, collection, orderBy } = await import('firebase/firestore');
        const snap = await getDocs(query(collection(db, 'bitacora_vehiculos'), orderBy('fecha', 'desc')));
        if (!snap.empty) {
          const remoteLogs = snap.docs
            .map((doc) => ({ ...doc.data(), id: doc.id }) as VehicleLog)
            .filter((l) => !l.isDeleted);

          await localDocStore.saveLocalDocsBatch('bitacora_vehiculos', remoteLogs);
          logs = remoteLogs;
          matchingUnitLogs = logs.filter((l) => {
            const logUCode = getUnitCode(l.unidad, l.unidadId, l.unidadName) || extraerUnidad(l.unidadId);
            return (
              (targetUCode && logUCode === targetUCode) ||
              l.unidad === unidad ||
              l.unidadId === vehiculoId ||
              extraerUnidad(l.unidadId) === unidad
            );
          });
          exactDateLogs = matchingUnitLogs.filter((l) => normalizeDateToCanonical(l.fecha) === targetDate);
        }
      } catch (errRemote) {
        console.warn('[findMatchingBitacoraLog] Fallback a Firestore remoto falló:', errRemote);
      }
    }

    if (exactDateLogs.length === 0) return undefined;

    if (exactDateLogs.length === 1) {
      return exactDateLogs[0].id;
    }

    if (exactDateLogs.length > 1) {
      // Si hay kilometraje de mantenimiento, buscar el mejor match
      if (kilometraje && kilometraje > 0) {
        // a) Rango estricto [kmSalida, kmLlegada]
        const inRange = exactDateLogs.find((l) =>
          l.kmSalida != null && l.kmLlegada != null &&
          l.kmSalida <= kilometraje && kilometraje <= l.kmLlegada
        );
        if (inRange) return inRange.id;

        // b) Menor distancia a kmSalida o kmLlegada
        const sortedByKmDiff = [...exactDateLogs].sort((a, b) => {
          const diffA = Math.min(
            a.kmLlegada != null ? Math.abs(a.kmLlegada - kilometraje) : Infinity,
            a.kmSalida != null ? Math.abs(a.kmSalida - kilometraje) : Infinity
          );
          const diffB = Math.min(
            b.kmLlegada != null ? Math.abs(b.kmLlegada - kilometraje) : Infinity,
            b.kmSalida != null ? Math.abs(b.kmSalida - kilometraje) : Infinity
          );
          return diffA - diffB;
        });
        if (sortedByKmDiff[0]) return sortedByKmDiff[0].id;
      }

      // c) Más reciente por hora de salida o createdAt
      return exactDateLogs.sort((a, b) =>
        (b.horaSalida || b.createdAt || '').localeCompare(a.horaSalida || a.createdAt || '')
      )[0].id;
    }

    return undefined;
  } catch (err) {
    console.error('Error finding matching bitacora log:', err);
    return undefined;
  }
}

/**
 * Guarda o actualiza un registro de mantenimiento
 */
export async function saveVehicleMaintenance(maintData: Partial<VehicleMaintenance>, currentUser?: User): Promise<string> {
  const now = new Date().toISOString();
  let maintId = maintData.id;

  if (maintId) {
    const docRef = doc(db, MAINT_COLLECTION, maintId);
    const updatePayload = {
      ...maintData,
      updatedAt: now,
      isDeleted: maintData.isDeleted ?? false
    };
    delete updatePayload.id;
    await setDoc(docRef, updatePayload, { merge: true });
  } else {
    const colRef = collection(db, MAINT_COLLECTION);
    const newDoc = {
      ...maintData,
      createdAt: maintData.createdAt || now,
      updatedAt: now,
      isDeleted: false
    };
    const res = await addDoc(colRef, newDoc);
    maintId = res.id;
  }

  // --- INTEGRACIÓN CON GASTOS (Análisis de Flota y Registro de Bitácora) ---
  if (maintId) {
    const expenseId = `gasto_maint_${maintId}`;
    const cost = maintData.costo || 0;
    const isMaintDeleted = maintData.isDeleted === true;

    if (isMaintDeleted || cost <= 0) {
      try {
        const existingExpense = await localDocStore.getLocalDoc('vehicle_expenses', expenseId);
        if (existingExpense && existingExpense.data) {
          const expenseData = existingExpense.data as VehicleExpense;
          if (currentUser) {
            await deleteVehicleExpense(expenseId, expenseData, currentUser);
          } else {
            const fallbackUser = { id: maintData.createdBy || 'system', name: maintData.createdBy || 'Sistema' } as User;
            await deleteVehicleExpense(expenseId, expenseData, fallbackUser);
          }
        } else {
          const fallbackUser = currentUser || { id: maintData.createdBy || 'system', name: maintData.createdBy || 'Sistema' } as User;
          await updateVersionedDocOffline('vehicle_expenses', expenseId, {
            isDeleted: true,
            updatedAt: now,
            updatedBy: fallbackUser.id
          }, {
            id: expenseId,
            isDeleted: true,
            unidad: maintData.unidad || '',
            vehiculoId: maintData.vehiculoId || '',
            fecha: maintData.fecha || '',
            categoria: 'Mantenimiento',
            descripcion: `Mantenimiento: ${maintData.tipoMantenimiento || ''}`,
            monto: cost,
            createdAt: now,
            createdBy: fallbackUser.id
          });
        }
      } catch (err) {
        console.error('Error al remover el gasto asociado al mantenimiento:', err);
      }
    } else {
      try {
        const fallbackUser = currentUser || { id: maintData.createdBy || 'system', name: maintData.createdBy || 'Sistema' } as User;
        const tipoMaint = maintData.tipoMantenimiento || '';
        const desc = tipoMaint ? `${tipoMaint}${maintData.tallerProveedor ? ` - ${maintData.tallerProveedor}` : ''}` : 'Mantenimiento';
        const categoria = mapMaintTypeToExpenseCategory(tipoMaint);
        
        // Buscar el ID del registro de bitácora correspondiente para esa unidad y fecha/kilometraje
        const matchedBitacoraId = await findMatchingBitacoraLog(
          maintData.unidad || '',
          maintData.vehiculoId || '',
          maintData.fecha || now.split('T')[0],
          maintData.kilometrajeActual
        );

        const expensePayload: Partial<VehicleExpense> = {
          id: expenseId,
          vehiculoId: maintData.vehiculoId || '',
          unidad: maintData.unidad || '',
          fecha: maintData.fecha || now.split('T')[0],
          categoria: categoria,
          descripcion: desc,
          monto: cost,
          kilometraje: maintData.kilometrajeActual,
          bitacoraId: matchedBitacoraId,
          sourceType: 'control_vehicular_mantenimiento',
          sourceId: maintId,
          observaciones: 'Generado automáticamente desde Control Vehicular.',
          isDeleted: false
        };

        await saveVehicleExpense(expensePayload, fallbackUser);
      } catch (err) {
        console.error('Error al guardar el gasto asociado al mantenimiento:', err);
      }
    }
  }

  return maintId;
}

/**
 * Auto-vincula y sincroniza todos los mantenimientos activos con la colección de gastos (vehicle_expenses)
 * y asigna el bitacoraId correspondiente a cada uno de forma persistente.
 */
export async function reconcileUnlinkedMaintenanceExpenses(): Promise<void> {
  try {
    const { getDocs, query, collection, doc, setDoc } = await import('firebase/firestore');
    
    // Consultar todos los mantenimientos registrados en Control Vehicular
    const maintsSnap = await getDocs(query(collection(db, MAINT_COLLECTION)));
    if (maintsSnap.empty) return;

    for (const mDoc of maintsSnap.docs) {
      const maint = { ...mDoc.data(), id: mDoc.id } as VehicleMaintenance;
      const cost = Number(maint.costo) || 0;
      if (maint.isDeleted || cost <= 0) continue;

      const expenseId = `gasto_maint_${maint.id}`;
      const matchedBitacoraId = await findMatchingBitacoraLog(
        maint.unidad || '',
        maint.vehiculoId || '',
        maint.fecha || maint.createdAt?.split('T')[0] || '',
        maint.kilometrajeActual
      );

      const tipoMaint = maint.tipoMantenimiento || '';
      const desc = tipoMaint ? `${tipoMaint}${maint.tallerProveedor ? ` - ${maint.tallerProveedor}` : ''}` : 'Mantenimiento';
      const categoria = mapMaintTypeToExpenseCategory(tipoMaint);
      const now = new Date().toISOString();

      const expensePayload: VehicleExpense = {
        id: expenseId,
        vehiculoId: maint.vehiculoId || '',
        unidad: maint.unidad || '',
        fecha: maint.fecha || maint.createdAt?.split('T')[0] || now.split('T')[0],
        categoria: categoria,
        descripcion: desc,
        monto: cost,
        kilometraje: maint.kilometrajeActual,
        bitacoraId: matchedBitacoraId,
        sourceType: 'control_vehicular_mantenimiento',
        sourceId: maint.id,
        observaciones: 'Generado automáticamente desde Control Vehicular.',
        isDeleted: false,
        createdAt: maint.createdAt || now,
        updatedAt: now,
        createdBy: maint.createdBy || 'sistema',
        version: 1
      };

      // Guardar de forma determinista e idempotente en Firestore
      await setDoc(doc(db, 'vehicle_expenses', expenseId), expensePayload, { merge: true });

      // Guardar en localDocStore
      await localDocStore.saveLocalDoc('vehicle_expenses', expenseId, expensePayload);
    }
  } catch (err) {
    console.warn('[reconcileUnlinkedMaintenanceExpenses] error:', err);
  }
}

/**
 * Elimina un registro de mantenimiento
 */
export async function deleteVehicleMaintenance(id: string, currentUser?: User): Promise<void> {
  const docRef = doc(db, MAINT_COLLECTION, id);
  const now = new Date().toISOString();
  await updateDoc(docRef, { isDeleted: true, updatedAt: now });

  // --- INTEGRACIÓN CON GASTOS: Borrar el gasto correspondiente ---
  const expenseId = `gasto_maint_${id}`;
  try {
    const existingExpense = await localDocStore.getLocalDoc('vehicle_expenses', expenseId);
    const fallbackUser = currentUser || { id: 'system', name: 'Sistema' } as User;
    if (existingExpense && existingExpense.data) {
      await deleteVehicleExpense(expenseId, existingExpense.data as VehicleExpense, fallbackUser);
    } else {
      await updateVersionedDocOffline('vehicle_expenses', expenseId, {
        isDeleted: true,
        updatedAt: now,
        updatedBy: fallbackUser.id
      }, {
        id: expenseId,
        isDeleted: true,
        unidad: '',
        vehiculoId: '',
        fecha: '',
        categoria: 'Mantenimiento',
        descripcion: 'Mantenimiento eliminado',
        monto: 0,
        createdAt: now,
        createdBy: fallbackUser.id
      });
    }
  } catch (err) {
    console.error('Error al eliminar el gasto asociado durante la eliminación del mantenimiento:', err);
  }
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
