const CACHE_NAME = 'tictac-job-v13';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// ─── Install ───
// cache: 'reload' bypasses the browser's HTTP cache so we always
// fetch the real latest file from the server, not a stale cached copy.
// This is the root cause of "HTML is new but CSS/JS look old".
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                urlsToCache.map(url => {
                    return fetch(new Request(url, { cache: 'reload' }))
                        .then(response => {
                            if (!response || response.status !== 200) return;
                            return cache.put(url, response);
                        })
                        .catch(() => {}); // don't abort install if an icon is missing
                })
            );
        }).then(() => self.skipWaiting())
    );
});

// ─── Activate ───
// Delete every old cache, claim all clients, then navigate them so
// they reload with the freshly cached files.
// Note: sw.js itself is always fetched from the network by the browser
// (bypasses SW cache), so the new sw.js always runs on activate.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            ))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
            .then(clients => {
                clients.forEach(client => {
                    if (typeof client.navigate === 'function') {
                        client.navigate(client.url);
                    }
                });
            })
    );
});

// ─── Fetch: Network-first, fallback to cache ───
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});