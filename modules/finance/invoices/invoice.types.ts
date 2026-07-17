
export interface Invoice {
  id: string;
  consecutivo: string;
  type: 'CXC' | 'CXP';
  paymentMode: 'CONTADO' | 'CREDITO';
  currency: 'USD' | 'CRC';
  entityName: string;
  
  // Desglose Financiero
  subtotal: number;
  iva: number;
  total: number;
  balance: number;
  exchangeRate?: number;
  
  // Fechas y Relaciones
  issueDate: string;
  dueDate?: string;
  projectId?: string;
  projectName?: string;
  notes?: string;
  status: 'Pagada' | 'Pendiente' | 'Anulada';

  // Attachments
  attachmentUrl?: string;
  attachmentPath?: string;
  
  // Auditoría
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
