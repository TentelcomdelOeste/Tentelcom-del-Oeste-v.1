import { 
  InventoryCostLayer, 
  FifoLayerConsumption, 
  FifoConsumptionResult 
} from '../types/fifoCostTypes';

/**
 * Servicio Centralizado de Costeo de Inventario mediante PEPS (FIFO)
 * Tentelcom del Oeste S.A.
 */

/**
 * Genera el ID determinista para una capa de costo de entrada.
 * Evita duplicación de capas ante reintentos o sincronizaciones repetidas.
 */
export function generateCostLayerId(movementId: string, itemId: string, index: number = 0): string {
  // Limpia caracteres no alfanuméricos para un ID limpio en Firestore
  const cleanMovId = (movementId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanItemId = (itemId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `layer_${cleanMovId}_${cleanItemId}_${index}`;
}

/**
 * Prepara el documento de Capa de Costo para una Entrada válida.
 */
export function prepareEntryCostLayer(params: {
  movementId: string;
  movementRequestNumber?: string | null;
  itemId: string;
  itemCode: string;
  itemName?: string;
  quantity: number;
  unitPrice: number; // Precio unitario de compra sin IVA
  currency?: 'USD' | 'CRC';
  exchangeRate?: number;
  provider?: string;
  invoiceReference?: string;
  iva?: number;
  taxRate?: number;
  date: string; // YYYY-MM-DD
  userEmail: string;
  index?: number;
}): InventoryCostLayer {
  const {
    movementId,
    movementRequestNumber,
    itemId,
    itemCode,
    itemName,
    quantity,
    unitPrice,
    currency = 'USD',
    exchangeRate = 1,
    provider = '',
    invoiceReference = '',
    iva = 0,
    taxRate = 0.13,
    date,
    userEmail,
    index = 0
  } = params;

  const validQty = Math.max(0, Number(quantity) || 0);
  const validPrice = Math.max(0, Number(unitPrice) || 0);
  const nowIso = new Date().toISOString();
  const layerId = generateCostLayerId(movementId, itemId, index);

  return {
    id: layerId,
    inventoryItemId: itemId,
    inventoryItemCode: itemCode,
    inventoryItemName: itemName || '',
    movementId,
    movementRequestNumber: movementRequestNumber || null,
    date: date || nowIso.split('T')[0],
    quantityOriginal: validQty,
    quantityRemaining: validQty,
    unitCost: validPrice,
    currency,
    exchangeRate,
    unitCostNormalized: validPrice, // En Fase 2 se implementará conversión si aplica
    provider,
    invoiceReference,
    iva,
    taxRate,
    status: validQty > 0 ? 'active' : 'exhausted',
    createdAt: nowIso,
    createdBy: userEmail || 'Sistema',
    updatedAt: nowIso
  };
}

/**
 * Ordena las capas de costo de forma estrictamente determinista según PEPS:
 * 1. Fecha efectiva de la entrada (date ASC)
 * 2. Fecha/hora de creación del registro (createdAt ASC)
 * 3. Identificador único de la capa (id ASC)
 */
export function sortLayersDeterministically(layers: InventoryCostLayer[]): InventoryCostLayer[] {
  return [...layers].sort((a, b) => {
    // 1. Fecha de entrada (YYYY-MM-DD)
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;

    // 2. Timestamp de creación (ISO)
    const createdComp = (a.createdAt || '').localeCompare(b.createdAt || '');
    if (createdComp !== 0) return createdComp;

    // 3. Desempate determinista por ID
    return (a.id || '').localeCompare(b.id || '');
  });
}

export interface LayerUpdate {
  layerId: string;
  newRemaining: number;
  newStatus: 'active' | 'exhausted';
  quantityDeducted: number;
}

/**
 * Ejecuta el cálculo y consumo PEPS (FIFO) de las capas disponibles para una cantidad solicitada.
 * Redondea con precisión a 4 decimales para evitar acumulación de errores de punto flotante.
 */
export function calculateFifoConsumption(params: {
  availableLayers: InventoryCostLayer[];
  requestedQuantity: number;
  catalogFallbackPrice: number;
  itemCurrency?: 'USD' | 'CRC';
  isOnline?: boolean;
}): {
  result: FifoConsumptionResult;
  layerUpdates: LayerUpdate[];
} {
  const {
    availableLayers,
    requestedQuantity,
    catalogFallbackPrice,
    itemCurrency = 'USD',
    isOnline = true
  } = params;

  const totalNeeded = Math.max(0, Number(requestedQuantity) || 0);
  let remainingToConsume = totalNeeded;
  let totalCostAcc = 0;

  const sortedLayers = sortLayersDeterministically(
    availableLayers.filter(l => l.status === 'active' && l.quantityRemaining > 0)
  );

  const layersConsumed: FifoLayerConsumption[] = [];
  const layerUpdates: LayerUpdate[] = [];

  for (const layer of sortedLayers) {
    if (remainingToConsume <= 0) break;

    const avail = Number(layer.quantityRemaining) || 0;
    if (avail <= 0) continue;

    const take = Math.min(remainingToConsume, avail);
    // Redondear a 4 decimales para cantidades con precisión métrica/rollo
    const roundedTake = Math.round(take * 10000) / 10000;
    const subtotal = Math.round(roundedTake * layer.unitCost * 10000) / 10000;

    totalCostAcc += subtotal;
    remainingToConsume = Math.round((remainingToConsume - roundedTake) * 10000) / 10000;

    const newRemaining = Math.max(0, Math.round((avail - roundedTake) * 10000) / 10000);
    const newStatus: 'active' | 'exhausted' = newRemaining <= 0 ? 'exhausted' : 'active';

    layersConsumed.push({
      layerId: layer.id,
      movementId: layer.movementId,
      date: layer.date,
      quantityConsumed: roundedTake,
      unitCost: layer.unitCost,
      currency: layer.currency || itemCurrency,
      subtotal,
      provider: layer.provider,
      invoiceReference: layer.invoiceReference
    });

    layerUpdates.push({
      layerId: layer.id,
      newRemaining,
      newStatus,
      quantityDeducted: roundedTake
    });
  }

  const isFullyCovered = remainingToConsume <= 0;
  const uncoveredQty = Math.max(0, remainingToConsume);

  // Si no se cubrió todo con capas reales (ej: saldo inicial sin compra registrada o compras no cargadas):
  if (uncoveredQty > 0) {
    const fallbackCost = uncoveredQty * catalogFallbackPrice;
    totalCostAcc += fallbackCost;
  }

  // Redondear costo total a 2 decimales estándar para dinero
  const finalTotalCost = Math.round(totalCostAcc * 100) / 100;
  const weightedUnitCost = totalNeeded > 0 
    ? Math.round((finalTotalCost / totalNeeded) * 10000) / 10000 
    : 0;

  const result: FifoConsumptionResult = {
    costMethod: layersConsumed.length > 0 ? 'FIFO' : 'CATALOG_FALLBACK',
    costingStatus: isOnline ? 'CONFIRMED' : 'PENDING_COSTING',
    totalQuantity: totalNeeded,
    totalCost: finalTotalCost,
    weightedUnitCost,
    currency: itemCurrency,
    layersConsumed,
    isFullyCoveredByLayers: isFullyCovered,
    uncoveredQuantity: uncoveredQty,
    uncoveredUnitCost: uncoveredQty > 0 ? catalogFallbackPrice : undefined
  };

  return {
    result,
    layerUpdates
  };
}

/**
 * Restaura cantidades a las capas originales en caso de una Devolución vinculada.
 */
export function calculateFifoReturnRestoration(params: {
  consumedLayers: FifoLayerConsumption[];
  quantityToReturn: number;
  currentLayersMap: Map<string, InventoryCostLayer>;
}): {
  restoredLayers: FifoLayerConsumption[];
  layerUpdates: LayerUpdate[];
  unrestoredQuantity: number;
} {
  const { consumedLayers, quantityToReturn, currentLayersMap } = params;

  let remainingToReturn = Math.max(0, Number(quantityToReturn) || 0);
  const restoredLayers: FifoLayerConsumption[] = [];
  const layerUpdates: LayerUpdate[] = [];

  // Se restauran en orden inverso de consumo (las últimas consumidas se restauran primero)
  const reversed = [...consumedLayers].reverse();

  for (const consumed of reversed) {
    if (remainingToReturn <= 0) break;

    const layer = currentLayersMap.get(consumed.layerId);
    if (!layer) continue;

    const maxCanRestore = consumed.quantityConsumed;
    const restoreAmount = Math.min(remainingToReturn, maxCanRestore);
    const roundedRestore = Math.round(restoreAmount * 10000) / 10000;

    const currentRem = Number(layer.quantityRemaining) || 0;
    const newRemaining = Math.round((currentRem + roundedRestore) * 10000) / 10000;

    remainingToReturn = Math.round((remainingToReturn - roundedRestore) * 10000) / 10000;

    restoredLayers.push({
      layerId: layer.id,
      movementId: layer.movementId,
      date: layer.date,
      quantityConsumed: -roundedRestore, // Cantidad negativa indica restauración
      unitCost: layer.unitCost,
      currency: layer.currency,
      subtotal: -Math.round(roundedRestore * layer.unitCost * 10000) / 10000,
      provider: layer.provider,
      invoiceReference: layer.invoiceReference
    });

    layerUpdates.push({
      layerId: layer.id,
      newRemaining,
      newStatus: 'active',
      quantityDeducted: -roundedRestore
    });
  }

  return {
    restoredLayers,
    layerUpdates,
    unrestoredQuantity: remainingToReturn
  };
}
