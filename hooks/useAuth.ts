
import { useUserContext } from '../contexts/UserContext';

// Este hook ahora actúa como un puente hacia el Contexto.
// Mantiene la misma firma para no romper el resto de la aplicación.
// El parámetro isOnline se ignora porque el contexto maneja su propia conectividad.
export const useAuth = (_isOnline?: boolean) => {
  return useUserContext();
};
