export type EstadoTrabajo =
  | "programado"
  | "en_proceso"
  | "finalizado"
  | "cancelado"
  | "en_espera"
  | "continuado";

export type EventSource = 
  | "system"
  | "manual"
  | "whatsapp";

export interface TimelineEvent {
  id: string;
  tipo: string;
  mensaje: string;
  usuarioId: string;
  usuarioNombre: string;
  timestamp: any;
  editado?: boolean;
  editedAt?: any;
  editedBy?: string;
  eliminado?: boolean;
  fileUrls?: string[];
  fileNames?: string[];
  fileSizes?: number[];
  optimisticId?: string;
  progress?: number;
  isOptimistic?: boolean;
  error?: string | null;
  pinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: any;
  mentions?: { userId: string; userName: string; email?: string }[];
  source?: EventSource;
  sourceMetadata?: {
    platform?: string;
    importId?: string;
    originalTimestamp?: any; 
    originalAuthor?: string;
    chatName?: string;
  };
  // WhatsApp attachment support
  attachmentName?: string;
  attachmentType?: 'image' | 'video' | 'audio' | 'pdf' | 'other';
  attachmentUrl?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface DiaDetalle {
  fecha: Date;
  completado: boolean;
  completado_en?: Date;
  completado_por?: string;
  hora_inicio?: string;
  hora_fin?: string;
  recursos_ajustados?: boolean;
  cuadrilla_diaria?: string[];
  unidades_diarias?: string[];
  estado?: EstadoTrabajo;
}

export interface BitacoraRelacionada {
  bitacoraId: string;
  fecha: string;
}

export interface Trabajo {
  id: string;
  titulo?: string;
  tipo_trabajo: string;
  descripcion: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  hora_inicio: string;
  hora_fin: string;
  cuadrilla: string[];
  unidades: string[];
  ubicacion: string;
  observaciones: string;
  estado: EstadoTrabajo;
  progreso: number;
  fecha_inicio_real?: Date;
  fecha_fin_real?: Date;
  dias_programados?: number;
  dias_detalle?: DiaDetalle[];
  cerrado_manualmente?: boolean;
  creado_en: Date;
  actualizado_en: Date;
  // Campos para relación padre-hijo
  parentId?: string | null;
  esSubTrabajo?: boolean;
  tieneContinuacionActiva?: boolean;
  enEspera?: boolean;
  fecha_reprogramacion?: Date | null;
  registroBitacoraId?: string | null; // Legacy
  bitacorasRelacionadas?: BitacoraRelacionada[];
  bitacoraIds?: string[]; // Helper for querying
  version?: number;
  deleted?: boolean;

  // Nuevos campos para búsqueda global
}
