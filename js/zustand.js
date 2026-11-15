// Der Zustand der App an einer Stelle. Ansichten lesen ihn, Aktionen ändern ihn.
import { heute } from './hilfen.js';

export const leer = () => ({
  mitglieder: [], aufgaben: [], best: [], jokerHeute: [], einkauf: [], termine: [],
  merk: [], schweine: [], post: [], info: {}, serien: [], endstand: null,
});

export const S = {
  phase: 'laden',          // laden | fehler | tor | pin | neu | app
  demo: false,
  fehler: '',              // Text für den Fehlerbildschirm
  ladeFehler: '',          // Hinweis oben auf "Heute", wenn das Laden scheitert
  bildUrl: p => p,

  // Anmeldung
  profile: [], ich: null, start: true,
  pinFuer: null, pin: '', pinFehler: '', pinWackel: 0, merken: true,
  neu: null,               // Entwurf für ein neues Profil
  beschaeftigt: false,

  // Daten vom Server
  d: leer(), roh: '',

  // Wo bin ich gerade?
  tab: 'heute', seg: 'tag', fam: 'best', bestArt: 'woche', kal: 'alle', tag: heute(),
  sheet: null,             // offenes Blatt, z. B. { k: 'aufgabe', id }
  kaufT: '', kaufM: '',    // Entwurf in der Einkaufsliste
  frisch: null,            // { id, bis }: gerade abgehakt, für die Haken-Animation
  frischTab: 0,
  push: 'unbekannt',       // an | aus | gesperrt | geht-nicht (auf diesem Gerät)
  imLaden: false,          // Einkaufsliste in der großen Ansicht für den Laden
  kaufBild: null,          // Foto, das am nächsten Einkaufs-Eintrag hängen soll
  hoert: false,            // läuft gerade die Spracheingabe?
  kaufOft: [],             // was die Familie oft kauft, für die Vorschläge beim Tippen
  feier: null,             // der Wochenabschluss, solange er zu sehen ist: { woche, reihen, fertig }
};

const UNBEKANNT = { id: null, name: 'Jemand', rolle: 'kind', farbe: '#888888', tier: '❔', bild_pfad: null, mitteilungen: {} };

export const P = id => S.d.mitglieder.find(m => m.id === id) || S.profile.find(m => m.id === id) || UNBEKANNT;
export const ich = () => P(S.ich);
export const eltern = () => ich().rolle === 'eltern';

// Eine gemeinsame Aufgabe steht bei jedem Beteiligten in der Liste. Alle Teile tragen dieselbe Gruppe.
export const runde = a => a.gruppe ? S.d.aufgaben.filter(x => x.gruppe === a.gruppe) : [a];
// In Listen für andere bleibt von einer gemeinsamen Aufgabe eine Zeile.
export const buendeln = liste => { const da = new Set(); return liste.filter(a => !a.gruppe || (!da.has(a.gruppe) && !!da.add(a.gruppe))); };
export const andereEltern = () => S.d.mitglieder.filter(m => m.rolle === 'eltern' && m.id !== S.ich);
// Wer darf prüfen? Ein Elternteil, das nicht selbst beteiligt ist. Machen alle Eltern mit: wer nicht abgehakt hat.
// Dieselbe Regel steht in der Datenbank (darf_pruefen).
export function darfPruefen(a) {
  if (a.status !== 'wartet' || !eltern()) return false;
  if (!a.gruppe) return a.fuer !== S.ich;
  const dabei = runde(a).map(x => x.fuer);
  if (!dabei.includes(S.ich)) return true;
  return a.erledigt_von !== S.ich && S.d.mitglieder.filter(m => m.rolle === 'eltern').every(m => dabei.includes(m.id));
}
