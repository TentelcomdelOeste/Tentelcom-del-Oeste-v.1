import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import { InventoryModal } from './InventoryModal';
import { InventoryDetailModal } from './InventoryDetailModal';
import { ReconcileInventoryModal } from './ReconcileInventoryModal';
import { User } from '../utils/types';
import { InventoryItem as InvItemType } from '../inventoryTypes';
import { ModulePage } from '../components/ui/ModulePage';
import { ModuleToolbar } from '../components/ui/ModuleToolbar';
import { ActionButtons } from '../components/ui/ActionButtons';
import { isAdmin } from '../utils/permissions';
import { exportToExcel } from '../utils/exportUtils';
import { triggerFileDownload } from '../utils/fileUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_BASE64 } from '../utils/logoBase64';
import { FiBox } from 'react-icons/fi';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { OptimizedImage } from '../components/OptimizedImage';
import { getItemImageSet } from '../utils/imageUtils';
import { 
  useConfirm, 
  DataTable, 
  TableColumn, 
  SearchInput, 
  ActionButton,
  IconButton,
  ACTION_ICONS,
  Select
} from '../design-system';
import { useInventoryCostLayers } from '../hooks/useInventoryCostLayers';

const EXCHANGE_RATE_LIST_VIEW = 515.0;

interface InventoryValuationDetail {
  confirmedValuationNoTax: number;
  confirmedValuationWithTax: number;
  coveredQty: number;
  uncoveredQty: number;
  averageUnitCostNoTax: number;
  averageUnitCostWithTax: number;
  isFullyCovered: boolean;
  hasNoLayers: boolean;
}


interface InventoryModuleProps {
  currentUser: User;
  selectedId?: string;
  selectedKey?: string;
  onClearSelectedId?: () => void;
}

const InventoryModule: React.FC<InventoryModuleProps> = ({ currentUser, selectedId, selectedKey, onClearSelectedId }) => {
  const { 
    items, 
    addInventoryItem, 
    updateInventoryItem, 
    deleteInventoryItem, 
    checkCodeStatus,
    isLoading
  } = useInventory(currentUser, { fetchAll: true });
  
  const { movements } = useInventoryMovements(currentUser);
  const confirm = useConfirm();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'ok' | 'low' | 'critical'>('all');
  const [sortConfig, setSortConfig] = useState<{key: keyof InvItemType, direction: 'asc' | 'desc'}>({ key: "code", direction: "asc" });
  const [showModal, setShowModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InvItemType | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{
    images: string[];
    originalImages?: string[];
    currentIndex: number;
    title: string;
    code: string;
  } | null>(null);

  /*
  // Automatic audit for admins
  useEffect(() => {
    if (isAdmin(currentUser.role)) {
      auditInventory().then(inconsistencies => {
        if (inconsistencies.length > 0) {
          console.warn("Inconsistencias de reserva detectadas y corregidas automáticamente:", inconsistencies);
          fixInventoryReservations(inconsistencies);
        }
      });
    }
  }, [currentUser.role, auditInventory, fixInventoryReservations]);
  */

  // ... (keep the rest of the code as is, just remove handleAudit and the button)


  // --- AUTO-OPEN AND HIGHLIGHT FROM SEARCH ---
  const autoOpenedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (selectedId && items.length > 0) {
      if (autoOpenedIdRef.current !== selectedId) {
        const target = items.find(i => 
          (selectedKey && (i as any)[selectedKey] === selectedId) || 
          i.id === selectedId || 
          (i as any).code === selectedId
        );
        if (target) {
          autoOpenedIdRef.current = selectedId;
          setViewingItem(target);
        }
      }
    }
  }, [selectedId, selectedKey, items]);
  const [viewingItem, setViewingItem] = useState<InvItemType | null>(null);

  const categories = [
    'Fibra Óptica',
    'Cableado Estructurado',
    'Equipos Activos',
    'Herramientas',
    'Consumibles',
    'Seguridad',
    'Infraestructura'
  ];

  const { costLayers } = useInventoryCostLayers();
  const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD'>('CRC');

  // Cálculo del Valor Real del Inventario basado en Capas PEPS Activas
  const inventoryValuationDetails = useMemo(() => {
      const detailsMap = new Map<string, InventoryValuationDetail>();

      items.forEach(item => {
          const itemLayers = costLayers.filter(l => l.inventoryItemId === item.id && l.status === 'active');
          const coveredQty = itemLayers.reduce((sum, l) => sum + (l.quantityRemaining || 0), 0);
          const physicalStock = item.stock || 0;
          const uncoveredQty = Math.max(0, physicalStock - coveredQty);

          let confirmedValuationNoTax = 0;

          itemLayers.forEach(layer => {
              const qty = layer.quantityRemaining || 0;
              if (qty <= 0) return;

              const layerCurrency = layer.currency || 'CRC';
              const baseCost = layer.unitCost || 0;
              const rate = layer.exchangeRate && layer.exchangeRate > 0 ? layer.exchangeRate : EXCHANGE_RATE_LIST_VIEW;

              let costInTarget = baseCost;
              if (layerCurrency === 'CRC' && selectedCurrency === 'USD') {
                  costInTarget = baseCost / EXCHANGE_RATE_LIST_VIEW;
              } else if (layerCurrency === 'USD' && selectedCurrency === 'CRC') {
                  costInTarget = baseCost * rate;
              }

              confirmedValuationNoTax += qty * costInTarget;
          });

          const confirmedValuationWithTax = confirmedValuationNoTax * 1.13;
          const averageUnitCostNoTax = coveredQty > 0 ? (confirmedValuationNoTax / coveredQty) : 0;
          const averageUnitCostWithTax = averageUnitCostNoTax * 1.13;

          detailsMap.set(item.id, {
              confirmedValuationNoTax,
              confirmedValuationWithTax,
              coveredQty,
              uncoveredQty,
              averageUnitCostNoTax,
              averageUnitCostWithTax,
              isFullyCovered: uncoveredQty === 0 && coveredQty > 0,
              hasNoLayers: coveredQty === 0 && physicalStock > 0
          });
      });

      return detailsMap;
  }, [items, costLayers, selectedCurrency]);

  // Resumen global de valoración
  const globalSummary = useMemo(() => {
      let totalConfirmedNoTax = 0;
      let totalConfirmedWithTax = 0;
      let totalPhysicalUnits = 0;
      let totalItemsWithStock = 0;
      let itemsUncoveredCount = 0;
      let totalUncoveredUnits = 0;

      items.forEach(item => {
          const detail = inventoryValuationDetails.get(item.id);
          if (detail) {
              totalConfirmedNoTax += detail.confirmedValuationNoTax;
              totalConfirmedWithTax += detail.confirmedValuationWithTax;
              if (detail.uncoveredQty > 0) {
                  itemsUncoveredCount += 1;
                  totalUncoveredUnits += detail.uncoveredQty;
              }
          }
          if ((item.stock || 0) > 0) {
              totalItemsWithStock += 1;
              totalPhysicalUnits += (item.stock || 0);
          }
      });

      return {
          totalConfirmedNoTax,
          totalConfirmedWithTax,
          totalPhysicalUnits,
          totalItemsWithStock,
          totalCatalogItems: items.length,
          itemsUncoveredCount,
          totalUncoveredUnits
      };
  }, [items, inventoryValuationDetails]);

  // Proveedores únicos para autocompletado en InventoryModal
  const uniqueProviders = useMemo(() => {
      const providers = new Set<string>();
      items.forEach(item => {
          if (item.providers) {
              item.providers.forEach(p => {
                  if (p.name) providers.add(p.name);
              });
          }
      });
      return Array.from(providers).sort();
  }, [items]);

  const uniqueCategories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(), [items]);
  const uniqueLocations = useMemo(() => Array.from(new Set(items.map(i => i.location).filter(Boolean))).sort(), [items]);

  const [filteredItems, setFilteredItems] = useState<InvItemType[]>(items || []);

  // Effect to update filteredItems when items change or selection changes
  useEffect(() => {
    if (!items || items.length === 0) {
      setFilteredItems([]);
      return;
    }

    if (selectedId && selectedKey) {
      const found = items.find(i => (i as any)[selectedKey] === selectedId);
      if (found) {
        setFilteredItems([found]);
        return;
      }
    }

    let result = [...items];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => {
        return (
          item.code?.toLowerCase().includes(lowerSearch) ||
          item.description?.toLowerCase().includes(lowerSearch) ||
          item.category?.toLowerCase().includes(lowerSearch) ||
          item.location?.toLowerCase().includes(lowerSearch) ||
          item.providers?.some(p => p.name?.toLowerCase().includes(lowerSearch)) ||
          item.price?.toString().includes(lowerSearch) ||
          item.stock?.toString().includes(lowerSearch)
        );
      });
    }

    if (categoryFilter !== 'all') {
      result = result.filter(item => item.category === categoryFilter);
    }

    if (stockStatusFilter !== 'all') {
      result = result.filter(item => {
        const available = (item.stock || 0) - (item.reserved || 0);
        if (stockStatusFilter === 'critical') return available <= 0;
        if (stockStatusFilter === 'low') return available > 0 && available <= item.minStock;
        if (stockStatusFilter === 'ok') return available > item.minStock;
        return true;
      });
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === undefined || bValue === undefined) return 0;
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredItems(result);
  }, [items, selectedId, selectedKey, searchTerm, categoryFilter, stockStatusFilter, sortConfig]);

  const handleEdit = useCallback((item: InvItemType) => {
    setEditingItem(item);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(async (item: InvItemType) => {
    const shouldDelete = await confirm({
        title: "¿Eliminar Material?",
        description: `¿Está seguro de eliminar "${item.description}" del inventario? Esta acción no se puede deshacer.`,
        confirmLabel: "Eliminar",
        variant: "danger"
    });

    if (shouldDelete) {
        await deleteInventoryItem(item.id);
    }
  }, [confirm, deleteInventoryItem]);

  const handleSave = async (data: any, options?: { skipCodeCheck?: boolean }) => {
      if (editingItem) {
          await updateInventoryItem(editingItem.id, data, options);
      } else {
          await addInventoryItem(data, options);
      }
  };

  const handleExportExcel = () => {
      const dataToExport = filteredItems.map(item => {
          const detail = inventoryValuationDetails.get(item.id);
          const valorTotalWithTax = detail?.confirmedValuationWithTax || 0;
          const valorTotalNoTax = detail?.confirmedValuationNoTax || 0;
          const unitCostWithTax = detail?.averageUnitCostWithTax || 0;
          const cobertura = detail?.uncoveredQty && detail.uncoveredQty > 0
            ? `${detail.coveredQty} cubiertas, ${detail.uncoveredQty} sin capa`
            : (detail?.coveredQty ? '100% Cubierto PEPS' : 'Sin Capa PEPS');

          return {
              "Código": item.code,
              "Descripción": item.description,
              "Categoría": item.category || '',
              "Stock Actual": item.stock || 0,
              "Unidad": item.unit || 'und',
              "Moneda Visualización": selectedCurrency,
              "Costo Promedio Unitario PEPS (Con IVA)": detail?.coveredQty ? unitCostWithTax : 0,
              "Valor Confirmado Base (Sin IVA)": valorTotalNoTax,
              "Valor Confirmado (Con IVA 13%)": valorTotalWithTax,
              "Cobertura Capas PEPS": cobertura,
              "Proveedores": item.providers?.map(p => p.name).join(', ') || ''
          };
      });
      exportToExcel(dataToExport, `Inventario_General_PEPS_${selectedCurrency}_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  };

  const handleExportPDF = async () => {
      const doc = new jsPDF('p', 'pt', 'letter');
      const margin = 40;
      
      const formatNumberOnly = (amount: number) => {
          return new Intl.NumberFormat(selectedCurrency === 'CRC' ? 'es-CR' : 'en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          }).format(amount);
      };

      // --- HEADER ---
      const logoWidth = 70;
      const logoHeight = 0; 
      const logoX = margin;
      const logoY = margin;

      try {
          const logoData = LOGO_BASE64;
          doc.addImage(logoData, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (error) {
          console.warn("Logo error", error);
      }

      const headerTextX = margin + logoWidth + 20;
      let textY = margin + 15;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138); 
      doc.text("TENTELCOM DEL OESTE S.A.", headerTextX, textY);

      textY += 20;
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("Reporte Valoración de Inventario (PEPS / FIFO)", headerTextX, textY);

      textY += 15;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-CR')} | Moneda: ${selectedCurrency} | T.C. Referencial: ₡515.00 / USD`, headerTextX, textY);
      
      // --- TABLE ---
      let grandTotalNoTax = 0;
      let grandTotalWithTax = 0;

      const tableData = filteredItems.map(item => {
          const detail = inventoryValuationDetails.get(item.id);
          const valorTotalWithTax = detail?.confirmedValuationWithTax || 0;
          const valorTotalNoTax = detail?.confirmedValuationNoTax || 0;
          const unitCostWithTax = detail?.averageUnitCostWithTax || 0;
          grandTotalNoTax += valorTotalNoTax;
          grandTotalWithTax += valorTotalWithTax;

          let coberturaTxt = '100% PEPS';
          if (detail?.uncoveredQty && detail.uncoveredQty > 0) {
              coberturaTxt = `⚠️ ${detail.uncoveredQty} s/capa`;
          } else if (!detail?.coveredQty) {
              coberturaTxt = 's/capa';
          }

          const unitCostDisplay = detail?.coveredQty ? formatNumberOnly(unitCostWithTax) : 'PENDIENTE';

          return [
              item.code,
              item.description,
              (item.stock || 0).toString(),
              coberturaTxt,
              unitCostDisplay,
              formatNumberOnly(valorTotalWithTax)
          ];
      });

      autoTable(doc, {
          startY: margin + 80,
          head: [['Código', 'Descripción', 'Stock', 'Estado PEPS', `P. Unit (${selectedCurrency})`, `Valor Total (${selectedCurrency})`]],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 8, cellPadding: 4 },
          columnStyles: {
              0: { cellWidth: 60 },
              2: { halign: 'center' },
              3: { halign: 'center' },
              4: { halign: 'right' },
              5: { halign: 'right' }
          }
      });

      // --- GRAN TOTAL ---
      const finalY = (doc as any).lastAutoTable.finalY || margin + 80;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 138);
      doc.text(`VALORACIÓN TOTAL CONFIRMADA PEPS (${selectedCurrency})`, margin, finalY + 25);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      
      const symbol = selectedCurrency === 'CRC' ? '₡' : '$';
      doc.text(`Base Sin IVA: ${symbol}${formatNumberOnly(grandTotalNoTax)}`, margin, finalY + 40);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Con IVA 13%: ${symbol}${formatNumberOnly(grandTotalWithTax)}`, margin, finalY + 55);

      const fileName = `Exportacion_Inventario_PEPS_${selectedCurrency}_${new Date().toISOString().split('T')[0]}.pdf`;
      const blob = doc.output('blob');
      triggerFileDownload(blob, fileName);
  };

  // Definición de columnas tipadas para DataTable
  const columns = useMemo<TableColumn<InvItemType>[]>(() => {
    const cols: TableColumn<InvItemType>[] = [
      { 
        header: 'Código', 
        align: 'center',
        width: '120px',
        mobileGrid: 'left',
        mobileOrder: 1,
        render: (item) => (
          <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
            {item.code}
          </span>
        )
      },
      { 
        header: 'Material / Descripción', 
        className: 'flex-1 min-w-[200px]',
        mobileGrid: 'full',
        mobileOrder: 3,
        render: (item, index) => {
          const {
            thumbnails,
            hdImages,
            originals,
            primaryThumb,
            primaryHD,
            galleryImages,
            fallbackCandidates,
            hasImages
          } = getItemImageSet(item);

          const isPriority = typeof index === 'number' && index < 8;

          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                className={`w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0 overflow-hidden ${
                  hasImages ? 'cursor-pointer select-none hover:border-blue-400 transition-colors' : 'text-slate-400'
                }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (hasImages) {
                    setPreviewGallery({
                      images: galleryImages,
                      originalImages: originals,
                      currentIndex: 0,
                      title: item.description,
                      code: item.code
                    });
                  }
                }}
                title={hasImages ? "Doble clic para ampliar imagen" : undefined}
              >
                {hasImages ? (
                  <OptimizedImage 
                    src={primaryThumb} 
                    fallbackSrc={primaryHD}
                    fallbackSrcs={fallbackCandidates}
                    alt={item.description}
                    loading={isPriority ? 'eager' : 'lazy'}
                    fetchPriority={isPriority ? 'high' : 'auto'}
                    className="w-full h-full p-0.5 pointer-events-none"
                    referrerPolicy="no-referrer"
                    iconSize={16}
                  />
                ) : (
                  <FiBox className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 flex-1 truncate">
                <div className="font-bold text-slate-900 text-xs truncate" title={item.description}>
                  {item.description}
                </div>
                {item.category && (
                  <span className="text-[10px] text-slate-400 font-medium truncate block">
                    {item.category}
                  </span>
                )}
              </div>
            </div>
          );
        }
      },
      { 
        header: 'Stock', 
        align: 'right',
        width: '110px',
        className: 'text-right',
        mobileGrid: 'right',
        mobileOrder: 2,
        render: (item) => {
           const actualReserved = Math.max(0, item.reserved || 0);
           const available = (item.stock || 0) - actualReserved;
           const isCritical = available <= 0;
           const isLow = available > 0 && available <= item.minStock;
           return (
             <div className="flex flex-col items-end">
               <span className={`font-black text-xs ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                   {available} <span className="text-[10px] text-slate-400 font-normal">{item.unit || 'und'}</span>
               </span>
               {actualReserved > 0 && (
                 <span className="text-[10px] font-bold text-slate-500">
                   ({actualReserved} reservadas)
                 </span>
               )}
             </div>
           );
        }
      }
    ];

    if (isAdmin(currentUser.role)) {
      cols.push({
        header: 'Unitario',
        accessorKey: 'price',
        align: 'right',
        width: '130px',
        className: 'text-right',
        mobileGrid: 'left',
        mobileOrder: 4,
        render: (item) => {
          const detail = inventoryValuationDetails.get(item.id);
          const physicalStock = item.stock || 0;
          const coveredQty = detail?.coveredQty || 0;
          const unitCostWithTax = detail?.averageUnitCostWithTax || 0;

          if (coveredQty > 0) {
            return (
              <div className="flex flex-col items-end">
                <span className="font-mono font-bold text-xs text-slate-700">
                  {selectedCurrency === 'CRC'
                    ? `₡${unitCostWithTax.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${unitCostWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
                <span className="text-[9px] font-bold text-blue-800 uppercase tracking-widest leading-none">
                  PROMEDIO PEPS
                </span>
              </div>
            );
          }

          if (physicalStock > 0 && coveredQty === 0) {
            return (
              <div className="flex flex-col items-end">
                <span className="font-mono font-bold text-xs text-amber-700">
                  PENDIENTE PEPS
                </span>
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest leading-none">
                  SIN CAPA
                </span>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-end">
              <span className="font-mono font-bold text-xs text-slate-400">
                ---
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                SIN STOCK
              </span>
            </div>
          );
        }
      });

      cols.push({
        header: 'Valor Total',
        align: 'right',
        width: '160px',
        className: 'text-right',
        mobileGrid: 'right',
        mobileOrder: 5,
        render: (item) => {
          const detail = inventoryValuationDetails.get(item.id);
          const totalWithTax = detail?.confirmedValuationWithTax || 0;
          const uncoveredQty = detail?.uncoveredQty || 0;
          const physicalStock = item.stock || 0;

          return (
            <div className="flex flex-col items-end gap-0.5">
                <span className="font-mono font-black text-xs text-emerald-700">
                {selectedCurrency === 'CRC'
                  ? `₡${totalWithTax.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `$${totalWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
                {physicalStock === 0 ? (
                  <span className="text-[9px] font-medium text-slate-400">SIN STOCK</span>
                ) : uncoveredQty > 0 ? (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={`${uncoveredQty} unidades físicas sin capa PEPS`}>
                    ⚠️ {uncoveredQty} {item.unit || 'und'} SIN CAPA
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    PEPS CONFIRMADO
                  </span>
                )}
            </div>
          );
        }
      });
    }

    cols.push({
      header: 'Acciones',
      align: 'center',
      width: '160px',
      mobileGrid: 'full',
      mobileOrder: 6,
      render: (item) => (
        <ActionButtons 
            onView={() => setViewingItem(item)}
            onEdit={() => handleEdit(item)}
            onDelete={isAdmin(currentUser.role) ? () => handleDelete(item) : undefined}
        />
      )
    });
    return cols;
  }, [currentUser.role, handleEdit, handleDelete, inventoryValuationDetails, selectedCurrency]);


  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
    <ModulePage 
      title="Inventario General" 
      subtitle="Gestión centralizada de stock, materiales e infraestructura."
    >
          {/* Economic Summary Header Bar for Admins */}
          {isAdmin(currentUser.role) && (
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Valor Confirmado PEPS */}
              <div className="bg-gradient-to-br from-blue-900 to-indigo-950 rounded-2xl p-4 text-white shadow-sm border border-blue-800 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-blue-200">
                    Valor Confirmado PEPS
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-800/80 text-blue-100 border border-blue-700">
                    Con IVA 13%
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
                    {selectedCurrency === 'CRC'
                      ? `₡${globalSummary.totalConfirmedWithTax.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `$${globalSummary.totalConfirmedWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </div>
                  <div className="text-[11px] text-blue-200/80 font-medium mt-0.5">
                    Base sin IVA: {selectedCurrency === 'CRC' ? '₡' : '$'}
                    {globalSummary.totalConfirmedNoTax.toLocaleString(selectedCurrency === 'CRC' ? 'es-CR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Card 2: Existencias Totales */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                  Existencias Físicas
                </div>
                <div className="mt-2">
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {globalSummary.totalPhysicalUnits.toLocaleString('es-CR')} <span className="text-xs font-normal text-slate-500">unidades</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {globalSummary.totalCatalogItems} artículos en catálogo ({globalSummary.totalItemsWithStock} con stock)
                  </div>
                </div>
              </div>

              {/* Card 3: Cobertura PEPS */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                  Estado Cobertura PEPS
                </div>
                <div className="mt-2">
                  {globalSummary.itemsUncoveredCount === 0 ? (
                    <div>
                      <div className="text-base sm:text-lg font-black text-emerald-600 flex items-center gap-1.5">
                        <span>✓ 100% Cobertura Real</span>
                      </div>
                      <div className="text-[11px] text-emerald-700/80 font-medium mt-0.5">
                        Todas las existencias tienen capas de costo auditables.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-base sm:text-lg font-black text-amber-600 flex items-center gap-1.5">
                        <span>⚠️ {globalSummary.itemsUncoveredCount} con pendientes</span>
                      </div>
                      <div className="text-[11px] text-amber-700/80 font-medium mt-0.5">
                        {globalSummary.totalUncoveredUnits.toLocaleString('es-CR')} unidades físicas sin capa PEPS registrada.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Moneda & T.C. Visualización */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                    Moneda Visualización
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  <div className="inline-flex p-1 bg-slate-200/80 rounded-xl w-full">
                    <button
                      type="button"
                      onClick={() => setSelectedCurrency('CRC')}
                      className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all ${
                        selectedCurrency === 'CRC'
                          ? 'bg-white text-blue-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ₡ Colones (CRC)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCurrency('USD')}
                      className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all ${
                        selectedCurrency === 'USD'
                          ? 'bg-white text-blue-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      $ Dólares (USD)
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold text-center">
                    T.C. Referencial: ₡515.00 / USD
                  </div>
                </div>
              </div>
            </div>
          )}

          <ModuleToolbar>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {selectedId ? (
                    <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-xl animate-in slide-in-from-top-2 duration-300">
                        <span className="text-xs font-bold text-yellow-800">Mostrando resultado de búsqueda</span>
                        <ActionButton 
                            onClick={onClearSelectedId} 
                            label="Ver todos" 
                            variant="secondary" 
                            className="h-7 px-3 text-[10px] bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                        />
                    </div>
                  ) : (
                    <>
                      {/* Mobile Filters: Exactly 2 Rows */}
                      <div className="block md:hidden space-y-2 w-full">
                        <div className="grid grid-cols-2 gap-2">
                          <SearchInput 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Buscar por código..."
                              className="w-full"
                          />
                          <Select
                              options={[
                                { label: 'Todas las Categorías', value: 'all' },
                                ...categories.map(c => ({ label: c, value: c }))
                              ]}
                              value={categoryFilter}
                              onChange={val => setCategoryFilter(val)}
                              className="w-full"
                              isSearchable={false}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                              options={[
                                { label: 'Todo el Stock', value: 'all' },
                                { label: 'Suficiente (Verde)', value: 'ok' },
                                { label: 'Bajo (Naranja)', value: 'low' },
                                { label: 'Sin Stock (Rojo)', value: 'critical' }
                              ]}
                              value={stockStatusFilter}
                              onChange={val => setStockStatusFilter(val as any)}
                              className="w-full"
                              isSearchable={false}
                          />
                          <Select
                              options={[
                                { label: 'Código (A-Z)', value: 'code-asc' },
                                { label: 'Ordenar por...', value: 'default' },
                                { label: 'Código (Z-A)', value: 'code-desc' },
                                { label: 'Descripción (A-Z)', value: 'description-asc' },
                                { label: 'Descripción (Z-A)', value: 'description-desc' },
                                { label: 'Stock (Menor a Mayor)', value: 'stock-asc' },
                                { label: 'Stock (Mayor a Menor)', value: 'stock-desc' },
                                { label: 'Valor Total (Menor a Mayor)', value: 'total-asc' },
                                { label: 'Valor Total (Mayor a Menor)', value: 'total-desc' }
                              ]}
                              value={sortConfig ? `${sortConfig.key}-${sortConfig.direction}` : 'default'}
                              onChange={val => {
                                if (val === 'default') {
                                  setSortConfig(null);
                                } else {
                                  const [key, direction] = val.split('-') as [keyof InvItemType, 'asc' | 'desc'];
                                  setSortConfig({key, direction});
                                }
                              }}
                              className="w-full"
                              isSearchable={false}
                          />
                        </div>
                      </div>

                      {/* Desktop Filters: Original Inline Layout */}
                      <div className="hidden md:flex items-center gap-2 w-full">
                        <SearchInput 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por código, descripción..."
                            className="w-64"
                        />
                        <Select
                            options={[
                              { label: 'Todas las Categorías', value: 'all' },
                              ...categories.map(c => ({ label: c, value: c }))
                            ]}
                            value={categoryFilter}
                            onChange={val => setCategoryFilter(val)}
                            className="w-48"
                            isSearchable={false}
                        />
                        <Select
                            options={[
                              { label: 'Todo el Stock', value: 'all' },
                              { label: 'Suficiente (Verde)', value: 'ok' },
                              { label: 'Bajo (Naranja)', value: 'low' },
                              { label: 'Sin Stock (Rojo)', value: 'critical' }
                            ]}
                            value={stockStatusFilter}
                            onChange={val => setStockStatusFilter(val as any)}
                            className="w-48"
                            isSearchable={false}
                        />
                        <Select
                            options={[
                              { label: 'Ordenar por...', value: 'default' },
                              { label: 'Código (A-Z)', value: 'code-asc' },
                              { label: 'Código (Z-A)', value: 'code-desc' },
                              { label: 'Descripción (A-Z)', value: 'description-asc' },
                              { label: 'Descripción (Z-A)', value: 'description-desc' },
                              { label: 'Stock (Menor a Mayor)', value: 'stock-asc' },
                              { label: 'Stock (Mayor a Menor)', value: 'stock-desc' },
                              { label: 'Valor Total (Menor a Mayor)', value: 'total-asc' },
                              { label: 'Valor Total (Mayor a Menor)', value: 'total-desc' }
                            ]}
                            value={sortConfig ? `${sortConfig.key}-${sortConfig.direction}` : 'default'}
                            onChange={val => {
                              if (val === 'default') {
                                setSortConfig(null);
                              } else {
                                const [key, direction] = val.split('-') as [keyof InvItemType, 'asc' | 'desc'];
                                setSortConfig({key, direction});
                              }
                            }}
                            className="w-48"
                            isSearchable={false}
                        />
                      </div>
                    </>
                  )}
              </div>
              
              <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                  {isAdmin(currentUser.role) && (
                    <ActionButton
                      onClick={() => setShowReconcileModal(true)}
                      label="Conciliar Capas PEPS"
                      variant="secondary"
                      className="bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 font-bold"
                    />
                  )}
                  <IconButton icon={<ACTION_ICONS.excel />} variant="success" onClick={handleExportExcel} title="Exportar Excel" />
                  <IconButton icon={<ACTION_ICONS.pdf />} variant="danger" onClick={handleExportPDF} title="Exportar PDF" />
                  <ActionButton 
                      onClick={() => { setEditingItem(null); setShowModal(true); }}
                      label="Nuevo Material"
                  />
              </div>
          </ModuleToolbar>

          {isLoading ? (
            <div className="flex justify-center items-center p-20 text-blue-900 font-bold bg-white rounded-xl border border-blue-100">
              Cargando catálogo...
            </div>
          ) : filteredItems.length === 0 && items.length === 0 ? (
            <div className="flex justify-center items-center p-20 text-slate-500 font-bold bg-white rounded-xl border border-slate-200">
              No hay datos disponibles en el inventario.
            </div>
          ) : (
            <>
              {/* Desktop View: DataTable untouched */}
              <div className="hidden md:block">
                <DataTable 
                    data={filteredItems}
                    columns={columns}
                    keyExtractor={(item: InvItemType) => item.id}
                    isLoading={isLoading}
                    emptyMessage="No se encontraron materiales que coincidan con la búsqueda."
                    enableVirtualization={true}
                    virtualHeight={600}
                    highlightedId={selectedId}
                    className="inventory-grid"
                    hideMobileView={true}
                />
              </div>

              {/* Mobile View: Redesigned Compact Cards */}
              <div className="md:hidden space-y-3">
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                    No se encontraron materiales que coincidan con la búsqueda.
                  </div>
                ) : (
                  filteredItems.map((item, index) => {
                    const isHighlighted = selectedId && item.id === selectedId;
                    const {
                      thumbnails,
                      hdImages,
                      originals,
                      primaryThumb,
                      primaryHD,
                      galleryImages,
                      fallbackCandidates,
                      hasImages
                    } = getItemImageSet(item);

                    const isPriority = index < 8;

                    const actualReserved = Math.max(0, item.reserved || 0);
                    const available = (item.stock || 0) - actualReserved;
                    const isCritical = available <= 0;
                    const isLow = available > 0 && available <= item.minStock;

                    let rawPrice = item.price || 0;
                    if (item.providers && item.providers.length > 0) {
                        const sum = item.providers.reduce((acc, p) => acc + p.price, 0);
                        rawPrice = sum / item.providers.length;
                    }
                    const itemCurrency = item.currency || 'USD';
                    let convertedPrice = rawPrice;
                    if (itemCurrency === 'CRC' && selectedCurrency === 'USD') {
                        convertedPrice = rawPrice / EXCHANGE_RATE_LIST_VIEW;
                    } else if (itemCurrency === 'USD' && selectedCurrency === 'CRC') {
                        convertedPrice = rawPrice * EXCHANGE_RATE_LIST_VIEW;
                    }
                    const priceWithTax = convertedPrice * 1.13;

                    const detail = inventoryValuationDetails.get(item.id);
                    const totalWithTax = detail?.confirmedValuationWithTax || 0;
                    const uncoveredQty = detail?.uncoveredQty || 0;
                    const physicalStock = item.stock || 0;

                    return (
                      <div 
                        key={item.id}
                        className={`bg-white rounded-2xl border p-3.5 shadow-sm transition-all ${
                          isHighlighted 
                            ? 'bg-yellow-50 border-yellow-400 ring-4 ring-yellow-200/50 relative z-10' 
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Header Area: Photo + Code/Description/Category + Actions */}
                        <div className="flex items-start gap-3">
                          {/* Photo Thumbnail */}
                          <div 
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden ${
                              hasImages ? 'cursor-pointer select-none active:scale-95 transition-transform' : 'text-slate-400'
                            }`}
                            onClick={() => {
                              if (hasImages) {
                                setPreviewGallery({
                                  images: galleryImages,
                                  originalImages: originals,
                                  currentIndex: 0,
                                  title: item.description,
                                  code: item.code
                                });
                              }
                            }}
                            title={hasImages ? "Tocar para ampliar imagen" : undefined}
                          >
                            {hasImages ? (
                              <OptimizedImage 
                                src={primaryThumb} 
                                fallbackSrc={primaryHD}
                                fallbackSrcs={fallbackCandidates}
                                alt={item.description}
                                loading={isPriority ? 'eager' : 'lazy'}
                                fetchPriority={isPriority ? 'high' : 'auto'}
                                className="w-full h-full p-0.5 pointer-events-none"
                                referrerPolicy="no-referrer"
                                iconSize={20}
                              />
                            ) : (
                              <FiBox className="w-5 h-5 text-slate-300" />
                            )}
                          </div>

                          {/* Code, Description, Category */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-black text-[10px] rounded-md tracking-wider">
                                {item.code}
                              </span>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <IconButton 
                                  icon={<ACTION_ICONS.view />} 
                                   variant="primary" 
                                   onClick={() => setViewingItem(item)} 
                                   title="Ver detalle"
                                   className="w-7 h-7"
                                />
                                <IconButton 
                                  icon={<ACTION_ICONS.edit />} 
                                   variant="primary" 
                                   onClick={() => handleEdit(item)} 
                                   title="Editar"
                                   className="w-7 h-7"
                                />
                                {isAdmin(currentUser.role) && (
                                  <IconButton 
                                    icon={<ACTION_ICONS.delete />} 
                                   variant="danger" 
                                   onClick={() => handleDelete(item)} 
                                   title="Eliminar"
                                   className="w-7 h-7"
                                  />
                                )}
                              </div>
                            </div>

                            <h4 className="font-bold text-blue-950 text-xs sm:text-sm leading-snug mt-1 line-clamp-2">
                              {item.description}
                            </h4>

                            {item.category && (
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 truncate">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-100 my-3" />

                        {/* Bottom Section: Stock, Unitario, Valor Total */}
                        <div className={`grid ${isAdmin(currentUser.role) ? 'grid-cols-[68px_1fr_1fr]' : 'grid-cols-1'} gap-1.5 text-center`}>
                          {/* Stock */}
                          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Stock</span>
                            <span className={`font-black text-xs sm:text-sm ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                              {available}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 leading-none mt-0.5">
                              {item.unit || 'Unidad'}
                            </span>
                            {actualReserved > 0 && (
                              <span className="text-[8px] font-bold text-amber-700 mt-0.5">
                                ({actualReserved} res.)
                              </span>
                            )}
                          </div>

                          {/* Unitario (Admin) */}
                          {isAdmin(currentUser.role) && (
                            <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Unitario</span>
                              <span className="font-mono font-bold text-xs text-slate-700 truncate w-full">
                                {selectedCurrency === 'CRC'
                                  ? `₡${priceWithTax.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : `$${priceWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                                INC. IVA
                              </span>
                            </div>
                          )}

                          {/* Valor Total (Admin) */}
                          {isAdmin(currentUser.role) && (
                            <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Valor Total</span>
                              <span className="font-mono font-black text-xs text-emerald-700 truncate w-full">
                                {selectedCurrency === 'CRC'
                                  ? `₡${totalWithTax.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : `$${totalWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </span>
                              {physicalStock === 0 ? (
                                <span className="text-[8px] font-medium text-slate-400 mt-0.5">SIN STOCK</span>
                              ) : uncoveredQty > 0 ? (
                                <span className="text-[8px] font-bold text-amber-700 mt-0.5 truncate w-full">
                                  ⚠️ {uncoveredQty} s/capa
                                </span>
                              ) : (
                                <span className="text-[8px] font-bold text-emerald-700 mt-0.5">
                                  PEPS OK
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          <InventoryModal 
              show={showModal}
              onClose={() => setShowModal(false)}
              onSubmit={handleSave}
              checkCodeStatus={checkCodeStatus}
              currentUser={currentUser}
              initialData={editingItem}
              uniqueProviders={uniqueProviders}
              uniqueCategories={uniqueCategories}
              uniqueLocations={uniqueLocations}
          />

          <InventoryDetailModal 
              show={!!viewingItem}
              onClose={() => { setViewingItem(null); onClearSelectedId?.(); }}
              item={viewingItem}
              currentUser={currentUser}
              onImagesUpdate={(imageUrls, thumbnailUrls, originalImageUrls) => {
                if (viewingItem) {
                  const primaryImage = imageUrls.length > 0 ? imageUrls[0] : '';
                  const primaryThumb = thumbnailUrls && thumbnailUrls.length > 0 ? thumbnailUrls[0] : primaryImage;
                  const primaryOriginal = originalImageUrls && originalImageUrls.length > 0 ? originalImageUrls[0] : primaryImage;
                  updateInventoryItem(viewingItem.id, { 
                    imageUrls, 
                    imageUrl: primaryImage,
                    thumbnailUrls: thumbnailUrls || [],
                    thumbnailUrl: primaryThumb,
                    originalImageUrls: originalImageUrls || [],
                    originalImageUrl: primaryOriginal
                  });
                  setViewingItem(prev => prev ? { 
                    ...prev, 
                    imageUrls, 
                    imageUrl: primaryImage,
                    thumbnailUrls: thumbnailUrls || [],
                    thumbnailUrl: primaryThumb,
                    originalImageUrls: originalImageUrls || [],
                    originalImageUrl: primaryOriginal
                  } : null);
                }
              }}
              onImageUpdate={(imageUrl, thumbnailUrl, originalImageUrl) => {
                if (viewingItem) {
                  updateInventoryItem(viewingItem.id, { imageUrl, thumbnailUrl, originalImageUrl });
                  setViewingItem(prev => prev ? { ...prev, imageUrl, thumbnailUrl, originalImageUrl } : null);
                }
              }}
          />

          {previewGallery && (
            <ImageViewerModal
              images={previewGallery.images}
              originalImages={previewGallery.originalImages}
              currentUser={currentUser}
              initialIndex={previewGallery.currentIndex}
              title={previewGallery.title}
              code={previewGallery.code}
              onClose={() => setPreviewGallery(null)}
            />
          )}

          <ReconcileInventoryModal
            show={showReconcileModal}
            onClose={() => setShowReconcileModal(false)}
            items={items}
            movements={movements}
            costLayers={costLayers}
            currentUser={currentUser}
          />
      </ModulePage>
    </div>
  );
};

export default InventoryModule;