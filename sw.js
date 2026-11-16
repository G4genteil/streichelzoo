// Service Worker: hält die App-Dateien bereit, damit sie auch bei schlechtem Netz startet.
// Regel: erst das Netz fragen (so kommen Updates sofort an), nach 3 Sekunden oder ohne Netz den gemerkten Stand nehmen.
// Daten von Supabase laufen nicht hierüber. Bei jeder Änderung an der Dateiliste VERSION hochzählen.
const VERSION = 'zoo-8';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/kern.js', 'js/zustand.js', 'js/hilfen.js', 'js/ansichten.js', 'js/aktionen.js', 'js/backend.js', 'js/demo.js', 'js/config.js',
  'vendor/idiomorph.js', 'vendor/supabase.js', 'icons/logo.webp', 'icons/joker.webp', 'icons/apple-touch-icon.png', 'icons/icon-192.png',
  'klang/haken.mp3', 'klang/fertig.mp3', 'klang/muenze.mp3', 'klang/joker.mp3', 'klang/sieg.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(alle => Promise.all(alle.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const gemerkt = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'));
  const netz = fetch(e.request).then(antwort => {
    if (antwort.ok) { const kopie = antwort.clone(); caches.open(VERSION).then(c => c.put(e.request, kopie)); }
    return antwort;
  });
  const zuLangsam = new Promise(fertig => setTimeout(fertig, 3000)).then(() => gemerkt().then(r => r || netz));
  e.respondWith(Promise.race([netz.catch(gemerkt), zuLangsam]));
});

// ---------- Push: Nachricht anzeigen, beim Antippen die App öffnen
self.addEventListener('push', e => {
  let n = {};
  try { n = e.data ? e.data.json() : {}; } catch { n = { titel: 'Streichelzoo', inhalt: e.data ? e.data.text() : '' }; }
  const zeigen = self.registration.showNotification(n.titel || 'Streichelzoo', {
    body: n.inhalt || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { ziel: n.ziel || '', art: n.art || '' },
  });
  // Die Zahl am App-Symbol: so viele Aufgaben sind offen (bei Eltern: plus was auf Bestätigung wartet).
  let zahl = Promise.resolve();
  if (typeof n.zahl === 'number' && 'setAppBadge' in self.navigator) {
    zahl = (n.zahl > 0 ? self.navigator.setAppBadge(n.zahl) : self.navigator.clearAppBadge()).catch(() => {});
  }
  e.waitUntil(Promise.all([zeigen, zahl]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(offen => {
    const da = offen.find(c => c.url.startsWith(self.registration.scope));
    if (da) { da.postMessage({ zoo: 'ziel', ziel: d.ziel, art: d.art }); return da.focus(); }
    return self.clients.openWindow(`${self.registration.scope}?zu=${encodeURIComponent(d.ziel || '')}&art=${encodeURIComponent(d.art || '')}`);
  }));
});
