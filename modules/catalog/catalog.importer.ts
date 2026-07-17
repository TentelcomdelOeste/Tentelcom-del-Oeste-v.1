
import * as XLSX from 'xlsx';
import { CatalogProduct, ImportResult, Currency, PricingRule } from './catalog.types';
import { calculateSalePrice, findBestRuleForProduct } from './price-rules.service';

// REGLA GLOBAL POR DEFECTO: 30% DE MARGEN
// Se utiliza como fallback si no hay reglas específicas (Categoría/Proveedor)
const DEFAULT_GLOBAL_RULE: PricingRule = {
  id: 'DEFAULT_GLOBAL_30',
  name: 'Margen Global Estándar',
  type: 'percentage_margin',
  value: 30, // 30%
  scope: 'global',
  isActive: true,
  priority: 0 // Prioridad mínima para que cualquier otra regla la sobreescriba
};

// Helper para normalizar claves de columnas (permitir variaciones comunes y bilingües)
const normalizeKey = (key: string): string => {
  const k = key.toLowerCase().trim();
  const map: Record<string, string> = {
    // Identificadores
    'sku': 'sku', 'código': 'sku', 'codigo': 'sku', 'referencia': 'sku', 'ref': 'sku',
    
    // Información Básica
    'name': 'name', 'nombre': 'name', 'producto': 'name', 'descripción': 'name', 'item': 'name',
    'description': 'description', 'detalle': 'description', 'notas': 'description',
    
    // Categorización
    'category': 'category', 'categoría': 'category', 'familia': 'category', 'grupo': 'category',
    
    // Precios
    'cost': 'costPrice', 'costo': 'costPrice', 'precio base': 'costPrice', 'precio costo': 'costPrice', 'costprice': 'costPrice',
    
    // Proveedor
    'supplier': 'supplierId', 'proveedor': 'supplierId', 'fabricante': 'supplierId',
    
    // Inventario
    'stock': 'stockLevel', 'cantidad': 'stockLevel', 'inventario': 'stockLevel', 'existencias': 'stockLevel',
    
    // Moneda
    'currency': 'currency', 'moneda': 'currency'
  };
  return map[k] || k;
};

export const parseCatalogFile = async (file: File, rules: PricingRule[] = []): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
            throw new Error("No se pudo leer el archivo o está vacío.");
        }

        // Leer el libro de trabajo
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Asumimos que los datos están en la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON crudo (array de objetos)
        // defval: '' asegura que celdas vacías no rompan la estructura si es necesario
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const result: ImportResult = {
          totalRows: rawRows.length,
          successCount: 0,
          errorCount: 0,
          errors: [],
          importedProducts: []
        };

        // Preparamos el conjunto de reglas efectivas (Reglas del sistema + Default)
        const effectiveRules = [...rules, DEFAULT_GLOBAL_RULE];

        rawRows.forEach((row: any, index) => {
          // 1. Normalizar las claves del objeto
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            const cleanKey = normalizeKey(key);
            // Solo copiamos si la clave normalizada es útil o si queremos mantener datos extra
            normalizedRow[cleanKey] = row[key];
          });

          // 2. Validación de campos obligatorios
          const missingFields = [];
          if (!normalizedRow.sku) missingFields.push('SKU');
          if (!normalizedRow.name) missingFields.push('Nombre');
          // Validamos que costPrice exista y no sea una cadena vacía, aunque sea 0 es válido
          if (normalizedRow.costPrice === undefined || normalizedRow.costPrice === '') missingFields.push('Costo');
          if (!normalizedRow.category) missingFields.push('Categoría');

          if (missingFields.length > 0) {
            result.errorCount++;
            result.errors.push({
              row: index + 2, // +2 para compensar: índice 0 y fila de encabezados
              message: `Datos incompletos. Faltan: ${missingFields.join(', ')}`,
              rawData: row
            });
            return; // Saltar esta fila
          }

          // 3. Validación y Conversión de Tipos
          const cost = parseFloat(normalizedRow.costPrice);
          if (isNaN(cost) || cost < 0) {
            result.errorCount++;
            result.errors.push({
              row: index + 2,
              message: `El costo no es un número válido: ${normalizedRow.costPrice}`,
              rawData: row
            });
            return;
          }

          const stock = parseInt(normalizedRow.stockLevel);
          const finalStock = isNaN(stock) ? 0 : stock;

          // Detectar moneda
          let currency: Currency = 'USD';
          if (normalizedRow.currency) {
            const cleanCurr = String(normalizedRow.currency).trim().toUpperCase();
            if (cleanCurr === 'CRC' || cleanCurr === 'COLONES' || cleanCurr === '¢') currency = 'CRC';
          }

          // 4. Construcción del Objeto CatalogProduct
          // NOTA: 'id' es temporal. Firestore asignará uno real al guardar.
          const product: CatalogProduct = {
            id: `TEMP_${Date.now()}_${index}`, 
            sku: String(normalizedRow.sku).trim(),
            name: String(normalizedRow.name).trim(),
            description: normalizedRow.description ? String(normalizedRow.description).trim() : '',
            category: String(normalizedRow.category).trim(),
            supplierId: normalizedRow.supplierId ? String(normalizedRow.supplierId).trim() : 'PENDING_ASSIGNMENT',
            
            costPrice: cost,
            salePrice: cost, // Se inicializa con el costo, se calcula abajo
            currency: currency,
            
            stockLevel: finalStock,
            status: 'draft', // Siempre entran como borrador para revisión
            
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            importSource: 'excel',
            tags: []
          };

          // 5. Aplicación de Reglas de Precio (Cálculo Automático)
          // Siempre buscamos la mejor regla (al menos existirá la DEFAULT_GLOBAL_RULE)
          const bestRule = findBestRuleForProduct(product, effectiveRules);
          if (bestRule) {
            product.salePrice = calculateSalePrice(product.costPrice, bestRule);
            product.appliedRuleId = bestRule.id;
          }

          result.importedProducts.push(product);
          result.successCount++;
        });

        resolve(result);

      } catch (error: any) {
        console.error("Error crítico en el parsing del archivo:", error);
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const validateImportData = (data: any[]): boolean => {
  // Validación estructural básica previa al procesamiento detallado
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return true;
};
