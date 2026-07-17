
import React, { useRef, useState } from 'react';
import { useAttachments } from './useAttachments';
import { Attachment, AttachmentType } from './attachment.types';
import { ConfirmModal, IconButton, ActionButton } from '../../design-system';
import { FiFileText, FiLoader, FiDownload, FiTrash2, FiPlus, FiX, FiShoppingCart, FiFile } from "react-icons/fi";
import { triggerFileDownload } from '../../utils/fileUtils';

interface AttachmentUploaderProps {
  entityType: string;
  entityId: string | number;
  title: string;
  subtitle: string;
  onClose: () => void;
  isReadOnly?: boolean;
}

const AttachmentRow: React.FC<{ attachment: Attachment; onDelete: () => void; isLoading: boolean; isReadOnly?: boolean }> = ({ attachment, onDelete, isLoading, isReadOnly }) => (
  <div className="group flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100/80 hover:bg-slate-50/50 transition-all duration-200">
    <div className="flex items-center gap-3 overflow-hidden">
      <FiFileText className="text-slate-400 flex-none"  />
      <div className="flex flex-col overflow-hidden">
        <span className="text-xs font-bold text-blue-950 truncate" title={attachment.name}>{attachment.name}</span>
        <span className="text-[9px] font-semibold text-slate-400">{new Date(attachment.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
    <div className="flex items-center gap-1.5 flex-none pl-2">
      {isLoading ? (
        <div className="w-5 h-5 flex items-center justify-center">
            <FiLoader className="text-slate-400 animate-spin"  />
        </div>
      ) : (
        <>
          <IconButton
            icon={<FiDownload />}
            onClick={async () => {
                try {
                    const response = await fetch(attachment.url);
                    const blob = await response.blob();
                    await triggerFileDownload(blob, attachment.name);
                } catch(e) {
                    console.error("Error downloading attachment:", e);
                    if (typeof window !== 'undefined' && !(window as any).Capacitor?.isNativePlatform()) {
                        const link = document.createElement('a');
                        link.href = attachment.url;
                        link.download = attachment.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } else {
                        alert(`Error descargando adjunto: ${e}`);
                    }
                }
            }}
            variant="secondary"
            title="Descargar"
            className="w-8 h-8 flex items-center justify-center transition-colors rounded-lg"
          />
          {!isReadOnly && (
            <IconButton 
              icon={<FiTrash2 />} 
              onClick={onDelete} 
              variant="danger" 
              title="Eliminar"
              className="w-8 h-8 flex items-center justify-center transition-colors rounded-lg"
            />
          )}
        </>
      )}
    </div>
  </div>
);

const UploadSection: React.FC<{ 
  title: string; 
  type: AttachmentType; 
  attachments: Attachment[]; 
  onDelete: (att: Attachment) => void; 
  onFileUpload: (file: File) => void; 
  isLoading: string | null; 
  icon: React.ReactNode; 
  color: string;
  isReadOnly?: boolean;
}> = ({ title, type, attachments, onDelete, onFileUpload, isLoading, icon, color, isReadOnly }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
  };

  const isUploading = isLoading === `uploading-${type}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className={`text-xs font-black ${color} uppercase tracking-widest flex items-center gap-3`}>
          {icon} {title}
        </h4>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        {!isReadOnly && (
          <ActionButton
            onClick={() => fileInputRef.current?.click()}
            loading={isUploading}
            label={isUploading ? "Subiendo..." : "Adjuntar"}
            icon={!isUploading && <FiPlus />}
            variant="ghost"
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all flex items-center gap-2 border shadow-sm ${isUploading ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-white text-blue-600 hover:bg-blue-50 border-slate-200'}`}
          />
        )}
      </div>
      <div className="bg-slate-50/70 p-4 rounded-2xl min-h-[150px] border border-slate-100/80">
        <div className="space-y-2">
          {attachments.length === 0 && !isUploading && (
            <p className="text-center text-xs font-bold text-slate-400 pt-10">No hay archivos adjuntos.</p>
          )}
          {attachments.map(att => (
            <AttachmentRow key={att.id} attachment={att} onDelete={() => onDelete(att)} isLoading={isLoading === `deleting-${att.id}`} isReadOnly={isReadOnly} />
          ))}
        </div>
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
      <div className="w-full max-w-4xl rounded-[32px] md:rounded-[50px] shadow-2xl p-6 md:p-12 bg-white animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-8 flex-none">
          <div>
            <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Expediente Digital</span>
            <h3 className="text-2xl md:text-3xl font-black text-blue-950 uppercase tracking-tight">{title}</h3>
            <p className="text-slate-400 text-sm font-bold">{subtitle}</p>
          </div>
          <IconButton 
            icon={<FiX />} 
            onClick={onClose} 
            variant="ghost"
            className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center flex-none"
          />
        </div>
        
        {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-bold text-center mb-4 border border-red-200">
                Error: {error}
            </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 overflow-y-auto flex-1 pr-2">
          <UploadSection 
            title="Órdenes / Documentos"
            type="OC"
            attachments={ocs}
            onDelete={setConfirmModal}
            onFileUpload={(file) => uploadFile(file, 'OC')}
            isLoading={isLoading}
            icon={<FiShoppingCart />}
            color="text-blue-600"
            isReadOnly={isReadOnly}
          />
          <UploadSection 
            title="Facturas / Comprobantes"
            type="Factura"
            attachments={facturas}
            onDelete={setConfirmModal}
            onFileUpload={(file) => uploadFile(file, 'Factura')}
            isLoading={isLoading}
            icon={<FiFile />}
            color="text-emerald-600"
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
