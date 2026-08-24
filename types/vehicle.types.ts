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
    oneDriveUrl?: string;
    oneDriveSyncedAt?: string;
    oneDriveSyncError?: string;
}

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
