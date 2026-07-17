
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '../logoBase64';

// --- INTERFACES DE DATOS (Dumb Data) ---

export interface DetailedReportHeader {
  projectName: string;
  projectCode?: string;
  clientName: string;
  currency: string;
  refId: string;
  date: string;
  exchangeRate: number;
  period: string; // Se usará para mostrar los filtros si T.C. está oculto
  userName: string;
  projectCount: string; // O el dato "Total Items" que va en la derecha
}

export interface DetailedReportKPIs {
  budget: string;
  costs: string;
  utility: string;
  margin: string; // Texto formateado ej: "25.0%"
  marginValue: number; // Valor numérico para cálculo de color
}

export interface DetailedReportTables {
  breakdown: string[][]; // Matriz para autoTable
  history: string[][];   // Matriz para autoTable
}

export interface DetailedReportTotals {
  crc: string;
  usd: string;
}

// Configuración opcional para sobreescribir defaults sin romper otros reportes
export interface DetailedReportConfig {
  mainTitle?: string; // Título principal personalizado
  subTitle?: string;  // Subtítulo personalizado
  hideExchangeRate?: boolean; // Nuevo: Ocultar T.C. y mostrar Periodo/Filtros
  hideKPIs?: boolean; // Nuevo: Ocultar tarjetas de KPIs
  hideTotals?: boolean; // Nuevo: Ocultar bloque de totales al final
  table1?: {
    title?: string;
    headers?: string[];
    columnStyles?: any;
  };
  table2?: {
    hidden?: boolean;
    title?: string;
    headers?: string[];
  };
}

export interface DetailedFinancialReportData {
  header: DetailedReportHeader;
  kpis: DetailedReportKPIs;
  tables: DetailedReportTables;
  totals: DetailedReportTotals;
  config?: DetailedReportConfig; // Nuevo campo opcional
}

// --- CONFIGURACIÓN DE ESTILOS (CONSTANTES) ---

const COLORS = {
  BLUE_900: [30, 58, 138] as [number, number, number],
  SLATE_500: [100, 116, 139] as [number, number, number],
  SLATE_200: [226, 232, 240] as [number, number, number],
  SLATE_50: [248, 250, 252] as [number, number, number],
  LABEL_GRAY: [148, 163, 184] as [number, number, number],
  VALUE_DARK: [15, 23, 42] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
  // KPI Lines
  KPI_BLUE: [37, 99, 235] as [number, number, number],
  KPI_RED: [220, 38, 38] as [number, number, number],
  KPI_GREEN: [22, 163, 74] as [number, number, number],
  KPI_AMBER: [217, 119, 6] as [number, number, number],
  // Table
  TABLE_HEAD_BG: [241, 245, 249] as [number, number, number],
  TABLE_HEAD_TXT: [71, 85, 105] as [number, number, number],
  TABLE_BODY_TXT: [51, 65, 85] as [number, number, number],
};

/**
 * Renderiza el Informe Financiero Detallado siguiendo la especificación maestra.
 * Unidades: mm
 * Formato: A4 Portrait
 */
export const renderDetailedFinancialLayout = async (
  doc: jsPDF,
  data: DetailedFinancialReportData
): Promise<void> => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  let y = 20;

  // 1️⃣ ENCABEZADO
  // A. Logo (Asíncrono)
  const logoWidth = 35;
  const logoHeight = 0;
  const logoX = pageWidth - margin - logoWidth;
  const logoY = 10;

  try {
    const logoData = LOGO_BASE64;
    doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (e) {
    console.warn("Logo no cargado", e);
  }

  // B. Título Principal
  doc.setFontSize(16);
  doc.setTextColor(COLORS.BLUE_900[0], COLORS.BLUE_900[1], COLORS.BLUE_900[2]);
  doc.setFont("helvetica", "bold");
  // Uso de título personalizado o fallback al default
  const mainTitle = data.config?.mainTitle || "INFORME FINANCIERO DETALLADO";
  doc.text(mainTitle, margin, 20);

  // C. Subtítulo
  y = 26;
  doc.setFontSize(9);
  doc.setTextColor(COLORS.SLATE_500[0], COLORS.SLATE_500[1], COLORS.SLATE_500[2]);
  doc.setFont("helvetica", "normal");
  // Uso de subtítulo personalizado o fallback al default
  const subTitle = data.config?.subTitle || "Análisis financiero del proyecto";
  doc.text(subTitle, margin, y);

  y += 8;

  // 2️⃣ BLOQUE SUPERIOR DE INFORMACIÓN (Caja Gris)
  const boxHeight = 16;
  
  // Contenedor Principal
  doc.setFillColor(COLORS.SLATE_50[0], COLORS.SLATE_50[1], COLORS.SLATE_50[2]);
  doc.setDrawColor(COLORS.SLATE_200[0], COLORS.SLATE_200[1], COLORS.SLATE_200[2]);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), boxHeight, 2, 2, 'FD');

  // Línea Divisoria
  doc.setDrawColor(COLORS.SLATE_200[0], COLORS.SLATE_200[1], COLORS.SLATE_200[2]);
  doc.setLineWidth(0.1);
  doc.line(margin, y + 8, pageWidth - margin, y + 8);

  // Helper para dibujar campos
  const drawField = (label: string, value: string, x: number, yPos: number, align: 'left' | 'right' = 'left') => {
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.LABEL_GRAY[0], COLORS.LABEL_GRAY[1], COLORS.LABEL_GRAY[2]);

    let labelX = x;
    let valueX = x;

    if (align === 'right') {
      doc.setFontSize(7);
      const valW = doc.getTextWidth(value);
      valueX = x - valW;

      doc.setFontSize(6);
      const labelW = doc.getTextWidth(label);
      labelX = valueX - labelW - 3; // Separación 3u
    } else {
      const labelW = doc.getTextWidth(label);
      valueX = x + labelW + 3; // Separación 3u
    }

    doc.text(label, labelX, yPos);

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.VALUE_DARK[0], COLORS.VALUE_DARK[1], COLORS.VALUE_DARK[2]);
    doc.text(value, valueX, yPos);
  };

  const row1Y = y + 5.5;
  const row2Y = y + 13.5;
  const col1X = margin + 6; // 20
  const col2X = margin + 90; // 104
  const col3X = pageWidth - margin - 6;

  // Datos Fila 1
  const projectDisplay = data.header.projectCode 
    ? `${data.header.projectCode} | ${data.header.projectName.substring(0, 25)}`
    : data.header.projectName.substring(0, 35);
  drawField("Proyecto:", projectDisplay, col1X, row1Y);
  drawField("CLIENTE:", data.header.clientName.substring(0, 25), col2X, row1Y);
  drawField("MONEDA:", data.header.currency, col3X, row1Y, 'right');

  // Datos Fila 2
  drawField("ID REF:", data.header.refId, col1X, row2Y);
  drawField("FECHA:", data.header.date, col2X, row2Y);
  
  // CONDICIONAL: Mostrar FILTROS (Periodo) en lugar de T.C. si está configurado
  if (data.config?.hideExchangeRate) {
    drawField("FILTROS:", data.header.period, col3X, row2Y, 'right');
  } else {
    drawField("T.C.:", `${data.header.exchangeRate}`, col3X, row2Y, 'right');
  }

  y += boxHeight + 8; // Offset acumulativo (34 + 16 + 8 = 58)

  // 3️⃣ TARJETAS KPI (CONDICIONAL)
  // Se renderizan solo si no están ocultas en la configuración
  if (!data.config?.hideKPIs) {
    const kpiWidth = (pageWidth - (margin * 2) - 9) / 4; // Ancho disponible - 3 gaps de 3u, entre 4
    const kpiHeight = 16;
    let kpiX = margin;

    const drawCard = (x: number, label: string, value: string, colorRGB: [number, number, number]) => {
        // Fondo y Borde
        doc.setDrawColor(COLORS.SLATE_200[0], COLORS.SLATE_200[1], COLORS.SLATE_200[2]);
        doc.setFillColor(COLORS.WHITE[0], COLORS.WHITE[1], COLORS.WHITE[2]);
        doc.roundedRect(x, y, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');

        // Línea de Acento (Subrayado inferior)
        doc.setDrawColor(colorRGB[0], colorRGB[1], colorRGB[2]);
        doc.setLineWidth(0.5);
        doc.line(x + 2, y + kpiHeight - 0.5, x + kpiWidth - 2, y + kpiHeight - 0.5);

        // Etiqueta
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(COLORS.LABEL_GRAY[0], COLORS.LABEL_GRAY[1], COLORS.LABEL_GRAY[2]);
        doc.text(label, x + 4, y + 5.5);

        // Valor
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
        doc.text(value, x + 4, y + 12);
    };

    // Cálculo de color de margen
    const mVal = data.kpis.marginValue;
    const marginColor: [number, number, number] = 
        mVal >= 20 ? COLORS.KPI_GREEN : 
        mVal > 0 ? COLORS.KPI_AMBER : 
        COLORS.KPI_RED;

    // Dibujar las 4 tarjetas
    drawCard(kpiX, "PRESUPUESTO", data.kpis.budget, COLORS.KPI_BLUE);
    kpiX += kpiWidth + 3;

    drawCard(kpiX, "COSTOS REALES", data.kpis.costs, COLORS.KPI_RED);
    kpiX += kpiWidth + 3;

    drawCard(kpiX, "UTILIDAD PROY.", data.kpis.utility, COLORS.KPI_GREEN);
    kpiX += kpiWidth + 3;

    drawCard(kpiX, "MARGEN RENT.", data.kpis.margin, marginColor);

    y += kpiHeight + 10;
  }

  // 4️⃣ TABLAS (AutoTable)

  // Configuración dinámica Tabla 1
  const t1Title = data.config?.table1?.title || "DESGLOSE DE COSTOS";
  const t1Head = data.config?.table1?.headers ? [data.config.table1.headers] : [['CATEGORÍA', 'ITEMS', 'MONTO USD', 'MONTO CRC']];
  const t1Styles = data.config?.table1?.columnStyles || {
    0: { halign: 'left', fontStyle: 'bold' },
    1: { halign: 'center' },
    2: { halign: 'right' },
    3: { halign: 'right' }
  };

  // Tabla 1: Principal
  doc.setFontSize(8);
  doc.setTextColor(COLORS.BLUE_900[0], COLORS.BLUE_900[1], COLORS.BLUE_900[2]);
  doc.setFont("helvetica", "bold");
  doc.text(t1Title, margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: t1Head,
    body: data.tables.breakdown,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.TABLE_HEAD_BG,
      textColor: COLORS.TABLE_HEAD_TXT,
      fontSize: 6,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.5,
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      fontSize: 6,
      textColor: COLORS.TABLE_BODY_TXT,
      cellPadding: 1.5,
      lineWidth: 0.1,
      lineColor: COLORS.SLATE_200
    },
    columnStyles: t1Styles,
    margin: { left: margin, right: margin }
  });

  // Espacio entre tablas
  y = (doc as any).lastAutoTable.finalY + 10;

  // Tabla 2: Secundaria (Opcional/Historial)
  // Solo se renderiza si NO está oculta explícitamente en la config
  if (!data.config?.table2?.hidden) {
    const t2Title = data.config?.table2?.title || "HISTORIAL DE MOVIMIENTOS";
    const t2Head = data.config?.table2?.headers ? [data.config.table2.headers] : [['FECHA', 'DESCRIPCIÓN', 'TIPO', 'MON', 'MONTO']];

    doc.setFontSize(8);
    doc.setTextColor(COLORS.BLUE_900[0], COLORS.BLUE_900[1], COLORS.BLUE_900[2]);
    doc.text(t2Title, margin, y);
    y += 3;
    autoTable(doc, {
        startY: y,
        head: t2Head,
        body: data.tables.history,
        theme: 'grid',
        headStyles: {
        fillColor: COLORS.TABLE_HEAD_BG,
        textColor: COLORS.TABLE_HEAD_TXT,
        fontSize: 6,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 1.5,
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
        },
        bodyStyles: {
        fontSize: 6,
        textColor: COLORS.TABLE_BODY_TXT,
        cellPadding: 1.5,
        lineWidth: 0.1,
        lineColor: COLORS.SLATE_200
        },
        columnStyles: {
        0: { halign: 'left', cellWidth: 20 },
        1: { halign: 'left' },
        2: { halign: 'left', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 10 },
        4: { halign: 'right', cellWidth: 25, fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
    });
    
    // Actualizar Y para bloques siguientes
    y = (doc as any).lastAutoTable.finalY;
  } else {
    // Si se ocultó la tabla 2, usamos el finalY de la tabla 1
    y = (doc as any).lastAutoTable.finalY;
  }

  // Manejo de Salto de Página para Bloque de Totales
  if (y > pageHeight - 40) {
    doc.addPage();
    y = margin;
  } else {
    y += 10;
  }

  // 5️⃣ BLOQUE DE TOTALES DINÁMICO (Derecha estricta)
  // Solo se renderiza si no está oculto
  if (!data.config?.hideTotals) {
    // Establecer fuente para medir anchos reales
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");

    // Ancho Columna 1: Etiquetas (MONEDA, CRC, USD) + Padding
    const labelColWidth = Math.max(
        doc.getTextWidth("MONEDA"),
        doc.getTextWidth("CRC"),
        doc.getTextWidth("USD")
    ) + 6; // Padding

    // Ancho Columna 2: Valores (Encabezado y Montos) + Padding
    const valueColWidth = Math.max(
        doc.getTextWidth("TOTAL ACUMULADO"),
        doc.getTextWidth(data.totals.crc),
        doc.getTextWidth(data.totals.usd)
    ) + 6; // Padding

    // Ancho total del bloque y posición X inicial
    const totalsTableWidth = labelColWidth + valueColWidth;
    const totalsX = pageWidth - margin - totalsTableWidth;

    // Línea Superior Azul
    doc.setDrawColor(COLORS.BLUE_900[0], COLORS.BLUE_900[1], COLORS.BLUE_900[2]);
    doc.setLineWidth(0.5);
    doc.line(totalsX, y, pageWidth - margin, y);
    y += 2;

    // Tabla Totales (Manual via AutoTable 'plain')
    const totalsBody = [
        ['CRC', data.totals.crc],
        ['USD', data.totals.usd]
    ];
    autoTable(doc, {
        startY: y,
        head: [['MONEDA', 'TOTAL ACUMULADO']],
        body: totalsBody,
        theme: 'plain',
        headStyles: {
        textColor: COLORS.BLUE_900,
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'right', // Forzado a derecha
        cellPadding: 1
        },
        bodyStyles: {
        fontSize: 8,
        fontStyle: 'bold',
        textColor: COLORS.VALUE_DARK,
        cellPadding: 1,
        halign: 'right' // Forzado a derecha
        },
        columnStyles: {
        0: { cellWidth: labelColWidth, halign: 'right', textColor: COLORS.SLATE_500 }, // Etiqueta alineada a la derecha, color gris
        1: { cellWidth: valueColWidth, halign: 'right' } // Valor alineado a la derecha
        },
        margin: { left: totalsX }, // Margen dinámico calculado
        tableWidth: totalsTableWidth // Ancho dinámico calculado
    });
  }

  // 6️⃣ PIE DE PÁGINA (Footer Loop)
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150); // Gray
    doc.setFont("helvetica", "normal");
    
    // Texto Izquierdo
    doc.text("Documento generado automáticamente – TENTELCOM DEL OESTE S.A.", margin, pageHeight - 10);
    
    // Texto Derecho (Fecha + Paginación)
    doc.text(`${new Date().toLocaleString('es-CR')} | Pág. ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }
};
