
import React, { useRef, useState } from 'react';
import { useAttachments } from './useAttachments';
import { Attachment, AttachmentType } from './attachment.types';
import { ConfirmModal } from '../../design-system';
import { FiFileText, FiLoader, FiDownload, FiTrash2, FiPlus, FiX, FiShoppingCart, FiFile, FiShare2 } from "react-icons/fi";
import { downloadFileSafely, shareFileSafely } from '../../utils/fileUtils';
import { toast } from 'react-hot-toast';

interface AttachmentUploaderProps {
  entityType: string;
  entityId: string | number;
  title: string;
  subtitle: string;
  onClose: () => void;
  isReadOnly?: boolean;
}

const AttachmentRow: React.FC<{ 
  attachment: Attachment; 
  onDelete: () => void; 
  isLoading: boolean; 
  isReadOnly?: boolean 
}> = ({ attachment, onDelete, isLoading, isReadOnly }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleDownload = async () => {
    if (isDownloading || isSharing) return;
    setIsDownloading(true);
    try {
      // 1. Verificar si existe copia binaria intacta en IndexedDB de este navegador
      try {
        const { getBlob } = await import('../../services/offlineMediaStore');
        const { isValidPdfBlob, triggerFileDownload } = await import('../../utils/fileUtils');
        const keys = [attachment.id, attachment.path, attachment.name].filter(Boolean) as string[];
        for (const k of keys) {
          const cachedBlob = await getBlob(k);
          if (cachedBlob && cachedBlob.size > 100) {
            if (attachment.name.toLowerCase().endsWith('.pdf')) {
              const valid = await isValidPdfBlob(cachedBlob);
              if (valid) {
                await triggerFileDownload(cachedBlob, attachment.name);
                return;
              }
            } else {
              await triggerFileDownload(cachedBlob, attachment.name);
              return;
            }
          }
        }
      } catch (idbErr) {
        console.warn("Verificación local en IndexedDB omitida:", idbErr);
      }

      // 2. Probar dataUrl si existe y es válido
      if (attachment.dataUrl) {
        try {
          const { dataUrlToBlob, isValidPdfBlob, triggerFileDownload } = await import('../../utils/fileUtils');
          const blob = dataUrlToBlob(attachment.dataUrl);
          const isPdf = attachment.name.toLowerCase().endsWith('.pdf');
          if (!isPdf || (await isValidPdfBlob(blob))) {
            await triggerFileDownload(blob, attachment.name);
            return;
          }
        } catch (dErr) {
          console.warn("dataUrl local no válido, reintentando con almacenamiento en la nube:", dErr);
        }
      }

      // 3. Descarga remota desde Firebase Storage
      const remoteUrl = attachment.url || attachment.downloadURL || attachment.downloadUrl;
      await downloadFileSafely(remoteUrl, attachment.name, attachment.path);
    } catch (e: any) {
      console.error("Error downloading attachment:", e);
      alert(e?.message || 'Error al descargar adjunto.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (isSharing || isDownloading) return;
    setIsSharing(true);
    try {
      // 1. Probar en IndexedDB local primero
      let blobToShare: Blob | null = null;
      try {
        const { getBlob } = await import('../../services/offlineMediaStore');
        const { isValidPdfBlob } = await import('../../utils/fileUtils');
        const keys = [attachment.id, attachment.path, attachment.name].filter(Boolean) as string[];
        for (const k of keys) {
          const cached = await getBlob(k);
          if (cached && cached.size > 100) {
            const isPdf = attachment.name.toLowerCase().endsWith('.pdf');
            if (!isPdf || (await isValidPdfBlob(cached))) {
              blobToShare = cached;
              break;
            }
          }
        }
      } catch (idbErr) {
        console.warn("IndexedDB check para share:", idbErr);
      }

      // 2. Probar dataUrl si existe
      if (!blobToShare && attachment.dataUrl) {
        try {
          const { dataUrlToBlob, isValidPdfBlob } = await import('../../utils/fileUtils');
          const blob = dataUrlToBlob(attachment.dataUrl);
          const isPdf = attachment.name.toLowerCase().endsWith('.pdf');
          if (!isPdf || (await isValidPdfBlob(blob))) {
            blobToShare = blob;
          }
        } catch (dErr) {
          console.warn("DataUrl check para share:", dErr);
        }
      }

      // 3. Compartir mediante Web Share / Capacitor Share
      const fileUrl = attachment.url || attachment.downloadURL || attachment.downloadUrl;
      await shareFileSafely(blobToShare || fileUrl, attachment.name, attachment.path);
    } catch (e: any) {
      if (e?.name !== 'AbortError' && !e?.message?.includes('canceled')) {
        console.error("Error sharing attachment:", e);
        toast.error(e?.message || 'Error al compartir adjunto.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const ext = (attachment.name.split('.').pop() || 'PDF').toUpperCase();

  return (
    <div className="group flex items-center justify-between bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow transition-all duration-200 gap-2 w-full min-w-0">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 border border-rose-200/80 flex flex-col items-center justify-center flex-none text-rose-600 font-black shadow-xs">
          <FiFileText className="text-sm" />
          <span className="text-[7px] font-black uppercase tracking-tight">{ext.slice(0, 3)}</span>
        </div>
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <span className="text-xs font-bold text-slate-900 truncate block hover:text-blue-600 transition-colors" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="text-[10px] font-semibold text-slate-400">
            {new Date(attachment.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5 flex-none shrink-0 pl-1">
        {isLoading || isDownloading || isSharing ? (
          <div className="w-8 h-8 flex items-center justify-center">
            <FiLoader className="text-blue-600 animate-spin text-sm" />
          </div>
        ) : (
          <>
            <button
              onClick={handleShare}
              title="Compartir en WhatsApp, Correo u otras apps"
              aria-label="Compartir"
              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200/80 flex items-center justify-center transition-all active:scale-95 shadow-xs"
            >
              <FiShare2 className="text-xs font-bold" />
            </button>
            <button
              onClick={handleDownload}
              title="Descargar archivo"
              aria-label="Descargar"
              className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/80 flex items-center justify-center transition-all active:scale-95 shadow-xs"
            >
              <FiDownload className="text-xs font-bold" />
            </button>
            {!isReadOnly && (
              <button 
                onClick={onDelete} 
                title="Eliminar archivo"
                aria-label="Eliminar"
                className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 flex items-center justify-center transition-all active:scale-95 shadow-xs"
              >
                <FiTrash2 className="text-xs font-bold" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const UploadSection: React.FC<{ 
  title: string; 
  type: AttachmentType; 
  attachments: Attachment[]; 
  onDelete: (att: Attachment) => void; 
  onFileUpload: (file: File) => void; 
  isLoading: string | null; 
  icon: React.ReactNode; 
  headerBg: string;
  themeColor: string;
  isReadOnly?: boolean;
}> = ({ title, type, attachments, onDelete, onFileUpload, isLoading, icon, headerBg, themeColor, isReadOnly }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isUploading = isLoading === `uploading-${type}`;

  return (
    <div className="flex flex-col rounded-2xl border-2 border-slate-200/90 bg-white overflow-hidden shadow-sm w-full min-w-0">
      {/* Encabezado con color distintivo y bordes definidos */}
      <div className={`px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 ${headerBg} text-white shadow-xs`}>
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <div className="p-1 rounded-md bg-white/20 text-white flex-none">
            {icon}
          </div>
          <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-wider truncate text-white drop-shadow-xs">
            {title}
          </h4>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        {!isReadOnly && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 bg-white shadow-sm shrink-0 active:scale-95 disabled:opacity-60"
            style={{ color: themeColor }}
          >
            {isUploading ? <FiLoader className="animate-spin text-xs" /> : <FiPlus className="text-xs font-black" />}
            <span>{isUploading ? "Subiendo..." : "Adjuntar"}</span>
          </button>
        )}
      </div>

      {/* Cuerpo de la lista de adjuntos */}
      <div className="p-2.5 sm:p-3.5 bg-slate-50/70 flex-1 min-h-[110px] flex flex-col justify-center space-y-2 w-full min-w-0">
        {attachments.length === 0 && !isUploading && (
          <div className="text-center py-6 px-2">
            <p className="text-xs font-bold text-slate-400">No hay archivos adjuntos.</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-1">Presione "+ ADJUNTAR" para agregar.</p>
          </div>
        )}
        {attachments.map(att => (
          <AttachmentRow 
            key={att.id} 
            attachment={att} 
            onDelete={() => onDelete(att)} 
            isLoading={isLoading === `deleting-${att.id}`} 
            isReadOnly={isReadOnly} 
          />
        ))}
      </div>
    </div>
  );
};

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({ entityType, entityId, title, subtitle, onClose, isReadOnly = false }) => {
  const { ocs, facturas, isLoading, error, uploadFile, deleteAttachment } = useAttachments(entityType, entityId);
  const [confirmModal, setConfirmModal] = useState<Attachment | null>(null);

  const handleConfirmDelete = () => {
    if (confirmModal) {
      deleteAttachment(confirmModal);
      setConfirmModal(null);
    }
  };

  return (
    <>
      <div className="w-full max-w-4xl rounded-2xl sm:rounded-[32px] md:rounded-[40px] shadow-2xl p-4 sm:p-6 md:p-8 bg-white animate-in zoom-in-95 duration-300 max-h-[92vh] md:max-h-[88vh] flex flex-col overflow-hidden border border-slate-200/90 box-border">
        {/* Cabecera Principal del Modal */}
        <div className="flex justify-between items-start mb-3 sm:mb-6 flex-none gap-2 pb-3 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1.5 inline-block shadow-xs">
              Expediente Digital
            </span>
            <h3 className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight truncate">
              {title}
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm font-bold truncate">
              {subtitle}
            </p>
          </div>
          <button 
            onClick={onClose} 
            title="Cerrar modal"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center flex-none shrink-0 active:scale-95"
          >
            <FiX className="text-base sm:text-lg font-bold" />
          </button>
        </div>
        
        {error && (
          <div className="bg-rose-50 text-rose-700 p-2.5 sm:p-3 rounded-xl text-xs font-bold text-center mb-3 border border-rose-200 flex-none">
            Error: {error}
          </div>
        )}

        {/* Contenedor de Secciones con scroll vertical limpio y sin scroll horizontal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 md:gap-6 overflow-y-auto overflow-x-hidden flex-1 pr-1 sm:pr-1.5 w-full min-w-0">
          <UploadSection 
            title="Órdenes / Documentos"
            type="OC"
            attachments={ocs}
            onDelete={setConfirmModal}
            onFileUpload={(file) => uploadFile(file, 'OC')}
            isLoading={isLoading}
            icon={<FiShoppingCart className="text-sm" />}
            headerBg="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600"
            themeColor="#1d4ed8"
            isReadOnly={isReadOnly}
          />
          <UploadSection 
            title="Facturas / Comprobantes"
            type="Factura"
            attachments={facturas}
            onDelete={setConfirmModal}
            onFileUpload={(file) => uploadFile(file, 'Factura')}
            isLoading={isLoading}
            icon={<FiFile className="text-sm" />}
            headerBg="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600"
            themeColor="#047857"
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      <ConfirmModal 
        show={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar Archivo?"
        description={`Esta acción es permanente. El archivo "${confirmModal?.name}" será eliminado.`}
      />
    </>
  );
};

