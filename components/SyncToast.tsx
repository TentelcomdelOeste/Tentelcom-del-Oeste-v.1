import React, { useState, useEffect } from 'react';

export const SyncToast = ({ message }: { message: string }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      if (message.startsWith('✓')) {
        setTimeout(() => setVisible(false), 3000);
      }
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-xs font-bold animate-in slide-in-from-bottom-4">
      {message}
    </div>
  );
};
