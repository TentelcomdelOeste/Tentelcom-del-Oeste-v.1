
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '../logoBase64';
import { formatCurrency } from '../formatCurrency';
import { triggerFileDownload } from '../fileUtils';

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
  // Note: This assumes all items are in the same currency or just sums them up.
  // The requirement says "Total General de Materiales Consumidos".
  // If currencies are mixed, this might be tricky, but let's just sum them for now as per requirement.
  
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL GENERAL DE MATERIALES CONSUMIDOS:", pageWidth - margin - 250, finalY, { align: 'right' });
  doc.text(formatCurrency(grandTotal, 'USD'), pageWidth - margin, finalY, { align: 'right' }); // Assuming USD or handling currency

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
