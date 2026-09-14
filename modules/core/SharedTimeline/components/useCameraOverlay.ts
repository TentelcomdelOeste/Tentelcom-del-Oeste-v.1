import { useCallback } from 'react';

interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

interface OverlayData {
  company: string;
  timestamp: string;
  technician: string;
  contextInfo?: string;
  locationName?: string;
  coords?: GPSCoordinates | null;
}

export function useCameraOverlay() {
  const stampOverlayOnImage = useCallback(async (
    base64Data: string,
    overlay: OverlayData,
    filename: string = `timeline_photo_${Date.now()}.jpg`
  ): Promise<File> => {
    let cleanBase64 = base64Data;
    if (base64Data.startsWith('data:')) {
      cleanBase64 = base64Data.split(',')[1] || '';
    }

    const src = `data:image/jpeg;base64,${cleanBase64}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para estampar el overlay'));
      img.src = src;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto 2D del Canvas');
    }

    // 1. Dibujar fotografía original completa
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    // 2. Escala proporcional basada en la resolución de la foto (diseñado para 1080p base)
    const scale = Math.max(0.7, Math.min(2.5, img.naturalWidth / 1080));

    // 3. Preparar líneas de texto del overlay
    const lines: { text: string; color: string; isBold?: boolean }[] = [
      { text: `${overlay.company} • REGISTRO OPERATIVO`, color: '#38bdf8', isBold: true },
      { text: `📅 ${overlay.timestamp}`, color: '#ffffff', isBold: true },
      { text: `👤 TÉCNICO: ${overlay.technician.toUpperCase()}`, color: '#ffffff', isBold: false },
    ];

    if (overlay.contextInfo && overlay.contextInfo.trim()) {
      lines.push({ text: `📋 CONTEXTO: ${overlay.contextInfo.toUpperCase()}`, color: '#e2e8f0', isBold: false });
    }

    if (overlay.coords) {
      lines.push({
        text: `📍 GPS: ${overlay.coords.latitude.toFixed(6)}, ${overlay.coords.longitude.toFixed(6)} (±${(overlay.coords.accuracy || 0).toFixed(1)}m)`,
        color: '#4ade80',
        isBold: true,
      });
    }

    if (overlay.locationName && overlay.locationName.trim()) {
      lines.push({
        text: `📌 UBICACIÓN: ${overlay.locationName.toUpperCase()}`,
        color: '#93c5fd',
        isBold: false,
      });
    }

    // 4. Medir dimensiones del texto para el posicionamiento
    const fontSizeHeader = Math.round(13 * scale);
    const fontSizeBody = Math.round(9.5 * scale);
    const lineHeight = Math.round(15 * scale);

    // Posicionar en la esquina superior izquierda
    const margin = Math.round(16 * scale);
    const textStartX = margin;
    let currentY = margin;

    ctx.save();
    ctx.textBaseline = 'top';

    lines.forEach((l, idx) => {
      ctx.font = l.isBold ? `bold ${idx === 0 ? fontSizeHeader : fontSizeBody}px sans-serif` : `${fontSizeBody}px sans-serif`;
      
      // Dibujar contorno de texto robusto para máxima legibilidad sobre cualquier fondo
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.lineWidth = Math.max(2.5, Math.round(3.5 * scale));
      ctx.lineJoin = 'round';
      ctx.strokeText(l.text, textStartX, currentY);

      // Dibujar texto de relleno principal
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, textStartX, currentY);
      
      currentY += lineHeight;
    });

    ctx.restore();

    // Exportar canvas a Blob JPEG de alta calidad
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
    });

    if (!blob) {
      throw new Error('Error al generar el archivo JPEG final desde Canvas');
    }

    return new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() });
  }, []);

  return { stampOverlayOnImage };
}
