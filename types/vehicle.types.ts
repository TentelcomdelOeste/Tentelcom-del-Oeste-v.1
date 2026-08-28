export interface VehicleRecharge {
    id: string;
    kmRecarga: number | null;
    monto: number | null;
    tipoCombustible: 'Super' | 'Regular' | 'Diesel' | 'Gas' | null;
    litros: number | null;
    gasolinera: string;
}

export interface VehicleLog {
    id: string;
    conductorId: string;
    conductorName: string;
    fecha: string;
    unidadId: string;
    unidadName: string;

    kmSalida: number;
    horaSalida: string;
    combustible: 'Full' | '3/4' | '1/2' | '1/4';
    destino: string;

    fechaRegreso: string;
    kmLlegada: number;
    horaLlegada: string;
    combustibleFinal: 'Full' | '3/4' | '1/2' | '1/4';
    eventosCarretera: string; // 'Sí' | 'No'

    kmRecarga: number | null;
    monto: number | null;
    tipoCombustible: 'Super' | 'Regular' | 'Diesel' | 'Gas' | null;
    litros: number | null;
    gasolinera: string;
    
    recargas?: VehicleRecharge[];

    observaciones: string;

    firma: {
        imageBase64: string;
        fecha: string;
        usuarioId: string;
    };

    totalKm: number;

    createdBy: string;
    updatedBy: string;
    createdAt: string;
    updatedAt: string;

    isDeleted?: boolean;
    deletedBy?: string;
    deletedAt?: string;

    vehiculoId?: string;
    unidad?: string;
    placa?: string;
    photoStoragePath?: string;
    photoStoragePaths?: string[];
    photoTimestamp?: number;
    photoPolicyLastCompletedAt?: string;
    oneDriveUrl?: string;
    oneDriveSyncedAt?: string;
    oneDriveSyncError?: string;
    revisionUnidad?: Record<string, 'SI' | 'NO' | 'N/A'>;
    hasInspectionAlert?: boolean;
    inspectionAlerts?: InspectionAlertItem[];
}

export type InspectionOption = 'SI' | 'NO' | 'N/A';

export type InspectionCategory = 
    | 'INICIO DE LABORES'
    | 'INSPECCIÓN EXTERIOR' 
    | 'REVISIÓN MECÁNICA BÁSICA' 
    | 'EQUIPAMIENTO DE SEGURIDAD' 
    | 'UNIDAD APAGADA' 
    | 'UNIDAD ENCENDIDA'
    | 'FINAL DE LABORES';

export interface InspectionItemDef {
    id: string;
    label: string;
    category: InspectionCategory;
    defaultValue?: InspectionOption;
}

export const INSPECTION_ITEMS: InspectionItemDef[] = [
    // INICIO DE LABORES
    { id: 'llenadoBoletaRecorrido', label: '1. Llenado de boleta de recorrido', category: 'INICIO DE LABORES' },

    // INSPECCIÓN EXTERIOR DEL VEHÍCULO
    { id: 'inspeccionGolpesDanos', label: '1. Revisar visualmente que no existan golpes, daños o piezas sueltas', category: 'INSPECCIÓN EXTERIOR', defaultValue: 'SI' },
    { id: 'estadoLlantas', label: '2. Revisar el estado de las llantas (desgaste excesivo o daños visibles en las llantas)', category: 'INSPECCIÓN EXTERIOR', defaultValue: 'SI' },
    { id: 'presionLlantas', label: '3. Presión de las llantas', category: 'INSPECCIÓN EXTERIOR', defaultValue: 'SI' },
    { id: 'llantaRepuesto', label: '4. Verificar estado de la llanta de repuesto', category: 'INSPECCIÓN EXTERIOR', defaultValue: 'SI' },
    { id: 'lucesCompletas', label: '5. Revisar funcionamiento de todas las luces, delanteras, traseras, de freno, direccionales, emergencia', category: 'INSPECCIÓN EXTERIOR', defaultValue: 'SI' },
    { id: 'espejosParabrisasVentanas', label: '6. Revisar espejos retrovisores, parabrisas y ventanas', category: 'INSPECCIÓN EXTERIOR', defaultValue: 'SI' },
    { id: 'sinFugasLiquidos', label: '7. Verificar que no existan fugas de aceite, combustible, refrigerante u otros líquidos debajo del vehículo', category: 'INSPECCIÓN EXTERIOR', defaultValue: 'SI' },

    // REVISIÓN MECÁNICA BÁSICA DEL VEHÍCULO
    { id: 'nivelAceite', label: '1. Nivel de aceite', category: 'REVISIÓN MECÁNICA BÁSICA', defaultValue: 'SI' },
    { id: 'nivelRefrigerante', label: '2. Nivel de refrigerante', category: 'REVISIÓN MECÁNICA BÁSICA', defaultValue: 'SI' },
    { id: 'nivelLiquidoFrenos', label: '3. Nivel de líquido de frenos', category: 'REVISIÓN MECÁNICA BÁSICA', defaultValue: 'SI' },
    { id: 'nivelLimpiaparabrisas', label: '4. Nivel de líquido limpiaparabrisas', category: 'REVISIÓN MECÁNICA BÁSICA', defaultValue: 'SI' },
    { id: 'verificarKmCambioAceite', label: '5. Verificar cantidad de kilómetros recorrido para el cambio de aceite de la unidad', category: 'REVISIÓN MECÁNICA BÁSICA', defaultValue: 'SI' },

    // EQUIPAMIENTO DE SEGURIDAD
    { id: 'extintorVigente', label: '1. Extintor disponible y vigente', category: 'EQUIPAMIENTO DE SEGURIDAD', defaultValue: 'SI' },
    { id: 'triangulosSenalizacion', label: '2. Triángulos y dispositivos de señalización', category: 'EQUIPAMIENTO DE SEGURIDAD', defaultValue: 'SI' },
    { id: 'gatoHidraulico', label: '3. Gato hidráulico', category: 'EQUIPAMIENTO DE SEGURIDAD', defaultValue: 'SI' },
    { id: 'llaveRuedas', label: '4. Llave para ruedas', category: 'EQUIPAMIENTO DE SEGURIDAD', defaultValue: 'SI' },
    { id: 'botiquin', label: '5. Botiquín de primeros auxilios', category: 'EQUIPAMIENTO DE SEGURIDAD', defaultValue: 'SI' },
    { id: 'documentosVehiculo', label: '6. Documentos del vehículo', category: 'EQUIPAMIENTO DE SEGURIDAD', defaultValue: 'SI' },
    { id: 'documentosConductor', label: '7. Documentos del conductor', category: 'EQUIPAMIENTO DE SEGURIDAD', defaultValue: 'SI' },

    // UNIDAD APAGADA (Puntos mecánicos/funcionales conservados)
    { id: 'terminalesBateriaBuenEstado', label: '1. Terminales de batería en buen estado (ajustados y sin corrosión)', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'frenoMano', label: '2. Buen estado del freno de mano', category: 'UNIDAD APAGADA', defaultValue: 'SI' },

    // UNIDAD ENCENDIDA (Puntos mecánicos/funcionales conservados)
    { id: 'enciendeCorreBien', label: '1. La unidad enciende y corre bien', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'indicadoresTablero', label: '2. Indicadores del tablero en buen estado (luces, termostato, combustible, velocímetro)', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'nivelCombustibleCarga', label: '3. Nivel de Combustible/Carga', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'claxonPito', label: '4. Claxon/Pito', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'frenosPedal', label: '5. Frenos de pedal funcionan', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'marchasBuenEstado', label: '6. Marchas en buen estado', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'aireAcondicionado', label: '7. Aire acondicionado en buen estado', category: 'UNIDAD ENCENDIDA' },

    // FINAL DE LABORES
    { id: 'inspeccionVisualParqueo', label: '1. Inspección visual de la unidad en el parqueo', category: 'FINAL DE LABORES' },
    { id: 'cerradoBoletaRecorrido', label: '2. Cerrado de la boleta de recorrido', category: 'FINAL DE LABORES' }
];

export const getDefaultVehicleInspection = (): Record<string, InspectionOption> => {
    const defaults: Record<string, InspectionOption> = {};
    INSPECTION_ITEMS.forEach(item => {
        if (item.defaultValue) {
            defaults[item.id] = item.defaultValue;
        }
    });
    return defaults;
};

export const normalizeVehicleInspection = (saved?: Record<string, any>): Record<string, InspectionOption> => {
    const defaults = getDefaultVehicleInspection();
    if (!saved) return defaults;

    const result: Record<string, InspectionOption> = { ...defaults, ...saved };

    // Migración retrocompatible para registros históricos
    if (saved.llantas && !saved.estadoLlantas) {
        result.estadoLlantas = saved.llantas;
    }
    if (saved.lucesBuenEstado && !saved.lucesCompletas) {
        result.lucesCompletas = saved.lucesBuenEstado;
    }
    if (saved.espejosRetrovisores && !saved.espejosParabrisasVentanas) {
        result.espejosParabrisasVentanas = saved.espejosRetrovisores;
    }
    if (saved.presentaFuga && !saved.sinFugasLiquidos) {
        result.sinFugasLiquidos = saved.presentaFuga === 'NO' ? 'SI' : (saved.presentaFuga === 'SI' ? 'NO' : 'N/A');
    }
    if (saved.llantaRefaccion && !saved.llantaRepuesto) {
        result.llantaRepuesto = saved.llantaRefaccion;
    }
    if ((saved.cuentaExtintor || saved.vencimientoExtintor) && !saved.extintorVigente) {
        result.extintorVigente = saved.cuentaExtintor || saved.vencimientoExtintor;
    }
    if ((saved.terminalesBateriaAjustados || saved.terminalesBateriaCorrosion) && !saved.terminalesBateriaBuenEstado) {
        if (saved.terminalesBateriaAjustados === 'NO' || saved.terminalesBateriaCorrosion === 'SI') {
            result.terminalesBateriaBuenEstado = 'NO';
        } else {
            result.terminalesBateriaBuenEstado = saved.terminalesBateriaAjustados || 'SI';
        }
    }

    // Puntos sin valor por defecto que no deben forzar selección si no estaban en saved
    if (saved.llenadoBoletaRecorrido === undefined) {
        delete result.llenadoBoletaRecorrido;
    } else {
        result.llenadoBoletaRecorrido = saved.llenadoBoletaRecorrido;
    }
    if (saved.inspeccionVisualParqueo === undefined) {
        delete result.inspeccionVisualParqueo;
    } else {
        result.inspeccionVisualParqueo = saved.inspeccionVisualParqueo;
    }
    if (saved.cerradoBoletaRecorrido === undefined) {
        delete result.cerradoBoletaRecorrido;
    } else {
        result.cerradoBoletaRecorrido = saved.cerradoBoletaRecorrido;
    }
    if (saved.aireAcondicionado === undefined) {
        delete result.aireAcondicionado;
    } else {
        result.aireAcondicionado = saved.aireAcondicionado;
    }

    return result;
};

export const extraerUnidad = (unidadId?: string): string => {
    if (!unidadId) return '';
    const parts = String(unidadId).split(' - ');
    return parts.length > 0 ? parts[0]?.trim() || '' : '';
};

export const extraerPlaca = (unidadId?: string): string => {
    if (!unidadId) return '';
    const parts = String(unidadId).split(' - ');
    return parts.length > 2 ? parts[2]?.trim() || '' : (parts.length > 1 ? parts[1]?.trim() || '' : '');
};

export interface InspectionAlertItem {
    itemId: string;
    label: string;
    category?: InspectionCategory;
    expectedValue: InspectionOption;
    selectedValue: InspectionOption;
}

/**
 * Extrae y normaliza el identificador canónico de la unidad (ej: 'U1', 'U2', 'U5', 'U8', etc.).
 */
export const getUnitCode = (unidad?: string, unidadId?: string, unidadName?: string): string => {
    const raw = String(unidad || unidadName || unidadId || '').trim();
    if (!raw) return '';
    const parts = raw.split(' - ');
    const firstPart = parts[0]?.trim().toUpperCase() || '';
    const match = firstPart.match(/^U\d+/);
    if (match) return match[0];
    const generalMatch = raw.toUpperCase().match(/\bU(\d+)\b/);
    if (generalMatch) return `U${generalMatch[1]}`;
    if (raw.toUpperCase().includes('BONGO')) return 'U2';
    if (raw.toUpperCase().includes('PATHFINDER')) return 'U1';
    if (raw.toUpperCase().includes('UD 1400') || raw.toUpperCase().includes('NISSAN UD')) return 'U5';
    return firstPart;
};

/**
 * Obtiene el valor esperado preestablecido para un punto de inspección según la unidad.
 * 
 * Reglas de negocio:
 * 1. SECCIONES GENERALES (SI para TODAS las unidades):
 *    - 1. INSPECCIÓN EXTERIOR
 *    - 2. REVISIÓN MECÁNICA BÁSICA
 *    - 3. EQUIPAMIENTO DE SEGURIDAD
 *    - 4.1 UNIDAD APAGADA
 * 
 * 2. SECCIÓN 4.2 UNIDAD ENCENDIDA:
 *    - U1: Nivel de Combustible/Carga (id: nivelCombustibleCarga) -> NO
 *          Aire acondicionado en buen estado (id: aireAcondicionado) -> NO
 *          Demás puntos -> SI
 *    - U2: Aire acondicionado en buen estado (id: aireAcondicionado) -> NO
 *          Demás puntos -> SI
 *    - U5: Nivel de Combustible/Carga (id: nivelCombustibleCarga) -> NO
 *          Aire acondicionado en buen estado (id: aireAcondicionado) -> NO
 *          Demás puntos -> SI
 *    - DEMÁS UNIDADES:
 *          Todos los puntos -> SI
 */
export const getExpectedInspectionValue = (itemId: string, unitCode: string): InspectionOption | null => {
    const unit = unitCode.trim().toUpperCase();

    // 4.2 UNIDAD ENCENDIDA
    if (itemId === 'nivelCombustibleCarga') {
        if (unit === 'U1' || unit === 'U5') {
            return 'NO';
        }
        return 'SI';
    }

    if (itemId === 'aireAcondicionado') {
        if (unit === 'U1' || unit === 'U2' || unit === 'U5') {
            return 'NO';
        }
        return 'SI';
    }

    const itemDef = INSPECTION_ITEMS.find(i => i.id === itemId);
    if (!itemDef) return null;

    if (
        itemDef.category === 'INSPECCIÓN EXTERIOR' ||
        itemDef.category === 'REVISIÓN MECÁNICA BÁSICA' ||
        itemDef.category === 'EQUIPAMIENTO DE SEGURIDAD' ||
        itemDef.category === 'UNIDAD APAGADA' ||
        itemDef.category === 'UNIDAD ENCENDIDA'
    ) {
        return 'SI';
    }

    return null;
};

/**
 * Evalúa las desviaciones de la revisión vehicular respecto a los valores preestablecidos.
 * La alerta se activa si: VALOR SELECCIONADO !== VALOR PREESTABLECIDO PARA ESA UNIDAD.
 */
export const evaluateVehicleInspectionAlerts = (
    revisionUnidad?: Record<string, any>,
    unitOrLog?: string | Partial<VehicleLog>
): { hasInspectionAlert: boolean; inspectionAlerts: InspectionAlertItem[] } => {
    if (!revisionUnidad) {
        return { hasInspectionAlert: false, inspectionAlerts: [] };
    }

    let unitCode = '';
    if (typeof unitOrLog === 'string') {
        unitCode = getUnitCode(unitOrLog);
    } else if (unitOrLog) {
        unitCode = getUnitCode(unitOrLog.unidad, unitOrLog.unidadId, unitOrLog.unidadName);
    }

    const alerts: InspectionAlertItem[] = [];

    const evaluatedCategories: InspectionCategory[] = [
        'INSPECCIÓN EXTERIOR',
        'REVISIÓN MECÁNICA BÁSICA',
        'EQUIPAMIENTO DE SEGURIDAD',
        'UNIDAD APAGADA',
        'UNIDAD ENCENDIDA'
    ];

    const inspectedItems = INSPECTION_ITEMS.filter(item => evaluatedCategories.includes(item.category));

    for (const item of inspectedItems) {
        const userValue = revisionUnidad[item.id];
        if (userValue === undefined || userValue === null || userValue === '') {
            continue;
        }

        const expected = getExpectedInspectionValue(item.id, unitCode);
        if (expected && userValue !== expected) {
            alerts.push({
                itemId: item.id,
                label: item.label,
                category: item.category,
                expectedValue: expected,
                selectedValue: userValue as InspectionOption
            });
        }
    }

    return {
        hasInspectionAlert: alerts.length > 0,
        inspectionAlerts: alerts
    };
};

export interface Vehicle {
    id: string;
    placa: string;
    alias: string;
    marca: string;
    modelo: string;
    isActive: boolean;
    photoPolicy?: {
        disabled?: boolean;
        photosEnabled?: boolean | null;
        photosDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday')[] | null;
        inspectionEnabled?: boolean | null;
        inspectionDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday')[] | null;
        intervalDaysOverride?: number | null;
    };
    photoPolicyLastCompletedAt?: string;
}

export interface VehicleExpense {
    id: string;
    vehiculoId: string;
    unidad: string;
    bitacoraId?: string; // Opcional, si se vincula a una bitácora
    fecha: string; // YYYY-MM-DD
    categoria: 'Combustible' | 'Mantenimiento' | 'Aceite' | 'Llantas' | 'Batería' | 'Seguro' | 'Marchamo' | 'RTV' | 'Reparación' | 'Gasto General' | 'Otros';
    descripcion: string;
    monto: number;
    kilometraje?: number;
    observaciones?: string;
    comprobanteUrl?: string;
    comprobanteNombre?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    version?: number;
    isDeleted?: boolean;
}
