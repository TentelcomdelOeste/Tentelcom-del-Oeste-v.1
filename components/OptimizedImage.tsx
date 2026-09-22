import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiImage } from 'react-icons/fi';

/**
 * In-memory session cache for URLs that have loaded successfully in the current session.
 * Prevents skeleton flicker on component remounts (filtering, tab switches, vehicle changes).
 */
const LOADED_IMAGE_URLS = new Set<string>();

/**
 * In-memory session cache for URLs that returned 404 or failed to load.
 * Allows components to instantly skip broken thumbnails and use working HD/Original images.
 */
const FAILED_IMAGE_URLS = new Set<string>();

interface OptimizedImageProps {
  src?: string;
  fallbackSrc?: string;
  fallbackSrcs?: string[];
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
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
  fallbackSrcs,
  alt = '',
  className = '',
  style,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  objectFit = 'cover',
  onClick,
  onLoad,
  onError,
  referrerPolicy,
  iconSize = 20,
}) => {
  // Collect all unique candidate URLs in order
  const candidates = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    const addUrl = (u?: string | null) => {
      if (typeof u === 'string') {
        const trimmed = u.trim();
        if (trimmed.length > 0 && !seen.has(trimmed)) {
          seen.add(trimmed);
          list.push(trimmed);
        }
      }
    };

    addUrl(src);
    addUrl(fallbackSrc);
    if (Array.isArray(fallbackSrcs)) {
      fallbackSrcs.forEach(addUrl);
    }

    return list;
  }, [src, fallbackSrc, fallbackSrcs]);

  // Determine initial candidate index (skipping previously failed URLs if alternatives exist)
  const getInitialIndex = (candidateList: string[]): number => {
    if (candidateList.length === 0) return -1;
    // Prefer the first candidate that hasn't failed in this session
    const firstNonFailedIdx = candidateList.findIndex(u => !FAILED_IMAGE_URLS.has(u));
    return firstNonFailedIdx !== -1 ? firstNonFailedIdx : 0;
  };

  const [candidateIndex, setCandidateIndex] = useState<number>(() => getInitialIndex(candidates));
  const currentUrl = candidateIndex >= 0 && candidateIndex < candidates.length ? candidates[candidateIndex] : '';

  const initialLoaded = Boolean(currentUrl && LOADED_IMAGE_URLS.has(currentUrl));
  const [isLoaded, setIsLoaded] = useState<boolean>(initialLoaded);
  const [hasError, setHasError] = useState<boolean>(!currentUrl);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(candidateIndex > 0);

  // Track candidates signature to avoid unnecessary resets
  const candidatesKey = candidates.join('|');
  const prevCandidatesKeyRef = useRef(candidatesKey);

  useEffect(() => {
    if (prevCandidatesKeyRef.current !== candidatesKey) {
      prevCandidatesKeyRef.current = candidatesKey;
      const initialIdx = getInitialIndex(candidates);
      setCandidateIndex(initialIdx);
      const nextUrl = initialIdx >= 0 && initialIdx < candidates.length ? candidates[initialIdx] : '';
      const loaded = Boolean(nextUrl && LOADED_IMAGE_URLS.has(nextUrl));
      setIsLoaded(loaded);
      setHasError(!nextUrl);
      setIsFallbackMode(initialIdx > 0);
    }
  }, [candidatesKey, candidates]);

  const handleImageError = () => {
    if (currentUrl) {
      FAILED_IMAGE_URLS.add(currentUrl);
    }

    // Try next candidate in the list that hasn't failed yet
    let nextIdx = candidateIndex + 1;
    while (nextIdx < candidates.length && FAILED_IMAGE_URLS.has(candidates[nextIdx])) {
      nextIdx++;
    }

    if (nextIdx < candidates.length) {
      const nextUrl = candidates[nextIdx];
      setCandidateIndex(nextIdx);
      setIsFallbackMode(true);
      setIsLoaded(LOADED_IMAGE_URLS.has(nextUrl));
      setHasError(false);
    } else {
      // All candidates exhausted
      setHasError(true);
      if (onError) onError();
    }
  };

  const handleImageLoad = () => {
    if (currentUrl) {
      LOADED_IMAGE_URLS.add(currentUrl);
      FAILED_IMAGE_URLS.delete(currentUrl);
    }
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad();
  };

  if (hasError || !currentUrl) {
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

  // Force eager loading during fallback attempts so Chromium doesn't suspend the fetch
  const effectiveLoading = isFallbackMode ? 'eager' : loading;

  return (
    <div className={`relative overflow-hidden shrink-0 ${className}`} style={style}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200/70 dark:bg-slate-700/60 animate-pulse z-0 rounded" />
      )}
      <img
        key={currentUrl}
        src={currentUrl}
        alt={alt}
        loading={effectiveLoading}
        decoding={decoding}
        {...(fetchPriority ? { fetchPriority } : {})}
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

