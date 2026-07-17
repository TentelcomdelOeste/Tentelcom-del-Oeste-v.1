import React from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export function SyncStatusIndicator(): JSX.Element | null {
  const {
    isOnline,
    pendingCount,
    lastSyncedAt,
    isSyncing
  } = useSyncStatus();

  // Online sin pendientes — indicador invisible
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  // Formatear última sincronización
  const lastSyncText = lastSyncedAt
    ? `Últ. sync: ${lastSyncedAt.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    : '';

  // Determinar clases dinámicas de Tailwind según el estado
  const containerClasses = !isOnline
    ? 'bg-amber-500 text-slate-950 font-bold border-amber-600 px-3.5 py-1.5 shadow-md scale-102 hover:scale-105 duration-150 rounded-full' // offline
    : isSyncing
      ? 'bg-blue-50 text-blue-800 border-blue-300 px-3 py-1 rounded-full' // syncing
      : 'bg-amber-50 text-amber-800 border-amber-300 px-3 py-1 rounded-full'; // pending items on reconnection/online

  const dotClasses = !isOnline
    ? 'bg-amber-950/70 border border-amber-800/20'
    : 'bg-blue-500 animate-pulse';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-1.5 text-xs leading-none border whitespace-nowrap shadow-sm transition-all duration-250 ${containerClasses}`}
    >
      {/* Indicador de estado */}
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClasses}`} />

      {/* Texto de estado */}
      {!isOnline && (
        <span className="flex items-center gap-1.5">
          <span>Sin conexión</span>
          {pendingCount > 0 && (
            <span className="bg-amber-950/20 text-amber-950 px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight shrink-0">
              {pendingCount} pend.
            </span>
          )}
        </span>
      )}

      {isOnline && isSyncing && (
        <span>Sincronizando...</span>
      )}

      {isOnline && !isSyncing && pendingCount > 0 && (
        <span>
          {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          {lastSyncText && ` · ${lastSyncText}`}
        </span>
      )}
    </div>
  );
}
