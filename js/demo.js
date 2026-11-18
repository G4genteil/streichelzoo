// Demo: dieselbe Schnittstelle wie backend.js, aber alles liegt nur im Speicher dieses Tabs.
// Zum Ausprobieren und zum Testen der Oberfläche, ohne echte Daten anzufassen: index.html?demo
// Die Regeln sind hier nachgebaut. Maßgeblich sind die in der Datenbank (supabase/01_schema.sql).
import { heute, plus, wocheEnde, PUNKTE } from './hilfen.js';
import { ZOO_TIERE } from './zoo_katalog.js';

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
    erledigt_am: status === 'offen' ? null : jetzt(), bestaetigt_von: null, created_at: jetzt(),
    ohne_punkte: false, gruppe: null, erledigt_von: null, notiz: null, weitere_fotos: null, ...mehr });
  let AUF = [
    aufgabe('Spülmaschine ausräumen', 'tag', 'm4'), aufgabe('Müll rausbringen', 'tag', 'm4', 'wartet'),
    aufgabe('Zimmer saugen', 'tag', 'm3', 'offen', { foto_pflicht: true }), aufgabe('Wäsche aufhängen', 'tag', 'm3', 'wartet'),
    aufgabe('Hausaufgaben zeigen', 'tag', 'm3', 'wartet', { foto_pflicht: true, foto_pfad: 'icons/logo.webp', weitere_fotos: ['icons/joker.webp', 'icons/logo.webp'] }),
    aufgabe('Altglas wegbringen', 'tag', 'm2', 'offen'), aufgabe('Tisch decken', 'tag', 'm3', 'offen', { faellig: plus(h, 1) }),
    aufgabe('Keller aufräumen', 'woche', 'm4'), aufgabe('Fahrrad winterfest machen', 'woche', 'm3'),
    aufgabe('Laub im Garten harken', 'woche', 'm2', 'erledigt'),
    aufgabe('Alte Kleidung aussortieren', 'irgendwann', 'm4'), aufgabe('Regal im Flur anbringen', 'irgendwann', 'm2'),
    aufgabe('Fotos vom Urlaub sortieren', 'irgendwann', 'm1'),
    aufgabe('Müll rausbringen', 'tag', null, 'offen', { fuer_alle: true }),
    aufgabe('Garage aufräumen', 'tag', 'm2', 'offen', { gruppe: 'g1' }), aufgabe('Garage aufräumen', 'tag', 'm4', 'offen', { gruppe: 'g1' }),
    aufgabe('Bett machen', 'tag', 'm4', 'offen', { ohne_punkte: true }),
    aufgabe('Bad putzen', 'tag', 'm3', 'offen', { notiz: 'Auch den Spiegel. Putzmittel steht unter dem Waschbecken.' }),
    aufgabe('Wäsche zusammenlegen', 'tag', 'm1', 'wartet', { erledigt_von: 'm1', von: 'm2' }),
  ];
  const SERIE = { m1: 4, m2: 0, m3: 12, m4: 6 };          // Tage in Folge alles erledigt
  const SIEGE = { m1: 1, m2: 0, m3: 4, m4: 2 };           // so oft die Woche gewonnen
  // Zum Ausprobieren von „Einkaufen ohne Netz": in der Konsole zooOhneNetz = true setzen, später wieder false.
  const netz = () => { if (globalThis.zooOhneNetz) throw Object.assign(new Error('Keine Verbindung zum Internet'), { offline: true }); };
  let SERIEN = [
    { id: 'r1', titel: 'Spülmaschine ausräumen', art: 'tag', fuer: 'm4', von: 'm1', tage: [1, 2, 3, 4, 5, 6, 7], foto_pflicht: false },
    { id: 'r2', titel: 'Zimmer saugen', art: 'tag', fuer: 'm3', von: 'm1', tage: [3, 6], foto_pflicht: true },
    { id: 'r3', titel: 'Keller aufräumen', art: 'woche', fuer: 'm4', von: 'm2', tage: [1, 2, 3, 4, 5, 6, 7], foto_pflicht: false },
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
    { id: neuId(), titel: 'Eistee Pfirsich', menge: '2×', status: 'vorschlag', von: 'm3', grund: null, foto_pfad: 'icons/logo.webp', weitere_fotos: ['icons/joker.webp'] },
    { id: neuId(), titel: 'Tiefkühlpizza', menge: '3×', status: 'vorschlag', von: 'm4', grund: null },
    { id: neuId(), titel: 'Energy-Drinks', menge: '6×', status: 'abgelehnt', von: 'm3', grund: 'Zu viel Zucker', entschieden_von: 'm1' },
    { id: neuId(), titel: 'Gummibärchen', menge: '', status: 'liste', von: 'm4', grund: null, entschieden_von: 'm2' },
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
  const POST = { m1: [], m2: [], m3: [{ id: neuId(), art: 'einkauf', titel: 'Vorschlag abgelehnt', inhalt: 'Energy-Drinks: Zu viel Zucker', ziel: 'einkauf', created_at: jetzt() }],
    m4: [{ id: neuId(), art: 'bestaetigt', titel: 'Bestätigt, +1 Punkt', inhalt: 'Tisch abräumen', ziel: 'aufgaben', created_at: jetzt() }] };
  const OFT = ['Milch', 'Brot', 'Eier', 'Butter', 'Äpfel', 'Bananen', 'Nudeln', 'Haferflocken', 'Käse', 'Joghurt', 'Spülmittel', 'Toilettenpapier', 'Tomaten', 'Kaffee'];
  // Die Woche davor ist schon ausgewertet: Linus hat gewonnen.
  const ENDSTAND = { woche: plus(wocheEnde(), -14), reihen: [
    { mitglied_id: 'm1', punkte: 9, platz: 3, joker: false }, { mitglied_id: 'm2', punkte: -2, platz: 4, joker: false },
    { mitglied_id: 'm3', punkte: 14, platz: 1, joker: true }, { mitglied_id: 'm4', punkte: 11, platz: 2, joker: false }] };

  // Zoo: wie in 11_zoo.sql. Futter = 10 je Pluspunkt minus was die Tiere gekostet haben.
  const ZOO = [];
  const zieht = (m, tier, wie, tageHer) => ZOO.push({ mitglied_id: m, tier, wie, futter: wie === 'gekauft' ? ZOO_TIERE.find(t => t.id === tier).futter : 0,
    am: new Date(Date.now() - tageHer * 864e5).toISOString() });
  zieht('m1', 'schaf', 'start', 3); zieht('m1', 'huhn', 'gekauft', 2); zieht('m1', 'pfau', 'verdient', 1);
  zieht('m2', 'alpaka', 'start', 3);
  zieht('m3', 'ziege', 'start', 3); zieht('m3', 'huhn', 'gekauft', 3); zieht('m3', 'kuh', 'gekauft', 2); zieht('m3', 'pinguin', 'verdient', 2);
  zieht('m3', 'schwein', 'gekauft', 2); zieht('m3', 'pfau', 'verdient', 1); zieht('m3', 'greif', 'verdient', 1); zieht('m3', 'fuchs', 'gekauft', 0);
  zieht('m4', 'hase', 'start', 3); zieht('m4', 'katze', 'gekauft', 2); zieht('m4', 'ente', 'gekauft', 1); zieht('m4', 'pfau', 'verdient', 1);
  const HERZEN = [{ von: 'm1', fuer: 'm3', tag: plus(h, -1) }, { von: 'm4', fuer: 'm3', tag: h }, { von: 'm3', fuer: 'm4', tag: plus(h, -2) }];
  const ERLEDIGT = { m1: 120, m2: 90, m3: 61, m4: 130 }, PERFEKT = { m1: 2, m2: 0, m3: 3, m4: 1 };
  const futter = m => Math.max(0, 10 * PKT.filter(p => p.mitglied_id === m && p.wert > 0).reduce((n, p) => n + p.wert, 0)
    - ZOO.filter(t => t.mitglied_id === m).reduce((n, t) => n + t.futter, 0));
  const zooStand = () => M.map(m => ({ mitglied_id: m.id, futter: futter(m.id), muede: m.id === 'm2',
    herzen: HERZEN.filter(x => x.fuer === m.id).length, herz_heute: HERZEN.some(x => x.fuer === m.id && x.von === ichId && x.tag === h),
    flamme: SERIE[m.id] || 0, siege: SIEGE[m.id] || 0, aufgaben: ERLEDIGT[m.id] || 0, perfekt: PERFEKT[m.id] || 0,
    familie: Object.values(ERLEDIGT).reduce((a, b) => a + b, 0) }));

  const eltern = () => (M.find(m => m.id === ichId) || {}).rolle === 'eltern';
  const name = id => (M.find(m => m.id === id) || {}).name || 'Jemand';
  const stand = s => BUCH.filter(b => b.schwein_id === s).reduce((n, b) => n + b.betrag_cent, 0);
  const anEltern = (ausser, art, titel, inhalt, ziel = null) => M.filter(m => m.rolle === 'eltern' && m.id !== ausser).forEach(m => POST[m.id].unshift({ id: neuId(), art, titel, inhalt, ziel, created_at: jetzt() }));
  const an = (wen, art, titel, inhalt, ziel = null) => POST[wen] && POST[wen].unshift({ id: neuId(), art, titel, inhalt, ziel, created_at: jetzt() });
  const finde = id => AUF.find(a => a.id === id) || nein('Diese Aufgabe gibt es nicht mehr');
  const wert = a => a.ohne_punkte ? 0 : (PUNKTE[a.art] || 0);
  const runde = a => a.gruppe ? AUF.filter(x => x.gruppe === a.gruppe) : [a];
  const aufz = l => l.length < 2 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' und ' + l[l.length - 1];
  const pkt = n => `+${n} ${n === 1 ? 'Punkt' : 'Punkte'}`;
  // Prüfen darf ein Elternteil, das nicht selbst beteiligt ist. Machen alle Eltern mit: wer nicht abgehakt hat.
  const darf = a => {
    if (!eltern()) return false;
    if (!a.gruppe) return a.fuer !== ichId;
    const dabei = runde(a).map(x => x.fuer);
    return !dabei.includes(ichId) || (a.erledigt_von !== ichId && M.filter(m => m.rolle === 'eltern').every(m => dabei.includes(m.id)));
  };

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
      netz();
      const best = M.map(m => ({ mitglied_id: m.id, joker: JOKER[m.id] || 0, serie: SERIE[m.id] || 0, siege: SIEGE[m.id] || 0,
        woche: PKT.filter(p => p.mitglied_id === m.id && p.woche).reduce((n, p) => n + p.wert, 0),
        gesamt: PKT.filter(p => p.mitglied_id === m.id).reduce((n, p) => n + p.wert, 0) }));
      return kopie({ mitglieder: M, aufgaben: AUF, best, jokerHeute: JOKER_HEUTE, einkauf: KAUF, termine: TERM, merk: MERK,
        schweine: SCHW.map(s => ({ ...s, stand_cent: stand(s.id) })), post: POST[ichId] || [], info: { iban: 'DE00 0000 0000 0000 0000 00', empfaenger: 'Demo-Konto' },
        serien: SERIEN, endstand: ENDSTAND, zoo: { tiere: ZOO, stand: zooStand() } });
    },
    beobachten() {}, nichtBeobachten() {},

    async vorschlaege(fuer) { return eltern() ? [...new Set(AUF.filter(a => a.fuer === fuer && a.art === 'tag').map(a => a.titel))].slice(0, 6) : []; },
    async aufgabeAnlegen(a) {
      await warte();
      const mit = (a.mit || []).filter(id => id !== a.fuer), dabei = a.fuer ? [a.fuer, ...mit] : [];
      if (!a.fuer && mit.length) nein('Wähle aus, wer mitmacht');
      if (!a.fuer && a.art !== 'tag' && a.art !== 'woche') nein('Für alle gibt es nur Tages- und Wochenaufgaben');
      if (dabei.some(id => !M.some(m => m.id === id))) nein('Dieses Familienmitglied gibt es nicht');
      if ((a.art === 'tag' || a.art === 'woche') && !eltern()) nein('Das können nur Eltern eintragen');
      if (a.art === 'frei' && (a.fuer !== ichId || mit.length)) nein('Freiwillige Aufgaben trägst du für dich selbst ein');
      const tag = a.art === 'tag' ? (a.faellig || h) : a.art === 'woche' ? wocheEnde() : a.art === 'frei' ? h : null;
      if (a.art === 'tag' && tag === h && dabei.some(id => JOKER_HEUTE.includes(id))) nein('An diesem Tag ist ein Joker eingelöst');
      const ohne = !!a.ohne_punkte && (a.art === 'tag' || a.art === 'woche'), gruppe = dabei.length > 1 ? neuId() : null;
      const notiz = (a.notiz || '').trim().slice(0, 200) || null, fotos = a.art === 'frei' ? (a.fotos || []) : [];
      if (fotos.length > 12) nein('Das sind zu viele Fotos. Mehr als 12 gehen nicht.');
      const wann = a.art === 'irgendwann' ? 'Ohne Datum' : a.art === 'woche' ? 'Bis Sonntag, 18 Uhr' : tag === h ? 'Für heute' : 'Für morgen';
      if (!a.fuer) {
        const neu = aufgabe(a.titel, a.art, null, 'offen', { von: ichId, fuer_alle: true, faellig: tag, foto_pflicht: !!a.foto_pflicht, ohne_punkte: ohne, notiz });
        AUF.push(neu);
        M.filter(m => m.id !== ichId).forEach(m => an(m.id, 'neu', `${name(ichId)} hat eine Aufgabe für alle: ${a.titel}`,
          ohne ? 'Wer zuerst kommt, erledigt sie. Punkte gibt es dafür keine.' : 'Wer sie zuerst erledigt, bekommt den Punkt.', 'aufgabe:' + neu.id));
        return;
      }
      for (const p of dabei) {
        const neu = aufgabe(a.titel, a.art, p, a.art === 'frei' ? 'wartet' : 'offen', { von: ichId, faellig: tag, foto_pflicht: !!a.foto_pflicht,
          foto_pfad: fotos[0] || null, weitere_fotos: fotos.length > 1 ? fotos.slice(1) : null, erinnerung_tage: a.erinnerung_tage || 7, ohne_punkte: ohne, gruppe, notiz });
        AUF.push(neu);
        if (a.art === 'frei') anEltern(ichId, 'erledigt', `${name(ichId)} hat freiwillig etwas erledigt`, a.titel + (fotos.length > 1 ? ` (mit ${fotos.length} Fotos)` : fotos.length ? ' (mit Foto)' : ''), 'aufgabe:' + neu.id);
        else if (p !== ichId) an(p, 'neu', `${name(ichId)} hat eine Aufgabe für ${gruppe ? 'euch' : 'dich'}: ${a.titel}`,
          wann + (gruppe ? `. Zusammen mit ${aufz(dabei.filter(x => x !== p).map(name))}.` : '') + (!ohne ? '' : gruppe ? ' Ohne Punkte.' : ', ohne Punkte'), 'aufgabe:' + neu.id);
      }
    },
    async aufgabeErledigen(id, fotos) {
      await warte();
      const a = finde(id);
      if (!a.fuer && a.fuer_alle && a.status === 'offen') a.fuer = ichId;
      if (a.fuer !== ichId) nein(a.fuer_alle ? 'Da war jemand schneller' : 'Das ist nicht deine Aufgabe');
      if (a.status !== 'offen') nein(a.gruppe ? 'Das hat schon jemand von euch abgehakt' : 'Die Aufgabe ist nicht mehr offen');
      const foto = fotos && fotos[0];
      if (fotos && fotos.length > 12) nein('Das sind zu viele Fotos. Mehr als 12 gehen nicht.');
      if (a.foto_pflicht && !foto && !a.foto_pfad) nein('Für diese Aufgabe ist ein Foto nötig');
      // Auch Eltern warten auf das andere Elternteil. Nur wer allein erzieht, ist sofort fertig.
      const sofort = a.art === 'irgendwann' || (eltern() && !M.some(m => m.rolle === 'eltern' && m.id !== ichId));
      for (const x of runde(a).filter(x => x.id === a.id || x.status === 'offen')) {
        x.hinweis = null; x.erledigt_am = jetzt(); x.erledigt_von = ichId;
        if (foto) { x.foto_pfad = foto; x.weitere_fotos = fotos.length > 1 ? fotos.slice(1) : null; }
        x.status = sofort ? 'erledigt' : 'wartet';
        if (sofort && wert(x)) punkt(x.fuer, wert(x), 'erledigt', x.titel);
      }
      if (sofort) return 'erledigt';
      const mit = runde(a).filter(x => x.id !== a.id).map(x => name(x.fuer));
      anEltern(ichId, 'erledigt', `${name(ichId)} hat erledigt: ${a.titel}`, (mit.length ? `Zusammen mit ${aufz(mit)}. ` : '') + (foto && fotos.length > 1 ? `Mit ${fotos.length} Fotos. ` : foto || a.foto_pfad ? 'Mit Foto. ' : '') + 'Tippe, um zu bestätigen.', 'aufgabe:' + a.id);
      return 'wartet';
    },
    async aufgabeWiederoeffnen(id) {
      await warte();
      const a = finde(id);
      if (a.fuer !== ichId) nein('Das ist nicht deine Aufgabe');
      if (a.gruppe && a.erledigt_von !== ichId) nein('Das hat jemand anderes abgehakt');
      if (a.art === 'frei' || !(a.status === 'wartet' || (a.status === 'erledigt' && !a.bestaetigt_von))) nein('Das lässt sich nicht mehr zurücknehmen');
      for (const x of runde(a).filter(x => x.id === a.id || (x.erledigt_von === ichId && !x.bestaetigt_von && (x.status === 'wartet' || x.status === 'erledigt')))) {
        if (x.status === 'erledigt' && wert(x)) { const i = PKT.findIndex(p => p.mitglied_id === x.fuer && p.aufgaben && p.aufgaben.titel === x.titel); if (i >= 0) PKT.splice(i, 1); }
        x.status = 'offen'; x.erledigt_am = null; x.erledigt_von = null;
        if (x.fuer_alle) x.fuer = null;
      }
      M.forEach(m => { POST[m.id] = (POST[m.id] || []).filter(p => p.ziel !== 'aufgabe:' + id || p.art !== 'erledigt'); });
    },
    async alleBestaetigen() {
      await warte();
      if (!eltern()) nein('Bestätigen können nur Eltern');
      const offen = AUF.filter(a => a.status === 'wartet' && darf(a));
      offen.forEach(a => { a.status = 'erledigt'; a.bestaetigt_von = ichId; a.hinweis = null; if (wert(a)) punkt(a.fuer, wert(a), 'erledigt', a.titel); });
      for (const m of new Set(offen.map(a => a.fuer))) {
        if (m === ichId) continue;
        const seine = offen.filter(a => a.fuer === m), p = seine.reduce((n, a) => n + wert(a), 0);
        if (seine.length === 1) an(m, 'bestaetigt', `${name(ichId)} hat bestätigt: ${seine[0].titel}`, p ? `${pkt(p)} für dich.` : 'Danke fürs Erledigen.', 'aufgabe:' + seine[0].id);
        else an(m, 'bestaetigt', `${name(ichId)} hat ${seine.length} Aufgaben bestätigt${p ? ', ' + pkt(p) : ''}`, seine.map(a => a.titel).join(', '), 'aufgaben');
      }
      return new Set(offen.map(a => a.gruppe || a.id)).size;
    },
    async serieAnlegen(s) {
      await warte();
      if (!eltern()) nein('Das können nur Eltern eintragen');
      const tage = s.tage && s.tage.length ? s.tage : [1, 2, 3, 4, 5, 6, 7], wt = new Date().getDay() || 7;
      if (s.art === 'tag' && s.tage && !s.tage.length) nein('Wähle mindestens einen Wochentag');
      const mit = s.fuer ? (s.mit || []).filter(id => id !== s.fuer) : [];
      const serie = { id: neuId(), titel: s.titel, art: s.art, fuer: s.fuer, von: ichId, tage, foto_pflicht: !!s.foto_pflicht, mit, ohne_punkte: !!s.ohne_punkte, notiz: (s.notiz || '').trim() || null };
      SERIEN.push(serie);
      if (s.art === 'tag' && !tage.includes(wt)) return;
      const mehr = { von: ichId, foto_pflicht: !!s.foto_pflicht, serie_id: serie.id, ohne_punkte: !!s.ohne_punkte, notiz: serie.notiz };
      if (!s.fuer) return void AUF.push(aufgabe(s.titel, s.art, null, 'offen', { ...mehr, fuer_alle: true }));
      const dabei = [s.fuer, ...mit].filter(id => s.art === 'woche' || !JOKER_HEUTE.includes(id)), gruppe = dabei.length > 1 ? neuId() : null;
      dabei.forEach(p => AUF.push(aufgabe(s.titel, s.art, p, 'offen', { ...mehr, gruppe })));
    },
    async aufgabeAendern(id, n) {
      await warte();
      const a = finde(id);
      if (!(eltern() || (a.von === ichId && a.art === 'irgendwann'))) nein('Das darfst du nicht ändern');
      if (a.art === 'frei' || a.status !== 'offen') nein('Das lässt sich nicht mehr ändern');
      if (n.faellig && a.art !== 'tag') nein('Nur Tagesaufgaben haben einen Tag');
      if (n.fuer && n.fuer !== a.fuer && (a.gruppe || !a.fuer)) nein('Hier lässt sich die Person nicht ändern');
      const tag = n.faellig || a.faellig, fuer = n.fuer || a.fuer;
      if (a.art === 'tag' && tag === h && (tag !== a.faellig || fuer !== a.fuer) && runde(a).some(x => JOKER_HEUTE.includes(x.id === a.id ? fuer : x.fuer))) nein('An diesem Tag ist ein Joker eingelöst');
      for (const x of runde(a).filter(x => x.status === 'offen')) {
        x.titel = (n.titel || '').trim() || x.titel; x.faellig = tag;
        if (n.notiz != null) x.notiz = n.notiz.trim().slice(0, 200) || null;
        if (x.art !== 'irgendwann') { if (n.foto_pflicht != null) x.foto_pflicht = n.foto_pflicht; if (n.ohne_punkte != null) x.ohne_punkte = n.ohne_punkte; }
      }
      if (fuer !== a.fuer) {
        a.fuer = fuer;
        if (fuer !== ichId) an(fuer, 'neu', `${name(ichId)} hat eine Aufgabe für dich: ${a.titel}`, a.art === 'irgendwann' ? 'Ohne Datum' : a.art === 'woche' ? 'Bis Sonntag, 18 Uhr' : tag === h ? 'Für heute' : 'Für morgen', 'aufgabe:' + a.id);
      }
    },
    async serieAendern(id, n) {
      await warte();
      if (!eltern()) nein('Das können nur Eltern ändern');
      const x = SERIEN.find(v => v.id === id) || nein('Diese Wiederholung gibt es nicht mehr');
      if (n.tage && x.art === 'tag' && !n.tage.length) nein('Wähle mindestens einen Wochentag');
      if (n.fuer && n.fuer !== x.fuer && (!x.fuer || (x.mit || []).length)) nein('Hier lässt sich die Person nicht ändern');
      x.titel = (n.titel || '').trim() || x.titel;
      if (n.notiz != null) x.notiz = n.notiz.trim().slice(0, 200) || null;
      if (n.tage && x.art === 'tag') x.tage = n.tage;
      if (n.foto_pflicht != null) x.foto_pflicht = n.foto_pflicht;
      if (n.ohne_punkte != null) x.ohne_punkte = n.ohne_punkte;
      if (n.fuer) x.fuer = n.fuer;
      AUF.filter(a => a.serie_id === id && a.status === 'offen').forEach(a => Object.assign(a, { titel: x.titel, notiz: x.notiz || null, foto_pflicht: x.foto_pflicht, ohne_punkte: x.ohne_punkte }));
    },
    async serieLoeschen(id) { if (!eltern()) nein('Das darfst du nicht'); SERIEN = SERIEN.filter(s => s.id !== id); },
    async aufgabeBestaetigen(id, punkte, lob) {
      await warte();
      const a = finde(id);
      if (!eltern()) nein('Bestätigen können nur Eltern');
      if (a.status !== 'wartet') nein('Hier gibt es nichts zu bestätigen');
      if (!darf(a)) nein('Das bestätigt das andere Elternteil');
      for (const x of runde(a).filter(x => x.status === 'wartet')) {
        const w = x.art === 'frei' ? Math.min(Math.max(punkte || 1, 1), 2) : wert(x);
        x.status = 'erledigt'; x.bestaetigt_von = ichId; x.lob = lob || null; x.hinweis = null;
        if (w) punkt(x.fuer, w, 'erledigt', x.titel);
        if (x.fuer !== ichId) an(x.fuer, 'bestaetigt', `${name(ichId)} hat bestätigt: ${x.titel}`, `${lob ? lob + '! ' : ''}${w ? `${pkt(w)} für dich.` : 'Danke fürs Erledigen.'}`, 'aufgabe:' + x.id);
      }
    },
    async aufgabeZurueck(id, grund) {
      const a = finde(id);
      if (!eltern()) nein('Das können nur Eltern');
      if (a.status !== 'wartet') nein('Hier gibt es nichts zu prüfen');
      if (!darf(a)) nein('Das prüft das andere Elternteil');
      for (const x of runde(a).filter(x => x.status === 'wartet')) {
        x.status = x.art === 'frei' ? 'abgelehnt' : 'offen'; x.erledigt_am = null; x.erledigt_von = null; x.hinweis = grund || null;
        if (x.fuer !== ichId) an(x.fuer, 'bestaetigt', name(ichId) + (x.art === 'frei' ? ' hat das nicht anerkannt' : ' sagt: bitte noch einmal'), x.titel + (grund ? ': ' + grund : ''), 'aufgabe:' + x.id);
      }
    },
    async aufgabeVerschieben(id) {
      const a = finde(id);
      if (a.fuer !== ichId) nein('Das ist nicht deine Aufgabe');
      if (a.gruppe) nein('Gemeinsame Aufgaben lassen sich nicht verschieben');
      if (a.verschoben) nein('Diese Aufgabe wurde schon einmal verschoben');
      a.faellig = plus(a.faellig, 1); a.verschoben = true;
    },
    async aufgabeLoeschen(id, gruppe) { AUF = AUF.filter(a => gruppe ? a.gruppe !== gruppe : a.id !== id); },
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
      KAUF.push({ id: neuId(), titel: k.titel, menge: k.menge || '', status: k.status, von: ichId, grund: null, foto_pfad: (k.fotos && k.fotos[0]) || null, weitere_fotos: k.fotos && k.fotos.length > 1 ? k.fotos.slice(1) : null });
      if (k.status === 'vorschlag') anEltern(ichId, 'einkauf', `${name(ichId)} wünscht sich: ${k.titel}`, 'Tippe, um zu entscheiden.', 'einkauf');
    },
    async einkaufSetzen(id, werte) {
      await warte(); netz();
      if (!eltern()) nein('Das darfst du nicht');
      const k = KAUF.find(v => v.id === id); if (!k) return;
      const vorher = k.status; Object.assign(k, werte);
      if (vorher === 'vorschlag' && k.status !== 'vorschlag') {
        k.entschieden_von = ichId;
        if (k.status === 'liste') an(k.von, 'einkauf', `${name(ichId)} hat deinen Vorschlag angenommen`, `${k.titel} steht jetzt auf der Einkaufsliste.`, 'einkauf');
        else an(k.von, 'einkauf', `${name(ichId)} hat deinen Vorschlag abgelehnt`, k.titel + (k.grund ? ': ' + k.grund : ''), 'einkauf');
      }
    },
    async einkaufLoeschen(id) { KAUF = KAUF.filter(k => k.id !== id); },
    async einkaufLos() {
      await warte();
      if (!eltern()) nein('Das können nur Eltern');
      const n = KAUF.filter(k => k.status === 'liste').length;
      M.filter(m => m.id !== ichId).forEach(m => an(m.id, 'einkauf', `${name(ichId)} geht jetzt einkaufen`, `${n} Sachen stehen auf der Liste. Fehlt noch etwas?`, 'einkauf'));
      return n;
    },
    async einkaufHaeufig() { await warte(); return [...OFT]; },
    async einkaufAufraeumen() {
      if (!eltern()) nein('Das darfst du nicht');
      const weg = KAUF.filter(k => k.status === 'gekauft');
      weg.forEach(k => { k.status = 'archiv'; });
      return weg.map(k => k.id);
    },
    async einkaufZurueckholen(ids) { KAUF.forEach(k => { if (ids.includes(k.id)) k.status = 'gekauft'; }); },

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

    async zooKaufen(id) {
      await warte();
      const k = ZOO_TIERE.find(t => t.id === id) || nein('Dieses Tier gibt es nicht');
      if (ZOO.some(t => t.mitglied_id === ichId && t.tier === id)) nein('Das Tier wohnt schon in deinem Zoo');
      if (!k.futter) nein('Dieses Tier kann man nicht kaufen. Es zieht ein bei: ' + k.ziel_text);
      if (futter(ichId) < k.futter) nein('Dafür reicht dein Futter noch nicht');
      ZOO.push({ mitglied_id: ichId, tier: id, wie: 'gekauft', futter: k.futter, am: jetzt() });
      return { futter: futter(ichId) };
    },
    async zooHerz(fuer) {
      await warte();
      if (fuer === ichId) nein('In deinen eigenen Zoo kannst du kein Herz legen');
      if (HERZEN.some(x => x.von === ichId && x.fuer === fuer && x.tag === h)) return false;
      HERZEN.push({ von: ichId, fuer, tag: h });
      an(fuer, 'zoo', `${name(ichId)} war in deinem Zoo`, 'Und hat ein Herz dagelassen.', 'zoo');
      return true;
    },

    async pushSpeichern() {}, async pushWeg() {},
    async postGelesen() { if (POST[ichId]) POST[ichId].length = 0; },
    async fotoHoch(eimer, blob) { return URL.createObjectURL(blob); },
    async fotoUrls(pfade) { await warte(); return [...pfade]; },
  };
}
