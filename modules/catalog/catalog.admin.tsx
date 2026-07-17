
import React, { useState, useMemo, useCallback } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { useAuth } from '../../hooks/useAuth';
import { Product } from '../../types';
import { ModuleHeader } from '../../components/ui/ModuleHeader';
import { formatCurrency } from '../../utils/formatCurrency';
import { useConfirm, StatusBadge, IconButton, ACTION_ICONS, SearchInput, DataTable, TableColumn, ActionButton } from '../../design-system';
import { FiSearch } from "react-icons/fi";

export const CatalogAdminModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    catalog, 
    addProduct,
    updateProduct,
    deactivateProduct, 
    checkCodeExists,
    isLoading, 
    loadMore, 
    hasMore, 
    loadingMore 
  } = useCatalog(currentUser);
  const confirm = useConfirm();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'name' | 'price_asc' | 'price_desc'>('name');

  // Estado para Modal de Edición/Creación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
      codigo: '',
      nombre: '',
      precioBase: '',
      moneda: 'USD' as 'USD' | 'CRC'
  });
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = useCallback((product?: Product) => {
      if (product) {
          setEditingProduct(product);
          setFormData({
              codigo: product.codigo,
              nombre: product.nombre,
              precioBase: product.precioBase.toString(),
              moneda: product.moneda || 'USD'
          });
      } else {
          setEditingProduct(null);
          setFormData({
              codigo: '',
              nombre: '',
              precioBase: '',
              moneda: 'USD'
          });
      }
      setError(null);
      setIsModalOpen(true);
  }, []);

  const handleSave = async () => {
      setError(null);
      const code = formData.codigo.trim().toUpperCase();
      const name = formData.nombre.trim();
      const price = parseFloat(formData.precioBase);

      if (!code || !name || isNaN(price)) {
          setError("Todos los campos son obligatorios.");
          return;
      }

      // Validaciones de Duplicados
      // 1. Validar Código Único y Permanente (Incluso eliminados)
      const codeExists = await checkCodeExists(code, editingProduct?.id);
      if (codeExists) {
          setError("El código ya existe en el sistema y no puede ser reutilizado, incluso si el registro fue eliminado.");
          return;
      }
      
      // 2. Validar Descripción Única (Solo activos)
      const otherWithSameName = catalog.find(p => 
          p.isActive !== false && 
          p.nombre.trim().toLowerCase() === name.toLowerCase() && 
          p.id !== editingProduct?.id
      );

      if (otherWithSameName) {
          setError("La descripción ya existe en el sistema. No se permiten duplicados");
          return;
      }

      try {
          if (editingProduct) {
              await updateProduct(editingProduct.id, {
                  codigo: code,
                  nombre: name,
                  precioBase: price,
                  moneda: formData.moneda
              });
          } else {
              await addProduct({
                  id: '', // Firestore generará uno
                  codigo: code,
                  nombre: name,
                  precioBase: price,
                  moneda: formData.moneda,
                  isActive: true
              });
          }
          setIsModalOpen(false);
      } catch (err: any) {
          setError("Error al guardar: " + err.message);
      }
  };

  // Debounce para el buscador
  React.useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedSearchTerm(searchTerm);
      }, 300);
      return () => clearTimeout(handler);
  }, [searchTerm]);
  
  // Lógica de Filtrado y Ordenamiento
  const filteredProducts = useMemo(() => {
    return catalog
      .filter(p => {
        // COMPATIBILIDAD: Mostrar si isActive es true O si es undefined (registros antiguos)
        if (p.isActive === false) return false;

        const term = debouncedSearchTerm.toLowerCase();
        const matchesSearch = 
          p.nombre.toLowerCase().includes(term) || 
          p.codigo.toLowerCase().includes(term);
        
        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortOrder === 'price_asc') return a.precioBase - b.precioBase;
        if (sortOrder === 'price_desc') return b.precioBase - a.precioBase;
        return a.nombre.localeCompare(b.nombre);
      });
  }, [catalog, debouncedSearchTerm, sortOrder]);

  const handleDeleteClick = useCallback(async (product: Product) => {
      const shouldDelete = await confirm({
          title: "¿Eliminar Producto?",
          description: `Se eliminará "${product.nombre}" del catálogo. ¿Desea continuar?`,
          confirmLabel: "Eliminar",
          variant: "danger"
      });

      if (shouldDelete) {
          try {
              // Eliminación Lógica: Update isActive = false
              await deactivateProduct(product.id);
          } catch (error: any) {
              await confirm({
                  title: "Error",
                  description: "Error al eliminar: " + error.message,
                  confirmLabel: "Cerrar",
                  variant: "warning"
              });
          }
      }
  }, [confirm, deactivateProduct]);

  const columns = useMemo<TableColumn<Product>[]>(() => [
    {
      header: "Producto / Servicio",
      mobileGrid: "full",
      mobileOrder: 1,
      render: (product) => (
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{product.codigo}</span>
          <p className="font-black text-blue-900 text-sm truncate whitespace-normal" title={product.nombre}>
            {product.nombre}
          </p>
        </div>
      )
    },
    {
      header: "Estado",
      width: "100px",
      align: "center",
      mobileGrid: "right",
      mobileOrder: 2,
      render: () => <StatusBadge label="Activo" variant="success" />
    },
    {
      header: "Precio Base",
      width: "120px",
      align: "right",
      mobileGrid: "right",
      mobileOrder: 3,
      render: (product) => (
        <span className="text-base font-black text-blue-600 tracking-tight">
          {formatCurrency(product.precioBase, product.moneda || 'USD')}
        </span>
      )
    },
    {
      header: "Acciones",
      width: "120px",
      align: "center",
      mobileGrid: "full",
      mobileOrder: 4,
      render: (product) => (
        <div className="flex justify-center gap-2">
            <IconButton 
                icon={<ACTION_ICONS.edit />}
                onClick={() => handleOpenModal(product)}
                variant="secondary"
                title="Editar Producto"
            />
            <IconButton 
                icon={<ACTION_ICONS.delete />}
                onClick={() => handleDeleteClick(product)}
                variant="danger"
                title="Eliminar Producto"
            />
        </div>
      )
    }
  ], [handleDeleteClick, handleOpenModal]);

  return (
    <div className="p-4 md:p-10 min-h-full">
      {/* Header Sticky */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-6 pt-2">
        <div className="flex flex-col gap-4">
          <ModuleHeader
            title="Catálogo de Productos"
            subtitle="Gestión de productos y servicios para cotizaciones"
          />

          {/* Barra de Herramientas */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
            
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1">
                <div className="relative w-full md:flex-1">
                   <SearchInput 
                        placeholder="Buscar por nombre o Código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="text-base md:text-sm"
                   />
                </div>

                <div className="w-px h-8 bg-slate-200 hidden md:block"></div>

                <select 
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full md:w-40 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none cursor-pointer hover:bg-slate-100 transition-all text-blue-600"
                >
                    <option value="name">A-Z Nombre</option>
                    <option value="price_asc">Precio: Menor a Mayor</option>
                    <option value="price_desc">Precio: Mayor a Menor</option>
                </select>
            </div>

            <div className="hidden md:block text-right flex-none">
                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Total Ítems</p>
                <p className="text-2xl font-black text-blue-900">{filteredProducts.length}</p>
            </div>

            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                <ActionButton 
                    onClick={() => handleOpenModal()}
                    label="Nuevo Producto"
                />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edición/Creación */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-xl font-black text-blue-950">
                              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                          </h3>
                          <p className="text-xs font-bold text-slate-500">Complete la información del catálogo</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                          <ACTION_ICONS.close className="text-slate-500" />
                      </button>
                  </div>

                  <div className="p-6 space-y-4">
                      {error && (
                          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-bold animate-shake">
                              <ACTION_ICONS.alert className="flex-none" />
                              {error}
                          </div>
                      )}

                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código</label>
                          <input 
                              type="text"
                              value={formData.codigo}
                              onChange={e => setFormData({...formData, codigo: e.target.value})}
                              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all uppercase"
                              placeholder="Ej: SERV-001"
                          />
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción / Nombre</label>
                          <textarea 
                              value={formData.nombre}
                              onChange={e => setFormData({...formData, nombre: e.target.value})}
                              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all min-h-[100px] resize-none"
                              placeholder="Descripción detallada del producto o servicio..."
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio Base</label>
                              <input 
                                  type="number"
                                  value={formData.precioBase}
                                  onChange={e => setFormData({...formData, precioBase: e.target.value})}
                                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                  placeholder="0.00"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Moneda</label>
                              <select 
                                  value={formData.moneda}
                                  onChange={e => setFormData({...formData, moneda: e.target.value as any})}
                                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
                              >
                                  <option value="USD">USD - Dólares</option>
                                  <option value="CRC">CRC - Colones</option>
                              </select>
                          </div>
                      </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button 
                          onClick={() => setIsModalOpen(false)}
                          className="flex-1 px-6 py-3 rounded-xl font-black text-sm text-slate-600 hover:bg-slate-200 transition-all"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleSave}
                          className="flex-1 px-6 py-3 rounded-xl font-black text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                      >
                          {editingProduct ? 'Guardar' : 'Crear Producto'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Vista de Tabla */}
      <div className="bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden">
        <DataTable<Product> 
            data={filteredProducts}
            columns={columns}
            keyExtractor={(p) => p.id}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            isLoadingMore={loadingMore}
            enableVirtualization={true}
            virtualHeight={600}
            emptyMessage={
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6 text-3xl">
                        <FiSearch  />
                    </div>
                    <h3 className="text-xl font-black text-blue-950 mb-2">No se encontraron productos</h3>
                    <p className="text-slate-500 text-sm font-bold">No hay ítems activos o no coinciden con la búsqueda.</p>
                </div>
            }
        />
      </div>
    </div>
  );
};
