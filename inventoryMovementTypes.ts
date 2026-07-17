
export type MovementType = 'Entrada' | 'Salida' | 'Devolución';

export interface MovementItemDetail {
  inventoryItemId: string;
  inventoryItemCode: string;
  inventoryItemName: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  // Campos calculados automáticamente según proveedor
  unitPrice?: number;
  iva?: number;
  total?: number;
  subtotal?: number;
  currency?: 'USD' | 'CRC';
}

export interface InventoryMovement {
  id: string;
  // Campos legacy (para mantener compatibilidad visual si hay un solo item o resumen)
  inventoryItemId: string; 
  inventoryItemCode: string; 
  inventoryItemName: string; 
  quantity: number; 
  unitPrice?: number;
  subtotal?: number;
  currency?: 'USD' | 'CRC';
  
  // Nuevo campo para múltiples items
  items?: MovementItemDetail[];

  type: MovementType;
  previousStock?: number; // Legacy
  newStock?: number; // Legacy
  date: string; // YYYY-MM-DD
  projectId?: string; // ID de la cotización/proyecto (Opcional)
  projectCode?: string; // Código visual del proyecto (ej: #101-2024)
  projectName?: string; // Nombre del cliente/proyecto
  userId: string;
  userName: string;
  observations?: string;
  createdAt: string;

  // Nuevos campos de Origen y Metadatos
  origin?: 'IBUX-CLARO' | 'CNFL' | 'PRIVADO' | 'Proveedor';
  provider?: string; // Nombre del proveedor si origin === 'Proveedor'
  fdh?: string;
  torre?: string;
  locationDetails?: string;
  linkedRequestId?: string; // ID de la solicitud de materiales vinculada
  dispatchId?: string;
  requestNumber?: string;
}
