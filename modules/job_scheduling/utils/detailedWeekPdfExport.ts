import { jsPDF } from 'jspdf';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trabajo } from '../types';
import { LOGO_BASE64 } from '@/utils/logoBase64';
import { triggerFileDownload } from '@/utils/fileUtils';

interface DetailedWeekPdfExportOptions {
  trabajos: Trabajo[];
  currentDate: Date;
  fileName?: string;
}

const STATUS_PDF_COLORS: Record<string, { r: number; g: number; b: number }> = {
  'programado': { r: 37, g: 99, b: 235 },   // #2563EB Blue
  'en_proceso': { r: 5, g: 150, b: 105 },  // #059669 Emerald
  'finalizado': { r: 148, g: 163, b: 184 }, // #94A3B8 Slate
  'en_espera': { r: 217, g: 119, b: 6 },   // #D97706 Amber
  'cancelado': { r: 220, g: 38, b: 38 },   // #DC2626 Red
  'reprogramado': { r: 234, g: 88, b: 12 }, // #EA580C Orange
};

const formatUnitName = (unitValue: string): string => {
  if (!unitValue) return 'S/U';
  const codeToName: Record<string, string> = {
    'U1': 'PATHFINDER',
    'U2': 'KIA BONGO',
    'U3': 'MERCEDES',
    'U4': 'KIA MORNING',
    'U5': 'NISSAN UD',
    'U6': 'HYUNDAI HD',
    'U7': 'VOLKSWAGEN',
    'U8': 'SUZUKI'
  };
  if (codeToName[unitValue]) return codeToName[unitValue];
  const parts = unitValue.split(' - ');
  if (parts.length >= 2) {
    const name = parts[1].trim();
    const nameMaps: Record<string, string> = {
      'NISSAN PATHFINDER': 'PATHFINDER',
      'MERCEDES BENZ': 'MERCEDES',
      'VOLKSWAGEN CROSS': 'VOLKSWAGEN',
      'SUZUKI GRAN VITARA': 'SUZUKI',
      'NISSAN UD 1400': 'NISSAN UD'
    };
    return nameMaps[name] || name;
  }
  return unitValue;
};

export const exportDetailedWeekToPDF = ({
  trabajos,
  currentDate,
  fileName
}: DetailedWeekPdfExportOptions) => {
  try {
    const doc = new jsPDF('landscape', 'pt', 'letter');
    const pageWidth = doc.internal.pageSize.width;   // 792 pt
    const pageHeight = doc.internal.pageSize.height; // 612 pt
    const margin = 28;
    const footerHeight = 22;
    const maxContentY = pageHeight - margin - footerHeight;

    // Dimensiones y posición del logo (superior derecha)
    const logoW = 80;
    const logoH = 52;
    const logoX = pageWidth - margin - logoW;
    const logoY = margin - 4; // Y = 24 pt (el logo ocupa de Y=24 a Y=76 pt)

    // Coordenadas verticales desacopladas para evitar superposiciones
    const headerLineY = 82; // Línea separadora por debajo del logo (a 6 pt de su base)
    const columnHeaderY = 94; // Encabezados de los días (12 pt por debajo de la línea)
    const dayHeaderH = 22;
    const cardsStartY = columnHeaderY + dayHeaderH + 6; // Y = 122 pt

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

    const getNominalDay = (date: any): string => {
      if (!date) return '';
      const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Agrupar trabajos por día
    const allDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayJobs = trabajos.filter(t => {
        if (!t.fecha_inicio) return false;
        if (t.dias_detalle && t.dias_detalle.length > 0) {
          return t.dias_detalle.some(d => getNominalDay(d.fecha) === dayKey);
        }
        const startKey = getNominalDay(t.fecha_inicio);
        const endKey = getNominalDay(t.fecha_fin || t.fecha_inicio);
        return dayKey >= startKey && dayKey <= endKey;
      }).map(t => {
        let dailyState = t.estado;
        let dailyCuadrilla = t.cuadrilla;
        let dailyUnidades = t.unidades;
        let dailyHoraInicio = t.hora_inicio;
        let dailyHoraFin = t.hora_fin;

        if (t.dias_detalle) {
          const dia = t.dias_detalle.find(d => getNominalDay(d.fecha) === dayKey);
          if (dia) {
            if (dia.estado) dailyState = dia.estado;
            if (dia.hora_inicio) dailyHoraInicio = dia.hora_inicio;
            if (dia.hora_fin) dailyHoraFin = dia.hora_fin;
            if (dia.cuadrilla_diaria && dia.cuadrilla_diaria.length > 0) {
              dailyCuadrilla = dia.cuadrilla_diaria;
            }
            if (dia.unidades_diarias && dia.unidades_diarias.length > 0) {
              dailyUnidades = dia.unidades_diarias;
            }
          }
        }

        return {
          ...t,
          estado: dailyState,
          cuadrilla: dailyCuadrilla,
          unidades: dailyUnidades,
          hora_inicio: dailyHoraInicio,
          hora_fin: dailyHoraFin
        };
      }).sort((a, b) => (a.hora_inicio || '00:00').localeCompare(b.hora_inicio || '00:00'));

      return { day, jobs: dayJobs };
    });

    // REGLA OBLIGATORIA: Ocultar fin de semana si no tiene trabajos
    // Lunes a Viernes se muestran SIEMPRE.
    const visibleDays = allDays.filter(({ day, jobs }) => {
      const dayOfWeek = getDay(day); // 0 = Domingo, 6 = Sábado
      if (dayOfWeek === 6 || dayOfWeek === 0) {
        return jobs.length > 0;
      }
      return true;
    });

    const numCols = visibleDays.length;
    const colGap = 6;
    const usableWidth = pageWidth - (margin * 2);
    const colWidth = (usableWidth - (numCols - 1) * colGap) / numCols;

    const intervalStart = format(weekStart, 'dd MMM', { locale: es }).toUpperCase();
    const intervalEnd = format(weekEnd, 'dd MMM yyyy', { locale: es }).toUpperCase();
    const intervalStr = `${intervalStart} — ${intervalEnd}`;

    // Helper para dibujar el encabezado superior de la página
    const drawPageHeader = (pageNum: number) => {
      // 1. Logo a la derecha absoluta
      try {
        doc.addImage(LOGO_BASE64, 'PNG', logoX, logoY, logoW, logoH);
      } catch (e) {
        // Ignorar si no carga logo
      }

      // 2. Título a la izquierda absoluta (con ancho máximo seguro para no aproximarse al logo)
      const maxTitleW = logoX - margin - 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 58, 138); // Blue 900
      doc.text('TENTELCOM — PROGRAMACIÓN DE TRABAJOS', margin, margin + 14, { maxWidth: maxTitleW });

      // 3. Subtítulo con rango de semana
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text(
        `SEMANA DETALLADA: ${intervalStr} ${pageNum > 1 ? `(Continuación - Pág. ${pageNum})` : ''}`,
        margin,
        margin + 28,
        { maxWidth: maxTitleW }
      );

      // 4. Línea separadora por debajo del logotipo
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.75);
      doc.line(margin, headerLineY, pageWidth - margin, headerLineY);
    };

    // Helper para dibujar los encabezados de columna de los días
    const drawColumnHeaders = (startY: number) => {
      visibleDays.forEach(({ day, jobs }, i) => {
        const x = margin + i * (colWidth + colGap);
        const dayName = format(day, 'EEEE', { locale: es }).toUpperCase();
        const dayNumber = format(day, 'd');
        const countLabel = `[${jobs.length} ${jobs.length === 1 ? 'TRABAJO' : 'TRABAJOS'}]`;

        // Fondo del encabezado
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.5);
        doc.roundedRect(x, startY, colWidth, dayHeaderH, 3, 3, 'FD');

        // Nombre del día + número y conteo en formato limpio
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(23, 37, 84); // blue-950

        const fullHeaderText = `${dayName} ${dayNumber}  ${countLabel}`;
        if (doc.getTextWidth(fullHeaderText) <= colWidth - 8) {
          doc.text(fullHeaderText, x + colWidth / 2, startY + 14, { align: 'center' });
        } else {
          doc.text(`${dayName} ${dayNumber}`, x + colWidth / 2, startY + 9, { align: 'center' });
          doc.setFontSize(6);
          doc.setTextColor(29, 78, 216); // blue-700
          doc.text(countLabel, x + colWidth / 2, startY + 17, { align: 'center' });
        }
      });
    };

    // Cálculo de altura de una tarjeta de trabajo en puntos
    const getJobCardHeight = (job: Trabajo): number => {
      const textPadding = 12;
      const titleLines = doc.splitTextToSize(job.titulo || job.tipo_trabajo || 'TRABAJO', colWidth - textPadding);
      const titleHeight = titleLines.length * 8.5;
      const horarioHeight = 11;
      const personalCount = job.cuadrilla ? job.cuadrilla.length : 0;
      // Personal se muestra compacto (en 2 columnas si caben o hasta 2 líneas por fila)
      const personalRows = Math.ceil(Math.max(1, personalCount) / 2);
      const personalHeight = 10 + personalRows * 8.5;
      const unidadesHeight = 14;
      const extraPad = 8;

      return titleHeight + horarioHeight + personalHeight + unidadesHeight + extraPad;
    };

    // Dibujar una tarjeta individual de trabajo
    const drawJobCard = (job: Trabajo, x: number, y: number, cardH: number) => {
      // 1. Contenedor de la tarjeta (fondo blanco con borde sutil)
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, colWidth, cardH, 4, 4, 'FD');

      // 2. Barra de acento lateral izquierda según estado
      const color = STATUS_PDF_COLORS[job.estado] || STATUS_PDF_COLORS['programado'];
      doc.setFillColor(color.r, color.g, color.b);
      doc.roundedRect(x, y, 3, cardH, 1, 1, 'F');

      let curY = y + 8;

      // 3. Título del trabajo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42); // slate-900
      const titleLines = doc.splitTextToSize(job.titulo || job.tipo_trabajo || 'TRABAJO', colWidth - 12);
      doc.text(titleLines, x + 6, curY);
      curY += titleLines.length * 8.5;

      // 4. Horario (texto limpio, sin emoji de reloj)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85); // slate-700
      const timeStr = job.hora_inicio && job.hora_fin ? `${job.hora_inicio} - ${job.hora_fin}` : 'Sin horario';
      doc.text(`Horario: ${timeStr}`, x + 6, curY);
      curY += 10;

      // 5. Personal asignado (Header + 2 Columnas con guión estándar '-')
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('PERSONAL:', x + 6, curY);
      curY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 59);

      if (job.cuadrilla && job.cuadrilla.length > 0) {
        const halfCol = (colWidth - 12) / 2;
        job.cuadrilla.forEach((member, idx) => {
          const colIdx = idx % 2;
          const rowIdx = Math.floor(idx / 2);
          const posX = x + 6 + colIdx * halfCol;
          const posY = curY + rowIdx * 8.5;
          const memberShort = doc.splitTextToSize(`- ${member}`, halfCol - 2)[0];
          doc.text(memberShort, posX, posY);
        });
        const rows = Math.ceil(job.cuadrilla.length / 2);
        curY += rows * 8.5 + 2;
      } else {
        doc.text('- Sin personal', x + 6, curY);
        curY += 10;
      }

      // 6. Unidades Vehiculares (Únicamente nombre de la unidad, sin emojis ni iconos que provoquen caracteres corruptos)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);

      if (job.unidades && job.unidades.length > 0) {
        doc.setTextColor(30, 58, 138); // blue-900
        const unitsList = job.unidades.map(formatUnitName).filter(Boolean).join(', ');
        doc.text(doc.splitTextToSize(unitsList, colWidth - 10)[0], x + 6, curY + 2);
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('Sin unidad asignada', x + 6, curY + 2);
      }
    };

    // Estructurar trabajos por columna y paginación sin cortar tarjetas
    // Creamos una cola de tarjetas pendientes por día
    const pendingJobsPerDay: Array<{ dayIndex: number; jobs: Trabajo[] }> = visibleDays.map((d, idx) => ({
      dayIndex: idx,
      jobs: [...d.jobs]
    }));

    let currentPage = 1;
    let hasPending = true;

    while (hasPending) {
      if (currentPage > 1) {
        doc.addPage('letter', 'landscape');
      }

      // Dibujar header general
      drawPageHeader(currentPage);

      // Dibujar encabezados de columna
      drawColumnHeaders(columnHeaderY);

      let anyJobDrawnInThisPage = false;

      // Para cada día, dibujar tarjetas hasta alcanzar maxContentY
      pendingJobsPerDay.forEach(({ dayIndex, jobs }) => {
        const colX = margin + dayIndex * (colWidth + colGap);
        let curY = cardsStartY;

        // Si es la página 1 y el día no tiene trabajos
        if (currentPage === 1 && jobs.length === 0) {
          doc.setDrawColor(226, 232, 240);
          doc.setLineDashPattern([2, 2], 0);
          doc.roundedRect(colX, curY, colWidth, 90, 4, 4, 'D');
          doc.setLineDashPattern([], 0); // Reset

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Sin trabajos', colX + colWidth / 2, curY + 42, { align: 'center' });
          doc.setFontSize(6.5);
          doc.text('programados', colX + colWidth / 2, curY + 52, { align: 'center' });
          return;
        }

        while (jobs.length > 0) {
          const nextJob = jobs[0];
          const cardH = getJobCardHeight(nextJob);

          if (curY + cardH > maxContentY) {
            // No cabe en esta página; se deja para la siguiente página
            break;
          }

          // Se extrae y se dibuja
          jobs.shift();
          drawJobCard(nextJob, colX, curY, cardH);
          curY += cardH + 5;
          anyJobDrawnInThisPage = true;
        }
      });

      // Verificar si todavía quedan trabajos pendientes en alguna columna
      hasPending = pendingJobsPerDay.some(p => p.jobs.length > 0);

      // Salvaguarda para evitar bucle infinito si una tarjeta individual fuera más grande que una página entera
      if (hasPending && !anyJobDrawnInThisPage) {
        // Forzar dibujo de la primera tarjeta en la siguiente página
        const firstPending = pendingJobsPerDay.find(p => p.jobs.length > 0);
        if (firstPending && firstPending.jobs.length > 0) {
          firstPending.jobs.shift();
        }
      }

      currentPage++;
    }

    // Pie de página con numeración total
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')} — TENTELCOM DEL OESTE S.A. | Vista Semana Detallada | Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 14,
        { align: 'center' }
      );
    }

    const outputName = fileName || `Semana_Detallada_${format(currentDate, 'yyyy-MM-dd')}`;
    const safeFileName = `${outputName.replace(/[\s-]+/g, '_')}.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, safeFileName);
  } catch (error) {
    console.error('Error generating Semana Detallada PDF:', error);
  }
};
