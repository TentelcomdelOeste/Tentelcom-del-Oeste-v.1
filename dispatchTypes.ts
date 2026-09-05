
export type RequestStatus = 'Pendiente' | 'Aprobada' | 'Parcial' | 'Despachada' | 'Rechazada' | 'Eliminada';
export type ProjectOrigin = 'IBUX-CLARO' | 'CNFL' | 'PRIVADO' | 'BODEGA PRINCIPAL' | 'BODEGA VEHICULAR';
export type RequestDestinationType = 'project' | 'vehicle';
export type ShortageStatus = 'Pendiente' | 'En proceso de compra' | 'Material recibido' | 'Cerrado';
export type ItemStatus = 'pending' | 'partial' | 'completed';

export interface RequestItem {
  inventoryItemId: string;
  code: string;
  description: string;
  unit: string;
  quantityRequested: number;
  quantityDispatched: number;
  quantityPending: number;
  status: ItemStatus;
  comment?: string;
  shortageQty?: number;
}

export interface ShortageItem {
  materialId: string;
  materialCode: string;
  materialDescription: string;
  quantityShortage: number;
}

export interface Shortage {
  id: string;
  requestId: string;
  projectName: string;
  requestedBy: string;
  requestedByName: string;
  status: ShortageStatus;
  date: string;
  items: ShortageItem[];
  requestNumber?: string;
}

export interface MaterialRequest {
  id: string;
  projectId: string;
  projectName: string;
  projectCode?: string;
  origin: ProjectOrigin;
  
  requestedBy: string; // User ID
  requestedByName: string;
  date: string; // Fecha solicitud
  
  status: RequestStatus;
  items: RequestItem[];
  
  // Destino y Bodega Vehicular
  destinationType?: RequestDestinationType;
  targetVehiculoId?: string;
  targetVehiculoPlaca?: string;
  targetVehiculoAlias?: string;
  movementReference?: string;

  // Campos condicionales IBUX
  fdh?: string;
  torre?: string;
  locationDetails?: string;
  planta?: string;
  observations?: string;
  
  approvalDate?: string;
  approvedBy?: string;
  
  // Trazabilidad
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  dispatchId?: string;
  requestNumber?: string;
  createdAt?: string;
}

export interface DispatchRecord {
  id: string;
  requestId: string;
  projectId: string;
  projectName: string;
  
  dispatchDate: string;
  dispatchedBy: string; // User ID responsable de la entrega física
  recordedBy: string; // User ID que registra en sistema
  requestNumber?: string;
  
  items: {
    inventoryItemId: string;
    code: string;
    description: string;
    quantity: number;
  }[];
  
  createdAt: string;
}
