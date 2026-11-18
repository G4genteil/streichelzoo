// Helfer ohne Zustand: Text, Geld, Datum und feste Listen.

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const euro = cent => (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

// "7,50", "7.50", "1.000", "12 €" -> Cent. Unlesbares -> NaN.
export function centAus(text) {
  let t = String(text ?? '').replace(/[\s€]/g, '');
  if (!/^\d+([.,]\d+)*$/.test(t)) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return Math.round(parseFloat(t) * 100);
}

// ---------- Datum: Tage als "2026-11-14" in der Zeit des Geräts ----------
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const tagVon = s => { const [j, m, t] = s.split('-').map(Number); return new Date(j, m - 1, t); };
export const heute = () => iso(new Date());
export const plus = (s, n) => { const d = tagVon(s); d.setDate(d.getDate() + n); return iso(d); };
export const montag = s => { const d = tagVon(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };

// Die Punktewoche endet sonntags um 18 Uhr. Liefert den Sonntag, an dem die laufende Woche endet.
export function wocheEnde(jetzt = new Date()) {
  const d = new Date(jetzt), wt = d.getDay();
  const dazu = wt === 0 ? (d.getHours() < 18 ? 0 : 7) : 7 - wt;
  d.setDate(d.getDate() + dazu);
  return iso(d);
}

const F = o => new Intl.DateTimeFormat('de-DE', o);
export const fmtLang = s => F({ weekday: 'long', day: 'numeric', month: 'long' }).format(tagVon(s));       // Samstag, 14. November
export const fmtKurz = s => F({ weekday: 'short', day: 'numeric', month: 'short' }).format(tagVon(s));     // Sa., 14. Nov.
export const fmtDatum = s => F({ day: 'numeric', month: 'long', year: 'numeric' }).format(tagVon(s));      // 14. November 2026
export const fmtMonat = s => F({ month: 'long', year: 'numeric' }).format(tagVon(s));                      // November 2026
export const fmtZeit = d => F({ hour: '2-digit', minute: '2-digit' }).format(d);                           // 18:00
export const fmtTag = s => F({ day: 'numeric', month: 'long' }).format(tagVon(s));                           // 14. November
export const wochentagKurz = s => F({ weekday: 'short' }).format(tagVon(s)).replace('.', '');              // Sa

export function relTag(s) {
  const h = heute();
  return s === h ? 'Heute' : s === plus(h, 1) ? 'Morgen' : s === plus(h, -1) ? 'Gestern' : fmtLang(s);
}
// Für Verläufe: Zeitpunkt -> "Heute", "Gestern" oder "10. Nov."
export function relKurz(zeitpunkt) {
  const s = iso(new Date(zeitpunkt)), h = heute();
  return s === h ? 'Heute' : s === plus(h, -1) ? 'Gestern' : F({ day: 'numeric', month: 'short' }).format(tagVon(s));
}

// ---------- Feste Listen ----------
export const PUNKTE = { tag: 1, woche: 3, frei: 1, irgendwann: 0 };
export const ABZUG = { tag: 3, woche: 15 };
// So viele Punkte bringt eine Aufgabe. Selbstverständliches kann ohne Punkte eingetragen sein.
export const wert = a => a.ohne_punkte ? 0 : (PUNKTE[a.art] || 0);
// "Leon", "Leon und Linus", "Leon, Linus und Stefan"
// Fotos: Das erste steht in foto_pfad, alle weiteren in weitere_fotos (braucht 10_fotos.sql).
export const MAX_FOTOS = 12;
export const fotosVon = x => [x.foto_pfad, ...(x.weitere_fotos || [])].filter(Boolean);
export const fotoText = n => n === 1 ? 'Foto' : `${n} Fotos`;
export const KREUZ = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
export const aufzaehlen = l => l.length < 2 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' und ' + l[l.length - 1];

export const TIERE = ['🐑', '🐐', '🦙', '🐇', '🐖', '🐴', '🦆', '🐓', '🐄', '🦔', '🐈', '🐕', '🦁', '🦉', '🐢', '🦊', '🐿️'];

export const FARBEN = [
  ['#D9577A', 'Himbeere'], ['#E8663D', 'Koralle'], ['#E0921A', 'Honig'], ['#7A8F2A', 'Moos'], ['#2E9B6B', 'Wiese'],
  ['#1F9FB0', 'Türkis'], ['#2F78D0', 'Blau'], ['#7558D6', 'Flieder'], ['#A0457F', 'Pflaume'], ['#5B6B7A', 'Schiefer'],
];

export const WOCHENTAGE = [[1, 'Mo'], [2, 'Di'], [3, 'Mi'], [4, 'Do'], [5, 'Fr'], [6, 'Sa'], [7, 'So']];   // wie in der Datenbank: 1 = Montag

export const HAKEN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';

export const LOB = ['Super gemacht', 'Danke dir', 'Richtig gründlich', 'Stark'];       // feste Sätze beim Bestätigen
// Der Platzhalter für „alle", wenn eine Aufgabe noch niemandem gehört.
export const ALLE = { id: null, name: 'Alle', farbe: '#2B7556', tier: '🙌', bild_pfad: null };
export const KAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.4"/></svg>';
export const FLAMME = '<svg class="flamme" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.2 1.2c.3 2.3 3.6 3.8 3.6 7.300A3.800 3.800 0 0 1 8 12.3a3.800 3.800 0 0 1-3.800-3.800c0-1.400.6-2.400 1.400-3.100.2 1.100.8 1.700 1.400 1.800-.4-2.600.1-4.600 1.200-6z" transform="translate(0 1.6)"/></svg>';
export const POKAL = '<svg class="pokal" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h8v3.5a4 4 0 0 1-8 0zM7.3 9.3h1.4v2.2h2.1v2H5.200v-2h2.100z"/><path class="henkel" d="M4 3.200H2v.9a2.500 2.500 0 0 0 2.300 2.500M12 3.200h2v.9a2.500 2.500 0 0 1-2.300 2.500"/></svg>';
export const MIKRO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';

export const ICON = {
  heute: '<circle cx="13" cy="13" r="4.5"/><path d="M13 3v2.5M13 20.5V23M3 13h2.5M20.5 13H23M5.9 5.9l1.8 1.8M18.3 18.3l1.8 1.8M5.9 20.1l1.8-1.8M18.3 7.7l1.8-1.8"/>',
  aufgaben: '<circle cx="13" cy="13" r="9.5"/><path d="M8.5 13.3l3 3 6-6.3"/>',
  einkauf: '<path d="M4 10h18l-2 11H6L4 10z"/><path d="M9 10l4-6 4 6"/>',
  kalender: '<rect x="4" y="5.5" width="18" height="16.5" rx="3.5"/><path d="M4 11h18M9 3v4M17 3v4"/>',
  familie: '<circle cx="9.5" cy="9" r="3.5"/><circle cx="18.5" cy="10.5" r="2.5"/><path d="M3 21c.4-4 3-6 6.5-6s6 2 6.5 6M17 15.5c3 0 5 1.8 5.5 5"/>',
};
// ---------- Zoo ----------
export const SELTEN = { gewoehnlich: 'Gewöhnlich', selten: 'Selten', episch: 'Episch', legendaer: 'Legendär' };
export const FUTTER = '<svg class="futter" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.6c-1.6-1.3-5-1-5 2.6 0 3 2.300 6.300 5 6.300s5-3.300 5-6.300c0-3.600-3.400-3.900-5-2.600z"/><path class="blatt" d="M8 4.600c0-1.700.9-2.800 2.600-3.100-.1 1.700-1 2.800-2.600 3.100z"/></svg>';
export const HERZ = '<svg class="herz" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14s-5.500-3.300-5.500-7.300A3 3 0 0 1 8 4.900a3 3 0 0 1 5.500 1.800C13.500 10.700 8 14 8 14z"/></svg>';
export const zahl = n => Number(n || 0).toLocaleString('de-DE');

export const TABS = { heute: 'Heute', aufgaben: 'Aufgaben', einkauf: 'Einkauf', kalender: 'Kalender', familie: 'Familie' };
