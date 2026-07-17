import { ImportedConversationEvent, ImportedAttachment } from '../types';
import JSZip from 'jszip';

/**
 * Parses a date string from WhatsApp export.
 * Attempts to handle various Android and iOS formats.
 */
function parseWhatsAppDate(dateStr: string): Date | null {
    const cleanStr = dateStr.replace(/^\[/, '').replace(/\]$/, '').trim();
    
    const regexDate = /^(\d{1,2})[/\\-\\.](\d{1,2})[/\\-\\.](\d{2,4})[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([aApP])\.?\s*[mM]\.?)?/;
    const match = cleanStr.match(regexDate);
    
    if (match) {
        const [_, p1, p2, yearStr, hStr, mStr, sStr, ampm] = match;
        
        let day = parseInt(p1 as string);
        let month = parseInt(p2 as string);
        let year = parseInt(yearStr as string);
        if (year < 100) year += 2000;
        
        if (month > 12 && day <= 12) {
            const temp = day;
            day = month;
            month = temp;
        }

        let hour = parseInt(hStr as string);
        const min = parseInt(mStr as string);
        const sec = sStr ? parseInt(sStr as string) : 0;
        
        if (ampm) {
            const isPm = (ampm as string).toLowerCase() === 'p';
            if (isPm && hour < 12) hour += 12;
            if (!isPm && hour === 12) hour = 0;
        }

        const d = new Date(year, month - 1, day, hour, min, sec);
        if (!isNaN(d.getTime())) return d;
    }

    // Fallback
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    
    return null;
}

/**
 * Normalizes text to remove LRM, RLM, Narrow No-Break Space, BOM, etc.
 */
export function normalizeWhatsAppText(text: string): string {
    let normalized = text.replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '');
    normalized = normalized.replace(/[\u202F\u00A0]/g, ' ');
    return normalized;
}

/**
 * Reads a zip file and extracts the chat text.
 */
export async function extractTextFromZip(file: File): Promise<{ text: string, chatName: string, mediaFiles: Map<string, JSZip.JSZipObject> } | null> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        let txtFileName = '';
        let txtFileObj = null;
        const mediaFiles = new Map<string, JSZip.JSZipObject>();
        
        for (const filename of Object.keys(zip.files)) {
            if (filename.endsWith('.txt') && !filename.startsWith('__MACOSX')) {
                // If it's _chat.txt, it's definitely the iOS chat file
                if (filename === '_chat.txt' || filename.endsWith('/_chat.txt')) {
                    txtFileName = filename;
                    txtFileObj = zip.files[filename];
                } 
                // Otherwise, if we don't have a file yet or if this one is longer (Android usually has long names)
                else if (!txtFileObj || (txtFileName !== '_chat.txt' && zip.files[filename].name.length > txtFileName.length)) {
                    txtFileName = filename;
                    txtFileObj = zip.files[filename];
                }
            } else if (!zip.files[filename].dir && !filename.startsWith('__MACOSX') && !filename.endsWith('.txt')) {
                // Use basename as key for easier matching
                const basename = filename.split('/').pop() || filename;
                mediaFiles.set(basename, zip.files[filename]);
            }
        }
        
        if (!txtFileObj) return null;
        
        const text = await txtFileObj.async('string');
        const chatName = txtFileName.replace('.txt', '').replace('Chat de WhatsApp con ', '').trim();
        
        return { text, chatName, mediaFiles };
    } catch (e) {
        console.error('Error unzipping file', e);
        throw e;
    }
}

/**
 * Parses a raw text file from WhatsApp export into an array of ImportedConversationEvent.
 */
export function parseWhatsAppText(text: string, chatName?: string): ImportedConversationEvent[] {
    const normalizedText = normalizeWhatsAppText(text);
    const lines = normalizedText.split(/\r?\n/);
    const events: ImportedConversationEvent[] = [];
    
    // Support variations like "a. m.", "p.m.", etc.
    const timeRegex = `\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[aA]\\.?\\s*[mM]\\.?|\\s*[pP]\\.?\\s*[mM]\\.?)?`;
    
    // Regex for Android: 1/23/24, 10:25 AM - Author: Message
    const androidRegex = new RegExp(`^(\\d{1,2}[/\\-\\.]\\d{1,2}[/\\-\\.]\\d{2,4}[, ]+${timeRegex})\\s+-\\s+(.*?):\\s+(.*)$`);
    
    // Regex for iOS: [23/1/24 10:25:34] Author: Message
    const iosRegex = new RegExp(`^\\[(\\d{1,2}[/\\-\\.]\\d{1,2}[/\\-\\.]\\d{2,4}[, ]+${timeRegex})\\]\\s+(.*?):\\s+(.*)$`);

    // Regex for System Messages (Android): 1/23/24, 10:25 AM - System message...
    const androidSystemRegex = new RegExp(`^(\\d{1,2}[/\\-\\.]\\d{1,2}[/\\-\\.]\\d{2,4}[, ]+${timeRegex})\\s+-\\s+(.*)$`);

    let currentEvent: ImportedConversationEvent | null = null;

    for (const line of lines) {
        if (!line.trim()) continue;

        let match = line.match(iosRegex);
        
        if (!match) {
            match = line.match(androidRegex);
        }

        if (match) {
            // New message line
            if (currentEvent) {
                events.push(currentEvent);
            }

            const dateStr = match[1] as string;
            const author = match[2] as string;
            let message = match[3] as string;
            
            const timestamp = parseWhatsAppDate(dateStr) || new Date(); 

            const attachments: ImportedAttachment[] = [];
            // Common patterns:
            // Android: FileName.ext (archivo adjunto)
            // iOS: FileName.ext <adjunto omitido>
            // Improved regex to handle more characters and variations
            const attachmentMatch = message.match(/([^:\n]+\.[a-zA-Z0-9]{2,5})\s+(?:\(archivo adjunto\)|<adjunto omitido>|\[archivo adjunto\])/i);
            
            if (attachmentMatch) {
                const fileName = attachmentMatch[1].trim();
                attachments.push({ fileName });
                message = `[Archivo adjunto: ${fileName}]`;
            } else if (
                message.includes('<Media omitted>') || 
                message.includes('<Media omitida>') || 
                message.includes('<adjunto omitido>') ||
                message.includes('(archivo adjunto)') ||
                message.includes('[archivo adjunto]')
            ) {
                // If we couldn't find the filename but see the tag
                message = `[Multimedia]`;
            } else if (message.includes('omitido') || message.includes('omitted')) {
                // Generic fallback for "omitted"
                message = `[Multimedia omitida]`;
            }

            currentEvent = {
                source: "whatsapp",
                timestamp,
                author,
                message,
                attachments,
                metadata: {
                    chatName,
                    originalLine: line
                }
            };
        } else {
            // Check if it's an Android system message
            const sysMatch = line.match(androidSystemRegex);
            if (sysMatch && !line.includes(':')) {
                 if (currentEvent) {
                    events.push(currentEvent);
                    currentEvent = null;
                 }
                 continue;
            }

            // It's a continuation of the previous message (multiline)
            if (currentEvent) {
                currentEvent.message += `\n${line}`;
            }
        }
    }

    if (currentEvent) {
        events.push(currentEvent);
    }

    return events;
}
