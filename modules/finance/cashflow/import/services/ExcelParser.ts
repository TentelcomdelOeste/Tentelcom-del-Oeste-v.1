import * as XLSX from 'xlsx';
import { ImportRow } from '../types';

export interface ParseResult {
  rows: ImportRow[];
  sheetName: string;
  sheetNames: string[];
}

export class ExcelParser {
  /**
   * Responsibility: Read the Excel file and convert it into a collection of raw objects (ImportRow).
   */
  async parse(file: File): Promise<ParseResult> {
    console.log('[ExcelParser] Parsing file:', file.name);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          // cellDates: true parses dates as JS Date objects when possible
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: true, cellStyles: true });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error("El archivo no contiene hojas."));
            return;
          }

          // Automatically select the first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convert to JSON: raw values (for exact numbers & dates)
          const rawRows = XLSX.utils.sheet_to_json<ImportRow>(worksheet, {
            defval: null,
            raw: true
          });

          // Convert to JSON: formatted string representations (for currency symbols like $, ₡, etc.)
          const formattedRows = XLSX.utils.sheet_to_json<ImportRow>(worksheet, {
            defval: null,
            raw: false
          });

          // Filter out completely empty rows and attach formatted representations
          const filteredRows: ImportRow[] = [];
          rawRows.forEach((row, idx) => {
            const hasData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
            if (hasData) {
              const fRow = formattedRows[idx] || {};
              filteredRows.push({
                ...row,
                __formattedRow: fRow
              });
            }
          });

          resolve({ rows: filteredRows, sheetName, sheetNames: workbook.SheetNames });
        } catch (error) {
          reject(new Error("Error al leer el archivo Excel: " + (error as Error).message));
        }
      };

      reader.onerror = () => {
        reject(new Error("Error de lectura del archivo: " + reader.error?.message));
      };

      reader.readAsArrayBuffer(file);
    });
  }
}
