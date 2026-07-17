
import { Fortnight } from '../financeTypes';

export interface ValidationResult {
  allowed: boolean;
  message?: string;
  details?: string;
}

/**
 * Lógica empresarial de validación para la generación de colillas.
 * Impide la creación de registros futuros fuera de la ventana permitida (antelación de 4 días).
 */
export const canGeneratePaystub = (year: number, month: number, fortnight: Fortnight): ValidationResult => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Determinar la fecha de cierre/pago del periodo solicitado
  const targetDate = fortnight === 'Primera' 
    ? new Date(year, month - 1, 15) // Día 15 del mes seleccionado
    : new Date(year, month, 0);     // Último día del mes seleccionado (mes 1-indexed en el input, Date usa 0-indexed para mes pero el día 0 del mes siguiente es el último del anterior)

  targetDate.setHours(0, 0, 0, 0);

  // La ventana se abre 4 días antes de la fecha de cierre
  const allowedDate = new Date(targetDate);
  allowedDate.setDate(targetDate.getDate() - 4);
  allowedDate.setHours(0, 0, 0, 0);

  // Si la fecha actual es mayor o igual a la fecha permitida, se autoriza
  if (now >= allowedDate) {
    return { allowed: true };
  }

  // Si no está permitido, construir mensaje explicativo
  const genericError = "No es permitido generar colillas futuras fuera del período autorizado.";
  const detailsMessage = "Las colillas únicamente pueden generarse para:\n✔ períodos actuales\n✔ períodos anteriores\n✔ o próximas quincenas habilitadas dentro de la ventana empresarial permitida (4 días antes del cierre).";

  const closingLabel = fortnight === 'Primera' ? "día 15" : "fin de mes";
  const habilitationDay = allowedDate.getDate();
  const monthName = targetDate.toLocaleString('es-ES', { month: 'long' });
  
  let specificContext = `Este período se habilitará el día ${habilitationDay} de ${monthName} (4 días antes del pago del ${closingLabel}).`;
  
  // Si es un año muy futuro, simplificar el contexto
  if (year > now.getFullYear() + 1) {
    specificContext = "Este período pertenece a un año futuro lejano y no está habilitado.";
  }

  return {
    allowed: false,
    message: genericError,
    details: `${detailsMessage}\n\n${specificContext}`
  };
};
