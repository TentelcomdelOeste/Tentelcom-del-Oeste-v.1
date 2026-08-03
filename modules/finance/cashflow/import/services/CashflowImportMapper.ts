import { ImportRow, IntermediateEntry } from '../types';

export class CashflowImportMapper {
  /**
   * Responsibility: Map Excel columns/rows to the IntermediateEntry structure.
   */
  map(rows: ImportRow[]): IntermediateEntry[] {
    console.log('[CashflowImportMapper] Mapping rows count:', rows.length);
    
    const mapped: IntermediateEntry[] = [];
    
    rows.forEach((row, index) => {
      const formattedRow = row.__formattedRow || {};
      
      // Clean keys of row (excluding internal __formattedRow)
      const keys = Object.keys(row).filter(k => k !== '__formattedRow');

      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Robust two-pass helper to find value by possible column names
      const getVal = (possibleNames: string[]) => {
        const normalizedTargets = possibleNames.map(p => normalize(p));

        // Pass 1: Exact match on normalized key
        for (const target of normalizedTargets) {
          const matchedKey = keys.find(k => normalize(k) === target);
          if (matchedKey && row[matchedKey] !== null && row[matchedKey] !== undefined && row[matchedKey] !== '') {
            return row[matchedKey];
          }
        }

        // Pass 2: Key contains target as substring (for target strings with length >= 3)
        for (const target of normalizedTargets) {
          if (target.length < 3) continue;
          const matchedKey = keys.find(k => normalize(k).includes(target));
          if (matchedKey && row[matchedKey] !== null && row[matchedKey] !== undefined && row[matchedKey] !== '') {
            return row[matchedKey];
          }
        }

        return null;
      };

      const rawDate = getVal(['fecha', 'date', 'fec', 'fechamovimiento', 'fechadocumento', 'fechatransaccion', 'femision', 'emision']);
      const rawProvider = getVal(['proveedor', 'provider', 'tercero', 'beneficiario', 'cliente', 'empresa', 'nombre', 'razonsocial', 'destinatario', 'cedula', 'vendedor', 'pagador']);
      const rawDetails = getVal(['detalle', 'detalles', 'descripcion', 'descripción', 'concepto', 'observacion', 'observaciones', 'asunto', 'nota', 'notas', 'explicacion', 'glosa', 'motivo']);
      const rawSubtotal = getVal(['subtotal', 'sub-total', 'sub total']);
      const rawTax = getVal(['impuesto', 'iva', 'tax', 'imp', 'tributo']);
      const rawTotal = getVal(['total', 'monto', 'valor', 'importe', 'montototal', 'egreso', 'ingreso', 'saldo', 'precio', 'cantidad', 'debe', 'haber']);
      const rawMethod = getVal(['formapago', 'metodopago', 'tipopago', 'mediopago', 'forma', 'metodo', 'método', 'pago', 'medio']);
      const rawAccount = getVal(['cuentabancaria', 'cuenta', 'banco', 'account', 'caja', 'origen', 'destino']);
      const rawConsecutive = getVal(['consecutivo', 'factura', 'recibo', 'comprobante', 'documento', 'numfactura', 'nofactura', 'ref', 'referencia', 'numero', 'num']);
      
      const rawCategory = getVal([
        'categoriadegasto', 'categoria de gasto', 'conceptodegasto', 'concepto de gasto',
        'tipodegasto', 'tipo de gasto', 'tipogasto', 'centrodecosto', 'centro de costo',
        'categoria', 'categoría', 'subtipo', 'clasificacion', 'clasificación', 'rubro',
        'familia', 'gasto', 'grupo'
      ]);

      const rawCurrency = getVal(['moneda', 'currency', 'mon', 'mnd', 'tipodemoneda', 'tipo de moneda', 'tipomoneda', 'divisa', 'mn', 'me', 'valuta']);

      const rawType = getVal(['tipodemovimiento', 'tipo de movimiento', 'tipodeoperacion', 'tipo de operacion', 'tipomovimiento', 'tipooperacion', 'ingresoegreso', 'naturaleza', 'movimiento', 'operacion', 'operación', 'tipo', 'ie']);
      
      const currencyHint = `${JSON.stringify(row)} ${JSON.stringify(formattedRow)}`;

      mapped.push({
        originalRowIndex: index + 2, // 1 for header, so first data row is 2 in Excel
        rawDate,
        rawProvider,
        rawDetails,
        rawSubtotal,
        rawTax,
        rawTotal,
        rawMethod,
        rawAccount,
        rawConsecutive,
        rawCategory,
        rawCurrency,
        rawType,
        currencyHint
      });
    });

    return mapped;
  }
}
