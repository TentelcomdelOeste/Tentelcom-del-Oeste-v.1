/**
 * Fuerza una solicitud de cámara de alta resolución en navegador.
 *
 * @capgo/camera-preview en Web usa getUserMedia({ video: true }) para
 * solicitar permisos y luego getUserMedia({ video: { facingMode } }) para
 * iniciar el preview. En Chrome Android, una primera solicitud sin
 * restricciones de resolución puede fijar la sesión en una resolución baja
 * (por ejemplo 480x640), y las solicitudes siguientes pueden heredarla.
 *
 * Este parche solo agrega preferencias de alta resolución cuando la llamada
 * no define ya width/height. No modifica las llamadas que ya tienen una
 * resolución explícita.
 */
let installed = false;

export function installHighResolutionCameraConstraints(): void {
  if (installed || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return;
  }

  const mediaDevices = navigator.mediaDevices;
  const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);

  mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints) => {
    if (!constraints?.video) {
      return originalGetUserMedia(constraints);
    }

    const originalVideo = constraints.video === true ? {} : { ...constraints.video };
    const hasExplicitWidth = originalVideo.width !== undefined;
    const hasExplicitHeight = originalVideo.height !== undefined;

    const videoConstraints: MediaTrackConstraints = {
      ...originalVideo,
    };

    if (!hasExplicitWidth && !hasExplicitHeight) {
      // Valor deliberadamente alto: Chrome intenta acercarse al máximo
      // disponible sin convertirlo en una restricción obligatoria.
      videoConstraints.width = { ideal: 4096 };
      videoConstraints.height = { ideal: 2160 };

      // Evita que el navegador recorte/reduzca artificialmente una fuente
      // de mayor resolución para satisfacer las dimensiones solicitadas.
      if (videoConstraints.resizeMode === undefined) {
        videoConstraints.resizeMode = 'none';
      }
    }

    const stream = await originalGetUserMedia({
      ...constraints,
      video: videoConstraints,
    });

    const track = stream.getVideoTracks?.()[0];
    if (!track) return stream;

    try {
      const initialSettings = track.getSettings();
      console.info('[CameraResolution] Stream inicial:', {
        width: initialSettings.width,
        height: initialSettings.height,
        facingMode: initialSettings.facingMode,
      });

      // Segunda oportunidad: si el navegador todavía entregó una resolución
      // baja, pedir la máxima capacidad conocida del track sin hacerla
      // obligatoria. Esto funciona especialmente bien en Chrome Android.
      if (
        (initialSettings.width || 0) < 1280 ||
        (initialSettings.height || 0) < 720
      ) {
        const capabilities = track.getCapabilities?.() as any;
        const maxWidth = Number(capabilities?.width?.max);
        const maxHeight = Number(capabilities?.height?.max);

        const idealWidth = Number.isFinite(maxWidth) && maxWidth > 0
          ? Math.min(maxWidth, 4096)
          : 4096;
        const idealHeight = Number.isFinite(maxHeight) && maxHeight > 0
          ? Math.min(maxHeight, 2160)
          : 2160;

        await track.applyConstraints({
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
          resizeMode: 'none',
        });

        const finalSettings = track.getSettings();
        console.info('[CameraResolution] Stream después de optimización:', {
          width: finalSettings.width,
          height: finalSettings.height,
          facingMode: finalSettings.facingMode,
        });
      }
    } catch (error) {
      // La cámara debe seguir funcionando aunque el navegador no permita
      // cambiar la resolución después de abrir el stream.
      console.warn('[CameraResolution] No se pudo optimizar la resolución:', error);
    }

    return stream;
  };

  installed = true;
  console.info('[CameraResolution] High-resolution getUserMedia patch instalado.');
}
