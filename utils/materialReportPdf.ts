import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LOGO_BASE64 } from './logoBase64';
import { triggerFileDownload } from './fileUtils';

const getMaterialName = (material: any) => {
  if (!material) return '-';
  if (typeof material === 'string') return material;
  if (typeof material === 'object') return material.name || material.label || material.descripcion || material.description || '-';
  return String(material);
};

const getMaterialCode = (material: any) => {
  if (!material) return '-';
  if (typeof material === 'object') return material.code || material.codigo || '-';
  return '-';
};

const calculateHours = (start: string, end: string) => {
  if (!start || !end || start === '---' || end === '---') return 0;
  const [hStart, mStart] = start.split(':').map(Number);
  const [hEnd, mEnd] = end.split(':').map(Number);
  const startDate = new Date(0, 0, 0, hStart, mStart);
  const endDate = new Date(0, 0, 0, hEnd, mEnd);
  
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours > 0 ? diffHours : 0;
};

const renderField = (doc: any, label: string, value: string, col: number, row: number, colWidth: number = 180, valueX: number = 0) => {
    doc.setTextColor(110, 110, 110);
    doc.text(label, col, row);
    
    doc.setTextColor(0, 0, 0);
    // Usar la posición explícita valueX si se proporciona, sino calcular automáticamente con un espacio base de 5
    const posX = valueX > 0 ? valueX : col + (doc.getTextWidth(label) + 5);
    const wrappedValue = doc.splitTextToSize(value, colWidth);
    doc.text(wrappedValue, posX, row); 
    
    return wrappedValue.length * 12; 
}

const addFooter = (doc: jsPDF, pageWidth: number, pageHeight: number, margin: number) => {
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.text("TENTELCOM DEL OESTE S.A. – Documento generado automáticamente por el sistema de gestión.", pageWidth / 2, pageHeight - 20, { align: 'center' });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }
};

const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 40;

export const generateMaterialReportPDF = async (
  report: any, 
  currentUser: any,
  _inventoryItems: any[] = [],
  options: { jobId?: string, mode?: "job" | "general", trabajo?: any } = {}
) => {
  try {
    const { trabajo } = options;
    
    const doc = new jsPDF('p', 'pt', 'letter');
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

    let y = MARGIN_TOP;

    // 1. HEADER Superior
    try {
      const logoData = LOGO_BASE64;
      doc.addImage(logoData, 'PNG', MARGIN_LEFT, y - 10, 90, 0); 
    } catch (e) {
      console.warn("Logo load skipped");
    } 
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("TENTELCOM DEL OESTE S.A.", MARGIN_LEFT + 100, y + 5);
    doc.text("REPORTE DE MATERIALES POR PROYECTO", MARGIN_LEFT + 100, y + 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, MARGIN_LEFT + 100, y + 40);
    
    y = y + 70; // Ajuste vertical
    
    // 2. BLOQUE GRIS ... (y 25)
    
    const fecha = trabajo?.fecha_inicio ? new Date(trabajo.fecha_inicio).toLocaleDateString() : '---';
    
    // 🔍 CALCULAR TOTAL DE HORAS SEGÚN SEGUIMIENTO (O FALLBACK A HORAS BASE)
    const diasCompletados = (trabajo?.dias_detalle || []).filter((d: any) => d.completado);
    let totalHorasReporte = 0;
    
    if (diasCompletados.length > 0) {
      totalHorasReporte = diasCompletados.reduce((sum: number, d: any) => {
        return sum + calculateHours(d.hora_inicio || trabajo.hora_inicio || '00:00', d.hora_fin || trabajo.hora_fin || '00:00');
      }, 0);
    } else {
      totalHorasReporte = calculateHours(trabajo?.hora_inicio || '00:00', trabajo?.hora_fin || '00:00');
    }

    doc.setFont("helvetica", "bold");
    doc.text(`FECHA INICIO: ${fecha}      |      HORAS BASE: ${totalHorasReporte.toFixed(1)} h`, MARGIN_LEFT, y + 25);
    y += 40;

    // 🔍 SECCIÓN DE DÍAS COMPLETADOS (NUEVO)
    if (diasCompletados.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("DÍAS COMPLETADOS:", MARGIN_LEFT, y);
      y += 10;
      
      const diasBody = diasCompletados.map((d: any) => {
        const dDate = d.fecha instanceof Date ? d.fecha : (d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha));
        const start = d.hora_inicio || trabajo.hora_inicio || '---';
        const end = d.hora_fin || trabajo.hora_fin || '---';
        const h = calculateHours(start, end);
        const cuadrilla = d.recursos_ajustados && d.cuadrilla_diaria ? d.cuadrilla_diaria : (trabajo.cuadrilla || []);
        const unidades = d.recursos_ajustados && d.unidades_diarias ? d.unidades_diarias : (trabajo.unidades || []);
        
        return [
          format(dDate, "EEEE d 'de' MMMM", { locale: es }),
          start,
          end,
          cuadrilla.length > 0 ? cuadrilla.join(', ') : '-',
          unidades.length > 0 ? unidades.join(', ') : '-',
          `${h.toFixed(1)} h`
        ];
      });

      // Agregar fila de total
      diasBody.push([
        { content: 'TOTAL DE HORAS LABORADAS', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: `${totalHorasReporte.toFixed(1)} h`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } }
      ]);

      autoTable(doc, {
        startY: y,
        head: [['DÍA', 'DE', 'A', 'PERSONAL', 'UNIDAD', 'TOTAL HORAS']],
        body: diasBody,
        theme: 'striped',
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], halign: 'center' },
        columnStyles: { 
          0: { cellWidth: 70 }, 
          1: { cellWidth: 35, halign: 'center' }, 
          2: { cellWidth: 35, halign: 'center' },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 70 },
          5: { cellWidth: 50, halign: 'center' }
        }
      });
      
      y = (doc as any).lastAutoTable.finalY + 25;
    }

    // 3. CUADRILLA ASIGNADA ...
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); 
    doc.text("Cuadrilla Asignada:", MARGIN_LEFT, y);
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text((trabajo?.cuadrilla || []).join(", "), MARGIN_LEFT, y, { maxWidth: CONTENT_WIDTH });
    y += 25;

    // 4. UNIDADES ASIGNADAS
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("Unidades Asignadas:", MARGIN_LEFT, y);
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const unidades = (trabajo?.unidades || []).filter((u: string) => u !== 'U-01' && u !== 'U01').map((u: string) => u.startsWith('U-') ? u.replace('U-', 'U') : u);
    doc.text(unidades.join(", "), MARGIN_LEFT, y);
    y += 20;

    y += 25;

    // 5. TABLA DE MATERIALES
    const tableBody = (report.items || []).map((item: any) => [
      getMaterialCode(item.material),
      getMaterialName(item.material),
      (item.quantityRequested || item.quantity || 0).toString(),
      item.origen || 'Inventario',
      item.observation || '-'
    ]);

    autoTable(doc, {
      startY: y,
      head: [['CÓDIGO', 'MATERIAL', 'CANTIDAD', 'ORIGEN', 'OBSERVACIONES']],
      body: tableBody,
      theme: 'grid',
      tableWidth: CONTENT_WIDTH,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { 
        fillColor: [0, 58, 138], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        halign: 'center' 
      },
      columnStyles: { 
        0: { cellWidth: 40, halign: 'center' }, 
        1: { cellWidth: 'auto' }, 
        2: { cellWidth: 40, halign: 'center' }, 
        3: { cellWidth: 50 },
        4: { cellWidth: 100 } 
      }
    });

    addFooter(doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN_LEFT);
    const fileName = `ReporteMateriales_${report.id || options.jobId || 'Proyecto'}.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, fileName);

  } catch (error) {
    console.error("Error generating Material Report PDF:", error);
    throw new Error("No se pudo generar el PDF del reporte de materiales.");
  }
};

const _renderColumns = (doc: any, list: string[], startY: number, label: string, pageWidth: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 138);
    doc.text(label, MARGIN_LEFT, startY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    // Cambiar a 5 elementos por columna
    const itemsPerCol = 5;
    // Dividir en 3 columnas basadas en el ancho útil
    const totalWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
    const colWidth = totalWidth / 3;
    
    list.forEach((item, index) => {
        const col = Math.floor(index / itemsPerCol);
        const row = index % itemsPerCol;
        const x = MARGIN_LEFT + (col * colWidth);
        const yPos = startY + 12 + (row * 12);
        
        // maxWidth evita que el texto se salga de su columna
        doc.text(`- ${item}`, x, yPos, { maxWidth: colWidth - 5 });
    });
    
    // Calcular altura real basada en el número de filas en la columna más larga
    const _numCols = Math.ceil(list.length / itemsPerCol);
    const maxRows = Math.min(list.length, itemsPerCol);
    return (maxRows * 12) + 20; 
};

export const generateConsolidatedMaterialReportPDF = async (grupo: any[], currentUser: any) => {
  try {
    const doc = new jsPDF('p', 'pt', 'letter');
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    let y = MARGIN_TOP;

    try {
      const logoData = LOGO_BASE64;
      doc.addImage(logoData, 'PNG', MARGIN_LEFT, y - 10, 80, 0);
    } catch (e) {
      console.warn("Logo load skipped");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 138);
    doc.text("TENTELCOM DEL OESTE S.A.", MARGIN_LEFT + 95, y + 5);
    doc.text("REPORTE DE MATERIALES POR PROYECTO", MARGIN_LEFT + 95, y + 20);
    doc.setFontSize(9);
    doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, MARGIN_LEFT + 95, y + 35);
    
    y = 100;
    
    // Restaurar bloque superior de dos columnas
    const trabajoRaiz = grupo[0].trabajo;
    
    doc.setFillColor(243, 246, 250); 
    doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, 70, 5, 5, 'F');
    doc.setTextColor(50);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    
    const colWidth = 140; 
    const labelX = MARGIN_LEFT + 10;
    const valueXIzquierda = MARGIN_LEFT + 90;
    const col2 = MARGIN_LEFT + 240; 
    const valueXDerecha = MARGIN_LEFT + 340; 
    
    let yIzquierda = y + 25;
    let yDerecha = y + 25;
    
    renderField(doc, "TIPO TRABAJO: ", `${trabajoRaiz.tipo_trabajo || '---'}`, labelX, yIzquierda, colWidth, valueXIzquierda);
    yIzquierda += 14;
    renderField(doc, "OT / TRABAJO: ", `${trabajoRaiz.otCode || '---'}`, labelX, yIzquierda, colWidth, valueXIzquierda);
    yIzquierda += 14;
    renderField(doc, "RESPONSABLE: ", `${currentUser?.email || 'N/A'}`, labelX, yIzquierda, colWidth, valueXIzquierda);
    
    renderField(doc, "UBICACIÓN: ", `${trabajoRaiz.ubicacion || '---'}`, col2, yDerecha, colWidth, valueXDerecha);
    yDerecha += 14;
    renderField(doc, "FECHA REPORTE: ", `${new Date().toLocaleDateString()}`, col2, yDerecha, colWidth, valueXDerecha);
    yDerecha += 14;
    renderField(doc, "TIPO: ", `Reporte de Materiales`, col2, yDerecha, colWidth, valueXDerecha);
    
    y = y + 70;
    
    const totalMateriales: Record<string, { name: string, code: string, qty: number }> = {};
    
    for (const entry of grupo) {
      const { trabajo, report } = entry;
      const fecha = new Date(trabajo.fecha_inicio).toLocaleDateString();
      
      // Espacio adicional para separar bloques de trabajo
      y += 30;
      
      // 🔍 CALCULAR TOTAL DE HORAS SEGÚN SEGUIMIENTO (O FALLBACK A HORAS BASE)
      const diasCompletados = (trabajo.dias_detalle || []).filter((d: any) => d.completado);
      let totalHorasTrabajo = 0;
      
      if (diasCompletados.length > 0) {
        totalHorasTrabajo = diasCompletados.reduce((sum: number, d: any) => {
          return sum + calculateHours(d.hora_inicio || trabajo.hora_inicio || '00:00', d.hora_fin || trabajo.hora_fin || '00:00');
        }, 0);
      } else {
        totalHorasTrabajo = calculateHours(trabajo?.hora_inicio || '00:00', trabajo?.hora_fin || '00:00');
      }

      // Fecha e Horas
      if (y + 30 > PAGE_HEIGHT - MARGIN_BOTTOM) { doc.addPage(); y = MARGIN_TOP; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 138);
      doc.text(`FECHA INICIO: ${fecha}`, MARGIN_LEFT, y);
      
      doc.text(`HORAS TOTALES: ${totalHorasTrabajo.toFixed(1)} h`, MARGIN_LEFT + 200, y);
      
      y += 15;

      // 🔍 SECCIÓN DE DÍAS COMPLETADOS (NUEVO)
      if (diasCompletados.length > 0) {
        doc.setFontSize(9);
        doc.text("DÍAS COMPLETADOS:", MARGIN_LEFT, y);
        y += 10;
        
        const diasBody = diasCompletados.map((d: any) => {
          const dDate = d.fecha instanceof Date ? d.fecha : (d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha));
          const start = d.hora_inicio || trabajo.hora_inicio || '---';
          const end = d.hora_fin || trabajo.hora_fin || '---';
          const h = calculateHours(start, end);
          return [
            format(dDate, "EEEE d 'de' MMMM", { locale: es }),
            start,
            end,
            `${h.toFixed(1)} h`
          ];
        });

        // Agregar fila de total
        diasBody.push([
          { content: 'TOTAL DE HORAS LABORADAS', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: `${totalHorasTrabajo.toFixed(1)} h`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } }
        ]);

        autoTable(doc, {
          startY: y,
          head: [['DÍA', 'DE', 'A', 'TOTAL HORAS']],
          body: diasBody,
          theme: 'striped',
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255] },
          columnStyles: { 
            0: { cellWidth: 'auto' }, 
            1: { cellWidth: 50, halign: 'center' }, 
            2: { cellWidth: 50, halign: 'center' },
            3: { cellWidth: 60, halign: 'center' }
          }
        });
        
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // CUADRILLA y UNIDADES en formato tabla
      const unidades = (trabajo.unidades || []).filter((u: string) => u !== 'U-01' && u !== 'U01').map((u: string) => u.startsWith('U-') ? u.replace('U-', 'U') : u);
      const dataInfo = [
        ["Cuadrilla:", trabajo.cuadrilla.join(", ")],
        ["Unidades:", unidades.join(", ")]
      ];
      
      autoTable(doc, {
        startY: y,
        body: dataInfo,
        theme: 'plain',
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 9, cellPadding: 2, textColor: [0,0,0] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80, textColor: [30, 58, 138] }, 1: { cellWidth: 'auto' } }
      });
      
      y = (doc as any).lastAutoTable.finalY + 10;
      
      const tableBody = (report.items || []).map((item: any) => {
        const code = item.material?.code || '-';
        const name = getMaterialName(item.material);
        if (!totalMateriales[code]) totalMateriales[code] = { name, code, qty: 0 };
        const qty = item.quantityRequested || item.quantity || 0;
        totalMateriales[code].qty += qty;
        return [code, name, qty.toString(), item.observation || '-'];
      });
      
      // Tabla
      if (y + 40 > PAGE_HEIGHT - MARGIN_BOTTOM) { doc.addPage(); y = MARGIN_TOP; }
      
      autoTable(doc, {
        startY: y,
        head: [['CÓDIGO', 'MATERIAL', 'CANTIDAD', 'OBSERVACIONES']],
        body: tableBody,
        theme: 'grid',
        tableWidth: CONTENT_WIDTH,
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { 
          fillColor: [30, 58, 138], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          halign: 'center' 
        },
        columnStyles: { 
          0: { cellWidth: 40, halign: 'center' }, 
          1: { cellWidth: 322 }, 
          2: { cellWidth: 50, halign: 'center' }, 
          3: { cellWidth: 120 } 
        }
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }

    const hResumen = 100; // Altura estimada para el resumen
    if (y + hResumen > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        y = MARGIN_TOP;
    } else {
        y += 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text("RESUMEN TOTAL CONSOLIDADO", MARGIN_LEFT, y);
    autoTable(doc, {
      startY: y + 15,
      head: [['CÓDIGO', 'MATERIAL', 'CANTIDAD']],
      body: Object.values(totalMateriales).map(m => [m.code, m.name, m.qty.toString()]),
      headStyles: { 
        fillColor: [30, 58, 138],
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 70 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 70 }
      },
      tableWidth: CONTENT_WIDTH,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { cellPadding: 3, fontSize: 9 }
    });
    
    addFooter(doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN_LEFT);
    const fileName = `CONSOLIDACION_REPORTE_MATERIALES.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, fileName);
  } catch (error) {
    console.error("Error generating Material Report PDF:", error);
    throw new Error("No se pudo generar el PDF del reporte consolidado.");
  }
};
