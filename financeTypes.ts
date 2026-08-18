import { AutomaticAdjustment } from './modules/finance/automatic_adjustments/automaticAdjustments.types';

export type AbsenceType = 'Permiso' | 'Ausencia' | 'Incapacidad';
export type Fortnight = 'Primera' | 'Segunda';

// MÁQUINA DE ESTADOS: NOMINA
export type PayrollStatus = 'GENERATED' | 'REVIEWED' | 'APPROVED' | 'PAID';

export interface PayrollMasterRecord {
  id: string; // Periodo: YYYY-MM-Q1/Q2
  year: number;
  month: number;
  fortnight: Fortnight;
  status: PayrollStatus;
  totals: {
    gross: number;
    charges: number;
    net: number;
    count: number;
  };
  updatedAt: string;
  updatedBy: string;
  history: Array<{
    status: PayrollStatus;
    timestamp: string;
    user: string;
    note?: string;
  }>;
}

export interface ModulePermissions {
  cotizaciones?: boolean;
  pre_analysis?: boolean; // NUEVO PERMISO PARA EVALUACIÓN DE PROYECTOS
  trabajos?: boolean;
  inventario?: {
    general: boolean;
    movimientos: boolean;
    solicitudes: boolean;
    reportes: boolean;
  };
  finanzas?: {
    movimientos: boolean;
    analisis: boolean;
    comprobantes: boolean;
    ausencias: boolean;
    empleados: boolean;
    facturacion: boolean;
    ordenes_compra: boolean;
    payroll: boolean; 
  };
  external_products?: boolean;
  [key: string]: any; // Firma dinámica para permitir expansión via registry
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  baseSalary: number;
  ccssDeduction: number;
  reportadoCCSS?: number;
  ccssDeductionQuincenal?: number;
  isActive: boolean;
  status?: 'activo' | 'archivado';
  employeeCode: string;
  phone: string;
  email: string;
  role: 'admin' | 'empleado' | 'supervisor';
  username?: string;
  password?: string;
  forcePasswordChange?: boolean;
  canUseOperationalLog?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  permissions?: ModulePermissions;
  hireDate?: string;
  salaryConfiguration?: SalaryConfiguration;
}

export interface SalaryConfiguration {
  salaryDivisor: number;
  ordinaryHours: number;
  ordinaryMultiplier: number;
  extraHours: number;
  extraMultiplier: number;
  holidayHours: number;
  holidayMultiplier: number;
  ccssType?: 'percentage' | 'fixed';
  ccssPercentage?: number;
  ccssDivideByTwo?: boolean;
  isManualValHoraBase?: boolean;
  manualValHoraBase?: number;
  isManualValHoraOrg?: boolean;
  manualValHoraOrg?: number;
}

export interface AbsenceRecord {
  id: string;
  employeeId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  justification: string;
  deductionAmount?: number;
}

export interface WorkHistoryEvent {
  id: string;
  employeeId: string;
  eventType: 'salary_increase' | 'salary_decrease' | 'position_change' | 'status_change' | 'permission_change' | 'promotion' | 'admin_modification' | 'other';
  date: string;
  timestamp: any;
  adminName: string;
  adminUid: string;
  oldValue: any;
  newValue: any;
  difference?: number | null;
  percentageChange?: number | null;
  observation?: string;
  metadataExtra?: any;
}

export interface AdminLogEvent {
  id: string;
  employeeId: string;
  date: string;
  timestamp: any;
  adminName: string;
  adminUid: string;
  action: string;
  oldValue: any;
  newValue: any;
}

export interface EmployeeFile {
  id: string;
  employeeId: string;
  name: string;
  size: number;
  type: string;
  category: string;
  date: string;
  timestamp: any;
  uploadedByName: string;
  uploadedByUid: string;
  downloadUrl: string;
  storagePath?: string;
}

export interface CustomPaystubField {
  id: string;
  type: 'ingreso' | 'deduccion';
  name: string;
  amount: number;
  isAutomatic?: boolean;
  automaticAdjustmentId?: string;
}

export interface PayStub {
  id: string;
  creatorId: string;
  createdByRole: 'admin' | 'empleado' | 'supervisor';
  employeeId: string;
  employeeEmail: string;
  month: number;
  year: number;
  fortnight: Fortnight;
  baseSalary: number;
  ccss: number;
  extraHours?: number;
  ordinaryHours?: number;
  extraHoursCount?: number;
  holidays?: number;
  holidayHoursCount?: number;
  advancePayment?: number;
  legalEmbargos?: number;
  absenceDeductions: number;
  bonuses?: number;
  travelExpenses?: number;
  availabilityBonus?: number;
  customFields?: CustomPaystubField[];
  netPay: number;
  generatedDate: any; // Modified to accept Timestamp
  planillaId?: string;
  periodo?: string;
  createdAt?: any;
  updatedAt?: any;
  // Fase 3: Endurecimiento Empresarial
  isDeleted?: boolean;
  deletedAt?: any;
  deletedBy?: string;
  deletedByUid?: string;
  deleteReason?: string;
}

export interface FinanceData {
  employees: Employee[];
  absenceRecords: AbsenceRecord[];
  payStubs: PayStub[];
  automaticAdjustments?: AutomaticAdjustment[];
}

export type CreatePayStubInput = {
  creatorId: string;
  createdByRole: 'admin' | 'empleado' | 'supervisor';
  employeeId: string;
  employeeEmail: string;
  year: number;
  month: number;
  fortnight: Fortnight;
  extraHours?: number;
  ordinaryHours?: number;
  extraHoursCount?: number;
  holidays?: number;
  holidayHoursCount?: number;
  bonuses?: number;
  advancePayment?: number;
  legalEmbargos?: number;
  travelExpenses?: number;
  availabilityBonus?: number;
  customFields?: CustomPaystubField[];
};

export type PayStubData = Omit<PayStub, 'id'>;