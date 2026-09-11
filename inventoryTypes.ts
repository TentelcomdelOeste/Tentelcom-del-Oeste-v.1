
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
  imageUrl?: string; // URL o base64 de la imagen de referencia del material (legacy/retrocompatibilidad)
  imageUrls?: string[]; // Lista de URLs o base64 de imágenes de referencia (hasta 4)
  providers?: ProductProvider[]; // Lista de precios por proveedor
  deleted?: boolean; // Marca de eliminación lógica
  updatedAt: string;
  updatedBy: string;
  _sync?: {
    status: 'synced' | 'pending';
    updatedAt: string;
  };
}

export interface CodeStatusResult {
  status: 'AVAILABLE' | 'ACTIVE_EXISTS' | 'PREVIOUSLY_USED';
  activeItem?: {
    id: string;
    code: string;
    description: string;
  };
  previousItem?: {
    id?: string;
    code: string;
    description?: string;
    source?: 'inventory_items' | 'movements' | 'assignments';
  };
}

export type StockStatus = 'ok' | 'low' | 'critical';
