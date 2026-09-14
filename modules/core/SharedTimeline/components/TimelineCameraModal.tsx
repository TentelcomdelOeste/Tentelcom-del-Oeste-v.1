import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraPreview } from '@capgo/camera-preview';
import { Capacitor } from '@capacitor/core';
import { FiX, FiZap, FiZapOff, FiPlus, FiMinus, FiRefreshCw } from 'react-icons/fi';
import { IconButton } from '@/design-system';
import { CameraOverlay } from './CameraOverlay';
import { useCameraOverlay } from './useCameraOverlay';

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

interface PictureSize {
  width: number;
  height: number;
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

  const { stampOverlayOnImage } = useCameraOverlay();
  const zoomLevelRef = useRef(zoomLevel);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const captureSizeRef = useRef<PictureSize | null>(null);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'unavailable'>('searching');

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOpen]);

  const stopCamera = useCallback(async () => {
    try {
      await CameraPreview.stop({ force: true });
    } catch {
      // Camera may already be stopped.
    } finally {
      document.body.classList.remove('camera-preview-active');
      document.documentElement.classList.remove('native-camera-active');
      const root = document.getElementById('root');
      if (root) root.classList.remove('camera-preview-transparent');
    }
  }, []);

  const resolveLargestPictureSize = useCallback(async () => {
    try {
      if (!CameraPreview.getSupportedPictureSizes) return null;

      const response = await CameraPreview.getSupportedPictureSizes();
      const groups = Array.isArray((response as any)?.supportedPictureSizes)
        ? (response as any).supportedPictureSizes
        : [];
      const group = groups.find(
        (item: any) => String(item?.facing || '').toLowerCase() === cameraPosition
      );
      const sizes: PictureSize[] = Array.isArray(group?.supportedPictureSizes)
        ? group.supportedPictureSizes.filter(
            (size: any) =>
              Number.isFinite(Number(size?.width)) &&
              Number.isFinite(Number(size?.height)) &&
              Number(size.width) > 0 &&
              Number(size.height) > 0
          )
        : [];

      if (!sizes.length) return null;
      return [...sizes].sort(
        (a, b) => Number(b.width) * Number(b.height) - Number(a.width) * Number(a.height)
      )[0] || null;
    } catch (error) {
      console.warn('[TimelineCamera] Could not resolve native picture size:', error);
      return null;
    }
  }, [cameraPosition]);

  useEffect(() => {
    if (!isOpen) return;

    activeRef.current = true;
    let mounted = true;

    const startCamera = async () => {
      try {
        setInitError(null);
        setIsReady(false);
        captureSizeRef.current = null;

        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
          document.body.classList.add('camera-preview-active');
          document.documentElement.classList.add('native-camera-active');
          const root = document.getElementById('root');
          if (root) root.classList.add('camera-preview-transparent');
        }

        try {
          if (CameraPreview.requestPermissions) {
            await CameraPreview.requestPermissions({ disableAudio: true });
          }
        } catch (permErr) {
          console.warn('[TimelineCamera] Permission request warning:', permErr);
        }

        const options: any = {
          position: cameraPosition,
          toBack: isNative,
          aspectRatio: 'fill',
          aspectMode: 'cover',
          storeToFile: false,
          disableAudio: true,
          rotateWhenOrientationChanged: true,
          initialZoomLevel: zoomLevelRef.current,
          enableHighResolution: true,
          className: 'camera-preview-video',
        };

        if (!isNative) {
          options.parent = 'timeline-camera-preview-container';
        }

        const previewInfo = await CameraPreview.start(options);
        console.info('[TimelineCamera] Preview started:', previewInfo);

        captureSizeRef.current = await resolveLargestPictureSize();
        if (captureSizeRef.current) {
          console.info('[TimelineCamera] Native capture size:', captureSizeRef.current);
        }

        if (!mounted || !activeRef.current) {
          await stopCamera();
          return;
        }

        try {
          await CameraPreview.setZoom({ level: zoomLevelRef.current });
        } catch {
          try {
            await CameraPreview.setZoom({ level: 1 });
          } catch {
            // Unsupported on this device.
          }
        }

        try {
          await CameraPreview.setFlashMode({ flashMode: 'off' });
        } catch {
          // Unsupported.
        }

        if (mounted) setIsReady(true);
      } catch (err: any) {
        console.error('[TimelineCamera] Error starting camera preview:', err);
        if (mounted) {
          setInitError(err?.message || 'No se pudo inicializar la cámara integrada.');
          await stopCamera();
        }
      }
    };

    void startCamera();

    return () => {
      mounted = false;
      activeRef.current = false;
      void stopCamera();
    };
  }, [isOpen, cameraPosition, resolveLargestPictureSize, stopCamera]);

  const handleToggleFlash = async () => {
    if (cameraPosition === 'front') return;
    const next = flashMode === 'off' ? 'on' : 'off';
    setFlashMode(next);

    try {
      await CameraPreview.setFlashMode({ flashMode: next === 'on' ? 'torch' : 'off' });
    } catch (err) {
      console.warn('[TimelineCamera] Torch failed, using flash fallback:', err);
      try {
        await CameraPreview.setFlashMode({ flashMode: next });
      } catch (fallbackError) {
        console.warn('[TimelineCamera] Flash fallback failed:', fallbackError);
      }
    }
  };

  const handleFlipCamera = async () => {
    if (!isReady || isCapturing) return;
    const nextPosition = cameraPosition === 'rear' ? 'front' : 'rear';
    setCameraPosition(nextPosition);
    if (nextPosition === 'front') setFlashMode('off');
  };

  const handleSetZoom = async (newZoom: number) => {
    const clamped = Math.max(1, Math.min(5, Number(newZoom.toFixed(1))));
    setZoomLevel(clamped);
    try {
      await CameraPreview.setZoom({ level: clamped });
    } catch (err) {
      console.warn('[TimelineCamera] Error setting zoom:', err);
    }
  };

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
      void handleSetZoom(zoomLevel + delta);
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  const handleCapture = async () => {
    if (isCapturing || !isReady) return;
    setIsCapturing(true);

    try {
      const captureOptions: any = {
        quality: 100,
        format: 'jpeg',
        saveToGallery: false,
        mirrorFrontCamera: false,
        photoQualityPrioritization: 'quality',
      };

      const nativeSize = captureSizeRef.current;
      if (nativeSize) {
        captureOptions.width = nativeSize.width;
        captureOptions.height = nativeSize.height;
      }

      const result = await CameraPreview.capture(captureOptions);
      if (!result?.value) throw new Error('No se recibió la imagen de la cámara.');

      console.info('[TimelineCamera] Capture received:', {
        bytesBase64: String(result.value).length,
        width: nativeSize?.width,
        height: nativeSize?.height,
      });

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

      // El overlay en vivo sigue siendo independiente. Aquí se estampa la misma información
      // sobre la fotografía final para que la evidencia conserve los datos aunque se comparta.
      const stampedFile = await stampOverlayOnImage(
        result.value,
        {
          company: 'TENTELCOM',
          timestamp: formattedTimestamp,
          technician: technicianName,
          contextInfo,
          locationName: jobLocation,
          coords: gpsCoords,
        },
        `camera_highres_${Date.now()}.jpg`
      );

      // Impide la compresión reductiva de 1200 px/75 % del uploader de Timeline.
      (stampedFile as any).bypassCompression = true;

      console.info('[TimelineCamera] Stamped high-resolution file:', {
        name: stampedFile.name,
        sizeBytes: stampedFile.size,
        type: stampedFile.type,
      });

      await stopCamera();
      onCapture(stampedFile);
      onClose();
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
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const formattedTime = currentDateTime.toLocaleTimeString('es-CR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`fixed inset-0 z-[9999] flex flex-col justify-between select-none overflow-hidden ${isNative ? 'bg-transparent' : 'bg-black'}`}
    >
      <div
        id="timeline-camera-preview-container"
        className={`absolute inset-0 w-full h-full z-0 overflow-hidden flex items-center justify-center pointer-events-none ${isNative ? 'bg-transparent' : 'bg-black'}`}
      />

      <div className="flex items-center justify-end gap-2 p-3 pt-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-30 pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleFlash}
          disabled={cameraPosition === 'front'}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-black/50 hover:bg-black/70 active:bg-black/95 text-white rounded-full border border-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider shadow-md transition-all disabled:opacity-40"
          title={cameraPosition === 'front' ? 'Flash no disponible en cámara frontal' : 'Controlar Flash'}
        >
          {cameraPosition === 'front' ? (
            <><FiZapOff className="w-3.5 h-3.5 text-slate-500" /><span className="text-slate-400">NO DISP.</span></>
          ) : flashMode === 'off' ? (
            <><FiZapOff className="w-3.5 h-3.5 text-slate-300" /><span>FLASH OFF</span></>
          ) : (
            <><FiZap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /><span>FLASH ON</span></>
          )}
        </button>

        <button
          type="button"
          onClick={handleFlipCamera}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-black/50 hover:bg-black/70 active:bg-black/90 text-white rounded-full border border-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider shadow-md transition-all"
          title="Cambiar Cámara (Frontal/Trasera)"
        >
          <FiRefreshCw className="w-3.5 h-3.5 text-sky-400" />
          <span>{cameraPosition === 'rear' ? 'TRASERA' : 'FRONTAL'}</span>
        </button>

        <IconButton
          icon={<FiX className="w-4 h-4 text-white" />}
          onClick={handleClose}
          variant="neutral"
          className="!p-1.5 bg-black/50 hover:bg-black/70 active:bg-black/90 text-white rounded-full border border-white/20 backdrop-blur-md shadow-md"
          title="Cerrar cámara"
        />
      </div>

      {/* OVERLAY EN TIEMPO REAL — NO ELIMINAR */}
      <CameraOverlay
        technicianName={technicianName}
        contextInfo={contextInfo}
        jobLocation={jobLocation}
        gpsCoords={gpsCoords}
        gpsStatus={gpsStatus}
        formattedDate={formattedDate}
        formattedTime={formattedTime}
      />

      {initError && (
        <div className="mx-6 p-4 bg-rose-900/90 text-white rounded-2xl border border-rose-500 backdrop-blur-md text-center flex flex-col gap-2 z-30 pointer-events-auto">
          <p className="font-bold text-sm">Error de Cámara</p>
          <p className="text-xs text-rose-200">{initError}</p>
          <button type="button" onClick={handleClose} className="mt-2 py-2 px-4 bg-white text-rose-900 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-rose-100 transition-colors">
            Volver al Timeline
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 p-6 pb-8 bg-gradient-to-t from-black/85 via-black/50 to-transparent z-30 pointer-events-auto">
        <div className="flex items-center gap-2 bg-black/50 border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg">
          <button type="button" onClick={() => void handleSetZoom(zoomLevel - 0.5)} disabled={zoomLevel <= 1} className="p-1 text-white/80 hover:text-white disabled:opacity-30 transition-colors" title="Reducir zoom">
            <FiMinus className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1 px-1">
            {[1, 2, 3].map((z) => (
              <button key={z} type="button" onClick={() => void handleSetZoom(z)} className={`w-7 h-7 rounded-full text-[11px] font-black transition-all ${Math.abs(zoomLevel - z) < 0.25 ? 'bg-sky-400 text-black shadow-md scale-110' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                {z}x
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void handleSetZoom(zoomLevel + 0.5)} disabled={zoomLevel >= 5} className="p-1 text-white/80 hover:text-white disabled:opacity-30 transition-colors" title="Aumentar zoom">
            <FiPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-center w-full">
          <button type="button" onClick={() => void handleCapture()} disabled={!isReady || isCapturing} className="relative group p-1.5 rounded-full border-4 border-white/90 bg-transparent hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100" title="Tomar fotografía con overlay">
            <div className="w-16 h-16 rounded-full bg-white group-active:bg-slate-200 transition-colors shadow-2xl flex items-center justify-center">
              {isCapturing && <div className="w-8 h-8 rounded-full border-3 border-slate-400 border-t-sky-500 animate-spin" />}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
