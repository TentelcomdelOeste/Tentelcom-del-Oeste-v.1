import React from 'react';

interface SyncStatusBadgeProps {
  status?: {
    status: 'synced' | 'pending';
    updatedAt: string;
  };
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ status }) => {
  if (!status) return null;

  const colorClass = status.status === 'synced' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  const label = status.status === 'synced' ? 'Sincronizado' : 'Pendiente';

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {label}
    </span>
  );
};
