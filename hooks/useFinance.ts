import { useState, useEffect, useCallback } from 'react';
import { FinanceData, Employee, AbsenceRecord, CreatePayStubInput, PayStubData } from '../financeTypes';
import { User } from '../utils/types';
import { hasPermission, isAdmin } from '../utils/permissions';
import { financeRepository } from '../repositories/financeRepository';
import { useConfirm } from '../design-system';
import { serverTimestamp } from 'firebase/firestore';
import { logWorkHistoryEvent, logAdminEvent } from '../modules/finance/payroll/services/useEmployeeHistory';
import { clearEmployeesCache } from './useEmployees';

export interface FinanceFilters {
  year?: string;
  month?: string;
  fortnight?: string;
  employeeEmail?: string;
}

export const useFinance = (currentUser: User | null, filters?: FinanceFilters) => {
  const [data, setData] = useState<FinanceData>({ employees: [], absenceRecords: [], payStubs: [], automaticAdjustments: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirm();

  useEffect(() => {
    if (!currentUser?.uid) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    // Función auxiliar para actualizar estado
    const updateState = (updater: (prev: FinanceData) => FinanceData) => {
        setData(prev => updater(prev));
    };
    
    // 1. Suscripción a Empleados (Vía Repositorio)
    const unsubEmployees = financeRepository.subscribeToEmployees(
      (employees) => {
        updateState(prev => ({ ...prev, employees }));
      },
      (err) => {
        console.warn("No se pudo cargar la lista completa de colaboradores:", err.message);
      }
    );

    let unsubAbsences = () => {};
    // PERMISO AUSENCIAS: Admin, Supervisor o Permiso 'ausencias'
    const canViewAllAbsences = isAdmin(currentUser?.role) || 
                               currentUser?.role === 'supervisor' || 
                               hasPermission(currentUser, 'finanzas', 'ausencias');

    if (canViewAllAbsences) {
      // 2. Suscripción a Ausencias (Vía Repositorio)
      unsubAbsences = financeRepository.subscribeToAbsences((absences) => {
        updateState(prev => ({ ...prev, absenceRecords: absences }));
      });
    }

    // 3. Suscripción a Colillas (Vía Repositorio)
    const effectiveFilters = filters || { year: new Date().getFullYear().toString() };
    const unsubStubs = financeRepository.subscribeToPayStubs(
      currentUser?.email || '',
      currentUser?.role || 'user',
      effectiveFilters,
      (stubs) => {
        // Mantener lógica de ordenamiento en el cliente
        stubs.sort((a, b) => {
          if (b.year !== a.year) {
            return b.year - a.year;
          }
          return b.month - a.month;
        });

        updateState(prev => ({ ...prev, payStubs: stubs }));
      },
      (err) => {
        console.error("Error fetching pay stubs:", err.message);
        console.error(err);
        setError("Error al cargar colillas de pago. Verifique la consola.");
      }
    );

    let unsubAdjustments = () => {};
    if (isAdmin(currentUser?.role) || currentUser?.role === 'supervisor' || hasPermission(currentUser, 'finanzas', 'comprobantes')) {
      unsubAdjustments = financeRepository.subscribeToAutomaticAdjustments(
        (adjs) => {
          updateState(prev => ({ ...prev, automaticAdjustments: adjs }));
        },
        (err) => {
          console.warn("No se pudo cargar la lista de ajustes automáticos:", err.message);
        }
      );
    }

    setIsLoading(false);

    return () => {
      unsubEmployees();
      unsubAbsences();
      unsubStubs();
      unsubAdjustments();
    };
  }, [currentUser?.uid, currentUser?.role, currentUser?.email, JSON.stringify(filters)]);

  const addOrUpdateEmployee = useCallback(async (employeeData: Partial<Omit<Employee, 'id'>>, id?: string): Promise<{ success: boolean; message?: string; }> => {
    try {
      const { password, ...firestoreData } = employeeData;

      if (id) {
        // Actualización
        const dataToUpdate = { ...firestoreData };
        if (typeof dataToUpdate.email === 'string') {
          dataToUpdate.email = dataToUpdate.email.trim();
        }
        if (typeof dataToUpdate.username === 'string') {
          dataToUpdate.username = dataToUpdate.username.trim();
        }
        
        const oldData = data.employees.find(e => e.id === id);
        await financeRepository.updateEmployee(id, dataToUpdate);
        clearEmployeesCache();

        if (oldData && currentUser) {
            const adminName = currentUser.name || currentUser.username || currentUser.email || 'Admin';
            const adminUid = currentUser.id;

            // Registro de cambio de email
            if (dataToUpdate.email && oldData.email !== dataToUpdate.email) {
                logAdminEvent(id, {
                    adminName,
                    adminUid,
                    action: 'Actualizó correo electrónico',
                    oldValue: oldData.email || '',
                    newValue: dataToUpdate.email
                }).catch(e => console.error(e));
            }

            // Diferencia salarial
            const newBaseSalary = Number(dataToUpdate.baseSalary);
            const oldBaseSalary = Number(oldData?.baseSalary || 0);

            if (!isNaN(newBaseSalary) && newBaseSalary !== oldBaseSalary) {
                const diff = newBaseSalary - oldBaseSalary;
                const perc = oldBaseSalary > 0 ? (diff / oldBaseSalary) * 100 : 100;
                logWorkHistoryEvent(id, {
                    eventType: diff > 0 ? 'salary_increase' : 'salary_decrease',
                    adminName,
                    adminUid,
                    oldValue: oldBaseSalary,
                    newValue: newBaseSalary,
                    difference: diff,
                    percentageChange: parseFloat(perc.toFixed(2)),
                    observation: `Ajuste salarial de ${diff > 0 ? 'aumento' : 'reducción'}.`
                }).catch(e => console.error(e));
                
                logAdminEvent(id, {
                    adminName,
                    adminUid,
                    action: 'Modificó salario base',
                    oldValue: oldBaseSalary,
                    newValue: newBaseSalary
                }).catch(e => console.error(e));
            }

            // Cambio de Puesto
            if (dataToUpdate.position && dataToUpdate.position !== oldData.position) {
                logWorkHistoryEvent(id, {
                    eventType: 'position_change',
                    adminName,
                    adminUid,
                    oldValue: oldData.position,
                    newValue: dataToUpdate.position,
                    observation: 'Cambio de puesto de trabajo.'
                }).catch(e => console.error(e));
                
                logAdminEvent(id, {
                    adminName,
                    adminUid,
                    action: 'Actualizó cargo',
                    oldValue: oldData.position,
                    newValue: dataToUpdate.position
                }).catch(e => console.error(e));
            }
        }
      } else {
        // Creación
        if (!password || !firestoreData.name) {
          return { success: false, message: "El nombre y la contraseña son obligatorios." };
        }
        
        // Delegar la lógica compleja de creación de Auth al repositorio
        const result = await financeRepository.createEmployeeWithAuth(firestoreData, password);
        if (!result.success) return result;
        clearEmployeesCache();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }, []);

  const adminSetPassword = useCallback(async (userId: string): Promise<{ success: boolean; message: string; }> => {
    try {
      await financeRepository.setForcePasswordChange(userId);
      return { success: true, message: "Marca de cambio de contraseña establecida. El usuario deberá cambiarla en su próximo inicio de sesión." };
    } catch (error: any) {
      console.error("Error setting password flag:", error.message);
      return { success: false, message: "Error al establecer la marca para el cambio de contraseña." };
    }
  }, []);

  const resetEmployeePassword = useCallback(async (email: string): Promise<{ success: boolean; message: string; }> => {
    try {
      await financeRepository.sendPasswordReset(email);
      return { success: true, message: `Se ha enviado un correo para restablecer la contraseña a ${email}.` };
    } catch (error: any) {
      return { success: false, message: "Error al enviar el correo de restablecimiento. Verifique que el correo sea válido." };
    }
  }, []);
  
  const archiveEmployee = useCallback(async (id: string) => {
    if (!currentUser) return;
    
    await financeRepository.updateEmployee(id, {
      isActive: false,
      isArchived: true,
      status: 'archivado',
      archivedAt: new Date().toISOString(),
      archivedBy: currentUser.id,
    });
    clearEmployeesCache();
  }, [currentUser]);

  const reactivateEmployee = useCallback(async (id: string) => {
    await financeRepository.updateEmployee(id, {
      isActive: true,
      isArchived: false,
      status: 'activo',
      archivedAt: null as any, // Cast necesario si el tipo es estricto
      archivedBy: null as any,
    });
    clearEmployeesCache();
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    if (!currentUser || !isAdmin(currentUser.role)) {
        await confirm({
            title: "Acceso Denegado",
            description: "Solo administradores pueden eliminar colaboradores.",
            confirmLabel: "Cerrar",
            variant: "warning"
        });
        return;
    }
    try {
        await financeRepository.deleteEmployee(id);
        clearEmployeesCache();
    } catch (error: any) {
        console.error("Error deleting employee:", error);
        await confirm({
            title: "Error",
            description: "Error al eliminar el colaborador: " + error.message,
            confirmLabel: "Cerrar",
            variant: "warning"
        });
    }
  }, [currentUser, confirm]);

  const addOrUpdateAbsence = useCallback(async (absence: Omit<AbsenceRecord, 'id'>, id?: string) => {
    await financeRepository.saveAbsence(absence, id);
  }, []);

  const deleteAbsence = useCallback(async (id: string) => {
    await financeRepository.deleteAbsence(id);
  }, []);
  
  const addOrUpdatePayStub = useCallback(async (stubData: CreatePayStubInput, id?: string): Promise<{ success: boolean; message?: string; }> => {
    if (!currentUser) {
      return { success: false, message: 'No autenticado.' };
    }
    
    // Permisos: Admin o Usuario con permiso de 'comprobantes'
    const canManageStubs = isAdmin(currentUser.role) || hasPermission(currentUser, 'finanzas', 'comprobantes');

    if (id && !canManageStubs) {
        return { success: false, message: 'Permiso denegado. Solo los administradores pueden editar colillas.' };
    }

    try {
      const isDuplicate = data.payStubs.some(ps => 
        ps.employeeId === stubData.employeeId &&
        ps.year === stubData.year &&
        ps.month === stubData.month &&
        ps.fortnight === stubData.fortnight &&
        ps.id !== id
      );

      if (isDuplicate) {
        return { success: false, message: "PAYSTUB_DUPLICATE" };
      }

      const docId = id || `${stubData.employeeId}_${stubData.year}_${stubData.month}_${stubData.fortnight}`;
      
      let employee = data.employees.find(e => e.id === stubData.employeeId);
      
      if (!employee) {
          // Fallback: Consultar repositorio directamente si no está en caché local
          employee = await financeRepository.getEmployeeById(stubData.employeeId) || undefined;
      }

      if (!employee) throw new Error("Colaborador no encontrado. No se pudo obtener la información salarial.");

      const valHoraOrg = (employee.baseSalary || 0) / 300;
      const valHoraExt = valHoraOrg * 1.5;
      
      const ordinaryHours = stubData.ordinaryHours !== undefined ? stubData.ordinaryHours : 150;
      const extraHoursCount = stubData.extraHoursCount !== undefined ? stubData.extraHoursCount : 0;
      const holidayHoursCount = stubData.holidayHoursCount !== undefined ? stubData.holidayHoursCount : 0;

      const baseSalary = Math.round(valHoraOrg * ordinaryHours * 100) / 100;
      const extraHours = Math.round(valHoraExt * extraHoursCount * 100) / 100;
      const holidays = Math.round(valHoraOrg * holidayHoursCount * 100) / 100;
      
      const ccss = (employee.ccssDeduction || 0) / 2;
      
      const bonuses = stubData.bonuses || 0;
      const travelExpenses = stubData.travelExpenses || 0;
      const availabilityBonus = stubData.availabilityBonus || 0;
      const advancePayment = stubData.advancePayment || 0;
      const legalEmbargos = stubData.legalEmbargos || 0;

      const totalAbsenceDeductions = data.absenceRecords
        .filter(abs => {
          const date = new Date(abs.startDate + 'T00:00:00');
          const absMonth = date.getMonth() + 1;
          const absYear = date.getFullYear();
          const absDay = date.getDate();
          
          const isSameMonthYear = absMonth === stubData.month && absYear === stubData.year;
          if (!isSameMonthYear || abs.employeeId !== stubData.employeeId) return false;
          
          if (stubData.fortnight === 'Primera') {
            return absDay <= 15;
          } else {
            return absDay > 15;
          }
        })
        .reduce((sum, abs) => sum + (abs.deductionAmount || 0), 0);

      const customFields = stubData.customFields || [];
      const customIngresosStr = customFields.filter(f => f.type === 'ingreso').reduce((sum, f) => sum + (parseFloat(f.amount as any) || 0), 0);
      const customDeduccionesStr = customFields.filter(f => f.type === 'deduccion').reduce((sum, f) => sum + (parseFloat(f.amount as any) || 0), 0);

      const totalIngresos = baseSalary + bonuses + extraHours + holidays + travelExpenses + availabilityBonus + customIngresosStr;
      const totalDeducciones = ccss + advancePayment + legalEmbargos + totalAbsenceDeductions + customDeduccionesStr;
      
      // REDONDEO ÚNICO AL FINAL
      const netPay = Math.round((totalIngresos - totalDeducciones) * 100) / 100;
      
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const periodo = `Q${stubData.fortnight === 'Primera' ? '1' : '2'} - ${monthNames[stubData.month - 1]} ${stubData.year}`;

      const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
      const lastDay = getDaysInMonth(stubData.year, stubData.month);
      const day = stubData.fortnight === 'Primera' ? '15' : lastDay.toString().padStart(2, '0');
      const monthStr = stubData.month.toString().padStart(2, '0');
      const planillaId = `PLN-${stubData.year}${monthStr}${day}`;

      const existingStub = id ? data.payStubs.find(ps => ps.id === id) : undefined;
      const prevGeneratedDate = existingStub ? existingStub.generatedDate : undefined;
      const prevCreatedAt = existingStub ? existingStub.createdAt : undefined;

      const payload: PayStubData = {
        ...stubData,
        employeeEmail: employee.email,
        periodo: periodo,
        planillaId: planillaId,
        baseSalary: baseSalary,
        ccss: ccss,
        legalEmbargos: legalEmbargos,
        absenceDeductions: totalAbsenceDeductions,
        bonuses: bonuses,
        travelExpenses: travelExpenses,
        availabilityBonus: availabilityBonus,
        advancePayment: advancePayment,
        extraHours: extraHours,
        holidays: holidays,
        customFields: customFields,
        netPay: netPay,
        generatedDate: prevGeneratedDate || serverTimestamp(),
        createdAt: prevCreatedAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Guardar vía repositorio
      await financeRepository.savePayStub(docId, payload);
      
      // RESTAR SALDOS DE AJUSTES AUTOMÁTICOS (SOLO EN NUEVAS COLILLAS)
      if (!id) {
          const automaticFields = customFields.filter(f => f.isAutomatic && f.automaticAdjustmentId);
          for (const field of automaticFields) {
              const adj = data.automaticAdjustments?.find(a => a.id === field.automaticAdjustmentId);
              if (adj) {
                  const amountApplied = parseFloat(field.amount as any);
                  const newBalance = adj.pendingBalance - amountApplied;
                  const newStatus = newBalance <= 0 ? 'finalizado' : adj.status;
                  
                  await financeRepository.updateAutomaticAdjustment(adj.id, {
                      pendingBalance: newBalance,
                      status: newStatus
                  });
              } else {
                  console.warn(`[AJUSTE] No se encontró el ajuste automático con ID ${field.automaticAdjustmentId}`);
              }
          }
      }

      return { success: true };
    } catch (err: any) {
      console.error("Error in addOrUpdatePayStub:", err.message || String(err));
      return { success: false, message: err.message };
    }
  }, [currentUser, data.payStubs, data.employees, data.absenceRecords, data.automaticAdjustments]);

  const deletePayStub = useCallback(async (id: string, reason: string = 'Eliminación administrativa') => {
    if (!currentUser) {
      await confirm({ title: "Error", description: "Error de autenticación.", confirmLabel: "Cerrar", variant: "warning" });
      return;
    }

    if (!isAdmin(currentUser.role)) {
      await confirm({ title: "Permiso Denegado", description: "Solo los administradores pueden eliminar colillas.", confirmLabel: "Cerrar", variant: "warning" });
      return;
    }

    try {
      const stubData = await financeRepository.getPayStubById(id);
      
      const auditInfo = {
        deletedBy: currentUser.name || currentUser.email || 'Admin',
        deletedByUid: currentUser.id,
        deleteReason: reason
      };

      await financeRepository.deletePayStub(id, auditInfo);
      
      if (stubData && typeof window !== 'undefined') {
        const { logAdminEvent } = await import('../modules/finance/payroll/services/useEmployeeHistory');
        logAdminEvent(stubData.employeeId, {
          action: 'DELETE_PAYSTUB',
          details: `Eliminación lógica (Soft Delete) de colilla - Período: ${stubData.periodo}, Neto: $${stubData.netPay}. Motivo: ${reason}`,
          performedBy: currentUser.name || currentUser.email || 'Admin',
          performedByEmail: currentUser.email || ''
        });
      }
    } catch (error: any) {
      console.error("Error deleting pay stub:", error);
      await confirm({ title: "Error", description: "Error al eliminar la colilla.", confirmLabel: "Cerrar", variant: "warning" });
    }
  }, [currentUser, confirm]);

  const saveAutomaticAdjustment = useCallback(async (adjData: any, id?: string): Promise<{ success: boolean; message?: string; }> => {
    try {
      if (id) {
        await financeRepository.updateAutomaticAdjustment(id, adjData);
        return { success: true, message: "Ajuste actualizado correctamente." };
      } else {
        await financeRepository.createAutomaticAdjustment(adjData);
        return { success: true, message: "Ajuste creado correctamente." };
      }
    } catch (error: any) {
      console.error("Error saving automatic adjustment:", error);
      return { success: false, message: error.message || "Error al guardar el ajuste automático." };
    }
  }, []);

  const removeAutomaticAdjustment = useCallback(async (id: string): Promise<void> => {
    try {
      await financeRepository.deleteAutomaticAdjustment(id);
    } catch (error: any) {
      console.error("Error deleting automatic adjustment:", error);
    }
  }, []);

  return {
    ...data,
    isLoading,
    error,
    addOrUpdateEmployee,
    archiveEmployee,
    reactivateEmployee,
    deleteEmployee,
    resetEmployeePassword,
    adminSetPassword,
    addOrUpdateAbsence,
    deleteAbsence,
    addOrUpdatePayStub,
    deletePayStub,
    saveAutomaticAdjustment,
    removeAutomaticAdjustment,
  };
};
