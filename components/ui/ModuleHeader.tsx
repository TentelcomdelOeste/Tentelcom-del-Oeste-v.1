
import React, { ReactNode } from 'react';

interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({ title, subtitle, rightContent }) => {
  return (
    <div className="flex flex-row justify-between items-center mb-4 pb-3 border-b border-slate-100 gap-4">
      <div className="w-full">
        <h1 className="text-xl md:text-2xl font-black text-blue-950 uppercase tracking-tight leading-tight text-left">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm font-bold text-slate-500 mt-1 text-left">{subtitle}</p>}
      </div>
      {rightContent && (
        <div className="flex flex-row gap-2 items-center w-auto">
          {rightContent}
        </div>
      )}
    </div>
  );
};
