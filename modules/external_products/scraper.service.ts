
/**
 * ------------------------------------------------------------------
 * ⚠️ MÓDULO EXPERIMENTAL DE EXTRACCIÓN (SCRAPER)
 * ------------------------------------------------------------------
 * 
 * ESTE SERVICIO ES UNA HERRAMIENTA AUXILIAR DE USO MANUAL.
 * NO ES PARTE DEL NÚCLEO TRANSACCIONAL DEL SISTEMA.
 * 
 * Limitaciones y Reglas de Uso:
 * 1. Uso Exclusivo: Solo debe ser invocado desde el módulo de "Productos Externos".
 * 2. Dependencia Externa: Utiliza un proxy CORS público (allorigins.win) que puede fallar.
 * 3. Estabilidad: No garantiza la extracción correcta si la estructura HTML del sitio origen cambia.
 * 4. Aislamiento: Los errores aquí NO deben detener la aplicación principal.
 * 5. Privacidad: NO procesar datos sensibles ni financieros a través de este canal.
 * 
 * @module ExperimentalScraper
 * @status EXPERIMENTAL
 */

import { RawProductData } from './types';

// Proxy público para evitar bloqueos CORS en frontend (Solo para demo/producción ligera)
// En un entorno empresarial estricto, esto debería ser un endpoint propio del backend.
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

/**
 * Limpia textos de caracteres financieros y espacios excesivos.
 */
const cleanText = (text: string | null | undefined): string => {
  if (!text) return '';
  const clean = text
    .replace(/[$€₡]/g, '') // Eliminar $, ₡, €
    .replace(/\b(USD|CRC|IVA|impuesto|precio|oferta)\b/gi, '') // Eliminar palabras financieras
    .replace(/\s+/g, ' ') // Colapsar espacios
    .trim();
  return clean;
};

/**
 * Extrae información técnica básica de un documento HTML parseado.
 * Intenta ser agnóstico pero prioriza estructuras comunes de e-commerce (como Intcomex).
 */
const parseHtmlContent = (htmlString: string, provider: string): Partial<RawProductData> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // 1. Extracción de Título
  // Prioridad: H1 > title tag > meta og:title
  const title = doc.querySelector('h1')?.textContent || 
              doc.querySelector('.product-name')?.textContent ||
              doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
              '';

  // 2. Extracción de Descripción
  // Busca contenedores comunes de descripción
  let description = '';
  const descSelectors = [
    '#description', '.description', '.product-description', 
    'div[itemprop="description"]', 'meta[name="description"]'
  ];
  
  for (const selector of descSelectors) {
    const el = doc.querySelector(selector);
    if (el) {
      // Si es meta tag
      if (selector.startsWith('meta')) {
        description = el.getAttribute('content') || '';
      } else {
        description = el.textContent || '';
      }
      if (description) break;
    }
  }

  // 3. Extracción de Especificaciones (Intento genérico)
  let specsText = '';
  // Buscar tablas que parezcan de especificaciones
  const tables = doc.querySelectorAll('table');
  tables.forEach(table => {
    // Heurística simple: Si la tabla tiene muchas filas y celdas, probablemente sea specs
    if (table.rows.length > 2 && table.textContent && table.textContent.length > 50) {
      // Evitar tablas de precios/carrito
      const text = table.textContent.toLowerCase();
      if (!text.includes('precio') && !text.includes('total') && !text.includes('cart')) {
        // Convertir tabla a texto simple clave: valor
        Array.from(table.rows).forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
                specsText += `${cleanText(cells[0].textContent)}: ${cleanText(cells[1].textContent)}\n`;
            }
        });
      }
    }
  });

  // Si no hay tablas, buscar listas
  if (!specsText) {
      const lists = doc.querySelectorAll('.specs li, .features li, #specifications li');
      lists.forEach(li => {
          specsText += `- ${cleanText(li.textContent)}\n`;
      });
  }

  // 4. Extracción de Imágenes
  const images: string[] = [];
  const imgSelectors = [
      'meta[property="og:image"]',
      '.product-image img',
      '#main-image',
      '.gallery img'
  ];

  imgSelectors.forEach(sel => {
      const els = doc.querySelectorAll(sel);
      els.forEach(el => {
          let src = el.getAttribute('src') || el.getAttribute('content') || '';
          if (src && !src.startsWith('data:') && (src.endsWith('.jpg') || src.endsWith('.png') || src.endsWith('.webp'))) {
              if (src.startsWith('//')) src = 'https:' + src;
              if (src.startsWith('/')) {
                  // No podemos resolver rutas relativas fácilmente sin la URL base original parseada, 
                  // pero intentamos ignorarlas o dejarlas como están si el usuario lo corrige.
              } else {
                  images.push(src);
              }
          }
      });
  });

  return {
    titulo_raw: cleanText(title),
    descripcion_raw: cleanText(description),
    especificaciones_raw: specsText.trim(),
    imagenes_raw: [...new Set(images)].slice(0, 5) // Máximo 5 imágenes únicas
  };
};

/**
 * Función principal expuesta al módulo.
 * ⚠️ EXPERIMENTAL: Ejecuta extracción de datos no estructurados.
 */
export const extractProductFromUrl = async (url: string, provider: string): Promise<RawProductData> => {
  if (!url) throw new Error("URL requerida");

  try {
    // Usamos AllOrigins para obtener el contenido crudo (JSON wrapper)
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    
    const data = await response.json();
    if (!data.contents) throw new Error("No se pudo recuperar el contenido HTML.");

    const extracted = parseHtmlContent(data.contents, provider);

    return {
      titulo_raw: extracted.titulo_raw || '',
      descripcion_raw: extracted.descripcion_raw || '',
      especificaciones_raw: extracted.especificaciones_raw || '',
      imagenes_raw: extracted.imagenes_raw || [],
      url_origen: url,
      fuente: provider // Mapeamos proveedor a fuente para el modelo
    };

  } catch (error: any) {
    console.error("Error en extracción:", error);
    // El error se propaga para ser manejado por la UI, no detiene el sistema
    throw new Error(`Fallo en la extracción: ${error.message || 'Error desconocido'}`);
  }
};
