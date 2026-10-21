// Worldhopper Engine for Lumiverse — the host layer: the user this runs for, settings, per-chat state, loading a chat,
// and the per-message snapshots (the Ledger, the Mind Book, history notes, edits) kept on each reply.
import { expandModes } from '../core/codex-core.js';

export const sp = globalThis.spindle;
export const LOG = '[Worldhopper]';

// Lumiverse runs one backend per extension. A user-scoped install needs no user id; an operator-scoped one does, so
// the id from the latest event or frontend message is passed along wherever the API takes one.
let USER = null;
export const user = () => USER || undefined;
export const setUser = id => { if (id) USER = id; };

export const log = (...a) => { try { sp.log.info(`${LOG} ${a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}`); } catch { /* logging never breaks a job */ } };
export const warn = (...a) => { try { sp.log.warn(`${LOG} ${a.map(x => (typeof x === 'string' ? x : x?.message || JSON.stringify(x))).join(' ')}`); } catch { /* as above */ } };

// ------------------------------------------------------------------ settings

const DEFAULTS = {
    // Worldhopper on or off (the switch at the top of its panel). Off, nothing is added to prompts and no model runs;
    // what's already in the chat (moment boxes, badges, ⟲) still shows.
    enabled: true,
    // The background jobs' models: a connection, and optionally a model on it other than the one it's set to.
    // The Ledger runs after every reply, so a fast model suits it; notes need judgment, so a stronger one suits them.
    ledger: { enabled: true, lanesCompact: false, connection: '', model: '', notesConnection: '', notesModel: '' },
    // Pictures of people in the Ledger and the Mind Book, drawn with an image connection ('' = the one Image
    // Generation uses). auto draws them on their own; style is put before every picture's prompt.
    pictures: { auto: false, connection: '', style: '', negative: '' },
    groups: {},      // group chat id → its picked modes (a character's own picks live on its card)
    suggested: {},   // 'char:<id>' / 'group:<chat id>' → the modes suggested for it, once
    scripts: {},     // display script id → { id: Lumiverse's id for it, hash: the version installed }
};

let settingsCache = null;
let settingsUser = null;

function normalizeSettings(s) {
    const out = { ...DEFAULTS, ...(s || {}) };
    out.ledger = { ...DEFAULTS.ledger, ...(s?.ledger || {}) };
    out.pictures = { ...DEFAULTS.pictures, ...(s?.pictures || {}) };
    for (const k of ['groups', 'suggested', 'scripts']) out[k] = { ...(s?.[k] || {}) };
    return out;
}

export async function settings() {
    if (!settingsCache || settingsUser !== USER) {
        let raw = {};
        try { raw = await sp.userStorage.getJson('settings.json', { fallback: {}, userId: user() }); } catch { /* first run */ }
        settingsCache = normalizeSettings(raw);
        settingsUser = USER;
    }
    return settingsCache;
}
export async function saveSettings() {
    if (settingsCache) await sp.userStorage.setJson('settings.json', settingsCache, { userId: user() });
}
export const on = s => s.enabled !== false;

// ------------------------------------------------------------------ per-chat state
// Host sheets, pictures and looks, and which 📖 entries are still sticky: kept per chat in the extension's own storage
// (a fork copies them).

const chatStates = new Map();
const statePath = chatId => `chats/${chatId}.json`;

export async function chatState(chatId) {
    if (!chatStates.has(chatId)) {
        let s = {};
        try { s = await sp.userStorage.getJson(statePath(chatId), { fallback: {}, userId: user() }); } catch { /* new chat */ }
        chatStates.set(chatId, { personas: {}, pictures: {}, ...s });
    }
    return chatStates.get(chatId);
}
export async function saveChatState(chatId) {
    const s = chatStates.get(chatId);
    if (s) await sp.userStorage.setJson(statePath(chatId), { personas: s.personas, pictures: s.pictures }, { userId: user() });
}
export async function copyChatState(from, to) {
    const s = await chatState(from);
    chatStates.set(to, structuredClone({ personas: s.personas, pictures: s.pictures }));
    await saveChatState(to);
}

// ------------------------------------------------------------------ characters and personas

const charCache = new Map();
export function forgetCharacter(id) { charCache.delete(id); }
export async function getCharacter(id) {
    if (!id) return null;
    if (!charCache.has(id)) {
        let ch = null;
        try { ch = await sp.characters.get(id, user()); } catch (err) { warn('character', id, err); }
        if (!ch) return null;
        charCache.set(id, ch);
    }
    return charCache.get(id);
}
export async function getPersona(id) {
    try { return id ? await sp.personas.get(id, user()) : await sp.personas.getActive(user()); } catch { return null; }
}

/** A card's text, for suggestions and first builds. */
export const cardText = ch => [ch?.description, ch?.personality, ch?.scenario, ch?.creator_notes].filter(Boolean).join('\n\n');

// ------------------------------------------------------------------ a chat

/** Which swipe a message is showing, as a key that survives other swipes being added or deleted. */
export const swipeKey = m => String(m?.swipe_dates?.[m?.swipe_id] ?? m?.swipe_id ?? 0);

function toMsg(m, i) {
    const key = swipeKey(m);
    return {
        id: m.id,
        i,
        isUser: !!m.is_user,
        system: m.role === 'system',
        name: m.name || '',
        text: String(m.content ?? ''),
        key,
        wh: m.metadata?.wh?.s?.[key] || null,
        raw: m,
    };
}

/**
 * Everything a job needs about a chat: its messages, its character (or group), the persona, and the picked modes.
 * Returns null when the chat can't be read.
 */
export async function loadChat(chatId) {
    if (!chatId) return null;
    let chat, raw;
    try {
        [chat, raw] = await Promise.all([sp.chats.get(chatId, user()), sp.chat.getMessages(chatId)]);
    } catch (err) { warn('load chat', err); return null; }
    if (!chat) return null;
    const meta = chat.metadata || {};
    const group = meta.group === true || meta.group === 1;
    const ids = group ? (Array.isArray(meta.character_ids) ? meta.character_ids : []) : [chat.character_id].filter(Boolean);
    const members = (await Promise.all(ids.map(getCharacter))).filter(Boolean);
    const persona = await getPersona(meta.active_persona_id || null);
    const character = group ? null : members[0] || null;
    const s = await settings();
    const picks = group ? (s.groups[chatId] || []) : (character?.extensions?.worldhopper?.modes || []);
    return {
        chatId,
        chat,
        group,
        members,
        character,
        persona,
        userName: persona?.name || 'User',
        charName: character?.name || members[0]?.name || '',
        msgs: (raw || []).map(toMsg),
        picks: Array.isArray(picks) ? picks : [],
        modes: [...expandModes(Array.isArray(picks) ? picks : [])],
        state: await chatState(chatId),
    };
}

/** Where a chat's picks are kept: 'char:<id>' or 'group:<chat id>', with a label for the panel. */
export function target(c) {
    if (!c) return null;
    if (c.group) return { key: `group:${c.chatId}`, label: c.chat?.name ? `group “${c.chat.name}”` : 'this group', group: true };
    return c.character ? { key: `char:${c.character.id}`, label: c.character.name, character: c.character } : null;
}

export async function setPicks(c, list) {
    if (c.group) {
        const s = await settings();
        if (list.length) s.groups[c.chatId] = list; else delete s.groups[c.chatId];
        await saveSettings();
    } else if (c.character) {
        const ext = c.character.extensions?.worldhopper || {};
        const next = { ...ext, modes: list };
        const ch = await sp.characters.update(c.character.id, { extensions: { worldhopper: next } }, user());
        charCache.set(c.character.id, ch || { ...c.character, extensions: { ...(c.character.extensions || {}), worldhopper: next } });
    }
    c.picks = list;
    c.modes = [...expandModes(list)];
}

// ------------------------------------------------------------------ the snapshots on each reply
// Kept in the message's metadata under the swipe it belongs to, so swipes and deletes roll the Ledger and the Mind
// Book back: { wh: { s: { <swipe key>: { ledger, mind, history, edit, timing } } } }.

// What each message's text was when Worldhopper last read or wrote it. Lumiverse sends MESSAGE_EDITED for any change to
// a message, its metadata included (every snapshot below is one), so only a change to the text itself counts as an edit.
export const seenText = new Map();   // messageId → text
export function seen(id, text) {
    seenText.delete(id);
    seenText.set(id, text);
    if (seenText.size > 2000) seenText.delete(seenText.keys().next().value);
}

/** Merges `patch` into a message's snapshot (a key set to undefined is dropped), and its text when `content` is given. */
export async function writeSnap(c, msg, patch, { content } = {}) {
    seen(msg.id, typeof content === 'string' ? content : msg.text);
    const meta = { ...(msg.raw.metadata || {}) };
    const wh = { ...(meta.wh || {}) };
    const s = { ...(wh.s || {}) };
    const live = new Set((msg.raw.swipe_dates || []).map(String));
    for (const k of Object.keys(s)) if (live.size && !live.has(k) && k !== msg.key) delete s[k];   // swipes deleted since
    const snap = { ...(s[msg.key] || {}), ...patch };
    for (const k of Object.keys(snap)) if (snap[k] === undefined) delete snap[k];
    s[msg.key] = snap;
    meta.wh = { ...wh, s };
    const update = { metadata: meta };
    if (typeof content === 'string') update.content = content;
    else update.skipChunkRebuild = true;
    await sp.chat.updateMessage(c.chatId, msg.id, update);
    msg.raw.metadata = meta;
    msg.wh = snap;
    if (typeof content === 'string') { msg.text = content; msg.raw.content = content; }
}

/** The newest message this snapshot field is on, before `before` (default: the whole chat). */
export function headSnap(c, field, before) {
    const msgs = c.msgs;
    for (let i = Math.min(before ?? msgs.length, msgs.length) - 1; i >= 0; i--) {
        const v = msgs[i].wh?.[field];
        if (v) return { value: v, index: i };
    }
    return null;
}

// ------------------------------------------------------------------ models

/** How many background requests each model has had since the backend started (shown under Settings → Tools). */
export const calls = { ledger: 0, notes: 0 };

/**
 * Sends messages to one of the jobs' models: a Lumiverse connection, and optionally a model on it. Returns the text,
 * or throws. Reasoning is off: these are small jobs, and a model thinking first only makes the next reply wait.
 */
export async function ask(job, messages, maxTokens, temperature, { signal } = {}) {
    const s = (await settings()).ledger;
    const notes = job === 'notes';
    const connection = (notes && s.notesConnection) || s.connection;
    const model = notes && s.notesConnection ? s.notesModel : s.model;
    if (!connection) throw new Error('no model picked (Worldhopper → Settings → Models)');
    // A raw call goes straight to the provider with the connection's key: the model is the one typed in beside the
    // connection, else the connection's own. (No preset is laid over it, so the RP preset's samplers stay out.)
    const conn = await connectionInfo(connection);
    calls[job === 'notes' ? 'notes' : 'ledger']++;
    // Some cloud models think before every answer and can't be told not to (Claude Sonnet 5.5 on OpenRouter: "reasoning
    // is mandatory"), and that thinking counts against max_tokens: a yes/no check capped at 60 came back empty. So a
    // cloud model gets headroom over what the job writes; it's a ceiling, not a cost. A local model keeps the job's own
    // cap, so a rambling one stops where the job expects.
    const local = LOCAL_PROVIDERS.test(String(conn?.provider || ''));
    const res = await sp.generate.raw({
        type: 'raw', messages, connection_id: connection, model: model || conn?.model || '',
        parameters: { max_tokens: local ? maxTokens : maxTokens + 2000, temperature }, reasoning: { source: 'off' }, userId: user(), signal,
    });
    return String(res?.content ?? '');
}
const LOCAL_PROVIDERS = /kobold|ollama|llama|lmstudio|lm_studio|tabby|vllm|textgen|ooba|aphrodite|local|custom/i;
const connCache = new Map();   // id → { at, value }: a connection's details, for a minute
async function connectionInfo(id) {
    const hit = connCache.get(id);
    if (hit && Date.now() - hit.at < 60000) return hit.value;
    let value = null;
    try { value = await sp.connections.get(id, user()); } catch { /* the call itself will say */ }
    connCache.set(id, { at: Date.now(), value });
    return value;
}
export async function modelLabel(job) {
    const s = (await settings()).ledger;
    const notes = job === 'notes' && s.notesConnection;
    const id = notes ? s.notesConnection : s.connection;
    if (!id) return '';
    let name = id;
    try { name = (await sp.connections.get(id, user()))?.name || id; } catch { /* keep the id */ }
    const model = notes ? s.notesModel : s.model;
    return model ? `${name} · ${model}` : name;
}
