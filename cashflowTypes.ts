
export type MovementType = 'Ingreso' | 'Egreso';
export type ExpenseSubtype = 'Gasto Operativo' | 'Gasto Administrativo' | 'Costo de Proyecto' | 'Otro Egreso';

/**
 * Representa un único movimiento financiero en el sistema.
 */
export interface CashflowEntry {
  id: string;
  date: string; // Fecha en formato YYYY-MM-DD
  type: MovementType;
  subtype: ExpenseSubtype | null; // Solo aplica si type es 'Egreso'
  projectId: string | null; // ID de la cotización asociada, ej: "101-2024"
  amount: number; // Monto del movimiento
  currency: 'USD' | 'CRC'; // Moneda del movimiento
  description: string; // Observación o detalle del movimiento
  invoice?: string; // Factura asociada (Opcional)
  fixedExpenseId?: string; // ID del gasto fijo que generó este movimiento (Opcional)
  createdBy: string; // ID del usuario que creó el registro
  createdAt: string; // Timestamp ISO de la creación
}

/**
 * Representa un gasto fijo recurrente.
 */
export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currency: 'USD' | 'CRC';
  frequency: 'Mensual' | 'Trimestral' | 'Anual';
  day: number; // Día del mes para aplicar el gasto
  subtype: ExpenseSubtype;
  status: 'Activo' | 'Inactivo';
  generationMode?: 'Automático' | 'Manual';
  lastGenerated?: string; // Fecha de la última generación YYYY-MM-DD
  createdAt: string;
  createdBy: string;
}

/**
 * Representa el cierre mensual consolidado.
 */
export interface MonthlyClosing {
  id: string; // Formato "YYYY-MM" para unicidad
  year: number;
  month: number;
  totalIncome: number; // CRC (o total legacy)
  totalExpenses: number; // CRC (o total legacy)
  netResult: number; // CRC (o total legacy)
  
  // Nuevos campos para soporte multi-moneda nativo
  totalIncomeUSD?: number;
  totalExpensesUSD?: number;
  netResultUSD?: number;

  status: 'Cerrado'; // Por ahora solo manejamos el estado persistente de cerrado
  movementCount?: number;
  closedAt: string; // ISO Timestamp
  closedBy: string; // Email o ID del usuario
  currency: 'CRC'; // Moneda base del sistema
}