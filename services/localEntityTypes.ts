// services/localEntityTypes.ts

export interface LocalMetadata {
  updatedAt: string;
  source: 'firestore' | 'manual';
}

export interface LocalEntity {
  id: string;
  metadata: LocalMetadata;
  syncState: 'synced' | 'pending' | 'conflict';
}

export interface TrabajosEntity extends LocalEntity {
  data: any; // Assuming flexible structure based on current usage
}

export interface EmpleadosEntity extends LocalEntity {
  data: any;
}

export interface ClientesEntity extends LocalEntity {
  data: any;
}

export interface BitacorasEntity extends LocalEntity {
  data: any;
}

export interface CotizacionesEntity extends LocalEntity {
  data: any;
}

export interface InventarioCacheEntity extends LocalEntity {
  data: any;
}

export interface MetadataEntity extends LocalEntity {
  key: string;
  value: any;
}
