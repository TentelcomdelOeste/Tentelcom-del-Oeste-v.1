import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { User } from '../utils/types';
import { DataTable, TableColumn, ActionButton, IconButton, StatusBadge, useConfirm } from '../design-system';
import { FiLock, FiUnlock, FiAlertTriangle } from "react-icons/fi";

interface MonthlyClosing {
  id: string; // Format: "YYYY-MM"
  closedAt: string;
  closedBy: string;
  closedByName: string;
}

interface MonthlyClosingViewProps {
  currentUser: User;
}

export const MonthlyClosingView: React.FC<MonthlyClosingViewProps> = ({ currentUser }) => {
  const { authReady } = useAuth();
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const confirm = useConfirm();
  
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  useEffect(() => {
    if (!authReady || !currentUser) return;
    const q = query(collection(db, "monthly_closings"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MonthlyClosing));
      setClosings(list.sort((a, b) => b.id.localeCompare(a.id)));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [authReady, currentUser]);

  const handleCloseMonth = useCallback(async () => {
    const id = `${selectedYear}-${selectedMonth}`;

    if (closings.some(c => c.id === id)) {
      await confirm({
        title: 'Mes ya cerrado',
        description: `El mes ${selectedMonth}/${selectedYear} ya se encuentra en la lista de periodos cerrados.`,
        confirmLabel: 'Entendido',
        variant: 'warning'
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmar Cierre Mensual',
      description: `¿Está seguro de CERRAR el mes ${selectedMonth}/${selectedYear}? Una vez cerrado, no se podrán editar ni eliminar movimientos de ese periodo.`,
      confirmLabel: 'Cerrar Mes',
      variant: 'danger'
    });

    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await setDoc(doc(db, "monthly_closings", id), {
        closedAt: new Date().toISOString(),
        closedBy: currentUser.id,
        closedByName: currentUser.email
      });
      setShowCloseForm(false);
    } catch (error) {
      console.error("Error closing month:", error);
      await confirm({
        title: 'Error',
        description: 'Hubo un problema al intentar cerrar el mes. Por favor intente de nuevo.',
        confirmLabel: 'Cerrar',
        variant: 'danger'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedYear, selectedMonth, closings, currentUser, confirm]);

  const handleOpenMonth = useCallback(async (id: string) => {
    const confirmed = await confirm({
      title: 'Reabrir Periodo',
      description: `¿Está seguro de REABRIR el mes ${id}? Esto permitirá nuevamente la edición de movimientos en este periodo.`,
      confirmLabel: 'Reabrir',
      variant: 'warning'
    });

    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "monthly_closings", id));
    } catch (error) {
      console.error("Error opening month:", error);
      await confirm({
        title: 'Error',
        description: 'Hubo un problema al intentar reabrir el mes.',
        confirmLabel: 'Cerrar',
        variant: 'danger'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [confirm]);

  const columns = useMemo<TableColumn<MonthlyClosing>[]>(() => [
    {
      header: 'Periodo (Año-Mes)',
      accessorKey: 'id',
      className: 'font-black text-blue-900'
    },
    {
      header: 'Fecha de Cierre',
      render: (c) => <span className="text-xs text-slate-500 font-mono">{new Date(c.closedAt).toLocaleString()}</span>
    },
    {
      header: 'Cerrado Por',
      accessorKey: 'closedByName',
      className: 'text-xs text-slate-600'
    },
    {
        header: 'Estado',
        align: 'center',
        render: () => <StatusBadge label="CERRADO" variant="danger" />
    },
    {
      header: 'Acciones',
      align: 'center',
      render: (c) => (
        <IconButton 
            icon={<FiUnlock />} 
            variant="warning" 
            onClick={() => handleOpenMonth(c.id)} 
            title="Reabrir Mes"
            disabled={isProcessing}
        />
      )
    }
  ], [isProcessing, handleOpenMonth]);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-none text-amber-600 shadow-sm">
            <FiAlertTriangle className="text-xl" />
        </div>
        <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Control de Cierre Mensual</h4>
            <p className="text-xs font-bold text-amber-700 mt-1 leading-relaxed">
                El cierre mensual bloquea todos los movimientos financieros (Ingresos/Egresos) del periodo seleccionado. 
                Esta acción garantiza la integridad de los reportes contables y evita modificaciones accidentales en periodos ya auditados.
            </p>
        </div>
      </div>

      {showCloseForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 animate-in slide-in-from-top-4">
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight mb-4">Seleccionar Periodo a Cerrar</h4>
              <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[120px]">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Año</label>
                      <select 
                        value={selectedYear}
                        onChange={e => setSelectedYear(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-200 font-bold text-xs outline-none"
                      >
                          {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mes</label>
                      <select 
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-200 font-bold text-xs outline-none"
                      >
                          {monthNames.map((m, i) => <option key={m} value={(i+1).toString()}>{m}</option>)}
                      </select>
                  </div>
                  <div className="flex gap-2">
                      <ActionButton 
                        onClick={() => setShowCloseForm(false)}
                        label="Cancelar"
                        variant="ghost"
                      />
                      <ActionButton 
                        onClick={handleCloseMonth}
                        isLoading={isProcessing}
                        label="Confirmar Cierre"
                        variant="danger"
                      />
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
                <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Meses Cerrados</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Historial de periodos con bloqueo de edición activo.</p>
            </div>
            {!showCloseForm && (
                <ActionButton 
                    onClick={() => setShowCloseForm(true)} 
                    label="Cerrar Nuevo Mes" 
                    icon={<FiLock />}
                    variant="danger"
                />
            )}
        </div>

        <DataTable 
            data={closings}
            columns={columns}
            keyExtractor={(c) => c.id}
            isLoading={isLoading}
            emptyMessage="No hay meses cerrados registrados."
        />
      </div>
    </div>
    </div>
  );
};
