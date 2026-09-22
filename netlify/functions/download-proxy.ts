interface HandlerEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: string | null;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

/**
 * Validates that the requested URL strictly belongs to the authorized
 * Tentelcom Firebase Storage bucket via HTTPS. Prevents open proxy and SSRF.
 */
function isAuthorizedFirebaseStorageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Check host whitelist
    const isGoogleStorageHost =
      host === 'firebasestorage.googleapis.com' ||
      host === 'storage.googleapis.com' ||
      host === 'tentelcom-del-oeste.firebasestorage.app' ||
      host === 'tentelcom-del-oeste.appspot.com' ||
      host.endsWith('.firebasestorage.app');

    if (!isGoogleStorageHost) {
      return false;
    }

    // Must belong to Tentelcom bucket/project
    const isTentelcomBucket =
      host.includes('tentelcom') ||
      pathname.includes('tentelcom');

    return isTentelcomBucket;
  } catch {
    return false;
  }
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET'
      },
      body: JSON.stringify({ error: 'Método no permitido. Solo se permite GET.' })
    };
  }

  const fileUrl = event.queryStringParameters?.url;
  const requestedName = event.queryStringParameters?.filename || 'imagen_original.jpg';

  if (!fileUrl) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'El parámetro "url" es obligatorio.' })
    };
  }

  // Security check: Validate URL against Tentelcom Firebase Storage bucket whitelist
  if (!isAuthorizedFirebaseStorageUrl(fileUrl)) {
    console.warn(`[download-proxy] URL no autorizada rechazada: ${fileUrl}`);
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'URL no autorizada. Solo se permiten descargas desde el almacenamiento oficial de Tentelcom.'
      })
    };
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Error al obtener la imagen de Firebase Storage: ${response.status} ${response.statusText}`
        })
      };
    }

    const rawContentType = (response.headers.get('content-type') || '').toLowerCase();
    
    // Safety check: ensure response from storage is not HTML or text error
    if (
      rawContentType.startsWith('text/') ||
      rawContentType.includes('html') ||
      rawContentType.includes('json')
    ) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'La respuesta del almacenamiento no contiene una imagen válida.'
        })
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'El archivo descargado está vacío.' })
      };
    }

    // Determine clean content type
    let finalContentType = rawContentType || 'image/jpeg';
    if (!finalContentType.startsWith('image/')) {
      finalContentType = 'image/jpeg';
    }

    // Clean filename for header
    const safeFileName = requestedName.replace(/["\r\n\\]/g, '_');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': finalContentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFileName)}"`,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error: any) {
    console.error('[download-proxy] Error al procesar descarga:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `Error en el servidor de descarga: ${error?.message || 'Error desconocido'}`
      })
    };
  }
};
