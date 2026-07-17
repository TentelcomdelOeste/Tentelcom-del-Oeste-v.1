
import * as XLSX from 'xlsx';
import { getInvoicesForExport, ExportFilters } from './invoiceData';

// Helper para formatear el tipo de factura según requerimientos estrictos
const getFormattedInvoiceType = (type: string, mode: string): string => {
  if (type === 'CXC') {
    return mode === 'CONTADO' ? 'Cuenta por cobrar contado' : 'Cuenta por cobrar crédito';
  }
  if (type === 'CXP') {
    return mode === 'CONTADO' ? 'Cuenta por pagar contado' : 'Cuenta por pagar crédito';
  }
  return `${type} - ${mode}`; // Fallback por seguridad
};

/**
 * Genera el reporte de Excel utilizando los datos centralizados.
 */
export const exportFullInvoicesToExcel = async (filters: ExportFilters) => {
  try {
    // 1. Obtener datos desde la capa central
    const filteredData = await getInvoicesForExport(filters);

    if (filteredData.length === 0) {
      throw new Error("No se encontraron facturas para el periodo seleccionado.");
    }

    // 2. Mapeo a Columnas EXACTAS para Excel
    const excelRows = filteredData.map(inv => ({
      "Consecutivo": inv.consecutivo,
      "Entidad": inv.entityName,
      "Tipo": getFormattedInvoiceType(inv.type, inv.paymentMode),
      "Modalidad": inv.paymentMode === 'CONTADO' ? 'Contado' : 'Crédito',
      "Mon": inv.currency,
      "Subtotal": inv.subtotal,
      "IVA": inv.iva,
      "Total": inv.total,
      "Estado": inv.status,
      "Proyecto": inv.projectName,
      "Observaciones": inv.notes,
      "Fecha Emisión": inv.issueDate,
      "Fecha Vencimiento": inv.dueDate
    }));

    // 3. Generación del Archivo Excel
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    
    const wscols = [
      { wch: 15 }, // Consecutivo
      { wch: 30 }, // Entidad
      { wch: 25 }, // Tipo (Aumentado para texto largo)
      { wch: 12 }, // Modalidad
      { wch: 8 },  // Mon
      { wch: 12 }, // Subtotal
      { wch: 12 }, // IVA
      { wch: 12 }, // Total
      { wch: 12 }, // Estado
      { wch: 30 }, // Proyecto
      { wch: 40 }, // Observaciones
      { wch: 15 }, // Emisión
      { wch: 15 }, // Vencimiento
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturación Completa");

    const periodStr = `${filters.year === 'all' ? 'Historico' : filters.year}${filters.month !== 'all' ? '_M' + filters.month : ''}`;
    const fileName = `Reporte_Facturas_Completo_${periodStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);

  } catch (error) {
    console.error("Error exportando facturas a Excel:", error);
    throw error;
  }
};
