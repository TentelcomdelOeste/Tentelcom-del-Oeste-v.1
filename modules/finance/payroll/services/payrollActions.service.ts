import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { db } from '../../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { generatePaystubPDF } from '../../../../utils/pdfGenerator';
import { triggerFileDownload } from '../../../../utils/fileUtils';
import { Employee, PayStub } from '../../../../financeTypes';

/**
 * Helper interno para formateo numérico puro (sin símbolos ni prefijos)
 * Requerido para estándares de reportes financieros ERP.
 */
const formatRawNumber = (amount: number): string => {
  return new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Servicio centralizado para acciones de planilla corporativa.
 * Diseñado para no mutar datos y manejar transformaciones de salida.
 */
export const PayrollActionsService = {
  
  /**
   * Exportación a Excel con formato de celdas financieras
   */
  exportToExcel: (data: any[], period: string) => {
    const excelRows = data.map(emp => ({
      "Código": emp.employeeCode,
      "Colaborador": emp.name,
      "Centro de Costo": emp.costCenter,
      "Cargo": emp.position,
      "Salario Base": emp.base,
      "Horas Extra": emp.extras,
      "Cargas Sociales (26.5%)": emp.charges,
      "Neto a Pagar": emp.netPay,
      "Estado": "Calculado"
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Planilla");

    // Ajuste de anchos
    worksheet['!cols'] = [
        { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, 
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, 
        { wch: 15 }, { wch: 12 }
    ];

    XLSX.writeFile(workbook, `Planilla_Corporativa_${period.replace(/\s/g, '_')}.xlsx`);
  },

  /**
   * Generación de PDF formal con motor jsPDF + AutoTable
   */
  exportToPDF: (data: any[], totals: any, period: string) => {
    const doc = new jsPDF('l', 'pt', 'letter');
    const margin = 40;
    const pageWidth = doc.internal.pageSize.width;

    // Header Corporativo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text("TENTELCOM DEL OESTE S.A.", margin, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    // Añadimos contexto de moneda en el subtítulo principal
    doc.text(`REPORTE DE PLANILLA CORPORATIVA (CRC) - PERIODO: ${period.toUpperCase()}`, margin, 65);
    doc.text(`Generado: ${new Date().toLocaleString()}`, pageWidth - margin, 65, { align: 'right' });

    // Bloque de Totales (Visualización de Resumen)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, 80, pageWidth - (margin * 2), 40, 5, 5, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("TOTAL BRUTO (CRC)", margin + 20, 95);
    doc.text("CARGAS PATRONALES", margin + 150, 95);
    doc.text("TOTAL NETO A PAGAR", margin + 300, 95);

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    // Usamos formateador puro para los totales del bloque superior
    doc.text(formatRawNumber(totals.gross), margin + 20, 110);
    doc.text(formatRawNumber(totals.charges), margin + 150, 110);
    doc.text(formatRawNumber(totals.net), margin + 300, 110);

    // Tabla de Datos
    const tableBody = data.map(emp => [
        emp.employeeCode,
        emp.name,
        emp.costCenter,
        formatRawNumber(emp.base),
        formatRawNumber(emp.charges),
        formatRawNumber(emp.netPay)
    ]);

    autoTable(doc, {
      startY: 140,
      head: [['COD', 'COLABORADOR', 'CENTRO', 'BASE', 'CARGAS', 'NETO']],
      body: tableBody,
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 58, 138], 
        fontSize: 8, 
        halign: 'center',
        cellPadding: 6 
      },
      styles: { 
        fontSize: 7, 
        valign: 'middle',
        cellPadding: 4 
      },
      columnStyles: {
        3: { halign: 'right', fontStyle: 'normal' },
        4: { halign: 'right', fontStyle: 'normal' },
        5: { halign: 'right', fontStyle: 'normal' },
        6: { halign: 'right', fontStyle: 'bold' } // Neto resaltado
      }
    });

    // Footer de página
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            `TENTELCOM DEL OESTE S.A. - Página ${i} de ${totalPages}`,
            pageWidth / 2,
            doc.internal.pageSize.height - 20,
            { align: 'center' }
        );
    }

    const fileName = `PLANILLA_GENERAL_CONS_${month}_${year}_${new Date().getTime()}.pdf`;
    const blob = doc.output('blob');
    triggerFileDownload(blob, fileName);
  },

  /**
   * Generación de archivo de dispersión bancaria (CSV)
   */
  generateBankFile: (data: any[]) => {
    // Validaciones preventivas
    const missingIban = data.filter(e => !e.phone); // Usamos phone como fallback si no hay campo IBAN real en el mock
    if (missingIban.length > 50) { // Simulación de validación
       throw new Error("Existen empleados sin cuenta bancaria configurada.");
    }

    // Estructura CSV: Nombre, Cuenta, Monto, Referencia
    const csvContent = [
      ["Nombre", "Cuenta", "Moneda", "Monto", "Referencia"],
      ...data.map(emp => [
        emp.name,
        "CR" + Math.random().toString().slice(2, 20), // Mock de IBAN
        "CRC",
        emp.netPay.toFixed(2),
        `PAGO_PLANILLA_${emp.employeeCode}`
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `Dispersion_Bancaria_${new Date().toISOString().split('T')[0]}.csv`;
    triggerFileDownload(blob, fileName);
  },

  /**
   * Exportación masiva a ZIP de colillas históricas
   */
  exportToZIP: async (year: number, month: number, fortnight: string, employees: Employee[]) => {
    const zip = new JSZip();
    const stubsRef = collection(db, 'pay_stubs');
    const q = query(
      stubsRef, 
      where("year", "==", year), 
      where("month", "==", month), 
      where("fortnight", "==", fortnight),
      where("isDeleted", "==", false)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error("No existen colillas generadas para el periodo seleccionado.");
    }

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthLabel = monthNames[month - 1];
    const fortnightLabel = fortnight === 'Primera' ? 'Q1' : 'Q2';

    // Procesar cada colilla
    const processingPromises = snapshot.docs.map(async (docSnap) => {
      const stub = docSnap.data() as PayStub;
      const employee = employees.find(e => e.id === stub.employeeId);
      
      if (!employee) return;

      const { fileBlob, fileName } = await generatePaystubPDF(stub, employee);
      zip.file(fileName, fileBlob);
    });

    await Promise.all(processingPromises);

    const content = await zip.generateAsync({ type: "blob" });
    const fileName = `Colillas_${monthLabel}_${year}_${fortnightLabel}.zip`;
    triggerFileDownload(content, fileName);
  },

  /**
   * Exportación de una lista específica de colillas a ZIP
   */
  exportVisibleStubsToZIP: async (stubs: PayStub[], employees: Employee[]) => {
    if (stubs.length === 0) {
      throw new Error("No hay colillas disponibles para exportar en la vista actual.");
    }

    const zip = new JSZip();
    
    const processingPromises = stubs.map(async (stub) => {
      const employee = employees.find(e => e.id === stub.employeeId);
      if (!employee) return;

      const { fileBlob, fileName } = await generatePaystubPDF(stub, employee);
      zip.file(fileName, fileBlob);
    });

    await Promise.all(processingPromises);

    const content = await zip.generateAsync({ type: "blob" });
    const fileName = `Colillas_Exportadas_${new Date().toISOString().split('T')[0]}.zip`;
    triggerFileDownload(content, fileName);
  }
};
