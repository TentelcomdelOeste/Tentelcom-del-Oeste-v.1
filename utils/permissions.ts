
import { User } from './types';
import { MODULES_CONFIG } from './permissionsConfig';

/**
 * Normaliza y verifica si un rol corresponde a un perfil administrativo.
 */
export const isAdmin = (role?: string): boolean => {
  if (!role) return false;
  
  const normalized = role.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return [
    "admin",
    "administrador",
    "administracion"
  ].includes(normalized);
};

/**
 * Verifica si un usuario tiene permiso para acceder a un módulo o submódulo.
 */
export const hasPermission = (user: User | null, moduleKey: string, submoduleKey?: string): boolean => {
  if (!user) return false;

  // 1. Admin Bypass
  if (isAdmin(user.role)) return true;

  // 2. Safeguard: Validar existencia de permisos
  if (!user.permissions) {
    // Si no hay objeto de permisos (ej: carga inicial), permitir acceso básico si es empleado
    if (user.role === 'empleado' || user.role === 'supervisor' || !user.role) {
      if (moduleKey === 'finanzas' && submoduleKey === 'comprobantes') return true;
      if (moduleKey === 'home') return true;
    }
    return false;
  }

  try {
    // -------------------------------------------------------------
    // CASO 1: Se solicita un submódulo específico (submoduleKey != null)
    // -------------------------------------------------------------
    if (submoduleKey) {
      const flatKey = `${moduleKey}.${submoduleKey}`;

      // A. Verificar si existe la clave plana directamente (ej: "inventario.movimientos")
      if (user.permissions[flatKey] === true) return true;
      if (user.permissions[flatKey] === false) return false;

      // B. Verificar en el mapa padre (ej: user.permissions["inventario"])
      const modulePerms = user.permissions[moduleKey];

      // Si el módulo padre es un booleano directo
      if (modulePerms === true) return true;
      if (modulePerms === false) return false;

      // Si el módulo padre es un objeto de submódulos (ej: user.permissions.inventario = { movimientos: true, general: false })
      if (typeof modulePerms === 'object' && modulePerms !== null) {
        if (modulePerms[submoduleKey] === true) return true;
        // Si es objeto y el submódulo no es true, RETORNAR FALSE directamente.
        // No debe evaluar si otros submódulos del mismo objeto son true.
        return false;
      }

      return false;
    }

    // -------------------------------------------------------------
    // CASO 2: Se solicita el módulo padre completo (submoduleKey == undefined)
    // Determina si el usuario tiene permiso para VER el grupo en el menú
    // -------------------------------------------------------------
    const modulePerms = user.permissions[moduleKey];

    // A. Booleano directo en módulo padre
    if (modulePerms === true) return true;
    if (modulePerms === false) return false;

    // B. Objeto de submódulos (Retorna true si AL MENOS UN submódulo tiene true)
    if (typeof modulePerms === 'object' && modulePerms !== null) {
      const validSubmodulesObj = (MODULES_CONFIG as any)[moduleKey]?.submodules;
      if (validSubmodulesObj) {
        const validKeys = Object.keys(validSubmodulesObj);
        return validKeys.some(key => modulePerms[key] === true);
      } else {
        return Object.values(modulePerms).some(v => v === true);
      }
    }

    // C. Claves planas (Retorna true si existe al menos una clave "moduleKey.*" === true)
    const prefix = `${moduleKey}.`;
    const hasAnyFlatKey = Object.keys(user.permissions).some(
      key => key.startsWith(prefix) && user.permissions[key] === true
    );
    if (hasAnyFlatKey) return true;

    return false;
  } catch (error) {
    console.warn(`Permission integrity error for ${moduleKey}.${submoduleKey}`, error);
    return false;
  }
};

/**
 * Función can() para verificar permisos usando la estructura de claves técnicas.
 * Soporta formato: "modulo" o "modulo.submodulo"
 */
export const can = (user: User | null, permissionPath: string): boolean => {
  if (!user) return false;
  if (isAdmin(user.role)) return true;

  const [moduleKey, submoduleKey] = permissionPath.split('.');
  return hasPermission(user, moduleKey, submoduleKey);
};
