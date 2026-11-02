// Worldhopper Engine — World notes: the things that matter, who knows what, where people are and what they have on, and
// the story's clock. Pure functions (no SillyTavern imports).
// The Body Ledger says who is in which body; the World notes keep what the story would otherwise lose: the clothes left
// in the alley, the phone someone else is holding, the roommate who saw the jump, the friend who suspects, the bikini
// she's still in three scenes later, the two bodies in different rooms, and the rental that ends at six. They're updated
// by their own call, alongside the Ledger's, so the Ledger's prompt stays as it is and nothing waits longer.

import { aliasResolver, normalizeLedger } from './ledger-core.js';

/** Who is in which body, as plain lines for the World update to read alongside the messages. */
export function bodyLines(ledger) {
    return normalizeLedger(ledger).bodies.filter(b => b.body && b.body.toLowerCase() !== 'none')
        .map(b => (b.driver ? `- ${b.driver} is inside ${b.body}'s body${b.user_knows === 'no' ? ' (kept from the player)' : ''}` : `- ${b.body}'s body is empty`)).join('\n');
}

// clock.elapsed: story minutes since the clock was first set, kept by the code as the clock moves (what change over time
// fades by).
export const EMPTY_WORLD = Object.freeze({ things: [], knows: [], people: [], clock: { day: '', time: '', elapsed: 0 }, timers: [] });

const str = (v, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lc = s => str(s).toLowerCase();
const NOBODY = /^(none|nobody|no one|n\/a|null|-|unknown)$/i;
const person = v => (NOBODY.test(str(v)) ? '' : str(v, 60));

export function normalizeWorld(raw) {
    const things = (Array.isArray(raw?.things) ? raw.things : []).map(t => ({
        what: str(t?.what, 80), whose: person(t?.whose), holder: person(t?.holder), where: str(t?.where, 100),
    })).filter(t => t.what).slice(0, 24);
    const knows = (Array.isArray(raw?.knows) ? raw.knows : []).map(k => ({
        who: person(k?.who),
        facts: (Array.isArray(k?.facts) ? k.facts : k?.fact ? [k] : []).map(f => ({ fact: str(f?.fact ?? f, 160), how: str(f?.how, 24) })).filter(f => f.fact).slice(0, 6),
    })).filter(k => k.who && k.facts.length).slice(0, 24);
    const people = (Array.isArray(raw?.people) ? raw.people : []).map(p => ({
        who: person(p?.who), where: str(p?.where, 100), wearing: str(p?.wearing, 140), state: str(p?.state, 120),
    })).filter(p => p.who && (p.where || p.wearing || p.state)).slice(0, 24);
    const clock = { day: str(raw?.clock?.day, 40), time: str(raw?.clock?.time, 40), elapsed: Math.max(0, parseInt(raw?.clock?.elapsed, 10) || 0) };
    const timers = (Array.isArray(raw?.timers) ? raw.timers : []).map(t => ({ what: str(t?.what, 100), when: str(t?.when, 60) })).filter(t => t.what && t.when).slice(0, 12);
    return { things, knows, people, clock, timers };
}

export const isEmptyWorld = w => !w || (!w.things?.length && !w.knows?.length && !w.people?.length && !w.timers?.length && !w.clock?.day && !w.clock?.time);

export const WORLD_SYSTEM = `You keep the World notes for an adult roleplay in which minds take over bodies. They are five parts and nothing else.

things: objects that matter to the story and could come up again. Clothes and belongings someone left behind when they changed bodies, a phone or bag someone else is holding or has taken, keys or money handed over, an object that carries a power. Not food, drinks, furniture, or anything only used for a moment. For each: what (a few words, with the owner's name: "Gwen's phone"), whose (the owner), holder (who has it now, or "" if nobody is holding it), where (where it is now, in a few words).
knows: what people know, saw, or suspect about the powers and about who is in which body, and lies told to them from a borrowed body. For each person, their facts, each in one short sentence with how they came by it: "saw it", "was told", "figured it out", "suspects", or "was lied to". Only that: never ordinary news, gossip or plans, never what someone does NOT know, and never a host's lost time or confusion after a ride (the Body History keeps that). Someone with nothing to know about the powers has no entry. {{user}} is never listed here: the Body Ledger already keeps what {{user}} knows.
people: each body the story has put somewhere, by the body's own name (a body someone has taken over is still listed as itself, never as who is driving it), {{user}}'s own body included. For each: where (the place first, then the spot in it after a comma, as specific as the story makes it: "Room 1418, on the bed", "Corner Café, behind the counter"; a place keeps the same name each time), wearing (what that body has on now, in a few words, including nothing: "her cheer uniform, sneakers scuffed", "only {{user}}'s cargo shorts"), state (anything physical the story made that lasts beyond the moment: soaked, a sprained ankle, exhausted, drunk, tied to a chair; blank when there's nothing).
clock: the day and time in the story as the newest messages leave it. day as the story counts days ("Saturday", "Day Four", "October 3"), time as a clock time or a part of the day ("11:05 AM", "late evening"). Blank until the story gives them. When the clock moves, passed says how much story time went by since it was last set ("20 minutes", "the rest of the night, about 8 hours", "two weeks").
timers: deadlines the story set that are still to come: a rental or spell that runs out, an appointment, a flight, a party at nine. For each: what (a few words) and when (as the story puts it, made into a time and day when the clock allows: "6:00 PM, Day Four", "Sunday afternoon").

Evidence. Change only what the new messages plainly show: an object handed over, put down, picked up, left behind or taken along; someone watching a possession happen, being told, working it out, or noticing something off; someone going somewhere, dressing, undressing or changing clothes; time passing ("an hour later", "the next morning", a clock read out). Someone who was merely nearby knows nothing. A thing nobody mentions for a while stays where it was, and so does a person and what they have on. Never move the clock forward on a guess. When in doubt, leave the notes as they are.
A possessed body is still its owner's body: when a possessor in Gwen's body hands Gwen's phone to Mara, Mara is the holder and Gwen is the owner, and when it walks to the bar, Gwen is the one at the bar. Use each person's name as the story does; the player's character is {{user}}.

Answer with ONLY what changed, as JSON and nothing else, leaving out any part with nothing in it:
{"things":{"set":[{"what":"","whose":"","holder":"","where":""}],"remove":["what"]},"knows":{"set":[{"who":"","facts":[{"fact":"","how":""}]}],"remove":["who"]},"people":{"set":[{"who":"","where":"","wearing":"","state":""}],"remove":["who"]},"clock":{"day":"","time":"","passed":""},"timers":{"set":[{"what":"","when":""}],"remove":["what"]}}
- things.set: each thing that is new or has moved, with all its fields. things.remove: a thing that no longer matters (used up, or back where it belongs for good).
- knows.set: each person whose knowledge changed, with their whole list of facts, the old ones included.
- people.set: each body whose place, clothes or state changed, with all three fields as they are now. people.remove: a body that has left the story for good.
- clock: only when time moved or the story first says when it is, with day and time, and passed when it moved.
- timers.set: a new deadline, or one that moved. timers.remove: one that came due, was called off, or no longer matters.
If nothing changed, answer {}`;

const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + ' …' : s; };

/**
 * @param {object} p
 * @param {object} p.world       current notes (or empty)
 * @param {{name:string, text:string}[]} p.messages  the messages since the last update, oldest first
 * @param {{name:string, text:string}[]} [p.context] the exchange before them, already reflected in the notes
 * @param {string} p.userName
 * @param {string} [p.bodies]    who is in which body right now, as plain lines (from the Body Ledger)
 */
export function buildWorldMessages({ world, messages, context = [], userName, bodies = '' }) {
    const parts = [];
    if (bodies) parts.push(`Who is in which body (from the Body Ledger):\n${bodies}`);
    parts.push(`Current World notes:\n${JSON.stringify(normalizeWorld(world || EMPTY_WORLD))}`);
    if (context.length) parts.push('Earlier messages, for context only (the notes already reflect them):\n' + context.map(m => `### ${m.name}\n${clip(m.text, 1500)}`).join('\n\n'));
    parts.push((context.length ? 'New messages to apply' : 'Newest messages') + ', oldest first:\n' + messages.map(m => `### ${m.name}\n${clip(m.text, 2500)}`).join('\n\n'));
    parts.push('Now output only what changed, as JSON, or {} if nothing did.');
    return [{ role: 'system', content: WORLD_SYSTEM.replaceAll('{{user}}', userName || 'the player') }, { role: 'user', content: parts.join('\n\n') }];
}

/**
 * The first balanced JSON object in a reply (models sometimes keep talking after it). One that never closes is an answer
 * cut off partway: null, so it's asked again with room (taking a complete piece from inside it saved empty notes).
 */
function firstJson(text) {
    const s = String(text || '');
    for (let a = s.indexOf('{'); a >= 0; a = s.indexOf('{', a + 1)) {
        let depth = 0, inStr = false, closed = false;
        for (let i = a; i < s.length; i++) {
            const c = s[i];
            if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
            if (c === '"') inStr = true;
            else if (c === '{') depth++;
            else if (c === '}' && --depth === 0) { closed = true; try { return JSON.parse(s.slice(a, i + 1)); } catch { break; } }
        }
        if (!closed) return null;
    }
    return null;
}

const listOf = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
// Two names for one thing: the same words, or one wording inside the other ("Kayla's clothes" / "Kayla's clothes and sneakers").
const sameThing = (a, b) => { const x = lc(a), y = lc(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

/** Apply a changes-only answer. Things match by name, people through the Ledger's aliases when it's given. */
export function applyWorldDiff(world, diff, ledger = null) {
    const base = normalizeWorld(world);
    if (!diff || typeof diff !== 'object') return base;
    const canon = aliasResolver(ledger);
    const t = diff.things, k = diff.knows;
    const tSet = Array.isArray(t) ? t : listOf(t?.set ?? t?.add);
    const tGone = listOf(Array.isArray(t) ? [] : t?.remove).map(x => (typeof x === 'string' ? x : x?.what)).filter(Boolean);
    let things = base.things.filter(x => !tGone.some(g => sameThing(g, x.what)));
    for (const x of tSet) {
        if (!x?.what) continue;
        const i = things.findIndex(y => lc(y.what) === lc(x.what));
        const j = i >= 0 ? i : things.findIndex(y => sameThing(y.what, x.what));
        const given = Object.fromEntries(['what', 'whose', 'holder', 'where'].filter(f => x[f] != null).map(f => [f, x[f]]));
        if (j < 0) things.push(given); else things[j] = { ...things[j], ...given };
    }
    const kSet = Array.isArray(k) ? k : listOf(k?.set ?? k?.add);
    const kGone = new Set(listOf(Array.isArray(k) ? [] : k?.remove).map(x => canon(typeof x === 'string' ? x : x?.who)));
    let knows = base.knows.filter(x => !kGone.has(canon(x.who)));
    for (const x of kSet) {
        if (!x?.who) continue;
        const i = knows.findIndex(y => canon(y.who) === canon(x.who));
        const entry = { who: x.who, facts: listOf(x.facts ?? (x.fact ? [x] : [])) };
        if (i < 0) knows.push(entry); else knows[i] = entry;
    }
    // People by name (through the Ledger's aliases); a field left out of an answer keeps what it was.
    const p = diff.people;
    const pSet = Array.isArray(p) ? p : listOf(p?.set ?? p?.add);
    const pGone = new Set(listOf(Array.isArray(p) ? [] : p?.remove).map(x => canon(typeof x === 'string' ? x : x?.who)));
    const people = base.people.filter(x => !pGone.has(canon(x.who)));
    for (const x of pSet) {
        if (!x?.who) continue;
        const i = people.findIndex(y => canon(y.who) === canon(x.who));
        const given = Object.fromEntries(['who', 'where', 'wearing', 'state'].filter(f => x[f] != null).map(f => [f, x[f]]));
        if (i < 0) people.push(given); else people[i] = { ...people[i], ...given, who: people[i].who };
    }
    // The clock only moves when an answer gives it; a half-given one keeps the other half, and the story time that went
    // by is added up.
    const c = diff.clock;
    let clock = base.clock;
    if (c && typeof c === 'object' && (str(c.day) || str(c.time))) {
        const next = { day: str(c.day) || base.clock.day, time: str(c.time) || base.clock.time };
        clock = { ...next, elapsed: base.clock.elapsed + clockAdvance(base.clock, next, c.passed) };
    }
    const tm = diff.timers;
    const tmSet = Array.isArray(tm) ? tm : listOf(tm?.set ?? tm?.add);
    const tmGone = listOf(Array.isArray(tm) ? [] : tm?.remove).map(x => (typeof x === 'string' ? x : x?.what)).filter(Boolean);
    const timers = base.timers.filter(x => !tmGone.some(g => sameThing(g, x.what)));
    for (const x of tmSet) {
        if (!x?.what) continue;
        const i = timers.findIndex(y => sameThing(y.what, x.what));
        if (i < 0) timers.push({ what: x.what, when: x.when }); else timers[i] = { what: timers[i].what, when: x.when ?? timers[i].when };
    }
    // A timer an hour or more past on the clock is done with, whether or not the answer said so.
    const live = timers.filter(t => { const m = minutesUntil(clock, t.when); return m == null || m > -60; });
    return normalizeWorld({ things, knows, people, clock, timers: live });
}

/** An update answer applied to the current notes; null when it can't be read. */
export function parseWorldUpdate(text, current, ledger = null) {
    const j = firstJson(text);
    if (!j) return /^\s*(\{\s*\}|none|no changes?\.?)\s*$/i.test(String(text || '')) ? normalizeWorld(current) : null;
    // Something with none of the notes' parts isn't an update (a piece of one): unreadable.
    if (Object.keys(j).length && !['things', 'knows', 'people', 'clock', 'timers'].some(k => k in j)) return null;
    return applyWorldDiff(current, j, ledger);
}

/** One World update, as the extension runs it after a reply. `ask(messages, maxTokens)` returns the model's text. */
export async function worldStep({ world = null, messages, context = [], userName, bodies = '', ledger = null }, ask) {
    const msgs = buildWorldMessages({ world, messages, context, userName, bodies });
    // Room for a first update that sets everything at once, after the thinking a reasoning profile does (736 tokens of it
    // used up 900 on a first reply, 2026-10-28).
    let answer = await ask(msgs, 1500);
    let next = parseWorldUpdate(answer, world || EMPTY_WORLD, ledger);
    // Cut off partway (a model that thinks first can run out of room): once more with plenty.
    if (!next) { answer = await ask(msgs, 4000); next = parseWorldUpdate(answer, world || EMPTY_WORLD, ledger); }
    return next ? { world: next, answer } : null;
}

// ------------------------------------------------------------------ the clock

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DAY_WORD = new RegExp(`\\b(?:day\\s+\\w+|${WEEKDAYS.join('|')}|tomorrow|yesterday|next\\s+\\w+|(?:${MONTHS.join('|')})\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`, 'i');

/** Minutes past midnight for "11:05 AM", "6 PM", "18:30", "noon", "midnight"; null for "late evening" and the like. */
export function clockMinutes(text) {
    const s = lc(text);
    if (/\bnoon\b/.test(s)) return 720;
    if (/\bmidnight\b/.test(s)) return 0;
    const m = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d:])/.exec(s);
    if (!m || (!m[2] && !m[3])) return null;
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    if (h > 23 || min > 59) return null;
    if (m[3]) { if (h > 12 || h === 0) return null; h = (h % 12) + (/p/.test(m[3]) ? 12 : 0); }
    return h * 60 + min;
}

const NUMBER = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, 'a couple of': 2, couple: 2, 'a few': 3, few: 3, several: 4 };
const UNIT = { minute: 1, min: 1, hour: 60, hr: 60, day: 1440, night: 1440, week: 10080, month: 43200, year: 525600 };

/** Story minutes in "20 minutes", "two weeks", "half an hour", "about 8 hours"; null when it gives no amount. */
export function parsePassed(text) {
    let s = lc(text);
    if (!s) return null;
    let total = 0, hit = false;
    if (/\bhalf an? hour\b/.test(s)) { total += 30; hit = true; s = s.replace(/\bhalf an? hour\b/g, ''); }
    for (const m of s.matchAll(/\b(\d+(?:\.\d+)?|a couple of|a few|forty-five|couple|few|several|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty)\s+(minute|min|hour|hr|day|night|week|month|year)s?\b/g)) {
        const n = Number.isFinite(Number(m[1])) ? Number(m[1]) : NUMBER[m[1]];
        if (n) { total += n * UNIT[m[2]]; hit = true; }
    }
    return hit ? Math.round(total) : null;
}

/**
 * How many story minutes passed between two clock readings: what the answer said (passed), else the difference between
 * two clock times (into the next day when the day changed), else a day for a new day and nothing otherwise.
 */
export function clockAdvance(prev, next, passed = '') {
    const said = parsePassed(passed);
    if (said != null) return said;
    if (!prev?.day && !prev?.time) return 0;
    const a = clockMinutes(prev.time), b = clockMinutes(next.time);
    const sameDay = !next.day || lc(prev.day) === lc(next.day);
    if (a != null && b != null) return sameDay ? Math.max(0, b - a) : ((b - a + 1440) % 1440) || 1440;
    return sameDay ? 0 : 1440;
}

/**
 * Minutes until a timer comes due (negative once it's past), when the clock and the timer both give a clock time on the
 * same day; null when that can't be worked out (a part of the day, or a timer that names another day or tomorrow).
 */
export function minutesUntil(clock, when) {
    const now = clockMinutes(clock?.time), due = clockMinutes(when);
    if (now == null || due == null) return null;
    const day = DAY_WORD.exec(String(when || ''))?.[0];
    if (day && !(clock?.day && lc(clock.day).includes(lc(day)))) return null;
    return due - now;
}

/** How long until a timer comes due, as "about 7 hours from now", or "due now"; '' when it can't be worked out. */
export function timeLeft(clock, when) {
    const left = minutesUntil(clock, when);
    if (left == null || left < -59) return '';
    if (left <= 0) return 'due now';
    if (left < 60) return `${left} minute${left === 1 ? '' : 's'} from now`;
    const h = Math.round(left / 30) / 2;
    return `about ${h === 1 ? 'an hour' : `${h} hours`} from now`;
}

/**
 * The place part of a whereabouts, for telling places apart: "Room 1418, on the bed" and "Room 1418 at the desk" are one
 * place, "the lobby" another. Lowercased, without a leading "the" or what follows the first comma, semicolon or dash.
 */
export const placeKey = where => lc(String(where || '').split(/[,;—–]|\s-\s/)[0]).replace(/^(the|a|an)\s+/, '').trim();
const samePlace = (a, b) => !!a && !!b && (a === b || a.includes(b) || b.includes(a));

/**
 * Where the bodies the player is running are, grouped by place: [{ place, bodies }], or [] when they're all in one place
 * or some of them have no place in the notes (then nothing is said about splitting).
 */
export function placesOf(world, running) {
    const w = normalizeWorld(world);
    const at = running.map(n => ({ n, p: w.people.find(x => lc(x.who) === lc(n)) }));
    if (at.length < 2 || at.some(x => !x.p?.where)) return [];
    const groups = [];
    for (const { n, p } of at) {
        const k = placeKey(p.where);
        const g = groups.find(x => samePlace(x.key, k));
        if (g) g.bodies.push(n); else groups.push({ key: k, place: p.where.split(/[,;—–]|\s-\s/)[0].trim(), bodies: [n] });
    }
    return groups.length > 1 ? groups.map(({ place, bodies }) => ({ place, bodies })) : [];
}

/**
 * The notes for the writer. With `scene` (the latest messages), people's knowledge and whereabouts are given only for
 * those named in it, plus `always` (the player's own bodies, so bodies in different places stay apart), and things only
 * when someone they belong to or someone holding them is (or the list is short anyway). The clock and timers always go.
 * `running`: the bodies the player is running at once (the Ledger's roster); when the notes put them in different
 * places, the reply is asked for as one scene per place, each opened with a %%place: …%% line the chat shows as a heading.
 */
export function renderWorld(world, userName = '{{user}}', { scene = null, always = [], running = [] } = {}) {
    const w = normalizeWorld(world);
    if (isEmptyWorld(w)) return '';
    always = [...always, ...running];
    const named = n => !scene || !n || new RegExp(`(?<![\\p{L}])${n.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(scene);
    const things = w.things.length <= 8 ? w.things : w.things.filter(t => named(t.whose) || named(t.holder));
    const knows = w.knows.filter(k => named(k.who));
    const yours = new Set(always.map(lc));
    const people = w.people.filter(p => yours.has(lc(p.who)) || named(p.who));
    const lines = [];
    const now = [w.clock.day, w.clock.time].filter(Boolean).join(', ');
    if (now) lines.push(`Now: ${now}. Time moves only when the story moves it.`);
    if (w.timers.length) {
        lines.push('Coming up:');
        for (const t of w.timers) { const left = timeLeft(w.clock, t.when); lines.push(`- ${t.what}: ${t.when}${left ? ` (${left})` : ''}.`); }
    }
    if (people.length) {
        lines.push('Where people are, and what they have on, until the story changes it:');
        for (const p of people) lines.push(`- ${p.who}${yours.has(lc(p.who)) && lc(p.who) !== lc(userName) ? ` (one of ${userName}'s bodies)` : ''}: ${[p.where, p.wearing ? `wearing ${p.wearing}` : '', p.state].filter(Boolean).join('; ')}.`);
    }
    if (things.length) {
        lines.push('Things, and where they are now:');
        // "has them" for clothes, keys and sunglasses; "has it" for a phone or a bag
        const many = t => /[^s]s$/i.test(t.what.trim());
        for (const t of things) lines.push(`- ${t.what}${t.whose && !lc(t.what).includes(lc(t.whose)) ? ` (${t.whose}'s)` : ''}: ${t.holder ? `${t.holder} has ${many(t) ? 'them' : 'it'}${t.where ? `, ${t.where}` : ''}` : t.where || `where ${many(t) ? 'they were' : 'it was'} left`}.`);
    }
    if (knows.length) {
        lines.push('What people know. They act on this and nothing more, and narration never has anyone know more than this:');
        for (const k of knows) lines.push(`- ${k.who}: ${k.facts.map(f => `${f.fact.replace(/[.\s]+$/, '')}${f.how ? ` (${f.how})` : ''}`).join('; ')}.`);
    }
    const apart = placesOf(w, running);
    if (apart.length) {
        lines.push(`${userName}'s bodies are in different places: ${apart.map(g => `${g.place} (${g.bodies.join(', ')})`).join('; ')}. Write this reply as one scene per place where something happens this turn, each starting with a line of its own reading %%place: <the place>%%. Nothing said or done in one place is seen or heard in another.`);
    }
    return lines.length ? `<world_notes>\n${lines.join('\n')}\n</world_notes>` : '';
}
