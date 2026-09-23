import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '@/utils/logoBase64';
import { ToolAssignment, RecipientType } from '@/types/toolAssignment.types';
import { triggerFileDownload } from '@/utils/fileUtils';

// Extracción limpia de Notas u Observaciones por cada asignación
export const extractAssignmentNote = (a: ToolAssignment): string | null => {
  const hasTransferHistory = Array.isArray(a.history) && a.history.some((h) => h.action === 'Transferencia');

  if (hasTransferHistory) {
    const transferEntries = a.history.filter((h) => h.action === 'Transferencia');
    const latestTransfer = transferEntries[transferEntries.length - 1];

    if (latestTransfer && typeof latestTransfer.notes === 'string') {
      const cleanTransferNote = latestTransfer.notes.trim();
      if (cleanTransferNote.length > 0) {
        return `[Traspaso de Custodia] ${cleanTransferNote}`;
      }
      return null;
    }
  }

  let obs = a.observations ? a.observations.trim() : '';
  if (!obs) return null;

  // Limpieza de cadenas históricas concatenadas con pipe
  if (obs.includes(' | Traspaso a ')) {
    const parts = obs.split(' | Traspaso a ');
    const lastPart = parts[parts.length - 1];
    const colonIdx = lastPart.indexOf(': ');
    if (colonIdx !== -1) {
      obs = lastPart.substring(colonIdx + 2).trim();
    } else {
      obs = '';
    }
  } else if (obs.startsWith('Traspaso a ') && obs.includes(': ')) {
    const colonIdx = obs.indexOf(': ');
    obs = obs.substring(colonIdx + 2).trim();
  }

  if (!obs) return null;

  if (hasTransferHistory) {
    return `[Traspaso de Custodia] ${obs}`;
  }

  return obs;
};

export const exportRecipientAssignmentsPDF = async (
  recipientName: string,
  recipientType: RecipientType,
  recipientDetail: string | undefined,
  assignments: ToolAssignment[],
  delivererName?: string
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
      a.itemUnit || 'Unidad',
      (a.quantity || 1).toString(),
      deliveryDate,
      a.initialCondition || 'Bueno'
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
        'Medida',
        'Cant.',
        'Fecha Entrega',
        'Condición'
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
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'left', cellWidth: 50, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 195 },
      3: { halign: 'left', cellWidth: 75 },
      4: { halign: 'center', cellWidth: 42 },
      5: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 58 },
      7: { halign: 'center', cellWidth: 52 }
    }
  });

  // Sección de Notas y Observaciones registradas
  let currentY = (doc as any).lastAutoTable.finalY + 18;
  const rawNotes = activeAssignments
    .map((a) => extractAssignmentNote(a))
    .filter((note): note is string => Boolean(note && note.length > 0));

  // Obtener notas únicas para evitar duplicados en asignaciones por lote
  const uniqueNotes = Array.from(new Set(rawNotes));

  if (uniqueNotes.length > 0) {
    if (currentY + 50 > pageHeight - margin - 80) {
      doc.addPage();
      currentY = margin + 30;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138); // Blue 900
    doc.text('NOTAS Y OBSERVACIONES REGISTRADAS', margin, currentY);
    currentY += 12;

    uniqueNotes.forEach((noteText) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const splitNote = doc.splitTextToSize(noteText, pageWidth - margin * 2 - 12);
      const boxH = splitNote.length * 10 + 10;

      if (currentY + boxH > pageHeight - margin - 80) {
        doc.addPage();
        currentY = margin + 30;
      }

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxH, 3, 3, 'FD');

      doc.text(splitNote, margin + 6, currentY + 10);
      currentY += boxH + 6;
    });

    currentY += 10;
  }

  // Sección de Firmas al final de la tabla
  let finalY = currentY + 10;
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

  const actualDeliverer =
    delivererName ||
    activeAssignments.find((a) => a.assignedBy && a.assignedBy.trim() !== '')?.assignedBy ||
    'Responsable de Entrega';

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('FIRMA CONFORMIDAD DE RECEPCIÓN', margin + 115, signatureY + 42, { align: 'center' });
  doc.text('FIRMA RESPONSABLE DE ENTREGA', pageWidth - margin - 115, signatureY + 42, {
    align: 'center'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(recipientName || '---', margin + 115, signatureY + 54, { align: 'center' });
  doc.text(actualDeliverer, pageWidth - margin - 115, signatureY + 54, {
    align: 'center'
  });

  // Renderizar Fotos de Evidencia de Entrega si existen
  const allEvidencePhotos: string[] = [];
  activeAssignments.forEach((a) => {
    if (a.evidencePhotos && Array.isArray(a.evidencePhotos)) {
      a.evidencePhotos.forEach((p) => {
        if (p && typeof p === 'string' && !allEvidencePhotos.includes(p)) {
          allEvidencePhotos.push(p);
        }
      });
    }
  });

  if (allEvidencePhotos.length > 0) {
    let photosY = signatureY + 70;
    if (photosY + 120 > pageHeight - margin - 25) {
      doc.addPage();
      photosY = margin + 30;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('FOTOS DE EVIDENCIA DE ENTREGA', margin, photosY);
    photosY += 12;

    const imgWidth = 140;
    const imgHeight = 95;
    const gap = 15;
    let currentX = margin;

    allEvidencePhotos.forEach((photo) => {
      if (photosY + imgHeight > pageHeight - margin - 25) {
        doc.addPage();
        photosY = margin + 30;
        currentX = margin;
      }

      try {
        const format = photo.includes('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(photo, format, currentX, photosY, imgWidth, imgHeight);
        doc.setDrawColor(203, 213, 225);
        doc.rect(currentX, photosY, imgWidth, imgHeight);
      } catch (err) {
        console.error('Error rendering evidence photo in PDF:', err);
      }

      currentX += imgWidth + gap;
      if (currentX + imgWidth > pageWidth - margin) {
        currentX = margin;
        photosY += imgHeight + gap;
      }
    });
  }

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

export const exportSingleAssignmentPDF = async (
  recipientName: string,
  recipientType: RecipientType,
  recipientDetail: string | undefined,
  assignment: ToolAssignment,
  delivererName?: string
) => {
  const doc = new jsPDF('p', 'pt', 'letter');
  const margin = 40;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Detectar si es un traspaso de custodia
  const isTransfer = Array.isArray(assignment.history) && assignment.history.some((h) => h.action === 'Transferencia');

  // Header Logo
  const logoX = margin;
  const logoY = 28;
  const logoWidth = 90;
  let logoHeight = 45;

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

  // Título y Subtítulo según si es Traspaso o Asignación Individual
  const headerTextX = logoX + logoWidth + 12;
  doc.setFontSize(11.5);
  doc.setTextColor(30, 58, 138); // Blue 900
  doc.setFont('helvetica', 'bold');

  const docTitle = isTransfer
    ? 'COMPROBANTE DE TRASPASO DE CUSTODIA'
    : 'COMPROBANTE DE ASIGNACIÓN EN CUSTODIA';

  doc.text(docTitle, headerTextX, logoY + 16);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont('helvetica', 'normal');

  const docSubtitle = isTransfer
    ? 'Documento oficial de transferencia de responsabilidad y custodia de activos'
    : 'Documento oficial de asignación y control de inventario de activos';

  doc.text(docSubtitle, headerTextX, logoY + 31);

  // Recuadro de Metadatos del Destinatario
  const boxY = Math.max(logoY + logoHeight + 18, 92);
  const boxHeight = 62;
  const boxWidth = pageWidth - 2 * margin;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, boxY, boxWidth, boxHeight, 5, 5, 'FD');

  const isColaborador = recipientType === 'colaborador';
  const recipientTypeLabel = isColaborador ? 'COLABORADOR' : 'UNIDAD VEHICULAR';
  const deliveryDate = assignment.assignedDate
    ? assignment.assignedDate
    : assignment.createdAt
    ? new Date(assignment.createdAt).toLocaleDateString('es-CR')
    : '---';

  const movNumber = assignment.requestNumber || assignment.movementId || '---';

  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

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

  // Fila 2: Identificador y Fecha
  doc.setFont('helvetica', 'bold');
  doc.text(isColaborador ? 'IDENTIFICACIÓN:' : 'PLACA / DETALLE:', col1LabelX, boxY + 32);
  doc.setFont('helvetica', 'normal');
  doc.text(recipientDetail || '---', col1ValueX, boxY + 32, { maxWidth: 160 });

  doc.setFont('helvetica', 'bold');
  doc.text(isTransfer ? 'FECHA TRASPASO:' : 'FECHA ENTREGA:', col2LabelX, boxY + 32);
  doc.setFont('helvetica', 'normal');
  doc.text(deliveryDate, col2ValueX, boxY + 32, { maxWidth: 140 });

  // Fila 3: Comprobante y Tipo de Operación
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE:', col1LabelX, boxY + 48);
  doc.setFont('helvetica', 'normal');
  doc.text(movNumber, col1ValueX, boxY + 48, { maxWidth: 160 });

  doc.setFont('helvetica', 'bold');
  doc.text('TIPO OPERACIÓN:', col2LabelX, boxY + 48);
  doc.setFont('helvetica', 'normal');
  doc.text(isTransfer ? 'Traspaso de Custodia' : 'Asignación Directa', col2ValueX, boxY + 48, { maxWidth: 140 });

  // Tabla con el ítem único
  const tableBody = [
    [
      '1',
      assignment.itemCode || '---',
      assignment.itemDescription || '---',
      assignment.itemCategory || 'Herramientas',
      assignment.itemUnit || 'Unidad',
      (assignment.quantity || 1).toString(),
      deliveryDate,
      assignment.initialCondition || 'Bueno'
    ]
  ];

  autoTable(doc, {
    startY: boxY + boxHeight + 12,
    head: [
      [
        '#',
        'Código',
        'Descripción',
        'Tipo / Categoría',
        'Medida',
        'Cant.',
        'Fecha',
        'Condición'
      ]
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
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
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'left', cellWidth: 50, fontStyle: 'bold' },
      2: { halign: 'left', cellWidth: 195 },
      3: { halign: 'left', cellWidth: 75 },
      4: { halign: 'center', cellWidth: 42 },
      5: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 58 },
      7: { halign: 'center', cellWidth: 52 }
    }
  });

  // Notas u Observaciones
  let currentY = (doc as any).lastAutoTable.finalY + 18;
  const singleNote = extractAssignmentNote(assignment);

  if (singleNote && singleNote.trim() !== '') {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('OBSERVACIONES / DETALLES DE LA OPERACIÓN', margin, currentY);
    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    const splitNote = doc.splitTextToSize(singleNote, pageWidth - margin * 2 - 12);
    const boxH = splitNote.length * 11 + 12;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxH, 4, 4, 'FD');

    doc.text(splitNote, margin + 6, currentY + 11);
    currentY += boxH + 15;
  }

  // Firmas
  let finalY = currentY + 10;
  const signatureBlockHeight = 70;

  if (finalY + signatureBlockHeight > pageHeight - margin - 25) {
    doc.addPage();
    finalY = margin + 30;
  }

  const signatureY = finalY;

  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 30, signatureY + 30, margin + 200, signatureY + 30);
  doc.line(pageWidth - margin - 200, signatureY + 30, pageWidth - margin - 30, signatureY + 30);

  const actualDeliverer =
    delivererName ||
    assignment.assignedBy ||
    'Responsable de Entrega';

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('FIRMA CONFORMIDAD DE RECEPCIÓN', margin + 115, signatureY + 42, { align: 'center' });
  doc.text('FIRMA RESPONSABLE DE ENTREGA', pageWidth - margin - 115, signatureY + 42, {
    align: 'center'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(recipientName || '---', margin + 115, signatureY + 54, { align: 'center' });
  doc.text(actualDeliverer, pageWidth - margin - 115, signatureY + 54, {
    align: 'center'
  });

  // Fotos de evidencia si las hay
  if (assignment.evidencePhotos && Array.isArray(assignment.evidencePhotos) && assignment.evidencePhotos.length > 0) {
    let photosY = signatureY + 70;
    if (photosY + 120 > pageHeight - margin - 25) {
      doc.addPage();
      photosY = margin + 30;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('EVIDENCIA FOTOGRÁFICA', margin, photosY);
    photosY += 12;

    const imgWidth = 140;
    const imgHeight = 95;
    const gap = 15;
    let currentX = margin;

    assignment.evidencePhotos.forEach((photo) => {
      if (photo && typeof photo === 'string') {
        if (photosY + imgHeight > pageHeight - margin - 25) {
          doc.addPage();
          photosY = margin + 30;
          currentX = margin;
        }

        try {
          const format = photo.includes('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(photo, format, currentX, photosY, imgWidth, imgHeight);
          doc.setDrawColor(203, 213, 225);
          doc.rect(currentX, photosY, imgWidth, imgHeight);
        } catch (err) {
          console.error('Error rendering evidence photo in single PDF:', err);
        }

        currentX += imgWidth + gap;
        if (currentX + imgWidth > pageWidth - margin) {
          currentX = margin;
          photosY += imgHeight + gap;
        }
      }
    });
  }

  // Paginación
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 20, {
      align: 'right'
    });
    doc.text(
      `Sistema de Gestión de Inventario • ${isTransfer ? 'Traspaso' : 'Asignación'}: ${assignment.itemCode}`,
      margin,
      pageHeight - 20
    );
  }

  const sanitizedRecipient = (recipientName || 'DESTINATARIO')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const prefix = isTransfer ? 'TRASPASO_CUSTODIA' : 'COMPROBANTE_ASIGNACION';
  const fileName = `${prefix}_${assignment.itemCode}_${sanitizedRecipient}.pdf`;

  const blob = doc.output('blob');
  await triggerFileDownload(blob, fileName);
};

