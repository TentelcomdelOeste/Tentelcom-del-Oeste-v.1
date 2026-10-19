import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../utils/types';
import { ActionButton, useConfirm, Select } from '../../design-system';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { VehicleLog, extraerUnidad, extraerPlaca, VehicleExpense } from '../../types/vehicle.types';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { AnalysisPopoverProvider } from './components/AnalysisPopoverContext';
import { FiEye } from 'react-icons/fi';
import { FuelConsumptionPopover } from './components/FuelConsumptionPopover';
import { TotalCostPopover } from './components/TotalCostPopover';
import { useLocalCollection } from '../../hooks/useLocalCollection';
import { localDocStore } from '../../core/offline/localDocStore';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const MONTH_NAMES = [
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

interface VehicleAnalysisProps {
    currentUser: User;
    onSetActiveModule?: (module: any) => void;
}

export const VehicleAnalysis: React.FC<VehicleAnalysisProps> = ({ currentUser, onSetActiveModule }) => {
    const { authReady } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [filterYear, setFilterYear] = useState<number>(() => new Date().getFullYear());
    const [filterMonth, setFilterMonth] = useState<string>(() => String(new Date().getMonth() + 1));
    const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
    const localDocuments = useLocalCollection("bitacora_vehiculos");
    const localExpenses = useLocalCollection("vehicle_expenses");

    const allLogs = useMemo(() => {
        return localDocuments.map(d => ({ ...d.data, id: d.docId } as VehicleLog));
    }, [localDocuments]);

    const allExpenses = useMemo(() => {
        return localExpenses.map(d => ({ ...d.data, id: d.docId } as VehicleExpense));
    }, [localExpenses]);

    useEffect(() => {
        if (!authReady || !currentUser) return;
        
        if (allLogs.length === 0) {
            setIsLoading(true);
        }

        const q = query(
            collection(db, "bitacora_vehiculos"),
            orderBy("fecha", "desc")
        );
        
        const unsubscribeLogs = onSnapshot(q, async (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id } as VehicleLog));

            setIsLoading(false);
            await localDocStore.saveLocalDocsBatch("bitacora_vehiculos", data);
        }, (error) => {
            console.error("Firestore bitacora_vehiculos listener error:", error);
            setIsLoading(false);
        });

        const qExpenses = query(
            collection(db, "vehicle_expenses")
        );

        const unsubscribeExpenses = onSnapshot(qExpenses, async (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id } as any));
            await localDocStore.saveLocalDocsBatch("vehicle_expenses", data);
        }, (error) => {
            console.error("Firestore vehicle_expenses listener error:", error);
        });
        
        return () => {
            unsubscribeLogs();
            unsubscribeExpenses();
        };
    }, [authReady, currentUser]);

    const logs = useMemo(() => {
        return allLogs.filter(log => {
            if (log.isDeleted) return false;
            const logDate = log.fecha || "";
            if (!logDate) return false;

            if (filterYear !== 0) {
                if (!logDate.startsWith(String(filterYear))) return false;
                if (filterMonth !== "all" && !filterMonth.startsWith("week:")) {
                    const m = filterMonth.padStart(2, "0");
                    if (logDate.substring(5, 7) !== m) return false;
                }
            }

            const unidad = log.unidad || extraerUnidad(log.unidadId);
            if (selectedUnit && selectedUnit !== "all" && unidad !== selectedUnit) return false;
            if (selectedDriver && selectedDriver !== "all" && log.conductorId !== selectedDriver) return false;
            return true;
        });
    }, [allLogs, selectedUnit, selectedDriver, filterYear, filterMonth]);

    const filteredExpenses = useMemo(() => {
        return allExpenses.filter(exp => {
            if (exp.isDeleted) return false;
            const expDate = exp.fecha || "";
            if (!expDate) return false;
            
            if (filterYear !== 0) {
                if (!expDate.startsWith(String(filterYear))) return false;
                if (filterMonth !== "all" && !filterMonth.startsWith("week:")) {
                    const m = filterMonth.padStart(2, "0");
                    if (expDate.substring(5, 7) !== m) return false;
                }
            }
            
            const expUnidad = exp.unidad;
            if (selectedUnit && selectedUnit !== "all" && expUnidad !== selectedUnit) return false;
            return true;
        });
    }, [allExpenses, selectedUnit, filterYear, filterMonth]);

    const litrosAGalones = (litros: number) => litros / 3.785;

    const _metrics = useMemo(() => {
        let totalKm = 0;
        let totalLitros = 0;
        let costoTotal = 0;
        let totalEventos = 0;

        logs.forEach(log => {
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

            totalKm += km;
            totalLitros += logLitros;
            if (log.eventosCarretera === 'Sí') {
                totalEventos++;
            }
        });

        filteredExpenses.forEach(exp => {
            costoTotal += exp.monto || 0;
        });

        logs.forEach(log => {
            const hasAssociated = filteredExpenses.some(exp => exp.bitacoraId === log.id);
            if (!hasAssociated) {
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
                costoTotal += logCosto;
            }
        });

        const totalGalones = litrosAGalones(totalLitros);
        const consumoPromedio = totalGalones > 0 ? totalKm / totalGalones : 0;
        const costoPorKm = totalKm > 0 ? costoTotal / totalKm : 0;
        
        return { totalKm, totalLitros, costoTotal, consumoPromedio, costoPorKm, totalEventos };
    }, [logs, filteredExpenses]);

    const uniqueDrivers = useMemo(() => {
        const driversMap = new Map();
        allLogs.forEach(log => {
            if (log.conductorId && log.conductorName) {
                driversMap.set(log.conductorId, log.conductorName);
            }
        });
        return Array.from(driversMap.entries()).map(([id, name]) => ({ id, name }));
    }, [allLogs]);

    const uniqueVehicles = useMemo(() => {
        const vMap = new Map();
        allLogs.forEach(log => {
            const unidad = log.unidad || extraerUnidad(log.unidadId);
            if (unidad) {
                const placa = log.placa || extraerPlaca(log.unidadId);
                vMap.set(unidad, placa ? `${unidad} - ${placa}` : unidad);
            }
        });
        return Array.from(vMap.entries()).map(([id, name]) => ({ id, name }));
    }, [allLogs]);

    const availableYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [currentYear];
        allLogs.forEach((log) => {
            const dateStr = log.fecha || log.createdAt || "";
            if (!dateStr) return;
            const y = parseInt(dateStr.split("-")[0]);
            if (y && !isNaN(y) && !years.includes(y)) years.push(y);
        });
        return Array.from(new Set(years)).sort((a, b) => b - a);
    }, [allLogs]);

    const yearOptions = useMemo(() => [
        { label: "Todos los años", value: 0 },
        ...availableYears.map((y) => ({ label: String(y), value: y })),
    ], [availableYears]);

    const monthOptions = useMemo(() => {
        const options = [{ label: "Todos los meses", value: "all" }];
        MONTH_NAMES.forEach(m => options.push({ label: m.label.toUpperCase(), value: m.value }));
        return options;
    }, []);

    const groupedByUnit = useMemo(() => {
        const groups: Record<string, any> = {};

        logs.forEach(log => {
            const uid = log.unidad || extraerUnidad(log.unidadId);
            if (!uid) return;
            
            if (!groups[uid]) {
                const placa = log.placa || extraerPlaca(log.unidadId);
                groups[uid] = {
                    unidadId: uid,
                    unidadName: uid,
                    placa: placa,
                    totalKm: 0,
                    totalLitros: 0,
                    costoCombustible: 0,
                    costoTotal: 0,
                    costBreakdown: {} as Record<string, number>,
                    totalEventos: 0,
                    registros: 0
                };
            }
            
            groups[uid].registros++;
            
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
            
            groups[uid].totalKm += km;
            groups[uid].totalLitros += logLitros;
            groups[uid].costoCombustible += logCosto;
            
            if (log.eventosCarretera === 'Sí') {
                groups[uid].totalEventos++;
            }
        });

        filteredExpenses.forEach(exp => {
            const uid = exp.unidad;
            if (!uid) return;

            if (!groups[uid]) {
                groups[uid] = {
                    unidadId: uid,
                    unidadName: uid,
                    placa: '',
                    totalKm: 0,
                    totalLitros: 0,
                    costoCombustible: 0,
                    costoTotal: 0,
                    costBreakdown: {} as Record<string, number>,
                    totalEventos: 0,
                    registros: 0
                };
            }

            if (exp.categoria !== 'Combustible') {
                const expMonto = exp.monto || 0;
                const categoria = exp.categoria || 'Gasto General';
                groups[uid].costBreakdown[categoria] = (groups[uid].costBreakdown[categoria] || 0) + expMonto;
            }
        });

        return Object.values(groups).map((g: any) => {
            const totalGalones = litrosAGalones(g.totalLitros);
            g.rendimiento = g.totalLitros >= 1 && totalGalones > 0 ? (g.totalKm / totalGalones) : 0;
            
            let nonFuelCost = 0;
            Object.entries(g.costBreakdown).forEach(([cat, monto]) => {
                nonFuelCost += Number(monto) || 0;
            });

            g.costoTotal = g.costoCombustible + nonFuelCost;
            g.costBreakdown['Combustible'] = g.costoCombustible;

            return g;
        }).sort((a, b) => b.totalKm - a.totalKm);
    }, [logs, filteredExpenses]);


    if (!currentUser) {
        return <div className="p-4 bg-yellow-100 text-yellow-800">Cargando datos de usuario...</div>;
    }

    if (!currentUser?.permissions?.bitacoraVehiculos?.analisis) {
        return <div className="p-4 bg-red-100 text-red-800">No tienes permisos para acceder a esta sección.</div>;
    }

    return (
        <AnalysisPopoverProvider>
            <div className="-mx-2 md:-mx-4 -mt-4">
            <ModulePage
                title="Análisis de Flota"
                subtitle="Análisis de rendimiento, consumos y eventos de la flota vehicular."
            >
                <ModuleToolbar>
                    <div className="grid grid-cols-2 md:grid-cols-4 items-end gap-2 w-full">
                        <div className="w-full">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Año</label>
                            <Select value={filterYear} onChange={setFilterYear} options={yearOptions} isSearchable={false} />
                        </div>
                        <div className="w-full">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Mes</label>
                            <Select value={filterMonth} onChange={setFilterMonth} options={monthOptions} isSearchable={false} />
                        </div>
                        <div className="w-full">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Unidad</label>
                            <select value={selectedUnit || ''} onChange={e => setSelectedUnit(e.target.value || null)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none h-[34px]">
                                <option value="">Todas las unidades</option>
                                {uniqueVehicles.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div className="w-full">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Conductor</label>
                            <select value={selectedDriver || ''} onChange={e => setSelectedDriver(e.target.value || null)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none h-[34px]">
                                <option value="">Todos los conductores</option>
                                {uniqueDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                        <ActionButton
                            label="Exportar Reporte"
                            variant="secondary"
                            className="!h-[34px] !min-h-0 flex items-center justify-center"
                            onClick={async () => {
                                await confirm({
                                    title: 'Exportar Reporte',
                                    description: '¿Desea generar el reporte de análisis de flota para el período seleccionado?',
                                    confirmLabel: 'EXPORTAR',
                                    variant: 'primary'
                                });
                            }}
                        />
                    </div>
                </ModuleToolbar>

                {isLoading ? (
                    <div className="flex justify-center items-center p-10">Cargando datos...</div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-4 mt-2">
                            <h3 className="text-sm font-bold text-slate-700 px-1">Rendimiento por Unidad</h3>
                            {groupedByUnit.length === 0 ? (
                                <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 shadow-sm text-slate-500 font-medium">
                                    No hay datos para mostrar en este período.
                                </div>
                            ) : (
                                groupedByUnit.map((unit) => (
                                    <div key={unit.unidadId} className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-500 flex flex-col">
                                        <div className="px-4 py-1.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">
                                                Unidad: {unit.unidadName} <span className="text-slate-300 mx-1">|</span> Placa: {unit.placa || '---'}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                                    {unit.registros} {unit.registros === 1 ? 'REGISTRO' : 'REGISTROS'}
                                                </span>
                                                <ActionButton 
                                                    className="flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 transition-colors shadow-sm !w-auto"
                                                    onClick={() => {
                                                        if (onSetActiveModule) {
                                                            onSetActiveModule({ module: 'vehicles_analysis_detail', selectedId: unit.unidadId });
                                                        }
                                                        navigate(`/analisis-flota/unidad/${encodeURIComponent(unit.unidadId)}`);
                                                    }}
                                                    label={<span className="hidden md:inline">VER DETALLE</span>}
                                                    icon={<FiEye className="text-[14px]" />}
                                                />
                                            </div>
                                        </div>
                                        <div className="divide-y md:divide-y-0 md:divide-x divide-slate-100 grid grid-cols-2 md:grid-cols-5">
                                            <div className="p-3 flex flex-col items-center md:items-start group transition-colors hover:bg-slate-50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-600 transition-colors">Total KM</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg md:text-xl font-black text-blue-950">{unit.totalKm.toLocaleString()}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">km</span>
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col items-center md:items-start group transition-colors hover:bg-slate-50 relative">
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-amber-600 transition-colors">Consumo Total</span>
                                                    <FuelConsumptionPopover totalLitros={unit.totalLitros} />
                                                </div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg md:text-xl font-black text-blue-950">{(unit.totalLitros / 3.785).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">GAL</span>
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col items-center md:items-start group transition-colors hover:bg-slate-50 relative">
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-orange-600 transition-colors">Costo Total</span>
                                                    <TotalCostPopover totalCost={unit.costoTotal} breakdown={unit.costBreakdown} />
                                                </div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg md:text-xl font-black text-orange-600">₡{unit.costoTotal.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col items-center md:items-start group transition-colors hover:bg-slate-50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-emerald-600 transition-colors">Rendimiento</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg md:text-xl font-black text-emerald-600">{unit.rendimiento.toFixed(2)}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">km/gal</span>
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col items-center md:items-start group transition-colors hover:bg-slate-50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-red-600 transition-colors">Alertas</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-lg md:text-xl font-black ${unit.totalEventos > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                        {unit.totalEventos}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Eventos</span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                ))
                            )}
                        </div>

                    </div>
                )}
            </ModulePage>
        </div>
        </AnalysisPopoverProvider>
    );
};
