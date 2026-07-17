import { pdfFileEngine } from './pdfFileEngine';

/**
 * Facilita el compartir un archivo PDF guardado localmente a través de las opciones nativas de Android.
 */
export async function sharePdfDocument(fileName: string, title?: string): Promise<void> {
    try {
        await pdfFileEngine.sharePdf(fileName, title);
    } catch (error) {
        console.error("pdfShare: Error al compartir archivo PDF", error);
    }
}
