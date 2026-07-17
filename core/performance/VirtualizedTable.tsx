import React from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface VirtualizedTableProps<T> {
  items: T[];
  rowHeight: number;
  renderRow: (props: { item: T; style: React.CSSProperties; index: number }) => React.ReactNode;
  header?: React.ReactNode;
  emptyMessage?: string;
  className?: string;
  listClassName?: string;
}

/**
 * Componente de Tabla Virtualizada de Alto Rendimiento.
 * 
 * Utiliza react-window para renderizar solo las filas visibles, permitiendo manejar
 * miles de registros sin degradar el rendimiento de la UI.
 * 
 * @param items Array de datos a renderizar
 * @param rowHeight Altura fija de cada fila en píxeles
 * @param renderRow Función de renderizado para cada fila (debe usar el style prop)
 * @param header Componente opcional para el encabezado (fijo)
 */
export function VirtualizedTable<T>({ 
  items, 
  rowHeight, 
  renderRow, 
  header, 
  emptyMessage = "No hay datos disponibles.",
  className = "",
  listClassName = ""
}: VirtualizedTableProps<T>) {
  
  if (!items || items.length === 0) {
    return (
      <div className={`w-full ${className}`}>
        {header}
        <div className="py-10 text-center text-slate-400 font-bold text-xs bg-white border-b border-l border-r border-slate-200 rounded-b-xl">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full h-full ${className}`}>
      {/* Header Fijo */}
      {header && <div className="flex-none z-10 relative">{header}</div>}
      
      {/* Cuerpo Virtualizado */}
      <div className="flex-1 min-h-[400px] w-full bg-white border-l border-r border-b border-slate-200 rounded-b-xl overflow-hidden">
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              itemCount={items.length}
              itemSize={rowHeight}
              width={width}
              className={`custom-scrollbar ${listClassName}`}
            >
              {({ index, style }) => (
                renderRow({ 
                  item: items[index], 
                  style, 
                  index 
                })
              )}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}