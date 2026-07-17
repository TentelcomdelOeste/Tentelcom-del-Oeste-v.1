import React, { useState, useRef } from 'react';
import { FiX, FiUploadCloud, FiFileText, FiCheckCircle, FiAlertCircle, FiMessageSquare } from 'react-icons/fi';
import { ActionButton, IconButton } from '@/design-system';
import { parseWhatsAppText } from '../parsers/whatsappParser';
import { ImportedConversationEvent } from '../types';
import { db, storage } from '@/firebase';
import { writeBatch, doc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { mapImportedEventToTimelineEvent } from '../mappers/timelineMapper';
import JSZip from 'jszip';

interface Props {
  show: boolean;
  onClose: () => void;
  resolvedTimelineId?: string;
  activeParentId?: string;
  currentCollection?: string;
  currentUser?: { id: string; name: string; email?: string };
}

export const ImportWizardModal: React.FC<Props> = ({ 
  show, 
  onClose,
  resolvedTimelineId,
  activeParentId,
  currentCollection,
  currentUser
}) => {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<'whatsapp'>('whatsapp');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<ImportedConversationEvent[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Map<string, JSZip.JSZipObject>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ imported: number, omitted: number, timeMs: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!show) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0] || null);
      setError(null);
    }
  };

  const processFile = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      let text = '';
      let chatName = '';

      if (file.name.endsWith('.zip')) {
        const { extractTextFromZip } = await import('../parsers/whatsappParser');
        const extracted = await extractTextFromZip(file);
        if (!extracted) {
           setError("No se encontró ningún archivo .txt en el archivo ZIP.");
           setIsProcessing(false);
           return;
        }
        text = extracted.text;
        chatName = extracted.chatName;
        setMediaFiles(extracted.mediaFiles);
      } else {
        text = await file.text();
        chatName = file.name.replace('.txt', '').replace('Chat de WhatsApp con ', '').trim();
        setMediaFiles(new Map());
      }

      if (!text.trim()) {
         setError("El archivo está vacío.");
         setIsProcessing(false);
         return;
      }
      
      const events = parseWhatsAppText(text, chatName);
      
      if (events.length === 0) {
          setError("No se detectaron mensajes. El formato podría ser desconocido.");
      } else {
          setParsedEvents(events);
          setStep(3);
      }
    } catch (err: any) {
      setError(`Error de lectura: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getAttachmentInfo = (fileName: string): { type: 'image' | 'video' | 'audio' | 'pdf' | 'other', mime: string } => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return { type: 'image', mime: `image/${ext === 'jpg' ? 'jpeg' : (ext === 'png' ? 'png' : (ext === 'webp' ? 'webp' : 'gif'))}` };
    if (['mp4', 'mov', 'avi', 'mkv', '3gp'].includes(ext || '')) return { type: 'video', mime: `video/${ext === 'mkv' ? 'x-matroska' : ext}` };
    if (['mp3', 'wav', 'ogg', 'opus', 'aac', 'm4a'].includes(ext || '')) return { type: 'audio', mime: `audio/${ext === 'opus' ? 'ogg' : ext}` };
    if (ext === 'pdf') return { type: 'pdf', mime: 'application/pdf' };
    return { type: 'other', mime: 'application/octet-stream' };
  };

  const handleImport = async () => {
    setIsProcessing(true);
    setError(null);
    const startTime = performance.now();

    try {
        const basePath = resolvedTimelineId
          ? `operational_timelines/${resolvedTimelineId}/events`
          : `${currentCollection}/${activeParentId}/timeline`;
        
        const storagePrefix = resolvedTimelineId
          ? `operational_timelines/${resolvedTimelineId}/whatsapp`
          : `${currentCollection}/${activeParentId}/timeline/whatsapp`;

        // Load existing whatsapp fingerprints
        const existingIds = new Set<string>();
        try {
            const q = query(collection(db, basePath), where("source", "==", "whatsapp"));
            const snap = await getDocs(q);
            snap.forEach(d => existingIds.add(d.id));
        } catch(e) {
            console.warn("Could not load existing whatsapp events for deduplication", e);
        }

        const batchChunks = [];
        let currentBatch = writeBatch(db);
        let currentBatchCount = 0;
        let imported = 0;
        let omitted = 0;

        for (let i = 0; i < parsedEvents.length; i++) {
            const ev = parsedEvents[i];
            if (!ev) continue;
            
            const msgSnippet = ev.message.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
            const authorSnippet = ev.author.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
            const fingerprint = `wa_${ev.timestamp.getTime()}_${authorSnippet}_${msgSnippet}`;

            if (existingIds.has(fingerprint)) {
                omitted++;
                continue;
            }

            const tEv = mapImportedEventToTimelineEvent(
                ev,
                currentUser?.id || 'unknown',
                currentUser?.name || 'Unknown'
            );
            tEv.id = fingerprint;
            tEv.progress = 100;

            // Handle Attachments
            if (ev.attachments && ev.attachments.length > 0) {
                for (const attachment of ev.attachments) {
                    // Try to find the file in the ZIP with case-insensitive matching
                    let zipFile = mediaFiles.get(attachment.fileName);
                    
                    if (!zipFile) {
                        // Fallback: try case-insensitive search
                        const lowerName = attachment.fileName.toLowerCase();
                        for (const [key, value] of mediaFiles.entries()) {
                            if (key.toLowerCase() === lowerName) {
                                zipFile = value;
                                break;
                            }
                        }
                    }

                    if (zipFile) {
                        try {
                            const blob = await zipFile.async('blob');
                            const info = getAttachmentInfo(attachment.fileName);
                            
                            const storagePath = `${storagePrefix}/${Date.now()}_${attachment.fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                            const storageRef = ref(storage, storagePath);
                            
                            // Direct upload as it's an import process
                            await uploadBytes(storageRef, blob, { 
                                contentType: info.mime,
                                customMetadata: {
                                    originalName: attachment.fileName,
                                    importSource: 'whatsapp'
                                }
                            });
                            
                            const downloadUrl = await getDownloadURL(storageRef);
                            
                            // Map to TimelineEvent fields
                            tEv.attachmentName = attachment.fileName;
                            tEv.attachmentType = info.type;
                            tEv.attachmentUrl = downloadUrl;
                            tEv.mimeType = info.mime;
                            tEv.fileSize = blob.size;

                            // Also add to fileUrls/fileNames for legacy/generic rendering
                            tEv.fileUrls = [downloadUrl];
                            tEv.fileNames = [attachment.fileName];
                            tEv.fileSizes = [blob.size];

                            // If it's an image, set type to 'imagen' for specialized rendering
                            if (info.type === 'image') {
                                tEv.tipo = 'imagen';
                            } else {
                                tEv.tipo = 'archivo';
                            }
                        } catch (uploadErr) {
                            console.warn(`Error uploading attachment ${attachment.fileName}:`, uploadErr);
                            // We continue without the file, as per requirement 6
                        }
                    } else {
                        console.warn(`File ${attachment.fileName} not found in ZIP`);
                    }
                }
            }

            const docRef = doc(db, basePath, fingerprint);
            currentBatch.set(docRef, tEv, { merge: true });
            currentBatchCount++;
            imported++;
            existingIds.add(fingerprint); 

            if (currentBatchCount >= 400) {
                batchChunks.push(currentBatch);
                currentBatch = writeBatch(db);
                currentBatchCount = 0;
            }
        }

        if (currentBatchCount > 0) {
            batchChunks.push(currentBatch);
        }

        for (const b of batchChunks) {
            await b.commit();
        }

        if (imported > 0) {
            try {
                const importId = `import_${Date.now()}`;
                const importLogPath = resolvedTimelineId 
                    ? `operational_timelines/${resolvedTimelineId}/imports` 
                    : `${currentCollection}/${activeParentId}/imports`;
                
                await setDoc(doc(db, importLogPath, importId), {
                    importId,
                    fechaImportacion: new Date().toISOString(),
                    usuario: currentUser?.name || 'Unknown',
                    cantidadMensajes: imported,
                    nombreChat: parsedEvents[0]?.metadata?.chatName || "Desconocido",
                    rangoFechas: getSummary()
                });
            } catch(e) { console.warn(e); }
        }

        const endTime = performance.now();
        setImportStats({
            imported,
            omitted,
            timeMs: Math.round(endTime - startTime)
        });
        setStep(5);

    } catch(err: any) {
        setError(`Error durante la importación: ${err.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const getSummary = () => {
    if (parsedEvents.length === 0) return null;

    const participants = new Set(parsedEvents.map(e => e.author));
    const totalAttachments = parsedEvents.reduce((acc, e) => acc + (e.attachments?.length || 0), 0);
    
    // Very rudimentary detection based on common WhatsApp patterns if it wasn't omitted

    const dates = parsedEvents.map(e => e.timestamp.getTime()).filter(t => !isNaN(t));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    return {
      total: parsedEvents.length,
      participants: Array.from(participants),
      totalAttachments,
      minDate,
      maxDate
    };
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Seleccionar Origen</h3>
            <div 
              className="p-4 border-2 border-blue-500 bg-blue-50 rounded-2xl flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <FiMessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800">WhatsApp</p>
                <p className="text-xs text-slate-500 font-medium">Exportación de chat (.txt o .zip)</p>
              </div>
              <div className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <FiCheckCircle className="w-3 h-3 text-white" />
              </div>
            </div>
            
            <div className="opacity-50 p-4 border border-slate-200 bg-slate-50 rounded-2xl flex items-center gap-3 cursor-not-allowed">
              <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center shrink-0">
                <FiMessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-600">Otras fuentes</p>
                <p className="text-xs text-slate-400 font-medium">Próximamente</p>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Seleccionar Archivo</h3>
            <p className="text-xs font-bold text-slate-500">Selecciona el archivo exportado de tu conversación.</p>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".txt,.zip"
              onChange={handleFileSelect}
            />
            
            {!file ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-[2rem] p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-16 h-16 bg-slate-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center mb-4 transition-colors">
                  <FiUploadCloud className="w-8 h-8 text-slate-400 group-hover:text-blue-500" />
                </div>
                <p className="text-sm font-bold text-slate-700">Click para seleccionar archivo</p>
                <p className="text-xs text-slate-400 mt-1">Formatos soportados: .txt, .zip</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl p-4 flex items-center gap-4 bg-slate-50">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                  <FiFileText className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <IconButton icon={<FiX />} onClick={() => setFile(null)} variant="neutral" />
              </div>
            )}
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
                <FiAlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        );
      case 3: {
        const summary = getSummary();
        return (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest text-center">Análisis Completado</h3>
            
            {summary ? (
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Nombre del Chat</p>
                    <p className="font-bold text-slate-700">{parsedEvents[0]?.metadata?.chatName || "Desconocido"}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Período</p>
                    <p className="font-bold text-slate-700 text-sm">
                        {summary.minDate.toLocaleDateString()} - {summary.maxDate.toLocaleDateString()}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-0.5">Mensajes</p>
                        <p className="text-xl font-black text-blue-600">{summary.total}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-0.5">Adjuntos (aprox)</p>
                        <p className="text-xl font-black text-purple-600">{summary.totalAttachments}</p>
                    </div>
                </div>
                <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Participantes ({summary.participants.length})</p>
                    <div className="flex flex-wrap gap-2">
                        {summary.participants.map(p => (
                            <span key={p} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
                                {p}
                            </span>
                        ))}
                    </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      }
      case 4:
        return (
          <div className="space-y-6 text-center py-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <FiCheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Listo para importar</h3>
                <p className="text-sm font-bold text-slate-500">
                    Se importarán <span className="text-slate-700 font-black">{parsedEvents.length} mensajes</span> a la Bitácora Operativa.
                </p>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6 text-center py-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <FiCheckCircle className="w-10 h-10 text-blue-600" />
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Importación Completada</h3>
                <p className="text-sm font-bold text-slate-500 mb-6">
                    El proceso ha finalizado correctamente.
                </p>
                
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 gap-4 text-left">
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Mensajes Importados</p>
                        <p className="text-xl font-black text-blue-600">{importStats?.imported}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Omitidos (Duplicados)</p>
                        <p className="text-xl font-black text-slate-600">{importStats?.omitted}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tiempo de procesamiento</p>
                        <p className="text-sm font-bold text-slate-600">{((importStats?.timeMs || 0) / 1000).toFixed(2)} segundos</p>
                    </div>
                </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (step === 2) {
      processFile();
    } else if (step === 4) {
      handleImport();
    } else if (step === 5) {
      onClose();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
            Importar Conversación
          </h2>
          <IconButton icon={<FiX />} onClick={onClose} variant="neutral" />
        </div>
        
        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          {renderStep()}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-between bg-slate-50">
          {step !== 5 && (
            <ActionButton 
              label="Cancelar" 
              variant="ghost" 
              onClick={onClose} 
              className="text-xs font-bold"
            />
          )}
          <div className={step === 5 ? "w-full" : ""}>
            <ActionButton 
              label={isProcessing ? "Procesando..." : step === 4 ? "Continuar" : step === 5 ? "Finalizar" : "Siguiente"} 
              variant="primary" 
              onClick={handleNext}
              disabled={isProcessing || (step === 2 && !file)}
              className={`text-xs font-bold px-6 ${step === 5 ? "w-full" : ""}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
