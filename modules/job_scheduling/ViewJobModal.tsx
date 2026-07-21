import React from 'react';
import { Modal, ActionButton } from '@/design-system';
import { Trabajo } from './types';
import { 
  FiInfo, 
  FiUsers, 
  FiTool, 
  FiMessageSquare,
  FiCalendar,
  FiClock,
  FiTag,
  FiClipboard,
  FiUser,
  FiAlertCircle
} from 'react-icons/fi';
import { FaBoxes, FaTruck, FaWrench } from 'react-icons/fa';

interface ViewJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  trabajo: Trabajo | null;
  onSetActiveModule?: (moduleData: string | { 
    module: string; 
    selectedId?: string; 
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
    state?: any;
  }) => void;
}

export const ViewJobModal: React.FC<ViewJobModalProps> = ({ isOpen, onClose, trabajo, onSetActiveModule }) => {
  if (!trabajo) return null;

  // Helpers
  const getTimestamp = (date: any) => {
    if (!date) return 0;
    if (typeof date.toMillis === "function") return date.toMillis();
    if (date.seconds) return date.seconds * 1000;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const formatJobDateRange = (startVal: any, endVal?: any) => {
    if (!startVal) return "No registrado";
    const tsStart = getTimestamp(startVal);
    if (tsStart <= 0) return "No registrado";
    
    const dStart = new Date(tsStart);
    const tsEnd = endVal ? getTimestamp(endVal) : 0;
    const dEnd = tsEnd > 0 ? new Date(tsEnd) : null;
    
    try {
      const options: Intl.DateTimeFormatOptions = { 
        day: "numeric", 
        month: "long", 
        year: "numeric",
        timeZone: "UTC"
      };
      
      const startText = new Intl.DateTimeFormat("es-CR", options).format(dStart);
      
      if (!dEnd || dStart.getTime() === dEnd.getTime()) {
        return startText;
      }
      
      const startDayMonth = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "long", timeZone: "UTC" }).format(dStart);
      const endText = new Intl.DateTimeFormat("es-CR", options).format(dEnd);
      
      return `${startDayMonth} al ${endText}`;
    } catch (e) {
      return "Fecha inválida";
    }
  };

  const renderStatus = (status?: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('programado')) {
      return <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max"><FiCalendar className="text-[10px]"/> PROGRAMADO</span>;
    }
    if (s.includes('proceso')) {
      return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max"><FiClock className="text-[10px]"/> EN PROCESO</span>;
    }
    if (s.includes('finalizado') || s.includes('completado')) {
      return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max"><FiClipboard className="text-[10px]"/> FINALIZADO</span>;
    }
    if (s.includes('cancelado')) {
      return <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max"><FiAlertCircle className="text-[10px]"/> CANCELADO</span>;
    }
    if (s.includes('reprogramado')) {
      return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max"><FiClock className="text-[10px]"/> REPROGRAMADO</span>;
    }
    return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider w-max">{status || 'N/D'}</span>;
  };

  const headerTitle = (
    <div className="flex items-center gap-3">
      <div className="bg-blue-600 rounded-xl w-10 h-10 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
        <FiClipboard className="text-xl" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-black text-blue-950 uppercase tracking-tight leading-none">VISUALIZAR TRABAJO</span>
      </div>
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={headerTitle} 
      maxWidth="max-w-4xl"
      footer={
        <div className="w-full flex justify-end">
          <ActionButton variant="primary" label="Cerrar" onClick={onClose} />
        </div>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* INFORMACIÓN GENERAL */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-100 text-blue-700 p-1.5 rounded-lg">
              <FiInfo className="text-sm" />
            </div>
            <h4 className="font-black text-blue-950 uppercase tracking-tight text-sm">Información General</h4>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Col 1 */}
              <div className="space-y-4">
                <div className="grid grid-cols-[30px_1fr] items-center">
                  <FiTag className="text-slate-400 text-sm" />
                  <div className="flex items-center">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider w-16 flex-shrink-0">Título:</span>
                    <span className="text-xs text-slate-900 font-black uppercase truncate ml-2 text-left">{trabajo.titulo || 'No registrado'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-[30px_1fr] items-center">
                  <FiTag className="text-slate-400 text-sm" />
                  <div className="flex items-center">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider w-16 flex-shrink-0">Tipo:</span>
                    <span className="text-xs text-slate-900 font-black uppercase truncate ml-2 text-left">{trabajo.tipo_trabajo || 'No registrado'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-[30px_1fr] items-center">
                  <FiCalendar className="text-slate-400 text-sm" />
                  <div className="flex items-center">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider w-16 flex-shrink-0">Fecha:</span>
                    <span className="text-xs text-slate-900 font-black uppercase truncate ml-2 text-left">
                      {formatJobDateRange(trabajo.fecha_inicio, trabajo.fecha_fin)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[30px_1fr] items-center">
                  <FiClock className="text-slate-400 text-sm" />
                  <div className="flex items-center">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider w-16 flex-shrink-0">Hora:</span>
                    <span className="text-xs text-slate-900 font-black uppercase truncate ml-2 text-left">
                      {trabajo.hora_inicio || 'N/D'} - {trabajo.hora_fin || 'N/D'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Col 2 */}
              <div className="space-y-4">
                <div className="grid grid-cols-[30px_1fr] items-center">
                  <FiClipboard className="text-slate-400 text-sm" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Estado:</span>
                    <div className="flex justify-end ml-2">{renderStatus(trabajo.estado)}</div>
                  </div>
                </div>
              </div>

              {/* Col 3: Descripción separada */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-full shadow-sm">
                <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2 block">Descripción</span>
                <p className="text-xs text-slate-700 font-medium leading-relaxed overflow-y-auto max-h-[120px] custom-scrollbar">
                  {trabajo.descripcion || 'Sin descripción registrada.'}
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* VÍNCULO DE BITÁCORA */}
        {(trabajo.registroBitacoraId || (trabajo.bitacoraIds && trabajo.bitacoraIds.length > 0) || (trabajo.bitacorasRelacionadas && trabajo.bitacorasRelacionadas.length > 0)) && (
          <section className="animate-in slide-in-from-top-2 duration-500">
             <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 text-white p-2.5 rounded-xl flex-shrink-0 shadow-md">
                    <FiClipboard className="text-lg" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest leading-none mb-1">Bitácora Vinculada</span>
                    <span className="text-xs font-bold text-slate-800">Este trabajo consume el timeline operativo de una bitácora de salida.</span>
                  </div>
                </div>
                <ActionButton 
                  variant="primary" 
                  label="Abrir Bitácora" 
                  className="!bg-indigo-600 hover:!bg-indigo-700 !text-white !py-2 !px-4 !h-auto !text-[10px]"
                  onClick={() => {
                    onClose();
                    
                    let actualParentId = trabajo.registroBitacoraId;
                    if (!actualParentId && trabajo.bitacoraIds && trabajo.bitacoraIds.length > 0) {
                        actualParentId = trabajo.bitacoraIds[trabajo.bitacoraIds.length - 1];
                    }
                    if (!actualParentId && trabajo.bitacorasRelacionadas && trabajo.bitacorasRelacionadas.length > 0) {
                        actualParentId = trabajo.bitacorasRelacionadas[trabajo.bitacorasRelacionadas.length - 1].bitacoraId;
                    }

                    onSetActiveModule?.({
                      module: 'operational_log',
                      selectedId: trabajo.id,
                      state: {
                        parentId: actualParentId,
                        parentCollection: 'bitacora_vehiculos'
                      }
                    });
                  }}
                />
             </div>
          </section>
        )}

        {/* PERSONAL ASIGNADO */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg">
              <FiUsers className="text-sm" />
            </div>
            <h4 className="font-black text-blue-950 uppercase tracking-tight text-sm">Personal Asignado</h4>
          </div>
          
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            {(!trabajo.cuadrilla || trabajo.cuadrilla.length === 0) ? (
              <p className="text-xs text-slate-400 font-bold italic">No hay personal asignado registrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trabajo.cuadrilla.map((persona, index) => (
                  <div key={index} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 hover:bg-indigo-100 transition-colors shadow-sm">
                    <div className="bg-indigo-200 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                      <FiUser className="text-[10px]" />
                    </div>
                    <span className="text-xs font-bold text-indigo-900">{persona}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RECURSOS */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-amber-100 text-amber-700 p-1.5 rounded-lg">
              <FiTool className="text-sm" />
            </div>
            <h4 className="font-black text-blue-950 uppercase tracking-tight text-sm">Recursos</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Materiales */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl flex-shrink-0">
                <FaBoxes className="text-lg" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Materiales</span>
                <span className="text-xs font-bold text-slate-800 break-words">
                  {(!trabajo.materiales || trabajo.materiales.length === 0) ? <span className="text-slate-400 italic font-medium">No registrado</span> : trabajo.materiales.join(', ')}
                </span>
              </div>
            </div>

            {/* Herramientas */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl flex-shrink-0">
                <FaWrench className="text-lg" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Herramientas</span>
                <span className="text-xs font-bold text-slate-800 break-words">
                  {(!trabajo.herramientas || trabajo.herramientas.length === 0) ? <span className="text-slate-400 italic font-medium">No registrado</span> : trabajo.herramientas.join(', ')}
                </span>
              </div>
            </div>

            {/* Vehículos */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-purple-100 text-purple-600 p-2.5 rounded-xl flex-shrink-0">
                <FaTruck className="text-lg" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Vehículos</span>
                <span className="text-xs font-bold text-slate-800 break-words">
                  {(!trabajo.unidades || trabajo.unidades.length === 0) ? <span className="text-slate-400 italic font-medium">No registrado</span> : trabajo.unidades.join(', ')}
                </span>
              </div>
            </div>
            
          </div>
        </section>

        {/* OBSERVACIONES */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-yellow-100 text-yellow-700 p-1.5 rounded-lg">
              <FiMessageSquare className="text-sm" />
            </div>
            <h4 className="font-black text-blue-950 uppercase tracking-tight text-sm">Observaciones</h4>
          </div>
          
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              {trabajo.observaciones || <span className="text-slate-400 italic">No registrado</span>}
            </p>
          </div>
        </section>

      </div>
    </Modal>
  );
};

