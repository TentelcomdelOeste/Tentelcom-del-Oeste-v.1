// services/offlineTelemetry.ts
// Purely local offline sync telemetry & metrics store for production observabilidad

export interface TelemetryMetrics {
  retries: number;
  failures: number;
  syncsStarted: number;
  syncsCompleted: number;
  totalSyncDurationMs: number;
  corruptionOccurrences: number;
  recoverySessions: number;
  orphanCountDetected: number;
  storageEvictionCleanups: number;
  lastSyncTime: number | null;
}

const STORAGE_KEY = 'telecom-offline-telemetry-metrics';

const defaultMetrics: TelemetryMetrics = {
  retries: 0,
  failures: 0,
  syncsStarted: 0,
  syncsCompleted: 0,
  totalSyncDurationMs: 0,
  corruptionOccurrences: 0,
  recoverySessions: 0,
  orphanCountDetected: 0,
  storageEvictionCleanups: 0,
  lastSyncTime: null,
};

export function getTelemetryMetrics(): TelemetryMetrics {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultMetrics };
    return { ...defaultMetrics, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('[Telemetry] Error reading telemetry metrics, returning defaults:', e);
    return { ...defaultMetrics };
  }
}

export function updateTelemetry(updater: (current: TelemetryMetrics) => Partial<TelemetryMetrics>): TelemetryMetrics {
  try {
    const current = getTelemetryMetrics();
    const updated = { ...current, ...updater(current) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Trigger local sync event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('telecom-telemetry-updated'));
    }
    return updated;
  } catch (e) {
    console.warn('[Telemetry] Error updating telemetry metrics:', e);
    return { ...defaultMetrics };
  }
}

export function logSyncStart(): void {
  updateTelemetry(prev => ({
    syncsStarted: prev.syncsStarted + 1
  }));
}

export function logSyncSuccess(durationMs: number): void {
  updateTelemetry(prev => ({
    syncsCompleted: prev.syncsCompleted + 1,
    totalSyncDurationMs: prev.totalSyncDurationMs + durationMs,
    lastSyncTime: Date.now()
  }));
}

export function logSyncAttemptFailure(): void {
  updateTelemetry(prev => ({
    failures: prev.failures + 1,
    retries: prev.retries + 1
  }));
}

export function logCorruption(): void {
  updateTelemetry(prev => ({
    corruptionOccurrences: prev.corruptionOccurrences + 1
  }));
}

export function logRecoverySession(): void {
  updateTelemetry(prev => ({
    recoverySessions: prev.recoverySessions + 1
  }));
}

export function logOrphanCount(count: number): void {
  if (count <= 0) return;
  updateTelemetry(prev => ({
    orphanCountDetected: prev.orphanCountDetected + count
  }));
}

export function logStorageEvictionCleanup(): void {
  updateTelemetry(prev => ({
    storageEvictionCleanups: prev.storageEvictionCleanups + 1
  }));
}

export function clearTelemetry(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMetrics));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('telecom-telemetry-updated'));
    }
  } catch (e) {
    console.error('[Telemetry] Failed to clear telemetry metrics:', e);
  }
}
