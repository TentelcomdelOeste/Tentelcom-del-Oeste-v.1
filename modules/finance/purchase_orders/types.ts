
export type PurchaseOrderStatus = 'ABIERTA' | 'CERRADA';

export interface PurchaseOrder {
  id: string;
  provider: string;       // Nombre del proveedor
  ocNumber: string;       // Número de referencia (ej: OC-2024-001)
  totalAmount: number;
  currency: 'USD' | 'CRC';
  status: PurchaseOrderStatus;
  issueDate: string;      // Fecha de emisión
  description?: string;
  
  // Campos de auditoría
  createdAt: string;
  createdBy: string;
}

export interface POApplication {
  id: string;
  purchaseOrderId: string;
  invoiceId: string;
  invoiceNumber: string;  // Desnormalizado para visualización rápida
  appliedAmount: number;
  date: string;
  status?: 'active' | 'deleted' | 'voided'; // Nuevo campo para borrado lógico
}

// Interfaz extendida para uso en UI (con cálculos)
export interface PurchaseOrderCalculated extends PurchaseOrder {
  usedAmount: number;
  availableBalance: number;
}
