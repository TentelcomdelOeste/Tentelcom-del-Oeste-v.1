import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { User } from "../../utils/types";
import {
  ActionButton,
  SearchInput,
  useConfirm,
  DataTable,
  TableColumn,
  Select,
} from "../../design-system";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { ActionButtons } from "../../components/ui/ActionButtons";
import { ModulePage } from "../../components/ui/ModulePage";
import { ModuleToolbar } from "../../components/ui/ModuleToolbar";
import { FiRefreshCcw, FiInfo, FiArrowRight } from "react-icons/fi";
import {
  VehicleLog,
  extraerUnidad,
  extraerPlaca,
} from "../../types/vehicle.types";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import { isAdmin, hasPermission } from "../../utils/permissions";
import { VehicleLogModal } from "./VehicleLogModal";
import SharedTimeline from "../core/SharedTimeline/SharedTimelineView";
import { useLocalCollection } from "../../hooks/useLocalCollection";
import { VehicleExpense } from "../../types/vehicle.types";
import { globalSearchEngine, vehicleLogSearchPlugin } from '../../core/search';


import { generateVehicleLogPDF } from "../../utils/export/vehicleLogPdf";
import { VehicleLogCard } from "./components/VehicleLogCard";
import { localDocStore } from "../../core/offline/localDocStore";
import { deleteVersionedDocOffline } from "../../core/versionControl";

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

interface VehicleLogsProps {
  currentUser: User;
  onSetActiveModule?: (module: any) => void;
  selectedId?: string; // Added for external navigation
  onClearSelectedId?: () => void;
}

// Component Entry Point
export const VehicleLogs: React.FC<VehicleLogsProps> = ({ currentUser, onSetActiveModule, selectedId, onClearSelectedId }) => {
  const { authReady } = useAuth();
  const localDocuments = useLocalCollection("bitacora_vehiculos");
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState<number>(() => new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<string>(() => String(new Date().getMonth() + 1));
  const [selectedLog, setSelectedLog] = useState<VehicleLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [vehicleMapById, setVehicleMapById] = useState<Record<string, string>>(
    {},
  );
  const [vehicleMapByName, setVehicleMapByName] = useState<
    Record<string, string>
  >({});
  const [employeesList, setEmployeesList] = useState<
    { id: string; name: string }[]
  >([]);
  const confirm = useConfirm();

  useEffect(() => {
    if (!authReady || !currentUser) return;
    // Load employee names & vehicles for resolution
    const loadMetadata = async () => {
      try {
        // Employees
        const snapEmp = await getDocs(collection(db, "employees"));
        const mapEmp: Record<string, string> = {};
        const listEmp: { id: string; name: string }[] = [];

        snapEmp.docs.forEach((d) => {
          const data = d.data();
          const name = data.name || data.username || "Sin nombre";
          mapEmp[d.id] = name;
          if (data.status !== "archivado" && !data.isArchived) {
            listEmp.push({ id: d.id, name });
          }
        });
        setEmployeeMap(mapEmp);
        setEmployeesList(listEmp.sort((a, b) => a.name.localeCompare(b.name)));

        // Vehicles
        const snapVeh = await getDocs(collection(db, "vehicles"));
        const mapById: Record<string, string> = {};
        const mapByName: Record<string, string> = {};
        snapVeh.docs.forEach((d) => {
          const data = d.data();
          mapById[d.id] = data.placa || "";
          if (data.name) mapByName[data.name] = data.placa || "";
        });
        setVehicleMapById(mapById);
        setVehicleMapByName(mapByName);
      } catch (err) {
        console.error("Error loading metadata:", err);
      }
    };
    loadMetadata();
  }, [authReady, currentUser]);

  const logs = useMemo(() => {
    const logMap = new Map<string, VehicleLog>();
    
    // 1. Local documents (cached + dirty)
    const localDocs = localDocuments
      .map(d => ({ ...d.data, id: d.docId }) as VehicleLog);
    
    localDocs.forEach(l => logMap.set(l.id, l));

    const rawLogs = Array.from(logMap.values());
    
    return rawLogs
      .filter(l => {
        // ALWAYS show incomplete logs regardless of filters to avoid "Ghost" active logs
        const isIncomplete = !l.horaLlegada || !l.kmLlegada;
        if (isIncomplete) return true;

        // Offline filtering consistency
        const logDate = l.fecha || "";
        if (!logDate && filterYear !== 0) return false;

        if (filterYear !== 0) {
          if (!logDate.startsWith(String(filterYear))) return false;
          
          if (filterMonth !== "all" && !filterMonth.startsWith("week:")) {
            const m = filterMonth.padStart(2, "0");
            if (logDate.substring(5, 7) !== m) return false;
          }
          if (filterMonth.startsWith("week:")) {
            const parts = filterMonth.split(":");
            const start = parts[1];
            const end = parts[2];
            if (logDate < start || logDate > end) return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sort by fecha DESC, then by createdAt DESC
        const dateA = a.fecha || "";
        const dateB = b.fecha || "";
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        
        const createdA = a.createdAt || "";
        const createdB = b.createdAt || "";
        return createdB.localeCompare(createdA);
      });
  }, [localDocuments, filterYear, filterMonth]);

  const autoOpenedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!logs.length) return;
    
    // Auto-open log if selectedId is provided
    if (selectedId) {
      if (autoOpenedIdRef.current !== selectedId) {
        const logToOpen = logs.find(l => l.id === selectedId);
        if (logToOpen) {
          autoOpenedIdRef.current = selectedId;
          setSelectedLog(logToOpen);
          setIsModalOpen(true);
        }
      }
    }
  }, [logs, selectedId, setSelectedLog, setIsModalOpen]);

  useEffect(() => {
    if (!authReady || !currentUser) return;
    
    // Solo mostramos loader si no hay datos locales para evitar parpadeo (SWR pattern)
    if (logs.length === 0) {
      setIsLoading(true);
    }

    let q = query(
      collection(db, "bitacora_vehiculos"),
      orderBy("fecha", "desc"),
      limit(100)
    );

    if (filterMonth && filterMonth.startsWith("week:")) {
      const parts = filterMonth.split(":");
      const start = parts[1] || "";
      const end = parts[2] || "";
      q = query(
        collection(db, "bitacora_vehiculos"),
        where("fecha", ">=", start),
        where("fecha", "<=", end),
        orderBy("fecha", "desc")
      );
    } else if (filterYear !== 0) {
      if (filterMonth !== "all") {
        const m = filterMonth.padStart(2, "0");
        const startMonth = `${filterYear}-${m}-01`;
        const endMonth = `${filterYear}-${m}-31`;
        q = query(
          collection(db, "bitacora_vehiculos"),
          where("fecha", ">=", startMonth),
          where("fecha", "<=", endMonth),
          orderBy("fecha", "desc")
        );
      } else {
        const startYear = `${filterYear}-01-01`;
        const endYear = `${filterYear}-12-31`;
        q = query(
          collection(db, "bitacora_vehiculos"),
          where("fecha", ">=", startYear),
          where("fecha", "<=", endYear),
          orderBy("fecha", "desc")
        );
      }
    }

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        
        // Detectar cambios incrementales (especialmente eliminaciones físicas)
        try {
          for (const change of snapshot.docChanges()) {
            if (change.type === "removed") {
              await localDocStore.removeLocalDoc("bitacora_vehiculos", change.doc.id);
              globalSearchEngine.removeDocument(`vehicleLog_${change.doc.id}`);
            } else {
              const data = change.doc.data();
              const log = { ...data, id: change.doc.id } as VehicleLog;
              if (!log.isDeleted) {
                globalSearchEngine.upsertDocument(vehicleLogSearchPlugin.mapToSearchableItem(log));
              } else {
                globalSearchEngine.removeDocument(`vehicleLog_${change.doc.id}`);
              }
            }
          }
        } catch(searchErr) {
          console.warn("[GlobalSearchEngine] Error en vehicles:", searchErr);
        }


        const remoteData = snapshot.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }) as VehicleLog)
          .filter(log => !log.isDeleted);
        setIsLoading(false);
        
        // Caching optimizado por lote para evitar tormenta de renders
        await localDocStore.saveLocalDocsBatch("bitacora_vehiculos", remoteData);
      },
      (err) => {
        console.error("Error fetching vehicle logs:", err);
        setIsLoading(false);
      },
    );

    // ADICIÓN: Segundo listener específico para bitácoras incompletas (activas)
    // Esto garantiza que siempre estén en el cache local aunque estén fuera del rango de fecha actual
    const qIncomplete = query(
      collection(db, "bitacora_vehiculos"),
      where("kmLlegada", "==", null),
      limit(20)
    );
    const unsubscribeIncomplete = onSnapshot(qIncomplete, (snap) => {
      const activeData = snap.docs.map(d => ({ ...d.data(), id: d.id }) as VehicleLog);
      localDocStore.saveLocalDocsBatch("bitacora_vehiculos", activeData);
    });

    // Fetch expenses for the logs
    const qExpenses = query(
      collection(db, "vehicle_expenses"),
      orderBy("fecha", "desc"),
      limit(500)
    );
    const unsubscribeExpenses = onSnapshot(qExpenses, (snap) => {
      const expensesData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as VehicleExpense);
      setExpenses(expensesData);
    });

    return () => {
      unsubscribe();
      unsubscribeIncomplete();
      unsubscribeExpenses();
    };
  }, [authReady, currentUser, filterYear, filterMonth]);

  // ELIMINACIÓN DE REPAIR HOOKS LEGADOS
  // La integridad ahora la garantiza SyncEngine y VersionControl



  const availableYears = useMemo(() => {
    try {
      const currentYear = new Date().getFullYear();
      const years = [currentYear];

      // Populate with some years back as default for bitácora
      for (let i = 1; i <= 2; i++) {
        years.push(currentYear - i);
      }

      logs.forEach((log) => {
        const dateStr = log.fecha || log.createdAt || "";
        if (!dateStr) return;

        let y = 0;
        if (typeof dateStr === "string" && dateStr.includes("T")) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) y = d.getFullYear();
        } else if (typeof dateStr === "string" && dateStr.includes("-")) {
          y = parseInt(dateStr.split("-")[0]);
        }

        if (y && !isNaN(y) && !years.includes(y)) {
          years.push(y);
        }
      });

      return Array.from(new Set(years))
        .filter((y) => !isNaN(y))
        .sort((a, b) => b - a);
    } catch (err) {
      console.error("Error computing availableYears:", err);
      return [new Date().getFullYear()];
    }
  }, [logs]);

  const yearOptions = useMemo(
    () => [
      { label: "Todos los años", value: 0 },
      ...availableYears.map((y) => ({ label: String(y), value: y })),
    ],
    [availableYears],
  );

  const weekOptions = useMemo(() => {
    try {
      const options: { label: string; value: string }[] = [
        { label: "Todos los meses", value: "all" },
      ];

      if (!filterYear || filterYear === 0 || isNaN(Number(filterYear))) {
        return options;
      }

      const now = new Date();
      if (!isNaN(now.getTime())) {
        const startOfCurWeek = startOfWeek(now, { weekStartsOn: 1 });
        const endOfCurWeek = endOfWeek(now, { weekStartsOn: 1 });

        if (
          !isNaN(startOfCurWeek.getTime()) &&
          !isNaN(endOfCurWeek.getTime())
        ) {
          options.push({
            label: `⭐ SEMANA ACTUAL (${format(startOfCurWeek, "dd/MM")} - ${format(endOfCurWeek, "dd/MM")})`,
            value: `week:${format(startOfCurWeek, "yyyy-MM-dd")}:${format(endOfCurWeek, "yyyy-MM-dd")}`,
          });
        }
      }

      MONTH_NAMES.forEach((m) => {
        options.push({ label: `📅 ${m.label.toUpperCase()}`, value: m.value });
      });

      return options;
    } catch (err) {
      console.error("🔥 [VehicleLogs] Error computing weekOptions:", err);
      return [{ label: "Todos los meses", value: "all" }];
    }
  }, [filterYear]);

  const getConductorName = useCallback(
    (log: VehicleLog) => {
      // If it's an email or missing or ID, try to get from map
      if (
        !log.conductorName ||
        log.conductorName.includes("@") ||
        log.conductorName === log.conductorId
      ) {
        return (
          employeeMap[log.conductorId] || log.conductorName || "Sin nombre"
        );
      }
      return log.conductorName;
    },
    [employeeMap],
  );

  const filteredLogs = useMemo(() => {
    const processed = logs.map((l) => {
      const unidad = l.unidad || extraerUnidad(l.unidadId) || l.unidadName;
      const placa =
        l.placa ||
        extraerPlaca(l.unidadId) ||
        vehicleMapById[l.unidadId] ||
        vehicleMapByName[l.unidadName] ||
        "";
      return {
        ...l,
        _resolvedName: getConductorName(l),
        _resolvedUnidad: unidad,
        _resolvedPlaca: placa,
      };
    });

    if (!searchTerm) return processed;
    const lower = searchTerm.toLowerCase();
    return processed.filter(
      (log) =>
        (log._resolvedUnidad &&
          log._resolvedUnidad.toLowerCase().includes(lower)) ||
        (log._resolvedName &&
          log._resolvedName.toLowerCase().includes(lower)) ||
        (log._resolvedPlaca &&
          log._resolvedPlaca.toLowerCase().includes(lower)) ||
        (log.unidadName && log.unidadName.toLowerCase().includes(lower)),
    );
  }, [logs, searchTerm, getConductorName, vehicleMapById, vehicleMapByName]);

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      // Logic for incomplete records (no return data)
      // We want chronologically first, but within the same date, incomplete might still be relevant
      // However, the user explicitly asked for "most recent to oldest"

      const dateA = a.fecha || "";
      const dateB = b.fecha || "";

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      // If same date, newest createdAt first
      const createdA = a.createdAt || "";
      const createdB = b.createdAt || "";

      return createdB.localeCompare(createdA);
    });
  }, [filteredLogs]);

  const getRowClassName = (log: VehicleLog) => {
    const isIncomplete = !log.horaLlegada || !log.kmLlegada;
    if (isIncomplete) {
      return "border-l-[5px] border-l-[#FFA500] bg-orange-50/20 animate-pulso-naranja ring-1 ring-inset ring-orange-500/20";
    }
    return "";
  };

  const handleDelete = useCallback(
    async (log: VehicleLog) => {
      const _isAdmin = isAdmin(currentUser.role);
      const isCreator =
        log.createdBy === currentUser.id ||
        (log.firma && log.firma.usuarioId === currentUser.id);

      if (!_isAdmin && !isCreator) {
        await confirm({
          title: "Acceso Denegado",
          description:
            "No tienes permisos para eliminar este registro. Solo el creador o un administrador pueden eliminarlo.",
          confirmLabel: "ACEPTAR",
          variant: "warning",
        });
        return;
      }

      const confirmed = await confirm({
        title: "Eliminar Registro",
        description:
          "¿Estás seguro de que deseas eliminar este registro de bitácora?",
        confirmLabel: "CONFIRMAR",
        variant: "danger",
      });

      if (confirmed) {
        setIsLoading(true);
        try {
          // Migración: Hard Delete mediante deleteVersionedDocOffline
          await deleteVersionedDocOffline('bitacora_vehiculos', log.id);

        } catch (err) {
          console.error("Error deleting log:", err);
          await confirm({
            title: "Error",
            description: "No se pudo eliminar el registro de la cola offline.",
            confirmLabel: "ACEPTAR",
            variant: "danger",
          });
        } finally {
          setIsLoading(false);
        }
      }
    },
    [confirm, currentUser],
  );

  const columns = useMemo<TableColumn<VehicleLog>[]>(() => {
    return [
      {
        header: "UNIDAD / PLACA",
        width: "15%",
        className: "!px-2",
        headerClassName: "!px-2",
        render: (l: any) => {
          const placa = l._resolvedPlaca || "SIN PLACA";
          const unidad = l._resolvedUnidad || l.unidadName || "---";
          return (
            <div className="flex flex-col items-start leading-tight">
              <span className="font-bold text-sm text-slate-900 truncate w-full" title={placa}>
                {placa}
              </span>
              <span className="text-[11px] text-slate-500 font-medium truncate w-full" title={unidad}>
                {unidad}
              </span>
            </div>
          );
        },
      },
      {
        header: "Conductor",
        width: "20%",
        render: (l: any) => (
          <div className="truncate w-full font-bold text-slate-800" title={l._resolvedName}>
            {l._resolvedName}
          </div>
        ),
      },
      {
        header: "Fecha",
        width: "10%",
        render: (l: any) => {
          const isIncomplete = !l.horaLlegada || !l.kmLlegada;
          const dateStr = l.fecha || l.createdAt || "";
          if (!dateStr) return "---";

          let displayDate = "";
          if (dateStr.includes("T")) {
            displayDate = new Date(dateStr).toLocaleDateString();
          } else {
            const [year, month, day] = dateStr.split("-").map(Number);
            displayDate = new Date(year, month - 1, day).toLocaleDateString();
          }

          return (
            <div className="flex flex-col items-start gap-1 w-full overflow-hidden">
              <span className="truncate w-full font-bold text-slate-700">{displayDate}</span>
              {isIncomplete && (
                <span className="text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded uppercase leading-none shadow-sm whitespace-nowrap">
                  Incompleto
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: "Ruta / Actividad",
        width: "20%",
        render: (l: any) => (
          <div
            className="truncate w-full text-slate-600 italic text-xs whitespace-nowrap overflow-hidden"
            title={l.destino || "Sin Actividad"}
          >
            {l.destino || "Sin Actividad"}
          </div>
        ),
      },
      {
        header: "Kilometraje",
        width: "10%",
        align: "center",
        className: "!px-2",
        headerClassName: "!px-2",
        render: (l: any) => (
          <div className="flex items-center justify-center gap-2 w-full font-mono text-sm">
            <span className="font-bold text-blue-900 whitespace-nowrap">
              {l.totalKm || 0} km
            </span>
          </div>
        ),
      },
      {
        header: "Gastos",
        width: "10%",
        align: "center",
        render: (l: any) => {
          const logExpenses = expenses.filter(e => e.bitacoraId === l.id);
          const total = logExpenses.reduce((sum, e) => sum + (e.monto || 0), 0);
          
          if (logExpenses.length === 0) return <span className="text-slate-300 text-[10px] font-bold uppercase">---</span>;
          
          return (
            <button
              onClick={() => {
                const unidad = l.unidad || extraerUnidad(l.unidadId);
                onSetActiveModule?.({ module: 'analisis_costos', selectedId: unidad });
              }}
              className="flex flex-col items-center leading-none group transition-transform active:scale-95"
              title="Ver Análisis de Costos"
            >
              <span className="text-xs font-black text-emerald-600 mb-1 group-hover:text-emerald-700">₡{total.toLocaleString()}</span>
              <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-0.5 group-hover:bg-emerald-100 transition-colors">
                {logExpenses.length} {logExpenses.length === 1 ? 'Gasto' : 'Gastos'} <FiArrowRight className="text-[7px]" />
              </span>
            </button>
          );
        }
      },
      {
        header: "Acciones",
        width: "15%",
        align: "center",
        className: "!px-2",
        headerClassName: "!px-2",
        render: (l: any) => (
          <div className="flex justify-center items-center w-full">
            <ActionButtons
              onPdf={() => generateVehicleLogPDF(l)}
              onEdit={() => {
                setSelectedLog(l);
                setIsModalOpen(true);
              }}
              onDelete={() => handleDelete(l)}
              onTimeline={(isAdmin(currentUser?.role) || currentUser?.canUseOperationalLog) ? () => {
                setSelectedLog(l);
                setIsTimelineOpen(true);
              } : undefined}
            />
          </div>
        ),
      },
    ];
  }, [handleDelete, setSelectedLog, setIsModalOpen, currentUser, expenses, onSetActiveModule]);

  // REPAIR HOOKS LEGADOS ELIMINADOS

  try {
    if (isTimelineOpen && selectedLog) {
      return (
        <div className="fixed inset-0 z-50 bg-white overflow-hidden">
          <SharedTimeline
            parentId={selectedLog.id}
            parentCollection="bitacora_vehiculos"
            timelineId={selectedLog.timelineId}
            onBack={() => setIsTimelineOpen(false)}
            onSetActiveModule={onSetActiveModule}
            currentUser={currentUser}
            metadata={{
              title: `Bitácora de Salida: ${(selectedLog as any)._resolvedUnidad || selectedLog.unidadName}`,
              subtitle: `${(selectedLog as any)._resolvedPlaca || ""} - ${(selectedLog as any)._resolvedName || ""}`,
              status: selectedLog.horaLlegada ? "finalizado" : "en_proceso",
              cuadrilla: [selectedLog.conductorName || selectedLog.conductorId],
            }}
          />
        </div>
      );
    }

    return (
      <div className="-mx-2 md:-mx-4 -mt-4">
        <ModulePage
          title="Registros de Bitácora"
          subtitle="Control operativo de salidas, consumo y trazabilidad de vehículos."
        >

          <ModuleToolbar>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full">
              {/* Search + Action Button on Mobile Row */}
              <div className="flex flex-row items-center gap-2 w-full md:flex-1">
                <div className="flex-1">
                  <SearchInput
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar unidad..."
                    className="w-full"
                  />
                </div>
                <div className="md:hidden">
                  {hasPermission(
                    currentUser,
                    "bitacoraVehiculos",
                    "registros",
                  ) && (
                    <ActionButton
                      variant="primary"
                      label="NUEVO"
                      className="whitespace-nowrap px-3 h-10 min-w-fit"
                      onClick={() => {
                        setSelectedLog(null);
                        setIsModalOpen(true);
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Filters and Desktop Action Button */}
              <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                <div className="flex-1 md:w-36">
                  <Select
                    value={filterYear}
                    onChange={(val) => {
                      setFilterYear(val);
                      if (
                        filterMonth &&
                        String(filterMonth).startsWith("week:")
                      )
                        setFilterMonth("all");
                    }}
                    options={yearOptions}
                    isSearchable={false}
                  />
                </div>

                <div className="flex-1 md:w-56">
                  <Select
                    value={filterMonth}
                    onChange={(val) => setFilterMonth(val)}
                    options={weekOptions}
                    isSearchable={false}
                  />
                </div>

                <div className="hidden md:block">
                  {hasPermission(
                    currentUser,
                    "bitacoraVehiculos",
                    "registros",
                  ) && (
                    <ActionButton
                      variant="primary"
                      label="NUEVO"
                      className="whitespace-nowrap px-6"
                      onClick={() => {
                        setSelectedLog(null);
                        setIsModalOpen(true);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </ModuleToolbar>

          {isLoading ? (
            <div className="text-center py-20 text-slate-500">
              <FiRefreshCcw className="inline-block animate-spin mr-2" />
              Cargando registros...
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3 pb-10">
                {sortedLogs.map((log) => (
                  <VehicleLogCard
                    key={log.id}
                    log={log}
                    expenses={expenses.filter(e => e.bitacoraId === log.id)}
                    onEdit={() => {
                      setSelectedLog(log);
                      setIsModalOpen(true);
                    }}
                    onDelete={() => handleDelete(log)}
                    onPdf={() => generateVehicleLogPDF(log)}
                    onTimeline={
                      (isAdmin(currentUser?.role) || currentUser?.canUseOperationalLog)
                        ? () => {
                            setSelectedLog(log);
                            setIsTimelineOpen(true);
                          }
                        : undefined
                    }
                    onCostAnalysis={() => {
                      const unidad = log.unidad || extraerUnidad(log.unidadId);
                      onSetActiveModule?.({ module: 'analisis_costos', selectedId: unidad });
                    }}
                  />
                ))}
              </div>

              <div className="hidden md:block">
                <DataTable<VehicleLog>
                  data={sortedLogs}
                  columns={columns}
                  keyExtractor={(l) => l.id}
                  getRowClassName={getRowClassName}
                  emptyMessage="No hay registros de bitácora que coincidan con la búsqueda."
                />
              </div>

              {sortedLogs?.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-500">
                  No hay registros de bitácora que coincidan con la búsqueda.
                </div>
              )}
            </>
          )}

          {isModalOpen && (
            <VehicleLogModal
              show={isModalOpen}
              onClose={(result?: any) => {
                if (result?.timelineId) {
                  setSelectedLog(prev => ({
                    ...(prev || {}),
                    ...(result.logDoc || {}),
                    timelineId: result.timelineId
                  }) as VehicleLog);
                }
                setIsModalOpen(false);
                onClearSelectedId?.();
              }}
              currentUser={currentUser}
              initialData={selectedLog}
              initialEmployees={employeesList}
            />
          )}
        </ModulePage>
      </div>
    );
  } catch (err) {
    console.error("🔥 [VehicleLogs] CRITICAL RENDER ERROR:", err);
    return (
      <div className="p-10 bg-red-50 border-2 border-red-100 rounded-2xl m-4">
        <h1 className="text-red-800 text-xl font-black mb-4 flex items-center gap-3">
          <FiInfo className="text-red-500" />
          Error al cargar Bitácora
        </h1>
        <pre className="text-xs bg-white p-4 rounded-lg overflow-auto max-h-60 border border-red-200">
          {String(err)}
        </pre>
        <div className="flex gap-4">
          <ActionButton
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg font-bold flex items-center gap-2"
            label="Reintentar"
            icon={<FiRefreshCcw className="w-4 h-4" />}
          />
          <ActionButton
            onClick={() => {}}
            className="mt-6 px-4 py-2 bg-slate-600 text-white rounded-lg font-bold"
            label="Ver detalles en consola"
          />
        </div>
      </div>
    );
  }
};
