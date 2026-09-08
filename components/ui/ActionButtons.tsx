import React from 'react';
import { IconButton, ACTION_ICONS } from '../../design-system';
import { ClipboardList, Clipboard } from 'lucide-react';

interface ActionButtonsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onPdf?: () => void;
  onAttachments?: () => void;
  onTimeline?: () => void;
  onCopy?: () => void;
  
  editTitle?: string;
  deleteTitle?: string;
  viewTitle?: string;
  approveTitle?: string;
  rejectTitle?: string;
  pdfTitle?: string;
  attachmentsTitle?: string;
  timelineTitle?: string;
  copyTitle?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onEdit,
  onDelete,
  onView,
  onApprove,
  onReject,
  onPdf,
  onAttachments,
  onTimeline,
  onCopy,
  editTitle = "Editar",
  deleteTitle = "Eliminar",
  viewTitle = "Ver Detalle",
  approveTitle = "Aprobar",
  rejectTitle = "Rechazar",
  pdfTitle = "Descargar PDF",
  attachmentsTitle = "Gestionar Archivos",
  timelineTitle = "Bitácora Operativa",
  copyTitle = "Copiar información",
}) => {
  return (
    <div className="flex justify-center gap-2 items-center" onClick={(e) => e.stopPropagation()}>
      {onCopy && (
        <IconButton 
          icon={<Clipboard size={16} />} 
          onClick={onCopy} 
          variant="neutral" 
          title={copyTitle} 
        />
      )}
      {onPdf && (
        <IconButton 
          icon={<ACTION_ICONS.pdf />} 
          onClick={onPdf} 
          variant="danger" 
          title={pdfTitle} 
        />
      )}

      {onAttachments && (
        <IconButton 
          icon={<ACTION_ICONS.files />} 
          onClick={onAttachments} 
          variant="warning" 
          title={attachmentsTitle} 
        />
      )}

      {onTimeline && (
        <IconButton
          icon={<ClipboardList size={16} />}
          onClick={onTimeline}
          variant="neutral"
          title={timelineTitle}
          className="text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200"
        />
      )}
      
      {onView && (
        <IconButton 
          icon={<ACTION_ICONS.view />} 
          onClick={onView} 
          variant="primary" 
          title={viewTitle} 
        />
      )}

      {onEdit && (
        <IconButton 
          icon={<ACTION_ICONS.edit />} 
          onClick={onEdit} 
          variant="primary" 
          title={editTitle} 
        />
      )}

      {onApprove && (
        <IconButton 
          icon={<ACTION_ICONS.approve />} 
          onClick={onApprove} 
          variant="success" 
          title={approveTitle} 
        />
      )}

      {onReject && (
        <IconButton 
          icon={<ACTION_ICONS.reject />} 
          onClick={onReject} 
          variant="danger" 
          title={rejectTitle} 
        />
      )}

      {onDelete && (
        <IconButton 
          icon={<ACTION_ICONS.delete />} 
          onClick={onDelete} 
          variant="danger" 
          title={deleteTitle} 
        />
      )}
    </div>
  );
};