
export type AttachmentType = 'OC' | 'Factura';

/**
 * Representa los metadatos de un archivo adjunto que se almacenan en Firestore.
 * La URL apunta al archivo real en Firebase Storage.
 */
export interface Attachment {
  id: string; // ID único para el archivo, usado para borrado.
  name: string; // Nombre original del archivo.
  url: string; // URL de descarga desde Firebase Storage.
  type: AttachmentType; // 'OC' o 'Factura'.
  createdAt: string; // Fecha de subida en formato ISO.
  path: string; // Ruta en Firebase Storage para poder eliminarlo.
}
