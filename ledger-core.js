// Worldhopper Engine — Body Ledger core. Pure functions (no SillyTavern imports).
// The ledger records every body not driven by its own mind, every empty body, every mind outside its own body,
// and who holds which power. A local model updates it after each reply; it is injected at depth 1 so the
// writing model always knows which name and pronouns belong to which body and which mind.

import { deleteSpan, leavesBroken } from './editor-core.js';

export const EMPTY_LEDGER = Object.freeze({ bodies: [], powers: [], aliases: [] });

const str = (v, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lc = s => str(s).toLowerCase();

/**
 * For descriptive fields (powers, notes, host, how). Never cuts mid-word: past the limit it ends at the last clause
 * (";", ",", " — ") in the back half of the text, else at the last space. Text an older version already chopped at
 * exactly its old limit (`legacy`) is trimmed back the same way, so "…her face; original bo" reads "…her face".
 */
function fit(v, max, legacy = 0) {
    let s = str(v, 2000);
    const cut = s.length > max || (legacy && s.length === legacy);
    if (!cut) return s;
    s = s.slice(0, s.length > max ? max : legacy);
    const clause = Math.max(s.lastIndexOf('; '), s.lastIndexOf(', '), s.lastIndexOf(' — '), s.lastIndexOf(' ('));
    const end = clause >= s.length * 0.5 ? clause : s.lastIndexOf(' ');
    return (end > 0 ? s.slice(0, end) : s).replace(/[\s,;:(—-]+$/, '');
}

/**
 * Groups every name that refers to the same person, from the aliases of any number of ledgers (entries that share
 * a name are joined). Returns canon(name) → one lowercase key per person; unknown names map to themselves.
 */
export function aliasResolver(...ledgers) {
    const parent = new Map();
    const find = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
    for (const l of ledgers) {
        for (const a of Array.isArray(l?.aliases) ? l.aliases : []) {
            const names = [a?.name, ...(Array.isArray(a?.aka) ? a.aka : [])].map(lc).filter(Boolean);
            for (const n of names) if (!parent.has(n)) parent.set(n, n);
            for (const n of names.slice(1)) { const r = find(n), r0 = find(names[0]); if (r !== r0) parent.set(r, r0); }
        }
    }
    return name => { const k = lc(name); return parent.has(k) ? find(k) : k; };
}

/** One entry per person, with every other name they go by. */
function normalizeAliases(raw) {
    const entries = (Array.isArray(raw) ? raw : []).map(a => ({
        name: str(a?.name, 60),
        aka: (Array.isArray(a?.aka) ? a.aka : String(a?.aka ?? '').split(',')).map(x => str(x, 60)).filter(Boolean),
    })).filter(a => a.name);
    const canon = aliasResolver({ aliases: entries });
    const groups = new Map();
    for (const a of entries) {
        const g = groups.get(canon(a.name)) || { name: a.name, seen: new Set([lc(a.name)]), aka: [] };
        for (const n of [a.name, ...a.aka]) if (!g.seen.has(lc(n))) { g.seen.add(lc(n)); g.aka.push(n); }
        groups.set(canon(a.name), g);
    }
    return [...groups.values()].filter(g => g.aka.length).map(g => ({ name: g.name, aka: g.aka.slice(0, 8) })).slice(0, 24);
}

// These change a mind that still drives its own body; listing them as "driven by" made Claude write mind control
// as puppetry. They are minds entries, never body rows: a body row with one of these is moved to minds here.
const MIND_ONLY = /hypno|mind[- ]?control|brainwash|dron|pet play|doll|blank slate|trance|perception|conditioning|limp/i;
// And the other way round: someone else in a body is a body row, even when the model reasons that the host's mind is
// "on standby" and files it under minds ("Kayla's mind ← Sam, multipossession"). The minds list is for minds that
// were changed while their owner still drives; a minds entry with one of these is moved to the body rows here.
const BODY_ONLY = /possess|skin|worn|hive|absorb|puppet|swap|cop(y|ied)|propagat|vore/i;

/** A minds entry: someone whose mind a power changed, with nobody else in their body. */
const normalizeMind = m => ({
    who: str(m?.who, 60),
    by: /^(none|nobody|no one|n\/a|null|-|self)$/i.test(str(m?.by)) ? '' : str(m?.by, 60),
    how: fit(m?.how, 40),
    changes: fit(m?.changes, 220),
    triggers: fit(m?.triggers, 160),
    state: fit(m?.state, 100),
    user_knows: /^\s*n/i.test(String(m?.user_knows ?? '')) ? 'no' : 'yes',
});

export function normalizeLedger(raw) {
    const rawBodies = Array.isArray(raw?.bodies) ? raw.bodies : [];
    const powers = Array.isArray(raw?.powers) ? raw.powers : [];
    const aliases = normalizeAliases(raw?.aliases);
    const canon = aliasResolver({ aliases });
    const misfiled = m => BODY_ONLY.test(m.how) && !MIND_ONLY.test(m.how);
    const allMinds = (Array.isArray(raw?.minds) ? raw.minds : []).map(normalizeMind).filter(m => m.who);
    const minds = allMinds.filter(m => !misfiled(m));
    for (const b of rawBodies.filter(b => MIND_ONLY.test(str(b?.how)) && str(b?.body))) {
        if (!minds.some(m => canon(m.who) === canon(b.body))) minds.push(normalizeMind({ who: b.body, by: b.driver, how: b.how, state: b.notes, user_knows: b.user_knows }));
    }
    const bodies = rawBodies.filter(b => !MIND_ONLY.test(str(b?.how)));
    // A misfiled one with nobody named as the driver says too little to become a row, so it's dropped.
    for (const m of allMinds.filter(m => misfiled(m) && m.by)) {
        if (!bodies.some(b => canon(str(b?.body)) === canon(m.who))) bodies.push({ body: m.who, driver: m.by, how: m.how, notes: m.state, user_knows: m.user_knows });
    }
    return {
        bodies: bodies.map(b => ({
            body: str(b.body, 60),
            pronouns: str(b.pronouns, 20),
            // "none" is a real value for body (a mind with no body) but never a driver's name.
            driver: /^(none|nobody|no one|n\/a|null|-)$/i.test(str(b.driver)) ? '' : str(b.driver, 60),
            driver_pronouns: str(b.driver_pronouns, 20),
            how: fit(b.how, 60, 40),
            host: fit(b.host, 120, 80),
            notes: fit(b.notes, 220, 140),
            doing: fit(b.doing, 80),
            // Older ledgers have no field: treat as known, which is the less intrusive assumption.
            user_knows: /^\s*n/i.test(String(b.user_knows ?? '')) ? 'no' : 'yes',
        })).filter(b => (b.body || b.driver) && !(b.body && b.driver && canon(b.body) === canon(b.driver))).slice(0, 24),
        // The own body of a mind running others alongside it: off the body list, so its whereabouts live here.
        own: (Array.isArray(raw?.own) ? raw.own : []).map(o => ({ who: str(o?.who, 60), doing: fit(o?.doing, 80), notes: fit(o?.notes, 160) }))
            .filter(o => o.who && (o.doing || o.notes)).slice(0, 8),
        minds: minds.slice(0, 24),
        powers: powers.map(p => ({ who: str(p.who, 60), power: fit(p.power, 240, 100) })).filter(p => p.who && p.power).slice(0, 24),
        aliases,
    };
}

export const isEmptyLedger = l => !l || (!l.bodies?.length && !l.powers?.length && !l.minds?.length);

// Copies (Propagation) are separate people the writer plays, never one mind in several bodies or the player's to
// direct. Puppets are empty bodies moved from outside: the player's to direct, but not "one person in several places".
const COPY = /cop(y|ied)|propagat/i;
const PUPPET = /puppet/i;

/** Every name a person goes by, for display: "Sasha (also Unit 114)". */
export function akaOf(ledger, name) {
    const canon = aliasResolver(ledger);
    const names = (ledger?.aliases || []).filter(a => canon(a.name) === canon(name)).flatMap(a => [a.name, ...a.aka]);
    return [...new Set(names)].filter(n => lc(n) !== lc(name));
}

const LEDGER_CORE = `You maintain the Body Ledger for an adult roleplay in which minds and bodies come apart (possession, skinsuits, hive minds, copies, puppets, swaps) and minds get changed (hypnosis, mind control, rewrites, drones, dolls). The ledger lists:
- bodies: every body that is NOT currently driven by its own mind, every empty or vacated body, every body worn as a skin, and every mind that is outside its own body;
- minds: everyone whose mind a power has changed while they stay in their own body;
- every character shown or stated to hold such a power, and what the power is.
A body driven by its own mind again leaves the body list. People who are simply themselves in their own bodies are never listed.

Bodies versus minds: hypnosis, mind control, brainwashing, perception rewrites, blank slates, drones, pets, dolls and limp bodies change what is in a mind (or empty it), but nobody else is driving the body, so they are never body rows; they go under minds. Possession and the other body mechanics are never minds entries.

Evidence. Add or change a row only when the messages plainly show a mind entering, leaving or switching bodies, or say so outright. Being near someone with powers, or touched, grabbed, spoken to, looked at, wanted or mentioned by them, is NOT being possessed. A character who acts on their own, speaks for themselves or shows their own feelings is in their own body. When in doubt, leave the ledger as it is.

Fields for each body:
- body: the body's own name, as the story uses it (for a mind with no body, use "none")
- pronouns: the BODY's own pronouns, e.g. "she/her"
- driver: the name of the mind currently driving it, or "" if nobody is driving it (an empty body)
- driver_pronouns: the DRIVING MIND's own pronouns, e.g. "he/him"
- how: the mechanism in a word or two: possession, multipossession, skinsuit, hive mind, copy, puppetry, swap. A body overwritten by a copy has the original's name as driver and how "copy"
- host: only what the messages actually show about the body's own mind, e.g. "gone" or "dead". If they don't show it, leave it "". Never guess, and never assume the host is awake or aware.
- notes: a short phrase: what the body is wearing and where it is. Lasting facts only, never a momentary action ("holding a cup", "laughing")
- doing: what the body is busy with right now, an ongoing activity in a few words ("calc homework", "driving to work", "asleep"), or "" if nothing in particular. Keep it current: when the messages show the body moving on to something else, change it
- user_knows: "yes" if {{user}} is the driver, has been told, has seen it happen, or the card or opening establishes that {{user}} knows; "no" if it is being kept from {{user}}. Once "yes", it stays "yes".

Aliases: anyone the story calls by more than one name (a code name or unit number, a handle, a host number, a nickname, a real name behind a persona) is listed once with every name, e.g. {"name":"Sasha","aka":["Unit 114"]}. In body and driver fields, use the name the story uses most.

Own bodies: a mind that runs other bodies while still in its own (multipossession, a hive's original mind, a puppeteer) gets one "own" entry for that own body, {"who": the mind's name, "doing": as above, "notes": what it is wearing and where it is}, kept current the same way whenever that body moves or does something new. Nobody else gets one.

Fields for each mind:
- who: the person whose mind was changed
- by: who did it, or "" if nobody is behind it now
- how: the mechanism in a word or two: hypnosis, mind control, perception rewrite, blank slate, dronification, pet play, dollification, limp
- changes: what has been changed, as lasting facts: new beliefs, loyalties, rules, a new sense of self, what they can no longer perceive. Never a passing command that is already done
- triggers: any cue and what it does ("'bloom' drops her into trance"), or ""
- state: how they are right now, in a few words ("deep trance", "awake, conditioned", "posed on the bed"). Keep it current
- user_knows: as for bodies
A person leaves minds when the change is undone.

Rules:
- Change only what the new messages clearly establish.
- A mind drives one body at a time unless the story shows it running several at once. When a driver moves into a new body, the body they left is no longer theirs: it is empty (driver "") or back with its own mind (remove it), whichever the messages show.
- A scene jump does not end an arrangement by itself. But when the newest messages show a driver living as themselves in their own body (their own home, their own name and features), remove the rows where they were driving.
- Use each character's name as the story does. The player's character is called {{user}}.
- Pronouns come from the story or the card. If a body's sex is plain from the text (breasts, cock, "the girl"), use it.`;

/** First build: the whole ledger. */
export const LEDGER_SYSTEM = `${LEDGER_CORE}
- Copy everything that didn't change exactly as it was.
Answer with the complete ledger as JSON and nothing else, in exactly this shape:
{"bodies":[{"body":"","pronouns":"","driver":"","driver_pronouns":"","how":"","host":"","notes":"","doing":"","user_knows":"yes"}],"own":[{"who":"","doing":"","notes":""}],"minds":[{"who":"","by":"","how":"","changes":"","triggers":"","state":"","user_knows":"yes"}],"powers":[{"who":"","power":""}],"aliases":[{"name":"","aka":[""]}]}`;

// Every later update: only the changes. Rewriting a dozen-body ledger every reply took a 26B local model 7.5 s; most replies
// change nothing or one row, which is well under a second of output.
export const LEDGER_UPDATE_SYSTEM = `${LEDGER_CORE}
Answer with ONLY what changed, as JSON and nothing else, in this shape, leaving out any part with nothing in it:
{"set":[{"body":"","pronouns":"","driver":"","driver_pronouns":"","how":"","host":"","notes":"","doing":"","user_knows":"yes"}],"remove":["body name"],"own":{"set":[{"who":"","doing":"","notes":""}],"remove":["who"]},"minds":{"set":[{"who":"","by":"","how":"","changes":"","triggers":"","state":"","user_knows":"yes"}],"remove":["who"]},"powers":{"set":[{"who":"","power":""}],"remove":["who"]},"aliases":[{"name":"","aka":[""]}]}
- set: each body that is new or whose row changed, with all its fields.
- remove: each body that leaves the ledger (its own mind drives it again), by name; for a mind with no body, the mind's name.
- own: own-body entries that are new or changed (a new place or a new activity counts); remove one when that mind no longer runs other bodies.
- minds: minds entries that are new or changed (a new change, trigger or state counts), with all their fields; remove one when the change is undone.
- aliases: only new names.
If nothing changed, answer {}`;

const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + ' …' : s; };

/**
 * @param {object} p
 * @param {object} p.ledger      current ledger (or empty)
 * @param {{name:string, text:string}[]} p.messages  newest messages, oldest first
 * @param {string} p.userName
 * @param {string[]} [p.modes]
 * @param {string} [p.card]      character card text, for a first build
 * @param {string} [p.persona]
 * @param {boolean} [p.update]   answer with only the changes (every update after the first build)
 * @param {{name:string, text:string}[]} [p.context]  the exchange before the new messages, already reflected in the
 *                               ledger: it tells the model who "you" is and who was where, so a mention isn't misread
 */
export function buildLedgerMessages({ ledger, messages, userName, modes = [], card = '', persona = '', update = false, context = [] }) {
    const sys = (update ? LEDGER_UPDATE_SYSTEM : LEDGER_SYSTEM).replaceAll('{{user}}', userName || 'the player');
    const parts = [];
    if (card) parts.push(`Character card (background only; the chat decides the current state):\n${clip(card, 3000)}`);
    if (persona) parts.push(`${userName}'s persona:\n${clip(persona, 800)}`);
    if (modes.length) parts.push(`Mechanics this story can use (possible, not necessarily happening): ${modes.join(', ')}.`);
    const keepsOwn = modes.filter(m => KEEPS_OWN_BODY.includes(m));
    if (keepsOwn.length) parts.push(`With ${list(keepsOwn)}, one mind runs several bodies at once, and taking a new body adds it: the mind keeps every body it already had, its own included, unless the messages show it leaving one. Its own body stays off the body list while it still drives it (it gets an "own" entry instead); never list it as empty just because the mind took someone else. Such a ride's how is ${keepsOwn.map(m => `"${lc(m)}"`).join(' or ')}, whichever the story shows.`);
    parts.push(`Current ledger:\n${JSON.stringify(normalizeLedger(ledger || EMPTY_LEDGER))}`);
    if (context.length) parts.push('Earlier messages, for context only (the ledger already reflects them):\n' + context.map(m => `### ${m.name}\n${clip(m.text, 1500)}`).join('\n\n'));
    parts.push((context.length ? 'New messages to apply' : 'Newest messages') + ', oldest first:\n' + messages.map(m => `### ${m.name}\n${clip(m.text, 2500)}`).join('\n\n'));
    parts.push(update ? 'Now output only what changed, as JSON, or {} if nothing did.' : 'Now output the complete updated ledger as JSON.');
    return [{ role: 'system', content: sys }, { role: 'user', content: parts.join('\n\n') }];
}

/**
 * The first complete JSON object in a response. Local models sometimes keep talking after the answer ("Wait, I need to
 * follow the rules…"), so read up to where the first object closes rather than to the last brace in the text.
 */
function firstJson(text, open = '{') {
    const s = String(text || '');
    const close = open === '[' ? ']' : '}';
    for (let a = s.indexOf(open); a >= 0; a = s.indexOf(open, a + 1)) {
        let depth = 0, inStr = false;
        for (let i = a; i < s.length; i++) {
            const c = s[i];
            if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
            if (c === '"') inStr = true;
            else if (c === open) depth++;
            else if (c === close && --depth === 0) {
                try { return JSON.parse(s.slice(a, i + 1)); } catch { break; }
            }
        }
    }
    return null;
}

/** A whole ledger from a model response. Returns null if it can't be parsed. */
export function parseLedger(text) {
    const j = firstJson(text);
    if (!j || (!Array.isArray(j.bodies) && !Array.isArray(j.powers))) return null;
    return normalizeLedger(j);
}

const FIELDS = ['body', 'pronouns', 'driver', 'driver_pronouns', 'how', 'host', 'notes', 'doing', 'user_knows'];
const listOf = v => (Array.isArray(v) ? v : v == null ? [] : [v]);

/**
 * Apply a changes-only answer to a ledger. Rows are matched by body name (or by mind, for a mind with no body),
 * through aliases. A set row replaces only the fields it gives, and once the player knows, they keep knowing.
 */
export function applyLedgerDiff(ledger, diff) {
    const base = normalizeLedger(ledger);
    if (!diff || typeof diff !== 'object') return base;
    const aliases = normalizeAliases([...base.aliases, ...listOf(diff.aliases)]);
    const canon = aliasResolver({ aliases });
    const noBody = b => !b.body || lc(b.body) === 'none';
    const rowKey = b => (noBody(b) ? 'm:' + canon(b.driver) : 'b:' + canon(b.body));
    const nameOf = n => (typeof n === 'string' ? n : n?.body || n?.name || n?.driver || n?.who || '');

    const gone = new Set(listOf(diff.remove ?? diff.removed ?? diff.delete).map(n => canon(nameOf(n))).filter(Boolean));
    let bodies = base.bodies.filter(b => !gone.has(canon(noBody(b) ? b.driver : b.body)));
    // A whole ledger sent during an update is read as changes: rows it gives are set, rows it leaves out stay.
    // A model sometimes answers with a partial "whole" ledger, and replacing with it wiped real rows.
    for (const r of listOf(diff.set ?? diff.add ?? diff.update ?? diff.changed ?? diff.bodies)) {
        if (!r || typeof r !== 'object' || (!r.body && !r.driver)) continue;
        const i = bodies.findIndex(b => rowKey(b) === rowKey(r));
        if (i < 0) {
            // A new row with nobody driving and nothing said about the host carries no information: noise.
            if (!noBody(r) && !str(r.driver) && !str(r.host)) continue;
            bodies.push(r);
            continue;
        }
        const merged = { ...bodies[i] };
        for (const f of FIELDS) {
            if (r[f] === undefined || r[f] === null) continue;
            if (f === 'user_knows' && bodies[i].user_knows === 'yes') continue;
            merged[f] = r[f];
        }
        bodies[i] = merged;
    }

    const p = diff.powers;
    const pSet = Array.isArray(p) ? p : listOf(p?.set ?? p?.add);
    const pGone = new Set(listOf(Array.isArray(p) ? [] : p?.remove).map(n => canon(nameOf(n))));
    let powers = base.powers.filter(x => !pGone.has(canon(x.who)));
    for (const x of pSet) {
        if (!x?.who || !x?.power) continue;
        const i = powers.findIndex(y => canon(y.who) === canon(x.who));
        if (i < 0) powers.push(x); else powers[i] = { ...powers[i], power: x.power };
    }

    const o = diff.own;
    const oSet = Array.isArray(o) ? o : listOf(o?.set ?? o?.add);
    const oGone = new Set(listOf(Array.isArray(o) ? [] : o?.remove).map(n => canon(nameOf(n))));
    const own = base.own.filter(x => !oGone.has(canon(x.who)));
    for (const x of oSet) {
        if (!x?.who) continue;
        const i = own.findIndex(y => canon(y.who) === canon(x.who));
        const given = Object.fromEntries(['doing', 'notes'].filter(k => x[k] != null).map(k => [k, x[k]]));
        if (i < 0) own.push({ who: x.who, ...given }); else own[i] = { ...own[i], ...given };
    }

    const d = diff.minds;
    const dSet = Array.isArray(d) ? d : listOf(d?.set ?? d?.add);
    const dGone = new Set(listOf(Array.isArray(d) ? [] : d?.remove).map(n => canon(nameOf(n))));
    const minds = base.minds.filter(x => !dGone.has(canon(x.who)));
    for (const x of dSet) {
        if (!x?.who) continue;
        const i = minds.findIndex(y => canon(y.who) === canon(x.who));
        if (i < 0) { minds.push(x); continue; }
        const merged = { ...minds[i] };
        for (const f of ['by', 'how', 'changes', 'triggers', 'state', 'user_knows']) {
            if (x[f] == null || (f === 'user_knows' && minds[i].user_knows === 'yes')) continue;
            merged[f] = x[f];
        }
        minds[i] = merged;
    }
    return normalizeLedger({ bodies, own, minds, powers, aliases });
}

/**
 * Read an update answer against the current ledger: a changes-only object, {} for no change, or a whole ledger
 * if the model sent one anyway. Returns null if it can't be read.
 */
export function parseLedgerUpdate(text, current) {
    const j = firstJson(text);
    if (!j) return /^\s*(\{\s*\}|none|no changes?\.?)\s*$/i.test(String(text || '')) ? normalizeLedger(current) : null;
    return applyLedgerDiff(current, j);
}

// ------------------------------------------------------------------ second look at new possessions
// The update model over-reads: someone grabbed, spoken to or merely present near a possessor got listed as
// possessed. A yes/no question about one specific pair is much easier than open extraction, and new possessions
// are rare, so each one gets checked before it's kept.

/** Possessions in `next` that `prev` didn't have. */
export function newRides(prev, next) {
    const key = pairKeyWith(aliasResolver(prev, next));
    const had = new Set(rides(prev).map(b => key(b.driver, b.body)));
    return rides(next).filter(b => !had.has(key(b.driver, b.body)));
}

export const RIDE_CHECK_SYSTEM = `You check one claim about a roleplay: that a particular mind has taken over a particular person's body and is driving it (possession, wearing them as a skin, a hive taking them, a copy overwriting them).
Answer YES if the messages show it or clearly imply it: the mind going into them; the person jolting, blanking or going still and then acting for that mind; the possessor talking about being in them or speaking through them; the narration saying so. A mind that can run several bodies can be in this one while its own body sits somewhere else.
Answer NO if the only link is being near, touched, grabbed, held, talked to, looked at, threatened, wanted or mentioned, or the person doing what they're told out of fear or their own choice. When it's truly unclear, answer NO.
Answer YES or NO on the first line, then quote the words that decide it.`;

export function buildRideCheckMessages(ride, messages, context = [], userName = 'the player', { ledger = null, modes = [] } = {}) {
    const show = xs => xs.map(m => `### ${m.name}\n${clip(m.text, 2500)}`).join('\n\n');
    const canon = aliasResolver(ledger);
    const already = ledger ? rides(ledger).filter(b => canon(b.driver) === canon(ride.driver)).map(b => b.body) : [];
    const known = [
        modes.length ? `Mechanics this story can use: ${modes.join(', ')}.` : '',
        already.length ? `Already known: ${ride.driver} is driving ${list(already)}.` : '',
        `The player's character is ${userName}; "you" in the narration is ${userName}, or whoever is driving ${userName}'s body.`,
    ].filter(Boolean).join('\n');
    // In a one-body story, a mind that already has a body can only take a new one by leaving the old: check for
    // that, the stronger claim. (Unchecked, a quote about the current body was taken as proof of a move.)
    const claim = already.length && isSingleBody(modes)
        ? `${ride.driver}'s mind has left ${list(already)} and is now inside ${ride.body}'s body, driving it.`
        : `${ride.driver}'s mind is now inside ${ride.body}'s body, driving it.`;
    return [
        { role: 'system', content: RIDE_CHECK_SYSTEM },
        { role: 'user', content: `${context.length ? `Earlier messages:\n${show(context)}\n\n` : ''}New messages:\n${show(messages)}\n\n${known}\nClaim: ${claim}\nIs the claim shown? YES or NO.` },
    ];
}

// Modes that let one mind drive several bodies at once. Without any of them, taking a new body means leaving the
// old one (a case from testing: the ledger kept the old body "driven by" a mind after it jumped into a new one).
const MULTI_MODES = ['Multipossession', 'Hive Mind', 'Propagation', 'Puppetry'];
export const isSingleBody = (modes = []) => modes.length > 0 && !modes.some(m => MULTI_MODES.includes(m));
// Modes where the mind's own body stays one of the set. (A Multipossession chat had the player's body "go slack",
// and the ledger, labelling the ride plain "possession", had no way to say otherwise.)
const KEEPS_OWN_BODY = ['Multipossession', 'Hive Mind'];

/**
 * A ride the model labelled plain "possession" is a multipossession when that mode is on, and a hive mind in a story
 * whose only occupancy mode is Hive Mind. The label is what tells the rest of the ledger the mind kept its own body.
 */
export function labelMultiRides(ledger, modes = []) {
    const l = normalizeLedger(ledger);
    const label = modes.includes('Multipossession') ? 'multipossession' : modes.includes('Hive Mind') && !modes.includes('Possession') ? 'hive mind' : '';
    if (!label) return l;
    return { ...l, bodies: l.bodies.map(b => (b.driver && b.body && /^\s*(possession|possessed)?\s*$/i.test(b.how) ? { ...b, how: label } : b)) };
}

/** With no multi-body mode picked, a mind that takes a new body has left its old one: that body is now empty. */
export function oneBodyAtATime(prev, next, modes = []) {
    if (!isSingleBody(modes)) return normalizeLedger(next);
    const canon = aliasResolver(prev, next);
    const moved = new Map(newRides(prev, next).map(r => [canon(r.driver), canon(r.body)]));
    if (!moved.size) return normalizeLedger(next);
    const bodies = normalizeLedger(next).bodies.map(b => (b.driver && moved.has(canon(b.driver)) && moved.get(canon(b.driver)) !== canon(b.body)
        ? { ...b, driver: '', driver_pronouns: '' } : b));
    return normalizeLedger({ ...next, bodies });
}

export const parseRideCheck = text => /^[\s*"'`]*yes\b/i.test(String(text || ''));

// "Did the mind move?" as a yes/no was approved on stray quotes (a corpse's thumbprint, the line where the mind
// LEFT that body). Picking where the mind is now, from a short list, is a question even a small model gets right.
export const WHERE_SYSTEM = `You read a roleplay and say where one mind is at the end of the new messages: which body it is inside and driving. Go by what the messages show happening, not by who is mentioned, touched or talked about. Answer with exactly one option from the list, copied as written, on the first line.`;

/** Options: the bodies the mind drives now, the claimed new body, its own body, and "unclear". */
export function buildWhereMessages(ride, current, messages, context = [], userName = 'the player') {
    const show = xs => xs.map(m => `### ${m.name}\n${clip(m.text, 2500)}`).join('\n\n');
    const options = [...new Set([...current, ride.body])].map(b => `${b}'s body`).concat([`${ride.driver}'s own body`, 'unclear']);
    return {
        options,
        messages: [
            { role: 'system', content: WHERE_SYSTEM },
            { role: 'user', content: `${context.length ? `Earlier messages:\n${show(context)}\n\n` : ''}New messages:\n${show(messages)}\n\nThe player's character is ${userName}; "you" in the narration is ${userName}, or whoever is driving ${userName}'s body.\nBefore these messages, ${ride.driver}'s mind was in ${list(current)}'s body.\nAt the end of the new messages, where is ${ride.driver}'s mind?\n${options.map(o => `- ${o}`).join('\n')}` },
        ],
    };
}

/** The option the answer names (first match on the first line), or null. */
export function parseWhere(text, options) {
    const first = String(text || '').split('\n').find(l => l.trim()) || '';
    const hit = options.map(o => [o, first.toLowerCase().indexOf(o.toLowerCase().replace(/'s body$/, ''))]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1])[0];
    return hit ? hit[0] : null;
}

/**
 * Second look at every new possession before it's kept; `ask(messages, maxTokens)` returns the model's text.
 * In a one-body story, a mind that already has a body gets the "where is it now?" question; otherwise yes/no.
 * Then, in a one-body story, the body a mind moved out of is left empty.
 */
export async function verifyNewRides(prev, next, { messages, context = [], userName = 'the player', modes = [] }, ask) {
    const canon = aliasResolver(prev, next);
    const rejected = [], log = [];
    for (const ride of newRides(prev, next)) {
        const current = rides(prev).filter(b => canon(b.driver) === canon(ride.driver)).map(b => b.body);
        let ok, answer;
        if (current.length && isSingleBody(modes)) {
            const w = buildWhereMessages(ride, current, messages, context, userName);
            answer = await ask(w.messages, 60);
            ok = parseWhere(answer, w.options) === `${ride.body}'s body`;
        } else {
            answer = await ask(buildRideCheckMessages(ride, messages, context, userName, { ledger: prev, modes }), 120);
            ok = parseRideCheck(answer);
        }
        log.push({ ride: `${ride.driver} → ${ride.body}`, kept: ok, answer: String(answer).replace(/\s+/g, ' ').slice(0, 160) });
        if (!ok) rejected.push(ride);
    }
    return { ledger: oneBodyAtATime(prev, dropRides(prev, next, rejected), modes), rejected, log };
}

/** Undo the rows for rides the check rejected: back to what the previous ledger had for that body, or gone. */
export function dropRides(prev, next, rejected) {
    if (!rejected.length) return normalizeLedger(next);
    const canon = aliasResolver(prev, next);
    const bodyKey = b => canon(b.body);
    const wrong = new Set(rejected.map(bodyKey));
    const before = new Map(normalizeLedger(prev).bodies.map(b => [bodyKey(b), b]));
    const bodies = normalizeLedger(next).bodies.flatMap(b => (!wrong.has(bodyKey(b)) ? [b] : before.has(bodyKey(b)) ? [before.get(bodyKey(b))] : []));
    return normalizeLedger({ ...next, bodies });
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

const list = xs => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const MULTI = /multi|hive|network|collective|swarm/i;

/**
 * Minds running more than one body at once (their own included), with the bodies they run: one person in several
 * places. Copies are separate people and puppets empty bodies moved from outside, so neither counts.
 */
export function multiBodyGroups(ledger) {
    const l = normalizeLedger(ledger);
    const canon = aliasResolver(l);
    // A mind's own body with a row of its own (empty, or someone else inside) isn't one it's running.
    const listed = new Set(l.bodies.filter(b => b.body).map(b => canon(b.body)));
    const groups = new Map();
    for (const b of l.bodies) {
        if (!b.driver || !b.body || same(b.body, 'none') || COPY.test(b.how) || PUPPET.test(b.how)) continue;
        const g = groups.get(canon(b.driver)) || { driver: b.driver, bodies: [], ownToo: false, hidden: false };
        g.bodies.push(b.body);
        if (MULTI.test(b.how) && !listed.has(canon(b.driver))) g.ownToo = true;
        if (b.user_knows === 'no') g.hidden = true;
        groups.set(canon(b.driver), g);
    }
    return [...groups.values()].filter(g => g.bodies.length > 1 || g.ownToo);
}

/** Every body `name` is running right now, their own listed as `name`; empty unless it's more than one. */
export function bodiesRunBy(ledger, name) {
    return rosterOf(ledger, name).map(r => r.name);
}

/**
 * The bodies `name` directs right now, with what each is doing and where it is: {name, own, doing, notes}. Hosts and
 * hive bodies share their mind, puppets are moved from outside, and the mind's own body counts while it keeps it
 * alongside the others. Copies are their own people and never count. Empty unless it's more than one.
 */
export function rosterOf(ledger, name) {
    const l = normalizeLedger(ledger);
    const canon = aliasResolver(l);
    const mine = l.bodies.filter(b => b.driver && b.body && !same(b.body, 'none') && canon(b.driver) === canon(name) && !COPY.test(b.how));
    const listed = new Set(l.bodies.filter(b => b.body).map(b => canon(b.body)));
    const ownToo = mine.some(b => MULTI.test(b.how) || PUPPET.test(b.how)) && !listed.has(canon(name));
    if (mine.length + (ownToo ? 1 : 0) < 2) return [];
    const own = l.own.find(o => canon(o.who) === canon(name)) || {};
    return [
        ...(ownToo ? [{ name, own: true, doing: own.doing || '', notes: own.notes || '' }] : []),
        ...mine.map(b => ({ name: b.body, own: false, doing: b.doing, notes: b.notes })),
    ];
}

// Each mechanism in its own words. A generic "driven by" on every row, every reply, read as someone operating a
// body from outside and pulled scenes toward puppetry.
const PLAIN_HOW = /^\s*(possession|possessed|skinsuit|skin|worn|hive( mind)?|copy|propagation|puppetry|puppet|swap|body swap|)\s*$/i;
function rideVerb(how) {
    const h = lc(how);
    if (/skin|worn/.test(h)) return 'worn as a skin by';
    if (/hive/.test(h)) return 'absorbed into the hive of';
    if (/cop(y|ied)|propagat|overwrit/.test(h)) return 'overwritten by a copy of';
    if (/puppet/.test(h)) return 'puppeted from outside by';
    if (/swap/.test(h)) return 'swapped, now home to';
    return 'possessed by';
}

/**
 * Which of `names` the player's message gives a line of its own ("[Kayla] …" or "Kayla: …" at the start of a line),
 * and whether it also has lines with no name.
 */
export function linesFor(text, names) {
    const byKey = new Map(names.map(n => [lc(n), n]));
    const given = new Set();
    let untagged = false;
    for (const line of String(text || '').split('\n')) {
        if (!line.trim()) continue;
        const m = /^\s*\[([^\]\n]+)\]\s*(\S.*)?$/.exec(line) || /^\s*([^:\n[\]]{1,40}):\s*(\S.*)?$/.exec(line);
        const name = m && byKey.get(lc(m[1]));
        if (name) { if (m[2]) given.add(name); } else untagged = true;
    }
    return { given: names.filter(n => given.has(n)), untagged };
}

/**
 * The player's bodies by name for this turn: the ones their message gave a line and the ones it didn't. A general
 * rule lost to a scene that pulled the other way (a customer waiting at an absorbed barista's register); names hold.
 */
function turnLine(roster, userName, lastUserText) {
    const names = roster.map(r => r.name);
    const { given, untagged } = linesFor(lastUserText, names);
    if (!given.length) return '';
    const idle = roster.filter(r => !given.includes(r.name)).map(r => (r.own ? `${userName}'s own body` : r.name));
    const gave = given.map(n => (lc(n) === lc(userName) ? `${userName}'s own body` : n));
    if (!idle.length) return `This turn ${userName} wrote a line for every one of their bodies: write each doing only that.`;
    const one = idle.length === 1;
    return `This turn ${userName} wrote lines for ${list(gave)} and nothing for ${list(idle)}${untagged ? ' (unless a line with no name plainly includes them)' : ''}. `
        + `${list(idle)} ${one ? 'does' : 'do'} nothing new and ${one ? 'says' : 'say'} nothing: if anyone speaks to or waits on ${one ? idle[0] : 'any of them'}, write that person and stop there, leaving the answer to ${userName}.`;
}

/** The text injected into the prompt (depth 1). Empty string when there is nothing to say. */
export function renderLedger(ledger, userName = '{{user}}', { lastUserText = '' } = {}) {
    const l = normalizeLedger(ledger);
    if (isEmptyLedger(l)) return '';
    const lines = [];
    const hidden = [];
    const canon = aliasResolver(l);
    // What the player's bodies are busy with is for the roster only: given to the writer, it was an invitation to
    // write those bodies doing things the player never wrote.
    const players = d => d && canon(d) === canon(userName);
    for (const b of l.bodies) {
        const body = b.body && b.body.toLowerCase() !== 'none' ? b.body : null;
        const bodyTag = body ? `${body}${b.pronouns ? ` (${b.pronouns})` : ''}` : null;
        const driverTag = b.driver ? `${b.driver}${b.driver_pronouns ? ` (${b.driver_pronouns})` : ''}` : null;
        let line;
        if (!bodyTag) line = `${driverTag}: a mind with no body right now`;
        else if (driverTag && !same(b.driver, body)) line = `${bodyTag}: ${rideVerb(b.how)} ${driverTag}${PLAIN_HOW.test(b.how) ? '' : ` (${b.how})`}`;
        else line = `${bodyTag}: empty, nobody inside${b.how ? ` (${b.how})` : ''}`;
        if (bodyTag && b.host) line += `. ${body}'s own mind: ${b.host}`;
        if (b.notes) line += `. ${b.notes}`;
        if (b.doing && !players(b.driver)) line += `. Busy with: ${b.doing}`;
        if (b.user_knows === 'no' && body && b.driver) { line += `. HIDDEN from ${userName}`; hidden.push(b); }
        lines.push(`- ${line}.`.replace(/\.\.$/, '.'));
    }
    const rules = [];
    const roster = rosterOf(l, userName);
    const ownLine = who => {
        const own = l.own.find(o => canon(o.who) === canon(who));
        const busy = own?.doing && !players(who) ? `. Busy with: ${own.doing}` : '';
        lines.push(`- ${who}'s own body: still ${who}'s, awake and in use${own?.notes ? `. ${own.notes}` : ''}${busy}.`.replace(/\.\.$/, '.'));
    };
    const groups = multiBodyGroups(l);
    for (const g of groups) if (g.ownToo) ownLine(g.driver);
    if (roster.some(r => r.own) && !groups.some(g => g.ownToo && players(g.driver))) ownLine(userName);
    for (const g of groups) {
        const bodies = [...g.bodies, ...(g.ownToo ? [`${g.driver}'s own body`] : [])];
        const independent = `Each body does its own thing, the way a drummer's limbs play different parts: never the same action at once, never in sync, never mirroring each other (only a mind new to the ability slips into that).`;
        if (g.hidden) {
            rules.push(`${list(bodies)} are all ${g.driver}, but ${userName} doesn't know. Around ${userName} they act like the separate people they appear to be, naturally or a little awkwardly, since one person is playing every part, and narration never shows the link. ${independent}`);
        } else {
            rules.push(`${list(bodies)} are all ${g.driver}: one person in several places. They touch, pleasure, look at and talk about each other freely, since that is one person enjoying their own bodies, but they never converse with each other as if they were separate people, except as staged talk in front of someone who doesn't know. ${independent}`);
        }
    }
    if (roster.length) {
        const names = [...roster.filter(r => !r.own).map(r => r.name), ...(roster.some(r => r.own) ? [`${userName}'s own body`] : [])];
        rules.push(`${list(names)} belong to ${userName}, the player: write none of them beyond what ${userName} wrote, exactly as you never write ${userName}. Each does only what ${userName} wrote for it, with nothing added. A body ${userName} gave nothing this turn does nothing new: if someone speaks to it or waits on it, write that person and stop, leaving the answer to ${userName}.`);
        const turn = turnLine(roster, userName, lastUserText);
        if (turn) rules.push(turn);
    }
    for (const b of hidden) {
        const her = (b.pronouns.split('/')[0] || 'they').toLowerCase();
        rules.push(`${userName} doesn't know that ${b.body} is ${b.driver}. In narration ${her === 'they' ? 'they are' : `${her} is`} only ${b.body}, with ${b.body}'s own name and pronouns, and nothing mentions, hints at, or explains that anyone else is inside. ${b.driver}'s habits may show in what ${b.body} does, written as ${b.body}'s own behaviour; only what ${userName} could actually notice reaches the page.`);
    }
    const minds = l.minds.map(m => mindLine(m, userName, players, rules));
    const powers = l.powers.map(p => `${p.who}: ${p.power}`).join('; ');
    const aliases = l.aliases.map(a => `${a.name} = ${a.aka.join(' = ')}`).join('; ');
    const hasBodies = l.bodies.length > 0 || lines.length > 0;
    return [
        '<body_ledger>',
        ...(hasBodies ? [
            `Who is in which body right now. Where ${userName} knows, everything the world sees of a body uses that body's own name and pronouns, and anything about the mind inside it (what it wants, decides, thinks, or is) uses the mind's own name and pronouns. Either way, that mind's habits show as the body's own behaviour, written plainly, with no narration pointing out who is inside.`,
            ...lines,
            `Everyone else, ${userName} included unless listed, is in their own body.`,
        ] : []),
        ...(minds.length ? ['Whose mind a power has changed. Nobody else is in these bodies: each change is to the mind itself, never someone steering from outside.', ...minds] : []),
        ...(aliases ? [`Same person, different names: ${aliases}.`] : []),
        ...(powers ? [`Powers: ${powers}.`] : []),
        ...rules,
        'This is a record kept alongside the story. Where the chat itself says otherwise, the chat wins.',
        '</body_ledger>',
    ].join('\n');
}

// Changes felt as the subject's own: they still want, decide and explain for themselves.
const FEELS_OWN = /hypno|trance|mind[- ]?control|perception|rewrite|brainwash|condition/i;

/** One minds line for the writer; any rule it needs (hidden, who holds it) goes into `rules`. */
function mindLine(m, userName, players, rules) {
    const how = m.how || 'changed';
    let line = `- ${m.who}: ${how}${m.by ? `, by ${m.by}` : ''}`;
    if (m.changes) line += `. Changed: ${m.changes}`;
    if (m.triggers) line += `. Triggers: ${m.triggers}`;
    if (m.state) line += `. Right now: ${m.state}`;
    if (FEELS_OWN.test(how)) line += `. ${m.who} is still ${m.who} at the wheel and feels all of it as their own`;
    if (m.user_knows === 'no') {
        line += `. HIDDEN from ${userName}`;
        rules.push(`${userName} doesn't know anything was done to ${m.who}. Narration never mentions, hints at, or explains it; only what ${userName} could actually notice reaches the page.`);
    }
    if (players(m.by)) rules.push(`${m.who}'s ${how} is ${userName}'s doing: only ${userName} sets or changes what ${m.who} is made to do, think or believe.`);
    if (players(m.who)) rules.push(`${userName} is the one changed (${how}): write ${userName}'s changed behaviour, and leave ${userName}'s inner experience of it to ${userName}.`);
    return `${line}.`.replace(/\.\.$/, '.');
}

// ------------------------------------------------------------------ possession lint (cut-only)

export const LINT_SYSTEM = `You cut specific lines out of body-swap roleplay prose. You may ONLY cut. Never add, reword, or move anything.
Cut exactly these, and nothing else:
{{rules}}
Copy each cut exactly, character for character, as it appears in the prose. Cut the smallest piece that removes the problem: a clause, a sentence, or one spoken line together with its speech tag. If nothing needs cutting, answer NONE.
Answer only in this form, one line per cut, or the single word NONE:
CUT: <exact text>`;

export function buildLintMessages(text, ledger, userName = 'the player') {
    const l = normalizeLedger(ledger);
    const rules = [];
    const groups = multiBodyGroups(l);
    for (const g of groups) {
        const bodies = [...g.bodies, ...(g.ownToo ? [g.driver] : [])];
        if (!g.hidden) {   // when the player doesn't know, the bodies are right to talk like separate people
            rules.push(`- BODIES CONVERSING. ${list(bodies)} are all one person, ${g.driver}. Cut any spoken line, with its speech tag, in which one of them addresses, answers, jokes with, or argues with another of them as though it were a different person, and narration that frames such an exchange ("a joke with herself", "the other body adds", "answering himself"). NEVER cut touching, kissing, sex, pleasuring, or looking at each other, and never cut one body talking ABOUT another to someone else: those are expected.`);
        }
        rules.push(`- BODIES IN SYNC. Narration in which two or more of ${list(bodies)} do the same thing at the same moment, move in unison, mirror each other, or speak in chorus ("both glance over at the same instant", "all four speaking at once", "in perfect sync"). Cut the sentence or clause that describes it. Different bodies doing different things at once is correct and stays. Leave it only if the story shows ${g.driver} is new to the ability.`);
    }
    rules.push('- POINTERS. Narration that points out someone else is inside a body: "Marcus\'s mannerism on her face", "his smile on her mouth", "her borrowed face", "someone else\'s mouth", "a smile that isn\'t hers", "something behind her eyes", "the amusement doesn\'t reach her eyes", "the same grin on three faces", "Victor\'s cadence makes it unsettling", bodies moving in eerie unison. Cut only the pointing words and keep the action: from "Dana rolls her eyes—Marcus\'s mannerism on her face." cut "—Marcus\'s mannerism on her face"; from "Cole\'s borrowed eyes go wide." cut just "borrowed " so it reads "Cole\'s eyes go wide."');
    for (const b of l.bodies.filter(b => b.user_knows === 'no' && b.body && b.driver)) {
        const aka = akaOf(l, b.driver);
        rules.push(`- SECRETS. ${userName} does not know that ${b.body} is being driven by ${b.driver}${aka.length ? ` (also called ${aka.join(', ')})` : ''}. Cut narration that reveals or hints at it (naming ${b.driver} as the one inside ${b.body}, "possessed", "inside her", "wearing her", "piloting").`);
    }
    return [
        { role: 'system', content: LINT_SYSTEM.replace('{{rules}}', rules.join('\n')) },
        { role: 'user', content: `Prose:\n<<<\n${text}\n>>>` },
    ];
}

/** A regex that matches `s` while ignoring dash style/spacing, quote style, and runs of whitespace. */
function looseMatcher(s) {
    const esc = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let src = '';
    for (const ch of s.trim()) {
        if (/[—–-]/.test(ch)) src += String.raw`\s*[—–-]\s*`;
        else if (/["“”]/.test(ch)) src += '["“”]';
        else if (/['‘’]/.test(ch)) src += "['‘’]";
        else if (/\s/.test(ch)) src += String.raw`\s+`;
        else src += esc(ch);
    }
    return new RegExp(src.replace(/(\\s\*|\\s\+)+/g, m => (m.includes('+') ? String.raw`\s+` : String.raw`\s*`)));
}

/**
 * Find `cut` in `text` ignoring asterisks (the model often drops italics markers) plus the looseMatcher slips.
 * Returns [start, end) in the original text, widened to take an italic marker that would otherwise dangle.
 */
function locateLoose(text, cut) {
    const map = [];
    let stripped = '';
    for (let i = 0; i < text.length; i++) if (text[i] !== '*') { map.push(i); stripped += text[i]; }
    const m = stripped.match(looseMatcher(cut.replace(/\*/g, '')));
    if (!m) return null;
    let s = map[m.index], e = map[m.index + m[0].length - 1] + 1;
    const inner = (text.slice(s, e).match(/\*/g) || []).length;
    if (inner % 2) {   // one marker of a pair is inside: take its partner if it sits right at an edge
        if (text[e] === '*') e++;
        else if (text[s - 1] === '*') s--;
    }
    return [s, e];
}

export function parseLintResponse(text) {
    return String(text || '').split('\n').map(l => l.match(/^\s*CUT:\s*(.+?)\s*$/i)?.[1]).filter(Boolean);
}

/**
 * Apply cut-only fixes. Every cut must appear verbatim, stay under 400 characters, keep its quote marks
 * balanced, and all cuts together may remove at most 40% of the reply.
 */
export function applyCuts(text, cuts) {
    let out = text;
    const applied = [], rejected = [];
    let removed = 0;
    for (let cut of cuts) {
        cut = cut.replace(/^<<<|>>>$/g, '').trim();
        if (!cut) continue;
        let at = out.indexOf(cut);
        // allow the model to drop the outer asterisks of an italic span
        if (at < 0 && out.indexOf(`*${cut}*`) >= 0) { cut = `*${cut}*`; at = out.indexOf(cut); }
        // tolerate copying slips that don't change the words: dash style and spacing, curly quotes, whitespace,
        // and dropped italics asterisks
        if (at < 0) {
            const span = locateLoose(out, cut);
            if (span) { at = span[0]; cut = out.slice(span[0], span[1]); }
        }
        if (at < 0) { rejected.push({ cut, why: 'not found verbatim' }); continue; }
        if (cut.length > 400) { rejected.push({ cut, why: 'too long' }); continue; }
        const quotes = (cut.match(/["“”]/g) || []).length;
        if (quotes % 2) { rejected.push({ cut, why: 'would break a quote' }); continue; }
        if (removed + cut.length > Math.max(0.4 * text.length, 220)) { rejected.push({ cut, why: 'too much of the reply' }); continue; }
        // A cut from the middle of a sentence ("the store" out of "he went to the store.") leaves it broken.
        const next = deleteSpan(out, at, at + cut.length);
        if (leavesBroken(out, next)) { rejected.push({ cut, why: 'leaves a broken sentence' }); continue; }
        out = next;
        removed += cut.length;
        applied.push({ action: 'CUT', from: cut });
    }
    out = out
        .replace(/[ \t]*[—–][ \t]*([.!?,;])/g, '$1')            // "tilts her head —." → "tilts her head."
        .replace(/([.!?])[ \t]*[—–][ \t]*(?=\*|"|”|$)/gm, '$1')  // a dash left dangling before a closing mark
        .replace(/,[ \t]*([.!?])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +([,.!?;:])/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^[ \t]+|[ \t]+$/gm, '');
    return { text: out, applied, rejected };
}

// ------------------------------------------------------------------ pronoun / name check

export const PRONOUNS = new Set('he him his himself she her hers herself they them their theirs themself themselves'.split(' '));

/** True when at least one body is driven by a mind with a different name or different pronouns. */
export function hasCrossedBodies(ledger) {
    return normalizeLedger(ledger).bodies.some(b => b.body && b.driver && !same(b.body, b.driver));
}

// A general "bodies get body pronouns, minds get mind pronouns" prompt makes a small model flip correct speech tags
// and movements ("she says" → "he says") and even swap who acted. This version says the default is correct and
// names the one thing to look for, which avoids false fixes and still catches the real errors.
export const PRONOUN_SYSTEM = `You check one specific mistake in body-swap roleplay prose. Given who is driving which body, find pronouns that refer to the DRIVING MIND itself but use the BODY's gender.
By default, pronouns follow the body, and that is correct: speech tags ("she says"), movements, gestures, looks, clothes, and body parts of a possessed body use the BODY's pronouns. Never touch those.
Only a pronoun whose referent is plainly the driving mind as a person gets the mind's pronouns: its identity and history, its own plans and wants stated as the mind's ("he's wanted this for years"), its attention split across bodies, or its own separate body.
Never change who performs an action, and never replace one character's name with another's.
Example, with Alice's body (she/her) driven by Marcus (he/him):
- "Not long," she says. She sets the eggs down. → correct, leave it.
- She has been planning this since he first saw her at the gym. → BAD: the planner is Marcus's mind. FIX: He has been planning this since he first saw her at the gym.
When in doubt, leave it. Report at most three.
Answer only in this form, one pair per mistake, or the single word NONE:
BAD: <the exact sentence, copied character for character>
FIX: <the sentence with only the pronouns or names changed>`;

export function buildPronounMessages(text, ledger) {
    const l = normalizeLedger(ledger);
    const map = l.bodies.filter(b => b.body && b.driver && !same(b.body, b.driver))
        .map(b => `- The body of ${b.body} (${b.pronouns || '?'}) is driven by ${b.driver} (${b.driver_pronouns || '?'}).`).join('\n');
    return [
        { role: 'system', content: PRONOUN_SYSTEM },
        { role: 'user', content: `Who is in which body:\n${map}${l.aliases.length ? `\nSame person, different names: ${l.aliases.map(a => [a.name, ...a.aka].join(' = ')).join('; ')}` : ''}\n\nProse:\n<<<\n${text}\n>>>` },
    ];
}

export function parsePronounResponse(text) {
    const out = [];
    const lines = String(text || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const bad = lines[i].match(/^\s*BAD:\s*(.+)$/i);
        if (!bad) continue;
        const fix = (lines[i + 1] || '').match(/^\s*FIX:\s*(.+)$/i);
        if (fix) { out.push({ bad: bad[1].trim(), fix: fix[1].trim() }); i++; }
    }
    return out;
}

const tokens = s => String(s).match(/[A-Za-z']+|[^\sA-Za-z']/g) || [];

/**
 * Accept a fix only if it is the same sentence with nothing but pronouns and ledger names swapped, and the
 * original sentence appears verbatim in the text. Returns the applied text and a log.
 */
export function applyPronounFixes(text, pairs, ledger) {
    const l = normalizeLedger(ledger);
    const names = new Set([...l.bodies.flatMap(b => [b.body, b.driver]), ...l.aliases.flatMap(a => [a.name, ...a.aka])]
        .filter(Boolean).flatMap(n => n.toLowerCase().split(/\s+/)));
    const swappable = w => {
        const x = w.toLowerCase().replace(/'s$/, '');
        return PRONOUNS.has(x) || names.has(x);
    };
    let out = text;
    const applied = [], rejected = [];
    for (const { bad, fix } of pairs) {
        const b = bad.replace(/^[*"“]+|[*"”]+$/g, '').trim(), f = fix.replace(/^[*"“]+|[*"”]+$/g, '').trim();
        if (!b || b === f) continue;
        const at = out.indexOf(b);
        if (at < 0) { rejected.push({ bad: b, fix: f, why: 'sentence not found verbatim' }); continue; }
        const tb = tokens(b), tf = tokens(f);
        if (tb.length !== tf.length) { rejected.push({ bad: b, fix: f, why: 'changed more than pronouns/names' }); continue; }
        let changed = 0, ok = true;
        for (let i = 0; i < tb.length; i++) {
            if (tb[i] === tf[i]) continue;
            if (swappable(tb[i]) && swappable(tf[i])) { changed++; continue; }
            if (tb[i].toLowerCase() === tf[i].toLowerCase()) continue; // capitalisation only
            ok = false; break;
        }
        if (!ok || !changed) { rejected.push({ bad: b, fix: f, why: ok ? 'no pronoun or name changed' : 'changed more than pronouns/names' }); continue; }
        out = out.slice(0, at) + f + out.slice(at + b.length);
        applied.push({ from: b, to: f });
    }
    return { text: out, applied, rejected };
}

// ------------------------------------------------------------------ body history
// Past possessions, worked out from the per-message ledger snapshots, so the history follows swipes, edits and
// deleted messages with nothing extra to keep in sync. The only thing stored besides the snapshots is a short
// note per ended possession (what the host remembers, what the driver kept, what the ride left behind), written
// by the local model on the message where the Ledger shows the possession ending.

// A ride is keyed by who is driving whom, through aliases, so "Sasha" and "Unit 114" are one body.
const pairKeyWith = canon => (driver, body) => `${canon(driver)}\u0000${canon(body)}`;
const pairKey = pairKeyWith(lc);
const rides = l => normalizeLedger(l).bodies.filter(b => b.driver && b.body && !same(b.body, 'none') && !same(b.body, b.driver));

/** Possessions in `before` that are gone from `after`: the row was removed or someone else drives the body now. */
export function endedRides(before, after) {
    const key = pairKeyWith(aliasResolver(before, after));
    const now = new Set(rides(after).map(b => key(b.driver, b.body)));
    return rides(before).filter(b => !now.has(key(b.driver, b.body)));
}

/**
 * Every possession episode in the chat, oldest first.
 * @param {{index:number, ledger:object, notes?:object[]}[]} snaps  ledger snapshots in chat order
 * @param {number} [gap]  a pair missing from this many snapshots in a row still counts as one ride, since the
 *                        ledger model occasionally drops a row for a turn and puts it back
 * @returns {{driver, body, how, host, start, end, user_knows, notes}[]}  end is null while the ride goes on
 */
export function bodyHistory(snaps, gap = 1) {
    // Aliases learned anywhere in the chat apply to all of it: a body renamed later is still the same body.
    const pairKey = pairKeyWith(aliasResolver(...snaps.map(s => s.ledger)));
    const open = new Map();
    const closed = [];
    snaps.forEach((snap, si) => {
        const cur = new Map(rides(snap.ledger).map(b => [pairKey(b.driver, b.body), b]));
        for (const [key, b] of cur) {
            let ep = open.get(key);
            if (!ep) {
                const last = closed.findLast(e => e.key === key);
                if (last && si - last.lastSeen - 1 <= gap) {
                    closed.splice(closed.indexOf(last), 1);
                    Object.assign(last, { end: null, notes: null });
                    ep = last;
                } else {
                    ep = { key, driver: b.driver, body: b.body, start: snap.index, end: null, notes: null };
                }
                open.set(key, ep);
            }
            // Latest names win, so the history uses what the story calls them now.
            Object.assign(ep, { driver: b.driver, body: b.body, how: b.how || ep.how || '', host: b.host || ep.host || '', user_knows: b.user_knows, lastSeen: si });
        }
        for (const [key, ep] of open) {
            if (cur.has(key)) continue;
            ep.end = snap.index;
            open.delete(key);
            closed.push(ep);
        }
        for (const n of normalizeNotes(snap.notes)) {
            const ep = closed.findLast(e => e.key === pairKey(n.driver, n.body) && e.end === snap.index);
            if (ep) ep.notes = n;
        }
    });
    return [...closed, ...open.values()].sort((a, b) => a.start - b.start)
        .map(({ lastSeen, ...ep }) => ep);
}

/** Like str(), but a long note ends at a word boundary instead of mid-word. */
const phrase = (v, max = 160) => {
    const s = str(v, 400).replace(/[.;,\s]+$/, '');
    if (s.length <= max) return s;
    return s.slice(0, max).replace(/[\s,;]+\S*$/, '');
};

export function normalizeNotes(raw) {
    return (Array.isArray(raw) ? raw : []).map(n => ({
        driver: str(n?.driver, 60), body: str(n?.body, 60),
        remembers: phrase(n?.remembers), kept: phrase(n?.kept), left: phrase(n?.left),
    })).filter(n => n.driver && n.body && (n.remembers || n.kept || n.left));
}

/**
 * Ended rides grouped for display, most recent first: one entry per driver→body pair, and bodies that share
 * everything but their name (a rig of unnamed hosts released together) folded into one. Used by the prompt text
 * and the settings panel.
 */
export function historyGroups(episodes, { max = 10 } = {}) {
    const pairs = new Map();
    for (const ep of episodes) {
        const key = ep.key ?? pairKey(ep.driver, ep.body);
        const p = pairs.get(key) || { driver: ep.driver, body: ep.body, ended: 0, ongoing: false, lastEnd: -1, how: '', host: '', user_knows: 'yes', notes: {} };
        if (ep.end == null) p.ongoing = true;
        else { p.ended++; p.lastEnd = Math.max(p.lastEnd, ep.end); }
        p.how = ep.how || p.how;
        p.host = ep.host || p.host;
        p.user_knows = ep.user_knows || p.user_knows;
        for (const k of ['remembers', 'kept', 'left']) if (ep.notes?.[k]) p.notes[k] = ep.notes[k];
        pairs.set(key, p);
    }
    // Bodies that share everything but their name (a rig of unnamed hosts released together) get one line.
    const groups = new Map();
    for (const p of [...pairs.values()].filter(p => p.ended)) {
        const sig = JSON.stringify([p.driver.toLowerCase(), p.ended, p.ongoing, p.how, p.notes.remembers ? '' : p.host, p.notes, p.user_knows]);
        const g = groups.get(sig) || { ...p, bodies: [] };
        g.bodies.push(p.body);
        g.lastEnd = Math.max(g.lastEnd, p.lastEnd);
        groups.set(sig, g);
    }
    return [...groups.values()].sort((a, b) => b.lastEnd - a.lastEnd).slice(0, max);
}

/** The text injected into the prompt. Only ended rides: the Ledger already covers what is happening now. */
export function renderHistory(episodes, userName = '{{user}}', { max = 10 } = {}) {
    const lines = historyGroups(episodes, { max }).map(g => {
        const many = g.bodies.length > 1;
        const who = list(g.bodies);
        const times = (g.ended === 1 ? 'once' : g.ended === 2 ? 'twice' : `${g.ended} times`) + (many ? ' each' : '');
        let line = `- ${g.driver} has been in ${who} ${times}${g.how ? ` (${g.how})` : ''}${g.ongoing ? ', and is again now' : ''}.`;
        if (g.notes.remembers) line += ` ${who} ${many ? 'remember' : 'remembers'}: ${g.notes.remembers}.`;
        else if (g.host) line += ` ${many ? 'Their own minds' : `${who}'s own mind`} while ridden: ${g.host}.`;
        if (g.notes.kept) line += ` ${g.driver} kept: ${g.notes.kept}.`;
        if (g.notes.left) line += ` It left ${many ? 'them' : who} with: ${g.notes.left}.`;
        if (g.user_knows === 'no') line += ` HIDDEN from ${userName}.`;
        return line.replace(/\.\./g, '.');
    });
    if (!lines.length) return '';
    return [
        '<body_history>',
        `Possessions in this story that have ended (who is in which body right now is in the Body Ledger). This is continuity: people live with the consequences the way they naturally would (lost time, what was taken, what changed), but narration doesn't recap these rides or point back at them, and whatever is hidden from ${userName} stays hidden.`,
        ...lines,
        '</body_history>',
    ].join('\n');
}

export const HISTORY_SYSTEM = `You keep continuity notes for an adult roleplay in which minds take over bodies. One or more possessions have just ended: the driving mind has left the body. From the messages, note for each one:
- remembers: what the body's own person is shown to remember or believe about the ridden time, judged by what they say or do once they're themselves again. "" if the messages don't show them after the ride.
- kept: only something the driver took away on leaving: memories or skills copied out, or an object carried off in another body. Things that stay with the host are not "kept".
- left: lasting consequences for the body's own person, in under 15 words: visible marks, changes to the body, things done or promised in their name. No tastes, aches or feelings.
Give each body only what the messages show for that body. An empty field is better than a wrong one: write "" for anything the messages don't clearly show.
Answer with JSON only, in exactly this shape:
[{"driver":"","body":"","remembers":"","kept":"","left":""}]`;

/** @param {{driver, body, host}[]} ended  @param {{name:string, text:string}[]} messages  newest messages, oldest first */
export function buildHistoryMessages(ended, messages) {
    const list = ended.map(b => `- ${b.driver} has left ${b.body}${b.host ? ` (while ridden, ${b.body}'s own mind was ${b.host})` : ''}`).join('\n');
    return [
        { role: 'system', content: HISTORY_SYSTEM },
        { role: 'user', content: `Possessions that just ended:\n${list}\n\nNewest messages, oldest first:\n${messages.map(m => `### ${m.name}\n${clip(m.text, 2500)}`).join('\n\n')}\n\nNow output the JSON.` },
    ];
}

/** Notes for the ended rides only (matched by name), or [] if the answer can't be read. */
export function parseHistoryResponse(text, ended) {
    // First complete array (a model may keep talking after it); a lone object is taken as a one-item list.
    let raw = firstJson(text, '[');
    if (!Array.isArray(raw)) { const one = firstJson(text); raw = one && typeof one === 'object' ? [one] : null; }
    if (!Array.isArray(raw)) return [];
    const wanted = new Set(ended.map(e => pairKey(e.driver, e.body)));
    const empty = /^(none|none shown|not shown|n\/a|unknown|nothing stated|not stated|-)$/i;
    return normalizeNotes(raw.map(n => ({ ...n, ...Object.fromEntries(['remembers', 'kept', 'left'].map(k => [k, empty.test(String(n?.[k] ?? '').trim()) ? '' : n?.[k]])) })))
        .filter(n => wanted.has(pairKey(n.driver, n.body)));
}
