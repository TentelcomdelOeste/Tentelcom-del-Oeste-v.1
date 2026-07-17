import React, { useMemo, useCallback } from 'react';
import { FiFileText, FiLoader } from 'react-icons/fi';
import { forceDownloadFile } from '../utils/logHelpers';

interface FileAttachmentPreviewProps {
  item: any;
  isMe: boolean;
  isOptimistic: boolean;
  progress: number;
  uploadErr: any;
  highlightedMessageId: string | null;
}

export const FileAttachmentPreviewComponent = ({
  item,
  isMe,
  isOptimistic,
  progress,
  uploadErr,
  highlightedMessageId,
}: FileAttachmentPreviewProps) => {
  const safeFileUrls = useMemo(() => (Array.isArray(item.fileUrls) ? item.fileUrls : []), [item.fileUrls]);
  const safeFileNames = useMemo(() => (Array.isArray(item.fileNames) ? item.fileNames : []), [item.fileNames]);
  const safeFileSizes = useMemo(() => (Array.isArray(item.fileSizes) ? item.fileSizes : []), [item.fileSizes]);

  const handleDownload = useCallback((url: string, name: string) => {
    forceDownloadFile(url, name);
  }, []);

  return (
    <div
      className={`flex flex-col gap-1 w-full rounded-2xl border transition-all duration-700 overflow-hidden ${
        highlightedMessageId === item.id
          ? "bg-amber-100 border-amber-300 ring-4 ring-amber-300/30 p-1.5"
          : isMe
          ? "bg-blue-50 border-blue-100 text-slate-800 p-1 shadow-sm rounded-tr-sm"
          : "bg-white border-slate-200 text-slate-800 p-1 shadow-sm rounded-tl-sm"
      }`}
    >
      <div className="flex flex-col gap-1.5 min-w-[180px] max-w-xs relative rounded-xl overflow-hidden bg-slate-50 p-1">
        {safeFileUrls.map((url, idx) => {
          const name = safeFileNames[idx] || "documento.pdf";
          const sizeKb = safeFileSizes[idx] ? (safeFileSizes[idx] / 1024).toFixed(1) : null;

          return (
            <button
              type="button"
              onClick={() => !isOptimistic && url && handleDownload(url, name)}
              key={idx}
              className={`w-full text-left flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all group ${
                isOptimistic && !url ? "pointer-events-none opacity-60" : "pointer-events-auto"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 transition-colors">
                <FiFileText size={16} />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                <p className="text-[10px] font-black text-slate-800 truncate leading-none uppercase tracking-wide">
                  {name}
                </p>
                {sizeKb && <p className="text-[9px] font-bold text-slate-400 mt-1 leading-none">{sizeKb} KB</p>}
              </div>
            </button>
          );
        })}
        {isOptimistic && progress < 100 && !uploadErr && (
          <div className="absolute inset-0 bg-white/85 flex items-center justify-center gap-1.5 p-1 rounded-xl z-10">
            <FiLoader size={12} className="animate-spin text-blue-600" />
            <span className="text-[9px] font-extrabold text-blue-700 uppercase tracking-widest leading-none">
              Subiendo {progress}%
            </span>
          </div>
        )}
        {isOptimistic && uploadErr && (
          <div className="absolute inset-0 bg-red-50/95 flex items-center justify-center gap-1.5 p-1 rounded-xl text-center z-10">
            <span className="text-[9px] text-red-600 font-black uppercase tracking-wider leading-none">
              Fallo de envío
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-1.5 py-0.5 rounded-b-xl">
        {item.mensaje ? (
          <p className="text-[11px] md:text-xs font-bold text-slate-700 leading-normal select-text">
            {item.mensaje}
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1 shrink-0 select-none">
          {isOptimistic ? (
            uploadErr ? (
              <span className="text-[8px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                ERROR
              </span>
            ) : progress < 100 ? (
              <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                Subiendo
              </span>
            ) : (
              <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                ENVIADO
              </span>
            )
          ) : (
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Enviado</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const FileAttachmentPreview = React.memo(FileAttachmentPreviewComponent);
FileAttachmentPreview.displayName = "FileAttachmentPreview";
