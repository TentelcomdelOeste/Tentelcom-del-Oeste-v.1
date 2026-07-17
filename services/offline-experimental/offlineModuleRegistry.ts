// services/offline-experimental/offlineModuleRegistry.ts

import { STORES } from '../localDb';

export const OFFLINE_MODULE_REGISTRY: Record<string, keyof typeof STORES> = {
  'bitacora': 'bitacoras',
  'trabajos': 'trabajos',
  'clientes': 'clientes',
  'cotizaciones': 'cotizaciones'
};

export const isModuleOfflineCapable = (moduleKey: string): boolean => {
  return !!OFFLINE_MODULE_REGISTRY[moduleKey];
};

export const getStoreForModule = (moduleKey: string): keyof typeof STORES | undefined => {
  return OFFLINE_MODULE_REGISTRY[moduleKey];
};
