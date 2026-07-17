
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LOGO_BASE64 } from '../logoBase64';
import { InventoryMovement } from '../../inventoryMovementTypes';
import { normalizeOrigin } from '../originUtils';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { triggerFileDownload } from '../fileUtils';

export const exportMovementToExcel = (movement: InventoryMovement) => {
  const data = (movement.items && movement.items.length > 0) 
    ? movement.items.map(item => ({
        'Código': item.inventoryItemCode,
        'Descripción': item.inventoryItemName,
        'Tipo': movement.type,
        'Cantidad': item.quantity,
        'Proyecto': movement.projectName || '---',
        'Usuario': movement.userName,
        'Fecha': movement.date,
        'Moneda': item.currency,
        'Precio Unitario': item.unitPrice,
        'Total': item.quantity * item.unitPrice
      }))
    : [{
        'Código': movement.inventoryItemCode,
        'Descripción': movement.inventoryItemName,
        'Tipo': movement.type,
        'Cantidad': movement.quantity,
        'Proyecto': movement.projectName || '---',
        'Usuario': movement.userName,
        'Fecha': movement.date,
        'Moneda': movement.currency,
        'Precio Unitario': movement.unitPrice,
        'Total': movement.quantity * (movement.unitPrice || 0)
      }];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimiento');
  XLSX.writeFile(wb, `Movimiento_${movement.id.substring(0, 8)}.xlsx`);
};

export const exportMovementToPdf = async (movement: InventoryMovement, linkedRequest?: any) => {
  let request = linkedRequest || null;

  if (!request && movement.requestNumber) {
    const snapshot = await getDocs(
      query(
        collection(db, "material_reports"),
        where("requestNumber", "==", movement.requestNumber)
      )
    );

    if (!snapshot.empty) {
      request = snapshot.docs[0].data();
    }
  }


  if (!request) {
    console.warn("⚠️ NO SE ENCONTRÓ REQUEST PARA ESTE MOVIMIENTO");
  }

  const doc = new jsPDF('p', 'pt', 'letter');
  const margin = 40;
  const pageWidth = doc.internal.pageSize.width;

  // Header
  try {
    const logoData = LOGO_BASE64;
    doc.addImage(logoData, 'PNG', margin, margin, 90, 0);
  } catch (e) {
    console.error('Error adding logo to PDF:', e);
  }

  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  let title = "DETALLE DE MOVIMIENTO";
  switch (movement.type) {
    case 'Salida':
      title = "ENTREGA DE MATERIALES";
      break;
    case 'Entrada':
      title = "ENTRADA DE MATERIALES";
      break;
    case 'Devolución':
      title = "DEVOLUCIÓN DE MATERIALES";
      break;
  }
  doc.text(title, pageWidth / 2, margin + 25, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text("Registro de materiales para control y trazabilidad de inventario", pageWidth / 2, margin + 40, { align: 'center' });
  
  // Material Request style header box
  const boxY = margin + 95;
  doc.setDrawColor(230, 230, 250);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, boxY, pageWidth - 2 * margin, 80, 5, 5, 'FD');
  
  // Centralized metadata object
  const metadata = {
    proyecto: normalizeOrigin(
      movement.origin ||
      request?.origin ||
      movement.projectName ||
      request?.projectName ||
      "---"
    ),
    fecha: 
      movement.date ||
      request?.date ||
      "---",
    fdh: 
      movement.fdh ||
      request?.fdh ||
      "---",
    torre: 
      movement.tower ||
      movement.torre ||
      request?.tower ||
      request?.torre ||
      "---",
    lugar: 
      movement.locationDetails ||
      request?.locationDetails ||
      "---",
    solicitud: 
      movement.requestNumber ||
      request?.requestNumber ||
      "---",
    cotizacion:
      movement.projectCode ||
      request?.projectCode ||
      "---",
    observaciones:
      movement.observations ||
      request?.observations ||
      ""
  };

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  
  doc.text(`Proyecto:`, margin + 10, boxY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(`${metadata.proyecto}`, margin + 70, boxY + 20);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`ID Solicitud:`, margin + 300, boxY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(`${metadata.solicitud}`, margin + 370, boxY + 20);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha:`, margin + 10, boxY + 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`${metadata.fecha}`, margin + 70, boxY + 40);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Cotización:`, margin + 300, boxY + 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`${metadata.cotizacion}`, margin + 370, boxY + 40);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`TORRE:`, margin + 10, boxY + 60);
  doc.setFont('helvetica', 'normal');
  doc.text(`${metadata.torre}`, margin + 70, boxY + 60);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`LUGAR / DISTRITO:`, margin + 300, boxY + 60);
  doc.setFont('helvetica', 'normal');
  doc.text(`${metadata.lugar}`, margin + 410, boxY + 60);

  const items = (movement.items && movement.items.length > 0) 
    ? movement.items 
    : [{
        inventoryItemCode: movement.inventoryItemCode,
        inventoryItemName: movement.inventoryItemName,
        quantity: movement.quantity,
        unitPrice: movement.unitPrice || 0,
        currency: movement.currency || 'CRC' // Default to CRC if missing
      }];

  const tableData = items.map(item => {
    // Use item price, fallback to movement price, then 0
    const price = item.unitPrice ?? movement.unitPrice ?? 0;
    const total = item.quantity * price;
    const currency = item.currency || movement.currency || 'CRC';
    
    return [
      item.inventoryItemCode,
      item.inventoryItemName,
      movement.type,
      item.quantity.toLocaleString('es-CR'),
      currency,
      price.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      total.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ];
  });

  autoTable(doc, {
    startY: boxY + 100,
    head: [['Código', 'Descripción', 'Tipo', 'Cant.', 'Moneda', 'Precio U.', 'Total']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, textColor: [41, 51, 61], lineColor: [230, 230, 230] },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: 'center', fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  
  // Totales por moneda
  const totals = items.reduce((acc, item) => {
    const currency = item.currency || movement.currency || 'CRC';
    acc[currency] = (acc[currency] || 0) + (item.quantity * (item.unitPrice || 0));
    return acc;
  }, {} as Record<string, number>);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('RESUMEN DEL MOVIMIENTO', margin, finalY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  let currentY = finalY + 15;

  Object.entries(totals).forEach(([currency, total]) => {
    doc.text(`Total ${currency}: ${total.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin, currentY);
    currentY += 15;
  });

  // Observaciones
  if (metadata.observaciones) {
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('OBSERVACIONES', margin, currentY);
    
    currentY += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    
    const splitObs = doc.splitTextToSize(metadata.observaciones, pageWidth - 2 * margin - 20);
    const boxHeight = (splitObs.length * 12) + 15;
    
    doc.setDrawColor(230, 230, 250);
    doc.setFillColor(252, 252, 255);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, boxHeight, 5, 5, 'FD');
    
    doc.text(splitObs, margin + 10, currentY + 15);
    currentY += boxHeight + 20;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("TENTELCOM DEL OESTE S.A. – Documento generado automáticamente", pageWidth / 2, doc.internal.pageSize.height - 20, { align: 'center' });

  // Forzar descarga de forma más robusta
  const cleanProject = (metadata.proyecto || 'S-P').replace(/[^a-z0-9]/gi, '_').substring(0, 20);
  const cleanOrigin = (movement.origin || 'S-O').replace(/[^a-z0-9]/gi, '_').substring(0, 15);
  const sol = metadata.solicitud || 'SOL-XXXX';
  const fileName = `${movement.type.toUpperCase()}_${cleanProject}_${cleanOrigin}_${sol}.pdf`;
  
  const blob = doc.output('blob');
  triggerFileDownload(blob, fileName);
};

export const exportConsumptionToExcel = (projectName: string, consumptionData: any[], selectedData?: any) => {
  const metaRows = selectedData ? [
    { 'Código': 'Proyecto / Origen', 'Material': normalizeOrigin(selectedData.origin || selectedData.projectName || '---') },
    { 'Código': 'ID Solicitud', 'Material': selectedData.requestNumber || 'SOL-XXXX' },
    { 'Código': 'Fecha', 'Material': selectedData.date || '---' },
    { 'Código': 'FDH', 'Material': selectedData.fdh || '---' },
    { 'Código': 'Torre', 'Material': selectedData.tower || selectedData.torre || '---' },
    { 'Código': 'Lugar / Distrito', 'Material': selectedData.locationDetails || '---' },
    { 'Código': '' }
  ] : [];

  const data = consumptionData.map(item => ({
    'Código': item.code,
    'Material': item.description,
    'Cantidad': item.totalQuantity,
    'Moneda': item.currency,
    'Precio Unitario': item.unitPrice,
    'Total': item.totalCost
  }));

  const ws = XLSX.utils.json_to_sheet([...metaRows, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consumo');
  XLSX.writeFile(wb, `Consumo_${projectName.replace(/\s+/g, '_')}.xlsx`);
};
