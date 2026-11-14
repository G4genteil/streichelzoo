// Die Verbindung zu Supabase. Diese Datei ist die einzige, die mit dem Server spricht.
// Alles, was Regeln hat (Punkte, Bestätigen, Joker), läuft über Funktionen in der Datenbank.
import { heute, plus } from './hilfen.js';

// Technische Fehler in verständliche Sätze übersetzen. Sätze aus der Datenbank (P0001) sind schon deutsch.
function deutsch(e) {
  const m = String(e?.message || e || '');
  if (e?.code === 'P0001') return m;
  if (/Failed to fetch|NetworkError|Load failed|fetch failed|network/i.test(m)) return 'Keine Verbindung zum Internet';
  if (e?.code === '42501' || /row-level security|permission denied/i.test(m)) return 'Das darfst du nicht';
  if (/farbe_form|tier_kurz|bild_form/.test(m)) return 'Dieser Wert passt nicht';
  if (/betrag_grenze/.test(m)) return 'Der Betrag ist zu groß';
  if (/Anonymous sign-ins are disabled/i.test(m)) return 'In Supabase sind anonyme Anmeldungen noch ausgeschaltet';
  console.error('Supabase:', e);
  return 'Das hat nicht geklappt' + (m ? ` (${m.slice(0, 120)})` : '');
}

export function supabaseBackend(sb, url) {
  const x = async anfrage => {
    const { data, error, status } = await anfrage;
    if (error) {
      const f = new Error(deutsch(error));
      f.status = status; f.code = error.code;
      throw f;
    }
    return data;
  };
  const rpc = (name, werte) => x(sb.rpc(name, werte));
  const vor = tage => new Date(Date.now() - tage * 864e5).toISOString();
  let kanal = null;

  return {
    demo: false,
    bildUrl: pfad => `${url}/storage/v1/object/public/profilbilder/${pfad}`,

    // ---------- Anmeldung
    // Jedes Gerät meldet sich einmal namenlos an und bleibt es. Wer davor sitzt, entscheidet erst der Code.
    async start() {
      const namenlos = async () => {
        const r = await sb.auth.signInAnonymously();
        if (r.error) throw new Error(deutsch(r.error));
      };
      const { data } = await sb.auth.getSession();
      if (!data?.session) await namenlos();
      const lesen = () => Promise.all([rpc('profile_liste'), rpc('ich')]);
      let erg;
      try { erg = await lesen(); }
      catch (e) {
        if (e.status !== 401) throw e;                 // nur bei ungültiger Anmeldung neu anfangen, nicht bei Funkloch
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        await namenlos();
        erg = await lesen();
      }
      return { profile: erg[0], ich: erg[1] };
    },
    wer: () => rpc('ich'),
    profile: () => rpc('profile_liste'),
    anmelden: (id, pin) => rpc('anmelden', { p_mitglied: id, p_pin: pin }),
    abmelden: () => rpc('abmelden'),
    profilAnlegen: n => rpc('profil_anlegen', {
      p_name: n.name, p_rolle: n.rolle, p_farbe: n.farbe, p_tier: n.tier, p_pin: n.pin,
      p_familiencode: n.familiencode, p_eltern_pin: n.elternPin || null }),
    profilAendern: a => rpc('profil_aendern', {
      p_farbe: a.farbe ?? null, p_tier: a.tier ?? null, p_bild_pfad: a.bild_pfad ?? null, p_mitteilungen: a.mitteilungen ?? null }),
    codeSetzen: (id, pin) => rpc('code_setzen', { p_mitglied: id, p_pin: pin }),

    // ---------- Alles, was die App anzeigt, in einem Rutsch
    async laden() {
      const h = heute();
      const [mitglieder, aufgaben, best, joker, einkauf, termine, merk, schweine, post, info] = await Promise.all([
        x(sb.from('mitglieder').select('id,name,rolle,farbe,tier,bild_pfad,mitteilungen').order('created_at')),
        x(sb.from('aufgaben').select('*').or(`status.in.(offen,wartet),faellig.gte.${plus(h, -7)},erledigt_am.gte."${vor(7)}"`).order('created_at')),
        x(sb.from('bestenliste').select('*')),
        x(sb.from('joker').select('mitglied_id').eq('eingeloest_am', h)),
        x(sb.from('einkauf').select('*').or(`status.in.(vorschlag,liste),geaendert_am.gte."${vor(1)}"`).order('created_at')),
        x(sb.from('termine').select('*').or(`wiederholung.neq.nie,beginn.gte."${vor(45)}"`).order('beginn')),
        x(sb.from('merkzettel').select('*').or(`erledigt.is.false,geaendert_am.gte."${vor(1)}"`).order('created_at')),
        x(sb.from('sparschweine_stand').select('*').is('aufgebrochen_am', null).order('created_at')),
        x(sb.from('mitteilungen').select('id,art,titel,inhalt,created_at').eq('gelesen', false).order('created_at', { ascending: false }).limit(30)),
        x(sb.from('familie_info').select('iban,empfaenger').maybeSingle()),
      ]);
      return { mitglieder, aufgaben, best, jokerHeute: joker.map(j => j.mitglied_id), einkauf, termine, merk, schweine, post, info: info || {} };
    },
    beobachten(beiAenderung) {
      if (kanal) sb.removeChannel(kanal);
      kanal = sb.channel('streichelzoo').on('postgres_changes', { event: '*', schema: 'public' }, () => beiAenderung()).subscribe();
    },
    nichtBeobachten() { if (kanal) sb.removeChannel(kanal); kanal = null; },

    // ---------- Aufgaben
    vorschlaege: async fuer => (await rpc('aufgaben_vorschlaege', { p_fuer: fuer })).map(v => v.titel),
    aufgabeAnlegen: a => rpc('aufgabe_anlegen', {
      p_titel: a.titel, p_art: a.art, p_fuer: a.fuer, p_faellig: a.faellig ?? null,
      p_foto_pflicht: !!a.foto_pflicht, p_erinnerung_tage: a.erinnerung_tage ?? 7 }),
    aufgabeErledigen: (id, foto) => rpc('aufgabe_erledigen', { p_id: id, p_foto: foto ?? null }),
    aufgabeBestaetigen: (id, punkte) => rpc('aufgabe_bestaetigen', { p_id: id, p_punkte: punkte ?? null }),
    aufgabeZurueck: id => rpc('aufgabe_zurueckgeben', { p_id: id }),
    aufgabeVerschieben: id => rpc('aufgabe_verschieben', { p_id: id }),
    aufgabeLoeschen: id => x(sb.from('aufgaben').delete().eq('id', id)),
    jokerEinloesen: () => rpc('joker_einloesen'),
    punkteVerlauf: id => x(sb.from('punkte').select('wert,grund,am,aufgaben(titel)').eq('mitglied_id', id).order('am', { ascending: false }).limit(30)),

    // ---------- Einkauf
    einkaufNeu: k => x(sb.from('einkauf').insert({ titel: k.titel, menge: k.menge || '', status: k.status, von: k.von })),
    einkaufSetzen: (id, werte) => x(sb.from('einkauf').update(werte).eq('id', id)),
    einkaufLoeschen: id => x(sb.from('einkauf').delete().eq('id', id)),

    // ---------- Kalender und Dran-Denken
    terminSpeichern: t => {
      const werte = { titel: t.titel, beginn: t.beginn, ganztags: t.ganztags, fuer: t.fuer, wiederholung: t.wiederholung, erinnerung_min: t.erinnerung_min };
      return t.id ? x(sb.from('termine').update(werte).eq('id', t.id)) : x(sb.from('termine').insert({ ...werte, von: t.von }));
    },
    terminLoeschen: id => x(sb.from('termine').delete().eq('id', id)),
    merkNeu: m => x(sb.from('merkzettel').insert({ titel: m.titel, erinnern_am: m.erinnern_am || null, von: m.von })),
    merkSetzen: (id, werte) => x(sb.from('merkzettel').update(werte).eq('id', id)),

    // ---------- Sparen
    schweinNeu: p => x(sb.from('sparschweine').insert({ name: p.name, ziel_cent: p.ziel_cent || null, von: p.von })),
    buchen: b => x(sb.from('spar_buchungen').insert({ schwein_id: b.schwein_id, mitglied_id: b.mitglied_id, betrag_cent: b.betrag_cent, weg: b.weg || 'bar' })),
    buchungen: id => x(sb.from('spar_buchungen').select('id,mitglied_id,betrag_cent,weg,am').eq('schwein_id', id).order('am', { ascending: false }).limit(40)),
    schweinAufbrechen: id => rpc('sparschwein_aufbrechen', { p_id: id }),

    // ---------- Mitteilungen
    postGelesen: () => x(sb.from('mitteilungen').update({ gelesen: true }).eq('gelesen', false)),

    // ---------- Fotos
    async fotoHoch(eimer, blob, ordner) {
      const pfad = `${ordner}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from(eimer).upload(pfad, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(deutsch(error));
      return pfad;
    },
    async fotoUrl(pfad) {
      const { data, error } = await sb.storage.from('beweise').createSignedUrl(pfad, 3600);
      if (error) throw new Error(deutsch(error));
      return data.signedUrl;
    },
  };
}
