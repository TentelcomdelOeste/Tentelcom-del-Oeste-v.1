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
  action: 'Asignación' | 'Devolución' | 'Incidencia' | 'Resolución' | 'Edición';
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

  // Observaciones y responsables
  observations?: string;
  assignedBy: string; // Nombre de quien entrega
  assignedByUserId?: string;

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
  assignedDate: string;
  initialCondition: ItemCondition;
  projectId?: string;
  projectNumber?: string;
  projectName?: string;
  jobId?: string;
  otCode?: string;
  observations?: string;
  assignedBy: string;
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
