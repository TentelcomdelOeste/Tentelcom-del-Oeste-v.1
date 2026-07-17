type CacheEntry<T> = {
  data: T;
  timestamp: number;
}

const CACHE_TIME = 60 * 1000; // 60 segundos de vida útil

const cache = new Map<string, CacheEntry<any>>();

/**
 * Envuelve una promesa en un sistema de caché en memoria.
 * Si existe un dato válido y reciente para la 'key', lo devuelve sin ejecutar el fetcher.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);

  if (existing && now - existing.timestamp < CACHE_TIME) {
    return existing.data;
  }

  const data = await fetcher();

  cache.set(key, {
    data,
    timestamp: now
  });

  return data;
}

/**
 * Invalida entradas del caché que comiencen con el prefijo dado.
 * Útil para limpiar listas después de crear o editar un item.
 */
export function invalidateCache(keyPrefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key);
    }
  }
}