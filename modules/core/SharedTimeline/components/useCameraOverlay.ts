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

    const sourceWidth = img.naturalWidth;
    const sourceHeight = img.naturalHeight;

    if (sourceWidth < 1000 || sourceHeight < 700) {
      console.warn('[CameraOverlay] WARNING: source photo is unexpectedly small:', {
        width: sourceWidth,
        height: sourceHeight,
      });
    } else {
      console.info('[CameraOverlay] Source photo dimensions:', {
        width: sourceWidth,
        height: sourceHeight,
      });
    }

    const canvas = document.createElement('canvas');
    // CRITICAL: the canvas is EXACTLY the native photo size. No resize/crop.
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('No se pudo inicializar el contexto 2D del Canvas');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight);

    const scale = Math.max(0.7, Math.min(3, sourceWidth / 1080));

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

    const fontSizeHeader = Math.round(13 * scale);
    const fontSizeBody = Math.round(9.5 * scale);
    const lineHeight = Math.round(15 * scale);
    const margin = Math.round(16 * scale);
    const textStartX = margin;
    let currentY = margin;

    ctx.save();
    ctx.textBaseline = 'top';

    lines.forEach((line, idx) => {
      ctx.font = line.isBold
        ? `bold ${idx === 0 ? fontSizeHeader : fontSizeBody}px sans-serif`
        : `${fontSizeBody}px sans-serif`;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.lineWidth = Math.max(2.5, Math.round(3.5 * scale));
      ctx.lineJoin = 'round';
      ctx.strokeText(line.text, textStartX, currentY);
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, textStartX, currentY);
      currentY += lineHeight;
    });

    ctx.restore();

    // Única re-serialización necesaria para incrustar el overlay. Usamos
    // calidad 1.0 y conservamos exactamente las dimensiones de la foto.
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 1.0);
    });

    if (!blob) {
      throw new Error('Error al generar el archivo JPEG final desde Canvas');
    }

    console.info('[CameraOverlay] Final stamped photo:', {
      width: canvas.width,
      height: canvas.height,
      sizeBytes: blob.size,
    });

    return new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() });
  }, []);

  return { stampOverlayOnImage };
}
