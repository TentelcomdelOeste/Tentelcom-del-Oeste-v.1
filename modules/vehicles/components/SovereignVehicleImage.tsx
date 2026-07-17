import React, { useState, useEffect } from 'react';
import { FaTruck } from 'react-icons/fa';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export const SovereignVehicleImage: React.FC<Props> = ({ src, alt, className = "w-full h-full object-contain" }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const cleanSrc = src.split('?')[0];
    const cacheKey = `sovereign_vehicle_img_${cleanSrc.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // 1. Try to load from Cache first
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      setImgSrc(cachedData);
      return;
    }

    // 2. Not cached. Set to original src.
    setImgSrc(src);

    // 3. If online, fetch and cache it in the background
    if (navigator.onLine) {
      const cacheBackground = async () => {
        try {
          const res = await fetch(src);
          if (!res.ok) return;
          const blob = await res.blob();
          
          const reader = new FileReader();
          reader.onloadend = () => {
            if (isMounted) {
              const base64data = reader.result as string;
              try {
                localStorage.setItem(cacheKey, base64data);
                // Switch to cache URL to ensure consistency
                setImgSrc(base64data);
              } catch (err) {
                console.warn('[Offline Cache] localStorage limit or write error:', err);
              }
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.warn('[Offline Cache] Failed to fetch/convert image for cache:', err);
        }
      };
      cacheBackground();
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  // Fallback state
  if (loadFailed || !imgSrc) {
    const initials = alt.split(' ').map(part => part[0]).join('').substring(0, 3).toUpperCase();
    return (
      <div 
        className="bg-slate-50 text-slate-500 border border-slate-200/50 rounded-lg w-14 h-9 flex flex-col items-center justify-center shrink-0 shadow-sm transition-all"
        title={alt}
      >
        <FaTruck size={14} className="text-slate-400 mb-0.5" />
        <span className="text-[8px] text-slate-400 font-bold tracking-wider select-none uppercase truncate max-w-full px-1">
          {initials || 'UNIT'}
        </span>
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        setLoadFailed(true);
      }}
    />
  );
};
