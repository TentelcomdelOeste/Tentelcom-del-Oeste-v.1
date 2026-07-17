import { useState, useEffect, useCallback } from 'react'
import { getPendingActions } from './useOfflineQueue'

export interface SyncStatus {
  isOnline:        boolean
  pendingCount:    number
  lastSyncedAt:    Date | null
  isSyncing:       boolean
}

export function useSyncStatus(): SyncStatus {

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<
    Date | null
  >(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Actualizar conteo de acciones pendientes
  const refreshPendingCount = useCallback(async () => {
    try {
      const actions = await getPendingActions()
      // Filter out SYSTEM_EVENT as they are handled optimistically
      const pendingVisible = actions.filter(a => a.type !== 'SYSTEM_EVENT')
      setPendingCount(pendingVisible.length)
    } catch {
      setPendingCount(0)
    }
  }, [])

  useEffect(() => {

    const handleOnline = async () => {
      setIsOnline(true)
      setIsSyncing(true)
      await refreshPendingCount()
      // Esperar a que el procesador termine
      // (estimado conservador)
      setTimeout(async () => {
        await refreshPendingCount()
        setIsSyncing(false)
        setLastSyncedAt(new Date())
      }, 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      refreshPendingCount()
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Polling cada 10 segundos para mantener
    // el contador actualizado
    const interval = setInterval(refreshPendingCount, 10000)

    // Estado inicial
    refreshPendingCount()

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [refreshPendingCount])

  return { isOnline, pendingCount, lastSyncedAt, isSyncing }
}
