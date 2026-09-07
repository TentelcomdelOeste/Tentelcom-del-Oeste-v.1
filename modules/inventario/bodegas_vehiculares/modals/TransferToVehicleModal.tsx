import React, { useState, useMemo, useEffect } from 'react';
import { ActionButton, IconButton } from '../../../../design-system';
import { 
  FiX, 
  FiCheck, 
  FiSearch, 
  FiTruck, 
  FiAlertCircle, 
  FiPlus, 
  FiTrash2, 
  FiBox, 
  FiArrowRight, 
  FiList,
  FiRefreshCw
} from 'react-icons/fi';
import { VehicleWarehouseItem } from '../../../../types/vehicleWarehouse.types';
import { vehicleWarehouseService, getVehicleCatalog } from '../services/vehicleWarehouseService';

export interface SelectedTransferItem {
  inventoryItemId: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  physicalStock: number;
  committedStock: number;
  availableToTransfer: number;
  quantity: number;
}

interface Props {
  show: boolean;
  onClose: () => void;
  defaultOriginVehicleId?: string;
  allVehicles?: any[];
  allItems?: VehicleWarehouseItem[];
  currentUser?: { id: string; name?: string; email?: string } | null;
  onConfirmTransfer?: (data: {
    originVehicleId: string;
    targetVehicleId: string;
    items: { inventoryItemId: string; quantity: number }[];
  }) => Promise<void>;
  // Legacy / fallback props
  item?: VehicleWarehouseItem | null;
  originVehicle?: any;
  originItems?: VehicleWarehouseItem[];
  onTransfer?: (data: any) => Promise<void>;
  onConfirm?: (targetVehicleId: string, quantity: number) => Promise<void>;
}

export const TransferToVehicleModal: React.FC<Props> = ({
  show,
  onClose,
  defaultOriginVehicleId,
  allVehicles: externalVehicles,
  allItems = [],
  currentUser,
  onConfirmTransfer,
  originVehicle: legacyOriginVehicle,
  onTransfer,
  onConfirm
}) => {
  const catalogVehicles = useMemo(() => {
    if (externalVehicles && externalVehicles.length > 0) {
      return externalVehicles;
    }
    return getVehicleCatalog();
  }, [externalVehicles]);

  const initialOriginId = defaultOriginVehicleId || legacyOriginVehicle?.id || (catalogVehicles.length > 0 ? catalogVehicles[0].id : '');

  const [originVehicleId, setOriginVehicleId] = useState<string>(initialOriginId);
  const [targetVehicleId, setTargetVehicleId] = useState<string>('');
  const [searchMaterial, setSearchMaterial] = useState<string>('');
  const [showAllAvailable, setShowAllAvailable] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<SelectedTransferItem[]>([]);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Destination vehicle options (exclude origin vehicle)
  const destinationVehicles = useMemo(() => {
    return catalogVehicles.filter(v => v.id !== originVehicleId);
  }, [catalogVehicles, originVehicleId]);

  // Origin vehicle object
  const originVehicle = useMemo(() => {
    return catalogVehicles.find(v => v.id === originVehicleId);
  }, [catalogVehicles, originVehicleId]);

  // Target vehicle object
  const targetVehicle = useMemo(() => {
    return catalogVehicles.find(v => v.id === targetVehicleId);
  }, [catalogVehicles, targetVehicleId]);

  // Items currently in origin vehicle
  const originWarehouseItems = useMemo(() => {
    return allItems.filter(item => item.vehiculoId === originVehicleId);
  }, [allItems, originVehicleId]);

  // Transferable materials in origin (physicalStock - committedStock > 0)
  const transferableMaterials = useMemo(() => {
    return originWarehouseItems.filter(item => {
      const realAvailable = item.physicalStock - item.committedStock;
      return realAvailable > 0;
    });
  }, [originWarehouseItems]);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchMaterial.trim() && !showAllAvailable) return [];
    
    let result = transferableMaterials;
    if (searchMaterial.trim()) {
      const q = searchMaterial.toLowerCase().trim();
      result = result.filter(item =>
        item.code.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [transferableMaterials, searchMaterial, showAllAvailable]);

  // Reset or initialize state when modal opens
  useEffect(() => {
    if (show) {
      const originId = defaultOriginVehicleId || legacyOriginVehicle?.id || (catalogVehicles.length > 0 ? catalogVehicles[0].id : '');
      setOriginVehicleId(originId);

      const dests = catalogVehicles.filter(v => v.id !== originId);
      setTargetVehicleId(dests.length > 0 ? dests[0].id : '');

      setSearchMaterial('');
      setShowAllAvailable(false);
      setSelectedItems([]);
      setError('');
      setIsSubmitting(false);
    }
  }, [show, defaultOriginVehicleId, legacyOriginVehicle?.id, catalogVehicles]);

  // Handle origin vehicle change
  const handleOriginChange = (newOriginId: string) => {
    setOriginVehicleId(newOriginId);
    setError('');

    // Update target if it matches new origin
    const newDests = catalogVehicles.filter(v => v.id !== newOriginId);
    if (targetVehicleId === newOriginId || !newDests.some(v => v.id === targetVehicleId)) {
      setTargetVehicleId(newDests.length > 0 ? newDests[0].id : '');
    }

    // Recalculate stock for items already added in list according to new origin
    const newOriginItems = allItems.filter(i => i.vehiculoId === newOriginId);
    const updatedSelected: SelectedTransferItem[] = [];

    selectedItems.forEach(st => {
      const currentInNewOrigin = newOriginItems.find(i => i.inventoryItemId === st.inventoryItemId);
      if (currentInNewOrigin) {
        const availableToTransfer = Math.max(0, currentInNewOrigin.physicalStock - currentInNewOrigin.committedStock);
        if (availableToTransfer > 0) {
          updatedSelected.push({
            ...st,
            physicalStock: currentInNewOrigin.physicalStock,
            committedStock: currentInNewOrigin.committedStock,
            availableToTransfer,
            quantity: Math.min(st.quantity, availableToTransfer)
          });
        }
      }
    });

    setSelectedItems(updatedSelected);
    setSearchMaterial('');
    setShowAllAvailable(false);
  };

  // Add material to transfer list (or update if already exists)
  const handleAddMaterial = (item: VehicleWarehouseItem, addQty = 1) => {
    setError('');
    const availableToTransfer = item.physicalStock - item.committedStock;
    if (availableToTransfer <= 0) return;

    setSelectedItems(prev => {
      const existingIndex = prev.findIndex(i => i.inventoryItemId === item.inventoryItemId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = Math.min(availableToTransfer, existing.quantity + addQty);
        updated[existingIndex] = {
          ...existing,
          physicalStock: item.physicalStock,
          committedStock: item.committedStock,
          availableToTransfer,
          quantity: newQty
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            inventoryItemId: item.inventoryItemId,
            code: item.code,
            description: item.description,
            category: item.category,
            unit: item.unit,
            physicalStock: item.physicalStock,
            committedStock: item.committedStock,
            availableToTransfer,
            quantity: Math.min(availableToTransfer, Math.max(1, addQty))
          }
        ];
      }
    });
  };

  // Modify quantity of an added item
  const handleUpdateQuantity = (inventoryItemId: string, newQty: number) => {
    setError('');
    setSelectedItems(prev =>
      prev.map(item => {
        if (item.inventoryItemId === inventoryItemId) {
          const validQty = isNaN(newQty) ? 0 : Math.max(0, newQty);
          return { ...item, quantity: validQty };
        }
        return item;
      })
    );
  };

  // Remove material from list
  const handleRemoveItem = (inventoryItemId: string) => {
    setError('');
    setSelectedItems(prev => prev.filter(i => i.inventoryItemId !== inventoryItemId));
  };

  // Total summary statistics
  const totalItemsCount = selectedItems.length;
  const totalUnitsCount = selectedItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);

  // Submit transfer
  const handleConfirm = async () => {
    setError('');

    if (!originVehicleId) {
      setError('Seleccione la bodega de origen.');
      return;
    }

    if (!targetVehicleId) {
      setError('Seleccione la bodega de destino.');
      return;
    }

    if (originVehicleId === targetVehicleId) {
      setError('La bodega de origen y destino no pueden ser la misma.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Debe seleccionar al menos un material para transferir.');
      return;
    }

    const invalidItems = selectedItems.filter(i => i.quantity <= 0 || isNaN(i.quantity));
    if (invalidItems.length > 0) {
      setError('Todas las cantidades a transferir deben ser mayores a 0.');
      return;
    }

    const exceedItems = selectedItems.filter(i => i.quantity > i.availableToTransfer);
    if (exceedItems.length > 0) {
      const item = exceedItems[0];
      setError(`La cantidad de "${item.description}" (${item.quantity}) supera la disponibilidad real (${item.availableToTransfer} ${item.unit}).`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        originVehicleId,
        targetVehicleId,
        items: selectedItems.map(i => ({
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantity
        }))
      };

      if (onConfirmTransfer) {
        await onConfirmTransfer(payload);
      } else if (onConfirm) {
        // Fallback for legacy single item
        await onConfirm(targetVehicleId, selectedItems[0]?.quantity || 1);
      } else {
        await vehicleWarehouseService.transferMultipleItems(
          originVehicleId,
          targetVehicleId,
          payload.items,
          currentUser
        );
      }

      onClose();
    } catch (err: any) {
      console.error('Error al ejecutar transferencia múltiple:', err);
      setError(err?.message || 'Ocurrió un error al procesar la transferencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FiBox className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Transferir Materiales entre Bodegas</h2>
              <p className="text-xs text-slate-500 font-medium">
                Sistemas de transferencia múltiple para bodegas vehiculares.
              </p>
            </div>
          </div>
          <IconButton
            icon={<FiX className="w-5 h-5" />}
            onClick={onClose}
            label="Cerrar ventana"
            size="sm"
            variant="ghost"
          />
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Error Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5">
              <FiAlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Origen y Destino Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bodega Origen */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <FiTruck className="text-slate-400" />
                  Bodega Origen
                </label>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {transferableMaterials.length} disponibles
                </span>
              </div>
              <select
                value={originVehicleId}
                onChange={(e) => handleOriginChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {catalogVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.alias} ({v.placa})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                Lugar donde se restará el inventario transferido.
              </p>
            </div>

            {/* Bodega Destino */}
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-200/70 rounded-xl space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiArrowRight className="text-indigo-500" />
                  Bodega Destino
                </label>
                <span className="text-[10px] font-bold text-indigo-700">Obligatorio</span>
              </div>
              <select
                value={targetVehicleId}
                onChange={(e) => {
                  setTargetVehicleId(e.target.value);
                  setError('');
                }}
                className="w-full p-2.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="" disabled>-- Seleccionar Vehículo Destino --</option>
                {destinationVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.alias} ({v.placa})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-indigo-600/80">
                Lugar donde se sumará el inventario transferido.
              </p>
            </div>
          </div>

          {/* Seccion 3: Buscador de Materiales */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FiSearch className="text-slate-400" />
                Buscar Material a Transferir
              </label>
              <button
                type="button"
                onClick={() => setShowAllAvailable(!showAllAvailable)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <FiList />
                {showAllAvailable ? 'Ocultar catálogo disponible' : `Ver todo el catálogo (${transferableMaterials.length})`}
              </button>
            </div>

            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar material por nombre, código o categoría..."
                value={searchMaterial}
                onChange={(e) => setSearchMaterial(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              {searchMaterial && (
                <button
                  onClick={() => setSearchMaterial('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Lista de Resultados de Búsqueda */}
            {(searchMaterial.trim() || showAllAvailable) && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-56 overflow-y-auto space-y-2">
                {searchResults.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 font-medium">
                    No se encontraron materiales con disponible real para transferir en la bodega origen ({originVehicle?.alias}).
                  </p>
                ) : (
                  searchResults.map(item => {
                    const availableToTransfer = item.physicalStock - item.committedStock;
                    const isAlreadySelected = selectedItems.some(s => s.inventoryItemId === item.inventoryItemId);

                    return (
                      <div
                        key={item.id || item.inventoryItemId}
                        className={`p-3 bg-white border rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-all ${
                          isAlreadySelected ? 'border-blue-300 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.code}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{item.description}</span>
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {item.category}
                            </span>
                          </div>

                          {/* Stocks Breakdown */}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700">
                              Físico total: <strong className="text-slate-900">{item.physicalStock} {item.unit}</strong>
                            </span>
                            <span className="text-orange-600 font-semibold">
                              Comprometido: <strong>{item.committedStock} {item.unit}</strong>
                            </span>
                            <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Para transferir: {availableToTransfer} {item.unit}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <ActionButton
                            label={isAlreadySelected ? "Actualizar (+1)" : "Agregar"}
                            icon={<FiPlus className="w-3.5 h-3.5" />}
                            variant={isAlreadySelected ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handleAddMaterial(item, 1)}
                            disabled={availableToTransfer <= 0}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Sección 6: Lista de Materiales Seleccionados */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FiBox className="text-blue-600" />
                Materiales Seleccionados para la Transferencia ({selectedItems.length})
              </h3>
              {selectedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedItems([])}
                  className="text-[11px] text-rose-600 font-bold hover:underline"
                >
                  Vaciar lista
                </button>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <div className="py-8 px-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                <FiBox className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-500">No hay materiales agregados a esta operación.</p>
                <p className="text-[11px] text-slate-400">
                  Busque materiales arriba por código o nombre para agregarlos a la transferencia múltiple.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedItems.map((st, index) => {
                  const isExceed = st.quantity > st.availableToTransfer;
                  const isInvalid = st.quantity <= 0 || isNaN(st.quantity);

                  return (
                    <div
                      key={st.inventoryItemId}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3 ${
                        isExceed || isInvalid
                          ? 'bg-rose-50/50 border-rose-300'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">#{index + 1}</span>
                          <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {st.code}
                          </span>
                          <span className="text-xs font-black text-slate-800">{st.description}</span>
                          <span className="text-[10px] text-slate-400">({st.category})</span>
                        </div>

                        {/* Breakdown */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px]">
                          <span className="text-slate-500">
                            Físico: <strong>{st.physicalStock} {st.unit}</strong>
                          </span>
                          <span className="text-orange-600">
                            Comprometido: <strong>{st.committedStock} {st.unit}</strong>
                          </span>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Disponible real: {st.availableToTransfer} {st.unit}
                          </span>
                        </div>
                      </div>

                      {/* Input de Cantidad & Eliminar */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="flex flex-col items-end">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                            Cant. a Transferir
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max={st.availableToTransfer}
                              value={st.quantity === 0 ? '' : st.quantity}
                              onChange={(e) => handleUpdateQuantity(st.inventoryItemId, parseFloat(e.target.value))}
                              className={`w-24 p-1.5 text-center text-xs font-black border rounded-lg outline-none focus:ring-2 ${
                                isExceed || isInvalid
                                  ? 'border-rose-400 text-rose-700 bg-rose-50 focus:ring-rose-400'
                                  : 'border-slate-300 text-slate-900 bg-white focus:ring-blue-500'
                              }`}
                            />
                            <span className="text-xs font-bold text-slate-500">{st.unit}</span>
                          </div>
                          {isExceed && (
                            <span className="text-[10px] font-bold text-rose-600 mt-0.5">
                              Máx. {st.availableToTransfer} {st.unit}
                            </span>
                          )}
                          {isInvalid && (
                            <span className="text-[10px] font-bold text-rose-600 mt-0.5">
                              Ingrese {'>'} 0
                            </span>
                          )}
                        </div>

                        <IconButton
                          icon={<FiTrash2 className="w-4 h-4 text-rose-500" />}
                          onClick={() => handleRemoveItem(st.inventoryItemId)}
                          label="Eliminar material"
                          size="sm"
                          variant="ghost"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sección 9: Resumen de Confirmación */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Resumen de Operación
              </span>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-blue-300">{originVehicle?.alias || 'Origen'}</span>
                <FiArrowRight className="text-slate-500 text-xs" />
                <span className="text-indigo-300">{targetVehicle?.alias || 'Seleccione destino'}</span>
              </div>
              <div className="text-xs text-slate-300 font-medium">
                <strong>{totalItemsCount}</strong> {totalItemsCount === 1 ? 'material' : 'materiales'} | <strong>{totalUnitsCount}</strong> {totalUnitsCount === 1 ? 'unidad total' : 'unidades totales'}
              </div>
            </div>

            <ActionButton
              label={isSubmitting ? "Transfiriendo..." : "CONFIRMAR TRANSFERENCIA"}
              icon={isSubmitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
              variant="primary"
              size="md"
              disabled={isSubmitting || selectedItems.length === 0 || !targetVehicleId || originVehicleId === targetVehicleId}
              onClick={handleConfirm}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
