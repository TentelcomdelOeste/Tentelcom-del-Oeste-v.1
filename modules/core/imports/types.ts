export type ImportSource = "whatsapp";

export interface ImportedAttachment {
    fileName: string;
    fileData?: Blob;
    mimeType?: string;
    fileSize?: number;
}

export interface ImportedConversationEvent {
    source: ImportSource;
    timestamp: Date;
    author: string;
    message: string;
    attachments: ImportedAttachment[];
    metadata?: {
        chatName?: string;
        originalLine?: string;
    };
}
