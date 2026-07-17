import { useState, useEffect, useCallback } from 'react';
import { MonthlyClosing, CashflowEntry } from '../cashflowTypes';
import { User } from '../utils/types';
import { readClient } from '../data/readClient';
import { writeClient } from '../data/writeClient';

export const useMonthlyClosing = (currentUser: User | null) => {
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Migración a ReadClient: Suscripción centralizada
    const unsubscribe = readClient.monthlyClosings.subscribe(
      (data) => {
        setClosings(data as MonthlyClosing[]);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching monthly closings:", err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  /**
   * Ejecuta el cierre de un mes específico.
   * Calcula los totales basados en las entradas proporcionadas para ese mes.
   */
  const closeMonth = useCallback(async (year: number, month: number, entries: CashflowEntry[]) => {
    if (!currentUser) throw new Error("No autenticado");

    const docId = `${year}-${month}`; // ID Determinista

    // 1. Filtrar movimientos del mes seleccionado
    const monthEntries = entries.filter(e => {
      // Ajuste de zona horaria simple: extraer componentes de la cadena YYYY-MM-DD
      const [eYear, eMonth] = e.date.split('-').map(Number);
      return eYear === year && eMonth === month;
    });

    // 2. Calcular Totales (Separados por moneda)
    const totals = monthEntries.reduce((acc, curr) => {
        const amount = curr.amount;
        
        if (curr.currency === 'USD') {
            if (curr.type === 'Ingreso') {
                acc.incomeUSD += amount;
            } else {
                acc.expensesUSD += amount;
            }
        } else {
            if (curr.type === 'Ingreso') {
                acc.incomeCRC += amount;
            } else {
                acc.expensesCRC += amount;
            }
        }
        return acc;
    }, { incomeCRC: 0, expensesCRC: 0, incomeUSD: 0, expensesUSD: 0 });

    const closingData: MonthlyClosing = {
        id: docId,
        year,
        month,
        // CRC
        totalIncome: totals.incomeCRC,
        totalExpenses: totals.expensesCRC,
        netResult: totals.incomeCRC - totals.expensesCRC,
        // USD
        totalIncomeUSD: totals.incomeUSD,
        totalExpensesUSD: totals.expensesUSD,
        netResultUSD: totals.incomeUSD - totals.expensesUSD,

        status: 'Cerrado',
        closedAt: new Date().toISOString(),
        closedBy: currentUser.email,
        currency: 'CRC'
    };

    // Migración a WriteClient: Operación de cierre centralizada
    await writeClient.monthlyClosings.close(docId, closingData);
  }, [currentUser]);

  /**
   * Verifica si una fecha específica corresponde a un mes cerrado.
   */
  const isDateClosed = useCallback((dateStr: string): boolean => {
    if (!dateStr) return false;
    const [year, month] = dateStr.split('-').map(Number);
    const docId = `${year}-${month}`;
    return closings.some(c => c.id === docId && c.status === 'Cerrado');
  }, [closings]);

  return {
    closings,
    isLoading,
    closeMonth,
    isDateClosed
  };
};
