import React, { useEffect, useState, Suspense, lazy } from 'react';
import { collection, query, where, limit, onSnapshot, orderBy, getDocs, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useUserContext } from '../../contexts/UserContext';
import { isAdmin } from '../../utils/permissions';
import { DataTable, ActionButton, useConfirm } from '../../design-system';
import { FiServer, FiShield, FiCamera, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { 
    checkVehiclePhotoPolicy, 
    getGlobalPolicyConfig, 
    saveGlobalPolicyConfig, 
    WEEK_DAYS, 
    WeekDay, 
    getTodayWeekDay, 
    getWeekDayLabel,
    VehicleWeeklyPolicyConfig 
} from '../../core/photoPolicy';

const AuditDashboard = lazy(() => import('./AuditDashboard'));

function PhotoPolicySettings() {
    const confirm = useConfirm();
    const [policyConfig, setPolicyConfig] = useState<VehicleWeeklyPolicyConfig>({
        enabled: true,
        photos: {
            enabled: true,
            days: ['monday', 'friday'],
        },
        inspection: {
            enabled: true,
            days: ['monday', 'friday'],
        },
    });
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const config = await getGlobalPolicyConfig(true);
            setPolicyConfig(config);

            const vehSnap = await getDocs(collection(db, 'vehiculos'));
            const vehList = vehSnap.docs.map(d => ({
                id: d.id,
                unidad: d.data().unidad || d.id,
                placa: d.data().placa || '',
                photoPolicy: d.data().photoPolicy || { disabled: false }
            }));
            vehList.sort((a, b) => a.unidad.localeCompare(b.unidad));
            setVehicles(vehList);
        } catch (err) {
            console.error("Error loading photo policy settings:", err);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const togglePhotoDay = (dayId: WeekDay) => {
        setPolicyConfig(prev => {
            const currentDays = prev.photos.days || [];
            const newDays = currentDays.includes(dayId)
                ? currentDays.filter(d => d !== dayId)
                : [...currentDays, dayId];
            return {
                ...prev,
                photos: {
                    ...prev.photos,
                    days: newDays,
                }
            };
        });
    };

    const toggleInspectionDay = (dayId: WeekDay) => {
        setPolicyConfig(prev => {
            const currentDays = prev.inspection.days || [];
            const newDays = currentDays.includes(dayId)
                ? currentDays.filter(d => d !== dayId)
                : [...currentDays, dayId];
            return {
                ...prev,
                inspection: {
                    ...prev.inspection,
                    days: newDays,
                }
            };
        });
    };

    const handleSaveGlobal = async () => {
        try {
            setSaving(true);
            await saveGlobalPolicyConfig({
                enabled: policyConfig.photos.enabled || policyConfig.inspection.enabled,
                photos: policyConfig.photos,
                inspection: policyConfig.inspection,
            });

            setMessage("Configuración semanal guardada exitosamente.");
            setTimeout(() => setMessage(null), 4000);
        } catch (err: any) {
            alert("Error al guardar la configuración: " + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateVehiclePolicy = async (vehId: string, disabled: boolean) => {
        await updateDoc(doc(db, 'vehiculos', vehId), {
            photoPolicy: {
                disabled: !!disabled
            }
        });
        setVehicles(prev => prev.map(v => v.id === vehId ? { 
            ...v, 
            photoPolicy: { ...v.photoPolicy, disabled: !!disabled } 
        } : v));
    };

    const todayWeekDay = getTodayWeekDay();
    const todayName = getWeekDayLabel(todayWeekDay);

    const activeCount = vehicles.filter(v => !v.photoPolicy?.disabled).length;
    const excludedCount = vehicles.filter(v => v.photoPolicy?.disabled).length;

    return (
        <div className="space-y-6">
            {message && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-sm flex items-center gap-2">
                    <FiCheck className="text-emerald-600 text-lg" />
                    <span>{message}</span>
                </div>
            )}

            {/* BANNER DE INFORMATIVO DE HOY */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        Día actual del sistema
                    </span>
                    <h3 className="text-base font-black text-slate-800 uppercase mt-1">
                        Hoy es {todayName}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                        Las solicitudes de fotografías y revisión se aplicarán inmediatamente a los registros creados hoy según los días configurados.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                        policyConfig.photos.enabled && todayWeekDay && policyConfig.photos.days.includes(todayWeekDay)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                    }`}>
                        Fotos Hoy: {policyConfig.photos.enabled && todayWeekDay && policyConfig.photos.days.includes(todayWeekDay) ? 'SÍ' : 'NO'}
                    </span>
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                        policyConfig.inspection.enabled && todayWeekDay && policyConfig.inspection.days.includes(todayWeekDay)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                    }`}>
                        Revisión Hoy: {policyConfig.inspection.enabled && todayWeekDay && policyConfig.inspection.days.includes(todayWeekDay) ? 'SÍ' : 'NO'}
                    </span>
                </div>
            </div>

            {/* CONFIGURACIÓN DE LAS DOS POLÍTICAS SEMANALES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. POLÍTICA DE FOTOGRAFÍAS */}
                <div className={`p-6 rounded-2xl border transition-all ${
                    policyConfig.photos.enabled ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'
                }`}>
                    <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                policyConfig.photos.enabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                                <FiCamera className="text-lg" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase">
                                    1. Fotografías de Bitácora
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Solicitud obligatoria de fotos de la unidad
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policyConfig.photos.enabled}
                                onChange={(e) => setPolicyConfig(prev => ({
                                    ...prev,
                                    photos: { ...prev.photos, enabled: e.target.checked }
                                }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="mt-4 space-y-3">
                        <label className="block text-xs font-bold text-slate-700 uppercase">
                            Días de la semana para exigir fotografías:
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {WEEK_DAYS.map(day => {
                                const isSelected = policyConfig.photos.days.includes(day.id);
                                const isToday = todayWeekDay === day.id;
                                return (
                                    <button
                                        key={day.id}
                                        type="button"
                                        disabled={!policyConfig.photos.enabled}
                                        onClick={() => togglePhotoDay(day.id)}
                                        className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase transition-all flex flex-col items-center justify-center gap-1 border ${
                                            !policyConfig.photos.enabled
                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span>{day.shortLabel}</span>
                                        {isToday && (
                                            <span className={`text-[8px] font-black uppercase px-1 rounded ${isSelected ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                                Hoy
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {policyConfig.photos.enabled 
                                ? (policyConfig.photos.days.length > 0 
                                    ? `Activa los días: ${policyConfig.photos.days.map(d => getWeekDayLabel(d)).join(', ')}.` 
                                    : 'Ningún día seleccionado (No se solicitarán fotos hasta seleccionar al menos un día).')
                                : 'Política de fotos desactivada.'
                            }
                        </p>
                    </div>
                </div>

                {/* 2. POLÍTICA DE REVISIÓN VEHICULAR */}
                <div className={`p-6 rounded-2xl border transition-all ${
                    policyConfig.inspection.enabled ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'
                }`}>
                    <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                policyConfig.inspection.enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                                <FiCheck className="text-lg" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase">
                                    2. Revisión de Unidad
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Inspección de 4 categorías técnicas y operativas
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policyConfig.inspection.enabled}
                                onChange={(e) => setPolicyConfig(prev => ({
                                    ...prev,
                                    inspection: { ...prev.inspection, enabled: e.target.checked }
                                }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <div className="mt-4 space-y-3">
                        <label className="block text-xs font-bold text-slate-700 uppercase">
                            Días de la semana para exigir revisión de unidad:
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {WEEK_DAYS.map(day => {
                                const isSelected = policyConfig.inspection.days.includes(day.id);
                                const isToday = todayWeekDay === day.id;
                                return (
                                    <button
                                        key={day.id}
                                        type="button"
                                        disabled={!policyConfig.inspection.enabled}
                                        onClick={() => toggleInspectionDay(day.id)}
                                        className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase transition-all flex flex-col items-center justify-center gap-1 border ${
                                            !policyConfig.inspection.enabled
                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span>{day.shortLabel}</span>
                                        {isToday && (
                                            <span className={`text-[8px] font-black uppercase px-1 rounded ${isSelected ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                                                Hoy
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {policyConfig.inspection.enabled 
                                ? (policyConfig.inspection.days.length > 0 
                                    ? `Activa los días: ${policyConfig.inspection.days.map(d => getWeekDayLabel(d)).join(', ')}.` 
                                    : 'Ningún día seleccionado (No se solicitará revisión hasta seleccionar al menos un día).')
                                : 'Política de revisión desactivada.'
                            }
                        </p>
                    </div>
                </div>

            </div>

            {/* BOTÓN GUARDAR CONFIGURACIÓN GLOBAL */}
            <div className="flex justify-end">
                <ActionButton
                    type="button"
                    variant="primary"
                    label={saving ? "Guardando Configuración..." : "Guardar Políticas Semanales"}
                    onClick={handleSaveGlobal}
                    disabled={saving}
                    className="!py-3 !px-6 !text-xs !font-black !uppercase !tracking-wider shadow-sm"
                />
            </div>

            {/* TABLA DE EXCEPCIONES Y EXCLUSIONES POR VEHÍCULO */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase">Exclusiones por Unidad</h2>
                        <p className="text-xs text-slate-600 font-medium">
                            Permite excluir unidades específicas para que nunca soliciten fotos ni revisión vehicular.
                        </p>
                    </div>
                    <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-black text-blue-900">
                        {activeCount} activas • {excludedCount} excluidas
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                                <th className="p-3.5">Unidad / Placa</th>
                                <th className="p-3.5">
                                    EXCLUIR DE POLÍTICAS
                                    <span className="block font-normal normal-case text-[10px] text-slate-500 mt-0.5">
                                        Si está excluida, nunca se le exigirá fotos ni revisión técnica.
                                    </span>
                                </th>
                                <th className="p-3.5">
                                    ESTADO HOY ({todayName})
                                    <span className="block font-normal normal-case text-[10px] text-slate-500 mt-0.5">
                                        Requisitos vigentes para hoy según la política semanal.
                                    </span>
                                </th>
                                <th className="p-3.5 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {vehicles.map(veh => (
                                <VehiclePolicyRow 
                                    key={veh.id} 
                                    veh={veh} 
                                    policyConfig={policyConfig}
                                    todayWeekDay={todayWeekDay}
                                    onSave={handleUpdateVehiclePolicy} 
                                />
                            ))}
                            {vehicles.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-slate-400 font-bold">No hay vehículos registrados</td>
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
    policyConfig,
    todayWeekDay,
    onSave 
}: { 
    veh: any; 
    policyConfig: VehicleWeeklyPolicyConfig;
    todayWeekDay: WeekDay | null;
    onSave: (id: string, disabled: boolean) => Promise<void> 
}) {
    const [disabled, setDisabled] = useState(Boolean(veh.photoPolicy?.disabled));
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        setDisabled(Boolean(veh.photoPolicy?.disabled));
    }, [veh.photoPolicy?.disabled]);

    const isExcluded = disabled;
    const isPhotoDay = Boolean(policyConfig.photos.enabled && todayWeekDay && policyConfig.photos.days.includes(todayWeekDay) && !isExcluded);
    const isInspectionDay = Boolean(policyConfig.inspection.enabled && todayWeekDay && policyConfig.inspection.days.includes(todayWeekDay) && !isExcluded);

    return (
        <tr className="hover:bg-slate-50/50">
            <td className="p-3.5 font-bold text-slate-900">
                <div className="flex items-center gap-2">
                    <span>{veh.unidad}</span>
                    <span className="font-normal text-slate-500">({veh.placa || 'Sin placa'})</span>
                </div>
            </td>
            <td className="p-3.5">
                <label className="flex items-center gap-2 select-none cursor-pointer">
                    <input
                        type="checkbox"
                        checked={disabled}
                        onChange={(e) => setDisabled(e.target.checked)}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                    />
                    <span className={disabled ? "text-rose-600 font-bold" : "text-slate-600 font-medium"}>
                        {disabled ? "Excluida de políticas" : "Activa (Sigue política semanal)"}
                    </span>
                </label>
            </td>
            <td className="p-3.5">
                {isExcluded ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold">
                        EXCLUIDA
                    </span>
                ) : (!isPhotoDay && !isInspectionDay) ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold">
                        Sin requisitos hoy
                    </span>
                ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {isPhotoDay && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[10px] font-black uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Fotos: Requerida
                            </span>
                        )}
                        {isInspectionDay && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-[10px] font-black uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Revisión: Requerida
                            </span>
                        )}
                    </div>
                )}
            </td>
            <td className="p-3.5 text-right">
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
                                await onSave(veh.id, disabled);
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

