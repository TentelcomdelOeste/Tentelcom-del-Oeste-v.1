import { db } from '../../../../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { PayrollStatus, PayrollMasterRecord } from '../../../../financeTypes';

/**
 * REGLAS DE TRANSICIÓN (FSM)
 * Evita saltos de estado ilegales.
 */
const VALID_TRANSITIONS: Record<PayrollStatus, PayrollStatus[]> = {
  'GENERATED': ['REVIEWED'],
  'REVIEWED': ['APPROVED'],
  'APPROVED': ['PAID'],
  'PAID': [] // Estado terminal
};

export const PayrollWorkflowService = {
  
  /**
   * Obtiene el estado persistente de una planilla
   */
  getPayrollMaster: async (periodId: string): Promise<PayrollMasterRecord | null> => {
    const docRef = doc(db, 'payroll_master', periodId);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as PayrollMasterRecord) : null;
  },

  /**
   * Ejecuta una transición de estado segura
   */
  transitionTo: async (
    periodId: string, 
    currentStatus: PayrollStatus, 
    nextStatus: PayrollStatus,
    userData: { email: string, totals: any }
  ) => {
    // 1. Validar transición permitida
    if (!VALID_TRANSITIONS[currentStatus].includes(nextStatus)) {
      throw new Error(`Transición ilegal de ${currentStatus} a ${nextStatus}`);
    }

    const docRef = doc(db, 'payroll_master', periodId);
    const masterData = await PayrollWorkflowService.getPayrollMaster(periodId);

    const historyEntry = {
      status: nextStatus,
      timestamp: new Date().toISOString(),
      user: userData.email
    };

    if (!masterData) {
      // Inicializar registro si no existe (Primera transición GENERATED -> REVIEWED)
      const [year, month, fortnight] = periodId.split('-');
      await setDoc(docRef, {
        id: periodId,
        year: parseInt(year),
        month: parseInt(month),
        fortnight,
        status: nextStatus,
        totals: userData.totals,
        updatedAt: new Date().toISOString(),
        updatedBy: userData.email,
        history: [historyEntry]
      });
    } else {
      // Actualizar estado
      await updateDoc(docRef, {
        status: nextStatus,
        totals: userData.totals,
        updatedAt: new Date().toISOString(),
        updatedBy: userData.email,
        history: arrayUnion(historyEntry)
      });
    }
    
    return true;
  }
};