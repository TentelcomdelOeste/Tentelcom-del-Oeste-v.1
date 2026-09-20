import React, { useState, useEffect } from 'react';
import { FiImage } from 'react-icons/fi';

interface OptimizedImageProps {
  src?: string;
  fallbackSrc?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onLoad?: () => void;
  onError?: () => void;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  iconSize?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  src,
  fallbackSrc,
  alt = '',
  className = '',
  style,
  loading = 'lazy',
  decoding = 'async',
  objectFit = 'cover',
  onClick,
  onLoad,
  onError,
  referrerPolicy,
  iconSize = 20,
}) => {
  const cleanSrc = typeof src === 'string' ? src.trim() : '';
  const cleanFallback = typeof fallbackSrc === 'string' ? fallbackSrc.trim() : '';
  const primarySrc = cleanSrc || cleanFallback || '';

  const [currentSrc, setCurrentSrc] = useState<string>(primarySrc);
  const [hasTriedFallback, setHasTriedFallback] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(!primarySrc);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const cSrc = typeof src === 'string' ? src.trim() : '';
    const cFallback = typeof fallbackSrc === 'string' ? fallbackSrc.trim() : '';
    const nextSrc = cSrc || cFallback || '';
    setCurrentSrc(nextSrc);
    setHasTriedFallback(false);
    setHasError(!nextSrc);
    setIsLoaded(false);
  }, [src, fallbackSrc]);

  const handleImageError = () => {
    const cFallback = typeof fallbackSrc === 'string' ? fallbackSrc.trim() : '';
    if (!hasTriedFallback && cFallback && currentSrc !== cFallback) {
      setHasTriedFallback(true);
      setCurrentSrc(cFallback);
    } else {
      setHasError(true);
      if (onError) onError();
    }
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad();
  };

  if (hasError || !currentSrc) {
    return (
      <div
        className={`bg-slate-100 border border-slate-200/60 dark:bg-slate-800 dark:border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0 ${className}`}
        style={style}
        title={alt || 'Sin imagen'}
      >
        <FiImage size={iconSize} />
      </div>
    );
  }

  const objectFitClass =
    objectFit === 'contain' ? 'object-contain' :
    objectFit === 'fill' ? 'object-fill' :
    objectFit === 'none' ? 'object-none' :
    objectFit === 'scale-down' ? 'object-scale-down' :
    'object-cover';

  return (
    <div className={`relative overflow-hidden shrink-0 ${className}`} style={style}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200/70 dark:bg-slate-700/60 animate-pulse z-0 rounded" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onError={handleImageError}
        onLoad={handleImageLoad}
        onClick={onClick}
        referrerPolicy={referrerPolicy}
        className={`w-full h-full ${objectFitClass} transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';
