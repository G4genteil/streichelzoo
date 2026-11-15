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
      let gezeichnet = false;
      const t = document.startViewTransition(() => { gezeichnet = true; zeichne(); });
      // Malt der Browser gerade keine Bilder (App im Hintergrund), käme der Übergang nie dran: dann ohne ihn.
      setTimeout(() => { if (!gezeichnet) { try { t.skipTransition(); } catch { /* schon vorbei */ } } }, 350);
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

// Kurzmeldung am unteren Rand. Mit { zurueck } bekommt sie für ein paar Sekunden den Knopf „Rückgängig".
let uhr;
export function melde(text, { zurueck } = {}) {
  const el = document.getElementById('toast');
  const satz = document.createElement('span');
  satz.textContent = text;
  el.replaceChildren(satz);
  if (zurueck) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = 'Rückgängig';
    knopf.onclick = () => { clearTimeout(uhr); el.classList.remove('an'); zurueck(); };
    el.appendChild(knopf);
  }
  el.classList.toggle('mit', !!zurueck);
  el.classList.add('an');
  clearTimeout(uhr);
  uhr = setTimeout(() => el.classList.remove('an'), zurueck ? 5500 : 2600);
}

// Konfetti aus zwei Kanonen links und rechts. Malt auf eine eigene Fläche über der App und räumt sich selbst weg.
export function konfetti(farben) {
  const rahmen = document.querySelector('.phone');
  if (!rahmen || ruhig()) return;
  const flaeche = document.createElement('canvas');
  flaeche.className = 'konfetti';
  rahmen.appendChild(flaeche);
  const b = rahmen.clientWidth, h = rahmen.clientHeight, dichte = Math.min(window.devicePixelRatio || 1, 2);
  flaeche.width = b * dichte; flaeche.height = h * dichte;
  const stift = flaeche.getContext('2d');
  stift.scale(dichte, dichte);
  const zufall = (von, bis) => von + Math.random() * (bis - von);
  const teile = Array.from({ length: 130 }, (_, i) => {
    const links = i % 2 === 0, winkel = (links ? -1.05 : -2.09) + zufall(-.42, .42), tempo = zufall(9, 21);
    return { x: links ? -8 : b + 8, y: h * zufall(.5, .66), vx: Math.cos(winkel) * tempo, vy: Math.sin(winkel) * tempo,
      gr: zufall(6, 11), farbe: farben[i % farben.length], dreh: zufall(0, 6.3), vdreh: zufall(-.25, .25),
      kipp: zufall(0, 6.3), vkipp: zufall(.12, .3), rund: i % 4 === 0, start: zufall(0, 140) };
  });
  const beginn = performance.now();
  let zuletzt = beginn;
  const bild = jetzt => {
    const alter = jetzt - beginn, dt = Math.min(2.2, (jetzt - zuletzt) / 16.7);
    zuletzt = jetzt;
    stift.clearRect(0, 0, b, h);
    stift.globalAlpha = Math.max(0, Math.min(1, (3400 - alter) / 700));
    for (const t of teile) {
      if (alter < t.start) continue;
      t.vy += .34 * dt; t.vx *= Math.pow(.985, dt); t.vy *= Math.pow(.99, dt);
      t.x += t.vx * dt + Math.sin(t.kipp) * .6; t.y += t.vy * dt;
      t.dreh += t.vdreh * dt; t.kipp += t.vkipp * dt;
      stift.save();
      stift.translate(t.x, t.y); stift.rotate(t.dreh); stift.scale(1, Math.cos(t.kipp));
      stift.fillStyle = t.farbe;
      if (t.rund) { stift.beginPath(); stift.arc(0, 0, t.gr / 2, 0, 6.3); stift.fill(); }
      else stift.fillRect(-t.gr / 2, -t.gr / 3, t.gr, t.gr / 1.5);
      stift.restore();
    }
    if (alter < 3400) requestAnimationFrame(bild); else flaeche.remove();
  };
  requestAnimationFrame(bild);
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
