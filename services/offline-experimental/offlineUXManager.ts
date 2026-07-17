// services/offline-experimental/offlineUXManager.ts

export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

let status: NetworkStatus = 'online';

export const getNetworkStatus = (): NetworkStatus => status;

export const setNetworkStatus = (newStatus: NetworkStatus): void => {
  status = newStatus;
  console.log(`[OfflineUX] Status changed to ${status}`);
  // Emit event if needed for UI components to listen
  window.dispatchEvent(new CustomEvent('network-status-change', { detail: status }));
};
