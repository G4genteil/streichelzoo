// Demo: dieselbe Schnittstelle wie backend.js, aber alles liegt nur im Speicher dieses Tabs.
// Zum Ausprobieren und zum Testen der Oberfläche, ohne echte Daten anzufassen: index.html?demo
// Die Regeln sind hier nachgebaut. Maßgeblich sind die in der Datenbank (supabase/01_schema.sql).
import { heute, plus, wocheEnde, PUNKTE } from './hilfen.js';

export function demoBackend() {
  let zaehler = 100, ichId = null;
  const neuId = () => 'x' + (zaehler++);
  const h = heute(), jetzt = () => new Date().toISOString();
  const um = (tag, zeit) => new Date(`${tag}T${zeit}:00`).toISOString();
  const kopie = v => JSON.parse(JSON.stringify(v));
  const warte = () => new Promise(r => setTimeout(r, 90));
  const nein = text => { throw new Error(text); };

  const M = [
    { id: 'm1', name: 'Sarah', rolle: 'eltern', farbe: '#D9577A', tier: '🐑', bild_pfad: null, mitteilungen: {} },
    { id: 'm2', name: 'Stefan', rolle: 'eltern', farbe: '#2F78D0', tier: '🦙', bild_pfad: null, mitteilungen: {} },
    { id: 'm3', name: 'Linus', rolle: 'kind', farbe: '#E0921A', tier: '🐐', bild_pfad: null, mitteilungen: {} },
    { id: 'm4', name: 'Leon', rolle: 'kind', farbe: '#7558D6', tier: '🐇', bild_pfad: null, mitteilungen: {} },
  ];
  const aufgabe = (titel, art, fuer, status = 'offen', mehr = {}) => ({
    id: neuId(), titel, art, fuer, von: 'm1', status, verschoben: false, foto_pflicht: false, foto_pfad: null, erinnerung_tage: 7,
    faellig: art === 'tag' || art === 'frei' ? h : art === 'woche' ? wocheEnde() : null,
    erledigt_am: status === 'offen' ? null : jetzt(), bestaetigt_von: null, created_at: jetzt(), ...mehr });
  let AUF = [
    aufgabe('Spülmaschine ausräumen', 'tag', 'm4'), aufgabe('Müll rausbringen', 'tag', 'm4', 'wartet'),
    aufgabe('Zimmer saugen', 'tag', 'm3', 'offen', { foto_pflicht: true }), aufgabe('Wäsche aufhängen', 'tag', 'm3', 'wartet'),
    aufgabe('Altglas wegbringen', 'tag', 'm2', 'offen'), aufgabe('Tisch decken', 'tag', 'm3', 'offen', { faellig: plus(h, 1) }),
    aufgabe('Keller aufräumen', 'woche', 'm4'), aufgabe('Fahrrad winterfest machen', 'woche', 'm3'),
    aufgabe('Laub im Garten harken', 'woche', 'm2', 'erledigt'),
    aufgabe('Alte Kleidung aussortieren', 'irgendwann', 'm4'), aufgabe('Regal im Flur anbringen', 'irgendwann', 'm2'),
    aufgabe('Fotos vom Urlaub sortieren', 'irgendwann', 'm1'),
  ];
  const PKT = [];
  const punkt = (m, wert, grund, a, tageHer = 0) => PKT.push({ mitglied_id: m, wert, grund, am: new Date(Date.now() - tageHer * 864e5).toISOString(), aufgaben: a ? { titel: a } : null, woche: tageHer === 0 });
  [['m1', 4], ['m2', 2], ['m3', 6], ['m4', 5]].forEach(([m, n]) => { for (let i = 0; i < n; i++) punkt(m, 1, 'erledigt', 'Tagesaufgabe'); });
  [['m1', 208], ['m2', 185], ['m3', 234], ['m4', 226]].forEach(([m, n]) => PKT.push({ mitglied_id: m, wert: n, grund: 'erledigt', am: new Date(Date.now() - 30 * 864e5).toISOString(), aufgaben: { titel: 'Frühere Wochen' }, woche: false }));
  const JOKER = { m1: 0, m2: 0, m3: 2, m4: 1 }, JOKER_HEUTE = [];
  let KAUF = [
    { id: neuId(), titel: 'Milch', menge: '2×', status: 'liste', von: 'm1', grund: null },
    { id: neuId(), titel: 'Haferflocken', menge: '', status: 'liste', von: 'm2', grund: null },
    { id: neuId(), titel: 'Äpfel', menge: '1 kg', status: 'liste', von: 'm1', grund: null },
    { id: neuId(), titel: 'Spülmittel', menge: '', status: 'gekauft', von: 'm1', grund: null },
    { id: neuId(), titel: 'Eistee Pfirsich', menge: '2×', status: 'vorschlag', von: 'm3', grund: null },
    { id: neuId(), titel: 'Tiefkühlpizza', menge: '3×', status: 'vorschlag', von: 'm4', grund: null },
    { id: neuId(), titel: 'Energy-Drinks', menge: '6×', status: 'abgelehnt', von: 'm3', grund: 'Zu viel Zucker' },
  ];
  const termin = (titel, tag, zeit, fuer, mehr = {}) => ({ id: neuId(), titel, beginn: um(tag, zeit), ganztags: false, fuer, wiederholung: 'nie', erinnerung_min: 1440, von: 'm1', ...mehr });
  let TERM = [
    termin('Fußballspiel', h, '10:30', ['m3']), termin('Essen bei Oma', h, '18:00', ['m1', 'm2', 'm3', 'm4']),
    termin('Zahnarzt', plus(h, 2), '16:00', ['m4']), termin('Elternabend', plus(h, 3), '19:30', ['m1']),
    termin('Training', plus(h, -4), '17:00', ['m3'], { wiederholung: 'woechentlich' }),
    termin('Auto zur Werkstatt', plus(h, 5), '08:00', ['m2']), termin('Omas Geburtstag', plus(h, 9), '00:00', ['m1', 'm2', 'm3', 'm4'], { ganztags: true, wiederholung: 'jaehrlich' }),
  ];
  let MERK = [
    { id: neuId(), titel: 'Gasabrechnung kommt', wann_text: '', erinnern_am: plus(h, 20), erledigt: false, von: 'm1' },
    { id: neuId(), titel: 'Dauerauftrag Miete ändern', wann_text: '', erinnern_am: plus(h, 52), erledigt: false, von: 'm2' },
    { id: neuId(), titel: 'Linus braucht neue Socken', wann_text: '', erinnern_am: null, erledigt: false, von: 'm1' },
    { id: neuId(), titel: 'Beim Friseur wegen Termin nachfragen', wann_text: '', erinnern_am: null, erledigt: false, von: 'm4' },
  ];
  let SCHW = [
    { id: 's1', name: 'Sommerurlaub', ziel_cent: 100000, von: 'm1' }, { id: 's2', name: 'Neuer Fernseher', ziel_cent: 60000, von: 'm2' },
    { id: 's3', name: 'Notgroschen', ziel_cent: null, von: 'm1' },
  ];
  const BUCH = [];
  const buche = (s, m, cent, tageHer, weg = 'bar') => BUCH.push({ id: neuId(), schwein_id: s, mitglied_id: m, betrag_cent: cent, weg, am: new Date(Date.now() - tageHer * 864e5).toISOString() });
  buche('s1', 'm2', 10000, 17, 'ueberweisung'); buche('s1', 'm4', 2500, 11); buche('s1', 'm1', 5000, 4); buche('s1', 'm1', 16500, 30);
  buche('s2', 'm3', 1000, 13); buche('s2', 'm2', 2550, 6); buche('s2', 'm2', 9000, 25); buche('s3', 'm1', 8000, 9);
  const POST = { m1: [], m2: [], m3: [{ id: neuId(), art: 'einkauf', titel: 'Vorschlag abgelehnt', inhalt: 'Energy-Drinks: Zu viel Zucker', created_at: jetzt() }],
    m4: [{ id: neuId(), art: 'bestaetigt', titel: 'Bestätigt, +1 Punkt', inhalt: 'Tisch abräumen', created_at: jetzt() }] };

  const eltern = () => (M.find(m => m.id === ichId) || {}).rolle === 'eltern';
  const name = id => (M.find(m => m.id === id) || {}).name || 'Jemand';
  const stand = s => BUCH.filter(b => b.schwein_id === s).reduce((n, b) => n + b.betrag_cent, 0);
  const anEltern = (ausser, art, titel, inhalt) => M.filter(m => m.rolle === 'eltern' && m.id !== ausser).forEach(m => POST[m.id].unshift({ id: neuId(), art, titel, inhalt, created_at: jetzt() }));
  const an = (wen, art, titel, inhalt) => POST[wen] && POST[wen].unshift({ id: neuId(), art, titel, inhalt, created_at: jetzt() });
  const finde = id => AUF.find(a => a.id === id) || nein('Diese Aufgabe gibt es nicht mehr');

  return {
    demo: true,
    bildUrl: p => p,
    async start() { await warte(); return { profile: kopie(M), ich: null }; },
    async wer() { return ichId; },
    async profile() { return kopie(M); },
    async anmelden(id, pin) { await warte(); if (!/^\d{4}$/.test(pin)) return { ok: false, grund: 'pin' }; ichId = id; return { ok: true }; },
    async abmelden() { ichId = null; },
    async profilAnlegen(n) {
      await warte();
      if (M.some(m => m.farbe === n.farbe)) return { ok: false, grund: 'farbe' };
      const m = { id: neuId(), name: n.name, rolle: n.rolle, farbe: n.farbe, tier: n.tier, bild_pfad: null, mitteilungen: {} };
      M.push(m); POST[m.id] = []; JOKER[m.id] = 0; ichId = m.id;
      return { ok: true, id: m.id };
    },
    async profilAendern(a) {
      const m = M.find(v => v.id === ichId);
      if (a.farbe && M.some(v => v.farbe === a.farbe && v.id !== ichId)) nein('Diese Farbe ist schon vergeben');
      if (a.farbe) m.farbe = a.farbe;
      if (a.tier) m.tier = a.tier;
      if (a.bild_pfad === '') m.bild_pfad = null; else if (a.bild_pfad) m.bild_pfad = a.bild_pfad;
      if (a.mitteilungen) m.mitteilungen = a.mitteilungen;
    },
    async codeSetzen(id, pin) { if (!/^\d{4}$/.test(pin)) nein('Der Code braucht genau 4 Ziffern'); if (id !== ichId && !eltern()) nein('Das können nur Eltern'); },

    async laden() {
      await warte();
      const best = M.map(m => ({ mitglied_id: m.id, joker: JOKER[m.id] || 0,
        woche: PKT.filter(p => p.mitglied_id === m.id && p.woche).reduce((n, p) => n + p.wert, 0),
        gesamt: PKT.filter(p => p.mitglied_id === m.id).reduce((n, p) => n + p.wert, 0) }));
      return kopie({ mitglieder: M, aufgaben: AUF, best, jokerHeute: JOKER_HEUTE, einkauf: KAUF, termine: TERM, merk: MERK,
        schweine: SCHW.map(s => ({ ...s, stand_cent: stand(s.id) })), post: POST[ichId] || [], info: { iban: 'DE00 0000 0000 0000 0000 00', empfaenger: 'Demo-Konto' } });
    },
    beobachten() {}, nichtBeobachten() {},

    async vorschlaege(fuer) { return eltern() ? [...new Set(AUF.filter(a => a.fuer === fuer && a.art === 'tag').map(a => a.titel))].slice(0, 6) : []; },
    async aufgabeAnlegen(a) {
      await warte();
      const ziel = M.find(m => m.id === a.fuer) || nein('Dieses Familienmitglied gibt es nicht');
      if ((a.art === 'tag' || a.art === 'woche') && !eltern()) nein('Das können nur Eltern eintragen');
      if (a.art === 'irgendwann' && ziel.rolle === 'eltern' && !eltern()) nein('Eltern bekommen Aufgaben nur von Eltern');
      if (a.art === 'frei' && a.fuer !== ichId) nein('Freiwillige Aufgaben trägst du für dich selbst ein');
      const tag = a.art === 'tag' ? (a.faellig || h) : a.art === 'woche' ? wocheEnde() : a.art === 'frei' ? h : null;
      if (a.art === 'tag' && tag === h && JOKER_HEUTE.includes(a.fuer)) nein('An diesem Tag ist ein Joker eingelöst');
      AUF.push(aufgabe(a.titel, a.art, a.fuer, a.art === 'frei' ? 'wartet' : 'offen', { von: ichId, faellig: tag, foto_pflicht: !!a.foto_pflicht, erinnerung_tage: a.erinnerung_tage || 7 }));
      if (a.art === 'frei') anEltern(ichId, 'erledigt', `${name(ichId)} hat freiwillig etwas erledigt`, a.titel);
    },
    async aufgabeErledigen(id, foto) {
      await warte();
      const a = finde(id);
      if (a.fuer !== ichId) nein('Das ist nicht deine Aufgabe');
      if (a.status !== 'offen') nein('Die Aufgabe ist nicht mehr offen');
      if (a.foto_pflicht && !foto && !a.foto_pfad) nein('Für diese Aufgabe ist ein Foto nötig');
      if (foto) a.foto_pfad = foto;
      a.erledigt_am = jetzt();
      if (a.art === 'irgendwann' || eltern()) { a.status = 'erledigt'; if (PUNKTE[a.art]) punkt(ichId, PUNKTE[a.art], 'erledigt', a.titel); return 'erledigt'; }
      a.status = 'wartet'; anEltern(ichId, 'erledigt', `${name(ichId)} hat eine Aufgabe erledigt`, a.titel); return 'wartet';
    },
    async aufgabeBestaetigen(id, punkte) {
      await warte();
      const a = finde(id);
      if (!eltern()) nein('Bestätigen können nur Eltern');
      if (a.status !== 'wartet') nein('Hier gibt es nichts zu bestätigen');
      if (a.fuer === ichId) nein('Das bestätigt das andere Elternteil');
      const wert = a.art === 'frei' ? Math.min(Math.max(punkte || 1, 1), 2) : PUNKTE[a.art];
      a.status = 'erledigt'; a.bestaetigt_von = ichId; punkt(a.fuer, wert, 'erledigt', a.titel);
      an(a.fuer, 'bestaetigt', `Bestätigt, +${wert} ${wert === 1 ? 'Punkt' : 'Punkte'}`, a.titel);
    },
    async aufgabeZurueck(id) {
      const a = finde(id);
      if (!eltern()) nein('Das können nur Eltern');
      a.status = a.art === 'frei' ? 'abgelehnt' : 'offen'; a.erledigt_am = null;
      an(a.fuer, 'bestaetigt', a.art === 'frei' ? 'Nicht anerkannt' : 'Bitte noch einmal', a.titel);
    },
    async aufgabeVerschieben(id) {
      const a = finde(id);
      if (a.fuer !== ichId) nein('Das ist nicht deine Aufgabe');
      if (a.verschoben) nein('Diese Aufgabe wurde schon einmal verschoben');
      a.faellig = plus(a.faellig, 1); a.verschoben = true;
    },
    async aufgabeLoeschen(id) { AUF = AUF.filter(a => a.id !== id); },
    async jokerEinloesen() {
      await warte();
      if (JOKER_HEUTE.includes(ichId)) nein('Du hast heute schon einen Joker eingelöst');
      if (!JOKER[ichId]) nein('Du hast keinen Joker');
      JOKER[ichId]--; JOKER_HEUTE.push(ichId);
      AUF.filter(a => a.fuer === ichId && a.art === 'tag' && a.status === 'offen' && a.faellig === h).forEach(a => { a.status = 'entfallen'; });
      anEltern(ichId, 'joker', `${name(ichId)} hat einen Joker eingelöst`, 'Heute sind keine Tagesaufgaben zu erledigen.');
    },
    async punkteVerlauf(id) { await warte(); return kopie(PKT.filter(p => p.mitglied_id === id).sort((a, b) => b.am.localeCompare(a.am)).slice(0, 30)); },

    async einkaufNeu(k) {
      await warte();
      if (k.status === 'liste' && !eltern()) nein('Das darfst du nicht');
      KAUF.push({ id: neuId(), titel: k.titel, menge: k.menge || '', status: k.status, von: ichId, grund: null });
      if (k.status === 'vorschlag') anEltern(ichId, 'einkauf', 'Neuer Vorschlag für die Einkaufsliste', k.titel);
    },
    async einkaufSetzen(id, werte) {
      if (!eltern()) nein('Das darfst du nicht');
      const k = KAUF.find(v => v.id === id); if (!k) return;
      const vorher = k.status; Object.assign(k, werte);
      if (vorher === 'vorschlag' && k.status !== 'vorschlag') an(k.von, 'einkauf', k.status === 'liste' ? 'Kommt auf die Einkaufsliste' : 'Vorschlag abgelehnt', k.titel + (k.grund ? ': ' + k.grund : ''));
    },
    async einkaufLoeschen(id) { KAUF = KAUF.filter(k => k.id !== id); },

    async terminSpeichern(t) {
      await warte();
      const werte = { titel: t.titel, beginn: t.beginn, ganztags: t.ganztags, fuer: t.fuer, wiederholung: t.wiederholung, erinnerung_min: t.erinnerung_min };
      if (t.id) Object.assign(TERM.find(v => v.id === t.id) || {}, werte); else TERM.push({ id: neuId(), von: ichId, ...werte });
    },
    async terminLoeschen(id) { TERM = TERM.filter(t => t.id !== id); },
    async merkNeu(m) { MERK.push({ id: neuId(), titel: m.titel, wann_text: '', erinnern_am: m.erinnern_am || null, erledigt: false, von: ichId }); },
    async merkSetzen(id, werte) { Object.assign(MERK.find(m => m.id === id) || {}, werte); },

    async schweinNeu(p) { await warte(); SCHW.push({ id: neuId(), name: p.name, ziel_cent: p.ziel_cent || null, von: ichId }); },
    async buchen(b) {
      await warte();
      if (b.betrag_cent < 0 && !eltern()) nein('Das darfst du nicht');
      if (b.betrag_cent < 0 && stand(b.schwein_id) + b.betrag_cent < 0) nein('So viel ist nicht im Sparschwein');
      BUCH.push({ id: neuId(), schwein_id: b.schwein_id, mitglied_id: ichId, betrag_cent: b.betrag_cent, weg: b.weg || 'bar', am: jetzt() });
    },
    async buchungen(id) { await warte(); return kopie(BUCH.filter(b => b.schwein_id === id).sort((a, b) => b.am.localeCompare(a.am))); },
    async schweinAufbrechen(id) { if (!eltern()) nein('Aufbrechen können nur Eltern'); SCHW = SCHW.filter(s => s.id !== id); },

    async pushSpeichern() {}, async pushWeg() {},
    async postGelesen() { if (POST[ichId]) POST[ichId].length = 0; },
    async fotoHoch(eimer, blob) { return URL.createObjectURL(blob); },
    async fotoUrl(pfad) { return pfad; },
  };
}
