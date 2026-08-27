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
}

export type InspectionOption = 'SI' | 'NO' | 'N/A';

export interface InspectionItemDef {
    id: string;
    label: string;
    category: 'UNIDAD APAGADA' | 'UNIDAD ENCENDIDA';
    defaultValue?: InspectionOption;
}

export const INSPECTION_ITEMS: InspectionItemDef[] = [
    // UNIDAD APAGADA
    { id: 'llantas', label: '1. Llantas en buen estado', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'lucesBuenEstado', label: '2. Luces en buen estado', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'espejosRetrovisores', label: '3. Espejos/retrovisores', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'presentaFuga', label: '4. Presenta alguna fuga', category: 'UNIDAD APAGADA', defaultValue: 'NO' },
    { id: 'frenoMano', label: '5. Buen estado del freno de mano', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'kitCarretera', label: '6. Kit obligatorio para carretera', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'llantaRefaccion', label: '7. Llanta de refacción en buen estado', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'cuentaExtintor', label: '8. Cuenta con extintor', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'vencimientoExtintor', label: '9. Fecha de vencimiento del extintor', category: 'UNIDAD APAGADA', defaultValue: 'SI' },
    { id: 'terminalesBateriaAjustados', label: '10. Terminales de batería ajustados', category: 'UNIDAD APAGADA', defaultValue: 'SI' },

    // UNIDAD ENCENDIDA
    { id: 'enciendeCorreBien', label: '11. La unidad enciende y corre bien', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'indicadoresTablero', label: '12. Indicadores del tablero en buen estado (luces, termostato, combustible, velocímetro)', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'lucesEmergencia', label: '13. Luces de emergencia', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'nivelCombustibleCarga', label: '14. Nivel de Combustible/Carga', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'claxonPito', label: '15. Claxon/Pito', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'frenosPedal', label: '16. Frenos de pedal funcionan', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'marchasBuenEstado', label: '17. Marchas en buen estado', category: 'UNIDAD ENCENDIDA', defaultValue: 'SI' },
    { id: 'aireAcondicionado', label: '18. Aire acondicionado en buen estado', category: 'UNIDAD ENCENDIDA' },
    { id: 'terminalesBateriaCorrosion', label: '19. Terminales de batería con corrosión', category: 'UNIDAD ENCENDIDA', defaultValue: 'NO' }
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

export interface Vehicle {
    id: string;
    placa: string;
    alias: string;
    marca: string;
    modelo: string;
    isActive: boolean;
    photoPolicy?: {
        intervalDaysOverride?: number | null;
        disabled?: boolean;
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
