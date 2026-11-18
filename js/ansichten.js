// Alle Ansichten. Jede Funktion liest den Zustand und liefert HTML als Text.
// Knöpfe rufen Aktionen über das globale Objekt A auf (siehe aktionen.js).
// In onclick stehen nur Kennungen und feste Werte, nie von Menschen eingegebener Text.
import { S, P, ich, eltern, runde, buendeln, darfPruefen, andereEltern } from './zustand.js';
import { toeneAn } from './kern.js';
import {
  esc, euro, heute, plus, montag, tagVon, iso, wocheEnde, fmtLang, fmtKurz, fmtDatum, fmtMonat, fmtZeit,
  wochentagKurz, relTag, relKurz, fmtTag, PUNKTE, ABZUG, wert, aufzaehlen, MAX_FOTOS, fotosVon, fotoText, KREUZ, POKAL, TIERE, FARBEN, WOCHENTAGE, HAKEN, MIKRO, KAMERA, FLAMME, LOB, ALLE, ICON, TABS,
  SELTEN, LEBENSRAUM, FUTTER, HERZ, zahl,
} from './hilfen.js';
import { ZOO_TIERE, ZOO_RASTER, ZOO_OBEN } from './zoo_katalog.js';

// ------------------------------------------------------------ Bausteine

// Fotos vor dem Hochladen: kleine Vorschauen, jede lässt sich wieder entfernen. Das Plus holt das nächste Foto.
const fotoLeiste = bilder => `<div class="fotoleiste">${bilder.map((b, i) =>
  `<span class="mini"><img src="${esc(b.url)}" alt="Foto ${i + 1}"><button onclick="A.fotoWeg(${i})" aria-label="Foto ${i + 1} entfernen">${KREUZ}</button></span>`).join('')}${
  bilder.length < MAX_FOTOS ? `<button class="mini dazu" onclick="A.fotoDazu()" aria-label="Noch ein Foto">+</button>` : ''}</div>`;

// Fotos ansehen: eins steht groß da, mehrere liegen nebeneinander zum Wischen. Antippen zeigt sie über die ganze Seite.
function galerie(urls, n, alt) {
  if (!urls) return `<div class="beweis laedt">${n > 1 ? 'Fotos werden' : 'Foto wird'} geladen …</div>`;
  const bild = (u, i) => `<button class="bild" onclick="A.gross(${i})" aria-label="${urls.length > 1 ? `Foto ${i + 1} von ${urls.length}` : 'Foto'} groß ansehen"><img class="beweis" src="${esc(u)}" alt="${alt}"></button>`;
  return urls.length > 1 ? `<div class="bilder">${urls.map(bild).join('')}</div><p class="hinweis mittig">${urls.length} Fotos. Wische zur Seite.</p>` : urls.map(bild).join('');
}

export const tier = (m, g = '') => `<span class="tier ${g}" style="--c:${esc(m.farbe)}" aria-hidden="true">${
  m.vorschau ? `<img src="${esc(m.vorschau)}" alt="">`
    : m.bild_pfad ? `<img src="${esc(S.bildUrl(m.bild_pfad))}" alt="">` : esc(m.tier)}</span>`;

const liste = (zeilen, leer = '') =>
  `<div class="liste">${zeilen.length ? zeilen.join('') : `<div class="leer">${leer}</div>`}</div>`;

const schalter = (key, opts) => `<div class="schalter ${opts.length > 3 ? 'vier' : ''}">${opts.map(([v, l]) =>
  `<button class="${S[key] === v ? 'an' : ''}" onclick="A.geh({${key}:'${v}'})">${l}</button>`).join('')}</div>`;

const blattSchalter = (key, opts) => `<div class="schalter im-blatt">${opts.map(([v, l]) =>
  `<button class="${S.sheet[key] === v ? 'an' : ''}" onclick="A.blattSetz('${key}','${v}')">${l}</button>`).join('')}</div>`;

const kipp = an => `<span class="kipp ${an ? 'an' : ''}"></span>`;
const klein = t => t.charAt(0).toLowerCase() + t.slice(1);
const frisch = id => !!S.frisch && S.frisch.id === id && Date.now() < S.frisch.bis;
const RANG = { offen: 0, wartet: 1, erledigt: 2, entfallen: 3, verpasst: 3, abgelehnt: 3 };
const sortiert = l => [...l].sort((a, b) => RANG[a.status] - RANG[b.status]);
const FERTIG = ['erledigt', 'verpasst', 'entfallen', 'abgelehnt'];
const ART = { tag: 'Tagesaufgabe', woche: 'Wochenaufgabe', irgendwann: 'Aufgabe ohne Datum', frei: 'Freiwillige Aufgabe' };
const gross = t => t.charAt(0).toUpperCase() + t.slice(1);
const pfeil = '<span class="info" aria-hidden="true">›</span>';
// Ein Textfeld mit Mikrofon-Knopf: antippen und sprechen statt tippen.
const sprechFeld = (feld, id) => `<div class="sprech">${feld}<button class="mikro ${S.hoert ? 'an' : ''}" onclick="A.sprich('${id}')"
  aria-label="${S.hoert ? 'Zuhören beenden' : 'Einsprechen statt tippen'}">${MIKRO}</button></div>`;

// Wann wiederholt sich eine Serie? "jeden Tag", "Montag bis Freitag", "Mo, Mi, Fr" ...
function serieText(x) {
  if (x.art === 'woche') return 'jede Woche';
  const t = [...(x.tage || [])].sort((a, b) => a - b).join('');
  if (t === '1234567') return 'jeden Tag';
  if (t === '12345') return 'Montag bis Freitag';
  if (t === '67') return 'am Wochenende';
  return WOCHENTAGE.filter(([n]) => (x.tage || []).includes(n)).map(([, l]) => l).join(', ');
}

const serieWer = x => !x.fuer ? 'Für alle' : aufzaehlen([x.fuer, ...(x.mit || [])].map(id => P(id).name));

// ------------------------------------------------------------ Termine eines Tages (mit Wiederholungen)

const minuten = e => { const d = new Date(e.beginn); return e.ganztags ? -1 : d.getHours() * 60 + d.getMinutes(); };

export function termineAm(tag) {
  const t = tagVon(tag);
  return S.d.termine.filter(e => {
    const b = new Date(e.beginn), erster = iso(b);
    if (e.wiederholung === 'nie' || !e.wiederholung) return erster === tag;
    if (tag < erster) return false;
    if (e.wiederholung === 'woechentlich') return b.getDay() === t.getDay();
    if (e.wiederholung === 'monatlich') return b.getDate() === t.getDate();
    if (e.wiederholung === 'jaehrlich') return b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
    return false;
  }).sort((a, b) => minuten(a) - minuten(b));
}

// ------------------------------------------------------------ Aufgaben-Zeile

export function aufgabeInfo(a) {
  const h = heute();
  switch (a.status) {
    case 'erledigt': return wert(a) && a.art !== 'frei' ? `Erledigt, +${wert(a)}` : 'Erledigt';
    case 'wartet': return 'Wartet auf Bestätigung';
    case 'verpasst': return `Verpasst, −${ABZUG[a.art] || 0}`;
    case 'entfallen': return a.fuer ? 'Entfällt, Joker eingelöst' : 'Hat niemand gemacht';
    case 'abgelehnt': return 'Nicht anerkannt';
  }
  if (!a.fuer) return (a.art === 'woche' ? 'Bis Sonntag. ' : a.faellig === plus(h, 1) ? 'Morgen. ' : '')
    + (!wert(a) ? 'Wer zuerst kommt, erledigt sie' : 'Wer zuerst kommt, bekommt ' + (wert(a) === 1 ? 'den Punkt' : `${wert(a)} Punkte`));
  if (a.hinweis) return 'Noch einmal: ' + esc(a.hinweis);
  if (a.art === 'woche') return 'Bis Sonntag, 18 Uhr';
  if (a.art === 'irgendwann') return 'Ohne Datum';
  if (a.faellig === h) return a.verschoben ? 'Heute, von gestern verschoben' : 'Heute';
  if (a.faellig === plus(h, 1)) return a.verschoben ? 'Auf morgen verschoben' : 'Morgen';
  return a.faellig ? fmtKurz(a.faellig) : '';
}

function aufgabeZeile(a, mitTier) {
  const m = a.fuer ? P(a.fuer) : ALLE, meine = a.fuer === S.ich;
  // Gemeinsame Aufgabe: in der eigenen Liste steht, mit wem. In fremden Listen stehen alle Namen in einer Zeile.
  const teile = runde(a), zus = teile.length > 1, mitWem = teile.filter(x => x.fuer !== a.fuer).map(x => P(x.fuer).name);
  const zusText = !zus ? '' : teile.length > 2 && teile.length >= S.d.mitglieder.length ? 'alle zusammen'
    : mitTier ? 'zusammen' : 'mit ' + (mitWem.length > 2 ? `${mitWem.length} anderen` : aufzaehlen(mitWem));
  const wer = zus && mitTier ? aufzaehlen(teile.map(x => P(x.fuer).name)) : m.name;
  const stand = a.status === 'erledigt' ? 'erledigt' : a.status === 'wartet' ? 'wartet' : '';
  const info = aufgabeInfo(a);
  const marken = (a.art === 'frei' ? '<span class="marke">freiwillig</span>' : '')
    + (a.foto_pflicht && a.status === 'offen' ? '<span class="marke">mit Foto</span>' : '')
    + (a.foto_pfad && a.status === 'wartet' ? `<span class="marke">${fotoText(fotosVon(a).length)}</span>` : '')
    + (a.fuer_alle && a.fuer ? '<span class="marke">für alle</span>' : '')
    + (zus ? `<span class="marke">${esc(zusText)}</span>` : '')
    + (a.ohne_punkte && !FERTIG.includes(a.status) ? '<span class="marke">ohne Punkte</span>' : '');
  let rechts = !mitTier ? '' : zus ? teile.slice(0, 3).map(x => tier(P(x.fuer), 'klein')).join('') : tier(m, 'klein');
  if (darfPruefen(a)) {
    rechts = `<button class="pille ja" onclick="A.bestaetige('${a.id}')">Bestätigen</button>`;
  } else if (a.status === 'offen' && meine && !zus && a.art === 'tag' && !a.verschoben && a.faellig === heute()) {
    rechts = `<button class="pille" onclick="A.morgen('${a.id}')">Auf morgen</button>`;
  }
  return `<div class="zeile ${FERTIG.includes(a.status) ? 'fertig' : ''}" style="view-transition-name:a-${a.id}">
    <button class="haken ${stand} ${frisch(a.id) ? 'frisch' : ''}" style="--c:${esc(m.farbe)}" onclick="A.abhaken('${a.id}')" aria-label="${esc(a.titel)} abhaken">${HAKEN}</button>
    <button class="mitte" onclick="A.auf('${a.id}')"><span class="titel">${esc(a.titel)}${marken}</span><span class="info">${mitTier ? esc(wer) + ', ' + klein(info) : info}</span>${a.notiz && a.status === 'offen' ? `<span class="info notiz">${esc(a.notiz)}</span>` : ''}</button>
    ${rechts}</div>`;
}

function terminZeile(e, tag) {
  const alle = S.d.mitglieder.length > 1 && e.fuer.length >= S.d.mitglieder.length;
  const meiner = e.fuer.includes(S.ich);
  const c = meiner ? ich().farbe : P(e.fuer[0]).farbe;
  const wer = alle ? 'Alle' : e.fuer.map(id => P(id).name).join(', ');
  const zeit = e.ganztags ? '<span class="zeit tag">ganzer<br>Tag</span>' : `<span class="zeit">${fmtZeit(new Date(e.beginn))}</span>`;
  return `<button class="zeile ${meiner ? 'meins' : ''}" style="--c:${esc(c)}" onclick="A.terminAuf('${e.id}')">${zeit}
    <span class="mitte termin"><span class="titel">${esc(e.titel)}</span><span class="info">${tag ? fmtKurz(tag) + ', ' : ''}${esc(wer)}</span></span>
    ${alle ? '' : e.fuer.slice(0, 3).map(id => tier(P(id), 'klein')).join('')}</button>`;
}

function jokerKarte() {
  const n = (S.d.best.find(b => b.mitglied_id === S.ich) || {}).joker || 0;
  if (!n) return '';
  // Die oberste Karte ist unsichtbar, solange sie groß zu sehen ist (im Joker-Blatt oder beim Wochenabschluss).
  const offen = (S.sheet && S.sheet.k === 'joker') || (S.feier && S.feier.reihen.some(r => r.mitglied_id === S.ich && r.joker));
  const zahl = Math.min(n, 3);
  const heuteSchon = S.d.jokerHeute.includes(S.ich);
  const karten = Array.from({ length: zahl }, (_, i) =>
    `<img src="icons/joker.webp" alt="" style="${i === zahl - 1 ? (offen ? 'opacity:0' : 'view-transition-name:jokerkarte') : ''}">`).join('');
  return `<h2>Deine Joker</h2><button class="jokerfeld" onclick="A.jokerAuf()"><span class="stapel">${karten}</span>
    <span class="mitte"><b>${n} Joker-${n > 1 ? 'Karten' : 'Karte'}</b><span class="info">${heuteSchon ? 'Heute hast du schon einen eingelöst.' : 'Ein Tag ohne Tagesaufgaben'}</span>
    ${heuteSchon ? '' : '<span class="pille ja">Einlösen</span>'}</span></button>`;
}

// ------------------------------------------------------------ Anmeldung

const vLaden = () => `<div class="screen ganz"><div class="tor"><img class="marke-logo puls" src="icons/logo.webp" alt="Streichelzoo wird geladen"></div></div>`;

const vFehler = () => `<div class="screen ganz"><div class="tor"><img class="marke-logo" src="icons/logo.webp" alt="">
  <h1 class="kleiner">Keine Verbindung</h1><p class="unter">${esc(S.fehler || 'Prüfe dein Internet und versuch es noch einmal.')}</p>
  <button class="knopf schmal" onclick="A.neustart()">Noch einmal versuchen</button></div></div>`;

function vTor() {
  const p = S.profile;
  const frage = S.demo ? 'Demo. Nichts wird gespeichert.' : p.length ? 'Wer bist du?' : 'Willkommen. Leg das erste Profil an.';
  return `<div class="tor ${S.start ? 'start' : ''}"><img class="marke-logo" src="icons/logo.webp" alt="">
    <h1>Streichelzoo</h1><p class="unter">${frage}</p>
    ${p.length ? `<div class="gehege">${p.map(m => `<button onclick="A.waehle('${m.id}')">${tier(m, 'gross')}${esc(m.name)}<small>${m.rolle === 'eltern' ? 'Elternteil' : 'Kind'}</small></button>`).join('')}</div>` : ''}
    <button class="knopf ${p.length ? 'still' : ''} schmal" onclick="A.neuStart()">Neues Profil</button></div>`;
}

function vPin() {
  const m = P(S.pinFuer);
  return `<div class="tor">${tier(m, 'gross')}<h1 class="kleiner">Hallo ${esc(m.name)}</h1>
    <p class="unter ${S.pinFehler ? 'fehler' : ''}" role="status">${esc(S.pinFehler || 'Gib deinen Code ein')}</p>
    <div class="punkte ${Date.now() < S.pinWackel ? 'wackel' : ''}">${[0, 1, 2, 3].map(i => `<i class="${i < S.pin.length ? 'voll' : ''}"></i>`).join('')}</div>
    <div class="tasten">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(z => `<button onclick="A.taste('${z}')">${z}</button>`).join('')}
      <button class="leerfeld" onclick="A.zurueck()">Zurück</button><button onclick="A.taste('0')">0</button>
      <button class="leerfeld" onclick="A.loesch()" aria-label="Letzte Ziffer löschen">⌫</button></div>
    <button class="merkzeile" onclick="A.merkenUm()"><span>Code auf diesem Gerät merken</span>${kipp(S.merken)}</button></div>`;
}

function tierWahl(aktuell, hatFoto, setzen, foto) {
  return `<div class="tiere">${TIERE.map(t => `<button class="${!hatFoto && aktuell === t ? 'an' : ''}" onclick="${setzen}('${t}')">${t}</button>`).join('')}
    <button class="foto ${hatFoto ? 'an' : ''}" onclick="${foto}()">Foto</button></div>`;
}
function farbWahl(aktuell, vergeben, setzen) {
  return `<div class="farben">${FARBEN.map(([f, name]) => `<button class="${aktuell === f ? 'an' : ''}" style="--c:${f}" ${vergeben.has(f) ? 'disabled' : ''}
    onclick="${setzen}('${f}')" aria-label="${name}${vergeben.has(f) ? ', schon vergeben' : ''}"></button>`).join('')}</div>`;
}

function vNeu() {
  const n = S.neu, vergeben = new Set(S.profile.map(p => p.farbe));
  return `<div class="neu"><button class="zurueck" onclick="A.zurueck()">‹ Zurück</button>
    <div class="neu-kopf">${tier({ farbe: n.farbe, tier: n.tier, vorschau: n.fotoUrl }, 'gross')}<h1 class="kleiner">Neues Profil</h1></div>
    <p class="klein-titel">Wie heißt du?</p>
    <input class="feld voll hell" value="${esc(n.name)}" oninput="A.entwurf('name', this.value)" placeholder="Dein Vorname" maxlength="30" autocomplete="off" autocapitalize="words">
    <p class="klein-titel">Ich bin</p>
    <div class="schalter im-blatt">${[['kind', 'Kind'], ['eltern', 'Elternteil']].map(([v, l]) => `<button class="${n.rolle === v ? 'an' : ''}" onclick="A.neuSetz('rolle','${v}')">${l}</button>`).join('')}</div>
    <p class="klein-titel">Dein Tier</p>${tierWahl(n.tier, !!n.fotoUrl, 'A.neuTier', 'A.neuFoto')}
    <p class="klein-titel">Deine Farbe</p>${farbWahl(n.farbe, vergeben, 'A.neuFarbe')}
    <p class="klein-titel">Dein Code zum Anmelden (4 Ziffern)</p>
    <input class="feld voll hell" value="${esc(n.pin)}" oninput="A.entwurf('pin', this.value)" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="z. B. 2580">
    <p class="klein-titel">Familiencode</p>
    <input class="feld voll hell" value="${esc(n.familiencode)}" oninput="A.entwurf('familiencode', this.value)" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Den kennt nur eure Familie">
    ${n.rolle === 'eltern' ? `<p class="klein-titel">Eltern-PIN</p>
    <input class="feld voll hell geheim" value="${esc(n.elternPin)}" oninput="A.entwurf('elternPin', this.value)" inputmode="numeric" autocomplete="off" placeholder="Nur für Eltern">` : ''}
    <div class="abstand"><button class="knopf" onclick="A.neuFertig()" ${S.beschaeftigt ? 'disabled' : ''}>${S.beschaeftigt ? 'Einen Moment …' : 'Profil anlegen'}</button></div></div>`;
}

// ------------------------------------------------------------ Heute

function vHeute() {
  const h = heute(), mrg = plus(h, 1), d = S.d, me = S.ich;
  const meine = d.aufgaben.filter(a => a.fuer === me);
  const dran = sortiert(meine.filter(a => (a.art === 'tag' || a.art === 'frei') && (a.faellig === h || a.status === 'wartet')));
  const morgen = meine.filter(a => a.art === 'tag' && a.faellig === mrg && a.status === 'offen');
  const woche = sortiert(meine.filter(a => a.art === 'woche' && (a.faellig === wocheEnde() || a.status === 'wartet')));
  const warten = buendeln(d.aufgaben.filter(darfPruefen));
  const vorschlaege = eltern() ? d.einkauf.filter(k => k.status === 'vorschlag').length : 0;
  const termine = termineAm(h).filter(e => e.fuer.includes(me));
  const sichtbar = eltern() ? ['bestaetigt', 'verpasst', 'joker', 'woche'] : ['bestaetigt', 'verpasst', 'joker', 'woche', 'einkauf'];
  const post = d.post.filter(p => sichtbar.includes(p.art));
  const frei = d.jokerHeute.includes(me);

  const fuerAlle = d.aufgaben.filter(a => !a.fuer && a.status === 'offen' && ((a.art === 'tag' && a.faellig === h) || (a.art === 'woche' && a.faellig === wocheEnde())));
  const serie = (d.best.find(b => b.mitglied_id === me) || {}).serie || 0;

  let s = `<div class="kopf"><div><h1>Hallo ${esc(ich().name)}</h1><p class="unter">${fmtLang(h)}</p>
    ${serie > 1 ? `<p class="serie-zeile">${FLAMME}${serie} Tage in Folge alles erledigt</p>` : ''}</div>
    <button class="feder" onclick="A.einstAuf()" aria-label="Einstellungen">${tier(ich())}</button></div>`;
  if (S.ladeFehler) s += `<p class="banner" role="alert">${esc(S.ladeFehler)}</p>`;

  if (post.length) {
    s += `<h2>Neu für dich</h2>` + liste(post.slice(0, 4).map(p => `<button class="zeile" onclick="A.zuPost('${p.id}')"><span class="punkt"></span>
      <span class="mitte"><span class="titel">${esc(p.titel)}</span>${p.inhalt ? `<span class="info">${esc(p.inhalt)}</span>` : ''}</span>${pfeil}</button>`))
      + `<button class="text-knopf" onclick="A.postGelesen()">${post.length > 4 ? `Alle ${post.length} gelesen` : 'Gelesen'}</button>`;
  }
  if (warten.length || vorschlaege) {
    s += `<h2>Wartet auf dich</h2>` + liste([...warten.map(a => aufgabeZeile(a, true)),
      ...(vorschlaege ? [`<button class="zeile" onclick="A.geh({tab:'einkauf'})"><span class="tier klein" style="--c:var(--wiese)" aria-hidden="true">🧺</span>
        <span class="mitte"><span class="titel">${vorschlaege} ${vorschlaege > 1 ? 'Vorschläge' : 'Vorschlag'} für die Einkaufsliste</span></span><span class="pille">Ansehen</span></button>`] : [])]);
    if (warten.length > 1) s += `<button class="text-knopf" onclick="A.alleBestaetigen()">Alle ${warten.length} bestätigen</button>`;
  }
  s += `<h2>Heute dran</h2>` + liste(dran.map(a => aufgabeZeile(a)), frei ? 'Joker eingelöst. Heute hast du frei.' : 'Heute hast du nichts zu tun.');
  if (fuerAlle.length) s += `<h2>Für alle</h2>` + liste(fuerAlle.map(a => aufgabeZeile(a, true)));
  if (morgen.length) s += `<h2>Morgen</h2>` + liste(morgen.map(a => aufgabeZeile(a)));
  if (woche.length) s += `<h2>Diese Woche</h2>` + liste(woche.map(a => aufgabeZeile(a)));
  if (termine.length) s += `<h2>Deine Termine heute</h2>` + liste(termine.map(e => terminZeile(e)));
  return s + jokerKarte();
}

// ------------------------------------------------------------ Aufgaben

function vAufgaben() {
  const h = heute(), mrg = plus(h, 1), me = S.ich;
  const passt = {
    tag: a => (a.art === 'tag' || a.art === 'frei') && (a.faellig === h || a.faellig === mrg || a.status === 'wartet'),
    woche: a => a.art === 'woche' && (a.faellig === wocheEnde() || a.status === 'wartet'),
    irgendwann: a => a.art === 'irgendwann',
  }[S.seg];
  const alle = sortiert(S.d.aufgaben.filter(passt));
  const meine = alle.filter(a => a.fuer === me), dabei = new Set(meine.map(a => a.gruppe).filter(Boolean));
  const andere = buendeln(alle.filter(a => a.fuer && a.fuer !== me && !dabei.has(a.gruppe)));   // Gemeinsames mit mir steht schon bei „Deine"
  const fuerAlle = alle.filter(a => !a.fuer && a.status === 'offen');
  const darfPlus = eltern() || S.seg === 'irgendwann';

  let s = `<div class="kopf"><h1>Aufgaben</h1>${darfPlus ? `<button class="plus" onclick="A.neuAuf()" aria-label="Aufgabe eintragen">+</button>` : ''}</div>`
    + schalter('seg', [['tag', 'Heute'], ['woche', 'Woche'], ['irgendwann', 'Irgendwann']]);
  s += `<h2 style="margin-top:8px">Deine</h2>` + liste(meine.map(a => aufgabeZeile(a)), 'Hier ist nichts für dich offen.');
  if (fuerAlle.length) s += `<h2>Für alle</h2>` + liste(fuerAlle.map(a => aufgabeZeile(a, true)));
  if (andere.length) s += `<h2>Die anderen</h2>` + liste(andere.map(a => aufgabeZeile(a, true)));
  const serien = eltern() ? S.d.serien.filter(x => x.art === S.seg) : [];
  if (serien.length) {
    s += `<h2>Wiederkehrend</h2>` + liste(serien.map(x => `<button class="zeile" style="view-transition-name:s-${x.id}" onclick="A.serieAuf('${x.id}')">${tier(x.fuer ? P(x.fuer) : ALLE, 'klein')}
      <span class="mitte"><span class="titel">${esc(x.titel)}</span><span class="info">${esc(serieWer(x))}, ${serieText(x)}${x.ohne_punkte ? ', ohne Punkte' : ''}</span></span>${pfeil}</button>`));
  }
  if (S.seg === 'tag') s += `<div class="abstand"><button class="knopf still" onclick="A.freiAuf()">Freiwillig etwas erledigt?</button></div>`;
  return s;
}

// ------------------------------------------------------------ Einkauf

function vEinkauf() {
  const k = S.d.einkauf;
  const L = k.filter(x => x.status === 'liste'), G = k.filter(x => x.status === 'gekauft');
  const V = k.filter(x => x.status === 'vorschlag'), A_ = k.filter(x => x.status === 'abgelehnt' && x.von === S.ich);
  const wunsch = x => x.entschieden_von && x.von && x.von !== x.entschieden_von
    ? `Wunsch von ${esc(P(x.von).name)}, angenommen von ${esc(P(x.entschieden_von).name)}` : '';
  const bild = x => x.foto_pfad ? `<button class="pille" onclick="A.kaufBild('${x.id}')">${fotoText(fotosVon(x).length)}</button>` : '';

  const n = S.wartetAufNetz;
  const netz = n ? `<p class="banner ruhig" role="status">Kein Netz. ${n === 1 ? '1 Haken ist' : `${n} Haken sind`} gemerkt und ${n === 1 ? 'wird' : 'werden'} übertragen, sobald du wieder Empfang hast.</p>` : '';

  // Im Laden: nur die Liste, groß, die ganze Zeile hakt ab. Der Bildschirm bleibt an.
  if (S.imLaden && eltern()) {
    const gross = x => `<button class="zeile laden ${x.status === 'gekauft' ? 'fertig' : ''}" style="view-transition-name:k-${x.id}" onclick="A.kaufUm('${x.id}')" aria-label="${esc(x.titel)} abhaken">
      <span class="haken ${x.status === 'gekauft' ? 'erledigt' : ''} ${frisch(x.id) ? 'frisch' : ''}">${HAKEN}</span>
      <span class="mitte"><span class="titel">${esc(x.titel)}</span>${wunsch(x) ? `<span class="info">${wunsch(x)}</span>` : ''}</span><span class="info">${esc(x.menge)}</span></button>`;
    return `<div class="kopf"><div><h1>Im Laden</h1><p class="unter">${L.length ? `Noch ${L.length} ${L.length === 1 ? 'Sache' : 'Sachen'}` : 'Alles im Korb'}</p></div>
      <button class="pille ja" onclick="A.ladenAus()">Fertig</button></div>
      ${netz}<div class="abstand">${liste(L.map(gross), 'Alles eingekauft.')}</div>
      ${G.length ? `<h2>Im Korb</h2>` + liste(G.map(gross)) : ''}`;
  }

  const kauf = x => `<div class="zeile ${x.status === 'gekauft' ? 'fertig' : ''}" style="view-transition-name:k-${x.id}">
    <button class="haken ${x.status === 'gekauft' ? 'erledigt' : ''} ${frisch(x.id) ? 'frisch' : ''}" onclick="A.kaufUm('${x.id}')" aria-label="${esc(x.titel)} abhaken">${HAKEN}</button>
    <button class="mitte" onclick="A.kaufAuf('${x.id}')"><span class="titel">${esc(x.titel)}</span>${wunsch(x) ? `<span class="info">${wunsch(x)}</span>` : ''}</button>${bild(x)}<span class="info">${esc(x.menge)}</span></div>`;
  const vorschlag = x => `<div class="zeile" style="view-transition-name:k-${x.id}">${tier(P(x.von), 'klein')}
    <div class="mitte"><span class="titel">${esc(x.titel)}${x.menge ? ` <span class="marke">${esc(x.menge)}</span>` : ''}</span>
    <span class="info">${x.von === S.ich ? 'Von dir, wartet auf Antwort' : 'Von ' + esc(P(x.von).name)}</span></div>${bild(x)}
    ${eltern() ? `<button class="pille nein" onclick="A.kaufNeinAuf('${x.id}')">Nein</button><button class="pille ja" onclick="A.kaufJa('${x.id}')">Ja</button>`
      : x.von === S.ich ? `<button class="pille" onclick="A.kaufWeg('${x.id}')">Zurückziehen</button>` : ''}</div>`;

  // Vorschläge: was ihr oft kauft und was gerade nicht auf der Liste steht. Beim Tippen nur noch, was dazu passt.
  const da = new Set([...L, ...V].map(x => x.titel.trim().toLowerCase())), such = (S.kaufT || '').trim().toLowerCase();
  const oft = S.kaufOft.filter(t => { const n = t.toLowerCase(); return !da.has(n) && (!such || (n.includes(such) && n !== such)); }).slice(0, 8);

  let s = `<div class="kopf"><h1>Einkaufsliste</h1></div>
    <div class="eingabe" style="margin:16px 0 4px">
      <div class="sprech"><input class="feld hell" id="kauf" value="${esc(S.kaufT)}" oninput="A.kaufTippen(this.value)" onkeydown="if(event.key==='Enter')A.kaufNeu()"
        placeholder="${eltern() ? 'Was fehlt?' : 'Was wünschst du dir?'}" aria-label="Artikel" maxlength="80" enterkeyhint="done" autocomplete="off">
        <button class="mikro ${S.kaufBilder.length ? 'dabei' : ''}" onclick="A.fotoDazu()" aria-label="${S.kaufBilder.length ? 'Noch ein Foto dazu' : 'Foto dazu'}">${KAMERA}</button></div>
      <input class="feld hell" id="menge" value="${esc(S.kaufM)}" oninput="A.setz('kaufM', this.value)" onkeydown="if(event.key==='Enter')A.kaufNeu()"
        placeholder="Menge" style="flex:0 0 78px" aria-label="Menge" maxlength="12" enterkeyhint="done" autocomplete="off">
      <button class="knopf" onclick="A.kaufNeu()">${eltern() ? 'Dazu' : 'Vorschlagen'}</button></div>`;
  if (S.kaufBilder.length) s += fotoLeiste(S.kaufBilder) + `<p class="hinweis">${S.kaufBilder.length > 1 ? 'Die Fotos hängen' : 'Das Foto hängt'} am nächsten Eintrag.</p>`;
  if (oft.length) s += `<div class="chips oft" aria-label="Oft gekauft">${oft.map(t =>
    `<button class="chip nur" data-t="${esc(t)}" onclick="A.kaufSchnell(this.dataset.t)" aria-label="${esc(t)} ${eltern() ? 'auf die Liste setzen' : 'vorschlagen'}"><span aria-hidden="true">+</span>${esc(t)}</button>`).join('')}</div>`;
  if (V.length) s += `<h2>Vorschläge</h2>` + liste(V.map(vorschlag));
  s += netz + `<h2>Zu kaufen</h2>` + liste(L.map(kauf), 'Alles eingekauft.');
  if (eltern() && L.length) s += `<div class="abstand"><button class="knopf still" onclick="A.ladenAn()">Ich gehe einkaufen</button></div>`;
  if (A_.length) s += `<h2>Abgelehnt</h2>` + liste(A_.map(x => `<div class="zeile" style="view-transition-name:k-${x.id}">${tier(P(x.von), 'klein')}
    <div class="mitte"><span class="titel">${esc(x.titel)}</span><span class="info">${x.entschieden_von
      ? `Abgelehnt von ${esc(P(x.entschieden_von).name)}${x.grund ? ': ' + esc(x.grund) : ''}` : esc(x.grund || 'Ohne Begründung')}</span></div></div>`));
  if (G.length) s += `<h2>Schon im Korb</h2>` + liste(G.map(kauf))
    + (eltern() ? `<button class="text-knopf" onclick="A.kaufAufraeumen()">Korb leeren</button>` : '');
  return s;
}

// ------------------------------------------------------------ Kalender

function vKalender() {
  const h = heute(), mo = montag(S.tag), tage = [0, 1, 2, 3, 4, 5, 6].map(i => plus(mo, i));
  const sicht = e => S.kal === 'alle' || e.fuer.includes(S.ich);
  const amTag = termineAm(S.tag).filter(sicht);
  const danach = [];
  for (let i = 1; i <= 28 && danach.length < 6; i++) {
    const t = plus(S.tag, i);
    for (const e of termineAm(t).filter(sicht)) if (danach.length < 6) danach.push([t, e]);
  }
  return `<div class="kopf"><h1>Kalender</h1><button class="plus" onclick="A.terminAuf()" aria-label="Termin eintragen">+</button></div>
    ${schalter('kal', [['alle', 'Ganze Familie'], ['ich', 'Nur meine']])}
    <div class="monat"><button class="pfeil" onclick="A.woche(-1)" aria-label="Eine Woche zurück">‹</button><span>${fmtMonat(S.tag)}</span>
      ${mo !== montag(h) ? `<button class="pille" onclick="A.tagWahl('${h}')">Heute</button>` : ''}
      <button class="pfeil" onclick="A.woche(1)" aria-label="Eine Woche weiter">›</button></div>
    <div class="woche">${tage.map(t => `<button class="${S.tag === t ? 'an' : ''} ${t === h ? 'heute' : ''}" onclick="A.tagWahl('${t}')" aria-label="${fmtLang(t)}">
      ${wochentagKurz(t)}<b>${tagVon(t).getDate()}</b><i class="${termineAm(t).some(sicht) ? 'da' : ''}"></i></button>`).join('')}</div>
    <h2>${relTag(S.tag)}</h2>${liste(amTag.map(e => terminZeile(e)), 'An diesem Tag ist nichts geplant.')}
    ${danach.length ? `<h2>Danach</h2>` + liste(danach.map(([t, e]) => terminZeile(e, t))) : ''}`;
}


// ------------------------------------------------------------ Zoo
// Jede Zelle besteht aus drei Bildern übereinander (Boden, Gehege, Tier), alle mit derselben Kamera gerendert
// (blender/zoo_app_render.py). Die Zellen liegen im Zickzack: eine in der Mitte, dann zwei nebeneinander, und so weiter.

const zooTier = id => ZOO_TIERE.find(t => t.id === id);
const zellPlatz = n => { const k = Math.floor(n / 3), r = n % 3; return r === 0 ? [0, 2 * k] : [r === 1 ? -1 : 1, 2 * k + 1]; };
const genitiv = name => /[sßxz]$/i.test(name) ? name + '’' : name + 's';
const ZIEL_ZEICHEN = { flamme: FLAMME, woche: POKAL };

function zielStand(t, st) {
  const [art, soll] = t.ziel.split('_');
  const ist = { flamme: st.flamme, woche: st.siege, aufgaben: st.aufgaben, perfekt: st.perfekt, familie: st.familie }[art] || 0;
  return { art, ist: Math.min(ist, Number(soll)), soll: Number(soll) };
}

function zooBild(tiere, wer, eigen, muede) {
  let n = Math.max(3, tiere.length + (eigen ? 1 : 0));
  if (n % 3 === 2) n++;                                    // eine angefangene Doppelreihe auffüllen
  const R = ZOO_RASTER, B = R.bild, dx = R.x[0], dy = R.x[1];
  // Oben beginnt der Zoo mit dem höchsten Ding (Baum, Giraffe), nicht mit leerem Himmel.
  const teile = i => { const k = tiere[i] && zooTier(tiere[i].tier);
    return k ? ['grund', 'lebensraum/' + k.lebensraum, 'tier/' + k.id] : eigen && i === tiere.length ? ['grund', 'bauplatz'] : ['grund']; };
  let rand = B;
  for (let i = 0; i < n; i++) for (const t of teile(i)) rand = Math.min(rand, zellPlatz(i)[1] * dy + (ZOO_OBEN[t] ?? 0) - 8);
  const W = 2 * dx + B, H = zellPlatz(n - 1)[1] * dy + B - rand;
  const pz = (v, g) => (v / g * 100).toFixed(3) + '%';
  let bilder = '', knoepfe = '';
  for (let i = 0; i < n; i++) {
    const [u, v] = zellPlatz(i), x = dx + u * dx, y = v * dy - rand;
    const lage = `left:${pz(x, W)};top:${pz(y, H)};width:${pz(B, W)}`;
    const ebene = (src, klasse = '', extra = '') => `<img class="zoo-ebene ${klasse}" src="${src}" alt="" style="${lage}${extra}" loading="lazy" decoding="async">`;
    const e = tiere[i], k = e && zooTier(e.tier);
    bilder += ebene('zoo/grund.webp');
    const feld = (aufruf, label) => { knoepfe += `<button class="zoo-feld" style="left:${pz(x + R.mitte[0], W)};top:${pz(y + R.mitte[1] - dy * 0.3, H)};width:${pz(dx * 1.15, W)};height:${pz(dy * 1.5, H)}" onclick="${aufruf}" aria-label="${label}"></button>`; };
    if (k) {
      bilder += ebene(`zoo/lebensraum/${k.lebensraum}.webp`);
      bilder += ebene(`zoo/tier/${k.id}.webp`, `zoo-tier ${muede ? 'muede' : ''} ${frisch('zoo-' + k.id) ? 'neu' : ''}`, `;--n:${i}`);
      feld(`A.zooTierAuf('${k.id}','${wer}')`, esc(k.name));
    } else if (eigen && i === tiere.length) {
      bilder += ebene('zoo/bauplatz.webp');
      feld('A.zooLaden()', 'Neues Tier holen');
    }
  }
  return `<div class="zoo" style="aspect-ratio:${W.toFixed(1)}/${H.toFixed(1)}">${bilder}${knoepfe}</div>`;
}

function vZoo() {
  const z = S.d.zoo;
  if (!z) return `<div class="leer">Der Zoo braucht noch ein Update in Supabase (Datei 11).</div>`;
  const wer = S.d.mitglieder.some(m => m.id === S.zooVon) ? S.zooVon : S.ich, eigen = wer === S.ich, m = P(wer);
  const st = z.stand.find(x => x.mitglied_id === wer) || {};
  const tiere = z.tiere.filter(t => t.mitglied_id === wer);
  const wahl = [...S.d.mitglieder].sort((a, b) => (b.id === S.ich) - (a.id === S.ich)).map(x => `<button class="chip ${x.id === wer ? 'an' : ''}" style="--c:${esc(x.farbe)}" onclick="A.zooVon('${x.id}')">${tier(x, 'klein')}${x.id === S.ich ? 'Mein Zoo' : esc(x.name)}</button>`).join('');
  const knopf = eigen ? `<button class="knopf" onclick="A.zooLaden()">Neues Tier holen</button>`
    : st.herz_heute ? `<button class="knopf still" disabled>${HERZ} Herz dagelassen</button>`
    : `<button class="knopf" onclick="A.zooHerz('${wer}')">${HERZ} Herz dalassen</button>`;
  return `<div class="chips zoo-wahl">${wahl}</div>
    <div class="zoo-zahlen">${eigen ? `<div><b>${FUTTER}${zahl(st.futter)}</b><span>Futter</span></div>` : ''}
      <div><b>${tiere.length}</b><span>von ${ZOO_TIERE.length} Tieren</span></div>
      <div><b>${HERZ}${zahl(st.herzen)}</b><span>${st.herzen === 1 ? 'Herz' : 'Herzen'}</span></div></div>
    ${st.muede ? `<p class="zoo-muede">${eigen ? 'Deine Tiere sind müde. Erledige heute deine Aufgaben, dann geht es ihnen wieder gut.' : `${esc(genitiv(m.name))} Tiere sind heute müde.`}</p>` : ''}
    ${zooBild(tiere, wer, eigen, st.muede)}
    <div class="knoepfe">${knopf}</div>`;
}

// ------------------------------------------------------------ Familie: Zoo, Bestenliste, Sparen, Dran denken

function vFamilie() {
  let s = `<div class="kopf"><h1>Familie</h1></div>` + schalter('fam', [['zoo', 'Zoo'], ['best', 'Bestenliste'], ['spar', 'Sparen'], ['merk', 'Dran denken']]);

  if (S.fam === 'zoo') s += vZoo();

  if (S.fam === 'best') {
    const feld = S.bestArt === 'woche' ? 'woche' : 'gesamt';
    const wert = id => (S.d.best.find(b => b.mitglied_id === id) || {})[feld] || 0;
    const reihe = [...S.d.mitglieder].sort((a, b) => wert(b.id) - wert(a.id));
    const max = Math.max(1, ...reihe.map(m => wert(m.id)));
    s += `<h2>${S.bestArt === 'woche' ? 'Diese Woche' : 'Seit dem Start'}</h2>` + liste(reihe.map(m => {
      const w = wert(m.id), platz = 1 + reihe.filter(x => wert(x.id) > w).length;
      const stand = S.d.best.find(b => b.mitglied_id === m.id) || {}, jk = stand.joker || 0, sr = stand.serie || 0, sg = stand.siege || 0;
      return `<button class="zeile" style="view-transition-name:r-${m.id}" onclick="A.verlaufAuf('${m.id}')"><span class="rang">${platz}</span>${tier(m)}
        <span class="mitte" style="--c:${esc(m.farbe)}"><span class="titel">${esc(m.name)}${m.id === S.ich ? ' (du)' : ''}${sr > 1 ? `<span class="marke heiss" aria-label="${sr} Tage in Folge alles erledigt">${FLAMME}${sr}</span>` : ''}${sg ? `<span class="marke gold" aria-label="${sg} ${sg === 1 ? 'Woche' : 'Wochen'} gewonnen">${POKAL}${sg}</span>` : ''}${jk ? `<span class="marke">${jk} Joker</span>` : ''}</span>
        <span class="balken"><i style="width:${Math.max(w, 0) / max * 100}%"></i></span></span><span class="zahl ${w < 0 ? 'minus' : ''}">${w}</span></button>`;
    }), 'Noch niemand da.');
    const zeichen = [
      S.bestArt === 'woche' && ['<span class="marke">Joker</span>', 'Gewinnt Platz 1 am Sonntag um 18 Uhr'],
      S.d.best.some(b => b.serie > 1) && [`<span class="marke heiss">${FLAMME}</span>`, 'Tage in Folge alles erledigt'],
      S.d.best.some(b => b.siege > 0) && [`<span class="marke gold">${POKAL}</span>`, 'Gewonnene Wochen'],
    ].filter(Boolean);
    s += `${zeichen.length ? `<ul class="legende">${zeichen.map(([z, t]) => `<li><span class="zeichen">${z}</span>${t}</li>`).join('')}</ul>` : ''}
      <div class="knoepfe"><button class="knopf still" onclick="A.geh({bestArt:'${S.bestArt === 'woche' ? 'gesamt' : 'woche'}'})">${S.bestArt === 'woche' ? 'Ewige Bestenliste zeigen' : 'Diese Woche zeigen'}</button>
      ${S.d.endstand ? `<button class="knopf still" onclick="A.feierAuf()">Letzte Woche ansehen</button>` : ''}</div>`
      + jokerKarte();
  }

  if (S.fam === 'spar') {
    s += `<div class="stall">${S.d.schweine.map(p => { const voll = p.ziel_cent && p.stand_cent >= p.ziel_cent; return `<button class="schwein ${voll ? 'voll' : ''} ${frisch(p.id) ? 'huepft' : ''}" onclick="A.schweinAuf('${p.id}')"><span class="nase" aria-hidden="true">🐷</span>
      <span class="titel">${esc(p.name)}</span><span class="summe">${euro(p.stand_cent)}</span>
      ${p.ziel_cent ? `<span class="balken"><i style="width:${Math.min(p.stand_cent / p.ziel_cent, 1) * 100}%"></i></span><span class="von">${voll ? 'Ziel erreicht' : 'von ' + euro(p.ziel_cent)}</span>` : ''}</button>`; }).join('')}
      <button class="schwein neu" onclick="A.neuSchweinAuf()">Neues Sparschwein</button></div>`;
  }

  if (S.fam === 'merk') {
    const offen = S.d.merk.filter(m => !m.erledigt).sort((a, b) => (a.erinnern_am || '9999').localeCompare(b.erinnern_am || '9999'));
    const fertig = S.d.merk.filter(m => m.erledigt);
    s += liste([...offen, ...fertig].map(m => `<div class="zeile ${m.erledigt ? 'fertig' : ''}" style="view-transition-name:d-${m.id}">
      <button class="haken ${m.erledigt ? 'erledigt' : ''} ${frisch(m.id) ? 'frisch' : ''}" onclick="A.merkUm('${m.id}')" aria-label="${esc(m.titel)} abhaken">${HAKEN}</button>
      <div class="mitte"><span class="titel">${esc(m.titel)}</span><span class="info">${m.erinnern_am ? fmtDatum(m.erinnern_am) : 'Ohne Datum'}</span></div>${tier(P(m.von), 'klein')}</div>`),
      'Noch nichts notiert.')
      + `<div class="abstand"><button class="knopf still" onclick="A.merkAuf()">Etwas zum Dran-Denken notieren</button></div>`;
  }
  return s;
}

// ------------------------------------------------------------ Blätter

function bAufgabe(s) {
  const a = S.d.aufgaben.find(x => x.id === s.id);
  if (!a) return `<h3>Diese Aufgabe gibt es nicht mehr</h3>`;
  const frei = !a.fuer, m = frei ? ALLE : P(a.fuer), meine = a.fuer === S.ich, serie = a.serie_id && S.d.serien.find(x => x.id === a.serie_id);
  const teile = runde(a), zus = teile.length > 1, pruefen = darfPruefen(a), w = wert(a), fotos = fotosVon(a);
  const haengt = a.status === 'wartet' && eltern() && !pruefen;           // ich bin selbst beteiligt
  let h = `<div class="blatt-kopf">${tier(m)}<div><h3>${esc(a.titel)}</h3><p class="unter">${ART[a.art]} für ${frei ? 'alle' : zus ? esc(aufzaehlen(teile.map(x => P(x.fuer).name))) : esc(m.name)}${a.fuer_alle && !frei ? ' (war für alle)' : ''}</p></div></div>
    <div class="liste eng"><div class="zeile"><span class="mitte titel">Stand</span><span class="info">${aufgabeInfo(a)}</span></div>
    ${a.notiz ? `<div class="zeile"><span class="mitte"><span class="titel">Notiz</span><span class="info notiz">${esc(a.notiz)}</span></span></div>` : ''}
    ${zus ? `<div class="zeile"><span class="mitte"><span class="titel">Gemeinsame Aufgabe</span><span class="info">${a.erledigt_von && a.status !== 'offen' ? `Abgehakt von ${esc(P(a.erledigt_von).name)}` : 'Einer hakt ab, dann ist sie für alle abgehakt.'}</span></span></div>` : ''}
    ${a.ohne_punkte ? `<div class="zeile"><span class="mitte"><span class="titel">Ohne Punkte</span><span class="info">Das ist selbstverständlich.${a.fuer && ABZUG[a.art] ? ` Liegen lassen kostet trotzdem ${ABZUG[a.art]} Punkte.` : ''}</span></span></div>` : ''}
    ${a.von && a.von !== a.fuer ? `<div class="zeile"><span class="mitte titel">Eingetragen von</span><span class="info">${esc(P(a.von).name)}</span></div>` : ''}
    ${a.foto_pflicht ? `<div class="zeile"><span class="mitte titel">Foto als Beweis</span><span class="info">${fotos.length > 1 ? `${fotos.length} sind dabei` : fotos.length ? 'Ist dabei' : 'Wird verlangt'}</span></div>` : ''}
    ${serie ? `<div class="zeile"><span class="mitte titel">Wiederholt sich</span><span class="info">${gross(serieText(serie))}</span></div>` : ''}
    ${a.hinweis ? `<div class="zeile"><span class="mitte"><span class="titel">Das fehlt noch</span><span class="info">${esc(a.hinweis)}</span></span></div>` : ''}
    ${a.lob ? `<div class="zeile"><span class="mitte"><span class="titel">${esc(a.lob)}</span><span class="info">Lob von ${esc(P(a.bestaetigt_von).name)}</span></span></div>` : ''}</div>`;
  if (fotos.length) h += galerie(s.fotos, fotos.length, 'Foto zur Aufgabe');

  if (pruefen) h += `<p class="klein-titel">Ein Lob dazu?</p><div class="chips">${LOB.map(l =>
    `<button class="chip nur ${s.lob === l ? 'an' : ''}" data-l="${esc(l)}" onclick="A.lobWahl(this.dataset.l)">${esc(l)}</button>`).join('')}</div>`;

  const k = [];
  if (a.status === 'offen' && (meine || frei)) {
    if (a.foto_pflicht && !a.foto_pfad) k.push(`<button class="knopf" onclick="A.mitFoto('${a.id}')">Foto aufnehmen und abhaken</button>`);
    else {
      k.push(`<button class="knopf" onclick="A.abhaken('${a.id}')">Erledigt</button>`);
      if (a.art !== 'irgendwann') k.push(`<button class="knopf still" onclick="A.mitFoto('${a.id}')">${fotos.length ? 'Neue Fotos aufnehmen' : 'Mit Foto abhaken'}</button>`);
    }
    if (meine && !zus && a.art === 'tag' && !a.verschoben && a.faellig === heute()) k.push(`<button class="knopf still" onclick="A.morgen('${a.id}')">Auf morgen verschieben</button>`);
  }
  if (pruefen) {
    if (a.art === 'frei') k.push(`<div class="zwei"><button class="knopf" onclick="A.bestaetige('${a.id}',1)">1 Punkt geben</button><button class="knopf still" onclick="A.bestaetige('${a.id}',2)">2 Punkte geben</button></div>`);
    else k.push(`<button class="knopf" onclick="A.bestaetige('${a.id}')">${!w ? 'Bestätigen' : zus ? `Bestätigen, +${w} für jeden` : `Bestätigen, +${w}`}</button>`);
    k.push(`<button class="knopf still" onclick="A.zurueckAuf('${a.id}')">${a.art === 'frei' ? 'Nicht anerkennen' : 'Noch nicht in Ordnung'}</button>`);
  }
  if (a.status === 'offen' && a.art !== 'frei' && (eltern() || (a.von === S.ich && a.art === 'irgendwann'))) {
    k.push(`<button class="knopf still" onclick="A.aendernAuf('${a.id}')">Ändern</button>`);
  }
  if (eltern() || (a.von === S.ich && a.art === 'irgendwann')) {
    k.push(`<button class="knopf gefahr" onclick="A.loeschAufgabe('${a.id}')">${zus ? 'Für alle löschen' : 'Aufgabe löschen'}</button>`);
  }
  if (haengt) h += `<p class="hinweis">Das bestätigt ${esc(aufzaehlen(andereEltern().map(x => x.name)) || 'das andere Elternteil')}.</p>`;
  return h + `<div class="knoepfe">${k.join('')}</div>`;
}

function bNeu(s) {
  const wer = S.d.mitglieder.filter(m => eltern() || s.art === 'irgendwann' || m.rolle === 'kind');
  const titel = { tag: 'Tagesaufgabe', woche: 'Aufgabe für die Woche', irgendwann: 'Aufgabe ohne Datum' }[s.art];
  const an = id => s.zus ? s.wer.includes(id) : s.fuer === id, alleAn = s.zus ? wer.every(m => s.wer.includes(m.id)) : s.fuer === 'alle';
  const lohn = !PUNKTE[s.art] || s.ohne ? '' : PUNKTE[s.art] === 1 ? 'den Punkt' : `die ${PUNKTE[s.art]} Punkte`;
  const hinweis = s.zus ? `Tippe alle an, die mitmachen. Einer hakt ab, ${lohn ? `jeder bekommt ${lohn}` : 'dann ist sie für alle abgehakt'}.`
    : s.fuer === 'alle' ? `${lohn ? `Wer sie zuerst erledigt, bekommt ${lohn}` : 'Wer zuerst kommt, erledigt sie'}. Bleibt sie liegen, verliert niemand etwas.` : '';
  return `<h3>${titel}</h3>
    <p class="klein-titel">${s.zus ? 'Wer macht mit?' : 'Für wen?'}</p>
    <div class="chips">${wer.map(m => `<button class="chip ${an(m.id) ? 'an' : ''}" style="--c:${esc(m.farbe)}" onclick="A.neuFuer('${m.id}')" aria-pressed="${an(m.id)}">${tier(m, 'klein')}${esc(m.name)}</button>`).join('')}
      ${s.zus || (eltern() && s.art !== 'irgendwann') ? `<button class="chip ${alleAn ? 'an' : ''}" style="--c:${ALLE.farbe}" onclick="A.neuFuer('alle')" aria-pressed="${alleAn}">${tier(ALLE, 'klein')}Alle</button>` : ''}</div>
    ${wer.length > 1 ? `<div class="liste eng"><button class="zeile" onclick="A.zusUm()"><span class="mitte"><span class="titel">Zusammen erledigen</span>
      <span class="info">Mehrere machen die Aufgabe gemeinsam</span></span>${kipp(s.zus)}</button></div>` : ''}
    ${hinweis ? `<p class="hinweis">${hinweis}</p>` : ''}
    <p class="klein-titel">Was ist zu tun?</p>
    ${sprechFeld(`<input class="feld voll hell" id="neu-t" value="${esc(s.t)}" oninput="A.entwurf('t', this.value)" onkeydown="if(event.key==='Enter')A.neuAufgabe()" placeholder="${S.hoert ? 'Ich höre zu …' : 'z. B. Flur wischen'}" maxlength="120" enterkeyhint="done" autocomplete="off">`, 'neu-t')}
    <input class="feld voll hell" style="margin-top:8px" value="${esc(s.notiz)}" oninput="A.entwurf('notiz', this.value)" placeholder="Notiz dazu, z. B. auch unter dem Bett" aria-label="Notiz (freiwillig)" maxlength="200" autocomplete="off">
    ${s.art === 'tag' && s.vor.length && s.fuer !== 'alle' && !s.zus ? `<p class="klein-titel">Oft für ${esc(P(s.fuer).name)}</p>
    <div class="chips">${s.vor.map(o => `<button class="chip nur" data-t="${esc(o)}" onclick="A.vorschlagNehmen(this.dataset.t)">${esc(o)}</button>`).join('')}</div>` : ''}
    ${s.art === 'tag' && !s.wdh ? `<p class="klein-titel">Wann?</p>${blattSchalter('wann', [['heute', 'Heute'], ['morgen', 'Morgen']])}` : ''}
    ${s.art === 'tag' && s.wdh ? `<p class="klein-titel">An welchen Tagen?</p>
    <div class="chips wochentage">${WOCHENTAGE.map(([n, l]) => `<button class="chip nur ${s.wtage.includes(n) ? 'an' : ''}" onclick="A.neuTag(${n})">${l}</button>`).join('')}</div>` : ''}
    ${s.art === 'irgendwann' ? `<p class="klein-titel">Wie oft erinnern?</p>
    <div class="chips">${[[3, 'Alle 3 Tage'], [7, 'Jede Woche'], [14, 'Alle 2 Wochen'], [30, 'Jeden Monat']].map(([n, l]) =>
      `<button class="chip nur ${s.tage === n ? 'an' : ''}" onclick="A.blattSetz('tage',${n})">${l}</button>`).join('')}</div>`
      : `<div class="liste eng"><button class="zeile" onclick="A.blattUm('wdh')"><span class="mitte"><span class="titel">Wiederholen</span>
        <span class="info">${s.art === 'tag' ? 'Trägt sich an den gewählten Tagen von selbst ein' : 'Trägt sich jede Woche von selbst ein'}</span></span>${kipp(s.wdh)}</button>
      <button class="zeile" onclick="A.blattUm('foto')"><span class="mitte titel">Foto als Beweis verlangen</span>${kipp(s.foto)}</button>
      <button class="zeile" onclick="A.blattUm('ohne')"><span class="mitte"><span class="titel">Ohne Punkte</span>
        <span class="info">Für Selbstverständliches.${s.fuer === 'alle' && !s.zus ? '' : ` Liegen lassen kostet trotzdem ${ABZUG[s.art]} Punkte.`}</span></span>${kipp(s.ohne)}</button></div>`}
    <div class="abstand"><button class="knopf" onclick="A.neuAufgabe()">Aufgabe eintragen</button></div>`;
}

function bSerie(s) {
  const x = S.d.serien.find(v => v.id === s.id);
  if (!x) return `<h3>Diese Wiederholung gibt es nicht mehr</h3>`;
  const m = x.fuer ? P(x.fuer) : ALLE;
  return `<div class="blatt-kopf">${tier(m)}<div><h3>${esc(x.titel)}</h3><p class="unter">${ART[x.art]} für ${x.fuer ? esc(serieWer(x)) : 'alle'}</p></div></div>
    <div class="liste eng"><div class="zeile"><span class="mitte titel">Wiederholt sich</span><span class="info">${gross(serieText(x))}</span></div>
    ${(x.mit || []).length ? `<div class="zeile"><span class="mitte titel">Gemeinsame Aufgabe</span><span class="info">Einer hakt für alle ab</span></div>` : ''}
    ${x.ohne_punkte ? `<div class="zeile"><span class="mitte titel">Punkte</span><span class="info">Ohne Punkte</span></div>` : ''}
    ${x.notiz ? `<div class="zeile"><span class="mitte"><span class="titel">Notiz</span><span class="info notiz">${esc(x.notiz)}</span></span></div>` : ''}
    ${x.foto_pflicht ? `<div class="zeile"><span class="mitte titel">Foto als Beweis</span><span class="info">Wird verlangt</span></div>` : ''}
    ${x.von ? `<div class="zeile"><span class="mitte titel">Eingetragen von</span><span class="info">${esc(P(x.von).name)}</span></div>` : ''}</div>
    <p class="hinweis">Was schon eingetragen ist, bleibt stehen. Es kommt nur nichts Neues mehr dazu.</p>
    <div class="knoepfe"><button class="knopf still" onclick="A.serieAendernAuf('${x.id}')">Ändern</button>
      <button class="knopf gefahr" onclick="A.serieWeg('${x.id}')">Wiederholung beenden</button></div>`;
}

// Gemeinsame Bausteine der beiden Ändern-Blätter
const feldTitel = (s, id, fertig) => `<p class="klein-titel">Was ist zu tun?</p>
  ${sprechFeld(`<input class="feld voll hell" id="${id}" value="${esc(s.t)}" oninput="A.entwurf('t', this.value)" onkeydown="if(event.key==='Enter')${fertig}()" placeholder="${S.hoert ? 'Ich höre zu …' : 'z. B. Flur wischen'}" maxlength="120" enterkeyhint="done" autocomplete="off">`, id)}
  <p class="klein-titel">Notiz (freiwillig)</p>
  <input class="feld voll hell" value="${esc(s.notiz)}" oninput="A.entwurf('notiz', this.value)" placeholder="z. B. auch unter dem Bett" maxlength="200" autocomplete="off">`;
const feldWer = s => `<p class="klein-titel">Für wen?</p>
  <div class="chips">${S.d.mitglieder.map(m => `<button class="chip ${s.fuer === m.id ? 'an' : ''}" style="--c:${esc(m.farbe)}" onclick="A.blattSetz('fuer','${m.id}')" aria-pressed="${s.fuer === m.id}">${tier(m, 'klein')}${esc(m.name)}</button>`).join('')}</div>`;
const feldSchalter = (s, art, mitAbzug) => `<div class="liste eng"><button class="zeile" onclick="A.blattUm('foto')"><span class="mitte titel">Foto als Beweis verlangen</span>${kipp(s.foto)}</button>
  <button class="zeile" onclick="A.blattUm('ohne')"><span class="mitte"><span class="titel">Ohne Punkte</span>
    <span class="info">Für Selbstverständliches.${mitAbzug ? ` Liegen lassen kostet trotzdem ${ABZUG[art]} Punkte.` : ''}</span></span>${kipp(s.ohne)}</button></div>`;

function bAendern(s) {
  const a = S.d.aufgaben.find(x => x.id === s.id);
  if (!a || a.status !== 'offen') return `<h3>Das lässt sich nicht mehr ändern</h3>`;
  const zus = !!a.gruppe;
  return `<h3>Aufgabe ändern</h3>${feldTitel(s, 'aend-t', 'A.aendern')}
    ${zus || !a.fuer ? '' : feldWer(s)}
    ${a.art === 'tag' ? `<p class="klein-titel">Wann?</p>${blattSchalter('wann', [['heute', 'Heute'], ['morgen', 'Morgen']])}` : ''}
    ${a.art === 'irgendwann' ? '' : feldSchalter(s, a.art, !!a.fuer)}
    ${zus ? `<p class="hinweis">Die Änderung gilt für alle, die mitmachen.</p>` : ''}
    <div class="abstand"><button class="knopf" onclick="A.aendern()">Speichern</button></div>`;
}

function bSerieAendern(s) {
  const x = S.d.serien.find(v => v.id === s.id);
  if (!x) return `<h3>Diese Wiederholung gibt es nicht mehr</h3>`;
  return `<h3>Wiederholung ändern</h3>${feldTitel(s, 'saend-t', 'A.serieAendern')}
    ${x.fuer && !(x.mit || []).length ? feldWer(s) : ''}
    ${x.art === 'tag' ? `<p class="klein-titel">An welchen Tagen?</p>
    <div class="chips wochentage">${WOCHENTAGE.map(([n, l]) => `<button class="chip nur ${s.wtage.includes(n) ? 'an' : ''}" onclick="A.neuTag(${n})">${l}</button>`).join('')}</div>` : ''}
    ${feldSchalter(s, x.art, !!x.fuer)}
    <p class="hinweis">Gilt für alles, was ab jetzt entsteht. Was schon in der Liste steht, bekommt den neuen Text gleich mit.</p>
    <div class="abstand"><button class="knopf" onclick="A.serieAendern()">Speichern</button></div>`;
}

const bFrei = s => `<h3>Freiwillig erledigt</h3><p class="unter">Wenn ein Elternteil bestätigt, bekommst du 1 Punkt.</p>
  <p class="klein-titel">Was hast du gemacht?</p>
  ${sprechFeld(`<input class="feld voll hell" id="frei-t" value="${esc(s.t)}" oninput="A.entwurf('t', this.value)" onkeydown="if(event.key==='Enter')A.neuFrei()" placeholder="${S.hoert ? 'Ich höre zu …' : 'z. B. Wäsche gemacht'}" maxlength="120" enterkeyhint="done" autocomplete="off">`, 'frei-t')}
  ${s.bilder.length ? fotoLeiste(s.bilder) : ''}
  <div class="knoepfe">${s.bilder.length ? '' : `<button class="knopf still" onclick="A.fotoDazu()">Foto hinzufügen</button>`}
    <button class="knopf" onclick="A.neuFrei()" ${s.laedt ? 'disabled' : ''}>${s.laedt ? (s.bilder.length > 1 ? 'Fotos werden hochgeladen …' : 'Foto wird hochgeladen …') : 'Eintragen'}</button></div>`;

// Abhaken mit Foto: Das erste ist schon aufgenommen, hier kommen weitere dazu.
function bFotos(s) {
  const a = S.d.aufgaben.find(x => x.id === s.id), n = s.bilder.length;
  if (!a) return `<h3>Diese Aufgabe gibt es nicht mehr</h3>`;
  return `<h3>${esc(a.titel)}</h3><p class="unter">${n > 1 ? `${n} Fotos sind dabei.` : n ? 'Reicht ein Foto nicht? Tippe auf das Plus.' : 'Tippe auf das Plus für ein Foto.'}</p>
    ${fotoLeiste(s.bilder)}
    <div class="knoepfe"><button class="knopf" onclick="A.fotosAb()" ${s.laedt || !n ? 'disabled' : ''}>${
      s.laedt ? (n > 1 ? 'Fotos werden hochgeladen …' : 'Foto wird hochgeladen …') : n > 1 ? `Mit ${n} Fotos abhaken` : 'Mit Foto abhaken'}</button></div>`;
}

const bJoker = () => `<img class="grosskarte" src="icons/joker.webp" alt="Joker-Karte" style="view-transition-name:jokerkarte">
  <h3>Joker heute einlösen?</h3>
  <p class="unter" style="margin-bottom:18px">Deine Tagesaufgaben für heute entfallen ohne Minuspunkte. ${eltern() ? 'Das andere Elternteil bekommt' : 'Die Eltern bekommen'} eine Nachricht.</p>
  <button class="knopf" onclick="A.jokerEin()">Joker einlösen</button><button class="knopf gefahr" onclick="A.zu()">Aufheben für später</button>`;

function bSchwein(s) {
  const p = S.d.schweine.find(x => x.id === s.id);
  if (!p) return `<h3>Dieses Sparschwein gibt es nicht mehr</h3>`;
  const info = S.d.info || {};
  const zeile = l => `<div class="zeile">${tier(P(l.mitglied_id), 'klein')}
    <div class="mitte"><span class="titel">${esc(P(l.mitglied_id).name)}</span><span class="info">${l.betrag_cent < 0 ? 'Entnahme, ' : l.weg === 'ueberweisung' ? 'Überweisung, ' : ''}${relKurz(l.am)}</span></div>
    <span class="zahl klein ${l.betrag_cent < 0 ? 'minus' : ''}">${l.betrag_cent > 0 ? '+' : ''}${euro(l.betrag_cent)}</span></div>`;
  return `<h3>${esc(p.name)}</h3><p class="gross-zahl">${euro(p.stand_cent)}</p>
    ${p.ziel_cent ? `<div class="balken"><i style="width:${Math.min(p.stand_cent / p.ziel_cent, 1) * 100}%"></i></div><p class="unter">Ziel: ${euro(p.ziel_cent)}</p>` : ''}
    <p class="klein-titel">Wie zahlst du ein?</p>${blattSchalter('weg', [['bar', 'Bar ins Sparschwein'], ['ueberweisung', 'Überweisung']])}
    ${s.weg === 'ueberweisung' ? (info.iban ? `<div class="liste eng"><div class="zeile"><div class="mitte"><span class="titel">${esc(info.iban)}</span>
      <span class="info">Empfänger: ${esc(info.empfaenger || '')}</span></div><button class="pille" onclick="A.ibanKopieren()">Kopieren</button></div></div>`
      : `<p class="hinweis">Es ist noch kein Konto hinterlegt.</p>`) : ''}
    <div class="betraege">${[5, 10, 25, 50].map(b => `<button onclick="A.einzahlen(${b * 100})">+${b} €</button>`).join('')}</div>
    <div class="eingabe"><input class="feld hell" id="betrag" inputmode="decimal" placeholder="Eigener Betrag, z. B. 7,50" aria-label="Eigener Betrag" autocomplete="off"
      onkeydown="if(event.key==='Enter')A.eigener()" enterkeyhint="done"><button class="knopf" onclick="A.eigener()">Einzahlen</button></div>
    <p class="klein-titel">Verlauf</p>${s.log ? liste(s.log.map(zeile), 'Noch keine Einzahlung.') : `<div class="liste"><div class="leer">Wird geladen …</div></div>`}
    ${eltern() ? `<div class="knoepfe"><button class="knopf still" onclick="A.entnehmen()">Im Notfall etwas herausnehmen</button>
      <button class="knopf gefahr" onclick="A.aufbrechen()">${s.sicher ? 'Wirklich aufbrechen? Es verschwindet für alle.' : 'Sparschwein aufbrechen'}</button></div>` : ''}`;
}

const bNeuSchwein = s => `<h3>Neues Sparschwein</h3>
  <p class="klein-titel">Wofür spart ihr?</p>
  <input class="feld voll hell" value="${esc(s.t)}" oninput="A.entwurf('t', this.value)" placeholder="z. B. Trampolin" maxlength="40" autocomplete="off">
  <p class="klein-titel">Sparziel in Euro (freiwillig)</p>
  <input class="feld voll hell" inputmode="decimal" value="${esc(s.ziel)}" oninput="A.entwurf('ziel', this.value)" onkeydown="if(event.key==='Enter')A.neuSchwein()" placeholder="z. B. 300" autocomplete="off" enterkeyhint="done">
  <div class="abstand"><button class="knopf" onclick="A.neuSchwein()">Sparschwein anlegen</button></div>`;

function bEinst() {
  const m = ich(), vergeben = new Set(S.d.mitglieder.filter(x => x.id !== m.id).map(x => x.farbe));
  const an = k => (m.mitteilungen || {})[k] !== false;
  const arten = [['neu', 'Neue Aufgabe für dich'], ['bestaetigt', 'Deine Aufgabe wurde bestätigt'], ['verpasst', 'Aufgabe verpasst'],
    ...(eltern() ? [['erledigt', 'Jemand hat eine Aufgabe erledigt'], ['einkauf', 'Neuer Vorschlag für die Einkaufsliste']]
      : [['einkauf', 'Antwort auf deinen Einkaufsvorschlag']]),
    ['erinnerung', 'Erinnerung an offene Aufgaben'], ['woche', 'Wochenabschluss'], ['joker', 'Joker'], ['termine', 'Termine'], ['merk', 'Dran denken'], ['sparen', 'Sparschweine'], ['zoo', 'Zoo: neue Tiere und Herzen']];
  const abend = Number((m.mitteilungen || {}).abend) || 18;
  return `<div class="blatt-kopf">${tier(m, 'gross')}<div><h3>${esc(m.name)}</h3><p class="unter">${eltern() ? 'Elternteil' : 'Kind'}</p></div></div>
    <p class="klein-titel">Dein Tier</p>${tierWahl(m.tier, !!m.bild_pfad, 'A.setzTier', 'A.setzFoto')}
    <p class="klein-titel">Deine Farbe</p>${farbWahl(m.farbe, vergeben, 'A.setzFarbe')}
    <p class="klein-titel">Push-Nachrichten</p>
    <div class="liste"><button class="zeile" onclick="A.pushGeraet()"><span class="mitte"><span class="titel">Auf diesem Gerät</span>
      <span class="info">${{ an: 'Eingeschaltet', aus: 'Ausgeschaltet', gesperrt: 'In den iPhone-Einstellungen gesperrt', 'geht-nicht': 'Geht nur in der App auf dem Home-Bildschirm', unbekannt: 'Wird geprüft …' }[S.push]}</span></span>${kipp(S.push === 'an')}</button></div>
    <p class="klein-titel">Wobei möchtest du eine Nachricht?</p>
    <div class="liste">${arten.map(([k, l]) => `<button class="zeile" onclick="A.pushUm('${k}')"><span class="mitte titel">${l}</span>${kipp(an(k))}</button>`).join('')}</div>
    <p class="klein-titel">Abend-Erinnerung an offene Aufgaben um</p>
    <div class="chips">${[16, 17, 18, 19, 20].map(n => `<button class="chip nur ${abend === n ? 'an' : ''}" onclick="A.abendZeit(${n})">${n} Uhr</button>`).join('')}</div>
    <p class="klein-titel">Dieses Gerät</p>
    <div class="liste"><button class="zeile" onclick="A.toeneUm()"><span class="mitte"><span class="titel">Töne</span>
      <span class="info">Beim Abhaken, Bestätigen und Einzahlen. Der Stumm-Schalter am iPhone gilt trotzdem.</span></span>${kipp(toeneAn())}</button>
      <button class="zeile" onclick="A.merkenUm()"><span class="mitte titel">Code merken</span>${kipp(S.merken)}</button>
      <button class="zeile" onclick="A.codeAuf()"><span class="mitte titel">${eltern() ? 'Einen Code ändern' : 'Meinen Code ändern'}</span><span class="info">›</span></button></div>
    <div class="knoepfe"><button class="knopf still" onclick="A.abmelden()">Abmelden</button></div>`;
}

function bCode(s) {
  return `<h3>Code ändern</h3><p class="unter">${eltern() ? 'Eltern können auch den Code der anderen neu setzen, falls ihn jemand vergessen hat.' : 'Danach brauchst du beim Anmelden den neuen Code.'}</p>
    ${eltern() ? `<p class="klein-titel">Für wen?</p><div class="chips">${S.d.mitglieder.map(m =>
      `<button class="chip ${s.fuer === m.id ? 'an' : ''}" style="--c:${esc(m.farbe)}" onclick="A.blattSetz('fuer','${m.id}')">${tier(m, 'klein')}${esc(m.name)}</button>`).join('')}</div>` : ''}
    <p class="klein-titel">Neuer Code (4 Ziffern)</p>
    <input class="feld voll hell" value="${esc(s.pin)}" oninput="A.entwurf('pin', this.value)" onkeydown="if(event.key==='Enter')A.codeSetzen()" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="z. B. 2580" enterkeyhint="done">
    <div class="abstand"><button class="knopf" onclick="A.codeSetzen()">Code speichern</button></div>`;
}

function bTermin(s) {
  const erinnern = [['', 'Gar nicht'], ['60', '1 Stunde vorher'], ['1440', '1 Tag vorher'], ['2880', '2 Tage vorher'], ['10080', '1 Woche vorher']];
  const wdh = [['nie', 'Nie'], ['woechentlich', 'Jede Woche'], ['monatlich', 'Jeden Monat'], ['jaehrlich', 'Jedes Jahr']];
  return `<h3>${s.id ? 'Termin ändern' : 'Neuer Termin'}</h3>
    <p class="klein-titel">Was?</p>
    <input class="feld voll hell" value="${esc(s.t)}" oninput="A.entwurf('t', this.value)" placeholder="z. B. Zahnarzt" maxlength="120" autocomplete="off">
    <p class="klein-titel">Wann?</p>
    <div class="eingabe"><input class="feld hell" type="date" value="${esc(s.datum)}" onchange="A.entwurf('datum', this.value)" aria-label="Datum">
      ${s.ganztags ? '' : `<input class="feld hell" type="time" value="${esc(s.zeit)}" onchange="A.entwurf('zeit', this.value)" style="flex:0 0 118px" aria-label="Uhrzeit">`}</div>
    <div class="liste eng"><button class="zeile" onclick="A.blattUm('ganztags')"><span class="mitte titel">Den ganzen Tag</span>${kipp(s.ganztags)}</button></div>
    <p class="klein-titel">Für wen?</p>
    <div class="chips">${S.d.mitglieder.map(m => `<button class="chip ${s.fuer.includes(m.id) ? 'an' : ''}" style="--c:${esc(m.farbe)}" onclick="A.terminFuer('${m.id}')">${tier(m, 'klein')}${esc(m.name)}</button>`).join('')}</div>
    <p class="klein-titel">Erinnern</p>
    <div class="chips">${erinnern.map(([v, l]) => `<button class="chip nur ${s.erinnerung === v ? 'an' : ''}" onclick="A.blattSetz('erinnerung','${v}')">${l}</button>`).join('')}</div>
    <p class="klein-titel">Wiederholen</p>
    <div class="chips">${wdh.map(([v, l]) => `<button class="chip nur ${s.wdh === v ? 'an' : ''}" onclick="A.blattSetz('wdh','${v}')">${l}</button>`).join('')}</div>
    <div class="knoepfe"><button class="knopf" onclick="A.terminSpeichern()">${s.id ? 'Speichern' : 'Termin eintragen'}</button>
    ${s.id ? `<button class="knopf gefahr" onclick="A.terminWeg()">Termin löschen</button>` : ''}</div>`;
}

const bMerk = s => `<h3>Dran denken</h3><p class="unter">Für alle in der Familie sichtbar.</p>
  <p class="klein-titel">Woran?</p>
  <input class="feld voll hell" value="${esc(s.t)}" oninput="A.entwurf('t', this.value)" placeholder="z. B. Dauerauftrag ändern" maxlength="160" autocomplete="off">
  <p class="klein-titel">Wann erinnern? (freiwillig)</p>
  <input class="feld voll hell" type="date" value="${esc(s.datum)}" min="${heute()}" onchange="A.entwurf('datum', this.value)" aria-label="Datum der Erinnerung">
  <div class="abstand"><button class="knopf" onclick="A.merkNeu()">Notieren</button></div>`;

function bNein(s) {
  const k = S.d.einkauf.find(x => x.id === s.id);
  if (!k) return `<h3>Schon erledigt</h3>`;
  return `<h3>Warum nicht?</h3><p class="unter">${esc(k.titel)}, vorgeschlagen von ${esc(P(k.von).name)}</p>
    <div class="chips abstand">${['Haben wir noch', 'Diesmal nicht', 'Zu teuer', 'Zu ungesund'].map(g => `<button class="chip nur" onclick="A.kaufNein('${g}')">${g}</button>`).join('')}</div>
    <input class="feld voll hell abstand" value="${esc(s.grund)}" oninput="A.entwurf('grund', this.value)" onkeydown="if(event.key==='Enter')A.kaufNein()" placeholder="Oder kurz selbst schreiben" maxlength="80" autocomplete="off" enterkeyhint="done">
    <div class="abstand"><button class="knopf" onclick="A.kaufNein()">Ablehnen</button></div>`;
}

function bKauf(s) {
  const k = S.d.einkauf.find(x => x.id === s.id);
  if (!k) return `<h3>Nicht mehr auf der Liste</h3>`;
  const herkunft = k.entschieden_von && k.von && k.von !== k.entschieden_von
    ? `Wunsch von ${esc(P(k.von).name)}, angenommen von ${esc(P(k.entschieden_von).name)}` : k.von ? `Eingetragen von ${esc(P(k.von).name)}` : '';
  return `<h3>${esc(k.titel)}</h3>${herkunft ? `<p class="unter">${herkunft}</p>` : ''}
    <p class="klein-titel">Menge</p>
    <input class="feld voll hell" value="${esc(s.menge)}" oninput="A.entwurf('menge', this.value)" onkeydown="if(event.key==='Enter')A.kaufMenge()" placeholder="z. B. 2×" maxlength="12" autocomplete="off" enterkeyhint="done">
    <div class="knoepfe"><button class="knopf" onclick="A.kaufMenge()">Speichern</button>
    <button class="knopf gefahr" onclick="A.kaufWeg('${k.id}')">Von der Liste nehmen</button></div>`;
}

function bVerlauf(s) {
  const m = P(s.id);
  const text = l => l.aufgaben?.titel || (l.grund === 'verpasst' ? 'Aufgabe verpasst' : 'Aufgabe');
  const siege = (S.d.best.find(b => b.mitglied_id === s.id) || {}).siege || 0;
  return `<div class="blatt-kopf">${tier(m)}<div><h3>Punkte von ${esc(m.name)}</h3><p class="unter">${siege ? `${siege} ${siege === 1 ? 'Woche' : 'Wochen'} gewonnen. ` : ''}Die letzten Einträge</p></div></div>
    <div class="abstand">${s.log ? liste(s.log.map(l => `<div class="zeile"><div class="mitte"><span class="titel">${esc(text(l))}</span>
      <span class="info">${l.grund === 'verpasst' ? 'Verpasst, ' : ''}${relKurz(l.am)}</span></div>
      <span class="zahl klein ${l.wert < 0 ? 'minus' : ''}">${l.wert > 0 ? '+' : '−'}${Math.abs(l.wert)}</span></div>`), 'Noch keine Punkte.')
      : `<div class="liste"><div class="leer">Wird geladen …</div></div>`}</div>`;
}

function bZurueck(s) {
  const a = S.d.aufgaben.find(x => x.id === s.id);
  if (!a || a.status !== 'wartet') return `<h3>Schon erledigt</h3>`;
  const frei = a.art === 'frei';
  const gruende = frei ? ['Das zählt nicht', 'War schon gemacht', 'Zu wenig'] : ['Nicht gründlich genug', 'Noch nicht fertig', 'Foto fehlt'];
  return `<h3>${frei ? 'Warum nicht?' : 'Was fehlt noch?'}</h3><p class="unter">${esc(a.titel)}, ${esc(aufzaehlen(runde(a).map(x => P(x.fuer).name)))}</p>
    <div class="chips abstand">${gruende.map(g => `<button class="chip nur" onclick="A.zurueckgeben('${a.id}','${g}')">${g}</button>`).join('')}</div>
    <input class="feld voll hell abstand" value="${esc(s.grund)}" oninput="A.entwurf('grund', this.value)" onkeydown="if(event.key==='Enter')A.zurueckgeben('${a.id}')" placeholder="Oder kurz selbst schreiben" maxlength="120" autocomplete="off" enterkeyhint="done">
    <div class="abstand"><button class="knopf" onclick="A.zurueckgeben('${a.id}')">${frei ? 'Nicht anerkennen' : 'Zurückgeben'}</button></div>`;
}

function bKaufBild(s) {
  const k = S.d.einkauf.find(x => x.id === s.id);
  return `<h3>${esc(k ? k.titel : 'Foto')}</h3>${k && k.von ? `<p class="unter">Von ${esc(P(k.von).name)}</p>` : ''}
    ${galerie(s.fotos, k ? fotosVon(k).length : 1, 'Foto zum Einkauf')}`;
}


function zooKarte(t, hat, st) {
  let unten;
  if (hat) unten = `<span class="zoo-preis hat">${HAKEN}Im Zoo</span>`;
  else if (t.futter) unten = `<span class="zoo-preis ${st.futter >= t.futter ? '' : 'fehlt'}">${FUTTER}${zahl(t.futter)}</span>`;
  else { const z = zielStand(t, st); unten = `<span class="zoo-preis ziel">${ZIEL_ZEICHEN[z.art] || HAKEN}${z.ist} von ${z.soll}</span>`; }
  return `<button class="zoo-karte ${t.seltenheit} ${hat ? 'hat' : ''}" onclick="A.zooTierAuf('${t.id}')"><img src="zoo/bild/${t.id}.webp" alt="" loading="lazy" decoding="async">
    <span class="name">${esc(t.name)}</span>${unten}</button>`;
}

function bZooLaden() {
  const z = S.d.zoo, st = z.stand.find(x => x.mitglied_id === S.ich) || {};
  const hab = new Set(z.tiere.filter(t => t.mitglied_id === S.ich).map(t => t.tier));
  const gruppen = Object.keys(SELTEN).map(sel => `<p class="klein-titel">${SELTEN[sel]}${sel === 'legendaer' ? ', nur durch Fleiß' : ''}</p>
    <div class="zoo-laden">${ZOO_TIERE.filter(t => t.seltenheit === sel).map(t => zooKarte(t, hab.has(t.id), st)).join('')}</div>`).join('');
  return `<h3>Neues Tier holen</h3><p class="unter">${FUTTER} ${zahl(st.futter)} Futter. Jeder bestätigte Punkt bringt 10.</p>${gruppen}`;
}

function bZooTier(s) {
  const t = zooTier(s.id), z = S.d.zoo, wer = s.wer || S.ich, eigen = wer === S.ich;
  const st = z.stand.find(x => x.mitglied_id === S.ich) || {};
  const da = z.tiere.find(x => x.mitglied_id === wer && x.tier === s.id);
  const zeile = (label, wert, mehr = '') => `<div class="zeile"><span class="mitte titel">${label}</span><span class="zoo-wert">${wert}${mehr ? `<small>${mehr}</small>` : ''}</span></div>`;
  const steckbrief = [zeile('Lebensraum', LEBENSRAUM[t.lebensraum] || ''), zeile('Frisst', esc(t.frisst))];
  let bild, unten = '';
  if (da) {
    // Wohnt im Zoo: das Gehege von nahem, das Tier bewegt sich darin.
    const muede = !!(z.stand.find(x => x.mitglied_id === wer) || {}).muede;
    bild = `<div class="zoo-nah"><img src="zoo/nah/${t.lebensraum}.webp" alt="">
      <img class="zoo-tier ${muede ? 'muede' : ''}" src="zoo/nah/tier/${t.id}.webp" alt="${esc(t.name)}" style="--n:0"></div>`;
    const wie = da.wie === 'start' ? 'Das erste Tier im Zoo' : da.wie === 'verdient' ? `Verdient: ${esc(t.ziel_text)}` : `Für ${zahl(da.futter)} Futter geholt`;
    steckbrief.push(zeile(eigen ? 'Eingezogen' : `Wohnt bei ${esc(P(wer).name)}`, relKurz(da.am), wie));
    steckbrief.push(zeile('Stimmung', muede ? 'Müde' : 'Fröhlich'));
  } else {
    bild = `<img class="zoo-portrait" src="zoo/bild/${t.id}.webp" alt="${esc(t.name)}">`;
    if (t.futter) {
      const fehlt = t.futter - (st.futter || 0);
      unten = `<p class="zoo-text">${fehlt > 0 ? `Dir fehlen noch ${zahl(fehlt)} Futter.` : `Du hast ${zahl(st.futter)} Futter.`}</p>
        <div class="abstand"><button class="knopf" ${fehlt > 0 ? 'disabled' : ''} onclick="A.zooKaufen('${t.id}')">Für ${zahl(t.futter)} Futter holen</button></div>`;
    } else {
      const ziel = zielStand(t, st);
      unten = `<p class="klein-titel">Nur durch Fleiß</p><div class="liste"><div class="zeile"><span class="mitte"><span class="titel">${esc(t.ziel_text)}</span>
        <span class="balken voll"><i style="width:${(ziel.ist / ziel.soll * 100).toFixed(1)}%"></i></span></span><span class="zahl">${ziel.ist} von ${ziel.soll}</span></div></div>
        <p class="hinweis">Es zieht von selbst ein, sobald du es geschafft hast.</p>`;
    }
  }
  return `${bild}<h3 class="mittig">${esc(t.name)}</h3><p class="mittig"><span class="marke ${t.seltenheit}">${SELTEN[t.seltenheit]}</span></p>
    ${unten}<p class="klein-titel">Steckbrief</p><div class="liste">${steckbrief.join('')}</div>
    <p class="klein-titel">Wusstest du?</p><p class="zoo-wissen">${esc(t.wissen)}</p>`;
}

const BLATT = {
  aufgabe: bAufgabe, neu: bNeu, frei: bFrei, joker: bJoker, schwein: bSchwein, neuschwein: bNeuSchwein, einst: bEinst,
  code: bCode, termin: bTermin, merk: bMerk, nein: bNein, kauf: bKauf, verlauf: bVerlauf, serie: bSerie, zurueck: bZurueck, kbild: bKaufBild, fotos: bFotos, aendern: bAendern, saendern: bSerieAendern,
  zooladen: bZooLaden, zootier: bZooTier,
};

const vBlatt = () => `<div class="schleier" onclick="if(event.target===this)A.zu()"><div class="blatt" role="dialog" aria-modal="true">
  <span class="griff-zone"><span class="griff"></span></span>${BLATT[S.sheet.k](S.sheet)}</div></div>`;

// ------------------------------------------------------------ Wochenabschluss
// Ein Wettlauf: Alle Säulen steigen gleich schnell, wer weniger Punkte hat, bleibt früher stehen.
// Der ganze Ablauf steckt im CSS (Verzögerungen über --d und --sieg), damit ihn ein Neuzeichnen nicht stört.

const LAUF = 2.6, ANLAUF = 0.9;      // Sekunden: so lange steigt die höchste Säule, so spät geht es los

export function feierPlan(f) {
  const reihen = S.d.mitglieder.map(m => f.reihen.find(r => r.mitglied_id === m.id)).filter(Boolean);
  const max = Math.max(0, ...reihen.map(r => r.punkte));
  const sieger = reihen.filter(r => r.joker);
  return { reihen, max, sieger, ich: reihen.find(r => r.mitglied_id === S.ich), sieg: ANLAUF + (max > 0 ? LAUF : .35) + .2 };
}

function vFeier() {
  const f = S.feier, { reihen, max, sieger, ich: meins, sieg } = feierPlan(f);
  const namen = l => l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' und ' + l[l.length - 1];
  const pkt = n => `${n} ${Math.abs(n) === 1 ? 'Punkt' : 'Punkten'}`;
  const gewonnen = !!meins && meins.joker, andere = sieger.filter(r => r.mitglied_id !== S.ich).map(r => P(r.mitglied_id).name);
  const platz = meins && !gewonnen ? ` Du bist auf Platz ${meins.platz} mit ${pkt(meins.punkte)}.` : '';

  let titel, text;
  if (!sieger.length) { titel = 'Kein Joker diese Woche'; text = 'Dafür braucht es mehr als 0 Punkte.' + platz; }
  else if (sieger.length === 1 && gewonnen) { titel = 'Du hast gewonnen'; text = `Mit ${pkt(meins.punkte)}. Du bekommst eine Joker-Karte.`; }
  else if (sieger.length === 1) { titel = `${P(sieger[0].mitglied_id).name} gewinnt`; text = `Mit ${pkt(sieger[0].punkte)}. Dafür gibt es eine Joker-Karte.` + platz; }
  else if (gewonnen) { titel = 'Gleichstand'; text = `Du teilst dir Platz 1 mit ${namen(andere)}. Ihr bekommt ${sieger.length > 2 ? 'alle' : 'beide'} eine Joker-Karte.`; }
  else { titel = 'Gleichstand'; text = `${namen(andere)} bekommen je eine Joker-Karte.` + platz; }

  const saeulen = reihen.map(r => {
    const m = P(r.mitglied_id), h = max > 0 && r.punkte > 0 ? Math.max(.07, r.punkte / max) : .035;
    const dauer = max > 0 ? Math.max(.35, LAUF * h) : .35;
    return `<div class="saeule ${r.joker ? 'sieger' : ''}" style="--c:${esc(m.farbe)};--h:${h.toFixed(3)};--d:${dauer.toFixed(2)}s;--n:${r.punkte}">
      <div class="schacht"><div class="lift">${r.joker ? '<span class="krone" aria-hidden="true">👑</span>' : ''}${tier(m)}
        <b class="zaehler ${r.punkte < 0 ? 'minus' : ''}" aria-label="${pkt(r.punkte).replace('Punkten', 'Punkte')}"></b><i class="turm"></i></div></div>
      <small>${esc(m.name)}</small></div>`;
  }).join('');

  const karten = Math.min(sieger.length, 3);
  return `<div class="feier ${f.fertig ? 'fertig' : ''} ${sieger.length ? 'hat-sieger' : ''}" style="--sieg:${sieg.toFixed(2)}s" role="dialog" aria-modal="true" aria-label="Wochenabschluss" onclick="A.feierTipp()">
    <div class="feier-kopf"><p class="feier-ueber">${fmtTag(f.woche)} bis ${fmtTag(plus(f.woche, 7))}</p>
      <div class="feier-titel"><h1 class="t1" aria-hidden="true">Die Woche ist um</h1><h1 class="t2">${esc(titel)}</h1></div></div>
    <div class="buehne">${saeulen}</div>
    ${sieger.length ? `<div class="preis"><div class="strahlen"></div><div class="karten-flug"><div class="karten-ruhe">
      ${karten > 2 ? '<img class="hinten zwei" src="icons/joker.webp" alt="">' : ''}${karten > 1 ? '<img class="hinten" src="icons/joker.webp" alt="">' : ''}
      <img class="vorn" src="icons/joker.webp" alt="Joker-Karte" ${gewonnen ? 'style="view-transition-name:jokerkarte"' : ''}><i class="glanz"></i></div></div></div>` : ''}
    <p class="feier-text">${esc(text)}</p>
    <button class="knopf feier-knopf" onclick="event.stopPropagation();A.feierZu()">Weiter</button></div>`;
}

// ------------------------------------------------------------ Die ganze Seite

export function seite() {
  if (S.phase === 'laden') return vLaden();
  if (S.phase === 'fehler') return vFehler();
  if (S.phase === 'tor') return `<div class="screen ganz">${vTor()}</div>`;
  if (S.phase === 'pin') return `<div class="screen ganz">${vPin()}</div>`;
  if (S.phase === 'neu') return `<div class="screen ganz">${vNeu()}</div>`;
  const inhalt = { heute: vHeute, aufgaben: vAufgaben, einkauf: vEinkauf, kalender: vKalender, familie: vFamilie }[S.tab]();
  return `<div class="screen">${inhalt}</div>
    <nav class="tabs">${Object.keys(TABS).map(k => `<button class="${S.tab === k ? 'an' + (Date.now() < S.frischTab ? ' frisch' : '') : ''}" onclick="A.geh({tab:'${k}'})">
      <svg viewBox="0 0 26 26" aria-hidden="true">${ICON[k]}</svg>${TABS[k]}</button>`).join('')}</nav>
    ${S.sheet ? vBlatt() : ''}${S.feier ? vFeier() : ''}`;
}
