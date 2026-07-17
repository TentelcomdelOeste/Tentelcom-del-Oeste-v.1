import React, { useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { TimelineItem } from "../TimelineItem";
import { getFormattedDate } from "../utils/logHelpers";
import { SystemEvent } from "./SystemEvent";

interface VirtualizedTimelineProps {
  data: any[];
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
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onScroll?: (scrollTop: number) => void;
  allProjectImageUrls: string[];
  onSetActiveModule?: (module: any) => void; // Added for navigation
}

export interface VirtualizedTimelineRef {
  scrollToIndex: (index: number) => void;
  scrollToBottom: () => void;
  getScrollTop: () => number;
}

export const VirtualizedTimeline = forwardRef<VirtualizedTimelineRef, VirtualizedTimelineProps>(
  (
    {
      data,
      currentUser,
      highlightedMessageId,
      swipingMessage,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      setActiveMenuComment,
      activeMenuComment,
      setReplyMediaTarget,
      scrollToMessage,
      mergedCommentsMap,
      setFullscreenImage,
      imageDiagnoses,
      setImageDiagnoses,
      onLoadMore,
      hasMore,
      isLoadingMore,
      onScroll,
      allProjectImageUrls,
      onSetActiveModule, // Added for navigation
    },
    ref
  ) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const scrollTopRef = useRef<number>(0);

    useImperativeHandle(ref, () => ({
      scrollToIndex: (index: number) => {
        virtuosoRef.current?.scrollToIndex({
          index,
          align: "center",
          behavior: "smooth",
        });
      },
      scrollToBottom: () => {
        if (data?.length > 0) {
          virtuosoRef.current?.scrollToIndex({
            index: data?.length - 1,
            align: "end",
            behavior: "auto",
          });
        }
      },
      getScrollTop: () => scrollTopRef.current,
    }));

    // Auto scroll bottom when a new personal message is sent
    useEffect(() => {
      if (data?.length > 0) {
        // Only auto scroll bottom if we are near the bottom
        // or if our last message is our own optimistic message or a system event
        const lastItem = data[data?.length - 1];
        const isSelfMessage = lastItem.usuarioId === currentUser?.id;
        const isOptimisticEvent = lastItem.isOptimistic === true;

        if (lastItem && (isSelfMessage || isOptimisticEvent)) {
          virtuosoRef.current?.scrollToIndex({
            index: data?.length - 1,
            align: "end",
            behavior: "smooth",
          });
        }
      }
    }, [data?.length, currentUser?.id]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      scrollTopRef.current = target.scrollTop;
      if (onScroll) onScroll(target.scrollTop);
    };

    return (
      <div className="flex-1 w-full h-full relative min-h-0 bg-slate-50">
        <Virtuoso
          ref={virtuosoRef}
          data={data}
          onScroll={handleScroll}
          style={{ height: "100%", width: "100%" }}
          className="custom-scrollbar"
          initialTopMostItemIndex={data?.length > 0 ? data?.length - 1 : 0}
          followOutput={false}
          computeItemKey={(_index, item) => item.id}
          startReached={() => {
            if (hasMore && !isLoadingMore) {
              onLoadMore();
            }
          }}
          components={{
            Header: () => {
              if (!hasMore) return null;
              return (
                <div id="timeline-pagination-header" className="flex justify-center py-4 bg-slate-50/50 w-full">
                  {isLoadingMore ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm animate-pulse">
                      <svg className="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-[10px] font-black uppercase tracking-wider">Cargando bitácora histórica...</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onLoadMore}
                      className="text-[10px] bg-white hover:bg-slate-50 hover:text-blue-700 text-slate-600 font-extrabold uppercase px-4 py-2 rounded-full border border-slate-200 hover:border-blue-300 shadow-xs transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none"
                    >
                      <span>🔄</span> Cargar mensajes anteriores
                    </button>
                  )}
                </div>
              );
            },
            Footer: () => <div className="h-28 w-full bg-transparent" />,
          }}
          itemContent={(index, c) => {
            if (c.tipo === "separador") {
              return (
                <div key={c.id} className="flex justify-center my-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-200/50 px-2.5 py-1 rounded-full shadow-2xs">
                    {getFormattedDate(c.fecha)}
                  </span>
                </div>
              );
            }
            if (c.tipo === "system_event") {
                const eventKey = c.clientGeneratedId || c.optimisticId || c.id;
                return <SystemEvent key={`sys-evt-${eventKey}`} c={c} onSetActiveModule={onSetActiveModule} />;
            }

            return (
              <div key={`chat-wrapper-${c.clientGeneratedId || c.optimisticId || c.id}`} className="px-3 py-1">
                <TimelineItem
                  c={c}
                  currentUser={currentUser}
                  highlightedMessageId={highlightedMessageId}
                  swipingMessage={swipingMessage}
                  handleTouchStart={handleTouchStart}
                  handleTouchMove={handleTouchMove}
                  handleTouchEnd={handleTouchEnd}
                  setActiveMenuComment={setActiveMenuComment}
                  activeMenuComment={activeMenuComment}
                  setReplyMediaTarget={setReplyMediaTarget}
                  scrollToMessage={scrollToMessage}
                  mergedCommentsMap={mergedCommentsMap}
                  setFullscreenImage={setFullscreenImage}
                  imageDiagnoses={imageDiagnoses}
                  setImageDiagnoses={setImageDiagnoses}
                  allProjectImageUrls={allProjectImageUrls}
                />
              </div>
            );
          }}
        />
      </div>
    );
  }
);

VirtualizedTimeline.displayName = "VirtualizedTimeline";
