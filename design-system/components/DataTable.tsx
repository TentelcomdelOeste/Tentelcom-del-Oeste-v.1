import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { UI_TOKENS } from '../UI_TOKENS';
import { FiLoader, FiChevronLeft, FiChevronRight, FiPlus } from "react-icons/fi";

export interface TableColumn<T> {
  header: string;
  accessorKey?: keyof T; // Clave directa del objeto
  render?: (item: T) => React.ReactNode; // Render personalizado
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  mobileGrid?: 'left' | 'right' | 'full'; // Posición en grid móvil
  mobileOrder?: number; // Orden en vista móvil
}

interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  keyExtractor?: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  // Pagination Props (Traditional)
  page?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
  totalRecords?: number;
  // Infinite Loading Props
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  // Virtualization Props
  enableVirtualization?: boolean;
  rowHeight?: number;
  virtualHeight?: string | number;
  highlightedId?: string | number;
  getRowClassName?: (item: T) => string;
  zebra?: boolean;
}

const getAlignClass = (align?: 'left' | 'center' | 'right') => {
  switch(align) {
    case 'center': return 'text-center justify-center';
    case 'right': return 'text-right justify-end';
    default: return 'text-left justify-start';
  }
};

const TableRow = React.memo(({ 
  item, 
  columns, 
  keyExtractor,
  highlightedId,
  rowHeight,
  getRowClassName,
  index
}: { 
  item: any, 
  columns: TableColumn<any>[], 
  keyExtractor: (item: any) => string | number,
  highlightedId?: string | number,
  rowHeight: number,
  getRowClassName?: (item: any) => string,
  index?: number
}) => {
  const isHighlighted = highlightedId && keyExtractor(item) === highlightedId;
  const customClass = getRowClassName ? getRowClassName(item) : '';
  const isEven = index !== undefined && index % 2 === 0;
  
  return (
    <div 
        className={`flex items-stretch px-4 hover:bg-blue-50/20 transition-colors border-b border-slate-200 group ${
          isHighlighted 
            ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-200/50 z-10 relative animate-in fade-in duration-500' 
            : isEven ? 'bg-white' : 'bg-slate-50/40'
        } ${customClass}`}
        style={{ minHeight: `${rowHeight}px` }}
    >
        {columns.map((col, idx) => (
            <div 
                key={idx} 
                className={`
                  ${UI_TOKENS.TYPOGRAPHY.body} 
                  ${getAlignClass(col.align)} 
                  ${col.className || ''} 
                  flex items-center text-blue-950 px-3 py-3
                  ${idx < columns.length - 1 ? 'border-r border-slate-200/40' : ''}
                `}
                style={{ 
                  width: col.width, 
                  flex: col.width ? 'none' : (col.className?.includes('flex-') ? undefined : 1),
                  maxWidth: col.width,
                  minWidth: col.width,
                }}
            >
                <div className={`w-full ${getAlignClass(col.align).split(' ')[0]}`}>
                  {col.render ? col.render(item) : (
                    <span className="truncate block">
                      {item[col.accessorKey as keyof typeof item] as React.ReactNode}
                    </span>
                  )}
                </div>
            </div>
        ))}
    </div>
  );
});
TableRow.displayName = "TableRow";

export const DataTable = React.memo(function DataTable<T>({ 
  data, 
  columns, 
  keyExtractor = (item: any) => item.id || Math.random().toString(), 
  isLoading = false,
  emptyMessage = "No hay registros disponibles.",
  page,
  totalPages,
  onPageChange,
  totalRecords,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  enableVirtualization = false,
  rowHeight = 60,
  virtualHeight = 600,
  highlightedId,
  getRowClassName,
  zebra = true
}: DataTableProps<T>) {
  // Ordenar columnas para vista móvil si tienen mobileOrder
  const mobileColumns = React.useMemo(() => [...columns].sort((a, b) => (a.mobileOrder || 0) - (b.mobileOrder || 0)), [columns]);

  return (
    <div className="w-full">
      {/* Vista de Escritorio: Tabla Estilizada (Card-like) */}
      <div className="hidden md:block">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible shadow-sm flex flex-col">
          {/* Header */}
          <div className={`bg-slate-50 border-b border-slate-200 flex items-stretch px-4 sticky top-0 z-20`}>
              {columns.map((col, idx) => (
                  <div 
                      key={idx} 
                      className={`
                        ${UI_TOKENS.TYPOGRAPHY.label} 
                        ${getAlignClass(col.align)} 
                        ${col.className || ''} 
                        h-12 flex items-center text-slate-500 px-3 text-[10px] font-black uppercase tracking-widest
                        ${idx < columns.length - 1 ? 'border-r border-slate-200/70' : ''}
                      `}
                      style={{ 
                        width: col.width, 
                        flex: col.width ? 'none' : (col.className?.includes('flex-') ? undefined : 1),
                        maxWidth: col.width,
                        minWidth: col.width,
                      }}
                  >
                      <span className="w-full truncate">{col.header}</span>
                  </div>
              ))}
          </div>

          {/* Body */}
          <div className="flex-1">
              {isLoading ? (
                  <div className="p-12 text-center text-slate-400">
                      <FiLoader className="inline-block mr-2 animate-spin" /> Cargando datos...
                  </div>
              ) : data.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                      {emptyMessage}
                  </div>
              ) : enableVirtualization ? (
                  <div style={{ height: virtualHeight }}>
                      <Virtuoso
                          style={{ height: '100%' }}
                          data={data}
                          endReached={onLoadMore}
                          increaseViewportBy={200}
                          itemContent={(index, item) => (
                             <TableRow 
                                item={item} 
                                columns={columns} 
                                keyExtractor={keyExtractor} 
                                highlightedId={highlightedId} 
                                rowHeight={rowHeight}
                                getRowClassName={getRowClassName}
                                index={zebra ? index : undefined}
                             />
                          )}
                          components={{
                              Footer: () => isLoadingMore ? (
                                  <div className="p-4 text-center text-slate-400 border-t border-slate-100">
                                      <FiLoader className="inline-block mr-2 animate-spin" /> Cargando más...
                                  </div>
                              ) : hasMore && onLoadMore ? (
                                  <div className="p-4 text-center">
                                      <button 
                                          onClick={onLoadMore}
                                          className="text-blue-600 font-bold text-sm hover:underline flex items-center justify-center w-full"
                                      >
                                          <FiPlus className="mr-1" /> Cargar más registros
                                      </button>
                                  </div>
                              ) : null
                          }}
                      />
                  </div>
              ) : (
                  <div className="">
                      {data.map((item, index) => (
                        <TableRow 
                          key={keyExtractor(item)}
                          item={item} 
                          columns={columns} 
                          keyExtractor={keyExtractor} 
                          highlightedId={highlightedId} 
                          rowHeight={rowHeight}
                          getRowClassName={getRowClassName}
                          index={zebra ? index : undefined}
                        />
                      ))}
                    
                    {/* Infinite Scroll / Load More Footer for non-virtualized */}
                    {isLoadingMore && (
                        <div className="p-4 text-center text-slate-400 border-t border-slate-100">
                            <FiLoader className="inline-block mr-2 animate-spin" /> Cargando más...
                        </div>
                    )}
                    {!isLoadingMore && hasMore && onLoadMore && (
                        <div className="p-4 text-center border-t border-slate-100">
                            <button 
                                onClick={onLoadMore}
                                className="text-blue-600 font-bold text-sm hover:underline flex items-center justify-center w-full"
                            >
                                <FiPlus className="mr-1" /> Cargar más registros
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>

      {/* Vista Móvil: Tarjetas Compactas */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-100">
            <FiLoader className="inline-block mr-2 animate-spin" /> Cargando datos...
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-100">
            {emptyMessage}
          </div>
        ) : (
          <>
            {data.map((item) => {
              const isHighlighted = highlightedId && keyExtractor(item) === highlightedId;
              const customClass = getRowClassName ? getRowClassName(item) : '';
              return (
                <div 
                  key={keyExtractor(item)} 
                  className={`rounded-2xl border p-4 shadow-sm active:bg-slate-50 transition-all ${
                    isHighlighted 
                      ? 'bg-yellow-50 border-yellow-400 ring-4 ring-yellow-200/50 z-10 relative scale-[1.02] animate-in zoom-in-95 duration-500' 
                      : 'bg-white border-slate-200'
                  } ${customClass}`}
                >
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {mobileColumns.map((col, idx) => {
                    const isFull = col.mobileGrid === 'full' || !col.mobileGrid;
                    const isRight = col.mobileGrid === 'right';
                    
                    return (
                      <div 
                        key={idx} 
                        className={`${isFull ? 'col-span-2' : 'col-span-1'} ${isRight ? 'text-right' : ''}`}
                      >
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                          {col.header}
                        </span>
                        <div className={`${UI_TOKENS.TYPOGRAPHY.body} text-blue-950 leading-tight`}>
                          {col.render ? col.render(item) : (item[col.accessorKey as keyof typeof item] as React.ReactNode)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {isLoadingMore && (
                <div className="p-4 text-center text-slate-400">
                    <FiLoader className="inline-block mr-2 animate-spin" /> Cargando más...
                </div>
            )}
            {!isLoadingMore && hasMore && onLoadMore && (
                <div className="p-4 text-center">
                    <button 
                        onClick={onLoadMore}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-blue-600 font-bold text-sm shadow-sm w-full"
                    >
                        Cargar más
                    </button>
                </div>
            )}
          </>
        )}
      </div>

      {/* Pagination Controls (Traditional) */}
      {(totalRecords !== undefined || (page !== undefined && totalPages !== undefined)) && (
          <div className="flex items-center justify-between px-4 py-4 mt-2">
             <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {totalRecords !== undefined ? `Mostrando ${data.length} de ${totalRecords} registros` : ''}
             </div>
             
             {page !== undefined && totalPages !== undefined && onPageChange && (
               <div className="flex items-center gap-2">
                 <button
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                 >
                    <FiChevronLeft size={16} />
                 </button>
                 <div className="flex items-center gap-1">
                   {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                     // Simple pagination logic for demo, showing first 5 pages
                     const pageNum = i + 1;
                     return (
                       <button
                         key={pageNum}
                         onClick={() => onPageChange(pageNum)}
                         className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black transition-all ${
                           page === pageNum 
                             ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                             : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'
                         }`}
                       >
                         {pageNum}
                       </button>
                     );
                   })}
                 </div>
                 <button
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                 >
                    <FiChevronRight size={16} />
                 </button>
               </div>
             )}
          </div>
       )}
    </div>
  );
});
