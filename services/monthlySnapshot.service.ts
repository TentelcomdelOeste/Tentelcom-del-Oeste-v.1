import { db } from '../firebase';
import { 
  collection, 
  doc, 
  runTransaction, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import { guardedWrite } from '../core/writeGuard';
import { MonthlyClosing } from '../cashflowTypes';

// COLECCIÓN ESTÁNDAR PARA AUDITORÍA FINANCIERA
const COLLECTION_CLOSURES = 'financial_month_snapshots';
const COLLECTION_MOVEMENTS = 'cashflow_entries';

export const MonthlySnapshotService = {
  createMonthlySnapshot: async (year: number, month: number, userId: string): Promise<MonthlyClosing> => {
    if (!year || !month || !userId) {
      throw new Error("SNAPSHOT_ERROR: Parámetros inválidos.");
    }

    const docId = `${year}-${month}`;
    const closureRef = doc(db, COLLECTION_CLOSURES, docId);

    // Definir rango de fechas (YYYY-MM-DD)
    const startStr = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    try {
      // 1. Lectura de movimientos (Query externa a transacción para Client SDK)
      const q = query(
        collection(db, COLLECTION_MOVEMENTS),
        where('date', '>=', startStr),
        where('date', '<=', endStr)
      );
      const querySnapshot = await getDocs(q);

      // Acumuladores separados por moneda
      let incomeCRC = 0;
      let expensesCRC = 0;
      let incomeUSD = 0;
      let expensesUSD = 0;
      let count = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const amount = Number(data.amount) || 0;
        
        if (data.currency === 'USD') {
            if (data.type === 'Ingreso') {
                incomeUSD += amount;
            } else {
                expensesUSD += amount;
            }
        } else {
            // Asumimos CRC por defecto
            if (data.type === 'Ingreso') {
                incomeCRC += amount;
            } else {
                expensesCRC += amount;
            }
        }
        
        count++;
      });

      // 2. Transacción de Cierre (Atomicidad y Verificación)
      // PROTECCIÓN DE ESCRITURA
      return await guardedWrite(() => runTransaction(db, async (transaction) => {
        // Verificación de existencia (Idempotencia)
        const closureDoc = await transaction.get(closureRef);
        if (closureDoc.exists()) {
          throw new Error("MONTH_ALREADY_CLOSED");
        }

        const newClosure: MonthlyClosing = {
          id: docId,
          year,
          month,
          status: "Cerrado",
          
          // Totales CRC
          totalIncome: incomeCRC,
          totalExpenses: expensesCRC,
          netResult: incomeCRC - expensesCRC,
          
          // Totales USD
          totalIncomeUSD: incomeUSD,
          totalExpensesUSD: expensesUSD,
          netResultUSD: incomeUSD - expensesUSD,

          movementCount: count,
          closedAt: new Date().toISOString(), // ISO string para compatibilidad UI
          closedBy: userId,
          currency: "CRC", // Moneda base del registro
          // createdAt: serverTimestamp() // Removed from return object to avoid type issues with Firestore FieldValue in UI
        };

        transaction.set(closureRef, {
            ...newClosure,
            createdAt: serverTimestamp()
        });

        return newClosure;
      }));

      console.info("FINANCIAL_MONTH_CLOSED", { year, month });

    } catch (error: any) {
      console.error("SNAPSHOT_FAILED", error);
      // Propagar error para manejo en UI
      throw error;
    }
  }
};
