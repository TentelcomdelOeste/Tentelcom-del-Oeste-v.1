
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';

interface ConfirmOptions {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{
    show: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    show: false,
    options: { title: '', description: '' },
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        show: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleClose = () => {
    if (state.resolve) state.resolve(false);
    setState((prev) => ({ ...prev, show: false, resolve: null }));
  };

  const handleConfirm = () => {
    if (state.resolve) state.resolve(true);
    setState((prev) => ({ ...prev, show: false, resolve: null }));
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        show={state.show}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={state.options.title}
        description={state.options.description}
        confirmLabel={state.options.confirmLabel}
        variant={state.options.variant}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used within ConfirmProvider");
  return context.confirm;
};
