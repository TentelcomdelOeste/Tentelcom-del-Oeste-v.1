const isDebug = import.meta.env.DEV;
const isVerbose = typeof window !== 'undefined' && (localStorage.getItem('DEBUG_VERBOSE') === 'true');
const isDiagnosticMode = typeof window !== 'undefined' && (window as any).__DISABLE_NON_CRITICAL_LOGS__ === true;
import { maskObject } from './masking';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3,
  CRITICAL = 4
}

// Global logger wrapper allowing custom developer levels
export const logger = {
  log: (...args: any[]) => {
    if (isDebug && !isDiagnosticMode) {
      console.log('[LOG]', ...args.map(maskObject));
    }
  },
  debug: (...args: any[]) => {
    if (isDebug && isVerbose && !isDiagnosticMode) {
      console.debug('[DEBUG]', ...args.map(maskObject));
    }
  },
  info: (...args: any[]) => {
    if (isDebug && !isDiagnosticMode) {
      console.info('[INFO]', ...args.map(maskObject));
    }
  },
  warn: (...args: any[]) => {
    // Only warn when a condition requires technical attention
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
    if (message.includes('[QUOTE CONFLICT]')) {
      // Omit soft conflict notes that are resolved natively without data risk
      return;
    }
    console.warn('[WARNING]', ...args.map(maskObject));
  },
  error: (...args: any[]) => {
    // ERROR level: Must represent actual technical failures or exceptions
    console.error('[ERROR]', ...args.map(maskObject));
  },
  critical: (...args: any[]) => {
    // CRITICAL level: High impact technical failures (auth blocks, network failure, local persistence limits)
    console.error('🔥 [CRITICAL]', ...args.map(maskObject));
  }
};

// Global interceptors for production transparency and normalization
if (typeof window !== 'undefined') {
  if (!isDebug || isDiagnosticMode) {
    // Prevent console pollution from direct un-encapsulated console calls in production or diagnostic mode
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};

    if (!isDebug) {
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => {
          const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
          
          // Filter out non-technical warnings that do not indicate functional failures
          if (
            message.includes('[QUOTE CONFLICT]') ||
            message.includes('pre-existing') || 
            message.includes('HMR') ||
            message.includes('WebSocket') ||
            message.includes('preload')
          ) {
            return;
          }
          
          // Allow warnings that represent real conditions requiring technical attention
          originalWarn('[WARNING]', ...args.map(maskObject));
        };
    }
  } else {
    // In development mode, filter out annoying non-actionable warning noise cleanly
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
      if (message.includes('[QUOTE CONFLICT]')) {
        return;
      }
      originalWarn(...args);
    };
  }
}

