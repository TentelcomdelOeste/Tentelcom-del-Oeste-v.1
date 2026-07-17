
import React, { useState, useMemo } from 'react';
import { InventoryMovement } from '../inventoryMovementTypes';
import { InventoryItem } from '../inventoryTypes';
import { User } from '../utils/types';
import { formatCurrency } from '../utils/formatCurrency';
import { isAdmin } from '../utils/permissions';
import { DataTable, TableColumn, ActionButton, Select } from '../design-system';
import { FiCircle, FiDatabase, FiAlertTriangle, FiSearch, FiFileText, FiTable } from "react-icons/fi";
import { generateProjectConsumptionPDF } from '../utils/pdfGenerator';
import { exportConsumptionToExcel } from '../utils/export/inventoryExport';

interface ProjectConsumptionModuleProps {
  movements: InventoryMovement[];
  inventoryItems: InventoryItem[];
  currentUser: User;
  dispatches?: any[]; // Añadido opcionalmente para dispatch
}

interface MaterialConsumption {
  materialId: string;
  code: string;
  description: string;
  unit: string;
  totalQuantity: number;
  unitPrice: number;
  currency: 'USD' | 'CRC';
  totalCost: number;
}

export const ProjectConsumptionModule: React.FC<ProjectConsumptionModuleProps> = ({ 
  movements, 
  inventoryItems, 
  currentUser,
  dispatches = [] // Default vacío
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // 1. Obtener lista de proyectos únicos con información extendida (SOL, Proyecto, FDH, Torre)
  const availableProjects = useMemo(() => {
    const projects = new Map<string, { label: string, value: string }>();
    
    // Procesar movimientos para extraer opciones únicas
    movements.forEach(m => {
        if (m.type === 'Salida' || m.type === 'Devolución') {
            const val = m.requestNumber || m.projectName || m.id;
            // Construir etiqueta: SOL-XXXX - Proyecto - FDH - Torre
            const label = `${m.requestNumber || "SIN-ID"} - ${m.projectName || "SIN-PROYECTO"} - ${m.fdh || "SIN-FDH"} - ${m.torre || m.tower || "SIN-TORRE"}`;
            if (val) projects.set(val, { label, value: val });
        }
    });

    // También procesar dispatches si existen para asegurar que estén todos los proyectos
    dispatches.forEach(d => {
        const val = d.requestNumber || d.projectName || d.projectId || d.id;
        const label = `${d.requestNumber || "SIN-ID"} - ${d.projectName || "SIN-PROYECTO"} - ${d.fdh || "SIN-FDH"} - ${d.tower || d.torre || "SIN-TORRE"}`;
        if (val) projects.set(val, { label, value: val });
    });

    return Array.from(projects.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [movements, dispatches]);

  // 2. Calcular consumo agrupado por material
  const consumptionData = useMemo(() => {
    if (!selectedProjectId) return [];

    const groupedData = new Map<string, MaterialConsumption>();

    // Determinar si usar dispatch (prioridad) o movements (fallback)
    const projectDispatches = dispatches.filter(d => 
        d.requestNumber === selectedProjectId || 
        d.projectName === selectedProjectId ||
        d.projectId === selectedProjectId ||
        d.id === selectedProjectId
    );
    const hasDispatchData = projectDispatches.length > 0;

    if (hasDispatchData) {
        // Lógica basada en Dispatch
        projectDispatches.forEach(d => {
            if (d.items) {
                d.items.forEach((item: any) => {
                    const itemId = item.inventoryItemId;
                    const delivered = item.quantityDelivered || 0;
                    const returned = item.quantityReturned || 0;
                    const netConsumed = delivered - returned;
                    
                    if (netConsumed === 0) return;

                    const currentItem = inventoryItems.find(i => i.id === itemId);
                    const price = item.unitPrice || currentItem?.price || 0;
                    const currency = item.currency || currentItem?.currency || 'USD';
                    const unit = currentItem?.unit || 'Und';
                    const code = currentItem?.code || '---';
                    const description = currentItem?.description || 'Item eliminado';

                    if (groupedData.has(itemId)) {
                        const existing = groupedData.get(itemId)!;
                        existing.totalQuantity += netConsumed;
                        existing.totalCost += (netConsumed * price);
                    } else {
                        groupedData.set(itemId, {
                            materialId: itemId,
                            code,
                            description,
                            unit,
                            totalQuantity: netConsumed,
                            unitPrice: price,
                            currency,
                            totalCost: (netConsumed * price)
                        });
                    }
                });
            }
        });

        // Sumar devoluciones huerfanas (sin dispatchId) a este proyecto
        const orphanReturns = movements.filter(m => 
          m.type === 'Devolución' && 
          !m.dispatchId && 
          (m.requestNumber === selectedProjectId || 
           m.projectName === selectedProjectId ||
           m.projectId === selectedProjectId ||
           m.id === selectedProjectId)
        );

        orphanReturns.forEach(m => {
            const processItem = (itemId: string, qty: number, type: string, historicalPrice?: number, historicalCurrency?: 'USD' | 'CRC') => {
                const currentItem = inventoryItems.find(i => i.id === itemId);
                const price = historicalPrice !== undefined ? historicalPrice : (currentItem?.price || 0);
                const currency = historicalCurrency || (currentItem?.currency || 'USD');
                const unit = currentItem?.unit || 'Und';
                const code = currentItem?.code || '---';
                const description = currentItem?.description || 'Item eliminado';

                const adjustedQty = -qty; // Es devolución
                const adjustedCost = (-qty * price);

                if (groupedData.has(itemId)) {
                    const existing = groupedData.get(itemId)!;
                    existing.totalQuantity += adjustedQty;
                    existing.totalCost += adjustedCost;
                } else {
                    groupedData.set(itemId, {
                        materialId: itemId,
                        code,
                        description,
                        unit,
                        totalQuantity: adjustedQty,
                        unitPrice: price,
                        currency,
                        totalCost: adjustedCost
                    });
                }
            };

            if (m.items && m.items.length > 0) {
                m.items.forEach((item: any) => {
                    processItem(item.inventoryItemId, Number(item.quantity) || 0, m.type, item.unitPrice, item.currency);
                });
            } else if (m.inventoryItemId) {
                processItem(m.inventoryItemId, Number(m.quantity) || 1, m.type, m.unitPrice, m.currency);
            }
        });

    } else {
        // Lógica actual basada en Movements (Fallback)
        const projectMovements = movements.filter(m => 
          (m.requestNumber === selectedProjectId || 
           m.projectName === selectedProjectId ||
           m.projectId === selectedProjectId ||
           m.id === selectedProjectId) && 
          (m.type === 'Salida' || m.type === 'Devolución')
        );

        projectMovements.forEach(m => {
            const processItem = (itemId: string, qty: number, type: string, historicalPrice?: number, historicalCurrency?: 'USD' | 'CRC') => {
                const currentItem = inventoryItems.find(i => i.id === itemId);
                const price = historicalPrice !== undefined ? historicalPrice : (currentItem?.price || 0);
                const currency = historicalCurrency || (currentItem?.currency || 'USD');
                const unit = currentItem?.unit || 'Und';
                const code = currentItem?.code || '---';
                const description = currentItem?.description || 'Item eliminado';

                const factor = type === 'Devolución' ? -1 : 1;
                const adjustedQty = qty * factor;
                const adjustedCost = (qty * price) * factor;

                if (groupedData.has(itemId)) {
                    const existing = groupedData.get(itemId)!;
                    existing.totalQuantity += adjustedQty;
                    existing.totalCost += adjustedCost;
                } else {
                    groupedData.set(itemId, {
                        materialId: itemId,
                        code,
                        description,
                        unit,
                        totalQuantity: adjustedQty,
                        unitPrice: price,
                        currency,
                        totalCost: adjustedCost
                    });
                }
            };

            if (m.items && m.items.length > 0) {
                m.items.forEach(item => processItem(item.inventoryItemId, item.quantity, m.type, item.unitPrice, item.currency));
            } else {
                processItem(m.inventoryItemId, m.quantity, m.type, m.unitPrice, m.currency);
            }
        });
    }

    return Array.from(groupedData.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [selectedProjectId, movements, inventoryItems, dispatches]);

  // 3. Calcular Totales por Moneda
  const totals = useMemo(() => {
    return consumptionData.reduce((acc, item) => {
        if (item.currency === 'USD') acc.usd += item.totalCost;
        else acc.crc += item.totalCost;
        return acc;
    }, { usd: 0, crc: 0 });
  }, [consumptionData]);

  const formatMoney = (amount: number, currency: 'USD' | 'CRC') => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const isUserAdmin = isAdmin(currentUser.role);

  const selectedData = useMemo(() => {
    const movement = movements.find(m => 
        m.requestNumber === selectedProjectId || 
        m.projectName === selectedProjectId ||
        m.projectId === selectedProjectId ||
        m.id === selectedProjectId
    );
    const dispatch = dispatches.find(d => 
        d.requestNumber === selectedProjectId || 
        d.projectName === selectedProjectId ||
        d.projectId === selectedProjectId ||
        d.id === selectedProjectId
    );
    return movement || dispatch;
  }, [selectedProjectId, movements, dispatches]);

  // Definición de columnas para DataTable
  const columns = useMemo<TableColumn<MaterialConsumption>[]>(() => {
    const cols: TableColumn<MaterialConsumption>[] = [
        { 
            header: 'Código', 
            accessorKey: 'code', 
            className: 'font-mono font-bold text-slate-500' 
        },
        { 
            header: 'Descripción del Material', 
            accessorKey: 'description', 
            className: 'font-bold text-blue-900' 
        },
        { 
            header: 'Unidad', 
            accessorKey: 'unit', 
            align: 'center',
            className: 'text-slate-500 font-bold'
        },
        { 
            header: 'Cant. Total', 
            align: 'right',
            render: (item) => (
                <span className="font-black text-slate-700 text-sm">
                    {item.totalQuantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
            )
        }
    ];

    if (isUserAdmin) {
        cols.push(
            { 
                header: 'Precio U.', 
                align: 'right',
                render: (item) => <span className="font-mono text-slate-500">{formatCurrency(item.unitPrice, item.currency)}</span>
            },
            { 
                header: 'Subtotal', 
                align: 'right',
                render: (item) => <span className="font-mono font-black text-emerald-600">{formatCurrency(item.totalCost, item.currency)}</span>
            }
        );
    }

    return cols;
  }, [isUserAdmin]);

  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Selector de Proyecto */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <Select
                    label="Seleccionar Proyecto para Análisis"
                    options={[
                        { label: '-- Seleccione un Proyecto --', value: '' },
                        ...availableProjects.map(opt => ({ label: opt.label, value: opt.value }))
                    ]}
                    value={selectedProjectId}
                    onChange={val => setSelectedProjectId(val)}
                    className="w-full"
                    isSearchable={true}
                    placeholder="Buscar por ID, Proyecto, FDH o Torre..."
                />
            </div>
            {selectedProjectId && (
                <div className="flex gap-2">
                    <ActionButton
                        onClick={() => {
                            const projectName = availableProjects.find(p => p.value === selectedProjectId)?.label || 'Proyecto';
                            exportConsumptionToExcel(projectName, consumptionData, selectedData);
                        }}
                        label="Excel"
                        icon={<FiTable className="text-lg" />}
                        variant="success"
                    />
                    <ActionButton
                        onClick={() => {
                            const projectName = availableProjects.find(p => p.value === selectedProjectId)?.label || 'Proyecto';
                            generateProjectConsumptionPDF(projectName, consumptionData, totals, isUserAdmin, selectedData);
                        }}
                        label="PDF"
                        icon={<FiFileText className="text-lg" />}
                        variant="danger"
                    />
                </div>
            )}
        </div>
      </div>

      {selectedProjectId && (
        <>
            {/* Totales (Solo Admin) */}
            {isUserAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Costo Total USD</p>
                            <p className="text-2xl font-black text-emerald-600">{formatMoney(totals.usd, 'USD')}</p>
                        </div>
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            <FiCircle  />
                        </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Costo Total Colones</p>
                            <p className="text-2xl font-black text-blue-600">{formatMoney(totals.crc, 'CRC')}</p>
                        </div>
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                            <FiDatabase  />
                        </div>
                    </div>
                </div>
            )}

            {/* Alerta Multimoneda */}
            {totals.usd > 0 && totals.crc > 0 && isUserAdmin && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-3 items-center">
                    <FiAlertTriangle className="text-amber-500"  />
                    <p className="text-xs font-bold text-amber-800">
                        Este proyecto contiene materiales en diferentes monedas. Los costos se muestran por separado.
                    </p>
                </div>
            )}

            {/* Tabla de Consumo */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <DataTable 
                    data={consumptionData}
                    columns={columns}
                    keyExtractor={(item: MaterialConsumption) => item.materialId}
                    emptyMessage="No hay salidas de inventario registradas para este proyecto."
                    enableVirtualization={true}
                    virtualHeight={600}
                />
            </div>
        </>
      )}

      {!selectedProjectId && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <FiSearch className="text-6xl mb-4"  />
              <p className="text-sm font-bold uppercase tracking-widest">Seleccione un proyecto para ver el análisis</p>
          </div>
      )}
    </div>
    </div>
  );
};
