export interface InventoryCostLayer {
  id: string; // Document ID: layer_${movementId}_${itemId}_${index}
  inventoryItemId: string; // Foreign key to inventory_items
  inventoryItemCode: string;
  inventoryItemName?: string;
  movementId: string; // Foreign key to origin Entrada in inventory_movements
  movementRequestNumber?: string | null;
  date: string; // Effective entry date (YYYY-MM-DD)
  quantityOriginal: number; // Original entered quantity
  quantityRemaining: number; // Remaining quantity available to be consumed
  unitCost: number; // Original unit purchase cost without VAT
  currency: 'USD' | 'CRC';
  exchangeRate?: number; // Optional exchange rate at entry time
  unitCostNormalized: number; // Normalized unit cost in item's base currency
  provider?: string;
  invoiceReference?: string;
  iva?: number;
  taxRate?: number; // e.g. 0.13
  status: 'active' | 'exhausted';
  createdAt: string; // ISO String timestamp for deterministic tie-breaker
  createdBy: string;
  updatedAt: string; // ISO String timestamp
}

export interface FifoLayerConsumption {
  layerId: string;
  movementId: string; // Origin Entrada movement ID
  date: string; // Entry date
  quantityConsumed: number;
  unitCost: number; // Cost applied from this layer
  currency: 'USD' | 'CRC';
  subtotal: number; // quantityConsumed * unitCost
  provider?: string;
  invoiceReference?: string;
}

export interface FifoConsumptionResult {
  costMethod: 'FIFO' | 'CATALOG_FALLBACK';
  costingStatus: 'CONFIRMED' | 'PENDING_COSTING';
  totalQuantity: number;
  totalCost: number;
  weightedUnitCost: number;
  currency: 'USD' | 'CRC';
  layersConsumed: FifoLayerConsumption[];
  isFullyCoveredByLayers: boolean;
  uncoveredQuantity: number;
  uncoveredUnitCost?: number;
}
