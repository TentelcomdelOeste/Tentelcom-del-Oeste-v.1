// services/networkQualityMonitor.ts

export type NetworkQuality = 'offline' | 'poor' | 'unstable' | 'good' | 'excellent';

let quality: NetworkQuality = 'good';

export const getNetworkQuality = (): NetworkQuality => quality;

export const updateNetworkQuality = (): void => {
  // Simulate network quality detection
  if (!navigator.onLine) {
    quality = 'offline';
  } else {
    quality = 'good'; // Simple simulation
  }
};
