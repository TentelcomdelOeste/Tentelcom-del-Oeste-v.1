import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../../utils/types';
import {
  ActionButton,
  SearchInput,
  Select,
  DataTable,
  TableColumn,
  useConfirm,
  Modal
} from '../../../design-system';
import {
  Vehicle,
  VehicleDocument,
  VehicleMaintenance,
  VehicleAttachment
} from '../../../types/vehicle.types';
import {
  getVehiclesCatalog,
  subscribeVehicleDocuments,
  subscribeVehicleMaintenances,
  saveVehicleDocument,
  deleteVehicleDocument,
  saveVehicleMaintenance,
  deleteVehicleMaintenance,
  calculateControlAlerts,
  formatUnitLabel
} from '../controlVehicularService';
import { VehicleDocumentModal } from './VehicleDocumentModal';
import { VehicleMaintenanceModal } from './VehicleMaintenanceModal';
import { VEHICLES } from '../../job_scheduling/JobForm';
import { db } from '../../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  FiShield,
  FiSettings,
  FiAlertTriangle,
  FiClock,
  FiEdit2,
  FiTrash2,
  FiPaperclip,
  FiDownload
} from 'react-icons/fi';

interface ControlVehicularModuleProps {
  currentUser: User;
  onSetActiveModule?: (module: any) => void;
}

export const ControlVehicularModule: React.FC<ControlVehicularModuleProps> = ({
  currentUser,
  onSetActiveModule
}) => {
  const confirm = useConfirm();

  // Estados principales
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('TODOS');
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([]);
  const [latestKmsMap, setLatestKmsMap] = useState<Record<string, number>>({});
  const [activeSubTab, setActiveSubTab] = useState<'documentos' | 'mantenimientos' | 'historial'>('documentos');

  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modales
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<VehicleDocument | null>(null);

  const [isMaintModalOpen, setIsMaintModalOpen] = useState<boolean>(false);
  const [editingMaint, setEditingMaint] = useState<VehicleMaintenance | null>(null);

  const [previewFiles, setPreviewFiles] = useState<VehicleAttachment[] | null>(null);

  // 1. Cargar catálogo de vehículos
  useEffect(() => {
    let isMounted = true;
    getVehiclesCatalog().then((list) => {
      if (isMounted) {
        setVehicles(list);
      }
    });

    // Escuchar bitácoras diarias para mapear los últimos kilometrajes reportados
    const qBitacoras = collection(db, 'bitacora_vehiculos');
    const unsubBitacoras = onSnapshot(qBitacoras, (snap) => {
      const kms: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.isDeleted) return;
        const vehKey1 = data.unidadId || '';
        const vehKey2 = data.unidad || '';
        const maxKm = Math.max(
          data.kmLlegada || 0,
          data.kmSalida || 0,
          data.kmActual || 0
        );
        if (maxKm > 0) {
          if (vehKey1) kms[vehKey1] = Math.max(kms[vehKey1] || 0, maxKm);
          if (vehKey2) kms[vehKey2] = Math.max(kms[vehKey2] || 0, maxKm);
        }
      });
      if (isMounted) {
        setLatestKmsMap(kms);
      }
    });

    return () => {
      isMounted = false;
      unsubBitacoras();
    };
  }, []);

  // 2. Suscripciones en tiempo real a documentos y mantenimientos
  useEffect(() => {
    const unsubDocs = subscribeVehicleDocuments((docs) => setDocuments(docs));
    const unsubMaints = subscribeVehicleMaintenances((maints) => setMaintenances(maints));
    return () => {
      unsubDocs();
      unsubMaints();
    };
  }, []);

  // 3. Calcular Alertas Activas
  const allAlerts = useMemo(() => {
    return calculateControlAlerts(vehicles, documents, maintenances, latestKmsMap);
  }, [vehicles, documents, maintenances, latestKmsMap]);

  // Opciones para el selector de unidad
  const vehicleOptions = useMemo(() => {
    const options = [
      { value: 'TODOS', label: '🚗 [ TODAS LAS UNIDADES VEHICULARES ]' }
    ];
    const addedValues = new Set<string>();

    VEHICLES.forEach((v) => {
      options.push({ value: v.value, label: v.label });
      addedValues.add(v.value);
    });

    vehicles.forEach((v) => {
      const code = v.alias || v.id;
      if (!addedValues.has(code) && !addedValues.has(v.id)) {
        options.push({
          value: v.id,
          label: formatUnitLabel(v)
        });
        addedValues.add(v.id);
      }
    });

    return options;
  }, [vehicles]);

  // Vehículo actualmente seleccionado
  const selectedVehicle = useMemo(() => {
    if (selectedVehicleId === 'TODOS') return null;
    const targetCode = selectedVehicleId.split(' - ')[0]?.split(' — ')[0]?.trim() || selectedVehicleId;

    const foundInCatalog = vehicles.find(
      (v) => v.id === selectedVehicleId || v.alias === selectedVehicleId || v.id === targetCode || v.alias === targetCode
    );
    if (foundInCatalog) return foundInCatalog;

    const staticV = VEHICLES.find((v) => v.value === selectedVehicleId || v.value === targetCode);
    if (staticV) {
      const parts = staticV.label.split(' - ');
      return {
        id: staticV.value,
        alias: staticV.value,
        marca: parts[1] || '',
        modelo: '',
        placa: parts[2] || '',
        isActive: true
      } as Vehicle;
    }
    return null;
  }, [vehicles, selectedVehicleId]);

  const matchesSelectedVehicle = (vehiculoId?: string, unidad?: string, unidadLabel?: string) => {
    if (selectedVehicleId === 'TODOS') return true;
    const targetCode = selectedVehicleId.split(' - ')[0]?.split(' — ')[0]?.trim() || selectedVehicleId;
    const docCode = unidad?.split(' - ')[0]?.split(' — ')[0]?.trim() || unidad || '';
    
    return (
      vehiculoId === selectedVehicleId ||
      vehiculoId === targetCode ||
      unidad === selectedVehicleId ||
      docCode === targetCode ||
      (unidadLabel && unidadLabel.toLowerCase().includes(targetCode.toLowerCase()))
    );
  };

  // Alertas filtradas según la unidad seleccionada
  const filteredAlerts = useMemo(() => {
    if (selectedVehicleId === 'TODOS') return allAlerts;
    return allAlerts.filter((a) => matchesSelectedVehicle(a.vehiculoId, a.unidad, a.unidadLabel));
  }, [allAlerts, selectedVehicleId]);

  // Documentos filtrados para la vista
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (!matchesSelectedVehicle(d.vehiculoId, d.unidad, d.unidadLabel)) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const textToSearch = `${d.tipoDocumento} ${d.unidad} ${d.unidadLabel || ''} ${d.numeroReferencia || ''} ${d.observaciones || ''}`.toLowerCase();
        return textToSearch.includes(term);
      }
      return true;
    });
  }, [documents, selectedVehicleId, searchTerm]);

  // Mantenimientos filtrados para la vista
  const filteredMaintenances = useMemo(() => {
    return maintenances.filter((m) => {
      if (!matchesSelectedVehicle(m.vehiculoId, m.unidad, m.unidadLabel)) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const textToSearch = `${m.tipoMantenimiento} ${m.unidad} ${m.unidadLabel || ''} ${m.tallerProveedor || ''} ${m.responsable || ''} ${m.observaciones || ''}`.toLowerCase();
        return textToSearch.includes(term);
      }
      return true;
    });
  }, [maintenances, selectedVehicleId, searchTerm]);

  // Historial Unificado
  const unifiedHistory = useMemo(() => {
    const list: Array<{
      id: string;
      kind: 'documento' | 'mantenimiento';
      fecha: string;
      unidad: string;
      unidadLabel: string;
      titulo: string;
      subtitulo: string;
      referenciaKm: string;
      costo?: number;
      responsable: string;
      archivos?: VehicleAttachment[];
      rawDoc?: VehicleDocument;
      rawMaint?: VehicleMaintenance;
    }> = [];

    filteredDocuments.forEach((d) => {
      list.push({
        id: `doc_${d.id}`,
        kind: 'documento',
        fecha: d.fechaEmision || d.createdAt?.split('T')[0] || '---',
        unidad: d.unidad,
        unidadLabel: d.unidadLabel || d.unidad,
        titulo: `Documento: ${d.tipoDocumento}`,
        subtitulo: `Vencimiento: ${d.fechaVencimiento || '---'} | Ref: ${d.numeroReferencia || 'S/N'}`,
        referenciaKm: `Vence: ${d.fechaVencimiento || 'N/A'}`,
        costo: d.costo,
        responsable: d.createdBy || 'Usuario',
        archivos: d.archivos,
        rawDoc: d
      });
    });

    filteredMaintenances.forEach((m) => {
      list.push({
        id: `maint_${m.id}`,
        kind: 'mantenimiento',
        fecha: m.fecha || m.createdAt?.split('T')[0] || '---',
        unidad: m.unidad,
        unidadLabel: m.unidadLabel || m.unidad,
        titulo: `Mantenimiento: ${m.tipoMantenimiento}`,
        subtitulo: `Taller: ${m.tallerProveedor || 'N/A'} | Km Trabajo: ${m.kilometrajeActual?.toLocaleString() || '---'} km`,
        referenciaKm: `Próximo: ${m.proximoKilometraje?.toLocaleString() || '---'} km`,
        costo: m.costo,
        responsable: m.responsable || m.createdBy || 'Usuario',
        archivos: m.archivos,
        rawMaint: m
      });
    });

    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [filteredDocuments, filteredMaintenances]);

  // Kilometraje actual del vehículo seleccionado
  const currentSelectedKm = useMemo(() => {
    if (!selectedVehicle) return 0;
    const key1 = selectedVehicle.id;
    const key2 = selectedVehicle.alias;
    const latestMaintKm = maintenances
      .filter((m) => m.vehiculoId === selectedVehicle.id || m.unidad === selectedVehicle.alias)
      .reduce((max, m) => Math.max(max, m.kilometrajeActual || 0), 0);
    return Math.max(latestKmsMap[key1] || 0, latestKmsMap[key2] || 0, latestMaintKm);
  }, [selectedVehicle, maintenances, latestKmsMap]);

  // Handlers para Documentos
  const handleSaveDocument = async (data: Partial<VehicleDocument>) => {
    await saveVehicleDocument(data);
  };

  const handleDeleteDoc = async (doc: VehicleDocument) => {
    const isConfirmed = await confirm({
      title: '¿Eliminar Documento Vehicular?',
      description: `¿Está seguro de eliminar el registro de ${doc.tipoDocumento} (${doc.unidad})? Esta acción es irreversible.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (isConfirmed) {
      await deleteVehicleDocument(doc.id);
    }
  };

  // Handlers para Mantenimientos
  const handleSaveMaintenance = async (data: Partial<VehicleMaintenance>) => {
    await saveVehicleMaintenance(data);
  };

  const handleDeleteMaint = async (maint: VehicleMaintenance) => {
    const isConfirmed = await confirm({
      title: '¿Eliminar Mantenimiento?',
      description: `¿Está seguro de eliminar el registro de ${maint.tipoMantenimiento} (${maint.unidad})? Esta acción es irreversible.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (isConfirmed) {
      await deleteVehicleMaintenance(maint.id);
    }
  };

  // Columnas de la tabla de Documentos
  const documentColumns: TableColumn<VehicleDocument>[] = [
    {
      header: 'Unidad',
      width: '15%',
      render: (d) => (
        <div className="flex flex-col">
          <span className="font-black text-blue-900 text-xs">{d.unidad}</span>
          <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{d.unidadLabel || ''}</span>
        </div>
      )
    },
    {
      header: 'Documento / Tipo',
      width: '20%',
      render: (d) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-xs">{d.tipoDocumento}</span>
          {d.numeroReferencia && (
            <span className="text-[10px] text-slate-500 font-mono">Ref: {d.numeroReferencia}</span>
          )}
        </div>
      )
    },
    {
      header: 'Emisión',
      width: '12%',
      align: 'center',
      render: (d) => <span className="text-xs text-slate-600">{d.fechaEmision || '---'}</span>
    },
    {
      header: 'Vencimiento',
      width: '15%',
      align: 'center',
      render: (d) => {
        if (!d.fechaVencimiento) return <span className="text-slate-400 text-xs">---</span>;
        const [y, m, day] = d.fechaVencimiento.split('-').map(Number);
        const target = new Date(y, m - 1, day);
        target.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const restan = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        let label = `${day}/${m}/${y} (${restan}d)`;

        if (restan <= 0) {
          badgeClass = 'bg-red-50 text-red-700 border-red-200 font-black';
          label = `${day}/${m}/${y} (VENCIDO)`;
        } else if (restan <= (d.diasAnticipacionAlerta ?? 30)) {
          badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
          label = `${day}/${m}/${y} (${restan}d restan)`;
        }

        return (
          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${badgeClass} inline-block whitespace-nowrap`}>
            {label}
          </span>
        );
      }
    },
    {
      header: 'Costo',
      width: '12%',
      align: 'right',
      render: (d) => (
        <span className="text-xs font-bold text-slate-700">
          {d.costo ? `₡${d.costo.toLocaleString()}` : '---'}
        </span>
      )
    },
    {
      header: 'Adjuntos',
      width: '10%',
      align: 'center',
      render: (d) => {
        const count = d.archivos?.length || 0;
        if (count === 0) return <span className="text-slate-300 text-[10px]">---</span>;
        return (
          <button
            type="button"
            onClick={() => setPreviewFiles(d.archivos || [])}
            className="flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg transition-colors"
          >
            <FiPaperclip />
            <span>{count}</span>
          </button>
        );
      }
    },
    {
      header: 'Acciones',
      width: '16%',
      align: 'center',
      render: (d) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditingDoc(d);
              setIsDocModalOpen(true);
            }}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar Documento"
          >
            <FiEdit2 className="text-sm" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteDoc(d)}
            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar Documento"
          >
            <FiTrash2 className="text-sm" />
          </button>
        </div>
      )
    }
  ];

  // Columnas de la tabla de Mantenimientos
  const maintenanceColumns: TableColumn<VehicleMaintenance>[] = [
    {
      header: 'Unidad',
      width: '14%',
      render: (m) => (
        <div className="flex flex-col">
          <span className="font-black text-blue-900 text-xs">{m.unidad}</span>
          <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{m.unidadLabel || ''}</span>
        </div>
      )
    },
    {
      header: 'Trabajo / Mantenimiento',
      width: '20%',
      render: (m) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-xs">{m.tipoMantenimiento}</span>
          {m.tallerProveedor && (
            <span className="text-[10px] text-slate-500">Taller: {m.tallerProveedor}</span>
          )}
        </div>
      )
    },
    {
      header: 'Fecha',
      width: '11%',
      align: 'center',
      render: (m) => <span className="text-xs text-slate-600">{m.fecha || '---'}</span>
    },
    {
      header: 'Km Trabajo',
      width: '12%',
      align: 'right',
      render: (m) => <span className="text-xs font-mono text-slate-700">{m.kilometrajeActual?.toLocaleString()} km</span>
    },
    {
      header: 'Próximo Km',
      width: '16%',
      align: 'center',
      render: (m) => {
        const currentKm = Math.max(
          latestKmsMap[m.vehiculoId] || 0,
          latestKmsMap[m.unidad] || 0,
          m.kilometrajeActual || 0
        );
        const proximo = m.proximoKilometraje || 0;
        const restan = proximo - currentKm;
        const threshold = m.kilometrajeAlerta ?? 1000;

        let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        let label = `${proximo.toLocaleString()} km (${restan.toLocaleString()} km restan)`;

        if (restan <= 0) {
          badgeClass = 'bg-red-50 text-red-700 border-red-200 font-black';
          label = `${proximo.toLocaleString()} km (SOBREPASADO)`;
        } else if (restan <= threshold) {
          badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
          label = `${proximo.toLocaleString()} km (${restan.toLocaleString()} km restan)`;
        }

        return (
          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${badgeClass} inline-block whitespace-nowrap`}>
            {label}
          </span>
        );
      }
    },
    {
      header: 'Costo',
      width: '11%',
      align: 'right',
      render: (m) => (
        <span className="text-xs font-bold text-slate-700">
          {m.costo ? `₡${m.costo.toLocaleString()}` : '---'}
        </span>
      )
    },
    {
      header: 'Comprobantes',
      width: '8%',
      align: 'center',
      render: (m) => {
        const count = m.archivos?.length || 0;
        if (count === 0) return <span className="text-slate-300 text-[10px]">---</span>;
        return (
          <button
            type="button"
            onClick={() => setPreviewFiles(m.archivos || [])}
            className="flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg transition-colors"
          >
            <FiPaperclip />
            <span>{count}</span>
          </button>
        );
      }
    },
    {
      header: 'Acciones',
      width: '8%',
      align: 'center',
      render: (m) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditingMaint(m);
              setIsMaintModalOpen(true);
            }}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar Mantenimiento"
          >
            <FiEdit2 className="text-sm" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteMaint(m)}
            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar Mantenimiento"
          >
            <FiTrash2 className="text-sm" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* TARJETA CABECERA DE SELECCIÓN DE UNIDAD & RESUMEN */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Unidad Vehicular
            </label>
            <Select
              options={vehicleOptions}
              value={selectedVehicleId}
              onChange={(val) => setSelectedVehicleId(val)}
              className="w-full md:w-96 text-xs font-bold"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ActionButton
              variant="secondary"
              label="+ Documento"
              onClick={() => {
                setEditingDoc(null);
                setIsDocModalOpen(true);
              }}
              className="!py-2 text-xs font-bold"
            />
            <ActionButton
              variant="primary"
              label="+ Mantenimiento"
              onClick={() => {
                setEditingMaint(null);
                setIsMaintModalOpen(true);
              }}
              className="!py-2 text-xs font-bold"
            />
          </div>
        </div>

        {/* Muestra detalle de la unidad seleccionada */}
        {selectedVehicle && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                Unidad: {selectedVehicle.alias}
              </span>
              <span><strong>Placa:</strong> {selectedVehicle.placa || '---'}</span>
              <span><strong>Marca / Modelo:</strong> {selectedVehicle.marca} {selectedVehicle.modelo}</span>
              <span className="bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded-md border border-blue-100">
                Km Registrado: {currentSelectedKm.toLocaleString()} km
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {documents.filter(d => d.vehiculoId === selectedVehicle.id || d.unidad === selectedVehicle.alias).length} Docs
              </span>
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {maintenances.filter(m => m.vehiculoId === selectedVehicle.id || m.unidad === selectedVehicle.alias).length} Mantenimientos
              </span>
              {filteredAlerts.length > 0 && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                  ⚠️ {filteredAlerts.length} Alerta{filteredAlerts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN DE ALERTAS VISUALES ACTIVAS */}
      {filteredAlerts.length > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
            <FiAlertTriangle className="text-amber-600 text-lg shrink-0" />
            <span>Alertas de Control Vehicular ({filteredAlerts.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-xl border flex flex-col justify-between text-xs ${
                  alert.nivel === 'danger'
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-amber-50/80 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between font-black mb-1">
                  <span className="truncate">{alert.unidadLabel}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-black ${
                    alert.nivel === 'danger' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                  }`}>
                    {alert.titulo}
                  </span>
                </div>
                <p className="text-[11px] font-medium leading-snug">{alert.detalle}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN SECUNDARIA (SUB-TABS) & BUSCADOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Selector de Sección (Móvil) */}
          <div className="block md:hidden w-full">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
              SECCIÓN
            </label>
            <Select
              options={[
                { value: 'documentos', label: `Documentación (${filteredDocuments.length})` },
                { value: 'mantenimientos', label: `Mantenimiento (${filteredMaintenances.length})` },
                { value: 'historial', label: `Historial (${unifiedHistory.length})` }
              ]}
              value={activeSubTab}
              onChange={(val) => setActiveSubTab(val as 'documentos' | 'mantenimientos' | 'historial')}
              isSearchable={false}
              className="w-full text-xs font-bold"
            />
          </div>

          {/* Sub-Tabs (Escritorio) */}
          <div className="hidden md:flex gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('documentos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeSubTab === 'documentos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FiShield />
              <span>Documentación ({filteredDocuments.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('mantenimientos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeSubTab === 'mantenimientos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FiSettings />
              <span>Mantenimiento ({filteredMaintenances.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('historial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeSubTab === 'historial'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FiClock />
              <span>Historial ({unifiedHistory.length})</span>
            </button>
          </div>

          {/* Buscador Rápido */}
          <div className="w-full md:w-64">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar en registros..."
              className="w-full"
            />
          </div>
        </div>

        {/* VISTA SEGÚN SUB-TAB SELECCIONADA */}
        {activeSubTab === 'documentos' && (
          <div className="mt-2 space-y-3">
            {filteredDocuments.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <FiShield className="text-3xl text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No hay documentos registrados para esta selección.</p>
                <p className="text-[11px] text-slate-400 mt-1">Haga clic en &quot;+ Documento&quot; para agregar DEKRA, Marchamo, Seguros o Permisos.</p>
              </div>
            ) : (
              <>
                {/* Lista de Tarjetas para Móvil */}
                <div className="block md:hidden space-y-3">
                  {filteredDocuments.map((d) => {
                    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    let label = 'VIGENTE';
                    if (d.fechaVencimiento) {
                      const [y, m, day] = d.fechaVencimiento.split('-').map(Number);
                      const target = new Date(y, m - 1, day);
                      target.setHours(0, 0, 0, 0);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const restan = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      label = `${day}/${m}/${y} (${restan}d)`;
                      if (restan <= 0) {
                        badgeClass = 'bg-red-50 text-red-700 border-red-200 font-black';
                        label = `${day}/${m}/${y} (VENCIDO)`;
                      } else if (restan <= (d.diasAnticipacionAlerta ?? 30)) {
                        badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
                        label = `${day}/${m}/${y} (${restan}d restan)`;
                      }
                    }

                    return (
                      <div key={d.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <span className="font-black text-blue-900 block">{d.unidad}</span>
                            <span className="text-[10px] text-slate-400 block">{d.unidadLabel || ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDoc(d);
                                setIsDocModalOpen(true);
                              }}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <FiEdit2 className="text-sm" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc(d)}
                              className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <FiTrash2 className="text-sm" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{d.tipoDocumento}</span>
                          {d.costo ? <span className="text-blue-700 font-extrabold">₡{d.costo.toLocaleString()}</span> : null}
                        </div>

                        {d.numeroReferencia && (
                          <p className="text-[10px] text-slate-500 font-mono">Ref: {d.numeroReferencia}</p>
                        )}

                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-slate-500">Emisión: {d.fechaEmision || '---'}</span>
                          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${badgeClass}`}>
                            {label}
                          </span>
                        </div>

                        {d.archivos && d.archivos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewFiles(d.archivos || [])}
                            className="flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg w-full justify-center"
                          >
                            <FiPaperclip />
                            <span>Ver {d.archivos.length} adjunto(s)</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Tabla para Escritorio */}
                <div className="hidden md:block">
                  <DataTable
                    columns={documentColumns}
                    data={filteredDocuments}
                    keyExtractor={(d) => d.id}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeSubTab === 'mantenimientos' && (
          <div className="mt-2 space-y-3">
            {filteredMaintenances.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <FiSettings className="text-3xl text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No hay mantenimientos registrados para esta selección.</p>
                <p className="text-[11px] text-slate-400 mt-1">Haga clic en &quot;+ Mantenimiento&quot; para registrar cambio de aceite, frenos o revisiones.</p>
              </div>
            ) : (
              <>
                {/* Lista de Tarjetas para Móvil */}
                <div className="block md:hidden space-y-3">
                  {filteredMaintenances.map((m) => {
                    const currentKm = Math.max(
                      latestKmsMap[m.vehiculoId] || 0,
                      latestKmsMap[m.unidad] || 0,
                      m.kilometrajeActual || 0
                    );
                    const restanKm = (m.proximoKilometraje || 0) - currentKm;
                    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    let label = `${m.proximoKilometraje?.toLocaleString()} km (${restanKm.toLocaleString()} km restan)`;
                    if (restanKm <= 0) {
                      badgeClass = 'bg-red-50 text-red-700 border-red-200 font-black';
                      label = `${m.proximoKilometraje?.toLocaleString()} km (ALERTA SOBREPASADO)`;
                    } else if (restanKm <= (m.kilometrajeAlerta ?? 1000)) {
                      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
                      label = `${m.proximoKilometraje?.toLocaleString()} km (${restanKm.toLocaleString()} km restan)`;
                    }

                    return (
                      <div key={m.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <span className="font-black text-blue-900 block">{m.unidad}</span>
                            <span className="text-[10px] text-slate-400 block">{m.unidadLabel || ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMaint(m);
                                setIsMaintModalOpen(true);
                              }}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <FiEdit2 className="text-sm" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMaint(m)}
                              className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <FiTrash2 className="text-sm" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{m.tipoMantenimiento}</span>
                          {m.costo ? <span className="text-blue-700 font-extrabold">₡{m.costo.toLocaleString()}</span> : null}
                        </div>

                        {m.tallerProveedor && (
                          <p className="text-[11px] text-slate-500">Taller: {m.tallerProveedor}</p>
                        )}

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Fecha: {m.fecha || '---'}</span>
                          <span className="font-mono text-slate-700">Km: {m.kilometrajeActual?.toLocaleString()} km</span>
                        </div>

                        <div className="pt-1">
                          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${badgeClass} inline-block w-full text-center`}>
                            Próximo: {label}
                          </span>
                        </div>

                        {m.archivos && m.archivos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewFiles(m.archivos || [])}
                            className="flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg w-full justify-center"
                          >
                            <FiPaperclip />
                            <span>Ver {m.archivos.length} adjunto(s)</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Tabla para Escritorio */}
                <div className="hidden md:block">
                  <DataTable
                    columns={maintenanceColumns}
                    data={filteredMaintenances}
                    keyExtractor={(m) => m.id}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeSubTab === 'historial' && (
          <div className="mt-2 space-y-2">
            {unifiedHistory.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <FiClock className="text-3xl text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No se encontraron registros en el historial.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unifiedHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl text-lg shrink-0 mt-0.5 ${
                        item.kind === 'documento' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.kind === 'documento' ? <FiShield /> : <FiSettings />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{item.titulo}</span>
                          <span className="text-[10px] bg-slate-200 font-bold px-2 py-0.5 rounded text-slate-700">
                            {item.unidad}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{item.subtitulo}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                          <span>Fecha: {item.fecha}</span>
                          <span>Registrado por: {item.responsable}</span>
                          {item.costo ? <span className="font-bold text-slate-700">Costo: ₡{item.costo.toLocaleString()}</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {item.archivos && item.archivos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewFiles(item.archivos || [])}
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50"
                        >
                          <FiPaperclip />
                          <span>{item.archivos.length} Adjunto{item.archivos.length > 1 ? 's' : ''}</span>
                        </button>
                      )}

                      {item.kind === 'documento' && item.rawDoc && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDoc(item.rawDoc || null);
                            setIsDocModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-lg"
                        >
                          <FiEdit2 className="text-xs" />
                        </button>
                      )}

                      {item.kind === 'mantenimiento' && item.rawMaint && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMaint(item.rawMaint || null);
                            setIsMaintModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-lg"
                        >
                          <FiEdit2 className="text-xs" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL MODALIDAD DOCUMENTO */}
      <VehicleDocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        onSave={handleSaveDocument}
        editingDoc={editingDoc}
        vehicles={vehicles}
        defaultVehiculoId={selectedVehicleId !== 'TODOS' ? selectedVehicleId : undefined}
        currentUser={currentUser}
      />

      {/* MODAL MODALIDAD MANTENIMIENTO */}
      <VehicleMaintenanceModal
        isOpen={isMaintModalOpen}
        onClose={() => setIsMaintModalOpen(false)}
        onSave={handleSaveMaintenance}
        editingMaint={editingMaint}
        vehicles={vehicles}
        defaultVehiculoId={selectedVehicleId !== 'TODOS' ? selectedVehicleId : undefined}
        defaultKm={currentSelectedKm > 0 ? currentSelectedKm : undefined}
        currentUser={currentUser}
      />

      {/* MODAL VISUALIZADOR DE ARCHIVOS ADJUNTOS */}
      {previewFiles && (
        <Modal
          isOpen={!!previewFiles}
          onClose={() => setPreviewFiles(null)}
          title="Archivos Adjuntos / Comprobantes"
          size="md"
        >
          <div className="space-y-3 text-slate-800">
            {previewFiles.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No hay archivos adjuntos.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {previewFiles.map((file, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="truncate pr-2">{file.name}</span>
                      <a
                        href={file.url}
                        download={file.name}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline shrink-0"
                      >
                        <FiDownload /> Descargar
                      </a>
                    </div>
                    {file.url.startsWith('data:image') || file.url.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-black/5 max-h-60 flex items-center justify-center">
                        <img src={file.url} alt={file.name} className="max-h-56 object-contain" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <ActionButton
                variant="secondary"
                label="Cerrar"
                onClick={() => setPreviewFiles(null)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
