
export type ExternalProductStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface RawProductData {
  titulo_raw: string;
  descripcion_raw: string;
  especificaciones_raw: string | null;
  imagenes_raw: string[];
  imagenes_base64?: string[];
  fichas_tecnicas?: string[];
  url_origen: string;
  fuente: string;
}

export interface ExternalProduct {
  // Identificadores
  id: string; // UUID
  
  // Origen
  proveedor: string;
  url_origen: string;

  // Datos Crudos
  titulo_raw: string;
  descripcion_raw: string;
  especificaciones_raw: string | null;
  imagenes_raw?: string[]; // Added to store scraped images
  imagenes_base64?: string[]; // Added to store base64 images
  fichas_tecnicas?: string[];

  // Datos Normalizados (Sugeridos)
  titulo_normalizado: string;
  descripcion_normalizada: string;
  categoria_sugerida: string | null;
  marca_sugerida: string | null;

  // Control
  estado: ExternalProductStatus;

  // Auditoría
  fecha_ingreso: string; // ISO DateTime
  creado_por: string; // user_id
  revisado_por: string | null; // user_id
  fecha_revision: string | null; // ISO DateTime
}

// DTO para creación
export type CreateExternalProductDTO = Omit<ExternalProduct, 'id' | 'estado' | 'fecha_ingreso' | 'revisado_por' | 'fecha_revision'>;