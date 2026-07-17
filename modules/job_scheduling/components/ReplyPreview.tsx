import React, { useCallback } from 'react';
import { isImageFile } from '../utils/logHelpers';

interface ReplyPreviewProps {
  replyToId: string;
  replyMediaIndex?: number;
  replyPreview: string;
  isMe: boolean;
  mergedCommentsMap: Map<string, any>;
  scrollToMessage: (id: string) => void;
}

export const ReplyPreviewComponent = ({
  replyToId,
  replyMediaIndex,
  replyPreview,
  isMe,
  mergedCommentsMap,
  scrollToMessage,
}: ReplyPreviewProps) => {
  const repliedMsg = mergedCommentsMap.get(replyToId || "");

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    scrollToMessage(replyToId);
  }, [replyToId, scrollToMessage]);

  if (!repliedMsg) {
    return (
      <div className="mb-1.5 px-2 py-1 rounded border-l-3 text-[10px] leading-tight select-none bg-slate-100 border-slate-300 text-slate-500 italic">
        Mensaje original no disponible
      </div>
    );
  }

  const safeRepliedUrls = Array.isArray(repliedMsg.fileUrls) ? repliedMsg.fileUrls : [];
  const safeRepliedNames = Array.isArray(repliedMsg.fileNames) ? repliedMsg.fileNames : [];
  
  // Use index if provided and valid, otherwise fallback to first image
  let thumbUrl = null;
  if (replyMediaIndex !== undefined && safeRepliedUrls[replyMediaIndex]) {
    thumbUrl = safeRepliedUrls[replyMediaIndex];
  } else {
    thumbUrl = safeRepliedUrls.find((url, idx) => isImageFile(safeRepliedNames[idx], url)) || null;
  }

  return (
    <div
      onClick={handleClick}
      className={`mb-1.5 px-2 py-1 rounded border-l-3 text-[10px] leading-tight cursor-pointer select-none transition-all flex items-center justify-between gap-2 ${
        isMe
          ? "bg-blue-700/50 border-blue-300 text-blue-100 hover:bg-blue-700/60"
          : "bg-slate-100 border-blue-500 text-slate-600 hover:bg-slate-200/80"
      }`}
    >
      <div className="min-w-0 flex-1">
        <span
          className={`font-black uppercase text-[8px] tracking-wider block ${
            isMe ? "text-blue-200" : "text-blue-600"
          }`}
        >
          {repliedMsg.usuarioNombre || "Mensaje original"}
        </span>
        <span className="font-semibold block truncate mt-0.5 max-w-[150px]">{replyPreview}</span>
      </div>
      {thumbUrl && (
        <img
          src={thumbUrl}
          className="w-8 h-8 rounded shrink-0 object-cover"
          alt="Preview"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
};

export const ReplyPreview = React.memo(ReplyPreviewComponent);
ReplyPreview.displayName = "ReplyPreview";
