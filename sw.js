const CACHE_NAME = 'tictac-job-v14';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './js/main.js',
    './js/render.js',
    './js/calc.js',
    './js/utils.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.all(urlsToCache.map(url =>
                fetch(new Request(url, { cache: 'reload' }))
                    .then(r => r?.status === 200 ? cache.put(url, r) : null)
                    .catch(() => {})
            ))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            ))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
            .then(clients => clients.forEach(c => c.navigate?.(c.url)))
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request)
            .then(r => {
                if (!r || r.status !== 200 || r.type === 'opaque') return r;
                caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
                return r;
            })
            .catch(() => caches.match(event.request))
    );
});