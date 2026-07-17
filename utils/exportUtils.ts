
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LOGO_BASE64 } from './logoBase64';
import { triggerFileDownload } from './fileUtils';

// --- EXCEL EXPORT ---
export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Datos') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Error generating Excel");
  }
};

// --- PDF EXPORT ---
interface PDFColumn {
  header: string;
  dataKey: string;
  width?: number; // Weight for width distribution (Used as hint)
  align?: 'left' | 'center' | 'right';
  isCurrency?: boolean; // Flag to use specific width & alignment
}

interface PDFExportOptions {
  title: string;
  subtitle?: string;
  fileName: string;
  columns: PDFColumn[];
  data: any[];
  totals?: { [key: string]: string | number };
  orientation?: 'p' | 'l'; // Portrait or Landscape
}

export const exportToPDF = async ({
  title,
  subtitle,
  fileName,
  columns,
  data,
  totals,
  orientation = 'p'
}: PDFExportOptions) => {
  try {
    const doc = new jsPDF(orientation, 'pt', 'letter');
    
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 40;
    
    // --- ZONA HEADER DESACOPLADA ---
    // Diseño: Logo a la DERECHA | Título a la IZQUIERDA
    
    // 1. Renderizado del Logo (Zona Derecha Absoluta)
    const logoWidth = 90;
    const logoHeight = 0; // Automatic height maintain aspect ratio
    const logoX = pageWidth - margin - logoWidth;
    const logoY = margin - 15; 

    try {
      const logoData = LOGO_BASE64;
      doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch (e) {
      console.warn("Logo load skipped");
    }

    // 2. Renderizado del Título (Zona Izquierda Absoluta)
    let textY = margin + 10; 

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138); // Blue 900
    // Ancho máximo disponible para texto = Ancho página - Márgenes - Ancho Logo - Espacio seguridad
    const maxTextWidth = pageWidth - (margin * 2) - logoWidth - 20;
    
    doc.text(title.toUpperCase(), margin, textY, { align: 'left', maxWidth: maxTextWidth });
    
    // 3. Subtítulo (Debajo del título)
    if (subtitle) {
      textY += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(subtitle, margin, textY, { align: 'left', maxWidth: maxTextWidth });
    }

    // 4. Línea Separadora (Debajo de todo el bloque header)
    // Calculamos el Y final basándonos en el elemento más bajo (ahora el logo o el subtítulo + padding)
    const headerBottomY = Math.max(textY + 10, logoY + 70);
    
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, headerBottomY, pageWidth - margin, headerBottomY);
    
    // El contenido empieza después de la línea
    const y = headerBottomY + 20;

    // --- AUTOTABLE CONFIG ---
    // Prepare Headers
    const head = [columns.map(col => col.header.toUpperCase())];
    
    // Prepare Body
    const body = data.map(row => columns.map(col => row[col.dataKey]));

    // Define Column Styles
    const columnStyles: any = {};
    columns.forEach((col, index) => {
        const style: any = {};
        
        if (col.align) {
            style.halign = col.align;
        }

        if (col.isCurrency) {
            style.halign = 'right';
            style.cellWidth = 90;
            style.font = 'helvetica';
            style.fontStyle = 'bold';
        }
        
        columnStyles[index] = style;
    });

    // Generate Table
    autoTable(doc, {
        startY: y,
        head: head,
        body: body,
        theme: 'plain',
        styles: {
            fontSize: 8,
            cellPadding: 6,
            overflow: 'linebreak',
            textColor: [30, 41, 59],
            valign: 'middle',
            font: 'helvetica',
            lineWidth: 0,
        },
        headStyles: {
            fillColor: [30, 58, 138],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 6
        },
        columnStyles: columnStyles,
        alternateRowStyles: {
            fillColor: [241, 245, 249]
        },
        margin: { top: 40, left: 40, right: 40, bottom: 40 },
    });

    // --- TOTALS SECTION ---
    const finalY = (doc as any).lastAutoTable.finalY;

    if (totals && Object.keys(totals).length > 0) {
        let yPos = finalY + 25;

        const totalsHeight = Object.keys(totals).length * 18 + 20;
        if (yPos + totalsHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }

        const summaryWidth = 240; 
        const valueColumnWidth = 120;
        const labelColumnWidth = summaryWidth - valueColumnWidth;
        const summaryTableStartX = pageWidth - margin - summaryWidth;

        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(1);
        doc.line(summaryTableStartX, yPos - 5, pageWidth - margin, yPos - 5);
        
        const totalsBody = Object.entries(totals).map(([key, value]) => [`${key}:`, value]);
        autoTable(doc, {
            startY: yPos,
            body: totalsBody,
            theme: 'plain', 
            tableWidth: summaryWidth,
            margin: { left: summaryTableStartX },
            styles: {
                overflow: 'hidden',
                fontSize: 9,
                cellPadding: 2,
                font: 'helvetica'
            },
            columnStyles: {
                0: { 
                    halign: 'left',
                    fontStyle: 'bold',
                    textColor: [30, 58, 138],
                    cellWidth: labelColumnWidth
                },
                1: { 
                    halign: 'right', 
                    fontStyle: 'bold',
                    textColor: [30, 41, 59],
                    cellWidth: valueColumnWidth 
                }
            }
        });
    }

    // --- FOOTER ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        doc.text(`Generado el ${new Date().toLocaleDateString()} - TENTELCOM DEL OESTE S.A. | Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    }

    const safeFileName = `${fileName.replace(/[\s-]+/g, '_')}.pdf`;
    const blob = doc.output('blob');
    
    console.log('[TRACE][PDF] Blob generado:', blob);
    console.log('[TRACE][PDF] Tamaño blob:', blob?.size);
    console.log('[TRACE][PDF] Tipo blob:', blob?.type);
    
    const url = URL.createObjectURL(blob);
    console.log('[TRACE][PDF] URL generada:', url);
    console.log('[TRACE][PDF] Intentando descargar...');
    console.log('[TRACE][PDF] Descarga disparada');

    triggerFileDownload(blob, safeFileName);
  } catch (error) {
    console.error("Error generating PDF: " + String(error));
  }
};
