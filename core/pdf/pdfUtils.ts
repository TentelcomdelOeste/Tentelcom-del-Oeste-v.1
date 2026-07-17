import { Capacitor } from '@capacitor/core';
import { pdfFileEngine } from './pdfFileEngine';

/**
 * Detecta si el entorno de ejecución actual es un binario nativo (Android/iOS APK).
 */
export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}

/**
 * Procesa un Blob PDF generado: lo persiste físicamente si estamos en Android
 * o genera una URL de objeto temporal para descarga clásica si estamos en Web.
 */
export async function handleGeneratedPdf(blob: Blob, fileName: string): Promise<string> {
    if (isNative()) {
        try {
            const physicalPath = await pdfFileEngine.savePdfToDevice(fileName, blob);
            return physicalPath;
        } catch (error) {
            console.error("pdfUtils: Error persistiendo PDF en dispositivo nativo", error);
            return "";
        }
    } else {
        return URL.createObjectURL(blob);
    }
}
