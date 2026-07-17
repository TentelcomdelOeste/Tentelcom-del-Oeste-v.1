import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

export const seedData = async () => {
  console.log("🔥 EJECUTANDO SEED REAL...");

  // 1. material_reports
  const reports = [
    {
      requestNumber: "SOL-0001",
      projectName: "IBUX-CLARO",
      origin: "IBUX-CLARO",
      fdh: "FDH0101",
      torre: "MTR0101",
      locationDetails: "San José",
      date: new Date().toISOString().split('T')[0],
      items: [
        { code: "TC081", description: "SPRAY ROJO", quantity: 2 },
        { code: "TC085", description: "TAPE NEGRO CONINCA", quantity: 5 }
      ]
    },
    {
      requestNumber: "SOL-0002",
      projectName: "IBUX-CLARO",
      origin: "IBUX-CLARO",
      fdh: "PRUEBA2",
      torre: "PRUEBA2",
      locationDetails: "San Rafael",
      date: new Date().toISOString().split('T')[0],
      items: [
        { code: "TC103", description: "TAPE ROJO", quantity: 10 }
      ]
    },
    {
      requestNumber: "SOL-0003",
      projectName: "PROYECTO INTERNO",
      origin: "BODEGA",
      fdh: "FDH0202",
      torre: "MTR0202",
      locationDetails: "Alajuela",
      date: new Date().toISOString().split('T')[0],
      items: [
        { code: "TC200", description: "CABLE FO", quantity: 50 }
      ]
    }
  ];

  for (const report of reports) {
    const q = query(collection(db, "material_reports"), where("requestNumber", "==", report.requestNumber));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await addDoc(collection(db, "material_reports"), report);
      console.log(`✅ Creado: material_reports/${report.requestNumber}`);
    } else {
      console.log(`ℹ️ Ya existe: material_reports/${report.requestNumber}`);
    }
  }

  // 2. material_dispatches
  const dispatches = [
    {
      dispatchId: "DISP-001",
      requestNumber: "SOL-0001",
      origin: "IBUX-CLARO",
      fdh: "FDH0101",
      torre: "MTR0101",
      locationDetails: "San José",
      date: new Date()
    },
    {
      dispatchId: "DISP-002",
      requestNumber: "SOL-0002",
      origin: "IBUX-CLARO",
      fdh: "PRUEBA2",
      torre: "PRUEBA2",
      locationDetails: "San Rafael",
      date: new Date()
    }
  ];

  for (const dispatch of dispatches) {
    const q = query(collection(db, "material_dispatches"), where("dispatchId", "==", dispatch.dispatchId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await addDoc(collection(db, "material_dispatches"), dispatch);
      console.log(`✅ Creado: material_dispatches/${dispatch.dispatchId}`);
    } else {
      console.log(`ℹ️ Ya existe: material_dispatches/${dispatch.dispatchId}`);
    }
  }

  // 3. inventory_movements
  const movements = [
    {
      type: "Salida",
      requestNumber: "SOL-0001",
      dispatchId: "DISP-001",
      origin: "IBUX-CLARO",
      fdh: "FDH0101",
      torre: "MTR0101",
      locationDetails: "San José",
      items: [
        { inventoryItemCode: "TC081", inventoryItemName: "SPRAY ROJO", quantity: 2 }
      ],
      date: new Date().toISOString().split('T')[0]
    },
    {
      type: "Salida",
      requestNumber: "SOL-0002",
      dispatchId: "DISP-002",
      origin: "IBUX-CLARO",
      fdh: "PRUEBA2",
      torre: "PRUEBA2",
      locationDetails: "San Rafael",
      items: [
        { inventoryItemCode: "TC103", inventoryItemName: "TAPE ROJO", quantity: 5 }
      ],
      date: new Date().toISOString().split('T')[0]
    },
    {
      type: "Devolución",
      requestNumber: "SOL-0001",
      dispatchId: "DISP-001",
      origin: "IBUX-CLARO",
      fdh: "FDH0101",
      torre: "MTR0101",
      locationDetails: "San José",
      items: [
        { inventoryItemCode: "TC081", inventoryItemName: "SPRAY ROJO", quantity: 1 }
      ],
      date: new Date().toISOString().split('T')[0]
    }
  ];

  for (const movement of movements) {
    // Para movimientos, validamos por requestNumber + tipo + dispatchId para evitar duplicados
    const q = query(collection(db, "inventory_movements"), 
      where("requestNumber", "==", movement.requestNumber),
      where("type", "==", movement.type),
      where("dispatchId", "==", movement.dispatchId)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await addDoc(collection(db, "inventory_movements"), movement);
      console.log(`✅ Creado: inventory_movements/${movement.requestNumber}-${movement.type}`);
    } else {
      console.log(`ℹ️ Ya existe: inventory_movements/${movement.requestNumber}-${movement.type}`);
    }
  }
  
  console.log("✅ SEED FINALIZADO");
};
