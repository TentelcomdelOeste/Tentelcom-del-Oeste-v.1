import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../../utils/types';
import { Modal, ActionButton, Select } from '../../../design-system';
import { Vehicle, VehicleDocument, VehicleAttachment } from '../../../types/vehicle.types';
import { formatUnitLabel } from '../controlVehicularService';
import { VEHICLES } from '../../job_scheduling/JobForm';
import { FiFileText, FiPaperclip, FiTrash2, FiAlertCircle } from 'react-icons/fi';

interface VehicleDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (docData: Partial<VehicleDocument>) => Promise<void>;
  editingDoc?: VehicleDocument | null;
  vehicles: Vehicle[];
  defaultVehiculoId?: string;
  currentUser: User;
}

const PRESET_DOC_TYPES = [
  'DEKRA',
  'Marchamo',
  'Permiso de pesos y dimensiones',
  'Seguro / Póliza',
  'Título de propiedad',
  'Revisión técnica',
  'Permisos especiales',
  'Otro (Especifique)'
];

export const VehicleDocumentModal: React.FC<VehicleDocumentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDoc,
  vehicles,
  defaultVehiculoId,
  currentUser
}) => {
  const [vehiculoId, setVehiculoId] = useState<string>('');
  const [tipoPreset, setTipoPreset] = useState<string>('DEKRA');
  const [customTipo, setCustomTipo] = useState<string>('');
  const [fechaEmision, setFechaEmision] = useState<string>('');
  const [fechaVencimiento, setFechaVencimiento] = useState<string>('');
  const [numeroReferencia, setNumeroReferencia] = useState<string>('');
  const [costo, setCosto] = useState<string>('');
  const [diasAlerta, setDiasAlerta] = useState<number>(30);
  const [observaciones, setObservaciones] = useState<string>('');
  const [archivos, setArchivos] = useState<VehicleAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);

      if (editingDoc) {
        setVehiculoId(editingDoc.vehiculoId || editingDoc.unidad || '');
        if (PRESET_DOC_TYPES.includes(editingDoc.tipoDocumento)) {
          setTipoPreset(editingDoc.tipoDocumento);
          setCustomTipo('');
        } else {
          setTipoPreset('Otro (Especifique)');
          setCustomTipo(editingDoc.tipoDocumento);
        }
        setFechaEmision(editingDoc.fechaEmision || '');
        setFechaVencimiento(editingDoc.fechaVencimiento || '');
        setNumeroReferencia(editingDoc.numeroReferencia || '');
        setCosto(editingDoc.costo ? String(editingDoc.costo) : '');
        setDiasAlerta(editingDoc.diasAnticipacionAlerta ?? 30);
        setObservaciones(editingDoc.observaciones || '');
        setArchivos(editingDoc.archivos || []);
      } else {
        const initialVeh = defaultVehiculoId || (vehicles[0]?.id || '');
        setVehiculoId(initialVeh);
        setTipoPreset('DEKRA');
        setCustomTipo('');
        const todayStr = new Date().toISOString().split('T')[0];
        setFechaEmision(todayStr);
        setFechaVencimiento('');
        setNumeroReferencia('');
        setCosto('');
        setDiasAlerta(30);
        setObservaciones('');
        setArchivos([]);
      }
    }
  }, [isOpen, editingDoc, defaultVehiculoId, vehicles]);

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
      setErrorMsg('Debe especificar el tipo de documento.');
      return;
    }

    if (!fechaVencimiento) {
      setErrorMsg('Debe indicar la fecha de vencimiento.');
      return;
    }

    const selectedOpt = vehicleOptions.find((o) => o.value === vehiculoId);
    const matchedVeh = vehicles.find((v) => v.id === vehiculoId || v.alias === vehiculoId);
    const unidadCode = matchedVeh?.alias || (selectedOpt ? selectedOpt.value : vehiculoId);
    const unidadLabel = matchedVeh ? formatUnitLabel(matchedVeh) : (selectedOpt ? selectedOpt.label : vehiculoId);

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingDoc?.id,
        vehiculoId: matchedVeh?.id || vehiculoId,
        unidad: unidadCode,
        unidadLabel,
        tipoDocumento: finalTipo,
        fechaEmision: fechaEmision || new Date().toISOString().split('T')[0],
        fechaVencimiento,
        numeroReferencia: numeroReferencia.trim(),
        costo: costo ? parseFloat(costo) : 0,
        diasAnticipacionAlerta: diasAlerta || 30,
        observaciones: observaciones.trim(),
        archivos,
        createdBy: editingDoc?.createdBy || currentUser.name || currentUser.username || 'Usuario',
        createdById: editingDoc?.createdById || currentUser.uid
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving vehicle document:', err);
      setErrorMsg(err.message || 'No se pudo guardar el documento. Intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingDoc ? 'Editar Documento Vehicular' : 'Registrar Nuevo Documento Vehicular'}
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

          {/* Tipo de Documento */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Tipo de Documento <span className="text-red-500">*</span>
            </label>
            <Select
              options={PRESET_DOC_TYPES.map((t) => ({ value: t, label: t }))}
              value={tipoPreset}
              onChange={(val) => setTipoPreset(val)}
              className="w-full"
            />
          </div>
        </div>

        {tipoPreset === 'Otro (Especifique)' && (
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Nombre Personalizado del Documento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customTipo}
              onChange={(e) => setCustomTipo(e.target.value)}
              placeholder="Ej: Permiso Sanitario, Certificado especial..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fecha de Emisión */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Fecha de Emisión
            </label>
            <input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Fecha de Vencimiento */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Fecha Vencimiento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Alerta Anticipación Días */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Anticipación Alerta (Días)
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={diasAlerta}
              onChange={(e) => setDiasAlerta(parseInt(e.target.value) || 30)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Número / Referencia */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Número de Referencia / Póliza
            </label>
            <input
              type="text"
              value={numeroReferencia}
              onChange={(e) => setNumeroReferencia(e.target.value)}
              placeholder="Ej: POL-9948123 / D-2026-X"
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

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-black uppercase text-slate-600 mb-1">
            Observaciones Adicionales
          </label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Detalles del trámite, cobertura de seguro, entidad emisora..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Adjuntos / Fotos */}
        <div>
          <label className="block text-xs font-black uppercase text-slate-600 mb-1">
            Archivos / Fotografías / PDF
          </label>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 bg-slate-50 text-center hover:bg-slate-100 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="doc-file-upload"
            />
            <label htmlFor="doc-file-upload" className="cursor-pointer flex flex-col items-center gap-1">
              <FiPaperclip className="text-xl text-blue-600" />
              <span className="text-xs font-bold text-slate-700">Adjuntar imágenes o comprobante PDF</span>
              <span className="text-[10px] text-slate-400">Haga clic o arrastre archivos aquí (Máx. 8MB)</span>
            </label>
          </div>

          {archivos.length > 0 && (
            <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
              {archivos.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <FiFileText className="text-blue-500 shrink-0" />
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
