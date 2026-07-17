import React, { useState, useEffect, useRef, useMemo } from "react";
import { User } from "@/utils/types";
import { db } from "@/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  or,
  getDocs,
  limit,
} from "firebase/firestore";
import { setVersionedDocOffline, updateVersionedDocOffline } from "@/core/versionControl";
import { networkProbe } from "@/core/offline/networkProbe";
import {
  FiArrowLeft,
  FiSend,
  FiActivity,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiMessageSquare,
  FiEdit2,
  FiTrash2,
  FiCamera,
  FiFileText,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiUsers,
  FiTruck,
  FiClock,
  FiCalendar,
  FiLink,
  FiDownload,
} from "react-icons/fi";
import { IconButton, StatusBadge, ActionButton } from "@/design-system";
import { OperationalLogInput } from "./components/TimelineInput";
import { Pin, PinOff, Trash, Edit3, CornerUpLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEmployees } from "@/hooks/useEmployees";
import {
  dispatchNotifications,
  detectMentionsInText,
} from "@/modules/job_scheduling/jobNotificationDispatcher";
import { useLocation } from "react-router-dom";
import { TimelineEvent } from "@/modules/job_scheduling/types";
import { useLogTimeline } from "./hooks/useSharedTimeline";
import { useOptimisticComments } from "./hooks/useOptimisticComments";
import { useLogUploader } from "./hooks/useTimelineUploader";
import { useSwipeMessageAction } from "@/modules/job_scheduling/hooks/useSwipeMessageAction";
import {
  isImageFile,
  forceDownloadFile,
  formatTime,
} from "@/modules/job_scheduling/utils/logHelpers";
import { VirtualizedTimeline } from "@/modules/job_scheduling/components/VirtualizedTimeline";
import { ImportWizardModal } from "../imports/components/ImportWizardModal";
import { ModalPortal } from "@/modules/job_scheduling/components/ModalPortal";
import { isAdmin } from "@/utils/permissions";
import { useAuditPermanence } from "@/hooks/useAuditPermanence";

function getHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function safeDate(ts: any): Date {
  if (!ts) return new Date(0);
  
  let d: Date;
  if (ts.toDate && typeof ts.toDate === 'function') {
    d = ts.toDate();
  } else if (ts instanceof Date) {
    d = ts;
  } else if (typeof ts === 'number' || typeof ts === 'string') {
    d = new Date(ts);
  } else if (ts.seconds !== undefined) {
    d = new Date(ts.seconds * 1000);
  } else {
    d = new Date(0);
  }

  return isNaN(d.getTime()) ? new Date(0) : d;
}

export interface SharedTimelineProps {
  trabajoId?: string; // Kept for backwards compatibility
  parentId?: string;
  parentCollection?: string;
  timelineId?: string;
  onBack: () => void;
  onSetActiveModule?: (module: any) => void; // Added for navigation
  currentUser?: User;
  metadata?: {
    title?: string;
    subtitle?: string;
    status?: string;
    badges?: React.ReactNode[];
    cuadrilla?: string[];
  };
}

export default function SharedTimeline({
  trabajoId,
  parentId: providedParentId,
  parentCollection = "trabajos",
  timelineId,
  onBack,
  onSetActiveModule, // Added for navigation
  currentUser,
  metadata,
}: SharedTimelineProps) {
  useEffect(() => {
    console.log("[TRACE][OperationalLogView] MOUNT");
    console.log("[TRACE][SharedTimeline] MOUNT");
    return () => {
      console.log("[TRACE][OperationalLogView] UNMOUNT");
      console.log("[TRACE][SharedTimeline] UNMOUNT");
    }
  }, []);

  useEffect(() => {
    console.log("[TRACE][OperationalLogView] RENDER");
    console.log("[TRACE][SharedTimeline] RENDER");
  });

  const resolvedId = providedParentId || trabajoId;

  useAuditPermanence({
    module: 'Programación de Trabajos',
    submodule: 'Bitácora Operacional (Timeline)',
    recordId: resolvedId,
    recordCode: metadata?.title,
    enabled: !!resolvedId
  });

  const activeParentId = resolvedId;

  const [currentCollection, setCurrentCollection] = useState<string>(parentCollection);

  useEffect(() => {
    setCurrentCollection(parentCollection);
  }, [parentCollection]);

  const [resolvedTimelineId, setResolvedTimelineId] = useState<string | undefined>(timelineId);
  const resolvedTimelineIdRef = useRef(resolvedTimelineId);

  useEffect(() => {
    setResolvedTimelineId(timelineId);
    resolvedTimelineIdRef.current = timelineId;
  }, [timelineId]);

  useEffect(() => {
    resolvedTimelineIdRef.current = resolvedTimelineId;
  }, [resolvedTimelineId]);

  const location = useLocation();
  const { employees } = useEmployees();
  const metadataRef = useRef(metadata);

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);
  
  interface OperationalContext {
    jobTitle: string;
    jobStatus: string;
    jobLocation: string;
    jobOt: string;
    vehicleName: string;
    details: any | null;
    linkedLog: any | null;
    trabajoId: string | null;
    isLoading: boolean;
  }

  const [context, setContext] = useState<OperationalContext>({
    jobTitle: metadata?.title || "",
    jobStatus: metadata?.status || "",
    jobLocation: metadata?.subtitle || "",
    jobOt: "",
    vehicleName: "",
    details: null,
    linkedLog: null,
    trabajoId: trabajoId || null,
    isLoading: true,
  });

  const {
    jobTitle,
    jobStatus,
    jobLocation,
    jobOt,
    vehicleName,
    details: fetchedTrabajoDetails,
    linkedLog: linkedLogDetails,
    trabajoId: finalTrabajoId,
  } = context;

  const [newMessage, setNewMessage] = useState("");
  const [showTechnicalLog, setShowTechnicalLog] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{
    urls: string[];
    currentIndex: number;
    commentId?: string;
  } | null>(null);
  
  const [zoomState, setZoomState] = useState({ scale: 1, x: 0, y: 0 });
  const zoomRef = useRef({ 
    initialDistance: 0, 
    initialScale: 1, 
    lastScale: 1, 
    startX: 0, 
    startY: 0, 
    lastX: 0, 
    lastY: 0 
  });
  const [showGridGallery, setShowGridGallery] = useState(false);
  const [galleryTab, setGalleryTab] = useState<'media' | 'docs' | 'links'>('media');
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    type: 'image' | 'file';
    url: string;
    name?: string;
    comment: any;
  } | null>(null);
  const [inlineReplyTarget, setInlineReplyTarget] = useState<{
    type: 'image' | 'file';
    url: string;
    name?: string;
    comment: any;
  } | null>(null);
  const [inlineReplyMessage, setInlineReplyMessage] = useState("");

  const { optimisticComments, setOptimisticComments } = useOptimisticComments(resolvedTimelineId);

  const virtuosoTimelineRef = useRef<any>(null);
  const scrollRef = useRef<any>({
    get scrollTop() {
      return virtuosoTimelineRef.current?.getScrollTop() || 0;
    },
    set scrollTop(val) {
      if (val === 0) {
        // do nothing or handle top
      } else {
        virtuosoTimelineRef.current?.scrollToBottom();
      }
    },
    get scrollHeight() {
      return 1000000;
    }
  });

  const {
    mergedComments,
    mergedCommentsMap,
    latestPinned,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useLogTimeline(activeParentId, optimisticComments, scrollRef, currentCollection, resolvedTimelineId);

  // EFFECT: Self-healing for events missing timestamps (Fixes "ghost" events in legacy records)
  useEffect(() => {
    if (mergedComments.length > 0 && resolvedTimelineId && networkProbe.isOnline()) {
      const ghostEvents = mergedComments.filter(c => !c.timestamp && c.createdAt && !c.optimistic && (c.tipo === 'system_event' || c.tipo === 'sistema'));
      if (ghostEvents.length > 0) {
        console.log(`[TRACE][SharedTimeline] Self-healing detected ${ghostEvents.length} ghost events (missing timestamp)`);
        
        // Repair them one by one (throttled/limited)
        ghostEvents.slice(0, 3).forEach(async (evt) => {
          try {
            const docRef = doc(db, "operational_timelines", resolvedTimelineId, "events", evt.id);
            await updateDoc(docRef, {
              timestamp: evt.createdAt,
              _repaired: true,
              _repairedAt: new Date().toISOString()
            });
            console.log(`[TRACE][SharedTimeline] Repaired event: ${evt.id}`);
          } catch(e: any) {
             if (e.message?.includes('not-found')) {
                const legacyPath = `${currentCollection}/${activeParentId}/timeline`;
                try {
                  const legacyRef = doc(db, legacyPath, evt.id);
                  await updateDoc(legacyRef, { timestamp: evt.createdAt, _repaired: true });
                } catch(e2) {}
             }
          }
        });
      }
    }
  }, [mergedComments, resolvedTimelineId, activeParentId, currentCollection]);

  const timelineWithSeparators = useMemo(() => {
    const list: any[] = [];
    let lastDate = "";
    // REMOVED duplicate .sort() here because useLogTimeline already returns mergedComments sorted chronologically.
    // This reduces re-render cost for large timelines.
    mergedComments
      .filter((c) => {
        if (!c || !c.tipo) return false;
        return ["comentario", "imagen", "foto", "archivo", "sistema", "ubicacion", "system_event"].includes(c.tipo);
      })
      .forEach((msg) => {
        const d = safeDate(msg.timestamp);
        const dateStr = d.toDateString();
        if (dateStr !== lastDate) {
          list.push({ id: `sep-${dateStr}`, tipo: "separador", fecha: d });
          lastDate = dateStr;
        }
        list.push(msg);
      });
    return list;
  }, [mergedComments]);

  const [imageDiagnoses, setImageDiagnoses] = useState<
    Record<string, { loading: boolean; error: string | null }>
  >({});

  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    usuarioId?: string;
    usuarioNombre: string;
    mensaje: string;
    tipo: "texto" | "imagen" | "archivo";
    imagenUrl?: string;
    replyMediaIndex?: number;
  } | null>(null);

  const [activeMenuComment, setActiveMenuComment] = useState<TimelineEvent | null>(null);
  const [replyMediaTarget, setReplyMediaTarget] = useState<any | null>(null);
  const [editingComment, setEditingComment] = useState<TimelineEvent | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);

  const touchStartZoomX = useRef<number | null>(null);

  const attachMenuRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    isUploading,
    pendingAttachment,
    setPendingAttachment,
    uploadMediaAndSend,
    handleCameraChange,
    handleSendAttachment,
    handleFileChange,
    handleCancelAttachment
  } = useLogUploader(
    activeParentId,
    currentUser,
    setOptimisticComments,
    setNewMessage,
    setShowAttachMenu,
    setReplyingTo,
    replyingTo,
    scrollRef,
    cameraRef,
    galleryRef,
    fileRef,
    employees,
    jobTitle,
    metadata?.cuadrilla || [],
    currentCollection,
    resolvedTimelineId
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAttachMenu]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logActiveFilter, setLogActiveFilter] = useState("all");

  useEffect(() => {
    if (!activeParentId && !resolvedTimelineId) return;

    const fetchAllMetadata = async () => {
      const startTime = performance.now();
      console.log("[TRACE][SharedTimeline] fetchAllMetadata STARTED", { activeParentId, resolvedTimelineId });
      try {
        let newContext: OperationalContext = {
          jobTitle: metadataRef.current?.title || "Bitácora Sin Título",
          jobStatus: metadataRef.current?.status || "",
          jobLocation: metadataRef.current?.subtitle || "",
          jobOt: "",
          vehicleName: "",
          details: null,
          linkedLog: null,
          trabajoId: trabajoId || null,
          isLoading: false
        };

        const fetchPromises: Promise<any>[] = [];

        // 1. Fetch Timeline-Only Metadata
        if (resolvedTimelineId && !activeParentId) {
          fetchPromises.push(getDoc(doc(db, "operational_timelines", resolvedTimelineId)).then(snap => ({ type: 'timeline', snap })));
        }

        // 2. Fetch Job Metadata
        if (trabajoId) {
          fetchPromises.push(getDoc(doc(db, "trabajos", trabajoId)).then(snap => ({ type: 'job', snap, requestedId: trabajoId })));
        }

        // 3. Fetch Vehicle Log Metadata or direct Job
        if (activeParentId) {
          if (currentCollection === "bitacora_vehiculos") {
            fetchPromises.push(getDoc(doc(db, "bitacora_vehiculos", activeParentId)).then(snap => ({ type: 'vehicle_log', snap, requestedId: activeParentId })));
          } else {
            // Under "trabajos" or undetermined, fetch from "trabajos" AND probe "bitacora_vehiculos" as a failsafe!
            if (activeParentId !== trabajoId) {
              fetchPromises.push(getDoc(doc(db, "trabajos", activeParentId)).then(snap => ({ type: 'job_direct', snap, requestedId: activeParentId })));
            }
            fetchPromises.push(getDoc(doc(db, "bitacora_vehiculos", activeParentId)).then(snap => ({ type: 'vehicle_log_probe', snap, requestedId: activeParentId })));
          }
        }

        // Failsafe 4: If we have a trabajoId but no bitacora yet, search for it
        if (trabajoId) {
           const bitRef = collection(db, "bitacora_vehiculos");
           const q = query(bitRef, where("trabajoId", "==", trabajoId), limit(1));
           fetchPromises.push(getDocs(q).then(snap => ({ type: 'vehicle_log_query', snap })));
        }

        const results = await Promise.all(fetchPromises);
        console.log(`[TRACE][SharedTimeline] Parallel fetch COMPLETED in ${Math.round(performance.now() - startTime)}ms`);

        let resolvedJobData: any = null;
        let vehicleLogData: any = null;
        let timelineData: any = null;

        // Offline fallback processor
        const processWithOfflineFallback = async (res: any, collectionName: string) => {
            if (res.snap.exists && res.snap.exists()) return res.snap.data();
            if (res.requestedId) {
                 try {
                     const { localDocStore } = await import('@/core/offline/localDocStore');
                     const offlineDoc = await localDocStore.getLocalDoc(collectionName, res.requestedId);
                     if (offlineDoc && offlineDoc.data) {
                         console.log(`[TRACE][SharedTimeline] fallback to offline ${collectionName} SUCCESS`);
                         return offlineDoc.data;
                     }
                 } catch(e) { }
            }
            return null;
        };

        for (const res of results) {
          if (res.type === 'timeline' && res.snap.exists()) timelineData = res.snap.data();
          if (res.type === 'job' || res.type === 'job_direct') {
              const data = await processWithOfflineFallback(res, 'trabajos');
              if (data) resolvedJobData = data;
          }
          if (res.type === 'vehicle_log') {
              const data = await processWithOfflineFallback(res, 'bitacora_vehiculos');
              if (data) vehicleLogData = data;
          }
          if (res.type === 'vehicle_log_probe') {
             const data = await processWithOfflineFallback(res, 'bitacora_vehiculos');
             if (data) {
                 vehicleLogData = data;
                 if (!trabajoId && currentCollection !== "bitacora_vehiculos") {
                    setCurrentCollection("bitacora_vehiculos");
                 }
             }
          }
          if (res.type === 'vehicle_log_query') {
             if (!res.snap.empty && !vehicleLogData) {
                vehicleLogData = res.snap.docs[0].data();
             }
          }
        }

        // Offline fallback query for vehicle_log BY trabajoId
        if (!vehicleLogData && trabajoId) {
             try {
                 const { localDocStore } = await import('@/core/offline/localDocStore');
                 const offlineDocs = await localDocStore.getLocalCollection('bitacora_vehiculos');
                 const match = offlineDocs.find(d => d.data && d.data.trabajoId === trabajoId);
                 if (match) {
                     console.log("[TRACE][SharedTimeline] fallback to offline bitacora_vehiculos BY trabajoId SUCCESS");
                     vehicleLogData = match.data;
                 }
             } catch(e) {}
        }

        // 1. Resolution for Timeline-Only
        if (timelineData) {
          const tlMeta = timelineData.metadata || {};
          newContext = {
            ...newContext,
            details: timelineData,
            jobTitle: tlMeta.title || tlMeta.unidad || "Canal de Comunicación",
            jobStatus: tlMeta.status || "en_proceso",
            jobLocation: tlMeta.subtitle || tlMeta.destino || "Ubicación de Campo",
            vehicleName: tlMeta.unidad || ""
          };
        }

        // 2. Resolution for Vehicle Log
        if (vehicleLogData) {
          const logData = vehicleLogData;
          
          // Identify all potential timelines
          const jobTimelineId = resolvedJobData?.timelineId;
          const bitacoraTimelineId = logData?.timelineId;
          const finalTimelineId = jobTimelineId || bitacoraTimelineId;

          if (finalTimelineId && finalTimelineId !== resolvedTimelineId) {
            console.log(`[TRACE][SharedTimeline] Switching timelineId: ${resolvedTimelineId} -> ${finalTimelineId}`, { source: jobTimelineId ? 'job' : 'bitacora' });
            setResolvedTimelineId(finalTimelineId);
            // Async sync (don't await)
            if (finalTimelineId === jobTimelineId && bitacoraTimelineId !== jobTimelineId) {
               updateDoc(doc(db, "bitacora_vehiculos", (logData.id || activeParentId)), { timelineId: finalTimelineId });
            } else if (finalTimelineId === bitacoraTimelineId && (!jobTimelineId || jobTimelineId !== bitacoraTimelineId)) {
               // Fixed: If jobTimelineId is missing OR different, we back-fill it
               if (trabajoId) {
                 updateDoc(doc(db, "trabajos", trabajoId as string), { timelineId: finalTimelineId });
               }
            }
          }

          let foundTrabajoId = logData.trabajoId || null;
          let foundJobData = resolvedJobData;

          if (!foundJobData && foundTrabajoId) {
             const jobSnap = await getDoc(doc(db, "trabajos", foundTrabajoId));
             if (jobSnap.exists()) foundJobData = jobSnap.data();
          }

          if (!foundJobData) {
             const trabajosCol = collection(db, "trabajos");
             const q = query(trabajosCol, or(where("registroBitacoraId", "==", activeParentId), where("bitacoraIds", "array-contains", activeParentId)));
             const qSnap = await getDocs(q);
             if (!qSnap.empty) {
               foundTrabajoId = qSnap.docs[0].id;
               foundJobData = qSnap.docs[0].data();
             }
          }

          const resolvedDriverName = (() => {
            if (!logData.conductorName || logData.conductorName.includes("@") || logData.conductorName === logData.conductorId) {
              const emp = employees?.find(e => e?.id === logData.conductorId);
              return emp ? (emp.name || emp.username || "Sin nombre") : (logData.conductorName || "Sin nombre");
            }
            return logData.conductorName;
          })();
          const vehicleUnit = logData.unidad || logData.unidadName || "Vehículo sin unidad";
          const vehiclePlaca = logData.placa || "";

          const vehicleLogTitle = metadataRef.current?.title || `Bitácora de Salida: ${vehicleUnit}`;
          const defaultSubtitle = `${vehiclePlaca ? vehiclePlaca + " - " : ""}${resolvedDriverName}`;
          const vehicleLogSubtitle = metadataRef.current?.subtitle || defaultSubtitle;

          newContext.jobTitle = vehicleLogTitle;
          newContext.jobLocation = vehicleLogSubtitle || logData.destino || "Sin destino";
          newContext.jobStatus = logData.horaLlegada ? "finalizado" : "en_proceso";

          if (foundTrabajoId && foundJobData) {
            newContext.trabajoId = foundTrabajoId;
            resolvedJobData = foundJobData;
            newContext.linkedLog = logData;
            newContext.vehicleName = logData.unidadName || logData.unidadId || "";
          } else if (!trabajoId || activeParentId === trabajoId || currentCollection === "bitacora_vehiculos") {
            newContext = {
              ...newContext,
              details: logData,
              jobTitle: vehicleLogTitle,
              jobStatus: logData.horaRegreso || logData.horaLlegada ? "FINALIZADA" : "EN RUTA",
              jobLocation: vehicleLogSubtitle || logData.destino || "Sin destino",
              vehicleName: logData.unidadName || logData.unidadId || ""
            };
          } else {
            newContext.linkedLog = logData;
            newContext.vehicleName = logData.unidadName || logData.unidadId || "";
          }
        }

        // 3. Final Title Resolution
        if (resolvedJobData) {
            if (resolvedJobData.timelineId && resolvedJobData.timelineId !== resolvedTimelineId) {
              setResolvedTimelineId(resolvedJobData.timelineId);
            }
            const isVehicleLog = currentCollection === "bitacora_vehiculos";
            newContext = {
                ...newContext,
                details: resolvedJobData,
                jobTitle: isVehicleLog && newContext.jobTitle ? newContext.jobTitle : (resolvedJobData.titulo || resolvedJobData.tipo_trabajo || "Trabajo sin título"),
                jobStatus: resolvedJobData.estado || newContext.jobStatus,
                jobLocation: isVehicleLog && newContext.jobLocation ? newContext.jobLocation : (resolvedJobData.ubicacion || ""),
                jobOt: resolvedJobData.otCode || ""
            };
        }

        setContext(prev => ({ ...prev, ...newContext, isLoading: false }));
        console.log(`[TRACE][SharedTimeline] Metadata flow COMPLETED in ${Math.round(performance.now() - startTime)}ms`);
      } catch (e) {
        console.error("Error fetching operational metadata:", e);
        setContext(prev => ({ ...prev, isLoading: false }));
      }
    };
    fetchAllMetadata();
  }, [activeParentId, trabajoId, currentCollection, resolvedTimelineId]);

  const handleSendLocation = () => {
    setShowAttachMenu(false);
    setIsGettingLocation(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setIsGettingLocation(false);
      setGpsError("Este dispositivo no soporta geolocalización o no tiene acceso a la API del navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const optimisticId = crypto.randomUUID();
        const msg = {
          id: optimisticId,
          tipo: "ubicacion",
          latitude,
          longitude,
          accuracy,
          mapPreview: `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=400x200&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}`,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
          timestamp: new Date().toISOString(),
          usuarioId: currentUser?.id,
          usuarioNombre: currentUser?.name || currentUser?.email,
          isOptimistic: true,
          optimisticId: optimisticId,
          progress: 100,
        };
        setOptimisticComments((prev) => [...prev, msg]);
        try {
          const path = resolvedTimelineId
            ? `operational_timelines/${resolvedTimelineId}/events`
            : `${currentCollection}/${activeParentId}/timeline`;

          await setVersionedDocOffline(path, optimisticId, {
            tipo: "ubicacion",
            latitude,
            longitude,
            accuracy,
            mapPreview: msg.mapPreview,
            googleMapsUrl: msg.googleMapsUrl,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            usuarioId: currentUser?.id,
            usuarioNombre: currentUser?.name || currentUser?.email,
            optimisticId: optimisticId,
          });
        } catch (e) {
          setGpsError("Error al enviar la ubicación al servidor.");
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        let errorMsg = "No fue posible obtener tu ubicación.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Permiso de ubicación denegado. Por favor, active los permisos del GPS en su navegador.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "El GPS del dispositivo está desactivado o la ubicación no está disponible.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Tiempo de espera agotado al obtener el posicionamiento GPS de alta precisión.";
        }
        setGpsError(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    if (mergedComments?.length === 0) return;
    const key = `logView_${activeParentId}_scroll`;
    const savedScroll = sessionStorage.getItem(key);
    requestAnimationFrame(() => {
      if (savedScroll && scrollRef.current) {
        scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      }
    });
  }, [activeParentId, mergedComments?.length]);

  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        const key = `logView_${activeParentId}_scroll`;
        sessionStorage.setItem(key, scrollRef.current.scrollTop.toString());
      }
    };
  }, [activeParentId]);

  const handlePinMessage = async (comment: any) => {
    try {
      const path = resolvedTimelineId
        ? `operational_timelines/${resolvedTimelineId}/events`
        : `${currentCollection}/${activeParentId}/timeline`;
      
      const isPinned = !!comment.pinned;
      await updateVersionedDocOffline(path, comment.id, {
        pinned: !isPinned,
        pinnedBy: !isPinned ? (currentUser?.name || currentUser?.email || "Usuario") : null,
        pinnedAt: !isPinned ? new Date().toISOString() : null,
      });
      setActiveMenuComment(null);
    } catch (err) {
      console.error("Error toggling pin:", err);
    }
  };

  const handleStartEdit = (comment: any) => {
    setEditingComment(comment);
    setNewMessage(comment.mensaje || "");
    setActiveMenuComment(null);
    setTimeout(() => {
      const inputElem = document.querySelector('input[placeholder="Mensajes..."]') as HTMLInputElement;
      if (inputElem) inputElem.focus();
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setNewMessage("");
  };

  const handleDeleteMessage = async (comment: any) => {
    try {
      const path = resolvedTimelineId
        ? `operational_timelines/${resolvedTimelineId}/events`
        : `${currentCollection}/${activeParentId}/timeline`;
      
      await updateVersionedDocOffline(path, comment.id, {
        eliminado: true,
        mensaje: "Este mensaje fue eliminado.",
        fileUrls: [],
        fileNames: [],
        fileSizes: [],
      });
      setActiveMenuComment(null);
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  useEffect(() => {
    if (timelineWithSeparators?.length > 0 && location.state?.scrollToCommentId) {
      const commentId = location.state.scrollToCommentId;
      // We clear the state so it doesn't scroll again on re-renders, but since location is immutable,
      // we just track if we already scrolled
      const hasScrolledKey = `hasScrolled_${commentId}`;
      if (!sessionStorage.getItem(hasScrolledKey)) {
        setTimeout(() => {
          scrollToMessage(commentId);
          sessionStorage.setItem(hasScrolledKey, "true");
        }, 1000); // Give time for virtualization to settle
      }
    }
  }, [timelineWithSeparators?.length, location.state]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingComment) {
      if (!newMessage.trim() || !currentUser) return;
      try {
        const path = resolvedTimelineId
          ? `operational_timelines/${resolvedTimelineId}/events`
          : `${currentCollection}/${activeParentId}/timeline`;
        
        // Also detect mentions on edit
        const mentions = detectMentionsInText(newMessage, employees);
        
        await updateVersionedDocOffline(path, editingComment.id, {
          mensaje: newMessage.trim(),
          mentions: mentions,
          editado: true,
          editedAt: new Date().toISOString(),
          editedBy: currentUser.name || currentUser.email || "Usuario",
        });
        setNewMessage("");
        setEditingComment(null);
      } catch (error) {
        alert("Error al editar el comentario.");
      }
      return;
    }
    if (pendingAttachment) {
      await handleSendAttachment(newMessage);
      return;
    }
    if (!newMessage.trim() || !currentUser) return;

    // Migración a Arquitectura Unificada (FASE 10A)
    // Se elimina el bloque condicional de navigator.onLine y enqueueAction manual
    // setVersionedDocOffline maneja persistencia local, mutaciones y sync transparente
    try {
      const mentions = detectMentionsInText(newMessage, employees);
      const path = resolvedTimelineId
        ? `operational_timelines/${resolvedTimelineId}/events`
        : `${currentCollection}/${activeParentId}/timeline`;
      
      const eventId = crypto.randomUUID();
      const payload: any = {
        id: eventId,
        tipo: "comentario",
        mensaje: newMessage.trim(),
        mentions: mentions,
        usuarioId: currentUser.id,
        usuarioNombre: currentUser.name || currentUser.email,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        editado: false,
        eliminado: false,
      };

      if (replyingTo) {
        payload.replyToId = replyingTo.id;
        payload.replyPreview = replyingTo.mensaje || (replyingTo.tipo === "imagen" ? "Evidencia fotográfica" : "Archivo adjunto");
        payload.replyType = replyingTo.tipo;
        payload.replyToUserId = replyingTo.usuarioId;
        payload.replyMediaIndex = replyingTo.replyMediaIndex;
      }

      // 1. Emitir optimista para UI inmediata
      const optimisticMsg = {
        ...payload,
        isOptimistic: true,
        timestamp: new Date(), // Local Date object for UI
      };
      setOptimisticComments(prev => [...prev, optimisticMsg]);

      // 2. Persistir localmente y encolar mutación
      await setVersionedDocOffline(path, eventId, payload);
      
      // 3. Notificaciones (si hay red)
      if (navigator.onLine) {
        dispatchNotifications({
          trabajoId: activeParentId,
          parentCollection: currentCollection,
          trabajoTitle: jobTitle,
          comentarioId: eventId,
          mensaje: newMessage.trim(),
          mentions: mentions,
          replyToUserId: replyingTo?.usuarioId,
          replyToId: replyingTo?.id,
          currentUser: { id: currentUser.id, name: currentUser.name || currentUser.email },
          cuadrilla: fetchedTrabajoDetails?.cuadrilla || []
        });
      }

      setNewMessage("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error sending message via unified offline engine:", error);
      alert("Error al enviar el comentario.");
    }
  };

  const scrollToMessage = (msgId: string) => {
    setShowTechnicalLog(false);
    setTimeout(() => {
      const idx = timelineWithSeparators.findIndex((item) => item.id === msgId);
      if (idx !== -1 && virtuosoTimelineRef.current) {
        virtuosoTimelineRef.current.scrollToIndex(idx);
        setHighlightedMessageId(msgId);
        setTimeout(() => setHighlightedMessageId(null), 2500);
      } else {
        const elem = document.getElementById(`msg-${msgId}`);
        if (elem) {
          elem.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightedMessageId(msgId);
          setTimeout(() => setHighlightedMessageId(null), 2500);
        }
      }
    }, 150);
  };



  const handleReplyContext = () => {
    if (contextMenuTarget?.comment) {
      setInlineReplyTarget(contextMenuTarget);
      setContextMenuTarget(null);
    }
  };

  const handleShowInChatContext = () => {
    if (contextMenuTarget?.comment?.id) {
      const msgId = contextMenuTarget.comment.id;
      // Close everything
      setContextMenuTarget(null);
      setFullscreenImage(null);
      setShowGridGallery(false);
      setShowProjectInfo(false);
      setActiveMenuComment(null);
      setInlineReplyTarget(null);
      
      setTimeout(() => scrollToMessage(msgId), 300);
    }
  };

  const handleDownloadContext = async () => {
    if (contextMenuTarget?.url) {
      const { url, name } = contextMenuTarget;
      setContextMenuTarget(null);
      await forceDownloadFile(url, name || 'descarga');
    }
  };

  const handleSendInlineReply = async () => {
    if (!inlineReplyMessage.trim() || !currentUser || !inlineReplyTarget?.comment) return;

    try {
      const path = resolvedTimelineId
        ? `operational_timelines/${resolvedTimelineId}/events`
        : `${currentCollection}/${activeParentId}/timeline`;
      
      const replyId = crypto.randomUUID();
      const payload: any = {
        id: replyId,
        tipo: "comentario",
        mensaje: inlineReplyMessage.trim(),
        usuarioId: currentUser.id,
        usuarioNombre: currentUser.name || currentUser.email,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        editado: false,
        eliminado: false,
        replyToId: inlineReplyTarget.comment.id,
        ...(inlineReplyTarget.index !== undefined ? { replyMediaIndex: inlineReplyTarget.index } : {}),
      };

      // 1. Optimista
      const optimisticMsg = {
        ...payload,
        timestamp: new Date(),
        isOptimistic: true,
      };
      setOptimisticComments(prev => [...prev, optimisticMsg]);

      // 2. Persistir via Unified Offline
      await setVersionedDocOffline(path, replyId, payload);

      setInlineReplyMessage("");
      setInlineReplyTarget(null);
    } catch (error) {
      console.error("Error sending inline reply via unified engine:", error);
    }
  };

  const triggerReply = (comment: TimelineEvent) => {
    const safeFileUrls = Array.isArray(comment.fileUrls) ? comment.fileUrls : [];
    const safeFileNames = Array.isArray(comment.fileNames) ? comment.fileNames : [];
    const hasImages = safeFileUrls.some((url: string, idx: number) => isImageFile(safeFileNames[idx], url));
    const isImg = comment.tipo === "imagen" || comment.tipo === "foto" || !!hasImages;
    const isFile = comment.tipo === "archivo" && !isImg;
    let previewImgUrl = undefined;
    if (isImg && safeFileUrls?.length > 0) previewImgUrl = safeFileUrls[0];

    setReplyingTo({
      id: comment.id,
      usuarioId: comment.usuarioId,
      usuarioNombre: comment.usuarioNombre,
      mensaje: comment.mensaje || "",
      tipo: isImg ? "imagen" : isFile ? "archivo" : "texto",
      imagenUrl: previewImgUrl,
    });

    const inputElem = document.querySelector('input[placeholder="Mensajes..."]') as HTMLInputElement;
    if (inputElem) inputElem.focus();
  };

  const { swipingMessage, handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeMessageAction(
    setActiveMenuComment,
    triggerReply
  );

  const getStatusVariant = (status: string) => {
  const s = typeof status === 'string' ? status : String(status);
  switch (s) {
    case 'programado': return 'info';
    case 'en_proceso': return 'success';
    case 'finalizado': return 'neutral';
    case 'cancelado': return 'danger';
    case 'reprogramado': return 'warning';
    default: return 'neutral';
  }
};

const getDynamicTitleSize = (title: string) => {
    if (title?.length > 40) return "text-[11px] sm:text-xs leading-none font-bold";
    if (title?.length > 25) return "text-xs sm:text-sm leading-tight font-black";
    return "text-sm sm:text-base md:text-lg lg:text-xl font-black leading-tight";
  };

  const filteredLogs = mergedComments.filter((c: TimelineEvent) => {
    const safeFileUrls = Array.isArray(c.fileUrls) ? c.fileUrls : [];
    const safeFileNames = Array.isArray(c.fileNames) ? c.fileNames : [];
    const hasImages = safeFileUrls.some((url: string, idx: number) => isImageFile(safeFileNames[idx], url));
    const isImageComment = c.tipo === "imagen" || c.tipo === "foto" || !!hasImages;
    const isFileComment = c.tipo === "archivo" && !isImageComment;

    let actionText = "";
    if (c.tipo === "sistema") actionText = c.mensaje || "realizó una acción del sistema";
    else if (c.tipo === "comentario") {
      if (c.eliminado) actionText = "eliminó un comentario";
      else if (c.editado) actionText = "editó un comentario";
      else actionText = "envió un mensaje";
    } else if (isImageComment) actionText = "adjuntó evidencia fotográfica";
    else if (isFileComment) actionText = "adjuntó un archivo";
    else actionText = "realizó una actividad";

    const searchable = `${c.usuarioNombre} ${c.mensaje || ""} ${actionText}`.toLowerCase();
    const query = logSearchQuery.toLowerCase().trim();
    if (query && !searchable.includes(query)) return false;

    if (logActiveFilter === "messages" && (c.tipo !== "comentario" || c.eliminado || c.editado)) return false;
    if (logActiveFilter === "edits" && !c.editado) return false;
    if (logActiveFilter === "deletions" && !c.eliminado) return false;
    if (logActiveFilter === "photos" && !isImageComment) return false;
    if (logActiveFilter === "files" && !isFileComment) return false;
    return true;
  });

  const projectImages = useMemo(() => {
    const urls: { url: string; label: string; date: string; comment: any; index: number }[] = [];
    mergedComments.forEach((c) => {
      const safeFileUrls = Array.isArray(c.fileUrls) ? c.fileUrls : [];
      const safeFileNames = Array.isArray(c.fileNames) ? c.fileNames : [];
      if (!c.eliminado && safeFileUrls?.length > 0) {
        safeFileUrls.forEach((url, idx) => {
          if (isImageFile(safeFileNames[idx], url)) {
            urls.push({ url, label: c.usuarioNombre || "Usuario", date: c.timestamp ? formatTime(c.timestamp) : "", comment: c, index: idx });
          }
        });
      }
    });
    return urls;
  }, [mergedComments]);

  const allProjectImageUrls = useMemo(() => projectImages.map(i => i.url), [projectImages]);
  const displayZoomUrl = fullscreenImage ? fullscreenImage.urls[fullscreenImage.currentIndex] : "";

  // Reset zoom on image change
  useEffect(() => {
      setZoomState({ scale: 1, x: 0, y: 0 });
  }, [displayZoomUrl]);

  const handleZoomTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomRef.current.initialDistance = dist;
      zoomRef.current.initialScale = zoomState.scale;
    } else if (e.touches.length === 1 && zoomState.scale > 1) {
      zoomRef.current.startX = e.touches[0].clientX - zoomState.x;
      zoomRef.current.startY = e.touches[0].clientY - zoomState.y;
    }
  };

  const handleZoomTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && zoomState.scale >= 1) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newScale = Math.min(Math.max(1, zoomRef.current.initialScale * (dist / zoomRef.current.initialDistance)), 4);
      setZoomState(prev => ({ ...prev, scale: newScale }));
    } else if (e.touches.length === 1 && zoomState.scale > 1) {
      e.preventDefault();
      setZoomState(prev => ({
        ...prev,
        x: e.touches[0].clientX - zoomRef.current.startX,
        y: e.touches[0].clientY - zoomRef.current.startY
      }));
    }
  };

  const handleZoomTouchEnd = () => {
    zoomRef.current.initialDistance = 0;
  };

  const handleDoubleTap = () => {
    setZoomState(prev => ({
      scale: prev.scale === 1 ? 2 : 1,
      x: 0,
      y: 0
    }));
  };

  const projectFiles = useMemo(() => {
    const files: { url: string; name: string; size: number; date: string; label: string; comment: any }[] = [];
    mergedComments.forEach((c) => {
      const safeFileUrls = Array.isArray(c.fileUrls) ? c.fileUrls : [];
      const safeFileNames = Array.isArray(c.fileNames) ? c.fileNames : [];
      const safeFileSizes = Array.isArray(c.fileSizes) ? c.fileSizes : [];
      if (!c.eliminado && safeFileUrls?.length > 0) {
        safeFileUrls.forEach((url, idx) => {
          if (!isImageFile(safeFileNames[idx], url)) {
            files.push({ url, name: safeFileNames[idx] || "Archivo Adjunto", size: safeFileSizes[idx] || 0, date: c.fecha, label: c.usuarioNombre || "Usuario", comment: c, index: idx });
          }
        });
      }
    });
    return files;
  }, [mergedComments]);

  const projectLinks = useMemo(() => {
    const links: { url: string; label: string; date: string; comment: any }[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    mergedComments.forEach((c) => {
      if (!c.eliminado && c.texto) {
        const matches = c.texto.match(urlRegex);
        if (matches) {
          matches.forEach((url) => {
            links.push({ url, label: c.usuarioNombre || "Usuario", date: c.fecha, comment: c });
          });
        }
      }
    });
    return links;
  }, [mergedComments]);

  const formatJobDate = (startVal: any, endVal?: any) => {
    if (!startVal) return "Pendiente";
    const dStart = safeDate(startVal);
    if (dStart.getTime() <= 0) return "Pendiente";
    
    const dEnd = endVal ? safeDate(endVal) : null;
    
    try {
      const options: Intl.DateTimeFormatOptions = { 
        day: "numeric", 
        month: "long", 
        year: "numeric",
        timeZone: "UTC"
      };
      
      const startText = new Intl.DateTimeFormat("es-CR", options).format(dStart);
      
      if (!dEnd || dEnd.getTime() <= 0 || dStart.getTime() === dEnd.getTime()) {
        return startText;
      }
      
      const startDayMonth = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "long", timeZone: "UTC" }).format(dStart);
      const endText = new Intl.DateTimeFormat("es-CR", options).format(dEnd);
      
      return `${startDayMonth} al ${endText}`;
    } catch (e) {
      console.error("formatJobDate error:", e, startVal);
      return "Fecha inválida";
    }
  };

  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const lastScrollY = useRef(0);

  const onTimelineScroll = (scrollTop: number) => {
    // Only for desktop (matches lg in tailwind, approx 1024px)
    if (window.innerWidth < 1024) return;

    if (scrollTop > 200 && scrollTop > lastScrollY.current + 60) {
      if (!headerCollapsed) setHeaderCollapsed(true);
    } else if (scrollTop < lastScrollY.current - 60 || scrollTop < 100) {
      if (headerCollapsed) setHeaderCollapsed(false);
    }
    lastScrollY.current = scrollTop;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {!activeParentId ? (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-slate-50">
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 max-w-xs w-full">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiActivity className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-black uppercase tracking-tight mb-2">Sin actividad detectada</h3>
            <p className="text-slate-500 text-xs font-bold leading-relaxed mb-6">
              Esta bitácora no tiene registros históricos o eventos reportados en el timeline operativo.
            </p>
            
            {/* DIAGNOSTIC BLOCK */}
            <div className="mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[8px] uppercase font-black text-slate-400 block mb-1">ID DE RASTREO (TIMELINE)</span>
                <code className="text-[9px] font-mono font-bold text-blue-600 break-all select-all">
                    {resolvedTimelineId || "N/A (Carga fallida o inexistente)"}
                </code>
            </div>

            {/* REPAIR BUTTON REMOVED IN ARCHITECTURAL REFACTOR */}

          </div>
        </div>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {!headerCollapsed ? (
          <motion.div 
            key="full-header"
            initial={false}
            animate={{ y: 0, opacity: 1, height: "auto" }}
            exit={{ y: -80, opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white px-3 md:px-5 py-1 flex flex-col border-b border-slate-200 sticky top-0 z-30 flex-none shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-2">
          <IconButton
            icon={<FiArrowLeft className="w-3.5 h-3.5" />}
            onClick={onBack}
            variant="secondary"
            title="Volver a Programación"
            className="!w-6 !h-6 !p-0 shrink-0 flex items-center justify-center !bg-slate-50 hover:!bg-slate-100 border border-slate-200"
          />
          <div 
            onClick={() => setShowProjectInfo(true)}
            className="flex-1 flex items-center justify-between min-w-0 cursor-pointer hover:bg-slate-50/80 active:bg-slate-100 p-1 rounded-lg transition-all duration-200 select-none group gap-2"
          >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[7.5px] uppercase font-black tracking-widest text-blue-600 leading-none">
                    {!finalTrabajoId ? "BITÁCORA DE SALIDA" : "CONVERSACIÓN OPERATIVA"}
                  </span>
                  <span className="text-[7px] font-extrabold text-blue-400 bg-blue-50 px-1 py-0.5 rounded leading-none shrink-0 group-hover:bg-blue-100 transition-colors">Ver Info</span>
                  {jobStatus && (
                    <div className="hidden sm:flex shrink-0">
                      <StatusBadge label={jobStatus.replace(/_/g, " ")} variant={getStatusVariant(jobStatus) as any} />
                    </div>
                  )}
                </div>
                <h1 className={`font-black text-blue-950 uppercase tracking-tight truncate mt-0.5 max-w-full ${getDynamicTitleSize(jobTitle)}`}>
                  {jobOt && <span className="text-blue-600 mr-1.5 shrink-0">{jobOt}</span>}
                  <span className="truncate">{jobTitle}</span>
                </h1>
                <div className="flex items-center gap-1.5 truncate">
                  <p className="text-[9px] font-bold text-slate-500 truncate leading-tight">
                    {jobLocation || (finalTrabajoId ? "Cargando ubicación..." : "Sin ubicación")}
                  </p>
                  {(linkedLogDetails || vehicleName) && (
                    <>
                      <span className="text-slate-300 mx-0.5">•</span>
                      <div className="flex items-center gap-1 px-1 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-600">
                        <FiTruck size={8} />
                        <span className="text-[8px] font-black uppercase tracking-tight">
                          {linkedLogDetails?.unidadName || linkedLogDetails?.unidadId || vehicleName || "Unidad"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              <ActionButton
                icon={<FiDownload className="w-4 h-4" />}
                onClick={() => setShowImportWizard(true)}
                variant="secondary"
                label="Importar"
                className="hidden sm:flex text-[10px] font-black h-8 rounded-lg"
              />
              <IconButton
                icon={<FiDownload className="w-4 h-4" />}
                onClick={() => setShowImportWizard(true)}
                variant="secondary"
                className="sm:hidden !w-8 !h-8 !p-0 rounded-lg flex items-center justify-center"
              />
            </div>
          </div>
        </motion.div>
      ) : (
          <motion.div
            key="mini-header"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="hidden lg:flex sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 justify-center py-1 flex-none shadow-sm"
          >
            <button 
              onClick={() => setHeaderCollapsed(false)}
              className="group flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-white transition-all duration-200 shadow-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[8px] font-black uppercase text-blue-600 tracking-wider">Bitácora Operativa</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-[9px] font-bold text-slate-700 truncate max-w-[200px]">{jobTitle}</span>
              </div>
              <FiChevronDown className="w-3.5 h-3.5 text-blue-500 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>



      {latestPinned && (() => {
        const safeFileUrls = Array.isArray(latestPinned.fileUrls) ? latestPinned.fileUrls : [];
        const safeFileNames = Array.isArray(latestPinned.fileNames) ? latestPinned.fileNames : [];
        const pinnedThumbUrl = safeFileUrls.find((url, idx) => isImageFile(safeFileNames[idx], url));
        return (
          <div className="sticky top-0 z-10 -mx-1 px-1 bg-slate-50/95 backdrop-blur-md py-1 border-b border-slate-200/50 mb-1 flex justify-between items-center gap-1.5">
            <div 
              onClick={() => scrollToMessage(latestPinned.id)}
              className="flex-1 flex items-center justify-between bg-white hover:bg-slate-50 active:bg-slate-100 py-1 px-2 rounded-lg border border-slate-200/80 shadow-xs cursor-pointer select-none transition-all duration-300 min-w-0 gap-1.5"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="flex items-center justify-center w-5.5 h-5.5 rounded bg-amber-50 text-amber-500 shrink-0">
                  <Pin className="w-3 h-3 rotate-45" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[8px] font-black uppercase text-blue-600 tracking-wider block leading-none mb-0.5 truncate">
                    Mensaje fijado por {latestPinned.pinnedBy || "Usuario"}
                  </span>
                  <p className="text-[10px] font-bold text-slate-600 truncate leading-tight mt-0.5">
                    {latestPinned.tipo === "comentario" ? latestPinned.mensaje : latestPinned.tipo === "imagen" || latestPinned.tipo === "foto" ? "📸 Evidencia fotográfica" : latestPinned.tipo === "archivo" ? "📁 Archivo" : latestPinned.tipo === "ubicacion" ? "📍 Ubicación compartida" : "Mensaje"}
                  </p>
                </div>
              </div>
              {pinnedThumbUrl && <img src={pinnedThumbUrl} className="w-6 h-6 rounded shrink-0 object-cover border border-slate-200/50" alt="Preview" />}
            </div>
            <button
              type="button"
              className="w-5.5 h-5.5 rounded bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0 shadow-xs transition-colors"
              onClick={() => handlePinMessage(latestPinned)}
            >
              <PinOff className="w-3 h-3" />
            </button>
          </div>
        );
      })()}

      {context.isLoading ? ( 
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50">
          Cargando conversación...
        </div>
      ) : timelineWithSeparators?.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 max-w-sm w-full">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiActivity className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-black uppercase tracking-tight mb-2">Sin actividad</h3>
            <p className="text-slate-500 text-xs font-bold leading-relaxed mb-6">
              No hay registros en la bitácora para este canal operativo.
            </p>
            
            {/* DIAGNOSTIC BLOCK - MOVED HERE FOR VISIBILITY */}
            <div className="mb-4 p-3 bg-red-50 rounded-2xl border border-red-100 text-left">
                <span className="text-[8px] uppercase font-black text-red-400 block mb-1">TRACE ID (DIAGNÓSTICO)</span>
                <code className="text-[10px] font-mono font-bold text-red-600 break-all select-all block mb-2">
                    {resolvedTimelineId || "N/A"}
                </code>
                <p className="text-[8px] text-red-400 leading-tight">
                  Si este ID es nulo o incorrecto, el pipeline está desconectado.
                </p>
            </div>

            {/* HERRAMIENTA DE RECUPERACIÓN */}
            {(isAdmin(currentUser?.role) && resolvedTimelineId && currentCollection === "bitacora_vehiculos") && (
               <button
                 className="w-full bg-slate-900 text-white rounded-xl py-3 px-4 font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                 onClick={async (e) => {
                   e.preventDefault();
                   try {
                     const { createSystemEvent } = await import('@/modules/job_scheduling/jobService');
                     const { setDoc } = await import('firebase/firestore');
                     const docRef = doc(db, 'bitacora_vehiculos', activeParentId);
                     const snap = await getDoc(docRef);
                     if (snap.exists()) {
                       const data = snap.data();
                       const createdAt = data.createdAt?.toDate?.() || new Date();
                       await setDoc(doc(db, "operational_timelines", resolvedTimelineId), {
                          id: resolvedTimelineId,
                          creado_en: createdAt.toISOString(),
                          metadata: {
                              title: `Bitácora de Salida: ${data.unidadName || ""}`,
                              subtitle: `${data.conductorName || ""}`,
                              status: data.kmLlegada ? "finalizado" : "en_proceso",
                              vehiculoId: data.vehiculoId || null,
                              createdAt: createdAt.toISOString()
                          }
                       }, { merge: true });
                       
                       await createSystemEvent(resolvedTimelineId, "bitacora_iniciada", {
                           conductor: data.conductorName || currentUser?.name || 'Sistema',
                           unidad: data.unidadName || "No especificada",
                           destino: data.destino || "No especificado",
                           kmSalida: data.kmSalida || 0,
                           combustibleInicial: data.combustible || 'Full',
                           descripcion: `[EVENTOS RECUPERADOS] Se inició una nueva sesión operacional para la unidad.`
                       }, createdAt, `recuperado_${resolvedTimelineId}`);
                       alert("¡Eventos iniciales recuperados! Espere unos segundos y los verá en la línea de tiempo.");
                     } else {
                       alert("El documento de origen de la bitácora no fue encontrado.");
                     }
                   } catch(err: any) {
                     alert("Error al recuperar: " + err.message);
                   }
                 }}
               >
                 Recuperar Evento Inicial
               </button>
            )}

          </div>
        </div>
      ) : (
        <VirtualizedTimeline
          ref={virtuosoTimelineRef}
          data={timelineWithSeparators}
          currentUser={currentUser}
          highlightedMessageId={highlightedMessageId}
          swipingMessage={swipingMessage}
          handleTouchStart={handleTouchStart}
          handleTouchMove={handleTouchMove}
          handleTouchEnd={handleTouchEnd}
          setActiveMenuComment={setActiveMenuComment}
          activeMenuComment={activeMenuComment}
          setReplyMediaTarget={setReplyMediaTarget}
          scrollToMessage={scrollToMessage}
          mergedCommentsMap={mergedCommentsMap}
          setFullscreenImage={setFullscreenImage}
          imageDiagnoses={imageDiagnoses}
          setImageDiagnoses={setImageDiagnoses}
          onLoadMore={loadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onScroll={onTimelineScroll}
          allProjectImageUrls={allProjectImageUrls}
          onSetActiveModule={onSetActiveModule} // Added for navigation
        />
      )}


        <div className="w-full max-w-3xl mx-auto mt-0 mb-0">
          <button
            onClick={() => setShowTechnicalLog(!showTechnicalLog)}
            className="flex items-center justify-between w-full p-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors border border-slate-200 group border-b-0 rounded-b-none"
          >
            <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 text-slate-500 group-hover:text-slate-700">
              <FiActivity size={10} /> Historial
            </span>
            {showTechnicalLog ? <FiChevronUp size={10} /> : <FiChevronDown size={10} />}
          </button>

          {showTechnicalLog && (
            <div className="bg-white border-x border-t border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
                <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
                  <FiSearch className="text-slate-400 ml-1" />
                  <input
                    type="text"
                    placeholder="Buscar usuario o actividad..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                  {[
                    { id: "all", label: "Todo" },
                    { id: "messages", label: "Mensajes", icon: FiMessageSquare },
                    { id: "photos", label: "Fotos", icon: FiCamera },
                    { id: "files", label: "Archivos", icon: FiFileText },
                    { id: "edits", label: "Ediciones", icon: FiEdit2 },
                    { id: "deletions", label: "Eliminados", icon: FiTrash2 },
                  ].map((filter) => {
                    const isActive = logActiveFilter === filter.id;
                    const Icon = filter.icon;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setLogActiveFilter(filter.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 ${isActive ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"} border`}
                      >
                        {Icon && <Icon size={10} />}
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredLogs?.length === 0 ? (
                <div className="px-6 py-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 flex flex-col items-center gap-2">
                  <FiSearch size={24} className="opacity-20 mb-1" />
                  {mergedComments?.length === 0 ? "No hay registros de actividad" : "No se encontraron resultados"}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
                  {filteredLogs.map((c, index) => {
                    const safeFileUrls = Array.isArray(c.fileUrls) ? c.fileUrls : [];
                    const safeFileNames = Array.isArray(c.fileNames) ? c.fileNames : [];
                    const hasImages = safeFileUrls.some((url: string, idx: number) => isImageFile(safeFileNames[idx], url));
                    const isImageComment = c.tipo === "imagen" || c.tipo === "foto" || !!hasImages;
                    const isFileComment = c.tipo === "archivo" && !isImageComment;

                    let actionText = "";
                    if (c.tipo === "sistema") actionText = c.mensaje || "realizó una acción del sistema";
                    else if (c.tipo === "comentario") {
                      if (c.eliminado) actionText = "eliminó un comentario";
                      else if (c.editado) actionText = "editó un comentario";
                      else actionText = "envió un mensaje";
                    } else if (isImageComment) actionText = "adjuntó evidencia fotográfica";
                    else if (isFileComment) actionText = "adjuntó un archivo";
                    else actionText = "realizó una actividad";

                    return (
                      <button
                        key={`log-${c.id}-${index}`}
                        onClick={() => scrollToMessage(c.id)}
                        className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 md:px-5 md:py-4 hover:bg-slate-50 transition-colors gap-2 sm:gap-4 group focus:outline-none focus:bg-slate-50 relative"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-400 focus:bg-blue-400 transition-colors flex-shrink-0" />
                            <span className="text-[11px] md:text-xs font-bold text-slate-700 uppercase tracking-wide truncate">
                              {c.usuarioNombre} <span className="font-medium text-slate-500 normal-case ml-1">{actionText}</span>
                            </span>
                          </div>
                          {c.mensaje && c.tipo !== "sistema" && c.mensaje !== actionText && (
                            <p className="text-[11px] font-medium text-slate-500 pl-4.5 border-l-2 border-slate-200 ml-[2px] pl-2 mt-1 truncate max-w-full">&quot;{c.mensaje}&quot;</p>
                          )}
                        </div>
                        <div className="flex items-center pl-4 sm:pl-0 shrink-0">
                          <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{formatTime(c.timestamp)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      <OperationalLogInput
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        pendingAttachment={pendingAttachment}
        setPendingAttachment={setPendingAttachment}
        showAttachMenu={showAttachMenu}
        setShowAttachMenu={setShowAttachMenu}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        isUploading={isUploading}
        onSend={handleSend}
        onCameraChange={handleCameraChange}
        onFileChange={handleFileChange}
        onSendLocation={handleSendLocation}
        handleCancelAttachment={handleCancelAttachment}
        cameraRef={cameraRef}
        galleryRef={galleryRef}
        fileRef={fileRef}
        attachMenuRef={attachMenuRef}
        isGettingLocation={isGettingLocation}
        gpsError={gpsError}
        setGpsError={setGpsError}
      />

      {/* PORTALS & MODALS SECTION */}
      <ModalPortal>
        <AnimatePresence>
          {activeMenuComment && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[600] flex items-center justify-center p-4 touch-none"
              onClick={() => { setActiveMenuComment(null); setConfirmingDeleteId(null); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 15 }}
                transition={{ type: "spring", duration: 0.35 }}
                className="bg-white rounded-[2rem] w-full max-w-xs shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-200/80"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1.5">{activeMenuComment.usuarioNombre}</span>
                  <p className="text-xs text-slate-500 font-bold line-clamp-2 leading-relaxed italic">
                    &quot;{activeMenuComment.eliminado ? "Mensaje eliminado" : activeMenuComment.mensaje || (activeMenuComment.tipo === "imagen" || activeMenuComment.tipo === "foto" ? "Evidencia fotográfica" : "Archivo adjunto")}&quot;
                  </p>
                </div>
                {confirmingDeleteId ? (
                  <div className="p-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100"><Trash className="w-6 h-6" /></div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1.5">¿Eliminar registro?</p>
                      <p className="text-[11px] text-slate-500 font-bold leading-normal px-2">Esta acción marcará el registro como eliminado para todos los usuarios.</p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                      <ActionButton label="Volver" variant="secondary" className="flex-1 text-[10px] font-black py-3 rounded-xl" onClick={() => setConfirmingDeleteId(null)} />
                      <button type="button" className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg transition-all" onClick={() => { handleDeleteMessage(activeMenuComment); setConfirmingDeleteId(null); }}>Eliminar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col p-2.5 bg-white space-y-1">
                    <button type="button" className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 rounded-2xl text-left text-[11px] font-black uppercase tracking-wider text-slate-700 transition-all group" onClick={() => {
                      const isTargetingMedia = replyMediaTarget && replyMediaTarget.comment.id === activeMenuComment.id;
                      setReplyingTo({
                        id: activeMenuComment.id,
                        usuarioId: activeMenuComment.usuarioId,
                        usuarioNombre: activeMenuComment.usuarioNombre || "Usuario",
                        mensaje: activeMenuComment.mensaje || "",
                        tipo: activeMenuComment.tipo === "imagen" || activeMenuComment.tipo === "foto" ? "imagen" : activeMenuComment.tipo === "archivo" ? "archivo" : "texto",
                        imagenUrl: isTargetingMedia ? replyMediaTarget.url : (Array.isArray(activeMenuComment.fileUrls) ? activeMenuComment.fileUrls[0] : undefined),
                        replyMediaIndex: isTargetingMedia ? replyMediaTarget.index : undefined,
                      });
                      setReplyMediaTarget(null);
                      setActiveMenuComment(null);
                    }}>
                      <CornerUpLeft className="w-4 h-4 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" /> <span className="flex-1">Responder mensaje</span>
                    </button>
                    <button type="button" className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 rounded-2xl text-left text-[11px] font-black uppercase tracking-wider text-slate-700 transition-all group" onClick={() => handlePinMessage(activeMenuComment)}>
                      <Pin className="w-4 h-4 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" /> <span className="flex-1">{activeMenuComment.pinned ? "Desfijar reporte" : "Destacar reporte"}</span>
                    </button>
                    {activeMenuComment.tipo === "comentario" && !activeMenuComment.eliminado && activeMenuComment.usuarioId === currentUser?.id && (
                      <button type="button" className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 rounded-2xl text-left text-[11px] font-black uppercase tracking-wider text-slate-700 transition-all group" onClick={() => handleStartEdit(activeMenuComment)}>
                        <Edit3 className="w-4 h-4 text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" /> <span className="flex-1">Editar contenido</span>
                      </button>
                    )}
                    {!activeMenuComment.eliminado && activeMenuComment.usuarioId === currentUser?.id && (
                      <button type="button" className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-red-50 text-red-600 rounded-2xl text-left text-[11px] font-black uppercase tracking-wider transition-all group" onClick={() => setConfirmingDeleteId(activeMenuComment.id)}>
                        <Trash className="w-4 h-4 text-red-500 shrink-0 group-hover:scale-110 transition-transform" /> <span className="flex-1">Eliminar reporte</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </ModalPortal>

      <ModalPortal>
        <AnimatePresence>
          {showGridGallery && (
            <motion.div 
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 bg-slate-950 z-[500] flex flex-col touch-none"
            >
              <div className="flex-none p-5 pb-3 border-b border-white/10 flex flex-col gap-4 sticky top-0 bg-slate-950/90 backdrop-blur-xl z-10 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Galería Central</span>
                    <h3 className="text-white text-base font-black uppercase tracking-tight">Bitácora de Medios</h3>
                  </div>
                  <IconButton icon={<FiX className="w-5 h-5" />} onClick={() => setShowGridGallery(false)} variant="ghost" className="!w-12 !h-12 !p-0 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 shadow-lg" />
                </div>
                <div className="flex gap-6 overflow-x-auto pb-1 scrollbar-none">
                  <button onClick={() => setGalleryTab('media')} className={`pb-3 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 relative shrink-0 ${galleryTab === 'media' ? 'text-white border-blue-500' : 'text-white/40 border-transparent hover:text-white/60'}`}>
                    Archivos Visuales <span className="ml-1 text-[9px] bg-white/10 px-1.5 py-0.5 rounded-md">{projectImages?.length}</span>
                  </button>
                  <button onClick={() => setGalleryTab('docs')} className={`pb-3 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 relative shrink-0 ${galleryTab === 'docs' ? 'text-white border-blue-500' : 'text-white/40 border-transparent hover:text-white/60'}`}>
                    Documentación <span className="ml-1 text-[9px] bg-white/10 px-1.5 py-0.5 rounded-md">{projectFiles?.length}</span>
                  </button>
                  <button onClick={() => setGalleryTab('links')} className={`pb-3 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 relative shrink-0 ${galleryTab === 'links' ? 'text-white border-blue-500' : 'text-white/40 border-transparent hover:text-white/60'}`}>
                    Enlaces <span className="ml-1 text-[9px] bg-white/10 px-1.5 py-0.5 rounded-md">{projectLinks?.length}</span>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar">
                {galleryTab === 'media' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2 mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {projectImages.map((img, idx) => (
                      <div key={`gal-${idx}`} className="aspect-square relative cursor-pointer group bg-slate-900 rounded-xl overflow-hidden border border-white/5 shadow-2xl" onClick={() => setFullscreenImage({ urls: projectImages.map(i => i.url), currentIndex: idx })} onContextMenu={(e) => { e.preventDefault(); setContextMenuTarget({ type: 'image', url: img.url, comment: img.comment, index: img.index }); }}>
                        <img src={img.url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out brightness-[0.85] group-hover:brightness-100" loading="lazy" referrerPolicy="no-referrer" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5 pt-6 text-[9px] text-white/90 truncate font-black uppercase tracking-tight">{img.label}</div>
                        <div className="absolute inset-0 ring-4 ring-inset ring-white/0 group-hover:ring-blue-500/40 transition-all duration-300" />
                      </div>
                    ))}
                    {projectImages?.length === 0 && <div className="col-span-full h-64 flex flex-col items-center justify-center text-white/30 text-xs font-black uppercase tracking-widest gap-4 border border-white/5 bg-white/2 rounded-3xl mt-10"><FiCamera size={32} /> No hay archivos visuales registrados</div>}
                  </div>
                )}
                {galleryTab === 'docs' && (
                  <div className="flex flex-col gap-3 max-w-3xl mx-auto mt-4 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {projectFiles.map((file, idx) => (
                      <div key={`doc-${idx}`} className="flex items-center bg-white/5 hover:bg-white/10 transition-all p-4 rounded-2xl gap-5 border border-white/5 shadow-xl group" onContextMenu={(e) => { e.preventDefault(); setContextMenuTarget({ type: 'file', url: file.url, name: file.name, comment: file.comment, index: file.index }); }}>
                        <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:scale-110 transition-transform"><FiFileText className="text-blue-400 w-6 h-6" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate uppercase tracking-tight" title={file.name}>{file.name}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40 font-black uppercase tracking-widest">{file.size > 0 && <span>{(file.size / 1024).toFixed(1)} KB</span>} <span>•</span> <span>Por {file.label}</span></div>
                        </div>
                        <IconButton icon={<FiDownload className="w-5 h-5" />} onClick={() => forceDownloadFile(file.url, file.name)} variant="ghost" className="!w-10 !h-10 !p-0 rounded-full bg-white/5 hover:bg-blue-600 hover:text-white transition-all text-white/70" />
                      </div>
                    ))}
                    {projectFiles?.length === 0 && <div className="h-64 flex flex-col items-center justify-center text-white/30 text-xs font-black uppercase tracking-widest gap-4 border border-white/5 bg-white/2 rounded-3xl mt-10"><FiFileText size={32} /> No hay documentos adjuntos</div>}
                  </div>
                )}
                {galleryTab === 'links' && (
                  <div className="flex flex-col gap-3 max-w-3xl mx-auto mt-4 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {projectLinks.map((link, idx) => (
                      <a key={`link-${idx}`} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-start bg-white/5 hover:bg-white/10 transition-all p-4 rounded-2xl gap-5 border border-white/5 shadow-xl group">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/20 group-hover:scale-110 transition-transform mt-0.5"><FiLink className="text-indigo-400 w-5 h-5" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white hover:text-blue-400 truncate uppercase tracking-tight transition-colors" title={link.url}>{link.url}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40 font-black uppercase tracking-widest"><span>{getHostname(link.url)}</span> <span>•</span> <span>Por {link.label}</span></div>
                        </div>
                      </a>
                    ))}
                    {projectLinks?.length === 0 && <div className="h-64 flex flex-col items-center justify-center text-white/30 text-xs font-black uppercase tracking-widest gap-4 border border-white/5 bg-white/2 rounded-3xl mt-10"><FiLink size={32} /> No hay enlaces externos</div>}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ModalPortal>

      <ModalPortal>
        <AnimatePresence>
          {fullscreenImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-slate-950/98 flex flex-col items-center justify-center z-[550] select-none touch-none p-4" 
              onClick={() => setFullscreenImage(null)} 
              onTouchStart={(e) => { touchStartZoomX.current = e.touches[0].clientX; }} 
              onTouchEnd={(e) => {
                if (!touchStartZoomX.current) return;
                const diff = e.changedTouches[0].clientX - touchStartZoomX.current;
                if (Math.abs(diff) > 60) {
                  if (diff > 0) setFullscreenImage(prev => prev ? { ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) } : null);
                  else setFullscreenImage(prev => prev ? { ...prev, currentIndex: Math.min(prev.urls?.length - 1, prev.currentIndex + 1) } : null);
                }
                touchStartZoomX.current = null;
              }}
            >
              <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10">
                <div className="flex flex-col">
                  <span className="text-white text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Visor Fullscreen</span>
                  <span className="text-white text-xs font-black tabular-nums">{fullscreenImage.currentIndex + 1} / {fullscreenImage.urls?.length}</span>
                </div>
                <IconButton icon={<FiX className="w-5 h-5" />} onClick={() => setFullscreenImage(null)} variant="ghost" className="!w-12 !h-12 !p-0 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 shadow-2xl" />
              </div>
              <button className="absolute left-4 w-12 h-12 rounded-full bg-black/40 text-white/50 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all z-10 border border-white/5" onClick={(e) => { e.stopPropagation(); setFullscreenImage(prev => prev ? { ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) } : null); }}><FiChevronLeft size={28} /></button>
              <button className="absolute right-4 w-12 h-12 rounded-full bg-black/40 text-white/50 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all z-10 border border-white/5" onClick={(e) => { e.stopPropagation(); setFullscreenImage(prev => prev ? { ...prev, currentIndex: Math.min(prev.urls?.length - 1, prev.currentIndex + 1) } : null); }}><FiChevronRight size={28} /></button>
              
              {/* Zoomable Image Implementation */}
              <div 
                className="relative w-full h-full flex items-center justify-center p-2 overflow-hidden" 
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  key={displayZoomUrl}
                  src={displayZoomUrl} 
                  alt="Zoom" 
                  className="max-w-full max-h-[88vh] object-contain rounded-xl shadow-[0_48px_96px_-12px_rgba(0,0,0,0.6)] border border-white/5 transition-transform duration-75 ease-out" 
                  style={{
                    transform: `scale(${zoomState.scale}) translate3d(${zoomState.x}px, ${zoomState.y}px, 0)`,
                    touchAction: zoomState.scale > 1 ? 'none' : 'auto',
                    willChange: 'transform'
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    let foundMsg = Array.isArray(projectImages) ? projectImages.find(img => img.url === displayZoomUrl)?.comment : null;
                    if (!foundMsg && fullscreenImage?.commentId) foundMsg = mergedComments.find(c => c.id === fullscreenImage.commentId);
                    setContextMenuTarget({ type: 'image', url: displayZoomUrl, comment: foundMsg });
                  }} 
                  onTouchStart={handleZoomTouchStart}
                  onTouchMove={handleZoomTouchMove}
                  onTouchEnd={handleZoomTouchEnd}
                  onDoubleClick={handleDoubleTap}
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="absolute bottom-10 left-0 right-0 flex justify-center px-4">
                <span className="bg-white/5 backdrop-blur-md px-6 py-3 rounded-full text-white/60 text-[10px] font-black uppercase tracking-widest border border-white/10 shadow-lg">Desliza para navegar</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ModalPortal>

      <ModalPortal>
        <AnimatePresence>
          {showProjectInfo && (
            <div className="fixed inset-0 z-[400]">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 0.35 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setShowProjectInfo(false)} 
                className="fixed inset-0 bg-slate-950 transition-opacity" 
              />
              <motion.div 
                initial={{ y: "100%", opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: "100%", opacity: 0 }} 
                transition={{ type: "spring", damping: 28, stiffness: 220 }} 
                className="fixed inset-x-0 bottom-0 md:top-6 md:right-6 md:bottom-6 md:left-auto md:w-[460px] bg-white rounded-t-[3rem] md:rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] flex flex-col border border-slate-200/80 max-h-[92vh] md:max-h-[calc(100vh-3rem)] overflow-hidden"
              >
                <div className="w-12 h-1.5 bg-slate-200 tracking-wide rounded-full mx-auto mt-4 mb-2 shrink-0 md:hidden" />
                <div className="px-7 pb-5 pt-3 md:pt-7 flex items-center justify-between border-b border-slate-100 shrink-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest bg-blue-50/85 px-3 py-1 rounded-lg border border-blue-100/30 font-mono">{fetchedTrabajoDetails?.otCode ? `OT-${fetchedTrabajoDetails.otCode}` : "PROYECTO"}</span>
                      {jobStatus && <StatusBadge label={jobStatus.replace(/_/g, " ")} variant={getStatusVariant(jobStatus) as any} />}
                    </div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate mt-2 leading-none">{jobTitle}</h2>
                  </div>
                  <IconButton icon={<FiX className="w-6 h-6" />} onClick={() => setShowProjectInfo(false)} variant="ghost" className="!w-12 !h-12 !p-0 rounded-full hover:bg-slate-100 shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-7 space-y-8">
                  <div>
                    <div className="flex items-center justify-between mb-5 px-1">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2.5">Evidencia Destacada <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100/50">{projectImages?.length}</span></h3>
                    </div>
                    {projectImages?.length > 0 ? (
                      <div className="space-y-5">
                        <div className="flex gap-4 overflow-x-auto pb-5 scrollbar-none snap-x -mx-1 px-1">
                          {projectImages.slice(0, 12).map((img, idx) => (
                            <div key={idx} onClick={() => setFullscreenImage({ urls: projectImages.map(i => i.url), currentIndex: idx })} className="relative w-32 h-32 md:w-36 md:h-36 rounded-[2rem] overflow-hidden shrink-0 border border-slate-200/80 shadow-md cursor-pointer snap-start hover:scale-[0.97] active:scale-95 transition-all duration-300 group hover:border-blue-300">
                              <img src={img.url} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:brightness-95 transition-all duration-500" alt={`Evidence ${idx + 1}`} loading="lazy" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-3 text-[9px] text-white truncate text-center font-black uppercase tracking-tight">{img.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end pr-1">
                          <ActionButton label={`Ver galería completa (${projectImages?.length})`} icon={<FiChevronRight className="w-4 h-4 ml-1" />} onClick={() => setShowGridGallery(true)} variant="secondary" className="text-[10px] md:text-xs font-black py-3 px-6 rounded-2xl shadow-sm hover:shadow-md" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 border border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 select-none gap-3"><p className="text-xs font-black uppercase tracking-widest">Sin capturas registradas</p></div>
                    )}
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest px-1">Detalles Operativos</h3>
                    <div className="bg-slate-50/60 p-6 rounded-[2rem] border border-slate-200/50 shadow-sm hover:border-slate-300 transition-all">
                      <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-3">Descripción General</span>
                      <p className={`text-xs text-slate-600 leading-relaxed font-bold ${isDescCollapsed ? "line-clamp-5" : ""}`}>{fetchedTrabajoDetails?.descripcion || "Sin descripción técnica programada."}</p>
                      {(fetchedTrabajoDetails?.descripcion?.length || 0) > 160 && (
                        <div role="button" onClick={() => setIsDescCollapsed(!isDescCollapsed)} className="text-[10px] font-black text-blue-600 hover:text-blue-700 mt-4 flex items-center gap-1.5 cursor-pointer select-none">
                          {isDescCollapsed ? "Expandir descripción" : "Colapsar descripción"} {isDescCollapsed ? <FiChevronDown className="w-4 h-4" /> : <FiChevronUp className="w-4 h-4" />}
                        </div>
                      )}
                    </div>
                    {fetchedTrabajoDetails?.observaciones && (
                      <div className="bg-amber-50/60 p-6 rounded-[2rem] border border-amber-200/60 flex flex-col gap-3">
                        <span className="text-[9px] uppercase font-black tracking-widest text-amber-600 block">Notas Críticas</span>
                        <p className="text-xs text-amber-950 font-black leading-relaxed">{fetchedTrabajoDetails.observaciones}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex flex-col gap-3">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block">Personal Asignado</span>
                        <div className="flex flex-wrap gap-2">
                          {fetchedTrabajoDetails?.cuadrilla && fetchedTrabajoDetails.cuadrilla?.length > 0 ? fetchedTrabajoDetails.cuadrilla.map((operator: string, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-2 text-[10px] font-black bg-slate-50 border border-slate-200/60 text-slate-700 px-4 py-2 rounded-2xl"><FiUsers className="w-3.5 h-3.5 text-slate-400 shrink-0" />{operator}</span>
                          )) : <span className="text-[10px] font-bold text-slate-400">Sin asignar</span>}
                        </div>
                      </div>
                      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex flex-col gap-3">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block">Móviles / Bitácora Ligada</span>
                        <div className="flex flex-wrap gap-2">
                          {fetchedTrabajoDetails?.unidades && fetchedTrabajoDetails.unidades?.length > 0 ? fetchedTrabajoDetails.unidades.map((unit: string, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-2 text-[10px] font-black bg-indigo-50/50 border border-indigo-200/50 text-indigo-700 px-4 py-2 rounded-2xl"><FiTruck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />{unit}</span>
                          )) : linkedLogDetails ? (
                            <div className="flex flex-col gap-1 w-full">
                               <span className="inline-flex items-center gap-2 text-[10px] font-black bg-indigo-600 text-white px-4 py-2 rounded-2xl shadow-md w-fit">
                                 <FiTruck className="w-3.5 h-3.5 shrink-0" />
                                 {linkedLogDetails.unidadName || linkedLogDetails.unidadId || "Móvil Ligado"}
                               </span>
                               <span className="text-[8px] font-black uppercase text-indigo-600 tracking-wider ml-1">Bitácora: {linkedLogDetails.placa || linkedLogDetails._resolvedPlaca || "N/A"}</span>
                            </div>
                          ) : <span className="text-[10px] font-bold text-slate-400">N/A</span>}
                        </div>
                      </div>
                      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-slate-200 transition-all group">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-3 leading-none">Programación</span>
                        <p className="text-xs font-black text-slate-700 flex items-center gap-3">
                          <FiCalendar className="w-5 h-5 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" /> 
                          {(() => {
                            // 1. Prioritize Scheduled Job date (fecha_inicio)
                            const jobDate = fetchedTrabajoDetails?.fecha_inicio;
                            if (jobDate) {
                              const d = safeDate(jobDate);
                              if (d.getTime() > 0) return formatJobDate(jobDate, fetchedTrabajoDetails?.fecha_fin);
                            }
                            
                            // 2. Fallback to Vehicle Log date (fecha) from either details or linkedLog
                            const logDate = fetchedTrabajoDetails?.fecha || linkedLogDetails?.fecha;
                            if (logDate) {
                              const d = safeDate(logDate);
                              if (d.getTime() > 0) return formatJobDate(logDate);
                            }
                            
                            return "Pendiente";
                          })()}
                        </p>
                      </div>
                      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-slate-200 transition-all group">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block mb-3 leading-none">Ventana Horaria</span>
                        <p className="text-xs font-black text-slate-700 flex items-center gap-3"><FiClock className="w-5 h-5 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" /> {fetchedTrabajoDetails?.hora_inicio || "--:--"} a {fetchedTrabajoDetails?.hora_fin || "--:--"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest px-1">Documentos Técnicos</h3>
                    {projectFiles?.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {projectFiles.map((file, idx) => (
                          <button type="button" onClick={() => forceDownloadFile(file.url, file.name)} key={idx} className="w-full text-left flex items-center gap-5 p-5 bg-slate-50/40 hover:bg-slate-50 border border-slate-200/60 rounded-[2.2rem] transition-all duration-300 group shadow-sm active:scale-[0.99]">
                            <div className="w-12 h-12 rounded-2xl bg-white text-slate-500 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center shrink-0 border border-slate-200 group-hover:border-blue-500 transition-all shadow-sm"><FiFileText className="w-6 h-6" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-800 truncate uppercase tracking-tight leading-tight mb-1">{file.name}</p>
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block opacity-70">Certificación / Acta</span>
                            </div>
                            <FiDownload className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 select-none gap-3"><p className="text-xs font-black uppercase tracking-widest">Sin reportes asociados</p></div>
                    )}
                  </div>
                </div>
                <div className="p-7 bg-slate-50/90 backdrop-blur-md border-t border-slate-100 flex gap-4 shrink-0 justify-end md:rounded-b-[3rem]">
                  <ActionButton label="Cerrar Panel" variant="secondary" onClick={() => setShowProjectInfo(false)} className="text-[10px] font-black px-8 py-4 rounded-2xl" />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ModalPortal>

      <ModalPortal>
        <AnimatePresence>
          {contextMenuTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md touch-none"
              onClick={() => setContextMenuTarget(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-slate-900 border border-white/10 w-full max-w-[300px] rounded-[2.5rem] shadow-[0_32px_96px_-16px_rgba(0,0,0,0.8)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-white/5 bg-white/2">
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] text-center mb-3">Gestión de Medios</p>
                  {contextMenuTarget.type === 'file' && <p className="text-white text-xs font-black text-center truncate px-2 uppercase tracking-tight">{contextMenuTarget.name}</p>}
                  {contextMenuTarget.type === 'image' && <p className="text-white text-[10px] font-bold text-center opacity-60">Evidencia Fotográfica</p>}
                </div>
                <div className="flex flex-col p-2.5 space-y-1">
                  <button onClick={handleShowInChatContext} className="flex items-center gap-4 w-full px-5 py-4 text-white hover:bg-white/5 active:bg-white/10 rounded-2xl transition-all group font-black text-[11px] uppercase tracking-wider uppercase"><FiMessageSquare className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" /> <span>MOSTRAR EN EL CHAT</span></button>
                  <button onClick={handleReplyContext} className="flex items-center gap-4 w-full px-5 py-4 text-white hover:bg-white/5 active:bg-white/10 rounded-2xl transition-all group font-black text-[11px] uppercase tracking-wider uppercase"><CornerUpLeft className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" /> <span>Responder</span></button>
                  <button onClick={handleDownloadContext} className="flex items-center gap-4 w-full px-5 py-4 text-white hover:bg-white/5 active:bg-white/10 rounded-2xl transition-all group font-black text-[11px] uppercase tracking-wider uppercase"><FiDownload className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" /> <span>Descargar</span></button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </ModalPortal>

      <ModalPortal>
        <AnimatePresence>
          {inlineReplyTarget && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-[750] flex flex-col items-center p-4 sm:p-8 bg-transparent pointer-events-none touch-none"
            >
              <div className="w-full max-w-2xl flex flex-col bg-slate-900 border border-white/10 shadow-[0_32px_128px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden pointer-events-auto">
                <div className="p-4 border-b border-white/5 flex items-center justify-between gap-5 bg-slate-900/90 backdrop-blur-xl">
                  <div className="flex flex-1 items-center gap-4 overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center border border-white/5">
                      {inlineReplyTarget.type === 'image' ? <img src={inlineReplyTarget.url} alt="Reply" className="w-full h-full object-cover" /> : <FiFileText className="w-6 h-6 text-slate-500" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] uppercase font-black text-blue-400 truncate tracking-[0.15em] mb-1">En respuesta a {inlineReplyTarget.comment?.usuarioNombre || "Usuario"}</span>
                      <span className="text-xs font-black text-white truncate uppercase tracking-tight">{inlineReplyTarget.type === "image" ? "Evidencia Visual" : (inlineReplyTarget.name || "Archivo de Datos")}</span>
                    </div>
                  </div>
                  <IconButton icon={<FiX className="w-5 h-5" />} onClick={() => setInlineReplyTarget(null)} variant="ghost" className="!w-10 !h-10 !p-0 rounded-full bg-white/5 hover:bg-white/10 text-white" />
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-900">
                  <input
                    type="text"
                    autoFocus
                    value={inlineReplyMessage}
                    onChange={(e) => setInlineReplyMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl text-sm font-black text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 py-4 px-6 transition-all"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendInlineReply(); } }}
                  />
                  <button type="button" onClick={handleSendInlineReply} disabled={!inlineReplyMessage.trim()} className="h-[56px] w-[56px] bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center rounded-2xl transition-all disabled:opacity-30 disabled:scale-95 shadow-lg flex-shrink-0"><FiSend className="w-5 h-5 ml-0.5" /></button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ModalPortal>
      
      <ImportWizardModal 
        show={showImportWizard} 
        onClose={() => setShowImportWizard(false)} 
        resolvedTimelineId={resolvedTimelineId}
        activeParentId={activeParentId}
        currentCollection={currentCollection}
        currentUser={currentUser}
      />
        </>
      )}
    </div>
  );
}
