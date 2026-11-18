// Alles, was beim Antippen passiert. Die Ansichten rufen diese Funktionen über A.name(...) auf.
// Muster: erst die Anzeige sofort anpassen ("lokal"), dann den Server fragen, dann den echten Stand nachladen.
// Lehnt der Server ab, zeigt das Nachladen wieder die Wahrheit.
import { S, P, ich, eltern, leer, runde, buendeln, darfPruefen, andereEltern } from './zustand.js';
import { render, zeichne, geh, melde, konfetti, klang, toeneAn, toeneSetzen } from './kern.js';
import { termineAm, feierPlan } from './ansichten.js';
import { esc, heute, plus, iso, euro, centAus, PUNKTE, TIERE, FARBEN, wert, aufzaehlen, MAX_FOTOS, fotosVon, KREUZ } from './hilfen.js';
import { ZOO_TIERE } from './zoo_katalog.js';

export const A = {};
let B = null;                      // die Verbindung (backend.js oder demo.js)
let gestartet = false;             // hat B.start() schon einmal geklappt?
let zuletzt = 0, ladeNr = 0, uhrLive = 0;
let VAPID = '';
let bereit = false;                // sind die Daten nach dem Anmelden einmal frisch geladen?
let offenesZiel = null;            // wohin eine angetippte Push-Nachricht führen soll, sobald die Daten da sind

// ------------------------------------------------------------ Merken auf dem Gerät

const lager = {
  lies: k => { try { return localStorage.getItem(k); } catch { return null; } },
  setz: (k, v) => { try { localStorage.setItem(k, v); } catch { /* voll oder gesperrt: dann eben nicht */ } },
  weg: k => { try { localStorage.removeItem(k); } catch { /* egal */ } },
};
const merkeStand = () => { if (!B.demo && S.merken && S.ich) lager.setz('zoo_stand', JSON.stringify({ ich: S.ich, d: S.d })); };
const liesStand = () => { try { return JSON.parse(lager.lies('zoo_stand')); } catch { return null; } };

// ------------------------------------------------------------ Laden und Speichern

async function laden() {
  if (S.phase !== 'app') return;
  const nr = ++ladeNr;
  let d;
  try { d = await B.laden(); }
  catch (e) {
    if (nr === ladeNr && S.ladeFehler !== e.message) { S.ladeFehler = e.message; render(); }
    return;
  }
  if (nr !== ladeNr || S.phase !== 'app') return;      // inzwischen läuft ein neueres Laden
  zuletzt = Date.now();
  if (!d.mitglieder.some(m => m.id === S.ich)) {
    const wer = await B.wer().catch(() => S.ich);
    if (!wer) return raus('Bitte melde dich noch einmal an');   // z. B. hat ein Elternteil den Code neu gesetzt
  }
  for (const w of wartend.values()) d[w.liste] = d[w.liste].filter(x => !w.ids.includes(x.id));   // was gerade gelöscht wird, bleibt weg
  hakenAuflegen(d);                                  // was ohne Netz abgehakt wurde, bleibt abgehakt
  const roh = JSON.stringify(d), hatteFehler = !!S.ladeFehler;
  S.ladeFehler = '';
  if (roh !== S.roh || hatteFehler) {
    S.roh = roh; S.d = d; S.profile = d.mitglieder;
    merkeStand();
    symbol();
    render();
  }
  feierPruefen();
}

async function tun(ruf, { lokal, ok, zu, zurueck } = {}) {
  if (lokal) { lokal(); S.roh = ''; symbol(); }
  if (zu) S.sheet = null;
  if (lokal || zu) render();
  try {
    const ergebnis = await ruf();
    if (ok) melde(typeof ok === 'function' ? ok(ergebnis) : ok, { zurueck });
    await laden();
    return true;
  } catch (e) {
    melde(e.message || 'Das hat nicht geklappt');
    S.roh = '';
    await laden();
    return false;
  }
}

// Löschen mit Bedenkzeit: Der Eintrag verschwindet sofort, gelöscht wird erst, wenn „Rückgängig" abgelaufen ist.
// Wird die App vorher geschlossen, bleibt der Eintrag einfach da.
const wartend = new Map();         // id -> { liste, fertig, ids }
function spaeterLoeschen(liste, id, ruf, text, auch = []) {
  const ids = [id, ...auch], eintraege = S.d[liste].filter(x => ids.includes(x.id));
  if (!eintraege.some(x => x.id === id)) return A.zu();
  const fertig = async () => {
    if (!wartend.delete(id)) return;
    clearTimeout(uhr);
    try { await ruf(); } catch (e) { melde(e.message || 'Das hat nicht geklappt'); }
    S.roh = '';
    laden();
  };
  const uhr = setTimeout(fertig, 5500);
  wartend.set(id, { liste, fertig, ids });
  S.d[liste] = S.d[liste].filter(x => !ids.includes(x.id));
  S.roh = ''; S.sheet = null;
  symbol();
  render();
  melde(text, { zurueck: () => {
    if (!wartend.delete(id)) return;
    clearTimeout(uhr);
    S.d[liste] = [...S.d[liste], ...eintraege.filter(e => !S.d[liste].some(x => x.id === e.id))];
    S.roh = '';
    symbol();
    render();
    laden();
  } });
}
const jetztLoeschen = () => { for (const w of [...wartend.values()]) w.fertig(); };

// Die Zahl am App-Symbol: eigene offene Tages- und Wochenaufgaben, bei Eltern dazu alles, was auf Bestätigung wartet.
// Dieselbe Regel steht in der Datenbank (symbol_zahl), damit auch eine Push-Nachricht die Zahl richtig setzt.
function symbol() {
  if (!('setAppBadge' in navigator)) return;
  const h = heute(), me = S.ich, bestaetigt = eltern();
  const n = S.phase !== 'app' ? 0 : S.d.aufgaben.filter(a =>
    a.fuer === me && a.status === 'offen' && ((a.art === 'tag' && a.faellig <= h) || a.art === 'woche')).length
    + (bestaetigt ? buendeln(S.d.aufgaben.filter(darfPruefen)).length : 0);
  try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* dann eben keine Zahl */ }
}

const eben = id => { S.frisch = { id, bis: Date.now() + 800 }; };
const punkteLokal = (id, wert) => { const b = S.d.best.find(x => x.mitglied_id === id); if (b) { b.woche += wert; b.gesamt += wert; } };
const aufgabe = id => S.d.aufgaben.find(a => a.id === id);

// ------------------------------------------------------------ Start und Anmeldung

export async function starte(backend, vapid) {
  B = backend; VAPID = vapid;
  S.merken = lager.lies('zoo_merken') !== '0';
  spaeterLesen();
  const stand = liesStand();
  if (stand && stand.ich && S.merken && !B.demo) {       // sofort den letzten Stand zeigen, dann auffrischen
    S.ich = stand.ich; S.d = { ...leer(), ...stand.d }; S.profile = S.d.mitglieder; S.phase = 'app'; S.start = false;
    hakenAuflegen(S.d);
  }
  S.wartetAufNetz = spaeter.length;
  zeichne();
  await verbinde();

  document.addEventListener('visibilitychange', () => { if (document.hidden) jetztLoeschen(); else auffrischen(); });
  window.addEventListener('pagehide', jetztLoeschen);
  window.addEventListener('online', () => { auffrischen(); nachsenden(); });
  setInterval(() => { if (!document.hidden) auffrischen(); }, 60000);
  setInterval(nachsenden, 10000);                       // gemerkte Haken der Einkaufsliste nachreichen
}

async function verbinde() {
  try {
    const { profile, ich: wer } = await B.start();
    gestartet = true;
    S.profile = profile;
    if (wer && S.merken) { S.ich = wer; await rein(); }
    else if (wer) { await B.abmelden(); zumCode(wer); }       // "Code merken" ist aus: jedes Mal neu fragen
    else nachDraussen();
  } catch (e) {
    if (S.phase === 'app') S.ladeFehler = e.message;
    else { S.phase = 'fehler'; S.fehler = e.message; }
    render();
  }
}

function auffrischen() {
  if (!gestartet) { if (S.phase !== 'laden') verbinde(); return; }
  if (S.phase === 'app') { nachsenden(); zeichne(); if (S.imLaden) wachBleiben(true); if (Date.now() - zuletzt > 4000) laden(); else feierPruefen(); }
  else if (S.phase === 'tor') B.profile().then(p => { S.profile = p; if (S.phase === 'tor') render(); }).catch(() => {});
}

async function rein() {
  S.phase = 'app'; S.tab = 'heute'; S.sheet = null; S.neu = null; S.pinFuer = null; S.pin = ''; S.start = false;
  render();
  await laden();
  B.beobachten(() => { clearTimeout(uhrLive); uhrLive = setTimeout(laden, 250); });
  bereit = true;
  ladeOft();
  if (offenesZiel) { const z = offenesZiel; offenesZiel = null; zuZiel(z.ziel, z.art); }
}

function nachDraussen() {
  bereit = false;
  if (S.feier) clearTimeout(S.feier.uhr);
  S.ich = null; S.d = leer(); S.roh = ''; S.sheet = null; S.feier = null; S.kaufOft = []; S.kaufBilder = []; S.phase = 'tor';
  spaeter = []; spaeterMerken();
  if (S.imLaden) { S.imLaden = false; wachBleiben(false); }
  symbol();
  lager.weg('zoo_stand');
  render();
}

function zumCode(id) {
  S.ich = null; S.pinFuer = id; S.pin = ''; S.pinFehler = ''; S.phase = 'pin';
  render();
}

async function raus(text) {
  jetztLoeschen();
  B.nichtBeobachten();
  S.profile = await B.profile().catch(() => S.profile);
  nachDraussen();
  if (text) melde(text);
}

A.neustart = () => { S.phase = 'laden'; S.fehler = ''; zeichne(); verbinde(); };
A.waehle = id => { S.start = false; zumCode(id); };
A.zurueck = () => { S.start = false; S.neu = null; S.pinFuer = null; S.phase = 'tor'; render(); };
A.loesch = () => { S.pin = S.pin.slice(0, -1); zeichne(); };

A.taste = async z => {
  if (S.pin.length >= 4 || S.beschaeftigt) return;
  S.pin += z; S.pinFehler = '';
  zeichne();
  if (S.pin.length < 4) return;
  S.beschaeftigt = true;
  try {
    const r = await B.anmelden(S.pinFuer, S.pin);
    if (r.ok) {
      lager.setz('zoo_merken', S.merken ? '1' : '0');
      S.ich = S.pinFuer; S.beschaeftigt = false;
      return await rein();
    }
    S.pinFehler = r.grund === 'gesperrt' ? 'Zu viele Versuche. Warte 10 Minuten.' : 'Der Code stimmt nicht';
  } catch (e) { S.pinFehler = e.message; }
  S.pin = ''; S.pinWackel = Date.now() + 500; S.beschaeftigt = false;
  zeichne();
};

A.toeneUm = () => { toeneSetzen(!toeneAn()); render(); };
A.merkenUm = () => {
  S.merken = !S.merken;
  lager.setz('zoo_merken', S.merken ? '1' : '0');
  if (S.merken) merkeStand(); else lager.weg('zoo_stand');
  render();
};

// ---------- Neues Profil

const GRUND = {
  familiencode: 'Der Familiencode stimmt nicht', eltern_pin: 'Der Eltern-PIN stimmt nicht',
  farbe: 'Diese Farbe ist schon vergeben', pin: 'Dein Code braucht genau 4 Ziffern',
  gesperrt: 'Zu viele Versuche. Warte 10 Minuten.', nicht_eingerichtet: 'Die Datenbank ist noch nicht eingerichtet',
  anmeldung: 'Keine Verbindung zum Server', rolle: 'Wähle Kind oder Elternteil',
};

A.neuStart = () => {
  const farben = new Set(S.profile.map(p => p.farbe)), tiere = new Set(S.profile.map(p => p.tier));
  S.start = false;
  S.neu = { name: '', rolle: 'kind', pin: '', familiencode: '', elternPin: '', foto: null, fotoUrl: null,
    tier: TIERE.find(t => !tiere.has(t)) || TIERE[0], farbe: (FARBEN.find(([f]) => !farben.has(f)) || FARBEN[0])[0] };
  S.phase = 'neu';
  render();
};
A.neuSetz = (k, v) => { S.neu[k] = v; render(); };
A.neuTier = t => { S.neu.tier = t; S.neu.foto = null; S.neu.fotoUrl = null; render(); };
A.neuFarbe = f => { S.neu.farbe = f; render(); };
A.neuFoto = async () => {
  const bild = await bildWaehlen(false, 400, true);
  if (!bild || !S.neu) return;
  S.neu.foto = bild; S.neu.fotoUrl = URL.createObjectURL(bild);
  render();
};

A.neuFertig = async () => {
  const n = S.neu;
  if (!n || S.beschaeftigt) return;
  const name = n.name.trim(), code = n.familiencode.trim(), elternPin = n.elternPin.trim();
  if (!name) return melde('Wie heißt du?');
  if (!/^\d{4}$/.test(n.pin)) return melde('Dein Code braucht genau 4 Ziffern');
  if (!code) return melde('Der Familiencode fehlt');
  if (n.rolle === 'eltern' && !elternPin) return melde('Der Eltern-PIN fehlt');
  S.beschaeftigt = true; render();
  try {
    const r = await B.profilAnlegen({ name, rolle: n.rolle, farbe: n.farbe, tier: n.tier, pin: n.pin, familiencode: code, elternPin });
    if (r.ok) {
      S.ich = r.id;
      lager.setz('zoo_merken', S.merken ? '1' : '0');
      if (n.foto) {
        try { await B.profilAendern({ bild_pfad: await B.fotoHoch('profilbilder', n.foto, r.id) }); }
        catch { melde('Das Foto konnte nicht gespeichert werden'); }
      }
      S.profile = await B.profile().catch(() => S.profile);
      S.beschaeftigt = false;
      return await rein();
    }
    melde(GRUND[r.grund] || 'Das hat nicht geklappt');
  } catch (e) { melde(e.message); }
  S.beschaeftigt = false; render();
};

// ------------------------------------------------------------ Allgemeines

A.geh = o => { if (o.tab === 'einkauf' && S.tab !== 'einkauf') ladeOft(); return geh(o); };
A.zu = () => { stilleSein(); if (S.sheet) geh({ sheet: null }); };
A.setz = (k, v) => { S[k] = v; };                                  // Entwurf auf der Seite, ohne neu zu zeichnen
A.entwurf = (k, v) => { const ziel = S.sheet || S.neu; if (ziel) ziel[k] = v; };
A.blattSetz = (k, v) => { if (S.sheet) { S.sheet[k] = v; render(); } };
A.blattUm = k => { if (S.sheet) { S.sheet[k] = !S.sheet[k]; render(); } };

// ---------- Fotos: wählen, verkleinern

// Mit der Kamera gibt es ein Foto nach dem anderen. Aus der Mediathek lassen sich gleich mehrere antippen.
function dateienWaehlen(kamera, mehrere) {
  return new Promise(fertig => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*'; i.style.display = 'none';
    if (kamera) i.capture = 'environment';
    else if (mehrere) i.multiple = true;
    document.body.appendChild(i);
    i.addEventListener('change', () => { const f = [...(i.files || [])]; i.remove(); fertig(f); });
    i.addEventListener('cancel', () => { i.remove(); fertig([]); });
    i.click();
  });
}

async function verkleinern(datei, max, quadrat) {
  const url = URL.createObjectURL(datei);
  try {
    const bild = await new Promise((gut, schlecht) => {
      const b = new Image();
      b.onload = () => gut(b); b.onerror = () => schlecht(new Error('Das Bild lässt sich nicht lesen'));
      b.src = url;
    });
    let sb = bild.naturalWidth, sh = bild.naturalHeight, sx = 0, sy = 0;
    if (quadrat) { const s = Math.min(sb, sh); sx = (sb - s) / 2; sy = (sh - s) / 2; sb = sh = s; }
    const f = Math.min(1, max / Math.max(sb, sh)), b = Math.round(sb * f), h = Math.round(sh * f);
    const leinwand = document.createElement('canvas');
    leinwand.width = b; leinwand.height = h;
    leinwand.getContext('2d').drawImage(bild, sx, sy, sb, sh, 0, 0, b, h);
    const blob = await new Promise(gut => leinwand.toBlob(gut, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Das Bild lässt sich nicht verkleinern');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

async function bildWaehlen(kamera, max, quadrat) {
  const [datei] = await dateienWaehlen(kamera, false);
  if (!datei) return null;
  try { return await verkleinern(datei, max, quadrat); }
  catch (e) { melde(e.message); return null; }
}

// ---------- Mehrere Fotos sammeln (beim Abhaken, bei freiwilligen Aufgaben, am Einkauf)
// Eine Sammlung ist eine Liste aus { blob, url }. Sie hängt am offenen Blatt oder, in der Einkaufsliste, am Entwurf.
async function bilderWaehlen(kamera, max, platz) {
  const dateien = await dateienWaehlen(kamera, platz > 1);
  if (dateien.length > platz) melde(`Mehr als ${MAX_FOTOS} Fotos gehen nicht`);
  const bilder = [];
  for (const d of dateien.slice(0, platz)) {
    try { const blob = await verkleinern(d, max, false); bilder.push({ blob, url: URL.createObjectURL(blob) }); }
    catch (e) { melde(e.message); }
  }
  return bilder;
}
const hochladen = bilder => Promise.all(bilder.map(b => B.fotoHoch('beweise', b.blob, S.ich)));
const sammlung = () => S.sheet ? S.sheet.bilder : S.tab === 'einkauf' ? S.kaufBilder : null;

A.fotoDazu = async () => {
  const blatt = S.sheet, liste = sammlung();
  if (!liste) return;
  if (liste.length >= MAX_FOTOS) return melde(`Mehr als ${MAX_FOTOS} Fotos gehen nicht`);
  // Der Beweis beim Abhaken kommt frisch aus der Kamera, alles andere auch aus der Mediathek.
  const neu = await bilderWaehlen(!!blatt && blatt.k === 'fotos', blatt ? 1600 : 1400, MAX_FOTOS - liste.length);
  if (S.sheet !== blatt) return neu.forEach(b => URL.revokeObjectURL(b.url));     // inzwischen geschlossen
  liste.push(...neu);
  return blatt ? render() : zeichne();
};
A.fotoWeg = i => {
  const liste = sammlung();
  if (!liste || !liste[i]) return;
  URL.revokeObjectURL(liste.splice(i, 1)[0].url);
  return S.sheet ? render() : zeichne();
};

// Fotos groß ansehen: über die ganze Seite, zur Seite wischen, mit zwei Fingern vergrößern. Antippen schließt.
A.gross = i => {
  const urls = S.sheet && S.sheet.fotos;
  if (!urls || !urls.length) return;
  const el = document.createElement('div'), n = urls.length;
  el.className = 'lupe';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', n > 1 ? `${n} Fotos` : 'Foto');
  el.innerHTML = `<div class="rolle">${urls.map((u, k) => `<img src="${esc(u)}" alt="Foto ${k + 1} von ${n}">`).join('')}</div>
    ${n > 1 ? `<span class="zaehler">${i + 1} von ${n}</span>` : ''}<button class="zu" aria-label="Schließen">${KREUZ}</button>`;
  const rolle = el.firstChild, zaehler = el.querySelector('.zaehler');
  const zu = () => { document.removeEventListener('keydown', taste); el.remove(); };
  const taste = e => { if (e.key === 'Escape') zu(); };
  el.addEventListener('click', zu);
  document.addEventListener('keydown', taste);
  if (zaehler) rolle.addEventListener('scroll', () => { zaehler.textContent = `${Math.min(n, Math.round(rolle.scrollLeft / rolle.clientWidth) + 1)} von ${n}`; }, { passive: true });
  document.body.appendChild(el);
  rolle.scrollLeft = i * rolle.clientWidth;
};

// ------------------------------------------------------------ Aufgaben

// Abhaken. Aufgaben ohne Datum sind sofort erledigt, alles andere wartet auf ein Elternteil. Das gilt auch für Eltern:
// Dann bestätigt das andere Elternteil. Eine gemeinsame Aufgabe ist mit einem Haken für alle abgehakt.
function erledige(a, fotos) {
  const sofort = a.art === 'irgendwann' || (eltern() && !andereEltern().length), p = wert(a);
  return tun(() => B.aufgabeErledigen(a.id, fotos), {
    zu: true,
    lokal: () => {
      if (!a.fuer) a.fuer = S.ich;                       // eine Aufgabe für alle gehört jetzt mir
      for (const x of runde(a).filter(x => x.id === a.id || x.status === 'offen')) {
        x.status = sofort ? 'erledigt' : 'wartet';
        x.hinweis = null; x.erledigt_von = S.ich;
        if (fotos) { x.foto_pfad = fotos[0]; x.weitere_fotos = fotos.length > 1 ? fotos.slice(1) : null; }   // neue Fotos ersetzen die alten
        if (sofort && wert(x)) punkteLokal(x.fuer, wert(x));
      }
      eben(a.id);
      klang(sofort ? 'fertig' : 'haken');
    },
    // Was wirklich passiert ist, sagt der Server (solange 08_gemeinsam.sql fehlt, sind Eltern noch sofort fertig).
    ok: r => r === 'wartet' ? 'Wartet auf Bestätigung' : p ? `Erledigt, +${p} ${p > 1 ? 'Punkte' : 'Punkt'}` : 'Erledigt',
    zurueck: () => tun(() => B.aufgabeWiederoeffnen(a.id), {
      ok: 'Wieder offen',
      lokal: () => {
        const x = aufgabe(a.id);
        if (!x) return;
        for (const y of runde(x).filter(y => y.id === x.id || y.erledigt_von === S.ich)) {
          if (y.status === 'erledigt' && wert(y)) punkteLokal(y.fuer, -wert(y));
          y.status = 'offen'; y.erledigt_von = null;
          if (y.fuer_alle) y.fuer = null;
        }
      },
    }),
  });
}

A.abhaken = id => {
  const a = aufgabe(id);
  if (!a) return;
  if (a.status === 'offen') {
    if (a.fuer && a.fuer !== S.ich) return melde(`Das ist die Aufgabe von ${P(a.fuer).name}`);
    if (a.foto_pflicht && !a.foto_pfad) return A.mitFoto(id);
    return erledige(a, null);
  }
  if (a.status === 'wartet') {
    if (!eltern()) return melde('Ein Elternteil muss noch bestätigen');
    if (!darfPruefen(a)) return melde(`Das bestätigt ${aufzaehlen(andereEltern().map(m => m.name)) || 'das andere Elternteil'}`);
    return A.bestaetige(id);
  }
};

// Abhaken mit Foto: erst die Kamera, dann ein Blatt mit dem Foto. Dort kommen weitere dazu (z. B. jede Seite der Hausaufgaben).
A.mitFoto = async id => {
  const a = aufgabe(id);
  if (!a) return;
  const bilder = await bilderWaehlen(true, 1600, 1);
  if (!bilder.length) return;
  return geh({ sheet: { k: 'fotos', id, bilder, laedt: false } });
};
A.fotosAb = async () => {
  const s = S.sheet, a = s && s.k === 'fotos' && aufgabe(s.id);
  if (!a || s.laedt || !s.bilder.length) return;
  s.laedt = true; render();
  let pfade;
  try { pfade = await hochladen(s.bilder); }
  catch (e) { s.laedt = false; render(); return melde(e.message || 'Die Fotos ließen sich nicht hochladen'); }
  s.laedt = false;
  if (S.sheet !== s) return;                                        // inzwischen geschlossen
  return erledige(a, pfade);
};

A.bestaetige = (id, punkte) => {
  const a = aufgabe(id);
  if (!a) return;
  const p = a.art === 'frei' ? (punkte || 1) : wert(a);
  const lob = S.sheet && S.sheet.k === 'aufgabe' && S.sheet.id === id ? S.sheet.lob || null : null;
  const teile = runde(a).filter(x => x.status === 'wartet'), wer = aufzaehlen(teile.map(x => P(x.fuer).name));
  return tun(() => B.aufgabeBestaetigen(id, punkte, lob), {
    zu: true, ok: p ? `Bestätigt, +${p} für ${wer}` : `Bestätigt für ${wer}`,
    lokal: () => {
      for (const x of teile) { x.status = 'erledigt'; x.lob = lob; x.hinweis = null; x.bestaetigt_von = S.ich; if (p) punkteLokal(x.fuer, p); }
      eben(id);
      klang('fertig');
    },
  });
};
A.lobWahl = l => { const s = S.sheet; if (s) { s.lob = s.lob === l ? null : l; render(); } };

A.alleBestaetigen = () => {
  const offen = S.d.aufgaben.filter(darfPruefen);
  if (!offen.length) return;
  return tun(() => B.alleBestaetigen(), {
    ok: n => n === 1 ? '1 Aufgabe bestätigt' : `${n} Aufgaben bestätigt`,
    lokal: () => { offen.forEach(a => { a.status = 'erledigt'; if (wert(a)) punkteLokal(a.fuer, wert(a)); }); klang('fertig'); },
  });
};

A.zurueckAuf = id => geh({ sheet: { k: 'zurueck', id, grund: '' } });
A.zurueckgeben = (id, fest) => {
  const a = aufgabe(id);
  if (!a) return A.zu();
  const grund = (fest || (S.sheet && S.sheet.grund) || '').trim() || null;
  const teile = runde(a).filter(x => x.status === 'wartet');
  return tun(() => B.aufgabeZurueck(id, grund), {
    zu: true, ok: a.art === 'frei' ? 'Nicht anerkannt' : `${aufzaehlen(teile.map(x => P(x.fuer).name))} ${teile.length > 1 ? 'müssen' : 'muss'} noch einmal ran`,
    lokal: () => { for (const x of teile) { x.status = a.art === 'frei' ? 'abgelehnt' : 'offen'; x.hinweis = grund; x.erledigt_von = null; } },
  });
};

A.morgen = id => {
  const a = aufgabe(id);
  if (!a) return;
  return tun(() => B.aufgabeVerschieben(id), {
    zu: true, ok: 'Auf morgen verschoben',
    lokal: () => { a.faellig = plus(a.faellig, 1); a.verschoben = true; },
  });
};

A.loeschAufgabe = id => {
  const a = aufgabe(id);
  if (!a) return A.zu();
  const auch = runde(a).map(x => x.id).filter(x => x !== id);     // eine gemeinsame Aufgabe verschwindet bei allen
  return spaeterLoeschen('aufgaben', id, () => B.aufgabeLoeschen(id, a.gruppe || null), auch.length ? 'Für alle gelöscht' : 'Aufgabe gelöscht', auch);
};

A.auf = id => {
  const a = aufgabe(id);
  if (!a) return;
  const blatt = S.sheet = { k: 'aufgabe', id, fotos: null }, pfade = fotosVon(a);
  render();
  if (pfade.length) B.fotoUrls(pfade).then(u => { if (S.sheet === blatt) { blatt.fotos = u; render(); } }).catch(() => {});
};

function ladeVorschlaege() {
  const s = S.sheet;
  if (!s || s.k !== 'neu' || s.art !== 'tag' || !eltern() || s.fuer === 'alle' || s.zus) return;
  const fuer = s.fuer;
  B.vorschlaege(fuer).then(v => { if (S.sheet === s && s.fuer === fuer) { s.vor = v; render(); } }).catch(() => {});
}

A.neuAuf = () => {
  const art = S.seg, kinder = S.d.mitglieder.filter(m => m.rolle === 'kind');
  const fuer = art === 'irgendwann' ? S.ich : (kinder.find(m => m.id !== S.ich) || kinder[0] || ich()).id;
  S.sheet = { k: 'neu', art, fuer, t: '', wann: 'heute', foto: false, tage: 7, vor: [], wdh: false, wtage: [1, 2, 3, 4, 5, 6, 7],
    zus: false, wer: [], ohne: false, notiz: '' };   // zus: mehrere erledigen sie zusammen (wer = die Beteiligten)
  render();
  ladeVorschlaege();
};
A.neuFuer = id => {
  const s = S.sheet;
  if (!s) return;
  if (s.zus) {                                           // zusammen: mehrere antippen, „Alle" wählt alle an oder ab
    const alle = S.d.mitglieder.map(m => m.id);
    if (id === 'alle') s.wer = alle.every(x => s.wer.includes(x)) ? [] : alle;
    else s.wer = s.wer.includes(id) ? s.wer.filter(x => x !== id) : [...s.wer, id];
    return render();
  }
  s.fuer = id; s.vor = [];
  render();
  ladeVorschlaege();
};
A.zusUm = () => {
  const s = S.sheet;
  if (!s) return;
  s.zus = !s.zus;
  if (s.zus) { s.wer = s.fuer === 'alle' ? S.d.mitglieder.map(m => m.id) : [s.fuer]; s.vor = []; }
  else { s.fuer = s.wer[0] || S.ich; ladeVorschlaege(); }
  render();
};
A.vorschlagNehmen = t => {
  if (!S.sheet) return;
  S.sheet.t = t;
  const feld = document.getElementById('neu-t');
  if (feld) feld.value = t;
  render();
};
A.neuTag = n => {
  const t = S.sheet && S.sheet.wtage;
  if (!t) return;
  const i = t.indexOf(n);
  if (i >= 0) t.splice(i, 1); else t.push(n);
  render();
};
A.neuAufgabe = () => {
  const s = S.sheet, titel = (s.t || '').trim();
  if (!titel) return melde('Schreib kurz, was zu tun ist');
  let fuer = s.fuer === 'alle' ? null : s.fuer, mit = [];   // leer = für alle
  if (s.zus) {
    const dabei = S.d.mitglieder.map(m => m.id).filter(id => s.wer.includes(id));
    if (dabei.length < 2) return melde('Tippe mindestens zwei an, die mitmachen');
    fuer = dabei[0]; mit = dabei.slice(1);
  }
  const ohne_punkte = s.art !== 'irgendwann' && !!s.ohne, notiz = (s.notiz || '').trim();
  if (s.art !== 'irgendwann' && s.wdh) {
    if (s.art === 'tag' && !s.wtage.length) return melde('Wähle mindestens einen Wochentag');
    return tun(() => B.serieAnlegen({ titel, art: s.art, fuer, mit, ohne_punkte, notiz, tage: s.art === 'tag' ? [...s.wtage].sort((a, b) => a - b) : null, foto_pflicht: s.foto }),
      { zu: true, ok: 'Trägt sich ab jetzt von selbst ein' });
  }
  const faellig = s.art === 'tag' ? (s.wann === 'morgen' ? plus(heute(), 1) : heute()) : null;
  return tun(() => B.aufgabeAnlegen({ titel, art: s.art, fuer, mit, ohne_punkte, notiz, faellig, foto_pflicht: s.art !== 'irgendwann' && s.foto, erinnerung_tage: s.tage }),
    { zu: true, ok: mit.length ? `Für ${aufzaehlen([fuer, ...mit].map(id => id === S.ich ? 'dich' : P(id).name))} eingetragen`
      : !fuer ? 'Für alle eingetragen' : fuer === S.ich ? 'Eingetragen' : `Aufgabe für ${P(fuer).name} eingetragen` });
};

// ---------- Ändern statt löschen und neu anlegen
export const darfAendern = a => a.status === 'offen' && a.art !== 'frei' && (eltern() || (a.von === S.ich && a.art === 'irgendwann'));
A.aendernAuf = id => {
  const a = aufgabe(id);
  if (!a || !darfAendern(a)) return;
  const h = heute();
  return geh({ sheet: { k: 'aendern', id, t: a.titel, notiz: a.notiz || '', fuer: a.fuer,
    wann: a.faellig === h ? 'heute' : a.faellig === plus(h, 1) ? 'morgen' : '', foto: !!a.foto_pflicht, ohne: !!a.ohne_punkte } });
};
A.aendern = () => {
  const s = S.sheet, a = s && aufgabe(s.id);
  if (!a) return A.zu();
  const titel = (s.t || '').trim(), notiz = (s.notiz || '').trim(), h = heute();
  if (!titel) return melde('Schreib kurz, was zu tun ist');
  const tag = a.art === 'tag' && s.wann ? (s.wann === 'morgen' ? plus(h, 1) : h) : null, mitSchaltern = a.art !== 'irgendwann';
  const neu = { titel, notiz, fuer: s.fuer && s.fuer !== a.fuer ? s.fuer : null, faellig: tag && tag !== a.faellig ? tag : null,
    foto_pflicht: mitSchaltern ? !!s.foto : null, ohne_punkte: mitSchaltern ? !!s.ohne : null };
  return tun(() => B.aufgabeAendern(a.id, neu), {
    zu: true, ok: 'Geändert',
    lokal: () => {
      for (const x of runde(a).filter(x => x.status === 'offen')) {
        x.titel = titel; x.notiz = notiz || null;
        if (neu.faellig) x.faellig = neu.faellig;
        if (mitSchaltern) { x.foto_pflicht = neu.foto_pflicht; x.ohne_punkte = neu.ohne_punkte; }
      }
      if (neu.fuer) a.fuer = neu.fuer;
    },
  });
};
A.serieAendernAuf = id => {
  const x = S.d.serien.find(v => v.id === id);
  if (!x || !eltern()) return;
  return geh({ sheet: { k: 'saendern', id, t: x.titel, notiz: x.notiz || '', fuer: x.fuer, wtage: [...(x.tage || [])], foto: !!x.foto_pflicht, ohne: !!x.ohne_punkte } });
};
A.serieAendern = () => {
  const s = S.sheet, x = s && S.d.serien.find(v => v.id === s.id);
  if (!x) return A.zu();
  const titel = (s.t || '').trim(), notiz = (s.notiz || '').trim();
  if (!titel) return melde('Schreib kurz, was zu tun ist');
  if (x.art === 'tag' && !s.wtage.length) return melde('Wähle mindestens einen Wochentag');
  const neu = { titel, notiz, tage: x.art === 'tag' ? [...s.wtage].sort((a, b) => a - b) : null, foto_pflicht: !!s.foto, ohne_punkte: !!s.ohne,
    fuer: s.fuer && s.fuer !== x.fuer ? s.fuer : null };
  return tun(() => B.serieAendern(x.id, neu), {
    zu: true, ok: 'Geändert',
    lokal: () => { Object.assign(x, { titel, notiz: notiz || null, foto_pflicht: neu.foto_pflicht, ohne_punkte: neu.ohne_punkte }); if (neu.tage) x.tage = neu.tage; if (neu.fuer) x.fuer = neu.fuer; },
  });
};

A.serieAuf = id => geh({ sheet: { k: 'serie', id } });
A.serieWeg = id => spaeterLoeschen('serien', id, () => B.serieLoeschen(id), 'Wiederholung beendet');

// ---------- Einsprechen statt tippen
// Wo der Browser Sprache erkennt, schreibt er das Gesagte ins Feld. Wo nicht (z. B. in manchen iPhone-Apps
// auf dem Home-Bildschirm), öffnet der Knopf die Tastatur: Deren Mikrofon-Taste kann dasselbe.
let hoerer = null;
const stilleSein = () => { if (hoerer) { try { hoerer.abort(); } catch { /* schon vorbei */ } } };

A.sprich = id => {
  const Erkennung = window.SpeechRecognition || window.webkitSpeechRecognition;
  const blatt = S.sheet, feld = document.getElementById(id);
  if (!blatt) return;
  if (hoerer) { try { hoerer.stop(); } catch { /* schon vorbei */ } return; }
  const tastatur = text => { if (feld) feld.focus(); melde(text); };
  if (!Erkennung) return tastatur('Tippe auf das Mikrofon unten auf der Tastatur');
  const r = hoerer = new Erkennung();
  r.lang = 'de-DE'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  r.onresult = e => {
    if (S.sheet !== blatt) return stilleSein();
    const text = Array.from(e.results).map(x => x[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
    blatt.t = (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, 120);
    if (feld && feld.isConnected) feld.value = blatt.t;
    zeichne();
  };
  r.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') tastatur('Das Mikrofon ist hier gesperrt. Nimm das Mikrofon auf der Tastatur.');
    else if (e.error === 'no-speech') melde('Ich habe nichts gehört');
    else if (e.error !== 'aborted') tastatur('Das hat nicht geklappt. Nimm das Mikrofon auf der Tastatur.');
  };
  r.onend = () => { if (hoerer === r) hoerer = null; S.hoert = false; if (S.phase === 'app') zeichne(); };
  try { r.start(); S.hoert = true; zeichne(); }
  catch { hoerer = null; tastatur('Tippe auf das Mikrofon unten auf der Tastatur'); }
};

A.freiAuf = () => geh({ sheet: { k: 'frei', t: '', bilder: [], laedt: false } });
A.neuFrei = async () => {
  const s = S.sheet, titel = (s.t || '').trim();
  if (!titel) return melde('Schreib kurz, was du gemacht hast');
  if (s.laedt) return;
  let fotos = [];
  if (s.bilder.length) {
    s.laedt = true; render();
    try { fotos = await hochladen(s.bilder); }
    catch (e) { s.laedt = false; render(); return melde(e.message || 'Die Fotos ließen sich nicht hochladen'); }
    s.laedt = false;
    if (S.sheet !== s) return;                                      // inzwischen geschlossen
  }
  return tun(() => B.aufgabeAnlegen({ titel, art: 'frei', fuer: S.ich, fotos }), { zu: true, ok: 'Eingetragen. Wartet auf Bestätigung.' });
};

A.jokerAuf = () => {
  if (S.d.jokerHeute.includes(S.ich)) return melde('Heute hast du schon einen Joker eingelöst');
  return geh({ sheet: { k: 'joker' } });
};
A.jokerEin = () => tun(() => B.jokerEinloesen(), {
  zu: true, ok: 'Joker eingelöst. Heute hast du frei.',
  lokal: () => {
    klang('joker');
    const b = S.d.best.find(x => x.mitglied_id === S.ich), h = heute();
    if (b && b.joker > 0) b.joker--;
    S.d.jokerHeute.push(S.ich);
    S.d.aufgaben.forEach(a => { if (a.fuer === S.ich && a.art === 'tag' && a.status === 'offen' && a.faellig === h) a.status = 'entfallen'; });
  },
});

A.verlaufAuf = id => {
  const blatt = S.sheet = { k: 'verlauf', id, log: null };
  render();
  B.punkteVerlauf(id).then(l => { if (S.sheet === blatt) { blatt.log = l; render(); } })
    .catch(() => { if (S.sheet === blatt) { blatt.log = []; render(); } });
};

// ------------------------------------------------------------ Einkauf

const kauf = id => S.d.einkauf.find(k => k.id === id);

// ---------- Einkaufen ohne Netz
// Im Laden ist der Empfang oft schlecht. Ein Haken in der Einkaufsliste wird deshalb zuerst auf dem Gerät gemerkt
// und dann übertragen. Klappt das nicht, bleibt er gemerkt und geht raus, sobald wieder Netz da ist.
let spaeter = [];                  // [{ id, status }] in der Reihenfolge des Antippens
let sendet = false, netzGesagt = false;
function spaeterLesen() {          // beim Start: was beim letzten Mal nicht mehr rausging (in der Demo bleibt nichts liegen)
  try { spaeter = (!B.demo && JSON.parse(lager.lies('zoo_spaeter'))) || []; } catch { spaeter = []; }
  if (!Array.isArray(spaeter)) spaeter = [];
}
function spaeterMerken() { if (!B.demo) lager.setz('zoo_spaeter', JSON.stringify(spaeter)); S.wartetAufNetz = spaeter.length; }
function hakenAuflegen(d) {
  for (const e of spaeter) { const k = d.einkauf.find(x => x.id === e.id); if (k) k.status = e.status; }
}
const ohneNetz = () => Object.assign(new Error('Keine Verbindung zum Internet'), { offline: true });

async function nachsenden() {
  if (sendet || !spaeter.length || S.phase !== 'app') return;
  sendet = true;
  let wartet = false;
  try {
    while (spaeter.length && !wartet) {
      const e = spaeter[0];
      try {
        // Bei schwachem Empfang hängt eine Anfrage lange: nach 8 Sekunden gilt sie als nicht angekommen.
        await Promise.race([B.einkaufSetzen(e.id, { status: e.status }), new Promise((_, nein) => setTimeout(() => nein(ohneNetz()), 8000))]);
      } catch (f) {
        if (f.offline) { wartet = true; continue; }
        melde(f.message || 'Das hat nicht geklappt');         // z. B. inzwischen gelöscht: nicht ewig wiederholen
      }
      const i = spaeter.indexOf(e);                           // wurde derselbe Artikel inzwischen neu angetippt, bleibt der neue Eintrag
      if (i >= 0) spaeter.splice(i, 1);
      spaeterMerken();
    }
  } finally { sendet = false; }
  if (wartet) {
    if (!netzGesagt) { netzGesagt = true; melde('Kein Netz. Deine Haken sind gemerkt.'); }
    if (S.phase === 'app' && S.tab === 'einkauf') zeichne();
    return;
  }
  if (netzGesagt) { netzGesagt = false; melde('Alles übertragen'); }
  S.roh = '';
  laden();
}

function ladeOft() {
  B.einkaufHaeufig().then(l => { S.kaufOft = l; if (S.phase === 'app' && S.tab === 'einkauf') zeichne(); }).catch(() => {});
}
A.kaufTippen = t => { S.kaufT = t; zeichne(); };                   // die Vorschläge filtern mit, das Feld behält den Fokus
A.kaufSchnell = t => { S.kaufT = t; S.kaufM = ''; return A.kaufNeu(); };
A.kaufAufraeumen = () => {
  const weg = S.d.einkauf.filter(k => k.status === 'gekauft');
  if (!weg.length) return;
  let ids = weg.map(k => k.id);
  return tun(async () => { ids = await B.einkaufAufraeumen(); }, {
    ok: 'Korb geleert',
    lokal: () => weg.forEach(k => { k.status = 'archiv'; }),
    zurueck: () => tun(() => B.einkaufZurueckholen(ids), { lokal: () => S.d.einkauf.forEach(k => { if (ids.includes(k.id)) k.status = 'gekauft'; }) }),
  });
};

A.kaufNeu = async () => {
  const titel = (S.kaufT || '').trim(), menge = (S.kaufM || '').trim(), bilder = S.kaufBilder;
  if (!titel) return bilder.length ? melde('Schreib dazu, was es ist') : undefined;
  const status = eltern() ? 'liste' : 'vorschlag';
  S.kaufT = S.kaufM = ''; S.kaufBilder = [];
  for (const id of ['kauf', 'menge']) { const feld = document.getElementById(id); if (feld) feld.value = ''; }
  let fotos = [];
  if (bilder.length) {
    zeichne();
    melde(bilder.length > 1 ? 'Fotos werden hochgeladen …' : 'Foto wird hochgeladen …');
    try { fotos = await hochladen(bilder); }
    catch (e) { S.kaufT = titel; S.kaufM = menge; S.kaufBilder = bilder; zeichne(); return melde(e.message || 'Die Fotos ließen sich nicht hochladen'); }
  }
  return tun(() => B.einkaufNeu({ titel, menge, status, von: S.ich, fotos }), {
    ok: eltern() ? 'Auf die Liste gesetzt' : 'Vorgeschlagen',
    lokal: () => { S.d.einkauf.push({ id: 'neu' + Date.now(), titel, menge, status, von: S.ich, grund: null, foto_pfad: fotos[0] || null, weitere_fotos: fotos.length > 1 ? fotos.slice(1) : null }); },
  });
};
A.kaufBild = id => {
  const k = kauf(id);
  if (!k || !k.foto_pfad) return;
  const blatt = S.sheet = { k: 'kbild', id, fotos: null };
  render();
  B.fotoUrls(fotosVon(k)).then(u => { if (S.sheet === blatt) { blatt.fotos = u; render(); } }).catch(() => { if (S.sheet === blatt) melde('Das Foto ließ sich nicht laden'); });
};

// ---------- Im Laden: große Liste, Bildschirm bleibt an, die anderen bekommen Bescheid
let wach = null;
async function wachBleiben(an) {
  try {
    if (an) { if ((!wach || wach.released) && navigator.wakeLock) wach = await navigator.wakeLock.request('screen'); }
    else if (wach) { const w = wach; wach = null; await w.release(); }
  } catch { wach = null; }                               // kein Recht oder Akku-Sparmodus: dann eben ohne
}
A.ladenAn = () => {
  S.imLaden = true;
  wachBleiben(true);
  render().then(() => { const sc = document.querySelector('.screen'); if (sc) sc.scrollTop = 0; });
  B.einkaufLos().then(() => melde('Die anderen wissen Bescheid'))
    .catch(e => { if (!/gerade schon/.test(e.message || '')) melde(e.message || 'Die Nachricht ging nicht raus'); });
};
A.ladenAus = () => { S.imLaden = false; wachBleiben(false); render(); };
A.kaufJa = id => { const k = kauf(id); if (k) return tun(() => B.einkaufSetzen(id, { status: 'liste' }), { ok: 'Auf die Liste gesetzt', lokal: () => { k.status = 'liste'; k.entschieden_von = S.ich; } }); };
A.kaufNeinAuf = id => geh({ sheet: { k: 'nein', id, grund: '' } });
A.kaufNein = fest => {
  const s = S.sheet, k = kauf(s.id), grund = (fest || s.grund || '').trim();
  if (!k) return A.zu();
  return tun(() => B.einkaufSetzen(s.id, { status: 'abgelehnt', grund: grund || null }), { zu: true, ok: 'Abgelehnt', lokal: () => { k.status = 'abgelehnt'; k.grund = grund; k.entschieden_von = S.ich; } });
};
A.kaufUm = id => {
  const k = kauf(id);
  if (!k) return;
  if (!eltern()) return melde('Abhaken können nur Eltern');
  const neu = k.status === 'gekauft' ? 'liste' : 'gekauft';
  k.status = neu;
  if (neu === 'gekauft') { eben(id); klang('haken'); }
  spaeter = spaeter.filter(e => e.id !== id);            // nur der letzte Stand eines Artikels zählt
  spaeter.push({ id, status: neu });
  spaeterMerken();
  S.roh = '';
  merkeStand();
  render();
  return nachsenden();
};
A.kaufAuf = id => { const k = kauf(id); if (k && eltern()) return geh({ sheet: { k: 'kauf', id, menge: k.menge || '' } }); };
A.kaufMenge = () => {
  const s = S.sheet, k = kauf(s.id), menge = (s.menge || '').trim();
  if (!k) return A.zu();
  return tun(() => B.einkaufSetzen(s.id, { menge }), { zu: true, lokal: () => { k.menge = menge; } });
};
A.kaufWeg = id => spaeterLoeschen('einkauf', id, () => B.einkaufLoeschen(id), 'Von der Liste genommen');

// ------------------------------------------------------------ Kalender

const zweistellig = n => String(n).padStart(2, '0');

A.woche = n => geh({ tag: plus(S.tag, 7 * n) });
A.tagWahl = t => geh({ tag: t });

A.terminAuf = id => {
  const e = id && S.d.termine.find(x => x.id === id);
  if (e) {
    const b = new Date(e.beginn);
    S.sheet = { k: 'termin', id, t: e.titel, datum: iso(b), zeit: `${zweistellig(b.getHours())}:${zweistellig(b.getMinutes())}`, ganztags: e.ganztags,
      fuer: [...e.fuer], erinnerung: e.erinnerung_min == null ? '' : String(e.erinnerung_min), wdh: e.wiederholung || 'nie' };
  } else {
    S.sheet = { k: 'termin', id: null, t: '', datum: S.tab === 'kalender' ? S.tag : heute(), zeit: '16:00', ganztags: false,
      fuer: [S.ich], erinnerung: '1440', wdh: 'nie' };
  }
  render();
};
A.terminFuer = id => {
  const f = S.sheet.fuer, i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1); else f.push(id);
  render();
};
A.terminSpeichern = () => {
  const s = S.sheet, titel = (s.t || '').trim();
  if (!titel) return melde('Wie heißt der Termin?');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.datum || '')) return melde('An welchem Tag?');
  if (!s.fuer.length) return melde('Für wen ist der Termin?');
  const [j, m, t] = s.datum.split('-').map(Number);
  const [st, mi] = (s.ganztags ? '00:00' : (s.zeit || '00:00')).split(':').map(Number);
  const beginn = new Date(j, m - 1, t, st || 0, mi || 0).toISOString();
  return tun(() => B.terminSpeichern({ id: s.id, titel, beginn, ganztags: !!s.ganztags, fuer: s.fuer, wiederholung: s.wdh,
    erinnerung_min: s.erinnerung === '' ? null : Number(s.erinnerung), von: S.ich }),
    { zu: true, ok: s.id ? 'Gespeichert' : 'Termin eingetragen', lokal: () => { S.tag = s.datum; } });
};
A.terminWeg = () => { const id = S.sheet.id; return spaeterLoeschen('termine', id, () => B.terminLoeschen(id), 'Termin gelöscht'); };

// ------------------------------------------------------------ Dran denken

A.merkAuf = () => geh({ sheet: { k: 'merk', t: '', datum: '' } });
A.merkNeu = () => {
  const s = S.sheet, titel = (s.t || '').trim();
  if (!titel) return melde('Woran soll die Familie denken?');
  return tun(() => B.merkNeu({ titel, erinnern_am: s.datum || null, von: S.ich }), { zu: true, ok: 'Notiert' });
};
A.merkUm = id => {
  const m = S.d.merk.find(x => x.id === id);
  if (!m) return;
  const neu = !m.erledigt;
  return tun(() => B.merkSetzen(id, { erledigt: neu }), { lokal: () => { m.erledigt = neu; if (neu) { eben(id); klang('haken'); } } });
};

// ------------------------------------------------------------ Sparschweine

const schwein = id => S.d.schweine.find(p => p.id === id);

function ladeBuchungen() {
  const s = S.sheet;
  if (!s || s.k !== 'schwein') return;
  B.buchungen(s.id).then(l => { if (S.sheet === s) { s.log = l; render(); } }).catch(() => {});
}
A.schweinAuf = id => { S.sheet = { k: 'schwein', id, weg: 'bar', log: null, sicher: false }; render(); ladeBuchungen(); };

async function buche(cent, text) {
  const s = S.sheet, p = schwein(s.id);
  if (!p) return;
  const weg = cent < 0 ? 'bar' : s.weg;
  // Meilenstein? Halb voll und Ziel erreicht werden gefeiert (die anderen bekommen eine Nachricht aus der Datenbank).
  const vorher = p.stand_cent, nachher = vorher + cent, ziel = p.ziel_cent;
  const geschafft = !!ziel && cent > 0 && vorher < ziel && nachher >= ziel;
  const halb = !!ziel && cent > 0 && !geschafft && vorher * 2 < ziel && nachher * 2 >= ziel;
  if (geschafft || halb) eben(p.id);
  if (cent > 0) klang('muenze');
  const gut = await tun(() => B.buchen({ schwein_id: s.id, mitglied_id: S.ich, betrag_cent: cent, weg }), {
    ok: geschafft ? `Sparziel erreicht: ${p.name}` : halb ? `${p.name} ist halb voll` : text,
    lokal: () => {
      p.stand_cent += cent;
      if (s.log) s.log.unshift({ id: 'neu' + Date.now(), mitglied_id: S.ich, betrag_cent: cent, weg, am: new Date().toISOString() });
    },
  });
  if (gut && geschafft) klang('sieg');
  if (gut && geschafft) konfetti(['#F5B841', '#FFD97A', '#F29CB4', '#FFFFFF', ich().farbe]);
  ladeBuchungen();
}
function betragLesen() {
  const feld = document.getElementById('betrag');
  return { feld, cent: centAus(feld ? feld.value : '') };
}
A.einzahlen = cent => buche(cent, `${euro(cent)} eingezahlt`);
A.eigener = () => {
  const { feld, cent } = betragLesen();
  if (!(cent > 0)) return melde('Trag einen Betrag ein, z. B. 7,50');
  if (cent > 1000000) return melde('Der Betrag ist zu groß');
  feld.value = '';
  return buche(cent, `${euro(cent)} eingezahlt`);
};
A.entnehmen = () => {
  const { feld, cent } = betragLesen(), p = schwein(S.sheet.id);
  if (!p) return;
  if (!(cent > 0)) return melde('Trag oben den Betrag ein');
  if (cent > p.stand_cent) return melde('So viel ist nicht im Sparschwein');
  feld.value = '';
  return buche(-cent, `${euro(cent)} herausgenommen`);
};
A.aufbrechen = () => {
  const s = S.sheet, p = schwein(s.id);
  if (!p) return A.zu();
  if (!s.sicher) { s.sicher = true; return render(); }
  return tun(() => B.schweinAufbrechen(s.id), {
    zu: true, ok: `${p.name} aufgebrochen: ${euro(p.stand_cent)}`,
    lokal: () => { S.d.schweine = S.d.schweine.filter(x => x.id !== s.id); },
  });
};
A.neuSchweinAuf = () => geh({ sheet: { k: 'neuschwein', t: '', ziel: '' } });
A.neuSchwein = () => {
  const s = S.sheet, name = (s.t || '').trim();
  if (!name) return melde('Gib dem Sparschwein einen Namen');
  let ziel = null;
  if ((s.ziel || '').trim()) {
    ziel = centAus(s.ziel);
    if (!(ziel > 0)) return melde('Das Sparziel verstehe ich nicht. Schreib z. B. 300');
  }
  return tun(() => B.schweinNeu({ name, ziel_cent: ziel, von: S.ich }), { zu: true, ok: 'Sparschwein angelegt' });
};
A.ibanKopieren = async () => {
  try { await navigator.clipboard.writeText((S.d.info.iban || '').replace(/\s/g, '')); melde('IBAN kopiert'); }
  catch { melde('Kopieren geht hier nicht. Tipp die IBAN bitte ab.'); }
};

// ------------------------------------------------------------ Zoo

const zooStand = () => (S.d.zoo && S.d.zoo.stand.find(x => x.mitglied_id === S.ich)) || null;
A.zooVon = id => geh({ zooVon: id });
A.zooLaden = () => { if (S.d.zoo) geh({ sheet: { k: 'zooladen' } }); };
A.zooTierAuf = (id, wer) => geh({ sheet: { k: 'zootier', id, wer: wer || S.ich } });
A.zooKaufen = async id => {
  const t = ZOO_TIERE.find(x => x.id === id), st = zooStand();
  if (!t || !st) return;
  const ok = await tun(() => B.zooKaufen(id), { zu: true, ok: `${t.name} ist eingezogen`, lokal: () => {
    S.d.zoo.tiere.push({ mitglied_id: S.ich, tier: id, wie: 'gekauft', futter: t.futter, am: new Date().toISOString() });
    st.futter -= t.futter;
    S.tab = 'familie'; S.fam = 'zoo'; S.zooVon = S.ich;
    S.frisch = { id: 'zoo-' + id, bis: Date.now() + 1600 };
  } });
  if (!ok) return;
  klang('sieg');
  konfetti(['#F5B841', '#FFD97A', '#A6D677', '#FFFFFF', ich().farbe]);
  setTimeout(() => { const neu = document.querySelector('.zoo-tier.neu'); if (neu) neu.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
};
A.zooHerz = id => {
  const st = S.d.zoo && S.d.zoo.stand.find(x => x.mitglied_id === id);
  if (!st || st.herz_heute) return;
  klang('haken');
  return tun(() => B.zooHerz(id), { ok: 'Herz dagelassen', lokal: () => { st.herz_heute = true; st.herzen += 1; } });
};

// ------------------------------------------------------------ Von einer Nachricht an die richtige Stelle

// ziel kommt aus der Datenbank ('aufgabe:<id>', 'termin:<id>', 'einkauf', ...). Fehlt es, hilft die Art der Nachricht.
const NACH_ART = { neu: 'aufgaben', erledigt: 'heute', bestaetigt: 'aufgaben', verpasst: 'aufgaben', erinnerung: 'heute',
  einkauf: 'einkauf', joker: 'heute', termine: 'kalender', merk: 'merk', woche: 'woche', zoo: 'zoo' };

function zuZiel(ziel, art) {
  if (!bereit || S.phase !== 'app') { offenesZiel = { ziel, art }; return; }
  const [was, id] = String(ziel || '').split(':');
  const wohin = was || NACH_ART[art] || 'heute';
  if (S.feier) { clearTimeout(S.feier.uhr); S.feier = null; }
  S.sheet = null;
  if (wohin === 'aufgabe') {
    const a = aufgabe(id);
    if (!a) return geh({ tab: 'aufgaben' });
    S.tab = 'aufgaben';
    S.seg = a.art === 'woche' ? 'woche' : a.art === 'irgendwann' ? 'irgendwann' : 'tag';
    return A.auf(id);
  }
  if (wohin === 'termin') {
    const h = heute();
    let tag = h;
    for (let i = 0; i < 400; i++) { const t = plus(h, i); if (termineAm(t).some(e => e.id === id)) { tag = t; break; } }
    return geh({ tab: 'kalender', kal: 'alle', tag });
  }
  if (wohin === 'woche') { render(); return A.feierAuf(); }
  if (wohin === 'spar') { S.tab = 'familie'; S.fam = 'spar'; return schwein(id) ? A.schweinAuf(id) : render(); }
  if (wohin === 'einkauf') return A.geh({ tab: 'einkauf' });
  if (wohin === 'merk') return geh({ tab: 'familie', fam: 'merk' });
  if (wohin === 'zoo') return geh({ tab: 'familie', fam: 'zoo', zooVon: S.ich });
  if (wohin === 'kalender') return geh({ tab: 'kalender' });
  if (wohin === 'aufgaben') return geh({ tab: 'aufgaben', seg: 'tag' });
  if (wohin === 'irgendwann') return geh({ tab: 'aufgaben', seg: 'irgendwann' });
  return geh({ tab: 'heute' });
}
export const oeffne = zuZiel;       // für main.js: angetippte Push-Nachricht
A.zuPost = id => { const p = S.d.post.find(x => x.id === id); if (p) zuZiel(p.ziel, p.art); };

// ------------------------------------------------------------ Wochenabschluss

const feierGesehen = () => 'zoo_feier_' + S.ich;

// Zeigt den Abschluss der letzten Woche einmal von selbst, sobald die App offen ist und nichts anderes im Weg steht.
function feierPruefen() {
  const e = S.d.endstand;
  if (!e || S.phase !== 'app' || S.feier || S.sheet || document.hidden) return;
  if (B.demo ? !new URLSearchParams(location.search).has('feier') || lager.lies('zoo_feier_demo') === e.woche : lager.lies(feierGesehen()) === e.woche) return;
  feierStart(e);
}

function feierStart(e) {
  const f = S.feier = { woche: e.woche, reihen: e.reihen, fertig: matchMedia('(prefers-reduced-motion: reduce)').matches, knall: false, uhr: 0 };
  S.sheet = null;
  render();
  if (!f.fertig) f.uhr = setTimeout(() => feierKnall(f), feierPlan(f).sieg * 1000);
}

function feierKnall(f) {
  if (S.feier !== f || f.knall) return;
  f.knall = true;
  const sieger = feierPlan(f).sieger.map(r => P(r.mitglied_id).farbe);
  if (sieger.length) klang('sieg');
  if (sieger.length) konfetti([...sieger, ...sieger, '#F5B841', '#FFD97A', '#FFFFFF', ...S.d.mitglieder.map(m => m.farbe)]);
}

A.feierAuf = () => { if (S.d.endstand && !S.feier) feierStart(S.d.endstand); };
A.feierTipp = () => {                                               // Tippen springt ans Ende
  const f = S.feier;
  if (!f || f.fertig) return;
  f.fertig = true;
  clearTimeout(f.uhr);
  render();
  feierKnall(f);
};
A.feierZu = () => {
  const f = S.feier;
  if (!f) return;
  clearTimeout(f.uhr);
  lager.setz(B.demo ? 'zoo_feier_demo' : feierGesehen(), f.woche);
  // Wer gewonnen hat, sieht die Karte auf den eigenen Stapel fliegen: dafür muss der Stapel im Bild sein.
  const stapel = document.querySelector('.screen .stapel');
  if (stapel && f.reihen.some(r => r.mitglied_id === S.ich && r.joker)) stapel.scrollIntoView({ block: 'center' });
  S.feier = null;
  render();
};

// ------------------------------------------------------------ Einstellungen

const meinEintrag = () => S.d.mitglieder.find(m => m.id === S.ich);

A.einstAuf = () => { pushStand().then(render); return geh({ sheet: { k: 'einst' } }); };

// ---------- Push auf diesem Gerät
// Auf dem iPhone geht Push nur, wenn die App auf dem Home-Bildschirm liegt, und nur nach einem Tipp des Menschen.
const pushMoeglich = () => !B.demo && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const anmeldung = async () => (await navigator.serviceWorker.ready).pushManager;
const bytes = b64 => Uint8Array.from(atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function pushStand() {
  if (!pushMoeglich()) { S.push = 'geht-nicht'; return; }
  if (Notification.permission === 'denied') { S.push = 'gesperrt'; return; }
  try { S.push = (await (await anmeldung()).getSubscription()) ? 'an' : 'aus'; } catch { S.push = 'geht-nicht'; }
}
async function pushAbmelden() {
  if (!pushMoeglich()) return;
  try {
    const abo = await (await anmeldung()).getSubscription();
    if (!abo) return;
    await B.pushWeg(abo.endpoint).catch(() => {});
    await abo.unsubscribe();
  } catch { /* dann bleibt es eben */ }
}
A.pushGeraet = async () => {
  if (S.push === 'geht-nicht') return melde('Push geht nur in der App auf dem Home-Bildschirm');
  if (S.push === 'gesperrt') return melde('Mitteilungen sind in den iPhone-Einstellungen gesperrt');
  try {
    if (S.push === 'an') { await pushAbmelden(); S.push = 'aus'; melde('Push auf diesem Gerät ist aus'); return render(); }
    if (await Notification.requestPermission() !== 'granted') { await pushStand(); return render(); }
    const abo = (await (await anmeldung()).subscribe({ userVisibleOnly: true, applicationServerKey: bytes(VAPID) })).toJSON();
    await B.pushSpeichern({ mitglied_id: S.ich, endpoint: abo.endpoint, p256dh: abo.keys.p256dh, auth: abo.keys.auth });
    S.push = 'an'; melde('Push auf diesem Gerät ist an');
  } catch (e) { melde('Push ließ sich nicht einschalten: ' + (e.message || e)); await pushStand(); }
  render();
};
A.setzTier = t => { const m = meinEintrag(); if (m) return tun(() => B.profilAendern({ tier: t, bild_pfad: '' }), { lokal: () => { m.tier = t; m.bild_pfad = null; } }); };
A.setzFarbe = f => { const m = meinEintrag(); if (m) return tun(() => B.profilAendern({ farbe: f }), { lokal: () => { m.farbe = f; } }); };
A.setzFoto = async () => {
  const m = meinEintrag(), bild = m && await bildWaehlen(false, 400, true);
  if (!bild) return;
  melde('Foto wird gespeichert …');
  try {
    const pfad = await B.fotoHoch('profilbilder', bild, S.ich);
    await tun(() => B.profilAendern({ bild_pfad: pfad }), { ok: 'Foto gespeichert', lokal: () => { m.bild_pfad = pfad; } });
  } catch (e) { melde(e.message); }
};
A.pushUm = k => {
  const m = meinEintrag();
  if (!m) return;
  const neu = { ...(m.mitteilungen || {}) };
  neu[k] = neu[k] === false;                          // aus -> an, sonst -> aus
  return tun(() => B.profilAendern({ mitteilungen: neu }), { lokal: () => { m.mitteilungen = neu; } });
};
A.abendZeit = n => {
  const m = meinEintrag();
  if (!m) return;
  const neu = { ...(m.mitteilungen || {}), abend: n };
  return tun(() => B.profilAendern({ mitteilungen: neu }), { lokal: () => { m.mitteilungen = neu; } });
};
A.codeAuf = () => geh({ sheet: { k: 'code', fuer: S.ich, pin: '' } });
A.codeSetzen = () => {
  const s = S.sheet;
  if (!/^\d{4}$/.test(s.pin || '')) return melde('Der Code braucht genau 4 Ziffern');
  return tun(() => B.codeSetzen(s.fuer, s.pin), { zu: true, ok: s.fuer === S.ich ? 'Dein Code ist geändert' : `Neuer Code für ${P(s.fuer).name} gespeichert` });
};
A.abmelden = async () => {
  await pushAbmelden();                                // sonst bekäme das Gerät weiter die Nachrichten dieser Person
  try { await B.abmelden(); } catch (e) { return melde(e.message); }
  await raus();
};
A.postGelesen = () => tun(() => B.postGelesen(), { lokal: () => { S.d.post = []; } });
