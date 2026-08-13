import React, { useMemo, useCallback } from 'react';
import { FiFileText } from 'react-icons/fi';
import { ActionButton } from '@/design-system';
import { isImageFile, forceDownloadFile } from '../utils/logHelpers';
import { localBlobCache } from '@/modules/core/SharedTimeline/hooks/useTimelineUploader';

interface ImageGridProps {
  item: any;
  isMe: boolean;
  isOptimistic: boolean;
  progress: number;
  uploadErr: any;
  imageDiagnoses: Record<string, { loading: boolean; error: string | null }>;
  setImageDiagnoses: React.Dispatch<React.SetStateAction<Record<string, { loading: boolean; error: string | null }>>>;
  setFullscreenImage: (spec: { urls: string[]; currentIndex: number; commentId?: string; comment?: any }) => void;
  setReplyMediaTarget: (media: any) => void;
  setActiveMenuComment: (comment: any) => void;
  allProjectImageUrls: string[];
}

export const ImageGridComponent = ({
  item,
  isOptimistic,
  progress,
  uploadErr,
  imageDiagnoses,
  setImageDiagnoses,
  setFullscreenImage,
  setReplyMediaTarget,
  setActiveMenuComment,
  allProjectImageUrls,
}: ImageGridProps) => {
  const commentFiles = useMemo(() => {
    let urls = Array.isArray(item.fileUrls) ? item.fileUrls : [];
    if (item.optimisticId) {
      const cached = localBlobCache.get(item.optimisticId);
      if (cached && cached.length > 0) {
        urls = cached;
      }
    }
    return urls;
  }, [item.fileUrls, item.optimisticId]);

  const commentNames = useMemo(() => (Array.isArray(item.fileNames) ? item.fileNames : []), [item.fileNames]);

  const thumbnailFiles = useMemo(() => {
    let thumbs = Array.isArray(item.thumbnailUrls) ? item.thumbnailUrls : [];
    if (item.optimisticId) {
      const cached = localBlobCache.get(item.optimisticId);
      if (cached && cached.length > 0) {
        thumbs = cached;
      }
    }
    return thumbs;
  }, [item.thumbnailUrls, item.optimisticId]);

  const commentImages = useMemo(() => {
    return commentFiles
      .map((url, idx) => ({ url, originalIdx: idx, name: commentNames[idx] || "Evidencia fotográfica" }))
      .filter((img) => isImageFile(img.name, img.url));
  }, [commentFiles, commentNames]);

  const commentImagesUrls = useMemo(() => commentImages.map((img) => img.url), [commentImages]);

  const nonImages = useMemo(() => {
    return commentFiles.filter((url, idx) => !isImageFile(commentNames[idx], url));
  }, [commentFiles, commentNames]);

  const visibleImages = useMemo(() => commentImages.slice(0, 4), [commentImages]);
  const totalImagesCount = commentImages.length;

  const { gridColsClass, containerHeightClass } = useMemo(() => {
    let cols = "grid-cols-1";
    let height = "h-48 sm:h-56";
    if (totalImagesCount === 2) {
      cols = "grid-cols-2";
      height = "h-36 sm:h-40";
    } else if (totalImagesCount >= 3) {
      cols = "grid-cols-2";
      height = "h-52 sm:h-60";
    }
    return { gridColsClass: cols, containerHeightClass: height };
  }, [totalImagesCount]);

  const handleImageClick = useCallback((url: string) => {
    let urlsToUse = allProjectImageUrls;
    let idx = urlsToUse.indexOf(url);

    // Fallback to local comment-specific images if url is not in global list
    if (idx === -1) {
      urlsToUse = commentImagesUrls;
      idx = urlsToUse.indexOf(url);
    }

    // Secondary fallback to single item display if still missing
    if (idx === -1) {
      urlsToUse = [url];
      idx = 0;
    }

    setFullscreenImage({
      urls: urlsToUse,
      currentIndex: idx,
      commentId: item.id,
      comment: item
    });
  }, [allProjectImageUrls, commentImagesUrls, item.id, item, setFullscreenImage]);

  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = React.useRef<any>(null);
  const isLongPressRef = React.useRef<boolean>(false);
  const lastTouchTimeRef = React.useRef<number>(0);

  const handleImageTouchStart = useCallback((e: React.TouchEvent, url: string, originalIdx: number) => {
    e.stopPropagation();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(55); } catch (err) { console.error(err); }
      }
      setReplyMediaTarget({ url, comment: item, index: originalIdx });
      setActiveMenuComment(item);
    }, 600);
  }, [item, setReplyMediaTarget, setActiveMenuComment]);

  const handleImageTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartRef.current.x);
    const diffY = Math.abs(touch.clientY - touchStartRef.current.y);
    if (diffX > 10 || diffY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const handleImageTouchEnd = useCallback((e: React.TouchEvent, url: string) => {
    e.stopPropagation();
    lastTouchTimeRef.current = Date.now();

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      touchStartRef.current = null;
      return;
    }

    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = Math.abs(touch.clientX - touchStartRef.current.x);
    const diffY = Math.abs(touch.clientY - touchStartRef.current.y);

    if (diffX < 8 && diffY < 8) {
      handleImageClick(url);
    }
    touchStartRef.current = null;
  }, [handleImageClick]);

  const handleImageTouchCancel = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isLongPressRef.current = false;
    touchStartRef.current = null;
  }, []);

  const handleImageClickWrapper = useCallback((e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    if (Date.now() - lastTouchTimeRef.current < 500) {
      return;
    }
    handleImageClick(url);
  }, [handleImageClick]);

  const [localLoaded, setLocalLoaded] = React.useState<Record<string, boolean>>({});

  const handleImageLoad = useCallback((url: string) => {
    setLocalLoaded(prev => ({ ...prev, [url]: true }));
    setImageDiagnoses((prev) => {
      if (prev[url] && !prev[url].loading) return prev;
      return {
        ...prev,
        [url]: { loading: false, error: null },
      };
    });
  }, [setImageDiagnoses]);

  // Handle cached images that might load before/during mount
  const checkImageComplete = useCallback((img: HTMLImageElement | null, url: string) => {
    if (!img) return;
    if (img.complete && img.naturalWidth > 0 && !localLoaded[url]) {
      handleImageLoad(url);
    }
  }, [handleImageLoad, localLoaded]);

  const handleImageError = useCallback((url: string) => {
    setLocalLoaded(prev => ({ ...prev, [url]: true })); // Stop loading spinner on error too
    setImageDiagnoses((prev) => ({
      ...prev,
      [url]: { loading: false, error: "Error de carga..." },
    }));
  }, [setImageDiagnoses]);

  const handleFileDownload = useCallback((url: string, name: string) => {
    forceDownloadFile(url, name);
  }, []);

  return (
    <div
      className="flex flex-col gap-1.5 w-full p-1"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {totalImagesCount > 0 && (
        <div
          className={`grid gap-1 ${gridColsClass} ${containerHeightClass} w-full rounded-xl overflow-hidden relative group max-w-sm sm:max-w-md`}
        >
          {visibleImages.map((imageItem, idx) => {
            const url = imageItem.url;
            const originalIdx = imageItem.originalIdx;
            const isLastAndExtra = idx === 3 && totalImagesCount > 4;
            const diagnosis = imageDiagnoses[url];
            const isDiagnosedLoaded = diagnosis && !diagnosis.loading;
            const isLoading = !isDiagnosedLoaded && !localLoaded[url];
            const hasError = diagnosis?.error;
            const thumbUrl = thumbnailFiles[originalIdx] || url;

            return (
              <div
                key={url}
                className="relative overflow-hidden bg-slate-100 w-full h-full cursor-pointer group-hover:brightness-95 hover:!brightness-100 transition-all duration-300"
                onClick={(e) => handleImageClickWrapper(e, url)}
                onDoubleClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => handleImageTouchStart(e, url, originalIdx)}
                onTouchMove={handleImageTouchMove}
                onTouchEnd={(e) => handleImageTouchEnd(e, url)}
                onTouchCancel={handleImageTouchCancel}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReplyMediaTarget({ url, comment: item, index: originalIdx });
                  setActiveMenuComment(item);
                }}
              >
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                      <div className="flex flex-col items-center gap-1 p-1">
                        <span className="text-[9px] text-blue-500 font-bold tracking-wider animate-pulse">
                          Cargando...
                        </span>
                      </div>
                    </div>
                  )}
                  <img
                    ref={(el) => checkImageComplete(el, url)}
                    src={thumbUrl}
                    alt={commentNames[originalIdx] || "Evidencia fotográfica"}
                    className={`w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300 ${
                      isLoading ? "opacity-0" : "opacity-100"
                    }`}
                    onLoad={() => handleImageLoad(url)}
                    onError={() => handleImageError(url)}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
                    <span className="opacity-0 hover:opacity-100 text-white font-extrabold text-[8px] uppercase tracking-widest bg-slate-900/80 px-2 py-1 rounded transition-opacity">
                      Ver imagen
                    </span>
                  </div>
                  {isLastAndExtra && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                      <span className="text-white text-base font-black tracking-tight">
                        +{totalImagesCount - 3}
                      </span>
                    </div>
                  )}
                </div>
                {hasError && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-red-50/95 p-2 text-center border border-red-200 rounded z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col items-center gap-1 w-full scale-90">
                      <span className="text-[8px] font-black uppercase tracking-widest text-red-600">Error</span>
                      <p className="text-[9px] font-bold text-red-800 leading-tight truncate max-w-[120px]">
                        {diagnosis.error}
                      </p>
                      <ActionButton
                        variant="ghost"
                        className="!text-[8px] !font-extrabold !uppercase !tracking-wider !text-blue-600 hover:!underline !bg-white !border !px-1.5 !py-0.5 !rounded !shadow-sm !h-auto !min-h-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileDownload(url, commentNames[originalIdx] || "archivo");
                        }}
                        label="Enlace directo"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {isOptimistic && progress < 100 && !uploadErr && (
            <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 rounded-lg transition-all z-10">
              <div className="w-8 h-8 rounded-full border-2 border-slate-200/50 border-t-white animate-spin flex items-center justify-center mb-1 bg-white/15 shadow-sm" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow">
                Enviando {progress}%
              </span>
            </div>
          )}
          {isOptimistic && uploadErr && (
            <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-2 rounded-lg text-center z-10">
              <span className="text-white font-black text-[10px] uppercase tracking-wider mb-1 leading-none">
                Fallo de envío
              </span>
              <span className="text-[9px] text-red-200 font-bold max-w-[150px] truncate leading-none">
                {uploadErr}
              </span>
            </div>
          )}
        </div>
      )}
      {nonImages.length > 0 && (
        <div className="flex flex-col gap-1 w-full max-w-xs mt-1">
          {nonImages.map((u) => {
            const originalIdx = commentFiles.indexOf(u);
            const name = commentNames[originalIdx] || "documento.pdf";
            return (
              <ActionButton
                variant="neutral"
                onClick={() => handleFileDownload(u, name)}
                key={u}
                className="!w-full !text-left !flex !items-center !gap-2 !p-1.5 !rounded !bg-white hover:!bg-slate-50 !border !border-slate-100 !transition-colors !justify-start !font-bold"
                label={
                  <span className="flex items-center gap-2">
                    <FiFileText size={14} className="text-blue-500" />
                    <span className="text-[9px] text-slate-700 truncate max-w-[120px]">{name}</span>
                  </span>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ImageGrid = React.memo(ImageGridComponent);
ImageGrid.displayName = "ImageGrid";
