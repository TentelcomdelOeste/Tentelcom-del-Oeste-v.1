import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '../logoBase64';
import { formatCurrency } from '../formatCurrency';
import { triggerFileDownload } from '../fileUtils';
import { VehicleProjectConsumption } from '../../types/vehicleWarehouse.types';
import { format } from 'date-fns';

interface MaterialConsumption {
  materialId: string;
  code: string;
  description: string;
  unit: string;
  totalQuantity: number;
  unitPrice: number;
  currency: 'USD' | 'CRC';
  totalCost: number;
}

export const generateConsumptionPdf = async (
  projectName: string,
  consumptionData: MaterialConsumption[]
) => {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.width;
  const margin = 40;

  // --- HEADER ---
  const logoWidth = 70;
  const logoHeight = 0;
  const logoX = margin;
  const logoY = margin;

  try {
    const logoData = LOGO_BASE64;
    doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    console.warn("Logo error", error);
  }

  const headerTextX = margin + logoWidth + 20;
  let textY = margin + 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138);
  doc.text("TENTELCOM DEL OESTE S.A.", headerTextX, textY);

  textY += 20;
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Consumo de Materiales por Proyecto", headerTextX, textY);

  textY += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Proyecto: ${projectName}`, headerTextX, textY);
  textY += 12;
  doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, headerTextX, textY);

  // --- TABLE ---
  const tableData = consumptionData.map(item => [
    item.code,
    item.description,
    item.totalQuantity.toLocaleString('en-US', { maximumFractionDigits: 2 }),
    item.currency,
    formatCurrency(item.unitPrice, item.currency),
    formatCurrency(item.totalCost, item.currency)
  ]);

  autoTable(doc, {
    startY: textY + 30,
    head: [['Código', 'Material', 'Cant.', 'Moneda', 'Precio U.', 'Total']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6, valign: 'middle' },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { halign: 'center' },
      1: { halign: 'left' },
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  // --- TOTALS ---
  const grandTotal = consumptionData.reduce((acc, item) => acc + item.totalCost, 0);
  
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL GENERAL DE MATERIALES CONSUMIDOS:", pageWidth - margin - 250, finalY, { align: 'right' });
  doc.text(formatCurrency(grandTotal, 'USD'), pageWidth - margin, finalY, { align: 'right' });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      "TENTELCOM DEL OESTE S.A. – Documento generado automáticamente",
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  const fileName = `REPORTE_CONSUMO_${projectName.replace(/[\s-]+/g, '_')}.pdf`;
  const blob = doc.output('blob');
  triggerFileDownload(blob, fileName);
};

export const exportVehicleConsumptionPdf = async (consumption: VehicleProjectConsumption) => {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 40;
  let y = margin;

  // --- HEADER ---
  const logoWidth = 90;
  const logoHeight = 0; // 0 auto-calculates height preserving intrinsic aspect ratio (same as Cotizaciones)
  const logoX = margin;
  const logoY = margin - 10;

  try {
    if (LOGO_BASE64) {
      doc.addImage(LOGO_BASE64, 'PNG', logoX, logoY, logoWidth, logoHeight);
    }
  } catch (error) {
    console.warn("Logo error", error);
  }

  const headerTextX = margin + logoWidth + 20;
  let textY = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138); // Blue #1E3A8A
  doc.text("TENTELCOM DEL OESTE S.A.", headerTextX, textY);

  textY += 16;
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("REPORTE DE CONSUMO Y LIQUIDACIÓN VEHICULAR", headerTextX, textY);

  textY += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  const genDateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
  doc.text(`Fecha de emisión: ${genDateStr}`, headerTextX, textY);

  y = Math.max(textY + 20, margin + 45);

  // --- SUMMARY BOX ---
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 65, 6, 6, 'FD');

  const boxY = y + 16;
  const col1X = margin + 15;
  const col2X = margin + (pageWidth - margin * 2) / 2 + 10;

  let closedAtFormatted = 'N/A';
  try {
    if (consumption.closedAt) {
      closedAtFormatted = format(new Date(consumption.closedAt), 'dd/MM/yyyy HH:mm');
    }
  } catch (e) {
    closedAtFormatted = consumption.closedAt || 'N/A';
  }

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("PROYECTO:", col1X, boxY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${consumption.projectName || 'N/A'} (${consumption.projectCode || 'N/A'})`, col1X + 58, boxY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("VEHÍCULO:", col2X, boxY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${consumption.vehiculoAlias || 'N/A'}`, col2X + 55, boxY);

  // Row 2
  const boxY2 = boxY + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("SOLICITUD REF.:", col1X, boxY2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text(`${consumption.requestNumber || 'N/A'}`, col1X + 80, boxY2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("FECHA CIERRE:", col2X, boxY2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${closedAtFormatted}`, col2X + 75, boxY2);

  // Row 3
  const boxY3 = boxY2 + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("LIQUIDADO POR:", col1X, boxY3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${consumption.closedBy || consumption.responsibleName || 'Sistema'}`, col1X + 82, boxY3);

  y += 78;

  // --- TABLE ---
  const tableData = (consumption.items || []).map(item => [
    item.code || '-',
    item.description || 'Sin descripción',
    item.committed ?? '-',
    item.consumed ?? 0,
    item.surplus ?? 0,
    (item.unit || 'unid').toUpperCase()
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Descripción del Material', 'Solicitado', 'Consumido', 'Sobrante', 'Unidad']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, halign: 'center', fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 80, fontStyle: 'bold' },
      1: { halign: 'left' },
      2: { halign: 'center', cellWidth: 65 },
      3: { halign: 'center', cellWidth: 65, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 60 },
      5: { halign: 'center', cellWidth: 50 }
    },
    margin: { left: margin, right: margin }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      "TENTELCOM DEL OESTE S.A. – Documento generado automáticamente por el sistema de gestión.",
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 20,
      { align: "right" }
    );
  }

  const cleanProjectCode = (consumption.projectCode || 'PROYECTO').replace(/[^a-zA-Z0-9_-]/g, '_');
  let cleanDate = 'REPORT';
  try {
    if (consumption.closedAt) {
      cleanDate = format(new Date(consumption.closedAt), 'yyyyMMdd_HHmm');
    }
  } catch (e) {
    // fallback
  }
  const fileName = `Reporte_Consumo_${cleanProjectCode}_${cleanDate}.pdf`;
  
  const blob = doc.output('blob');
  await triggerFileDownload(blob, fileName);
};
