// Worldhopper Engine for Lumiverse — the work after each reply, ported from the SillyTavern Engine's index.js:
//   Ledger:   a Body Ledger (who is driving which body, the owner's state, powers) updated after each reply and kept
//             on the reply, so swipes and deletes roll it back. Body History is derived from those snapshots, plus a
//             short note per ended ride (what the owner remembers, what was kept, what it left behind).
//   Checks:   after the Ledger update, a pronoun check and a cut-only body-rules pass against it. The original is
//             kept; ⟲ on the message toggles back.
//   Mind:     the Mind Book (mind-core.js): what Hypnosis, Mind Control and Altered Perception have put into people,
//             one record per mode, updated only on replies that need it.
//   Hosts:    a short sheet per body someone else has taken (who its owner is in their own life), and pictures.
// Every job runs through one queue, so the model requests never overlap, and the next reply waits (briefly) for the
// Ledger to catch up.
import { looksLikeRoleplay } from '../core/text-core.js';
import {
    EMPTY_LEDGER, normalizeLedger, buildLedgerMessages, parseLedger, parseLedgerUpdate, verifyNewRides, verifyEndedRides,
    aliasResolver, personNamedIn, labelMultiRides, tracksBodies,
    hasCrossedBodies, needsPronounCheck, buildPronounMessages, parsePronounResponse, applyPronounFixes, buildLintMessages, parseLintResponse, applyCuts,
    endedRides, bodyHistory, buildHistoryMessages, parseHistoryResponse,
} from '../core/ledger-core.js';
import { MIND_MODES, KINDS as MIND_KINDS, EMPTY_BOOK, normalizeBook, needsUpdate, buildMindMessages, applyMindUpdate, trappedSelfCuts, resistanceSetUp } from '../core/mind-core.js';
import { describesMinor, buildPersonaMessages, parsePersona, personaKey, buildLookMessages, parseLook, portraitPrompt } from '../core/persona-core.js';
import { sp, user, log, warn, settings, on, loadChat, writeSnap, headSnap, ask, cardText, saveChatState, seen, seenText } from './host.js';

export const SCENE_MESSAGES = 4;   // who is "in the scene": named in this many of the latest messages
export const RECENT_REPLIES = 30;  // "Build history" can read just this many of the latest replies instead of the whole chat
const LEDGER_WAIT_MS = 8000;

// ------------------------------------------------------------------ chat helpers

export const inStory = m => !!m && !m.system && !!m.text;
export const isReply = m => inStory(m) && !m.isUser;
export const speakerName = (c, m) => (m.isUser ? c.userName : (m.name || c.charName || 'Narrator'));
const say = c => m => ({ name: speakerName(c, m), text: m.text });
export const same = (a, b) => personaKey(a) === personaKey(b);
const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function headLedger(c, before) {
    const h = headSnap(c, 'ledger', before);
    return h ? { ledger: normalizeLedger(h.value), index: h.index } : null;
}
export function headMind(c, before) {
    const h = headSnap(c, 'mind', before);
    return h ? { book: normalizeBook(h.value), index: h.index } : null;
}
export function lastReplyIndex(c) {
    for (let i = c.msgs.length - 1; i >= 0; i--) if (isReply(c.msgs[i])) return i;
    return -1;
}

export const bodyModes = c => tracksBodies(c.modes);
export const ledgerWanted = (s, c) => on(s) && s.ledger.enabled && bodyModes(c);
export const mindKinds = c => MIND_KINDS.filter(k => c.modes.includes(MIND_MODES[k]));
export const mindWanted = (s, c) => on(s) && s.ledger.enabled && mindKinds(c).length > 0;

/** Names that have a card of their own here: you, the character, group members. Their sheets and pictures come from it. */
export function cardNames(c) {
    return new Set([c.userName, ...c.members.map(m => m.name)].filter(Boolean).map(personaKey));
}
export const cardCharacter = (c, name) => c.members.find(ch => same(ch.name, name)) || null;

/** Ledger rows for bodies someone else is driving right now, minus the ones with a card of their own. */
export function takenBodies(c, ledger) {
    const skip = cardNames(c);
    return (ledger?.bodies || []).filter(b => b.body && b.driver && b.body.toLowerCase() !== 'none' && !skip.has(personaKey(b.body)));
}

/** Ledger snapshots (with any history notes) on messages before `before`, in chat order. */
export function ledgerSnapshots(c, before) {
    const snaps = [];
    for (let i = 0; i < Math.min(before ?? c.msgs.length, c.msgs.length); i++) {
        const w = c.msgs[i].wh;
        if (w?.ledger) snaps.push({ index: i, ledger: w.ledger, notes: w.history });
    }
    return snaps;
}

// ------------------------------------------------------------------ status, busy flags, and the push to the panel

const chatStatus = new Map();   // chatId → { ledger, checks, timing, ledgerBusy, mindBusy }
export const statusOf = chatId => (chatStatus.has(chatId) ? chatStatus.get(chatId) : chatStatus.set(chatId, {}).get(chatId));
let notifier = () => {};
export const onChange = fn => { notifier = fn; };
export const notify = chatId => { try { notifier(chatId); } catch (err) { warn('notify', err); } };
export function setStatus(chatId, field, text) {
    statusOf(chatId)[field] = text;
    log(text);
    notify(chatId);
}
const busy = (chatId, field, v) => { statusOf(chatId)[field] = v; notify(chatId); };
/** Why a model call failed, short: "no model picked" when none is, else the error itself. */
const unreachable = (label, err) => (!label ? 'no model picked (Settings → Models)' : `couldn't reach the ${label} model${err?.message ? ` (${String(err.message).slice(0, 140)})` : ''}`);

// One queue for the per-reply jobs, so their requests never overlap. ledgerReady resolves once the Ledger has caught up
// with the latest reply in that chat; the next generation waits on it, for at most LEDGER_WAIT_MS.
let queue = Promise.resolve();
export const enqueue = fn => (queue = queue.then(fn).catch(err => warn(err)));
const ready = new Map();
function hold(chatId) {
    let done;
    ready.set(chatId, new Promise(r => (done = r)));
    return () => done();
}
export async function waitForLedger(chatId) {
    const p = ready.get(chatId);
    if (!p) return 0;
    const t0 = Date.now();
    await Promise.race([p, new Promise(r => setTimeout(r, LEDGER_WAIT_MS))]);
    return Date.now() - t0;
}

// ------------------------------------------------------------------ Body Ledger

export async function updateLedger(c, mesId, { rebuild = false } = {}) {
    const fail = { ok: false, ended: [] };
    const msg = c.msgs[mesId];
    if (!msg) return fail;
    seen(msg.id, msg.text);
    const base = rebuild ? null : headLedger(c, mesId);
    const from = base ? base.index + 1 : Math.max(0, mesId - 7);
    const msgs = c.msgs.slice(Math.max(from, mesId - 5), mesId + 1).filter(inStory).map(say(c));
    // The exchange the ledger already reflects, so the model knows who "you" is and who was where before.
    const context = base ? c.msgs.slice(Math.max(0, base.index - 1), base.index + 1).filter(inStory).map(say(c)) : [];
    const first = !base;
    const userName = c.userName;
    const modes = c.modes;
    const messages = buildLedgerMessages({
        ledger: base?.ledger || EMPTY_LEDGER,
        messages: msgs,
        context,
        userName,
        modes,
        card: first && c.character ? cardText(c.character) : '',
        persona: first ? c.persona?.description || '' : '',
        update: !first,   // after the first build, only the changes: faster, and it tracks better
    });
    const t0 = Date.now();
    const askLedger = (m, max) => ask('ledger', m, max, 0.1);
    let text;
    try { text = await ask('ledger', messages, 900, 0.1); } catch (err) { setStatus(c.chatId, 'ledger', `Ledger: ${unreachable(err.message.includes('no model') ? '' : 'Ledger', err)}.`); warn(err); return fail; }
    let next = first ? parseLedger(text) : parseLedgerUpdate(text, base.ledger);
    if (!next) { setStatus(c.chatId, 'ledger', 'Ledger: the model\'s answer was unreadable; kept the previous ledger.'); return fail; }
    if (!first) {
        // Every new body change gets a second look before it's kept, and every body that left gets one too.
        try { next = (await verifyNewRides(base.ledger, next, { messages: msgs, context, userName, modes }, askLedger)).ledger; } catch { /* a filter: keep the update */ }
        try { next = (await verifyEndedRides(base.ledger, next, { messages: msgs, context, userName, modes }, askLedger)).ledger; } catch { /* as above */ }
    }
    next = labelMultiRides(next, modes);
    await writeSnap(c, msg, { ledger: normalizeLedger(next) });
    const ms = Date.now() - t0;
    setStatus(c.chatId, 'ledger', `Ledger updated (${(ms / 1000).toFixed(1)}s).`);
    return { ok: true, ms, ended: rebuild ? [] : endedRides(base?.ledger || EMPTY_LEDGER, next) };
}

/** Ask the notes model what the ended body changes left behind, and keep the answer on the reply. */
export async function noteEndedRides(c, mesId, ended) {
    const msgs = c.msgs.slice(Math.max(0, mesId - 5), mesId + 1).filter(inStory).map(say(c));
    let text;
    try { text = await ask('notes', buildHistoryMessages(ended, msgs), 2000, 0.1); } catch (err) { setStatus(c.chatId, 'ledger', `History note skipped: ${unreachable('notes', err)}.`); warn(err); return; }
    const notes = parseHistoryResponse(text, ended);
    const msg = c.msgs[mesId];
    if (!notes.length || !msg) return;
    await writeSnap(c, msg, { history: notes });
    notify(c.chatId);
}

// One-time walk over an older chat: a ledger snapshot for every reply that has none. Replies that already have one
// are skipped, and a long chat can do just its latest replies. Calling it again stops it.
const backfills = new Map();
export function backfillCounts(c) {
    const all = c.msgs.map((m, i) => (isReply(m) && !m.wh?.ledger ? i : -1)).filter(i => i >= 0);
    const replies = c.msgs.map((m, i) => (isReply(m) ? i : -1)).filter(i => i >= 0);
    const cutoff = replies[Math.max(0, replies.length - RECENT_REPLIES)] ?? 0;
    return { all, recent: all.filter(i => i >= cutoff) };
}
export const backfillRunning = chatId => backfills.has(chatId);
export function stopBackfill(chatId) { const j = backfills.get(chatId); if (j) j.stop = true; }
export async function backfill(chatId, which = 'recent') {
    if (backfills.has(chatId)) return;
    const job = { stop: false };
    backfills.set(chatId, job);
    notify(chatId);
    let done = 0, endings = 0, total = 0;
    await enqueue(async () => {
        try {
            const first = await loadChat(chatId);
            const { all, recent } = backfillCounts(first);
            const ids = (which === 'all' ? all : recent).map(i => first.msgs[i].id);
            total = ids.length;
            for (const id of ids) {
                if (job.stop) break;
                const c = await loadChat(chatId);
                const i = c.msgs.findIndex(m => m.id === id);
                if (i < 0) continue;
                const r = await updateLedger(c, i);
                if (!r.ok) continue;
                done++;
                if (r.ended.length) { endings++; await noteEndedRides(c, i, r.ended); }
                setStatus(chatId, 'ledger', `Building history: ${done} of ${total} replies…`);
            }
        } finally {
            backfills.delete(chatId);
            setStatus(chatId, 'ledger', `${job.stop ? 'Stopped' : 'Done'}: ${done} replies read, ${endings} ended body change${endings === 1 ? '' : 's'} found.`);
        }
    });
}

// ------------------------------------------------------------------ host sheets

const personaJobs = new Set();
/** Writes a sheet for every taken body that has none yet. */
export async function ensurePersonas(chatId) {
    const s = await settings();
    let c = await loadChat(chatId);
    if (!c || !ledgerWanted(s, c) || !s.ledger.connection) return;
    const head = headLedger(c);
    if (!head) return;
    // A sheet deleted while its body was taken stays deleted for that ride only.
    const map = c.state.personas;
    const taken = new Set(takenBodies(c, head.ledger).map(b => personaKey(b.body)));
    const over = Object.keys(map).filter(k => map[k]?.removed && !taken.has(k));
    if (over.length) { for (const k of over) delete map[k]; await saveChatState(chatId); }
    for (const row of takenBodies(c, head.ledger)) {
        const id = `${chatId}|${personaKey(row.body)}`;
        if (map[personaKey(row.body)] || personaJobs.has(id)) continue;
        personaJobs.add(id);
        try { await writePersona(c, row); } finally { personaJobs.delete(id); }
        c = await loadChat(chatId);
    }
}

export async function writePersona(c, row) {
    const chat = c.msgs.filter(inStory);
    const name = row.body;
    const named = new RegExp(`\\b${reEsc(name)}\\b`, 'i');
    // The latest messages, plus the last few that name the body even if they're further back.
    const picked = new Set([...chat.filter(m => named.test(m.text)).slice(-6), ...chat.slice(-10)]);
    const msgs = chat.filter(m => picked.has(m)).slice(-14).map(say(c));
    setStatus(c.chatId, 'ledger', `Writing a host persona for ${name}…`);
    let text;
    try {
        text = await ask('notes', buildPersonaMessages({ body: name, row, card: c.character ? cardText(c.character) : '', messages: msgs, userName: c.userName }), 2000, 0.4);
    } catch (err) { setStatus(c.chatId, 'ledger', `Host persona for ${name} skipped: ${unreachable('notes', err)}.`); return; }
    const sheet = parsePersona(text);
    if (!sheet) { setStatus(c.chatId, 'ledger', describesMinor(text) ? `Host persona for ${name} not kept: it described them as a minor.` : `Host persona for ${name}: the model's answer was unreadable.`); return; }
    await setSheet(c, name, sheet);
    setStatus(c.chatId, 'ledger', `Host persona written for ${name}.`);
}

/**
 * Sets a host's sheet, or deletes it (null). A sheet deleted while someone is still in the body leaves a mark, so no new
 * one is written after the next reply; the next time that person is taken, they get a fresh one.
 */
export async function setSheet(c, name, sheet, { taken = false } = {}) {
    const map = c.state.personas;
    const k = personaKey(name);
    const prev = map[k];
    if (sheet) map[k] = { body: name, sheet, at: Date.now() };
    else if (prev?.sheet && taken) map[k] = { body: prev.body, removed: true, at: Date.now() };
    else delete map[k];
    await saveChatState(c.chatId);
    notify(c.chatId);
}

/** A body renamed takes its sheet and its picture along, unless the new name already has one. */
export function movePerson(c, from, to) {
    for (const store of [c.state.personas, c.state.pictures]) {
        const a = personaKey(from), b = personaKey(to);
        if (a === b || !store[a] || store[b]) continue;
        store[b] = { ...store[a], ...('body' in store[a] ? { body: to } : { name: to }) };
        delete store[a];
    }
}

/** Hosts released but still in the scene (named in the last few messages before limit): the model plays them again. */
export function hostsBack(c, ledger, limit) {
    const taken = new Set((ledger?.bodies || []).filter(b => b.body).map(b => personaKey(b.body)));
    const skip = cardNames(c);
    const recent = c.msgs.slice(Math.max(0, limit - SCENE_MESSAGES), limit).filter(inStory).map(m => m.text).join('\n');
    return Object.values(c.state.personas).filter(e => e.sheet && !taken.has(personaKey(e.body)) && !skip.has(personaKey(e.body)) && personNamedIn(recent, [e.body]));
}

// ------------------------------------------------------------------ pictures

// A picture for anyone in the Ledger or the Mind Book without a card of their own, drawn through one of Lumiverse's
// image connections. Drawn when you tap someone's face, or on their own with "Draw pictures on their own". Drawn
// from a look: a host's sheet has one; anyone else gets one written by the notes model, or typed by you.
export const pictureOf = (c, name) => c.state.pictures[personaKey(name)]?.image || '';
export function lookOf(c, name) {
    const fromSheet = c.state.personas[personaKey(name)]?.sheet?.Look;
    return fromSheet ? { look: fromSheet, fromSheet: true } : { look: c.state.pictures[personaKey(name)]?.look || '', fromSheet: false };
}

export async function setPicture(c, name, imageId) {
    const map = c.state.pictures;
    const k = personaKey(name);
    const old = map[k]?.image;
    map[k] = { ...(map[k] || {}), name };
    if (imageId) { map[k].image = imageId; delete map[k].keepEmpty; } else { delete map[k].image; map[k].keepEmpty = true; }
    await saveChatState(c.chatId);
    notify(c.chatId);
    if (old && old !== imageId) { try { await sp.images.delete(old, user()); } catch { /* already gone */ } }
}

export async function writeLook(c, name) {
    if (!(await settings()).ledger.connection) { setStatus(c.chatId, 'ledger', `Picture of ${name}: write their look first, or pick a model under Settings → Models.`); return ''; }
    const chat = c.msgs.filter(inStory);
    const named = new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(name)}(?![\\p{L}\\p{N}])`, 'iu');
    const picked = new Set([...chat.filter(m => named.test(m.text)).slice(-6), ...chat.slice(-6)]);
    const msgs = chat.filter(m => picked.has(m)).slice(-10).map(say(c));
    setStatus(c.chatId, 'ledger', `Describing ${name} for their picture…`);
    let text;
    try { text = await ask('notes', buildLookMessages({ name, card: c.character ? cardText(c.character) : '', messages: msgs, userName: c.userName }), 1200, 0.4); } catch (err) { setStatus(c.chatId, 'ledger', `Picture of ${name} skipped: ${unreachable('notes', err)}.`); return ''; }
    const look = parseLook(text, name);
    if (!look) { setStatus(c.chatId, 'ledger', describesMinor(text) ? `Picture of ${name} not drawn: the look described them as a minor.` : `Picture of ${name}: the model's answer was unreadable.`); return ''; }
    const k = personaKey(name);
    c.state.pictures[k] = { ...(c.state.pictures[k] || {}), name, look };
    await saveChatState(c.chatId);
    return look;
}

/** The image connection pictures use: the one picked under Settings → Pictures, else the one Image Generation uses. */
async function imageConnection() {
    const p = (await settings()).pictures;
    if (p.connection) return p.connection;
    try {
        const list = await sp.imageGen.listConnections(user());
        return (list.find(x => x.is_default) || list[0])?.id || '';
    } catch { return ''; }
}

// One picture at a time.
let drawing = Promise.resolve();
export function drawPicture(chatId, name) {
    const run = drawing.then(() => drawNow(chatId, name));
    drawing = run.catch(() => {});
    return run;
}
async function drawNow(chatId, name) {
    let c = await loadChat(chatId);
    const look = lookOf(c, name).look || await writeLook(c, name);
    if (!look) return;
    const connection = await imageConnection();
    if (!connection) { setStatus(chatId, 'ledger', `Picture of ${name}: no image connection. Add one under Connections → Image Generation.`); return; }
    const p = (await settings()).pictures;
    setStatus(chatId, 'ledger', `Drawing ${name}…`);
    let res;
    try {
        res = await sp.imageGen.generate({
            connection_id: connection,
            prompt: [p.style, portraitPrompt(look, name)].filter(Boolean).join(' '),
            ...(p.negative ? { negativePrompt: p.negative } : {}),
            // A workflow's seed is filled only when one is sent (Image Generation sends its own).
            parameters: { seed: Math.floor(Math.random() * 2147483647) },
            owner_chat_id: chatId,
            userId: user(),
        });
    } catch (err) { setStatus(chatId, 'ledger', `Picture of ${name}: ${String(err.message || err).slice(0, 160)}.`); return; }
    let id = res?.imageId || '';
    if (!id && res?.imageDataUrl) { try { id = (await sp.images.uploadFromDataUrl(res.imageDataUrl, { originalFilename: `${personaKey(name)}.png`, userId: user() }))?.id || ''; } catch { /* below */ } }
    if (!id) { setStatus(chatId, 'ledger', `Picture of ${name}: the image connection returned nothing.`); return; }
    c = await loadChat(chatId);
    await setPicture(c, name, id);
    setStatus(chatId, 'ledger', `Picture drawn for ${name}.`);
}

const pictureTried = new Set();   // `${chat}|${person}`: drawn on its own once a session, so a failing source isn't hit every reply
export const drawingNow = new Map();   // 'pic:<chat>|<person>' or 'sheet:<chat>|<person>' → what's being done
/** With "Draw pictures on their own" on: a picture for each host with a sheet, and each person in the Mind Book. */
export async function ensurePictures(chatId) {
    const s = await settings();
    if (!on(s) || !s.pictures.auto) return;
    const c = await loadChat(chatId);
    const people = [];
    if (ledgerWanted(s, c)) for (const b of takenBodies(c, headLedger(c)?.ledger)) if (c.state.personas[personaKey(b.body)]?.sheet) people.push(b.body);
    if (mindWanted(s, c)) {
        const book = headMind(c)?.book;
        for (const h of book?.hypnosis || []) people.push(h.who);
        for (const w of book?.control || []) people.push(...w.who);
    }
    const skip = cardNames(c);
    for (const name of people) {
        const k = personaKey(name);
        const id = `${chatId}|${k}`;
        if (!k || skip.has(k) || pictureOf(c, name) || c.state.pictures[k]?.keepEmpty || pictureTried.has(id) || drawingNow.has(`pic:${id}`)) continue;
        pictureTried.add(id);
        await busyWork(`pic:${id}`, 'Drawing…', chatId, () => drawPicture(chatId, name));
    }
}
export async function busyWork(key, label, chatId, job) {
    if (drawingNow.has(key)) return;
    drawingNow.set(key, label);
    notify(chatId);
    try { await job(); } finally { drawingNow.delete(key); notify(chatId); }
}

// ------------------------------------------------------------------ Mind Book

/**
 * Update each picked mind mode's record from the newest messages, one small prompt per mode, and only for the modes
 * the messages give something to do. The first update in a chat reads the card and runs every picked mode.
 */
export async function updateMind(c, mesId) {
    const kinds = mindKinds(c);
    const msg = c.msgs[mesId];
    if (!kinds.length || !msg) return null;
    seen(msg.id, msg.text);
    const base = headMind(c, mesId);
    const first = !base;
    const from = base ? base.index + 1 : Math.max(0, mesId - 5);
    const msgs = c.msgs.slice(Math.max(from, mesId - 5), mesId + 1).filter(inStory).map(say(c));
    const context = base ? c.msgs.slice(Math.max(0, base.index - 1), base.index + 1).filter(inStory).map(say(c)) : [];
    const text = msgs.map(m => m.text).join('\n');
    const card = first && c.character ? cardText(c.character) : '';
    let book = base?.book || EMPTY_BOOK;
    let ran = 0;
    const t0 = Date.now();
    try {
        for (const kind of kinds) {
            if (!first && !needsUpdate(kind, book, text)) continue;
            if (!statusOf(c.chatId).mindBusy) busy(c.chatId, 'mindBusy', true);
            let answer;
            try { answer = await ask('ledger', buildMindMessages(kind, { book, messages: msgs, context, userName: c.userName, card }), 700, 0.1); } catch (err) { setStatus(c.chatId, 'ledger', `Mind Book: ${unreachable('Ledger', err)}.`); return null; }
            ran++;
            const next = applyMindUpdate(kind, book, answer);
            if (next) book = next; else warn(`Mind Book (${kind}): unreadable answer`);
        }
    } finally {
        if (statusOf(c.chatId).mindBusy) busy(c.chatId, 'mindBusy', false);
    }
    if (!ran) return null;
    if (first || JSON.stringify(book) !== JSON.stringify(base.book)) await writeSnap(c, msg, { mind: normalizeBook(book) });
    notify(c.chatId);
    return { ms: Date.now() - t0, ran };
}

// ------------------------------------------------------------------ checks on a reply

/** One record per reply: the text before anything changed it, and the text now, so ⟲ goes all the way back. */
function editRecord(prev, before, after, applied) {
    return prev && prev.edited === before
        ? { original: prev.original, edited: after, applied: [...(prev.applied || []), ...applied], at: Date.now() }
        : { original: before, edited: after, applied, at: Date.now() };
}


/** Writes a fixed reply, if the reply is still what was checked (same swipe, same text). */
async function applyFix(chatId, messageId, original, text, applied) {
    const c = await loadChat(chatId);
    const msg = c?.msgs.find(m => m.id === messageId);
    if (!msg || msg.text !== original) return false;
    seen(messageId, text);
    await writeSnap(c, msg, { edit: editRecord(msg.wh?.edit, original, text, applied) }, { content: text });
    return true;
}

/**
 * The Ledger's two checks on a reply, whenever it has someone in another body: pronouns for a body and for the mind
 * inside it, then cut-only body rules. Returns the time taken in ms, or null when there was nothing to check.
 */
export async function runBodyChecks(c, mesId) {
    const head = headLedger(c, mesId + 1);
    if (!head || !hasCrossedBodies(head.ledger)) return null;
    const pronouns = needsPronounCheck(head.ledger);
    if (!pronouns && !head.ledger.bodies.some(b => b.user_knows === 'no' && b.body && b.driver)) return null;
    const msg = c.msgs[mesId];
    if (!msg || msg.isUser || msg.system || !msg.text || !looksLikeRoleplay(msg.text)) return null;
    const t0 = Date.now();
    const original = msg.text;
    let text = original;
    const applied = [];
    if (pronouns) {
        try {
            const out = applyPronounFixes(text, parsePronounResponse(await ask('ledger', buildPronounMessages(text, head.ledger), 500, 0.1)), head.ledger);
            text = out.text;
            applied.push(...out.applied.map(a => ({ action: 'PRONOUN', ...a })));
        } catch { /* the cuts can still run */ }
    }
    try {
        const out = applyCuts(text, parseLintResponse(await ask('ledger', buildLintMessages(text, head.ledger, c.userName), 500, 0.1)));
        text = out.text;
        applied.push(...out.applied);
    } catch { /* the pronoun fixes still stand */ }
    const ms = Date.now() - t0;
    if (!applied.length) { setStatus(c.chatId, 'checks', 'Body checks: nothing to fix.'); return ms; }
    if (!(await applyFix(c.chatId, msg.id, original, text, applied))) { setStatus(c.chatId, 'checks', 'Body checks: the reply changed while it was being checked, so nothing was applied.'); return ms; }
    setStatus(c.chatId, 'checks', `Body checks: ${applied.length} fix${applied.length > 1 ? 'es' : ''}. ⟲ on the reply restores the original.`);
    return ms;
}

/**
 * Mind Control has no trapped self: cut sentences that write one (no model), unless a struggle has been set up, by the
 * card, by your newest message, or in play (a will the Mind Book records as resisting).
 */
export async function runMindCuts(c, mesId) {
    if (!mindKinds(c).includes('control')) return;
    if (resistanceSetUp(c.character ? cardText(c.character) : '')) return;
    let lastUser = '';
    for (let i = mesId - 1; i >= 0; i--) if (c.msgs[i]?.isUser) { lastUser = c.msgs[i].text; break; }
    if (resistanceSetUp(lastUser)) return;
    if (headMind(c, mesId + 1)?.book.control.some(w => w.resists === 'yes')) return;
    const msg = c.msgs[mesId];
    if (!msg || msg.isUser || msg.system || !msg.text || !looksLikeRoleplay(msg.text)) return;
    const original = msg.text;
    const cuts = trappedSelfCuts(original);
    if (!cuts.length) return;
    const out = applyCuts(original, cuts);
    if (!out.applied.length) return;
    if (await applyFix(c.chatId, msg.id, original, out.text, out.applied.map(a => ({ ...a, why: 'trapped self under mind control' })))) {
        setStatus(c.chatId, 'checks', `Mind control: cut ${out.applied.length} line${out.applied.length > 1 ? 's' : ''} writing a trapped self. ⟲ restores the original.`);
    }
}

/** ⟲: the reply as it came, or with the fixes again. */
export async function toggleEdit(chatId, messageId) {
    const c = await loadChat(chatId);
    const msg = c?.msgs.find(m => m.id === messageId);
    const rec = msg?.wh?.edit;
    if (!rec) return 'none';
    let next;
    if (msg.text === rec.edited) next = rec.original;
    else if (msg.text === rec.original) next = rec.edited;
    else return 'changed';
    seen(messageId, next);
    await writeSnap(c, msg, {}, { content: next });
    notify(chatId);
    return next === rec.original ? 'original' : 'fixed';
}

// ------------------------------------------------------------------ the pipeline

function noteTiming(chatId, t) {
    const s = x => `${(x / 1000).toFixed(1)}s`;
    const parts = [t.wait > 200 ? `waited ${s(t.wait)} for the ${t.ledger != null ? 'Ledger' : 'Mind Book'}` : '', t.ledger != null ? `Ledger ${s(t.ledger)}` : '', t.mind != null ? `Mind Book ${s(t.mind)}` : '', t.checks != null ? `body checks ${s(t.checks)}` : ''].filter(Boolean);
    if (parts.length) statusOf(chatId).timing = `Last turn: ${parts.join(' · ')}`;
}

const lastWait = new Map();
export const noteWait = (chatId, ms) => lastWait.set(chatId, ms);

/** After a reply lands: the Ledger, the Mind Book, the checks, then notes, sheets and pictures. */
export function onReply(chatId, messageId) {
    lastReread.set(messageId, Date.now());   // this run reads it; the host's own follow-up writes to it aren't edits
    const done = hold(chatId);
    const wait = lastWait.get(chatId) || 0;
    lastWait.delete(chatId);
    enqueue(async () => {
        const s = await settings();
        let ended = [];
        const timing = { wait };
        let c;
        try {
            c = await loadChat(chatId);
            if (!c || !on(s)) return;
            const mesId = c.msgs.findIndex(m => m.id === messageId);
            if (mesId < 0) return;
            if ((ledgerWanted(s, c) || mindWanted(s, c)) && !s.ledger.connection) { setStatus(chatId, 'ledger', `Ledger: ${unreachable('')}.`); return; }
            if (ledgerWanted(s, c)) {
                busy(chatId, 'ledgerBusy', true);
                const r = await updateLedger(c, mesId);
                ended = r.ended;
                if (r.ok) timing.ledger = r.ms;
            }
            if (mindWanted(s, c)) {
                const m = await updateMind(c, mesId);
                if (m) timing.mind = m.ms;
            }
        } finally {
            if (statusOf(chatId).ledgerBusy) busy(chatId, 'ledgerBusy', false);
            done();
        }
        if (!c) return;
        const mesId = c.msgs.findIndex(m => m.id === messageId);
        if (mesId < 0) return;
        if (ledgerWanted(s, c) && s.ledger.connection) {
            const checks = await runBodyChecks(c, mesId);
            if (checks != null) timing.checks = checks;
        }
        if (on(s)) await runMindCuts(await loadChat(chatId), mesId);
        noteTiming(chatId, timing);
        notify(chatId);
        // Notes, sheets and pictures come after the checks, so the reply is final and nothing waits on them. A separate
        // notes model runs alongside the queue; a shared one waits its turn.
        const shared = !s.ledger.notesConnection || (s.ledger.notesConnection === s.ledger.connection && s.ledger.notesModel === s.ledger.model);
        if (ended.length) {
            const notes = loadChat(chatId).then(c2 => noteEndedRides(c2, c2.msgs.findIndex(m => m.id === messageId), ended)).catch(err => warn(err));
            if (shared) await notes;
        }
        const sheets = ledgerWanted(s, c) ? ensurePersonas(chatId).catch(err => warn(err)) : Promise.resolve();
        sheets.then(() => ensurePictures(chatId)).catch(err => warn(err));
        if (shared) await sheets;
    });
}

// Editing the newest reply has the Ledger and the Mind Book read it again, so what they hold matches the page. Older
// replies aren't re-read: every snapshot after them was built on the old text.
const editTimers = new Map();
const lastReread = new Map();   // messageId → when it was last re-read: never more than once in 15 s, whatever fires
export function onEdited(chatId, messageId, content) {
    if (typeof content !== 'string' || seenText.get(messageId) === content) return;
    seen(messageId, content);
    if (Date.now() - (lastReread.get(messageId) || 0) < 15000) return;
    clearTimeout(editTimers.get(chatId));
    editTimers.set(chatId, setTimeout(() => rereadReply(chatId, messageId), 500));
}
async function rereadReply(chatId, messageId) {
    const s = await settings();
    const c0 = await loadChat(chatId);
    if (!c0 || !on(s) || !s.ledger.connection || (!ledgerWanted(s, c0) && !mindWanted(s, c0))) return;
    if (c0.msgs[lastReplyIndex(c0)]?.id !== messageId) return;
    lastReread.set(messageId, Date.now());
    const done = hold(chatId);
    enqueue(async () => {
        let ended = null;
        try {
            const c = await loadChat(chatId);
            const i = c.msgs.findIndex(m => m.id === messageId);
            if (i < 0 || i !== lastReplyIndex(c)) return;
            if (ledgerWanted(s, c)) {
                busy(chatId, 'ledgerBusy', true);
                const r = await updateLedger(c, i);
                if (r.ok) ended = r.ended;
            }
            if (mindWanted(s, c)) await updateMind(await loadChat(chatId), i);
        } finally {
            if (statusOf(chatId).ledgerBusy) busy(chatId, 'ledgerBusy', false);
            done();
        }
        // The history notes follow the re-read: new ones for what the edited reply ends, none if it ends nothing now.
        if (ended) {
            const c = await loadChat(chatId);
            const i = c.msgs.findIndex(m => m.id === messageId);
            if (i >= 0 && ended.length) await noteEndedRides(c, i, ended);
            else if (i >= 0 && c.msgs[i].wh?.history) await writeSnap(c, c.msgs[i], { history: undefined });
        }
        if (ledgerWanted(s, c0)) await ensurePersonas(chatId).catch(err => warn(err));
        ensurePictures(chatId).catch(err => warn(err));
        notify(chatId);
    });
}

// An update still running when the backend restarted, or a reply that came in while Worldhopper was off, leaves the
// newest reply without a Ledger entry. Opening the chat catches it up. The greeting alone is left for the first reply.
export async function catchUp(chatId) {
    const s = await settings();
    const c = await loadChat(chatId);
    if (!c || !ledgerWanted(s, c) || !s.ledger.connection) return;
    const i = lastReplyIndex(c);
    if (i <= 0 || c.msgs[i].wh?.ledger) return;
    const id = c.msgs[i].id;
    const done = hold(chatId);
    enqueue(async () => {
        try {
            const c2 = await loadChat(chatId);
            const j = c2.msgs.findIndex(m => m.id === id);
            if (j < 0 || c2.msgs[j].wh?.ledger) return;
            busy(chatId, 'ledgerBusy', true);
            await updateLedger(c2, j);
        } finally {
            if (statusOf(chatId).ledgerBusy) busy(chatId, 'ledgerBusy', false);
            done();
        }
    });
}

export function rebuildLedger(chatId) {
    setStatus(chatId, 'ledger', 'Rebuilding from the card and recent messages…');
    const done = hold(chatId);
    return enqueue(async () => {
        try {
            const c = await loadChat(chatId);
            const i = c.msgs.length - 1;
            if (i < 0) return;
            busy(chatId, 'ledgerBusy', true);
            await updateLedger(c, i, { rebuild: true });
        } finally {
            if (statusOf(chatId).ledgerBusy) busy(chatId, 'ledgerBusy', false);
            done();
        }
    });
}

export { aliasResolver };
