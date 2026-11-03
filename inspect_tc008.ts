import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspectData() {
  console.log("=========================================");
  console.log("🔍 INSPECCIÓN FORENSE TC008 Y CAPAS PEPS");
  console.log("=========================================\n");

  // 1. Obtener el item TC008
  const qItem = query(collection(db, "inventory_items"), where("code", "==", "TC008"));
  const itemSnap = await getDocs(qItem);

  let targetItem: any = null;
  itemSnap.forEach(d => {
    targetItem = { id: d.id, ...d.data() };
  });

  if (!targetItem) {
    console.log("⚠️ No se encontró el ítem TC008 por código directo. Buscando todos los artículos...");
    const allItemsSnap = await getDocs(collection(db, "inventory_items"));
    allItemsSnap.forEach(d => {
      const data = d.data();
      if (data.code === 'TC008' || (data.description && data.description.includes('ABRAZADERA'))) {
        targetItem = { id: d.id, ...data };
      }
    });
  }

  if (targetItem) {
    console.log("📦 ÍTEM ENCONTRADO:", {
      id: targetItem.id,
      code: targetItem.code,
      description: targetItem.description,
      stock: targetItem.stock,
      price: targetItem.price,
      currency: targetItem.currency
    });
  } else {
    console.log("❌ No se encontró ningún artículo TC008.");
  }

  // 2. Obtener movimientos de TC008
  const movsSnap = await getDocs(collection(db, "inventory_movements"));
  const tc008Movs: any[] = [];
  movsSnap.forEach(d => {
    const data = d.data();
    const movId = d.id;
    const isTarget = targetItem 
      ? (data.inventoryItemId === targetItem.id || (data.items && data.items.some((i: any) => i.inventoryItemId === targetItem.id)))
      : (data.inventoryItemCode === 'TC008' || (data.items && data.items.some((i: any) => i.inventoryItemCode === 'TC008')));

    if (isTarget) {
      tc008Movs.push({ id: movId, ...data });
    }
  });

  console.log(`\n📋 MOVIMIENTOS ENCONTRADOS PARA TC008: ${tc008Movs.length}`);
  let totalEntradas = 0;
  let totalSalidas = 0;
  let totalDevoluciones = 0;

  tc008Movs.forEach((m, idx) => {
    let qty = m.quantity || 0;
    let unitCost = m.unitPrice;
    if (m.items && Array.isArray(m.items)) {
      const detail = m.items.find((i: any) => targetItem ? i.inventoryItemId === targetItem.id : i.inventoryItemCode === 'TC008');
      if (detail) {
        qty = detail.quantity;
        unitCost = detail.unitPrice !== undefined ? detail.unitPrice : detail.unitCost;
      }
    }

    if (m.type === 'Entrada') totalEntradas += qty;
    if (m.type === 'Salida') totalSalidas += qty;
    if (m.type === 'Devolución') totalDevoluciones += qty;

    console.log(`  [${idx + 1}] Tipo: ${m.type} | Fecha: ${m.date || m.createdAt} | Cant: ${qty} | UnitPrice: ${unitCost} | Ref: ${m.requestNumber || m.reference || 'S/R'}`);
  });

  console.log(`\n📊 RESUMEN HISTÓRICO DE MOVIMIENTOS TC008:`);
  console.log(`  Total Entradas: ${totalEntradas}`);
  console.log(`  Total Salidas: ${totalSalidas}`);
  console.log(`  Total Devoluciones: ${totalDevoluciones}`);
  console.log(`  Saldo Teórico Histórico: ${totalEntradas - totalSalidas + totalDevoluciones}`);
  console.log(`  Stock Físico en Registro de Artículo: ${targetItem?.stock || 0}`);

  // 3. Obtener Capas de Costo de TC008
  const layersSnap = await getDocs(collection(db, "inventory_cost_layers"));
  const tc008Layers: any[] = [];
  layersSnap.forEach(d => {
    const data = d.data();
    if (targetItem && data.inventoryItemId === targetItem.id) {
      tc008Layers.push({ id: d.id, ...data });
    }
  });

  console.log(`\n🧱 CAPAS DE COSTO ACTUALES FIRESTORE PARA TC008: ${tc008Layers.length}`);
  tc008Layers.forEach((l, idx) => {
    console.log(`  [${idx + 1}] ID: ${l.id} | MovId: ${l.movementId} | Date: ${l.date} | Remanente: ${l.quantityRemaining}/${l.quantityOriginal} | CostoUnit: ${l.unitCost} | Moneda: ${l.currency} | Status: ${l.status}`);
  });

  // 4. Analizar el total de capas en todo el inventario
  let totalCapasGlobal = layersSnap.size;
  let totalEntradasGlobal = 0;
  let entradasSinCapaCount = 0;

  movsSnap.forEach(d => {
    const m = d.data();
    if (m.type === 'Entrada') {
      totalEntradasGlobal++;
      const movId = d.id;
      // Verificar si existe alguna capa vinculada a esta entrada
      let hasLayer = false;
      layersSnap.forEach(lDoc => {
        if (lDoc.data().movementId === movId) hasLayer = true;
      });
      if (!hasLayer) entradasSinCapaCount++;
    }
  });

  console.log(`\n🌐 RESUMEN GLOBAL EN TODO EL SISTEMA:`);
  console.log(`  Total Movimientos de Entrada: ${totalEntradasGlobal}`);
  console.log(`  Total Capas Existentes en BD: ${totalCapasGlobal}`);
  console.log(`  Entradas de Compra sin Capa PEPS registrada: ${entradasSinCapaCount}`);
}

inspectData().catch(console.error);
