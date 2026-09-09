import { db } from '@/firebase';
import {
  collection,
  doc,
  runTransaction,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import {
  ToolAssignment,
  CreateAssignmentDTO,
  ReturnAssignmentDTO,
  IncidentReportDTO,
  ToolAssignmentHistoryEntry
} from '@/types/toolAssignment.types';
import { User } from '@/utils/types';
import { guardedWrite } from '@/core/writeGuard';
import { localDocStore } from '@/core/offline/localDocStore';

export const toolAssignmentService = {
  /**
   * Suscribe en tiempo real a todas las asignaciones de herramientas
   */
  subscribeToAssignments(
    onData: (assignments: ToolAssignment[]) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'tool_assignments'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      async (snapshot) => {
        try {
          const list: ToolAssignment[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              ...data,
              id: docSnap.id,
              quantity: Number(data.quantity || 1),
              history: Array.isArray(data.history) ? data.history : []
            } as ToolAssignment;
          });

          // Cache local para disponibilidad offline
          try {
            for (const item of list) {
              await localDocStore.saveLocalDoc('tool_assignments', item.id, item, false);
            }
          } catch (cacheErr) {
            console.warn('[toolAssignmentService] Error actualizando cache local:', cacheErr);
          }

          onData(list);
        } catch (err) {
          console.error('[toolAssignmentService] Error procesando snapshot:', err);
          if (onError) onError(err);
        }
      },
      async (err) => {
        console.warn('[toolAssignmentService] Error en snapshot de Firestore, cargando offline:', err);
        try {
          const localDocs = await localDocStore.getLocalCollection('tool_assignments');
          if (localDocs && localDocs.length > 0) {
            const cachedList = localDocs.map((ld) => ld.data as ToolAssignment);
            onData(cachedList);
            return;
          }
        } catch (localErr) {
          console.error('[toolAssignmentService] Fallo carga local fallback:', localErr);
        }
        if (onError) onError(err);
      }
    );
  },

  /**
   * Crea una nueva asignación de herramienta/equipo descontando el stock del inventario
   */
  async createAssignment(dto: CreateAssignmentDTO, currentUser: User | null): Promise<string> {
    if (!currentUser) throw new Error('Usuario no autenticado');
    if (!dto.itemId) throw new Error('Debe seleccionar un artículo del inventario');
    if (!dto.recipientId || !dto.recipientName) throw new Error('Debe seleccionar un destinatario válido');
    if (dto.quantity <= 0) throw new Error('La cantidad a asignar debe ser mayor a 0');

    const assignmentRef = doc(collection(db, 'tool_assignments'));
    const movementRef = doc(collection(db, 'inventory_movements'));
    const itemRef = doc(db, 'inventory_items', dto.itemId);
    const counterRef = doc(db, 'counters', 'requestNumber');

    const nowIso = new Date().toISOString();

    await guardedWrite(() =>
      runTransaction(db, async (transaction) => {
        // ==========================================
        // 1. TODAS LAS LECTURAS (READS FIRST)
        // ==========================================
        // A. Lectura del contador correlativo global SOL-XXXX
        const counterSnap = await transaction.get(counterRef);

        // B. Lectura del artículo de inventario
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
          throw new Error('El artículo seleccionado no existe en el inventario general.');
        }

        // ==========================================
        // 2. CÁLCULOS Y VALIDACIONES
        // ==========================================
        // Cálculo del consecutivo correlativo único del sistema
        let lastNumber = 0;
        if (counterSnap.exists()) {
          lastNumber = counterSnap.data().lastNumber || 0;
        }
        const newNumber = lastNumber + 1;
        const finalRequestNumber = `SOL-${String(newNumber).padStart(4, '0')}`;

        const itemData = itemDoc.data();
        const currentStock = Number(itemData.stock || 0);

        if (currentStock < dto.quantity) {
          throw new Error(
            `Stock insuficiente para ${itemData.description || 'el artículo'}. Disponible: ${currentStock}, Solicitado: ${dto.quantity}`
          );
        }

        const newStock = currentStock - dto.quantity;
        const itemPrice = Number(itemData.price || 0);
        const itemCurrency = (itemData.currency as 'USD' | 'CRC') || 'USD';
        const subtotal = itemPrice * dto.quantity;

        // Determinación de Proyecto / Referencia
        const hasProject = Boolean(dto.projectId && dto.projectName && dto.projectName.trim() !== '');
        const originLabel = hasProject ? dto.projectName! : 'HERRAMIENTAS Y EQUIPOS ASIGNADOS';
        const referenceLabel = hasProject
          ? (dto.projectNumber ? `[${dto.projectNumber}] ${dto.projectName}` : dto.projectName!)
          : 'HERRAMIENTAS Y EQUIPOS ASIGNADOS';

        const historyEntry: ToolAssignmentHistoryEntry = {
          id: `${Date.now()}_initial`,
          date: nowIso,
          action: 'Asignación',
          performedBy: dto.assignedBy || currentUser.name || currentUser.email || 'Sistema',
          details: `Asignación inicial (${finalRequestNumber}) de ${dto.quantity} ${dto.itemUnit || 'unid'} a ${dto.recipientType === 'colaborador' ? 'Colaborador: ' : 'Unidad: '}${dto.recipientName}. Condición inicial: ${dto.initialCondition}. ${dto.observations ? `Notas: ${dto.observations}` : ''}`,
          newStatus: 'Asignado'
        };

        // ==========================================
        // 3. TODAS LAS ESCRITURAS (WRITES)
        // ==========================================
        // A. Actualizar contador correlativo global
        transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });

        // B. Descontar stock en inventario
        transaction.update(itemRef, {
          stock: newStock,
          updatedAt: nowIso,
          updatedBy: currentUser.email || currentUser.name || 'Sistema'
        });

        // C. Registrar movimiento en historial de inventario (inventory_movements)
        transaction.set(movementRef, {
          type: 'Salida',
          subtype: 'Asignación de Herramienta',
          originType: 'herramientas_asignadas',
          isAssignment: true,
          requestNumber: finalRequestNumber,
          date: dto.assignedDate || nowIso.split('T')[0],
          origin: originLabel,
          reference: referenceLabel,
          projectId: hasProject ? dto.projectId : '',
          projectNumber: hasProject ? (dto.projectNumber || '') : '',
          projectName: hasProject ? dto.projectName : '',
          destination: dto.recipientName,
          recipientName: dto.recipientName,
          recipientType: dto.recipientType,
          initialCondition: dto.initialCondition || 'Bueno',
          reason: dto.observations 
            ? `Asignación a ${dto.recipientName} (${dto.recipientType === 'colaborador' ? 'Colaborador' : 'Unidad Vehicular'}): ${dto.observations}` 
            : `Asignación de herramienta a ${dto.recipientName} (${dto.recipientType === 'colaborador' ? 'Colaborador' : 'Unidad Vehicular'})`,
          observations: dto.observations || '',
          userId: currentUser.uid || '',
          userName: dto.assignedBy || currentUser.name || currentUser.email || 'Sistema',
          createdBy: currentUser.email || currentUser.name || 'Sistema',
          createdAt: nowIso,
          // Campos planos para compatibilidad con vistas legacy
          inventoryItemId: dto.itemId,
          inventoryItemCode: dto.itemCode || itemData.code || '',
          inventoryItemName: dto.itemDescription || itemData.description || '',
          quantity: dto.quantity,
          unitPrice: itemPrice,
          subtotal: subtotal,
          currency: itemCurrency,
          previousStock: currentStock,
          newStock: newStock,
          // Estructura de items detallada
          items: [
            {
              inventoryItemId: dto.itemId,
              inventoryItemCode: dto.itemCode || itemData.code || '',
              inventoryItemName: dto.itemDescription || itemData.description || '',
              quantity: dto.quantity,
              previousStock: currentStock,
              newStock: newStock,
              unitPrice: itemPrice,
              subtotal: subtotal,
              total: subtotal,
              currency: itemCurrency
            }
          ]
        });

        // D. Crear documento de asignación
        const assignmentData: ToolAssignment = {
          id: assignmentRef.id,
          requestNumber: finalRequestNumber,
          movementId: movementRef.id,
          itemId: dto.itemId,
          itemCode: dto.itemCode || itemData.code || '',
          itemDescription: dto.itemDescription || itemData.description || '',
          itemCategory: dto.itemCategory || itemData.category || 'Herramientas',
          itemUnit: dto.itemUnit || itemData.unit || 'unid',
          quantity: dto.quantity,
          recipientType: dto.recipientType,
          recipientId: dto.recipientId,
          recipientName: dto.recipientName,
          recipientDetail: dto.recipientDetail || '',
          assignedDate: dto.assignedDate || nowIso.split('T')[0],
          status: 'Asignado',
          initialCondition: dto.initialCondition || 'Bueno',
          projectId: hasProject ? (dto.projectId || '') : '',
          projectNumber: hasProject ? (dto.projectNumber || '') : '',
          projectName: hasProject ? (dto.projectName || '') : '',
          jobId: dto.jobId || '',
          otCode: dto.otCode || '',
          observations: dto.observations || '',
          assignedBy: dto.assignedBy || currentUser.name || currentUser.email || 'Sistema',
          assignedByUserId: currentUser.uid,
          history: [historyEntry],
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: currentUser.email || currentUser.name || 'Sistema',
          updatedBy: currentUser.email || currentUser.name || 'Sistema'
        };

        transaction.set(assignmentRef, assignmentData);
      })
    );

    return assignmentRef.id;
  },

  /**
   * Registra la devolución de una herramienta/equipo e incrementa el stock en el inventario
   */
  async returnAssignment(dto: ReturnAssignmentDTO, currentUser: User | null): Promise<void> {
    if (!currentUser) throw new Error('Usuario no autenticado');
    if (!dto.assignmentId) throw new Error('ID de asignación no válido');

    const assignmentRef = doc(db, 'tool_assignments', dto.assignmentId);
    const movementRef = doc(collection(db, 'inventory_movements'));
    const nowIso = new Date().toISOString();

    await guardedWrite(() =>
      runTransaction(db, async (transaction) => {
        // 1. Leer asignación
        const assignmentDoc = await transaction.get(assignmentRef);
        if (!assignmentDoc.exists()) {
          throw new Error('La asignación no existe.');
        }

        const assignmentData = assignmentDoc.data() as ToolAssignment;
        if (assignmentData.status === 'Devuelto') {
          throw new Error('Esta asignación ya ha sido devuelta previamente.');
        }

        const qtyToReturn = Number(dto.returnQuantity || assignmentData.quantity);
        if (qtyToReturn <= 0) {
          throw new Error('La cantidad a devolver debe ser mayor a 0');
        }

        // 2. Leer artículo de inventario
        const itemRef = doc(db, 'inventory_items', assignmentData.itemId);
        const itemDoc = await transaction.get(itemRef);

        let currentStock = 0;
        let newStock = qtyToReturn;
        let itemPrice = 0;
        let itemCurrency: 'USD' | 'CRC' = 'USD';

        if (itemDoc.exists()) {
          const itemData = itemDoc.data();
          currentStock = Number(itemData.stock || 0);
          newStock = currentStock + qtyToReturn;
          itemPrice = Number(itemData.price || 0);
          itemCurrency = (itemData.currency as 'USD' | 'CRC') || 'USD';

          // 3. Incrementar stock en inventario
          transaction.update(itemRef, {
            stock: newStock,
            updatedAt: nowIso,
            updatedBy: currentUser.email || currentUser.name || 'Sistema'
          });
        }

        const hasProject = Boolean(assignmentData.projectId && assignmentData.projectName && assignmentData.projectName.trim() !== '');

        // 4. Registrar movimiento de devolución en inventario
        transaction.set(movementRef, {
          type: 'Entrada',
          subtype: 'Devolución de Herramienta',
          originType: 'herramientas_asignadas',
          isAssignment: true,
          requestNumber: assignmentData.requestNumber || '',
          date: dto.returnDate || nowIso.split('T')[0],
          reason: `Devolución de herramienta de ${assignmentData.recipientName}. Condición: ${dto.returnCondition}. ${dto.returnObservations ? `Observaciones: ${dto.returnObservations}` : ''}`,
          origin: assignmentData.recipientName,
          destination: 'Bodega Principal',
          reference: hasProject 
            ? (assignmentData.projectNumber ? `[${assignmentData.projectNumber}] ${assignmentData.projectName}` : assignmentData.projectName!)
            : 'HERRAMIENTAS Y EQUIPOS ASIGNADOS',
          projectId: hasProject ? assignmentData.projectId : '',
          projectNumber: hasProject ? (assignmentData.projectNumber || '') : '',
          projectName: hasProject ? assignmentData.projectName : '',
          recipientName: assignmentData.recipientName,
          recipientType: assignmentData.recipientType,
          observations: dto.returnObservations || '',
          userId: currentUser.uid || '',
          userName: dto.returnHandledBy || currentUser.name || currentUser.email || 'Sistema',
          createdBy: currentUser.email || currentUser.name || 'Sistema',
          createdAt: nowIso,
          inventoryItemId: assignmentData.itemId,
          inventoryItemCode: assignmentData.itemCode || '',
          inventoryItemName: assignmentData.itemDescription || '',
          quantity: qtyToReturn,
          previousStock: currentStock,
          newStock: newStock,
          unitPrice: itemPrice,
          subtotal: 0,
          currency: itemCurrency,
          items: [
            {
              inventoryItemId: assignmentData.itemId,
              inventoryItemCode: assignmentData.itemCode || '',
              inventoryItemName: assignmentData.itemDescription || '',
              quantity: qtyToReturn,
              previousStock: currentStock,
              newStock: newStock,
              unitPrice: itemPrice,
              subtotal: 0,
              total: 0,
              currency: itemCurrency
            }
          ]
        });

        // 5. Actualizar estado e historial de la asignación
        const history: ToolAssignmentHistoryEntry[] = Array.isArray(assignmentData.history)
          ? [...assignmentData.history]
          : [];

        const returnHistoryEntry: ToolAssignmentHistoryEntry = {
          id: `${Date.now()}_return`,
          date: nowIso,
          action: 'Devolución',
          performedBy: dto.returnHandledBy || currentUser.name || currentUser.email || 'Sistema',
          details: `Devolución registrada de ${qtyToReturn} ${assignmentData.itemUnit || 'unid'}. Condición recibida: ${dto.returnCondition}. ${dto.returnObservations ? `Notas: ${dto.returnObservations}` : ''}`,
          previousStatus: assignmentData.status,
          newStatus: 'Devuelto'
        };

        history.push(returnHistoryEntry);

        transaction.update(assignmentRef, {
          status: 'Devuelto',
          returnDate: dto.returnDate || nowIso.split('T')[0],
          returnCondition: dto.returnCondition,
          returnObservations: dto.returnObservations || '',
          returnQuantity: qtyToReturn,
          returnHandledBy: dto.returnHandledBy || currentUser.name || currentUser.email || 'Sistema',
          history: history,
          updatedAt: nowIso,
          updatedBy: currentUser.email || currentUser.name || 'Sistema'
        });
      })
    );
  },

  /**
   * Registra una incidencia / reporte sobre una herramienta asignada
   */
  async reportIncident(dto: IncidentReportDTO, currentUser: User | null): Promise<void> {
    if (!currentUser) throw new Error('Usuario no autenticado');
    if (!dto.assignmentId) throw new Error('ID de asignación no válido');

    const assignmentRef = doc(db, 'tool_assignments', dto.assignmentId);
    const nowIso = new Date().toISOString();

    await guardedWrite(() =>
      runTransaction(db, async (transaction) => {
        const assignmentDoc = await transaction.get(assignmentRef);
        if (!assignmentDoc.exists()) {
          throw new Error('La asignación no existe.');
        }

        const assignmentData = assignmentDoc.data() as ToolAssignment;
        const history: ToolAssignmentHistoryEntry[] = Array.isArray(assignmentData.history)
          ? [...assignmentData.history]
          : [];

        const incidentEntry: ToolAssignmentHistoryEntry = {
          id: `${Date.now()}_incident`,
          date: nowIso,
          action: 'Incidencia',
          performedBy: dto.reportedBy || currentUser.name || currentUser.email || 'Sistema',
          details: `Incidencia reportada (Severidad: ${dto.severity}): ${dto.description}`,
          previousStatus: assignmentData.status,
          newStatus: 'Con incidencia'
        };

        history.push(incidentEntry);

        transaction.update(assignmentRef, {
          status: 'Con incidencia',
          incidentReport: {
            date: dto.date || nowIso.split('T')[0],
            reportedBy: dto.reportedBy || currentUser.name || currentUser.email || 'Sistema',
            description: dto.description,
            severity: dto.severity,
            status: 'Abierta'
          },
          history: history,
          updatedAt: nowIso,
          updatedBy: currentUser.email || currentUser.name || 'Sistema'
        });
      })
    );
  },

  /**
   * Resuelve una incidencia reportada
   */
  async resolveIncident(
    assignmentId: string,
    resolutionNotes: string,
    currentUser: User | null
  ): Promise<void> {
    if (!currentUser) throw new Error('Usuario no autenticado');
    if (!assignmentId) throw new Error('ID de asignación no válido');

    const assignmentRef = doc(db, 'tool_assignments', assignmentId);
    const nowIso = new Date().toISOString();

    await guardedWrite(() =>
      runTransaction(db, async (transaction) => {
        const assignmentDoc = await transaction.get(assignmentRef);
        if (!assignmentDoc.exists()) {
          throw new Error('La asignación no existe.');
        }

        const assignmentData = assignmentDoc.data() as ToolAssignment;
        const history: ToolAssignmentHistoryEntry[] = Array.isArray(assignmentData.history)
          ? [...assignmentData.history]
          : [];

        const newStatus = assignmentData.returnDate ? 'Devuelto' : 'Asignado';

        const resolveEntry: ToolAssignmentHistoryEntry = {
          id: `${Date.now()}_resolved`,
          date: nowIso,
          action: 'Resolución',
          performedBy: currentUser.name || currentUser.email || 'Sistema',
          details: `Incidencia resuelta. Notas de resolución: ${resolutionNotes || 'Sin notas adicionales'}.`,
          previousStatus: assignmentData.status,
          newStatus: newStatus
        };

        history.push(resolveEntry);

        const currentIncident = assignmentData.incidentReport || {
          date: nowIso.split('T')[0],
          reportedBy: 'Sistema',
          description: '',
          severity: 'Media' as const,
          status: 'Abierta' as const
        };

        transaction.update(assignmentRef, {
          status: newStatus,
          incidentReport: {
            ...currentIncident,
            status: 'Resuelta',
            resolvedAt: nowIso,
            resolvedBy: currentUser.name || currentUser.email || 'Sistema',
            resolutionNotes: resolutionNotes || ''
          },
          history: history,
          updatedAt: nowIso,
          updatedBy: currentUser.email || currentUser.name || 'Sistema'
        });
      })
    );
  },

  /**
   * Elimina una asignación (solo Admin) y revierte el stock si no estaba devuelta
   */
  async deleteAssignment(assignmentId: string, currentUser: User | null): Promise<void> {
    if (!currentUser) throw new Error('Usuario no autenticado');
    const assignmentRef = doc(db, 'tool_assignments', assignmentId);

    await guardedWrite(() =>
      runTransaction(db, async (transaction) => {
        const assignmentDoc = await transaction.get(assignmentRef);
        if (!assignmentDoc.exists()) {
          return;
        }

        const data = assignmentDoc.data() as ToolAssignment;

        // Si la herramienta no fue devuelta, devolver stock al inventario
        if (data.status !== 'Devuelto' && data.itemId) {
          const itemRef = doc(db, 'inventory_items', data.itemId);
          const itemDoc = await transaction.get(itemRef);
          if (itemDoc.exists()) {
            const currentStock = Number(itemDoc.data().stock || 0);
            transaction.update(itemRef, {
              stock: currentStock + Number(data.quantity || 1),
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.email || 'Sistema'
            });
          }
        }

        transaction.delete(assignmentRef);
      })
    );
  }
};
