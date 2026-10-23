
/**
 * Extrae el año de una cadena de fecha en formatos variados (ISO, DD/MM/YYYY, etc).
 * Usado para agrupar reportes y generar códigos de referencia.
 */
export const getYearFromDateString = (dateStr?: string): number => {
  // FIX TS18048: Check for undefined explicitly
  if (!dateStr) return new Date().getFullYear();
  
  // Soporte formato DD/MM/YYYY
  if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
          const y = parseInt(parts[2]);
          if (!isNaN(y)) return y;
      }
  }
  
  // Soporte formato ISO (YYYY-MM-DD) y constructores estándar
  const date = new Date(dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr);
  return !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
};

/**
 * Extrae el mes de una cadena de fecha en formatos variados (ISO, DD/MM/YYYY, etc).
 */
export const getMonthFromDateString = (dateStr?: string): number => {
  if (!dateStr) return new Date().getMonth() + 1;
  
  if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
          const m = parseInt(parts[1]);
          if (!isNaN(m)) return m;
      }
  }
  
  const date = new Date(dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr);
  return !isNaN(date.getTime()) ? date.getMonth() + 1 : new Date().getMonth() + 1;
};

/**
 * Retorna el mes (1-12) y año (YYYY) actuales en la zona horaria de Costa Rica (America/Costa_Rica).
 */
export const getCostaRicaCurrentMonthAndYear = (): { month: number; year: number } => {
  try {
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" });
    const crDate = new Date(nowStr);
    if (!isNaN(crDate.getTime())) {
      return { month: crDate.getMonth() + 1, year: crDate.getFullYear() };
    }
  } catch (e) {
    console.error("Error obteniendo hora de Costa Rica:", e);
  }
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

/**
 * Extrae el mes (1-12) y año (YYYY) de cualquier objeto de movimiento de inventario,
 * soportando createdAt (ISO) o date (YYYY-MM-DD o DD/MM/YYYY).
 */
export const getMovementMonthAndYear = (movement: { createdAt?: string; date?: string }): { month: number; year: number } | null => {
  if (movement.createdAt) {
    const d = new Date(movement.createdAt);
    if (!isNaN(d.getTime())) {
      try {
        const crStr = d.toLocaleString("en-US", { timeZone: "America/Costa_Rica" });
        const crDate = new Date(crStr);
        if (!isNaN(crDate.getTime())) {
          return { month: crDate.getMonth() + 1, year: crDate.getFullYear() };
        }
      } catch {
        // Fallback
      }
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    }
  }

  if (movement.date) {
    const isoMatch = movement.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return { month: parseInt(isoMatch[2], 10), year: parseInt(isoMatch[1], 10) };
    }
    const dmyMatch = movement.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
      return { month: parseInt(dmyMatch[2], 10), year: parseInt(dmyMatch[3], 10) };
    }
    const d = new Date(movement.date);
    if (!isNaN(d.getTime())) {
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    }
  }

  return null;
};

export const MONTH_OPTIONS = [
  { value: 'ALL', label: 'Todos los Meses' },
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

