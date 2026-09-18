import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '@/utils/logoBase64';
import { ToolAssignment, RecipientType } from '@/types/toolAssignment.types';
import { triggerFileDownload } from '@/utils/fileUtils';

export const exportRecipientAssignmentsPDF = async (
  recipientName: string,
  recipientType: RecipientType,
  recipientDetail: string | undefined,
  assignments: ToolAssignment[]
) => {
  // Filtrar únicamente asignaciones activas / en custodia (excluir devueltas)
  const activeAssignments = assignments.filter((a) => a.status !== 'Devuelto');

  const doc = new jsPDF('p', 'pt', 'letter');
  const margin = 40;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header Logo (Alineado a la izquierda, relación de aspecto original preservada)
  const logoX = margin;
  const logoY = 28;
  const logoWidth = 90;
  let logoHeight = 45; // fallback de seguridad

  try {
    const logoData = LOGO_BASE64;
    const imgProps = doc.getImageProperties(logoData);
    if (imgProps && imgProps.width && imgProps.height) {
      logoHeight = (imgProps.height * logoWidth) / imgProps.width;
    }
    doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (e) {
    console.error('Error al agregar logo al PDF:', e);
  }

  // Título y Subtítulo (Alineados a la derecha del logo sin sobreponerse)
  const headerTextX = logoX + logoWidth + 12;
  doc.setFontSize(12.5);
  doc.setTextColor(30, 58, 138); // Blue 900
  doc.setFont('helvetica', 'bold');
  doc.text('LISTADO COMPLETO DE ASIGNACIONES EN CUSTODIA', headerTextX, logoY + 16);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Control de custodia integral, entrega y trazabilidad de herramientas y equipos',
    headerTextX,
    logoY + 31
  );

  // Recuadro de Metadatos del Destinatario (Desplazado hacia abajo respetando la altura del logo)
  const boxY = Math.max(logoY + logoHeight + 18, 92);
  const boxHeight = 62;
  const boxWidth = pageWidth - 2 * margin; // 532 pt
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(margin, boxY, boxWidth, boxHeight, 5, 5, 'FD');

  const isColaborador = recipientType === 'colaborador';
  const recipientTypeLabel = isColaborador ? 'COLABORADOR' : 'UNIDAD VEHICULAR';
  const generationDate = new Date().toLocaleDateString('es-CR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const totalQuantity = activeAssignments.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59); // Slate 800

  // Coordenadas de columnas dentro del recuadro
  const col1LabelX = margin + 12;
  const col1ValueX = margin + 105;
  const col2LabelX = margin + 275;
  const col2ValueX = margin + 375;

  // Fila 1: Destinatario y Tipo
  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATARIO:', col1LabelX, boxY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(recipientName || '---', col1ValueX, boxY + 16, { maxWidth: 160 });

  doc.setFont('helvetica', 'bold');
  doc.text('TIPO DESTINATARIO:', col2LabelX, boxY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(recipientTypeLabel, col2ValueX, boxY + 16, { maxWidth: 140 });

  // Fila 2: Identificador / Placa y Fecha Generación
  doc.setFont('helvetica', 'bold');
  doc.text(isColaborador ? 'IDENTIFICACIÓN:' : 'PLACA / DETALLE:', col1LabelX, boxY + 32);
  doc.setFont('helvetica', 'normal');
  doc.text(recipientDetail || '---', col1ValueX, boxY + 32, { maxWidth: 160 });

  doc.setFont('helvetica', 'bold');
  doc.text('FECHA GENERACIÓN:', col2LabelX, boxY + 32);
  doc.setFont('helvetica', 'normal');
  doc.text(generationDate, col2ValueX, boxY + 32, { maxWidth: 140 });

  // Fila 3: Total Ítems y Estado Custodia
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DE ÍTEMS:', col1LabelX, boxY + 48);
  doc.setFont('helvetica', 'normal');
  doc.text(`${activeAssignments.length} líneas (${totalQuantity} unid.)`, col1ValueX, boxY + 48, {
    maxWidth: 160
  });

  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO CUSTODIA:', col2LabelX, boxY + 48);
  doc.setFont('helvetica', 'normal');
  doc.text('Activo / En uso', col2ValueX, boxY + 48, { maxWidth: 140 });

  // Datos para la tabla sin columna "Lote / Mov."
  const tableBody = activeAssignments.map((a, idx) => {
    const deliveryDate = a.assignedDate
      ? a.assignedDate
      : a.createdAt
      ? new Date(a.createdAt).toLocaleDateString('es-CR')
      : '---';

    return [
      (idx + 1).toString(),
      a.itemCode || '---',
      a.itemDescription || '---',
      a.itemCategory || 'Herramientas',
      (a.quantity || 1).toString(),
      deliveryDate,
      a.initialCondition || 'Bueno',
      a.status || 'Asignado'
    ];
  });

  autoTable(doc, {
    startY: boxY + boxHeight + 12,
    head: [
      [
        '#',
        'Código',
        'Descripción',
        'Tipo / Categoría',
        'Cant.',
        'Fecha Entrega',
        'Condición',
        'Estado'
      ]
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240]
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      halign: 'center',
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'left', cellWidth: 55, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 170 },
      3: { halign: 'left', cellWidth: 95 },
      4: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 62 },
      6: { halign: 'center', cellWidth: 54 },
      7: { halign: 'center', cellWidth: 48 }
    }
  });

  // Sección de Firmas al final de la tabla
  let finalY = (doc as any).lastAutoTable.finalY + 25;
  const signatureBlockHeight = 70;

  // Si las firmas no caben en la página actual, agregamos una nueva
  if (finalY + signatureBlockHeight > pageHeight - margin - 25) {
    doc.addPage();
    finalY = margin + 30;
  }

  const signatureY = finalY;

  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 30, signatureY + 30, margin + 200, signatureY + 30);
  doc.line(pageWidth - margin - 200, signatureY + 30, pageWidth - margin - 30, signatureY + 30);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('FIRMA CONFORMIDAD DE RECEPCIÓN', margin + 115, signatureY + 42, { align: 'center' });
  doc.text('FIRMA RESPONSABLE DE INVENTARIO', pageWidth - margin - 115, signatureY + 42, {
    align: 'center'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(recipientName || '---', margin + 115, signatureY + 54, { align: 'center' });
  doc.text('Control e Inventarios', pageWidth - margin - 115, signatureY + 54, {
    align: 'center'
  });

  // Paginación precisa en todas las páginas generadas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 20, {
      align: 'right'
    });
    doc.text(
      `Sistema de Gestión de Inventario • Reporte de Custodia: ${recipientName}`,
      margin,
      pageHeight - 20
    );
  }

  // Nombre de archivo sanitizado
  const sanitizedName = (recipientName || 'DESTINATARIO')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const fileName = `ASIGNACIONES_${sanitizedName}.pdf`;

  const blob = doc.output('blob');
  await triggerFileDownload(blob, fileName);
};

