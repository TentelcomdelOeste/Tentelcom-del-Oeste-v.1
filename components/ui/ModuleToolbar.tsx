import React, { ReactNode } from 'react';

interface ModuleToolbarProps {
  children: ReactNode;
}

export const ModuleToolbar: React.FC<ModuleToolbarProps> = ({ children }) => {
  return (
    <div className="
      flex 
      flex-col 
      md:flex-row
      md:items-center
      md:justify-between
      gap-4
      w-full
      mb-3
    ">
      {children}
    </div>
  );
};