import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InventoryItem } from '../inventoryTypes';
import { User } from '../utils/types';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { useConfirm, DataTable, TableColumn, IconButton } from '../design-system';
import { formatCurrency } from '../utils/formatCurrency';
import { InventoryMovement } from '../inventoryMovementTypes';
import { FiX, FiMapPin, FiBox, FiDatabase, FiTag, FiClock, FiCamera, FiTrash2, FiChevronLeft, FiChevronRight, FiUpload, FiRefreshCw, FiLoader } from "react-icons/fi";
import { uploadImageToStorage, uploadProcessedImageToStorage, deleteImageFromStorage } from '../utils/storageUtils';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { OptimizedImage } from '../components/OptimizedImage';
import { isHistoricalItem, optimizeHistoricalItemImages } from '../utils/historicalImageOptimizer';
import { OriginalImageContextMenu, useImageContextMenu } from '../components/OriginalImageContextMenu';
import { getItemImageSet } from '../utils/imageUtils';

interface InventoryDetailModalProps {
  show: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  currentUser: User;
  onImageUpdate?: (imageUrl: string, thumbnailUrl?: string, originalImageUrl?: string) => void;
  onImagesUpdate?: (imageUrls: string[], thumbnailUrls?: string[], originalImageUrls?: string[]) => void;
}

export const InventoryDetailModal: React.FC<InventoryDetailModalProps> = ({ show, onClose, item, currentUser, onImageUpdate, onImagesUpdate }) => {
  useLockBodyScroll(show);
  const { movements, isLoading } = useInventoryMovements(currentUser);
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isOptimizingHistorical, setIsOptimizingHistorical] = useState<boolean>(false);
  const replacingIndexRef = useRef<number | null>(null);

  const handleOptimizeHistorical = async () => {
    if (!item) return;
    setIsOptimizingHistorical(true);
    try {
      const res = await optimizeHistoricalItemImages(item);
      if (res.success && res.updatedFields && Object.keys(res.updatedFields).length > 0) {
        if (onImagesUpdate && res.updatedFields.imageUrls && res.updatedFields.thumbnailUrls) {
          onImagesUpdate(
            res.updatedFields.imageUrls,
            res.updatedFields.thumbnailUrls,
            res.updatedFields.originalImageUrls
          );
        } else if (onImageUpdate && res.updatedFields.imageUrl && res.updatedFields.thumbnailUrl) {
          onImageUpdate(
            res.updatedFields.imageUrl,
            res.updatedFields.thumbnailUrl,
            res.updatedFields.originalImageUrl
          );
        }
      }
    } catch (err) {
      console.error("Error al optimizar imagen histórica:", err);
    } finally {
      setIsOptimizingHistorical(false);
    }
  };

  // Estado previewGallery igual al de Bodegas Vehiculares (VehicleInventoryTab.tsx)
  const [previewGallery, setPreviewGallery] = useState<{
    images: string[];
    currentIndex: number;
    title: string;
    code: string;
  } | null>(null);

  const [lastTap, setLastTap] = useState<{ id: string; time: number }>({ id: '', time: 0 });
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    replacingIndexRef.current = replacingIndex;
  }, [replacingIndex]);

  const imageSet = useMemo(() => getItemImageSet(item), [item]);
  const currentImages = imageSet.hdImages.length > 0 ? imageSet.hdImages : imageSet.thumbnails;
  const currentThumbnails = imageSet.thumbnails.length > 0 ? imageSet.thumbnails : currentImages;
  const currentOriginals = imageSet.originals;

  const selectedOriginalUrl =
    currentOriginals[selectedIndex] ||
    currentOriginals[0] ||
    currentImages[selectedIndex] ||
    currentImages[0] ||
    null;

  const { menuPosition, closeMenu, bindEvents } = useImageContextMenu(
    currentUser,
    selectedOriginalUrl,
    item?.code,
    selectedIndex
  );

  // Keep selectedIndex in bounds if currentImages length changes
  useEffect(() => {
    if (selectedIndex >= currentImages.length && currentImages.length > 0) {
      setSelectedIndex(currentImages.length - 1);
    } else if (currentImages.length === 0) {
      setSelectedIndex(0);
    }
  }, [currentImages, selectedIndex]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewGallery) {
          handleClosePreviewGallery();
        } else if (show) {
          onClose();
        }
      }
    };
    if (show || previewGallery) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [show, onClose, previewGallery]);

  const handlePrevImage = () => {
    if (currentImages.length <= 1) return;
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : currentImages.length - 1));
  };

  const handleNextImage = () => {
    if (currentImages.length <= 1) return;
    setSelectedIndex(prev => (prev < currentImages.length - 1 ? prev + 1 : 0));
  };

  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const isSmallScreen = window.innerWidth < 1024;
    return isTouch || isSmallScreen;
  };

  const openPreviewGallery = (indexToOpen: number) => {
    if (!currentImages || currentImages.length === 0) return;
    setPreviewGallery({
      images: currentImages,
      currentIndex: indexToOpen,
      title: item?.description || 'Imagen de referencia',
      code: item?.code || ''
    });
  };

  const handleClosePreviewGallery = () => {
    if (previewGallery) {
      setSelectedIndex(previewGallery.currentIndex);
    }
    setPreviewGallery(null);
  };

  // Lógica de click / doble toque idéntica a VehicleInventoryTab.tsx
  const handleImageDoubleClick = (e: React.SyntheticEvent) => {
    if (!currentImages || currentImages.length === 0) return;
    if (!isMobileDevice()) return;
    e.stopPropagation();
    openPreviewGallery(selectedIndex);
  };

  const handleImageClick = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!currentImages || currentImages.length === 0) return;
    if (!isMobileDevice()) return;

    const now = Date.now();
    const itemId = item?.id || item?.code || 'inventory-item';
    if (lastTap.id === itemId && now - lastTap.time < 350) {
      if (e) e.stopPropagation();
      openPreviewGallery(selectedIndex);
      setLastTap({ id: '', time: 0 });
    } else {
      setLastTap({ id: itemId, time: now });
      // Para asegurar respuesta ágil en pantallas táctiles móviles:
      openPreviewGallery(selectedIndex);
    }
  };

  // Handlers para la galería de vista previa (previewGallery) de Bodegas Vehiculares

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !e.changedTouches || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - (touchStartY !== null ? touchStartY : touchEndY);

    if (deltaX > 40 && Math.abs(deltaY) < 40) {
      handlePrevImage();
    } else if (deltaX < -40 && Math.abs(deltaY) < 40) {
      handleNextImage();
    } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15 && isMobileDevice()) {
      handleImageClick(e);
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const emitImagesUpdate = (newImages: string[], newThumbnails: string[], newOriginals: string[]) => {
    if (onImagesUpdate) {
      onImagesUpdate(newImages, newThumbnails, newOriginals);
    } else if (onImageUpdate) {
      onImageUpdate(
        newImages.length > 0 ? newImages[0] : '',
        newThumbnails.length > 0 ? newThumbnails[0] : '',
        newOriginals.length > 0 ? newOriginals[0] : ''
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !item) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor seleccione un archivo de imagen válido.");
      return;
    }

    try {
      setIsUploading(true);
      const isReplacing = replacingIndexRef.current !== null && replacingIndexRef.current < currentImages.length;
      
      // Target folder based on item ID (or code as fallback)
      const folderPath = `inventory/${item.id || item.code || 'unknown'}`;
      
      // Desired filename: e.g., image-1, image-2
      const targetIndex = isReplacing ? replacingIndexRef.current! : currentImages.length;
      const baseFileName = `image-${targetIndex + 1}`;
      
      // Upload raw original, processed HD, and Thumbnail images to Firebase Storage
      const { originalUrl, hdUrl, thumbnailUrl } = await uploadProcessedImageToStorage(file, folderPath, baseFileName);
      
      let nextImages = [...currentImages];
      let nextThumbnails = [...currentThumbnails];
      let nextOriginals = [...currentOriginals];

      // Ensure thumbnails and originals arrays match images array length before replacement/addition
      while (nextThumbnails.length < nextImages.length) {
        nextThumbnails.push(nextImages[nextThumbnails.length]);
      }
      while (nextOriginals.length < nextImages.length) {
        nextOriginals.push(nextImages[nextOriginals.length]);
      }
      
      let oldImageUrlToClean: string | null = null;
      let oldThumbUrlToClean: string | null = null;
      let oldOriginalUrlToClean: string | null = null;
      
      if (isReplacing) {
        const replaceIdx = replacingIndexRef.current!;
        oldImageUrlToClean = nextImages[replaceIdx];
        oldThumbUrlToClean = nextThumbnails[replaceIdx];
        oldOriginalUrlToClean = nextOriginals[replaceIdx];

        nextImages[replaceIdx] = hdUrl;
        nextThumbnails[replaceIdx] = thumbnailUrl;
        nextOriginals[replaceIdx] = originalUrl;
        setSelectedIndex(replaceIdx);
      } else if (nextImages.length < 4) {
        nextImages.push(hdUrl);
        nextThumbnails.push(thumbnailUrl);
        nextOriginals.push(originalUrl);
        setSelectedIndex(nextImages.length - 1);
      }
      
      // Update Firestore references
      emitImagesUpdate(nextImages, nextThumbnails, nextOriginals);
      
      // Clean up old images if replacing
      const urlsToClean = new Set([oldImageUrlToClean, oldThumbUrlToClean, oldOriginalUrlToClean].filter(Boolean) as string[]);
      for (const url of urlsToClean) {
        await deleteImageFromStorage(url).catch(console.error);
      }

    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Hubo un error al subir la imagen. Por favor intente nuevamente.");
    } finally {
      setReplacingIndex(null);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async () => {
    if (currentImages.length === 0 || selectedIndex < 0 || selectedIndex >= currentImages.length) return;
    const indexToDelete = selectedIndex;

    const shouldDelete = await confirm({
      title: "¿Eliminar imagen de referencia?",
      description: `¿Está seguro de eliminar la imagen #${indexToDelete + 1} del material "${item?.description || ''}"? Esta acción no se puede deshacer.`,
      confirmLabel: "ELIMINAR",
      variant: "danger"
    });

    if (!shouldDelete) return;
    
    setIsUploading(true);
    
    try {
      const urlToDelete = currentImages[indexToDelete];
      const thumbToDelete = currentThumbnails[indexToDelete];
      const originalToDelete = currentOriginals[indexToDelete];
      
      const nextImages = currentImages.filter((_, idx) => idx !== indexToDelete);
      const nextThumbnails = currentThumbnails.filter((_, idx) => idx !== indexToDelete);
      const nextOriginals = currentOriginals.filter((_, idx) => idx !== indexToDelete);

      emitImagesUpdate(nextImages, nextThumbnails, nextOriginals);
      
      const urlsToClean = new Set([urlToDelete, thumbToDelete, originalToDelete].filter(Boolean) as string[]);
      for (const url of urlsToClean) {
        await deleteImageFromStorage(url).catch(console.error);
      }

      if (nextImages.length === 0) {
        setSelectedIndex(0);
      } else if (indexToDelete >= nextImages.length) {
        setSelectedIndex(nextImages.length - 1);
      }
    } catch (error) {
      console.error("Error al eliminar imagen:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const itemMovements = useMemo(() => {
    if (!item) return [];
    return movements.filter(m => {
        // Legacy check
        if (m.inventoryItemId === item.id) return true;
        // Multi-item check
        if (m.items && m.items.some(i => i.inventoryItemId === item.id)) return true;
        return false;
    });
  }, [movements, item]);

  if (!show || !item) return null;

  const providerColumns: TableColumn<{ name: string; price: number }>[] = [
    {
      header: 'Proveedor',
      accessor: 'name',
      className: 'font-bold text-slate-700 pl-4'
    },
    {
      header: 'Precio Unit. (Sin IVA)',
      accessor: (p) => formatCurrency(p.price, item.currency || 'USD'),
      align: 'right',
      className: 'font-mono font-bold text-slate-600'
    },
    {
      header: 'IVA (13%)',
      accessor: (p) => formatCurrency(p.price * 0.13, item.currency || 'USD'),
      align: 'right',
      className: 'font-mono text-slate-500'
    },
    {
      header: 'Total',
      accessor: (p) => formatCurrency(p.price * 1.13, item.currency || 'USD'),
      align: 'right',
      className: 'font-mono font-black text-emerald-600 pr-4'
    }
  ];

  const columns: TableColumn<InventoryMovement>[] = [
      {
          header: 'Fecha',
          accessorKey: 'createdAt',
          render: (m) => {
              const date = new Date(m.createdAt);
              return (
                  <div className="flex flex-col">
                      <span className="font-bold text-slate-700">{date.toLocaleDateString()}</span>
                      <span className="text-[10px] text-slate-400">{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
              );
          }
      },
      {
          header: 'Tipo',
          accessorKey: 'type',
          render: (m) => (
              <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                  m.type === 'Entrada' ? 'bg-emerald-100 text-emerald-700' :
                  m.type === 'Salida' ? 'bg-rose-100 text-rose-700' :
                  'bg-blue-100 text-blue-700'
              }`}>
                  {m.type}
              </span>
          )
      },
      {
          header: 'Proveedor',
          render: (m) => {
              if (m.type === 'Entrada' && m.origin === 'Proveedor' && m.provider) {
                  return <span className="text-[10px] font-bold text-slate-600">{m.provider}</span>;
              }
              return <span className="text-[10px] text-slate-300 font-bold">-</span>;
          }
      },
      {
          header: 'Cant.',
          align: 'right',
          render: (m) => {
              let qty = 0;
              if (m.items && m.items.length > 0) {
                  const detail = m.items.find(i => i.inventoryItemId === item.id);
                  qty = detail ? detail.quantity : 0;
              } else {
                  qty = m.quantity;
              }
              return <span className="font-mono font-black text-slate-800">{qty}</span>;
          }
      },
      {
          header: 'Precio Unit.',
          align: 'right',
          render: (m) => {
              let price: number | undefined;
              if (m.items && m.items.length > 0) {
                  const detail = m.items.find(i => i.inventoryItemId === item.id);
                  price = detail ? detail.unitPrice : undefined;
              } else if (m.inventoryItemId === item.id) {
                  price = m.unitPrice;
              }
              
              const ivaRate = (item as any).ivaRate ?? (item as any).iva ?? 0.13;
              const priceWithIva = price !== undefined ? price * (1 + ivaRate) : undefined;
              
              return (
                  <span className="font-mono font-bold text-slate-600 text-xs">
                      {priceWithIva !== undefined ? formatCurrency(priceWithIva, item.currency || 'USD') : '-'}
                  </span>
              );
          }
      },
      {
          header: 'Referencia',
          render: (m) => (
              <div className="flex flex-col max-w-[150px]">
                  {m.projectCode && <span className="text-xs font-bold text-blue-600">{m.projectCode}</span>}
                  <span className="text-[10px] text-slate-500 truncate" title={m.projectName || m.observations}>
                      {m.projectName || m.observations || '-'}
                  </span>
              </div>
          )
      }
  ];

  return createPortal(
    <div 
        className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
        onClick={onClose}
    >
        <div 
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-none">
                <div>
                    <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">Detalle del Material</h3>
                    <p className="text-xs text-slate-500 font-bold font-mono mt-1">{item.code}</p>
                </div>
                <IconButton 
                    onClick={onClose} 
                    icon={<FiX  />}
                    variant="neutral"
                    title="Cerrar"
                />
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 space-y-6">
                {/* Product Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Descripción</label>
                        <p className="text-sm font-bold text-slate-800 leading-relaxed">{item.description}</p>
                    </div>
                    
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Ubicación</label>
                         <div className="flex items-center gap-2">
                            <FiMapPin className="text-slate-300"  />
                            <p className="text-sm font-bold text-slate-800">{item.location || 'No asignada'}</p>
                         </div>
                    </div>

                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10">
                            <FiBox className="text-6xl text-blue-600"  />
                        </div>
                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Stock Actual</label>
                        <div className="flex flex-col">
                            <p className="text-3xl font-black text-blue-900 tracking-tight">
                                {(item.stock || 0) - (item.reserved || 0)} <span className="text-sm font-bold text-blue-400 ml-1">Disponible</span>
                            </p>
                            <div className="flex gap-3 mt-2">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                    Total: {item.stock} {item.unit}
                                </span>
                                {(item.reserved || 0) > 0 && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-lg border border-amber-200">
                                        Reservado: {item.reserved} {item.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10">
                            <FiDatabase className="text-6xl text-emerald-600"  />
                        </div>
                        <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Valor Total</label>
                        <p className="text-3xl font-black text-emerald-900 tracking-tight">
                            {(() => {
                                const ivaRate = (item as any).ivaRate ?? (item as any).iva ?? 0.13;
                                const priceWithIva = (item.price || 0) * (1 + ivaRate);
                                return formatCurrency(priceWithIva * item.stock, item.currency || 'USD');
                            })()}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-bold mt-2 bg-emerald-100/50 inline-block px-2 py-1 rounded-lg">
                            Unitario: {(() => {
                                const ivaRate = (item as any).ivaRate ?? (item as any).iva ?? 0.13;
                                const priceWithIva = (item.price || 0) * (1 + ivaRate);
                                return formatCurrency(priceWithIva, item.currency || 'USD');
                            })()}
                        </p>
                    </div>

                    {/* Reference Images Card (Visor + Botones Exteriores) */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm sm:col-span-2 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Imágenes de Referencia</label>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Visor de imágenes del material. Utiliza los botones inferiores para subir, reemplazar o eliminar imágenes.
                                </p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                                {isHistoricalItem(item) && (
                                    <button
                                        type="button"
                                        onClick={handleOptimizeHistorical}
                                        disabled={isOptimizingHistorical || isUploading}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-300 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                                        title="Esta imagen fue subida con el formato antiguo. Haz clic para generar su miniatura optimizada de forma segura sin modificar el archivo original."
                                    >
                                        {isOptimizingHistorical ? (
                                            <>
                                                <FiLoader className="w-3.5 h-3.5 animate-spin" />
                                                <span>Optimizando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiRefreshCw className="w-3.5 h-3.5" />
                                                <span>Optimizar Imagen Histórica</span>
                                            </>
                                        )}
                                    </button>
                                )}
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                    currentImages.length >= 4 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                    {currentImages.length} de 4 imágenes
                                </span>
                            </div>
                        </div>

                        {/* VISOR DE IMÁGENES (Exclusivo para visualización y navegación) */}
                        <div 
                            className="relative w-full aspect-video sm:aspect-[21/9] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center p-4 border border-slate-800 shadow-inner select-none touch-pan-y cursor-pointer sm:cursor-default"
                            onTouchStart={(e) => {
                              handleTouchStart(e);
                              bindEvents.onTouchStart(e);
                            }}
                            onTouchMove={bindEvents.onTouchMove}
                            onTouchEnd={(e) => {
                              handleTouchEnd(e);
                              bindEvents.onTouchEnd(e);
                            }}
                            onContextMenu={bindEvents.onContextMenu}
                            onClick={handleImageClick}
                            onDoubleClick={handleImageDoubleClick}
                        >
                            <OriginalImageContextMenu 
                              position={menuPosition} 
                              onClose={closeMenu} 
                              currentUser={currentUser} 
                            />
                            {currentImages.length > 0 ? (
                                <>
                                    {/* Flecha Izquierda (Anterior) */}
                                    {currentImages.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePrevImage();
                                            }}
                                            className="absolute left-3 z-10 p-2.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition-all shadow-md active:scale-95 border border-slate-700/50 backdrop-blur-xs cursor-pointer"
                                            title="Imagen anterior"
                                        >
                                            <FiChevronLeft className="w-5 h-5" />
                                        </button>
                                    )}

                                    {/* Imagen activa centrada sin deformar (HD con fallback a Thumbnail) */}
                                    <OptimizedImage 
                                        src={currentImages[selectedIndex] || currentImages[0]} 
                                        fallbackSrc={currentThumbnails[selectedIndex] || currentThumbnails[0]}
                                        fallbackSrcs={[currentOriginals[selectedIndex], ...currentOriginals, ...currentImages].filter(Boolean) as string[]}
                                        alt={`${item.description} - Imagen ${selectedIndex + 1}`} 
                                        loading="eager"
                                        decoding="async"
                                        className="w-full h-full p-1 pointer-events-none flex items-center justify-center"
                                        objectFit="contain"
                                        referrerPolicy="no-referrer"
                                        iconSize={32}
                                    />

                                    {/* Flecha Derecha (Siguiente) */}
                                    {currentImages.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleNextImage();
                                            }}
                                            className="absolute right-3 z-10 p-2.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition-all shadow-md active:scale-95 border border-slate-700/50 backdrop-blur-xs cursor-pointer"
                                            title="Siguiente imagen"
                                        >
                                            <FiChevronRight className="w-5 h-5" />
                                        </button>
                                    )}

                                    {/* Indicador de posición (ej. "2 / 4") */}
                                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/80 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md border border-slate-800 tracking-wider shadow-sm">
                                        {selectedIndex + 1} / {currentImages.length}
                                    </div>
                                </>
                            ) : (
                                /* Estado Sin Imágenes */
                                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-6 text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                                        <FiCamera className="text-xl" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-300 block">Sin imagen de referencia</span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block">Utiliza el botón "SUBIR IMAGEN" para agregar fotos</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* GALERÍA DE MINIATURAS (utiliza thumbnails para hasta 4 fotos) */}
                        {currentImages.length > 1 && (
                            <div className="flex items-center justify-center gap-2.5 pt-1">
                                {currentImages.map((_, idx) => {
                                    const thumbUrl = currentThumbnails[idx] || currentImages[idx];
                                    const isSelected = idx === selectedIndex;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedIndex(idx)}
                                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 overflow-hidden transition-all cursor-pointer shrink-0 ${
                                                isSelected 
                                                    ? 'border-blue-600 ring-2 ring-blue-400/50 scale-105 shadow-sm' 
                                                    : 'border-slate-200 hover:border-slate-400 opacity-70 hover:opacity-100'
                                            }`}
                                            title={`Ver foto ${idx + 1}`}
                                        >
                                            <OptimizedImage
                                                src={thumbUrl}
                                                fallbackSrc={currentImages[idx]}
                                                fallbackSrcs={[currentOriginals[idx], ...currentImages].filter(Boolean) as string[]}
                                                alt={`Miniatura ${idx + 1}`}
                                                className="w-full h-full p-0.5"
                                                referrerPolicy="no-referrer"
                                                iconSize={16}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* BOTONES ACCIONES FUERA DEL VISOR */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                            {/* SUBIR IMAGEN (Visible cuando hay menos de 4 imágenes) */}
                            {currentImages.length < 4 && (
                                <button
                                    type="button"
                                    disabled={isUploading}
                                    onClick={() => {
                                        setReplacingIndex(null);
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUploading && replacingIndex === null ? (
                                        <><FiLoader className="text-sm animate-spin" /> SUBIENDO...</>
                                    ) : (
                                        <><FiUpload className="text-sm" /> SUBIR IMAGEN</>
                                    )}
                                </button>
                            )}

                            {/* REEMPLAZAR Y ELIMINAR (Solo cuando hay al menos 1 imagen) */}
                            {currentImages.length > 0 && (
                                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        disabled={isUploading}
                                        onClick={() => {
                                            setReplacingIndex(selectedIndex);
                                            fileInputRef.current?.click();
                                        }}
                                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Reemplazar la imagen actualmente seleccionada"
                                    >
                                        {isUploading && replacingIndex === selectedIndex ? (
                                            <><FiLoader className="text-xs animate-spin" /> CARGANDO</>
                                        ) : (
                                            <><FiRefreshCw className="text-xs" /> REEMPLAZAR</>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isUploading}
                                        onClick={handleDeleteImage}
                                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Eliminar la imagen actualmente seleccionada"
                                    >
                                        <FiTrash2 className="text-xs" /> ELIMINAR
                                    </button>
                                </div>
                            )}
                        </div>

                        <input 
                            ref={fileInputRef} 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange} 
                            className="hidden" 
                            disabled={isUploading}
                        />
                    </div>
                </div>

                {/* Precios por Proveedor Section */}
                {item.providers && item.providers.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                <FiTag className="text-slate-400"  /> Precios por Proveedor
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                                {item.providers.length} proveedores
                            </span>
                        </div>
                        <DataTable<{ name: string; price: number }>
                            data={item.providers}
                            columns={providerColumns}
                            keyExtractor={(p, idx) => `${p.name}-${idx}`}
                        />
                    </div>
                )}

                {/* History Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <FiClock className="text-slate-400"  /> Historial de Movimientos
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                            {itemMovements.length} registros
                        </span>
                    </div>
                    <div className="flex-1">
                        <DataTable
                            data={itemMovements}
                            columns={columns}
                            keyExtractor={(m) => m.id}
                            isLoading={isLoading}
                            emptyMessage="No hay movimientos registrados para este material."
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Modal de Vista de Imagen de Referencia (Reutilizando componente común) */}
        {previewGallery && (
          <ImageViewerModal
            images={previewGallery.images}
            originalImages={currentOriginals}
            currentUser={currentUser}
            initialIndex={previewGallery.currentIndex}
            title={previewGallery.title}
            code={previewGallery.code}
            onClose={(lastIndex) => {
              setSelectedIndex(lastIndex);
              setPreviewGallery(null);
            }}
          />
        )}
    </div>,
    document.body
  );
};
