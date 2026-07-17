
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Quote } from '../types';
import { Employee, PayStub } from '../financeTypes';
import { MaterialRequest } from '../dispatchTypes';
import { AutomaticAdjustment } from '../modules/finance/automatic_adjustments/automaticAdjustments.types';
import { numeroALetras } from './numberToWords';
import { formatCurrency } from './formatCurrency';
import { LOGO_BASE64, LOGO14_BASE64 } from './logoBase64';
import { normalizeOrigin } from '@/utils/originUtils';
import { triggerFileDownload } from './fileUtils';

export const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const generateQuotePDF = async (quote: Quote) => {
  const doc = new jsPDF('p', 'pt'); 
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 40;
  
  // --- HEADER ---
  const logoWidth = 90;
  const logoHeight = 0; 
  const logoX = margin;
  const logoY = margin - 10;

  try {
    const logoData = LOGO_BASE64;
    doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    console.error("Error logo", error);
  }

  const companyInfoX = margin + logoWidth + 20; 
  let textY = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138); 
  doc.text("TENTELCOM DEL OESTE S.A.", companyInfoX, textY, { align: 'left' });

  textY += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100); 
  doc.text("Soluciones en Telecomunicaciones y Fibra Óptica", companyInfoX, textY, { align: 'left' });
  textY += 12;
  doc.text("Cédula Jurídica: 3-101-438992", companyInfoX, textY, { align: 'left' });
  textY += 12;
  doc.text("Tel: 2249 5551 | 8327 0245 | 8393 6595", companyInfoX, textY, { align: 'left' });
  textY += 12;
  doc.text("tentelcom@ice.co.cr", companyInfoX, textY, { align: 'left' });

  // --- CLIENT INFO ---
  let y = Math.max(textY, logoY + logoHeight) + 35;
  const secondColX = pageWidth - margin - 95; 

  doc.setTextColor(41, 51, 61); 
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE:", margin, y);
  doc.text("DETALLES:", secondColX, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  // SAFEGUARDS: Ensure strings are never undefined
  doc.text(`Empresa: ${quote.empresa ?? ''}`, margin, y);
  doc.text(`Cod. Cliente: ${quote.codigoCliente ?? ''}`, secondColX, y);
  y += 13;
  
  const quoteDate = quote.fecha ?? '';
  const year = new Date(
      quoteDate.includes('/') 
      ? quoteDate.split('/').reverse().join('-') 
      : quoteDate
  ).getFullYear();
  const displayYear = !isNaN(year) ? year : new Date().getFullYear();
  
  doc.text(`Atención: ${quote.contacto ?? ''}`, margin, y);
  doc.text(`Cotización: #${quote.id.toString().padStart(3, '0')}-${displayYear}`, secondColX, y);
  y += 13;
  
  doc.text(`Tel: ${quote.telefono ?? ''} | ${quote.correo ?? ''}`, margin, y);
  doc.text(`Fecha: ${quoteDate}`, secondColX, y);
  
  // ESPACIO ENTRE DATOS DEL CLIENTE Y TABLA
  y += 22.5;
  
  // --- TABLE ITEMS (AUTOTABLE) ---
  
  doc.setFontSize(8); 
  doc.setFont("helvetica", "normal");

  let minPriceColWidth = 0;
  let minTotalColWidth = 0;
  const paddingSafety = 10; 

  // FIX: Provide fallback array for items
  const tableBody = (quote.items || []).map(item => {
    let precioRaw = '';
    let totalRaw = '';

    if (quote.moneda === 'CRC') {
        const fmt = new Intl.NumberFormat('es-CR', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        // FIX: Ensure numeric values
        precioRaw = fmt.format(item.precioUnitario || 0);
        totalRaw = fmt.format(item.total || 0);
    } else {
        precioRaw = formatCurrency(item.precioUnitario || 0, quote.moneda);
        totalRaw = formatCurrency(item.total || 0, quote.moneda);
    }

    const precio = precioRaw
      .replace('CRC', '')
      .replace('USD', '')
      .trim()
      .replace(/\s/g, '\u00A0');

    const totalItem = totalRaw
      .replace('CRC', '')
      .replace('USD', '')
      .trim()
      .replace(/\s/g, '\u00A0');

    const wPrice = doc.getTextWidth(precio);
    if (wPrice > minPriceColWidth) minPriceColWidth = wPrice;

    const wTotal = doc.getTextWidth(totalItem);
    if (wTotal > minTotalColWidth) minTotalColWidth = wTotal;

    return [
        item.codigo ?? '',
        item.descripcion ?? '',
        item.cantidad ?? 0,
        precio,
        totalItem
    ];
  });

  minPriceColWidth += paddingSafety;
  minTotalColWidth += paddingSafety;

  autoTable(doc, {
    startY: y,
    head: [['COD.', 'DESCRIPCIÓN', 'CANT', 'PRECIO UNIT.', 'TOTAL']],
    body: tableBody,
    theme: 'grid',
    styles: {
        fontSize: 8,
        font: 'helvetica',
        textColor: [41, 51, 61],
        cellPadding: 4,
        valign: 'middle',
        lineWidth: 0.1,
        lineColor: [230, 230, 230]
    },
    headStyles: {
        fontSize: 9,
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
    },
    columnStyles: {
        0: { halign: 'center', cellWidth: 'auto' }, 
        1: { halign: 'left', valign: 'middle' }, 
        2: { halign: 'center', cellWidth: 40 }, 
        3: { halign: 'right', cellWidth: 'auto', minCellWidth: minPriceColWidth }, 
        4: { halign: 'right', cellWidth: 'auto', minCellWidth: minTotalColWidth }  
    },
    margin: { left: margin, right: margin }
  });

  y = (doc as any).lastAutoTable.finalY + 20;

  // --- TOTALS ---
  const applyTax = quote.applyTax ?? true; // Backward compatibility (default true)
  
  const subtotal = (quote.items || []).reduce((acc, i) => acc + (i.total || 0), 0);
  const discountPercentage = quote.descuento || 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  
  // Lógica de IVA Condicional
  const iva = applyTax ? subtotalAfterDiscount * 0.13 : 0;
  
  const finalTotal = subtotalAfterDiscount + iva;
  const symbol = quote.moneda === 'USD' ? '$' : '¢';

  if (y + 100 > pageHeight - margin) {
      doc.addPage();
      y = margin;
  }
  
  const rightAlignX = pageWidth - margin;
  const gapBetweenLabelAndValue = 40; 

  const fmtSubtotal = `${symbol}${subtotal.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDiscount = `-${symbol}${discountAmount.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtIva = `${symbol}${iva.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtTotal = `${symbol}${finalTotal.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  doc.setFontSize(12); 
  doc.setFont("helvetica", "bold");
  const maxValWidth = doc.getTextWidth(fmtTotal) + 5; 

  const labelsRightX = rightAlignX - maxValWidth - gapBetweenLabelAndValue;

  doc.setTextColor(41, 51, 61);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SUBTOTAL:", labelsRightX, y, { align: "right" });
  doc.text(fmtSubtotal, rightAlignX, y, { align: "right" });
  y += 15;

  if (discountPercentage > 0) {
      doc.text(`DESCUENTO (${discountPercentage}%):`, labelsRightX, y, { align: "right" });
      doc.text(fmtDiscount, rightAlignX, y, { align: "right" });
      y += 15;
  }
  
  // Etiqueta condicional para IVA
  const taxLabel = applyTax ? "IVA (13%):" : "IVA (EXENTO):";
  doc.text(taxLabel, labelsRightX, y, { align: "right" });
  doc.text(fmtIva, rightAlignX, y, { align: "right" });
  y += 12;

  doc.setDrawColor(30, 58, 138); 
  doc.setLineWidth(1.5);
  const lineStartX = labelsRightX - 110; 
  doc.line(lineStartX, y, rightAlignX, y);
  y += 15;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("Total de la Oferta:", labelsRightX, y, { align: "right" });
  doc.text(fmtTotal, rightAlignX, y, { align: "right" });
  doc.setTextColor(41, 51, 61); 
  
  // --- FOOTER & INFO ---
  const footerHeightEstimate = 200;
  if (y + footerHeightEstimate > pageHeight - margin) {
      doc.addPage();
      y = margin;
  } else {
      y += 30; 
  }

  const valueAlignmentX = margin + 105; 
  const reducedLineHeight = 14; 

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("MONTO EN LETRAS:", margin, y);
  doc.setFont("helvetica", "normal");
  
  const montoEnLetrasCalc = numeroALetras(finalTotal, quote.moneda);
  const availableWidth = pageWidth - valueAlignmentX - margin;
  const montoLetrasLines = doc.splitTextToSize(montoEnLetrasCalc, availableWidth);
  doc.text(montoLetrasLines, valueAlignmentX, y);
  y += (montoLetrasLines.length * 12) + (reducedLineHeight - 12);

  doc.setFont("helvetica", "bold");
  doc.text("FORMA DE PAGO:", margin, y);
  doc.setFont("helvetica", "normal");
  
  const formaPagoText = quote.formaPago || 'A convenir';
  const formaPagoLines = doc.splitTextToSize(formaPagoText, pageWidth - valueAlignmentX - margin);
  doc.text(formaPagoLines, valueAlignmentX, y);
  y += (formaPagoLines.length * 12) + (reducedLineHeight - 12);

  doc.setFont("helvetica", "bold");
  doc.text("VIGENCIA:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(quote.vigencia ?? '', valueAlignmentX, y);
  y += 25; 

  if (quote.observaciones) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("OBSERVACIONES Y CONSIDERACIONES TÉCNICAS:", margin, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const obsLines = doc.splitTextToSize(quote.observaciones, pageWidth - margin * 2);
      doc.text(obsLines, margin, y);
      y += (obsLines.length * 10) + 15;
  }

  const boxHeight = 45;
  if (y + boxHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
  }

  doc.setFillColor(241, 245, 249); 
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 3, 3, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("INFORMACIÓN PARA TRANSFERENCIA BANCARIA:", margin + 10, y + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Cuenta IBAN Dólares: CR10015201001025010901 a nombre de TENTELCOM DEL OESTE S.A. con el BCR", margin + 10, y + 26);
  doc.text("Cuenta IBAN Colones: CR48015201001024997704 a nombre de TENTELCOM DEL OESTE S.A. con el BCR", margin + 10, y + 36);
  y += boxHeight + 20;
  
  const disclaimer = "Solicitamos revisar detalladamente esta cotización y corroborar que corresponde satisfactoriamente a los productos y/o solucion requeridos. La presente oferta es el resultado de nuestra interpretacion de la información recibida, por lo cual la responsabilidad de TENTELCOM DEL OESTE S.A. se limita al suministro de los bienes y servicios en los terminos que se detallan es esta cotización";
  
  if (y + 30 > pageHeight - margin) {
      doc.addPage();
      y = margin;
  }

  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(128, 128, 128);
  doc.text(splitDisclaimer, margin, y);

  const pageCount = doc.internal.pages.length;
  for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("TENTELCOM DEL OESTE S.A. - Garantía de servicio y calidad técnica.", pageWidth / 2, pageHeight - 20, { align: "center" });
  }

  const quoteIdFmt = quote.id.toString().padStart(3, '0');
  const empresaFmt = (quote.empresa ?? 'CLIENTE').trim().toUpperCase().replace(/\s+/g, '_');
  const contactoFmt = (quote.contacto ?? 'CONTACTO').trim().toUpperCase().replace(/\s+/g, '_');
  
  const fileName = `Cotización_${quoteIdFmt}_${empresaFmt}_${contactoFmt}.pdf`;
  return { fileBlob: doc.output('blob'), fileName };
};

export const generatePaystubPDF = async (entry: PayStub, employee: Employee): Promise<{ fileBlob: Blob, fileName: string }> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const currency = (amount?: number) => {
    const value = Number(amount) || 0;
    return `¢ ${value.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const CORPORATE_BLUE = [15, 45, 120];
  const TEXT_DARK = [30, 41, 59];
  const TEXT_LABEL = [15, 45, 120]; 
  const LIGHT_BG = [245, 248, 255];
  const BORDER_COLOR = [220, 220, 220];

  // 1. Header Box
  doc.setFillColor(CORPORATE_BLUE[0], CORPORATE_BLUE[1], CORPORATE_BLUE[2]);
  doc.rect(0, 0, 210, 35, 'F');
  
  try { 
    const logoData = LOGO14_BASE64;
    const props = doc.getImageProperties(logoData);
    const ratio = props.width / props.height;
    const w = 40;
    const h = w / ratio;
    const imgY = (35 - h) / 2;
    doc.addImage(logoData, 'PNG', 15, imgY, w, h); 
  } catch (e) {
      console.warn("Could not load logo", e);
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("COLILLA DE PAGO", 105, 23, { align: "center" }); 

  // 2. Employee Info
  let y = 44;
  const col1X = 15;
  const col1ValX = 45;
  const col2X = 125;
  const col2ValX = 155;
  
  const dateObj = entry.generatedDate ? new Date(entry.generatedDate) : new Date();
  const formattedDate = dateObj.toLocaleDateString('es-CR');

  doc.setFontSize(10);
  
  const drawRow = (l1: string, v1: string, l2: string, v2: string, yPos: number) => {
    doc.setTextColor(TEXT_LABEL[0], TEXT_LABEL[1], TEXT_LABEL[2]);
    doc.setFont("helvetica", "bold"); doc.text(l1, col1X, yPos);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("helvetica", "normal"); doc.text(v1, col1ValX, yPos);
    
    doc.setTextColor(TEXT_LABEL[0], TEXT_LABEL[1], TEXT_LABEL[2]);
    doc.setFont("helvetica", "bold"); doc.text(l2, col2X, yPos);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setFont("helvetica", "normal"); doc.text(v2, col2ValX, yPos);
  };

  drawRow("Colaborador:", employee.name || '', "Fecha Emisión:", formattedDate, y);
  y += 6;
  drawRow("Puesto:", employee.position || '', "ID Colaborador:", employee.employeeCode || '', y);
  y += 6;
  drawRow("Comprobante:", "---", "Planilla:", entry.planillaId || "—", y);

  // Divider
  y += 6;
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);

  // 3. Tables
  y += 10;
  const Y_TABLE_START = y;
  const HEADER_H = 8;
  const ROW_H = 8;
  
  const T1_X = 15;
  const T1_W = 86;
  
  const T2_X = 109;
  const T2_W = 86;

  // Computed data
  const ordHours = (entry as any).ordinaryHours !== undefined ? (entry as any).ordinaryHours : 150;
  const ordHoursStr = ordHours.toString().replace('.', ',');
  
  let valHoraOrg = 0;
  const baseSal = entry.baseSalary || 0;
  
  if (ordHours > 0) {
      valHoraOrg = baseSal / ordHours;
  }

  const valHoraExt = valHoraOrg * 1.5;
  const extrasHorasCount = (entry as any).extraHoursCount !== undefined ? (entry as any).extraHoursCount : 0;
  const extrasMonto = entry.extraHours || 0;
  let extrasHorasStr = extrasHorasCount > 0 ? extrasHorasCount.toString().replace('.', ',') : "0";
  
  if (extrasHorasCount === 0 && extrasMonto > 0) {
      const rawH = valHoraExt > 0 ? (extrasMonto / valHoraExt) : 0;
      const roundedH = Math.round(rawH * 10) / 10;
      extrasHorasStr = roundedH.toString().replace('.', ',');
  }

  const holidayHoursCount = (entry as any).holidayHoursCount !== undefined ? (entry as any).holidayHoursCount : 0;
  const feriadosMonto = (entry as any).holidays || 0;
  let feriadosHorasStr = holidayHoursCount > 0 ? holidayHoursCount.toString().replace('.', ',') : "0";

  if (holidayHoursCount === 0 && feriadosMonto > 0) {
      const rawH = valHoraOrg > 0 ? (feriadosMonto / valHoraOrg) : 0;
      const roundedH = Math.round(rawH * 10) / 10;
      feriadosHorasStr = roundedH.toString().replace('.', ',');
  }
  
  const bonosMonto = entry.bonuses || 0;
  const viaticosMonto = entry.travelExpenses || 0;
  const disponibilidadMonto = entry.availabilityBonus || 0;

  const customIngresos = (entry.customFields || [])
    .filter(cf => cf.type === 'ingreso' && cf.amount && cf.amount > 0)
    .map(cf => ({ c: cf.name || 'Ingreso Extra', h: "-", v: "-", t: currency(cf.amount) }));

  const incomeItems = [
    {c: "Salario Ordinario", h: ordHoursStr, v: currency(valHoraOrg), t: currency(baseSal)},
    ...(extrasMonto > 0 ? [{c: "Salario Extra", h: extrasHorasStr, v: currency(valHoraExt), t: currency(extrasMonto)}] : []),
    ...(feriadosMonto > 0 ? [{c: "Feriados", h: feriadosHorasStr, v: currency(valHoraOrg), t: currency(feriadosMonto)}] : []),
    ...(bonosMonto > 0 ? [{c: "Bonos", h: "-", v: "-", t: currency(bonosMonto)}] : []),
    ...(viaticosMonto > 0 ? [{c: "Viáticos", h: "-", v: "-", t: currency(viaticosMonto)}] : []),
    ...(disponibilidadMonto > 0 ? [{c: "Disponibilidad", h: "-", v: "-", t: currency(disponibilidadMonto)}] : []),
    ...customIngresos
  ];

  const ccssMonto = entry.ccss || 0;
  const adelantoMonto = entry.advancePayment || 0;
  const ausenciasMonto = entry.absenceDeductions || 0;
  const embargosMonto = (entry as any).legalEmbargos || 0;

  const customDeducciones = (entry.customFields || [])
    .filter(cf => cf.type === 'deduccion' && cf.amount && cf.amount > 0)
    .map(cf => ({ c: cf.name || 'Deducción Extra', m: currency(cf.amount) }));

  const deductionItems = [
    ...(ccssMonto > 0 ? [{c: "CCSS", m: currency(ccssMonto)}] : []),                
    ...(adelantoMonto > 0 ? [{c: "Adelanto de Salario", m: currency(adelantoMonto)}] : []),
    ...(ausenciasMonto > 0 ? [{c: "Deducción por Ausencias", m: currency(ausenciasMonto)}] : []),
    ...(embargosMonto > 0 ? [{c: "Embargos Legales", m: currency(embargosMonto)}] : []),
    ...customDeducciones
  ];

  const MAX_ROWS = Math.max(incomeItems.length, deductionItems.length);
  const bodyH = MAX_ROWS * ROW_H;
  const finalY = Y_TABLE_START + HEADER_H + bodyH;
  const totalRowH = 10;

  // Table Backgrounds
  doc.setFillColor(CORPORATE_BLUE[0], CORPORATE_BLUE[1], CORPORATE_BLUE[2]);
  
  // T1 Header BG
  doc.roundedRect(T1_X, Y_TABLE_START, T1_W, HEADER_H, 2, 2, 'F');
  doc.rect(T1_X, Y_TABLE_START + 3, T1_W, HEADER_H - 3, 'F'); // flatten bottom
  
  // T2 Header BG
  doc.roundedRect(T2_X, Y_TABLE_START, T2_W, HEADER_H, 2, 2, 'F');
  doc.rect(T2_X, Y_TABLE_START + 3, T2_W, HEADER_H - 3, 'F');

  // Totals Area (Light Blue Background)
  doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
  
  // T1 Total BG
  doc.roundedRect(T1_X, finalY, T1_W, totalRowH, 2, 2, 'F');
  doc.rect(T1_X, finalY, T1_W, 3, 'F'); // flatten top
  
  // T2 Total BG
  doc.roundedRect(T2_X, finalY, T2_W, totalRowH, 2, 2, 'F');
  doc.rect(T2_X, finalY, T2_W, 3, 'F');

  // Draw Headers text & inner vertical lines
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  const headY = Y_TABLE_START + 5.5;
  const T1_COL1 = 28;
  const T1_COL2 = 42;
  const T1_COL3 = 64;

  doc.text("CONCEPTO", T1_X + 14, headY, {align: "center"});
  doc.text("HORAS", T1_X + 35, headY, {align: "center"});
  doc.text("V.HORA", T1_X + 53, headY, {align: "center"});
  doc.text("TOTAL", T1_X + 75, headY, {align: "center"});

  doc.setDrawColor(255, 255, 255);
  doc.line(T1_X + T1_COL1, Y_TABLE_START, T1_X + T1_COL1, Y_TABLE_START + HEADER_H);
  doc.line(T1_X + T1_COL2, Y_TABLE_START, T1_X + T1_COL2, Y_TABLE_START + HEADER_H);
  doc.line(T1_X + T1_COL3, Y_TABLE_START, T1_X + T1_COL3, Y_TABLE_START + HEADER_H);

  const T2_COL1 = 56;
  doc.text("CONCEPTO", T2_X + 28, headY, {align: "center"});
  doc.text("MONTO", T2_X + 71, headY, {align: "center"});
  doc.line(T2_X + T2_COL1, Y_TABLE_START, T2_X + T2_COL1, Y_TABLE_START + HEADER_H);

  // Body inner vertical lines
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.line(T1_X + T1_COL1, Y_TABLE_START + HEADER_H, T1_X + T1_COL1, finalY);
  doc.line(T1_X + T1_COL2, Y_TABLE_START + HEADER_H, T1_X + T1_COL2, finalY);
  doc.line(T1_X + T1_COL3, Y_TABLE_START + HEADER_H, T1_X + T1_COL3, finalY);
  doc.line(T2_X + T2_COL1, Y_TABLE_START + HEADER_H, T2_X + T2_COL1, finalY);

  // Body Items
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.setFont("helvetica", "normal");
  
  let drawRowY = Y_TABLE_START + HEADER_H;
  for (let i = 0; i < MAX_ROWS; i++) {
    const textY = drawRowY + 5.5;
    if (i < incomeItems.length) {
      const it = incomeItems[i];
      doc.text(it.c, T1_X + 2, textY);
      doc.text(it.h, T1_X + 35, textY, {align: "center"});
      doc.text(it.v, T1_X + 62, textY, {align: "right"});
      doc.text(it.t, T1_X + 84, textY, {align: "right"});
    }
    if (i < deductionItems.length) {
      const it = deductionItems[i];
      doc.text(it.c, T2_X + 2, textY);
      doc.text(it.m, T2_X + 84, textY, {align: "right"});
    }
    drawRowY += ROW_H;
    // Row horizontal line
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.line(T1_X, drawRowY, T1_X + T1_W, drawRowY);
    doc.line(T2_X, drawRowY, T2_X + T2_W, drawRowY);
  }

  // Totals Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(CORPORATE_BLUE[0], CORPORATE_BLUE[1], CORPORATE_BLUE[2]);
  
  const totalIngresosCustom = (entry.customFields || []).filter(cf => cf.type === 'ingreso').reduce((sum, cf) => sum + (cf.amount || 0), 0);
  const totalDeduccionesCustom = (entry.customFields || []).filter(cf => cf.type === 'deduccion').reduce((sum, cf) => sum + (cf.amount || 0), 0);

  const totalIngresos = baseSal + extrasMonto + feriadosMonto + bonosMonto + viaticosMonto + disponibilidadMonto + totalIngresosCustom;
  const totalDeducciones = ccssMonto + adelantoMonto + ausenciasMonto + embargosMonto + totalDeduccionesCustom;
  const computedNetPay = totalIngresos - totalDeducciones;

  doc.text("TOTAL INGRESOS", T1_X + 35, finalY + 6.5, {align: "center"});
  doc.text(currency(totalIngresos), T1_X + 84, finalY + 6.5, {align: "right"});
  
  doc.text("TOTAL DEDUCCIONES", T2_X + 35, finalY + 6.5, {align: "center"});
  doc.text(currency(totalDeducciones), T2_X + 84, finalY + 6.5, {align: "right"});

  // Draw full tables outer borders at the end
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.roundedRect(T1_X, Y_TABLE_START, T1_W, HEADER_H + bodyH + totalRowH, 2, 2, 'S');
  doc.roundedRect(T2_X, Y_TABLE_START, T2_W, HEADER_H + bodyH + totalRowH, 2, 2, 'S');

  // Render comments/observaciones si existen
  let commentsY = finalY + totalRowH + 6;
  
  const customComments = (entry.customFields || [])
    .filter(cf => cf.comment && cf.comment.trim() !== '');
    
  if (customComments.length > 0) {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    
    // Draw box
    const boxHeight = 8 + (customComments.length * 4.5);
    doc.roundedRect(T1_X, commentsY, (T2_X + T2_W) - T1_X, boxHeight, 2, 2, 'FD');
    
    // Draw Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("OBSERVACIONES", T1_X + 6, commentsY + 5);
    
    // Draw Comments
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    
    let currentLineY = commentsY + 9.5;
    customComments.forEach(cf => {
      // Shorten name if needed, display as bullet points
      const text = `• ${cf.name.toUpperCase()}: ${cf.comment}`;
      doc.text(text, T1_X + 6, currentLineY);
      currentLineY += 4.5;
    });
    
    commentsY += boxHeight;
  }

  // 4. NETO A RECIBIR
  const notoY = commentsY + 6;
  const netoH = 14;
  doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
  doc.setDrawColor(CORPORATE_BLUE[0], CORPORATE_BLUE[1], CORPORATE_BLUE[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(T1_X, notoY, (T2_X + T2_W) - T1_X, netoH, 2, 2, 'FD'); 
  
  doc.setTextColor(CORPORATE_BLUE[0], CORPORATE_BLUE[1], CORPORATE_BLUE[2]);
  doc.setFontSize(15);
  doc.text("NETO A RECIBIR", T1_X + 8, notoY + 9.5);
  
  doc.text(currency(entry.netPay), T2_X + T2_W - 8, notoY + 9.5, {align: "right"});

  // 5. Footer Info
  const footerY = notoY + netoH + 6;
  
  // Top Separator
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.setLineWidth(0.4);
  doc.line(15, footerY, 195, footerY);
  
  // Center vertical separator
  doc.line(105, footerY + 3, 105, footerY + 22);

  // Position of elements to be perfectly horizontally aligned around their respective centers (X=60 and X=150)
  const leftIconX = 36;
  const leftTextX = 48;
  const rightIconX = 130;
  const rightTextX = 144;
  
  doc.setTextColor(TEXT_LABEL[0], TEXT_LABEL[1], TEXT_LABEL[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  
  doc.setDrawColor(CORPORATE_BLUE[0], CORPORATE_BLUE[1], CORPORATE_BLUE[2]);
  doc.setLineWidth(0.5);
  
  // Calendar Icon
  const cx = leftIconX;
  const cy = footerY + 7.5;
  doc.roundedRect(cx, cy, 8, 7.5, 0.8, 0.8, 'S');
  doc.line(cx + 2.5, cy - 1, cx + 2.5, cy + 1); // left pin
  doc.line(cx + 5.5, cy - 1, cx + 5.5, cy + 1); // right pin
  doc.line(cx, cy + 2.5, cx + 8, cy + 2.5); // header separator
  doc.setFillColor(CORPORATE_BLUE[0], CORPORATE_BLUE[1], CORPORATE_BLUE[2]);
  doc.circle(cx + 2, cy + 4, 0.45, 'F');
  doc.circle(cx + 4, cy + 4, 0.45, 'F');
  doc.circle(cx + 6, cy + 4, 0.45, 'F');
  doc.circle(cx + 2, cy + 5.5, 0.45, 'F');
  doc.circle(cx + 4, cy + 5.5, 0.45, 'F');
  doc.circle(cx + 6, cy + 5.5, 0.45, 'F');

  doc.text("Periodo de Pago", leftTextX, footerY + 10.5); 

  // Phone/Contact Icon
  const px = rightIconX;
  const py = footerY + 8;
  // Modern simple envelope
  doc.roundedRect(px, py - 1, 10, 6.5, 0.8, 0.8, 'S');
  doc.line(px, py - 1, px + 5, py + 2.5);
  doc.line(px + 10, py - 1, px + 5, py + 2.5);
  
  doc.text("Consultas", rightTextX, footerY + 10.5);
  
  doc.setTextColor(110, 110, 110); 
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${entry.fortnight} Quincena de ${monthNames[entry.month - 1]} ${entry.year}`, leftTextX, footerY + 15);
  doc.text("mbenavides@tentelcom.com", rightTextX, footerY + 15);
  doc.text("Tel. 8865 1686", rightTextX, footerY + 19);

  // Disclaimer text
  const bottomY = doc.internal.pageSize.height - 10;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento generado automáticamente por TENTELCOM DEL OESTE S.A. Sistema corporativo de planillas y RRHH.", 105, bottomY, { align: "center" });

  const fileName = `Colilla_${(employee.name ?? 'Empleado').replace(/\s+/g, '_')}.pdf`;
  return { fileBlob: doc.output('blob'), fileName };
};

export const generateMaterialRequestPDF = async (request: MaterialRequest) => {
  // Validation before generation
  let validationField = '';
  if (request.origin === "IBUX-CLARO") validationField = request.fdh || '';
  else if (request.origin === "CNFL") validationField = request.planta || (request as any).plantel || '';
  else if (request.origin === "PRIVADO") validationField = request.projectName || '';

  if (!validationField) {
      console.error("No se puede generar el PDF: Falta el campo identificador para el origen", request.origin);
      return;
  }

  const tableData = request.items.map(item => {
    const quantityToDeliver = item.quantityRequested - (item.shortageQty || 0);
    return [
        item.code,
        item.description,
        quantityToDeliver.toString(),
        item.comment || ''
    ];
  }).filter(row => parseFloat(row[2]) > 0);

  const docPdf = new jsPDF('p', 'pt', 'letter');
  const pageWidth = docPdf.internal.pageSize.width;
  const pageHeight = docPdf.internal.pageSize.height;
  const margin = 40;
  
  // --- HEADER ---
  const logoWidth = 70;
  const logoHeight = 0; 
  const logoX = margin;
  const logoY = margin;

  try {
    const logoData = LOGO_BASE64;
    docPdf.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    console.warn("Logo error", error);
  }

  const headerTextX = margin + logoWidth + 20;
  let textY = margin + 15;
  
  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(14);
  docPdf.setTextColor(30, 58, 138); 
  docPdf.text("TENTELCOM DEL OESTE S.A.", headerTextX, textY);
  
  textY += 20;
  docPdf.setFontSize(16);
  docPdf.setTextColor(0, 0, 0);
  docPdf.text("SOLICITUD DE MATERIALES", headerTextX, textY);
  
  textY += 15;
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(9);
  docPdf.setTextColor(100, 116, 139); 
  docPdf.text("Requisición de materiales para despliegue en campo y proyectos", headerTextX, textY);
  
  // --- INFO SECTION ---
  let y = Math.max(textY, logoY + logoHeight) + 20;

  const allFields: { label: string; value: string }[] = [
      { label: "ID Solicitud:", value: request.requestNumber || '' },
      { label: "Fecha:", value: request.date || '' },
      { label: "Solicitante:", value: (request.requestedByName || "").split('@')[0].toUpperCase() },
      { label: "Origen del Movimiento:", value: request.origin || 'N/A' },
  ];

  if (request.origin === "IBUX-CLARO") {
      allFields.push({ label: "FDH:", value: request.fdh || '' });
      allFields.push({ label: "Torre:", value: request.torre || '' });
      allFields.push({ label: "Lugar / Distrito:", value: request.locationDetails || '' });
  } else if (request.origin === "CNFL") {
      allFields.push({ label: "Lugar / Plantel:", value: request.planta || (request as any).plantel || '' });
  } else if (request.origin === "PRIVADO") {
      allFields.push({ 
          label: "Proyecto:", 
          value: request.projectName || '',
          // @ts-expect-error - projectCode is a custom property for the PDF layout
          projectCode: request.projectCode 
      });
  }

  const mid = Math.ceil(allFields.length / 2);
  const leftFields = allFields.slice(0, mid);
  const rightFields = allFields.slice(mid);

  docPdf.setFontSize(10);
  
  // Calculate required height for left column
  let leftHeight = 20;
  leftFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      const labelWidth = docPdf.getTextWidth(field.label);
      docPdf.setFont("helvetica", "normal");
      const valX = margin + 20 + labelWidth + 10;
      const maxWidth = (pageWidth / 2) - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:", "Lugar / Plantel:", "Origen del Movimiento:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              leftHeight += 14;
          }
          const lines = docPdf.splitTextToSize(field.value, maxWidth);
          leftHeight += lines.length * 18;
      } else {
          leftHeight += 18;
      }
  });

  // Calculate required height for right column
  let rightHeight = 20;
  const rightColX = pageWidth / 2 + 10;
  rightFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      const labelWidth = docPdf.getTextWidth(field.label);
      docPdf.setFont("helvetica", "normal");
      const valX = rightColX + labelWidth + 10;
      const maxWidth = pageWidth - margin - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:", "Lugar / Plantel:", "Origen del Movimiento:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              rightHeight += 14;
          }
          const lines = docPdf.splitTextToSize(field.value, maxWidth);
          rightHeight += lines.length * 18;
      } else {
          rightHeight += 18;
      }
  });

  const boxHeight = Math.max(leftHeight, rightHeight, 20);

  docPdf.setFillColor(248, 250, 252); 
  docPdf.setDrawColor(226, 232, 240); 
  docPdf.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 5, 5, 'FD');
  
  // Render Left Column
  let currentLeftY = y + 20;
  leftFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(71, 85, 105); 
      docPdf.text(field.label, margin + 20, currentLeftY);
      
      docPdf.setFont("helvetica", "normal");
      docPdf.setTextColor(30, 41, 59); 
      const labelWidth = docPdf.getTextWidth(field.label);
      const valX = margin + 20 + labelWidth + 10;
      const maxWidth = (pageWidth / 2) - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:", "Lugar / Plantel:", "Origen del Movimiento:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              docPdf.setFont("helvetica", "bold");
              docPdf.setTextColor(30, 58, 138); // Blue
              docPdf.text((field as any).projectCode, valX, currentLeftY);
              currentLeftY += 14;
              docPdf.setTextColor(30, 41, 59); // Back to normal
              docPdf.setFont("helvetica", "normal");
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentLeftY);
              currentLeftY += lines.length * 18;
          } else {
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentLeftY);
              currentLeftY += lines.length * 18;
          }
      } else {
          docPdf.text(field.value, valX, currentLeftY);
          currentLeftY += 18;
      }
  });

  // Render Right Column
  let currentRightY = y + 20;
  rightFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(71, 85, 105); 
      docPdf.text(field.label, rightColX, currentRightY);
      
      docPdf.setFont("helvetica", "normal");
      docPdf.setTextColor(30, 41, 59); 
      const labelWidth = docPdf.getTextWidth(field.label);
      const valX = rightColX + labelWidth + 10;
      const maxWidth = pageWidth - margin - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:", "Lugar / Plantel:", "Origen del Movimiento:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              docPdf.setFont("helvetica", "bold");
              docPdf.setTextColor(30, 58, 138); // Blue
              docPdf.text((field as any).projectCode, valX, currentRightY);
              currentRightY += 14;
              docPdf.setTextColor(30, 41, 59); // Back to normal
              docPdf.setFont("helvetica", "normal");
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentRightY);
              currentRightY += lines.length * 18;
          } else {
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentRightY);
              currentRightY += lines.length * 18;
          }
      } else {
          docPdf.text(field.value, valX, currentRightY);
          currentRightY += 18;
      }
  });

  y += boxHeight + 25;

  // --- TABLE ITEMS ---
  const rowHeight = 25;
  const headHeight = 30;
  const tableHeight = (tableData.length * rowHeight) + headHeight;
  const marginBottom = 40;
  const espacioDisponibleTable = pageHeight - y - marginBottom;

  if (tableHeight > espacioDisponibleTable) {
      docPdf.addPage();
      y = margin;
  }

  autoTable(docPdf, {
      startY: y,
      head: [["CÓDIGO", "DESCRIPCIÓN DEL MATERIAL", "CANTIDAD", "COMENTARIO"]],
      body: tableData,
      theme: 'grid',
      styles: {
          fontSize: 9,
          cellPadding: 6,
          valign: 'middle',
          font: 'helvetica',
          lineWidth: 0.1,
          lineColor: [200, 200, 200],
      },
      headStyles: {
          fillColor: [30, 58, 138], 
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
      },
      columnStyles: {
          0: { halign: 'center', cellWidth: 70 },
          1: { halign: 'left' },
          2: { halign: 'center', cellWidth: 60 },
          3: { halign: 'left', cellWidth: 100 }
      },
      margin: { left: margin, right: margin }
  });

  // --- OBSERVACIONES ---
  if (request.observations) {
      let obsY = (docPdf as any).lastAutoTable.finalY + 20;
      const obsLines = docPdf.splitTextToSize(request.observations, pageWidth - margin * 2);
      const obsHeight = (obsLines.length * 12) + 10;
      const espacioDisponibleObs = pageHeight - obsY - marginBottom;

      if (obsHeight > espacioDisponibleObs) {
          docPdf.addPage();
          obsY = margin + 20;
      }
      
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(10);
      docPdf.text("OBSERVACIONES:", margin, obsY);
      obsY += 15;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      docPdf.rect(margin, obsY - 10, pageWidth - margin * 2, (obsLines.length * 12) + 10);
      docPdf.text(obsLines, margin + 5, obsY);
  }

  // --- SIGNATURES ---
  const finalY = (docPdf as any).lastAutoTable.finalY || y;
  let sigY = finalY + 60;
  const sigHeight = 60;
  const espacioDisponibleSig = pageHeight - sigY - marginBottom;
  
  if (sigHeight > espacioDisponibleSig) {
      docPdf.addPage();
      sigY = margin + 40;
  }

  const leftX = margin + 40;
  const rightX = pageWidth - margin - 190;

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(10);
  docPdf.setTextColor(0, 0, 0);

  // Entrega
  const entregaText = "ENTREGA";
  const entregaWidth = docPdf.getTextWidth(entregaText);
  docPdf.setDrawColor(0, 0, 0);
  docPdf.setLineWidth(1);
  docPdf.line(leftX, sigY, leftX + 150, sigY);
  docPdf.text(entregaText, leftX + (150 - entregaWidth) / 2, sigY + 15);
  
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(10);
  docPdf.text("Ronald Ramírez", leftX + 75, sigY + 30, null, null, 'center');

  // Recibe
  docPdf.setFont("helvetica", "bold");
  const recibeText = "RECIBE";
  const recibeWidth = docPdf.getTextWidth(recibeText);
  docPdf.setDrawColor(0, 0, 0);
  docPdf.setLineWidth(1);
  docPdf.line(rightX, sigY, rightX + 150, sigY);
  docPdf.text(recibeText, rightX + (150 - recibeWidth) / 2, sigY + 15);

  // --- FOOTER ---

  // --- FOOTER ---
  const pageCount = (docPdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
      docPdf.setPage(i);
      docPdf.setFontSize(8);
      docPdf.setTextColor(100);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("TENTELCOM DEL OESTE S.A. – Documento generado automáticamente", pageWidth / 2, pageHeight - 15, { align: 'center' });
  }

  let baseName = '';
  if (request.origin === "IBUX-CLARO") {
      baseName = request.fdh || '';
  } else if (request.origin === "CNFL") {
      baseName = request.planta || (request as any).plantel || '';
  } else if (request.origin === "PRIVADO") {
      baseName = request.projectName || '';
  }

  if (!baseName) {
      console.warn("Missing required field for filename based on origin:", request.origin);
  }
  
  const fileName = `Solicitud_Materiales_${baseName.replace(/[\s-]+/g, '_')}.pdf`;
  const blob = docPdf.output('blob');
  triggerFileDownload(blob, fileName);
};

export const generateShortagePDF = async (shortage: Shortage) => {
  let request: MaterialRequest | null = null;
  if (shortage.requestId) {
    try {
      const reqRef = doc(db, 'material_reports', shortage.requestId);
      const reqSnap = await getDoc(reqRef);
      if (reqSnap.exists()) {
        request = { id: reqSnap.id, ...reqSnap.data() } as MaterialRequest;
      }
    } catch (error) {
      console.error("Error fetching original request for shortage PDF", error);
    }
  }

  const docPdf = new jsPDF('p', 'pt', 'letter');
  const pageWidth = docPdf.internal.pageSize.width;
  const pageHeight = docPdf.internal.pageSize.height;
  const margin = 40;
  
  // --- HEADER ---
  const logoWidth = 70;
  const logoHeight = 0; 
  const logoX = margin;
  const logoY = margin;

  try {
    const logoData = LOGO_BASE64;
    docPdf.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    console.warn("Logo error", error);
  }

  const headerTextX = margin + logoWidth + 20;
  let textY = margin + 15;
  
  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(14);
  docPdf.setTextColor(30, 58, 138); 
  docPdf.text("TENTELCOM DEL OESTE S.A.", headerTextX, textY);
  
  textY += 20;
  docPdf.setFontSize(16);
  docPdf.setTextColor(0, 0, 0);
  docPdf.text("FALTANTES DE INVENTARIO", headerTextX, textY);
  
  textY += 15;
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(9);
  docPdf.setTextColor(100, 116, 139); 
  docPdf.text("Reporte de materiales faltantes para solicitud", headerTextX, textY);
  
  // --- INFO SECTION ---
  let y = Math.max(textY, logoY + logoHeight) + 20;

  const metadata = {
    proyecto: normalizeOrigin(shortage.origin || request?.origin || shortage.projectName || '---'),
    projectCode: request?.projectCode || '',
    fecha: request?.date || (shortage.date ? new Date(shortage.date).toISOString().split('T')[0] : '---'),
    fdh: request?.fdh || '---',
    torre: request?.torre || request?.tower || '---',
    lugar: request?.locationDetails || '---',
    solicitud: request?.requestNumber || shortage.requestNumber || 'SOL-XXXX',
    solicitante: (shortage.requestedByName || request?.requestedByName || "").split('@')[0].toUpperCase(),
    estado: shortage.status || 'Pendiente'
  };

  const allFields = [
      { label: "ID Solicitud:", value: metadata.solicitud },
      { label: "Proyecto:", value: metadata.proyecto, projectCode: metadata.projectCode },
      { label: "Fecha:", value: metadata.fecha },
      { label: "Solicitante:", value: metadata.solicitante },
      { label: "Estado Faltante:", value: metadata.estado.toUpperCase() },
      { label: "FDH:", value: metadata.fdh },
      { label: "Torre:", value: metadata.torre },
      { label: "Lugar / Distrito:", value: metadata.lugar },
  ];

  const mid = Math.ceil(allFields.length / 2);
  const leftFields = allFields.slice(0, mid);
  const rightFields = allFields.slice(mid);

  docPdf.setFontSize(10);
  
  // Calculate required height for left column
  let leftHeight = 20;
  leftFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      const labelWidth = docPdf.getTextWidth(field.label);
      docPdf.setFont("helvetica", "normal");
      const valX = margin + 20 + labelWidth + 10;
      const maxWidth = (pageWidth / 2) - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              leftHeight += 14;
          }
          const lines = docPdf.splitTextToSize(field.value, maxWidth);
          leftHeight += lines.length * 18;
      } else {
          leftHeight += 18;
      }
  });

  // Calculate required height for right column
  let rightHeight = 20;
  const rightColX = pageWidth / 2 + 10;
  rightFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      const labelWidth = docPdf.getTextWidth(field.label);
      docPdf.setFont("helvetica", "normal");
      const valX = rightColX + labelWidth + 10;
      const maxWidth = pageWidth - margin - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              rightHeight += 14;
          }
          const lines = docPdf.splitTextToSize(field.value, maxWidth);
          rightHeight += lines.length * 18;
      } else {
          rightHeight += 18;
      }
  });

  const boxHeight = Math.max(leftHeight, rightHeight, 20);

  docPdf.setFillColor(248, 250, 252); 
  docPdf.setDrawColor(226, 232, 240); 
  docPdf.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 5, 5, 'FD');
  
  // Render Left Column
  let currentLeftY = y + 20;
  leftFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(71, 85, 105); 
      docPdf.text(field.label, margin + 20, currentLeftY);
      
      docPdf.setFont("helvetica", "normal");
      docPdf.setTextColor(30, 41, 59); 
      const labelWidth = docPdf.getTextWidth(field.label);
      const valX = margin + 20 + labelWidth + 10;
      const maxWidth = (pageWidth / 2) - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              docPdf.setFont("helvetica", "bold");
              docPdf.setTextColor(30, 58, 138); // Blue
              docPdf.text((field as any).projectCode, valX, currentLeftY);
              currentLeftY += 14;
              docPdf.setTextColor(30, 41, 59); // Back to normal
              docPdf.setFont("helvetica", "normal");
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentLeftY);
              currentLeftY += lines.length * 18;
          } else {
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentLeftY);
              currentLeftY += lines.length * 18;
          }
      } else {
          docPdf.text(field.value, valX, currentLeftY);
          currentLeftY += 18;
      }
  });

  // Render Right Column
  let currentRightY = y + 20;
  rightFields.forEach(field => {
      docPdf.setFont("helvetica", "bold");
      docPdf.setTextColor(71, 85, 105); 
      docPdf.text(field.label, rightColX, currentRightY);
      
      docPdf.setFont("helvetica", "normal");
      docPdf.setTextColor(30, 41, 59); 
      const labelWidth = docPdf.getTextWidth(field.label);
      const valX = rightColX + labelWidth + 10;
      const maxWidth = pageWidth - margin - valX;
      
      const isLongField = ["Proyecto:", "Lugar / Distrito:"].includes(field.label);
      
      if (isLongField) {
          if (field.label === "Proyecto:" && (field as any).projectCode) {
              docPdf.setFont("helvetica", "bold");
              docPdf.setTextColor(30, 58, 138); // Blue
              docPdf.text((field as any).projectCode, valX, currentRightY);
              currentRightY += 14;
              docPdf.setTextColor(30, 41, 59); // Back to normal
              docPdf.setFont("helvetica", "normal");
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentRightY);
              currentRightY += lines.length * 18;
          } else {
              const lines = docPdf.splitTextToSize(field.value, maxWidth);
              docPdf.text(lines, valX, currentRightY);
              currentRightY += lines.length * 18;
          }
      } else {
          docPdf.text(field.value, valX, currentRightY);
          currentRightY += 18;
      }
  });

  y += boxHeight + 25;

  // --- TABLE ---
  const tableData = (shortage.items || []).map(item => {
      // Intentar obtener la unidad de medida desde el request original
      let unit = '-';
      if (request && request.items) {
          const reqItem = request.items.find(ri => ri.code === item.materialCode || ri.inventoryItemId === item.materialId);
          if (reqItem && reqItem.unit) {
              unit = reqItem.unit;
          }
      }

      return [
          item.materialCode,
          item.materialDescription,
          item.quantityShortage.toString(),
          unit,
          (request && request.items && request.items.find(ri => ri.code === item.materialCode)?.comment) || ''
      ];
  });

  autoTable(docPdf, {
      startY: y,
      head: [["CÓDIGO", "DESCRIPCIÓN DEL MATERIAL", "CANTIDAD", "U.M.", "COMENTARIO"]],
      body: tableData,
      theme: 'grid',
      styles: {
          fontSize: 9,
          cellPadding: 6,
          valign: 'middle',
          font: 'helvetica',
          lineWidth: 0.1,
          lineColor: [200, 200, 200],
      },
      headStyles: {
          fillColor: [30, 58, 138], 
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
      },
      columnStyles: {
          0: { halign: 'center', cellWidth: 70 },
          1: { halign: 'left' },
          2: { halign: 'center', cellWidth: 50 },
          3: { halign: 'center', cellWidth: 40 },
          4: { halign: 'left', cellWidth: 100 }
      },
      margin: { left: margin, right: margin }
  });

  // --- OBSERVACIONES ---
  if (request && request.observations) {
      let obsY = (docPdf as any).lastAutoTable.finalY + 20;
      const marginBottom = 40;
      const obsLines = docPdf.splitTextToSize(request.observations, pageWidth - margin * 2);
      const obsHeight = (obsLines.length * 12) + 10;
      const espacioDisponibleObs = pageHeight - obsY - marginBottom;

      if (obsHeight > espacioDisponibleObs) {
          docPdf.addPage();
          obsY = margin + 20;
      }
      
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(10);
      docPdf.text("OBSERVACIONES:", margin, obsY);
      obsY += 15;
      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(9);
      docPdf.rect(margin, obsY - 10, pageWidth - margin * 2, (obsLines.length * 12) + 10);
      docPdf.text(obsLines, margin + 5, obsY);
  }

  // --- SIGNATURES ---
  const finalY = (docPdf as any).lastAutoTable.finalY + ((request && request.observations) ? 50 : 0);
  let sigY = finalY + 60;
  const sigHeight = 60;
  const marginBottom = 40;
  const espacioDisponibleSig = pageHeight - sigY - marginBottom;
  
  if (sigHeight > espacioDisponibleSig) {
      docPdf.addPage();
      sigY = margin + 40;
  }

  const leftX = margin + 40;
  const rightX = pageWidth - margin - 190;

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(10);
  docPdf.setTextColor(0, 0, 0);

  // Entrega
  const entregaText = "ENTREGA";
  const entregaWidth = docPdf.getTextWidth(entregaText);
  docPdf.setDrawColor(0, 0, 0);
  docPdf.setLineWidth(1);
  docPdf.line(leftX, sigY, leftX + 150, sigY);
  docPdf.text(entregaText, leftX + (150 - entregaWidth) / 2, sigY + 15);
  
  // Recibe
  const recibeText = "RECIBE";
  const recibeWidth = docPdf.getTextWidth(recibeText);
  docPdf.line(rightX, sigY, rightX + 150, sigY);
  docPdf.text(recibeText, rightX + (150 - recibeWidth) / 2, sigY + 15);

  // --- FOOTER ---
  const pageCount = (docPdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
      docPdf.setPage(i);
      docPdf.setFontSize(8);
      docPdf.setTextColor(100);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("TENTELCOM DEL OESTE S.A. – Documento generado automáticamente", pageWidth / 2, pageHeight - 15, { align: 'center' });
  }

  const baseName = (request?.projectId && request.projectId !== 'N/A' && request.projectName)
    ? request.projectName
    : (request?.fdh || 'N_A');
  
  const fileName = `Faltantes_Materiales_${baseName.replace(/[\s-]+/g, '_')}.pdf`;
  const blob = docPdf.output('blob');
  triggerFileDownload(blob, fileName);
};

import { normalizeOrigin } from './originUtils';

export const generateAutomaticAdjustmentPDF = async (adjustment: AutomaticAdjustment, history: any[]) => {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 40;

  // --- HEADER ---
  try {
    const logoData = LOGO_BASE64;
    doc.addImage(logoData, 'PNG', margin, margin - 10, 80, 0);
  } catch (e) { console.error(e); }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text("TENTELCOM DEL OESTE S.A.", margin + 90, margin + 5);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Detalle de Ajuste Automático", margin + 90, margin + 20);
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-CR')}`, margin + 90, margin + 35);

  let y = margin + 70;
  
  // General Info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text("INFORMACIÓN GENERAL", margin, y);
  y += 20;

  doc.setFontSize(9);
  
  // Col 1
  doc.setTextColor(30, 58, 138);
  doc.text("Colaborador:", margin, y);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adjustment.employeeName}`, margin + 80, y);
  y += 15;
  doc.setTextColor(30, 58, 138);
  doc.text("Concepto:", margin, y);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adjustment.conceptName}`, margin + 80, y);
  y += 15;
  doc.setTextColor(30, 58, 138);
  doc.text("Fecha creación:", margin, y);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adjustment.createdAt ? new Date(adjustment.createdAt).toLocaleDateString('es-CR') : '---'}`, margin + 80, y);
  
  // Col 2
  let y2 = y - 30;
  doc.setTextColor(30, 58, 138);
  doc.text("Tipo:", pageWidth / 2, y2);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adjustment.type === 'ingreso' ? 'INGRESO (+)' : 'DEDUCCIÓN (-)'}`, pageWidth / 2 + 80, y2);
  y2 += 15;
  doc.setTextColor(30, 58, 138);
  doc.text("Estado:", pageWidth / 2, y2);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adjustment.status.toUpperCase()}`, pageWidth / 2 + 80, y2);
  y2 += 15;
  doc.setTextColor(30, 58, 138);
  doc.text("Comentario:", pageWidth / 2, y2);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adjustment.comment || 'N/A'}`, pageWidth / 2 + 80, y2);
  
  y += 25;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Summary
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("RESUMEN FINANCIERO", margin, y);
  y += 10;
  
  const totalPagado = adjustment.totalAmount - adjustment.pendingBalance;
  
  autoTable(doc, {
      startY: y,
      head: [["DESCRIPCIÓN", "MONEDA", "MONTO"]],
      body: [
          ["Monto Total", "CRC", adjustment.totalAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })],
          ["Cuota Quincenal", "CRC", adjustment.fortnightlyQuota.toLocaleString('es-CR', { minimumFractionDigits: 2 })],
          ["Total Pagado", "CRC", totalPagado.toLocaleString('es-CR', { minimumFractionDigits: 2 })],
          ["Saldo Pendiente", "CRC", adjustment.pendingBalance.toLocaleString('es-CR', { minimumFractionDigits: 2 })]
      ],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } }
  });

  y = (doc as any).lastAutoTable.finalY + 30;

  // History
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("REGISTRO HISTÓRICO", margin, y);
  y += 10;
  
  const tableData = history.map(item => [
      item.date instanceof Date ? item.date.toLocaleDateString('es-CR') : new Date(item.date).toLocaleDateString('es-CR'),
      item.planillaId,
      item.type.toUpperCase(),
      "CRC",
      item.amount.toLocaleString('es-CR', { minimumFractionDigits: 2 }),
      item.status.toUpperCase(),
  ]);

  autoTable(doc, {
      startY: y,
      head: [["FECHA", "NÚM. PLANILLA", "TIPO", "MONEDA", "MONTO", "ESTADO"]],
      body: tableData.length > 0 ? tableData : [["---", "---", "---", "---", "---", "---"]],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' } }
  });

  const fileName = `AJUSTE_AUTOMATICO_${adjustment.employeeName.replace(/\s+/g, '_')}_${adjustment.id.slice(-6).toUpperCase()}.pdf`;
  const blob = doc.output('blob');
  triggerFileDownload(blob, fileName);
};

export const generateProjectConsumptionPDF = async (
  projectName: string,
  consumptionData: any[],
  totals: { usd: number; crc: number },
  isUserAdmin: boolean,
  selectedData?: any
) => {
  const doc = new jsPDF('p', 'pt');
  const margin = 40;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // --- HEADER ---
  try {
    const logoData = LOGO_BASE64;
    doc.addImage(logoData, 'PNG', margin, margin - 10, 80, 0);
  } catch (e) { console.error(e); }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text("TENTELCOM DEL OESTE S.A.", margin + 90, margin + 5);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text("REPORTE DE CONSUMO DE MATERIALES POR PROYECTO", margin + 90, margin + 20);

  let y = margin + 60;

  // --- RECUADRO GRIS (METADATA) ---
  if (selectedData) {
      doc.setFillColor(243, 246, 250);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 85, 5, 5, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.setFont('helvetica', 'bold');
      
      const labelX = margin + 15;
      const valueX = margin + 110;
      const col2 = margin + 340;
      const valCol2 = col2 + 90;
      
      doc.text(`PROYECTO / ORIGEN:`, labelX, y + 20);
      doc.setTextColor(0,0,0);
      const projectDisplay = selectedData.projectCode 
          ? `${selectedData.projectCode} - ${normalizeOrigin(selectedData.origin || selectedData.projectName || '---')}`
          : normalizeOrigin(selectedData.origin || selectedData.projectName || '---');
      doc.text(projectDisplay, valueX, y + 20);
      
      doc.setTextColor(110, 110, 110);
      doc.text(`ID SOLICITUD:`, col2, y + 20);
      doc.setTextColor(0,0,0);
      doc.text(`${selectedData.requestNumber || 'SOL-XXXX'}`, valCol2, y + 20);
      
      doc.setTextColor(110, 110, 110);
      doc.text(`FECHA:`, labelX, y + 40);
      doc.setTextColor(0,0,0);
      doc.text(`${selectedData.date || '---'}`, valueX, y + 40);
      
      doc.setTextColor(110, 110, 110);
      doc.text(`FDH:`, col2, y + 40);
      doc.setTextColor(0,0,0);
      doc.text(`${selectedData.fdh || '---'}`, valCol2, y + 40);
      
      doc.setTextColor(110, 110, 110);
      doc.text(`TORRE:`, labelX, y + 60);
      doc.setTextColor(0,0,0);
      doc.text(`${selectedData.tower || selectedData.torre || '---'}`, valueX, y + 60);
      
      doc.setTextColor(110, 110, 110);
      doc.text(`LUGAR / DISTRITO:`, col2, y + 60);
      doc.setTextColor(0,0,0);
      doc.text(`${selectedData.locationDetails || '---'}`, valCol2, y + 60);
      
      y += 105;
  } else {
      // --- INFO (OLD) ---
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 51, 61);
      doc.text("Proyecto:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, margin + 70, y);
      
      const dateStr = new Date().toLocaleDateString('es-CR');
      doc.setFont("helvetica", "bold");
      doc.text("Fecha:", pageWidth - margin - 120, y);
      doc.setFont("helvetica", "normal");
      doc.text(dateStr, pageWidth - margin - 70, y);

      y += 30;
  }


  // --- TABLE ---
  const head = isUserAdmin 
    ? [['CÓDIGO', 'DESCRIPCIÓN', 'CANT', 'MONEDA', 'PRECIO U.', 'SUBTOTAL']]
    : [['CÓDIGO', 'DESCRIPCIÓN', 'CANT', 'MONEDA']];

  const formatNum = (num: number) => {
    return num.toLocaleString('es-CR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const body = consumptionData.map(item => {
    const row = [
      item.code,
      item.description,
      item.totalQuantity.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      item.currency
    ];
    if (isUserAdmin) {
      row.push(
        formatNum(item.unitPrice),
        formatNum(item.totalCost)
      );
    }
    return row;
  });

  autoTable(doc, {
    startY: y,
    head: head,
    body: body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'center', cellWidth: 50 },
      4: { halign: 'right', cellWidth: 70 },
      5: { halign: 'right', cellWidth: 70 }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 30;

  // --- TOTALS ---
  if (isUserAdmin) {
    if (y + 60 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("TOTAL GENERAL DEL COSTO DE MATERIALES", margin, y);
    y += 20;

    doc.setFontSize(10);
    doc.setTextColor(41, 51, 61);
    if (totals.usd > 0) {
      doc.text(`TOTAL USD: ${formatNum(totals.usd)}`, margin, y);
      y += 15;
    }
    if (totals.crc > 0) {
      doc.text(`TOTAL CRC: ${formatNum(totals.crc)}`, margin, y);
      y += 15;
    }
  }

  const fileName = `REPORTE_CONSUMO_${projectName.replace(/[\s-]+/g, '_')}.pdf`;
  const blob = doc.output('blob');
  triggerFileDownload(blob, fileName);
};
