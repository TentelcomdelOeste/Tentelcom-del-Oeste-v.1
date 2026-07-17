


export type Section = 'inicio' | 'dashboard';
export type SubSection = 'cotizaciones' | 'finanzas' | 'usuarios' | 'inventario' | 'movimientos_inventario' | 'solicitudes' | 'reporte_materiales';
export type Currency = 'USD' | 'CRC';

export interface ProjectFile {
  id: string;
  name: string;
  data: string;
  date: string;
}

export interface Product {
  id:string;
  codigo: string;
  nombre: string;
  precioBase: number;
  moneda?: Currency;
  isActive?: boolean;
  updatedAt?: string;
  _sync?: {
    status: 'synced' | 'pending';
    updatedAt: string;
  };
}

export interface QuoteItem {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  source?: 'catalog' | 'manual'; // Propiedad para identificar el origen del item
  productId?: string | null;     // ID del producto en catálogo (null si es manual)
  originProductId?: string | null; // ID original del producto de catálogo
  isCustom?: boolean;            // Flag para identificar partidas libres
  isNewLine?: boolean;           // Flag transitorio: Indica si la partida fue creada en esta sesión
  isEdited?: boolean;            // Flag transitorio: Indica si la descripción o código fue editado
}

// Fix: Updated Client interface to use 'codigoCliente' instead of 'codigo' to match usage in App.tsx
export interface Client {
  id: string;
  codigoCliente?: string;
  empresa: string;
  contacto: string;
  telefono: string;
  correo: string;
  isActive?: boolean;
}

export interface Quote {
  docId?: string; // ID estable del documento en Firestore para operaciones precisas
  id: number | string;
  clientId?: string; // Referencia al ID del documento del cliente
  codigoCliente?: string;
  empresa: string;
  contacto: string;
  telefono: string;
  correo: string;
  items: QuoteItem[];
  monto: number;
  moneda: Currency;
  vigencia: string;
  formaPago: string;
  observaciones: string;
  observacionesCliente?: string;
  montoLetras: string;
  estado: 'Pendiente' | 'Aprobada';
  status: 'Pendiente' | 'Aprobada';
  ordenPrincipal?: string | null;
  ocNumbers?: string[];
  ordenes: ProjectFile[]; // Sistema de archivos heredado
  facturas: ProjectFile[]; // Sistema de archivos heredado
  // attachments ahora es una subcolección en Firestore, se elimina del modelo principal.
  fecha: string;
  year?: number;
  month?: number;
  visualQuoteNumber?: number; // Correlativo visual para el cliente
  descuento?: number;
  exchangeRate?: number; // Tipo de cambio persistente por proyecto
  applyTax?: boolean; // Indica si se debe aplicar el IVA (13%) o si es exento
  analysisHidden?: boolean; // Flag para ocultar el análisis sin cambiar el estado de la cotización
  isDeleted?: boolean;
}

export interface PayrollEntry {
  id: number;
  empleado: string;
  mes: string;
  monto: number;
}

// Nuevas interfaces para Control de Acceso
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'empleado' | 'supervisor';
  password?: string;
  active: boolean;
  forcePasswordChange?: boolean;
  canUseOperationalLog?: boolean; // Permiso BETA para Bitácora Operativa
  permissions?: any; // Añadido para soportar permisos granulares sin circular dependency
}
