
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
    if (user.role === 'empleado' || !user.role) {
      if (moduleKey === 'finanzas' && submoduleKey === 'comprobantes') return true;
      if (moduleKey === 'home') return true;
    }
    return false;
  }

  try {
    // Check flat key directly if submoduleKey is provided (e.g. "inventario.solicitudes")
    if (submoduleKey) {
      const flatKey = `${moduleKey}.${submoduleKey}`;
      if (user.permissions[flatKey] === true) return true;
    }

    const modulePerms = user.permissions[moduleKey];

    // Check if flat key for moduleKey exists directly
    if (user.permissions[moduleKey] === true) return true;

    // 3. Si el módulo no existe en el objeto del usuario -> False
    if (modulePerms === undefined) return false;

    // 4. Caso: Permiso Booleano (Top-level module)
    if (typeof modulePerms === 'boolean') return modulePerms;

    // 5. Caso: Permiso Anidado (Submódulo específico)
    if (submoduleKey && typeof modulePerms === 'object' && modulePerms !== null) {
        if (modulePerms[submoduleKey] === true) return true; 
    }

    // 6. Caso: Pregunta por módulo padre que es objeto -> Retornar true si el objeto existe
    if (typeof modulePerms === 'object' && modulePerms !== null) {
        // Obtenemos los submódulos válidos de la configuración
        const validSubmodulesObj = (MODULES_CONFIG as any)[moduleKey]?.submodules;
        if (validSubmodulesObj) {
            const validKeys = Object.keys(validSubmodulesObj);
            return validKeys.some(key => modulePerms[key] === true);
        } else {
            return Object.values(modulePerms).some(v => v === true);
        }
    }

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
