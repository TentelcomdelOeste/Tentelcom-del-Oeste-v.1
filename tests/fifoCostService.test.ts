import { 
  prepareEntryCostLayer, 
  sortLayersDeterministically, 
  calculateFifoConsumption, 
  calculateFifoReturnRestoration,
  generateCostLayerId
} from '../services/fifoCostService';
import { 
  diagnoseHistoricalLayers, 
  ItemReconstructionDiagnostic 
} from '../services/historicalLayerReconstructionService';
import { InventoryCostLayer } from '../types/fifoCostTypes';
import { InventoryItem } from '../inventoryTypes';
import { InventoryMovement } from '../inventoryMovementTypes';

function runTests() {
  console.log('=====================================================');
  console.log('🧪 EJECUTANDO PRUEBAS OBLIGATORIAS DE COSTEO Y RECONSTRUCCIÓN PEPS');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  // PRUEBA 1: Una entrada y una salida parcial de una sola capa
  {
    const layer = prepareEntryCostLayer({
      movementId: 'MOV-001',
      itemId: 'ITEM-1',
      itemCode: 'TC001',
      quantity: 50,
      unitPrice: 100,
      currency: 'CRC',
      date: '2026-10-01',
      userEmail: 'test@tentelcom.com'
    });

    const { result, layerUpdates } = calculateFifoConsumption({
      availableLayers: [layer],
      requestedQuantity: 20,
      catalogFallbackPrice: 150,
      itemCurrency: 'CRC'
    });

    assert(result.totalCost === 2000, 'Prueba 1: Costo total debe ser 20 * 100 = 2000');
    assert(result.weightedUnitCost === 100, 'Prueba 1: Costo unitario ponderado debe ser 100');
    assert(layerUpdates[0].newRemaining === 30, 'Prueba 1: Capa debe quedar con 30 restantes');
    assert(layerUpdates[0].newStatus === 'active', 'Prueba 1: Capa debe permanecer activa');
    assert(result.isFullyCoveredByLayers === true, 'Prueba 1: Completamente cubierto por capas');
  }

  // PRUEBA 2: Dos entradas con costos distintos y una salida que consume ambas (Ejemplo Oficial)
  {
    const layerA = prepareEntryCostLayer({
      movementId: 'MOV-A',
      itemId: 'ITEM-2',
      itemCode: 'TC002',
      quantity: 10,
      unitPrice: 1000,
      currency: 'CRC',
      date: '2026-10-01',
      userEmail: 'test@tentelcom.com',
      index: 0
    });

    const layerB = prepareEntryCostLayer({
      movementId: 'MOV-B',
      itemId: 'ITEM-2',
      itemCode: 'TC002',
      quantity: 20,
      unitPrice: 1200,
      currency: 'CRC',
      date: '2026-10-05',
      userEmail: 'test@tentelcom.com',
      index: 0
    });

    const { result, layerUpdates } = calculateFifoConsumption({
      availableLayers: [layerA, layerB],
      requestedQuantity: 15,
      catalogFallbackPrice: 1500,
      itemCurrency: 'CRC'
    });

    assert(result.totalCost === 16000, 'Prueba 2: Costo total debe ser exactamente ₡16.000');
    assert(Math.abs(result.weightedUnitCost - 1066.6667) < 0.01, 'Prueba 2: Costo ponderado ~₡1.066,67');
    assert(result.layersConsumed.length === 2, 'Prueba 2: Debe consumir exactamente 2 capas');
    assert(result.layersConsumed[0].quantityConsumed === 10 && result.layersConsumed[0].unitCost === 1000, 'Prueba 2: 10 unidades de Capa A @ 1000');
    assert(result.layersConsumed[1].quantityConsumed === 5 && result.layersConsumed[1].unitCost === 1200, 'Prueba 2: 5 unidades de Capa B @ 1200');

    const updateA = layerUpdates.find(u => u.layerId === layerA.id);
    const updateB = layerUpdates.find(u => u.layerId === layerB.id);

    assert(updateA?.newRemaining === 0 && updateA?.newStatus === 'exhausted', 'Prueba 2: Capa A debe quedar agotada');
    assert(updateB?.newRemaining === 15 && updateB?.newStatus === 'active', 'Prueba 2: Capa B debe quedar con 15 remanente');
  }

  // PRUEBA 3: Capas con fechas iguales y desempate determinista
  {
    const layer1: InventoryCostLayer = {
      id: 'layer_C',
      inventoryItemId: 'ITEM-3',
      inventoryItemCode: 'TC003',
      movementId: 'M3',
      date: '2026-10-10',
      quantityOriginal: 10,
      quantityRemaining: 10,
      unitCost: 500,
      currency: 'CRC',
      unitCostNormalized: 500,
      status: 'active',
      createdAt: '2026-10-10T10:00:00.000Z',
      createdBy: 'u1',
      updatedAt: '2026-10-10T10:00:00.000Z'
    };

    const layer2: InventoryCostLayer = {
      id: 'layer_A',
      inventoryItemId: 'ITEM-3',
      inventoryItemCode: 'TC003',
      movementId: 'M1',
      date: '2026-10-10',
      quantityOriginal: 10,
      quantityRemaining: 10,
      unitCost: 400,
      currency: 'CRC',
      unitCostNormalized: 400,
      status: 'active',
      createdAt: '2026-10-10T08:00:00.000Z',
      createdBy: 'u1',
      updatedAt: '2026-10-10T08:00:00.000Z'
    };

    const sorted = sortLayersDeterministically([layer1, layer2]);
    assert(sorted[0].id === 'layer_A', 'Prueba 3: Desempate por createdAt debe priorizar layer_A creada a las 08:00');
  }

  // PRUEBA 4: Reconstrucción Histórica - Caso TC008 (1 Entrada 100u @ ₡2.312,50, 34u Salidas, 66u Stock)
  {
    const tc008Item: InventoryItem = {
      id: 'item_tc008',
      code: 'TC008',
      description: 'ABRAZADERA DE 7"',
      stock: 66,
      price: 2312.5,
      currency: 'CRC',
      category: 'ACCESORIOS'
    };

    const tc008Entry: InventoryMovement = {
      id: 'MOV-0037',
      type: 'Entrada',
      inventoryItemId: 'item_tc008',
      inventoryItemCode: 'TC008',
      quantity: 100,
      unitPrice: 2312.5,
      currency: 'CRC',
      date: '2026-10-01',
      createdAt: '2026-10-01T10:00:00.000Z',
      origin: 'Proveedor Nacional'
    };

    const tc008Output: InventoryMovement = {
      id: 'MOV-0050',
      type: 'Salida',
      inventoryItemId: 'item_tc008',
      inventoryItemCode: 'TC008',
      quantity: 34,
      unitPrice: 2312.5,
      currency: 'CRC',
      date: '2026-10-15',
      createdAt: '2026-10-15T14:00:00.000Z'
    };

    const diag = diagnoseHistoricalLayers([tc008Item], [tc008Entry, tc008Output], []);
    const tcDiag = diag.itemDiagnostics[0];

    assert(tcDiag.projectedCoveredQty === 66, 'Prueba 4 (TC008): Debe cubrir 66 unidades de stock físico');
    assert(tcDiag.layersToCreate.length === 1, 'Prueba 4 (TC008): Debe crear 1 capa reconstituida');
    assert(tcDiag.layersToCreate[0].unitCost === 2312.5, 'Prueba 4 (TC008): El costo unitario debe ser exactamente ₡2.312,50');
    assert(tcDiag.statusAfter === 'OK', 'Prueba 4 (TC008): El estado final debe ser OK (100% cubierto)');
  }

  // PRUEBA 5: Reconstrucción Histórica - Múltiples Compras a Precios Distintos
  {
    const multiItem: InventoryItem = {
      id: 'item_multi',
      code: 'TC_MULTI',
      description: 'CABLE MULTIPAR',
      stock: 60,
      price: 15,
      currency: 'USD',
      category: 'CABLES'
    };

    const entry1: InventoryMovement = {
      id: 'MOV-E1',
      type: 'Entrada',
      inventoryItemId: 'item_multi',
      quantity: 50,
      unitPrice: 10,
      currency: 'USD',
      date: '2026-05-01',
      createdAt: '2026-05-01T10:00:00.000Z'
    };

    const entry2: InventoryMovement = {
      id: 'MOV-E2',
      type: 'Entrada',
      inventoryItemId: 'item_multi',
      quantity: 50,
      unitPrice: 15,
      currency: 'USD',
      date: '2026-08-01',
      createdAt: '2026-08-01T10:00:00.000Z'
    };

    const output1: InventoryMovement = {
      id: 'MOV-S1',
      type: 'Salida',
      inventoryItemId: 'item_multi',
      quantity: 40,
      date: '2026-06-01',
      createdAt: '2026-06-01T10:00:00.000Z'
    };

    const diag = diagnoseHistoricalLayers([multiItem], [entry1, entry2, output1], []);
    const itemDiag = diag.itemDiagnostics[0];

    assert(itemDiag.projectedCoveredQty === 60, 'Prueba 5: Debe cubrir 60 unidades en total');
    assert(itemDiag.layersToCreate.length === 2, 'Prueba 5: Debe generar 2 capas (10u @ $10 y 50u @ $15)');
    assert(itemDiag.layersToCreate.some(l => l.unitCost === 10 && l.quantityRemaining === 10), 'Prueba 5: Capa 1 de 10u @ $10');
    assert(itemDiag.layersToCreate.some(l => l.unitCost === 15 && l.quantityRemaining === 50), 'Prueba 5: Capa 2 de 50u @ $15');
  }

  // PRUEBA 6: Material con Stock Superior a Compras Registradas (Discrepancia)
  {
    const discItem: InventoryItem = {
      id: 'item_disc',
      code: 'TC_DISC',
      description: 'TERMINAL OPTICA',
      stock: 100,
      price: 500,
      currency: 'CRC',
      category: 'EQUIPOS'
    };

    const entryOnly60: InventoryMovement = {
      id: 'MOV-ONLY60',
      type: 'Entrada',
      inventoryItemId: 'item_disc',
      quantity: 60,
      unitPrice: 500,
      currency: 'CRC',
      date: '2026-01-01',
      createdAt: '2026-01-01T10:00:00.000Z'
    };

    const diag = diagnoseHistoricalLayers([discItem], [entryOnly60], []);
    const itemDiag = diag.itemDiagnostics[0];

    assert(itemDiag.projectedCoveredQty === 60, 'Prueba 6: Debe cubrir 60u respaldadas por compra');
    assert(itemDiag.projectedUncoveredQty === 40, 'Prueba 6: Deben quedar 40u pendientes SIN CAPA');
    assert(itemDiag.hasDiscrepancy === true, 'Prueba 6: Marca bandera de discrepancia (stock > compras)');
    assert(diag.discrepancyCount === 1, 'Prueba 6: Incrementa contador global de discrepancias');
  }

  // PRUEBA 7: Reejecución Idempotente (Capas Ya Existentes)
  {
    const existingItem: InventoryItem = {
      id: 'item_ex',
      code: 'TC_EX',
      description: 'CONECTOR RJ45',
      stock: 100,
      price: 50,
      currency: 'CRC'
    };

    const existingLayer: InventoryCostLayer = {
      id: 'layer_hist_MOV-EX_item_ex_0',
      inventoryItemId: 'item_ex',
      inventoryItemCode: 'TC_EX',
      movementId: 'MOV-EX',
      date: '2026-01-01',
      quantityOriginal: 100,
      quantityRemaining: 100,
      unitCost: 50,
      currency: 'CRC',
      status: 'active',
      createdAt: '2026-01-01T10:00:00.000Z'
    };

    const entryMov: InventoryMovement = {
      id: 'MOV-EX',
      type: 'Entrada',
      inventoryItemId: 'item_ex',
      quantity: 100,
      unitPrice: 50,
      currency: 'CRC',
      date: '2026-01-01'
    };

    const diag = diagnoseHistoricalLayers([existingItem], [entryMov], [existingLayer]);
    const itemDiag = diag.itemDiagnostics[0];

    assert(itemDiag.currentCoveredQty === 100, 'Prueba 7: Ya está 100% cubierto por capa existente');
    assert(itemDiag.layersToCreate.length === 0, 'Prueba 7: No crea capas duplicadas');
    assert(itemDiag.statusAfter === 'OK', 'Prueba 7: Estado final permanece en OK');
  }

  console.log('\n=====================================================');
  console.log(`📊 RESULTADO DE LA SUITE DE PRUEBAS: ${passed} PASADAS / ${failed} FALLIDAS`);
  console.log('=====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
