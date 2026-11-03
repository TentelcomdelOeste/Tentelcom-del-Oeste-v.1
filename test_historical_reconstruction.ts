import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { diagnoseHistoricalLayers } from './services/historicalLayerReconstructionService';
import { InventoryItem } from './inventoryTypes';
import { InventoryMovement } from './inventoryMovementTypes';
import { InventoryCostLayer } from './types/fifoCostTypes';

async function runDiagnosticTest() {
  console.log("==================================================");
  console.log("🧪 DIAGNÓSTICO REAL DE RECONSTRUCCIÓN DE CAPAS PEPS");
  console.log("==================================================\n");

  const [itemsSnap, movsSnap, layersSnap] = await Promise.all([
    getDocs(collection(db, "inventory_items")),
    getDocs(collection(db, "inventory_movements")),
    getDocs(collection(db, "inventory_cost_layers"))
  ]);

  const items: InventoryItem[] = [];
  itemsSnap.forEach(d => items.push({ id: d.id, ...d.data() } as InventoryItem));

  const movements: InventoryMovement[] = [];
  movsSnap.forEach(d => movements.push({ id: d.id, ...d.data() } as InventoryMovement));

  const layers: InventoryCostLayer[] = [];
  layersSnap.forEach(d => layers.push({ id: d.id, ...d.data() } as InventoryCostLayer));

  const diagnostic = diagnoseHistoricalLayers(items, movements, layers);

  console.log("📊 RESULTADO DEL DIAGNÓSTICO GLOBAL:");
  console.log(`  Artículos analizados: ${diagnostic.totalItemsAnalyzed}`);
  console.log(`  Artículos con pendientes ANTES: ${diagnostic.itemsWithIssuesBefore}`);
  console.log(`  Artículos con pendientes DESPUÉS: ${diagnostic.itemsWithIssuesAfter}`);
  console.log(`  Entradas históricas con precio encontradas: ${diagnostic.totalHistoricalEntriesWithCost}`);
  console.log(`  Capas faltantes que se pueden reconstruir: ${diagnostic.totalMissingLayersToCreate}`);
  console.log(`  Unidades físicas que quedarán cubiertas: ${diagnostic.totalUnitsToCover}`);

  if (diagnostic.tc008Diagnostic) {
    const tc008 = diagnostic.tc008Diagnostic;
    console.log("\n📦 DETALLE ESPECÍFICO DEL CASO TC008:");
    console.log(`  Código: ${tc008.item.code} - ${tc008.item.description}`);
    console.log(`  Stock Físico Actual: ${tc008.physicalStock} unidades`);
    console.log(`  Cobertura ANTES: ${tc008.currentCoveredQty} cubiertas, ${tc008.currentUncoveredQty} sin capa (Estado: ${tc008.statusBefore})`);
    console.log(`  Capas candidatas a crear: ${tc008.layersToCreate.length}`);
    tc008.layersToCreate.forEach((l, idx) => {
      console.log(`    [Capa ${idx + 1}] MovId: ${l.movementId} | Date: ${l.date} | Cantidad a Cubrir: ${l.quantityRemaining}/${l.quantityOriginal} | Precio Compra Original: ₡${l.unitCost}`);
    });
    console.log(`  Cobertura DESPUÉS: ${tc008.projectedCoveredQty} cubiertas, ${tc008.projectedUncoveredQty} sin capa (Estado: ${tc008.statusAfter})`);
  }

  process.exit(0);
}

runDiagnosticTest().catch(err => {
  console.error(err);
  process.exit(1);
});
