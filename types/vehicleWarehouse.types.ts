export interface VehicleWarehouseItem {
  id: string; // `${vehiculoId}_${inventoryItemId}`
  vehiculoId: string;
  vehiculoPlaca: string;
  vehiculoAlias: string;
  inventoryItemId: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  physicalStock: number;
  committedStock: number;
  availableStock: number;
  minStockAlert?: number;
  updatedAt: string;
  updatedBy: string;
}

export type VehicleRequestStatus = 'Abierta' | 'Cerrada' | 'Cancelada';

export interface VehicleRequestItem {
  inventoryItemId: string;
  code: string;
  description: string;
  unit: string;
  quantityCommitted: number;
  quantityUsed?: number;
  quantitySurplus?: number;
  notes?: string;
}

export interface VehicleAdditionLog {
  additionId: string;
  date: string;
  addedBy: string;
  addedByName: string;
  notes?: string;
  items: { inventoryItemId: string; quantity: number }[];
}

export interface VehicleMaterialRequest {
  id: string;
  requestNumber: string;
  vehiculoId: string;
  vehiculoAlias: string;
  vehiculoPlaca: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  responsibleId: string;
  responsibleName: string;
  status: VehicleRequestStatus;
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  closedByName?: string;
  items: VehicleRequestItem[];
  additionsLog: VehicleAdditionLog[];
  observations?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type VehicleMovementType = 
  | 'Traslado_Entrada'
  | 'Traslado_Salida'
  | 'Traslado_Entre_Vehiculos'
  | 'Consumo_Proyecto'
  | 'Devolucion_Bodega_Central'
  | 'Ajuste';

export interface VehicleMovementItem {
  inventoryItemId: string;
  code: string;
  description: string;
  quantity: number;
  previousPhysicalStock: number;
  newPhysicalStock: number;
  previousCommittedStock?: number;
  newCommittedStock?: number;
}

export interface VehicleMovement {
  id: string;
  movementNumber: string;
  type: VehicleMovementType;
  vehiculoId: string;
  vehiculoPlaca: string;
  targetVehiculoId?: string;
  targetVehiculoPlaca?: string;
  requestId?: string;
  projectId?: string;
  projectName?: string;
  items: VehicleMovementItem[];
  date: string;
  reason: string;
  performedBy: string;
  performedByName: string;
  createdAt: string;
}

export interface VehicleProjectConsumptionItem {
  inventoryItemId: string;
  code: string;
  description: string;
  unit: string;
  committed: number;
  consumed: number;
  surplus: number;
}

export interface VehicleProjectConsumption {
  id: string;
  requestId: string;
  requestNumber: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  vehiculoId: string;
  vehiculoAlias: string;
  responsibleId: string;
  responsibleName: string;
  closedAt: string;
  closedBy: string;
  items: VehicleProjectConsumptionItem[];
  totalItemsConsumed: number;
}
