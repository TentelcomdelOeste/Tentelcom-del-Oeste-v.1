import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiDownload, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { downloadOriginalImage } from '../utils/originalImageDownloader';
import { isAdmin } from '../utils/permissions';
import { User } from '../utils/types';

export interface ContextMenuPosition {
  x: number;
  y: number;
  originalUrl?: string | null;
  code?: string;
  imageIndex?: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  currentUser?: User | null;
}

export const OriginalImageContextMenu: React.FC<ContextMenuProps> = ({
  position,
  onClose,
  currentUser
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isUserAdmin = isAdmin(currentUser?.role);

  // Close on Escape or click outside
  useEffect(() => {
    if (!position) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [position, onClose]);

  if (!position || !isUserAdmin) return null;

  const { x, y, originalUrl, code, imageIndex = 0 } = position;

  // Calculate adjusted x/y to fit on screen
  const menuWidth = 240;
  const menuHeight = 56;
  const posX = Math.min(x, window.innerWidth - menuWidth - 12);
  const posY = Math.min(y, window.innerHeight - menuHeight - 12);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!originalUrl || originalUrl.trim() === '') {
      setErrorMessage('Esta imagen no tiene un archivo original disponible.');
      setTimeout(() => {
        setErrorMessage(null);
        onClose();
      }, 2500);
      return;
    }

    setIsDownloading(true);
    setErrorMessage(null);

    const prefix = code ? `${code}_foto${imageIndex + 1}` : `foto_${imageIndex + 1}`;
    const result = await downloadOriginalImage(originalUrl, prefix);

    setIsDownloading(false);

    if (!result.success && result.message) {
      setErrorMessage(result.message);
      setTimeout(() => {
        setErrorMessage(null);
        onClose();
      }, 2500);
    } else {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      <div
        ref={menuRef}
        style={{ left: `${Math.max(8, posX)}px`, top: `${Math.max(8, posY)}px` }}
        className="absolute bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-1.5 min-w-[220px] animate-scale-in text-xs font-semibold select-none z-[10000]"
        onClick={(e) => e.stopPropagation()}
      >
        {errorMessage ? (
          <div className="flex items-center gap-2 p-2 text-red-300 text-[11px] bg-red-950/60 rounded-lg border border-red-800/50">
            <FiAlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded-lg text-slate-100 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <FiLoader className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                <span className="text-blue-300">Descargando Original...</span>
              </>
            ) : (
              <>
                <FiDownload className="w-4 h-4 text-blue-400 shrink-0" />
                <span>DESCARGAR IMAGEN ORIGINAL</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

/**
 * Custom React Hook for attaching right-click (desktop) and long-press (mobile ~500ms) handlers
 * to any image element.
 */
export function useImageContextMenu(
  currentUser?: User | null,
  originalUrl?: string | null,
  code?: string,
  imageIndex: number = 0
) {
  const [menuPosition, setMenuPosition] = useState<ContextMenuPosition | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const isUserAdmin = isAdmin(currentUser?.role);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isUserAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({
      x: e.clientX,
      y: e.clientY,
      originalUrl,
      code,
      imageIndex
    });
  }, [isUserAdmin, originalUrl, code, imageIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isUserAdmin) return;
    const touch = e.touches[0];
    if (!touch) return;

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      setMenuPosition({
        x: touch.clientX,
        y: touch.clientY,
        originalUrl,
        code,
        imageIndex
      });
    }, 500); // 500ms long press
  }, [isUserAdmin, originalUrl, code, imageIndex]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !touchTimerRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // Cancel long press if user moves finger more than 10px (scrolling)
    if (dx > 10 || dy > 10) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    setMenuPosition(null);
  }, []);

  return {
    menuPosition,
    closeMenu,
    bindEvents: {
      onContextMenu: handleContextMenu,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
}
