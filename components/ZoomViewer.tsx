import React, { useState, useRef, useEffect } from 'react';
import { FiZoomIn, FiZoomOut } from 'react-icons/fi';

interface ZoomViewerProps {
  src: string;
  alt: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onDoubleTap?: () => void;
}

export const ZoomViewer: React.FC<ZoomViewerProps> = ({ 
  src, 
  alt, 
  onSwipeLeft, 
  onSwipeRight,
  onDoubleTap
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Drag state
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPosition = useRef({ x: 0, y: 0 });
  
  // Pinch state
  const pinchStartDistance = useRef<number | null>(null);
  const lastScale = useRef(1);
  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);

  // Reset when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    lastScale.current = 1;
  }, [src]);

  const handleZoomIn = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScale(prev => Math.max(prev - 0.5, 1));
  };

  const handleReset = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY < 0) {
      setScale(prev => Math.min(prev + 0.25, 4));
    } else {
      setScale(prev => {
        const newScale = Math.max(prev - 0.25, 1);
        if (newScale === 1) setPosition({ x: 0, y: 0 });
        return newScale;
      });
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2);
    }
    if (onDoubleTap) onDoubleTap();
  };

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastPosition.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;
    setPosition({
      x: lastPosition.current.x + deltaX,
      y: lastPosition.current.y + deltaY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers
  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      pinchStartDistance.current = getDistance(e.touches[0], e.touches[1]);
      lastScale.current = scale;
    } else if (e.touches.length === 1) {
      // Drag or Swipe start
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX, y: touch.clientY };
      lastPosition.current = { ...position };
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      
      if (scale > 1) {
        setIsDragging(true);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistance.current) {
      // Pinch move
      // No preventDefault here normally, but to prevent scrolling we might need it.
      if (e.cancelable) e.preventDefault();
      
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const newScale = lastScale.current * (currentDistance / pinchStartDistance.current);
      const boundedScale = Math.max(1, Math.min(newScale, 5));
      setScale(boundedScale);
      if (boundedScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && scale > 1 && isDragging) {
      // Drag move
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.current.x;
      const deltaY = touch.clientY - dragStart.current.y;
      setPosition({
        x: lastPosition.current.x + deltaX,
        y: lastPosition.current.y + deltaY
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    pinchStartDistance.current = null;
    setIsDragging(false);
    
    // Check swipe if not zoomed in
    if (scale <= 1 && e.changedTouches.length === 1 && touchStartRef.current) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const timeDiff = Date.now() - touchStartRef.current.time;
      
      if (Math.abs(deltaX) > 40 && timeDiff < 300) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else if (Math.abs(deltaX) < 10 && timeDiff < 300) {
        // Double tap check
        const now = Date.now();
        if ((now - ((window as any).lastZoomTapTime || 0)) < 300) {
           handleDoubleClick(e as any);
           (window as any).lastZoomTapTime = 0;
        } else {
           (window as any).lastZoomTapTime = now;
        }
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Viewport de Imagen */}
      <div 
        className="relative flex-1 flex flex-col items-center justify-center overflow-hidden touch-none w-full"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-md select-none pointer-events-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging || (pinchStartDistance.current !== null) ? 'none' : 'transform 0.2s ease-out',
            transformOrigin: 'center center',
            willChange: 'transform'
          }}
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>
      
      {/* Controles de Zoom */}
      <div className="flex-none pt-3 pb-1 flex justify-center items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="p-2.5 text-white hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent rounded-full transition-colors cursor-pointer"
            title="Alejar"
          >
            <FiZoomOut className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-white text-sm font-bold hover:bg-slate-700 rounded transition-colors min-w-[4rem] cursor-pointer"
            title="Restablecer"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="p-2.5 text-white hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent rounded-full transition-colors cursor-pointer"
            title="Acercar"
          >
            <FiZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
