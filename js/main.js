// Startpunkt. Mit ?demo in der Adresse läuft alles nur im Speicher (demo.js), sonst gegen Supabase.
import { S } from './zustand.js';
import { ziehen, tastaturBeachten, fuehlen } from './kern.js';
import { A, starte, oeffne } from './aktionen.js';
import { supabaseBackend } from './backend.js';
import { demoBackend } from './demo.js';
import { SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC } from './config.js';

window.A = A;
S.demo = new URLSearchParams(location.search).has('demo');
const B = S.demo ? demoBackend() : supabaseBackend(window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY), SUPABASE_URL);
S.bildUrl = B.bildUrl;
ziehen(() => A.zu());
tastaturBeachten();
fuehlen();
// Kam die App über eine angetippte Push-Nachricht auf? Dann steht das Ziel in der Adresse (siehe sw.js).
const frage = new URLSearchParams(location.search);
if (frage.has('zu') || frage.has('art')) {
  oeffne(frage.get('zu') || '', frage.get('art') || '');
  frage.delete('zu'); frage.delete('art');
  history.replaceState(null, '', location.pathname + (frage.size ? '?' + frage : ''));
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.zoo === 'ziel') oeffne(e.data.ziel || '', e.data.art || ''); });
}
starte(B, VAPID_PUBLIC);

// Offline-Start. Nicht in der Demo, damit beim Ausprobieren nichts Altes hängen bleibt.
if ('serviceWorker' in navigator && !S.demo) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(reg => {
    // Auf dem iPhone wird die App selten wirklich neu gestartet, sie kommt meist aus dem Hintergrund zurück.
    // Dann nach einer neuen Version schauen.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {}));
  // Eine neue Version hat übernommen: einmal neu laden, damit alle Dateien zusammenpassen.
  // Ist gerade ein Blatt offen (z. B. ein Entwurf), warten wir, bis die App im Hintergrund ist.
  if (navigator.serviceWorker.controller) {
    let neuGeladen = false;
    const neuLaden = () => { if (!neuGeladen) { neuGeladen = true; location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!S.sheet) return neuLaden();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') neuLaden(); });
    });
  }
}
