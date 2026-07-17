// Tab Lock Manager for Multi-Tab Synchronization Coordination
// Utilizes Web Locks API (navigator.locks) with fallback to LocalStorage/BroadcastChannel leases.

const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 11) : 'server';
const LEADER_KEY = 'telecom_sync_leader_lease';
const HEARTBEAT_CHANNEL_NAME = 'telecom_tab_coordination';
const LEASE_DURATION_MS = 3000;

let isLeaderTabFlag = false;
let checkInterval: any = null;
let heartbeatInterval: any = null;
const leadershipListeners: ((isLeader: boolean) => void)[] = [];

let broadcastChannel: any = null;

if (typeof window !== 'undefined') {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(HEARTBEAT_CHANNEL_NAME);
    } catch (e) {
      console.warn('[TabLock] BroadcastChannel creation failed:', e);
    }
  }

  // Handle tab unload to gracefully resign leadership instantly
  window.addEventListener('unload', resignLeadership);
  window.addEventListener('pagehide', resignLeadership);
}

// Subscribe to leadership state changes
export function onLeadershipChange(callback: (isLeader: boolean) => void): () => void {
  leadershipListeners.push(callback);
  // Immediate trigger
  callback(isLeaderTabFlag);
  return () => {
    const idx = leadershipListeners.indexOf(callback);
    if (idx !== -1) {
      leadershipListeners.splice(idx, 1);
    }
  };
}

export function isLeader(): boolean {
  return isLeaderTabFlag;
}

function notifyListeners() {
  leadershipListeners.forEach(cb => {
    try {
      cb(isLeaderTabFlag);
    } catch (err) {
      console.error('[TabLock] Listener callback error:', err);
    }
  });
}

function becomeLeader() {
  if (isLeaderTabFlag) return;
  console.info(`[TabLock] Tab ${TAB_ID} has successfully CLAIMED active leadership!`);
  isLeaderTabFlag = true;
  notifyListeners();
  
  // Start sending heartbeat to other tabs
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    const expires = Date.now() + LEASE_DURATION_MS;
    try {
      localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, expires }));
    } catch (e) {
      // Storage full or quota exceeded
    }

    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'HEARTBEAT', tabId: TAB_ID, expires });
    }
  }, 1000);
}

function loseLeadership() {
  if (!isLeaderTabFlag) return;
  console.info(`[TabLock] Tab ${TAB_ID} is LOSING active leadership.`);
  isLeaderTabFlag = false;
  notifyListeners();
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function resignLeadership() {
  if (!isLeaderTabFlag) return;
  console.info(`[TabLock] Tab ${TAB_ID} is resigning leadership during unload/pagehide.`);
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  try {
    const lease = localStorage.getItem(LEADER_KEY);
    if (lease) {
      const parsed = JSON.parse(lease);
      if (parsed.tabId === TAB_ID) {
        localStorage.removeItem(LEADER_KEY);
      }
    }
  } catch (e) {
    // ignore
  }

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'RESIGN', tabId: TAB_ID });
    } catch (e) {
      // ignore
    }
  }
}

// Core coordination engine
export function startLockAcquisition(): void {
  if (typeof window === 'undefined') return;

  // Try standard navigator.locks if supported
  if (typeof navigator !== 'undefined' && navigator.locks) {
    console.info('[TabLock] Native Web Locks API found. Attempting to lock...');
    
    const requestNativeLock = () => {
      navigator.locks.request('telecom_sync_coordinator_lock', { ifAvailable: true }, async (lock) => {
        if (lock) {
          becomeLeader();
          // Keep lock held indefinitely until the tab collapses or unloads
          await new Promise<void>((resolve) => {
            const handleUnload = () => {
              window.removeEventListener('unload', handleUnload);
              window.removeEventListener('pagehide', handleUnload);
              resolve();
            };
            window.addEventListener('unload', handleUnload);
            window.addEventListener('pagehide', handleUnload);
          });
          loseLeadership();
        } else {
          // Locked by another tab, we are a passive instance
          console.info('[TabLock] Native Web Lock held by another tab. Passive listener state active.');
          isLeaderTabFlag = false;
          notifyListeners();
          
          // Retry to get native lock later if leader steps down or crashes
          setTimeout(requestNativeLock, 4000);
        }
      }).catch(err => {
        console.warn('[TabLock] Web Locks request rejected, falling back to heartbeats:', err);
        startHeartbeatLoop();
      });
    };

    requestNativeLock();
    setupBroadcastListeners();
  } else {
    console.info('[TabLock] Web Locks unsupported. Falling back to heartbeat lease coordinator.');
    startHeartbeatLoop();
  }
}

function startHeartbeatLoop() {
  // Safe Fallback check loop
  const checkLease = () => {
    const now = Date.now();
    let lease: any = null;
    
    try {
      const leaseStr = localStorage.getItem(LEADER_KEY);
      if (leaseStr) {
        lease = JSON.parse(leaseStr);
      }
    } catch (e) {
      // LocalStorage error or parsing error fallback
    }

    if (!lease || lease.expires < now || lease.tabId === TAB_ID) {
      // Lock is empty, expired, or held by ourselves -> Claim it!
      becomeLeader();
    } else {
      // Held by another tab
      if (isLeaderTabFlag) {
        loseLeadership();
      }
    }
  };

  checkLease();
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkLease, 2000);

  setupBroadcastListeners();
}

function setupBroadcastListeners() {
  if (!broadcastChannel) return;

  broadcastChannel.onmessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === 'HEARTBEAT') {
      if (msg.tabId !== TAB_ID && isLeaderTabFlag) {
        // Double-leader collision mitigation (split-brain survival)
        // Tab with lexicographically smaller ID yields leadership to ensure deterministic consensus
        if (TAB_ID < msg.tabId) {
          console.warn(`[TabLock] Collision mitigation: Yielding leadership to tab ${msg.tabId}`);
          loseLeadership();
        }
      }
    } else if (msg.type === 'RESIGN') {
      if (msg.tabId !== TAB_ID) {
        console.info(`[TabLock] Active leader resigned: ${msg.tabId}. Forcing immediate election.`);
        if (!isLeaderTabFlag) {
          // Immediately attempt to claim leadership of the fallback engine
          try {
            localStorage.removeItem(LEADER_KEY);
          } catch(e) {
            console.debug('[TabLock] Resign cleanup error ignored:', e);
          }
          becomeLeader();
        }
      }
    }
  };
}

startLockAcquisition();
