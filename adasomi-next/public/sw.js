// Adasomi service worker
// Conservative strategy: never cache API/server-action responses or dynamic
// HTML (auth/session data means the "right" page differs per user), only
// cache static assets and provide an offline fallback for navigation.

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `adasomi-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/images/logo.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((key) => key.startsWith('adasomi-') && key !== STATIC_CACHE).map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only ever intercept same-origin GET requests.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Never touch API routes or Next.js server-action/data traffic.
    if (url.pathname.startsWith('/api')) return;

    // Page navigations: go to the network first (so logged-in users always
    // see fresh, correctly-authorized content). Only fall back to the cached
    // offline page if the network is unreachable.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.open(STATIC_CACHE).then((cache) => cache.match(OFFLINE_URL)))
        );
        return;
    }

    const isStaticAsset =
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icons/') ||
        url.pathname.startsWith('/images/') ||
        url.pathname.startsWith('/css/') ||
        /\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|css)$/.test(url.pathname);

    if (isStaticAsset) {
        event.respondWith(
            caches.open(STATIC_CACHE).then((cache) =>
                cache.match(request).then((cached) => {
                    if (cached) return cached;
                    return fetch(request).then((response) => {
                        if (response && response.ok) cache.put(request, response.clone());
                        return response;
                    });
                })
            )
        );
    }
    // Everything else (fonts/CDN, RSC payloads, etc.): let the browser handle it normally.
});
