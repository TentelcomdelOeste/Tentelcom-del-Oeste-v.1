import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { FixedExpense, CashflowEntry } from '../cashflowTypes';
import { User } from '../utils/types';
import { guardedWrite } from '../core/writeGuard';
import { useUserContext } from '../contexts/UserContext';
import { logger } from '../utils/logger';

export const useFixedExpenses = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Cargar gastos fijos
  useEffect(() => {
    if (!authReady || !currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, 'fixed_expenses'), orderBy('day', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FixedExpense[];
      setExpenses(loadedExpenses);
      setIsLoading(false);
    }, (error: any) => {
      if (error.code === 'permission-denied') {
        logger.warn("Acceso restringido a gastos fijos");
        setIsLoading(false);
        return;
      }
      console.error("Error loading fixed expenses:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, authReady]);

  // Agregar gasto fijo
  const addFixedExpense = useCallback(async (expenseData: Omit<FixedExpense, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!currentUser) return;
    try {
      const newExpense = {
        ...expenseData,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id
      };
      
      const newDocRef = doc(collection(db, 'fixed_expenses'));
      const writePromise = guardedWrite(() => setDoc(newDocRef, newExpense));
      await writePromise;
      
      const createdExpense = { ...newExpense, id: newDocRef.id } as FixedExpense;
      setExpenses(prev => [...prev, createdExpense].sort((a, b) => a.day - b.day));
      return createdExpense;
    } catch (error) {
      console.error("Error adding fixed expense:", error);
      throw error;
    }
  }, [currentUser]);

  // Actualizar gasto fijo
  const updateFixedExpense = useCallback(async (id: string, updates: Partial<FixedExpense>) => {
    try {
      const expenseRef = doc(db, 'fixed_expenses', id);
      await guardedWrite(() => updateDoc(expenseRef, updates));
      
      setExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, ...updates } : exp));
    } catch (error) {
      console.error("Error updating fixed expense:", error);
      throw error;
    }
  }, []);

  // Eliminar (o desactivar) gasto fijo
  const deleteFixedExpense = useCallback(async (id: string) => {
    try {
      // Verificar si ya generó movimientos
      const q = query(collection(db, 'cashflow_entries'), where('fixedExpenseId', '==', id));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Si tiene movimientos, solo lo desactivamos (Soft Delete / Inactive)
        await updateFixedExpense(id, { status: 'Inactivo' });
      } else {
        // Si no tiene movimientos, eliminación física
        await guardedWrite(() => deleteDoc(doc(db, 'fixed_expenses', id)));
        setExpenses(prev => prev.filter(exp => exp.id !== id));
      }
    } catch (error) {
      console.error("Error deleting fixed expense:", error);
      throw error;
    }
  }, [updateFixedExpense]);

  // Generar movimientos pendientes para el mes actual
  const generatePendingExpenses = useCallback(async (targetYear: number, targetMonth: number) => {
    if (!currentUser) return;
    setIsGenerating(true);
    let generatedCount = 0;

    try {
      const activeExpenses = expenses.filter(e => e.status === 'Activo');
      
      // Fecha de inicio y fin del mes objetivo
      const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
      const endOfMonth = new Date(targetYear, targetMonth, 0);
      const startStr = startOfMonth.toISOString().split('T')[0];
      const endStr = endOfMonth.toISOString().split('T')[0];

      // Buscar movimientos YA generados en este mes para evitar duplicados
      // Nota: Firestore 'in' query tiene límite de 10, así que mejor traemos todos los del mes
      // y filtramos en memoria por fixedExpenseId
      const q = query(
        collection(db, 'cashflow_entries'), 
        where('date', '>=', startStr), 
        where('date', '<=', endStr),
        where('type', '==', 'Egreso') // Solo egresos
      );
      
      const snapshot = await getDocs(q);
      const existingEntries = snapshot.docs.map(d => d.data() as CashflowEntry);
      const generatedIds = new Set(existingEntries.map(e => e.fixedExpenseId).filter(Boolean));

      for (const expense of activeExpenses) {
        if (expense.generationMode === 'Manual') continue;

        // Verificar frecuencia
        if (expense.frequency === 'Trimestral') {
             // Lógica simple: Enero, Abril, Julio, Octubre (o basado en createdAt?)
             // Por simplicidad MVP: Generar si el mes actual es múltiplo de 3? 
             // O mejor: Si no se ha generado en los últimos 2 meses.
             // Para este alcance, asumiremos Mensual como principal. 
             // Si es trimestral, verificamos si lastGenerated fue hace < 3 meses.
             if (expense.lastGenerated) {
                 const lastDate = new Date(expense.lastGenerated);
                 const diffMonths = (targetYear - lastDate.getFullYear()) * 12 + (targetMonth - 1 - lastDate.getMonth());
                 if (diffMonths < 3) continue;
             }
        } else if (expense.frequency === 'Anual') {
             if (expense.lastGenerated) {
                 const lastDate = new Date(expense.lastGenerated);
                 const diffMonths = (targetYear - lastDate.getFullYear()) * 12 + (targetMonth - 1 - lastDate.getMonth());
                 if (diffMonths < 12) continue;
             }
        }

        // Verificar si ya existe en este mes
        if (generatedIds.has(expense.id)) continue;

        // Construir fecha de aplicación
        // Si el día del gasto es mayor al último día del mes, usar el último día
        const maxDay = endOfMonth.getDate();
        const applyDay = Math.min(expense.day, maxDay);
        const entryDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${applyDay.toString().padStart(2, '0')}`;

        // Crear movimiento
        const newEntry: Omit<CashflowEntry, 'id'> = {
          date: entryDate,
          type: 'Egreso',
          subtype: expense.subtype,
          projectId: null,
          amount: expense.amount,
          currency: expense.currency,
          description: `[Gasto Fijo] ${expense.name}`,
          fixedExpenseId: expense.id,
          createdBy: 'system',
          createdAt: new Date().toISOString()
        };

        await guardedWrite(() => addDoc(collection(db, 'cashflow_entries'), newEntry));
        
        // Actualizar lastGenerated
        await updateFixedExpense(expense.id, { lastGenerated: entryDate });
        
        generatedCount++;
      }

      if (generatedCount > 0) {
        // Log removed
      }

    } catch (error) {
      console.error("Error generating expenses:", error);
      console.error("Error al generar gastos fijos.");
    } finally {
      setIsGenerating(false);
    }
  }, [currentUser, expenses, updateFixedExpense]);

  const generateManualExpense = useCallback(async (expense: FixedExpense) => {
    if (!currentUser) return;
    try {
      const entryDate = new Date().toISOString().split('T')[0];
      const newEntry: Omit<CashflowEntry, 'id'> = {
        date: entryDate,
        type: 'Egreso',
        subtype: expense.subtype,
        projectId: null,
        amount: expense.amount,
        currency: expense.currency,
        description: `[Gasto Fijo Manual] ${expense.name}`,
        fixedExpenseId: expense.id,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString()
      };
      await guardedWrite(() => addDoc(collection(db, 'cashflow_entries'), newEntry));
    } catch (error) {
      console.error("Error generating manual expense:", error);
      console.error("Error al generar movimiento.");
    }
  }, [currentUser]);

  return {
    expenses,
    isLoading,
    isGenerating,
    addFixedExpense,
    updateFixedExpense,
    deleteFixedExpense,
    generatePendingExpenses,
    generateManualExpense
  };
};
