import React, { useState, useRef, useEffect } from "react";
import { useNotifications, NotificationDoc } from "../hooks/useNotifications";
import { Bell, CheckCheck, AtSign, CornerUpLeft, MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NotificationCenterProps {
  setActiveModule: (moduleData: {
    module: string;
    selectedId?: string;
    state?: any;
    selectedKey?: string;
    jobId?: string;
    otCode?: string;
  }) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  setActiveModule,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Close when clicking outside - only relevant for desktop popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        window.innerWidth >= 768 // Only on desktop
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Prevent scroll when open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: NotificationDoc) => {
    setIsOpen(false);
    
    // Mark as read in Firestore
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    const isVehicleLog = notification.parentCollection === "bitacora_vehiculos" || 
                         (notification.trabajoTitle && notification.trabajoTitle.includes("Bitácora de Salida"));

    if (isVehicleLog) {
      setActiveModule({
        module: "operational_log",
        selectedId: notification.trabajoId,
        state: { 
          parentId: notification.trabajoId,
          parentCollection: "bitacora_vehiculos",
          scrollToCommentId: notification.comentarioId 
        },
      });
    } else {
      // Direct contextual navigation to OperationalLog (Bitácora)
      setActiveModule({
        module: "operational_log",
        selectedId: notification.trabajoId,
        state: { 
          scrollToCommentId: notification.comentarioId,
          parentCollection: "trabajos"
        },
      });
    }
  };

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return "ahora";
    
    let date: Date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    const diff = new Date().getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return "ahora";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "mention":
        return (
          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
            <AtSign className="w-4.5 h-4.5" />
          </div>
        );
      case "reply":
        return (
          <div className="w-9 h-9 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 shrink-0 shadow-xs">
            <CornerUpLeft className="w-4.5 h-4.5" />
          </div>
        );
      case "comment":
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 shadow-xs">
            <MessageCircle className="w-4.5 h-4.5" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-blue-800 flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all text-blue-100 hover:text-white relative outline-none cursor-pointer group shadow-sm border border-blue-700/50"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5 transition-transform duration-200 group-hover:rotate-12" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-black text-[10px] min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1 shadow-sm border-2 border-blue-800 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for Mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[998] md:hidden"
            />

            {/* Floating Panel / Drawer */}
            <motion.div
              initial={
                window.innerWidth < 768 
                  ? { y: "100%" } 
                  : { opacity: 0, scale: 0.95, y: 10 }
              }
              animate={
                window.innerWidth < 768 
                  ? { y: 0 } 
                  : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                window.innerWidth < 768 
                  ? { y: "100%" } 
                  : { opacity: 0, scale: 0.95, y: 10 }
              }
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 md:absolute md:inset-auto md:right-0 md:top-full md:mt-3 w-full md:w-[420px] bg-white md:rounded-2xl rounded-t-[2rem] border-t md:border border-slate-200 shadow-[0_-8px_32px_rgba(0,0,0,0.1)] md:shadow-2xl z-[999] flex flex-col md:max-h-[550px] max-h-[80vh] overflow-hidden"
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0 md:hidden" />
              {/* Header */}
              <div className="bg-slate-50/80 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase font-black tracking-[0.1em] text-slate-400">
                      Notificaciones
                    </span>
                    {unreadCount > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 active:scale-95 transition-all bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Leer todas</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="md:hidden p-2 text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* List content */}
              <div className="overflow-y-auto custom-scrollbar flex flex-col divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 ring-8 ring-slate-50/50">
                      <Bell className="w-7 h-7 opacity-50" />
                    </div>
                    <span className="font-black text-xs uppercase text-slate-400 mt-6 tracking-widest">
                      Bandeja vacía
                    </span>
                    <p className="text-[13px] text-slate-400 mt-2 font-medium max-w-[200px]">
                      No tienes notificaciones pendientes en este momento.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full px-5 py-4 text-left flex items-start gap-4 transition-all outline-none cursor-pointer relative group ${
                        n.read
                          ? "hover:bg-slate-50 bg-white"
                          : "bg-blue-50/30 hover:bg-blue-50/50 border-l-4 border-blue-500"
                      }`}
                    >
                      {renderNotificationIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight truncate">
                            {n.triggeredByName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            {getRelativeTime(n.createdAt)}
                          </span>
                        </div>

                        <p className="text-[13px] font-semibold text-slate-700 leading-snug">
                          {n.type === "mention" && (
                            <>Te mencionó en <span className="text-slate-900 font-bold">{n.trabajoTitle || "Trabajo"}</span></>
                          )}
                          {n.type === "reply" && (
                            <>Respondió en <span className="text-slate-900 font-bold">{n.trabajoTitle || "Trabajo"}</span></>
                          )}
                          {n.type === "comment" && (
                            <>Nuevo comentario en <span className="text-slate-900 font-bold">{n.trabajoTitle || "Trabajo"}</span></>
                          )}
                        </p>

                        {n.comentarioTexto && (
                          <div className="mt-2 pl-3 border-l-2 border-slate-200/60 py-0.5">
                            <p className="text-[12px] italic text-slate-500 line-clamp-2 leading-relaxed">
                              &quot;{n.comentarioTexto}&quot;
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              
              {/* Footer (only on mobile) */}
              <div className="md:hidden h-8 bg-white shrink-0" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
