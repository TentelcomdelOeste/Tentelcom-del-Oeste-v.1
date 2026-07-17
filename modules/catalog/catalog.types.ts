
// Tipos Base
export type ProductStatus = 'draft' | 'published' | 'archived';
export type SupplierStatus = 'active' | 'inactive';
export type ImportSource = 'manual' | 'excel' | 'api';
export type Currency = 'USD' | 'CRC';

// Tipos para Reglas de Precio
export type PricingRuleType = 'percentage_margin' | 'fixed_markup';
export type PricingRuleScope = 'global' | 'category' | 'supplier';

// ------------------------------------------------------------------
// 2️⃣ Entidad: Proveedor (Supplier)
// ------------------------------------------------------------------
export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------
// 3️⃣ Entidad: Regla de Precio (PricingRule)
// ------------------------------------------------------------------
export interface PricingRule {
  id: string;
  name: string;
  
  // Definición de la regla
  type: PricingRuleType; // Porcentaje o Monto Fijo
  value: number; // El valor numérico de la regla (ej. 30 para 30%, o 5000 para +5000)
  
  // Alcance
  scope: PricingRuleScope;
  targetId?: string; // ID de la categoría o del proveedor (si scope != 'global')
  
  isActive: boolean;
  priority: number; // Para determinar qué regla gana si hay conflicto
}

// ------------------------------------------------------------------
// 1️⃣ Entidad: Producto de Catálogo (CatalogProduct)
// ------------------------------------------------------------------
export interface CatalogProduct {
  id: string;
  sku: string; // Código único de inventario/referencia
  name: string;
  description?: string;
  category: string;
  
  // Relaciones
  supplierId: string; // Referencia al Proveedor
  
  // Media
  imageUrl?: string;
  
  // Precios
  costPrice: number; // Precio base (Costo del proveedor)
  salePrice: number; // Precio público (Ya con margen aplicado)
  currency: Currency;
  
  // Metadatos de cálculo (opcionales, para trazabilidad)
  appliedRuleId?: string; // ID de la regla que calculó el precio
  
  // Inventario y Estado
  stockLevel: number;
  minStockLevel?: number;
  status: ProductStatus;
  
  // Metadatos de Sistema
  createdAt: string;
  updatedAt: string;
  importSource: ImportSource;
  tags?: string[];
}

// ------------------------------------------------------------------
// Helpers para Importación (Utilidad)
// ------------------------------------------------------------------
export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string; rawData: any }>;
  importedProducts: CatalogProduct[];
}
