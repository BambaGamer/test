self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/song/')) {
        const id = url.pathname.split('/').pop();

        event.respondWith((async () => {
            const clients = await self.clients.matchAll();
            const client = clients[0];

            const blob = await new Promise(resolve => {
                const channel = new MessageChannel();
                channel.port1.onmessage = e => resolve(e.data);
                client.postMessage({ type: 'GET_SONG', id }, [channel.port2]);
            });

            return new Response(blob, {
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'no-store'
                }
            });
        })());
    }
});

