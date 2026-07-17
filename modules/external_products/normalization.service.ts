import { getFunctions, httpsCallable } from "firebase/functions";
import { RawProductData } from "./types";

export interface NormalizedProductData {
  titulo_normalizado: string;
  descripcion_normalizada: string;
  categoria_sugerida: string;
  marca_sugerida: string;
}

/**
 * Servicio de Normalización con IA.
 * Analiza los datos crudos y sugiere una estructura limpia y estandarizada.
 * Utiliza Cloud Functions para proteger la API Key.
 */
export const normalizeProductData = async (raw: RawProductData): Promise<NormalizedProductData> => {
  try {
    const functions = getFunctions();
    const normalizeFn = httpsCallable<{raw: RawProductData}, NormalizedProductData>(functions, "normalizeProductDataProxy");
    
    const result = await normalizeFn({ raw });
    return result.data;

  } catch (error: any) {
    console.error("Error en normalización IA:", error);
    // Fallback básico en caso de error de API
    return {
      titulo_normalizado: raw.titulo_raw,
      descripcion_normalizada: raw.descripcion_raw,
      categoria_sugerida: "Sin Categoría",
      marca_sugerida: "Genérico"
    };
  }
};
