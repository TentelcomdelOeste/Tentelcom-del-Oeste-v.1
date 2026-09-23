export type RecipientType = 'colaborador' | 'unidad';

export type AssignmentStatus = 'Asignado' | 'En uso' | 'Devuelto' | 'Con incidencia';

export type ItemCondition = 'Nuevo' | 'Bueno' | 'Regular' | 'Dañado' | 'Con faltante';

export interface IncidentReport {
  date: string;
  reportedBy: string;
  description: string;
  severity: 'Baja' | 'Media' | 'Alta';
  status: 'Abierta' | 'Resuelta';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface ToolAssignmentHistoryEntry {
  id: string;
  date: string;
  action: 'Asignación' | 'Devolución' | 'Incidencia' | 'Resolución' | 'Edición' | 'Transferencia';
  performedBy: string;
  details: string;
  previousStatus?: AssignmentStatus;
  newStatus?: AssignmentStatus;
}

export interface ToolAssignment {
  id: string;
  // Artículo del inventario
  itemId: string;
  itemCode: string;
  itemDescription: string;
  itemCategory?: string;
  itemUnit?: string;
  quantity: number;

  // Destinatario
  recipientType: RecipientType;
  recipientId: string;
  recipientName: string;
  recipientDetail?: string; // Cargo del colaborador o placa del vehículo
  isExternalRecipient?: boolean; // Indica si el destinatario es un tercero/externo y no un empleado del catálogo

  // Fechas y estados
  assignedDate: string; // YYYY-MM-DD
  status: AssignmentStatus;
  initialCondition: ItemCondition;

  // Datos de devolución
  returnDate?: string; // YYYY-MM-DD
  returnCondition?: ItemCondition;
  returnObservations?: string;
  returnQuantity?: number;
  returnHandledBy?: string;

  // Proyecto o trabajo opcional
  projectId?: string;
  projectNumber?: string;
  projectName?: string;
  jobId?: string;
  otCode?: string;

  // Identificador de movimiento e ID correlativo
  requestNumber?: string;
  movementId?: string;

  // Observaciones, fotos de evidencia y responsables
  observations?: string;
  assignedBy: string; // Nombre de quien entrega
  assignedByUserId?: string;
  evidencePhotos?: string[]; // URLs o fotos en formato Base64 de evidencia de entrega

  // Incidencias
  incidentReport?: IncidentReport;

  // Trazabilidad
  history: ToolAssignmentHistoryEntry[];

  // Metadatos
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted?: boolean;
}

export interface CreateAssignmentDTO {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  itemCategory?: string;
  itemUnit?: string;
  quantity: number;
  recipientType: RecipientType;
  recipientId: string;
  recipientName: string;
  recipientDetail?: string;
  isExternalRecipient?: boolean;
  assignedDate: string;
  initialCondition: ItemCondition;
  projectId?: string;
  projectNumber?: string;
  projectName?: string;
  jobId?: string;
  otCode?: string;
  observations?: string;
  assignedBy: string;
  evidencePhotos?: string[];
}

export interface ReturnAssignmentDTO {
  assignmentId: string;
  returnDate: string;
  returnCondition: ItemCondition;
  returnObservations?: string;
  returnQuantity: number;
  returnHandledBy: string;
}

export interface IncidentReportDTO {
  assignmentId: string;
  date: string;
  reportedBy: string;
  description: string;
  severity: 'Baja' | 'Media' | 'Alta';
}

export interface TransferAssignmentDTO {
  assignmentId: string;
  newRecipientType: RecipientType;
  newRecipientId: string;
  newRecipientName: string;
  newRecipientDetail?: string;
  isExternalRecipient?: boolean;
  transferDate: string; // YYYY-MM-DD
  assignedBy: string; // Nombre de quien realiza o autoriza el traspaso
  projectId?: string;
  projectNumber?: string;
  projectName?: string;
  observations?: string;
  evidencePhotos?: string[]; // Fotos nuevas de evidencia del traspaso
}
