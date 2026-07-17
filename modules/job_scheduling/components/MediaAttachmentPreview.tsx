import React from 'react';
import { FiPlay, FiMusic, FiFileText, FiDownload } from 'react-icons/fi';

interface MediaAttachmentPreviewProps {
  item: any;
  isMe: boolean;
  highlightedMessageId: string | null;
}

export const MediaAttachmentPreview: React.FC<MediaAttachmentPreviewProps> = ({
  item,
  isMe,
}) => {
  const { attachmentUrl, attachmentType, attachmentName, fileSize } = item;
  const sizeMb = fileSize ? (fileSize / (1024 * 1024)).toFixed(1) : null;

  if (attachmentType === 'video') {
    return (
      <div className={`flex flex-col w-full max-w-xs rounded-2xl overflow-hidden border transition-all duration-300 ${
        isMe ? "border-blue-200 bg-blue-50 shadow-sm" : "border-slate-200 bg-white shadow-sm"
      }`}>
        <div className="relative group cursor-pointer aspect-video bg-slate-900">
          <video 
            src={attachmentUrl} 
            className="w-full h-full object-contain"
            controls={false}
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 shadow-lg">
              <FiPlay className="text-white w-6 h-6 fill-white ml-1" />
            </div>
          </div>
          {sizeMb && (
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
              {sizeMb} MB
            </div>
          )}
        </div>
        {item.mensaje && (
           <div className={`px-3 py-2 text-[12px] font-medium leading-relaxed ${isMe ? "bg-blue-600 text-white" : "text-slate-700"}`}>
             {item.mensaje}
           </div>
        )}
      </div>
    );
  }

  if (attachmentType === 'audio') {
    return (
      <div className={`p-3 rounded-2xl border flex flex-col gap-2.5 min-w-[240px] transition-all duration-300 ${
        isMe 
          ? "bg-blue-600 text-white border-blue-500 shadow-md" 
          : "bg-white text-slate-700 border-slate-200 shadow-sm"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isMe ? "bg-blue-500 shadow-inner" : "bg-blue-50 text-blue-600"
          }`}>
            <FiMusic size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black truncate uppercase tracking-widest ${isMe ? "text-blue-100" : "text-slate-400"}`}>
              {attachmentName || "Mensaje de voz"}
            </p>
            {sizeMb && (
              <p className={`text-[8px] font-bold mt-0.5 ${isMe ? "text-blue-200" : "text-slate-300"}`}>
                {sizeMb} MB • WhatsApp
              </p>
            )}
          </div>
        </div>
        <div className="w-full">
            <audio 
              src={attachmentUrl} 
              controls 
              className={`w-full h-8 custom-audio-player ${isMe ? "filter invert brightness-100 contrast-100" : ""}`}
            />
        </div>
        {item.mensaje && (
           <p className="text-[12px] font-medium leading-normal mt-0.5 border-t border-white/10 pt-1.5">{item.mensaje}</p>
        )}
      </div>
    );
  }

  if (attachmentType === 'pdf') {
    return (
      <div className={`flex flex-col w-full max-w-xs rounded-2xl overflow-hidden border transition-all duration-300 ${
        isMe ? "border-blue-200 bg-blue-50 shadow-sm" : "border-slate-200 bg-white shadow-sm"
      }`}>
        <a 
          href={attachmentUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors group"
        >
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <FiFileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">
              {attachmentName || "Documento.pdf"}
            </p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
              PDF {sizeMb ? `• ${sizeMb} MB` : ""}
            </p>
          </div>
        </a>
        {item.mensaje && (
           <div className={`px-3 py-2 text-[12px] font-medium leading-relaxed ${isMe ? "bg-blue-600 text-white" : "text-slate-700"}`}>
             {item.mensaje}
           </div>
        )}
      </div>
    );
  }

  if (attachmentType === 'other') {
    return (
      <div className={`flex flex-col w-full max-w-xs rounded-2xl overflow-hidden border transition-all duration-300 ${
        isMe ? "border-blue-200 bg-blue-50 shadow-sm" : "border-slate-200 bg-white shadow-sm"
      }`}>
        <a 
          href={attachmentUrl} 
          download={attachmentName || "archivo"}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors group"
        >
          <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <FiDownload size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">
              {attachmentName || "Archivo"}
            </p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
              {attachmentName?.split('.').pop()?.toUpperCase() || "ARCHIVO"} {sizeMb ? `• ${sizeMb} MB` : ""}
            </p>
          </div>
        </a>
        {item.mensaje && (
           <div className={`px-3 py-2 text-[12px] font-medium leading-relaxed ${isMe ? "bg-blue-600 text-white" : "text-slate-700"}`}>
             {item.mensaje}
           </div>
        )}
      </div>
    );
  }

  return null;
};
