import React from 'react';
import { FiSend, FiPaperclip, FiX, FiCamera, FiImage, FiFileText, FiMapPin, FiCornerUpLeft } from 'react-icons/fi';
import { IconButton } from '@/design-system';
import { MentionInput } from '@/modules/job_scheduling/components/MentionInput';

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

interface OperationalLogInputProps {
  newMessage: string;
  setNewMessage: (msg: string) => void;
  pendingAttachment: any;
  setPendingAttachment: (a: any) => void;
  showAttachMenu: boolean;
  setShowAttachMenu: (show: boolean) => void;
  replyingTo: any;
  setReplyingTo: (r: any) => void;
  isUploading: boolean;
  onSend: (e?: React.FormEvent) => void;
  onCameraChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => void;
  onSendLocation: () => void;
  handleCancelAttachment: () => void;
  cameraRef: React.RefObject<HTMLInputElement>;
  galleryRef: React.RefObject<HTMLInputElement>;
  fileRef: React.RefObject<HTMLInputElement>;
  attachMenuRef?: React.RefObject<HTMLDivElement>;
  isGettingLocation?: boolean;
  gpsError?: string | null;
  setGpsError?: (err: string | null) => void;
}

export const OperationalLogInput: React.FC<OperationalLogInputProps> = ({
  newMessage,
  setNewMessage,
  pendingAttachment,
  setPendingAttachment: _setPendingAttachment,
  showAttachMenu,
  setShowAttachMenu,
  replyingTo,
  setReplyingTo,
  isUploading,
  onSend,
  onCameraChange,
  onFileChange,
  onSendLocation,
  handleCancelAttachment,
  cameraRef,
  galleryRef,
  fileRef,
  attachMenuRef,
  isGettingLocation = false,
  gpsError = null,
  setGpsError
}) => {
  const [isLongText, setIsLongText] = React.useState(false);

  return (
    <div className="bg-white p-2 md:p-3 border-t border-slate-200 shrink-0 sticky bottom-0 z-20 w-full overflow-visible">
      {/* Hidden file selectors for different file inputs */}
      <input 
        type="file" 
        ref={cameraRef} 
        onChange={onCameraChange} 
        className="hidden" 
        accept="image/*" 
        capture="environment" 
      />
      
      <input 
        type="file" 
        ref={galleryRef} 
        onChange={(e) => onFileChange(e, 'image')} 
        className="hidden" 
        accept="image/*" 
        multiple
      />

      <input 
        type="file" 
        ref={fileRef} 
        onChange={(e) => onFileChange(e, 'file')} 
        className="hidden" 
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" 
      />

      {replyingTo && (
        <div className="mx-2 mb-2 p-2 px-3 bg-slate-50 text-slate-800 rounded-xl border-l-4 border-blue-500 shadow-xs flex items-center justify-between gap-3 text-xs font-semibold relative z-15">
          <div className="flex items-center gap-3 overflow-hidden">
            {replyingTo.tipo === 'imagen' && replyingTo.imagenUrl ? (
              <img 
                src={replyingTo.imagenUrl} 
                className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 shadow-xs" 
                alt="Reply message preview" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                <FiCornerUpLeft className="w-4 h-4" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-blue-600 text-[10px] uppercase tracking-wider">Respondiendo a {replyingTo.usuarioNombre}</span>
              <p className="text-slate-500 truncate text-[11px] font-bold">
                {replyingTo.tipo === 'imagen'
                  ? (replyingTo.mensaje || "Evidencia fotográfica")
                  : replyingTo.mensaje || "Archivo adjunto"}
              </p>
            </div>
          </div>
          <IconButton 
            icon={<FiX className="w-4 h-4" />} 
            onClick={() => setReplyingTo(null)} 
            variant="neutral"
            className="!p-1.5 !min-w-0 !min-h-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
          />
        </div>
      )}
      
      {pendingAttachment && pendingAttachment.type === 'image' && (
        <div className="mx-2 mb-2 p-3 bg-blue-50/40 rounded-2xl border border-blue-100 flex flex-col gap-2 shadow-xs animate-fade-in relative z-15">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] uppercase font-black tracking-widest text-blue-600">Imágenes seleccionadas ({pendingAttachment.files?.length || 0})</span>
            <IconButton 
              icon={<FiX className="w-4 h-4" />} 
              onClick={handleCancelAttachment} 
              variant="neutral"
              className="!p-1.5 !min-w-0 !min-h-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              title="Quitar imágenes"
            />
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 max-w-full custom-scrollbar">
            {pendingAttachment.previewUrls?.map((url: string, index: number) => {
              const file = pendingAttachment.files?.[index];
              return (
                <div key={index} className="relative group shrink-0">
                  <img 
                    src={url} 
                    alt="Pending upload image grid preview element" 
                    className="w-14 h-14 object-cover rounded-xl border border-blue-200 shadow-xs" 
                  />
                  {file && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 rounded-b-xl px-1 text-[8px] text-white font-semibold text-center truncate max-w-[56px]">
                      {formatSize(file.size)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingAttachment && pendingAttachment.type === 'file' && (
        <div className="mx-2 mb-2 p-3 bg-indigo-50/45 text-slate-800 rounded-xl border border-indigo-100/60 flex items-center justify-between gap-3 text-xs font-bold shadow-xs animate-fade-in relative z-15">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-200">
              <FiFileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-indigo-600 text-[10px] uppercase tracking-wider">Documento adjunto</span>
              <p className="text-slate-700 truncate font-semibold text-[11px] mb-0.5">
                {pendingAttachment.files?.[0]?.name || 'Archivo adjunto'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">
                  {pendingAttachment.files?.[0] ? formatSize(pendingAttachment.files[0].size) : ""}
                </span>
                {pendingAttachment.files?.[0]?.type && (
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                    {pendingAttachment.files[0].type.split("/")[1] || pendingAttachment.files[0].name.split(".").pop()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <IconButton 
            icon={<FiX className="w-4 h-4" />} 
            onClick={handleCancelAttachment} 
            variant="neutral"
            className="!p-1.5 !min-w-0 !min-h-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
            title="Quitar documento"
          />
        </div>
      )}

      {isGettingLocation && (
        <div className="mx-2 mb-2 p-3 bg-blue-50/45 text-slate-800 rounded-xl border border-blue-100/65 flex items-center justify-between gap-3 text-xs font-bold shadow-xs animate-fade-in relative z-15 shadow-blue-50/20">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100/80 flex items-center justify-center text-blue-600 shrink-0 border border-blue-200">
              <div className="relative flex items-center justify-center">
                <FiMapPin className="w-5 h-5 animate-bounce text-blue-600" />
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-25 animate-ping"></span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-blue-600 text-[10px] uppercase tracking-wider">Localización por GPS</span>
              <p className="text-slate-700 truncate font-semibold text-[11px] mb-0.5">
                Obteniendo coordenadas de alta precisión...
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400">
                  Por favor, espere un momento
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {gpsError && (
        <div className="mx-2 mb-2 p-3 bg-rose-50 border border-rose-200/80 text-rose-800 rounded-xl flex items-center justify-between gap-3 text-xs font-bold shadow-xs animate-fade-in relative z-15 shadow-rose-50/10">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-100/90 flex items-center justify-center text-rose-600 shrink-0 border border-rose-200/60">
              <FiMapPin className="w-5 h-5 text-rose-600" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-rose-600 text-[10px] uppercase tracking-wider">Error de Localización</span>
              <p className="text-slate-700 font-semibold text-[11px] leading-snug mt-0.5 mb-1 pr-1">
                {gpsError}
              </p>
              <span className="text-[10px] font-bold text-slate-400">
                Toque el icono de la cruz para descartar
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGpsError?.(null)}
            className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-400 hover:text-rose-600 transition-colors shrink-0 outline-none"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={onSend} className="flex items-end gap-0.5 w-full">
        <MentionInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={onSend}
          disabled={isUploading || isGettingLocation}
          placeholder={isGettingLocation ? "Obteniendo ubicación..." : "Mensajes..."}
          className="flex-1 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/85 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-700 py-3 px-3 focus:outline-none transition-colors duration-200 shadow-xs placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed w-full"
          onLinesChange={setIsLongText}
        />

        {/* Camera Button: triggers direct promptless image capture. Omitted when isLongText is true */}
        {!isLongText && (
          <IconButton
            icon={<FiCamera className="w-4 h-4 text-slate-500 hover:text-blue-600 transition-colors" />}
            onClick={() => cameraRef.current?.click()}
            disabled={isUploading || isGettingLocation}
            title="Tomar foto / Cámara"
            className="hover:bg-slate-50 active:bg-slate-100 rounded-lg !p-2 shrink-0"
          />
        )}

        {/* Clip Button: toggles mini contextual menu */}
        <div className="relative" ref={attachMenuRef}>
          <IconButton
            icon={
              <FiPaperclip 
                className={`w-4 h-4 transition-transform duration-250 ${
                  showAttachMenu ? "rotate-45 text-blue-600 animate-pulse" : "text-slate-500 hover:text-blue-600"
                }`} 
              />
            }
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={isUploading || isGettingLocation}
            title="Adjuntar"
            className={`hover:bg-slate-50 active:bg-slate-100 rounded-lg !p-2 shrink-0 ${
              showAttachMenu ? "bg-blue-50/50" : ""
            }`}
          />

          {/* Mini Contextual Menu */}
          {showAttachMenu && (
            /* eslint-disable-next-line no-restricted-syntax */
            <div 
              className="absolute bottom-12 right-0 bg-white shadow-xl rounded-2xl border border-slate-100/80 p-1.5 min-w-[200px] flex flex-col gap-0.5 z-[100]"
              style={{
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08)'
              }}
            >
              {/* Show Camera option inside attachments menu only when long text (outer camera button is hidden) */}
              {isLongText && (
                /* eslint-disable-next-line no-restricted-syntax */
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setTimeout(() => {
                      cameraRef.current?.click();
                    }, 150);
                  }}
                  className="flex items-center gap-3.5 w-full px-4 py-3 hover:bg-slate-50 active:bg-slate-100/80 rounded-xl text-left text-[11px] font-black uppercase tracking-wider text-slate-700 transition-colors group"
                >
                  <FiCamera className="w-4.5 h-4.5 text-blue-500 group-hover:scale-105 transition-transform shrink-0" />
                  <span>Tomar foto / Cámara</span>
                </button>
              )}

              {/* eslint-disable-next-line no-restricted-syntax */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  setTimeout(() => {
                    galleryRef.current?.click();
                  }, 150);
                }}
                className="flex items-center gap-3.5 w-full px-4 py-3 hover:bg-slate-50 active:bg-slate-100/80 rounded-xl text-left text-[11px] font-black uppercase tracking-wider text-slate-700 transition-colors group"
              >
                <FiImage className="w-4.5 h-4.5 text-emerald-500 group-hover:scale-105 transition-transform shrink-0" />
                <span>Seleccionar galería</span>
              </button>

              {/* eslint-disable-next-line no-restricted-syntax */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  setTimeout(() => {
                    fileRef.current?.click();
                  }, 150);
                }}
                className="flex items-center gap-3.5 w-full px-4 py-3 hover:bg-slate-50 active:bg-slate-100/80 rounded-xl text-left text-[11px] font-black uppercase tracking-wider text-slate-700 transition-colors group"
              >
                <FiFileText className="w-4.5 h-4.5 text-indigo-500 group-hover:scale-105 transition-transform shrink-0" />
                <span>Adjuntar documento</span>
              </button>

              {/* eslint-disable-next-line no-restricted-syntax */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  onSendLocation();
                }}
                className="flex items-center gap-3.5 w-full px-4 py-3 hover:bg-slate-50 active:bg-slate-100/80 rounded-xl text-left text-[11px] font-black uppercase tracking-wider text-slate-700 transition-colors group"
              >
                <FiMapPin className="w-4.5 h-4.5 text-blue-500 group-hover:scale-105 transition-transform shrink-0" />
                <span>Enviar ubicación</span>
              </button>
            </div>
          )}
        </div>

        {/* Send Button */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <button 
          type="submit" 
          disabled={isUploading || isGettingLocation || (!newMessage.trim() && !pendingAttachment)}
          className="h-9 w-9 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-blue-600 disabled:cursor-not-allowed shrink-0"
        >
          <FiSend className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </form>
    </div>
  );
};

