import React, { useEffect, useState, Suspense, lazy } from 'react';
import { collection, query, where, limit, onSnapshot, orderBy, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useUserContext } from '../../contexts/UserContext';
import { isAdmin } from '../../utils/permissions';
import { DataTable } from '../../design-system';
import { FiServer, FiShield, FiCamera } from 'react-icons/fi';

const AuditDashboard = lazy(() => import('./AuditDashboard'));

function PhotoPolicySettings() {
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
                    photoPolicy: d.data().photoPolicy || { intervalDaysOverride: '', disabled: false }
                }));
                vehList.sort((a, b) => a.unidad.localeCompare(b.unidad));
                setVehicles(vehList);
            } catch (err) {
                console.error("Error loading photo policy settings:", err);
            }
        };
        loadData();
    }, []);

    const handleSaveGlobal = async () => {
        try {
            setSaving(true);
            await setDoc(doc(db, 'config', 'photo_policy'), { intervalDays: Number(globalInterval) }, { merge: true });
            setMessage("Configuración global guardada correctamente.");
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateVehiclePolicy = async (vehId: string, override: any, disabled: boolean) => {
        try {
            const numOverride = override === '' || override === null ? null : Number(override);
            await updateDoc(doc(db, 'vehiculos', vehId), {
                photoPolicy: {
                    intervalDaysOverride: isNaN(numOverride!) ? null : numOverride,
                    disabled: !!disabled
                }
            });
            setVehicles(prev => prev.map(v => v.id === vehId ? { ...v, photoPolicy: { intervalDaysOverride: numOverride, disabled } } : v));
            setMessage("Unidad actualizada.");
            setTimeout(() => setMessage(null), 2000);
        } catch (err: any) {
            alert("Error al actualizar unidad: " + err.message);
        }
    };

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
                    Política Global de Fotos de Bitácora
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                    Define cada cuántos días se requiere obligatoriamente una nueva fotografía de la bitácora al cerrar boleta.
                </p>
                <div className="flex items-center gap-4 max-w-md">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Días de Intervalo Global</label>
                        <input
                            type="number"
                            min="1"
                            max="365"
                            value={globalInterval}
                            onChange={(e) => setGlobalInterval(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                        />
                    </div>
                    <button
                        onClick={handleSaveGlobal}
                        disabled={saving}
                        className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Global'}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-sm font-bold text-slate-700">Excepciones y Overrides por Unidad</h2>
                    <p className="text-xs text-slate-500">Configura un intervalo específico o desactiva la exigencia de foto para unidades particulares.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                                <th className="p-3">Unidad / Placa</th>
                                <th className="p-3">Días Override (Opcional)</th>
                                <th className="p-3">Excluir Requisito (Disabled)</th>
                                <th className="p-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {vehicles.map(veh => (
                                <VehiclePolicyRow key={veh.id} veh={veh} onSave={handleUpdateVehiclePolicy} />
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

function VehiclePolicyRow({ veh, onSave }: { veh: any; onSave: (id: string, override: any, disabled: boolean) => void }) {
    const [override, setOverride] = useState(veh.photoPolicy?.intervalDaysOverride ?? '');
    const [disabled, setDisabled] = useState(veh.photoPolicy?.disabled ?? false);
    const [isSaving, setIsSaving] = useState(false);

    return (
        <tr className="hover:bg-slate-50/50">
            <td className="p-3 font-bold text-slate-900">
                {veh.unidad} <span className="font-normal text-slate-500">({veh.placa || 'Sin placa'})</span>
            </td>
            <td className="p-3">
                <input
                    type="number"
                    placeholder={`Global (${veh.photoPolicy?.intervalDaysOverride === null ? 'Default' : ''})`}
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                    className="w-36 px-2 py-1 border border-slate-300 rounded text-xs"
                />
            </td>
            <td className="p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={disabled}
                        onChange={(e) => setDisabled(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className={disabled ? "text-rose-600 font-bold" : "text-slate-600"}>
                        {disabled ? "Desactivado" : "Activo"}
                    </span>
                </label>
            </td>
            <td className="p-3 text-right">
                <button
                    onClick={async () => {
                        setIsSaving(true);
                        await onSave(veh.id, override, disabled);
                        setIsSaving(false);
                    }}
                    disabled={isSaving}
                    className="px-3 py-1 bg-slate-900 hover:bg-blue-600 text-white rounded text-[11px] font-bold transition-all disabled:opacity-50"
                >
                    {isSaving ? 'Guardando...' : 'Actualizar'}
                </button>
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

