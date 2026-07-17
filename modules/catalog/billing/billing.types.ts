
export type BillingType = 'COBRAR' | 'PAGAR';
export type PaymentMode = 'CONTADO' | 'CREDITO';
export type BillingStatus = 'BORRADOR' | 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA' | 'CANCELADA';
export type Currency = 'CRC' | 'USD';

export interface BillingInvoice {
  id: string;
  
  // Clasificación Contable
  type: BillingType;
  mode: PaymentMode;
  
  // Entidad (Cliente o Proveedor)
  entityName: string;
  entityId?: string; // Opcional, para vincular con ID de cliente/proveedor futuro
  
  // Relación con Proyectos (Centro de Costos)
  projectId?: string;
  projectName?: string; // Desnormalizado para visualización rápida
  
  // Fechas
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD (Obligatorio si es CRÉDITO)
  
  // Datos Económicos
  currency: Currency;
  exchangeRate?: number; // Para reportes consolidados
  
  // Desglose
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  
  // Control de Saldos
  paidAmount: number;
  balance: number; // Saldo pendiente
  
  // Estado y Auditoría
  status: BillingStatus;
  notes?: string;
  
  createdAt: string; // ISO String
  createdBy: string; // User ID
  updatedAt: string; // ISO String
}

// Input simplificado para creación
export interface CreateInvoiceDTO {
  type: BillingType;
  mode: PaymentMode;
  entityName: string;
  projectId?: string;
  projectName?: string;
  issueDate: string;
  dueDate?: string;
  currency: Currency;
  subtotal: number;
  taxAmount: number;
  notes?: string;
}
