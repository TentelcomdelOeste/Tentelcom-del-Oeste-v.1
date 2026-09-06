export interface Project {
  id: string; // The auto-generated ID like "TTC-2026-001"
  name: string;

  status:
    | 'Planificación'
    | 'En Ejecución'
    | 'En Pausa'
    | 'Entregado'
    | 'Facturado'
    | 'Cerrado';

  origin: 'Cotización' | 'Manual';

  quoteId?: string;
  clientId?: string;

  supervisorId?: string;

  mainOcNumber?: string;
  extraOcNumbers?: string[];

  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
}
