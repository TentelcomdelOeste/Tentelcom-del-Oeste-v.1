import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import { InventoryModal } from './InventoryModal';
import { InventoryDetailModal } from './InventoryDetailModal';
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
  const [editingItem, setEditingItem] = useState<InvItemType | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{
    images: string[];
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

  // Cálculo del Valor Real del Inventario (FIFO/Ponderado según entradas)
  const inventoryValuation = useMemo(() => {
      const valuation = new Map<string, number>();

      items.forEach(item => {
          // 1. Obtener movimientos de entrada para este item
          const entries = movements
              .filter(m => m.type === 'Entrada')
              .flatMap(m => {
                  // Soporte para estructura nueva (items array) y legacy
                  if (m.items && m.items.length > 0) {
                      return m.items
                          .filter(i => i.inventoryItemId === item.id)
                          .map(i => ({
                              date: new Date(m.date).getTime(), // Usar timestamp para ordenamiento preciso
                              quantity: i.quantity,
                              price: i.unitPrice || 0, // Precio real de la entrada
                              total: i.total || 0
                          }));
                  } else if (m.inventoryItemId === item.id) {
                      // Legacy structure
                      return [{
                          date: new Date(m.date).getTime(),
                          quantity: m.quantity,
                          price: 0, // No tenemos precio en legacy, asumiremos 0 o precio admin
                          total: 0
                      }];
                  }
                  return [];
              })
              .sort((a, b) => b.date - a.date); // Ordenar descendente (más reciente primero)

          let remainingStock = item.stock;
          let totalValue = 0;

          // 2. Recorrer entradas para cubrir el stock actual (Lógica FIFO inversa para valoración actual)
          for (const entry of entries) {
              if (remainingStock <= 0) break;

              const quantityToValue = Math.min(remainingStock, entry.quantity);
              
              // Si la entrada tiene precio real, lo usamos. Si no (legacy), usamos el precio admin actual como fallback.
              const entryPrice = entry.price > 0 ? entry.price : (item.price || 0);
              
              totalValue += quantityToValue * entryPrice;
              remainingStock -= quantityToValue;
          }

          // 3. Si queda stock sin cubrir (ej: stock inicial sin movimientos), valorarlo a precio actual
          if (remainingStock > 0) {
              totalValue += remainingStock * (item.price || 0);
          }

          valuation.set(item.id, totalValue);
      });

      return valuation;
  }, [items, movements]);

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

  const handleSave = async (data: any) => {
      if (editingItem) {
          await updateInventoryItem(editingItem.id, data);
      } else {
          await addInventoryItem(data);
      }
  };

  const handleExportExcel = () => {
      const dataToExport = filteredItems.map(item => ({
          "Código": item.code,
          "Descripción": item.description,
          "Categoría": item.category,
          "Stock Actual": item.stock,
          "Unidad": item.unit,
          "Precio Unitario": item.price || 0,
          "Valor Total": inventoryValuation.get(item.id) || 0,
          "Proveedores": item.providers?.join(', ') || ''
      }));
      exportToExcel(dataToExport, `Inventario_General_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  };

  const handleExportPDF = async () => {
      const doc = new jsPDF('p', 'pt', 'letter');
      const margin = 40;
      
      const formatNumberOnly = (amount: number) => {
          return new Intl.NumberFormat('es-CR', {
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
      doc.text("Reporte de Inventario General", headerTextX, textY);

      textY += 15;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-CR')}`, headerTextX, textY);
      
      // --- TABLE ---
      let totalCRC = 0;
      let totalUSD = 0;

      const tableData = filteredItems.map(item => {
          const valorTotal = inventoryValuation.get(item.id) || 0;
          const moneda = item.currency || 'CRC';
          
          if (moneda === 'USD') {
              totalUSD += valorTotal;
          } else {
              totalCRC += valorTotal;
          }

          return [
              item.code,
              item.description,
              item.stock.toString(),
              moneda,
              formatNumberOnly(item.price || 0),
              formatNumberOnly(valorTotal)
          ];
      });

      autoTable(doc, {
          startY: margin + 80,
          head: [['Código', 'Descripción', 'Stock', 'Moneda', 'Precio Unit.', 'Valor Total']],
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
      doc.text("GRAN TOTAL DEL INVENTARIO", margin, finalY + 30);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      
      let currentY = finalY + 45;
      if (totalCRC > 0 || totalUSD === 0) {
          doc.text(`Total CRC: ${formatNumberOnly(totalCRC)}`, margin, currentY);
          currentY += 15;
      }
      if (totalUSD > 0) {
          doc.text(`Total USD: ${formatNumberOnly(totalUSD)}`, margin, currentY);
      }

      const fileName = `Exportacion_Inventario_${new Date().toISOString().split('T')[0]}.pdf`;
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
        render: (item) => {
          const images = (() => {
            if (!item) return [];
            if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
              return item.imageUrls.filter(Boolean);
            }
            if (item.imageUrl) {
              return [item.imageUrl];
            }
            return [];
          })();
          const primaryImage = images.length > 0 ? images[0] : '';
          const hasImages = images.length > 0;
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
                      images,
                      currentIndex: 0,
                      title: item.description,
                      code: item.code
                    });
                  }
                }}
                title={hasImages ? "Doble clic para ampliar imagen" : undefined}
              >
                {hasImages ? (
                  <img 
                    src={primaryImage} 
                    alt={item.description}
                    className="w-full h-full object-contain p-0.5 pointer-events-none"
                    referrerPolicy="no-referrer"
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
        width: '120px',
        className: 'text-right',
        mobileGrid: 'left',
        mobileOrder: 4,
        render: (item) => {
          let displayPrice = item.price || 0;
          if (item.providers && item.providers.length > 0) {
              const sum = item.providers.reduce((acc, p) => acc + p.price, 0);
              displayPrice = sum / item.providers.length;
          }
          const priceWithTax = displayPrice * 1.13;
          return (
            <div className="flex flex-col items-end">
                <span className="font-mono font-bold text-xs text-slate-700">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(priceWithTax)}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Inc. IVA</span>
            </div>
          );
        }
      });

      cols.push({
        header: 'Valor Total',
        align: 'right',
        width: '150px',
        className: 'text-right',
        mobileGrid: 'right',
        mobileOrder: 5,
        render: (item) => {
          const realTotalValue = inventoryValuation.get(item.id) || 0;
          const totalWithTax = realTotalValue * 1.13;
          return (
            <div className="flex flex-col items-end">
                <span className="font-mono font-black text-xs text-emerald-700">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(totalWithTax)}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">FIFO BASE</span>
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
  }, [currentUser.role, handleEdit, handleDelete, inventoryValuation]);


  return (
    <div className="-mx-2 md:-mx-4 -mt-4">
    <ModulePage 
      title="Inventario General" 
      subtitle="Gestión centralizada de stock, materiales e infraestructura."
    >
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
                  filteredItems.map((item) => {
                    const isHighlighted = selectedId && item.id === selectedId;
                    const images = (() => {
                      if (!item) return [];
                      if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
                        return item.imageUrls.filter(Boolean);
                      }
                      if (item.imageUrl) {
                        return [item.imageUrl];
                      }
                      return [];
                    })();
                    const primaryImage = images.length > 0 ? images[0] : '';
                    const hasImages = images.length > 0;

                    const actualReserved = Math.max(0, item.reserved || 0);
                    const available = (item.stock || 0) - actualReserved;
                    const isCritical = available <= 0;
                    const isLow = available > 0 && available <= item.minStock;

                    let displayPrice = item.price || 0;
                    if (item.providers && item.providers.length > 0) {
                        const sum = item.providers.reduce((acc, p) => acc + p.price, 0);
                        displayPrice = sum / item.providers.length;
                    }
                    const priceWithTax = displayPrice * 1.13;
                    const realTotalValue = inventoryValuation.get(item.id) || 0;
                    const totalWithTax = realTotalValue * 1.13;

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
                                  images,
                                    currentIndex: 0,
                                    title: item.description,
                                    code: item.code
                                });
                              }
                            }}
                            title={hasImages ? "Tocar para ampliar imagen" : undefined}
                          >
                            {hasImages ? (
                              <img 
                                src={primaryImage} 
                                alt={item.description}
                                className="w-full h-full object-contain p-0.5 pointer-events-none"
                                referrerPolicy="no-referrer"
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
                          <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex flex-col items-center">
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
                            <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex flex-col items-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Unitario</span>
                              <span className="font-mono font-bold text-xs sm:text-sm text-slate-700 truncate w-full">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(priceWithTax)}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                                INC. IVA
                              </span>
                            </div>
                          )}

                          {/* Valor Total (Admin) */}
                          {isAdmin(currentUser.role) && (
                            <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex flex-col items-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Valor Total</span>
                              <span className="font-mono font-black text-xs sm:text-sm text-emerald-700 truncate w-full">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(totalWithTax)}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                                FIFO BASE
                              </span>
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
              onImagesUpdate={(imageUrls) => {
                if (viewingItem) {
                  const primaryImage = imageUrls.length > 0 ? imageUrls[0] : '';
                  updateInventoryItem(viewingItem.id, { imageUrls, imageUrl: primaryImage });
                  setViewingItem(prev => prev ? { ...prev, imageUrls, imageUrl: primaryImage } : null);
                }
              }}
              onImageUpdate={(imageUrl) => {
                if (viewingItem) {
                  updateInventoryItem(viewingItem.id, { imageUrl });
                  setViewingItem(prev => prev ? { ...prev, imageUrl } : null);
                }
              }}
          />

          {previewGallery && (
            <ImageViewerModal
              images={previewGallery.images}
              initialIndex={previewGallery.currentIndex}
              title={previewGallery.title}
              code={previewGallery.code}
              onClose={() => setPreviewGallery(null)}
            />
          )}
      </ModulePage>
    </div>
  );
};

export default InventoryModule;