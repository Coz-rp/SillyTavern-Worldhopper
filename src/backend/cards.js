// Worldhopper Engine for Lumiverse — card tools: mode suggestions for a card, and Check card (the Card Doctor, plus a
// deeper review by the notes model).
import { buildSuggestMessages, parseSuggestResponse, expandModes } from '../core/codex-core.js';
import { doctorCard, buildReviewMessages, estimateTokens } from '../core/card-core.js';
import { CODEX } from '../core/codex-data.js';
import { sp, user, settings, saveSettings, on, loadChat, target, ask, cardText, forgetCharacter, getCharacter } from './host.js';
import { notify } from './engine.js';

// ------------------------------------------------------------------ suggestions

/** Suggest modes from the card, once per character (or on request). Returns the modes, or a reason it couldn't. */
export async function suggestModes(chatId, { force = false } = {}) {
    const s = await settings();
    const c = await loadChat(chatId);
    const t = target(c);
    if (!on(s) || !t?.character || (!force && (c.picks.length || s.suggested[t.key]))) return null;
    if (t.character.extensions?.worldhopper?.tool) return null;   // a card builder has no modes of its own
    if (!s.ledger.connection) return force ? { error: 'Pick a model first (Settings → Models).' } : null;
    let modes;
    try { modes = parseSuggestResponse(await ask('ledger', buildSuggestMessages(cardText(t.character), t.character.name), 80, 0.1)); } catch (err) { return force ? { error: `Suggestions: couldn't reach the model (${err.message}).` } : null; }
    s.suggested[t.key] = modes;
    await saveSettings();
    notify(chatId);
    return { modes, label: t.label };
}

// ------------------------------------------------------------------ token counts

async function count(text) {
    try {
        const r = await sp.tokens.countText(String(text || ''), { userId: user() });
        const n = r?.total_tokens;
        return typeof n === 'number' ? n : estimateTokens(text);
    } catch { return estimateTokens(text); }
}

async function personaNames() {
    try { return (await sp.personas.list({ limit: 200, userId: user() })).data.map(p => p.name).filter(Boolean); } catch { return []; }
}

// ------------------------------------------------------------------ Check card

/** The Card Doctor's findings for a card's data with these modes. */
function doctor(d, { modes = [], userNames = [], alwaysTokens = null, tool = false } = {}) {
    return doctorCard(d, { userNames, modes: [...expandModes(modes)], tool, alwaysTokens, preferCard: { system: true, postHistory: true } });
}

/** The character to check: the one asked for (the character editor), else the open chat's. */
async function cardFor(chatId, characterId) {
    const c = chatId ? await loadChat(chatId) : null;
    const id = characterId || c?.character?.id;
    if (!id) return { c };
    forgetCharacter(id);
    const ch = await getCharacter(id);
    const modes = Array.isArray(ch?.extensions?.worldhopper?.modes) ? ch.extensions.worldhopper.modes : [];
    return { c, ch, modes: [...expandModes(modes)] };
}

export async function checkCard(chatId, characterId) {
    const { c, ch, modes } = await cardFor(chatId, characterId);
    if (!ch) return { error: "Open a chat with a character first (group chats aren't checked)." };
    const d = { ...ch, extensions: ch.extensions || {} };
    const tool = !!d.extensions?.worldhopper?.tool;
    const always = await count([d.description, d.personality, d.scenario].filter(Boolean).join('\n'));
    const issues = doctor(d, { modes, userNames: [...await personaNames(), c?.userName].filter(Boolean), alwaysTokens: always, tool });
    const greetings = 1 + (d.alternate_greetings?.length || 0);
    return { name: ch.name, always, greetings, modes, issues, tool };
}

/** The Codex's own definitions of these modes, so the deeper review can check the card against them. */
function codexText(modes) {
    const want = new Set(modes);
    return CODEX.filter(e => e.title.startsWith('👁 ') && want.has(e.title.slice(2).trim())).map(e => `${e.title}\n${e.content}`).join('\n\n');
}

const reviews = new Map();   // character id → AbortController
export async function review(chatId, characterId) {
    const { ch, modes } = await cardFor(chatId, characterId);
    if (!ch) return { error: 'Open a chat with a character first.' };
    const ctl = new AbortController();
    reviews.set(ch.id, ctl);
    const timer = setTimeout(() => ctl.abort(new Error('timeout')), 180000);
    try {
        const d = { ...ch, extensions: ch.extensions || {} };
        // A generous ceiling: on explicit cards a model can spend hidden tokens before it answers.
        const text = await ask('notes', buildReviewMessages(d, modes, codexText(modes), { tool: !!d.extensions?.worldhopper?.tool }), 4000, 0.3, { signal: ctl.signal });
        return { text: text.trim() || 'The model returned nothing. Try again.' };
    } catch (err) {
        return { error: ctl.signal.aborted ? (ctl.signal.reason?.message === 'timeout' ? 'No answer after 3 minutes, so the review stopped. Check the Notes model under Settings → Models, or try again.' : 'Review canceled.') : `Couldn't run the review: ${err.message}` };
    } finally {
        clearTimeout(timer);
        reviews.delete(ch.id);
    }
}
export function cancelReview(characterId) { reviews.get(characterId)?.abort(); }

