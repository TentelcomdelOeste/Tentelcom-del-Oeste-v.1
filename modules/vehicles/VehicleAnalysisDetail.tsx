import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../utils/types';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { VehicleLog, extraerUnidad, extraerPlaca, VehicleExpense, getUnitCode } from '../../types/vehicle.types';
import { normalizeDateToCanonical, reconcileUnlinkedMaintenanceExpenses } from './controlVehicularService';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { useLocalCollection } from '../../hooks/useLocalCollection';
import { localDocStore } from '../../core/offline/localDocStore';
import { FiArrowLeft, FiCreditCard } from 'react-icons/fi';
import { ActionButtons } from '../../components/ui/ActionButtons';
import { FuelDetailModal } from './components/FuelDetailModal';
import { EventSummaryModal } from './components/EventSummaryModal';
import { VehicleEventModal } from './components/VehicleEventModal';
import { VehicleExpenseModal } from './components/VehicleExpenseModal';
import { CostPerKmPopover } from './components/CostPerKmPopover';
import { FuelConsumptionPopover } from './components/FuelConsumptionPopover';
import { EfficiencyPopover } from './components/EfficiencyPopover';
import { getVehicleExpenses, deleteVehicleExpense } from './vehicleService';
import { AnalysisPopoverProvider } from './components/AnalysisPopoverContext';
import { ActionButton, useConfirm, Select } from '../../design-system';

const MONTH_NAMES = [
  { value: "all", label: "Todos los meses" },
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const getInitialCostaRicaPeriod = () => {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Costa_Rica',
            year: 'numeric',
            month: 'numeric',
        });
        const parts = formatter.formatToParts(now);
        const yearPart = parts.find(p => p.type === 'year')?.value;
        const monthPart = parts.find(p => p.type === 'month')?.value;
        return {
            year: yearPart ? parseInt(yearPart, 10) : now.getFullYear(),
            month: monthPart ? String(parseInt(monthPart, 10)) : String(now.getMonth() + 1),
        };
    } catch {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: String(now.getMonth() + 1),
        };
    }
};

interface VehicleAnalysisDetailProps {
    currentUser: User;
    unidadId: string;
    onSetActiveModule?: (module: any) => void;
}

export const VehicleAnalysisDetail: React.FC<VehicleAnalysisDetailProps> = ({ currentUser, unidadId, onSetActiveModule }) => {
    console.log('[TRACE][VehicleAnalysisDetail] RENDER');
    
    const { authReady } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [showFuelModal, setShowFuelModal] = useState(false);
    const [showEventSummaryModal, setShowEventSummaryModal] = useState(false);
    const [selectedEventLog, setSelectedEventLog] = useState<VehicleLog | null>(null);
    const [rawLogs, setRawLogs] = useState<VehicleLog[]>([]);
    const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
    const [filterYear, setFilterYear] = useState<number>(() => getInitialCostaRicaPeriod().year);
    const [filterMonth, setFilterMonth] = useState<string>(() => getInitialCostaRicaPeriod().month);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [selectedBitacoraId, setSelectedBitacoraId] = useState<string | undefined>(undefined);
    const [selectedLogDate, setSelectedLogDate] = useState<string | undefined>(undefined);
    const [selectedLogMileage, setSelectedLogMileage] = useState<number | undefined>(undefined);
    const [editingExpense, setEditingExpense] = useState<VehicleExpense | null>(null);

    // Unified identification logic: load all and filter in memory to match Summary View
    const localDocuments = useLocalCollection("bitacora_vehiculos");
    
    const allLogs = useMemo(() => {
        return localDocuments.map(d => ({ ...d.data, id: d.docId } as VehicleLog));
    }, [localDocuments]);

    // Helper to parse date string without timezone shift (YYYY-MM-DD as local)
    const parseDateSafe = (dateStr: string) => {
        if (!dateStr) return new Date();
        if (dateStr.includes('T')) return new Date(dateStr);
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const unidadParam = useMemo(() => {
        try {
            return decodeURIComponent(unidadId || '');
        } catch {
            return unidadId || '';
        }
    }, [unidadId]);

    // NORMALIZATION ENGINE: Run once to fix historical records
    useEffect(() => {
        if (!authReady || allLogs.length === 0) return;
        
        const toFix = allLogs.filter(log => {
            if (log.isDeleted) return false;
            const uid = log.unidad || extraerUnidad(log.unidadId);
            // Only fix records that belong to THIS unit but are missing the 'unidad' field
            return uid === unidadParam && !log.unidad;
        });

        if (toFix.length > 0) {
            console.log(`[VehicleAnalysisDetail] Normalizing ${toFix.length} records for ${unidadParam}`);
            toFix.forEach(log => {
                const parts = (log.unidadId || "").split(" - ");
                const derivedUnidad = parts[0]?.trim() || "";
                const derivedPlaca = parts[2]?.trim() || parts[1]?.trim() || "";
                
                if (derivedUnidad) {
                    import('./vehicleService').then(({ updateVehicleLog }) => {
                        updateVehicleLog(log.id, { 
                            unidad: derivedUnidad,
                            placa: derivedPlaca || log.placa
                        }, currentUser).catch(err => console.error("Error normalizing record:", err));
                    });
                }
            });
        }
    }, [allLogs, unidadParam, authReady, currentUser]);

    useEffect(() => {
        if (!authReady || !currentUser?.id) return;
        setIsLoading(true);

        // Broad query to keep local cache fresh (mirroring Summary View logic but without date limit to get full history)
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

    // Apply unified filtering logic to the memory-cached logs and sort chronologically (newest to oldest)
    useEffect(() => {
        const registrosUnidad = allLogs.filter(r => {
            if (r.isDeleted) return false;
            const unidad = r.unidad || extraerUnidad(r.unidadId);
            const placa = r.placa || extraerPlaca(r.unidadId);
            
            return unidad === unidadParam || 
                   placa === unidadParam ||
                   (r.unidadId || '').startsWith(unidadParam + " - ");
        });

        // Sort from newest to oldest
        registrosUnidad.sort((a, b) => {
            const dateA = a.fecha || "";
            const dateB = b.fecha || "";
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            const timeA = a.horaSalida || "";
            const timeB = b.horaSalida || "";
            return timeB.localeCompare(timeA);
        });

        setRawLogs(registrosUnidad);
    }, [allLogs, unidadParam]);

    useEffect(() => {
        if (!authReady || !currentUser?.id || !unidadParam) return;
        
        reconcileUnlinkedMaintenanceExpenses().catch(console.error);

        const targetUCode = getUnitCode(unidadParam);
        const matchesUnit = (e: VehicleExpense) => {
            if (e.isDeleted) return false;
            if (e.unidad === unidadParam) return true;
            const expUCode = getUnitCode(e.unidad, e.vehiculoId);
            return !!(targetUCode && expUCode && targetUCode === expUCode);
        };

        const qExpenses = query(
            collection(db, "vehicle_expenses"),
            orderBy("fecha", "desc")
        );
        const unsubscribe = onSnapshot(qExpenses, (snap) => {
            const data = snap.docs
                .map(doc => ({ ...doc.data(), id: doc.id } as VehicleExpense))
                .filter(matchesUnit);
            setExpenses(data.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
        }, (err) => {
            console.error("Error in vehicle_expenses listener:", err);
            getVehicleExpenses(unidadParam).then(setExpenses);
        });

        return () => unsubscribe();
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

    // Lista de años disponibles basados en la unidad y el año actual
    const availableYears = useMemo(() => {
        const currentYear = getInitialCostaRicaPeriod().year;
        const years = [currentYear];
        for (let i = 1; i <= 3; i++) {
            years.push(currentYear - i);
        }
        rawLogs.forEach(l => {
            const canonical = normalizeDateToCanonical(l.fecha);
            if (canonical) {
                const y = parseInt(canonical.split('-')[0], 10);
                if (y && !isNaN(y) && !years.includes(y)) {
                    years.push(y);
                }
            }
        });
        expenses.forEach(e => {
            const canonical = normalizeDateToCanonical(e.fecha);
            if (canonical) {
                const y = parseInt(canonical.split('-')[0], 10);
                if (y && !isNaN(y) && !years.includes(y)) {
                    years.push(y);
                }
            }
        });
        return Array.from(new Set(years)).sort((a, b) => b - a);
    }, [rawLogs, expenses]);

    const yearOptions = useMemo(() => {
        return availableYears.map(y => ({ label: String(y), value: y }));
    }, [availableYears]);

    // Registros filtrados por Mes y Año seleccionados
    const filteredLogs = useMemo(() => {
        return rawLogs.filter(log => {
            const canonical = normalizeDateToCanonical(log.fecha);
            if (!canonical) return false;
            const parts = canonical.split('-');
            if (parts.length < 2) return false;
            const y = parseInt(parts[0], 10);
            const m = parts[1];
            if (y !== filterYear) return false;
            if (filterMonth && filterMonth !== 'all') {
                const targetMonth = String(filterMonth).padStart(2, '0');
                if (m !== targetMonth) return false;
            }
            return true;
        });
    }, [rawLogs, filterYear, filterMonth]);

    // Gastos filtrados por Mes y Año seleccionados
    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const canonical = normalizeDateToCanonical(exp.fecha);
            if (!canonical) return false;
            const parts = canonical.split('-');
            if (parts.length < 2) return false;
            const y = parseInt(parts[0], 10);
            const m = parts[1];
            if (y !== filterYear) return false;
            if (filterMonth && filterMonth !== 'all') {
                const targetMonth = String(filterMonth).padStart(2, '0');
                if (m !== targetMonth) return false;
            }
            return true;
        });
    }, [expenses, filterYear, filterMonth]);

    const costSummary = useMemo(() => {
        const totalHistorico = expenses.reduce((acc, curr) => acc + (curr.monto || 0), 0);
        
        const gastoAnio = expenses
            .filter(e => {
                const canon = normalizeDateToCanonical(e.fecha);
                return canon && canon.startsWith(String(filterYear));
            })
            .reduce((acc, curr) => acc + (curr.monto || 0), 0);

        const targetMonthPrefix = filterMonth && filterMonth !== 'all'
            ? `${filterYear}-${String(filterMonth).padStart(2, '0')}`
            : `${filterYear}-`;
        const gastoMes = expenses
            .filter(e => {
                const canon = normalizeDateToCanonical(e.fecha);
                return canon && canon.startsWith(targetMonthPrefix);
            })
            .reduce((acc, curr) => acc + (curr.monto || 0), 0);

        const ultimoGasto = filteredExpenses.length > 0 ? filteredExpenses[0] : (expenses.length > 0 ? expenses[0] : null);

        const now = new Date();
        const promedioMensual = expenses.length > 0 ? (totalHistorico / (expenses.length > 0 ? (Math.max(1, (now.getTime() - parseDateSafe(expenses[expenses.length - 1].fecha).getTime()) / (1000 * 60 * 60 * 24 * 30))) : 1)) : 0;
        const promedioPorGasto = expenses.length > 0 ? totalHistorico / expenses.length : 0;
        
        const categoryMap = new Map<string, number>();
        filteredExpenses.forEach(e => {
            categoryMap.set(e.categoria, (categoryMap.get(e.categoria) || 0) + e.monto);
        });
        let topCategory = 'N/A';
        let maxMonto = 0;
        categoryMap.forEach((monto, cat) => {
            if (monto > maxMonto) {
                maxMonto = monto;
                topCategory = cat;
            }
        });

        return { 
            totalHistorico, 
            gastoAnio, 
            gastoMes, 
            ultimoGasto,
            promedioMensual,
            promedioPorGasto,
            topCategory,
            totalCount: filteredExpenses.length
        };
    }, [expenses, filteredExpenses, filterYear, filterMonth]);

    const unitInfo = useMemo(() => {
        if (rawLogs.length > 0) {
            const firstLog = rawLogs[0];
            const unidad = firstLog.unidad || extraerUnidad(firstLog.unidadId);
            const placa = firstLog.placa || extraerPlaca(firstLog.unidadId);
            if (unidad && placa) {
                return `Unidad: ${unidad} | Placa: ${placa}`;
            }
            return `Unidad: ${unidad || unidadParam}`;
        }
        
        const partes = unidadParam.split(" - ");
        if (partes.length >= 3) {
            return `Unidad: ${partes[0].trim()} | Placa: ${partes[2].trim()}`;
        }
        return `Unidad: ${unidadParam}`;
    }, [rawLogs, unidadParam]);

    const metrics = useMemo(() => {
        let totalKm = 0;
        let totalLitros = 0;
        let costoCombustible = 0;
        let totalEventos = 0;

        filteredLogs.forEach(log => {
            const km = (log.kmLlegada && log.kmSalida && log.kmLlegada >= log.kmSalida) 
                ? (log.kmLlegada - log.kmSalida) 
                : (log.totalKm || 0);

            let logLitros = 0;
            if (log.recargas && Array.isArray(log.recargas) && log.recargas.length > 0) {
                log.recargas.forEach(r => {
                    if (r.litros != null) {
                        logLitros += parseFloat(String(r.litros)) || 0;
                    }
                });
            } else {
                logLitros = (log.litros != null && log.litros !== "") ? parseFloat(String(log.litros)) || 0 : 0;
            }

            let logCosto = 0;
            if (log.recargas && Array.isArray(log.recargas) && log.recargas.length > 0) {
                log.recargas.forEach(r => {
                    if (r.monto != null) {
                        logCosto += parseFloat(String(r.monto)) || 0;
                    }
                });
            } else {
                logCosto = log.monto || (log as any).costo || 0;
            }

            totalKm += km;
            totalLitros += logLitros;
            costoCombustible += logCosto;
            if (log.eventosCarretera === 'Sí') {
                totalEventos++;
            }
        });

        let nonFuelCost = 0;
        filteredExpenses.forEach(exp => {
            if (exp.categoria !== 'Combustible') {
                nonFuelCost += exp.monto || 0;
            }
        });

        const costoTotal = costoCombustible + nonFuelCost;
        const totalGalones = totalLitros / 3.785;
        const kmPorGalon = totalLitros >= 1 && totalGalones > 0 ? totalKm / totalGalones : 0;
        const costoPorKm = totalKm > 0 ? costoCombustible / totalKm : 0;
        const costoPorGalon = totalGalones > 0 ? costoTotal / totalGalones : 0;

        return { 
            totalKm, 
            totalLitros, 
            totalGalones, 
            costoTotal, 
            costoCombustible,
            kmPorGalon, 
            costoPorKm,
            costoPorGalon,
            totalEventos 
        };
    }, [filteredLogs, filteredExpenses, expenses]);

    const advancedMetrics = useMemo(() => {
        if (filteredLogs.length === 0) return null;

        const dailyData: Record<string, { km: number, lts: number, costo: number }> = {};

        filteredLogs.forEach(log => {
            const date = log.fecha || "";
            if (!date) return;
            const km = log.totalKm || ((log.kmLlegada != null && log.kmSalida != null && log.kmLlegada >= log.kmSalida) ? (log.kmLlegada - log.kmSalida) : 0);
            const consumoLts = (log.litros != null && log.litros !== "") ? parseFloat(String(log.litros)) || 0 : 0;
            const costo = log.monto || (log as any).costo || 0;

            if (!dailyData[date]) dailyData[date] = { km: 0, lts: 0, costo: 0 };
            dailyData[date].km += km;
            dailyData[date].lts += consumoLts;
            dailyData[date].costo += costo;
        });

        const daysCount = Object.keys(dailyData).length;
        if (daysCount === 0) return null;

        let totalDailyKm = 0;
        let totalDailyLts = 0;
        let totalDailyCosto = 0;
        Object.values(dailyData).forEach(d => {
            totalDailyKm += d.km;
            totalDailyLts += d.lts;
            totalDailyCosto += d.costo;
        });

        return {
            avgKm: totalDailyKm / daysCount,
            avgLts: totalDailyLts / daysCount,
            avgGalones: (totalDailyLts / daysCount) / 3.785,
            avgCosto: totalDailyCosto / daysCount,
        };
    }, [filteredLogs]);


    if (!currentUser) return null;

    return (
        <AnalysisPopoverProvider>
            <div className="-mx-2 md:-mx-4 -mt-4">
            <ModulePage
                title={`Análisis Detallado`}
                subtitle={unitInfo}
            >
                <ModuleToolbar>
                    <div className="flex items-center gap-2 flex-wrap">
                        <ActionButton
                            type="button"
                            onClick={() => {
                              if (onSetActiveModule) {
                                  onSetActiveModule({ module: 'vehicles_analysis' });
                              } else {
                                  navigate("/analisis-flota");
                              }
                            }}
                            className="!bg-white !text-slate-600 !border-slate-200 hover:!bg-slate-50 !w-auto shadow-sm font-bold text-xs uppercase tracking-widest rounded-xl !px-6"
                            label="VOLVER"
                            icon={<FiArrowLeft className="text-sm" />}
                        />
                        <ActionButton
                            type="button"
                            onClick={() => setShowExpenseModal(true)}
                            className="!bg-emerald-600 !text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:!bg-emerald-700 transition-colors !w-auto border-none shadow-sm !px-6"
                            label="REGISTRAR GASTO"
                        />
                    </div>

                    {/* SELECTORES DE MES Y AÑO */}
                    <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                        <div className="flex-1 md:w-36">
                            <Select
                                value={filterYear}
                                onChange={(val) => setFilterYear(Number(val))}
                                options={yearOptions}
                                isSearchable={false}
                                placeholder="Año"
                            />
                        </div>
                        <div className="flex-1 md:w-52">
                            <Select
                                value={filterMonth}
                                onChange={(val) => setFilterMonth(String(val))}
                                options={MONTH_NAMES}
                                isSearchable={false}
                                placeholder="Mes"
                            />
                        </div>
                    </div>
                </ModuleToolbar>

                <VehicleEventModal show={!!selectedEventLog} onClose={() => setSelectedEventLog(null)} log={selectedEventLog} />
                <FuelDetailModal show={showFuelModal} onClose={() => setShowFuelModal(false)} logs={filteredLogs} />
                <EventSummaryModal 
                    show={showEventSummaryModal} 
                    onClose={() => setShowEventSummaryModal(false)} 
                    logs={filteredLogs} 
                    onSelectEvent={(log) => {
                        setSelectedEventLog(log);
                        setShowEventSummaryModal(false);
                    }}
                />
                <VehicleExpenseModal
                    show={showExpenseModal}
                    onClose={() => {
                        setShowExpenseModal(false);
                        setSelectedBitacoraId(undefined);
                        setSelectedLogDate(undefined);
                        setSelectedLogMileage(undefined);
                        setEditingExpense(null);
                    }}
                    unidad={unidadParam}
                    bitacoraId={selectedBitacoraId || editingExpense?.bitacoraId}
                    defaultDate={selectedLogDate}
                    defaultMileage={selectedLogMileage}
                    currentUser={currentUser}
                    onSuccess={handleExpenseSuccess}
                    initialData={editingExpense}
                />

                {isLoading ? (
                    <div className="flex justify-center items-center p-10">Cargando detalles...</div>
                ) : (
                    <div className="space-y-6">
                        {/* INDICADORES PRINCIPALES */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Recorrido</span>
                                <div>
                                    <span className="text-2xl font-black text-blue-950">{metrics.totalKm.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-slate-500 ml-1">km</span>
                                </div>
                            </div>
                            <div 
                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-400 hover:shadow-md transition-all duration-300 group"
                                onClick={() => setShowFuelModal(true)}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-amber-600 transition-colors">Combustible</span>
                                        <FuelConsumptionPopover 
                                            totalLitros={metrics.totalLitros} 
                                            desktopAlignment="left"
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-300 group-hover:text-amber-600 transition-colors">→</span>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-amber-600">{metrics.totalLitros.toLocaleString(undefined, {maximumFractionDigits: 1})}</span>
                                        <span className="text-xs font-bold text-slate-500">L</span>
                                    </div>
                                    <div className="text-xs text-slate-400 font-medium">
                                        {metrics.totalGalones.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} galones
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-1 mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rendimiento</span>
                                    <EfficiencyPopover 
                                        kmPorGalon={metrics.kmPorGalon} 
                                        totalKm={metrics.totalKm} 
                                        totalGalones={metrics.totalGalones} 
                                        desktopAlignment="center"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-emerald-600">{metrics.kmPorGalon.toFixed(2)}</span>
                                        <span className="text-xs font-bold text-slate-500">km/gal</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-1 mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo por Km</span>
                                    <CostPerKmPopover 
                                        totalCombustible={metrics.costoCombustible} 
                                        totalKm={metrics.totalKm} 
                                        costPerKm={metrics.costoPorKm} 
                                        desktopAlignment="right"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-orange-600">₡{metrics.costoPorKm.toFixed(0)}</span>
                                        <span className="text-xs font-bold text-slate-500">/ km</span>
                                    </div>
                                </div>
                            </div>
                            <div 
                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-400 hover:shadow-md transition-all duration-300 group"
                                onClick={() => setShowEventSummaryModal(true)}
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-rose-600 transition-colors">Eventos</span>
                                    <span className="text-[10px] text-slate-300 group-hover:text-rose-600 transition-colors">→</span>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-rose-600">{metrics.totalEventos}</span>
                                        <span className="text-xs font-bold text-slate-500">Eventos</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CONSUMO PROMEDIO DIARIO */}
                        {advancedMetrics && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Consumo Promedio Diario</h3>
                                    <div className="flex gap-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-black text-blue-950">{advancedMetrics.avgKm.toFixed(1)} km/día</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Recorrido</span>
                                        </div>
                                        <div className="w-px h-8 bg-slate-100"></div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-black text-amber-600">{advancedMetrics.avgLts.toFixed(1)} L/día</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Consumo</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, (advancedMetrics.avgKm / 100) * 100)}%` }}
                                    ></div>
                                </div>
                                <p className="mt-3 text-[9px] text-slate-400 italic">Promedios basados en el histórico de recorridos registrados.</p>
                            </div>
                        )}

                        {/* RESUMEN DE COSTOS - INTERACTIVO */}
                        <div 
                            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all duration-300 group"
                            onClick={() => onSetActiveModule?.({ module: 'analisis_costos', selectedId: unidadId })}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                        <FiCreditCard className="text-blue-600 text-lg" />
                                    </div>
                                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-blue-700 transition-colors">Resumen de Costos</h3>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors cursor-pointer group/link">
                                    VER ANÁLISIS <FiArrowLeft className="rotate-180 transition-transform group-hover/link:translate-x-0.5" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Histórico</span>
                                    <div className="text-xl font-black text-slate-900">
                                        ₡{costSummary.totalHistorico.toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Gasto del Año ({filterYear})</span>
                                    <div className="text-xl font-black text-blue-600">
                                        ₡{costSummary.gastoAnio.toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {filterMonth === 'all' ? `Gasto del Período (${filterYear})` : `Gasto del Mes (${MONTH_NAMES.find(m => m.value === String(filterMonth))?.label || filterMonth})`}
                                    </span>
                                    <div className="text-xl font-black text-emerald-600">
                                        ₡{costSummary.gastoMes.toLocaleString()}
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

                        {/* HISTORIAL DE REGISTROS (BITACORAS) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                    Historial de Registros — {filterMonth === 'all' ? `Año ${filterYear}` : `${MONTH_NAMES.find(m => m.value === String(filterMonth))?.label} ${filterYear}`}
                                </h3>
                                <div className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase">
                                    {filteredLogs.length} {filteredLogs.length === 1 ? 'Bitácora' : 'Bitácoras'}
                                </div>
                            </div>

                            {filteredLogs.length === 0 ? (
                                <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
                                    <p className="text-sm font-medium text-slate-400 italic">
                                        No se encontraron registros de bitácora para esta unidad en {filterMonth === 'all' ? `el año ${filterYear}` : `${MONTH_NAMES.find(m => m.value === String(filterMonth))?.label} de ${filterYear}`}.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in duration-500">
                                    {filteredLogs.map((log) => (
                                        <div key={log.id} id={`log-${log.id}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 transition-all">
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Columna Izquierda */}
                                                <div className="space-y-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Fecha</span>
                                                        <span className="text-xs font-black text-slate-700">
                                                            {(() => {
                                                                if (!log.fecha) return '---';
                                                                if (log.fecha.includes('T')) return new Date(log.fecha).toLocaleDateString();
                                                                const [year, month, day] = log.fecha.split('-').map(Number);
                                                                return new Date(year, month - 1, day).toLocaleDateString();
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Conductor</span>
                                                        <span className="text-xs font-bold text-slate-600 truncate">{log._resolvedName || log.conductorName || 'N/A'}</span>
                                                    </div>
                                                </div>

                                                {/* Columna Derecha */}
                                                <div className="space-y-2 text-right">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Kilometraje</span>
                                                        <div className="text-xs font-black text-blue-600">
                                                            {log.kmSalida != null ? log.kmSalida.toLocaleString() : '---'} → {log.kmLlegada != null ? log.kmLlegada.toLocaleString() : '---'}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-blue-500/60">
                                                            +{((log.kmLlegada || 0) - (log.kmSalida || 0)).toLocaleString()} km
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* GASTOS ASOCIADOS A LA BITACORA */}
                                            {(() => {
                                                const logExpenses = expenses.filter(e => {
                                                    if (e.bitacoraId === log.id) return true;
                                                    if (e.sourceType === 'control_vehicular_mantenimiento' && !e.bitacoraId) {
                                                        const lUCode = getUnitCode((log as any)._resolvedUnidad, log.unidad, log.unidadId || log.unidadName) || extraerUnidad(log.unidadId);
                                                        const eUCode = getUnitCode(e.unidad, e.vehiculoId);
                                                        const lDate = normalizeDateToCanonical(log.fecha);
                                                        const eDate = normalizeDateToCanonical(e.fecha);
                                                        return !!(lUCode && eUCode && lUCode === eUCode && lDate && eDate && lDate === eDate);
                                                    }
                                                    return false;
                                                });
                                                if (logExpenses.length === 0) return null;
                                                return (
                                                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                            <FiCreditCard className="text-emerald-500" /> Gastos de este recorrido
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {logExpenses.map(exp => (
                                                                <div key={exp.id} className="flex justify-between items-center bg-white p-2 rounded-md border border-slate-100 shadow-sm group/exp">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-slate-900">{exp.descripcion}</span>
                                                                        <span className="text-[8px] text-slate-400 uppercase font-medium">{exp.categoria}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-slate-700">₡{exp.monto.toLocaleString()}</span>
                                                                        <div className="opacity-0 group-hover/exp:opacity-100 transition-opacity">
                                                                            <ActionButtons
                                                                                onEdit={() => {
                                                                                    setEditingExpense(exp);
                                                                                    setShowExpenseModal(true);
                                                                                }}
                                                                                onDelete={() => handleDeleteExpense(exp)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className="pt-3 mt-auto border-t border-slate-100 flex justify-between items-center">
                                                <div className="flex gap-1">
                                                    {(() => {
                                                        const logExpenses = expenses.filter(e => {
                                                            if (e.bitacoraId === log.id) return true;
                                                            if (e.sourceType === 'control_vehicular_mantenimiento' && !e.bitacoraId) {
                                                                const lUCode = getUnitCode((log as any)._resolvedUnidad, log.unidad, log.unidadId || log.unidadName) || extraerUnidad(log.unidadId);
                                                                const eUCode = getUnitCode(e.unidad, e.vehiculoId);
                                                                const lDate = normalizeDateToCanonical(log.fecha);
                                                                const eDate = normalizeDateToCanonical(e.fecha);
                                                                return !!(lUCode && eUCode && lUCode === eUCode && lDate && eDate && lDate === eDate);
                                                            }
                                                            return false;
                                                        });
                                                        if (logExpenses.length === 0) return null;
                                                        return (
                                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold border border-emerald-100">
                                                                <FiCreditCard className="text-[8px]" />
                                                                {logExpenses.reduce((acc, c) => acc + c.monto, 0).toLocaleString()} EN GASTOS
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <ActionButton
                                                    onClick={() => {
                                                        setSelectedBitacoraId(log.id);
                                                        setSelectedLogDate(log.fecha);
                                                        setSelectedLogMileage(log.kmLlegada);
                                                        setShowExpenseModal(true);
                                                    }}
                                                    variant="ghost"
                                                    className="!p-0 !h-auto !bg-transparent !text-[10px] font-bold !text-emerald-600 hover:!text-emerald-700 flex items-center gap-1 transition-colors uppercase tracking-wider !w-auto"
                                                    label="Asociar Gasto"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </ModulePage>
        </div>
        </AnalysisPopoverProvider>
    );
};
