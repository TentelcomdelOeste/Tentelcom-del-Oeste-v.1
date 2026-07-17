
import { CatalogProduct } from './catalog.types';

// Este archivo servirá como capa de abstracción para Firestore en el futuro.
// Actualmente solo define las firmas de las funciones.

export const fetchProducts = async (): Promise<CatalogProduct[]> => {
  // TODO: Implementar conexión a Firestore
  return [];
};

export const getProductById = async (id: string): Promise<CatalogProduct | null> => {
  // TODO: Implementar búsqueda por ID
  return null;
};

export const saveProduct = async (product: CatalogProduct): Promise<void> => {
  // TODO: Implementar guardado/actualización
};

export const deleteProduct = async (id: string): Promise<void> => {
  // TODO: Implementar borrado lógico o físico
};

export const updateProductStatus = async (id: string, status: CatalogProduct['status']): Promise<void> => {
  // TODO: Implementar cambio de estado
};
