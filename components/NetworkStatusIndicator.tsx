import React, { useState, useEffect } from 'react';
import { FiLoader } from 'react-icons/fi';

export const NetworkStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<'connected' | 'offline' | 'syncing'>('connected');

  useEffect(() => {
    const handleOnline = () => {
      setStatus('syncing');
      setTimeout(() => setStatus('connected'), 3000);
    };
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setStatus(navigator.onLine ? 'connected' : 'offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (status === 'connected' || status === 'offline') return null;

  return (
    <div className={`fixed bottom-4 right-4 z-[60] px-3 py-2 rounded-full shadow-lg flex items-center gap-2 bg-amber-400 text-amber-950 transition-all uppercase tracking-wider text-[10px] font-bold`}>
      <FiLoader className="text-sm animate-spin" />
      <span>Sincronizando cambios...</span>
    </div>
  );
};
