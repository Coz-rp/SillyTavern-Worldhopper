// Worldhopper Engine — the people the Body Ledger and the Mind Book views show, one entry per person. The Ledger, the
// World notes, the host sheets, the Body History, powers and names all talk about the same people, and drawn section by
// section one body turned up four or five times. This gathers each person's records under one name, says in a line
// what's going on with them, and sorts them by how much the player needs them right now. Pure, so the tests can load it.
import { aliasResolver, normalizeLedger, personNamedIn } from './ledger-core.js';
import { normalizeWorld } from './world-core.js';
import { normalizeBook } from './mind-core.js';

const lc = s => String(s ?? '').trim().toLowerCase();
const isNone = s => !s || lc(s) === 'none';
const COPY = /cop(y|ied)|propagat/i;
const list = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// Who comes first: you and your bodies, then who's in the scene, then bodies elsewhere, then everyone else (folded away).
export const GROUPS = ['yours', 'scene', 'elsewhere', 'rest'];
const KIND_ORDER = ['you', 'npc', 'idle', 'mind', 'back', 'plain'];

function people(canon) {
    const map = new Map();
    const get = name => {
        const key = canon(name);
        if (!key) return null;
        if (!map.has(key)) {
            map.set(key, { key, name: String(name).trim(), rows: [], drives: [], own: -1, place: -1, knows: -1, things: [], powers: [], aliases: -1, history: [], sheet: false, back: false });
        }
        return map.get(key);
    };
    return { map, get };
}

// The player's own body leads their group.
const sortPeople = (xs, mine) => xs.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || (b.key === mine) - (a.key === mine)
    || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));

/**
 * Everyone the Body Ledger view shows.
 * @param {object} o  ledger and world as stored; sheets: the host sheets by key ({ body, sheet, removed }); back: names
 *   back in their own bodies and still in the scene; history: historyGroups() entries; me: the player's name; scene: the
 *   latest messages; cards: lowercased names with a card of their own; away: lowercased names you marked "not in this
 *   scene", who stay out of it though the latest messages name them.
 * @returns {{ people: object[], things: number[] }} each person: { key, name, aka, group, kind, status, where, hidden,
 *   rows, drives, own, place, knows, things, powers, aliases, history, sheet, back, counts }, the numbers indexes into
 *   the records they came from. things: the World notes' things nobody shown holds or owns.
 */
export function ledgerPeople({ ledger, world, sheets = {}, back = [], history = [], me = '', scene = '', cards = new Set(), away = new Set() } = {}) {
    const l = normalizeLedger(ledger);
    const w = normalizeWorld(world);
    const canon = aliasResolver(l);
    const mine = canon(me);
    const { map, get } = people(canon);
    const secret = b => b.user_knows === 'no' && !isNone(b.body) && !!b.driver;

    l.bodies.forEach((b, i) => {
        const body = isNone(b.body) ? null : b.body;
        if (body) get(body).rows.push(i); else if (b.driver) get(b.driver).rows.push(i);
        if (body && b.driver && canon(b.driver) !== canon(body)) get(b.driver).drives.push(i);
    });
    l.own.forEach((o, j) => { if (o.who) get(o.who).own = j; });
    w.people.forEach((p, j) => { get(p.who).place = j; });
    w.knows.forEach((k, j) => { get(k.who).knows = j; });
    l.powers.forEach((p, j) => { if (p.who) get(p.who).powers.push(j); });
    l.aliases.forEach((a, j) => { if (a.name) get(a.name).aliases = j; });
    for (const e of Object.values(sheets || {})) if ((e?.sheet || e?.removed) && e.body && !cards.has(lc(e.body))) get(e.body).sheet = true;
    for (const name of back) get(name).back = true;
    history.forEach((g, gi) => { for (const body of g.bodies || []) get(body).history.push(gi); });
    // A thing goes with whoever has it, or else whoever it belongs to, among the people shown; holding a thing alone
    // doesn't make someone worth a card.
    const loose = [];
    w.things.forEach((t, j) => {
        const at = [t.holder, t.whose].map(n => n && map.get(canon(n))).find(Boolean);
        if (at) at.things.push(j); else loose.push(j);
    });

    const isMe = n => !!n && canon(n) === mine;
    const out = [];
    for (const p of map.values()) {
        const aka = p.aliases >= 0 ? [l.aliases[p.aliases].name, ...l.aliases[p.aliases].aka].filter(n => lc(n) !== lc(p.name)) : [];
        let kind = 'plain', status = '', hidden = false;
        const row = p.rows.length ? l.bodies[p.rows[0]] : null;
        if (row && isNone(row.body)) { kind = 'mind'; status = 'No body'; }
        else if (row && row.driver && canon(row.driver) !== p.key) {
            hidden = secret(row);
            if (COPY.test(row.how)) { kind = 'npc'; status = `A copy of ${isMe(row.driver) ? 'you' : row.driver}`; }
            else if (isMe(row.driver)) { kind = 'you'; status = "You're inside"; }
            else { kind = 'npc'; status = p.key === mine ? `${row.driver} is in you` : `${row.driver} inside`; }
        } else if (row) { kind = 'idle'; status = 'Empty'; }
        // Someone riding other bodies: where they are, after what's become of their own.
        const rode = p.drives.map(i => l.bodies[i]).filter(b => !COPY.test(b.how));
        if (rode.length) {
            const names = list(rode.map(b => b.body));
            const keeps = p.own >= 0 || (!row && rode.some(b => /multi|puppet/i.test(b.how)));
            const where = keeps ? `also in ${names}` : `in ${names}`;
            status = status ? `${status} · ${where}` : where.charAt(0).toUpperCase() + where.slice(1);
            if (kind === 'plain') kind = p.key === mine ? 'you' : 'npc';
            hidden ||= rode.some(secret);
        }
        if (kind === 'plain' && p.back) { kind = 'back'; status = 'Themselves again'; }
        if (p.key === mine && kind === 'plain') kind = 'you';

        const place = p.place >= 0 ? w.people[p.place] : null;
        const doing = row && !isMe(row.driver) ? row.doing : '';
        const where = [place?.where || row?.notes || (p.own >= 0 ? l.own[p.own].notes : ''), doing].filter(Boolean).join(' · ');

        const yours = p.key === mine || kind === 'you' && !!row;
        const here = p.back || (!away.has(p.key) && personNamedIn(scene, [p.name, ...aka]));
        const busy = p.rows.length || p.drives.length || p.own >= 0;
        const group = yours ? 'yours' : here ? 'scene' : busy ? 'elsewhere' : 'rest';
        const facts = p.knows >= 0 ? w.knows[p.knows].facts.length : 0;
        out.push({ ...p, aka, kind, status, where, hidden, group, counts: { knows: facts, things: p.things.length, powers: p.powers.length, history: p.history.length } });
    }
    return { people: sortPeople(out, mine), things: loose };
}

/**
 * Everyone the Mind Book view shows: one entry per person, whatever hypnosis, control and change over time hold for
 * them, and the perception edits apart (one can cover a whole room).
 * @returns {{ people: object[], edits: number[] }} each person: { key, name, hypnosis, control: [], influence: [], status,
 *   group ('scene' or 'rest'), hidden }, the numbers indexes into the book's lists.
 */
export function mindPeople({ book, me = '', scene = '' } = {}) {
    const b = normalizeBook(book);
    const canon = n => lc(n);
    const map = new Map();
    const get = name => {
        const key = canon(name);
        if (!map.has(key)) map.set(key, { key, name: String(name).trim(), hypnosis: -1, control: [], influence: [], hidden: false });
        return map.get(key);
    };
    b.hypnosis.forEach((h, i) => { const p = get(h.who); p.hypnosis = i; p.hidden ||= h.user_knows === 'no'; });
    b.control.forEach((c, i) => { for (const who of c.who) { const p = get(who); p.control.push(i); p.hidden ||= c.user_knows === 'no'; } });
    b.influence.forEach((c, i) => { const p = get(c.who); p.influence.push(i); p.hidden ||= c.user_knows === 'no'; });
    const by = n => (n && canon(n) === canon(me) ? 'you' : n);
    const out = [...map.values()].map(p => {
        const bits = [];
        if (p.hypnosis >= 0) {
            const h = b.hypnosis[p.hypnosis];
            bits.push(h.now && h.now !== 'awake' ? `${h.now} trance` : `hypnotized${h.by ? ` by ${by(h.by)}` : ''}`);
        }
        for (const i of p.control) bits.push(`controlled${b.control[i].by ? ` by ${by(b.control[i].by)}` : ''}`);
        if (p.influence.length) bits.push(p.influence.length === 1 ? 'changing' : `${p.influence.length} changes`);
        const status = bits.join(' · ');
        return { ...p, status: status.charAt(0).toUpperCase() + status.slice(1), group: personNamedIn(scene, [p.name]) ? 'scene' : 'rest' };
    }).sort((x, y) => (x.group === y.group ? x.name.localeCompare(y.name) : x.group === 'scene' ? -1 : 1));
    return { people: out, edits: b.perception.map((_, i) => i) };
}
