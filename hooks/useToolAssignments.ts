import { useState, useEffect, useMemo, useCallback } from 'react';
import { toolAssignmentService } from '@/services/toolAssignmentService';
import {
  ToolAssignment,
  CreateAssignmentDTO,
  ReturnAssignmentDTO,
  IncidentReportDTO
} from '@/types/toolAssignment.types';
import { User } from '@/utils/types';
import { useUserContext } from '@/contexts/UserContext';
import { hasPermission, isAdmin } from '@/utils/permissions';

export const useToolAssignments = (currentUser: User | null) => {
  const { authReady } = useUserContext();
  const [assignments, setAssignments] = useState<ToolAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canAccess =
      authReady &&
      currentUser?.uid &&
      (isAdmin(currentUser.role) ||
        hasPermission(currentUser, 'inventario', 'herramientas_asignadas') ||
        hasPermission(currentUser, 'inventario', 'general') ||
        hasPermission(currentUser, 'inventario', 'movimientos') ||
        hasPermission(currentUser, 'trabajos'));

    if (!canAccess) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = toolAssignmentService.subscribeToAssignments(
      (data) => {
        setAssignments(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useToolAssignments] Error en suscripción:', err);
        setError('Error al cargar las asignaciones de herramientas.');
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authReady, currentUser]);

  // Cálculos de KPIs y métricas en tiempo real
  const kpis = useMemo(() => {
    let totalAssignedUnits = 0;
    let toEmployeesUnits = 0;
    let toVehiclesUnits = 0;
    let pendingReturnCount = 0;
    let activeIncidentsCount = 0;

    assignments.forEach((a) => {
      const isReturned = a.status === 'Devuelto';
      const hasActiveIncident =
        a.status === 'Con incidencia' ||
        (a.incidentReport && a.incidentReport.status === 'Abierta');

      if (!isReturned) {
        const qty = Number(a.quantity || 1);
        totalAssignedUnits += qty;
        if (a.recipientType === 'colaborador') {
          toEmployeesUnits += qty;
        } else if (a.recipientType === 'unidad') {
          toVehiclesUnits += qty;
        }
        pendingReturnCount += 1;
      }

      if (hasActiveIncident) {
        activeIncidentsCount += 1;
      }
    });

    return {
      totalAssignedUnits,
      toEmployeesUnits,
      toVehiclesUnits,
      pendingReturnCount,
      activeIncidentsCount,
      totalHistoricCount: assignments.length
    };
  }, [assignments]);

  const addAssignment = useCallback(
    async (dto: CreateAssignmentDTO) => {
      setError(null);
      return await toolAssignmentService.createAssignment(dto, currentUser);
    },
    [currentUser]
  );

  const returnAssignment = useCallback(
    async (dto: ReturnAssignmentDTO) => {
      setError(null);
      return await toolAssignmentService.returnAssignment(dto, currentUser);
    },
    [currentUser]
  );

  const reportIncident = useCallback(
    async (dto: IncidentReportDTO) => {
      setError(null);
      return await toolAssignmentService.reportIncident(dto, currentUser);
    },
    [currentUser]
  );

  const resolveIncident = useCallback(
    async (assignmentId: string, notes: string) => {
      setError(null);
      return await toolAssignmentService.resolveIncident(assignmentId, notes, currentUser);
    },
    [currentUser]
  );

  const deleteAssignment = useCallback(
    async (assignmentId: string) => {
      setError(null);
      return await toolAssignmentService.deleteAssignment(assignmentId, currentUser);
    },
    [currentUser]
  );

  return {
    assignments,
    isLoading,
    error,
    kpis,
    addAssignment,
    returnAssignment,
    reportIncident,
    resolveIncident,
    deleteAssignment
  };
};
