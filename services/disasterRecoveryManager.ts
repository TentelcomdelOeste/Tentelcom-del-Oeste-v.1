// services/disasterRecoveryManager.ts
// Handles safe startup scans, storage eviction limits, and failsafe/degraded modes

import { repairAndIsolateQueue, restoreQueueFromSnapshot } from './recoveryAuditService';
import { logRecoverySession, logStorageEvictionCleanup } from './offlineTelemetry';

let isSafeModeFlag = false;

if (typeof window !== 'undefined') {
  try {
    isSafeModeFlag = localStorage.getItem('telecom-safe-mode-active') === 'true';
  } catch (e) {
    // Ignore storage isolation errors safely
    void e;
  }
}

/**
 * Manually reset all recovery flags and crash counters.
 */
export function resetRecoveryState(): void {
  try {
    localStorage.setItem('telecom-startup-crash-counter', '0');
    localStorage.removeItem('telecom-safe-mode-active');
    isSafeModeFlag = false;
    console.info('[Recovery] All disaster recovery flags have been manually reset.');
  } catch (e) {
    console.error('[Recovery] Failed to manual reset flags:', e);
  }
}

/**
 * Checks if the system is running under Failsafe Safe Mode.
 * Fortified for reliability across all app contexts.
 */
export function isSafeModeActive(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('telecom-safe-mode-active') === 'true' || isSafeModeFlag;
  } catch {
    return isSafeModeFlag;
  }
}

/**
 * Forces the application into Failsafe Degraded-UI Mode.
 */
export function activateSafeMode(): void {
  if (isSafeModeFlag) return;
  console.warn('[SafeMode] [DisasterRecovery] Failsafe Safe Mode ACTIVATED. Storage operations will degrade gracefully.');
  isSafeModeFlag = true;
  try {
    localStorage.setItem('telecom-safe-mode-active', 'true');
  } catch (e) {
    void e;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('telecom-safemode-changed'));
  }
}

/**
 * Resets the safe mode status.
 */
export function deactivateSafeMode(): void {
  if (!isSafeModeFlag) return;
  console.info('[SafeMode] [DisasterRecovery] Failsafe Safe Mode DEACTIVATED.');
  isSafeModeFlag = false;
  try {
    localStorage.removeItem('telecom-safe-mode-active');
  } catch (e) {
    void e;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('telecom-safemode-changed'));
  }
}

/**
 * Monitors the browser's storage space and takes proactive cleanup measures
 * (sweeping optional dynamic cache storage) if space is critically low.
 */
export async function monitorStorageQuota(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const freeSpace = quota - usage;
      const CRITICAL_FREE_MS = 50 * 1024 * 1024; // 50MB free space threshold

      if (freeSpace < CRITICAL_FREE_MS || (quota > 0 && (usage / quota) > 0.85)) {
        console.warn(`[DisasterRecovery] Proactive Storage Sweep: Free space is low (${(freeSpace / 1024 / 1024).toFixed(2)}MB). Clearing caches.`);
        logStorageEvictionCleanup();

        if (typeof caches !== 'undefined') {
          const cacheKeys = await caches.keys();
          for (const key of cacheKeys) {
            // Delete historical image/file caches (never touch application state)
            if (key.includes('telecom-storage-images') || key.includes('telecom-cache')) {
              await caches.delete(key);
            }
          }
        }
        return true;
      }
    } catch (err) {
      console.warn('[DisasterRecovery] Storage quota estimation failed:', err);
    }
  }
  return false;
}

/**
 * Main application boot uploader scanner & recovery loop.
 * Runs structural IndexedDB validation + releases stale tab-locks + isolates broken/duplicate records
 * without losing high-integrity files.
 */
export async function initializeDisasterRecovery(authReady: boolean = true, isAuthResolving: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  logRecoverySession();

  const CRASH_COUNTER_KEY = 'telecom-startup-crash-counter';
  const MAX_START_CRASHES = 3;
  let crashCount = 0;

  try {
    crashCount = parseInt(localStorage.getItem(CRASH_COUNTER_KEY) || '0', 10);
  } catch (_) {
    void 0;
  }

  // Safe mode protection trigger for repeated startup crash-loops
  if (crashCount >= MAX_START_CRASHES) {
    if (authReady || !isAuthResolving) {
      console.warn('[BootRecovery] [DisasterRecovery] Running under safety mechanism due to previous failures. Attempting normal recovery...');
      activateSafeMode();
    }
  } else {
    try {
      localStorage.setItem(CRASH_COUNTER_KEY, String(crashCount + 1));
    } catch (_) {
      void 0;
    }
  }

  try {
    // 1. Proactively inspect and optimize storage boundary limit
    await monitorStorageQuota();

    // 2. Perform IndexedDB sanity repairs, isolating bad indices to cold recovery slots
    const { isolatedCount, clearedOrphans } = await repairAndIsolateQueue();
    if (isolatedCount > 0 || clearedOrphans > 0) {
      console.warn(`[DisasterRecovery] Handled auto-repair during startup: ${isolatedCount} isolated, ${clearedOrphans} orphans garbage-collected.`);
    }

    // 3. Fallback restore from local snapshot if local IndexedDB uploads schema was wiped or degraded
    await restoreQueueFromSnapshot();

    // 4. Initialization successful: reset crash loop guard
    setTimeout(() => {
      try {
        localStorage.setItem(CRASH_COUNTER_KEY, '0');
        
        // --- NEW: Reset Safe Mode automatically if startup is stable ---
        if (isSafeModeActive()) {
          console.info('[RecoveryReset] Startup is stable. Deactivating residual Safe Mode.');
          deactivateSafeMode();
        }
      } catch (err) {
        console.warn('[RecoveryReset] Failed to clear boot flags:', err);
      }
    }, 2000);

    return true;
  } catch (err) {
    console.error('[DisasterRecovery] Critical startup repair failure. Activating Safe Mode to preserve UI capability:', err);
    activateSafeMode();
    return false;
  }
}
