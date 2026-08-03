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
    isLoading,
    loadMore,
    hasMore,
    loadingMore
  } = useInventory(currentUser);
  
  const { movements } = useInventoryMovements(currentUser);
  const confirm = useConfirm();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'ok' | 'low' | 'critical'>('all');
  const [sortConfig, setSortConfig] = useState<{key: keyof InvItemType, direction: 'asc' | 'desc'}>({ key: "code", direction: "asc" });
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InvItemType | null>(null);

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
        accessorKey: 'code', 
        align: 'left',
        width: '120px',
        className: 'font-black text-slate-700',
        mobileGrid: 'left',
        mobileOrder: 1,
        render: (item) => <span>{item.code}</span>
      },
      { 
        header: 'Descripción', 
        accessorKey: 'description', 
        align: 'left',
        width: '300px',
        className: 'font-bold text-blue-900',
        mobileGrid: 'full',
        mobileOrder: 3
      },
      { 
        header: 'Stock', 
        align: 'right',
        width: '100px',
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
               <span className={`font-black ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                   {available}
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
                <span className="font-mono font-bold text-slate-700">
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
                <span className="font-mono font-black text-emerald-700">
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
                      <SearchInput 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar por código, descripción..."
                          className="w-full md:w-64"
                      />
                      <Select
                          options={[
                            { label: 'Todas las Categorías', value: 'all' },
                            ...categories.map(c => ({ label: c, value: c }))
                          ]}
                          value={categoryFilter}
                          onChange={val => setCategoryFilter(val)}
                          className="w-full md:w-48"
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
                          className="w-full md:w-48"
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
                          className="w-full md:w-48"
                          isSearchable={false}
                      />
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
            <DataTable 
                data={filteredItems}
                columns={columns}
                keyExtractor={(item: InvItemType) => item.id}
                isLoading={isLoading}
                emptyMessage="No se encontraron materiales que coincidan con la búsqueda."
                hasMore={hasMore}
                onLoadMore={loadMore}
                isLoadingMore={loadingMore}
                enableVirtualization={true}
                virtualHeight={600}
                highlightedId={selectedId}
                className="inventory-grid"
            />
          )}

          <InventoryModal 
              show={showModal}
              onClose={() => setShowModal(false)}
              onSubmit={handleSave}
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
          />
      </ModulePage>
    </div>
  );
};

export default InventoryModule;