import React, { useCallback } from 'react';
import { FiActivity, FiMoreVertical } from 'react-icons/fi';
import { ActionButton } from '@/design-system';
import { formatTime, isImageFile } from './utils/logHelpers';
import { ReplyPreview } from './components/ReplyPreview';
import { LocationCard } from './components/LocationCard';
import { ImageGrid } from './components/ImageGrid';
import { FileAttachmentPreview } from './components/FileAttachmentPreview';
import { MediaAttachmentPreview } from './components/MediaAttachmentPreview';
import { MessageLinkRenderer } from './components/MessageLinkRenderer';

interface TimelineItemProps {
  c: any;
  currentUser: any;
  highlightedMessageId: string | null;
  swipingMessage: { id: string; offset: number } | null;
  handleTouchStart: (e: React.TouchEvent, comment: any) => void;
  handleTouchMove: (e: React.TouchEvent, comment: any) => void;
  handleTouchEnd: (comment: any) => void;
  setActiveMenuComment: (comment: any) => void;
  activeMenuComment: any;
  setReplyMediaTarget: (media: any) => void;
  scrollToMessage: (id: string) => void;
  mergedCommentsMap: Map<string, any>;
  setFullscreenImage: (spec: { urls: string[]; currentIndex: number; commentId?: string; comment?: any }) => void;
  imageDiagnoses: Record<string, { loading: boolean; error: string | null }>;
  setImageDiagnoses: React.Dispatch<React.SetStateAction<Record<string, { loading: boolean; error: string | null }>>>;
  allProjectImageUrls: string[];
}

const TimelineItemComponent = ({
  c,
  currentUser,
  highlightedMessageId,
  swipingMessage,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  setActiveMenuComment,
  setReplyMediaTarget,
  scrollToMessage,
  mergedCommentsMap,
  setFullscreenImage,
  imageDiagnoses,
  setImageDiagnoses,
  allProjectImageUrls,
}: TimelineItemProps) => {
  const isMe = c.usuarioId === currentUser?.id;
  const isOptimistic = !!c.isOptimistic;
  const progress = c.progress || 0;
  const uploadErr = c.error;

  const safeFileUrls = Array.isArray(c.fileUrls) ? c.fileUrls : [];
  const safeFileNames = Array.isArray(c.fileNames) ? c.fileNames : [];
  const hasImages = safeFileUrls.some((url, idx) => isImageFile(safeFileNames[idx], url));
  const isImageComment = c.tipo === "imagen" || c.tipo === "foto" || !!hasImages;
  const isMediaAttachment = !!c.attachmentUrl && ['video', 'audio', 'pdf', 'other'].includes(c.attachmentType || '');
  const isFileComment = c.tipo === "archivo" && !isImageComment && !isMediaAttachment;

  // Memoized Touch Start Callback
  const handleTouchStartLocal = useCallback((e: React.TouchEvent) => {
    handleTouchStart(e, c);
  }, [handleTouchStart, c]);

  // Memoized Touch Move Callback
  const handleTouchMoveLocal = useCallback((e: React.TouchEvent) => {
    handleTouchMove(e, c);
  }, [handleTouchMove, c]);

  // Memoized Touch End Callback
  const handleTouchEndLocal = useCallback(() => {
    handleTouchEnd(c);
  }, [handleTouchEnd, c]);

  // Memoized Open Menu / Options Card Callbacks
  const handleOptionsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuComment(c);
  }, [setActiveMenuComment, c]);

  const handleDoubleClickLocal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuComment(c);
  }, [setActiveMenuComment, c]);

  // System Activity render style
  if (c.tipo === "sistema") {
    return (
      <div id={`msg-${c.id}`} className="flex justify-center w-full my-2.5">
        <div className="bg-slate-100 text-slate-600 text-[10px] font-extrabold tracking-widest uppercase py-1 px-3.5 rounded-full border border-slate-200/80 shadow-sm flex items-center gap-1.5 animate-fade-in">
          <FiActivity size={11} className="text-slate-500" /> {c.mensaje}
        </div>
      </div>
    );
  }

  // Normal Chat message bubble layout
  return (
    <div
      id={`msg-${c.id}`}
      className={`flex w-full transition-all duration-300 relative touch-pan-y select-none ${
        isMe ? "justify-end" : "justify-start"
      } ${highlightedMessageId === c.id ? "scale-[1.02] z-10" : "scale-100"}`}
      onTouchStart={c.eliminado ? undefined : handleTouchStartLocal}
      onTouchMove={c.eliminado ? undefined : handleTouchMoveLocal}
      onTouchEnd={c.eliminado ? undefined : handleTouchEndLocal}
      onDoubleClick={c.eliminado ? undefined : handleDoubleClickLocal}
      style={
        swipingMessage?.id === c.id
          ? { transform: `translateX(${swipingMessage.offset}px)` }
          : undefined
      }
    >
      <div
        className={`max-w-[85%] md:max-w-[70%] flex flex-col gap-0.5 group/bubble ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        <div className="flex items-center gap-1.5 px-1 max-w-full min-w-0 overflow-hidden">
          <span
            title={isMe ? "Tú" : c.usuarioNombre || "Usuario"}
            className="text-[9px] font-black uppercase text-slate-400 tracking-wider truncate whitespace-nowrap min-w-0 inline-block"
          >
            {isMe ? "Tú" : c.usuarioNombre || "Usuario"}
          </span>
          {!c.eliminado && (
            <ActionButton
              onClick={handleOptionsClick}
              variant="ghost"
              className="!opacity-0 group-hover/bubble:!opacity-100 focus:!opacity-100 !text-[8px] !font-black !tracking-wider !text-blue-500 hover:!text-blue-700 !uppercase !ml-1.5 !transition-opacity !p-0 !min-h-0 !h-auto shrink-0"
              label={
                <span className="flex items-center gap-0.5">
                  <FiMoreVertical className="w-2.5 h-2.5" /> Opciones
                </span>
              }
            />
          )}
          <span className="text-[8px] font-bold text-slate-300 tracking-tight whitespace-nowrap shrink-0">
            • {isOptimistic ? "Hace un momento" : formatTime(c.timestamp)}
            {c.editado && !c.eliminado && (
              <span className="text-amber-500 font-bold ml-1.5 whitespace-nowrap">
                • Editado{c.editedAt ? ` • ${formatTime(c.editedAt)}` : ""}
              </span>
            )}
            {c.pinned && !c.eliminado && <span className="whitespace-nowrap"> • Pinned 📌</span>}
          </span>
        </div>

        {c.eliminado ? (
          <div
            className={`px-3 py-2 rounded-2xl text-[12px] italic font-semibold select-none leading-relaxed transition-all duration-300 bg-slate-100/85 text-slate-400 border border-slate-200/80 shadow-none ${
              isMe ? "rounded-tr-sm" : "rounded-tl-sm animate-fade-in"
            }`}
          >
            🚫 Este mensaje fue eliminado.
          </div>
        ) : (
          <div className={`flex flex-col gap-0.5 w-full relative group/item-container ${isMe ? "items-end" : "items-start"}`}>
            {/* Highlight Glow Effect */}
            {highlightedMessageId === c.id && (
              <div className="absolute -inset-2 bg-blue-400/20 rounded-3xl blur-xl animate-pulse z-0 pointer-events-none" />
            )}
            
            <div className={`relative z-1 transition-all duration-300 ${
              highlightedMessageId === c.id ? "scale-[1.02]" : "scale-100"
            }`}>
              {isImageComment && (
                <div className={`rounded-3xl overflow-hidden transition-all duration-500 ${
                  highlightedMessageId === c.id 
                    ? "ring-4 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.5)]" 
                    : ""
                }`}>
                  <ImageGrid
                    item={c}
                    isMe={isMe}
                    isOptimistic={isOptimistic}
                    progress={progress}
                    uploadErr={uploadErr}
                    imageDiagnoses={imageDiagnoses}
                    setImageDiagnoses={setImageDiagnoses}
                    setFullscreenImage={setFullscreenImage}
                    setReplyMediaTarget={setReplyMediaTarget}
                    setActiveMenuComment={setActiveMenuComment}
                    allProjectImageUrls={allProjectImageUrls}
                  />
                </div>
              )}
              
              {c.tipo === "ubicacion" && (
                <div className={`rounded-3xl overflow-hidden transition-all duration-500 ${
                  highlightedMessageId === c.id 
                    ? "ring-4 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.5)]" 
                    : ""
                }`}>
                  <LocationCard item={c} isMe={isMe} />
                </div>
              )}

              {isMediaAttachment && (
                <div className={`rounded-2xl transition-all duration-500 ${
                  highlightedMessageId === c.id 
                    ? "ring-4 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-[1.02]" 
                    : ""
                }`}>
                  <MediaAttachmentPreview
                    item={c}
                    isMe={isMe}
                    highlightedMessageId={highlightedMessageId}
                  />
                </div>
              )}

              {c.tipo === "comentario" && (
                <div
                  className={`px-2.5 py-1.5 md:px-3 md:py-2 rounded-2xl text-[12px] md:text-sm font-medium leading-relaxed transition-all duration-700 ${
                    highlightedMessageId === c.id
                      ? "bg-blue-600 text-white shadow-xl ring-4 ring-blue-400/40 scale-[1.03]"
                      : isMe
                      ? "bg-blue-600 text-white rounded-tr-sm shadow-sm"
                      : "bg-white text-slate-700 rounded-tl-sm border border-slate-200 shadow-sm"
                  }`}
                >
                  {c.replyToId && (
                    <ReplyPreview
                      replyToId={c.replyToId}
                      replyMediaIndex={c.replyMediaIndex}
                      replyPreview={c.replyPreview || ""}
                      isMe={isMe}
                      mergedCommentsMap={mergedCommentsMap}
                      scrollToMessage={scrollToMessage}
                    />
                  )}
                  <MessageLinkRenderer mensaje={c.mensaje} isMe={isMe} mentions={c.mentions} />
                </div>
              )}

              {isFileComment && (
                <div className={`rounded-2xl transition-all duration-500 ${
                  highlightedMessageId === c.id 
                    ? "ring-4 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-[1.02]" 
                    : ""
                }`}>
                  <FileAttachmentPreview
                    item={c}
                    isMe={isMe}
                    isOptimistic={isOptimistic}
                    progress={progress}
                    uploadErr={uploadErr}
                    highlightedMessageId={highlightedMessageId}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 2. React.memo Custom Equality comparison safely configured as specified in requirements.
function arePropsEqual(prevProps: TimelineItemProps, nextProps: TimelineItemProps) {
  const cPrev = prevProps.c;
  const cNext = nextProps.c;

  // Compare core fields of the message item itself
  const itemUnchanged =
    cPrev.id === cNext.id &&
    cPrev.mensaje === cNext.mensaje &&
    cPrev.tipo === cNext.tipo &&
    cPrev.eliminado === cNext.eliminado &&
    cPrev.editado === cNext.editado &&
    cPrev.pinned === cNext.pinned &&
    cPrev.replyMediaIndex === cNext.replyMediaIndex &&
    cPrev.isOptimistic === cNext.isOptimistic &&
    cPrev.progress === cNext.progress &&
    cPrev.error === cNext.error &&
    cPrev.usuarioNombre === cNext.usuarioNombre &&
    cPrev.source === cNext.source &&
    cPrev.attachmentUrl === cNext.attachmentUrl &&
    cPrev.attachmentName === cNext.attachmentName &&
    cPrev.attachmentType === cNext.attachmentType &&
    JSON.stringify(cPrev.fileUrls) === JSON.stringify(cNext.fileUrls) &&
    JSON.stringify(cPrev.fileNames) === JSON.stringify(cNext.fileNames) &&
    JSON.stringify(cPrev.fileSizes) === JSON.stringify(cNext.fileSizes);

  if (!itemUnchanged) return false;

  // IMPORTANT: If this message is a reply, we must re-render if the replied message is now available
  if (cNext.replyToId) {
    const prevReplied = prevProps.mergedCommentsMap.get(cNext.replyToId);
    const nextReplied = nextProps.mergedCommentsMap.get(cNext.replyToId);
    if (prevReplied !== nextReplied) return false;
  }

  // Highlight check
  const prevIsHighlighted = prevProps.highlightedMessageId === cPrev.id;
  const nextIsHighlighted = nextProps.highlightedMessageId === cNext.id;
  if (prevIsHighlighted !== nextIsHighlighted) return false;

  // Swipe offset checks
  const prevSwipeId = prevProps.swipingMessage?.id;
  const nextSwipeId = nextProps.swipingMessage?.id;
  const prevSwipeOffset = prevProps.swipingMessage?.offset;
  const nextSwipeOffset = nextProps.swipingMessage?.offset;

  const swipeWasMe = prevSwipeId === cPrev.id;
  const swipeIsMe = nextSwipeId === cNext.id;

  if (swipeWasMe !== swipeIsMe) return false;
  if (swipeIsMe && prevSwipeOffset !== nextSwipeOffset) return false;

  // Check user equality (isMe)
  const prevIsMe = cPrev.usuarioId === prevProps.currentUser?.id;
  const nextIsMe = cNext.usuarioId === nextProps.currentUser?.id;
  if (prevIsMe !== nextIsMe) return false;

  // Active options menu status
  const prevIsActiveMenu = prevProps.activeMenuComment?.id === cPrev.id;
  const nextIsActiveMenu = nextProps.activeMenuComment?.id === cNext.id;
  if (prevIsActiveMenu !== nextIsActiveMenu) return false;

  // Diagnoses check for this item's image files (if any)
  const fileUrls = Array.isArray(cNext.fileUrls) ? cNext.fileUrls : [];
  for (const url of fileUrls) {
    if (prevProps.imageDiagnoses[url] !== nextProps.imageDiagnoses[url]) {
      return false;
    }
  }

  return true;
}

export const TimelineItem = React.memo(TimelineItemComponent, arePropsEqual);
TimelineItem.displayName = "TimelineItem";
