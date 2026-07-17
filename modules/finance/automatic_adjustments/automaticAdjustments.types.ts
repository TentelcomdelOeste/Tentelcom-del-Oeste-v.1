export interface AutomaticAdjustment {
    id: string;
    employeeId: string;
    employeeName: string;
    type: 'ingreso' | 'deduccion';
    conceptName: string;
    comment?: string;
    totalAmount: number;
    fortnightlyQuota: number;
    pendingBalance: number;
    startDate: string; // ISO format date YYYY-MM-DD
    endDate?: string;
    status: 'activo' | 'pausado' | 'finalizado';
    createdAt?: number;
    updatedAt?: number;
    creatorId?: string;
}
