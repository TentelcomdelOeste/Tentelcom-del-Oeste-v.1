// services/offline-experimental/offlineIndicatorsRegistry.ts

interface Indicators {
  syncing: boolean;
  pendingItems: number;
  lastOnline: number | null;
}

const indicators: Indicators = { syncing: false, pendingItems: 0, lastOnline: Date.now() };

export const getIndicators = (): Indicators => ({ ...indicators });

export const setIndicators = (newIndicators: Partial<Indicators>): void => {
  Object.assign(indicators, newIndicators);
};
