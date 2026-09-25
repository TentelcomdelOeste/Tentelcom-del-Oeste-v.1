import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LOGO_BASE64 } from '../logoBase64';
import { VehicleLog } from '../../types/vehicle.types';
import { format } from 'date-fns';
import { triggerFileDownload } from '../fileUtils';

const MARGIN = 40;

export const generateVehicleLogPDF = async (log: VehicleLog) => {
    const doc = new jsPDF('p', 'pt', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (MARGIN * 2);
    let y = MARGIN;

    // --- HEADER ---
    const logoWidth = 90;
    const logoHeight = 0; // Auto height to preserve aspect ratio
    const logoX = MARGIN;
    const logoY = MARGIN - 10;

    try {
        const logoData = LOGO_BASE64;
        doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch (error) {
        console.error("Error rendering logo:", error);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20); 
    doc.setTextColor(30, 58, 138); // Dark Blue matching Quotations PDF
    doc.text("TENTELCOM DEL OESTE S. A.", pageWidth / 2, MARGIN + 15, { align: 'center' });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5); // Matching common small text size
    doc.setTextColor(50, 50, 50);
    doc.text("Dirección: Alajuela, Rio Segundo, ofibodegas Terrum", pageWidth / 2, MARGIN + 29, { align: 'center' });
    doc.text("Teléfono: 2249-5551 - Celular 8302-5407", pageWidth / 2, MARGIN + 41, { align: 'center' });
    doc.text("Cédula Jurídica: 3-101-438992 Email: info@tentelcom.com", pageWidth / 2, MARGIN + 53, { align: 'center' });
    
    y = MARGIN + 75;

    // HELPERS FOR TABLES
    const drawRow = (x: number, yPos: number, width: number, height: number, bgColor?: [number, number, number]) => {
        if (bgColor) {
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.rect(x, yPos, width, height, 'F');
        }
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.8);
        doc.rect(x, yPos, width, height);
    };

    const drawTextInCell = (text: string, label: string, x: number, yPos: number, fontSize: number = 10, isBoldLabel: boolean = false) => {
        doc.setFont("helvetica", isBoldLabel ? "bold" : "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(0, 0, 0);
        doc.text(label, x + 5, yPos + 17);
        doc.setFont("helvetica", "normal");
        doc.text(text || '---', x + doc.getTextWidth(label) + 12, yPos + 17);
    };

    const formatTimeWithAMPM = (timeStr?: string) => {
        if (!timeStr) return '---';
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return timeStr;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    // --- PRIMERA FILA: CONDUCTOR Y FECHA ---
    drawRow(MARGIN, y, contentWidth * 0.7, 25);
    drawTextInCell(log.conductorName || '', "Conductor:", MARGIN, y, 10, true);
    
    drawRow(MARGIN + (contentWidth * 0.7), y, contentWidth * 0.3, 25);
    const dateStr = log.fecha ? format(new Date(log.fecha + 'T00:00:00'), "dd/MM/yyyy") : '';
    drawTextInCell(dateStr, "Fecha:", MARGIN + (contentWidth * 0.7), y, 10, true);
    
    y += 25;

    // --- SECCIÓN: ANTES DE SALIR ---
    drawRow(MARGIN, y, contentWidth, 20, [219, 234, 254]); // Soft blue
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text("Antes de Salir", pageWidth / 2, y + 14, { align: 'center' });
    y += 20;

    // Fila 2: Placa, KM Salida, Hora Salida
    const col3Width = contentWidth / 3;
    drawRow(MARGIN, y, col3Width, 25);
    
    const unidad = log.unidad || (log.unidadId ? String(log.unidadId).split(' - ')[0]?.trim() || '' : '');
    const placa = log.placa || (log.unidadId ? String(log.unidadId).split(' - ').slice(-1)[0]?.trim() || '' : '');
    const displayVehicleName = (unidad && placa) ? `${unidad} - ${placa}` : (unidad || log.unidadName || '');
    
    drawTextInCell(displayVehicleName, "Vehículo:", MARGIN, y, 8.5);
    
    drawRow(MARGIN + col3Width, y, col3Width, 25);
    drawTextInCell(String(log.kmSalida || ''), "Kilometraje de salida:", MARGIN + col3Width, y, 8.5);
    
    drawRow(MARGIN + (col3Width * 2), y, col3Width, 25);
    drawTextInCell(formatTimeWithAMPM(log.horaSalida), "Hora de salida:", MARGIN + (col3Width * 2), y, 8.5);
    y += 25;

    // Fila 3: Combustible, Destino
    drawRow(MARGIN, y, col3Width, 25);
    drawTextInCell(log.combustible || '', "Combustible:", MARGIN, y, 8.5);
    
    drawRow(MARGIN + col3Width, y, col3Width * 2, 25);
    drawTextInCell(log.destino || '', "Lugar de destino:", MARGIN + col3Width, y, 8.5);
    y += 35;

    // --- SECCIÓN: AL REGRESAR ---
    drawRow(MARGIN, y, contentWidth, 20, [219, 234, 254]);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("Al regresar", pageWidth / 2, y + 14, { align: 'center' });
    y += 20;

    // Fila 4: Fecha Regreso, KM Llegada, Hora Salida (literal like template)
    drawRow(MARGIN, y, col3Width, 25);
    const dateRegressoStr = log.fechaRegreso ? format(new Date(log.fechaRegreso + 'T00:00:00'), "dd/MM/yyyy") : (log.fecha ? format(new Date(log.fecha + 'T00:00:00'), "dd/MM/yyyy") : '');
    drawTextInCell(dateRegressoStr, "Fecha:", MARGIN, y, 8.5);
    
    drawRow(MARGIN + col3Width, y, col3Width, 25);
    drawTextInCell(String(log.kmLlegada || ''), "Kilometraje de llegada:", MARGIN + col3Width, y, 8.5);
    
    drawRow(MARGIN + (col3Width * 2), y, col3Width, 25);
    drawTextInCell(formatTimeWithAMPM(log.horaLlegada), "Hora de llegada:", MARGIN + (col3Width * 2), y, 8.5);
    y += 25;

    // Fila 5: Total KM, Combustible, Eventos
    drawRow(MARGIN, y, col3Width, 25);
    const totalKm = (log.kmLlegada || 0) - (log.kmSalida || 0);
    drawTextInCell(String(totalKm > 0 ? totalKm : 0), "Total de KM recorridos:", MARGIN, y, 8.5);
    
    drawRow(MARGIN + col3Width, y, col3Width, 25);
    drawTextInCell(log.combustibleFinal || '', "Combustible:", MARGIN + col3Width, y, 8.5);
    
    drawRow(MARGIN + (col3Width * 2), y, col3Width, 25);
    drawTextInCell(log.eventosCarretera || '', "Eventos en carretera:", MARGIN + (col3Width * 2), y, 8.5);
    y += 40;

    // --- OBSERVACIONES ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Observaciones:", MARGIN, y);
    doc.setLineWidth(0.5);
    // Draw lines for observations
    doc.line(MARGIN + 75, y + 2, pageWidth - MARGIN, y + 2);
    doc.line(MARGIN, y + 18, pageWidth - MARGIN, y + 18);
    
    if (log.observaciones) {
        doc.setFontSize(8.5);
        doc.text(log.observaciones, MARGIN + 78, y, { maxWidth: contentWidth - 85 });
    }
    y += 40;

    // --- SECCIÓN: CONTROL DE COMBUSTIBLE ---
    drawRow(MARGIN, y, contentWidth, 20, [254, 243, 199]); // Light Yellow
    doc.setFont("helvetica", "bold");
    doc.setTextColor(146, 64, 14); // Brownish
    doc.text("Control de combustible", pageWidth / 2, y + 14, { align: 'center' });
    y += 20;

    // Fila 6: Fecha Recarga, KM Recarga
    drawRow(MARGIN, y, contentWidth * 0.5, 25);
    drawTextInCell(log.monto ? dateStr : '', "Fecha:", MARGIN, y, 8.5);
    
    drawRow(MARGIN + (contentWidth * 0.5), y, contentWidth * 0.5, 25);
    drawTextInCell(String(log.kmRecarga || ''), "Kilometraje al momento de la recarga:", MARGIN + (contentWidth * 0.5), y, 8.5);
    y += 25;

    // Fila 7: Monto, Checkboxes tipo
    drawRow(MARGIN, y, contentWidth * 0.5, 25);
    drawTextInCell(log.monto ? `${log.monto.toLocaleString()}` : '', "Monto Colones:", MARGIN, y, 8.5);
    
    drawRow(MARGIN + (contentWidth * 0.5), y, contentWidth * 0.5, 25);
    const cbX = MARGIN + (contentWidth * 0.5) + 10;
    const drawCheckbox = (label: string, isChecked: boolean, x: number) => {
        doc.setLineWidth(0.5);
        doc.rect(x, y + 8, 8, 8);
        if (isChecked) {
            doc.line(x, y + 8, x + 8, y + 16);
            doc.line(x + 8, y + 8, x, y + 16);
        }
        doc.setFontSize(8.5);
        doc.text(label, x + 12, y + 15);
    };
    drawCheckbox("Super", log.tipoCombustible === 'Super', cbX);
    drawCheckbox("Regular", log.tipoCombustible === 'Regular', cbX + 50);
    drawCheckbox("Diesel", log.tipoCombustible === 'Diesel', cbX + 100);
    drawCheckbox("Gas", log.tipoCombustible === 'Gas', cbX + 150);
    y += 25;

    // Fila 8: Cantidad litros, Gasolinera
    drawRow(MARGIN, y, contentWidth * 0.5, 25);
    drawTextInCell(log.litros ? `${log.litros} L` : '', "Cantidad de Litros:", MARGIN, y, 8.5);
    
    drawRow(MARGIN + (contentWidth * 0.5), y, contentWidth * 0.5, 25);
    drawTextInCell(log.gasolinera || '', "Gasolinera:", MARGIN + (contentWidth * 0.5), y, 8.5);
    y += 25;

    // Disclaimer
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const disclaimer = "No olvide presentar adjunto a esta boleta la factura de combustible emitida a nombre de TENTELCOM DEL OESTE S. A., cédula jurídica 3-101-438992, e-mail info@tentelcom.com";
    doc.text(disclaimer, MARGIN + 5, y + 12, { maxWidth: contentWidth - 10 });
    y += 40;

    // --- DECLARACIÓN JURADA ---
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const declaracion = "Declaro bajo fe de juramento que la información consignada en la presente boleta es veraz, exacta y completa. Asimismo, reconozco que cualquier omisión, alteración o falsedad en la información podrá dar lugar a las responsabilidades administrativas, civiles o legales correspondientes.";
    doc.text(declaracion, MARGIN, y, { maxWidth: contentWidth, align: 'justify' });
    y += 80;

    // --- FIRMA ---
    doc.setLineWidth(0.8);
    doc.line(pageWidth / 2 - 90, y, pageWidth / 2 + 90, y);
    doc.setFont("helvetica", "bold");
    doc.text("Firma del conductor", pageWidth / 2, y + 15, { align: 'center' });
    
    if (log.firma?.imageBase64) {
        doc.addImage(log.firma.imageBase64, 'PNG', pageWidth / 2 - 70, y - 60, 140, 55);
    }

    const fileName = `Bitacora_${log.unidadName}_${log.fecha}.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, fileName);
};

export const exportVehicleLogsListPDF = async (logs: VehicleLog[], periodText: string) => {
    // Generate Landscape letter size PDF
    const doc = new jsPDF('l', 'pt', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth(); // 792
    const margin = 40;

    // Header Logo (Preserving original aspect ratio)
    const logoX = margin;
    const logoY = 30;
    const logoWidth = 90;
    let logoHeight = 45; // safety fallback

    try {
        const logoData = LOGO_BASE64;
        const imgProps = doc.getImageProperties(logoData);
        if (imgProps && imgProps.width && imgProps.height) {
            logoHeight = (imgProps.height * logoWidth) / imgProps.width;
        }
        doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch (e) {
        console.error('Error adding logo to PDF:', e);
    }

    // Title and Metadata
    const headerTextX = logoX + logoWidth + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138); // Dark Blue
    doc.text("REPORTE DE BITÁCORAS DE FLOTA VEHICULAR", headerTextX, logoY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Período / Filtro: ${periodText} | Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, headerTextX, logoY + 32);

    // Prepare table data
    const tableData = logs.map(l => {
        let displayDate = "";
        if (l.fecha) {
            if (l.fecha.includes("T")) {
                displayDate = format(new Date(l.fecha), "dd/MM/yyyy");
            } else {
                const [year, month, day] = l.fecha.split("-").map(Number);
                displayDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
            }
        } else {
            displayDate = "---";
        }

        const conductor = l.conductorName || '---';
        const unidad = l.unidad || (l.unidadId ? String(l.unidadId).split(' - ')[0]?.trim() || '' : '---');
        const placa = l.placa || (l.unidadId ? String(l.unidadId).split(' - ').slice(-1)[0]?.trim() || '' : '---');
        const displayVehicle = (unidad && placa && unidad !== placa) ? `${unidad} - ${placa}` : (unidad || '---');
        const kmRecorridos = l.totalKm != null ? `${l.totalKm} km` : `${(l.kmLlegada || 0) - (l.kmSalida || 0)} km`;
        const combustible = `${l.combustible || '---'} / ${l.combustibleFinal || '---'}`;
        const recarga = l.monto ? `₡${l.monto.toLocaleString()}` : '---';

        return [
            displayDate,
            displayVehicle,
            conductor,
            l.destino || "---",
            l.kmSalida != null ? l.kmSalida.toLocaleString() : '---',
            l.kmLlegada != null ? l.kmLlegada.toLocaleString() : '---',
            kmRecorridos,
            combustible,
            recarga,
            l.observaciones || "---"
        ];
    });

    const columns = [
        "Fecha",
        "Vehículo",
        "Conductor",
        "Destino / Actividad",
        "KM Inicio",
        "KM Fin",
        "Recorrido",
        "Combustible (I/F)",
        "Recarga",
        "Observaciones"
    ];

    autoTable(doc, {
        head: [columns],
        body: tableData,
        startY: Math.max(logoY + logoHeight + 15, 95),
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 7.5,
            cellPadding: 4,
            overflow: 'linebreak',
            halign: 'left'
        },
        headStyles: {
            fillColor: [30, 58, 138], // Dark Blue
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 55 }, // Fecha
            1: { cellWidth: 75 }, // Vehículo
            2: { cellWidth: 95 }, // Conductor
            3: { cellWidth: 110 }, // Destino
            4: { cellWidth: 45, halign: 'right' }, // KM Inicio
            5: { cellWidth: 45, halign: 'right' }, // KM Fin
            6: { cellWidth: 55, halign: 'right' }, // Recorrido
            7: { cellWidth: 65, halign: 'center' }, // Combustible (I/F)
            8: { cellWidth: 55, halign: 'right' }, // Recarga
            9: { cellWidth: 115 } // Observaciones
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252] // Very light slate
        }
    });

    const fileName = `Reporte_Bitacoras_${periodText.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, fileName);
};

export const exportVehicleLogsListExcel = async (logs: VehicleLog[], periodText: string) => {
    try {
        const excelRows = logs.map(l => {
            let displayDate = "";
            if (l.fecha) {
                if (l.fecha.includes("T")) {
                    displayDate = format(new Date(l.fecha), "dd/MM/yyyy");
                } else {
                    const [year, month, day] = l.fecha.split("-").map(Number);
                    displayDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                }
            } else {
                displayDate = "---";
            }

            const unidad = l.unidad || (l.unidadId ? String(l.unidadId).split(' - ')[0]?.trim() || '' : '');
            const placa = l.placa || (l.unidadId ? String(l.unidadId).split(' - ').slice(-1)[0]?.trim() || '' : '');
            const displayVehicle = (unidad && placa && unidad !== placa) ? `${unidad} - ${placa}` : (unidad || l.unidadName || '');
            const kmRecorridos = l.totalKm != null ? l.totalKm : ((l.kmLlegada || 0) - (l.kmSalida || 0));

            return {
                "Fecha": displayDate,
                "Vehículo / Unidad": displayVehicle,
                "Placa": placa,
                "Conductor": l.conductorName || '---',
                "Destino / Actividad": l.destino || '---',
                "KM Salida": l.kmSalida || 0,
                "KM Llegada": l.kmLlegada || 0,
                "KM Recorridos": kmRecorridos > 0 ? kmRecorridos : 0,
                "Combustible Inicial": l.combustible || '---',
                "Combustible Final": l.combustibleFinal || '---',
                "Gasolinera": l.gasolinera || '---',
                "Litros Recarga": l.litros || 0,
                "Monto Recarga (₡)": l.monto || 0,
                "Observaciones": l.observaciones || '---'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        
        // Auto-sizing columns helper
        const wscols = [
            { wch: 12 }, // Fecha
            { wch: 18 }, // Vehículo / Unidad
            { wch: 12 }, // Placa
            { wch: 25 }, // Conductor
            { wch: 30 }, // Destino
            { wch: 12 }, // KM Salida
            { wch: 12 }, // KM Llegada
            { wch: 14 }, // KM Recorridos
            { wch: 18 }, // Combustible Inicial
            { wch: 18 }, // Combustible Final
            { wch: 20 }, // Gasolinera
            { wch: 14 }, // Litros
            { wch: 16 }, // Monto
            { wch: 40 }  // Observaciones
        ];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Bitácora Vehicular");

        const fileName = `Reporte_Bitacoras_${periodText.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error("Error exportando bitácora a Excel:", error);
        throw error;
    }
};
