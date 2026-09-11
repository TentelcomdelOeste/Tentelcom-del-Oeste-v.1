import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../../../types';
import { useInventory } from '../../../../hooks/useInventory';
import { getVehicleCatalog, vehicleWarehouseService, isVehicleDeleteAuthorized } from '../services/vehicleWarehouseService';
import { ActionButton, IconButton, ACTION_ICONS, useConfirm, DataTable, TableColumn } from '../../../../design-system';
import { FiRefreshCw, FiSearch, FiX, FiBox, FiChevronRight, FiChevronLeft } from 'react-icons/fi';
import { VehicleWarehouseItem, VehicleMovement } from '../../../../types/vehicleWarehouse.types';
import { TransferToVehicleModal } from '../modals/TransferToVehicleModal';
import { VehicleInventoryDetailModal } from '../modals/VehicleInventoryDetailModal';
import { format } from 'date-fns';

interface Props {
  currentUser?: User | null;
  items?: VehicleWarehouseItem[];
  movements?: VehicleMovement[];
  setItems?: React.Dispatch<React.SetStateAction<VehicleWarehouseItem[]>>;
  onRegisterMovement?: (movement: VehicleMovement) => void;
  onTransfer?: (data: {
    originVehicleId: string;
    targetVehicleId: string;
    inventoryItemId: string;
    quantity: number;
  }) => void;
  onMultipleTransfer?: (data: {
    originVehicleId: string;
    targetVehicleId: string;
    items: { inventoryItemId: string; quantity: number }[];
  }) => Promise<void>;
  onDeleteInventoryItem?: (itemId: string) => Promise<void> | void;
  selectedVehicleId?: string;
  onSelectVehicleId?: (id: string) => void;
  activeTab?: 'inventory' | 'requests' | 'movements' | 'reports';
  onTabChange?: (tab: 'inventory' | 'requests' | 'movements' | 'reports') => void;
}

export const VehicleInventoryTab: React.FC<Props> = ({
  currentUser,
  items: externalItems,
  movements = [],
  onTransfer,
  onMultipleTransfer,
  onDeleteInventoryItem,
  selectedVehicleId: externalSelectedVehicleId,
  onSelectVehicleId,
  activeTab = 'inventory',
  onTabChange
}) => {
  const confirm = useConfirm();
  const canDelete = isVehicleDeleteAuthorized(currentUser);

  // Fetch general inventory items for visual mapping
  const { items: generalInventoryItems } = useInventory(currentUser || null, { fetchAll: true });

  const itemImagesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (Array.isArray(generalInventoryItems)) {
      generalInventoryItems.forEach(item => {
        if (item && item.id) {
          const imgs: string[] = item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0
            ? item.imageUrls.filter(Boolean)
            : (item.imageUrl ? [item.imageUrl] : []);
          if (imgs.length > 0) {
            map.set(item.id, imgs);
          }
        }
      });
    }
    return map;
  }, [generalInventoryItems]);

  const items = externalItems || [];
  const vehicles = getVehicleCatalog();
  const selectedVehicleId = externalSelectedVehicleId || (vehicles.length > 0 ? vehicles[0].id : '');

  const setSelectedVehicleId = onSelectVehicleId || (() => {});

  const [searchTerm, setSearchTerm] = useState('');
  const [detailItem, setDetailItem] = useState<VehicleWarehouseItem | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{
    images: string[];
    currentIndex: number;
    title: string;
    code: string;
  } | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [lastTap, setLastTap] = useState<{ id: string; time: number }>({ id: '', time: 0 });

  const handleImageDoubleClick = (item: VehicleWarehouseItem, images: string[], e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (images && images.length > 0) {
      setPreviewGallery({
        images,
        currentIndex: 0,
        title: item.description,
        code: item.code
      });
    }
  };

  const handleImageClick = (item: VehicleWarehouseItem, images: string[], e: React.MouseEvent | React.TouchEvent) => {
    if (!images || images.length === 0) return;
    const now = Date.now();
    if (lastTap.id === item.id && now - lastTap.time < 350) {
      e.stopPropagation();
      setPreviewGallery({
        images,
        currentIndex: 0,
        title: item.description,
        code: item.code
      });
      setLastTap({ id: '', time: 0 });
    } else {
      setLastTap({ id: item.id, time: now });
    }
  };

  const handlePrevImage = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    if (!previewGallery || previewGallery.images.length <= 1) return;
    setPreviewGallery(prev => {
      if (!prev) return null;
      const nextIdx = prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.images.length - 1;
      return { ...prev, currentIndex: nextIdx };
    });
  };

  const handleNextImage = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    if (!previewGallery || previewGallery.images.length <= 1) return;
    setPreviewGallery(prev => {
      if (!prev) return null;
      const nextIdx = prev.currentIndex < prev.images.length - 1 ? prev.currentIndex + 1 : 0;
      return { ...prev, currentIndex: nextIdx };
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !e.changedTouches || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    if (deltaX > 40) {
      handlePrevImage();
    } else if (deltaX < -40) {
      handleNextImage();
    }
    setTouchStartX(null);
  };
  
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  }, [selectedVehicleId, vehicles]);

  const handleDeleteItem = async (item: VehicleWarehouseItem) => {
    const confirmed = await confirm({
      title: '¿Eliminar del inventario vehicular?',
      description: `¿Está seguro de eliminar el registro de "${item.description}" (${item.code}) para la unidad ${selectedVehicle?.alias || 'seleccionada'}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (confirmed) {
      try {
        if (onDeleteInventoryItem) {
          await onDeleteInventoryItem(item.id);
        } else {
          await vehicleWarehouseService.deleteInventoryItem(item.id, currentUser);
        }
      } catch (err: any) {
        console.error('Error al eliminar ítem de inventario vehicular:', err);
        await confirm({
          title: 'Error al eliminar',
          description: err?.message || 'Ocurrió un error al eliminar el registro de inventario.',
          confirmLabel: 'Aceptar',
          variant: 'danger'
        });
      }
    }
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      if (item.vehiculoId !== selectedVehicleId) return false;

      const stock = Number(item.physicalStock) || 0;
      const committed = Number(item.committedStock) || 0;
      const available = item.availableStock !== undefined 
        ? (Number(item.availableStock) || 0) 
        : (stock - committed);

      // Mostrar card solo si al menos uno de los valores es mayor que cero
      return stock > 0 || committed > 0 || available > 0;
    });
    
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.code.toLowerCase().includes(lower) || 
        item.description.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower)
      );
    }
    
    return result;
  }, [items, selectedVehicleId, searchTerm]);

  // Modal state for multiple transfer
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Columnas para vista de escritorio estilo Cotizaciones
  const columns: TableColumn<VehicleWarehouseItem>[] = [
    {
      header: 'Código',
      align: 'center',
      width: '120px',
      render: (item) => (
        <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
          {item.code}
        </span>
      )
    },
    {
      header: 'Material / Descripción',
      className: 'flex-1 min-w-[200px]',
      render: (item) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0 text-slate-400">
            <FiBox className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 truncate">
            <div className="font-bold text-slate-900 text-xs truncate" title={item.description}>
              {item.description}
            </div>
            <span className="text-[10px] text-slate-400 font-medium truncate block">
              {item.category}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Categoría',
      width: '130px',
      render: (item) => (
        <span className="text-xs font-semibold text-slate-600 truncate block" title={item.category}>
          {item.category}
        </span>
      )
    },
    {
      header: 'Stock Físico',
      align: 'right',
      width: '110px',
      render: (item) => (
        <span className="font-black text-slate-800 text-xs whitespace-nowrap">
          {item.physicalStock} <span className="text-[10px] text-slate-400 font-normal">{item.unit || 'und'}</span>
        </span>
      )
    },
    {
      header: 'Comprometido',
      align: 'right',
      width: '115px',
      render: (item) => (
        <span className={`font-black text-xs whitespace-nowrap ${item.committedStock > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
          {item.committedStock}
        </span>
      )
    },
    {
      header: 'Disponible',
      align: 'right',
      width: '110px',
      render: (item) => {
        const disp = item.physicalStock - item.committedStock;
        return (
          <span className={`font-black text-xs whitespace-nowrap ${disp > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {disp}
          </span>
        );
      }
    },
    {
      header: 'Últ. Actualización',
      align: 'center',
      width: '150px',
      render: (item) => (
        <div className="text-[10px] text-slate-500 leading-tight text-center truncate">
          <div className="font-semibold text-slate-700">
            {item.updatedAt ? format(new Date(item.updatedAt), 'dd/MM/yyyy') : '-'}
          </div>
          <div className="text-slate-400 truncate max-w-[130px] mx-auto font-medium" title={item.updatedBy}>
            {item.updatedBy ? item.updatedBy.split('@')[0] : '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Acciones',
      align: 'center' as const,
      width: '100px',
      render: (item: VehicleWarehouseItem) => (
        <div className="flex justify-center items-center gap-1.5">
          <IconButton
            icon={<ACTION_ICONS.view />}
            onClick={(e) => {
              e.stopPropagation();
              setDetailItem(item);
            }}
            variant="primary"
            title="Ver detalle e historial"
            className="!p-1 !h-7 !w-7 text-blue-600 hover:bg-blue-50"
          />
          {canDelete && (
            <IconButton
              icon={<ACTION_ICONS.delete />}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteItem(item);
              }}
              variant="danger"
              title="Eliminar de esta bodega vehicular"
              className="!p-1 !h-7 !w-7"
            />
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* VISTA MÓVIL: Contenedor de Controles */}
      <div className="block md:hidden bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
        {/* ROW 1: SELECTOR DE SECCIÓN + SELECTOR DE UNIDAD */}
        <div className="grid grid-cols-2 gap-2">
          {/* Selector de Sección (Mobile) */}
          <div className="relative min-w-0 block">
            <select
              value={activeTab}
              onChange={(e) => onTabChange && onTabChange(e.target.value as any)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 truncate"
            >
              <option value="inventory">📦 Inventario</option>
              <option value="requests">📋 Solicitudes</option>
              <option value="movements">🔄 Movimientos</option>
              <option value="reports">📊 Reportes</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Selector de Unidad / Vehículo */}
          <div className="relative min-w-0">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-6 truncate"
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.alias} ({v.placa})
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* ROW 2: BÚSQUEDA + BOTÓN TRANSFERIR */}
        <div className="flex items-center gap-2">
          {/* Buscador de Material */}
          <div className="relative flex-1 min-w-0">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
              >
                <FiX className="text-xs" />
              </button>
            )}
          </div>

          {/* Botón Transferir */}
          <ActionButton
            label="TRANSFERIR"
            icon={<FiRefreshCw className="w-3.5 h-3.5" />}
            variant="primary"
            onClick={() => setShowTransferModal(true)}
            className="!w-auto flex-none shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 whitespace-nowrap text-xs rounded-lg shadow-sm"
          />
        </div>
      </div>

      {/* VISTA ESCRITORIO: Contenedor de Controles */}
      <div className="hidden md:flex md:items-center md:gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        {/* Selector de Unidad / Vehículo */}
        <div className="relative w-72 shrink-0">
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none pr-7 truncate"
          >
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.alias} ({v.placa})
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
            ▼
          </div>
        </div>

        {/* Buscador de Material (espacio flexible restante) */}
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-7 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
            >
              <FiX className="text-xs" />
            </button>
          )}
        </div>

        {/* Botón Transferir (ancho compacto y fijo) */}
        <ActionButton
          label="TRANSFERIR"
          icon={<FiRefreshCw className="w-4 h-4" />}
          variant="primary"
          onClick={() => setShowTransferModal(true)}
          className="!w-auto flex-none shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 whitespace-nowrap text-sm rounded-lg shadow-sm"
        />
      </div>

      {/* Contenido: Tabla en Escritorio + Cards en Móvil */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
          No hay inventario registrado en {selectedVehicle?.alias || 'este vehículo'}.
        </div>
      ) : (
        <>
          {/* VISTA ESCRITORIO: Formato de Registros Estructurado */}
          <div className="hidden md:block">
            <DataTable<VehicleWarehouseItem>
              data={filteredItems}
              columns={columns}
              keyExtractor={(item) => item.id}
              emptyMessage={`No hay inventario registrado en ${selectedVehicle?.alias || 'este vehículo'}.`}
            />
          </div>

          {/* VISTA MÓVIL: Tarjetas Originales Intactas */}
          <div className="grid grid-cols-1 md:hidden gap-3 sm:gap-4 animate-fade-in">
            {filteredItems.map((item) => (
              <div 
                key={item.id} 
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 sm:p-3.5 flex flex-col justify-between hover:shadow-sm hover:border-slate-300 transition-all duration-200"
              >
                {/* AREA SUPERIOR: Imagen + Detalles del Material */}
                <div className="flex gap-3 items-start">
                  {/* Espacio reservado para la imagen (limpio/neutral) */}
                  {(() => {
                    const images = itemImagesMap.get(item.inventoryItemId) || [];
                    const primaryImage = images.length > 0 ? images[0] : '';
                    const hasImages = images.length > 0;
                    return (
                      <div 
                        className={`relative w-16 h-16 sm:w-[72px] sm:h-[72px] bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                          hasImages ? 'cursor-pointer select-none active:scale-95 transition-transform' : ''
                        }`}
                        onDoubleClick={(e) => handleImageDoubleClick(item, images, e)}
                        onClick={(e) => handleImageClick(item, images, e)}
                        title={hasImages ? "Doble clic para ampliar imágenes" : undefined}
                      >
                        {hasImages ? (
                          <>
                            <img 
                              src={primaryImage} 
                              alt={item.description} 
                              className="w-full h-full object-contain p-1 pointer-events-none"
                              referrerPolicy="no-referrer"
                            />
                            {images.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 bg-slate-900/80 text-white text-[8px] font-black px-1 py-0.2 rounded leading-none backdrop-blur-xs">
                                1/{images.length}
                              </span>
                            )}
                          </>
                        ) : (
                          <FiBox className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                    );
                  })()}

                  {/* Detalles textuales */}
                  <div className="flex-1 min-w-0">
                    {/* Fila superior: Código + Última Actualización + Botón Eliminar (solo si autorizado) */}
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="inline-block text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded leading-none shrink-0">
                        {item.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="text-right text-[9px] text-slate-400 leading-tight">
                          <div className="font-medium">Últ. act. {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</div>
                          <div className="truncate max-w-[80px] sm:max-w-[100px] ml-auto font-normal text-slate-400" title={item.updatedBy}>
                            {item.updatedBy?.split('@')[0] || '-'}
                          </div>
                        </div>
                        {canDelete && (
                          <IconButton
                            icon={<ACTION_ICONS.delete />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item);
                            }}
                            variant="danger"
                            title="Eliminar de esta bodega vehicular"
                            className="!p-1 !h-6 !w-6 shrink-0"
                          />
                        )}
                      </div>
                    </div>

                    {/* Nombre/Descripción del Material */}
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight leading-snug mt-1 line-clamp-2" title={item.description}>
                      {item.description}
                    </h4>

                    {/* Categoría */}
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5 truncate">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Divisor delgado */}
                <div className="border-t border-slate-100 my-2.5" />

                {/* AREA INFERIOR: Indicadores de Cantidades */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    {/* Indicador 1: Stock */}
                    <div className="flex items-center min-w-0 shrink-0">
                      <FiBox className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="ml-1.5 leading-none">
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stock</div>
                        <div className="text-xs sm:text-sm font-black text-slate-800 mt-0.5">
                          {item.physicalStock} <span className="text-[9px] text-slate-400 font-normal">{item.unit || 'Unid.'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Divisor Vertical */}
                    <div className="border-r border-slate-200 h-6 mx-2 sm:mx-3 shrink-0" />

                    {/* Indicador 2: Comprometido */}
                    <div className="flex items-center min-w-0 shrink-0">
                      <FiBox className="w-4 h-4 text-orange-500 shrink-0" />
                      <div className="ml-1.5 leading-none">
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Comp.</div>
                        <div className="text-xs sm:text-sm font-black text-orange-600 mt-0.5">
                          {item.committedStock}
                        </div>
                      </div>
                    </div>

                    {/* Divisor Vertical */}
                    <div className="border-r border-slate-200 h-6 mx-2 sm:mx-3 shrink-0" />

                    {/* Indicador 3: Disponible */}
                    <div className="flex items-center min-w-0 shrink-0">
                      <FiBox className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="ml-1.5 leading-none">
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Disp.</div>
                        <div className="text-xs sm:text-sm font-black text-emerald-600 mt-0.5">
                          {item.physicalStock - item.committedStock}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Icono de Navegación discreto */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailItem(item);
                    }}
                    className="text-slate-300 hover:text-slate-400 ml-2 shrink-0 cursor-pointer p-1 -mr-1 rounded-md active:bg-slate-50 transition-colors"
                    title="Ver detalle"
                  >
                    <FiChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Multiple Transfer Modal */}
      {showTransferModal && (
        <TransferToVehicleModal
          show={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          defaultOriginVehicleId={selectedVehicleId}
          allVehicles={vehicles}
          allItems={items}
          currentUser={currentUser}
          onConfirmTransfer={async (data) => {
            if (onMultipleTransfer) {
              await onMultipleTransfer(data);
            } else if (onTransfer) {
              await vehicleWarehouseService.transferMultipleItems(
                data.originVehicleId,
                data.targetVehicleId,
                data.items,
                currentUser
              );
            } else {
              await vehicleWarehouseService.transferMultipleItems(
                data.originVehicleId,
                data.targetVehicleId,
                data.items,
                currentUser
              );
            }
            setShowTransferModal(false);
          }}
        />
      )}

      {/* Detail & History Modal */}
      {detailItem && (
        <VehicleInventoryDetailModal
          show={detailItem !== null}
          onClose={() => setDetailItem(null)}
          item={detailItem}
          selectedVehicleId={selectedVehicleId}
          movements={movements}
        />
      )}

      {/* Modal de Vista de Imagen de Referencia (Exclusivamente de Lectura) */}
      {previewGallery && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewGallery(null)}
        >
          <div 
            className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full max-h-[85vh] flex flex-col items-center p-4 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-sm text-slate-900 truncate leading-tight">
                  {previewGallery.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    {previewGallery.code}
                  </span>
                  {previewGallery.images.length > 1 && (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {previewGallery.currentIndex + 1} / {previewGallery.images.length}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreviewGallery(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                title="Cerrar vista de imagen"
                aria-label="Cerrar"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Area de Imagen centrada y proporcional con soporte Swipe y Flechas */}
            <div 
              className="relative w-full flex-1 flex items-center justify-center overflow-hidden bg-slate-50 rounded-xl p-3 min-h-[240px] max-h-[60vh] select-none touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Flecha Izquierda (Anterior) */}
              {previewGallery.images.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrevImage}
                  className="absolute left-2 z-10 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all shadow-md active:scale-95"
                  title="Imagen anterior"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Imagen actual */}
              <img
                src={previewGallery.images[previewGallery.currentIndex]}
                alt={`${previewGallery.title} ${previewGallery.currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-md transition-all duration-200"
                referrerPolicy="no-referrer"
              />

              {/* Flecha Derecha (Siguiente) */}
              {previewGallery.images.length > 1 && (
                <button
                  type="button"
                  onClick={handleNextImage}
                  className="absolute right-2 z-10 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-all shadow-md active:scale-95"
                  title="Siguiente imagen"
                >
                  <FiChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Indicador inferior de navegación si hay múltiples imágenes */}
            {previewGallery.images.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-3 pt-1">
                {previewGallery.images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPreviewGallery(prev => prev ? { ...prev, currentIndex: idx } : null)}
                    className={`h-2 rounded-full transition-all ${
                      idx === previewGallery.currentIndex 
                        ? 'w-6 bg-blue-600' 
                        : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                    title={`Ir a imagen ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

