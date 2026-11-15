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
