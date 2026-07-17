// services/localDb.ts

const DB_NAME = 'TentelcomLocalDB';
const DB_VERSION = 2;

export const STORES = {
  trabajos: 'trabajos',
  empleados: 'empleados',
  clientes: 'clientes',
  bitacoras: 'bitacoras',
  cotizaciones: 'cotizaciones',
  inventario_cache: 'inventario_cache',
  metadata: 'metadata',
  mutation_queue: 'mutation_queue',
  mutation_journal: 'mutation_journal'
};

let db: IDBDatabase | null = null;

export const initLocalDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      
      Object.values(STORES).forEach(storeName => {
        if (!dbInstance.objectStoreNames.contains(storeName)) {
          dbInstance.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = (event: Event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event: Event) => {
      console.error('[LocalDB] Database error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const getDB = async (): Promise<IDBDatabase> => {
  if (!db) {
    return await initLocalDB();
  }
  return db;
};
