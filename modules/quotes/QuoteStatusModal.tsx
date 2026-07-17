import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Quote } from '../../utils/types';
import useLockBodyScroll from '../../hooks/useLockBodyScroll';
import { FiFileText, FiHash, FiTrash2, FiPlusCircle, FiLoader, FiClock, FiAlertCircle, FiLink, FiAlertTriangle, FiInfo, FiCheckCircle, FiShield, FiRotateCcw } from "react-icons/fi";
import { ActionButton, IconButton } from '../../design-system';

interface IntegrityRisk {
  type: 'invoice' | 'movement' | 'oc' | 'job' | 'report';
  count: number;
  label: string;
}

interface QuoteStatusModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: (ocs?: string[]) => Promise<void>;
  onRevert?: () => Promise<void>; // Nueva prop para reversión explícita
  quote: Quote | null;
  type: 'approve' | 'revert' | 'delete' | 'add_oc' | 'manage'; // Agregado 'manage'
  risks?: IntegrityRisk[];
}

export const QuoteStatusModal: React.FC<QuoteStatusModalProps> = ({ 
  show, onClose, onConfirm, onRevert, quote, type, risks = [] 
}) => {
  useLockBodyScroll(show);

  const [mainOc, setMainOc] = useState('');
  const [extraOcs, setExtraOcs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado local para manejar el sub-flujo de reversión dentro del modo 'manage'
  const [isReverting, setIsReverting] = useState(false);

  useEffect(() => {
    if (show && quote) {
      // Resetear estado de reversión al abrir
      setIsReverting(type === 'revert');

      const safeOcNumbers = Array.isArray(quote.ocNumbers) ? quote.ocNumbers : [];

      // Lógica de Pre-carga
      if (safeOcNumbers.length > 0) {
          setMainOc(safeOcNumbers[0] || '');
          setExtraOcs(safeOcNumbers.slice(1) || []);
      } else {
          setMainOc('');
          setExtraOcs([]);
      }
      setIsSubmitting(false);
    }
  }, [show, quote, type]);

  const addExtraField = () => {
    setExtraOcs([...extraOcs, '']);
  };

  const updateExtraOc = (index: number, value: string) => {
    const newOcs = [...extraOcs];
    newOcs[index] = value;
    setExtraOcs(newOcs);
  };

  const removeExtraOc = (index: number) => {
    setExtraOcs(extraOcs.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
        const validExtras = extraOcs.filter(oc => oc.trim() !== '');
        const finalOcs = mainOc.trim() ? [mainOc.trim(), ...validExtras] : validExtras;
        
        await onConfirm(finalOcs);
        onClose();
    } catch (e) {
        console.error(e);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRevertClick = async () => {
      if (onRevert) {
          setIsSubmitting(true);
          try {
              await onRevert();
              onClose();
          } catch (e) {
              console.error("❌ Error en handleRevertClick:", e);
          } finally {
              setIsSubmitting(false);
          }
      } else {
          console.warn("⚠️ Prop onRevert NO detectada en QuoteStatusModal");
      }
  };

  if (!show || !quote) return null;

  // Determinar si estamos en vista de formulario o vista de reversión/bloqueo
  const showRevertView = type === 'revert' || type === 'delete' || isReverting;
  const showFormView = (type === 'approve' || type === 'add_oc' || type === 'manage') && !isReverting;

  const isRevertBlocked = (type === 'revert' || isReverting) && risks.length > 0;
  const isDeleteBlocked = type === 'delete';

  let headerColor = 'bg-blue-500';
  let iconNode = <FiInfo className="text-2xl" />;
  let iconBg = 'bg-blue-100 text-blue-600';
  let title = '';
  let description = '';

  if (showFormView) {
      if (type === 'approve') {
          headerColor = 'bg-emerald-500';
          iconNode = <FiCheckCircle className="text-2xl" />;
          iconBg = 'bg-emerald-100 text-emerald-600';
          title = 'Aprobar Proyecto';
          description = 'Ingrese los números de Orden de Compra (OC) para formalizar.';
      } else {
          // manage o add_oc
          headerColor = 'bg-indigo-500';
          iconNode = <FiFileText className="text-2xl" />;
          iconBg = 'bg-indigo-100 text-indigo-600';
          title = 'Gestionar OCs';
          description = 'Administre las Órdenes de Compra asociadas a este proyecto.';
      }
  } else {
      if (type === 'delete') {
          headerColor = 'bg-red-500';
          iconNode = <FiShield className="text-2xl" />;
          iconBg = 'bg-red-100 text-red-600';
          title = 'No se puede eliminar el proyecto';
      } else {
          // Revertir (ya sea directo o desde manage)
          headerColor = 'bg-amber-500';
          iconNode = <FiRotateCcw className="text-2xl" />;
          iconBg = 'bg-amber-100 text-amber-600';
          title = 'Revertir Estado';
      }
  }

  return createPortal(
    <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex justify-center items-center z-[500] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200 relative overflow-hidden">
        
        <div className={`absolute top-0 left-0 w-full h-2 ${headerColor}`}></div>

        <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${iconBg}`}>
                {iconNode}
            </div>
            <h3 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                {title}
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1">
                Proyecto #{quote.id !== undefined && quote.id !== null ? quote.id.toString().padStart(3, '0') : '---'}
            </p>
        </div>

        {/* --- VISTA: FORMULARIO DE OCS --- */}
        {showFormView && (
            <div className="space-y-4">
                <p className="text-sm text-slate-600 font-medium text-center mb-2">
                    {description}
                </p>
                
                <div className="space-y-3">
                    {/* OC Principal */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">OC Principal <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <FiFileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"  />
                            <input 
                                type="text" 
                                value={mainOc}
                                onChange={(e) => setMainOc(e.target.value)}
                                className="w-full pl-8 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100 text-blue-900 placeholder:text-slate-300 transition-all"
                                placeholder="Ej: 4500123456"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* OCs Adicionales (Lista Dinámica) */}
                    {extraOcs.map((oc, index) => (
                        <div key={index} className="flex gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="relative flex-1">
                                <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"  />
                                <input 
                                    type="text" 
                                    value={oc}
                                    onChange={(e) => updateExtraOc(index, e.target.value)}
                                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100 text-slate-600"
                                    placeholder={`OC Adicional #${index + 1}`}
                                />
                            </div>
                            <IconButton 
                                icon={<FiTrash2 className="text-xs" />}
                                onClick={() => removeExtraOc(index)}
                                variant="danger"
                                className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
                                title="Eliminar referencia"
                            />
                        </div>
                    ))}

                    <ActionButton 
                        label={<span className="flex items-center gap-1"><FiPlusCircle /> Agregar OC adicional</span>}
                        onClick={addExtraField}
                        variant="secondary"
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 py-1 px-2 rounded-lg transition-colors border-none shadow-none bg-transparent"
                    />
                </div>

                {/* Footer de Acciones (Guardar y Opcional Revertir) */}
                <div className="flex flex-col gap-3 mt-8">
                    <div className="flex gap-3">
                        <ActionButton 
                            label="Cancelar"
                            onClick={onClose}
                            variant="secondary"
                            className="flex-1 py-3 text-slate-400 font-black uppercase text-xs rounded-xl shadow-none hover:bg-slate-50 transition-colors"
                            disabled={isSubmitting}
                        />
                        
                        <ActionButton 
                            label={isSubmitting ? <FiLoader className="animate-spin" /> : 'CONFIRMAR'}
                            onClick={handleConfirm}
                            disabled={isSubmitting || !mainOc.trim()}
                            variant="primary"
                            className={`flex-1 py-3 font-black uppercase text-xs rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                type === 'approve' 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                            }`}
                        />
                    </div>

                    {/* Botón secundario para revertir estado (Solo en modo manage/add_oc) */}
                    {(type === 'manage' || type === 'add_oc') && (
                        <ActionButton
                            label={<span className="flex items-center justify-center"><FiClock className="mr-1" /> Revertir a Pendiente</span>}
                            onClick={() => setIsReverting(true)}
                            variant="secondary"
                            className="w-full py-2 text-red-400 font-bold uppercase text-[10px] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-dashed border-slate-200 hover:border-red-200 shadow-none"
                        />
                    )}
                </div>
            </div>
        )}

        {/* --- VISTA: REVERSIÓN / BLOQUEO --- */}
        {showRevertView && (
            <div className="space-y-4">
                {(isRevertBlocked || isDeleteBlocked) ? (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                        <FiAlertCircle className="text-red-500 text-2xl mb-2"  />
                        <h4 className="text-sm font-black text-red-800 uppercase mb-2">Integridad del Sistema</h4>
                        <p className="text-xs text-red-700 mb-4">
                            {type === 'delete' 
                                ? 'Este proyecto tiene información asociada. Para mantener la integridad del sistema, no puede ser eliminado:' 
                                : 'No se puede revertir a "Pendiente" por dependencias activas:'}
                        </p>
                        <ul className="text-left bg-white/50 rounded-lg p-3 space-y-2 mb-2">
                            {risks.map((risk, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                    <FiLink className="text-red-400"  />
                                    {risk.count} {risk.label}
                                </li>
                            ))}
                        </ul>
                        <p className="text-[10px] font-medium text-slate-500 mt-3">
                            Debe desvincular o anular estos registros primero para proceder.
                        </p>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-sm font-medium text-slate-600 mb-4">
                            El proyecto volverá al estado <strong>Pendiente</strong>. <br/>
                            Esto permitirá editar sus partidas nuevamente.
                        </p>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-amber-800 text-xs font-bold flex items-center gap-2 justify-center">
                            <FiAlertTriangle  />
                            Las OCs asociadas serán desvinculadas.
                        </div>
                    </div>
                )}

                <div className="flex gap-3 mt-8">
                    {/* Botón Volver/Cancelar según contexto */}
                    <ActionButton 
                        label={(isRevertBlocked || isDeleteBlocked) ? 'Entendido' : 'Volver'}
                        onClick={() => {
                            if (isReverting && type !== 'revert') {
                                setIsReverting(false); // Volver al formulario de OCs
                            } else {
                                onClose(); // Cerrar modal
                            }
                        }}
                        variant="secondary"
                        className="flex-1 py-3 text-slate-400 font-black uppercase text-xs hover:bg-slate-50 rounded-xl transition-colors shadow-none"
                        disabled={isSubmitting}
                    />
                    
                    {/* Botón de Confirmación de Reversión (Solo si no está bloqueado y no es delete) */}
                    {!(isRevertBlocked || isDeleteBlocked) && (
                        <ActionButton 
                            label={isSubmitting ? <FiLoader className="animate-spin" /> : 'Confirmar Reversión'}
                            onClick={handleRevertClick}
                            disabled={isSubmitting}
                            variant="primary"
                            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-amber-200 transition-all active:scale-95"
                        />
                    )}
                </div>
            </div>
        )}

      </div>
    </div>,
    document.body
  );
};