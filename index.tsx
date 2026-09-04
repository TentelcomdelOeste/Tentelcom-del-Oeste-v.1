import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { UserProvider } from './contexts/UserContext';
import ErrorBoundary from './core/ErrorBoundary';
import { ConfirmProvider } from './design-system';
import { BrowserRouter } from 'react-router-dom';

async function bootstrap() {

  // Registrar SW unificado (FCM + App Shell) para soporte offline y notificaciones
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    }).then(registration => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] Nueva versión instalada y lista para activarse.');
            }
          });
        }
      });
    }).catch(err => {
      console.error('[App] SW registration failed:', err);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[SW] Controlador actualizado. El nuevo SW ha tomado el control.');
        // Se comenta window.location.reload() para evitar parpadeos blancos durante el arranque.
        // window.location.reload();
      }
    });
  }

  window.addEventListener('vite:preloadError', () => {
    console.warn('Vite preload error. Reloading page...');
    window.location.reload();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.message?.includes('Failed to fetch dynamically imported module')) {
      console.warn('Dynamic import error caught. Reloading page...');
      window.location.reload();
      return;
    }
    (window as any).__LAST_ERROR__ = {
      message: (event.reason as any)?.message || JSON.stringify(event.reason),
      stack: (event.reason as any)?.stack || null
    };
  });

  window.onerror = (msg, url, line, col, error) => {
    console.error("GLOBAL ERROR (PRE-MOUNT):", msg, "at", url, ":", line, col, error);
    return false;
  };

  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <UserProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ConfirmProvider>
        </UserProvider>
      </ErrorBoundary>
    );
  } else {
    console.error("❌ [BOOT] Root element NOT FOUND!");
  }
}

bootstrap();
