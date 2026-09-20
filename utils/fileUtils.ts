import { Capacitor } from '@capacitor/core';
import { pdfFileEngine } from '../core/pdf/pdfFileEngine';

export const triggerFileDownload = async (blob: Blob, fileName: string) => {
    console.log("triggerFileDownload: Iniciando...", { fileName, blobSize: blob?.size, blobType: blob?.type });

    if (!blob || blob.size === 0) {
        console.error("triggerFileDownload: Blob vacío o inválido, descarga cancelada.");
        return;
    }

    if (Capacitor.isNativePlatform()) {
        try {
            const finalUri = await pdfFileEngine.savePdfToDevice(fileName, blob);
            console.log("triggerFileDownload: Guardado nativo exitoso en", finalUri);
            await pdfFileEngine.openPdf(fileName);
            return;
        } catch (e) {
            console.error("triggerFileDownload: Error guardando local nativo", e);
            alert(`No se pudo guardar el archivo en el dispositivo. Asegúrese de otorgar permisos de almacenamiento. Detalles: ${e}`);
            return; // Detener flujo, no hacer fallback a web
        }
    }

    // Web Fallback / PWA
    console.log("triggerFileDownload: Web Fallback");
    const url = URL.createObjectURL(blob);
    console.log("triggerFileDownload: URL creada", url);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    console.log("triggerFileDownload: Link appendido y clickeando");
    link.click();
    console.log("triggerFileDownload: Link clickeado");
    document.body.removeChild(link);
    
    // Limpiamos después de un tiempo prudente (10s para permitir que el gestor de descargas de Android procese el stream)
    setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log("triggerFileDownload: URL revocada");
    }, 10000);
};

