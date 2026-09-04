import React, { useState, useMemo, useEffect } from 'react';
import { ActionButton, Select } from '../../../../design-system';
import { FiX, FiCheck, FiArrowRight, FiSearch, FiTruck, FiAlertCircle } from 'react-icons/fi';
import { mockVehicles } from '../mockData';
import { VehicleWarehouseItem } from '../../../../types/vehicleWarehouse.types';

interface Props {
  show: boolean;
  onClose: () => void;
  originVehicle?: typeof mockVehicles[0];
  originItems: VehicleWarehouseItem[];
  allVehicles?: typeof mockVehicles;
  allItems?: VehicleWarehouseItem[];
  onTransfer: (data: {
    originVehicleId: string;
    targetVehicleId: string;
    inventoryItemId: string;
    quantity: number;
  }) => void;
}

export const TransferToVehicleModal: React.FC<Props> = ({
  show,
  onClose,
  originVehicle,
  originItems,
  allVehicles = mockVehicles,
  allItems = [],
  onTransfer
}) => {
  // Available destination vehicles (excluding origin vehicle and inherently excluding U3/U7)
  const destinationVehicles = useMemo(() => {
    return allVehicles.filter(v => v.id !== originVehicle?.id);
  }, [allVehicles, originVehicle?.id]);

  const [targetVehicleId, setTargetVehicleId] = useState<string>('');
  const [searchMaterial, setSearchMaterial] = useState<string>('');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Transferable materials: ONLY items existing in the origin vehicle with availableStock > 0
  const transferableMaterials = useMemo(() => {
    return originItems.filter(item => {
      const availableToTransfer = item.physicalStock - item.committedStock;
      return availableToTransfer > 0;
    });
  }, [originItems]);

  // Filtered materials based on search query
  const filteredMaterials = useMemo(() => {
    if (!searchMaterial.trim()) return transferableMaterials;
    const q = searchMaterial.toLowerCase();
    return transferableMaterials.filter(
      item =>
        item.code.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [transferableMaterials, searchMaterial]);

  // Selected item object
  const selectedItem = useMemo(() => {
    return transferableMaterials.find(i => i.inventoryItemId === selectedInventoryItemId);
  }, [transferableMaterials, selectedInventoryItemId]);

  // Max transferable for the selected item
  const maxTransferable = selectedItem
    ? Math.max(0, selectedItem.physicalStock - selectedItem.committedStock)
    : 0;

  // Selected target vehicle object
  const targetVehicle = useMemo(() => {
    return destinationVehicles.find(v => v.id === targetVehicleId);
  }, [destinationVehicles, targetVehicleId]);

  // Target vehicle's current stock for the selected material (if any)
  const targetExistingItem = useMemo(() => {
    if (!targetVehicleId || !selectedInventoryItemId) return null;
    return allItems.find(
      i => i.vehiculoId === targetVehicleId && i.inventoryItemId === selectedInventoryItemId
    );
  }, [allItems, targetVehicleId, selectedInventoryItemId]);

  // Initialize or reset states on open/close
  useEffect(() => {
    if (show) {
      if (destinationVehicles.length > 0) {
        setTargetVehicleId(destinationVehicles[0].id);
      } else {
        setTargetVehicleId('');
      }

      if (transferableMaterials.length > 0) {
        setSelectedInventoryItemId(transferableMaterials[0].inventoryItemId);
      } else {
        setSelectedInventoryItemId('');
      }

      setSearchMaterial('');
      setQty('');
      setError('');
    }
  }, [show, originVehicle?.id, destinationVehicles, transferableMaterials]);

  if (!show) return null;

  const parsedQty = parseFloat(qty) || 0;

  const handleTransfer = () => {
    setError('');

    // Transactional-style validation before submission
    if (!originVehicle) {
      setError('No se ha detectado el vehículo de origen.');
      return;
    }

    if (!targetVehicleId || targetVehicleId === originVehicle.id) {
      setError('Seleccione un vehículo de destino válido y distinto del origen.');
      return;
    }

    if (!selectedItem) {
      setError('Seleccione un material válido con stock disponible para transferencia.');
      return;
    }

    if (!qty || isNaN(parsedQty) || parsedQty <= 0) {
      setError('Ingrese una cantidad válida mayor a 0.');
      return;
    }

    // Safety constraint: transfer quantity cannot exceed physical - committed
    const currentTransferable = selectedItem.physicalStock - selectedItem.committedStock;
    if (parsedQty > currentTransferable) {
      setError(`La cantidad a transferir (${parsedQty}) supera el disponible transferible (${currentTransferable} ${selectedItem.unit}).`);
      return;
    }

    if (selectedItem.physicalStock - parsedQty < 0) {
      setError('La transferencia generaría un inventario físico negativo en el vehículo de origen.');
      return;
    }

    // Execute transfer
    onTransfer({
      originVehicleId: originVehicle.id,
      targetVehicleId,
      inventoryItemId: selectedItem.inventoryItemId,
      quantity: parsedQty
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white md:rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/80">
          <div>
            <h2 className="text-lg font-black text-slate-800">Transferir entre Bodegas Vehiculares</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Traslado de material exclusivo: Bodega Vehicular Origen → Bodega Vehicular Destino
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Error Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5">
              <FiAlertCircle className="text-base text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Origen y Destino Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Origen (Fijo) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Bodega Origen (Actual)
              </span>
              <div className="flex items-center gap-2">
                <FiTruck className="text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm text-slate-800">{originVehicle?.alias}</p>
                  <p className="text-[11px] text-slate-500 font-mono">Placa: {originVehicle?.placa}</p>
                </div>
              </div>
            </div>

            {/* Destino (Desplegable) */}
            <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl">
              <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                Bodega Destino
              </label>
              <Select
                options={destinationVehicles.map(v => ({
                  value: v.id,
                  label: v.displayName || v.alias
                }))}
                value={targetVehicleId}
                onChange={(val) => {
                  setTargetVehicleId(val);
                  setError('');
                }}
                placeholder="Buscar vehículo..."
              />
            </div>
          </div>

          {/* Sección Selección de Material */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="material-search-input" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Material a Transferir
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {transferableMaterials.length} disponible{transferableMaterials.length === 1 ? '' : 's'} en {originVehicle?.alias}
              </span>
            </div>

            {transferableMaterials.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs text-center font-medium">
                No hay materiales con stock disponible para transferir en la bodega de <strong>{originVehicle?.alias}</strong>.
                Todos los materiales tienen existencia física 0 o se encuentran 100% comprometidos en solicitudes abiertas.
              </div>
            ) : (
              <>
                {/* Search input for materials */}
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                  <input
                    id="material-search-input"
                    type="text"
                    value={searchMaterial}
                    onChange={(e) => setSearchMaterial(e.target.value)}
                    placeholder="Filtrar por nombre, código o categoría..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {searchMaterial && (
                    <button
                      onClick={() => setSearchMaterial('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
                    >
                      <FiX />
                    </button>
                  )}
                </div>

                {/* Material Dropdown / Selector */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-1.5 bg-slate-50/40">
                  {filteredMaterials.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No se encontraron materiales que coincidan con la búsqueda.
                    </p>
                  ) : (
                    filteredMaterials.map(item => {
                      const isSelected = item.inventoryItemId === selectedInventoryItemId;
                      const itemTransferable = item.physicalStock - item.committedStock;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedInventoryItemId(item.inventoryItemId);
                            setQty('');
                            setError('');
                          }}
                          className={`p-2.5 rounded-lg cursor-pointer transition-all border text-xs flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-blue-50 border-blue-300 shadow-sm'
                              : 'bg-white border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 truncate">{item.description}</p>
                            <p className="text-[10px] font-mono text-slate-500">
                              {item.code} • {item.category}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[11px]">
                              Disp: {itemTransferable} {item.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Desglose del Stock y Regla de Compromiso */}
          {selectedItem && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-700">Disponibilidad en {originVehicle?.alias}:</span>
                <span className="text-[11px] font-mono text-slate-500">{selectedItem.code}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <p className="text-[9px] uppercase font-bold text-slate-500">Físico Total</p>
                  <p className="text-sm font-black text-slate-800">
                    {selectedItem.physicalStock} <span className="text-[10px] font-normal">{selectedItem.unit}</span>
                  </p>
                </div>

                <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <p className="text-[9px] uppercase font-bold text-amber-700">Comprometido</p>
                  <p className="text-sm font-black text-amber-600">
                    {selectedItem.committedStock} <span className="text-[10px] font-normal">{selectedItem.unit}</span>
                  </p>
                </div>

                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <p className="text-[9px] uppercase font-bold text-emerald-700">Para Transferir</p>
                  <p className="text-sm font-black text-emerald-600">
                    {maxTransferable} <span className="text-[10px] font-normal">{selectedItem.unit}</span>
                  </p>
                </div>
              </div>

              {selectedItem.committedStock > 0 && (
                <p className="text-[11px] text-amber-800 bg-amber-100/60 px-2.5 py-1.5 rounded-lg leading-tight">
                  ℹ️ Los <strong>{selectedItem.committedStock} {selectedItem.unit}</strong> comprometidos en solicitudes abiertas de este vehículo permanecen intactos y no pueden transferirse.
                </p>
              )}
            </div>
          )}

          {/* Cantidad a Transferir */}
          {selectedItem && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="transfer-quantity-input" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Cantidad a Transferir ({selectedItem.unit})
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQty(maxTransferable.toString());
                    setError('');
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                >
                  Transferir Máximo ({maxTransferable})
                </button>
              </div>

              <div className="relative">
                <input
                  id="transfer-quantity-input"
                  type="number"
                  min="0.1"
                  max={maxTransferable}
                  step="any"
                  value={qty}
                  onChange={(e) => {
                    setQty(e.target.value);
                    setError('');
                  }}
                  placeholder="0"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xl font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center"
                />
              </div>

              {parsedQty > maxTransferable && (
                <p className="text-xs font-semibold text-rose-600 mt-1">
                  La cantidad ingresada excede el máximo transferible ({maxTransferable} {selectedItem.unit}).
                </p>
              )}
            </div>
          )}

          {/* Resumen Visual de la Operación */}
          {selectedItem && targetVehicle && parsedQty > 0 && parsedQty <= maxTransferable && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-center">
                Previsualización del Balance
              </span>

              <div className="flex items-center justify-between gap-2 text-center">
                {/* Origen */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex-1">
                  <p className="text-[10px] font-bold text-slate-600">{originVehicle?.alias}</p>
                  <p className="text-xs font-mono text-slate-400">
                    {selectedItem.physicalStock} → <strong className="text-slate-800">{selectedItem.physicalStock - parsedQty}</strong>
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    Disp: {maxTransferable - parsedQty} {selectedItem.unit}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center px-1">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {parsedQty} {selectedItem.unit}
                  </span>
                  <FiArrowRight className="text-slate-400 text-lg mt-1" />
                </div>

                {/* Destino */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex-1">
                  <p className="text-[10px] font-bold text-slate-600">{targetVehicle?.alias}</p>
                  <p className="text-xs font-mono text-slate-400">
                    {targetExistingItem ? targetExistingItem.physicalStock : 0} →{' '}
                    <strong className="text-emerald-700">
                      {(targetExistingItem ? targetExistingItem.physicalStock : 0) + parsedQty}
                    </strong>
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    + {parsedQty} {selectedItem.unit}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-col md:flex-row justify-end gap-2.5">
          <ActionButton
            label="Cancelar"
            variant="secondary"
            onClick={onClose}
            className="w-full md:w-auto justify-center order-2 md:order-1"
          />
          <ActionButton
            label="Confirmar Traslado"
            icon={<FiCheck />}
            variant="primary"
            onClick={handleTransfer}
            disabled={
              !selectedItem ||
              !targetVehicleId ||
              transferableMaterials.length === 0 ||
              parsedQty <= 0 ||
              parsedQty > maxTransferable
            }
            className="w-full md:w-auto justify-center order-1 md:order-2"
          />
        </div>
      </div>
    </div>
  );
};
