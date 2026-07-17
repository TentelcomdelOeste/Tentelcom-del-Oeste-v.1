import React, { useState, useEffect } from 'react';
import { FiMapPin } from 'react-icons/fi';

interface LocationCardProps {
  item: any;
  isMe: boolean;
}

export const LocationCardComponent = ({ item, isMe }: LocationCardProps) => {
  const [mapImgError, setMapImgError] = useState(false);

  const lat = item.latitude;
  const lng = item.longitude;

  // Generate OpenStreetMap static map preview URL dynamically
  const osmStaticUrl =
    lat !== undefined && lat !== null && lng !== undefined && lng !== null
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=16&size=600x300&markers=${lat},${lng},red-pushpin`
      : null;

  // Primary URL is osmStaticUrl, fallback is the legacy mapPreview
  const finalMapUrl = osmStaticUrl || item.mapPreview;

  // Basic check to see if we have an image URL worth attempting to load
  const isValidSource =
    finalMapUrl &&
    !finalMapUrl.endsWith('key=') &&
    !finalMapUrl.endsWith('key=undefined') &&
    !finalMapUrl.includes('key=&') &&
    !finalMapUrl.includes('key=undefined&');

  const showImage = isValidSource && !mapImgError;

  // Quiet warning logging to check OSM static map path loading state
  useEffect(() => {
    if (finalMapUrl) {
      console.warn("[OSM-PREVIEW] Active static map preview URL:", finalMapUrl);
    }
  }, [finalMapUrl]);

  // Handle native map picker for Android, fallback seamlessly to Google Maps web on iOS/Desktop
  const handleOpenLocation = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    if (isAndroid && lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
      e.preventDefault();
      window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
    }
  };

  return (
    <div
      className={`p-2 rounded-2xl text-[12px] md:text-sm leading-relaxed transition-all duration-300 w-[240px] ${
        isMe
          ? "bg-blue-50 text-slate-800 rounded-tr-sm border border-blue-100"
          : "bg-white text-slate-800 rounded-tl-sm border border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <FiMapPin className="text-red-500 animate-pulse" />
        <span className="font-bold">Ubicación compartida</span>
      </div>
      
      {showImage ? (
        <img
          src={finalMapUrl}
          className="rounded-lg mb-2 w-full border border-slate-100 object-cover aspect-video"
          alt="Mapa de ubicación"
          referrerPolicy="no-referrer"
          onError={() => setMapImgError(true)}
        />
      ) : (
        <div className="rounded-lg mb-2 w-full aspect-video bg-slate-100/60 flex flex-col items-center justify-center p-3 text-slate-400 border border-dashed border-slate-200">
          <FiMapPin className="w-8 h-8 text-blue-500/80 mb-1" />
          <span className="text-[10px] font-bold text-slate-500 font-sans">Vista previa no disponible</span>
          <span className="text-[9px] font-medium text-slate-400 mt-0.5 font-sans text-center">GPS capturado de forma segura</span>
        </div>
      )}

      <p className="text-[10px] text-slate-500 mb-2 truncate px-1 font-mono">
        Lat: {lat?.toFixed(5) || 'n/a'}, Lng: {lng?.toFixed(5) || 'n/a'}
      </p>

      {item.googleMapsUrl && (
        <a
          href={item.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenLocation}
          className="block text-center w-full bg-blue-600 text-white rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-xs"
        >
          Abrir ubicación
        </a>
      )}
    </div>
  );
};

export const LocationCard = React.memo(LocationCardComponent);
LocationCard.displayName = "LocationCard";
