import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../../utils/types';
import { Modal, ActionButton, Select } from '../../../design-system';
import { Vehicle, VehicleMaintenance, VehicleAttachment } from '../../../types/vehicle.types';
import { formatUnitLabel } from '../controlVehicularService';
import { VEHICLES } from '../../job_scheduling/JobForm';
import { FiSettings, FiPaperclip, FiTrash2, FiAlertCircle } from 'react-icons/fi';

interface VehicleMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (maintData: Partial<VehicleMaintenance>) => Promise<void>;
  editingMaint?: VehicleMaintenance | null;
  vehicles: Vehicle[];
  defaultVehiculoId?: string;
  defaultKm?: number;
  currentUser: User;
}

const PRESET_MAINT_TYPES = [
  'Cambio de aceite',
  'Cambio de filtros',
  'Frenos',
  'Llantas',
  'Batería',
  'Alineación y balanceo',
  'Mantenimiento preventivo',
  'Reparación',
  'Servicio mecánico',
  'Otro (Especifique)'
];

export const VehicleMaintenanceModal: React.FC<VehicleMaintenanceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMaint,
  vehicles,
  defaultVehiculoId,
  defaultKm,
  currentUser
}) => {
  const [vehiculoId, setVehiculoId] = useState<string>('');
  const [tipoPreset, setTipoPreset] = useState<string>('Cambio de aceite');
  const [customTipo, setCustomTipo] = useState<string>('');
  const [fecha, setFecha] = useState<string>('');
  const [kilometrajeActual, setKilometrajeActual] = useState<string>('');
  const [intervaloMantenimiento, setIntervaloMantenimiento] = useState<number>(10000);
  const [proximoKilometraje, setProximoKilometraje] = useState<string>('');
  const [kilometrajeAlerta, setKilometrajeAlerta] = useState<number>(1000);
  const [tallerProveedor, setTallerProveedor] = useState<string>('');
  const [costo, setCosto] = useState<string>('');
  const [responsable, setResponsable] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [archivos, setArchivos] = useState<VehicleAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);

      if (editingMaint) {
        setVehiculoId(editingMaint.vehiculoId || editingMaint.unidad || '');
        if (PRESET_MAINT_TYPES.includes(editingMaint.tipoMantenimiento)) {
          setTipoPreset(editingMaint.tipoMantenimiento);
          setCustomTipo('');
        } else {
          setTipoPreset('Otro (Especifique)');
          setCustomTipo(editingMaint.tipoMantenimiento);
        }
        setFecha(editingMaint.fecha || '');
        setKilometrajeActual(editingMaint.kilometrajeActual ? String(editingMaint.kilometrajeActual) : '');
        setIntervaloMantenimiento(editingMaint.intervaloMantenimiento || 10000);
        setProximoKilometraje(editingMaint.proximoKilometraje ? String(editingMaint.proximoKilometraje) : '');
        setKilometrajeAlerta(editingMaint.kilometrajeAlerta ?? 1000);
        setTallerProveedor(editingMaint.tallerProveedor || '');
        setCosto(editingMaint.costo ? String(editingMaint.costo) : '');
        setResponsable(editingMaint.responsable || currentUser.name || currentUser.username || '');
        setObservaciones(editingMaint.observaciones || '');
        setArchivos(editingMaint.archivos || []);
      } else {
        const initialVeh = defaultVehiculoId || (vehicles[0]?.id || '');
        setVehiculoId(initialVeh);
        setTipoPreset('Cambio de aceite');
        setCustomTipo('');
        setFecha(new Date().toISOString().split('T')[0]);
        const startKm = defaultKm ? String(defaultKm) : '';
        setKilometrajeActual(startKm);
        setIntervaloMantenimiento(10000);
        const nextKm = defaultKm ? defaultKm + 10000 : '';
        setProximoKilometraje(nextKm ? String(nextKm) : '');
        setKilometrajeAlerta(1000);
        setTallerProveedor('');
        setCosto('');
        setResponsable(currentUser.name || currentUser.username || '');
        setObservaciones('');
        setArchivos([]);
      }
    }
  }, [isOpen, editingMaint, defaultVehiculoId, defaultKm, vehicles, currentUser]);

  // Recalcular próximo kilometraje cuando cambia el actual o el intervalo
  const handleKmChange = (valStr: string) => {
    setKilometrajeActual(valStr);
    const kmNum = parseFloat(valStr);
    if (!isNaN(kmNum)) {
      setProximoKilometraje(String(Math.round(kmNum + intervaloMantenimiento)));
    }
  };

  const handleIntervalChange = (intervalNum: number) => {
    setIntervaloMantenimiento(intervalNum);
    const kmNum = parseFloat(kilometrajeActual);
    if (!isNaN(kmNum)) {
      setProximoKilometraje(String(Math.round(kmNum + intervalNum)));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 8 * 1024 * 1024) {
        setError(`El archivo ${file.name} supera el tamaño máximo de 8MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setArchivos((prev) => [
          ...prev,
          {
            name: file.name,
            url: result,
            type: file.type
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index));
  };

  const vehicleOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!vehiculoId) {
      setErrorMsg('Debe seleccionar una unidad vehicular.');
      return;
    }

    const finalTipo = tipoPreset === 'Otro (Especifique)' ? customTipo.trim() : tipoPreset;
    if (!finalTipo) {
      setErrorMsg('Debe especificar el tipo de mantenimiento.');
      return;
    }

    const kmActualNum = parseFloat(kilometrajeActual);
    if (isNaN(kmActualNum) || kmActualNum < 0) {
      setErrorMsg('Debe ingresar un kilometraje actual válido.');
      return;
    }

    const proximoKmNum = parseFloat(proximoKilometraje);
    if (isNaN(proximoKmNum) || proximoKmNum <= kmActualNum) {
      setErrorMsg('El próximo kilometraje debe ser mayor que el kilometraje actual.');
      return;
    }

    const selectedOpt = vehicleOptions.find((o) => o.value === vehiculoId);
    const matchedVeh = vehicles.find((v) => v.id === vehiculoId || v.alias === vehiculoId);
    const unidadCode = matchedVeh?.alias || (selectedOpt ? selectedOpt.value : vehiculoId);
    const unidadLabel = matchedVeh ? formatUnitLabel(matchedVeh) : (selectedOpt ? selectedOpt.label : vehiculoId);

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingMaint?.id,
        vehiculoId: matchedVeh?.id || vehiculoId,
        unidad: unidadCode,
        unidadLabel,
        tipoMantenimiento: finalTipo,
        fecha: fecha || new Date().toISOString().split('T')[0],
        kilometrajeActual: kmActualNum,
        proximoKilometraje: proximoKmNum,
        intervaloMantenimiento: intervaloMantenimiento || (proximoKmNum - kmActualNum),
        kilometrajeAlerta: kilometrajeAlerta || 1000,
        tallerProveedor: tallerProveedor.trim(),
        costo: costo ? parseFloat(costo) : 0,
        observaciones: observaciones.trim(),
        archivos,
        responsable: responsable.trim() || currentUser.name || currentUser.username || 'Usuario',
        createdBy: editingMaint?.createdBy || currentUser.name || currentUser.username || 'Usuario'
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving vehicle maintenance:', err);
      setErrorMsg(err.message || 'No se pudo guardar el registro de mantenimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingMaint ? 'Editar Registro de Mantenimiento' : 'Registrar Mantenimiento Vehicular'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
            <FiAlertCircle className="shrink-0 text-base" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Unidad Vehicular */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Unidad Vehicular <span className="text-red-500">*</span>
            </label>
            <Select
              options={vehicleOptions}
              value={vehiculoId}
              onChange={(val) => setVehiculoId(val)}
              placeholder="Seleccionar unidad..."
              className="w-full"
            />
          </div>

          {/* Tipo de Mantenimiento */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Tipo de Mantenimiento <span className="text-red-500">*</span>
            </label>
            <Select
              options={PRESET_MAINT_TYPES.map((t) => ({ value: t, label: t }))}
              value={tipoPreset}
              onChange={(val) => setTipoPreset(val)}
              className="w-full"
            />
          </div>
        </div>

        {tipoPreset === 'Otro (Especifique)' && (
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Nombre Personalizado de Mantenimiento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customTipo}
              onChange={(e) => setCustomTipo(e.target.value)}
              placeholder="Ej: Cambio de faja de distribución, Rectificación de discos..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fecha del Servicio */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Fecha del Trabajo <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Kilometraje Actual */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Kilometraje Actual <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={kilometrajeActual}
              onChange={(e) => handleKmChange(e.target.value)}
              placeholder="Ej: 125000"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Intervalo Recomendado */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Intervalo (Km)
            </label>
            <input
              type="number"
              min="500"
              step="500"
              value={intervaloMantenimiento}
              onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 10000)}
              placeholder="10000"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Próximo Kilometraje */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Próximo Mantenimiento (Km) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={proximoKilometraje}
              onChange={(e) => setProximoKilometraje(e.target.value)}
              placeholder="Ej: 135000"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Margen Alerta (Km) */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Alerta Faltando (Km)
            </label>
            <input
              type="number"
              min="100"
              step="100"
              value={kilometrajeAlerta}
              onChange={(e) => setKilometrajeAlerta(parseInt(e.target.value) || 1000)}
              placeholder="1000"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Costo */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Costo Registrado (₡)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Taller / Proveedor */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Taller / Proveedor / Servicio
            </label>
            <input
              type="text"
              value={tallerProveedor}
              onChange={(e) => setTallerProveedor(e.target.value)}
              placeholder="Ej: Taller Central, Carrión, Autorepuestos X..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Responsable / Mecánico */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Usuario Responsable
            </label>
            <input
              type="text"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Nombre del responsable..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-black uppercase text-slate-600 mb-1">
            Observaciones y Repuestos Utilizados
          </label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Filtro de aceite 15W40, pastillas delanteras, observaciones del mecánico..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Comprobantes / Fotos odómetro / Facturas */}
        <div>
          <label className="block text-xs font-black uppercase text-slate-600 mb-1">
            Fotografías de Odómetro, Facturas o Trabajos
          </label>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 bg-slate-50 text-center hover:bg-slate-100 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="maint-file-upload"
            />
            <label htmlFor="maint-file-upload" className="cursor-pointer flex flex-col items-center gap-1">
              <FiPaperclip className="text-xl text-blue-600" />
              <span className="text-xs font-bold text-slate-700">Adjuntar foto de odómetro, factura o comprobante</span>
              <span className="text-[10px] text-slate-400">Haga clic o arrastre archivos aquí (Máx. 8MB)</span>
            </label>
          </div>

          {archivos.length > 0 && (
            <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
              {archivos.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <FiSettings className="text-blue-500 shrink-0" />
                    <span className="truncate font-medium text-slate-700">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-200 w-full">
          <ActionButton
            variant="secondary"
            label="CANCELAR"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold uppercase"
          />
          <ActionButton
            variant="primary"
            label={isSubmitting ? 'GUARDANDO...' : 'GUARDAR'}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold uppercase"
          />
        </div>
      </form>
    </Modal>
  );
};
