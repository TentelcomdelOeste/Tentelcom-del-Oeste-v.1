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

/**
 * Cámara de Timeline.
 *
 * IMPORTANTE:
 * - En Web/PWA NO usamos CameraPreview.capture().
 * - Chrome Android dispone de ImageCapture.takePhoto(), que obtiene la
 *   resolución fotográfica máxima del sensor y no la limitada al preview.
 * - En Capacitor nativo mantenemos @capgo/camera-preview para no romper el
 *   flujo nativo existente.
 */
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
  const webVideoRef = useRef<HTMLVideoElement>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webTrackRef = useRef<MediaStreamTrack | null>(null);
  const webImageCaptureRef = useRef<any>(null);
  const webPhotoCapabilitiesRef = useRef<any>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const captureSizeRef = useRef<PictureSize | null>(null);

  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'unavailable'>('searching');

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

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

  const stopWebCamera = useCallback(() => {
    try {
      const stream = webStreamRef.current;
      stream?.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.warn('[TimelineCamera] Error stopping Web camera:', error);
    }

    webStreamRef.current = null;
    webTrackRef.current = null;
    webImageCaptureRef.current = null;
    webPhotoCapabilitiesRef.current = null;

    const video = webVideoRef.current;
    if (video) {
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        // no-op
      }
    }
  }, []);

  const stopCamera = useCallback(async () => {
    if (!isNative) {
      stopWebCamera();
      return;
    }

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
  }, [isNative, stopWebCamera]);

  const startWebCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no permite acceder a la cámara.');
    }

    stopWebCamera();

    const facingMode = cameraPosition === 'rear' ? 'environment' : 'user';

    // Solicitamos una fuente de vídeo de alta resolución. Usamos ideal/max y
    // no una dimensión fija porque cada teléfono ofrece modos diferentes.
    const attempts: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          facingMode: { exact: facingMode },
          width: { min: 1280, ideal: 3840, max: 4096 },
          height: { min: 720, ideal: 2880, max: 3072 },
          resizeMode: 'none',
          frameRate: { ideal: 30, max: 30 },
        },
      },
      {
        audio: false,
        video: {
          facingMode,
          width: { min: 1280, ideal: 2560, max: 4096 },
          height: { min: 720, ideal: 1920, max: 3072 },
          resizeMode: 'none',
        },
      },
      {
        audio: false,
        video: {
          facingMode,
          width: { min: 1280, ideal: 1920 },
          height: { min: 720, ideal: 1080 },
        },
      },
      {
        audio: false,
        video: { facingMode },
      },
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (error) {
        lastError = error;
        console.warn('[TimelineCamera] Web camera constraint fallback:', {
          name: (error as any)?.name,
          message: (error as any)?.message,
          constraints,
        });
      }
    }

    if (!stream) {
      throw lastError || new Error('No se pudo abrir la cámara.');
    }

    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((item) => item.stop());
      throw new Error('La cámara no devolvió una pista de vídeo.');
    }

    webStreamRef.current = stream;
    webTrackRef.current = track;

    const video = webVideoRef.current;
    if (!video) {
      stream.getTracks().forEach((item) => item.stop());
      throw new Error('No se encontró el visor de cámara.');
    }

    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });

    await video.play();

    // Una vez transmitiendo, obtenemos las capacidades reales y pedimos el
    // mayor modo de vídeo que el navegador permita para que el preview tampoco
    // quede limitado a 480x640.
    try {
      const capabilities = track.getCapabilities?.() as any;
      const maxWidth = Number(capabilities?.width?.max);
      const maxHeight = Number(capabilities?.height?.max);

      if (maxWidth >= 1280 && maxHeight >= 720) {
        await track.applyConstraints({
          width: { ideal: Math.min(maxWidth, 4096) },
          height: { ideal: Math.min(maxHeight, 3072) },
          resizeMode: 'none',
        });
      }
    } catch (error) {
      console.warn('[TimelineCamera] Could not maximize live stream:', error);
    }

    // ImageCapture es la parte crítica: takePhoto() usa la resolución de
    // fotografía del sensor, que puede ser muy superior a video.videoWidth.
    const ImageCaptureCtor = (window as any).ImageCapture;
    if (typeof ImageCaptureCtor === 'function') {
      try {
        const imageCapture = new ImageCaptureCtor(track);
        webImageCaptureRef.current = imageCapture;
        webPhotoCapabilitiesRef.current = await imageCapture.getPhotoCapabilities();
      } catch (error) {
        console.warn('[TimelineCamera] ImageCapture unavailable:', error);
        webImageCaptureRef.current = null;
        webPhotoCapabilitiesRef.current = null;
      }
    }

    const settings = track.getSettings();
    console.info('[TimelineCamera] WEB CAMERA REAL VIDEO RESOLUTION:', {
      width: settings.width,
      height: settings.height,
      facingMode: settings.facingMode,
      zoom: (settings as any).zoom,
      videoElementWidth: video.videoWidth,
      videoElementHeight: video.videoHeight,
    });

    const photoCaps = webPhotoCapabilitiesRef.current;
    if (photoCaps?.imageWidth && photoCaps?.imageHeight) {
      console.info('[TimelineCamera] WEB STILL PHOTO CAPABILITIES:', {
        maxWidth: photoCaps.imageWidth.max,
        maxHeight: photoCaps.imageHeight.max,
        minWidth: photoCaps.imageWidth.min,
        minHeight: photoCaps.imageHeight.min,
      });
    }

    if (!webImageCaptureRef.current) {
      console.warn('[TimelineCamera] ImageCapture unavailable; capture will use the high-resolution video frame fallback.');
    }
  }, [cameraPosition, stopWebCamera]);

  useEffect(() => {
    if (!isOpen) return;

    activeRef.current = true;
    let mounted = true;

    const startCamera = async () => {
      try {
        setInitError(null);
        setIsReady(false);
        captureSizeRef.current = null;

        if (isNative) {
          document.body.classList.add('camera-preview-active');
          document.documentElement.classList.add('native-camera-active');
          const root = document.getElementById('root');
          if (root) root.classList.add('camera-preview-transparent');

          try {
            if (CameraPreview.requestPermissions) {
              await CameraPreview.requestPermissions({ disableAudio: true });
            }
          } catch (permErr) {
            console.warn('[TimelineCamera] Permission request warning:', permErr);
          }

          const options: any = {
            position: cameraPosition,
            toBack: true,
            aspectRatio: 'fill',
            aspectMode: 'cover',
            storeToFile: false,
            disableAudio: true,
            rotateWhenOrientationChanged: true,
            initialZoomLevel: zoomLevelRef.current,
            enableHighResolution: true,
            className: 'camera-preview-video',
          };

          const previewInfo = await CameraPreview.start(options);
          console.info('[TimelineCamera] Native preview started:', previewInfo);

          try {
            if (CameraPreview.getSupportedPictureSizes) {
              const response = await CameraPreview.getSupportedPictureSizes();
              const groups = Array.isArray((response as any)?.supportedPictureSizes)
                ? (response as any).supportedPictureSizes
                : [];
              const group = groups.find(
                (item: any) => String(item?.facing || '').toLowerCase() === cameraPosition
              );
              const sizes: PictureSize[] = Array.isArray(group?.supportedPictureSizes)
                ? group.supportedPictureSizes.filter((size: any) => Number(size?.width) > 0 && Number(size?.height) > 0)
                : [];
              captureSizeRef.current = [...sizes].sort(
                (a, b) => b.width * b.height - a.width * a.height
              )[0] || null;
            }
          } catch (error) {
            console.warn('[TimelineCamera] Native picture-size query failed:', error);
          }

          try {
            await CameraPreview.setZoom({ level: zoomLevelRef.current });
          } catch {
            // Unsupported on this device.
          }

          try {
            await CameraPreview.setFlashMode({ flashMode: 'off' });
          } catch {
            // Unsupported.
          }
        } else {
          await startWebCamera();
        }

        if (!mounted || !activeRef.current) {
          await stopCamera();
          return;
        }

        setIsReady(true);
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
  }, [isOpen, cameraPosition, isNative, startWebCamera, stopCamera]);

  const handleToggleFlash = async () => {
    if (cameraPosition === 'front') return;

    const next = flashMode === 'off' ? 'on' : 'off';
    setFlashMode(next);

    if (!isNative) {
      const track = webTrackRef.current;
      if (!track) return;

      try {
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities?.torch) {
          await track.applyConstraints({ advanced: [{ torch: next === 'on' } as any] });
        }
      } catch (error) {
        console.warn('[TimelineCamera] Web torch unavailable:', error);
      }
      return;
    }

    try {
      await CameraPreview.setFlashMode({ flashMode: next === 'on' ? 'torch' : 'off' });
    } catch (err) {
      console.warn('[TimelineCamera] Native torch failed:', err);
    }
  };

  const handleFlipCamera = async () => {
    if (!isReady || isCapturing) return;
    const nextPosition = cameraPosition === 'rear' ? 'front' : 'rear';
    await stopCamera();
    setIsReady(false);
    setCameraPosition(nextPosition);
    if (nextPosition === 'front') setFlashMode('off');
  };

  const handleSetZoom = async (newZoom: number) => {
    const track = webTrackRef.current;
    let maxZoom = 5;

    if (!isNative && track) {
      try {
        const capabilities = track.getCapabilities?.() as any;
        if (Number.isFinite(Number(capabilities?.zoom?.max))) {
          maxZoom = Math.min(5, Number(capabilities.zoom.max));
        }
      } catch {
        // Keep UI fallback at 5x.
      }
    }

    const clamped = Math.max(1, Math.min(maxZoom, Number(newZoom.toFixed(1))));
    setZoomLevel(clamped);
    zoomLevelRef.current = clamped;

    try {
      if (!isNative && track) {
        await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
      } else if (isNative) {
        await CameraPreview.setZoom({ level: clamped });
      }
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

  const blobToDataUrl = async (blob: Blob): Promise<string> => {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la fotografía capturada.'));
      reader.readAsDataURL(blob);
    });
  };

  const captureWebHighResolution = async (): Promise<string> => {
    const track = webTrackRef.current;
    if (!track) throw new Error('La cámara Web no está activa.');

    const imageCapture = webImageCaptureRef.current;
    if (imageCapture) {
      try {
        const photoCaps = webPhotoCapabilitiesRef.current;
        const photoSettings: any = {};

        if (flashMode === 'on' && photoCaps?.fillLightMode?.includes?.('flash')) {
          photoSettings.fillLightMode = 'flash';
        } else if (flashMode === 'off' && photoCaps?.fillLightMode?.includes?.('off')) {
          photoSettings.fillLightMode = 'off';
        }

        if (photoCaps?.imageWidth?.max && photoCaps?.imageHeight?.max) {
          photoSettings.imageWidth = Math.round(photoCaps.imageWidth.max);
          photoSettings.imageHeight = Math.round(photoCaps.imageHeight.max);
        }

        let blob: Blob;
        try {
          blob = Object.keys(photoSettings).length > 0
            ? await imageCapture.takePhoto(photoSettings)
            : await imageCapture.takePhoto();
        } catch (firstError) {
          console.warn('[TimelineCamera] takePhoto settings failed; retrying native maximum:', firstError);
          blob = await imageCapture.takePhoto();
        }

        if (!blob || blob.size < 10000) {
          throw new Error('La cámara devolvió una fotografía demasiado pequeña.');
        }

        console.info('[TimelineCamera] FULL-RES WEB PHOTO:', {
          bytes: blob.size,
          type: blob.type,
        });

        return await blobToDataUrl(blob);
      } catch (error) {
        console.warn('[TimelineCamera] ImageCapture failed; using video-frame fallback:', error);
      }
    }

    // Fallback únicamente para navegadores sin ImageCapture.
    const video = webVideoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      throw new Error('No se pudo obtener una imagen de la cámara.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No se pudo preparar la captura de cámara.');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 1);
    console.info('[TimelineCamera] WEB VIDEO FALLBACK PHOTO:', {
      width: canvas.width,
      height: canvas.height,
      bytesBase64: dataUrl.length,
    });
    return dataUrl;
  };

  const handleCapture = async () => {
    if (isCapturing || !isReady) return;
    setIsCapturing(true);

    try {
      const capturedDataUrl = isNative
        ? (() => null)()
        : await captureWebHighResolution();

      let base64Data: string;
      if (isNative) {
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
        base64Data = result.value;

        console.info('[TimelineCamera] NATIVE PHOTO:', {
          bytesBase64: String(base64Data).length,
          width: nativeSize?.width,
          height: nativeSize?.height,
        });
      } else {
        base64Data = capturedDataUrl || '';
        if (!base64Data) throw new Error('No se recibió la fotografía Web.');
      }

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

      // El overlay en vivo sigue siendo independiente. Aquí se estampa la misma
      // información sobre la fotografía final para que la evidencia conserve los datos.
      const stampedFile = await stampOverlayOnImage(
        base64Data,
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

      // Nunca permitir que el uploader reduzca esta fotografía de alta resolución.
      (stampedFile as any).bypassCompression = true;

      console.info('[TimelineCamera] FINAL HIGH-RES PHOTO:', {
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
      >
        {!isNative && (
          <video
            ref={webVideoRef}
            id="timeline-camera-web-video"
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        )}
      </div>

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
          onClick={() => void handleFlipCamera()}
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
