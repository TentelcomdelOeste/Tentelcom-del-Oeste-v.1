import React, { useEffect, useState, Suspense, lazy } from 'react';
import { collection, query, where, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useUserContext } from '../../contexts/UserContext';
import { isAdmin } from '../../utils/permissions';
import { DataTable } from '../../design-system';
import { FiActivity, FiServer, FiShield } from 'react-icons/fi';

const AuditDashboard = lazy(() => import('./AuditDashboard'));

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
    const [activeTab, setActiveTab] = useState<'stats' | 'audit'>('stats');

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
                </div>
            </div>

            <main>
                {activeTab === 'stats' ? (
                    <HealthStats />
                ) : (
                    <Suspense fallback={<div className="p-12 text-center text-slate-400 font-bold">Cargando Auditoría...</div>}>
                        <AuditDashboard />
                    </Suspense>
                )}
            </main>
        </div>
    );
}

