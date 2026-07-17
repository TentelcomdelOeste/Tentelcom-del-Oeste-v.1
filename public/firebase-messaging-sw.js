// Este SW maneja FCM/Push y App Shell (Offline support).
/* global importScripts, firebase */

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 1. CONFIGURACIÓN FIREBASE
firebase.initializeApp({
  apiKey: "AIzaSyBZClYso1SeEnWdqIjlkRPiN0oSQV47JPQ",
  authDomain: "tentelcom-del-oeste.firebaseapp.com",
  projectId: "tentelcom-del-oeste",
  storageBucket: "tentelcom-del-oeste.firebasestorage.app",
  messagingSenderId: "669263702822",
  appId: "1:669263702822:web:0dd30912a8cd4156062fe7"
});

const messaging = firebase.messaging();

// 2. MENSAJERÍA EN SEGUNDO PLANO (FCM)
messaging.onBackgroundMessage((payload) => {
  // Suprimir la notificación automática de Firebase
  // forzando que SIEMPRE sea este handler quien la muestre
  const data = payload.data || {};
  const notif = payload.notification || {};

  // Si no hay data.title ni notif.title, algo está mal — abortar silenciosamente
  const title = data.title || notif.title || 'Tentelcom';
  const body  = data.body  || notif.body  || 'Tienes una nueva notificación';

  // GUARD: nunca mostrar notificación vacía
  if (!title && !body) return;

  const trabajoId      = data.trabajoId      || '';
  const comentarioId   = data.comentarioId   || '';
  const notificationId = data.notificationId || String(Date.now());

  const options = {
    body,
    icon:               '/icon-192x192.png',
    badge:              '/icon-192x192.png',
    vibrate:            [300, 100, 300, 100, 300],
    requireInteraction: true,
    tag:    `telecom-${notificationId}`,
    renotify: true,
    silent:   false,
    sound:    'default',
    data: {
      trabajoId,
      comentarioId,
      notificationId,
      url: trabajoId ? `/bitacora/${trabajoId}` : '/'
    },
    actions: [
      { action: 'view',    title: '📋 Ver mensaje' },
      { action: 'dismiss', title: 'Descartar'      },
    ],
  };

  return self.registration.showNotification(title, options);
});

// 3. CONSOLIDACIÓN DE NOTIFICATION CLICK EVENT (ÚNICO NOTIFICATIONCLICK LISTENER)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  const trabajoId = data.trabajoId || '';
  const comentarioId = data.comentarioId || '';
  
  if (action === 'dismiss') return;

  const targetUrlStr = data.url || (trabajoId ? `/bitacora/${trabajoId}` : '/');
  const targetUrl = new URL(targetUrlStr, self.location.origin);

  // Acción confirmación rápida (Legacy support)
  if (action === 'confirm_action') {
    // We already have targetUrl defined above, but if we want to add 'action=confirm'
    const confirmUrl = new URL(targetUrl.href);
    confirmUrl.searchParams.append('action', 'confirm');

    event.waitUntil(
      self.clients.openWindow(confirmUrl.href)
    );
    return;
  }

  // Comportamiento para 'view', 'view_detail' o clic directo (action === '')
  if (action === 'view_detail' || action === 'view' || action === '') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          // Intentar coincidencia exacta o coincidencia por ID de trabajo en la URL
          for (let client of windowClients) {
            const hasTrabajoId = trabajoId && client.url.includes(trabajoId);
            const isExactMatch = client.url === targetUrl.href;
            if ((isExactMatch || hasTrabajoId) && 'focus' in client) {
              return client.focus();
            }
          }
          // Si hay algún cliente de ventana abierto de la misma app, enfocarlo y navegar a la sección
          for (let client of windowClients) {
            if (client.url.startsWith(self.location.origin) && 'focus' in client) {
              if ('navigate' in client) {
                client.navigate(targetUrl.href);
              }
              return client.focus();
            }
          }
          // Si no hay ninguna ventana abierta, abrir una nueva pestaña
          if (self.clients.openWindow) {
            return self.clients.openWindow(targetUrl.href);
          }
        })
    );
    return;
  }
});

// Native Background Sync event listener
self.addEventListener('sync', (event) => {
  if (event.tag === 'telecom-sync-queue') {
    console.info('[SW-FCM] Background sync tag "telecom-sync-queue" triggered.');
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_SYNC_QUEUE' });
        });
      })
    );
  }
});

// ── App Shell mínimo integrado ──
const CACHE_NAME = 'telecom-cache-v6';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/offline.html',
        '/manifest.json',
        '/favicon.ico',
        '/icon-192x192.png',
        '/icon-512x512.png',
      ]).catch(err => console.warn('[FCM-SW] Shell cache partial fail:', err));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== 'telecom-storage-images-v1')
            .map(k => caches.delete(k))
        )
      )
    ])
  );
});
