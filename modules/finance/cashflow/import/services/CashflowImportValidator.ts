import { IntermediateEntry, ValidatedEntry, ImportValidationResult, ImportError, ImportWarning } from '../types';
import { Quote, CashflowEntry } from '../../../../utils/types';
import * as XLSX from 'xlsx';

export class CashflowImportValidator {
  /**
   * Responsibility: Validate the mapped data against business rules.
   * Reuses logic like checkIsClosed and required field checks.
   */
  validate(
    entries: IntermediateEntry[], 
    quotes: Quote[], 
    isDateClosed: (date: string) => boolean,
    existingEntries: CashflowEntry[]
  ): { validatedEntries: ValidatedEntry[], validationResult: ImportValidationResult } {
    console.log('[CashflowImportValidator] Validating data count:', entries.length);
    
    const validatedEntries: ValidatedEntry[] = [];
    const allErrors: ImportError[] = [];
    const allWarnings: ImportWarning[] = [];
    
    if (entries.length === 0) {
       allErrors.push({ row: 0, column: 'Global', message: 'No hay registros para validar.' });
       return {
         validatedEntries: [],
         validationResult: { isValid: false, errors: allErrors, warnings: allWarnings }
       };
    }

    entries.forEach((entry, entryIndex) => {
      const errors: ImportError[] = [];
      const warnings: ImportWarning[] = [];
      
      let parsedDate: string | undefined;
      let parsedTotal: number | undefined;
      let parsedCurrency: 'CRC' | 'USD' | undefined;
      let parsedType: 'Ingreso' | 'Egreso' | undefined;
      let parsedSubtype: string | undefined = undefined;
      let parsedProjectId: string | null = null;
      let isClosedMonth = false;
      let isDuplicate = false;

      // 1. Date Validation
      if (entry.rawDate === null || entry.rawDate === undefined || entry.rawDate === '') {
        errors.push({ row: entry.originalRowIndex, column: 'Fecha', message: 'La fecha está vacía.', value: entry.rawDate });
      } else {
        let d: Date | null = null;
        if (entry.rawDate instanceof Date) {
           d = entry.rawDate;
        } else if (typeof entry.rawDate === 'number') {
           // Excel serial date
           try {
             const parsedSS = XLSX.SSF ? XLSX.SSF.parse_date_code(entry.rawDate) : null;
             if (parsedSS) {
               d = new Date(parsedSS.y, parsedSS.m - 1, parsedSS.d);
             } else {
               const excelEpoch = new Date(Date.UTC(1899, 11, 30));
               d = new Date(excelEpoch.getTime() + entry.rawDate * 86400000);
             }
           } catch {
             const excelEpoch = new Date(Date.UTC(1899, 11, 30));
             d = new Date(excelEpoch.getTime() + entry.rawDate * 86400000);
           }
        } else {
           const str = String(entry.rawDate).trim();
           const partsSlash = str.split('/');
           const partsDash = str.split('-');
           if (partsSlash.length === 3) {
             const p1 = parseInt(partsSlash[0], 10);
             const p2 = parseInt(partsSlash[1], 10);
             const p3 = parseInt(partsSlash[2], 10);
             if (p3 > 1000) {
               // Assume DD/MM/YYYY
               d = new Date(p3, p2 - 1, p1);
             } else if (p1 > 1000) {
               // Assume YYYY/MM/DD
               d = new Date(p1, p2 - 1, p3);
             } else {
               d = new Date(str);
             }
           } else if (partsDash.length === 3) {
             const p1 = parseInt(partsDash[0], 10);
             const p2 = parseInt(partsDash[1], 10);
             const p3 = parseInt(partsDash[2], 10);
             if (p1 > 1000) {
               // YYYY-MM-DD
               d = new Date(p1, p2 - 1, p3);
             } else {
               d = new Date(str);
             }
           } else {
             d = new Date(str);
           }
        }

        if (d && !isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          parsedDate = `${yyyy}-${mm}-${dd}`;
          
          if (yyyy < 2000 || yyyy > 2100) {
             errors.push({ row: entry.originalRowIndex, column: 'Fecha', message: 'Año fuera de rango razonable (2000-2100).', value: parsedDate });
             parsedDate = undefined;
          }
        } else {
          errors.push({ row: entry.originalRowIndex, column: 'Fecha', message: 'Formato de fecha inválido. Intente usar YYYY-MM-DD o formato de Fecha Excel.', value: entry.rawDate });
        }
      }

      // 2. Closed Periods
      if (parsedDate) {
         if (isDateClosed(parsedDate)) {
            errors.push({ row: entry.originalRowIndex, column: 'Fecha', message: 'El mes de esta fecha se encuentra cerrado.', value: parsedDate });
            isClosedMonth = true;
         }
      }

      // 3. Amount Validation
      if (entry.rawTotal === null || entry.rawTotal === undefined || entry.rawTotal === '') {
        errors.push({ row: entry.originalRowIndex, column: 'Total', message: 'El monto está vacío.', value: entry.rawTotal });
      } else {
        const cleanedStr = typeof entry.rawTotal === 'string' ? entry.rawTotal.replace(/[^0-9.-]/g, '') : entry.rawTotal;
        const num = Number(cleanedStr);
        if (isNaN(num)) {
          errors.push({ row: entry.originalRowIndex, column: 'Total', message: 'El monto no es un valor numérico.', value: entry.rawTotal });
        } else if (num <= 0) {
          errors.push({ row: entry.originalRowIndex, column: 'Total', message: 'El monto debe ser mayor a cero.', value: entry.rawTotal });
        } else {
          parsedTotal = num;
        }
      }

      // 4. Currency Detection
      // Check explicit rawCurrency field first
      const rawCurrStr = String(entry.rawCurrency || '').toLowerCase().trim();
      if (rawCurrStr) {
        if (rawCurrStr.includes('usd') || rawCurrStr.includes('dolar') || rawCurrStr.includes('dólar') || rawCurrStr.includes('$') || rawCurrStr === 'us') {
          parsedCurrency = 'USD';
        } else if (rawCurrStr.includes('crc') || rawCurrStr.includes('colon') || rawCurrStr.includes('colón') || rawCurrStr.includes('₡') || rawCurrStr === 'cr') {
          parsedCurrency = 'CRC';
        }
      }

      // If not resolved from rawCurrency, check combined text hints & cell formatting
      if (!parsedCurrency) {
        const hintStr = (entry.currencyHint || '').toLowerCase();
        const rawMethodStr = String(entry.rawMethod || '').toLowerCase();
        const rawAccountStr = String(entry.rawAccount || '').toLowerCase();
        const rawDetailsStr = String(entry.rawDetails || '').toLowerCase();
        const combinedHint = `${hintStr} ${rawMethodStr} ${rawAccountStr} ${rawDetailsStr}`;

        if (combinedHint.includes('usd') || combinedHint.includes('dolar') || combinedHint.includes('dólar') || combinedHint.includes('$')) {
          parsedCurrency = 'USD';
        } else {
          // Default to CRC for Costa Rican operational expenses context
          parsedCurrency = 'CRC';
        }
      }

      // 5. Movement Type (Ingreso / Egreso)
      // All imported rows in this wizard represent EGRESOS (operational expenses)
      parsedType = 'Egreso';

      // 6. Category Mapping (ExpenseSubtype for Egresos)
      // Defaults to 'Gasto Operativo' as this wizard handles operational expenses Excel files
      const catVal = entry.rawCategory !== null && entry.rawCategory !== undefined ? String(entry.rawCategory).trim() : '';
      if (catVal) {
         const catLower = catVal.toLowerCase();
         if (catLower.includes('administrativo') || catLower.includes('admin') || catLower.includes('oficina')) {
            parsedSubtype = 'Gasto Administrativo';
         } else if (catLower.includes('proyecto') || catLower.includes('obra')) {
            parsedSubtype = 'Costo de Proyecto';
         } else if (catLower.includes('otro') || catLower.includes('varios')) {
            parsedSubtype = 'Otro Egreso';
         } else {
            parsedSubtype = 'Gasto Operativo';
         }
      } else {
         parsedSubtype = 'Gasto Operativo';
      }

      // 7. Validate Projects
      const detailsStr = String(entry.rawDetails || '').toLowerCase();
      const providerStr = String(entry.rawProvider || '').toLowerCase();
      const matchedQuote = quotes.find(q => {
         const qStr = `#${q.id.toString().padStart(3, '0')}`;
         return detailsStr.includes(qStr) || providerStr.includes(qStr);
      });
      if (matchedQuote) {
         parsedProjectId = matchedQuote.id.toString();
      }

      // 8. Duplicates
      if (parsedDate && parsedTotal) {
         const duplicate = existingEntries.find(e => 
             e.date === parsedDate && 
             e.amount === parsedTotal &&
             (String(e.description || '').toLowerCase() === detailsStr || String(e.projectId) === parsedProjectId)
         );
         if (duplicate) {
             isDuplicate = true;
             warnings.push({ row: entry.originalRowIndex, column: 'General', message: 'Posible duplicado detectado en base de datos.', value: `Monto: ${parsedTotal}` });
         }
      }

      // Diagnostic logging for the first 5 rows (Requirement 7)
      if (entryIndex < 5) {
        console.log(`[Diagnostic Fila ${entry.originalRowIndex}]`, {
          fecha: parsedDate,
          monto: parsedTotal,
          monedaDetectada: parsedCurrency,
          categoriaDetectada: parsedSubtype,
          tipoMovimiento: parsedType,
          proveedor: entry.rawProvider,
          descripcion: entry.rawDetails,
          categoriaRaw: entry.rawCategory,
          monedaRaw: entry.rawCurrency,
          tipoRaw: entry.rawType
        });
      }

      const isValid = errors.length === 0;

      validatedEntries.push({
        ...entry,
        isValid,
        errors,
        warnings,
        parsedDate,
        parsedTotal,
        parsedCurrency,
        parsedType,
        parsedSubtype,
        parsedProjectId,
        isClosedMonth,
        isDuplicate
      });

      allErrors.push(...errors);
      allWarnings.push(...warnings);
    });

    return {
      validatedEntries,
      validationResult: {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
      }
    };
  }
}
