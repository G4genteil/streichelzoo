// Zeichnen und Bewegung.
// Die Seite wird nicht ersetzt, sondern angeglichen (Idiomorph): Eingabefelder behalten Fokus und Text,
// Bilder flackern nicht, und Rollpositionen bleiben. Wo der Browser es kann, gleiten Änderungen (View Transitions).
import { S } from './zustand.js';
import { seite } from './ansichten.js';

const ruhig = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tippt = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };

export function zeichne() {
  const app = document.getElementById('app');
  const ort = [S.phase, S.tab, S.pinFuer || ''].join(':');
  window.Idiomorph.morph(app, seite(), { morphStyle: 'innerHTML', ignoreActiveValue: true });
  if (app.dataset.ort !== ort) { const sc = app.querySelector('.screen'); if (sc) sc.scrollTop = 0; }
  app.dataset.ort = ort;
}

// Zeichnet neu. Liefert ein Versprechen, das erfüllt ist, sobald die Seite den neuen Stand zeigt.
export function render() {
  if (document.startViewTransition && !ruhig() && !tippt()) {
    try {
      const t = document.startViewTransition(zeichne);
      t.ready.catch(() => {});
      t.finished.catch(() => {});
      return t.updateCallbackDone.catch(() => {});
    } catch { /* fällt unten auf das einfache Zeichnen zurück */ }
  }
  zeichne();
  return Promise.resolve();
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
    zug = { y: e.touches[0].clientY, blatt, weg: 0 };
    blatt.style.transition = 'none';
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!zug) return;
    zug.weg = Math.max(0, e.touches[0].clientY - zug.y);
    zug.blatt.style.transform = `translateY(${zug.weg}px)`;
  }, { passive: true });
  const ende = () => {
    if (!zug) return;
    const { blatt, weg } = zug;
    zug = null;
    if (weg > 90) return zu();
    blatt.style.transition = 'transform .32s cubic-bezier(.3,1.3,.4,1)';
    blatt.style.transform = '';
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
