import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraPreview } from '@capgo/camera-preview';
import { Capacitor } from '@capacitor/core';
import { FiX, FiZap, FiZapOff, FiPlus, FiMinus, FiMapPin, FiClock, FiUser, FiNavigation, FiRefreshCw } from 'react-icons/fi';
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
 * Mantenemos este procesamiento tal como está para que la fotografía final conserve el recuadro de alta visibilidad.
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

  // 8. Exportar canvas a Blob JPEG de alta calidad
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
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
  const [cameraPosition, setCameraPosition] = useState<'rear' | 'front'>('rear');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [initError, setInitError] = useState<string | null>(null);

  // Zoom Ref para persistir el zoom durante la reinstanciación sin re-ejecutar el efecto de la cámara
  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

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
        const options: any = {
          position: cameraPosition,
          toBack: isNative,
          aspectRatio: 'fill',
          aspectMode: 'cover',
          storeToFile: false,
          disableAudio: true,
          rotateWhenOrientationChanged: true,
          initialZoomLevel: zoomLevelRef.current,
        };

        if (!isNative) {
          options.parent = 'timeline-camera-preview-container';
        }

        await CameraPreview.start(options);

        if (!mounted || !activeRef.current) {
          await stopCamera();
          return;
        }

        // Restaurar zoom apropiadamente sin romper la cámara
        try {
          await CameraPreview.setZoom({ level: zoomLevelRef.current });
        } catch {
          try {
            await CameraPreview.setZoom({ level: 1 });
          } catch {
            // No-op
          }
        }

        // Inicializar Flash en Off
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
  }, [isOpen, cameraPosition, stopCamera]);

  // Flash toggle handler - Controla de verdad el flash de la cámara (torch enciende físicamente el LED)
  const handleToggleFlash = async () => {
    if (cameraPosition === 'front') return; // Sin flash físico en cámara frontal

    const next = flashMode === 'off' ? 'on' : 'off';
    setFlashMode(next);
    try {
      // 'torch' enciende físicamente el LED de la cámara trasera inmediatamente en Android/iOS
      await CameraPreview.setFlashMode({ flashMode: next === 'on' ? 'torch' : 'off' });
    } catch (err) {
      console.warn('[TimelineCamera] Error setting flash mode to torch, trying fallback:', err);
      try {
        await CameraPreview.setFlashMode({ flashMode: next });
      } catch (errFallback) {
        console.warn('[TimelineCamera] Flash fallback failed:', errFallback);
      }
    }
  };

  // Flip camera handler
  const handleFlipCamera = async () => {
    if (!isReady || isCapturing) return;
    const nextPosition = cameraPosition === 'rear' ? 'front' : 'rear';
    setCameraPosition(nextPosition);
    // Si pasamos a frontal, apagamos el flash en el estado inmediatamente
    if (nextPosition === 'front') {
      setFlashMode('off');
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
      let targetWidth = 1080; // Defaults de seguridad en retrato
      let targetHeight = 1920;

      try {
        const sizesResult = await CameraPreview.getSupportedPictureSizes();
        if (sizesResult && sizesResult.supportedPictureSizes) {
          const currentFacing = cameraPosition === 'front' ? 'front' : 'rear';
          const sizeGroup = sizesResult.supportedPictureSizes.find(
            (s: any) => s.facing?.toLowerCase() === currentFacing
          );

          if (sizeGroup && sizeGroup.supportedPictureSizes && sizeGroup.supportedPictureSizes.length > 0) {
            // Ordenar de mayor a menor por total de píxeles
            const sortedSizes = [...sizeGroup.supportedPictureSizes].sort((a: any, b: any) => {
              const pixelsA = (a.width || 0) * (a.height || 0);
              const pixelsB = (b.width || 0) * (b.height || 0);
              return pixelsB - pixelsA;
            });

            const bestSize = sortedSizes[0];
            if (bestSize && bestSize.width && bestSize.height) {
              const w = bestSize.width;
              const h = bestSize.height;
              // Asegurar proporción vertical (ancho < alto) para formato de pantalla vertical (retrato)
              // Esto evita que el plugin rellene con fondo negro el lienzo horizontal al capturar
              targetWidth = Math.min(w, h);
              targetHeight = Math.max(w, h);
              console.log(`[TimelineCamera] Usando la máxima resolución soportada en retrato: ${targetWidth}x${targetHeight}`);
            }
          }
        }
      } catch (sizeErr) {
        console.warn('[TimelineCamera] No se pudieron obtener los tamaños soportados, usando defaults de alta resolución:', sizeErr);
      }

      const result = await CameraPreview.capture({
        width: targetWidth,
        height: targetHeight,
        quality: 95,
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

        // 1. Estampar la información del overlay directamente en la fotografía usando Canvas
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
          `camera_highres_${Date.now()}.jpg`
        );

        // Etiquetar archivo para que useTimelineUploader no aplique compresión secundaria reductiva
        (stampedFile as any).bypassCompression = true;

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

      {/* 1. Barra Superior: Controles de Flash, Flip y Cerrar - Agrupados a la derecha */}
      <div className="flex items-center justify-end gap-2 p-3 pt-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-30 pointer-events-auto">
        {/* Botón de Flash */}
        <button
          type="button"
          onClick={handleToggleFlash}
          disabled={cameraPosition === 'front'}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-black/50 hover:bg-black/70 active:bg-black/95 text-white rounded-full border border-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider shadow-md transition-all disabled:opacity-40"
          title={cameraPosition === 'front' ? 'Flash no disponible en cámara frontal' : 'Controlar Flash'}
        >
          {cameraPosition === 'front' ? (
            <>
              <FiZapOff className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">NO DISP.</span>
            </>
          ) : flashMode === 'off' ? (
            <>
              <FiZapOff className="w-3.5 h-3.5 text-slate-300" />
              <span>FLASH OFF</span>
            </>
          ) : (
            <>
              <FiZap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span>FLASH ON</span>
            </>
          )}
        </button>

        {/* Botón para Voltear la Cámara */}
        <button
          type="button"
          onClick={handleFlipCamera}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-black/50 hover:bg-black/70 active:bg-black/90 text-white rounded-full border border-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider shadow-md transition-all"
          title="Cambiar Cámara (Frontal/Trasera)"
        >
          <FiRefreshCw className="w-3.5 h-3.5 text-sky-400" />
          <span>{cameraPosition === 'rear' ? 'TRASERA' : 'FRONTAL'}</span>
        </button>

        {/* Botón de Cerrar */}
        <IconButton
          icon={<FiX className="w-4 h-4 text-white" />}
          onClick={handleClose}
          variant="neutral"
          className="!p-1.5 bg-black/50 hover:bg-black/70 active:bg-black/90 text-white rounded-full border border-white/20 backdrop-blur-md shadow-md"
          title="Cerrar cámara"
        />
      </div>

      {/* 2. OVERLAY EN TIEMPO REAL - Solamente texto sobre el video en la parte superior izquierda */}
      <div
        className="absolute top-3 left-3 z-40 pointer-events-none flex flex-col gap-0.5 text-white font-medium select-none text-[11px] leading-tight tracking-wide text-left max-w-[55vw]"
        style={{
          textShadow: '1px 1px 1.5px rgba(0,0,0,0.95), -1px -1px 1.5px rgba(0,0,0,0.95), 1px -1px 1.5px rgba(0,0,0,0.95), -1px 1px 1.5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)'
        }}
      >
        <div className="text-sky-400 font-extrabold uppercase tracking-widest text-[12px]">
          TENTELCOM • <span className="text-emerald-400 animate-pulse">EN VIVO</span>
        </div>
        <div>
          {formattedDate} {formattedTime}
        </div>
        <div>
          👤 Técnico: {technicianName}
        </div>
        {contextInfo && (
          <div>
            🚚 {contextInfo}
          </div>
        )}
        {jobLocation && (
          <div className="truncate max-w-[50vw]">
            📍 {jobLocation}
          </div>
        )}
        {gpsCoords ? (
          <div className="text-emerald-300 font-mono text-[10px]">
            GPS: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} {gpsCoords.accuracy ? `(±${gpsCoords.accuracy.toFixed(1)}m)` : ''}
          </div>
        ) : gpsStatus === 'searching' ? (
          <div className="text-amber-400 text-[10px] italic">
            GPS: Buscando satélites...
          </div>
        ) : (
          <div className="text-slate-400 text-[10px] italic">
            GPS: No disponible
          </div>
        )}
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
