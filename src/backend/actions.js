// Worldhopper Engine for Lumiverse — what you change by hand in the Ledger and Mind Book views, and in the panel
// (ported from the SillyTavern Engine's save*/remove* functions). Each returns true when it saved, or a string saying
// why it didn't (the frontend shows it and keeps the form open).
import { normalizeLedger, EMPTY_LEDGER } from '../core/ledger-core.js';
import { normalizeBook, EMPTY_BOOK } from '../core/mind-core.js';
import { personaKey, personaText, sheetFromFields, describesMinor } from '../core/persona-core.js';
import { sp, user, loadChat, writeSnap, saveChatState } from './host.js';
import { headLedger, headMind, cardNames, takenBodies, setSheet, movePerson, writePersona, busyWork, drawPicture, setPicture, pictureOf, notify, same, ensurePersonas } from './engine.js';
import { setBatch } from './viewdata.js';

const changedMeanwhile = what => `The ${what} changed while you were editing. Cancel, look it over, and try again.`;

/** Saves the Ledger as changed in the view, on the newest message; the next update builds on it. */
async function storeLedgerEdit(c, next) {
    const msg = c.msgs[c.msgs.length - 1];
    if (!msg) return 'Open a chat first.';
    await writeSnap(c, msg, { ledger: normalizeLedger(next) });
    notify(c.chatId);
    return true;
}

export async function saveBody(chatId, orig, { row, sheet }) {
    const c = await loadChat(chatId);
    if (!c?.msgs.length) return 'Open a chat first.';
    row = Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, String(v ?? '').trim()]));
    const made = sheet ? sheetFromFields(sheet) : null;
    if (made?.minor) return 'Hosts are adults: that sheet describes a minor, so it wasn\'t saved.';
    const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
    const at = orig ? ledger.bodies.findIndex(b => same(b.body, orig.body) && same(b.driver, orig.driver)) : -1;
    if (orig && at < 0) return changedMeanwhile('Ledger');
    // Saved as typed: the "once you know, you keep knowing" rule only guards the model's updates, not your edits.
    const next = { ...(orig ? ledger.bodies[at] : {}), ...row };
    if (!next.body && !next.driver) return 'A body needs a name, or a mind inside it.';
    if (orig) ledger.bodies[at] = next; else ledger.bodies.push(next);
    if (orig?.body && next.body && !same(orig.body, next.body)) movePerson(c, orig.body, next.body);
    if (made?.sheet && next.body && !cardNames(c).has(personaKey(next.body))) await setSheet(c, next.body, made.sheet);
    return storeLedgerEdit(c, ledger);
}

export async function removeBody(chatId, orig) {
    const c = await loadChat(chatId);
    const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
    const at = ledger.bodies.findIndex(b => same(b.body, orig.body) && same(b.driver, orig.driver));
    if (at < 0) return changedMeanwhile('Ledger');
    ledger.bodies.splice(at, 1);
    return storeLedgerEdit(c, ledger);
}

/** Adds (i = -1), changes or removes (v = null) a power or a name; v is what its chip's form holds. */
export async function saveListItem(chatId, list, i, v) {
    const c = await loadChat(chatId);
    const ledger = normalizeLedger(headLedger(c)?.ledger || EMPTY_LEDGER);
    let item = null;
    if (v && list === 'powers') {
        item = { who: String(v.who || '').trim(), power: String(v.power || '').trim() };
        if (!item.who || !item.power) return 'Say who has it and what it is.';
    }
    if (v && list === 'aliases') {
        item = { name: String(v.name || '').trim(), aka: String(v.aka || '').split(',').map(x => x.trim()).filter(Boolean) };
        if (!item.name || !item.aka.length) return 'Give the main name and at least one other.';
    }
    if (i < 0) ledger[list].push(item);
    else if (item) ledger[list][i] = item;
    else ledger[list].splice(i, 1);
    return storeLedgerEdit(c, ledger);
}

const isTaken = (c, name) => takenBodies(c, headLedger(c)?.ledger).some(b => same(b.body, name));

export async function saveSheet(chatId, name, values) {
    const c = await loadChat(chatId);
    const made = sheetFromFields(values);
    if (made.minor) return 'Hosts are adults: that sheet describes a minor, so it wasn\'t saved.';
    await setSheet(c, name, made.sheet, { taken: isTaken(c, name) });
    return true;
}

export async function deleteSheet(chatId, name) {
    const c = await loadChat(chatId);
    await setSheet(c, name, null, { taken: isTaken(c, name) });
    return true;
}

export async function writeSheet(chatId, name) {
    const c = await loadChat(chatId);
    const row = headLedger(c)?.ledger?.bodies?.find(b => same(b.body, name)) || { body: name };
    await busyWork(`sheet:${chatId}|${personaKey(name)}`, 'Writing the sheet…', chatId, () => writePersona(c, row));
    return true;
}

/** A Lumiverse persona from a host's sheet (and picture), to play as in this chat or any other. */
export async function makePersona(chatId, name, description) {
    const c = await loadChat(chatId);
    const e = c.state.personas[personaKey(name)];
    if (!e?.sheet) return { error: 'No sheet for them yet.' };
    const persona = await sp.personas.create({ name, title: 'Worldhopper host', description: String(description || '').trim() }, user());
    return { personaId: persona?.id, image: pictureOf(c, name) };
}
export async function personaDraft(chatId, name) {
    const c = await loadChat(chatId);
    const e = c.state.personas[personaKey(name)];
    if (!e?.sheet) return null;
    const row = (headLedger(c)?.ledger?.bodies || []).find(b => same(b.body, name));
    let existing = false;
    try { existing = (await sp.personas.list({ limit: 200, userId: user() })).data.some(p => same(p.name, name)); } catch { /* fine */ }
    return { text: `${name}${row?.pronouns ? ` (${row.pronouns})` : ''}\n${personaText(e.sheet)}`, existing, picture: !!pictureOf(c, name) };
}

// ------------------------------------------------------------------ Mind Book

/** A Mind Book entry with one part of its card saved over it (lines of suggestions, triggers and settings read back into lists). */
function mindEntryFromForm(kind, o, raw) {
    const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
    const out = { ...(raw || {}), ...o };
    if ('suggestions' in o) out.suggestions = lines(o.suggestions).map(l => { const [text, stage, n] = l.split('|').map(x => x.trim()); return { text, stage, times: parseInt(n, 10) || 1 }; });
    if ('triggers' in o) out.triggers = lines(o.triggers).map(l => { const [cue, ...rest] = l.split(/\s*(?:→|->)\s*/); return { cue, effect: rest.join(' → ') }; });
    if ('set' in o) out.set = lines(o.set).map(l => { const m = l.match(/^\s*(wants|feels|believes|loyal to|command)\s*:\s*(.+)$/i); return m ? { kind: m[1].toLowerCase(), text: m[2] } : { kind: 'wants', text: l }; });
    if ('everyone' in o) out.everyone = o.everyone === 'yes';
    return out;
}
const findEntry = (list, raw) => list.findIndex(x => (raw.id ? x.id === raw.id : JSON.stringify(x) === JSON.stringify(raw)));

async function storeMindEdit(c, next) {
    const msg = c.msgs[c.msgs.length - 1];
    if (!msg) return 'Open a chat first.';
    await writeSnap(c, msg, { mind: normalizeBook(next) });
    notify(c.chatId);
    return true;
}

export async function saveMindEntry(chatId, kind, raw, values) {
    const c = await loadChat(chatId);
    const book = normalizeBook(headMind(c)?.book || EMPTY_BOOK);
    const list = [...book[kind]];
    const entry = mindEntryFromForm(kind, values, raw);
    const need = kind === 'perception' ? entry.what : entry.who;
    if (!String(Array.isArray(need) ? need.join('') : need || '').trim()) return kind === 'perception' ? 'Say what the edit is.' : 'Say who it is.';
    if (kind !== 'perception' && describesMinor(JSON.stringify(entry))) return 'People here are adults: that entry describes a minor, so it wasn\'t saved.';
    if (raw) {
        const at = findEntry(list, raw);
        if (at < 0) return changedMeanwhile('Mind Book');
        list[at] = entry;
    } else list.push(entry);
    return storeMindEdit(c, { ...book, [kind]: list });
}

export async function removeMindEntry(chatId, kind, raw) {
    const c = await loadChat(chatId);
    const book = normalizeBook(headMind(c)?.book || EMPTY_BOOK);
    const at = findEntry(book[kind], raw);
    if (at < 0) return changedMeanwhile('Mind Book');
    return storeMindEdit(c, { ...book, [kind]: book[kind].filter((_, j) => j !== at) });
}

// ------------------------------------------------------------------ pictures

export async function draw(chatId, name) {
    await busyWork(`pic:${chatId}|${personaKey(name)}`, 'Drawing…', chatId, () => drawPicture(chatId, name));
    return true;
}

/** Draws everyone in a view who can have a picture and has none yet, one after another. */
export async function drawMissing(chatId, names) {
    const todo = names.slice();
    const job = { done: 0, total: todo.length };
    setBatch(job);
    notify(chatId);
    let drawn = 0;
    try {
        for (const n of todo) {
            await busyWork(`pic:${chatId}|${personaKey(n)}`, 'Drawing…', chatId, () => drawPicture(chatId, n));
            if (pictureOf(await loadChat(chatId), n)) drawn++;
            job.done++;
            notify(chatId);
        }
    } finally {
        setBatch(null);
        notify(chatId);
    }
    return { drawn, total: todo.length };
}

export async function usePicture(chatId, name, dataUrl) {
    if (!/^data:image\/[\w.+-]+;base64,/.test(String(dataUrl || ''))) return 'That file is not a picture.';
    const img = await sp.images.uploadFromDataUrl(dataUrl, { originalFilename: `${personaKey(name) || 'picture'}.png`, userId: user() });
    if (!img?.id) return 'The picture couldn\'t be saved.';
    await setPicture(await loadChat(chatId), name, img.id);
    return true;
}
export async function removePicture(chatId, name) {
    await setPicture(await loadChat(chatId), name, '');
    return true;
}
export async function saveLook(chatId, name, text) {
    const c = await loadChat(chatId);
    const look = String(text || '').replace(/\s+/g, ' ').trim();
    if (look && describesMinor(look)) return 'People here are adults: that look describes a minor, so it wasn\'t saved.';
    const k = personaKey(name);
    c.state.pictures[k] = { ...(c.state.pictures[k] || {}), name };
    if (look) c.state.pictures[k].look = look; else delete c.state.pictures[k].look;
    await saveChatState(chatId);
    notify(chatId);
    return true;
}

export { ensurePersonas };
