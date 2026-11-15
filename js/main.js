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
if ('serviceWorker' in navigator && !S.demo) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
