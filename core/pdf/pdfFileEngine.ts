import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Convierte un Blob de JavaScript en una cadena codificada en Base64 de forma asíncrona.
 */
export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            if (!result) {
                reject(new Error("No se pudo leer el archivo blob"));
                return;
            }
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = () => {
            reject(reader.error || new Error("Error leyendo el Blob"));
        };
        reader.readAsDataURL(blob);
    });
}

/**
 * Convierte una cadena codificada en Base64 de vuelta a un Blob de JavaScript.
 */
export function base64ToBlob(base64: string, mimeType: string = 'application/pdf'): Blob {
    const byteCharacters = atob(base64);
    const byteArrays: Uint8Array[] = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
}

/**
 * Genera un nombre de archivo limpio y seguro.
 */
export function sanitizeFileName(name: string): string {
    return name.replace(/[^A-Za-z0-9_.-]/g, '_');
}

export const pdfFileEngine = {
    /**
     * Genera la ruta o URI físico para un archivo en el dispositivo.
     */
    async generatePdfPath(fileName: string): Promise<string> {
        const cleanName = sanitizeFileName(fileName);
        if (!Capacitor.isNativePlatform()) {
            return cleanName;
        }
        try {
            const result = await Filesystem.getUri({
                directory: Directory.Documents,
                path: cleanName
            });
            return result.uri;
        } catch (error) {
            console.error("pdfFileEngine: Error generando ruta PDF", error);
            return cleanName;
        }
    },

    /**
     * Verifica si un archivo PDF ya existe en el dispositivo físico.
     */
    async fileExists(fileName: string): Promise<boolean> {
        const cleanName = sanitizeFileName(fileName);
        if (!Capacitor.isNativePlatform()) {
            return false;
        }
        try {
            await Filesystem.stat({
                directory: Directory.Documents,
                path: cleanName
            });
            return true;
        } catch (error) {
            return false;
        }
    },

    /**
     * Revisa y solicita permisos explícitos de almacenamiento si es necesario.
     */
    async ensurePermissions(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) return true;
        
        try {
            const status = await Filesystem.checkPermissions();
            if (status.publicStorage === 'granted') {
                return true;
            }
            
            // Solicitar permisos
            const request = await Filesystem.requestPermissions();
            return request.publicStorage === 'granted';
        } catch (error) {
            console.error("pdfFileEngine: Error verificando permisos", error);
            return false; // Asumir denegado si falla la API
        }
    },

    /**
     * Guarda un archivo PDF físico real en el dispositivo Android.
     */
    async savePdfToDevice(fileName: string, blob: Blob): Promise<string> {
        const cleanName = sanitizeFileName(fileName);
        if (!Capacitor.isNativePlatform()) {
            console.log("pdfFileEngine: Guardado físico omitido (No nativo). nombre:", cleanName);
            return cleanName;
        }

        const hasPermission = await this.ensurePermissions();
        if (!hasPermission) {
            throw new Error("Permisos de almacenamiento denegados por el usuario.");
        }

        try {
            const base64Data = await blobToBase64(blob);
            await Filesystem.writeFile({
                directory: Directory.Documents,
                path: cleanName,
                data: base64Data
            });
            const finalUri = await this.generatePdfPath(cleanName);
            console.log("pdfFileEngine: PDF guardado con éxito. Ruta física:", finalUri);
            return finalUri;
        } catch (error) {
            console.error("pdfFileEngine: Error al guardar PDF físico", error);
            throw error;
        }
    },

    /**
     * Lee un archivo PDF físico guardado y lo devuelve como Blob de JS.
     */
    async readPdfFromDevice(fileName: string): Promise<Blob> {
        const cleanName = sanitizeFileName(fileName);
        if (!Capacitor.isNativePlatform()) {
            throw new Error("pdfFileEngine: Lectura física no disponible en entorno web");
        }
        try {
            const result = await Filesystem.readFile({
                directory: Directory.Documents,
                path: cleanName
            });
            
            // readFile devuelve base64 en result.data
            const base64Str = typeof result.data === 'string' ? result.data : '';
            return base64ToBlob(base64Str, 'application/pdf');
        } catch (error) {
            console.error("pdfFileEngine: Error leyendo PDF físico", error);
            throw error;
        }
    },

    /**
     * Elimina un archivo PDF físico del almacenamiento local.
     */
    async deletePdf(fileName: string): Promise<void> {
        const cleanName = sanitizeFileName(fileName);
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        try {
            await Filesystem.deleteFile({
                directory: Directory.Documents,
                path: cleanName
            });
            console.log("pdfFileEngine: Archivo eliminado:", cleanName);
        } catch (error) {
            console.warn("pdfFileEngine: Error al eliminar PDF físico (archivo podría no existir)", error);
        }
    },

    /**
     * Comparte el PDF físicamente usando el selector nativo de compartir de Android.
     */
    async sharePdf(fileName: string, title?: string): Promise<void> {
        const cleanName = sanitizeFileName(fileName);
        if (!Capacitor.isNativePlatform()) {
            console.warn("pdfFileEngine: Compartir nativo omitido (no nativo)");
            return;
        }
        try {
            const fileUri = await this.generatePdfPath(cleanName);
            await Share.share({
                title: title || 'Compartir Reporte PDF',
                text: 'Documento PDF generado por Tentelcom',
                url: fileUri,
                dialogTitle: 'Enviar PDF'
            });
            console.log("pdfFileEngine: Menú compartir invocado con éxito");
        } catch (error) {
            console.error("pdfFileEngine: Error al compartir PDF", error);
        }
    },

    /**
     * Abre el archivo PDF utilizando un visor local o el selector nativo.
     */
    async openPdf(fileName: string): Promise<void> {
        const cleanName = sanitizeFileName(fileName);
        if (!Capacitor.isNativePlatform()) {
            console.warn("pdfFileEngine: Apertura nativa omitida (no nativo)");
            return;
        }
        try {
            const fileExists = await this.fileExists(cleanName);
            if (!fileExists) {
                throw new Error(`El archivo PDF ${cleanName} no existe localmente.`);
            }
            const fileUri = await this.generatePdfPath(cleanName);
            
            // Abrir compartiendo es la forma más compatible de visor nativo en Android WebView
            await Share.share({
                title: 'Abrir PDF de Reporte',
                url: fileUri,
                dialogTitle: 'Ver documento'
            });
        } catch (error) {
            console.error("pdfFileEngine: Error abriendo visor nativo", error);
            alert("No se pudo iniciar el visor nativo. Intente compartir el archivo.");
        }
    }
};
