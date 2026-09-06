export interface Project {
  id: string; // The technical Firestore ID
  projectNumber: string; // The visible ID like "TTC-2026-001"
  name: string;
  isActive: boolean;

  status:
    | 'Planificación'
    | 'En Ejecución'
    | 'En Pausa'
    | 'Entregado'
    | 'Facturado'
    | 'Cerrado';

  origin: 'Cotización' | 'Manual';

  quoteId?: string;
  quoteCommercialId?: string;
  clientId?: string;
  clientName?: string; // Company Name for display

  supervisorId?: string;
  supervisorName?: string;

  mainOcNumber?: string;
  extraOcNumbers?: string[];

  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;

  createdAt: string;
  createdBy: string;
  createdByDisplayName?: string; // User Name for display
  updatedAt: string;
}
