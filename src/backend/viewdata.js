// Worldhopper Engine for Lumiverse — what the panel, the bars above the chat, the body roster, the badges and the
// Ledger and Mind Book views show, gathered from a chat in one object the frontend draws (ported from the SillyTavern
// Engine's render* and *ViewData functions).
import { normalizeLedger, EMPTY_LEDGER, aliasResolver, akaOf, rosterOf, bodyHistory, historyGroups } from '../core/ledger-core.js';
import { normalizeBook, EMPTY_BOOK, isEmptyBook, KINDS as MIND_KINDS } from '../core/mind-core.js';
import { MODE_BLURBS } from '../core/codex-core.js';
import { personaKey } from '../core/persona-core.js';
import { target, on } from './host.js';
import {
    headLedger, headMind, ledgerWanted, mindWanted, mindKinds, bodyModes, takenBodies, cardNames, cardCharacter, hostsBack,
    ledgerSnapshots, statusOf, pictureOf, lookOf, drawingNow, same, backfillCounts, backfillRunning,
} from './engine.js';

const imageUrl = id => (id ? `/api/v1/images/${encodeURIComponent(id)}?size=sm` : '');
const COPY = /cop(y|ied)|propagat/i;

/** A face: your persona's or a card's avatar for someone with a card of their own, else their picture (tap to draw). */
export function faceFor(c, name) {
    const k = personaKey(name);
    if (!k) return {};
    if (same(name, c.userName)) return { image: imageUrl(c.persona?.image_id) };
    const ch = cardCharacter(c, name);
    if (ch) return { image: imageUrl(ch.image_id) };
    return { image: imageUrl(pictureOf(c, name)), busy: drawingNow.get(`pic:${c.chatId}|${k}`) || '', open: name };
}

// ------------------------------------------------------------------ panel rows and the bars

function ledgerRows(c, ledger) {
    const canon = aliasResolver(ledger);
    const me = canon(c.userName);
    return (ledger?.bodies || []).map(b => {
        const body = b.body && b.body.toLowerCase() !== 'none' ? b.body : null;
        const copy = COPY.test(b.how);
        const main = !body ? `${b.driver}: no body` : b.driver ? `${body} ← ${copy ? `a copy of ${b.driver}` : b.driver}` : `${body}: empty`;
        const sub = [b.how && !/^possess/i.test(b.how) ? b.how : '', b.host ? `mind: ${b.host}` : '', b.notes].filter(Boolean).join(' · ');
        const kind = !b.driver || !body ? 'idle' : !copy && canon(b.driver) === me ? 'you' : 'npc';
        return { main, sub, hidden: b.user_knows === 'no' && !!body && !!b.driver, kind, icon: copy ? 'clone' : kind === 'idle' ? 'user-slash' : kind === 'you' ? 'user' : 'ghost' };
    });
}

function historyRows(c) {
    return historyGroups(bodyHistory(ledgerSnapshots(c))).map(g => {
        const times = g.ended === 1 ? 'once' : g.ended === 2 ? 'twice' : `${g.ended}×`;
        return {
            main: `${g.driver} → ${g.bodies.join(', ')} · ${times}${g.ongoing ? ', again now' : ''}`,
            sub: [g.notes.remembers ? `remembers: ${g.notes.remembers}` : g.host ? `mind: ${g.host}` : '', g.notes.kept ? `kept: ${g.notes.kept}` : '', g.notes.left ? `left: ${g.notes.left}` : ''].filter(Boolean).join(' · '),
            hidden: g.user_knows === 'no',
        };
    });
}

function stripChips(c, ledger) {
    const canon = aliasResolver(ledger);
    const me = canon(c.userName);
    return (ledger?.bodies || []).map(b => {
        const body = b.body && b.body.toLowerCase() !== 'none' ? b.body : null;
        const copy = COPY.test(b.how) && body && b.driver;
        const kind = !body ? 'mind' : !b.driver ? 'empty' : copy ? 'npc' : canon(b.driver) === me ? 'you' : 'npc';
        const title = body || b.driver;
        const sub = copy ? `a copy of ${canon(b.driver) === me ? 'you' : b.driver}`
            : { you: "you're inside", npc: canon(body) === me ? `${b.driver} is in you` : `${b.driver} inside`, empty: 'empty', mind: 'no body' }[kind];
        const icon = copy ? 'clone' : { you: 'user', npc: 'ghost', empty: 'user-slash', mind: 'wind' }[kind];
        const aka = body ? akaOf(ledger, body) : [];
        const tip = [b.how, b.host ? `own mind: ${b.host}` : '', aka.length ? `also ${aka.join(', ')}` : '', b.user_knows === 'no' ? 'hidden from you' : ''].filter(Boolean).join(' · ');
        return { kind, icon, title, sub, tip, hidden: b.user_knows === 'no', face: faceFor(c, title).image };
    });
}

function mindChips(c, book) {
    const me = c.userName.toLowerCase();
    const mine = by => (by && by.toLowerCase() === me ? 'you' : 'npc');
    const you = n => (n && n.toLowerCase() === me ? 'you' : n);
    return [
        ...(book?.hypnosis || []).map(h => ({
            kind: mine(h.by), icon: 'circle-dot', title: h.who,
            sub: h.now === 'awake' ? (h.times ? `awake · under ${h.times}×` : 'awake') : `${h.now} trance`,
            tip: ['hypnosis', h.by ? `by ${you(h.by)}` : '', h.suggestions.length ? `${h.suggestions.length} suggestion${h.suggestions.length > 1 ? 's' : ''}` : '', h.triggers.length ? `triggers: ${h.triggers.map(t => `"${t.cue}"`).join(', ')}` : ''].filter(Boolean).join(' · '),
            hidden: h.user_knows === 'no', face: faceFor(c, h.who).image,
        })),
        ...(book?.control || []).map(w => ({
            kind: mine(w.by), icon: 'hand-sparkles', title: w.who.join(', '),
            sub: `${w.by ? (mine(w.by) === 'you' ? 'your control' : `${w.by}'s control`) : 'controlled'}${w.resists === 'yes' ? ' · resisting' : ''}`,
            tip: ['mind control', ...w.set.map(x => `${x.kind} ${x.text}`)].join(' · '),
            hidden: w.user_knows === 'no', face: faceFor(c, w.who[0]).image,
        })),
        ...(book?.perception || []).map(e => ({
            kind: mine(e.by), icon: 'eye-slash',
            title: e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(', ')}` : ''}` : e.who.join(', '),
            sub: e.kind === 'unseen' ? `can't perceive ${you(e.target)}` : e.kind === 'false' ? 'believes a falsehood' : 'altered normal',
            tip: ['altered perception', e.what, e.by ? `by ${you(e.by)}` : ''].filter(Boolean).join(' · '),
            hidden: e.user_knows === 'no',
        })),
    ];
}

function mindRows(c, book) {
    const me = c.userName.toLowerCase();
    const mine = by => (by && by.toLowerCase() === me ? 'you' : 'npc');
    const rows = [];
    for (const h of book?.hypnosis || []) {
        rows.push({
            main: `${h.who} · ${h.now === 'awake' ? 'awake' : `${h.now} trance`}`,
            sub: [h.by ? `by ${h.by}` : '', h.susceptibility ? `${h.susceptibility} susceptibility` : '', h.times ? `under ${h.times}×, deepest ${h.deepest || 'light'}` : '',
                h.suggestions.length ? `${h.suggestions.length} suggestion${h.suggestions.length > 1 ? 's' : ''}: ${h.suggestions.map(x => x.text).join('; ')}` : '',
                h.triggers.length ? `triggers: ${h.triggers.map(x => `"${x.cue}"`).join(', ')}` : ''].filter(Boolean).join(' · '),
            hidden: h.user_knows === 'no', kind: mine(h.by), icon: 'circle-dot',
        });
    }
    for (const w of book?.control || []) {
        rows.push({ main: `${w.who.join(', ')}${w.by ? ` ← ${w.by}` : ''}${w.resists === 'yes' ? ' · resisting' : ''}`, sub: [...w.set.map(x => `${x.kind} ${x.text}`), w.own ? `own: ${w.own}` : ''].filter(Boolean).join(' · '), hidden: w.user_knows === 'no', kind: mine(w.by), icon: 'hand-sparkles' });
    }
    for (const e of book?.perception || []) {
        const who = e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(', ')}` : ''}` : e.who.join(', ');
        rows.push({ main: e.kind === 'unseen' ? `${who} can't perceive ${e.target}` : `${who}: ${e.kind === 'false' ? 'believes' : 'takes as normal'}`, sub: [e.what, e.by ? `by ${e.by}` : ''].filter(Boolean).join(' · '), hidden: e.user_knows === 'no', kind: mine(e.by), icon: 'eye-slash' });
    }
    return rows;
}

// ------------------------------------------------------------------ the body roster and its colors

const LANE_HUES = ['29, 158, 117', '127, 119, 221', '216, 90, 48', '212, 83, 126', '186, 117, 23', '55, 138, 221', '99, 153, 34', '226, 75, 74'];

/** Your own body is always teal; every body you've driven in this chat gets the next color, in order of first appearance. */
function laneColours(c) {
    const me = c.userName;
    const map = new Map([[me.toLowerCase(), 0]]);
    let next = 1;
    for (const snap of ledgerSnapshots(c)) {
        const l = normalizeLedger(snap.ledger);
        const canon = aliasResolver(l);
        for (const b of l.bodies) {
            if (!b.body || !b.driver || canon(b.driver) !== canon(me) || COPY.test(b.how) || map.has(b.body.toLowerCase())) continue;
            map.set(b.body.toLowerCase(), next);
            next = next % (LANE_HUES.length - 1) + 1;
        }
    }
    return map;
}
export function laneHue(map, name) {
    const k = String(name || '').trim().toLowerCase();
    const i = map.has(k) ? map.get(k) : 1 + [...k].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % (LANE_HUES.length - 1);
    return LANE_HUES[i];
}

/** "as (name)" on your own messages, from the Ledger as it stood when you wrote each one. */
function badges(c) {
    const out = [];
    let ledger = null;
    for (const m of c.msgs) {
        if (m.isUser && ledger) {
            const canon = aliasResolver(ledger);
            const me = canon(m.name || c.userName);
            const worn = ledger.bodies.filter(b => b.driver && b.body && b.body.toLowerCase() !== 'none' && canon(b.driver) === me && canon(b.body) !== me && !COPY.test(b.how)).map(b => b.body);
            if (worn.length) out.push({ messageId: m.id, worn });
        }
        if (m.wh?.ledger) ledger = normalizeLedger(m.wh.ledger);
    }
    return out;
}

// ------------------------------------------------------------------ the views behind the bars

export function ledgerViewData(c, s) {
    const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
    const canon = aliasResolver(ledger);
    const me = canon(c.userName);
    const map = c.state.personas;
    const names = cardNames(c);
    const host = (name, kind) => {
        const e = map[personaKey(name)];
        return { sheet: e?.sheet || null, removed: !!e?.removed, busy: drawingNow.get(`sheet:${c.chatId}|${personaKey(name)}`) || '', face: faceFor(c, name, kind) };
    };
    const taken = new Set(takenBodies(c, ledger).map(b => personaKey(b.body)));
    const inLedger = new Set(ledger.bodies.filter(b => b.body).map(b => personaKey(b.body)));
    const bodies = ledger.bodies.map((b, i) => {
        const body = b.body && b.body.toLowerCase() !== 'none' ? b.body : null;
        const copy = COPY.test(b.how) && body && b.driver;
        const kind = !body ? 'mind' : !b.driver ? 'idle' : copy ? 'npc' : canon(b.driver) === me ? 'you' : 'npc';
        const sheetable = !!body && (taken.has(personaKey(body)) || (!!map[personaKey(body)]?.sheet && !names.has(personaKey(body))));
        const row = { body: b.body, pronouns: b.pronouns, driver: b.driver, driver_pronouns: b.driver_pronouns, how: b.how, host: b.host, notes: b.notes, doing: b.doing, user_knows: b.user_knows };
        return {
            i, row, title: body || b.driver, kind, sheetable,
            hidden: b.user_knows === 'no' && !!body && !!b.driver,
            icon: copy ? 'clone' : { you: 'user', npc: 'ghost', idle: 'user-slash', mind: 'wind' }[kind],
            inside: copy ? `a copy of ${canon(b.driver) === me ? 'you' : b.driver}`
                : { you: "you're inside", npc: canon(body) === me ? `${b.driver} is in you` : `${b.driver} inside`, idle: 'empty', mind: 'no body' }[kind],
            ...(body && !names.has(personaKey(body)) ? host(body, kind) : { sheet: null, face: faceFor(c, body || b.driver) }),
        };
    });
    const back = hostsBack(c, ledger, c.msgs.length).map(e => ({ body: e.body, ...host(e.body, 'back') }));
    const shown = new Set([...inLedger, ...back.map(e => personaKey(e.body))]);
    const past = Object.values(map).filter(e => e.sheet && !shown.has(personaKey(e.body)))
        .sort((a, b) => a.body.localeCompare(b.body)).map(e => ({ body: e.body, ...host(e.body, 'idle') }));
    const history = historyGroups(bodyHistory(ledgerSnapshots(c))).map(g => ({
        title: `${g.driver} in ${g.bodies.join(', ')} · ${g.ended === 1 ? 'once' : g.ended === 2 ? 'twice' : `${g.ended}×`}${g.ongoing ? ', again now' : ''}`,
        lines: [g.notes.remembers ? ['Remembers', g.notes.remembers] : g.host ? ['Their mind', g.host] : null,
            g.notes.kept ? ['Kept', g.notes.kept] : null, g.notes.left ? ['Left behind', g.notes.left] : null].filter(Boolean),
        hidden: g.user_knows === 'no', ongoing: g.ongoing,
    }));
    return {
        bodies, back, past, history, powers: ledger.powers, aliases: ledger.aliases,
        ...missingPictures([...bodies.map(b => [b.title, b.face]), ...back.map(h => [h.body, h.face]), ...past.map(h => [h.body, h.face])]),
        empty: ledgerWanted(s, c) ? 'Everyone is in their own body.' : 'The Ledger is off: switch on Body Ledger & Mind Book under Settings → Choices, and pick a body mode.',
    };
}

let batch = null;   // "Draw missing pictures": { done, total } while it runs
export const setBatch = b => { batch = b; };
function missingPictures(faces) {
    const names = [...new Map(faces.filter(([, f]) => f?.open && !f.image).map(([n]) => [personaKey(n), n])).values()];
    return { missing: names, batch: batch ? `Drawing ${Math.min(batch.done + 1, batch.total)} of ${batch.total}…` : '' };
}

export function mindViewData(c) {
    const book = normalizeBook(headMind(c)?.book || EMPTY_BOOK);
    const me = c.userName.toLowerCase();
    const isMe = n => !!n && n.toLowerCase() === me;
    const kind = by => (isMe(by) ? 'you' : 'npc');
    const label = n => (isMe(n) ? 'you' : n);
    const hypnosis = book.hypnosis.map(h => [h.who, faceFor(c, h.who)]);
    const control = book.control.map(w => [w.who[0], faceFor(c, w.who[0])]);
    return {
        ...missingPictures([...hypnosis, ...control]),
        kinds: [...new Set([...mindKinds(c), ...MIND_KINDS.filter(k => book[k].length)])],
        hypnosis: book.hypnosis.map((h, i) => ({
            i, raw: h, who: h.who, kind: kind(h.by), by: h.by, byLabel: label(h.by), susceptibility: h.susceptibility, times: h.times,
            amnesia: h.amnesia === 'yes', hidden: h.user_knows === 'no', now: h.now || 'awake', deepest: h.deepest,
            suggestions: h.suggestions.map(x => ({ text: x.text, stage: x.stage, reinforced: x.times > 1 })), triggers: h.triggers,
            face: faceFor(c, h.who),
        })),
        control: book.control.map((w, i) => ({
            i, raw: w, who: w.who, kind: kind(w.by), by: w.by, byLabel: label(w.by), resists: w.resists === 'yes', hidden: w.user_knows === 'no', set: w.set, own: w.own,
            face: faceFor(c, w.who[0]),
        })),
        perception: book.perception.map((e, i) => {
            const who = e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(', ')}` : ''}` : e.who.join(', ');
            return {
                i, raw: e, kind: kind(e.by), by: e.by, byLabel: label(e.by), hidden: e.user_knows === 'no', what: e.what,
                icon: e.kind === 'unseen' ? 'eye-slash' : e.kind === 'false' ? 'masks-theater' : 'wand-magic-sparkles',
                title: e.kind === 'unseen' ? `${who} can't perceive ${label(e.target)}` : e.kind === 'false' ? `${who}: a false belief` : `${who}: an altered normal`,
            };
        }),
        empty: 'Pick Hypnosis, Mind Control or Altered Perception for this character to start a Mind Book.',
    };
}

export function pictureViewData(c, name, kind = 'idle') {
    const { look, fromSheet } = lookOf(c, name);
    return { name, image: imageUrl(pictureOf(c, name)).replace('?size=sm', ''), look, lookFromSheet: fromSheet, busy: drawingNow.get(`pic:${c.chatId}|${personaKey(name)}`) || '', kind };
}

// ------------------------------------------------------------------ everything at once

export function stateFor(c, s, extra = {}) {
    const st = statusOf(c?.chatId);
    const base = {
        type: 'state', chatId: c?.chatId || null, on: on(s),
        settings: { enabled: s.enabled, ledger: s.ledger, pictures: s.pictures },
        status: { ledger: st.ledger || '', checks: st.checks || '', timing: st.timing || '' },
        ...extra,
    };
    if (!c) return { ...base, target: null };
    const t = target(c);
    const builder = !!c.character?.extensions?.worldhopper?.tool;
    const ledger = headLedger(c)?.ledger;
    const book = headMind(c)?.book;
    const bodiesOn = ledgerWanted(s, c);
    const mindOn = mindWanted(s, c);
    const colours = laneColours(c);
    const roster = bodiesOn && ledger ? rosterOf(ledger, c.userName) : [];
    const sug = t ? s.suggested[t.key] : null;
    const counts = backfillCounts(c);
    return {
        ...base,
        target: t && { key: t.key, label: t.label, group: !!t.group, builder, characterId: c.character?.id || null },
        picks: c.picks,
        modes: c.modes,
        blurbs: MODE_BLURBS,
        suggestion: on(s) && !c.picks.length && Array.isArray(sug) && sug.length ? sug : null,
        showLedgerCard: on(s) && bodyModes(c),
        showMindCard: on(s) && mindKinds(c).length > 0,
        ledgerEnabled: s.ledger.enabled,
        panel: {
            ledgerRows: ledgerRows(c, ledger),
            extra: [
                ledger?.powers?.length ? `Powers: ${ledger.powers.map(p => `${p.who} (${p.power})`).join(', ')}` : '',
                ledger?.aliases?.length ? `Also known as: ${ledger.aliases.map(a => [a.name, ...a.aka].join(' = ')).join('; ')}` : '',
            ].filter(Boolean),
            ledgerEmpty: ledgerWanted(s, c) ? 'Everyone is in their own body.' : 'Off: switch on Body Ledger & Mind Book under Settings → Choices.',
            historyRows: historyRows(c),
            mindRows: mindRows(c, book),
            mindEmpty: isEmptyBook(book) ? (s.ledger.enabled
                ? 'Nothing yet. It fills in when someone is hypnotized, controlled, or has their perception changed. Tap ✏️ to add something yourself.'
                : 'The Mind Book is off with the Body Ledger (Settings → Choices).') : '',
        },
        strip: { show: bodiesOn && !!c.msgs.length && (!!ledger?.bodies?.length || !!st.ledgerBusy), chips: stripChips(c, ledger), busy: !!st.ledgerBusy },
        mindStrip: { show: mindOn && !!c.msgs.length && (!isEmptyBook(book) || !!st.mindBusy), chips: mindChips(c, book), busy: !!st.mindBusy },
        roster: {
            show: roster.length > 0,
            compact: roster.length > 6 || !!s.ledger.lanesCompact,
            big: roster.length > 6,
            cards: roster.map(r => ({ name: r.name, own: !!r.own, doing: r.doing || '', notes: r.notes || '', hue: laneHue(colours, r.name) })),
        },
        laneHues: Object.fromEntries([...colours.keys()].map(k => [k, laneHue(colours, k)])),
        badges: s.ledger.enabled ? badges(c) : [],
        edited: c.msgs.filter(m => m.wh?.edit).map(m => ({ messageId: m.id, original: m.text === m.wh.edit.original })),
        backfill: { running: backfillRunning(c.chatId), all: counts.all.length, recent: counts.recent.length },
        views: { ledger: ledgerViewData(c, s), mind: mindViewData(c) },
    };
}
