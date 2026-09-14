import React from 'react';

interface CameraOverlayProps {
  technicianName: string;
  contextInfo?: string;
  jobLocation?: string;
  gpsCoords?: { latitude: number; longitude: number; accuracy: number | null } | null;
  gpsStatus: 'searching' | 'active' | 'unavailable';
  formattedDate: string;
  formattedTime: string;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  technicianName,
  contextInfo,
  jobLocation,
  gpsCoords,
  gpsStatus,
  formattedDate,
  formattedTime
}) => {
  return (
    <div
      className="absolute top-3 left-3 z-40 pointer-events-none flex flex-col gap-0.5 text-white font-medium select-none text-[11px] leading-tight tracking-wide text-left max-w-[55vw]"
      style={{
        textShadow: '1px 1px 1.5px rgba(0,0,0,0.95), -1px -1px 1.5px rgba(0,0,0,0.95), 1px -1px 1.5px rgba(0,0,0,0.95), -1px 1px 1.5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)'
      }}
    >
      <div className="text-sky-400 font-extrabold uppercase tracking-widest text-[12px]">
        TENTELCOM • <span className="text-emerald-400 animate-pulse">EN VIVO</span>
      </div>
      <div>
        {formattedDate} {formattedTime}
      </div>
      <div>
        👤 Técnico: {technicianName}
      </div>
      {contextInfo && (
        <div>
          🚚 {contextInfo}
        </div>
      )}
      {jobLocation && (
        <div className="truncate max-w-[50vw]">
          📍 {jobLocation}
        </div>
      )}
      {gpsCoords ? (
        <div className="text-emerald-300 font-mono text-[10px]">
          GPS: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)} {gpsCoords.accuracy ? `(±${gpsCoords.accuracy.toFixed(1)}m)` : ''}
        </div>
      ) : gpsStatus === 'searching' ? (
        <div className="text-amber-400 text-[10px] italic">
          GPS: Buscando satélites...
        </div>
      ) : (
        <div className="text-slate-400 text-[10px] italic">
          GPS: No disponible
        </div>
      )}
    </div>
  );
};
