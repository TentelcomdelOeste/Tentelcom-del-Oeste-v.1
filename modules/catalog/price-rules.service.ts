
import { CatalogProduct, PricingRule } from './catalog.types';

/**
 * Redondea un número a 2 decimales para evitar errores de punto flotante en moneda.
 */
const roundCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/**
 * Calcula el precio de venta sugerido basado en un costo y una regla de precio.
 * @param cost Precio de costo del producto
 * @param rule Regla de precio a aplicar
 * @returns El precio de venta calculado
 */
export const calculateSalePrice = (cost: number, rule: PricingRule): number => {
  let salePrice = cost;

  switch (rule.type) {
    case 'percentage_margin':
      // Margen sobre costo: Costo * (1 + %/100)
      // Ejemplo: 100 * (1 + 0.30) = 130
      salePrice = cost * (1 + rule.value / 100);
      break;
    case 'fixed_markup':
      // Monto fijo agregado: Costo + Valor
      // Ejemplo: 100 + 50 = 150
      salePrice = cost + rule.value;
      break;
  }

  return roundCurrency(salePrice);
};

/**
 * Encuentra la mejor regla aplicable para un producto específico.
 * Criterios de resolución de conflictos:
 * 1. Mayor Prioridad (campo priority)
 * 2. Mayor Especificidad (Proveedor > Categoría > Global)
 */
export const findBestRuleForProduct = (product: CatalogProduct, rules: PricingRule[]): PricingRule | null => {
  // Pesos para desempate por especificidad (si la prioridad es igual)
  const scopeWeights = {
    supplier: 3,
    category: 2,
    global: 1
  };

  const applicableRules = rules.filter(rule => {
    if (!rule.isActive) return false;

    switch (rule.scope) {
      case 'global':
        return true;
      case 'category':
        return rule.targetId === product.category;
      case 'supplier':
        return rule.targetId === product.supplierId;
      default:
        return false;
    }
  });

  if (applicableRules.length === 0) return null;

  // Ordenar reglas: Primero por prioridad (descendente), luego por especificidad
  return applicableRules.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Gana el de mayor prioridad numérica
    }
    // Desempate por especificidad
    return scopeWeights[b.scope] - scopeWeights[a.scope];
  })[0];
};

/**
 * Aplica un conjunto de reglas a una lista de productos.
 * Retorna una NUEVA lista de productos con los precios y metadatos actualizados.
 * No muta los objetos originales.
 */
export const applyRulesToCatalog = (products: CatalogProduct[], rules: PricingRule[]): CatalogProduct[] => {
  return products.map(product => {
    const bestRule = findBestRuleForProduct(product, rules);

    if (bestRule) {
      const newSalePrice = calculateSalePrice(product.costPrice, bestRule);
      
      return {
        ...product,
        salePrice: newSalePrice,
        appliedRuleId: bestRule.id,
        updatedAt: new Date().toISOString() // Actualizamos fecha de modificación simulada
      };
    }

    // Si no hay regla aplicable, se mantiene el producto original (o se podría decidir otra lógica)
    return product;
  });
};

/**
 * Valida si el precio de venta cumple con un margen mínimo de ganancia.
 * Útil para alertas de seguridad antes de publicar.
 * @param cost Costo del producto
 * @param price Precio de venta
 * @param minMarginPercentage Porcentaje mínimo requerido (ej. 10 para 10%)
 */
export const validateMargin = (cost: number, price: number, minMarginPercentage: number): boolean => {
  if (cost <= 0) return true; // Evitar división por cero, asumimos válido si costo es 0 o negativo (casos raros)
  
  const currentMargin = ((price - cost) / cost) * 100;
  return currentMargin >= minMarginPercentage;
};

/**
 * Calcula el margen real de ganancia de un producto.
 */
export const calculateMarginPercentage = (cost: number, price: number): number => {
    if (cost <= 0) return 100;
    return roundCurrency(((price - cost) / cost) * 100);
};
