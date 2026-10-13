// Service Worker SIVT AI
const CACHE_NAME = 'sivt-ai-v4';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

// Install: cache aset dasar
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => {
                console.warn('[SW] Gagal cache beberapa aset:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first untuk HTML & JS, cache-first untuk aset statis
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip API
    if (url.pathname.startsWith('/api/')) return;

    // Skip CDN eksternal
    if (url.origin !== self.location.origin) return;

    // Skip uploads
    if (url.pathname.startsWith('/uploads/')) return;

    const isHTML = url.pathname === '/' || url.pathname.endsWith('.html');
    const isJS = url.pathname.endsWith('.js');
    const isCSS = url.pathname.endsWith('.css');

    // ✅ NETWORK-FIRST untuk HTML, JS, CSS (biar update langsung kelihatan)
    if (isHTML || isJS || isCSS) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // ✅ CACHE-FIRST untuk aset statis (gambar, font, dll)
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            });
        })
    );
});