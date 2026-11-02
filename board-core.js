// Worldhopper Engine — the Board in Stage mode: the people a story is using, gathered into the places the World notes
// put them, each ridden body with its rider's face and a line from the rider's own body to it. Pure, so the tests can
// load it; index.js gathers the people (people-core.js) and stage.js draws the result.
import { aliasResolver, normalizeLedger } from './ledger-core.js';
import { normalizeWorld, placeKey } from './world-core.js';

const lc = s => String(s ?? '').trim().toLowerCase();
const isNone = s => !s || lc(s) === 'none';
const COPY = /cop(y|ied)|propagat/i;
const SPLIT = /[,;—–]|\s-\s/;
const PREP = '(?:at|in|inside|on|by|near|behind|outside|of)';
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const upFirst = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Corner Café, behind the counter" → { place: 'Corner Café', spot: 'behind the counter' }; one part is all place. */
export function splitWhere(where) {
    const s = String(where || '').replace(/\s+/g, ' ').trim();
    const m = SPLIT.exec(s);
    if (!m) return { place: s, spot: '' };
    return { place: s.slice(0, m.index).trim(), spot: s.slice(m.index + m[0].length).trim() };
}

/**
 * Where someone is within a place, without the place: "behind the counter at Corner Café" in Corner Café is "behind the
 * counter", "Corner Café, by the door" is "by the door", and just "Corner Café" is nothing.
 */
export function spotIn(where, place) {
    const s = String(where || '').replace(/\s+/g, ' ').trim();
    if (!place) return s;
    const name = escRe(String(place).trim().replace(/^(the|a|an)\s+/i, ''));
    const lead = new RegExp(`^(?:${PREP}\\s+)?(?:(?:the|a|an)\\s+)?${name}\\s*(?:[,;—–]|\\s-\\s)?\\s*`, 'i');
    if (lead.test(s)) return s.replace(lead, '').trim();
    const tail = new RegExp(`\\s*(?:[,;—–]|\\s-\\s)?\\s*(?:${PREP}\\s+)?(?:(?:the|a|an)\\s+)?${name}\\s*$`, 'i');
    return s.replace(tail, '').trim();
}

// One place when either name holds the other: "corner café" and "behind the counter at corner café".
const samePlace = (a, b) => !!a && !!b && (a === b || a.includes(b) || b.includes(a));

/**
 * The Board.
 * @param {object} o  ledger and world as stored; people: ledgerPeople().people (only the groups shown are used: yours,
 *   scene and elsewhere); me: the player's name.
 * @returns {{ places: object[], unplaced: object[], lines: object[], hidden: number }}
 *   places: [{ key, name, where, people }] with your bodies' places first (name for showing, where as the notes write
 *   it, for moving someone there); unplaced: people with no place in the notes;
 *   each person: { key, name, kind, status, where, spot, hidden, yours, rider: { name, key, you } | null };
 *   lines: [{ from, to, you, hidden }] from a rider's own body to the body they're in, both on the Board;
 *   hidden: how many rides on the Board are kept from the player.
 */
export function boardOf({ ledger, world, people = [], me = '' } = {}) {
    const l = normalizeLedger(ledger);
    const w = normalizeWorld(world);
    const canon = aliasResolver(l);
    const mine = canon(me);
    const shown = people.filter(p => p.group !== 'rest');
    const onBoard = new Set(shown.map(p => p.key));

    const cast = shown.map(p => {
        const row = p.rows?.length ? l.bodies[p.rows[0]] : null;
        const ridden = row && !isNone(row.body) && row.driver && canon(row.driver) !== p.key && !COPY.test(row.how);
        const where = p.place >= 0 ? w.people[p.place]?.where || '' : '';
        return {
            key: p.key, name: p.name, kind: p.kind, status: p.status, where, spot: '', hidden: !!p.hidden,
            yours: p.group === 'yours', scene: p.group === 'scene',
            rider: ridden ? { name: row.driver, key: canon(row.driver), you: canon(row.driver) === mine, hidden: row.user_knows === 'no' } : null,
        };
    });

    // Places: an explicit "Place, spot" names its place; otherwise the whole whereabouts is one, until a shorter name
    // inside it turns up ("Corner Café" absorbs "behind the counter at Corner Café").
    const places = [];
    for (const p of cast.filter(x => x.where)) {
        const { place, spot } = splitWhere(p.where);
        const key = placeKey(p.where);
        let g = places.find(x => samePlace(x.key, key));
        if (!g) { g = { key, name: place, named: !!spot, people: [] }; places.push(g); }
        else if ((spot && !g.named) || (!!spot === g.named && key.length < g.key.length)) { g.key = key; g.name = place; g.named = !!spot; }
        g.people.push(p);
    }
    for (const g of places) {
        g.where = g.name;
        g.name = upFirst(g.name);
        for (const p of g.people) p.spot = spotIn(p.where, g.name);
    }
    // Where you are first (a body you're inside), then your other bodies' places, then the scene's, then the rest.
    const rank = g => (g.people.some(p => p.kind === 'you') ? 0 : g.people.some(p => p.yours) ? 1 : g.people.some(p => p.scene) ? 2 : 3);
    places.sort((a, b) => rank(a) - rank(b));

    const lines = cast.filter(p => p.rider && onBoard.has(p.rider.key) && p.rider.key !== p.key)
        .map(p => ({ from: p.rider.key, to: p.key, you: p.rider.you, hidden: p.rider.hidden }));
    return {
        places: places.map(({ key, name, where, people: ps }) => ({ key, name, where, people: ps })),
        unplaced: cast.filter(p => !p.where),
        lines,
        hidden: cast.filter(p => p.rider?.hidden).length,
    };
}

/** How long ago, said the way a story says it: "20 minutes later", "an hour later", "the next day". */
export function laterText(minutes) {
    const m = Math.round(Number(minutes) || 0);
    if (m < 30) return '';
    if (m < 60) return `${Math.round(m / 5) * 5} minutes later`;
    if (m < 90) return 'an hour later';
    if (m < 20 * 60) return `${Math.round(m / 60)} hours later`;
    const days = Math.max(1, Math.round(m / (24 * 60)));
    return days === 1 ? 'the next day' : `${days} days later`;
}

/**
 * Where a scene breaks between two replies, for Stage mode's dividers: the place changes, the day changes, or half an
 * hour or more of story time goes by. prev and next: { place, day, time, elapsed } as the World notes left them after
 * each reply (prev null before the first). Returns null, or { when: "Tuesday, 3:40 PM" (as known), later, moved }.
 */
export function sceneBreak(prev, next) {
    if (!next || (!next.place && !next.day && !next.time)) return null;
    const when = [next.day, next.time].filter(Boolean).join(', ');
    if (!prev || (!prev.place && !prev.day && !prev.time)) return { when, later: '', moved: false, opening: true };
    const moved = !!prev.place && !!next.place && !samePlace(placeKey(prev.place), placeKey(next.place));
    const dayChanged = !!prev.day && !!next.day && lc(prev.day) !== lc(next.day);
    const gap = (Number(next.elapsed) || 0) - (Number(prev.elapsed) || 0);
    const later = laterText(gap);
    if (!moved && !dayChanged && !later) return null;
    return { when, later, moved, opening: false };
}

/**
 * The rides a reply began and ended, from the Ledger before it (as the last reply left it, with your moves since) and
 * after it: [{ rider, body, how, hidden }] each. Copies are their own people and don't count.
 */
export function ridesChanged(before, after) {
    const key = b => `${lc(b.driver)}→${lc(b.body)}`;
    const rides = l => {
        const n = normalizeLedger(l);
        const canon = aliasResolver(n);
        return n.bodies.filter(b => b.driver && !isNone(b.body) && canon(b.driver) !== canon(b.body) && !COPY.test(b.how))
            .map(b => ({ rider: b.driver, body: b.body, how: b.how || '', hidden: b.user_knows === 'no' }));
    };
    const was = rides(before), now = rides(after);
    const had = new Set(was.map(key)), has = new Set(now.map(key));
    return { began: now.filter(r => !had.has(key(r))), ended: was.filter(r => !has.has(key(r))) };
}
