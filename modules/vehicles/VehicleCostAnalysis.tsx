import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../utils/types';
import { ActionButton, DataTable, TableColumn, useConfirm } from '../../design-system';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { ActionButtons } from '../../components/ui/ActionButtons';
import { VehicleLog, extraerUnidad, extraerPlaca, VehicleExpense } from '../../types/vehicle.types';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useLocalCollection } from '../../hooks/useLocalCollection';
import { localDocStore } from '../../core/offline/localDocStore';
import { FiArrowLeft, FiCreditCard, FiTruck, FiDroplet, FiZap, FiSettings, FiShield, FiFileText, FiSearch, FiMoreHorizontal, FiTrendingUp, FiPieChart, FiAlertCircle, FiCheckCircle, FiInfo, FiActivity, FiArrowRight } from 'react-icons/fi';
import { VehicleExpenseModal } from './components/VehicleExpenseModal';
import { getVehicleExpenses, deleteVehicleExpense } from './vehicleService';
import { AnalysisPopover } from './components/AnalysisPopover';
import { AnalysisPopoverProvider } from './components/AnalysisPopoverContext';

const ALL_CATEGORIES = [
    'Combustible',
    'Mantenimiento',
    'Reparación',
    'Aceite',
    'Llantas',
    'Batería',
    'Seguro',
    'Marchamo',
    'RTV',
    'Gasto General',
    'Otros'
];

const getCategoryConfig = (category: string) => {
    switch (category) {
        case 'Llantas': return { icon: FiTruck, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' };
        case 'Aceite': return { icon: FiDroplet, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' };
        case 'Batería': return { icon: FiZap, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' };
        case 'Mantenimiento': return { icon: FiSettings, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' };
        case 'Reparación': return { icon: FiSettings, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' };
        case 'Combustible': return { icon: FiDroplet, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
        case 'Seguro': return { icon: FiShield, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' };
        case 'Marchamo': return { icon: FiFileText, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' };
        case 'RTV': return { icon: FiSearch, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' };
        case 'Gasto General': return { icon: FiCreditCard, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' };
        default: return { icon: FiMoreHorizontal, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' };
    }
};

interface VehicleCostAnalysisProps {
    currentUser: User;
    unidadId: string;
    onSetActiveModule?: (module: any) => void;
}

// Helper to parse date string without timezone shift (YYYY-MM-DD as local)
const parseDateSafe = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('T')) return new Date(dateStr);
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const VehicleCostAnalysis: React.FC<VehicleCostAnalysisProps> = ({ currentUser, unidadId, onSetActiveModule }) => {
    const { authReady } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [rawLogs, setRawLogs] = useState<VehicleLog[]>([]);
    const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showEfficiencyModal, setShowEfficiencyModal] = useState(false);
    const [selectedBitacoraId, setSelectedBitacoraId] = useState<string | undefined>(undefined);
    const [editingExpense, setEditingExpense] = useState<VehicleExpense | null>(null);

    // Unified identification logic: load all and filter in memory to match Summary View
    const localDocuments = useLocalCollection("bitacora_vehiculos");
    
    const allLogs = useMemo(() => {
        return localDocuments.map(d => ({ ...d.data, id: d.docId } as VehicleLog));
    }, [localDocuments]);

    const unidadParam = useMemo(() => {
        try {
            return decodeURIComponent(unidadId || '');
        } catch {
            return unidadId || '';
        }
    }, [unidadId]);

    useEffect(() => {
        if (!authReady || !currentUser?.id) return;
        setIsLoading(true);

        const q = query(
            collection(db, "bitacora_vehiculos"),
            orderBy("fecha", "desc")
        );
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id } as VehicleLog));

            // Sync to local store
            await localDocStore.saveLocalDocsBatch("bitacora_vehiculos", data);
            setIsLoading(false);
        }, (error) => {
            console.error("Firestore listener error:", error);
            setIsLoading(false);
        });
        
        return () => unsubscribe();
    }, [authReady, currentUser?.id]);

    // Apply unified filtering logic to the memory-cached logs
    useEffect(() => {
        const registrosUnidad = allLogs.filter(r => {
            if (r.isDeleted) return false;
            const unidad = r.unidad || extraerUnidad(r.unidadId);
            const placa = r.placa || extraerPlaca(r.unidadId);
            
            return unidad === unidadParam || 
                   placa === unidadParam ||
                   (r.unidadId || '').startsWith(unidadParam + " - ");
        });

        setRawLogs(registrosUnidad);
    }, [allLogs, unidadParam]);

    useEffect(() => {
        if (!authReady || !currentUser?.id || !unidadParam) return;
        const fetchExpenses = async () => {
            const data = await getVehicleExpenses(unidadParam);
            setExpenses(data);
        };
        fetchExpenses();
    }, [authReady, currentUser?.id, unidadParam]);

    const handleExpenseSuccess = async () => {
        const data = await getVehicleExpenses(unidadParam);
        setExpenses(data);
        setEditingExpense(null);
    };

    const handleDeleteExpense = React.useCallback(async (expense: VehicleExpense) => {
        const confirmed = await confirm({
            title: 'Eliminar Gasto',
            description: '¿Desea eliminar este gasto?\n\nEsta acción no se puede deshacer.',
            confirmLabel: 'ELIMINAR',
            variant: 'danger'
        });

        if (confirmed) {
            try {
                await deleteVehicleExpense(expense.id, expense, currentUser);
                const data = await getVehicleExpenses(unidadParam);
                setExpenses(data);
            } catch (error) {
                console.error("Error deleting expense:", error);
            }
        }
    }, [confirm, currentUser, unidadParam]);

    const financialHealth = useMemo(() => {
        if (expenses.length === 0) {
            return {
                status: 'Sin datos',
                color: 'text-slate-400',
                bg: 'bg-slate-50',
                border: 'border-slate-200',
                icon: FiInfo,
                description: 'No existe información suficiente para determinar el estado financiero.',
                efficiency: 0,
                breakdown: []
            };
        }

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 1. Gasto del mes vs promedio histórico (25%)
        const gastoMes = expenses
            .filter(e => {
                const d = parseDateSafe(e.fecha);
                return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            })
            .reduce((acc, curr) => acc + curr.monto, 0);

        const monthsMap = new Map<string, number>();
        expenses.forEach(e => {
            const d = parseDateSafe(e.fecha);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthsMap.set(key, (monthsMap.get(key) || 0) + e.monto);
        });
        
        const totalHistorico = expenses.reduce((acc, curr) => acc + curr.monto, 0);
        const numMonths = monthsMap.size || 1;
        const promedioHistoricoMensual = totalHistorico / numMonths;

        let penalty1 = 0;
        let explanation1 = "Gasto mensual controlado dentro de promedios.";
        if (gastoMes > promedioHistoricoMensual && promedioHistoricoMensual > 0) {
            const deviation = (gastoMes - promedioHistoricoMensual) / promedioHistoricoMensual;
            penalty1 = Math.min(25, deviation * 10);
            explanation1 = `El gasto del mes supera el promedio histórico por ₡${(gastoMes - promedioHistoricoMensual).toLocaleString()}.`;
        }

        // 2. Tendencia de gasto (20%)
        const last3Months: number[] = [];
        for (let i = 1; i <= 3; i++) {
            const d = new Date(currentYear, currentMonth - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            last3Months.push(monthsMap.get(key) || 0);
        }
        const avgLast3Months = last3Months.reduce((a, b) => a + b, 0) / (last3Months.filter(v => v > 0).length || 1);
        
        let penalty2 = 0;
        let explanation2 = "Tendencia de gasto estable o favorable.";
        if (gastoMes > avgLast3Months && avgLast3Months > 0) {
            const trendIncrease = (gastoMes - avgLast3Months) / avgLast3Months;
            penalty2 = Math.min(20, trendIncrease * 15);
            explanation2 = "Se detectó un incremento de gasto respecto a los meses anteriores.";
        }

        // 3. Frecuencia de mantenimientos preventivos (15%)
        const maintenanceExpenses = expenses.filter(e => e.categoria === 'Mantenimiento');
        const lastMaintenanceDate = maintenanceExpenses.length > 0 
            ? parseDateSafe(maintenanceExpenses[0].fecha) 
            : null;
        
        let penalty3 = 0;
        let explanation3 = "Registro periódico de mantenimientos preventivos.";
        if (!lastMaintenanceDate) {
            penalty3 = 15;
            explanation3 = "Ausencia de mantenimientos preventivos en el historial.";
        } else {
            const diffDays = Math.floor((now.getTime() - lastMaintenanceDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 90) {
                penalty3 = Math.min(15, (diffDays - 90) / 10);
                explanation3 = `La unidad no registra mantenimiento preventivo desde hace ${diffDays} días.`;
            }
        }

        // 4. Costo por kilómetro (20%)
        let totalKm = 0;
        let recentKm = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        rawLogs.forEach(log => {
            const km = log.totalKm || ((log.kmLlegada != null && log.kmSalida != null && log.kmLlegada >= log.kmSalida) ? (log.kmLlegada - log.kmSalida) : 0);
            totalKm += km;
            const logDate = parseDateSafe(log.fecha);
            if (logDate >= thirtyDaysAgo) {
                recentKm += km;
            }
        });

        let penalty4 = 0;
        let explanation4 = "Costo por kilómetro dentro de parámetros históricos.";
        let evaluated4 = false;

        if (totalKm > 0) {
            evaluated4 = true;
            const historicalCostPerKm = totalHistorico / totalKm;
            const recentExpenses = expenses.filter(e => parseDateSafe(e.fecha) >= thirtyDaysAgo).reduce((acc, curr) => acc + curr.monto, 0);
            
            if (recentKm > 0) {
                const recentCostPerKm = recentExpenses / recentKm;
                if (recentCostPerKm > historicalCostPerKm * 1.15) {
                    const deviation = (recentCostPerKm - historicalCostPerKm) / historicalCostPerKm;
                    penalty4 = Math.min(20, (deviation - 0.15) * 15);
                    explanation4 = `El costo por km reciente (₡${Math.round(recentCostPerKm)}) superó el promedio histórico (₡${Math.round(historicalCostPerKm)}).`;
                }
            } else if (historicalCostPerKm > 1000) { // Umbral de advertencia si el histórico ya es muy alto
                penalty4 = 5;
                explanation4 = `El costo por km histórico es elevado (₡${Math.round(historicalCostPerKm)}), sin recorridos recientes para contrastar.`;
            } else {
                explanation4 = `Costo por km histórico saludable (₡${Math.round(historicalCostPerKm)}).`;
            }
        } else {
            explanation4 = "Sin datos de kilometraje suficientes para evaluar costo operativo por distancia.";
        }

        // 5. Concentración de gastos correctivos (10%)
        const repairExpenses = expenses.filter(e => e.categoria === 'Reparación');
        const totalRepair = repairExpenses.reduce((acc, curr) => acc + curr.monto, 0);
        const repairRatio = totalRepair / totalHistorico;
        
        let penalty5 = 0;
        let explanation5 = "Balance óptimo entre preventivos y correctivos.";
        if (repairRatio > 0.25) {
            penalty5 = Math.min(10, (repairRatio - 0.25) * 20);
            explanation5 = `Alta concentración de gastos en reparaciones correctivas (${(repairRatio * 100).toFixed(1)}%).`;
        }

        // 6. Tiempo desde el último mantenimiento (10%)
        let penalty6 = 0;
        let explanation6 = "Mantenimiento realizado recientemente.";
        if (lastMaintenanceDate) {
            const diffDays = Math.floor((now.getTime() - lastMaintenanceDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 45) {
                 penalty6 = Math.min(10, (diffDays - 45) / 10);
                 explanation6 = `Mantenimiento pendiente (último registro hace ${diffDays} días).`;
            }
        } else {
            penalty6 = 10;
            explanation6 = "Sin registro de mantenimientos.";
        }

        const efficiency = Math.max(0, Math.min(100, 100 - (penalty1 + penalty2 + penalty3 + penalty4 + penalty5 + penalty6)));
        
        const breakdown = [
            { name: 'Gasto vs Promedio Histórico', weight: 25, penalty: penalty1, explanation: explanation1, evaluated: true },
            { name: 'Tendencia de Gasto', weight: 20, penalty: penalty2, explanation: explanation2, evaluated: true },
            { name: 'Frecuencia de Mantenimientos', weight: 15, penalty: penalty3, explanation: explanation3, evaluated: true },
            { name: 'Costo por Kilómetro', weight: 20, penalty: penalty4, explanation: explanation4, evaluated: evaluated4 },
            { name: 'Gastos Correctivos', weight: 10, penalty: penalty5, explanation: explanation5, evaluated: true },
            { name: 'Antigüedad Mantenimiento', weight: 10, penalty: penalty6, explanation: explanation6, evaluated: true },
        ];

        let status = 'Excelente';
        let color = 'text-emerald-600';
        let bg = 'bg-emerald-50';
        let border = 'border-emerald-100';
        let icon = FiCheckCircle;

        if (efficiency >= 95) {
            status = 'Excelente';
        } else if (efficiency >= 85) {
            status = 'Muy Bueno';
            color = 'text-emerald-600';
            bg = 'bg-emerald-50';
            border = 'border-emerald-100';
        } else if (efficiency >= 70) {
            status = 'Bueno';
            color = 'text-blue-600';
            bg = 'bg-blue-50';
            border = 'border-blue-100';
            icon = FiActivity;
        } else if (efficiency >= 55) {
            status = 'Normal';
            color = 'text-blue-600';
            bg = 'bg-blue-50';
            border = 'border-blue-100';
            icon = FiActivity;
        } else if (efficiency >= 40) {
            status = 'Alto Costo';
            color = 'text-orange-600';
            bg = 'bg-orange-50';
            border = 'border-orange-100';
            icon = FiTrendingUp;
        } else {
            status = 'Requiere Revisión';
            color = 'text-rose-600';
            bg = 'bg-rose-50';
            border = 'border-rose-100';
            icon = FiAlertCircle;
        }

        let description = "La unidad mantiene una salud financiera óptima y costos controlados.";
        if (efficiency < 90) {
            const mainPenalty = [...breakdown].sort((a, b) => b.penalty - a.penalty)[0];
            description = `Eficiencia del ${efficiency === 100 ? '100' : efficiency.toFixed(1)}%. ${mainPenalty.explanation}`;
        }

        return {
            status,
            color,
            bg,
            border,
            icon,
            description,
            efficiency,
            breakdown
        };
    }, [expenses, rawLogs]);


    const costSummary = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());

        const totalHistorico = expenses.reduce((acc, curr) => acc + curr.monto, 0);
        const gastoAnio = expenses
            .filter(e => parseDateSafe(e.fecha).getFullYear() === currentYear)
            .reduce((acc, curr) => acc + curr.monto, 0);
        const gastoMes = expenses
            .filter(e => {
                const d = parseDateSafe(e.fecha);
                return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            })
            .reduce((acc, curr) => acc + curr.monto, 0);
        const gastoSemana = expenses
            .filter(e => parseDateSafe(e.fecha) >= startOfWeek)
            .reduce((acc, curr) => acc + curr.monto, 0);
        const ultimoGasto = expenses.length > 0 ? expenses[0] : null;

        const categoryMap = new Map<string, number>();
        expenses.forEach(e => {
            categoryMap.set(e.categoria, (categoryMap.get(e.categoria) || 0) + e.monto);
        });

        const sortedCategories = Array.from(categoryMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // NUEVOS INDICADORES
        const logsWithExpenses = rawLogs.filter(log => expenses.some(e => e.bitacoraId === log.id));
        const logsWithoutExpenses = rawLogs.filter(log => !expenses.some(e => e.bitacoraId === log.id));
        
        const expensePerLog = logsWithExpenses.map(log => {
            const logTotal = expenses.filter(e => e.bitacoraId === log.id).reduce((sum, e) => sum + e.monto, 0);
            return { log, total: logTotal };
        });

        const avgExpensePerTrip = logsWithExpenses.length > 0 
            ? expensePerLog.reduce((sum, item) => sum + item.total, 0) / logsWithExpenses.length 
            : 0;
        
        const mostExpensiveTrip = expensePerLog.length > 0 
            ? expensePerLog.reduce((prev, curr) => (curr.total > prev.total ? curr : prev))
            : null;

        const maintenanceExpenses = expenses.filter(e => e.categoria === 'Mantenimiento' && e.bitacoraId);
        const lastMaintenanceTripId = maintenanceExpenses.length > 0 ? maintenanceExpenses[0].bitacoraId : null;
        const lastMaintenanceTrip = lastMaintenanceTripId ? rawLogs.find(l => l.id === lastMaintenanceTripId) : null;

        return { 
            totalHistorico, 
            gastoAnio, 
            gastoMes, 
            gastoSemana,
            ultimoGasto,
            sortedCategories,
            totalCount: expenses.length,
            // Nuevos
            logsWithExpenses: logsWithExpenses.length,
            logsWithoutExpenses: logsWithoutExpenses.length,
            avgExpensePerTrip,
            mostExpensiveTrip,
            lastMaintenanceTrip
        };
    }, [expenses, rawLogs]);

    const unitInfo = useMemo(() => {
        if (rawLogs.length > 0) {
            const firstLog = rawLogs[0];
            const unidad = firstLog.unidad || extraerUnidad(firstLog.unidadId);
            const placa = firstLog.placa || extraerPlaca(firstLog.unidadId);
            return { 
                unidad: unidad || unidadParam, 
                placa: placa || '---',
                vehiculoId: firstLog.vehiculoId
            };
        }
        return { unidad: unidadParam, placa: '---', vehiculoId: undefined };
    }, [rawLogs, unidadParam]);

    const expenseColumns = useMemo<TableColumn<VehicleExpense>[]>(() => [
        {
            header: 'Fecha',
            width: '12%',
            render: (exp) => (
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                    {parseDateSafe(exp.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
            ),
            mobileGrid: 'left'
        },
        {
            header: 'Categoría',
            width: '18%',
            render: (exp) => {
                const config = getCategoryConfig(exp.categoria);
                return (
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${config.bg} ${config.color}`}>
                            <config.icon className="text-xs" />
                        </div>
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{exp.categoria}</span>
                    </div>
                );
            },
            mobileGrid: 'left'
        },
        {
            header: 'Descripción',
            width: '30%',
            render: (exp) => (
                <span className="text-xs font-bold text-slate-600 line-clamp-1" title={exp.descripcion}>{exp.descripcion}</span>
            ),
            mobileGrid: 'full'
        },
        {
            header: 'Monto',
            align: 'right',
            width: '15%',
            render: (exp) => (
                <span className="text-sm font-black text-emerald-600">₡{exp.monto.toLocaleString()}</span>
            ),
            mobileGrid: 'right'
        },
        {
            header: 'Bitácora',
            align: 'center',
            width: '10%',
            render: (exp) => {
                const relatedLog = exp.bitacoraId ? rawLogs.find(l => l.id === exp.bitacoraId) : null;
                return relatedLog ? (
                    <ActionButton
                        variant="ghost"
                        onClick={() => onSetActiveModule?.({ module: 'vehicles_logs', selectedId: relatedLog.id })}
                        className="!py-1 !px-2 !bg-blue-50 !text-blue-600 !border-blue-100 hover:!bg-blue-100 !text-[9px] !font-black !uppercase"
                        label="Bitácora"
                        icon={<FiArrowRight className="text-[8px]" />}
                    />
                ) : (
                    <span className="text-[9px] font-bold text-slate-300 uppercase italic">N/A</span>
                );
            },
            mobileGrid: 'right'
        },
        {
            header: 'Proyecto',
            align: 'center',
            width: '5%',
            render: () => (
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">P-000</span>
            ),
            mobileGrid: 'right'
        },
        {
            header: 'Acciones',
            align: 'right',
            width: '10%',
            render: (exp) => (
                <div className="flex items-center justify-end">
                    <ActionButtons 
                        onEdit={() => {
                            setEditingExpense(exp);
                            setShowExpenseModal(true);
                        }}
                        onDelete={() => handleDeleteExpense(exp)}
                    />
                </div>
            ),
            mobileGrid: 'right'
        }
    ], [rawLogs, onSetActiveModule, confirm, currentUser, unidadParam, handleDeleteExpense]);

    if (!currentUser) return null;

    return (
        <AnalysisPopoverProvider>
            <div className="-mx-2 md:-mx-4 -mt-4">
            <ModulePage
                title="Análisis de Costos de la Unidad"
                subtitle={`${unitInfo.unidad} | ${unitInfo.placa}`}
            >
                <ModuleToolbar>
                    <ActionButton
                        type="button"
                        onClick={() => {
                          if (onSetActiveModule) {
                              onSetActiveModule({ module: 'vehicles_analysis_detail', selectedId: unidadId });
                          } else {
                              navigate(-1);
                          }
                        }}
                        className="!bg-white !text-slate-600 !border-slate-200 hover:!bg-slate-50 !w-auto shadow-sm font-bold text-xs uppercase tracking-widest rounded-xl !px-6"
                        label="VOLVER"
                        icon={<FiArrowLeft className="text-sm" />}
                    />
                    <ActionButton
                        type="button"
                        onClick={() => {
                          setShowExpenseModal(true);
                        }}
                        className="!bg-emerald-600 !text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:!bg-emerald-700 transition-colors !w-auto border-none shadow-sm !px-6"
                        label="REGISTRAR GASTO"
                    />
                </ModuleToolbar>

                <VehicleExpenseModal
                    show={showExpenseModal}
                    onClose={() => {
                        setShowExpenseModal(false);
                        setSelectedBitacoraId(undefined);
                        setEditingExpense(null);
                    }}
                    unidad={unidadParam}
                    vehiculoId={unitInfo.vehiculoId}
                    bitacoraId={selectedBitacoraId || editingExpense?.bitacoraId}
                    currentUser={currentUser}
                    onSuccess={handleExpenseSuccess}
                    initialData={editingExpense}
                />

                {/* MODAL DE DESGLOSE DE EFICIENCIA */}
                {financialHealth.breakdown && (
                    <div 
                        className={`fixed inset-0 z-[200] flex justify-center items-center p-4 bg-blue-950/80 backdrop-blur-sm transition-opacity duration-300 ${showEfficiencyModal ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
                        onClick={() => setShowEfficiencyModal(false)}
                    >
                        <div 
                            className={`bg-white w-full max-w-lg rounded-[32px] shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden transform transition-all duration-300 ${showEfficiencyModal ? 'scale-100' : 'scale-95'}`}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-600 rounded-lg">
                                        <FiActivity className="text-white text-lg" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Desglose de Eficiencia</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Transparencia en el cálculo financiero</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Resultado Final</span>
                                    <span className="text-xl font-black text-blue-600">{Math.round(financialHealth.efficiency)}%</span>
                                </div>
                            </div>
                            
                            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                                {financialHealth.breakdown.map((item, idx) => (
                                    <div key={idx} className={`p-3 rounded-xl border ${item.evaluated ? 'border-slate-100 bg-slate-50/30' : 'border-slate-50 bg-slate-50/10 opacity-60'}`}>
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{item.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Peso: {item.weight}%</span>
                                                {item.evaluated && item.penalty > 0 && (
                                                    <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded uppercase">-{item.penalty.toFixed(1)}%</span>
                                                )}
                                                {item.evaluated && item.penalty === 0 && (
                                                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Óptimo</span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 leading-tight">
                                            {item.explanation}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button 
                                    onClick={() => setShowEfficiencyModal(false)}
                                    className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-100 transition-colors shadow-sm"
                                >
                                    CERRAR
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center items-center p-10">Cargando datos financieros...</div>
                ) : (
                    <div className="space-y-4">
                        {/* ESTADO FINANCIERO DE LA UNIDAD */}
                        <div className={`p-4 rounded-2xl border ${financialHealth.border} ${financialHealth.bg} shadow-sm transition-all duration-500`}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl bg-white shadow-sm ${financialHealth.color}`}>
                                        <financialHealth.icon className="text-3xl" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Financiero</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight ${financialHealth.bg.replace('50', '100')} ${financialHealth.color}`}>
                                                {financialHealth.status}
                                            </span>
                                        </div>
                                        <h2 className={`text-xl font-black ${financialHealth.color} uppercase tracking-tight`}>
                                            Unidad {unitInfo.unidad}
                                        </h2>
                                        <p className="text-xs font-bold text-slate-500 max-w-md">
                                            {financialHealth.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 px-4 py-2 bg-white/50 rounded-2xl border border-white">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Eficiencia</span>
                                            <button 
                                                onClick={() => setShowEfficiencyModal(true)}
                                                className="text-slate-300 hover:text-blue-500 transition-colors p-0.5"
                                                title="Ver detalle del cálculo"
                                            >
                                                <FiInfo className="text-[10px]" />
                                            </button>
                                        </div>
                                        <span className="text-lg font-black text-slate-700">
                                            {financialHealth.efficiency === 100 ? '100' : financialHealth.efficiency.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200"></div>
                                    <div className="text-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Registros</span>
                                        <span className="text-lg font-black text-slate-700">{expenses.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RESUMEN OPERATIVO ADICIONAL */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:border-emerald-200 transition-colors">
                                <span className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-tighter">Bitácoras con Gasto</span>
                                <span className="text-lg font-black text-emerald-600">{costSummary.logsWithExpenses}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:border-slate-300 transition-colors">
                                <span className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-tighter">Bitácoras sin Gasto</span>
                                <span className="text-lg font-black text-slate-400">{costSummary.logsWithoutExpenses}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Gasto Prom. Recorrido</span>
                                    <AnalysisPopover desktopAlignment="center">
                                        <div className="p-4 space-y-3">
                                            <div className="border-b border-slate-100 pb-2">
                                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Gasto Promedio</h3>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">por recorrido registrado</p>
                                            </div>

                                            <div>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">¿Cómo se calcula?</h4>
                                                <p className="text-[11px] font-bold text-slate-600 leading-tight">Total Histórico de Gastos ÷ Cantidad de Bitácoras con Gasto</p>
                                            </div>
                                            
                                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Ejemplo para esta unidad</h4>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="font-bold text-slate-500 uppercase">Total Histórico:</span>
                                                        <span className="font-black text-slate-700 uppercase ml-2">₡{costSummary.totalHistorico.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="font-bold text-slate-500 uppercase">Bitácoras con gasto:</span>
                                                        <span className="font-black text-slate-700 uppercase ml-2">{costSummary.logsWithExpenses}</span>
                                                    </div>
                                                    <div className="pt-1.5 mt-1 border-t border-blue-200 flex justify-between items-center">
                                                        <span className="text-[9px] font-black text-blue-600 uppercase">Resultado</span>
                                                        <span className="text-xs font-black text-blue-700">₡{Math.round(costSummary.avgExpensePerTrip).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Interpretación</h4>
                                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                                    Representa el costo promedio invertido en cada recorrido que tuvo un gasto registrado. Permite estimar cuánto cuesta, en promedio, cada intervención realizada sobre la unidad.
                                                </p>
                                            </div>
                                        </div>
                                    </AnalysisPopover>
                                </div>
                                <span className="text-lg font-black text-blue-600">₡{Math.round(costSummary.avgExpensePerTrip).toLocaleString()}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:border-orange-200 transition-colors">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Recorrido más Costoso</span>
                                    <AnalysisPopover desktopAlignment="center">
                                        <div className="p-4 space-y-3">
                                            <div className="border-b border-slate-100 pb-2">
                                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Recorrido más Costoso</h3>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Evento de mayor impacto</p>
                                            </div>

                                            <div>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">¿Qué representa?</h4>
                                                <p className="text-[11px] font-bold text-slate-600 leading-tight">Corresponde al recorrido o bitácora que registró el mayor gasto económico dentro del historial de la unidad.</p>
                                            </div>
                                            
                                            {costSummary.mostExpensiveTrip ? (
                                                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                                                    <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">Detalle del Recorrido</h4>
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="font-bold text-slate-500 uppercase">Fecha:</span>
                                                            <span className="font-black text-slate-700 uppercase ml-2">{new Date(costSummary.mostExpensiveTrip.log.fecha).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="font-bold text-slate-500 uppercase">Conductor:</span>
                                                            <span className="font-black text-slate-700 uppercase ml-2 truncate max-w-[120px]">{costSummary.mostExpensiveTrip.log.conductorName}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="font-bold text-slate-500 uppercase">Monto:</span>
                                                            <span className="font-black text-orange-600 uppercase ml-2">₡{costSummary.mostExpensiveTrip.total.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center text-[10px] font-bold text-slate-400 italic uppercase tracking-widest">
                                                    Sin datos registrados
                                                </div>
                                            )}

                                            <div>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Interpretación</h4>
                                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                                    Este indicador permite identificar el evento de mayor impacto económico para facilitar su análisis y determinar si corresponde a una reparación extraordinaria, mantenimiento mayor o un evento aislado.
                                                </p>
                                            </div>
                                        </div>
                                    </AnalysisPopover>
                                </div>
                                <span className="text-xs font-black text-orange-600 truncate w-full">
                                    {costSummary.mostExpensiveTrip ? `₡${costSummary.mostExpensiveTrip.total.toLocaleString()}` : 'N/A'}
                                </span>
                                {costSummary.mostExpensiveTrip && <span className="text-[8px] text-slate-400 font-bold uppercase mt-1">{new Date(costSummary.mostExpensiveTrip.log.fecha).toLocaleDateString()}</span>}
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center group hover:border-indigo-200 transition-colors">
                                <span className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-tighter">Último Mantenimiento</span>
                                <span className="text-xs font-black text-indigo-600 truncate w-full">
                                    {costSummary.lastMaintenanceTrip ? new Date(costSummary.lastMaintenanceTrip.fecha).toLocaleDateString() : 'SIN DATOS'}
                                </span>
                                {costSummary.lastMaintenanceTrip && <span className="text-[8px] text-slate-400 font-bold uppercase mt-1 truncate w-full">{costSummary.lastMaintenanceTrip.conductorName}</span>}
                            </div>
                        </div>

                        {/* RESUMEN EJECUTIVO DE COSTOS */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <FiCreditCard className="text-blue-600 text-lg" />
                                </div>
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Resumen Ejecutivo</h3>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Histórico</span>
                                    <div className="text-xl font-black text-slate-900">
                                        ₡{costSummary.totalHistorico.toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Gasto del Año</span>
                                    <div className="text-xl font-black text-blue-600">
                                        ₡{costSummary.gastoAnio.toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Gasto del Mes</span>
                                    <div className="text-xl font-black text-emerald-600">
                                        ₡{costSummary.gastoMes.toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Gasto Semana</span>
                                    <div className="text-xl font-black text-orange-600">
                                        ₡{costSummary.gastoSemana.toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Último Gasto</span>
                                    <div className="text-sm font-bold text-slate-900 truncate">
                                        {costSummary.ultimoGasto ? (
                                            <>
                                                ₡{costSummary.ultimoGasto.monto.toLocaleString()}
                                                <span className="text-[10px] text-slate-400 font-normal block truncate">{costSummary.ultimoGasto.descripcion}</span>
                                            </>
                                        ) : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CONTENIDOS PRINCIPALES: INTELIGENCIA, DISTRIBUCIÓN Y HISTORIAL */}
                        <div className="space-y-4">
                            {/* PRIMERA FILA: INTELIGENCIA Y DISTRIBUCIÓN (LADO A LADO EN ESCRITORIO) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                                {/* INTELIGENCIA FINANCIERA */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <FiActivity className="text-blue-600 text-lg" />
                                            </div>
                                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Inteligencia Financiera</h3>
                                        </div>
                                        <div className="text-[8px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Análisis IA</div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100/80 hover:bg-blue-50/30 hover:border-blue-200 transition-all duration-300 group">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-wider group-hover:text-blue-500 transition-colors">Costo Operativo Estimado</p>
                                            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                                                {expenses.length < 10 
                                                    ? "Historial insuficiente para proyecciones precisas."
                                                    : `₡${Math.round(costSummary.totalHistorico / (expenses.length || 1)).toLocaleString()} prom. por evento.`
                                                }
                                            </p>
                                        </div>
                                        <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100/80 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all duration-300 group">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-wider group-hover:text-indigo-500 transition-colors">Punto Crítico de Gasto</p>
                                            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                                                {costSummary.totalCount > 0 
                                                    ? `"${costSummary.sortedCategories[0]?.name}" concentra la inversión histórica.`
                                                    : "Sin alertas activas en los parámetros actuales."
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* DISTRIBUCION POR CATEGORIA */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="p-2 bg-indigo-50 rounded-lg">
                                            <FiPieChart className="text-indigo-600 text-lg" />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Distribución de Gastos</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                        {ALL_CATEGORIES.map((catName) => {
                                            const catData = costSummary.sortedCategories.find(c => c.name === catName) || { name: catName, value: 0 };
                                            const config = getCategoryConfig(catName);
                                            const percentage = costSummary.totalHistorico > 0 ? (catData.value / costSummary.totalHistorico) * 100 : 0;
                                            
                                            return (
                                                <div key={catName} className="space-y-2 group">
                                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
                                                        <span className="text-slate-500 flex items-center gap-2 truncate group-hover:text-slate-700 transition-colors">
                                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-none ${config.bg} shadow-sm`}>
                                                                <config.icon className={`${config.color} text-[10px]`} />
                                                            </div>
                                                            <span className="truncate">{catName}</span>
                                                        </span>
                                                        <span className="text-slate-400 group-hover:text-slate-900 transition-colors font-black">
                                                            {percentage > 0 ? `${percentage.toFixed(1)}%` : '0%'}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${catData.value > 0 ? '' : 'opacity-0'}`}
                                                            style={{ 
                                                                width: `${percentage > 0 ? percentage : 0}%`, 
                                                                backgroundColor: config.color.includes('blue') ? '#3b82f6' : 
                                                                               config.color.includes('emerald') ? '#10b981' : 
                                                                               config.color.includes('orange') ? '#f97316' : 
                                                                               config.color.includes('amber') ? '#f59e0b' : 
                                                                               config.color.includes('indigo') ? '#6366f1' : 
                                                                               config.color.includes('purple') ? '#a855f7' : '#94a3b8' 
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="text-right text-[10px] font-black text-slate-400 group-hover:text-emerald-600 transition-colors">
                                                        ₡{catData.value.toLocaleString()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* SEGUNDA FILA: HISTORIAL FINANCIERO (ANCHO COMPLETO) */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-emerald-50 rounded-lg">
                                            <FiCreditCard className="text-emerald-600 text-lg" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Historial Financiero</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-tight">Registro cronológico de eventos económicos</p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        {expenses.length} Eventos Registrados
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-slate-100/50">
                                    <DataTable
                                        data={expenses}
                                        columns={expenseColumns}
                                        isLoading={isLoading}
                                        emptyMessage="No se registran eventos financieros para esta unidad."
                                        zebra={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </ModulePage>
        </div>
        </AnalysisPopoverProvider>
    );
};
