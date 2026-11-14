// Zeichnen und Bewegung.
// Die Seite wird nicht ersetzt, sondern angeglichen (Idiomorph): Eingabefelder behalten Fokus und Text,
// Bilder flackern nicht, und Rollpositionen bleiben. Wo der Browser es kann, gleiten Änderungen (View Transitions).
import { S } from './zustand.js';
import { seite } from './ansichten.js';
import { TABS } from './hilfen.js';

const ruhig = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tippt = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };

let gezeigt = { phase: '', tab: '' };   // was gerade auf dem Bildschirm steht

export function zeichne() {
  const app = document.getElementById('app');
  const ort = [S.phase, S.tab, S.pinFuer || ''].join(':');
  window.Idiomorph.morph(app, seite(), { morphStyle: 'innerHTML', ignoreActiveValue: true });
  if (app.dataset.ort !== ort) { const sc = app.querySelector('.screen'); if (sc) sc.scrollTop = 0; }
  app.dataset.ort = ort;
  gezeigt = { phase: S.phase, tab: S.tab };
}

// In welche Richtung wechselt die Seite? Daraus macht das CSS die passende Bewegung.
const PHASEN = ['tor', 'neu', 'pin', 'app'];
function richtung() {
  const { phase, tab } = gezeigt;
  if (phase !== S.phase) {
    const a = PHASEN.indexOf(phase), b = PHASEN.indexOf(S.phase);
    if (a < 0 || b < 0) return '';
    if (S.phase === 'app') return 'rein';
    return b > a ? 'vor' : 'zurueck';
  }
  if (S.phase === 'app' && tab !== S.tab) {
    const k = Object.keys(TABS);
    return k.indexOf(S.tab) > k.indexOf(tab) ? 'vor' : 'zurueck';
  }
  return '';
}

// Zeichnet neu. Liefert ein Versprechen, das erfüllt ist, sobald die Seite den neuen Stand zeigt.
let lauf = 0;
export function render() {
  if (document.startViewTransition && !ruhig() && !tippt()) {
    try {
      const nr = ++lauf, zug = richtung(), wurzel = document.documentElement;
      if (zug) wurzel.dataset.zug = zug; else delete wurzel.dataset.zug;
      const t = document.startViewTransition(zeichne);
      t.ready.catch(() => {});
      t.finished.catch(() => {}).then(() => { if (nr === lauf) delete wurzel.dataset.zug; });
      return t.updateCallbackDone.catch(() => {});
    } catch { /* fällt unten auf das einfache Zeichnen zurück */ }
  }
  zeichne();
  return Promise.resolve();
}

// Ein kurzes Tippgefühl. Android kann vibrieren; auf dem iPhone löst ein unsichtbarer Schalter es aus.
let fuehler;
function tick() {
  try {
    if (navigator.vibrate) return void navigator.vibrate(8);
    if (!fuehler) {
      fuehler = document.createElement('label');
      fuehler.style.display = 'none';
      fuehler.setAttribute('aria-hidden', 'true');
      const i = document.createElement('input');
      i.type = 'checkbox'; i.setAttribute('switch', '');
      fuehler.appendChild(i);
      document.head.appendChild(fuehler);
    }
    fuehler.click();
  } catch { /* kein Tippgefühl, dann eben nicht */ }
}
export function fuehlen() {
  document.addEventListener('click', e => {
    const z = e.target.closest && e.target.closest('.tabs button, .schalter button, .haken, .zeile, .woche button, .tasten button');
    if (z && (!z.matches('.zeile') || z.querySelector('.kipp'))) tick();
  });
}

export function geh(o) {
  if (o.tab && o.tab !== S.tab) S.frischTab = Date.now() + 500;
  Object.assign(S, o);
  return render();
}

let uhr;
export function melde(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('an');
  clearTimeout(uhr);
  uhr = setTimeout(() => el.classList.remove('an'), 2600);
}

// Blatt am Griff nach unten ziehen, wie bei iOS.
export function ziehen(zu) {
  let zug = null;
  document.addEventListener('touchstart', e => {
    const g = e.target.closest && e.target.closest('.griff-zone');
    if (!g) return;
    const blatt = g.closest('.blatt');
    const y = e.touches[0].clientY;
    zug = { y, blatt, schleier: blatt.closest('.schleier'), hoch: blatt.offsetHeight || 1, weg: 0, zuletzt: y, zeit: e.timeStamp, tempo: 0 };
    blatt.style.transition = 'none';
    if (zug.schleier) zug.schleier.style.transition = 'none';
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!zug) return;
    const y = e.touches[0].clientY, roh = y - zug.y;
    const dt = e.timeStamp - zug.zeit;
    if (dt > 0) zug.tempo = .7 * (y - zug.zuletzt) / dt + .3 * zug.tempo;   // Pixel je Millisekunde, geglättet
    zug.zuletzt = y; zug.zeit = e.timeStamp;
    zug.weg = roh > 0 ? roh : -Math.sqrt(-roh) * 1.6;                       // nach oben gibt es nur zäh nach
    zug.blatt.style.transform = `translateY(${zug.weg}px)`;
    if (zug.schleier) zug.schleier.style.backgroundColor = `rgba(10,16,13,${(.4 * (1 - Math.min(1, Math.max(0, zug.weg) / zug.hoch))).toFixed(3)})`;
  }, { passive: true });
  const ende = () => {
    if (!zug) return;
    const { blatt, schleier, weg, hoch, tempo } = zug;
    zug = null;
    // Zu, wenn weit genug gezogen oder mit Schwung nach unten geschnippt.
    if (weg > Math.min(160, hoch * .3) || (tempo > .55 && weg > 12)) return zu();
    blatt.style.transition = 'transform .5s cubic-bezier(.2,1.25,.35,1)';
    blatt.style.transform = '';
    if (schleier) { schleier.style.transition = 'background-color .3s'; schleier.style.backgroundColor = ''; }
  };
  document.addEventListener('touchend', ende);
  document.addEventListener('touchcancel', ende);
}

// Wenn die iPhone-Tastatur aufgeht, rückt das Blatt über sie.
export function tastaturBeachten() {
  const vv = window.visualViewport;
  if (!vv) return;
  const setz = () => document.documentElement.style.setProperty('--tast',
    Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px');
  vv.addEventListener('resize', setz);
  vv.addEventListener('scroll', setz);
}
