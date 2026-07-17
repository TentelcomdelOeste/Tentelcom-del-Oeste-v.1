
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getInvoicesForExport, ExportFilters } from './invoiceData';
import { LOGO_BASE64 } from '../logoBase64';
import { triggerFileDownload } from '../fileUtils';

/**
 * Genera un PDF gerencial con el listado completo de facturas filtradas.
 */
export const exportFullInvoicesToPDF = async (filters: ExportFilters) => {
  try {
    // 1. Obtener datos
    const invoices = await getInvoicesForExport(filters);

    if (invoices.length === 0) {
      throw new Error("No hay datos para exportar en el periodo seleccionado.");
    }

    // 2. Calcular Totales
    const totals = invoices.reduce((acc, curr) => {
        if (curr.currency === 'USD') {
            acc.usd += curr.total;
        } else {
            acc.crc += curr.total;
        }
        return acc;
    }, { usd: 0, crc: 0 });

    // 3. Configuración del Documento
    const doc = new jsPDF('l', 'pt', 'letter'); // Landscape
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;
    
    // --- HEADER DESACOPLADO (2 COLUMNAS) ---
    // Diseño: Logo a la DERECHA | Título a la IZQUIERDA

    // 1. Logo (Derecha Absoluta)
    const logoWidth = 90;
    const logoHeight = 0; // Altura recalculable
    const logoX = pageWidth - margin - logoWidth;
    const logoY = margin - 15;

    try {
        const logoData = LOGO_BASE64;
        doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch (e) {
        console.warn("Logo load skipped");
    }

    // 2. Título (Izquierda Absoluta)
    let textY = margin + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 138); // Blue 900
    doc.text("REPORTE GENERAL DE FACTURACIÓN", margin, textY);
    
    // --- DYNAMIC SUBTITLE ---
    textY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    // Periodo
    const yearText = filters.year === 'all' ? 'Todos los Años' : filters.year;
    const monthText = filters.month === 'all' ? 'Todos los Meses' : monthNames[parseInt(filters.month) - 1];
    
    // Moneda
    const currencyText = (!filters.currency || filters.currency === 'all') ? 'Todas' : filters.currency;
    
    // Modalidad
    let modeText = 'Todas';
    if (filters.paymentMode === 'CONTADO') modeText = 'Contado';
    else if (filters.paymentMode === 'CREDITO') modeText = 'Crédito';
    
    // Tipo
    let typeText = 'Todas';
    if (filters.type === 'CXC') typeText = 'Cuenta por Cobrar';
    else if (filters.type === 'CXP') typeText = 'Cuenta por Pagar';

    const subtitleText = `Periodo: ${yearText} / ${monthText} | Moneda: ${currencyText} | Modalidad: ${modeText} | Tipo: ${typeText}`;
    
    doc.text(subtitleText, margin, textY);

    let y = Math.max(textY, logoY + logoHeight) + 35;

    // --- FORMATTER ---
    const fmtNum = (num: number) => num.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // --- TABLE BODY ---
    // ORDEN DEFINITIVO: Cons, Tipo, Mod, Estado, Proyecto, Obs, Mon, Subtotal, IVA, Total
    const tableBody = invoices.map(inv => [
        inv.consecutivo,
        inv.type === 'CXC' ? 'Cobrar' : 'Pagar',
        inv.paymentMode === 'CONTADO' ? 'Cont.' : 'Créd.',
        inv.status,
        inv.projectName,
        inv.notes,
        inv.currency,        // Moneda antes de los montos
        fmtNum(inv.subtotal),
        fmtNum(inv.iva),
        fmtNum(inv.total)
    ]);

    // --- AUTOTABLE ---
    autoTable(doc, {
        startY: y,
        // ENCABEZADOS COINCIDENTES
        head: [['CONS.', 'TIPO', 'MOD.', 'ESTADO', 'PROYECTO', 'OBSERVACIONES', 'MON', 'SUBTOTAL', 'IVA', 'TOTAL']],
        body: tableBody,
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: 3,
            valign: 'middle',
            font: 'helvetica',
            lineWidth: 0.1,
            lineColor: [226, 232, 240]
        },
        headStyles: {
            fillColor: [30, 58, 138],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 40, fontStyle: 'bold' }, // Cons. (Compacto)
            1: { halign: 'center', cellWidth: 35 }, // Tipo
            2: { halign: 'center', cellWidth: 30 }, // Mod.
            3: { halign: 'center', cellWidth: 45 }, // Estado
            4: { halign: 'left', cellWidth: 90 }, // Proyecto
            5: { halign: 'left' }, // Obs (Auto width remainder)
            
            // Grupo Financiero (Alineado a la derecha)
            6: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }, // Mon
            7: { halign: 'right', cellWidth: 55, fontStyle: 'bold', textColor: [100, 116, 139] }, // Subtotal
            8: { halign: 'right', cellWidth: 45, fontStyle: 'bold', textColor: [100, 116, 139] }, // IVA
            9: { halign: 'right', cellWidth: 55, fontStyle: 'bold', textColor: [30, 41, 59] }, // Total
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        margin: { left: margin, right: margin }
    });

    // --- TOTALS FOOTER ---
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    
    // Check page break for totals block
    if (finalY + 60 > doc.internal.pageSize.height) {
        doc.addPage();
        y = margin;
    } else {
        y = finalY;
    }

    // Línea separadora alineada a la derecha
    const rightX = pageWidth - margin;
    const totalsWidth = 250; 
    
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(rightX - totalsWidth, y, rightX, y);
    y += 15;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); // Blue 900
    
    // Total CRC
    // Alineamos la etiqueta a la derecha dejando un espacio fijo para el valor
    // Alineamos el valor a la derecha pegado al margen
    const valueGap = 110; 
    
    doc.text(`Total Colones (CRC):`, rightX - valueGap, y, { align: 'right' });
    doc.text(fmtNum(totals.crc), rightX, y, { align: 'right' });
    
    y += 15;
    
    // Total USD
    doc.text(`Total Dólares (USD):`, rightX - valueGap, y, { align: 'right' });
    doc.text(fmtNum(totals.usd), rightX, y, { align: 'right' });

    // --- PAGE FOOTER ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.setFont("helvetica", "normal");
        const dateStr = new Date().toLocaleDateString();
        doc.text(`Generado el ${dateStr} - TENTELCOM DEL OESTE S.A. | Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.height - 15, { align: 'center' });
    }

    // Save
    const fileName = `Exportacion_Facturas_${Date.now()}.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, fileName);

  } catch (error) {
    console.error("Error generando PDF de facturas:", error);
    throw error;
  }
};
