/**
 * Envuelve una promesa con un límite de tiempo de espera (timeout).
 * Si la promesa se resuelve/rechaza antes de `timeoutMs`, retorna o lanza su resultado.
 * Si transcurre `timeoutMs` primero, rechaza con un error de timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 4000,
  errorMessage: string = 'La operación remota excedió el tiempo de espera.'
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
