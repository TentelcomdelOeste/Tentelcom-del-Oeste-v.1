import React from "react";
import { FiExternalLink } from "react-icons/fi";
import { ActionButton } from "@/design-system";

interface SystemEventProps {
  c: any;
  onSetActiveModule?: (module: any) => void;
}

const toSafeDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return !isNaN(d.getTime()) ? d : null;
};

export const SystemEvent: React.FC<SystemEventProps> = ({ c, onSetActiveModule }) => {
  const metadata = c.metadata || {};
  const date = toSafeDate(c.timestamp);
  
  // Prioritize technical timestamp over metadata if available, to ensure accuracy
  const displayTimestamp = (date ? date.toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toUpperCase().replace('.', '') : "") || metadata.fechaHora;

  let header = "";
  let icon = "";
  
  switch (c.systemAction) {
    case "bitacora_iniciada":
      header = "BITÁCORA INICIADA";
      icon = "🚛";
      break;
    case "bitacora_vinculada":
      header = "BITÁCORA VINCULADA";
      icon = "🔗";
      break;
    case "bitacora_desvinculada":
      header = "BITÁCORA DESVINCULADA";
      icon = "🔓";
      break;
    case "bitacora_finalizada":
      header = "BITÁCORA FINALIZADA";
      icon = "🏁";
      break;
    case "bitacora_recarga_combustible":
      header = "RECARGA DE COMBUSTIBLE";
      icon = "⛽";
      break;
    case "bitacora_actualizada":
      header = "BITÁCORA ACTUALIZADA";
      icon = "📝";
      break;
    default:
      header = "NOTIFICACIÓN";
      icon = "ℹ️";
  }

  const handleNavigateToBitacora = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetBitacoraId = metadata.bitacoraId || metadata.logId || metadata.registroId;
    
    if (onSetActiveModule && targetBitacoraId) {
      console.log(`[SystemEvent] Navigating to bitacora: ${targetBitacoraId}`);
      onSetActiveModule({ 
        module: 'vehicles_logs', 
        selectedId: targetBitacoraId 
      });
    }
  };

  return (
    <div className="flex flex-col items-center my-1.5 px-3">
      <div className="bg-slate-100/80 rounded-full px-2 py-0.5 text-[9px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
         <span>{icon}</span> {header}
      </div>
      <div className="text-[10px] text-slate-700 mt-0.5 text-center leading-snug whitespace-pre-line font-medium max-w-sm px-2">
         {metadata.descripcion}
         {metadata.destino && (
             <div className="mt-0.5"><span className="font-bold">Destino:</span> “{metadata.destino}”</div>
         )}
          {(metadata.kmLlegada !== undefined || metadata.kmSalida !== undefined || metadata.combustibleInicial || metadata.combustibleFinal || metadata.kmRecarga || metadata.monto || metadata.litros || metadata.observaciones || metadata.gasolinera) && (
            <div className="mt-0.5 space-y-0.5 text-[10px]">
                {metadata.kilometraje_recorrido !== undefined && metadata.kilometraje_recorrido > 0 && <div><span className="font-bold">Total Recorrido:</span> {metadata.kilometraje_recorrido} km</div>}
                {metadata.kmSalida !== undefined && metadata.kmSalida > 0 && <div><span className="font-bold">KM Salida:</span> {metadata.kmSalida} km</div>}
                {metadata.kmLlegada !== undefined && metadata.kmLlegada > 0 && <div><span className="font-bold">Llegada KM:</span> {metadata.kmLlegada} km</div>}
                {metadata.combustibleInicial ? <div><span className="font-bold">Combustible Inicial:</span> {metadata.combustibleInicial}</div> : null}
                {metadata.combustibleFinal ? <div><span className="font-bold">Combustible Final:</span> {metadata.combustibleFinal}</div> : null}
                {metadata.kmRecarga ? <div><span className="font-bold">KM Recarga:</span> {metadata.kmRecarga} km</div> : null}
                {metadata.monto ? <div><span className="font-bold">Monto:</span> ₡{metadata.monto.toLocaleString()}</div> : null}
                {metadata.litros ? <div><span className="font-bold">Litros:</span> {metadata.litros} L</div> : null}
                {metadata.gasolinera ? <div><span className="font-bold">Gasolinera:</span> {metadata.gasolinera}</div> : null}
                {(metadata.observaciones && metadata.observaciones.trim() && metadata.observaciones !== "Sin observaciones específicas." && metadata.observaciones !== "N/A") ? <div className="italic text-slate-500 mt-0.5">“{metadata.observaciones}”</div> : null}
            </div>
         )}
      </div>

      {(metadata.bitacoraId || metadata.logId || metadata.registroId) && onSetActiveModule && (
        <div className="mt-1.5">
          <ActionButton
            onClick={handleNavigateToBitacora}
            variant="primary"
            className="!px-3 !py-1 !rounded-full !text-[9px] !font-black !uppercase !tracking-wider shadow-md group"
            label={
              <span className="flex items-center gap-1">
                <FiExternalLink className="text-[10px] group-hover:scale-110 transition-transform" />
                Ver Bitácora
              </span>
            }
          />
        </div>
      )}

      {displayTimestamp && (
        <div className="text-[8px] text-slate-400 mt-0.5 font-mono uppercase">
          {displayTimestamp}
        </div>
      )}
    </div>
  );
};
