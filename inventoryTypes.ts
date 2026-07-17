
export interface ProductProvider {
  name: string;
  price: number; // Precio Unitario sin IVA
}

export interface InventoryItem {
  id: string;
  code: string; // Código único del material
  description: string;
  category: string;
  unit: string; // Unidad de medida (m, unidad, rollo, etc.)
  stock: number;
  reserved?: number; // Cantidad reservada por solicitudes pendientes
  minStock: number; // Punto de reorden
  location: string; // Ubicación física
  price: number; // Precio unitario (visible solo para admin)
  currency: 'USD' | 'CRC';
  providers?: ProductProvider[]; // Lista de precios por proveedor
  updatedAt: string;
  updatedBy: string;
  _sync?: {
    status: 'synced' | 'pending';
    updatedAt: string;
  };
}

export type StockStatus = 'ok' | 'low' | 'critical';
