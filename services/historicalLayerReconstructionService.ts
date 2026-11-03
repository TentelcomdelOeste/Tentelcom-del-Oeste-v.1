import { InventoryItem } from '../inventoryTypes';
import { InventoryMovement } from '../inventoryMovementTypes';
import { InventoryCostLayer } from '../types/fifoCostTypes';
import { db } from '../firebase';
import { doc, collection, getDocs, query, orderBy, startAfter, limit, writeBatch } from 'firebase/firestore';

export const serviceName = "historicalLayerReconstructionService";

export interface ReconstructibleLayerPreview {
  layerId: string;
  movementId: string;
  movementRequestNumber: string | null;
  inventoryItemId: string;
  inventoryItemCode: string;
  inventoryItemName: string;
  date: string;
  quantityOriginal: number;
  quantityRemaining: number;
  unitCost: number; // Precio unitario de compra original (Sin IVA)
  currency: 'USD' | 'CRC';
  exchangeRate: number;
  provider: string;
  invoiceReference: string;
}

export interface ItemReconstructionDiagnostic {
  item: InventoryItem;
  physicalStock: number;
  currentCoveredQty: number;
  currentUncoveredQty: number;
  projectedCoveredQty: number;
  projectedUncoveredQty: number;
  statusBefore: 'OK' | 'UNCOVERED' | 'SURPLUS' | 'NO_STOCK';
  statusAfter: 'OK' | 'UNCOVERED' | 'SURPLUS' | 'NO_STOCK';
  candidateEntriesCount: number;
  totalHistoricalPurchaseQty: number;
  totalHistoricalOutputQty: number;
  hasDiscrepancy: boolean;
  uncoveredReason?: string;
  layersToCreate: ReconstructibleLayerPreview[];
}

export interface GlobalReconstructionDiagnostic {
  totalItemsAnalyzed: number;
  totalMovementsConsulted: number;
  totalCostLayersConsulted: number;
  oldestMovementDate: string | null;
  newestMovementDate: string | null;
  itemsWithIssuesBefore: number;
  itemsWithIssuesAfter: number;
  totalHistoricalEntriesWithCost: number;
  totalMissingLayersToCreate: number;
  totalUnitsToCover: number;
  totalUnitsRemainingUncovered: number;
  discrepancyCount: number;
  itemDiagnostics: ItemReconstructionDiagnostic[];
  tc008Diagnostic?: ItemReconstructionDiagnostic;
}

/**
 * CONSULTA PAGINADA COMPLETA DE FIRESTORE
 * Garantiza recorrer el 100% de los documentos de inventory_movements, inventory_items e inventory_cost_layers
 * sin detenerse en límites de página (p. ej. limit(50)) ni depender de la vista actual de la UI.
 */
export async function fetchAllInventoryDataFromFirestore(
  onProgress?: (stage: string, count: number) => void
): Promise<{
  items: InventoryItem[];
  movements: InventoryMovement[];
  costLayers: InventoryCostLayer[];
}> {
  // 1. Cargar todos los artículos de inventario
  if (onProgress) onProgress("Cargando catálogo completo de materiales...", 0);
  const itemsSnap = await getDocs(collection(db, "inventory_items"));
  const items = itemsSnap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem));

  // 2. Cargar todas las capas de costo existentes
  if (onProgress) onProgress("Cargando capas PEPS existentes...", 0);
  const layersSnap = await getDocs(collection(db, "inventory_cost_layers"));
  const costLayers = layersSnap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryCostLayer));

  // 3. Cargar el historial COMPLETO de movimientos con paginación por lotes
  const movements: InventoryMovement[] = [];
  let lastDoc: any = null;
  const BATCH_LIMIT = 500;
  let page = 0;

  while (true) {
    page++;
    if (onProgress) onProgress(`Cargando movimientos históricos (Lote ${page})...`, movements.length);

    let q = query(
      collection(db, "inventory_movements"),
      orderBy("createdAt", "asc"),
      limit(BATCH_LIMIT)
    );
    if (lastDoc) {
      q = query(
        collection(db, "inventory_movements"),
        orderBy("createdAt", "asc"),
        startAfter(lastDoc),
        limit(BATCH_LIMIT)
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) break;

    snap.docs.forEach(d => {
      movements.push({ ...d.data(), id: d.id } as InventoryMovement);
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_LIMIT) break;
  }

  if (onProgress) onProgress("Carga completa finalizada.", movements.length);

  return { items, movements, costLayers };
}

/**
 * DIAGNÓSTICO HISTÓRICO PEPS COMPLETO (SOLO LECTURA)
 * Analiza la trazabilidad cronológica de compras y consumos de cada material.
 * Aplica PEPS sobre el historial sin alterar stock ni escrituras.
 */
export function diagnoseHistoricalLayers(
  items: InventoryItem[],
  movements: InventoryMovement[],
  existingLayers: InventoryCostLayer[]
): GlobalReconstructionDiagnostic {
  const itemDiagnostics: ItemReconstructionDiagnostic[] = [];
  let totalHistoricalEntriesWithCost = 0;
  let totalMissingLayersToCreate = 0;
  let totalUnitsToCover = 0;
  let totalUnitsRemainingUncovered = 0;
  let itemsWithIssuesBefore = 0;
  let itemsWithIssuesAfter = 0;
  let discrepancyCount = 0;

  // Calcular rango de fechas de movimientos
  let oldestMovementDate: string | null = null;
  let newestMovementDate: string | null = null;

  const validMovementDates = movements
    .map(m => m.date || (m.createdAt ? m.createdAt.split('T')[0] : null))
    .filter((d): d is string => Boolean(d))
    .sort();

  if (validMovementDates.length > 0) {
    oldestMovementDate = validMovementDates[0];
    newestMovementDate = validMovementDates[validMovementDates.length - 1];
  }

  items.forEach(item => {
    const physicalStock = Math.max(0, item.stock || 0);

    // 1. Capas activas ya registradas en Firestore para este ítem
    const currentActiveLayers = existingLayers.filter(l => l.inventoryItemId === item.id && l.status === 'active');
    const currentCoveredQty = currentActiveLayers.reduce((sum, l) => sum + (l.quantityRemaining || 0), 0);
    const currentUncoveredQty = Math.max(0, physicalStock - currentCoveredQty);

    let statusBefore: 'OK' | 'UNCOVERED' | 'SURPLUS' | 'NO_STOCK' = 'OK';
    if (physicalStock === 0 && currentCoveredQty === 0) statusBefore = 'NO_STOCK';
    else if (currentUncoveredQty > 0) statusBefore = 'UNCOVERED';
    else if (currentCoveredQty > physicalStock) statusBefore = 'SURPLUS';

    if (statusBefore === 'UNCOVERED' || statusBefore === 'SURPLUS') {
      itemsWithIssuesBefore++;
    }

    // Si ya está 100% cubierto o no tiene stock físico, no requiere nuevas capas
    if (currentUncoveredQty <= 0) {
      itemDiagnostics.push({
        item,
        physicalStock,
        currentCoveredQty,
        currentUncoveredQty: 0,
        projectedCoveredQty: currentCoveredQty,
        projectedUncoveredQty: 0,
        statusBefore,
        statusAfter: statusBefore,
        candidateEntriesCount: 0,
        totalHistoricalPurchaseQty: 0,
        totalHistoricalOutputQty: 0,
        hasDiscrepancy: false,
        layersToCreate: []
      });
      return;
    }

    // 2. Extraer y estructurar todos los movimientos del ítem ordenados cronológicamente
    const itemMovements = movements.filter(m => {
      if (m.inventoryItemId === item.id) return true;
      if (m.items && Array.isArray(m.items)) {
        return m.items.some((i: any) => i.inventoryItemId === item.id);
      }
      return false;
    });

    // Ordenar cronológicamente (más antiguo a más reciente)
    itemMovements.sort((a, b) => {
      const dateA = a.date || (a.createdAt ? a.createdAt.split('T')[0] : '2026-01-01');
      const dateB = b.date || (b.createdAt ? b.createdAt.split('T')[0] : '2026-01-01');
      const dComp = dateA.localeCompare(dateB);
      if (dComp !== 0) return dComp;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Separar entradas y salidas
    interface HistoricalEntryCandidate {
      movementId: string;
      movementRequestNumber: string | null;
      date: string;
      createdAt: string;
      quantityOriginal: number;
      quantityAvailable: number; // Tras descontar consumos históricos pre-PEPS
      unitPrice: number;
      currency: 'USD' | 'CRC';
      provider: string;
      invoiceReference: string;
      index: number;
      hasExistingLayer: boolean;
    }

    const candidateEntries: HistoricalEntryCandidate[] = [];
    let totalHistoricalPurchaseQty = 0;
    let totalHistoricalOutputQty = 0;

    itemMovements.forEach(m => {
      const mDate = m.date || (m.createdAt ? m.createdAt.split('T')[0] : '2026-01-01');
      const mCreatedAt = m.createdAt || mDate || '2026-01-01T00:00:00.000Z';
      const isEntry = m.type === 'Entrada';
      const isOutput = m.type === 'Salida' || m.type === 'Despacho';

      if (m.items && Array.isArray(m.items) && m.items.length > 0) {
        m.items.forEach((it: any, idx: number) => {
          if (it.inventoryItemId === item.id) {
            const qty = Number(it.quantity) || 0;
            if (isEntry) {
              totalHistoricalPurchaseQty += qty;
              const price = Number(it.unitPrice !== undefined ? it.unitPrice : (it.unitCost !== undefined ? it.unitCost : m.unitPrice));
              if (qty > 0 && price > 0) {
                // Verificar si ya existe una capa en Firestore para esta entrada y este ítem
                const hasExistingLayer = existingLayers.some(l =>
                  l.movementId === m.id && l.inventoryItemId === item.id
                );
                candidateEntries.push({
                  movementId: m.id,
                  movementRequestNumber: m.requestNumber || null,
                  date: mDate,
                  createdAt: mCreatedAt,
                  quantityOriginal: qty,
                  quantityAvailable: qty,
                  unitPrice: price,
                  currency: (it.currency || m.currency || item.currency || 'CRC') as 'USD' | 'CRC',
                  provider: m.provider || m.origin || 'Compra Histórica',
                  invoiceReference: m.factura || m.reference || m.requestNumber || 'ENTRADA_HISTORICA',
                  index: idx,
                  hasExistingLayer
                });
              }
            } else if (isOutput) {
              totalHistoricalOutputQty += qty;
            }
          }
        });
      } else if (m.inventoryItemId === item.id) {
        const qty = Number(m.quantity) || 0;
        if (isEntry) {
          totalHistoricalPurchaseQty += qty;
          const price = Number(m.unitPrice !== undefined ? m.unitPrice : (m as any).unitCost);
          if (qty > 0 && price > 0) {
            const hasExistingLayer = existingLayers.some(l =>
              l.movementId === m.id && l.inventoryItemId === item.id
            );
            candidateEntries.push({
              movementId: m.id,
              movementRequestNumber: m.requestNumber || null,
              date: mDate,
              createdAt: mCreatedAt,
              quantityOriginal: qty,
              quantityAvailable: qty,
              unitPrice: price,
              currency: (m.currency || (m as any).moneda || item.currency || 'CRC') as 'USD' | 'CRC',
              provider: m.provider || m.origin || 'Compra Histórica',
              invoiceReference: m.factura || m.reference || m.requestNumber || 'ENTRADA_HISTORICA',
              index: 0,
              hasExistingLayer
            });
          }
        } else if (isOutput) {
          totalHistoricalOutputQty += qty;
        }
      }
    });

    totalHistoricalEntriesWithCost += candidateEntries.length;

    // 3. Simular consumo PEPS sobre entradas que NO tienen capa previa
    // Para las entradas sin capa existente, descontar las salidas históricas pre-PEPS en orden de antigüedad
    let pendingPreFifoOutputQty = totalHistoricalOutputQty;

    // Iterar sobre las entradas de la más antigua a la más reciente para descontar salidas pre-PEPS
    candidateEntries.forEach(entry => {
      if (entry.hasExistingLayer) {
        // Si ya tiene capa, la disponibilidad activa ya está contada en currentCoveredQty
        entry.quantityAvailable = 0;
      } else if (pendingPreFifoOutputQty > 0) {
        const consumed = Math.min(entry.quantityAvailable, pendingPreFifoOutputQty);
        entry.quantityAvailable -= consumed;
        pendingPreFifoOutputQty -= consumed;
      }
    });

    // 4. Asignar el stock descubierto (uncoveredQty) contra las entradas disponibles
    // Ordenar las entradas disponibles por fecha descendente (las compras más recientes disponibles primero)
    const availablePreFifoEntries = candidateEntries
      .filter(e => !e.hasExistingLayer && e.quantityAvailable > 0)
      .sort((a, b) => {
        const dComp = b.date.localeCompare(a.date);
        if (dComp !== 0) return dComp;
        return b.createdAt.localeCompare(a.createdAt);
      });

    const layersToCreateForItem: ReconstructibleLayerPreview[] = [];
    let remainingStockToCover = currentUncoveredQty;

    for (const entry of availablePreFifoEntries) {
      if (remainingStockToCover <= 0) break;

      const allocableQty = Math.min(remainingStockToCover, entry.quantityAvailable);

      if (allocableQty > 0) {
        const layerId = `layer_hist_${entry.movementId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${entry.index}`;

        layersToCreateForItem.push({
          layerId,
          movementId: entry.movementId,
          movementRequestNumber: entry.movementRequestNumber,
          inventoryItemId: item.id,
          inventoryItemCode: item.code,
          inventoryItemName: item.description,
          date: entry.date,
          quantityOriginal: entry.quantityOriginal,
          quantityRemaining: allocableQty,
          unitCost: entry.unitPrice,
          currency: entry.currency,
          exchangeRate: entry.currency === 'USD' ? 515 : 1,
          provider: entry.provider,
          invoiceReference: entry.invoiceReference
        });

        remainingStockToCover -= allocableQty;
        totalMissingLayersToCreate++;
        totalUnitsToCover += allocableQty;
      }
    }

    const projectedCoveredQty = physicalStock - remainingStockToCover;
    const projectedUncoveredQty = remainingStockToCover;

    let statusAfter: 'OK' | 'UNCOVERED' | 'SURPLUS' | 'NO_STOCK' = 'OK';
    if (physicalStock === 0 && projectedCoveredQty === 0) statusAfter = 'NO_STOCK';
    else if (projectedUncoveredQty > 0) statusAfter = 'UNCOVERED';
    else if (projectedCoveredQty > physicalStock) statusAfter = 'SURPLUS';

    if (statusAfter === 'UNCOVERED' || statusAfter === 'SURPLUS') {
      itemsWithIssuesAfter++;
    }

    let uncoveredReason: string | undefined = undefined;
    let hasDiscrepancy = false;

    if (projectedUncoveredQty > 0) {
      totalUnitsRemainingUncovered += projectedUncoveredQty;

      if (candidateEntries.length === 0) {
        uncoveredReason = `Sin compras o entradas registradas en el historial para este artículo.`;
      } else if (physicalStock > totalHistoricalPurchaseQty) {
        hasDiscrepancy = true;
        discrepancyCount++;
        uncoveredReason = `Stock físico (${physicalStock}u) supera el total acumulado de compras históricas (${totalHistoricalPurchaseQty}u). (${projectedUncoveredQty}u sin respaldo de compra).`;
      } else {
        uncoveredReason = `Las compras disponibles sin capa (${candidateEntries.reduce((acc, c) => acc + c.quantityAvailable, 0)}u) ya fueron consumidas por salidas históricas. (${projectedUncoveredQty}u pendientes de regularizar).`;
      }
    }

    const itemDiag: ItemReconstructionDiagnostic = {
      item,
      physicalStock,
      currentCoveredQty,
      currentUncoveredQty,
      projectedCoveredQty,
      projectedUncoveredQty,
      statusBefore,
      statusAfter,
      candidateEntriesCount: candidateEntries.length,
      totalHistoricalPurchaseQty,
      totalHistoricalOutputQty,
      hasDiscrepancy,
      uncoveredReason,
      layersToCreate: layersToCreateForItem
    };

    itemDiagnostics.push(itemDiag);
  });

  const tc008Diagnostic = itemDiagnostics.find(d => d.item.code === 'TC008');

  return {
    totalItemsAnalyzed: items.length,
    totalMovementsConsulted: movements.length,
    totalCostLayersConsulted: existingLayers.length,
    oldestMovementDate,
    newestMovementDate,
    itemsWithIssuesBefore,
    itemsWithIssuesAfter,
    totalHistoricalEntriesWithCost,
    totalMissingLayersToCreate,
    totalUnitsToCover,
    totalUnitsRemainingUncovered,
    discrepancyCount,
    itemDiagnostics,
    tc008Diagnostic
  };
}

/**
 * APLICA LA RECONSTRUCCIÓN EN LOTES SEGUROS DE HASTA 400 OPERACIONES.
 * Idempotente: no duplica capas existentes.
 * Permite callback de progreso para informar al usuario.
 */
export async function applyHistoricalLayerReconstruction(
  diagnosticResult: GlobalReconstructionDiagnostic,
  userEmail: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; createdCount: number }> {
  let createdCount = 0;
  const nowIso = new Date().toISOString();

  const allLayersToCreate: ReconstructibleLayerPreview[] = [];
  diagnosticResult.itemDiagnostics.forEach(diag => {
    allLayersToCreate.push(...diag.layersToCreate);
  });

  if (allLayersToCreate.length === 0) {
    return { success: true, createdCount: 0 };
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < allLayersToCreate.length; i += BATCH_SIZE) {
    const chunk = allLayersToCreate.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(preview => {
      const layerRef = doc(db, 'inventory_cost_layers', preview.layerId);
      const fullLayer: InventoryCostLayer = {
        id: preview.layerId,
        inventoryItemId: preview.inventoryItemId,
        inventoryItemCode: preview.inventoryItemCode,
        inventoryItemName: preview.inventoryItemName,
        movementId: preview.movementId,
        movementRequestNumber: preview.movementRequestNumber,
        date: preview.date,
        quantityOriginal: preview.quantityOriginal,
        quantityRemaining: preview.quantityRemaining,
        unitCost: preview.unitCost,
        currency: preview.currency,
        exchangeRate: preview.exchangeRate,
        unitCostNormalized: preview.unitCost,
        provider: preview.provider,
        invoiceReference: preview.invoiceReference,
        iva: preview.unitCost * 0.13,
        taxRate: 0.13,
        status: 'active',
        createdAt: nowIso,
        createdBy: userEmail || 'Sistema (Reconstrucción Histórica)',
        updatedAt: nowIso
      };

      batch.set(layerRef, fullLayer, { merge: true });
      createdCount++;
    });

    await batch.commit();

    if (onProgress) {
      onProgress(Math.min(createdCount, allLayersToCreate.length), allLayersToCreate.length);
    }
  }

  return { success: true, createdCount };
}
