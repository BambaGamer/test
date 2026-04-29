self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // מאפשר לקבצי האודיו לעבור גם כשהמסך נעול
    event.respondWith(fetch(event.request));
});