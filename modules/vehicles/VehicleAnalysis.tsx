import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../utils/types';
import { ActionButton, useConfirm } from '../../design-system';
import { ModulePage } from '../../components/ui/ModulePage';
import { ModuleToolbar } from '../../components/ui/ModuleToolbar';
import { VehicleLog, extraerUnidad, extraerPlaca } from '../../types/vehicle.types';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { AnalysisPopoverProvider } from './components/AnalysisPopoverContext';
import { FiEye } from 'react-icons/fi';
import { FuelConsumptionPopover } from './components/FuelConsumptionPopover';
import { useLocalCollection } from '../../hooks/useLocalCollection';
import { localDocStore } from '../../core/offline/localDocStore';

interface VehicleAnalysisProps {
    currentUser: User;
}

export const VehicleAnalysis: React.FC<VehicleAnalysisProps> = ({ currentUser }) => {
    const { authReady } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState("todos");
    const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
    const localDocuments = useLocalCollection("bitacora_vehiculos");

    const allLogs = useMemo(() => {
        return localDocuments.map(d => ({ ...d.data, id: d.docId } as VehicleLog));
    }, [localDocuments]);

    const getDateRange = (range: string) => {
        const now = new Date();
        const startDate = new Date();
        if (range === 'semana') startDate.setDate(now.getDate() - 7);
        else if (range === 'mes') startDate.setMonth(now.getMonth() - 1);
        else if (range === 'año') startDate.setFullYear(now.getFullYear() - 1);
        else return { startDate: new Date(2000, 0, 1), endDate: new Date(3000, 0, 1) };
        return { startDate, endDate: now };
    };

    useEffect(() => {
        if (!authReady || !currentUser) return;
        
        // Evitamos parpadeo: solo cargando si no hay datos en el memo derivado de localDocuments
        if (allLogs.length === 0) {
            setIsLoading(true);
        }

        const { startDate, endDate } = getDateRange(dateRange);
        
        const q = query(
            collection(db, "bitacora_vehiculos"),
            where("fecha", ">=", startDate.toISOString().split('T')[0]),
            where("fecha", "<=", endDate.toISOString().split('T')[0]),
            orderBy("fecha", "desc")
        );
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id } as VehicleLog));

            setIsLoading(false);
            // Sync silent
            await localDocStore.saveLocalDocsBatch("bitacora_vehiculos", data);
        }, (error) => {
            console.error("Firestore listener error:", error);
            setIsLoading(false);
        });
        
        return () => unsubscribe();
    }, [authReady, currentUser, dateRange]);

    const logs = useMemo(() => {
        const { startDate, endDate } = getDateRange(dateRange);
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        return allLogs.filter(log => {
            if (log.isDeleted) return false;
            const logDate = log.fecha || "";
            if (logDate < startStr || logDate > endStr) return false;

            const unidad = log.unidad || extraerUnidad(log.unidadId);
            if (selectedUnit && selectedUnit !== "all" && unidad !== selectedUnit) return false;
            if (selectedDriver && selectedDriver !== "all" && log.conductorId !== selectedDriver) return false;
            return true;
        });
    }, [allLogs, selectedUnit, selectedDriver, dateRange]);

    const litrosAGalones = (litros: number) => litros / 3.785;

    const _metrics = useMemo(() => {
        let totalKm = 0;
        let totalLitros = 0;
        let costoTotal = 0;
        let totalEventos = 0;

        logs.forEach(log => {
            const km = log.totalKm || ((log.kmLlegada != null && log.kmSalida != null && log.kmLlegada >= log.kmSalida) ? (log.kmLlegada - log.kmSalida) : 0);
            const consumoLts = (log.litros != null && log.litros !== "") ? parseFloat(String(log.litros)) || 0 : 0;
            const costo = log.monto || (log as any).costo || 0;

            totalKm += km;
            totalLitros += consumoLts;
            costoTotal += costo;
            if (log.eventosCarretera === 'Sí') {
                totalEventos++;
            }
        });

        const totalGalones = litrosAGalones(totalLitros);
        const consumoPromedio = totalGalones > 0 ? totalKm / totalGalones : 0;
        const costoPorKm = totalKm > 0 ? costoTotal / totalKm : 0;

        return { totalKm, totalLitros, costoTotal, consumoPromedio, costoPorKm, totalEventos };
    }, [logs]);

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
                    costoTotal: 0,
                    totalEventos: 0,
                    registros: 0
                };
            }
            
            groups[uid].registros++;
            
            const km = log.totalKm || ((log.kmLlegada != null && log.kmSalida != null && log.kmLlegada >= log.kmSalida) ? (log.kmLlegada - log.kmSalida) : 0);
            const consumoLts = (log.litros != null && log.litros !== "") ? parseFloat(String(log.litros)) || 0 : 0;
            const costo = log.monto || (log as any).costo || 0;
            
            groups[uid].totalKm += km;
            groups[uid].totalLitros += consumoLts;
            groups[uid].costoTotal += costo;
            
            if (log.eventosCarretera === 'Sí') {
                groups[uid].totalEventos++;
            }
        });
        
        return Object.values(groups).map(g => {
            const totalGalones = litrosAGalones(g.totalLitros);
            g.rendimiento = g.totalLitros >= 1 && totalGalones > 0 ? (g.totalKm / totalGalones) : 0;
            return g;
        }).sort((a, b) => b.totalKm - a.totalKm);
    }, [logs]);



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
                    <div className="grid grid-cols-2 md:grid-cols-1 lg:flex lg:flex-row items-end gap-2 w-full">
                        <div className="w-full lg:flex-1 lg:min-w-[140px]">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Período</label>
                            <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold outline-none w-full cursor-pointer h-[34px]">
                                <option value="semana">Últimos 7 días</option>
                                <option value="mes">Último mes</option>
                                <option value="año">Último año</option>
                                <option value="todos">Todos</option>
                            </select>
                        </div>
                        <div className="w-full lg:flex-1 lg:min-w-[140px]">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Unidad</label>
                            <select value={selectedUnit || ''} onChange={e => setSelectedUnit(e.target.value || null)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none h-[34px]">
                                <option value="">Todas las unidades</option>
                                {uniqueVehicles.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div className="w-full lg:flex-1 lg:min-w-[140px]">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Conductor</label>
                            <select value={selectedDriver || ''} onChange={e => setSelectedDriver(e.target.value || null)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none h-[34px]">
                                <option value="">Todos los conductores</option>
                                {uniqueDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="w-full lg:w-auto lg:ml-auto pb-[1px]">
                            <label className="block lg:hidden text-[9px] font-bold text-transparent mb-1 ml-1 select-none">Exportar</label>
                            <ActionButton
                                label={
                                    <>
                                        <span className="hidden sm:inline">Exportar Reporte</span>
                                        <span className="sm:hidden">Exportar</span>
                                    </>
                                }
                                variant="secondary"
                                className="w-full md:w-auto !h-[34px] !min-h-0 flex items-center justify-center"
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
                    </div>
                </ModuleToolbar>

                {isLoading ? (
                    <div className="flex justify-center items-center p-10">Cargando datos...</div>
                ) : (
                    <div className="space-y-4">
                        {/* LISTA DE RESUMEN POR UNIDAD */}
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
                                                    onClick={() => navigate(`/analisis-flota/unidad/${unit.unidadId}`)}
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
                                            <div className="p-3 flex flex-col items-center md:items-start group transition-colors hover:bg-slate-50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-orange-600 transition-colors">Costo Total</span>
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
