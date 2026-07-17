import { db } from '../../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { cachedQuery } from '../queryCache';

export interface ExportFilters {
  year: string;
  month: string;
  type?: string;        // 'all' | 'CXC' | 'CXP'
  paymentMode?: string; // 'all' | 'CONTADO' | 'CREDITO'
  currency?: string;    // 'all' | 'USD' | 'CRC'
}

export interface InvoiceExportData {
  consecutivo: string;
  entityName: string;
  type: string;
  paymentMode: string;
  currency: 'CRC' | 'USD';
  subtotal: number;
  iva: number;
  total: number;
  status: string;
  projectName: string;
  notes: string;
  issueDate: string;
  dueDate: string;
}

/**
 * Obtiene y filtra las facturas directamente desde Firestore para procesos de exportación.
 * Fuente de verdad única para Excel y PDF.
 * AHORA CON CACHÉ: Evita leer miles de documentos si el usuario exporta Excel y luego PDF.
 */
export const getInvoicesForExport = async (filters: ExportFilters): Promise<InvoiceExportData[]> => {
  const cacheKey = `export_invoices_${JSON.stringify(filters)}`;

  return await cachedQuery(cacheKey, async () => {
    try {
      const q = query(collection(db, 'invoices'), orderBy('issueDate', 'desc'));
      const snapshot = await getDocs(q);

      const rawData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          consecutivo: data.consecutivo || '---',
          type: data.type || 'CXC',
          paymentMode: data.paymentMode || 'CREDITO',
          currency: (data.currency === 'USD' || data.currency === 'CRC') ? data.currency : 'USD',
          subtotal: Number(data.subtotal) || 0,
          iva: Number(data.iva) || 0,
          total: Number(data.total) || 0,
          status: data.status || 'Pendiente',
          projectName: data.projectName || '---',
          notes: data.notes || '',
          issueDate: data.issueDate || '',
          dueDate: data.dueDate || '',
          entityName: data.entityName || '---'
        };
      });

      // Filtrado Extendido (Año, Mes, Tipo, Modalidad, Moneda)
      return rawData.filter(inv => {
        if (!inv.issueDate) return false;
        
        const dateParts = inv.issueDate.split('-'); // YYYY-MM-DD
        if (dateParts.length < 2) return false;

        const invYear = dateParts[0];
        const invMonth = parseInt(dateParts[1], 10).toString();

        const yearMatch = filters.year === 'all' || invYear === filters.year;
        const monthMatch = filters.month === 'all' || invMonth === filters.month;

        // Filtros Adicionales (Opcionales)
        const typeMatch = !filters.type || filters.type === 'all' || inv.type === filters.type;
        const modeMatch = !filters.paymentMode || filters.paymentMode === 'all' || inv.paymentMode === filters.paymentMode;
        const currencyMatch = !filters.currency || filters.currency === 'all' || inv.currency === filters.currency;

        return yearMatch && monthMatch && typeMatch && modeMatch && currencyMatch;
      });
    } catch (error) {
      console.error("Error obteniendo datos para exportación:", error);
      throw new Error("Error al consultar la base de datos.");
    }
  });
};