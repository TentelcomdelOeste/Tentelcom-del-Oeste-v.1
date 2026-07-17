import React, { useMemo } from 'react';
import { useShortages } from './hooks/useShortages';
import { DataTable, TableColumn, StatusBadge } from './design-system';
import { ActionButtons } from './components/ui/ActionButtons';
import { Shortage } from './dispatchTypes';
import { User } from './utils/types';
import { generateShortagePDF } from './utils/pdfGenerator';

interface ShortagesViewProps {
  currentUser: User;
}

export const ShortagesView: React.FC<ShortagesViewProps> = ({ currentUser }) => {
  const { shortages, isLoading, updateShortageStatus, deleteShortage } = useShortages(currentUser);

  const columns = useMemo<TableColumn<Shortage>[]>(() => [
    {
      header: 'ID Solicitud',
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-blue-600 font-bold">{s.requestNumber || 'SOL-XXXX'}</span>
          <span className="text-[9px] text-slate-400 font-medium">{s.requestId.substring(0, 8)}...</span>
        </div>
      )
    },
    {
      header: 'Fecha',
      accessorKey: 'date',
      className: 'font-mono text-slate-500 text-xs',
      render: (s) => <span>{s.date ? new Date(s.date).toLocaleDateString() : "N/A"}</span>
    },
    {
      header: 'Proyecto / Origen',
      accessorKey: 'projectName',
      className: 'font-bold text-blue-900 text-xs',
      render: (s) => {
        const isIBUX = s.origin === 'IBUX-CLARO' || (s.projectName || "").toUpperCase().includes('IBUX');
        const isCNFL = s.origin === 'CNFL';

        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-blue-900 leading-tight">{(s.projectName || "Sin Nombre").replace(" MANTENIMIENTO", "")}</span>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded uppercase tracking-tighter">
                {(s.origin || "N/A").replace(" MANTENIMIENTO", "")}
              </span>
              {isIBUX && s.torre && (
                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 rounded border border-blue-100 uppercase">
                  T: {s.torre}
                </span>
              )}
            </div>
            {(isIBUX && s.locationDetails) && (
              <p className="text-[9px] font-medium text-slate-500 italic mt-0.5">
                Dist: <span className="font-bold text-slate-700">{s.locationDetails}</span>
              </p>
            )}
            {(isCNFL && s.planta) && (
              <p className="text-[9px] font-medium text-slate-500 italic mt-0.5">
                Plantel: <span className="font-bold text-slate-700">{s.planta}</span>
              </p>
            )}
          </div>
        );
      }
    },
    {
      header: 'Solicitante',
      accessorKey: 'requestedByName',
      className: 'text-xs text-slate-600',
      render: (s) => <span>{(s.requestedByName || "").split('@')[0]}</span>
    },
    {
      header: 'Materiales Faltantes',
      render: (s) => (
        <div className="space-y-1">
          {(s.items || []).map((item, idx) => (
            <div key={idx} className="text-[10px] flex justify-between gap-4 border-b border-slate-50 pb-1 last:border-0">
              <span className="font-bold text-slate-700">{item.materialDescription}</span>
              <span className="font-black text-red-600 whitespace-nowrap">Faltan: {item.quantityShortage}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Estado',
      align: 'center',
      render: (s) => {
        let variant: 'warning' | 'info' | 'success' | 'neutral' = 'neutral';
        if (s.status === 'Pendiente') variant = 'warning';
        else if (s.status === 'En proceso de compra') variant = 'info';
        else if (s.status === 'Material recibido') variant = 'success';
        else if (s.status === 'Cerrado') variant = 'neutral';
        return <StatusBadge label={s.status} variant={variant} />;
      }
    },
    {
      header: 'Acciones',
      align: 'right',
      render: (s) => {
        const handleStatus = (status: string) => {
          updateShortageStatus(s.id, status as any);
        };

        const isPending = s.status === 'Pendiente';
        const isProcessing = s.status === 'En proceso de compra';
        const isReceived = s.status === 'Material recibido';
        const isClosed = s.status === 'Cerrado';

        if (isClosed) return (
          <div className="flex justify-end pr-4">
             <ActionButtons onDelete={() => deleteShortage(s.id)} onPdf={() => generateShortagePDF(s)} />
          </div>
        );

        return (
          <div className="flex items-center justify-end gap-2 p-1">
            <div className="flex gap-1.5 flex-wrap justify-end">
              {isPending && (
                <button 
                  onClick={() => handleStatus('En proceso de compra')}
                  className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg border border-blue-200 hover:bg-blue-600 hover:text-white hover:scale-105 transition-all shadow-sm active:scale-95"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:bg-white animate-pulse" />
                  Procesar
                </button>
              )}
              {(isPending || isProcessing) && (
                <button 
                  onClick={() => handleStatus('Material recibido')}
                  className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:scale-105 transition-all shadow-sm active:scale-95"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:bg-white" />
                  Recibir
                </button>
              )}
              {!isClosed && (
                <button 
                  onClick={() => handleStatus('Cerrado')}
                  className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black uppercase rounded-lg border border-slate-200 hover:bg-slate-700 hover:text-white hover:scale-105 transition-all shadow-sm active:scale-95"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-white" />
                  Cerrar
                </button>
              )}
              
              <div className="flex items-center ml-1 pl-2 border-l border-slate-200">
                <ActionButtons 
                  onDelete={() => deleteShortage(s.id)} 
                  onPdf={() => generateShortagePDF(s)}
                />
              </div>
            </div>
          </div>
        );
      }
    }
  ], [updateShortageStatus, deleteShortage]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Faltantes de Inventario</h3>
          <p className="text-xs font-bold text-slate-400 mt-1">Materiales solicitados que no contaban con stock suficiente al momento del despacho.</p>
        </div>
        <div className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
          {shortages.filter(s => s.status !== 'Cerrado' && s.status !== 'Eliminada').length} Activos
        </div>
      </div>

      <DataTable 
        data={shortages
          .filter(s => s.status !== 'Eliminada')
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        }
        columns={columns}
        keyExtractor={(s) => s.id}
        isLoading={isLoading}
        emptyMessage="No hay registros de faltantes."
      />
    </div>
  );
};
