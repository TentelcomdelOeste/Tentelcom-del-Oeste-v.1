import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../utils/types';
import { VehicleLog, VehicleRecharge, VehicleExpense, INSPECTION_ITEMS, getDefaultVehicleInspection, normalizeVehicleInspection, InspectionOption, InspectionItemDef } from '../../types/vehicle.types';
import { db } from '../../firebase';
import { collection, query, getDocs, orderBy, where, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { localDocStore } from '../../core/offline/localDocStore';
import { offlineQueueEngine } from '../../core/offline/offlineQueueEngine';
import { VEHICLES } from '../job_scheduling/JobForm';
import { useAuditPermanence } from '../../hooks/useAuditPermanence';
import { Select, ActionButton, IconButton, useConfirm } from '../../design-system';
import { SignaturePad } from '../../components/SignaturePad';
import { FiX, FiAlertTriangle, FiCreditCard, FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { isAdmin as checkIsAdmin } from '../../utils/permissions';
import { saveVehicleLog, deleteVehicleLogPhoto, SaveProgressInfo } from './vehicleService';
import { VehicleExpenseModal } from './components/VehicleExpenseModal';
import { checkVehiclePhotoPolicy } from '../../core/photoPolicy';
import { networkProbe } from '../../core/offline/networkProbe';

interface VehicleLogModalProps {
    show: boolean;
    onClose: (result?: any) => void;
    currentUser: User;
    initialData?: VehicleLog | null;
    initialEmployees?: {id: string, name: string}[];
    trabajoId?: string; // New prop
}

export const VehicleLogModal: React.FC<VehicleLogModalProps> = ({ show, onClose, currentUser, initialData, initialEmployees = [], trabajoId }) => {
    useAuditPermanence({
        module: 'Bitácora de Vehículos',
        submodule: 'Registro de Bitácora',
        recordId: initialData?.id,
        recordCode: initialData?.unidad,
        enabled: show
    });

    // Lock body scroll when modal is open
    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [show]);
    const confirm = useConfirm();
    const isEditing = !!initialData;
    const [isLoading, setIsLoading] = useState(false);
    const [alreadyUploadedMap] = useState<Map<File, string>>(() => new Map());
    const [saveProgress, setSaveProgress] = useState<SaveProgressInfo | null>(null);
    const [failedUploadsInfo, setFailedUploadsInfo] = useState<{ failedCount: number; totalPhotos: number } | null>(null);
    const [employees, setEmployees] = useState<{id: string, name: string}[]>(initialEmployees);
    const [isSigned, setIsSigned] = useState(!!initialData?.firma);
    const [activeLogWarning, setActiveLogWarning] = useState<string | null>(null);
    const [lastKnownKmLlegada, setLastKnownKmLlegada] = useState<number | null>(null);
    const lastSuggestionRef = useRef<{ unitName: string | null; suggestedKm: number | null }>({ unitName: null, suggestedKm: null });
    const [relatedExpenses, setRelatedExpenses] = useState<VehicleExpense[]>([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<VehicleExpense | null>(null);
    
    // Use official helper
    const userIsAdmin = checkIsAdmin(currentUser?.role);
    
    const [formData, setFormData] = useState<Partial<VehicleLog>>(() => {
        const today = new Date();
        const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const base = initialData || {
            fecha: localDate,
            fechaRegreso: '',
            conductorId: currentUser?.id || '',
            conductorName: currentUser?.name || currentUser?.email || '',
            horaSalida: '06:00',
            horaLlegada: '16:00',
            combustible: 'Full',
            combustibleFinal: '',
            eventosCarretera: 'No',
            tipoCombustible: null,
        };

        // Instant name resolution using initialEmployees if needed
        if (base.conductorId) {
            const emp = initialEmployees.find(e => e.id === base.conductorId);
            if (emp && (base.conductorName?.includes('@') || !base.conductorName || base.conductorName === base.conductorId)) {
                return { ...base, conductorName: emp.name };
            }
        }
        
        // Also check if resolvedName was passed from table
        if (initialData && (initialData as any)._resolvedName) {
            return {
                ...base,
                conductorName: (initialData as any)._resolvedName
            };
        }

        return base;
    });

    const [photoPolicyStatus, setPhotoPolicyStatus] = useState<{ vencida: boolean; loading: boolean; intervalDays: number; disabled: boolean }>({ vencida: false, loading: false, intervalDays: 15, disabled: false });
    const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<{ url: string; path?: string }[]>([]);
    const [deletingPhotoIndex, setDeletingPhotoIndex] = useState<number | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [manualPhotoRequested, setManualPhotoRequested] = useState(false);
    const [revisionUnidad, setRevisionUnidad] = useState<Record<string, InspectionOption>>(() => {
        if (initialData?.revisionUnidad) {
            return normalizeVehicleInspection(initialData.revisionUnidad);
        }
        return getDefaultVehicleInspection();
    });
    const takePhotoInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const handleInspectionChange = (id: string, value: InspectionOption) => {
        setRevisionUnidad(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const renderInspectionItem = (item: InspectionItemDef) => {
        const val = revisionUnidad[item.id] !== undefined ? revisionUnidad[item.id] : item.defaultValue;
        const isLaborCheckpoint = item.category === 'INICIO DE LABORES' || item.category === 'FINAL DE LABORES';
        const options: readonly InspectionOption[] = isLaborCheckpoint 
            ? (['SI', 'NO'] as const)
            : (['SI', 'NO', 'N/A'] as const);

        return (
            <div key={item.id} className="py-1.5 flex items-center justify-between gap-2.5">
                <span className="text-[11px] text-slate-700 font-medium leading-tight select-none">
                    {item.label}
                </span>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-md text-[10px] font-black shrink-0 border border-slate-200/60">
                    {options.map((opt) => (
                        <span
                            key={opt}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleInspectionChange(item.id, opt)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleInspectionChange(item.id, opt);
                                }
                            }}
                            className={`px-1.5 py-0.5 rounded transition-all leading-none cursor-pointer select-none ${
                                val === opt 
                                    ? (opt === 'SI' 
                                        ? 'bg-emerald-600 text-white shadow-xs font-black' 
                                        : (opt === 'NO' ? 'bg-rose-600 text-white shadow-xs font-black' : 'bg-slate-700 text-white shadow-xs font-black'))
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                        >
                            {opt}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    useEffect(() => {
        const loadExistingPhoto = async () => {
            if (!initialData) return;
            
            // Usar photoStoragePaths si existe (array de todas), sino caer a la primera
            const paths = initialData.photoStoragePaths && initialData.photoStoragePaths.length > 0
                ? initialData.photoStoragePaths
                : initialData.photoStoragePath 
                    ? [initialData.photoStoragePath]
                    : [];

            if (paths.length === 0) {
                if (initialData.oneDriveUrl) {
                    setExistingPhotos([{ url: initialData.oneDriveUrl }]);
                }
                return;
            }

            setPhotoLoading(true);
            try {
                const photos: { url: string; path?: string }[] = [];
                for (const path of paths) {
                    try {
                        if (networkProbe.isOnline()) {
                            const { storage } = await import('../../firebase');
                            const { ref, getDownloadURL } = await import('firebase/storage');
                            const url = await getDownloadURL(ref(storage, path));
                            photos.push({ url, path });
                        } else {
                            const { getBlob } = await import('../../services/offlineMediaStore');
                            const blob = await getBlob(path);
                            if (blob) {
                                photos.push({ url: URL.createObjectURL(blob), path });
                            }
                        }
                    } catch (err) {
                        console.warn(`Could not load photo ${path}:`, err);
                    }
                }
                setExistingPhotos(photos);
            } catch (err) {
                console.error("Error loading photos:", err);
                if (initialData.oneDriveUrl) {
                    setExistingPhotos([{ url: initialData.oneDriveUrl }]);
                }
            } finally {
                setPhotoLoading(false);
            }
        };

        loadExistingPhoto();
    }, [initialData]);

    const handleDeleteExistingPhoto = async (idx: number) => {
        const photoToDelete = existingPhotos[idx];
        if (!photoToDelete) return;

        const confirmed = await confirm({
            title: "¿Eliminar fotografía?",
            description: "¿Estás seguro de que deseas eliminar esta fotografía de la bitácora? Esta acción la borrará permanentemente de los registros.",
            confirmLabel: "ELIMINAR",
            cancelLabel: "CANCELAR",
            variant: "danger"
        });

        if (!confirmed) return;

        if (initialData?.id && photoToDelete.path) {
            try {
                setDeletingPhotoIndex(idx);
                await deleteVehicleLogPhoto(initialData.id, photoToDelete.path, currentUser);
                setExistingPhotos(prev => prev.filter((_, i) => i !== idx));
                
                // Actualizar initialData local en memoria si existe
                if (initialData.photoStoragePaths) {
                    initialData.photoStoragePaths = initialData.photoStoragePaths.filter(p => p !== photoToDelete.path);
                }
                if (initialData.photoStoragePath === photoToDelete.path) {
                    initialData.photoStoragePath = initialData.photoStoragePaths && initialData.photoStoragePaths.length > 0 
                        ? initialData.photoStoragePaths[0] 
                        : undefined;
                }
            } catch (err: any) {
                alert("Error al eliminar la fotografía: " + (err.message || 'Error desconocido'));
            } finally {
                setDeletingPhotoIndex(null);
            }
        } else {
            // Si solo es una URL externa o temporal
            setExistingPhotos(prev => prev.filter((_, i) => i !== idx));
        }
    };

    useEffect(() => {
        if (initialData) {
            if (initialData.revisionUnidad) {
                setRevisionUnidad(normalizeVehicleInspection(initialData.revisionUnidad));
            } else {
                setRevisionUnidad(getDefaultVehicleInspection());
            }
        }
    }, [initialData]);

    useEffect(() => {
        const checkPolicy = async () => {
            const unidad = formData.unidadName || formData.unidad || initialData?.unidad;
            if (!unidad) return;
            setPhotoPolicyStatus(prev => ({ ...prev, loading: true }));
            try {
                const res = await checkVehiclePhotoPolicy(unidad);
                setPhotoPolicyStatus({
                    vencida: res.vencida,
                    loading: false,
                    intervalDays: res.intervalDays,
                    disabled: res.disabled
                });
            } catch (e) {
                console.error("Error checking photo policy:", e);
                setPhotoPolicyStatus(prev => ({ ...prev, loading: false }));
            }
        };
        if (show) {
            checkPolicy();
        }
    }, [show, formData.unidadName, formData.unidad, initialData?.unidad]);
    
    
    const [recargas, setRecargas] = useState<VehicleRecharge[]>(() => {
        if (initialData?.recargas && initialData.recargas.length > 0) {
            return initialData.recargas;
        }
        if (initialData && (initialData.kmRecarga || initialData.monto || initialData.litros)) {
            return [{
                id: crypto.randomUUID(),
                kmRecarga: initialData.kmRecarga,
                monto: initialData.monto,
                litros: initialData.litros,
                tipoCombustible: initialData.tipoCombustible,
                gasolinera: initialData.gasolinera || ''
            }];
        }
        return [{
            id: crypto.randomUUID(),
            kmRecarga: null,
            monto: null,
            litros: null,
            tipoCombustible: null,
            gasolinera: ''
        }];
    });

    useEffect(() => {
        // Load employees for conductor select only if list is empty
        const loadEmployees = async () => {
             if (initialEmployees.length > 0 && employees.length > 0) return;

             const q = query(collection(db, 'employees'), orderBy('name'));
             const snap = await getDocs(q);
             
             const emps = snap.docs
                .map(d => ({ id: d.id, name: d.data().name, status: d.data().status }))
                .filter(e => e.status === 'activo' || e.status === 'active' || !e.status);

             setEmployees(emps);

             // Resolve name if it looks like an email or is missing
             if (formData.conductorId) {
                const emp = emps.find(e => e.id === formData.conductorId);
                if (emp && (formData.conductorName?.includes('@') || !formData.conductorName || formData.conductorName === formData.conductorId)) {
                    setFormData(prev => ({ ...prev, conductorName: emp.name }));
                }
             }
        };
        loadEmployees();
    }, [initialEmployees, employees.length, formData.conductorId, formData.conductorName]);

    // Auto-complete mileage logic
    useEffect(() => {
        let isCancelled = false;

        const fetchLastMileage = async () => {
            // Only for new records and when a unit is selected
            if (isEditing || !formData.unidadId) {
                if (!isCancelled) {
                    setActiveLogWarning(null);
                    setLastKnownKmLlegada(null);
                }
                return;
            }

            const unitMatch = formData.unidadId.split(" - ");
            const unitName = unitMatch[0]?.trim();
            if (!unitName) return;

            const computeLogsAndSuggest = (remoteLogs: VehicleLog[], localDocs: any[], pendingMutations: any[]) => {
                const deleteMutations = new Set(
                    pendingMutations
                        .filter(m => m.collection === 'bitacora_vehiculos' && m.operation === 'delete')
                        .map(m => m.docId)
                );

                const localLogs = localDocs
                    .filter(d => d.data?.unidad === unitName)
                    .map(d => ({ ...d.data, id: d.docId }) as VehicleLog);

                // Hybrid Merge: Priority to local dirty records
                const logMap = new Map<string, VehicleLog>();
                
                // Add remote logs first, skipping those pending deletion or legacy deleted
                remoteLogs.forEach(l => {
                    if (!deleteMutations.has(l.id) && !l.isDeleted) {
                        logMap.set(l.id, l);
                    }
                });
                
                // Overlay local logs (especially dirty ones or locals-only)
                localLogs.forEach(l => {
                    const localEntry = localDocs.find(d => d.docId === l.id);
                    if (localEntry?.isDirty || !logMap.has(l.id)) {
                        if (!deleteMutations.has(l.id) && !l.isDeleted) {
                            logMap.set(l.id, l);
                        }
                    }
                });
                
                const logs = Array.from(logMap.values());
                
                if (logs.length > 0) {
                    logs.sort((a, b) => {
                        const dateA = a.fecha || "";
                        const dateB = b.fecha || "";
                        if (dateA !== dateB) return dateB.localeCompare(dateA);
                        
                        const timeA = a.horaSalida || "";
                        const timeB = b.horaSalida || "";
                        return timeB.localeCompare(timeA);
                    });

                    const activeLog = logs.find(log => !log.kmLlegada && !log.isDeleted);
                    const warning = (activeLog && activeLog.id !== (initialData?.id)) 
                        ? `Esta unidad (${unitName}) posee una bitácora activa actualmente.` 
                        : null;

                    const lastFinalLog = logs.find(log => (log.kmLlegada ?? 0) > 0);
                    const suggestedKm = lastFinalLog ? lastFinalLog.kmLlegada : null;

                    return {
                        warning,
                        lastKm: suggestedKm,
                        logsCount: logs.length
                    };
                }

                return {
                    warning: null,
                    lastKm: null,
                    logsCount: 0
                };
            };

            // 1. PASO 1: Obtención inmediata local (sin await a red)
            let localDocs: any[] = [];
            let pendingMutations: any[] = [];
            try {
                [localDocs, pendingMutations] = await Promise.all([
                    localDocStore.getLocalCollection('bitacora_vehiculos'),
                    offlineQueueEngine.getPendingQueue()
                ]);
            } catch (e) {
                console.warn("[VehicleLogModal] localDocStore/offlineQueue access failed:", e);
            }

            if (isCancelled) return;

            const localResult = computeLogsAndSuggest([], localDocs, pendingMutations);
            setActiveLogWarning(localResult.warning);
            setLastKnownKmLlegada(localResult.lastKm);
            
            const initialSuggestedKm = localResult.lastKm;
            const unitChanged = lastSuggestionRef.current.unitName !== unitName;

            if (unitChanged) {
                setFormData(prev => ({ ...prev, kmSalida: initialSuggestedKm !== null ? initialSuggestedKm : undefined }));
                lastSuggestionRef.current = { unitName, suggestedKm: initialSuggestedKm };
            } else {
                if (initialSuggestedKm !== null) {
                    setFormData(prev => {
                        if (prev.kmSalida === undefined || prev.kmSalida === null) {
                            return { ...prev, kmSalida: initialSuggestedKm };
                        }
                        return prev;
                    });
                } else {
                    setFormData(prev => ({ ...prev, kmSalida: undefined }));
                }
            }

            // 2. PASO 2 & 3: Consulta remota en background (non-blocking)
            (async () => {
                let remoteLogs: VehicleLog[] = [];
                try {
                    const { getDocsFromServer } = await import('firebase/firestore');
                    const qLogs = query(
                        collection(db, 'bitacora_vehiculos'),
                        where('unidad', '==', unitName),
                        orderBy('fecha', 'desc'),
                        limit(15)
                    );
                    
                    const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_GETDOCS")), 2500));
                    const snapLogs = await Promise.race([
                        getDocsFromServer(qLogs),
                        timeoutPromise
                    ]);
                    
                    remoteLogs = snapLogs.docs.map(doc => ({ ...doc.data() as VehicleLog, id: doc.id }));
                } catch (e) {
                    console.warn("[VehicleLogModal] Server fetch failed or timed out, using getDocsFromCache:", e);
                    try {
                        const { getDocsFromCache } = await import('firebase/firestore');
                        const qLogs = query(collection(db, 'bitacora_vehiculos'), where('unidad', '==', unitName), orderBy('fecha', 'desc'), limit(15));
                        const snapLogs = await getDocsFromCache(qLogs);
                        remoteLogs = !snapLogs.empty ? snapLogs.docs.map(doc => ({ ...doc.data() as VehicleLog, id: doc.id })) : [];
                    } catch (cacheError) {
                        console.warn("[VehicleLogModal] Cache fetch failed, relying on localDocStore:", cacheError);
                    }
                }

                if (isCancelled) return;

                const fullResult = computeLogsAndSuggest(remoteLogs, localDocs, pendingMutations);

                if (fullResult.warning !== localResult.warning || fullResult.lastKm !== localResult.lastKm) {
                    setActiveLogWarning(fullResult.warning);
                    setLastKnownKmLlegada(fullResult.lastKm);

                    if (fullResult.lastKm !== null) {
                        setFormData(prev => {
                            // Protección contra edición manual usando lastSuggestionRef.current.suggestedKm
                            const currentKm = prev.kmSalida;
                            const lastSuggested = lastSuggestionRef.current.suggestedKm;

                            if (currentKm === undefined || currentKm === null || currentKm === lastSuggested) {
                                lastSuggestionRef.current = { unitName, suggestedKm: fullResult.lastKm };
                                return { ...prev, kmSalida: fullResult.lastKm };
                            }
                            return prev;
                        });
                    }
                }
            })().catch(err => {
                console.error("Error in background remote mileage fetch:", err);
            });
        };

        fetchLastMileage();

        return () => {
            isCancelled = true;
        };
    }, [formData.unidadId, isEditing]);

    const handleDeleteExpense = async (expenseId: string) => {
        const confirmed = await confirm({
            title: 'Eliminar Gasto',
            description: '¿Estás seguro de que deseas eliminar este gasto relacionado?',
            confirmLabel: 'ELIMINAR',
            variant: 'danger'
        });

        if (confirmed) {
            try {
                await deleteDoc(doc(db, 'vehicle_expenses', expenseId));
            } catch (err) {
                console.error("Error deleting expense:", err);
            }
        }
    };
    useEffect(() => {
        if (!initialData?.id) return;

        const q = query(
            collection(db, 'vehicle_expenses'),
            where('bitacoraId', '==', initialData.id)
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            const expenses = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as VehicleExpense);
            // Sort in memory to avoid the need for a composite index in this view
            expenses.sort((a, b) => b.fecha.localeCompare(a.fecha));
            setRelatedExpenses(expenses);
        });

        return () => unsubscribe();
    }, [initialData?.id]);

    const toTitleCase = (str: string) => {
        return str.split(' ').map(word => {
            if (word.length === 0) return '';
            return word[0].toUpperCase() + word.slice(1);
        }).join(' ');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let finalValue: any = value;
        if (name === 'kmSalida' || name === 'kmLlegada') {
            finalValue = value ? Number(value) : null;
        } else if (name === 'destino') {
            finalValue = toTitleCase(value);
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    const handleRecargaChange = (id: string, field: keyof VehicleRecharge, value: any) => {
        setRecargas(prev => prev.map(r => {
            if (r.id === id) {
                let finalValue = value;
                if (field === 'kmRecarga' || field === 'monto' || field === 'litros') {
                    finalValue = value ? Number(value) : null;
                } else if (field === 'gasolinera') {
                    finalValue = toTitleCase(value);
                }
                return { ...r, [field]: finalValue };
            }
            return r;
        }));
    };

    const addRecarga = () => {
        setRecargas(prev => [...prev, {
            id: crypto.randomUUID(),
            kmRecarga: null,
            monto: null,
            litros: null,
            tipoCombustible: null,
            gasolinera: ''
        }]);
    };

    const removeRecarga = (id: string) => {
        setRecargas(prev => prev.filter(r => r.id !== id));
    };

    const handleSignature = (base64: string | null) => {
        if (base64) {
            setFormData(prev => ({
                ...prev,
                firma: {
                    imageBase64: base64,
                    fecha: new Date().toISOString(),
                    usuarioId: currentUser.id
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, firma: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isLoading) return; 
        setIsLoading(true); 

        // 1. Validaciones de Negocio (UI)
        if (formData.kmLlegada && formData.kmSalida && formData.kmLlegada < formData.kmSalida) {
             setIsLoading(false);
             await confirm({
                 title: 'Kilometraje Inválido',
                 description: 'El kilometraje de llegada no puede ser menor al de salida.',
                 confirmLabel: 'ACEPTAR',
                 variant: 'warning'
             });
             return;
        }

        if (lastKnownKmLlegada && formData.kmSalida && formData.kmSalida < lastKnownKmLlegada) {
            setIsLoading(false);
            await confirm({
                title: 'Discrepancia de Kilometraje',
                description: `El kilometraje de salida (${formData.kmSalida}) es menor al último kilometraje de llegada registrado parea esta unidad (${lastKnownKmLlegada}).`,
                confirmLabel: 'ACEPTAR',
                variant: 'danger'
            });
            return;
        }
        
        // Validations for recargas
        const validRecargas = recargas.filter(r => r.monto || r.litros || r.kmRecarga || r.gasolinera);
        for (const r of validRecargas) {
            if (r.monto && (!r.litros || r.litros <= 0)) {
                setIsLoading(false);
                await confirm({
                    title: 'Validación de Combustible',
                    description: 'Si hay monto de recarga, debe especificar los litros en todas las recargas.',
                    confirmLabel: 'ACEPTAR',
                    variant: 'warning'
                });
                return;
            }
        }

        let totalMonto = null;
        let totalLitros = null;
        
        if (validRecargas.length > 0) {
            totalMonto = validRecargas.reduce((sum, r) => sum + (r.monto || 0), 0);
            totalLitros = validRecargas.reduce((sum, r) => sum + (r.litros || 0), 0);
        }

        const isPhotoRequired = !photoPolicyStatus.disabled && photoPolicyStatus.vencida;
        const hasHistoricalInspection = isEditing && !!initialData?.revisionUnidad && (
            initialData.revisionUnidad.estadoLlantas !== undefined ||
            initialData.revisionUnidad.llantas !== undefined ||
            initialData.revisionUnidad.inspeccionGolpesDanos !== undefined ||
            initialData.revisionUnidad.nivelAceite !== undefined ||
            initialData.revisionUnidad.extintorVigente !== undefined ||
            initialData.revisionUnidad.cuentaExtintor !== undefined ||
            initialData.revisionUnidad.terminalesBateriaBuenEstado !== undefined ||
            initialData.revisionUnidad.enciendeCorreBien !== undefined ||
            initialData.revisionUnidad.aireAcondicionado !== undefined ||
            !!initialData.photoStoragePath ||
            !!initialData.oneDriveUrl
        );
        const isFulfillingCycle = !photoPolicyStatus.disabled && (isPhotoRequired || manualPhotoRequested || hasHistoricalInspection);
        const shouldSaveInspection = isFulfillingCycle;

        // Validación obligatoria para Inicio de Labores (SI o NO)
        const llenadoBoleta = revisionUnidad?.llenadoBoletaRecorrido;
        if (!llenadoBoleta || !['SI', 'NO'].includes(llenadoBoleta)) {
            setIsLoading(false);
            await confirm({
                title: 'Inicio de Labores Incompleto',
                description: 'Debe responder obligatoriamente el punto "1. Llenado de boleta de recorrido" en Inicio de Labores seleccionando SI o NO.',
                confirmLabel: 'ACEPTAR',
                variant: 'warning'
            });
            return;
        }

        // Validación condicional para Final de Labores (OBLIGATORIO solo si se ingresa Kilometraje de Llegada)
        const hasKmLlegada = formData.kmLlegada !== null && formData.kmLlegada !== undefined && formData.kmLlegada !== '' && !isNaN(Number(formData.kmLlegada));
        if (hasKmLlegada) {
            const inspParqueo = revisionUnidad?.inspeccionVisualParqueo;
            const cerradoBoleta = revisionUnidad?.cerradoBoletaRecorrido;
            if (!inspParqueo || !['SI', 'NO'].includes(inspParqueo) || !cerradoBoleta || !['SI', 'NO'].includes(cerradoBoleta)) {
                setIsLoading(false);
                await confirm({
                    title: 'Final de Labores Incompleto',
                    description: 'Al registrar el kilometraje de llegada, debe responder obligatoriamente los puntos de "Final de Labores" ("1. Inspección visual de la unidad en el parqueo" y "2. Cerrado de la boleta de recorrido") seleccionando SI o NO.',
                    confirmLabel: 'ACEPTAR',
                    variant: 'warning'
                });
                return;
            }
        }

        // Validación obligatoria especial para el punto de Aire acondicionado
        if (shouldSaveInspection || hasHistoricalInspection) {
            const acValue = revisionUnidad?.aireAcondicionado;
            if (!acValue || !['SI', 'NO', 'N/A'].includes(acValue)) {
                setIsLoading(false);
                await confirm({
                    title: 'Revisión de Unidad Incompleta',
                    description: 'Debe responder obligatoriamente el punto "Aire acondicionado en buen estado" seleccionando SI, NO o N/A.',
                    confirmLabel: 'ACEPTAR',
                    variant: 'warning'
                });
                return;
            }
        }

        const dataToSave: any = {
            ...formData,
            revisionUnidad: {
                ...(initialData?.revisionUnidad || {}),
                ...revisionUnidad
            },
            ...(isFulfillingCycle && (selectedPhotoFiles.length > 0 || existingPhotos.length > 0)
                ? { photoPolicyLastCompletedAt: new Date().toISOString() }
                : (initialData?.photoPolicyLastCompletedAt ? { photoPolicyLastCompletedAt: initialData.photoPolicyLastCompletedAt } : {})),
            recargas: validRecargas,
            monto: validRecargas.length > 0 ? totalMonto : null,
            litros: validRecargas.length > 0 ? totalLitros : null,
            kmRecarga: validRecargas.length > 0 ? validRecargas[0].kmRecarga : null,
            tipoCombustible: validRecargas.length > 0 ? validRecargas[0].tipoCombustible : null,
            gasolinera: validRecargas.length > 0 ? validRecargas.map(r => r.gasolinera).filter(Boolean).join(', ') : '',
        };

        if (isPhotoRequired && selectedPhotoFiles.length === 0 && !initialData?.oneDriveUrl && !initialData?.photoTimestamp && !initialData?.photoStoragePath && existingPhotos.length === 0) {
            setIsLoading(false);
            await confirm({
                title: 'Fotografía de Bitácora Requerida',
                description: `Esta unidad tiene la fotografía de bitácora vencida (más de ${photoPolicyStatus.intervalDays} días laborales). Debe adjuntar al menos una foto actual para registrar o cerrar la boleta.`,
                confirmLabel: 'ACEPTAR',
                variant: 'warning'
            });
            return;
        }

        // 2. Ejecutar Guardado Centralizado con arquitectura paralela y seguimiento de progreso
        try {
            setFailedUploadsInfo(null);
            const existingPaths = existingPhotos.map(p => p.path).filter(Boolean) as string[];

            const result = await saveVehicleLog(
                dataToSave,
                currentUser,
                isEditing,
                initialData,
                trabajoId,
                selectedPhotoFiles,
                existingPaths,
                (progress) => setSaveProgress(progress),
                alreadyUploadedMap
            );

            if (result.failedCount && result.failedCount > 0) {
                setFailedUploadsInfo({
                    failedCount: result.failedCount,
                    totalPhotos: selectedPhotoFiles.length
                });
                await confirm({
                    title: 'Registro Guardado con Fotos Pendientes',
                    description: `El registro de la bitácora se guardó exitosamente, pero ${result.failedCount} de ${selectedPhotoFiles.length} fotografías no se pudieron subir por inestabilidad en la conexión. Las fotografías confirmadas se conservaron. Puede presionar "REINTENTAR SUBIDA" para enviar las fotos pendientes sin volver a subir las ya procesadas.`,
                    confirmLabel: 'ENTENDIDO',
                    variant: 'warning'
                });
            } else {
                onClose(result);
            }
        } catch (err: any) {
            console.error("Error saving vehicle log:", err);
            await confirm({
                title: 'Error al Guardar',
                description: err?.message || 'Ocurrió un problema inesperado al intentar guardar el registro. Por favor intente de nuevo.',
                confirmLabel: 'ACEPTAR',
                variant: 'danger'
            });
        } finally {
            setIsLoading(false);
            setSaveProgress(null);
        }
    };

    if (!show) return null;

    return createPortal(
        <div 
            className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm z-[200] flex justify-center items-center p-3 sm:p-4 md:p-6 overflow-hidden"
            style={{ 
                WebkitOverflowScrolling: 'touch',
                paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))'
            }}
        >
            <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-hidden animate-in zoom-in-95 my-auto relative">
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white rounded-t-[24px] sm:rounded-t-[32px] flex-none">
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-blue-950 uppercase tracking-tight">
                            {isEditing ? 'Editar Registro de Bitácora' : 'Nuevo Registro de Bitácora'}
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Control de Flota Vehicular</p>
                    </div>
                    <IconButton 
                        icon={<FiX className="text-xl" />}
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    />
                </div>

                <form onSubmit={handleSubmit} id="vehicle-log-form" className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6 min-h-0">
                    {/* BANNER DE PROGRESO DE GUARDADO / SUBIDA */}
                    {saveProgress && (
                        <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-xl flex flex-col gap-2 animate-in fade-in">
                            <div className="flex items-center justify-between text-xs font-black text-blue-900 uppercase">
                                <span>{saveProgress.message}</span>
                                {saveProgress.total > 0 && (
                                    <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full text-[10px]">
                                        {saveProgress.current} / {saveProgress.total}
                                    </span>
                                )}
                            </div>
                            {saveProgress.total > 0 && (
                                <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                                        style={{ width: `${Math.min(100, Math.round((saveProgress.current / saveProgress.total) * 100))}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* BANNER DE REINTENTO DE FOTOGRAFÍAS PENDIENTES */}
                    {failedUploadsInfo && !isLoading && (
                        <div className="bg-amber-50 border border-amber-300 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                            <div className="flex items-center gap-3">
                                <FiAlertTriangle className="text-amber-600 text-2xl flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-black text-amber-900 uppercase">Fotografías pendientes de subida</p>
                                    <p className="text-[11px] text-amber-800 font-medium">
                                        {failedUploadsInfo.failedCount} de {failedUploadsInfo.totalPhotos} fotografías no se pudieron subir. La bitácora ya fue guardada. Puedes reintentar sin volver a subir las ya procesadas.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e)}
                                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black uppercase px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-xs shrink-0"
                            >
                                Reintentar Subida
                            </button>
                        </div>
                    )}
                    {/* INFORMACIÓN GENERAL */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="text-xs font-black text-blue-800 uppercase mb-3">Información General</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Conductor</label>
                                {userIsAdmin ? (
                                    <Select 
                                        options={[
                                            ...employees.map(emp => ({ value: emp.id, label: emp.name })),
                                            ...(formData.conductorId && !employees.some(e => e.id === formData.conductorId) 
                                                ? [{ 
                                                    value: formData.conductorId, 
                                                    label: (!formData.conductorName || formData.conductorName === formData.conductorId) 
                                                        ? 'Cargando...' 
                                                        : formData.conductorName 
                                                }] : [])
                                        ]}
                                        value={formData.conductorId || ''}
                                        onChange={(val) => {
                                            const emp = employees.find(e => e.id === val);
                                            setFormData(p => ({
                                                ...p, 
                                                conductorId: val, 
                                                conductorName: emp?.name || ''
                                            }));
                                        }}
                                        placeholder="Seleccione conductor..."
                                        required
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={
                                            (formData.conductorName && formData.conductorName !== formData.conductorId) 
                                            ? formData.conductorName 
                                            : (formData.conductorId ? "Cargando..." : (currentUser?.name || currentUser?.email || ''))
                                        }
                                        className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-bold"
                                        disabled
                                    />
                                )}
                                <input type="hidden" name="conductorId" value={formData.conductorId || ''} />
                                <input type="hidden" name="conductorName" value={formData.conductorName || ''} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                                <input type="date" name="fecha" value={formData.fecha || ''} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidad / Vehículo</label>
                                <Select 
                                    options={VEHICLES.map(v => ({ value: v.value, label: v.label }))}
                                    value={formData.unidadName}
                                    onChange={(val) => {
                                        const vehicle = VEHICLES.find(v => v.value === val);
                                        setFormData(p => ({...p, unidadName: val, unidadId: vehicle?.label || ''}));
                                    }}
                                    placeholder="Buscar vehículo..."
                                    required
                                />
                                {activeLogWarning && (
                                    <div className="mt-2 flex items-center gap-2 text-[10px] font-black text-orange-600 bg-orange-50 p-2 rounded-lg border border-orange-100 animate-pulse">
                                        <FiAlertTriangle className="text-xs shrink-0" />
                                        <span className="uppercase tracking-tight font-black">{activeLogWarning}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 1. INICIO DE LABORES */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200/80 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                                <span>Inicio de Labores</span>
                            </h3>
                            <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                                Control de Inicio
                            </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-blue-100 divide-y divide-slate-100">
                            {INSPECTION_ITEMS.filter(item => item.category === 'INICIO DE LABORES').map(renderInspectionItem)}
                        </div>
                    </div>

                    {/* 2. ANTES DE SALIR */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-xs">
                        <h3 className="text-xs font-black text-blue-800 uppercase mb-3">Antes de Salir</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kilometraje Salida</label>
                                <input type="number" name="kmSalida" value={formData.kmSalida || ''} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" required />
                            </div>
                            <div className="flex items-end gap-2 w-full min-w-0 max-w-full">
                                <div className="flex-[0.9] min-w-0 max-w-full">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 truncate">Hora Salida</label>
                                    <input type="time" name="horaSalida" value={formData.horaSalida || ''} onChange={handleChange} className="w-full py-[10px] px-[12px] text-[16px] md:text-sm border border-slate-200 rounded-lg bg-white min-w-0 max-w-full outline-none focus:ring-2 focus:ring-blue-100 appearance-none" required />
                                </div>
                                <div className="flex-[0.7] min-w-0 max-w-full">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 truncate">Combustible</label>
                                    <select name="combustible" value={formData.combustible || 'Full'} onChange={handleChange} className="w-full py-[10px] px-[12px] text-[16px] md:text-sm border border-slate-200 rounded-lg bg-white min-w-0 max-w-full outline-none focus:ring-2 focus:ring-blue-100 appearance-none" required>
                                        <option value="Full">Full</option>
                                        <option value="3/4">3/4</option>
                                        <option value="1/2">1/2</option>
                                        <option value="1/4">1/4</option>
                                        <option value="Reserva">Reserva</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destino</label>
                                <textarea
                                    name="destino"
                                    value={formData.destino || ''}
                                    onChange={handleChange}
                                    rows={2}
                                    className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm resize-y leading-normal block whitespace-pre-wrap break-words"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. REVISIÓN DE UNIDAD Y FOTOGRAFÍA */}
                    {(() => {
                        // 1. REGLA ABSOLUTA: Si la política global está desactivada (o la unidad está excluida / disabled),
                        // NO mostrar Fotografía ni Revisión de Unidad.
                        if (photoPolicyStatus.disabled) {
                            return null;
                        }

                        // 2. Si la política está activada pero NO vencida y no hay solicitud manual:
                        // NO mostrar formulario, NO mostrar revisión, NO mostrar botón.
                        const isPhotoRequired = photoPolicyStatus.vencida;
                        const hasHistoricalInspection = isEditing && !!initialData?.revisionUnidad && (
                            initialData.revisionUnidad.estadoLlantas !== undefined ||
                            initialData.revisionUnidad.llantas !== undefined ||
                            initialData.revisionUnidad.inspeccionGolpesDanos !== undefined ||
                            initialData.revisionUnidad.nivelAceite !== undefined ||
                            initialData.revisionUnidad.extintorVigente !== undefined ||
                            initialData.revisionUnidad.cuentaExtintor !== undefined ||
                            initialData.revisionUnidad.terminalesBateriaBuenEstado !== undefined ||
                            initialData.revisionUnidad.enciendeCorreBien !== undefined ||
                            initialData.revisionUnidad.aireAcondicionado !== undefined ||
                            !!initialData.photoStoragePath ||
                            !!initialData.oneDriveUrl
                        );
                        const shouldShowPhotoAndInspection = isPhotoRequired || manualPhotoRequested || hasHistoricalInspection;

                        if (!shouldShowPhotoAndInspection) {
                            return null;
                        }

                        return (
                            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                                {/* Encabezado de la Sección Integrada */}
                                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/80">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                            Fotografía de Bitácora
                                        </span>
                                        {initialData?.oneDriveUrl || initialData?.oneDriveSyncedAt ? (
                                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full" title="Sincronizado correctamente con OneDrive">
                                                ✅ Sincronizada con OneDrive
                                            </span>
                                        ) : initialData?.oneDriveSyncError ? (
                                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full" title={initialData.oneDriveSyncError}>
                                                ⚠️ Error OneDrive
                                            </span>
                                        ) : (initialData?.photoStoragePath || initialData?.photoTimestamp || existingPhotos.length > 0) ? (
                                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full" title="Guardada en Storage, pendiente de sincronización secundaria">
                                                ☁️ Sincronizando OneDrive...
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                📷 Sin foto adjunta
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <ActionButton
                                            type="button"
                                            variant="primary"
                                            label="Tomar foto"
                                            onClick={() => takePhotoInputRef.current?.click()}
                                            className="!py-1 !px-2.5 !text-[10px] !font-bold !uppercase !rounded-lg"
                                        />
                                        <ActionButton
                                            type="button"
                                            variant="secondary"
                                            label="Galería"
                                            onClick={() => galleryInputRef.current?.click()}
                                            className="!py-1 !px-2.5 !text-[10px] !font-bold !uppercase !rounded-lg"
                                        />
                                        {!isPhotoRequired && !initialData?.photoStoragePath && !initialData?.photoTimestamp && !initialData?.revisionUnidad && existingPhotos.length === 0 && selectedPhotoFiles.length === 0 && manualPhotoRequested && (
                                            <IconButton
                                                icon={<FiX size={14} />}
                                                onClick={() => setManualPhotoRequested(false)}
                                                className="!p-1 text-slate-400 hover:text-slate-700"
                                                title="Ocultar sección opcional"
                                            />
                                        )}
                                    </div>
                                </div>

                                {photoPolicyStatus.vencida && !photoPolicyStatus.disabled && (
                                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start gap-2 text-amber-800 text-xs">
                                        <FiAlertTriangle className="text-sm shrink-0 text-amber-600 mt-0.5" />
                                        <div>
                                            <span className="font-bold uppercase">Fotografía Obligatoria Requerida:</span> Han pasado más de {photoPolicyStatus.intervalDays} días desde la última fotografía de bitácora para esta unidad.
                                        </div>
                                    </div>
                                )}

                                {/* Visor de Fotos (Tira Horizontal Compacta) */}
                                {(photoLoading || existingPhotos.length > 0 || selectedPhotoFiles.length > 0) && (
                                    <div className="flex flex-wrap gap-2 py-1">
                                        {photoLoading && (
                                            <div className="w-20 h-20 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-[10px] text-slate-500 animate-pulse">
                                                Cargando...
                                            </div>
                                        )}

                                        {existingPhotos.map((photo, idx) => (
                                            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-slate-300 shadow-xs group shrink-0">
                                                <img 
                                                    src={photo.url} 
                                                    alt={`Foto ${idx + 1}`} 
                                                    className="w-full h-full object-cover" 
                                                />
                                                <IconButton
                                                    icon={<FiTrash2 size={11} />}
                                                    disabled={deletingPhotoIndex === idx}
                                                    onClick={() => handleDeleteExistingPhoto(idx)}
                                                    className="absolute top-0.5 right-0.5 !bg-rose-600 !text-white !p-1 hover:!bg-rose-700 transition-all shadow-md rounded-full opacity-90 group-hover:opacity-100 disabled:opacity-50"
                                                    title="Eliminar esta foto"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] text-center py-0.5 font-bold truncate px-0.5">
                                                    {deletingPhotoIndex === idx ? 'Borrando...' : `Foto ${idx + 1}`}
                                                </div>
                                            </div>
                                        ))}

                                        {selectedPhotoFiles.map((file, idx) => {
                                            const previewUrl = URL.createObjectURL(file);
                                            const isAlreadyUploaded = alreadyUploadedMap.has(file);
                                            return (
                                                <div key={idx} className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 ${isAlreadyUploaded ? 'border-emerald-500' : 'border-blue-500'} shadow-xs shrink-0`}>
                                                    <img src={previewUrl} alt={`Nueva ${idx + 1}`} className="w-full h-full object-cover" />
                                                    <IconButton
                                                        icon={<FiX size={10} />}
                                                        disabled={isLoading}
                                                        onClick={() => {
                                                            alreadyUploadedMap.delete(file);
                                                            setSelectedPhotoFiles(prev => prev.filter((_, i) => i !== idx));
                                                            setFailedUploadsInfo(null);
                                                        }}
                                                        className="absolute top-0.5 right-0.5 !bg-red-600 !text-white !p-0.5 hover:!bg-red-700 transition-colors shadow rounded-full disabled:opacity-50"
                                                    />
                                                    <div className={`absolute inset-x-0 bottom-0 ${isAlreadyUploaded ? 'bg-emerald-600' : 'bg-blue-600'} text-white text-[8px] text-center py-0.5 font-bold truncate px-0.5`}>
                                                        {isAlreadyUploaded ? '✓ Subida' : `Nueva ${idx + 1}`}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* REVISIÓN DE UNIDAD (4 CATEGORÍAS ORGANIZADAS) */}
                                <div className="pt-2 border-t border-slate-200/80">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                                Revisión de Unidad
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium">
                                                (Inspección técnica y operativa del vehículo)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Grid responsivo de tarjetas organizadas */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* 1. INSPECCIÓN EXTERIOR DEL VEHÍCULO */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 bg-slate-100/90 px-2.5 py-1.5 rounded-lg mb-2 flex items-center justify-between border border-slate-200/60">
                                                <span className="truncate">1. Inspección Exterior</span>
                                                <span className="text-[9px] text-slate-500 font-bold shrink-0 ml-1">8 puntos</span>
                                            </div>
                                            <div className="divide-y divide-slate-100 flex-1">
                                                {INSPECTION_ITEMS.filter(item => item.category === 'INSPECCIÓN EXTERIOR').map(renderInspectionItem)}
                                            </div>
                                        </div>

                                        {/* 2. REVISIÓN MECÁNICA BÁSICA */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 bg-slate-100/90 px-2.5 py-1.5 rounded-lg mb-2 flex items-center justify-between border border-slate-200/60">
                                                <span className="truncate">2. Revisión Mecánica Básica</span>
                                                <span className="text-[9px] text-slate-500 font-bold shrink-0 ml-1">5 puntos</span>
                                            </div>
                                            <div className="divide-y divide-slate-100 flex-1">
                                                {INSPECTION_ITEMS.filter(item => item.category === 'REVISIÓN MECÁNICA BÁSICA').map(renderInspectionItem)}
                                            </div>
                                        </div>

                                        {/* 3. EQUIPAMIENTO DE SEGURIDAD */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 bg-slate-100/90 px-2.5 py-1.5 rounded-lg mb-2 flex items-center justify-between border border-slate-200/60">
                                                <span className="truncate">3. Equipamiento de Seguridad</span>
                                                <span className="text-[9px] text-slate-500 font-bold shrink-0 ml-1">7 puntos</span>
                                            </div>
                                            <div className="divide-y divide-slate-100 flex-1">
                                                {INSPECTION_ITEMS.filter(item => item.category === 'EQUIPAMIENTO DE SEGURIDAD').map(renderInspectionItem)}
                                            </div>
                                        </div>

                                        {/* 4. REVISIÓN OPERATIVA (UNIDAD APAGADA Y ENCENDIDA) */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col space-y-3">
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 bg-slate-100/90 px-2.5 py-1.5 rounded-lg mb-1.5 flex items-center justify-between border border-slate-200/60">
                                                    <span className="truncate">4.1 Unidad Apagada</span>
                                                    <span className="text-[9px] text-slate-500 font-bold shrink-0 ml-1">3 puntos</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {INSPECTION_ITEMS.filter(item => item.category === 'UNIDAD APAGADA').map(renderInspectionItem)}
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-800 bg-slate-100/90 px-2.5 py-1.5 rounded-lg mb-1.5 flex items-center justify-between border border-slate-200/60">
                                                    <span className="truncate">4.2 Unidad Encendida</span>
                                                    <span className="text-[9px] text-slate-500 font-bold shrink-0 ml-1">7 puntos</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {INSPECTION_ITEMS.filter(item => item.category === 'UNIDAD ENCENDIDA').map(renderInspectionItem)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 4. FINAL DE LABORES */}
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                                <span>Final de Labores</span>
                            </h3>
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                                Cierre de Recorrido
                            </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-emerald-100 divide-y divide-slate-100">
                            {INSPECTION_ITEMS.filter(item => item.category === 'FINAL DE LABORES').map(renderInspectionItem)}
                        </div>
                    </div>

                    {/* 5. AL REGRESAR */}
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-xs">
                        <h3 className="text-xs font-black text-emerald-800 uppercase mb-3">Al Regresar</h3>
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Regreso</label>
                                    <input type="date" name="fechaRegreso" value={formData.fechaRegreso || formData.fecha || ''} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hora Llegada</label>
                                    <input type="time" name="horaLlegada" value={formData.horaLlegada || ''} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kilometraje Llegada</label>
                                <input type="number" name="kmLlegada" value={formData.kmLlegada || ''} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Combustible Final</label>
                                    <select name="combustibleFinal" value={formData.combustibleFinal || 'Full'} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none">
                                        <option value="Full">Full</option>
                                        <option value="3/4">3/4</option>
                                        <option value="1/2">1/2</option>
                                        <option value="1/4">1/4</option>
                                        <option value="Reserva">Reserva</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Eventos en Carretera</label>
                                    <select name="eventosCarretera" value={formData.eventosCarretera || 'No'} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none">
                                        <option value="No">No</option>
                                        <option value="Sí">Sí</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <input
                        ref={takePhotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                setSelectedPhotoFiles(prev => [...prev, file]);
                            }
                            e.target.value = '';
                        }}
                    />
                    <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                                setSelectedPhotoFiles(prev => [...prev, ...files]);
                            }
                            e.target.value = '';
                        }}
                    />

                    {/* CONTROL DE COMBUSTIBLE */}
                    <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-orange-800 uppercase">Control de Combustible (Recarga)</h3>
                        </div>
                        
                        <div className="space-y-4">
                            {recargas.map((recarga, index) => (
                                <div key={recarga.id} className="relative border border-orange-200/60 bg-white/50 p-4 rounded-xl">
                                    {index > 0 && (
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] font-black text-orange-700 uppercase tracking-wider">Recarga #{index + 1}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeRecarga(recarga.id)}
                                                    className="text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center"
                                                >
                                                    <span>Eliminar</span>
                                                </button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kilometraje</label>
                                            <input type="number" name={`kmRecarga-${recarga.id}`} value={recarga.kmRecarga ?? ''} onChange={(e) => handleRecargaChange(recarga.id, 'kmRecarga', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto ₡</label>
                                            <input type="number" name={`monto-${recarga.id}`} value={recarga.monto ?? ''} onChange={(e) => handleRecargaChange(recarga.id, 'monto', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Litros</label>
                                            <input type="number" name={`litros-${recarga.id}`} value={recarga.litros ?? ''} onChange={(e) => handleRecargaChange(recarga.id, 'litros', e.target.value)} step="0.01" className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Combustible</label>
                                            <select name={`tipoCombustible-${recarga.id}`} value={recarga.tipoCombustible || ''} onChange={(e) => handleRecargaChange(recarga.id, 'tipoCombustible', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none">
                                                <option value="">Seleccione...</option>
                                                <option value="Super">Super</option>
                                                <option value="Regular">Regular</option>
                                                <option value="Diesel">Diesel</option>
                                                <option value="Gas">Gas</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 md:col-span-4">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gasolinera</label>
                                            <input type="text" name={`gasolinera-${recarga.id}`} value={recarga.gasolinera || ''} onChange={(e) => handleRecargaChange(recarga.id, 'gasolinera', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm appearance-none" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="pt-2">
                            <button 
                                type="button" 
                                onClick={addRecarga}
                                className="text-[10px] font-bold text-orange-700 bg-orange-100/80 border border-orange-200 hover:bg-orange-200 px-4 py-2 rounded-xl uppercase transition-colors flex items-center justify-center gap-1 w-full md:w-auto"
                            >
                                <span>Agregar otra recarga</span>
                            </button>
                        </div>
                    </div>

                    {/* OBSERVACIONES */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                        <textarea 
                            name="observaciones" 
                            value={formData.observaciones || ''} 
                            onChange={handleChange} 
                            rows={3}
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 text-[16px] md:text-sm"
                        ></textarea>
                    </div>

                    {/* TOTAL KM CALCULADO */}
                    <div className="bg-slate-100 p-4 rounded-xl flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase">Total KM Recorridos:</span>
                        <span className="text-xl font-black text-blue-900">
                            {((formData.kmLlegada || 0) - (formData.kmSalida || 0)) > 0 
                                ? ((formData.kmLlegada || 0) - (formData.kmSalida || 0)) 
                                : 0} km
                        </span>
                    </div>

                    {/* FIRMA */}
                    <div className="border border-slate-200 rounded-xl p-4">
                        <h3 className="text-xs font-black text-slate-700 uppercase mb-3 text-center">Firma del Conductor</h3>
                        <div className={isSigned ? "pointer-events-none opacity-50" : ""}>
                            <SignaturePad 
                                onSignatureChange={handleSignature} 
                                initialSignature={formData.firma?.imageBase64}
                            />
                        </div>
                        {!isSigned ? (
                            <ActionButton
                                type="button"
                                variant="primary"
                                label="Listo"
                                onClick={async () => {
                                    if(!formData.firma) {
                                        await confirm({
                                            title: 'Firma Requerida',
                                            description: 'Por favor, firme antes de marcar como listo.',
                                            confirmLabel: 'ACEPTAR',
                                            variant: 'warning'
                                        });
                                        return;
                                    }
                                    setIsSigned(true);
                                }}
                                className="w-full mt-2"
                            />
                        ) : (
                            <ActionButton
                                type="button"
                                variant="secondary"
                                label="Editar Firma"
                                onClick={() => setIsSigned(false)}
                                className="w-full mt-2"
                            />
                        )}
                    </div>

                    {/* GASTOS RELACIONADOS - Oculto en Bitácoras por centralización en Análisis */}
                    {false && (
                    <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-200 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <FiCreditCard className="text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight">Gastos Relacionados</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Consumos registrados en este recorrido</p>
                                </div>
                            </div>
                            {isEditing && (
                                <ActionButton 
                                    type="button"
                                    variant="primary"
                                    onClick={() => {
                                        setEditingExpense(null);
                                        setIsExpenseModalOpen(true);
                                    }}
                                    icon={<FiPlus />}
                                    label="AGREGAR GASTO"
                                    className="!py-2 !px-4 !text-[10px]"
                                />
                            )}
                        </div>

                        {!isEditing ? (
                            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-400">Guarde la bitácora primero para poder asociar gastos específicos.</p>
                            </div>
                        ) : relatedExpenses.length === 0 ? (
                            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-400">No hay gastos asociados a este recorrido.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {relatedExpenses.map(expense => (
                                    <div key={expense.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:border-emerald-200 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-full">
                                                {expense.categoria}
                                            </span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <IconButton 
                                                    icon={<FiEdit2 />} 
                                                    onClick={() => {
                                                        setEditingExpense(expense);
                                                        setIsExpenseModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50"
                                                />
                                                <IconButton 
                                                    icon={<FiTrash2 />} 
                                                    onClick={() => handleDeleteExpense(expense.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs font-bold text-slate-700 mb-1 line-clamp-1">{expense.descripcion}</p>
                                        <div className="flex justify-between items-end mt-2">
                                            <span className="text-xs font-black text-slate-900">₡{expense.monto.toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">{new Date(expense.fecha).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {relatedExpenses.length > 0 && (
                            <div className="flex justify-between items-center px-4 py-3 bg-emerald-600 rounded-xl text-white">
                                <span className="text-[10px] font-black uppercase">Total Gastos Recorrido</span>
                                <span className="text-sm font-black italic">₡{relatedExpenses.reduce((sum, e) => sum + e.monto, 0).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    )}
                </form>

                {/* ACCIONES (FOOTER) */}
                <div className="flex gap-3 p-4 sm:p-6 border-t border-slate-100 bg-slate-50 rounded-b-[24px] sm:rounded-b-[32px] flex-none">
                    <ActionButton
                        type="button"
                        variant="secondary"
                        label="Cancelar"
                        disabled={isLoading}
                        onClick={onClose}
                        className="flex-1 !py-3 !text-[10px] !font-bold !uppercase !rounded-xl disabled:opacity-50"
                    />
                    {(() => {
                        const isPhotoRequired = !photoPolicyStatus.disabled && photoPolicyStatus.vencida;
                        const isPhotoMissing = isPhotoRequired && selectedPhotoFiles.length === 0 && !initialData?.oneDriveUrl && !initialData?.photoTimestamp && !initialData?.photoStoragePath && existingPhotos.length === 0;
                        const isDisabled = isLoading || (activeLogWarning !== null && !isEditing) || isPhotoMissing;

                        let buttonLabel = "Guardar Registro";
                        if (isLoading) {
                            if (saveProgress?.message) {
                                buttonLabel = saveProgress.message;
                            } else {
                                buttonLabel = "Guardando...";
                            }
                        } else if (failedUploadsInfo && failedUploadsInfo.failedCount > 0) {
                            buttonLabel = "Reintentar Subida Pendiente";
                        }

                        return (
                            <ActionButton
                                type="submit"
                                form="vehicle-log-form"
                                variant="primary"
                                label={buttonLabel}
                                disabled={isDisabled}
                                className={`flex-1 !py-3 !text-[10px] !font-black !uppercase !tracking-wider !rounded-xl ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                        );
                    })()}
                </div>
            </div>

            {false && isExpenseModalOpen && isEditing && (
                <VehicleExpenseModal
                    show={isExpenseModalOpen}
                    onClose={() => setIsExpenseModalOpen(false)}
                    unidad={formData.unidadName || ''}
                    vehiculoId={formData.unidadId}
                    bitacoraId={initialData?.id}
                    currentUser={currentUser}
                    initialData={editingExpense}
                />
            )}
        </div>,
        document.body
    );
};

export const formatSystemEventDateTime = (d: Date) => {
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = String(hours).padStart(2, '0') + ':' + minutes + ':' + seconds + ' ' + ampm;
    return `${day} ${month} ${year} • ${strTime}`;
};

export const formatSystemTimeOnly = (timeStr: string) => {
    if (!timeStr) return "";
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const seconds = parts[2] || "00";
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    }
    return timeStr;
};
