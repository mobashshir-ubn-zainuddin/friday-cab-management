// Minimal service worker: makes the site installable as an app.
// It deliberately caches nothing, so users always get the latest app and live data
// (no stale bookings, payments or login state). It only shows a friendly page when offline.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Friday Cab</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif;text-align:center;padding:16px}
button{margin-top:16px;background:#059669;color:#fff;border:0;border-radius:8px;padding:10px 20px;font-size:16px}</style>
</head><body><div><h1>You're offline</h1><p>Friday Cab needs an internet connection.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  );
});
