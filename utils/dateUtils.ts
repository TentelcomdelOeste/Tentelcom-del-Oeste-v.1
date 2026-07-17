
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
