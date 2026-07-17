// Definiciones manuales para características específicas de Vite (como import.meta.glob)
// Esto asegura que TypeScript no arroje errores si 'vite/client' no está cargado correctamente.

interface ImportMeta {
  readonly glob: <T = Record<string, any>>(
    pattern: string | string[],
    options?: {
      eager?: boolean;
      import?: string;
      query?: string | Record<string, string | number | boolean>;
      as?: string;
    }
  ) => T;
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  [key: string]: any;
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  // Variables de EmailJS
  readonly VITE_EMAILJS_SERVICE_ID: string;
  readonly VITE_EMAILJS_TEMPLATE_ID: string;
  readonly VITE_EMAILJS_PUBLIC_KEY: string;
}

// Variable global inyectada en tiempo de build para versionado de caché
declare const __BUILD_VERSION__: string;

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';