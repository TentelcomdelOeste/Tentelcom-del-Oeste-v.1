import { useEffect } from 'react';
import { precacheModules } from '../services/modulePrecacheService';

export function useModulePreloader(isAuthenticated: boolean): void {
    useEffect(() => {
        // Solo precargar si el usuario está autenticado
        if (!isAuthenticated) return;

        let handle: number;
        // Esperar a que la UI principal esté pintada y el navegador esté en estado idle
        // antes de iniciar la precarga en segundo plano
        if ('requestIdleCallback' in window) {
            handle = (window as any).requestIdleCallback(() => {
                precacheModules().catch(err => {
                    console.warn('[Preloader] Module prefetch failed:', err);
                });
            }, { timeout: 5000 });
        } else {
            handle = window.setTimeout(() => {
                precacheModules().catch(err => {
                    console.warn('[Preloader] Module prefetch failed:', err);
                });
            }, 100);
        }

        return () => {
            if ('cancelIdleCallback' in window && handle) {
                (window as any).cancelIdleCallback(handle);
            } else if (handle) {
                clearTimeout(handle);
            }
        };
    }, [isAuthenticated]);
}
