import React, { useEffect, useState, Suspense, lazy } from 'react';
import { collection, query, where, limit, onSnapshot, orderBy, getDocs, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useUserContext } from '../../contexts/UserContext';
import { isAdmin } from '../../utils/permissions';
import { DataTable, ActionButton, useConfirm } from '../../design-system';
import { FiServer, FiShield, FiCamera, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { checkVehiclePhotoPolicy, calculateRemainingBusinessDays } from '../../core/photoPolicy';

const AuditDashboard = lazy(() => import('./AuditDashboard'));

function PhotoPolicySettings() {
    const confirm = useConfirm();
    const [globalInterval, setGlobalInterval] = useState<number>(15);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const configSnap = await getDoc(doc(db, 'config', 'photo_policy'));
                if (configSnap.exists()) {
                    const data = configSnap.data();
                    if (typeof data.intervalDays === 'number') {
                        setGlobalInterval(data.intervalDays);
                    }
                }

                const vehSnap = await getDocs(collection(db, 'vehiculos'));
                const vehList = vehSnap.docs.map(d => ({
                    id: d.id,
                    unidad: d.data().unidad || d.id,
                    placa: d.data().placa || '',
                    photoPolicy: d.data().photoPolicy || { intervalDaysOverride: null, disabled: false }
                }));
                vehList.sort((a, b) => a.unidad.localeCompare(b.unidad));
                setVehicles(vehList);
            } catch (err) {
                console.error("Error loading photo policy settings:", err);
            }
        };
        loadData();
    }, []);

    // Check if any vehicle currently has an exception (override or disabled)
    const hasActiveExceptions = vehicles.some(v => 
        (typeof v.photoPolicy?.intervalDaysOverride === 'number' && v.photoPolicy?.intervalDaysOverride >= 0) || 
        Boolean(v.photoPolicy?.disabled)
    );

    const handleSaveGlobal = async () => {
        const newInterval = Number(globalInterval);
        if (isNaN(newInterval) || newInterval < 1) {
            alert("Por favor ingrese un número válido de días laborales (mínimo 1).");
            return;
        }

        // Check if confirmation is required due to existing overrides/exceptions
        if (hasActiveExceptions) {
            const confirmed = await confirm({
                title: "¿Cambiar la política global y restablecer excepciones?",
                description: "Al guardar el nuevo intervalo global, todas las unidades volverán a utilizar este valor. Se eliminarán los intervalos personalizados y las exclusiones actuales.",
                confirmLabel: "CONFIRMAR Y GUARDAR",
                cancelLabel: "CANCELAR",
                type: "warning"
            });
            if (!confirmed) return;
        }

        try {
            setSaving(true);
            // 1. Update global config in Firestore
            await setDoc(doc(db, 'config', 'photo_policy'), { intervalDays: newInterval }, { merge: true });

            // 2. Reset photoPolicy on ALL vehicles in Firestore (clean overrides and disabled)
            const vehsToReset = vehicles.filter(v => 
                (typeof v.photoPolicy?.intervalDaysOverride === 'number' && v.photoPolicy?.intervalDaysOverride !== null) || 
                v.photoPolicy?.disabled
            );

            if (vehsToReset.length > 0) {
                // Batch updates in chunks of 450 (Firestore limit is 500)
                const chunkSize = 450;
                for (let i = 0; i < vehsToReset.length; i += chunkSize) {
                    const chunk = vehsToReset.slice(i, i + chunkSize);
                    const batch = writeBatch(db);
                    for (const v of chunk) {
                        batch.update(doc(db, 'vehiculos', v.id), {
                            photoPolicy: {
                                intervalDaysOverride: null,
                                disabled: false
                            }
                        });
                    }
                    await batch.commit();
                }
            }

            // 3. Update local state immediately so all vehicles reflect Global
            setVehicles(prev => prev.map(v => ({
                ...v,
                photoPolicy: {
                    intervalDaysOverride: null,
                    disabled: false
                }
            })));

            setMessage(`Nueva política global guardada (${newInterval} días laborales). Todas las excepciones han sido restablecidas.`);
            setTimeout(() => setMessage(null), 4000);
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateVehiclePolicy = async (vehId: string, override: any, disabled: boolean) => {
        const numOverride = override === '' || override === null ? null : Number(override);
        const cleanOverride = numOverride === null || isNaN(numOverride) ? null : numOverride;
        const cleanDisabled = !!disabled;

        await updateDoc(doc(db, 'vehiculos', vehId), {
            photoPolicy: {
                intervalDaysOverride: cleanOverride,
                disabled: cleanDisabled
            }
        });
        setVehicles(prev => prev.map(v => v.id === vehId ? { 
            ...v, 
            photoPolicy: { intervalDaysOverride: cleanOverride, disabled: cleanDisabled } 
        } : v));
    };

    const unidadCounts = vehicles.reduce((acc: Record<string, number>, v: any) => {
        acc[v.unidad] = (acc[v.unidad] || 0) + 1;
        return acc;
    }, {});
    const isDuplicate = (unidad: string) => (unidadCounts[unidad] || 0) > 1;

    const globalCount = vehicles.filter(v => (v.photoPolicy?.intervalDaysOverride === null || v.photoPolicy?.intervalDaysOverride === undefined || v.photoPolicy?.intervalDaysOverride === '') && !v.photoPolicy?.disabled).length;
    const overrideCount = vehicles.filter(v => typeof v.photoPolicy?.intervalDaysOverride === 'number' && !v.photoPolicy?.disabled).length;
    const excludedCount = vehicles.filter(v => v.photoPolicy?.disabled).length;

    return (
        <div className="space-y-6">
            {message && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-sm">
                    {message}
                </div>
            )}
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <FiCamera className="text-blue-600" />
                    POLÍTICA GLOBAL DE FOTOS Y REVISIÓN VEHICULAR
                </h2>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Define cada cuántos días laborales todas las unidades deberán realizar nuevamente la fotografía y la revisión de la unidad.
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 max-w-lg">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            INTERVALO GLOBAL (DÍAS LABORALES)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="365"
                            value={globalInterval}
                            onChange={(e) => setGlobalInterval(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <span className="block text-[11px] text-slate-500 mt-1 font-normal">
                            Ejemplo: 10 = solicitar nuevamente cada 10 días laborales. Sábados y domingos no cuentan.
                        </span>
                    </div>
                    <ActionButton
                        type="button"
                        variant="primary"
                        label={saving ? "Guardando..." : "Guardar Global"}
                        onClick={handleSaveGlobal}
                        disabled={saving}
                        className="!py-2.5 !px-5 !text-xs !font-black !uppercase !tracking-wider w-full sm:w-auto shrink-0"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-2">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Excepciones y Overrides por Unidad</h2>
                        <p className="text-xs text-slate-600">
                            Todas las unidades utilizan el intervalo global, excepto aquellas configuradas manualmente aquí.
                        </p>
                    </div>
                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-900">
                        {globalCount} usando Global, {overrideCount} con intervalo personalizado, {excludedCount} excluidas.
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                                <th className="p-3">Unidad / Placa</th>
                                <th className="p-3">
                                    DÍAS OVERRIDE
                                    <span className="block font-normal normal-case text-[10px] text-slate-500 mt-0.5">
                                        Vacío = usa el intervalo global. Un número = intervalo personalizado para esta unidad.
                                    </span>
                                </th>
                                <th className="p-3">
                                    EXCLUIR REQUISITO
                                    <span className="block font-normal normal-case text-[10px] text-slate-500 mt-0.5">
                                        Actívelo únicamente si esta unidad nunca debe solicitar fotografía ni revisión mediante esta política.
                                    </span>
                                </th>
                                <th className="p-3">
                                    ESTADO ACTUAL
                                    <span className="block font-normal normal-case text-[10px] text-slate-500 mt-0.5">
                                        Estado en tiempo real calculado por política de días laborales.
                                    </span>
                                </th>
                                <th className="p-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {vehicles.map(veh => (
                                <VehiclePolicyRow 
                                    key={`${veh.id}-${veh.photoPolicy?.intervalDaysOverride ?? 'g'}-${veh.photoPolicy?.disabled ? 'd' : 'a'}`} 
                                    veh={veh} 
                                    globalInterval={globalInterval}
                                    isDuplicate={isDuplicate(veh.unidad)} 
                                    onSave={handleUpdateVehiclePolicy} 
                                />
                            ))}
                            {vehicles.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-slate-400 font-bold">No hay vehículos registrados</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function VehiclePolicyRow({ 
    veh, 
    globalInterval,
    isDuplicate, 
    onSave 
}: { 
    veh: any; 
    globalInterval: number;
    isDuplicate: boolean; 
    onSave: (id: string, override: any, disabled: boolean) => Promise<void> 
}) {
    const [override, setOverride] = useState(
        veh.photoPolicy?.intervalDaysOverride !== null && veh.photoPolicy?.intervalDaysOverride !== undefined 
            ? String(veh.photoPolicy.intervalDaysOverride) 
            : ''
    );
    const [disabled, setDisabled] = useState(Boolean(veh.photoPolicy?.disabled));
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [policyStatus, setPolicyStatus] = useState<{ vencida: boolean; intervalDays: number; disabled: boolean; ultimaFotoDate: Date | null; fechaLimite: Date | null } | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);

    // Keep internal row input state in sync if parent resets vehicles
    useEffect(() => {
        setOverride(
            veh.photoPolicy?.intervalDaysOverride !== null && veh.photoPolicy?.intervalDaysOverride !== undefined 
                ? String(veh.photoPolicy.intervalDaysOverride) 
                : ''
        );
        setDisabled(Boolean(veh.photoPolicy?.disabled));
    }, [veh.photoPolicy]);

    useEffect(() => {
        let isMounted = true;
        const fetchStatus = async () => {
            try {
                const res = await checkVehiclePhotoPolicy(veh.unidad);
                if (isMounted) {
                    setPolicyStatus(res);
                }
            } catch (e) {
                console.error("Error fetching policy status:", e);
            } finally {
                if (isMounted) setLoadingStatus(false);
            }
        };
        fetchStatus();
        return () => { isMounted = false; };
    }, [veh.unidad, veh.photoPolicy, globalInterval]);

    // Determine configuration type (GLOBAL, PERSONALIZADO, EXCLUIDA)
    const isCustomOverride = typeof veh.photoPolicy?.intervalDaysOverride === 'number' && veh.photoPolicy?.intervalDaysOverride >= 0;
    const isExcluded = Boolean(veh.photoPolicy?.disabled);

    return (
        <tr className={`hover:bg-slate-50/50 ${isDuplicate ? 'bg-amber-50/30' : ''}`}>
            <td className="p-3 font-bold text-slate-900">
                <div className="flex items-center gap-2">
                    <span>{veh.unidad}</span>
                    <span className="font-normal text-slate-500">({veh.placa || 'Sin placa'})</span>
                </div>
                {isDuplicate && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 w-fit">
                        <FiAlertTriangle className="text-amber-600 shrink-0" />
                        <span>Unidad duplicada — revisar en Firestore manualmente</span>
                    </div>
                )}
            </td>
            <td className="p-3">
                <input
                    type="number"
                    min="1"
                    placeholder="Global"
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                    className="w-32 px-2 py-1.5 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
            </td>
            <td className="p-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={disabled}
                        onChange={(e) => setDisabled(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className={disabled ? "text-rose-600 font-bold" : "text-slate-600"}>
                        {disabled ? "Excluida" : "Activo"}
                    </span>
                </label>
            </td>
            <td className="p-3">
                {loadingStatus ? (
                    <span className="text-[11px] text-slate-400">Calculando...</span>
                ) : isExcluded || policyStatus?.disabled ? (
                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">
                        EXCLUIDA
                    </span>
                ) : policyStatus?.vencida ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        REQUERIDA AHORA
                    </span>
                ) : (
                    (() => {
                        const now = new Date();
                        const targetDate = policyStatus?.fechaLimite || now;
                        const remainingBusinessDays = calculateRemainingBusinessDays(now, targetDate);
                        const prefix = isCustomOverride ? "PERSONALIZADO" : "GLOBAL";

                        return (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-[11px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {prefix} — faltan {remainingBusinessDays} {remainingBusinessDays === 1 ? 'día' : 'días'}
                            </span>
                        );
                    })()
                )}
            </td>
            <td className="p-3 text-right">
                <div className="flex flex-col items-end gap-1">
                    <ActionButton
                        type="button"
                        variant={saveSuccess ? "success" : "primary"}
                        label={isSaving ? "Guardando..." : saveSuccess ? "Guardado" : "Guardar"}
                        icon={saveSuccess ? <FiCheck className="text-sm" /> : undefined}
                        onClick={async () => {
                            setIsSaving(true);
                            setSaveError(null);
                            try {
                                await onSave(veh.id, override, disabled);
                                setSaveSuccess(true);
                                setTimeout(() => setSaveSuccess(false), 2500);
                            } catch (err: any) {
                                setSaveError(err.message || "Error");
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving}
                        className="!py-1.5 !px-3 !text-[11px] !font-black !uppercase !tracking-wider !rounded-lg"
                    />
                    {saveError && <span className="text-[10px] text-rose-600 font-bold">{saveError}</span>}
                </div>
            </td>
        </tr>
    );
}

function HealthStats() {
    const { currentUser } = useUserContext();
    const { authReady } = useAuth();
    
    const [pendingUploads, setPendingUploads] = useState<any[]>([]);
    const [fcmTokensCount, setFcmTokensCount] = useState<number>(0);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    useEffect(() => {
        if (!authReady || !currentUser || !isAdmin(currentUser.role)) return;

        // a) Uploads pendientes/huérfanos (colección media)
        const uploadsQ = query(
            collection(db, "media"),
            where("uploadStatus", "in", ["pending", "orphaned"]),
            limit(50)
        );
        const unsubUploads = onSnapshot(uploadsQ, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingUploads(data);
        });

        // b) Tokens FCM activos
        const usersQ = query(collection(db, "employees"));
        const unsubUsers = onSnapshot(usersQ, (snap) => {
            let count = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    count += data.fcmTokens.length;
                }
            });
            setFcmTokensCount(count);
        });

        // c) Últimas acciones auditadas
        const auditQ = query(
            collection(db, "audit_log"),
            orderBy("timestamp", "desc"),
            limit(20)
        );
        const unsubAudit = onSnapshot(auditQ, (snap) => {
            const logs = snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    actionType: data.actionType,
                    collection: data.collection,
                    docId: data.docId,
                    triggeredBy: data.triggeredBy,
                    timestamp: data.timestamp?.toDate?.() || new Date()
                };
            });
            setAuditLogs(logs);
        });

        return () => {
            unsubUploads();
            unsubUsers();
            unsubAudit();
        };
    }, [authReady, currentUser]);

    const auditColumns = [
        {
            key: 'timestamp',
            header: 'Fecha',
            render: (item: any) => item.timestamp.toLocaleString()
        },
        { key: 'actionType', header: 'Acción' },
        { key: 'collection', header: 'Colección' },
        { key: 'docId', header: 'ID Documento' },
        { key: 'triggeredBy', header: 'Por' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">Uploads Pendientes / Huérfanos</p>
                    <p className="text-2xl font-black text-rose-600 mt-2">{pendingUploads.length}</p>
                    {pendingUploads.length > 0 && (
                        <div className="mt-2 text-xs text-slate-600 space-y-1">
                            {pendingUploads.map(up => (
                                <div key={up.id} className="truncate">{up.id} ({up.uploadStatus})</div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">Tokens FCM Activos</p>
                    <p className="text-2xl font-black text-blue-600 mt-2">{fcmTokensCount}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-sm font-bold text-slate-700">Últimas Acciones Auditadas</h2>
                </div>
                <div className="p-4">
                    <DataTable 
                        data={auditLogs}
                        columns={auditColumns}
                        keyExtractor={(item) => item.id}
                        emptyMessage="No hay acciones recientes registradas"
                    />
                </div>
            </div>
        </div>
    );
}

export default function HealthDashboard(): JSX.Element | null {
    const { currentUser } = useUserContext();
    const [activeTab, setActiveTab] = useState<'stats' | 'audit' | 'photo_policy'>('stats');

    if (!currentUser || !isAdmin(currentUser.role)) {
        return null;
    }

    return (
        <div className="p-4 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-2xl font-black text-blue-950 uppercase tracking-tighter">Administración del Sistema</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión de salud, monitoreo y auditoría</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('stats')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'stats' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FiServer className="text-sm" />
                        Salud
                    </button>
                    <button 
                        onClick={() => setActiveTab('audit')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FiShield className="text-sm" />
                        Auditoría
                    </button>
                    <button 
                        onClick={() => setActiveTab('photo_policy')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'photo_policy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FiCamera className="text-sm" />
                        Política de Fotos
                    </button>
                </div>
            </div>

            <main>
                {activeTab === 'stats' && <HealthStats />}
                {activeTab === 'audit' && (
                    <Suspense fallback={<div className="p-12 text-center text-slate-400 font-bold">Cargando Auditoría...</div>}>
                        <AuditDashboard />
                    </Suspense>
                )}
                {activeTab === 'photo_policy' && <PhotoPolicySettings />}
            </main>
        </div>
    );
}

