import { useState, useRef, useCallback } from 'react';

export function useSwipeMessageAction(
  setActiveMenuComment: (comment: any) => void,
  triggerReply: (comment: any) => void
) {
  const [swipingMessage, setSwipingMessage] = useState<{
    id: string;
    offset: number;
  } | null>(null);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimeoutRef = useRef<any>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent, comment: any) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      setActiveMenuComment(comment);
      if (navigator.vibrate) navigator.vibrate(55);
    }, 600);
  }, [setActiveMenuComment]);

  const handleTouchMove = useCallback((e: React.TouchEvent, comment: any) => {
    if (!touchStartRef.current) return;
    const diffX = e.touches[0].clientX - touchStartRef.current.x;
    const diffY = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.sqrt(diffX * diffX + diffY * diffY) > 10) {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
    if (Math.abs(diffX) > 15 && Math.abs(diffX) > Math.abs(diffY) && diffX > 0) {
      setSwipingMessage({ id: comment.id, offset: Math.min(diffX, 75) });
    }
  }, []);

  const handleTouchEnd = useCallback((comment: any) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    // Need to use the current swipingMessage state.
    setSwipingMessage((prev) => {
      if (prev && prev.id === comment.id && prev.offset >= 50) {
        triggerReply(comment);
      }
      return null;
    });
    touchStartRef.current = null;
  }, [triggerReply]);

  return {
    swipingMessage,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}
