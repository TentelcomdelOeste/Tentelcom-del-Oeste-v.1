import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraPreview } from '@capgo/camera-preview';
import { Capacitor } from '@capacitor/core';
import { FiX, FiZap, FiZapOff, FiPlus, FiMinus, FiMapPin, FiClock, FiUser, FiNavigation } from 'react-icons/fi';
import { IconButton } from '@/design-system';

interface TimelineCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  currentUser?: any;
  contextInfo?: string;
  jobLocation?: string;
}

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

/**
 * Graba el watermark/overlay de información directamente sobre la imagen capturada usando Canvas.
 */
export async function stampOverlayOnImage(
  base64Data: string,
  overlay: OverlayData,
  filename: string = `timeline_photo_${Date.now()}.jpg`
): Promise<File> {
  let cleanBase64 = base64Data;
  if (base64Data.startsWith('data:')) {
    cleanBase64 = base64Data.split(',')[1] || '';
  }

  const src = `data:image/jpeg;base64,${cleanBase64}`;
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(new Error('No se pudo cargar la imagen para estampar el overlay'));
    img.src = src;
  });

  const canvas = document.createElement('canvas');
  const imgWidth = img.naturalWidth || img.width || 1920;
  const imgHeight = img.naturalHeight || img.height || 1080;
  canvas.width = imgWidth;
  canvas.height = imgHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del Canvas');
  }

  // 1. Dibujar fotografía original completa
  ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

  // 2. Escala proporcional basada en la resolución de la foto (diseñado para 1080p base)
  const scale = Math.max(0.7, Math.min(2.5, imgWidth / 1080));

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

  // 4. Medir dimensiones del badge
  const fontSizeHeader = Math.round(20 * scale);
  const fontSizeBody = Math.round(15 * scale);
  const lineHeight = Math.round(24 * scale);
  const padX = Math.round(22 * scale);
  const padY = Math.round(18 * scale);

  ctx.font = `bold ${fontSizeHeader}px sans-serif`;
  let maxTextWidth = 0;
  lines.forEach((l, idx) => {
    ctx.font = l.isBold ? `bold ${idx === 0 ? fontSizeHeader : fontSizeBody}px sans-serif` : `${fontSizeBody}px sans-serif`;
    const w = ctx.measureText(l.text).width;
    if (w > maxTextWidth) maxTextWidth = w;
  });

  const cardWidth = maxTextWidth + padX * 2 + Math.round(14 * scale); // espacio adicional para la barra de acento
  const cardHeight = lines.length * lineHeight + padY * 2;

  // Posicionar tarjeta en la esquina superior izquierda o inferior izquierda
  // Colocamos en la parte superior izquierda con margen seguro
  const margin = Math.round(24 * scale);
  const cardX = margin;
  const cardY = margin;
  const cornerRadius = Math.round(12 * scale);

  // 5. Dibujar fondo semi-transparente oscuro de alto contraste
  ctx.save();
  ctx.fillStyle = 'rgba(10, 15, 30, 0.82)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cornerRadius);
  } else {
    // Fallback para navegadores antiguos
    ctx.rect(cardX, cardY, cardWidth, cardHeight);
  }
  ctx.fill();
  ctx.stroke();

  // 6. Barra lateral de acento (Cyan)
  ctx.fillStyle = '#38bdf8';
  const barWidth = Math.round(4 * scale);
  const barHeight = cardHeight - padY * 2;
  const barX = cardX + Math.round(12 * scale);
  const barY = cardY + padY;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(barX, barY, barWidth, barHeight, Math.round(2 * scale));
  } else {
    ctx.rect(barX, barY, barWidth, barHeight);
  }
  ctx.fill();

  // 7. Renderizar líneas de texto con sombra para máxima legibilidad
  const textStartX = barX + barWidth + Math.round(12 * scale);
  let currentY = cardY + padY + Math.round(16 * scale);

  lines.forEach((l, idx) => {
    ctx.font = l.isBold ? `bold ${idx === 0 ? fontSizeHeader : fontSizeBody}px sans-serif` : `${fontSizeBody}px sans-serif`;
    ctx.fillStyle = l.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(l.text, textStartX, currentY);
    currentY += lineHeight;
  });

  ctx.restore();

  // 8. Exportar canvas a Blob JPEG de alta calidad
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('Error al generar el archivo JPEG final desde Canvas');
  }

  return new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() });
}

export const TimelineCameraModal: React.FC<TimelineCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  currentUser,
  contextInfo = '',
  jobLocation = '',
}) => {
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto' | 'torch'>('off');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [initError, setInitError] = useState<string | null>(null);

  // Live Clock State
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  // Live GPS State
  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'unavailable'>('searching');

  const containerRef = useRef<HTMLDivElement>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  // 1. Reloj en tiempo real (actualización cada segundo)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // 2. Rastreo GPS en tiempo real para el overlay
  useEffect(() => {
    if (!isOpen) return;

    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    setGpsStatus('searching');
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGpsStatus('active');
      },
      (err) => {
        console.warn('[TimelineCamera] Geolocation watch error:', err);
        // Si ya teníamos coordenadas, las mantenemos
        setGpsStatus((prev) => (prev === 'active' ? 'active' : 'unavailable'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen]);

  // Safe stop helper
  const stopCamera = useCallback(async () => {
    try {
      await CameraPreview.stop({ force: true });
    } catch {
      // Ignorar si ya estaba detenida
    } finally {
      document.body.classList.remove('camera-preview-active');
      const root = document.getElementById('root');
      if (root) root.classList.remove('camera-preview-transparent');
    }
  }, []);

  // 3. Inicializar CameraPreview
  useEffect(() => {
    if (!isOpen) return;

    activeRef.current = true;
    let mounted = true;

    const startCamera = async () => {
      try {
        setInitError(null);
        setIsReady(false);

        const isNative = Capacitor.isNativePlatform();

        // En nativo, hacemos transparente el fondo de la app para que el SurfaceView detrás sea visible
        if (isNative) {
          document.body.classList.add('camera-preview-active');
          const root = document.getElementById('root');
          if (root) root.classList.add('camera-preview-transparent');
        }

        // Request permissions
        try {
          if (CameraPreview.requestPermissions) {
            await CameraPreview.requestPermissions({ disableAudio: true });
          }
        } catch (permErr) {
          console.warn('[TimelineCamera] Permission request warning:', permErr);
        }

        // Configuración adaptativa según entorno
        // En Web / Chrome: toBack: false y parent: 'timeline-camera-preview-container' asegura que el <video>
        // se monte directamente dentro del contenedor del modal y sea visible al 100%.
        // En Android Nativo: toBack: true coloca la vista de cámara tras el WebView transparente.
        const options: any = {
          position: 'rear',
          toBack: isNative,
          aspectRatio: 'fill',
          aspectMode: 'cover',
          storeToFile: false,
          disableAudio: true,
          rotateWhenOrientationChanged: true,
          initialZoomLevel: 1,
        };

        if (!isNative) {
          options.parent = 'timeline-camera-preview-container';
        }

        await CameraPreview.start(options);

        if (!mounted || !activeRef.current) {
          await stopCamera();
          return;
        }

        // Ajustes iniciales
        try {
          await CameraPreview.setZoom({ level: 1 });
        } catch {
          // No-op si no es soportado
        }

        try {
          await CameraPreview.setFlashMode({ flashMode: 'off' });
        } catch {
          // No-op si no es soportado
        }

        if (mounted) {
          setIsReady(true);
        }
      } catch (err: any) {
        console.error('[TimelineCamera] Error starting camera preview:', err);
        if (mounted) {
          setInitError(err?.message || 'No se pudo inicializar la cámara integrada.');
          await stopCamera();
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      activeRef.current = false;
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  // Flash toggle handler
  const handleToggleFlash = async () => {
    const nextMode: Record<string, 'off' | 'on' | 'auto' | 'torch'> = {
      off: 'on',
      on: 'auto',
      auto: 'torch',
      torch: 'off',
    };
    const next = nextMode[flashMode] || 'off';
    setFlashMode(next);
    try {
      await CameraPreview.setFlashMode({ flashMode: next });
    } catch (err) {
      console.warn('[TimelineCamera] Error setting flash mode:', err);
    }
  };

  // Zoom handler
  const handleSetZoom = async (newZoom: number) => {
    const clamped = Math.max(1, Math.min(5, Number(newZoom.toFixed(1))));
    setZoomLevel(clamped);
    try {
      await CameraPreview.setZoom({ level: clamped });
    } catch (err) {
      console.warn('[TimelineCamera] Error setting zoom:', err);
    }
  };

  // Pinch to zoom handler
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      const delta = (newDistance - touchDistanceRef.current) / 150;
      touchDistanceRef.current = newDistance;

      const newLevel = Math.max(1, Math.min(5, zoomLevel + delta));
      handleSetZoom(newLevel);
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  // Capture & Stamp handler
  const handleCapture = async () => {
    if (isCapturing || !isReady) return;
    setIsCapturing(true);

    try {
      const result = await CameraPreview.capture({
        width: 1920,
        quality: 90,
        format: 'jpeg',
      });

      if (result && result.value) {
        const formattedTimestamp = currentDateTime.toLocaleString('es-CR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        const technicianName = currentUser?.name || currentUser?.displayName || currentUser?.email || 'Técnico';

        // 1. Estampar la información del overlay directamente en la fotografía
        const stampedFile = await stampOverlayOnImage(
          result.value,
          {
            company: 'TENTELCOM',
            timestamp: formattedTimestamp,
            technician: technicianName,
            contextInfo: contextInfo,
            locationName: jobLocation,
            coords: gpsCoords,
          },
          `timeline_photo_${Date.now()}.jpg`
        );

        // 2. Detener cámara y entregar fotografía al Timeline
        await stopCamera();
        onCapture(stampedFile);
        onClose();
      } else {
        throw new Error('No se recibió la imagen de la cámara.');
      }
    } catch (err: any) {
      console.error('[TimelineCamera] Capture failed:', err);
      alert('Error al capturar la imagen: ' + (err?.message || 'Intente nuevamente'));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClose = async () => {
    await stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  const isNative = Capacitor.isNativePlatform();
  const technicianName = currentUser?.name || currentUser?.displayName || currentUser?.email || 'Técnico';
  const formattedDate = currentDateTime.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = currentDateTime.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`fixed inset-0 z-[9999] flex flex-col justify-between select-none overflow-hidden ${
        isNative ? 'bg-transparent' : 'bg-black'
      }`}
    >
      {/* 0. Contenedor del Preview de Video (Especialmente para Web/Chrome/PWA) */}
      <div
        id="timeline-camera-preview-container"
        className={`absolute inset-0 w-full h-full z-0 overflow-hidden flex items-center justify-center pointer-events-none ${
          isNative ? 'bg-transparent' : 'bg-black'
        }`}
      />

      {/* 1. Barra Superior: Controles de Flash y Cerrar */}
      <div className="flex items-center justify-between p-4 pt-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-30 pointer-events-auto">
        <IconButton
          icon={<FiX className="w-6 h-6 text-white" />}
          onClick={handleClose}
          variant="neutral"
          className="!p-2.5 bg-black/50 hover:bg-black/70 active:bg-black/90 text-white rounded-full border border-white/20 backdrop-blur-md shadow-lg"
          title="Cerrar cámara"
        />

        {/* Flash Mode Toggle */}
        <button
          type="button"
          onClick={handleToggleFlash}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-black/50 hover:bg-black/70 text-white rounded-full border border-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider shadow-lg transition-all"
        >
          {flashMode === 'off' && (
            <>
              <FiZapOff className="w-4 h-4 text-slate-300" />
              <span>Flash Off</span>
            </>
          )}
          {flashMode === 'on' && (
            <>
              <FiZap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span>Flash On</span>
            </>
          )}
          {flashMode === 'auto' && (
            <>
              <FiZap className="w-4 h-4 text-blue-400" />
              <span>Auto</span>
            </>
          )}
          {flashMode === 'torch' && (
            <>
              <FiZap className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
              <span>Linterna</span>
            </>
          )}
        </button>
      </div>

      {/* 2. OVERLAY EN TIEMPO REAL (Información visible sobre el preview) */}
      <div className="px-4 z-20 pointer-events-none flex flex-col items-start gap-2">
        <div className="bg-slate-950/80 border border-white/20 backdrop-blur-md rounded-2xl p-3 shadow-2xl text-white max-w-sm flex flex-col gap-1.5">
          {/* Header Badge */}
          <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5">
            <span className="text-xs font-black tracking-wider text-sky-400 uppercase">
              TENTELCOM
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                EN VIVO
              </span>
            </div>
          </div>

          {/* Fecha y Hora en tiempo real */}
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <FiClock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{formattedDate}</span>
            <span className="text-sky-300 font-black">{formattedTime}</span>
          </div>

          {/* Técnico */}
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <FiUser className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Técnico: <strong className="text-white">{technicianName}</strong></span>
          </div>

          {/* Contexto si existe */}
          {contextInfo && (
            <div className="text-[11px] text-slate-300 font-medium pl-5 truncate">
              {contextInfo}
            </div>
          )}

          {/* Ubicación y Coordenadas GPS */}
          <div className="flex flex-col gap-0.5 pt-1 border-t border-white/10 text-[11px]">
            {jobLocation && (
              <div className="flex items-center gap-1.5 text-sky-300 font-semibold truncate">
                <FiMapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">{jobLocation}</span>
              </div>
            )}

            {gpsCoords ? (
              <div className="flex items-center gap-1.5 text-emerald-300 font-mono text-[10px]">
                <FiNavigation className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>
                  {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)}
                </span>
                {gpsCoords.accuracy && (
                  <span className="text-slate-400">
                    (±{gpsCoords.accuracy.toFixed(1)}m)
                  </span>
                )}
              </div>
            ) : gpsStatus === 'searching' ? (
              <div className="flex items-center gap-1.5 text-amber-300 text-[10px] italic">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>Buscando satélites GPS...</span>
              </div>
            ) : (
              <div className="text-slate-400 text-[10px] italic pl-4">
                GPS no disponible
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error State if any */}
      {initError && (
        <div className="mx-6 p-4 bg-rose-900/90 text-white rounded-2xl border border-rose-500 backdrop-blur-md text-center flex flex-col gap-2 z-30 pointer-events-auto">
          <p className="font-bold text-sm">Error de Cámara</p>
          <p className="text-xs text-rose-200">{initError}</p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-2 py-2 px-4 bg-white text-rose-900 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-rose-100 transition-colors"
          >
            Volver al Timeline
          </button>
        </div>
      )}

      {/* 3. Barra Inferior: Selector de Zoom, Botón de Captura */}
      <div className="flex flex-col items-center gap-4 p-6 pb-8 bg-gradient-to-t from-black/85 via-black/50 to-transparent z-30 pointer-events-auto">
        {/* Controles de Zoom */}
        <div className="flex items-center gap-2 bg-black/50 border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg">
          <button
            type="button"
            onClick={() => handleSetZoom(zoomLevel - 0.5)}
            disabled={zoomLevel <= 1}
            className="p-1 text-white/80 hover:text-white disabled:opacity-30 transition-colors"
            title="Reducir zoom"
          >
            <FiMinus className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1 px-1">
            {[1, 2, 3].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => handleSetZoom(z)}
                className={`w-7 h-7 rounded-full text-[11px] font-black transition-all ${
                  Math.abs(zoomLevel - z) < 0.25
                    ? 'bg-sky-400 text-black shadow-md scale-110'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleSetZoom(zoomLevel + 0.5)}
            disabled={zoomLevel >= 5}
            className="p-1 text-white/80 hover:text-white disabled:opacity-30 transition-colors"
            title="Aumentar zoom"
          >
            <FiPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Botón de Captura Shutter */}
        <div className="flex items-center justify-center w-full">
          <button
            type="button"
            onClick={handleCapture}
            disabled={!isReady || isCapturing}
            className="relative group p-1.5 rounded-full border-4 border-white/90 bg-transparent hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100"
            title="Tomar fotografía con overlay"
          >
            <div className="w-16 h-16 rounded-full bg-white group-active:bg-slate-200 transition-colors shadow-2xl flex items-center justify-center">
              {isCapturing && (
                <div className="w-8 h-8 rounded-full border-3 border-slate-400 border-t-sky-500 animate-spin" />
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
