import React from 'react';
import { MentionRenderer } from './MentionRenderer';

interface Token {
  type: 'text' | 'link';
  text: string;
  url?: string;
}

interface LinkMetadata {
  url: string;
  type: 'youtube' | 'drive' | 'aistudio' | 'firebase' | 'pdf' | 'image' | 'generic';
  title: string;
  domain: string;
  description: string;
  thumbnailUrl?: string;
}


// Custom Premium inline SVGs for compile safety across all package versions
export const YoutubeIcon = () => (
  <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.519 3.5 12 3.5 12 3.5s-7.519 0-9.388.553a3.002 3.002 0 00-2.11 2.11C0 8.03 0 12 0 12s0 3.97.49 5.837a3.002 3.002 0 002.11 2.11c1.88.553 9.388.553 9.388.553s7.519 0 9.388-.553a3.003 3.003 0 002.11-2.11C24 15.97 24 12 24 12s0-3.97-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const DriveIcon = () => (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 0M7 7h10" />
  </svg>
);

export const SparklesIcon = () => (
  <svg className="w-4 h-4 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

export const FirebaseIcon = () => (
  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

export const PdfIcon = () => (
  <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h1.5m1 0H13m-3 4h2.5m-2.5 4h3" />
  </svg>
);

export const ImageIcon = () => (
  <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const GlobeIcon = () => (
  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

export const ExternalLinkIcon = () => (
  <svg className="w-3 h-3 ml-0.5 inline-block opacity-80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// 1. Core tokenizer to extract links and preserve correct spacing and trailing punctuation
export function parseMessageText(text: string): Token[] {
  if (!text) return [];

  // Robust URL detection pattern supporting http, https, www, subdomains and query fields
  const rawRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(rawRegex);
  if (parts.length <= 1) {
    return [{ type: 'text', text }];
  }

  const tokens: Token[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // Is it a matched URL (alternate indices due to single-group captured split)
    const isUrl = i % 2 === 1;
    if (isUrl) {
      let cleanUrl = part;
      let trailingPunc = '';

      // Clean up common trailing punctuation or symbols that are part of text sentences
      const trailingPuncMatch = part.match(/([.,;:!?)]+)$/);
      if (trailingPuncMatch) {
        trailingPunc = trailingPuncMatch[1];
        cleanUrl = part.slice(0, -trailingPunc.length);
      }

      const href = cleanUrl.toLowerCase().startsWith('www.')
        ? `https://${cleanUrl}`
        : cleanUrl;

      tokens.push({
        type: 'link',
        text: cleanUrl,
        url: href,
      });

      if (trailingPunc) {
        tokens.push({
          type: 'text',
          text: trailingPunc,
        });
      }
    } else {
      tokens.push({
        type: 'text',
        text: part,
      });
    }
  }

  return tokens;
}

// 2. Metadata extractor for the premium smart link previews
export function getLinkMetadata(url: string): LinkMetadata {
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    hostname = url;
  }

  const cleanDomain = hostname.replace('www.', '');
  const urlLower = url.toLowerCase();

  // YouTube match checks
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      url,
      type: 'youtube',
      title: 'Contenido de YouTube',
      domain: cleanDomain,
      description: 'Vídeo enlazado de YouTube. Toque para ver el contenido directamente.',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  }

  // Google Drive checks
  if (urlLower.includes('drive.google.com')) {
    return {
      url,
      type: 'drive',
      title: 'Archivo Compartido Drive',
      domain: cleanDomain,
      description: 'Carpeta o documento seguro guardado en Google Drive.',
    };
  }

  // AI Studio checks
  if (urlLower.includes('aistudio.google.com')) {
    return {
      url,
      type: 'aistudio',
      title: 'Google AI Studio Resource',
      domain: cleanDomain,
      description: 'Espacio de trabajo o API de pruebas de modelos generativos Gemini.',
    };
  }

  // Firebase/Google Cloud Cloud Storage checks
  if (urlLower.includes('firebase') || urlLower.includes('firebasestorage.googleapis.com')) {
    return {
      url,
      type: 'firebase',
      title: 'Consola / Servidor Firebase',
      domain: cleanDomain,
      description: 'Instancia en la nube de Firebase. Almacenamiento seguro de activos.',
    };
  }

  // PDF check
  if (urlLower.match(/\.pdf(\?|$)/)) {
    return {
      url,
      type: 'pdf',
      title: 'Documento PDF Digital',
      domain: cleanDomain,
      description: 'Documento en formato de lectura PDF. Presione para visualizar.',
    };
  }

  // Remote image url check
  if (urlLower.match(/\.(png|jpe?g|gif|webp|svg|heic|heif)(\?|$)/)) {
    return {
      url,
      type: 'image',
      title: 'Activo de Imagen Externo',
      domain: cleanDomain,
      description: 'Enlace de imagen remota. Haz clic para ampliar y ver los detalles.',
      thumbnailUrl: url,
    };
  }

  // Generic link
  const domainParts = cleanDomain.split('.');
  const brandName = domainParts[0]
    ? domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1)
    : 'Portal Externo';

  return {
    url,
    type: 'generic',
    title: brandName,
    domain: cleanDomain,
    description: 'Enlace de navegación web seguro. Toque para abrir una nueva pestaña.',
  };
}

// 3. Icon selection helper
function renderMetaIcon(type: string) {
  switch (type) {
    case 'youtube':
      return <YoutubeIcon />;
    case 'drive':
      return <DriveIcon />;
    case 'aistudio':
      return <SparklesIcon />;
    case 'firebase':
      return <FirebaseIcon />;
    case 'pdf':
      return <PdfIcon />;
    case 'image':
      return <ImageIcon />;
    default:
      return <GlobeIcon />;
  }
}

interface MessageLinkRendererProps {
  mensaje: string;
  isMe: boolean;
  mentions?: { userId: string; userName: string; email?: string }[];
  onMentionClick?: (userId: string) => void;
}

export const MessageLinkRenderer = ({
  mensaje,
  isMe,
  mentions = [],
  onMentionClick,
}: MessageLinkRendererProps) => {
  if (!mensaje) return null;

  const tokens = parseMessageText(mensaje);
  const linksFound = tokens.filter(t => t.type === 'link');

  // Find the first URL to generate the Smart Preview card
  const firstLink = linksFound[0];
  const meta = firstLink ? getLinkMetadata(firstLink.url!) : null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* 1. Styled text body with integrated, wrapped external links */}
      <div className="leading-relaxed select-text font-medium text-[12px] md:text-sm">
        {tokens.map((token, index) => {
          if (token.type === 'link') {
            return (
              <a
                key={index}
                href={token.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`font-bold underline transition-all break-all inline-flex items-center gap-0.5 ${
                  isMe
                    ? 'text-cyan-200 hover:text-cyan-100'
                    : 'text-blue-600 hover:text-blue-800'
                }`}
                style={{ overflowWrap: 'anywhere' }}
              >
                {token.text}
                <ExternalLinkIcon />
              </a>
            );
          }
          return (
            <MentionRenderer
              key={index}
              mensaje={token.text}
              isMe={isMe}
              mentions={mentions}
              onMentionClick={onMentionClick}
            />
          );
        })}
      </div>

      {/* 2. Advanced Smart Link Preview Card container */}
      {meta && (
        <a
          href={meta.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`mt-1 flex items-start gap-3 p-2.5 rounded-xl border select-none transition-all hover:scale-[1.01] overflow-hidden max-w-sm cursor-pointer ${
            isMe
              ? 'bg-blue-700/50 hover:bg-blue-700/70 border-blue-500/30 text-white'
              : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/80 text-slate-700'
          }`}
        >
          {meta.thumbnailUrl ? (
            <img
              src={meta.thumbnailUrl}
              alt="Miniature link preview"
              className="w-12 h-12 rounded-lg object-cover border border-slate-300/40 shrink-0 shadow-2xs"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                isMe
                  ? 'bg-blue-600/50 border-blue-500/20'
                  : 'bg-slate-100 border-slate-200/60'
              }`}
            >
              {renderMetaIcon(meta.type)}
            </div>
          )}

          <div className="flex flex-col min-w-0 flex-1">
            <span
              className={`font-bold text-[11px] truncate leading-tight uppercase tracking-wider ${
                isMe ? 'text-cyan-100' : 'text-blue-600'
              }`}
            >
              {meta.title}
            </span>
            
            <p
              className={`text-[10px] leading-snug mt-0.5 line-clamp-2 ${
                isMe ? 'text-blue-100' : 'text-slate-500'
              }`}
            >
              {meta.description}
            </p>

            <span
              className={`text-[8.5px] font-bold tracking-tight mt-1 font-mono truncate uppercase ${
                isMe ? 'text-blue-300/80' : 'text-slate-400'
              }`}
            >
              {meta.domain}
            </span>
          </div>
        </a>
      )}
    </div>
  );
};
