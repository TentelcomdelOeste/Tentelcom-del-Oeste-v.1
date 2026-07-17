
import React from 'react';
import { FaFilePdf } from 'react-icons/fa';
import { Quote } from './types';
import { generateQuotePDF } from './utils/pdfGenerator';
import { triggerFileDownload } from './utils/fileUtils';
import { IconButton } from '@/design-system';

interface PdfButtonProps {
  quote: Quote;
}

const PdfButton: React.FC<PdfButtonProps> = ({ quote }) => {
  return (
    <IconButton 
      onClick={async () => {
        const { fileBlob, fileName } = await generateQuotePDF(quote);
        triggerFileDownload(fileBlob, fileName);
      }} 
      icon={<FaFilePdf className="text-xl" />}
      variant="danger"
      title="Descargar PDF"
    />
  );
};

export default PdfButton;
