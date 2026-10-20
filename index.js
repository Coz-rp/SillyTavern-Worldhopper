// Worldhopper Engine — SillyTavern extension.
//   Codex:  per-character metaphysics mode picks → switches on the matching entries of the Codex lorebook for
//           each generation (everything in that book is stored disabled; this is the only switch).
//           Plus a one-time mode suggestion per card.
//   Ledger: a Body Ledger (who is driving which body, the owner's state, powers) updated after each reply, stored
//           per message/swipe, and injected at depth 1 so the writer keeps names and pronouns straight.
//           Body History: past body changes, derived from those snapshots, plus a short note per ended one (what
//           the owner remembers, what was kept, what it left behind), injected at depth 4.
//   Checks: after the Ledger update, a pronoun check and a cut-only body-rules pass against it. The original is
//           kept; ⟲ in the message menu toggles back.
//   Mind:   the Mind Book (mind-core.js): what Hypnosis, Mind Control and Altered Perception have put into people,
//           one record per mode, updated only on replies that need it, injected at depth 1 with live watcher lines. (The style Editor is its own extension now, WH Editor;
//           the two share the ⟲ record and take turns on a reply.)
//   Cards:  Make card (a card-builder chat → a character with its modes) and Check card (Card Doctor).
// Each background job runs through a connection profile picked under Settings → Models.
import { ConnectionManagerRequestService } from '../../shared.js';
import { getPresetManager } from '../../../preset-manager.js';
import { promptManager } from '../../../openai.js';
import { loadWorldInfo, saveWorldInfo, updateWorldInfoList, world_names } from '../../../world-info.js';
import { looksLikeRoleplay } from './text-core.js';
import { MODE_GROUPS, MODIFIERS, PARENT, ALL_MODES, MODE_BLURBS, expandModes, planEntry, buildSuggestMessages, parseSuggestResponse, DISPLAY_SCRIPTS } from './codex-core.js';
import {
    EMPTY_LEDGER, normalizeLedger, buildLedgerMessages, parseLedger, parseLedgerUpdate, verifyNewRides, verifyEndedRides, renderLedger, akaOf, aliasResolver, personNamedIn,
    labelMultiRides, rosterOf, tracksBodies,
    hasCrossedBodies, needsPronounCheck, buildPronounMessages, parsePronounResponse, applyPronounFixes, buildLintMessages, parseLintResponse, applyCuts,
    endedRides, bodyHistory, renderHistory, historyGroups, buildHistoryMessages, parseHistoryResponse,
} from './ledger-core.js';
import { parseBuilderChat, buildCard, doctorCard, buildReviewMessages, estimateTokens } from './card-core.js';
import { describesMinor, buildPersonaMessages, parsePersona, personaText, personaKey, sheetFromFields, buildLookMessages, parseLook, portraitPrompt } from './persona-core.js';
import { ledgerView, mindView, pictureView } from './views.js';
import { user_avatar } from '../../../personas.js';
import { MIND_MODES, KINDS as MIND_KINDS, EMPTY_BOOK, normalizeBook, isEmptyBook, needsUpdate, buildMindMessages, applyMindUpdate, renderMindBook, trappedSelfCuts, resistanceSetUp } from './mind-core.js';

const MODULE = 'worldhopper';
const LOG = '[Worldhopper]';
const LEDGER_KEY = 'worldhopper_ledger';
const HISTORY_KEY = 'worldhopper_history';
const HISTORY_DEPTH = 4;   // background, so a little further back than the Ledger at depth 1
const PERSONA_KEY = 'worldhopper_personas';   // the host sheets, in chat metadata
const REVIEW_TIMEOUT_MS = 180000;   // Check card's deeper review: a slow model takes about a minute; past three, give up
const SCENE_MESSAGES = 4;   // who is "in the scene": named in this many of the latest messages
const RECENT_REPLIES = 30;   // "Build history" can read just this many of the latest replies instead of the whole chat
const IN_CHAT = 1;   // extension_prompt_types.IN_CHAT
const SYSTEM = 0;    // extension_prompt_roles.SYSTEM
const DEFAULTS = {
    // Worldhopper on or off (the switch in its heading). Off, nothing is added to prompts and no model runs; what's
    // already in the chat (moment boxes, badges, ⟲) still shows.
    enabled: true,
    codex: { world: 'WH Metaphysics', selections: {}, suggested: {}, installedHash: '' },
    // Connection profiles, picked under Settings → Models. The Ledger runs after every reply, so a fast model suits
    // it; history notes need judgment about who remembers what, so a stronger model suits them.
    ledger: { enabled: true, lanesCompact: false, profile: '', notesProfile: '' },
    // Pictures of people in the Ledger and the Mind Book, drawn by Image Generation as it's set up. auto draws them on
    // their own; style, model and workflow ('' = as set in Image Generation) and shape apply to these pictures only.
    // rewrite has Image Generation's own prompt template rewrite the prompt first (for tag-based models).
    pictures: { auto: false, style: '', model: '', workflow: '', shape: 'square', rewrite: false },
};

const ctx = () => SillyTavern.getContext();

function settings() {
    const all = ctx().extensionSettings;
    const s = (all[MODULE] ??= {});
    s.enabled ??= DEFAULTS.enabled;
    s.codex = { ...DEFAULTS.codex, ...(s.codex || {}) };
    s.codex.selections ??= {};
    s.codex.suggested ??= {};
    // Perception Rewrite is called Altered Perception now.
    for (const map of [s.codex.selections, s.codex.suggested]) {
        for (const k of Object.keys(map)) if (Array.isArray(map[k]) && map[k].includes('Perception Rewrite')) map[k] = map[k].map(m => m === 'Perception Rewrite' ? 'Altered Perception' : m);
    }
    const hadLedgerProfile = s.ledger && 'profile' in s.ledger;
    s.ledger = { ...DEFAULTS.ledger, ...(s.ledger || {}) };
    // Before 0.2 the Ledger used the Editor's model; keep it that way for existing setups.
    if (!hadLedgerProfile) s.ledger.profile = s.editor?.profile || '';
    // These used to be switches and are simply part of Worldhopper now; the heading's switch turns everything off.
    // "Powers get used" too: characters always use their powers now (⛓ Initiative Anchor comes with any mode).
    for (const k of ['enabled', 'anchors', 'details', 'suggest', 'initiative']) delete s.codex[k];
    s.pictures = { ...DEFAULTS.pictures, ...(s.pictures || {}) };
    // Host portraits (DEV builds) are Pictures now.
    if ('portraits' in s.ledger) s.pictures.auto = !!s.ledger.portraits;
    if (s.ledger.portraitWorkflow) s.pictures.workflow ||= s.ledger.portraitWorkflow;
    // Host personas too: their sheets are part of the Ledger now.
    for (const k of ['strip', 'badges', 'lanes', 'history', 'personas', 'portraits', 'portraitWorkflow']) delete s.ledger[k];
    // s.editor is left as it was: the WH Editor (its own extension now) takes its settings from there once.
    return s;
}
const save = () => ctx().saveSettingsDebounced();
/** Worldhopper is switched on (the switch in its heading). */
const on = () => settings().enabled !== false;

// One queue for the per-reply jobs (Ledger, Editor, suggestions), so their requests never overlap.
let queue = Promise.resolve();
const enqueue = fn => (queue = queue.then(fn).catch(err => console.warn(LOG, err)));

// ------------------------------------------------------------------ models

function profileByName(name) {
    return ctx().extensionSettings.connectionManager?.profiles?.find(p => p.name === name);
}

/** Send messages through a connection profile (Text or Chat Completion). Returns the text, or throws. `signal` aborts it. */
async function askProfile(name, messages, maxTokens, temperature, { signal = null } = {}) {
    if (!name) throw new Error('no model picked (Worldhopper → Settings → Models)');
    const profile = profileByName(name);
    if (!profile) throw new Error(`connection profile “${name}” not found`);
    if (profile.mode === 'cc') {
        const custom = { stream: false, extractData: true, includePreset: true, includeInstruct: false, signal };
        const res = await ConnectionManagerRequestService.sendRequest(profile.id, messages, maxTokens, custom, { temperature });
        return typeof res === 'string' ? res : String(res?.content ?? '');
    }
    // A background request ends on the instruct's quiet sequence, which skips the reply-turn prefill (for Gemma 4
    // WH, the empty thought channel). Without it Gemma opens a thought block, hits the "<|channel>thought" stop
    // string, and returns nothing. So end on the template's normal reply opening instead.
    const custom = { stream: false, extractData: true, includePreset: true, includeInstruct: true, signal };
    const inst = profile.instruct ? getPresetManager('instruct')?.getCompletionPresetByName(profile.instruct) : null;
    if (inst?.last_output_sequence) custom.instructSettings = { last_system_sequence: inst.last_output_sequence };
    // DRY off: an RP preset often uses it, and it penalizes exactly what these jobs need — copying a sentence or
    // the previous ledger verbatim. With DRY on, the model paraphrases the text it is told to quote, and every
    // guarded fix gets rejected.
    const res = await ConnectionManagerRequestService.sendRequest(profile.id, messages, maxTokens, custom, { temperature, dry_multiplier: 0 });
    return typeof res === 'string' ? res : String(res?.content ?? '');
}

/** The Ledger's model: ledger updates, their checks, the body checks on each reply, and mode suggestions. */
const ledgerProfile = () => settings().ledger.profile;
const askLedger = (messages, maxTokens, temperature) => askProfile(ledgerProfile(), messages, maxTokens, temperature);

/** Model for Body History notes and card reviews; the Ledger's when none is picked. */
const notesProfile = () => settings().ledger.notesProfile || ledgerProfile();

/** "couldn't reach “X”", or where to pick a model when none is set. */
const unreachable = name => (name ? `couldn't reach “${name}”` : 'no model picked (Settings → Models)');

// Summaryception 5.5.x calls sendRequest(profileId, messages, { ignoreInstruct: true }), putting options where ST
// expects max_tokens, so the object goes out as max_tokens: KoboldCpp drops the request and NanoGPT has no way to
// override it. Turn an object in that slot into a real limit, for any caller. A no-op once Summaryception is fixed.
// The limit is generous on purpose: on explicit passages Claude can spend several times the visible length in hidden
// output tokens before answering, and running out returns nothing. It is a ceiling, not a cost.
function guardSendRequest() {
    const svc = ConnectionManagerRequestService;
    if (svc.whGuarded) return;
    const original = svc.sendRequest;
    svc.sendRequest = function (profileId, prompt, maxTokens, ...rest) {
        return original.call(this, profileId, prompt, maxTokens && typeof maxTokens === 'object' ? 2000 : maxTokens, ...rest);
    };
    svc.whGuarded = true;
}

// ------------------------------------------------------------------ Codex

function selectionTarget() {
    const c = ctx();
    if (c.groupId) {
        const g = c.groups?.find(x => x.id === c.groupId);
        return { key: 'group:' + c.groupId, label: g ? `group “${g.name}”` : 'this group', group: true };
    }
    const ch = c.characters?.[c.characterId];
    return ch ? { key: 'char:' + ch.avatar, label: ch.name, character: ch } : null;
}

function currentModes() {
    const t = selectionTarget();
    return t ? (settings().codex.selections[t.key] || []) : [];
}

function setModes(list) {
    const t = selectionTarget();
    if (!t) return;
    const s = settings().codex;
    if (list.length) s.selections[t.key] = list; else delete s.selections[t.key];
    save();
}

async function onEntriesLoaded(lore) {
    const s = settings().codex;
    if (!on()) return;
    const active = expandModes(currentModes());
    if (!active.size) return;

    // The Codex book doesn't have to be switched on anywhere: if it isn't already loaded as global, character,
    // chat or persona lore, bring its entries in ourselves (same shape ST's getGlobalLore produces).
    const lists = [lore?.globalLore, lore?.characterLore, lore?.chatLore, lore?.personaLore].filter(Array.isArray);
    if (Array.isArray(lore?.globalLore) && !lists.some(l => l.some(e => e.world === s.world))) {
        const data = await loadWorldInfo(s.world);
        if (!data?.entries) { console.warn(LOG, `Codex lorebook “${s.world}” not found`); return; }
        for (const { uid, ...rest } of Object.values(data.entries)) lore.globalLore.push({ uid, world: s.world, ...rest });
    }

    let n = 0;
    for (const list of lists) {
        for (const e of list) {
            if (e.world !== s.world) continue;
            const plan = planEntry(e.comment, active);
            if (plan === 'constant') { e.disable = false; e.constant = true; n++; }
            else if (plan === 'keyed') { e.disable = false; n++; }
        }
    }
    console.debug(LOG, `Codex: ${[...active].join(', ')} → ${n} entries armed`);
}

// The Codex lorebook ships with the extension (codex/, built by tools/build-codex.cjs). It's installed when missing
// and updated when this version's differs, unless the installed copy has edits of its own: then the update is
// offered under Settings → Codex, and taking it keeps those edits as a separate lorebook.
const CODEX_BOOK = 'WH Metaphysics';
let codexUpdate = null;   // the bundled book, while an update waits for the user's OK

/** A fingerprint of what the model can see. The README entry and ST's own bookkeeping fields don't count. */
function bookHash(data) {
    const rows = Object.values(data?.entries || {}).filter(e => !String(e.comment || '').startsWith('✦'))
        .map(e => [e.comment, e.content, (e.key || []).join('\u0001'), e.position, e.depth, e.role ?? '', e.order, e.sticky ?? 0, e.scanDepth ?? ''].join('\u0002'))
        .sort();
    let h = 2166136261;   // FNV-1a
    for (const ch of rows.join('\u0003')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return `${h.toString(16)}:${rows.length}`;
}

async function syncCodexBook({ force = false } = {}) {
    const s = settings().codex;
    if (s.world !== CODEX_BOOK) return;   // a lorebook of your own choosing isn't ours to touch
    let bundled;
    try { bundled = await (await fetch(new URL(`./codex/${CODEX_BOOK}.json`, import.meta.url))).json(); } catch { return; }
    const want = bookHash(bundled);
    const installed = Array.isArray(world_names) && world_names.includes(CODEX_BOOK) ? await loadWorldInfo(CODEX_BOOK) : null;
    const have = installed ? bookHash(installed) : null;
    if (have === want) {
        if (s.installedHash !== want) { s.installedHash = want; save(); }
        codexUpdate = null;
        renderCodexUpdate();
        return;
    }
    const edited = installed && have !== s.installedHash;
    if (edited && !force) {
        codexUpdate = bundled;
        renderCodexUpdate();
        return;
    }
    if (edited) await saveWorldInfo(`${CODEX_BOOK} (your edits)`, installed, true);
    await saveWorldInfo(CODEX_BOOK, bundled, true);
    await updateWorldInfoList();
    settings().codex.installedHash = want;
    save();
    codexUpdate = null;
    toastr.success(installed ? `The Codex lorebook was updated${edited ? `; your version is kept as “${CODEX_BOOK} (your edits)”` : ''}.` : 'The Codex lorebook was installed.', 'Worldhopper');
    renderWorldSelect();
    renderCodexPanel();
    renderCodexUpdate();
}

function renderCodexUpdate() {
    $('#wh_codex_update').toggle(!!codexUpdate && settings().codex.world === CODEX_BOOK);
}

// Display scripts for the moments the Codex asks the writer to mark, and for your body lines (codex-core.js): installed once; a script you've edited is left
// alone, and one you've deleted stays deleted.
const scriptHash = r => JSON.stringify([r.findRegex, r.replaceString, r.placement, r.markdownOnly, r.promptOnly]);

function syncDisplayScripts() {
    const all = (ctx().extensionSettings.regex ??= []);
    const known = (settings().codex.displayScripts ??= {});   // id → the version we last installed
    let changed = false;
    for (const want of DISPLAY_SCRIPTS) {
        const i = all.findIndex(r => r.id === want.id);
        const wantHash = scriptHash(want);
        if (i < 0) {
            if (known[want.id]) continue;   // deleted on purpose
            // Scripts run in list order, and the stray-marker cleanup must come after every box script.
            const stray = all.findIndex(r => r.id === 'wh-stray-markers');
            if (stray >= 0 && want.id !== 'wh-stray-markers') all.splice(stray, 0, structuredClone(want)); else all.push(structuredClone(want));
        } else {
            const have = scriptHash(all[i]);
            if (have !== wantHash && have !== known[want.id]) continue;   // your edit
            if (have !== wantHash) all[i] = { ...structuredClone(want), disabled: all[i].disabled };
        }
        if (known[want.id] !== wantHash) { known[want.id] = wantHash; changed = true; }
        changed ||= i < 0;
    }
    if (changed) save();
}

function cardText(ch) {
    return [ch?.description, ch?.personality, ch?.scenario, ch?.data?.creator_notes].filter(Boolean).join('\n\n');
}

async function suggestModes({ force = false } = {}) {
    const s = settings().codex;
    const t = selectionTarget();
    if (!on() || !t?.character || (!force && (currentModes().length || s.suggested[t.key]))) return;
    if (t.character.data?.extensions?.worldhopper?.tool) return;   // a card builder has no modes of its own
    if (!ledgerProfile() && !force) return;
    let modes;
    try {
        modes = parseSuggestResponse(await askLedger(buildSuggestMessages(cardText(t.character), t.character.name), 80, 0.1));
    } catch (err) {
        if (force) toastr.warning(`Suggestions: ${unreachable(ledgerProfile())}.`);
        return;
    }
    if (selectionTarget()?.key !== t.key) return;   // chat changed meanwhile
    s.suggested[t.key] = modes;
    save();
    renderCodexPanel();
    if (!modes.length) { if (force) toastr.info(`No metaphysics modes found in ${t.label}'s card.`); return; }
    toastr.info(`${modes.join(', ')} — click to apply.`, `Suggested modes for ${t.label}`, {
        timeOut: 20000, extendedTimeOut: 10000, closeButton: true,
        onclick: () => applySuggestion(t.key),
    });
}

function applySuggestion(key) {
    const t = selectionTarget();
    if (!t || t.key !== key) return;
    const modes = settings().codex.suggested[key] || [];
    setModes(modes);
    renderCodexPanel();
    toastr.success(`Codex: ${modes.join(', ')}`);
}

// The full picker stays folded away once a card has its modes; it opens by itself for a card with none.
let pickerOpen = null;
// Each mode's family ("occupancy", "overwrite"…), for its chip color.
const groupOf = m => (MODE_GROUPS.find(([, list]) => list.includes(m))?.[0] || 'other').toLowerCase();

function renderCodexPanel() {
    const s = settings().codex;
    const t = selectionTarget();
    const picked = new Set(currentModes());
    $('#wh_codex_target').text(t ? `· ${t.label}` : '');

    const chips = $('#wh_codex_picked').empty();
    $('#wh_codex_blurb, #wh_codex_missing').remove();
    const builder = !!t?.character?.data?.extensions?.worldhopper?.tool;   // a card builder has no modes of its own
    if (!t) chips.append('<span class="wh-empty">Open a chat to pick its modes.</span>');
    else if (builder && !picked.size) chips.append('<span class="wh-empty">This is a card builder, so it has no modes of its own. When the card is done, use <b>Make card</b> in the wand menu.</span>');
    else if (!picked.size) chips.append('<span class="wh-empty">None yet. Tap <i class="fa-solid fa-pen"></i> to pick some, or <i class="fa-solid fa-wand-magic-sparkles"></i> to suggest them from the card. Only what you pick is ever used.</span>');
    else for (const m of expandModes([...picked])) chips.append($('<span class="wh-chip" tabindex="0"></span>').addClass(`wh-g-${groupOf(m)}`).text(m).attr('title', MODE_BLURBS[m] || '').data('mode', m));
    if (on() && Array.isArray(world_names) && !world_names.includes(s.world)) {
        chips.after($('<div id="wh_codex_missing" class="wh-warning"></div>').text(`The Codex lorebook “${s.world}” isn't installed, so modes have no effect yet (Settings → Choices).`));
    }

    const box = $('#wh_codex_modes').empty();
    for (const [group, modes] of MODE_GROUPS) {
        const row = $('<div class="wh-mode-group"></div>').addClass(`wh-g-${group.toLowerCase()}`).append($('<div class="wh-mode-group-title"></div>').text(group));
        for (const m of modes) {
            const id = 'wh_mode_' + m.replace(/\W+/g, '_');
            const pill = $(`<label class="wh-pill${MODIFIERS.has(m) ? ' wh-modifier' : ''}" for="${id}"></label>`)
                .attr('title', (MODE_BLURBS[m] || '') + (PARENT[m] ? ` (modifier: also switches on ${PARENT[m]})` : ''));
            const cb = $(`<input type="checkbox" id="${id}">`).prop('checked', picked.has(m)).prop('disabled', !t || !on()).data('mode', m);
            row.append(pill.append(cb, $('<span></span>').text(m)));
        }
        box.append(row);
    }
    const open = pickerOpen ?? (!!t && on() && !picked.size && !builder);
    box.toggle(open);
    chips.toggle(!open || !t || !on());   // the pills already show the picks while the picker is open
    $('#wh_codex_edit').toggleClass('wh-on', open).toggleClass('fa-pen', !open).toggleClass('fa-check', open)
        .attr('title', open ? 'Done' : "Change this card's modes").toggle(!!t && on());
    $('#wh_codex_suggest_now').toggle(!!t && on());

    const sug = t ? s.suggested[t.key] : null;
    const showSug = t && on() && !picked.size && Array.isArray(sug) && sug.length;
    $('#wh_codex_suggestion').toggle(!!showSug);
    $('#wh_codex_suggestion_text').text(showSug ? `Suggested: ${sug.join(', ')}` : '');
    renderPresetNudge();
}

// The Worldhopper presets' optional metaphysics block (a bodies-and-minds step in their reasoning check). When this chat
// has modes and the active Chat Completion preset carries it switched off, the Codex panel offers to switch it on: the
// same as ticking it in the prompt list. (Two Referents, once a preset gate, is the Engine's own ⛓ Referent Anchor now.)
const PRESET_HELPERS = ['✚ Metaphysics Check'];
function presetHelpersOff() {
    if (ctx().mainApi !== 'openai' || !promptManager?.serviceSettings?.prompts) return [];
    const out = [];
    for (const name of PRESET_HELPERS) {
        const prompt = promptManager.serviceSettings.prompts.find(p => p.name === name);
        const entry = prompt && promptManager.getPromptOrderEntry(promptManager.activeCharacter, prompt.identifier);
        if (entry && !entry.enabled) out.push({ name, entry });
    }
    return out;
}
function renderPresetNudge() {
    const off = selectionTarget() && on() && currentModes().length ? presetHelpersOff() : [];
    $('#wh_codex_preset').toggle(off.length > 0);
    $('#wh_codex_preset_text').text(!off.length ? '' : `Your preset has ${off.map(x => x.name).join(' and ')} switched off. ${off.length > 1 ? 'They help' : 'It helps'} the model keep bodies and minds straight.`);
}
function switchOnPresetHelpers() {
    const off = presetHelpersOff();
    if (!off.length) return;
    for (const { entry } of off) entry.enabled = true;
    promptManager.render();
    promptManager.saveServiceSettings();
    renderPresetNudge();
    toastr.success(`${off.map(x => x.name).join(' and ')} switched on. Save the preset to keep ${off.length > 1 ? 'them' : 'it'} on after you switch presets.`, 'Worldhopper');
}

function onModeToggle() {
    const picked = $('#wh_codex_modes input:checked').map((_, el) => $(el).data('mode')).get();
    setModes(picked);
    renderCodexPanel();
    renderLedgerPanel();
}

// ------------------------------------------------------------------ Body Ledger

/** Latest ledger snapshot on a message before `beforeIndex` (default: whole chat). */
function headLedger(beforeIndex) {
    const chat = ctx().chat || [];
    for (let i = Math.min(beforeIndex ?? chat.length, chat.length) - 1; i >= 0; i--) {
        const l = chat[i]?.extra?.wh_ledger;
        if (l) return { ledger: normalizeLedger(l), index: i };
    }
    const base = ctx().chatMetadata?.[LEDGER_KEY];
    return base ? { ledger: normalizeLedger(base), index: -1 } : null;
}

// The Ledger only comes in where a mind inhabits another body (LEDGER_MODES): it runs, goes into the prompt and shows
// in the panel, strip and roster only while one of those modes is picked, the way the Mind Book comes in only with
// its own modes. Mind changes (hypnosis, mind control, altered perception) belong to the Mind Book, so a chat with
// only those never runs the Ledger, even if it holds Ledger entries from before; they stay for when a body mode is on.
const bodyModes = () => tracksBodies([...expandModes(currentModes())]);
function ledgerWanted() {
    return on() && settings().ledger.enabled && bodyModes();
}

function storeLedger(mesId, ledger) {
    const msg = ctx().chat?.[mesId];
    if (!msg) return;
    const l = normalizeLedger(ledger);
    msg.extra ??= {};
    msg.extra.wh_ledger = l;
    const info = msg.swipe_info?.[msg.swipe_id];
    if (info) { info.extra ??= {}; info.extra.wh_ledger = l; }
}

function speakerName(m) {
    return m.is_user ? (ctx().name1 || 'User') : (m.name || ctx().name2 || 'Narrator');
}

// Summaryception hides summarized messages as system messages; they are still part of the story.
const inStory = m => m?.mes && (!m.is_system || m.extra?.sc_ghosted);
const isReply = m => inStory(m) && !m.is_user;
const chatKey = () => ctx().getCurrentChatId?.() ?? ctx().chatId;

async function updateLedger(mesId, { rebuild = false, save = true } = {}) {
    const c = ctx();
    const chat = c.chat || [];
    const fail = { ok: false, ended: [] };
    if (!chat[mesId]) return fail;
    const key = chatKey();
    const base = rebuild ? null : headLedger(mesId);
    const from = base && base.index >= 0 ? base.index + 1 : Math.max(0, mesId - 7);
    const say = m => ({ name: speakerName(m), text: m.mes });
    const msgs = chat.slice(Math.max(from, mesId - 5), mesId + 1).filter(inStory).map(say);
    // The exchange the ledger already reflects, so the model knows who "you" is and who was where before.
    const context = base && base.index >= 0 ? chat.slice(Math.max(0, base.index - 1), base.index + 1).filter(inStory).map(say) : [];
    const t = selectionTarget();
    const first = !base;
    const persona = c.powerUserSettings?.persona_description || '';
    const userName = c.name1 || 'User';
    const modes = [...expandModes(currentModes())];
    const messages = buildLedgerMessages({
        ledger: base?.ledger || EMPTY_LEDGER,
        messages: msgs,
        context,
        userName,
        modes,
        card: first && t?.character ? cardText(t.character) : '',
        persona: first ? persona : '',
        update: !first,   // after the first build, only the changes: about 0.5 s instead of 2 s, and it tracks better
    });
    const t0 = performance.now();
    let text;
    try { text = await askLedger(messages, 900, 0.1); }
    catch (err) { ledgerStatus(`Ledger: ${unreachable(ledgerProfile())}.`); return fail; }
    let next = first ? parseLedger(text) : parseLedgerUpdate(text, base.ledger);
    if (!next) { ledgerStatus('Ledger: the model\'s answer was unreadable; kept the previous ledger.'); return fail; }
    if (!first) {
        // Every new body change gets a second look before it's kept (someone merely near the one doing it used to be listed).
        try {
            const v = await verifyNewRides(base.ledger, next, { messages: msgs, context, userName, modes }, (m, max) => askLedger(m, max, 0.1));
            next = v.ledger;
            if (v.log.length) console.log(LOG, 'new body changes checked', v.log);
        } catch { /* the check is a filter: if the model can't be reached, keep the update as it was */ }
        // And every body that left gets one too: a scene moving on, or the possessor busy in another body, ends nothing.
        try {
            const e = await verifyEndedRides(base.ledger, next, { messages: msgs, context, userName, modes }, (m, max) => askLedger(m, max, 0.1));
            next = e.ledger;
            if (e.log.length) console.log(LOG, 'ended body changes checked', e.log);
        } catch { /* as above */ }
    }
    next = labelMultiRides(next, modes);
    if (chatKey() !== key || !ctx().chat?.[mesId]) return fail;
    storeLedger(mesId, next);
    if (save) await ctx().saveChat();
    applyLedgerInjection();
    renderLedgerPanel();
    const ms = Math.round(performance.now() - t0);
    ledgerStatus(`Ledger updated (${(ms / 1000).toFixed(1)}s).`);
    return { ok: true, ms, ended: rebuild ? [] : endedRides(base?.ledger || EMPTY_LEDGER, next) };
}

// ------------------------------------------------------------------ Body History

/** Ledger snapshots (with any history notes) on messages before `beforeIndex`, in chat order. */
function ledgerSnapshots(beforeIndex) {
    const chat = ctx().chat || [];
    const snaps = [];
    const base = ctx().chatMetadata?.[LEDGER_KEY];
    if (base) snaps.push({ index: -1, ledger: base });
    for (let i = 0; i < Math.min(beforeIndex ?? chat.length, chat.length); i++) {
        const x = chat[i]?.extra;
        if (x?.wh_ledger) snaps.push({ index: i, ledger: x.wh_ledger, notes: x.wh_history });
    }
    return snaps;
}

function historyText(beforeIndex) {
    return renderHistory(bodyHistory(ledgerSnapshots(beforeIndex)), ctx().name1 || 'User');
}

/** Ask the notes model what the ended body changes left behind, and keep the answer on the message. */
async function noteEndedRides(mesId, ended, { save = true } = {}) {
    const chat = ctx().chat || [];
    const key = chatKey();
    const msgs = chat.slice(Math.max(0, mesId - 5), mesId + 1).filter(inStory).map(m => ({ name: speakerName(m), text: m.mes }));
    let text;
    try { text = await askProfile(notesProfile(), buildHistoryMessages(ended, msgs), 2000, 0.1); }
    catch (err) { ledgerStatus(`History note skipped: ${unreachable(notesProfile())}.`); console.warn(LOG, err); return; }
    const notes = parseHistoryResponse(text, ended);
    const msg = ctx().chat?.[mesId];
    if (!notes.length || chatKey() !== key || !msg) return;
    msg.extra ??= {};
    msg.extra.wh_history = notes;
    const info = msg.swipe_info?.[msg.swipe_id];
    if (info) { info.extra ??= {}; info.extra.wh_history = notes; }
    if (save) await ctx().saveChat();
    renderLedgerPanel();
    console.log(LOG, 'history notes', notes);
}

// One-time walk over an older chat: a ledger snapshot for every reply that has none, so the history covers what
// happened before the Ledger existed. Replies that already have one are skipped, and a long chat can do just its
// latest replies. Click again to stop.
let backfill = null;
const BACKFILL_LABEL = '<i class="fa-solid fa-clock-rotate-left"></i> Build history from earlier replies';
const minutes = n => `about ${Math.max(1, Math.ceil(n * 1.5 / 60))} min`;

async function backfillHistory() {
    if (backfill) { backfill.stop = true; return; }
    const c = ctx();
    const chat = c.chat || [];
    const all = chat.map((m, i) => (isReply(m) && !m.extra?.wh_ledger ? i : -1)).filter(i => i >= 0);
    if (!all.length) { toastr.info('Every reply already has a Ledger entry.'); return; }
    if (!ledgerProfile()) { toastr.warning('Pick a Ledger model first (Settings → Models).'); return; }
    const replies = chat.map((m, i) => (isReply(m) ? i : -1)).filter(i => i >= 0);
    const cutoff = replies[Math.max(0, replies.length - RECENT_REPLIES)];
    const recent = all.filter(i => i >= cutoff);
    let todo = all;
    if (recent.length < all.length) {
        const res = await c.callGenericPopup(
            `<p>${all.length} replies in this chat have no Ledger entry yet. Each is read once; replies that already have one are skipped.</p>`
            + `<p><b>Last ${RECENT_REPLIES} replies:</b> ${recent.length ? `reads ${recent.length}, ${minutes(recent.length)}.` : 'nothing to read, they all have entries.'}<br><b>Whole chat:</b> reads all ${all.length}, ${minutes(all.length)}.</p>`,
            c.POPUP_TYPE.CONFIRM, '', { okButton: `Last ${RECENT_REPLIES} replies`, cancelButton: 'Cancel', customButtons: [{ text: 'Whole chat', result: 2 }] });
        if (res === 2) todo = all;
        else if (res === c.POPUP_RESULT.AFFIRMATIVE) todo = recent;
        else return;
        if (!todo.length) { toastr.info(`The last ${RECENT_REPLIES} replies already have Ledger entries.`); return; }
    }
    const job = backfill = { stop: false };
    const key = chatKey();
    $('#wh_ledger_backfill').html('<i class="fa-solid fa-stop"></i> Stop building');
    toastr.info(`Building the Body History from ${todo.length} replies (${minutes(todo.length)}). You can keep reading; new replies wait their turn.`);
    let done = 0, endings = 0;
    await enqueue(async () => {
        try {
            for (const i of todo) {
                if (job.stop || chatKey() !== key) break;
                const r = await updateLedger(i, { save: false });
                if (!r.ok) continue;
                done++;
                if (r.ended.length) { endings++; await noteEndedRides(i, r.ended, { save: false }); }
                ledgerStatus(`Building history: ${done} of ${todo.length} replies…`);
                if (done % 10 === 0) await ctx().saveChat();
            }
        } finally {
            if (chatKey() === key) await ctx().saveChat();
            backfill = null;
            $('#wh_ledger_backfill').html(BACKFILL_LABEL);
            applyLedgerInjection();
            renderLedgerPanel();
            ledgerStatus(`${job.stop ? 'Stopped' : 'Done'}: ${done} replies read, ${endings} ended body change${endings === 1 ? '' : 's'} found.`);
        }
    });
}

function applyLedgerInjection(type) {
    const c = ctx();
    const s = settings().ledger;
    if (!on() || !s.enabled || type === 'quiet') {
        c.setExtensionPrompt(LEDGER_KEY, '', IN_CHAT, 1, false, SYSTEM);
        c.setExtensionPrompt(HISTORY_KEY, '', IN_CHAT, HISTORY_DEPTH, false, SYSTEM);
        c.setExtensionPrompt(MIND_KEY, '', IN_CHAT, 1, false, SYSTEM);
        return;
    }
    // A swipe or regenerate rewrites the last reply, so the state to write from is the one before it.
    const chat = c.chat || [];
    const last = chat[chat.length - 1];
    const exclude = (type === 'swipe' || type === 'regenerate') && last && !last.is_user;
    const limit = exclude ? chat.length - 1 : chat.length;
    const head = headLedger(limit);
    // Your latest message, for which of your bodies it gave a line. (A normal send lands in the chat after
    // GENERATION_STARTED; MESSAGE_SENT runs this again once it's there.)
    let lastUserText = '';
    for (let i = limit - 1; i >= 0; i--) if (chat[i]?.is_user) { lastUserText = chat[i].mes; break; }
    const bodies = ledgerWanted();
    // Who is in the scene: anyone named in the last few messages. Only they get their host sheet or their full Mind Book
    // entry, so a long chat full of hosts and hypnotized people doesn't grow the prompt every reply.
    const scene = chat.slice(Math.max(0, limit - SCENE_MESSAGES), limit).filter(inStory).map(m => m.mes).join('\n');
    // Each taken body's row carries who its owner is in their own life, and hosts released but still in the scene follow.
    const text = bodies && head ? renderLedger(head.ledger, c.name1 || 'User', { lastUserText, scene, ...hostSheets(head.ledger, chat, limit) }) : '';
    c.setExtensionPrompt(LEDGER_KEY, text, IN_CHAT, 1, false, SYSTEM);
    c.setExtensionPrompt(HISTORY_KEY, bodies ? historyText(limit) : '', IN_CHAT, HISTORY_DEPTH, false, SYSTEM);
    // The Mind Book, with the watcher lines for the reply about to be written: your newest message, and the scene
    // as the last two messages leave it.
    const kinds = mindKinds();
    const mind = kinds.length ? headMind(limit) : null;
    const recent = chat.slice(Math.max(0, limit - 2), limit).filter(inStory).map(m => m.mes).join('\n');
    c.setExtensionPrompt(MIND_KEY, mind ? renderMindBook(mind.book, c.name1 || 'User', { kinds, latest: lastUserText, recent, scene }) : '', IN_CHAT, 1, false, SYSTEM);
}

// ------------------------------------------------------------------ Host personas

// A short sheet per body someone else has taken (persona-core.js), part of the Body Ledger: written once, the first time
// the Ledger shows the body taken, with the notes model; kept in the chat's metadata; given to the model under the body's
// Ledger row while it's occupied, and after it's released while that person is still in the scene.
// Bodies with a card of their own (you, the card's character, group members) already have one and are skipped.
const personaMap = () => ctx().chatMetadata?.[PERSONA_KEY] || {};
const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const same = (a, b) => personaKey(a) === personaKey(b);
async function saveChatMeta() {
    const c = ctx();
    if (c.saveMetadata) await c.saveMetadata(); else c.saveMetadataDebounced?.();
}
function cardNames() {
    const c = ctx();
    const names = new Set([c.name1, c.name2].filter(Boolean).map(personaKey));
    const g = c.groupId ? c.groups?.find(x => x.id === c.groupId) : null;
    for (const av of g?.members || []) { const ch = c.characters?.find(x => x.avatar === av); if (ch) names.add(personaKey(ch.name)); }
    return names;
}
/** The character card by this name in this chat (its character, or a group member), if there is one. */
function cardCharacter(name) {
    const c = ctx();
    const g = c.groupId ? c.groups?.find(x => x.id === c.groupId) : null;
    const avatars = g ? g.members || [] : [c.characters?.[c.characterId]?.avatar].filter(Boolean);
    return avatars.map(av => c.characters?.find(x => x.avatar === av)).find(ch => ch && same(ch.name, name)) || null;
}
/**
 * Hosts who have been released but are still in the scene (named in the last few messages before limit): the model
 * plays that person again, so their sheet matters most then. A body still in the Ledger (taken, or empty) isn't back.
 */
function hostsBack(ledger, chat, limit) {
    const taken = new Set((ledger?.bodies || []).filter(b => b.body).map(b => personaKey(b.body)));
    const skip = cardNames();
    const recent = chat.slice(Math.max(0, limit - SCENE_MESSAGES), limit).filter(inStory).map(m => m.mes).join('\n');
    return Object.values(personaMap()).filter(e => e.sheet && !taken.has(personaKey(e.body)) && !skip.has(personaKey(e.body)) && personNamedIn(recent, [e.body]));
}

/** The sheets renderLedger puts in the prompt: { sheets: body → sheet text for the taken bodies, back: [{ body, text }] }. */
function hostSheets(ledger, chat, limit) {
    const sheets = new Map();
    for (const b of takenBodies(ledger)) {
        const e = personaMap()[personaKey(b.body)];
        if (e?.sheet) sheets.set(personaKey(b.body), personaText(e.sheet));
    }
    return { sheets, back: hostsBack(ledger, chat, limit).map(e => ({ body: e.body, text: personaText(e.sheet) })) };
}

/** Ledger rows for bodies someone else is driving right now, minus the ones with a card of their own. */
function takenBodies(ledger) {
    const skip = cardNames();
    return (ledger?.bodies || []).filter(b => b.body && b.driver && b.body.toLowerCase() !== 'none' && !skip.has(personaKey(b.body)));
}
const isTaken = name => takenBodies(headLedger()?.ledger).some(b => same(b.body, name));

const personaJobs = new Set();
/** Writes a sheet for every taken body that has none yet. Runs beside the reply queue, like Body History notes. */
async function ensurePersonas() {
    if (!ledgerWanted() || !notesProfile()) return;
    const key = chatKey();
    const head = headLedger();
    if (!head) return;
    // A sheet deleted while its body was taken stays deleted for that ride only.
    const map = personaMap();
    const taken = new Set(takenBodies(head.ledger).map(b => personaKey(b.body)));
    const over = Object.keys(map).filter(k => map[k]?.removed && !taken.has(k));
    if (over.length) { for (const k of over) delete map[k]; await saveChatMeta(); }
    for (const row of takenBodies(head.ledger)) {
        const id = `${key}|${personaKey(row.body)}`;
        if (personaMap()[personaKey(row.body)] || personaJobs.has(id)) continue;
        personaJobs.add(id);
        try { await writePersona(row, key); } finally { personaJobs.delete(id); }
    }
}

async function writePersona(row, key = chatKey()) {
    const c = ctx();
    const chat = (c.chat || []).filter(inStory);
    const name = row.body;
    const named = new RegExp(`\\b${reEsc(name)}\\b`, 'i');
    // The latest messages, plus the last few that name the body even if they're further back.
    const picked = new Set([...chat.filter(m => named.test(m.mes)).slice(-6), ...chat.slice(-10)]);
    const msgs = chat.filter(m => picked.has(m)).slice(-14).map(m => ({ name: speakerName(m), text: m.mes }));
    const t = selectionTarget();
    ledgerStatus(`Writing a host persona for ${name}…`);
    let text;
    try {
        text = await askProfile(notesProfile(), buildPersonaMessages({ body: name, row, card: t?.character ? cardText(t.character) : '', messages: msgs, userName: c.name1 || 'User' }), 2000, 0.4);
    } catch { ledgerStatus(`Host persona for ${name} skipped: ${unreachable(notesProfile())}.`); return; }
    const sheet = parsePersona(text);
    if (!sheet) { ledgerStatus(describesMinor(text) ? `Host persona for ${name} not kept: it described them as a minor.` : `Host persona for ${name}: the model's answer was unreadable.`); return; }
    if (chatKey() !== key) return;
    await setSheet(name, sheet);
    ledgerStatus(`Host persona written for ${name}.`);
    applyLedgerInjection();
    renderLedgerPanel();
}

/**
 * Sets a host's sheet, or deletes it (null). A sheet deleted while someone is still in the body leaves a mark, so no new
 * one is written after the next reply; the next time that person is taken, they get a fresh one.
 */
async function setSheet(name, sheet, { taken = false } = {}) {
    const meta = ctx().chatMetadata;
    meta[PERSONA_KEY] ??= {};
    const map = meta[PERSONA_KEY];
    const k = personaKey(name);
    const prev = map[k];
    if (sheet) map[k] = { body: name, sheet, at: Date.now() };
    else if (prev?.sheet && taken) map[k] = { body: prev.body, removed: true, at: Date.now() };
    else delete map[k];
    await saveChatMeta();
}

/** A body renamed in its card takes its sheet and its picture along, unless the new name already has one. */
function movePerson(from, to) {
    const meta = ctx().chatMetadata;
    for (const store of [meta?.[PERSONA_KEY], meta?.[PICTURE_KEY]]) {
        if (!store) continue;
        const a = personaKey(from), b = personaKey(to);
        if (a === b || !store[a] || store[b]) continue;
        store[b] = { ...store[a], ...('body' in store[a] ? { body: to } : { name: to }) };
        delete store[a];
    }
}

/**
 * A SillyTavern persona from a host's sheet and picture, to play as in this chat or any other. Made through SillyTavern's
 * own /persona-create, so it's a persona like any other; the description (built from the sheet) can be changed first.
 */
async function makePersona(name) {
    const c = ctx();
    const e = personaMap()[personaKey(name)];
    if (!e?.sheet) return;
    const create = c.SlashCommandParser?.commands?.['persona-create'];
    if (!create) { toastr.warning("This SillyTavern can't make personas from an extension yet (no /persona-create): update SillyTavern."); return; }
    const row = (headLedger()?.ledger?.bodies || []).find(b => same(b.body, name));
    const text = `${name}${row?.pronouns ? ` (${row.pronouns})` : ''}
${personaText(e.sheet)}`;
    const again = Object.values(c.powerUserSettings?.personas || {}).some(n => same(n, name));
    const picture = pictureOf(name);
    const head = `<h3>Make a persona: ${esc(name)}</h3><small>A persona you can pick in Persona Management, for this chat or any other${picture ? ', with their picture' : ''}. Change the description first if you like.${again ? ` You already have a persona named ${esc(name)}; this makes another.` : ''}</small>`;
    const res = await c.callGenericPopup(head, c.POPUP_TYPE.INPUT, text, { rows: 8, wide: true, okButton: 'Make it', cancelButton: 'Cancel' });
    if (typeof res !== 'string' || !res.trim()) return;
    try {
        // SillyTavern says it was made; it shows up in Persona Management.
        await create.callback({ name, description: res.trim(), title: 'Worldhopper host', avatar: picture, select: 'false', avatarPromptResize: 'false' }, '');
    } catch (err) {
        console.warn(LOG, err);
        toastr.error(`Couldn't make the persona: ${String(err.message || err).slice(0, 160)}`);
    }
}

async function rewritePersona(name) {
    const head = headLedger();
    const row = head?.ledger?.bodies?.find(b => same(b.body, name)) || { body: name };
    await writePersona(row);
}

// ------------------------------------------------------------------ Pictures

// A picture for anyone in the Ledger or the Mind Book without a card of their own (people with a card show its avatar),
// drawn by SillyTavern's Image Generation however it's set up: whatever source, model, workflow and style it uses, with
// the choices under Settings → Pictures laid over it for these pictures only. Drawn when you tap someone's face, or on
// their own with "Draw pictures on their own" (off by default). Drawn from a look: a host's sheet has one; anyone else
// gets one written for the picture by the notes model, or typed by you. Kept in the chat's metadata; the files live in
// their own folder of SillyTavern's images, so a replaced or removed one can be deleted without touching anything else.
const PICTURE_KEY = 'worldhopper_pictures';
const PICTURE_FOLDER = 'Worldhopper pictures';
const OUR_FOLDERS = [PICTURE_FOLDER, 'Worldhopper hosts'];   // the second from DEV builds before 1.3.0

function pictureMap(create = false) {
    const meta = ctx().chatMetadata;
    if (!meta) return {};
    // DEV builds before 1.3.0 kept a host's picture on their sheet.
    const legacy = Object.entries(meta[PERSONA_KEY] || {}).filter(([, e]) => e?.image);
    if (create || legacy.length) meta[PICTURE_KEY] ??= {};
    for (const [k, e] of legacy) { meta[PICTURE_KEY][k] ??= { name: e.body, image: e.image }; delete e.image; }
    return meta[PICTURE_KEY] || {};
}
const pictureOf = name => pictureMap()[personaKey(name)]?.image || '';
/** What their picture is drawn from: their sheet's Look, else a look of its own. */
function lookOf(name) {
    const fromSheet = personaMap()[personaKey(name)]?.sheet?.Look;
    return fromSheet ? { look: fromSheet, fromSheet: true } : { look: pictureMap()[personaKey(name)]?.look || '', fromSheet: false };
}
/** A card's face: the avatar of someone with a card of their own, else their picture, which a tap draws or changes. */
function faceFor(name, kind = 'idle') {
    const c = ctx();
    const k = personaKey(name);
    if (!k) return {};
    if (same(name, c.name1)) return { image: user_avatar ? c.getThumbnailUrl('persona', user_avatar) : '' };
    const ch = cardCharacter(name);
    if (ch) return { image: c.getThumbnailUrl('avatar', ch.avatar) };
    return { image: pictureOf(name), busy: viewBusy.get(`pic:${k}`) || '', open: () => openPicture(name, kind) };
}

/** Image Generation is on (its /imagine command is there). */
const imageGenOn = () => !!ctx().extensionSettings?.sd && !!ctx().SlashCommandParser?.commands?.imagine;
/** One of Image Generation's own settings, when it applies to the source it's set to (going by its settings panel). */
function sdControl(id) {
    const node = $(`#${id}`);
    if (!node.length) return null;
    const scope = node.closest('[data-sd-source]').attr('data-sd-source');
    return !scope || scope.split(',').includes(ctx().extensionSettings.sd?.source) ? node : null;
}
const sdOptions = id => (sdControl(id)?.find('option').map((_, o) => ({ value: o.value, label: o.textContent.trim() })).get() || []).filter(o => o.value);
const sdHas = (id, value) => sdOptions(id).some(o => o.value === value);

// A face is shown small, and most image models (and their LoRAs) are made for about 1 megapixel: drawn much bigger, a
// LoRA's look can wash out entirely. So a square picture is never asked for above 1024 a side.
const MAX_SIDE = 1024;

// One picture at a time: each lays its choices over Image Generation's settings and puts back what it found, so two at
// once would leave the first one's choices behind for good.
let drawing = Promise.resolve();
function imagine(prompt) {
    const run = drawing.then(() => imagineNow(prompt));
    drawing = run.catch(() => {});
    return run;
}

/**
 * Draws a picture through Image Generation as it's set up, with the choices under Settings → Pictures laid over it for
 * this one picture and put back right after. Returns { url ('' when nothing came back), side (the square asked for, or 0) }.
 */
async function imagineNow(prompt) {
    const c = ctx();
    if (!imageGenOn()) throw new Error('Image Generation is off: turn it on under Extensions → Image Generation and pick a source');
    const sd = c.extensionSettings.sd;
    const p = settings().pictures;
    // With no chat model to rewrite it, Image Generation draws the word "undefined" instead.
    if (p.rewrite && (!c.onlineStatus || c.onlineStatus === 'no_connection')) throw new Error('Prompt is set to "Rewritten by Image Generation", which needs your chat model connected');
    const was = {};
    const set = (k, v) => { if (!(k in was)) was[k] = sd[k]; sd[k] = v; };
    const style = p.style && sd.styles?.find(x => x.name === p.style);
    if (style) { set('prompt_prefix', style.prefix || ''); set('negative_prompt', style.negative || ''); }
    // A "pov" in the prefix is there for scene pictures; a picture of someone shows them.
    if (typeof sd.prompt_prefix === 'string') set('prompt_prefix', sd.prompt_prefix.split(',').filter(t => !/^\s*pov\s*$/i.test(t)).join(','));
    if (p.workflow && sdHas('sd_comfy_workflow', p.workflow)) set('comfy_workflow', p.workflow);
    // The prompt goes in as written, unless it's to be rewritten by Image Generation's own prompt template (through your
    // chat model), which tag-based models need.
    const args = ['quiet=true', `extend=${p.rewrite ? 'true' : 'false'}`, 'edit=false'];
    if (p.model && !p.model.includes('"') && sdHas('sd_model', p.model)) args.push(`model="${p.model}"`);
    const side = p.shape === 'square' && sd.width > 0 && sd.height > 0 ? Math.min(sd.width, sd.height, MAX_SIDE) : 0;
    if (side) args.push(`width=${side}`, `height=${side}`);
    try {
        const r = await c.executeSlashCommandsWithOptions(`/imagine ${args.join(' ')} ${String(prompt).replace(/"/g, '')}`, { handleExecutionErrors: false, handleParserErrors: false });
        return { url: String(r?.pipe || ''), side };
    } finally {
        Object.assign(sd, was);
        c.saveSettingsDebounced();
    }
}

const dataUrlOf = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
/** Saves picture data (base64) in the pictures' folder; returns its path. */
async function savePictureFile(data, format, name) {
    const saved = await fetch('/api/images/upload', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ image: data, format, ch_name: PICTURE_FOLDER, filename: `${String(name).replace(/[^\p{L}\p{N}]+/gu, '_')}_${Date.now()}` }) });
    if (!saved.ok) throw new Error('could not save the picture');
    return (await saved.json()).path || '';
}
async function deleteImage(url) {
    try { await fetch('/api/images/delete', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ path: url }) }); } catch { /* already gone */ }
}
/** Deletes a picture file, but only one in the pictures' own folder. */
async function deletePictureFile(url) {
    if (url && OUR_FOLDERS.some(f => String(url).includes(`/${f}/`))) await deleteImage(url);
}
/** Image Generation saves into the character's folder; the picture moves to ours, so it can be replaced or removed safely. */
async function adoptPicture(url, name) {
    try {
        const res = await fetch(url);
        if (!res.ok) return url;
        const m = (await dataUrlOf(await res.blob())).match(/^data:image\/([\w.+-]+);base64,(.+)$/);
        if (!m) return url;
        const mine = await savePictureFile(m[2], m[1] === 'jpeg' ? 'jpg' : m[1], name);
        if (mine && String(url).includes('/user/images/')) await deleteImage(url);
        return mine || url;
    } catch { return url; }
}
/**
 * Puts a picture on someone (or takes it off, with '') and deletes the one it replaces. One you took off stays off:
 * "Draw pictures on their own" leaves that person alone until you draw or add one yourself.
 */
async function setPicture(name, url) {
    const map = pictureMap(true);
    const k = personaKey(name);
    const old = map[k]?.image;
    map[k] = { ...(map[k] || {}), name };
    if (url) { map[k].image = url; delete map[k].keepEmpty; } else { delete map[k].image; map[k].keepEmpty = true; }
    await saveChatMeta();
    renderLedgerPanel();
    refreshViews('picture');
    if (old && old !== url) await deletePictureFile(old);
}

/** A look for someone without a sheet, written by the notes model from the card and the chat; '' when it can't be. */
async function writeLook(name, key = chatKey()) {
    if (!notesProfile()) { ledgerStatus(`Picture of ${name}: write their look first (✏️ by Look, under their picture), or pick a Notes model under Settings → Models.`); return ''; }
    const c = ctx();
    const chat = (c.chat || []).filter(inStory);
    const named = new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(name)}(?![\\p{L}\\p{N}])`, 'iu');
    const picked = new Set([...chat.filter(m => named.test(m.mes)).slice(-6), ...chat.slice(-6)]);
    const msgs = chat.filter(m => picked.has(m)).slice(-10).map(m => ({ name: speakerName(m), text: m.mes }));
    const t = selectionTarget();
    ledgerStatus(`Describing ${name} for their picture…`);
    let text;
    try { text = await askProfile(notesProfile(), buildLookMessages({ name, card: t?.character ? cardText(t.character) : '', messages: msgs, userName: c.name1 || 'User' }), 1200, 0.4); }
    catch { ledgerStatus(`Picture of ${name} skipped: ${unreachable(notesProfile())}.`); return ''; }
    const look = parseLook(text, name);
    if (!look) { ledgerStatus(describesMinor(text) ? `Picture of ${name} not drawn: the look described them as a minor.` : `Picture of ${name}: the model's answer was unreadable.`); return ''; }
    if (chatKey() !== key) return '';
    const map = pictureMap(true);
    map[personaKey(name)] = { ...(map[personaKey(name)] || {}), name, look };
    await saveChatMeta();
    return look;
}

const imageSize = url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
});
let sizeTipShown = false;
/**
 * A setup that sets its own size (a workflow can) ignores the square asked for, and a picture far bigger than a model
 * was made for can lose its look. Said once a session, when a square was asked for and the picture came back not
 * square, or well over a megapixel. (A square of its own at about a megapixel is just right, whatever was asked.)
 */
async function checkPictureSize(url, side) {
    if (!side || sizeTipShown) return;
    const got = await imageSize(url);
    if (!got) return;
    const square = Math.abs(got.w - got.h) <= Math.max(got.w, got.h) * 0.1;
    const mp = (got.w * got.h) / 1e6;
    if (square && mp <= 1.6) return;
    sizeTipShown = true;
    toastr.info(`This picture came back ${got.w}×${got.h}${square ? '' : ', not square'}${mp > 1.6 ? `, ${mp.toFixed(1)} megapixels` : ''}: your Image Generation setup sets its own size. Pictures look best square at about 1 megapixel, and much bigger a LoRA's look can wash out. If yours uses a workflow, give pictures one of their own under Settings → Pictures → Workflow.`, 'Worldhopper', { timeOut: 20000, extendedTimeOut: 10000 });
}

async function drawPicture(name, key = chatKey()) {
    const look = lookOf(name).look || await writeLook(name, key);
    if (!look || chatKey() !== key) return;
    ledgerStatus(`Drawing ${name}…`);
    let drawn;
    try { drawn = await imagine(portraitPrompt(look, name)); } catch (err) { console.warn(LOG, err); ledgerStatus(`Picture of ${name}: ${String(err.message || err).slice(0, 160)}.`); return; }
    if (!drawn.url) { ledgerStatus(`Picture of ${name}: Image Generation returned nothing. Is it set up (Extensions → Image Generation)?`); return; }
    const url = await adoptPicture(drawn.url, name);
    if (chatKey() !== key) { await deletePictureFile(url); return; }
    await setPicture(name, url);
    ledgerStatus(`Picture drawn for ${name}.`);
    await checkPictureSize(url, drawn.side);
}

/** A picture of your own, from a file picker. */
function uploadPicture(name, key = chatKey()) {
    const input = $('<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>');
    input.on('cancel', () => input.remove()).on('change', async function () {
        const file = this.files?.[0];
        input.remove();
        if (!file) return;
        try {
            const m = (await dataUrlOf(file)).match(/^data:image\/([\w.+-]+);base64,(.+)$/);
            if (!m) throw new Error('that file is not a picture');
            const url = await savePictureFile(m[2], m[1] === 'jpeg' ? 'jpg' : m[1], name);
            if (chatKey() !== key) { await deletePictureFile(url); return; }
            await setPicture(name, url);
        } catch (err) { toastr.warning(`Picture of ${name}: ${String(err.message || err).slice(0, 160)}`); }
    });
    $('body').append(input);
    input.trigger('click');
}

async function removePicture(name) {
    const c = ctx();
    if (!pictureOf(name)) return;
    const ok = await c.callGenericPopup(`Remove ${name}'s picture?`, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Remove', cancelButton: 'Cancel' });
    if (ok === c.POPUP_RESULT.AFFIRMATIVE) await setPicture(name, '');
}

async function editLook(name) {
    const c = ctx();
    const res = await c.callGenericPopup(`How ${name} looks, for their picture`, c.POPUP_TYPE.INPUT, lookOf(name).look, { rows: 4, wide: true, okButton: 'Save', cancelButton: 'Cancel' });
    if (typeof res !== 'string') return;
    const look = res.replace(/\s+/g, ' ').trim();
    if (look && describesMinor(look)) { toastr.warning('People here are adults: that look describes a minor, so it wasn\'t saved.'); return; }
    const map = pictureMap(true);
    const k = personaKey(name);
    map[k] = { ...(map[k] || {}), name };
    if (look) map[k].look = look; else delete map[k].look;
    await saveChatMeta();
    refreshViews();
}

const pictureTried = new Set();   // `${chat}|${person}`: drawn on its own once a session, so a failing source isn't hit every reply
/** With "Draw pictures on their own" on: a picture for each host with a sheet, and each person in the Mind Book. */
async function ensurePictures() {
    if (!on() || !settings().pictures.auto || !imageGenOn()) return;
    const key = chatKey();
    const people = [];
    if (ledgerWanted()) for (const b of takenBodies(headLedger()?.ledger)) if (personaMap()[personaKey(b.body)]?.sheet) people.push(b.body);
    if (mindWanted()) {
        const book = headMind()?.book;
        for (const h of book?.hypnosis || []) people.push(h.who);
        for (const w of book?.control || []) people.push(...w.who);
    }
    const skip = cardNames();
    for (const name of people) {
        const k = personaKey(name);
        const id = `${key}|${k}`;
        if (!k || skip.has(k) || pictureOf(name) || pictureMap()[k]?.keepEmpty || pictureTried.has(id) || viewBusy.has(`pic:${k}`)) continue;
        pictureTried.add(id);
        await busyWork(`pic:${k}`, name, 'Drawing…', () => drawPicture(name, key), { quiet: true });
        if (chatKey() !== key) return;
    }
}

// ------------------------------------------------------------------ the views behind the bars
// Tapping a bar above the chat (or ✏️ on the panel, or Body Ledger in the wand menu) opens the Ledger or the Mind Book as
// cards that read at a glance (views.js): one per body or person, each body with who its owner is in their own life. A
// card's ✏️ turns it into its form in place. An open view redraws itself whenever what it shows changes, except while
// you're changing something in it; then it waits until you save or cancel.
const liveViews = new Set();   // { kind: 'ledger' | 'mind' | 'picture', render } for each view open
const viewBusy = new Map();   // 'sheet:<person>' or 'pic:<person>' → what's being done, shown on their card
const refreshViews = kind => { for (const v of liveViews) if (!kind || v.kind === kind) v.render(); };

let batch = null;   // "Draw missing pictures": { done, total } while it runs
/** The people a view could draw (a face to tap, no picture yet), while Image Generation is on, and how far a run is. */
function missingPictures(faces) {
    const names = imageGenOn() ? [...new Map(faces.filter(([, f]) => f?.open && !f.image).map(([n]) => [personaKey(n), n])).values()] : [];
    return { missing: names, batch: batch ? `Drawing ${Math.min(batch.done + 1, batch.total)} of ${batch.total}…` : '' };
}
/** Draws everyone in a view who can have a picture and has none yet, one after another. */
async function drawMissing(names) {
    if (batch) return;
    const key = chatKey();
    const todo = names.filter(n => !pictureOf(n) && !viewBusy.has(`pic:${personaKey(n)}`));
    if (!todo.length) return;
    batch = { done: 0, total: todo.length };
    refreshViews();
    let drawn = 0;
    try {
        for (const n of todo) {
            if (chatKey() !== key) break;
            await busyWork(`pic:${personaKey(n)}`, n, 'Drawing…', () => drawPicture(n, key), { quiet: true });
            if (pictureOf(n)) drawn++;
            batch.done++;
            refreshViews();
        }
    } finally {
        batch = null;
        refreshViews();
    }
    if (drawn === todo.length) toastr.info(`Drew ${drawn} picture${drawn > 1 ? 's' : ''}.`);
    else toastr.warning(`Drew ${drawn} of ${todo.length} pictures. ${$('#wh_ledger_status').text()}`);
}

/** Runs a job on someone's sheet or picture with a note on their card while it runs, then says how it went. */
async function busyWork(key, name, label, job, { quiet = false } = {}) {
    if (viewBusy.has(key)) return;
    viewBusy.set(key, label);
    refreshViews();
    if (!quiet) $('#wh_ledger_status').text('');
    try { await job(); } finally {
        viewBusy.delete(key);
        refreshViews();
    }
    const said = $('#wh_ledger_status').text();
    if (!quiet && said.includes(name)) toastr.info(said);
}

async function showView(kind, make, { wide = true } = {}) {
    const c = ctx();
    if (!c.chat?.length) { toastr.info('Open a chat first.'); return; }
    const box = $('<div class="wh-dos-wrap"></div>');
    const draw = () => box.empty().append(make(view));
    const view = { kind, render: () => { if (!box.find('.wh-dos-editing').length) draw(); }, refresh: draw };
    draw();
    liveViews.add(view);
    try { await c.callGenericPopup(box, c.POPUP_TYPE.TEXT, '', { wide, allowVerticalScrolling: true, okButton: 'Close' }); } finally { liveViews.delete(view); }
}

function ledgerViewData() {
    const c = ctx();
    const chat = c.chat || [];
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    const canon = aliasResolver(ledger);
    const me = canon(c.name1 || '');
    const map = personaMap();
    const host = (name, kind) => {
        const e = map[personaKey(name)];
        return { sheet: e?.sheet || null, removed: !!e?.removed, busy: viewBusy.get(`sheet:${personaKey(name)}`) || '', face: faceFor(name, kind) };
    };
    const taken = new Set(takenBodies(ledger).map(b => personaKey(b.body)));
    const inLedger = new Set(ledger.bodies.filter(b => b.body).map(b => personaKey(b.body)));
    // Each body as the bar shows it: teal when it's you inside, violet someone else (a copy is always its own person).
    const bodies = ledger.bodies.map((b, i) => {
        const body = b.body && b.body.toLowerCase() !== 'none' ? b.body : null;
        const copy = /cop(y|ied)|propagat/i.test(b.how) && body && b.driver;
        const kind = !body ? 'mind' : !b.driver ? 'idle' : copy ? 'npc' : canon(b.driver) === me ? 'you' : 'npc';
        // A taken body's card holds its owner's sheet; so does an empty one that has a sheet from before.
        const sheetable = !!body && (taken.has(personaKey(body)) || (!!map[personaKey(body)]?.sheet && !cardNames().has(personaKey(body))));
        const row = { body: b.body, pronouns: b.pronouns, driver: b.driver, driver_pronouns: b.driver_pronouns, how: b.how, host: b.host, notes: b.notes, doing: b.doing, user_knows: b.user_knows };
        return {
            i, row, title: body || b.driver, kind, sheetable,
            hidden: b.user_knows === 'no' && !!body && !!b.driver,
            icon: copy ? 'fa-clone' : { you: 'fa-user', npc: 'fa-ghost', idle: 'fa-user-slash', mind: 'fa-wind' }[kind],
            inside: copy ? `a copy of ${canon(b.driver) === me ? 'you' : b.driver}`
                : { you: "you're inside", npc: canon(body) === me ? `${b.driver} is in you` : `${b.driver} inside`, idle: 'empty', mind: 'no body' }[kind],
            ...(body && !cardNames().has(personaKey(body)) ? host(body, kind) : { sheet: null, face: faceFor(body || b.driver, kind) }),
        };
    });
    const back = hostsBack(ledger, chat, chat.length).map(e => ({ body: e.body, ...host(e.body, 'back') }));
    const shown = new Set([...inLedger, ...back.map(e => personaKey(e.body))]);
    const past = Object.values(map).filter(e => e.sheet && !shown.has(personaKey(e.body)))
        .sort((a, b) => a.body.localeCompare(b.body)).map(e => ({ body: e.body, ...host(e.body, 'idle') }));
    const history = historyGroups(bodyHistory(ledgerSnapshots())).map(g => ({
        title: `${g.driver} in ${g.bodies.join(', ')} · ${g.ended === 1 ? 'once' : g.ended === 2 ? 'twice' : `${g.ended}×`}${g.ongoing ? ', again now' : ''}`,
        lines: [g.notes.remembers ? ['Remembers', g.notes.remembers] : g.host ? ['Their mind', g.host] : null,
            g.notes.kept ? ['Kept', g.notes.kept] : null, g.notes.left ? ['Left behind', g.notes.left] : null].filter(Boolean),
        hidden: g.user_knows === 'no', ongoing: g.ongoing,
    }));
    return {
        bodies, back, past, history, powers: ledger.powers, aliases: ledger.aliases,
        ...missingPictures([...bodies.map(b => [b.title, b.face]), ...back.map(h => [h.body, h.face]), ...past.map(h => [h.body, h.face])]),
        empty: ledgerWanted() ? 'Everyone is in their own body.' : 'The Ledger is off: switch on Body Ledger & Mind Book under Settings → Choices, and pick a body mode.',
    };
}

/** Saves the Ledger as changed in the view, on the newest message; the next update builds on it. */
async function storeLedgerEdit(next) {
    const c = ctx();
    storeLedger(c.chat.length - 1, normalizeLedger(next));
    await c.saveChat();
    applyLedgerInjection();
    renderLedgerPanel();
}
const changedMeanwhile = what => { toastr.warning(`The ${what} changed while you were editing. Cancel, look it over, and try again.`); return false; };

/** Saves a body's card: a new body (i = -1, with an optional sheet), or one part of one already there (orig). */
async function saveBody(i, orig, { row, sheet }) {
    const c = ctx();
    if (!c.chat?.length) return false;
    row = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '').trim()]));
    const made = sheet ? sheetFromFields(sheet) : null;
    if (made?.minor) { toastr.warning('Hosts are adults: that sheet describes a minor, so it wasn\'t saved.'); return false; }
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    const at = orig ? ledger.bodies.findIndex(b => same(b.body, orig.body) && same(b.driver, orig.driver)) : -1;
    if (orig && at < 0) return changedMeanwhile('Ledger');
    // Saved as typed: the "once you know, you keep knowing" rule only guards the model's updates, not your edits.
    const next = { ...(orig ? ledger.bodies[at] : {}), ...row };
    if (!next.body && !next.driver) { toastr.warning('A body needs a name, or a mind inside it.'); return false; }
    if (orig) ledger.bodies[at] = next; else ledger.bodies.push(next);
    if (orig?.body && next.body && !same(orig.body, next.body)) movePerson(orig.body, next.body);
    if (made?.sheet && next.body && !cardNames().has(personaKey(next.body))) await setSheet(next.body, made.sheet);
    await storeLedgerEdit(ledger);
    return true;
}

async function removeBody(i, orig) {
    const c = ctx();
    const name = orig.body || orig.driver;
    const ok = await c.callGenericPopup(`Take ${name} out of the Ledger?`, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Remove', cancelButton: 'Cancel' });
    if (ok !== c.POPUP_RESULT.AFFIRMATIVE) return false;
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    const at = ledger.bodies.findIndex(b => same(b.body, orig.body) && same(b.driver, orig.driver));
    if (at < 0) return changedMeanwhile('Ledger');
    ledger.bodies.splice(at, 1);
    await storeLedgerEdit(ledger);
    return true;
}

/** Adds (i = -1), changes or removes (v = null) a power or a name; v is what its chip's form holds. */
async function saveListItem(list, i, v) {
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    let item = null;
    if (v && list === 'powers') {
        item = { who: v.who.trim(), power: v.power.trim() };
        if (!item.who || !item.power) { toastr.warning('Say who has it and what it is.'); return false; }
    }
    if (v && list === 'aliases') {
        item = { name: v.name.trim(), aka: v.aka.split(',').map(x => x.trim()).filter(Boolean) };
        if (!item.name || !item.aka.length) { toastr.warning('Give the main name and at least one other.'); return false; }
    }
    if (i < 0) ledger[list].push(item);
    else if (item) ledger[list][i] = item;
    else ledger[list].splice(i, 1);
    await storeLedgerEdit(ledger);
    return true;
}

async function saveSheetFromView(name, values) {
    const made = sheetFromFields(values);
    if (made.minor) { toastr.warning('Hosts are adults: that sheet describes a minor, so it wasn\'t saved.'); return false; }
    await setSheet(name, made.sheet, { taken: isTaken(name) });
    applyLedgerInjection();
    renderLedgerPanel();
    return true;
}

async function deleteSheet(name) {
    const c = ctx();
    const ok = await c.callGenericPopup(`Delete ${name}'s sheet?`, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Delete', cancelButton: 'Cancel' });
    if (ok !== c.POPUP_RESULT.AFFIRMATIVE) return false;
    await setSheet(name, null, { taken: isTaken(name) });
    applyLedgerInjection();
    renderLedgerPanel();
    ledgerStatus(`Host persona deleted for ${name}.`);
    return true;
}

function mindViewData() {
    const book = normalizeBook(headMind()?.book || EMPTY_BOOK);
    const me = String(ctx().name1 || '').toLowerCase();
    const isMe = n => !!n && n.toLowerCase() === me;
    const kind = by => (isMe(by) ? 'you' : 'npc');
    const label = n => (isMe(n) ? 'you' : n);
    const hypnosis = book.hypnosis.map(h => [h.who, faceFor(h.who, kind(h.by))]);
    const control = book.control.map(w => [w.who[0], faceFor(w.who[0], kind(w.by))]);
    return {
        ...missingPictures([...hypnosis, ...control]),
        kinds: [...new Set([...mindKinds(), ...MIND_KINDS.filter(k => book[k].length)])],
        hypnosis: book.hypnosis.map((h, i) => ({
            i, raw: h, who: h.who, kind: kind(h.by), by: h.by, byLabel: label(h.by), susceptibility: h.susceptibility, times: h.times,
            amnesia: h.amnesia === 'yes', hidden: h.user_knows === 'no', now: h.now || 'awake', deepest: h.deepest,
            suggestions: h.suggestions.map(x => ({ text: x.text, stage: x.stage, reinforced: x.times > 1 })), triggers: h.triggers,
            face: faceFor(h.who, kind(h.by)),
        })),
        control: book.control.map((w, i) => ({
            i, raw: w, who: w.who, kind: kind(w.by), by: w.by, byLabel: label(w.by), resists: w.resists === 'yes', hidden: w.user_knows === 'no', set: w.set, own: w.own,
            face: faceFor(w.who[0], kind(w.by)),
        })),
        perception: book.perception.map((e, i) => {
            const who = e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(', ')}` : ''}` : e.who.join(', ');
            return {
                i, raw: e, kind: kind(e.by), by: e.by, byLabel: label(e.by), hidden: e.user_knows === 'no', what: e.what,
                icon: e.kind === 'unseen' ? 'fa-eye-slash' : e.kind === 'false' ? 'fa-masks-theater' : 'fa-wand-magic-sparkles',
                title: e.kind === 'unseen' ? `${who} can't perceive ${label(e.target)}` : e.kind === 'false' ? `${who}: a false belief` : `${who}: an altered normal`,
            };
        }),
        empty: 'Pick Hypnosis, Mind Control or Altered Perception for this character to start a Mind Book.',
    };
}

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

async function storeMindEdit(next) {
    const c = ctx();
    storeMind(c.chat.length - 1, next);
    await c.saveChat();
    applyLedgerInjection();
    renderMindPanel();
}
const findEntry = (list, raw) => list.findIndex(x => (raw.id ? x.id === raw.id : JSON.stringify(x) === JSON.stringify(raw)));

async function saveMindEntry(kind, i, raw, values) {
    const book = normalizeBook(headMind()?.book || EMPTY_BOOK);
    const list = [...book[kind]];
    const entry = mindEntryFromForm(kind, values, raw);
    const need = kind === 'perception' ? entry.what : entry.who;
    if (!String(Array.isArray(need) ? need.join('') : need || '').trim()) { toastr.warning(kind === 'perception' ? 'Say what the edit is.' : 'Say who it is.'); return false; }
    if (raw) {
        const at = findEntry(list, raw);
        if (at < 0) return changedMeanwhile('Mind Book');
        list[at] = entry;
    } else list.push(entry);
    await storeMindEdit({ ...book, [kind]: list });
    return true;
}

async function removeMindEntry(kind, i, raw) {
    const c = ctx();
    const ok = await c.callGenericPopup('Take this out of the Mind Book?', c.POPUP_TYPE.CONFIRM, '', { okButton: 'Remove', cancelButton: 'Cancel' });
    if (ok !== c.POPUP_RESULT.AFFIRMATIVE) return false;
    const book = normalizeBook(headMind()?.book || EMPTY_BOOK);
    const at = findEntry(book[kind], raw);
    if (at < 0) return changedMeanwhile('Mind Book');
    await storeMindEdit({ ...book, [kind]: book[kind].filter((_, j) => j !== at) });
    return true;
}

function openLedgerView() {
    return showView('ledger', view => ledgerView(ledgerViewData(), {
        saveBody, removeBody,
        saveSheet: saveSheetFromView, deleteSheet,
        writeSheet: name => busyWork(`sheet:${personaKey(name)}`, name, 'Writing the sheet…', () => rewritePersona(name)),
        makePersona,
        savePower: (i, v) => saveListItem('powers', i, v),
        saveAlias: (i, v) => saveListItem('aliases', i, v),
        drawMissing,
        refresh: view.refresh,
    }));
}
function openMindView() {
    return showView('mind', view => mindView(mindViewData(), { save: saveMindEntry, remove: removeMindEntry, drawMissing, refresh: view.refresh }));
}
function openPicture(name, kind = 'idle') {
    const k = personaKey(name);
    return showView('picture', () => {
        const { look, fromSheet } = lookOf(name);
        return pictureView({ name, image: pictureOf(name), look, lookFromSheet: fromSheet, busy: viewBusy.get(`pic:${k}`) || '', kind }, {
            draw: () => busyWork(`pic:${k}`, name, 'Drawing…', () => drawPicture(name)),
            upload: () => uploadPicture(name),
            remove: () => removePicture(name),
            editLook: () => editLook(name),
        });
    }, { wide: false });
}

function ledgerStatus(text) {
    $('#wh_ledger_status').text(text);
    console.log(LOG, text);
}

// The panel's own compact view of the ledger (the prose in renderLedger is written for the model, not for you):
// one line per body, details on a faint second line that expands on tap.
// kind colors the row like the strip: 'you' teal, 'npc' violet, 'idle' dashed; icon is a Font Awesome name.
function panelRow(main, sub, hidden, kind = '', icon = '') {
    const row = $('<div class="wh-row"></div>').addClass(kind ? `wh-k-${kind}` : '').append($('<div class="wh-row-main"></div>').text(main));
    if (icon) row.find('.wh-row-main').prepend(`<i class="fa-solid ${icon} wh-row-icon"></i>`);
    if (hidden) row.find('.wh-row-main').append(' <i class="fa-solid fa-eye-slash" title="hidden from you"></i>');
    if (sub) row.append($('<div class="wh-row-sub"></div>').text(sub).attr('title', sub)).addClass('wh-expandable');
    return row;
}

function renderLedgerPanel() {
    renderMindPanel();
    $('#wh_ledger_card').toggle(on() && bodyModes());
    const ledger = headLedger()?.ledger;
    const box = $('#wh_ledger_summary').empty();
    const canon = aliasResolver(ledger);
    const me = canon(ctx().name1 || '');
    for (const b of ledger?.bodies || []) {
        const body = b.body && b.body.toLowerCase() !== 'none' ? b.body : null;
        const copy = /cop(y|ied)|propagat/i.test(b.how);
        const main = !body ? `${b.driver}: no body` : b.driver ? `${body} ← ${copy ? `a copy of ${b.driver}` : b.driver}` : `${body}: empty`;
        const sub = [b.how && !/^possess/i.test(b.how) ? b.how : '', b.host ? `mind: ${b.host}` : '', b.notes].filter(Boolean).join(' · ');
        const kind = !b.driver || !body ? 'idle' : !copy && canon(b.driver) === me ? 'you' : 'npc';
        box.append(panelRow(main, sub, b.user_knows === 'no' && body && b.driver, kind, copy ? 'fa-clone' : kind === 'idle' ? 'fa-user-slash' : kind === 'you' ? 'fa-user' : 'fa-ghost'));
    }
    const extra = [
        ledger?.powers?.length ? `Powers: ${ledger.powers.map(p => `${p.who} (${p.power})`).join(', ')}` : '',
        ledger?.aliases?.length ? `Also known as: ${ledger.aliases.map(a => [a.name, ...a.aka].join(' = ')).join('; ')}` : '',
    ].filter(Boolean);
    for (const x of extra) box.append($('<div class="wh-row-sub wh-extra"></div>').text(x));
    if (!ledger?.bodies?.length) {
        box.prepend($('<div class="wh-empty"></div>').text(ledgerWanted() ? 'Everyone is in their own body.' : 'Off: switch on Body Ledger & Mind Book under Settings → Choices.'));
    }

    const hist = $('#wh_ledger_history').empty();
    const groups = historyGroups(bodyHistory(ledgerSnapshots()));
    if (groups.length) hist.append('<div class="wh-mini-title">History</div>');
    for (const g of groups) {
        const times = g.ended === 1 ? 'once' : g.ended === 2 ? 'twice' : `${g.ended}×`;
        const main = `${g.driver} → ${g.bodies.join(', ')} · ${times}${g.ongoing ? ', again now' : ''}`;
        const sub = [g.notes.remembers ? `remembers: ${g.notes.remembers}` : g.host ? `mind: ${g.host}` : '',
            g.notes.kept ? `kept: ${g.notes.kept}` : '', g.notes.left ? `left: ${g.notes.left}` : ''].filter(Boolean).join(' · ');
        hist.append(panelRow(main, sub, g.user_knows === 'no'));
    }
    hist.toggle(groups.length > 0);
    $('#wh_ledger_enabled').prop('checked', settings().ledger.enabled);
    renderStrip();
    renderBadges();
    refreshViews('ledger');
}

// A one-line strip above the chat: who is in which body, at a glance. Tap it for the full view.
let ledgerBusy = false;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** A bar chip's lead: the person's face, small, when there is one; else the chip's icon. */
const chipLead = (icon, face) => (face ? `<img class="wh-chip-face" src="${esc(face)}" alt="" loading="lazy">` : `<i class="fa-solid ${icon} wh-chip-icon"></i>`);

// The bars above the chat: the Ledger's, then the Mind Book's under it. Made together, so they always stack the same way.
function ensureStrips() {
    if ($('#wh_ledger_strip').length) return;
    const bar = (id, cls, title, open) => $(`<div id="${id}" class="wh-ledger-strip ${cls}" title="${title}" role="button" tabindex="0"></div>`)
        .on('click keydown', e => { if (e.type === 'click' || e.key === 'Enter') open(); }).hide();
    $('#chat').before(bar('wh_ledger_strip', '', 'Body Ledger — tap to open', openLedgerView), bar('wh_mind_strip', 'wh-mind-strip', 'Mind Book — tap to open', openMindView));
}

function renderStrip() {
    ensureStrips();
    const ledger = headLedger()?.ledger;
    const bodies = ledger?.bodies || [];
    // The roster goes with it: a chat with no bodies must not keep the last chat's cards over the message box.
    if (!ledgerWanted() || !ctx().chat?.length || (!bodies.length && !ledgerBusy)) { $('#wh_ledger_strip').hide(); renderLanes(); return; }
    const canon = aliasResolver(ledger);
    const me = canon(ctx().name1 || '');
    const chip = (kind, icon, title, sub, tip, hidden, face = '') => `<span class="wh-chip wh-${kind}${hidden ? ' wh-hidden' : ''}${face ? ' wh-has-face' : ''}" title="${esc(tip)}">${chipLead(icon, face)}`
        + `<span class="wh-chip-text"><b>${esc(title)}</b><small>${esc(sub)}${hidden ? ' · hidden <i class="fa-solid fa-eye-slash"></i>' : ''}</small></span></span>`;
    // Two lines per body; the color says who is doing it: teal when it's you, violet when it's someone else.
    // A copy is its own person even when it's a copy of you, so it's always violet.
    const chips = bodies.map(b => {
        const body = b.body && b.body.toLowerCase() !== 'none' ? b.body : null;
        const copy = /cop(y|ied)|propagat/i.test(b.how) && body && b.driver;
        const kind = !body ? 'mind' : !b.driver ? 'empty' : copy ? 'npc' : canon(b.driver) === me ? 'you' : 'npc';
        const title = body || b.driver;
        const sub = copy ? `a copy of ${canon(b.driver) === me ? 'you' : b.driver}`
            : { you: "you're inside", npc: canon(body) === me ? `${b.driver} is in you` : `${b.driver} inside`, empty: 'empty', mind: 'no body' }[kind];
        const icon = copy ? 'fa-clone' : { you: 'fa-user', npc: 'fa-ghost', empty: 'fa-user-slash', mind: 'fa-wind' }[kind];
        const aka = body ? akaOf(ledger, body) : [];
        const tip = [b.how, b.host ? `own mind: ${b.host}` : '', aka.length ? `also ${aka.join(', ')}` : '', b.user_knows === 'no' ? 'hidden from you' : ''].filter(Boolean).join(' · ');
        return chip(kind, icon, title, sub, tip, b.user_knows === 'no', faceFor(title).image);
    });
    $('#wh_ledger_strip').html(`${chips.join('')}${ledgerBusy ? '<span class="wh-busy">updating…</span>' : ''}`).show();
    renderLanes();
}

// The body roster over the message box while you run more than one body (multipossession, or you as a hive): a card
// per body in its own color, saying what it's doing. Tap one to start a line for it; the card for the line you're
// writing lights up. Past six bodies, or on request, the cards shrink to one-line chips.
const LANE_HUES = ['29, 158, 117', '127, 119, 221', '216, 90, 48', '212, 83, 126', '186, 117, 23', '55, 138, 221', '99, 153, 34', '226, 75, 74'];
let laneColourCache = { key: '', map: new Map() };

/** Your own body is always teal; every body you've driven in this chat gets the next color, in order of first appearance. */
function laneColours() {
    const me = ctx().name1 || '';
    const snaps = ledgerSnapshots();
    const key = `${chatKey()}|${snaps.length}|${me}`;
    if (laneColourCache.key === key) return laneColourCache.map;
    const map = new Map([[me.toLowerCase(), 0]]);
    let next = 1;
    for (const snap of snaps) {
        const l = normalizeLedger(snap.ledger);
        const canon = aliasResolver(l);
        for (const b of l.bodies) {
            if (!b.body || !b.driver || canon(b.driver) !== canon(me) || /cop(y|ied)|propagat/i.test(b.how) || map.has(b.body.toLowerCase())) continue;
            map.set(b.body.toLowerCase(), next);
            next = next % (LANE_HUES.length - 1) + 1;
        }
    }
    laneColourCache = { key, map };
    return map;
}
function laneHue(name) {
    const k = String(name || '').trim().toLowerCase();
    const map = laneColours();
    const i = map.has(k) ? map.get(k) : 1 + [...k].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % (LANE_HUES.length - 1);
    return LANE_HUES[i];
}

function renderLanes() {
    if (!$('#wh_lanes').length) {
        $('<div id="wh_lanes" class="wh-lanes"></div>')
            .on('click', '.wh-lane-card', e => addLane($(e.currentTarget).attr('data-name')))
            .on('click', '.wh-lanes-size', () => { const s = settings().ledger; s.lanesCompact = !s.lanesCompact; save(); renderLanes(); })
            .insertBefore('#nonQRFormItems');
        $('#send_textarea').on('input click keyup focus', markLanes);
    }
    const s = settings().ledger;
    const ledger = ledgerWanted() ? headLedger()?.ledger : null;
    const roster = ledger ? rosterOf(ledger, ctx().name1 || '') : [];
    if (!roster.length) { $('#wh_lanes').hide().empty(); return; }
    const big = roster.length > 6;
    const compact = big || !!s.lanesCompact;
    const cards = roster.map(r => {
        const carry = r.doing || r.notes || 'no line yet';
        const tip = [`Start a line for ${r.name}: [${r.name}]`, r.doing, r.notes].filter(Boolean).join('\n');
        return `<button type="button" class="wh-lane-card" data-name="${esc(r.name)}" data-carry="${esc(carry)}" style="--wh-hue: ${laneHue(r.name)}" title="${esc(tip)}">`
            + `<span class="wh-lane-top"><span class="wh-lane-dot"></span><b>${esc(r.name)}</b>${r.own ? '<small>(you)</small>' : ''}</span>`
            + `<span class="wh-lane-status">${esc(carry)}</span></button>`;
    });
    const size = big ? '' : `<button type="button" class="wh-lanes-size fa-solid ${compact ? 'fa-up-right-and-down-left-from-center' : 'fa-down-left-and-up-right-to-center'}" title="${compact ? 'Bigger cards, with what each body is doing' : 'Smaller cards'}"></button>`;
    $('#wh_lanes').toggleClass('wh-compact', compact).html(cards.join('') + size).show();
    markLanes();
}

/** Light up the card for the line the cursor is on, and say which bodies already have a line. */
function markLanes() {
    const box = $('#wh_lanes');
    const ta = document.getElementById('send_textarea');
    if (!ta || !box.children().length) return;
    const names = box.find('.wh-lane-card').map((_, el) => el.dataset.name.toLowerCase()).get();
    const tagOf = l => {
        const m = /^\s*\[([^\]\n]+)\]\s*(.*)$/.exec(l) || /^\s*([^:\n[\]]{1,40}):\s*(.*)$/.exec(l);
        return m && names.includes(m[1].trim().toLowerCase()) ? { n: m[1].trim().toLowerCase(), text: m[2].trim() } : null;
    };
    const v = ta.value;
    const at = ta.selectionEnd ?? v.length;
    const end = v.indexOf('\n', at);
    const cur = tagOf(v.slice(v.lastIndexOf('\n', at - 1) + 1, end < 0 ? v.length : end));
    const has = new Set(v.split('\n').map(tagOf).filter(x => x?.text).map(x => x.n));
    box.find('.wh-lane-card').each((_, el) => {
        const n = el.dataset.name.toLowerCase();
        $(el).toggleClass('wh-on', cur?.n === n).toggleClass('wh-has', has.has(n));
        $(el).find('.wh-lane-status').text(cur?.n === n ? 'writing' : has.has(n) ? 'has a line' : el.dataset.carry);
    });
}

/** Each [Name] line in the chat takes that body's color. */
function colourLanes() {
    $('#chat .mes_text .custom-wh-lane').each((_, el) => {
        el.style.setProperty('--wh-hue', laneHue($(el).find('.custom-wh-lane-name').first().text()));
    });
}

/** "[Name] " at the start of a line in the message box: on a new line, or in place of a tag with nothing after it. */
function addLane(name) {
    const ta = document.getElementById('send_textarea');
    if (!ta || !name) return;
    const v = ta.value;
    const at = ta.selectionEnd ?? v.length;
    const lineStart = v.lastIndexOf('\n', at - 1) + 1;
    const line = v.slice(lineStart, at);
    const tag = `[${name}] `;
    if (!line.trim() || /^\s*\[[^\]\n]*\]\s*$/.test(line)) ta.setRangeText(tag, lineStart, at, 'end');
    else ta.setRangeText(`\n${tag}`, at, at, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
}

// "as (name)" on your own messages, from the Ledger as it stood when you wrote each one.
function renderBadges() {
    colourLanes();
    markLanes();
    $('#chat .wh-as').remove();
    const s = settings().ledger;
    const chat = ctx().chat || [];
    if (!s.enabled || !chat.length) return;
    let ledger = ctx().chatMetadata?.[LEDGER_KEY] ? normalizeLedger(ctx().chatMetadata[LEDGER_KEY]) : null;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (m.is_user && ledger) {
            const canon = aliasResolver(ledger);
            const me = canon(m.name || ctx().name1 || '');
            const worn = ledger.bodies.filter(b => b.driver && b.body && b.body.toLowerCase() !== 'none' && canon(b.driver) === me && canon(b.body) !== me && !/cop(y|ied)|propagat/i.test(b.how)).map(b => b.body);
            if (worn.length) {
                $(`#chat .mes[mesid="${i}"] .name_text`).first()
                    .after($('<span class="wh-as"></span>').attr('title', `You're in ${worn.join(', ')}`).html(`<i class="fa-solid fa-user"></i> as ${esc(worn.join(', '))}`));
            }
        }
        if (m.extra?.wh_ledger) ledger = normalizeLedger(m.extra.wh_ledger);
    }
}

function setLedgerBusy(v) {
    ledgerBusy = v;
    renderStrip();
}

// Each body is one collapsed line ("Body ← Mind · how"); tap it to edit its fields.
// ------------------------------------------------------------------ Mind Book

// The Mind Book follows the Ledger's pattern: a snapshot on the reply that changed it (and in swipe_info), so swipes
// and deletes roll it back, and the newest snapshot is the book.
const MIND_KEY = 'worldhopper_mind';

/** The mind modes picked for this chat, as Mind Book kinds (hypnosis, control, perception). */
function mindKinds() {
    const modes = expandModes(currentModes());
    return MIND_KINDS.filter(k => modes.has(MIND_MODES[k]));
}

function headMind(beforeIndex) {
    const chat = ctx().chat || [];
    for (let i = Math.min(beforeIndex ?? chat.length, chat.length) - 1; i >= 0; i--) {
        const b = chat[i]?.extra?.wh_mind;
        if (b) return { book: normalizeBook(b), index: i };
    }
    return null;
}

function storeMind(mesId, book) {
    const msg = ctx().chat?.[mesId];
    if (!msg) return;
    const b = normalizeBook(book);
    msg.extra ??= {};
    msg.extra.wh_mind = b;
    const info = msg.swipe_info?.[msg.swipe_id];
    if (info) { info.extra ??= {}; info.extra.wh_mind = b; }
}

/** The Mind Book updates with the Ledger (the same switch and model), in chats with a mind mode picked. */
const mindWanted = () => on() && settings().ledger.enabled && mindKinds().length > 0;

/**
 * Update each picked mind mode's record from the newest messages, one small prompt per mode, and only for the modes
 * the messages give something to do (a marked moment, someone still in trance, the mode's words). The first update
 * in a chat reads the card and runs every picked mode. Returns { ms, ran } or null.
 */
async function updateMind(mesId, { save = true } = {}) {
    const kinds = mindKinds();
    const chat = ctx().chat || [];
    if (!kinds.length || !chat[mesId]) return null;
    const key = chatKey();
    const base = headMind(mesId);
    const first = !base;
    const from = base ? base.index + 1 : Math.max(0, mesId - 5);
    const say = m => ({ name: speakerName(m), text: m.mes });
    const msgs = chat.slice(Math.max(from, mesId - 5), mesId + 1).filter(inStory).map(say);
    const context = base ? chat.slice(Math.max(0, base.index - 1), base.index + 1).filter(inStory).map(say) : [];
    const text = msgs.map(m => m.text).join('\n');
    const userName = ctx().name1 || 'User';
    const t = selectionTarget();
    const card = first && t?.character ? cardText(t.character) : '';
    let book = base?.book || EMPTY_BOOK;
    let ran = 0;
    const t0 = performance.now();
    try {
        for (const kind of kinds) {
            if (!first && !needsUpdate(kind, book, text)) continue;
            if (!mindBusy) { mindBusy = true; renderMindStrip(); }
            let answer;
            try { answer = await askLedger(buildMindMessages(kind, { book, messages: msgs, context, userName, card }), 700, 0.1); }
            catch { ledgerStatus(`Mind Book: ${unreachable(ledgerProfile())}.`); return null; }
            ran++;
            const next = applyMindUpdate(kind, book, answer);
            if (next) book = next;
            else console.warn(LOG, `Mind Book (${kind}): unreadable answer`, answer);
        }
    } finally {
        if (mindBusy) { mindBusy = false; renderMindStrip(); }
    }
    if (!ran || chatKey() !== key || !ctx().chat?.[mesId]) return null;
    if (first || JSON.stringify(book) !== JSON.stringify(base.book)) {
        storeMind(mesId, book);
        if (save) await ctx().saveChat();
    }
    applyLedgerInjection();
    renderMindPanel();
    return { ms: Math.round(performance.now() - t0), ran };
}

/**
 * Mind Control has no trapped self: cut sentences that write one (no model), unless a struggle has been set up, by the
 * card, by your newest message, or in play (a will the Mind Book records as resisting).
 */
async function runMindCuts(mesId) {
    if (!mindKinds().includes('control')) return;
    const t = selectionTarget();
    if (resistanceSetUp(t?.character ? cardText(t.character) : '')) return;
    const chat = ctx().chat || [];
    let lastUser = '';
    for (let i = mesId - 1; i >= 0; i--) if (chat[i]?.is_user) { lastUser = chat[i].mes || ''; break; }
    if (resistanceSetUp(lastUser)) return;
    if (headMind(mesId + 1)?.book.control.some(w => w.resists === 'yes')) return;
    const msg = ctx().chat?.[mesId];
    if (!msg || msg.is_user || msg.is_system || !msg.mes || !looksLikeRoleplay(msg.mes)) return;
    await new Promise(r => setTimeout(r, 0));
    await globalThis.WHEditor?.whenDone?.(mesId);
    const original = ctx().chat?.[mesId]?.mes;
    const cuts = trappedSelfCuts(original);
    if (!cuts.length) return;
    const out = applyCuts(original, cuts);
    const now = ctx().chat?.[mesId];
    if (!out.applied.length || !now || now.mes !== original) return;
    writeMessage(now, out.text);
    recordEdit(now, original, out.text, out.applied.map(a => ({ ...a, why: 'trapped self under mind control' })));
    ctx().updateMessageBlock(mesId, now);
    markEdited(mesId);
    await ctx().saveChat();
    checksStatus(`Mind control: cut ${out.applied.length} line${out.applied.length > 1 ? 's' : ''} writing a trapped self. ⟲ restores the original.`);
}

let mindBusy = false;

/**
 * The Mind Book's bar above the chat: a chip per hypnotized person (their trance, or how many times they've been
 * under), per controlled will and per perception edit. Teal when you're the one doing it, violet when someone else
 * is, dashed when it's kept from you. Tap to edit.
 */
function renderMindStrip() {
    ensureStrips();
    const book = headMind()?.book;
    if (!mindWanted() || !ctx().chat?.length || (isEmptyBook(book) && !mindBusy)) { $('#wh_mind_strip').hide(); return; }
    const me = String(ctx().name1 || '').toLowerCase();
    const mine = by => (by && by.toLowerCase() === me ? 'you' : 'npc');
    const chip = (kind, icon, title, sub, tip, hidden, face = '') => `<span class="wh-chip wh-${kind}${hidden ? ' wh-hidden' : ''}${face ? ' wh-has-face' : ''}" title="${esc(tip)}">${chipLead(icon, face)}`
        + `<span class="wh-chip-text"><b>${esc(title)}</b><small>${esc(sub)}${hidden ? ' · hidden <i class="fa-solid fa-eye-slash"></i>' : ''}</small></span></span>`;
    const you = n => (n && n.toLowerCase() === me ? 'you' : n);
    const chips = [
        ...(book?.hypnosis || []).map(h => chip(mine(h.by), 'fa-circle-dot', h.who,
            h.now === 'awake' ? (h.times ? `awake · under ${h.times}×` : 'awake') : `${h.now} trance`,
            ['hypnosis', h.by ? `by ${you(h.by)}` : '', h.suggestions.length ? `${h.suggestions.length} suggestion${h.suggestions.length > 1 ? 's' : ''}` : '', h.triggers.length ? `triggers: ${h.triggers.map(t => `"${t.cue}"`).join(', ')}` : ''].filter(Boolean).join(' · '),
            h.user_knows === 'no', faceFor(h.who).image)),
        ...(book?.control || []).map(w => chip(mine(w.by), 'fa-hand-sparkles', w.who.join(', '),
            `${w.by ? (mine(w.by) === 'you' ? 'your control' : `${w.by}'s control`) : 'controlled'}${w.resists === 'yes' ? ' · resisting' : ''}`,
            ['mind control', ...w.set.map(x => `${x.kind} ${x.text}`)].join(' · '), w.user_knows === 'no', faceFor(w.who[0]).image)),
        ...(book?.perception || []).map(e => chip(mine(e.by), 'fa-eye-slash',
            e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(', ')}` : ''}` : e.who.join(', '),
            e.kind === 'unseen' ? `can't perceive ${you(e.target)}` : e.kind === 'false' ? 'believes a falsehood' : 'altered normal',
            ['altered perception', e.what, e.by ? `by ${you(e.by)}` : ''].filter(Boolean).join(' · '), e.user_knows === 'no')),
    ];
    $('#wh_mind_strip').html(`<span class="wh-strip-label" title="Mind Book"><i class="fa-solid fa-brain"></i></span>${chips.join('')}${mindBusy ? '<span class="wh-busy">updating…</span>' : ''}`).show();
}

function renderMindPanel() {
    renderMindStrip();
    refreshViews('mind');
    const kinds = mindKinds();
    const head = headMind();
    const book = head?.book;
    const show = on() && kinds.length > 0;
    $('#wh_mind_card').toggle(show);
    if (!show) return;
    const box = $('#wh_mind_summary').empty();
    const me = String(ctx().name1 || '').toLowerCase();
    const mine = by => by && by.toLowerCase() === me ? 'you' : 'npc';
    for (const h of book?.hypnosis || []) {
        const main = `${h.who} · ${h.now === 'awake' ? 'awake' : `${h.now} trance`}`;
        const sub = [h.by ? `by ${h.by}` : '', h.susceptibility ? `${h.susceptibility} susceptibility` : '', h.times ? `under ${h.times}×, deepest ${h.deepest || 'light'}` : '',
            h.suggestions.length ? `${h.suggestions.length} suggestion${h.suggestions.length > 1 ? 's' : ''}: ${h.suggestions.map(x => x.text).join('; ')}` : '',
            h.triggers.length ? `triggers: ${h.triggers.map(x => `"${x.cue}"`).join(', ')}` : ''].filter(Boolean).join(' · ');
        box.append(panelRow(main, sub, h.user_knows === 'no', mine(h.by), 'fa-circle-dot'));
    }
    for (const w of book?.control || []) {
        box.append(panelRow(`${w.who.join(', ')}${w.by ? ` ← ${w.by}` : ''}${w.resists === 'yes' ? ' · resisting' : ''}`, [...w.set.map(x => `${x.kind} ${x.text}`), w.own ? `own: ${w.own}` : ''].filter(Boolean).join(' · '), w.user_knows === 'no', mine(w.by), 'fa-hand-sparkles'));
    }
    for (const e of book?.perception || []) {
        const who = e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(', ')}` : ''}` : e.who.join(', ');
        const main = e.kind === 'unseen' ? `${who} can't perceive ${e.target}` : `${who}: ${e.kind === 'false' ? 'believes' : 'takes as normal'}`;
        box.append(panelRow(main, [e.what, e.by ? `by ${e.by}` : ''].filter(Boolean).join(' · '), e.user_knows === 'no', mine(e.by), 'fa-eye-slash'));
    }
    if (isEmptyBook(book)) {
        box.append($('<div class="wh-empty"></div>').text(settings().ledger.enabled
            ? 'Nothing yet. It fills in when someone is hypnotized, controlled, or has their perception changed. Tap ✏️ to add something yourself.'
            : 'The Mind Book is off with the Body Ledger (Settings → Choices).'));
    }
}

// ------------------------------------------------------------------ body checks

function checksStatus(text) {
    $('#wh_checks_status').text(text);
    console.log(LOG, text);
}

function lastReplyIndex() {
    const chat = ctx().chat;
    for (let i = chat.length - 1; i >= 0; i--) if (!chat[i].is_user && !chat[i].is_system) return i;
    return -1;
}

function writeMessage(msg, text) {
    msg.mes = text;
    if (Array.isArray(msg.swipes) && typeof msg.swipe_id === 'number') msg.swipes[msg.swipe_id] = text;
}

// One record per reply, shared with the WH Editor: the text before anything changed it, and the text now. A second
// pass on the same reply extends the record, so ⟲ still goes all the way back to the original.
function recordEdit(msg, before, after, applied) {
    const prev = msg.extra?.wh_edit;
    const rec = prev && prev.edited === before
        ? { original: prev.original, edited: after, applied: [...(prev.applied || []), ...applied], at: Date.now() }
        : { original: before, edited: after, applied, at: Date.now() };
    msg.extra ??= {};
    msg.extra.wh_edit = rec;
    const info = msg.swipe_info?.[msg.swipe_id];
    if (info) { info.extra ??= {}; info.extra.wh_edit = rec; }
}

/**
 * The Ledger's two checks on a reply, whenever it has someone in another body (Text Completion replies included):
 * pronouns for a body and for the mind inside it, then cut-only body rules (bodies of one mind talking to each
 * other, narration pointing at who is inside, anything that gives away a change the player doesn't know about).
 * Both run on the Ledger's model. Returns the time taken in ms, or null when there was nothing to check.
 */
async function runBodyChecks(mesId) {
    const head = headLedger(mesId + 1);
    if (!head || !hasCrossedBodies(head.ledger)) return null;
    // A known swap names people by who they are on purpose, so a chat whose only borrowed bodies are a known swap has
    // nothing for either check (no pronoun to move, no pointer to cut).
    const pronouns = needsPronounCheck(head.ledger);
    if (!pronouns && !head.ledger.bodies.some(b => b.user_knows === 'no' && b.body && b.driver)) return null;
    const msg = ctx().chat?.[mesId];
    if (!msg || msg.is_user || msg.is_system || !msg.mes || !looksLikeRoleplay(msg.mes)) return null;
    // The WH Editor works on the same reply: let it finish first, so the two never edit it at once.
    await new Promise(r => setTimeout(r, 0));
    await globalThis.WHEditor?.whenDone?.(mesId);

    const t0 = performance.now();
    const original = ctx().chat?.[mesId]?.mes;
    if (!original) return null;
    let text = original;
    const applied = [];
    if (pronouns) try {
        const out = applyPronounFixes(text, parsePronounResponse(await askLedger(buildPronounMessages(text, head.ledger), 500, 0.1)), head.ledger);
        text = out.text;
        applied.push(...out.applied.map(a => ({ action: 'PRONOUN', ...a })));
        if (out.rejected.length) console.debug(LOG, 'rejected pronoun fixes', out.rejected);
    } catch { /* the cuts can still run */ }
    try {
        const out = applyCuts(text, parseLintResponse(await askLedger(buildLintMessages(text, head.ledger, ctx().name1 || 'User'), 500, 0.1)));
        text = out.text;
        applied.push(...out.applied);
        if (out.rejected.length) console.debug(LOG, 'rejected cuts', out.rejected);
    } catch { /* the pronoun fixes still stand */ }

    const ms = Math.round(performance.now() - t0);
    const now = ctx().chat?.[mesId];
    if (!now || now.mes !== original) { checksStatus('Body checks: the reply changed while it was being checked, so nothing was applied.'); return ms; }
    if (!applied.length) { checksStatus('Body checks: nothing to fix.'); return ms; }
    writeMessage(now, text);
    recordEdit(now, original, text, applied);
    ctx().updateMessageBlock(mesId, now);
    markEdited(mesId);
    await ctx().saveChat();
    checksStatus(`Body checks: ${applied.length} fix${applied.length > 1 ? 'es' : ''}. ⟲ in the message menu restores the original.`);
    console.debug(LOG, 'applied', applied);
    return ms;
}

async function toggleEdit(mesId) {
    const msg = ctx().chat?.[mesId];
    const rec = msg?.extra?.wh_edit;
    if (!rec) { toastr.info('No Worldhopper changes on this message.'); return; }
    let target;
    if (msg.mes === rec.edited) target = rec.original;
    else if (msg.mes === rec.original) target = rec.edited;
    else { toastr.warning('This message was changed after it was fixed, so it can’t be toggled.'); return; }
    writeMessage(msg, target);
    ctx().updateMessageBlock(mesId, msg);
    markEdited(mesId);
    await ctx().saveChat();
    toastr.success(target === rec.original ? 'Original reply restored.' : 'Fixes re-applied.');
}

function markEdited(mesId) {
    const msg = ctx().chat?.[mesId];
    $(`#chat .mes[mesid="${mesId}"]`).toggleClass('wh-edited', !!msg?.extra?.wh_edit);
}
function markAll() {
    $('#chat .mes').each((_, el) => markEdited(Number($(el).attr('mesid'))));
}

// ------------------------------------------------------------------ pipeline

// Resolves once the Ledger has caught up with the latest reply. The next generation waits on it (briefly), so a
// fast reply from the player never goes out with the previous turn's ledger.
let ledgerReady = Promise.resolve();
const LEDGER_WAIT_MS = 8000;

// What the Engine cost each turn, kept on the reply as extra.wh_timing so a slow turn can be traced afterward:
// wait = how long the reply waited for the Ledger before it was sent; ledger, checks = the work after it came back
// (ms). The reply's own time is ST's gen_started → gen_finished, which includes the wait.
let lastWait = 0;
function noteTiming(mesId, timing) {
    const msg = ctx().chat?.[mesId];
    if (!msg) return;
    msg.extra ??= {};
    msg.extra.wh_timing = { ...msg.extra.wh_timing, ...timing };
    const info = msg.swipe_info?.[msg.swipe_id];
    if (info) { info.extra ??= {}; info.extra.wh_timing = msg.extra.wh_timing; }
    const t = msg.extra.wh_timing, s = ms => `${(ms / 1000).toFixed(1)}s`;
    const parts = [t.wait > 200 ? `waited ${s(t.wait)} for the ${t.ledger != null ? 'Ledger' : 'Mind Book'}` : '', t.ledger != null ? `Ledger ${s(t.ledger)}` : '', t.mind != null ? `Mind Book ${s(t.mind)}` : '', t.checks != null ? `body checks ${s(t.checks)}` : ''].filter(Boolean);
    if (parts.length) $('#wh_turn_timing').text(`Last turn: ${parts.join(' · ')}`);
}

function onMessageReceived(mesId, type) {
    if (!on() || ['quiet', 'impersonate', 'command', 'first_message'].includes(type)) return;
    const wait = lastWait;
    lastWait = 0;
    const key = chatKey();
    let done;
    ledgerReady = new Promise(r => (done = r));
    enqueue(async () => {
        let ended = [];
        const timing = { wait: Math.round(wait) };
        try {
            if (ledgerWanted() && !ledgerProfile()) ledgerStatus(`Ledger: ${unreachable('')}.`);
            else if (ledgerWanted()) {
                setLedgerBusy(true);
                const r = await updateLedger(mesId);
                ended = r.ended;
                if (r.ok) timing.ledger = r.ms;
            }
            if (mindWanted() && ledgerProfile()) {
                const m = await updateMind(mesId);
                if (m) timing.mind = m.ms;
            }
        } finally {
            setLedgerBusy(false);
            done();
        }
        const checks = ledgerWanted() && ledgerProfile() ? await runBodyChecks(mesId) : null;
        if (checks != null) timing.checks = checks;
        await runMindCuts(mesId);
        if (chatKey() === key) { noteTiming(mesId, timing); await ctx().saveChat(); }
        // After the checks, so the reply is final and the fix you see isn't held up by it. A separate notes model
        // runs alongside the queue instead of holding up the next reply's Ledger; a shared one waits its turn.
        if (ended.length) {
            const notes = noteEndedRides(mesId, ended).catch(err => console.warn(LOG, err));
            if (notesProfile() === ledgerProfile()) await notes;
        }
        // A body taken for the first time gets its host persona the same way. Pictures that draw on their own come
        // after the sheets (a host's is drawn from theirs) and never hold anything up: drawing takes a while.
        const sheets = ledgerWanted() ? ensurePersonas().catch(err => console.warn(LOG, err)) : Promise.resolve();
        sheets.then(ensurePictures).catch(err => console.warn(LOG, err));
        if (ledgerWanted() && notesProfile() === ledgerProfile()) await sheets;
    });
}

// Editing the newest reply (writing a possession in or out of it, say) has the Ledger and the Mind Book read it again, so
// what they hold matches the page. Older replies aren't re-read: every snapshot after them was built on the old text.
let editTimer = null;
function onMessageEdited(id) {
    const mesId = Number(id);
    if (!on() || mesId !== lastReplyIndex()) return;
    clearTimeout(editTimer);
    editTimer = setTimeout(() => rereadReply(mesId), 500);
}
function rereadReply(mesId) {
    const key = chatKey();
    const current = () => chatKey() === key && mesId === lastReplyIndex() && !!ctx().chat?.[mesId];
    if (!current() || !ledgerProfile() || (!ledgerWanted() && !mindWanted())) return;
    let done;
    ledgerReady = new Promise(r => (done = r));
    enqueue(async () => {
        let ended = null;
        try {
            if (!current()) return;
            if (ledgerWanted()) {
                setLedgerBusy(true);
                const r = await updateLedger(mesId);
                if (r.ok) ended = r.ended;
            }
            if (mindWanted() && current()) await updateMind(mesId);
        } finally {
            setLedgerBusy(false);
            done();
        }
        // The history notes follow the re-read: new ones for what the edited reply ends, none if it ends nothing now.
        if (ended && current()) {
            const msg = ctx().chat[mesId];
            if (ended.length) await noteEndedRides(mesId, ended);
            else if (msg.extra?.wh_history) {
                delete msg.extra.wh_history;
                delete msg.swipe_info?.[msg.swipe_id]?.extra?.wh_history;
                await ctx().saveChat();
                renderLedgerPanel();
            }
        }
        if (ledgerWanted()) await ensurePersonas().catch(err => console.warn(LOG, err));
        ensurePictures().catch(err => console.warn(LOG, err));
    });
}

// An update still running when you switch chats is dropped (it can't be written into the chat you moved to), so the
// newest reply comes back without a Ledger entry, and a chat's first reply comes back with no Ledger at all. Opening
// the chat catches that reply up. The greeting alone is left for the first reply, as before.
function catchUpLedger() {
    const key = chatKey();
    const i = lastReplyIndex();
    const behind = () => chatKey() === key && i > 0 && !!ctx().chat?.[i] && !ctx().chat[i].extra?.wh_ledger && ledgerWanted() && !!ledgerProfile();
    if (!behind()) return;
    let done;
    ledgerReady = new Promise(r => (done = r));
    enqueue(async () => {
        try {
            if (!behind()) return;   // the dropped update may have landed after all, if you came straight back
            setLedgerBusy(true);
            await updateLedger(i);
        } finally {
            setLedgerBusy(false);
            done();
        }
    });
}

async function onGenerationStarted(type, _options, dryRun) {
    if (on() && !dryRun && type !== 'quiet') {
        const t0 = performance.now();
        await Promise.race([ledgerReady, new Promise(r => setTimeout(r, LEDGER_WAIT_MS))]);
        const waited = performance.now() - t0;
        lastWait = waited;
        if (waited > 200) console.log(LOG, `waited ${(waited / 1000).toFixed(1)}s for the Ledger before generating`);
    }
    applyLedgerInjection(type);
}

// ------------------------------------------------------------------ panels

function fillProfileSelect(id, value, emptyLabel) {
    const sel = $(id).empty();
    const profiles = ctx().extensionSettings.connectionManager?.profiles || [];
    if (emptyLabel) sel.append($('<option></option>').val('').text(emptyLabel));
    for (const p of profiles) sel.append($('<option></option>').val(p.name).text(p.name));
    if (value && !profiles.some(p => p.name === value)) sel.append($('<option></option>').val(value).text(`${value} (missing)`));
    sel.val(value || '');
}

function renderModelSelects() {
    const s = settings();
    fillProfileSelect('#wh_ledger_profile', s.ledger.profile, '— pick a profile —');
    fillProfileSelect('#wh_ledger_notes_profile', s.ledger.notesProfile, 'Same as Ledger');
    renderPictureSelects();
    $('#wh_no_profiles').toggle(!(ctx().extensionSettings.connectionManager?.profiles || []).length);
}

/** Settings → Pictures: what Image Generation is set to, and its own styles, models and workflows to pick from. */
function renderPictureSelects() {
    const p = settings().pictures;
    const sd = ctx().extensionSettings.sd;
    const source = $('#sd_source option:selected').text().trim() || sd?.source || '';
    $('#wh_pictures_source').text(imageGenOn()
        ? `Drawn by Image Generation as you've set it up (${source}). Anything left on "As set" follows it.`
        : 'Image Generation is off: turn it on under Extensions → Image Generation and pick a source.');
    const fill = (id, options, value) => {
        const list = [...options];
        if (value && !list.some(o => o.value === value)) list.push({ value, label: `${value} (not offered now)` });
        $(id).empty().append($('<option></option>').val('').text('As set in Image Generation'), list.map(o => $('<option></option>').val(o.value).text(o.label))).val(value || '');
    };
    fill('#wh_pictures_style', (sd?.styles || []).map(x => ({ value: x.name, label: x.name })), p.style);
    fill('#wh_pictures_model', sdOptions('sd_model'), p.model);
    fill('#wh_pictures_workflow', sdOptions('sd_comfy_workflow'), p.workflow);
    // A workflow only means something to a source that has them.
    $('#wh_pictures_workflow_row').toggle(sdOptions('sd_comfy_workflow').length > 0);
    $('#wh_pictures_shape').val(p.shape || '');
    $('#wh_pictures_rewrite').val(p.rewrite ? 'yes' : '');
}

function renderWorldSelect() {
    const s = settings().codex;
    const names = Array.isArray(world_names) ? world_names : [];
    const sel = $('#wh_codex_world').empty();
    for (const n of names) sel.append($('<option></option>').val(n).text(n));
    if (s.world && !names.includes(s.world)) sel.append($('<option></option>').val(s.world).text(`${s.world} (not installed)`));
    sel.val(s.world);
}

async function addSettingsPanel() {
    const html = await (await fetch(new URL('./settings.html', import.meta.url))).text();
    $('#extensions_settings2').append(html);
    const s = settings();
    const bind = (id, get, set) => $(id).prop('checked', get()).on('change', function () { set(this.checked); save(); });
    // Ledger and history rows keep their details to one line; tap a row to read it all.
    $('#wh_ledger_summary, #wh_ledger_history').on('click', '.wh-expandable', function () { $(this).toggleClass('wh-open'); });
    // (?) opens a short how-to under its heading; tap again to close. Works the same on phones, unlike tooltips.
    $('.worldhopper-settings').on('click keydown', '.wh-help-toggle', function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();   // the Settings heading is also a drawer toggle
        const key = $(this).data('help');
        const open = !$(this).hasClass('wh-on');
        $(this).toggleClass('wh-on', open);
        $(`.worldhopper-settings .wh-help[data-help="${key}"]`).toggleClass('wh-open', open);
    });
    // A picked mode says what it means when tapped (the tooltip only works with a mouse).
    $('#wh_codex_picked').on('click', '.wh-chip', function () {
        const m = $(this).data('mode');
        const shown = $('#wh_codex_blurb').data('mode');
        $('#wh_codex_blurb').remove();
        if (shown !== m) $(this).parent().after($('<div id="wh_codex_blurb" class="wh-blurb"></div>').data('mode', m).append($('<b></b>').text(m), `: ${MODE_BLURBS[m] || ''}`));
    });

    // The heading's switch: a click on it mustn't also open or close the drawer it sits in.
    $('.wh-power').on('click', e => e.stopPropagation());
    bind('#wh_enabled', () => s.enabled, v => { settings().enabled = v; applyPower(); });
    $('#wh_codex_modes').on('change', 'input[type="checkbox"]', onModeToggle);
    $('#wh_codex_suggest_now').on('click', () => enqueue(() => suggestModes({ force: true })));
    $('#wh_codex_edit').on('click', () => { pickerOpen = !$('#wh_codex_modes').is(':visible'); renderCodexPanel(); });
    $('#wh_codex_apply_suggestion').on('click', () => { const t = selectionTarget(); if (t) applySuggestion(t.key); });
    $('#wh_codex_preset_on').on('click', switchOnPresetHelpers);

    bind('#wh_ledger_enabled', () => s.ledger.enabled, v => { settings().ledger.enabled = v; applyLedgerInjection(); renderLedgerPanel(); });
    bind('#wh_pictures_auto', () => s.pictures.auto, v => { settings().pictures.auto = v; if (v) ensurePictures().catch(err => console.warn(LOG, err)); });
    for (const k of ['style', 'model', 'workflow', 'shape']) $(`#wh_pictures_${k}`).on('change', function () { settings().pictures[k] = String($(this).val() || ''); save(); });
    $('#wh_pictures_rewrite').on('change', function () { settings().pictures.rewrite = $(this).val() === 'yes'; save(); });
    // Image Generation's lists can change while the panel is open (another source, a new style): read them again on the way in.
    $('#wh_pictures_box').on('mouseenter focusin', () => { if (!$('#wh_pictures_box select:focus').length) renderPictureSelects(); });
    $('#wh_ledger_backfill').on('click', backfillHistory);
    $('#wh_ledger_notes_profile').on('change', function () { settings().ledger.notesProfile = String($(this).val() || ''); save(); });
    $('#wh_ledger_profile').on('change', function () { settings().ledger.profile = String($(this).val() || ''); save(); });
    $('#wh_codex_world').on('change', function () { settings().codex.world = String($(this).val() || ''); save(); renderWorldSelect(); renderCodexPanel(); syncCodexBook(); })
        .on('focus mousedown', () => { if ($('#wh_codex_world option').length !== (world_names?.length || 0)) renderWorldSelect(); });
    $('#wh_codex_update_now').on('click', () => syncCodexBook({ force: true }).catch(err => toastr.error(err.message)));
    $('#wh_ledger_open').on('click', openLedgerView);
    $('#wh_mind_open').on('click', openMindView);
    $('#wh_ledger_rebuild').on('click', () => {
        const i = (ctx().chat?.length || 0) - 1;
        if (i < 0) return;
        ledgerStatus('Rebuilding from the card and recent messages…');
        enqueue(() => updateLedger(i, { rebuild: true }));
    });

    renderModelSelects();
    renderWorldSelect();
    renderCodexPanel();
    renderLedgerPanel();
    applyPower();
}

/** Show the panel for Worldhopper on or off, and take its prompts out (or put them back) right away. */
function applyPower() {
    const live = on();
    $('#wh_enabled').prop('checked', live);
    $('#wh_off_note').toggle(!live);
    $('.worldhopper-settings .wh-body > .wh-card, .worldhopper-settings .wh-body > .wh-status').toggle(live);
    applyLedgerInjection();
    renderCodexPanel();
    renderLedgerPanel();
    renderLanes();
    if (live) catchUpLedger();
}

function addMessageButton() {
    // The WH Editor adds the same button: whichever loads first adds it, and only one click handler is bound.
    if (!$('#message_template .wh-undo').length) {
        $('#message_template .mes_buttons .extraMesButtons').prepend('<div title="Worldhopper: toggle original / fixed" class="mes_button wh-undo fa-solid fa-rotate-left"></div>');
    }
    if (globalThis.whUndoBound) return;
    globalThis.whUndoBound = true;
    $(document).on('click', '.wh-undo', function () {
        toggleEdit(Number($(this).closest('.mes').attr('mesid')));
    });
}

// The style Editor used to be part of the Engine. Anyone who had it on hears once where it went.
function noteEditorMoved() {
    const s = settings();
    if (s.editorMovedNoted || !s.editor || s.editor.enabled === false || globalThis.WHEditor) return;
    s.editorMovedNoted = true;
    save();
    toastr.info('The Editor is its own extension now: install <b>WH Editor</b> to keep its line fixes. Your settings and slop list carry over.',
        'Worldhopper', { timeOut: 0, extendedTimeOut: 0, escapeHtml: false, onclick: () => window.open('https://github.com/Coz-rp/SillyTavern-WH-Editor', '_blank') });
}

function addWandButton() {
    const item = $('<div id="wh_ledger_wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="Who is in which body"><div class="fa-solid fa-people-arrows extensionsMenuExtensionButton"></div><span>Body Ledger</span></div>');
    item.on('click', openLedgerView);
    $('#extensionsMenu').append(item);
    const make = $('<div class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="From a card-builder chat: turn the finished pieces into a real character, modes and all"><div class="fa-solid fa-id-card extensionsMenuExtensionButton"></div><span>Make card</span></div>');
    const check = $('<div class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="Check the open character\'s card for things that trip models up"><div class="fa-solid fa-stethoscope extensionsMenuExtensionButton"></div><span>Check card</span></div>');
    make.on('click', () => makeCard().catch(err => toastr.error(err.message)));
    check.on('click', () => checkCard().catch(err => toastr.error(err.message)));
    $('#extensionsMenu').append(make, check);
    addPowerButtons();
}

// Power buttons, for switching things off from another device. They need the optional wh-power server plugin, so they
// only appear when it answers.
async function addPowerButtons() {
    try {
        const res = await fetch('/api/plugins/wh-power/status', { headers: ctx().getRequestHeaders() });
        if (!res.ok) return;
    } catch { return; }
    const shutdown = $('<div class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="Shut SillyTavern down on the PC"><div class="fa-solid fa-power-off extensionsMenuExtensionButton"></div><span>Shut down SillyTavern</span></div>');
    shutdown.on('click', () => powerShutdown());
    $('#extensionsMenu').append(shutdown);
}

// ------------------------------------------------------------------ card tools

/** ST's settings for whether a card's own main prompt / post-history replace the preset's. */
const preferCard = () => ({ system: ctx().powerUserSettings?.prefer_character_prompt !== false, postHistory: ctx().powerUserSettings?.prefer_character_jailbreak !== false });

function personaNames() {
    const c = ctx();
    return [...Object.values(c.powerUserSettings?.personas || {}), c.name1].filter(Boolean);
}

/** Exact count with ST's tokenizer for the current model; the estimate if that fails. */
async function countTokens(text) {
    try { return await ctx().getTokenCountAsync(String(text || '')); } catch { return estimateTokens(text); }
}

function doctorList(issues) {
    const list = $('<div class="wh-doctor"></div>');
    if (!issues.length) return list.append($('<div class="wh-doctor-ok"><i class="fa-solid fa-check"></i> No problems found.</div>'));
    for (const i of issues) {
        list.append($(`<details class="wh-doctor-item wh-${i.level}"></details>`).append(
            $('<summary></summary>').append($(`<i class="fa-solid ${i.level === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>`), $('<span></span>').text(i.title)),
            $('<div class="wh-doctor-detail"></div>').append(i.quote ? $('<q></q>').text(i.quote) : '', $('<div></div>').text(i.detail))));
    }
    return list;
}

/** Turn the labeled blocks of a card-builder chat into a new character, with its Codex modes already picked. */
async function makeCard() {
    const c = ctx();
    if (!c.chat?.length) { toastr.info('Open the card-builder chat first.'); return; }
    // The visible swipe of each message; narrator/system notices aren't part of the build.
    const card = buildCard(parseBuilderChat(c.chat.filter(m => !m.extra?.type).map(m => ({ text: m.mes, is_user: !!m.is_user }))));
    const d = card.data;
    if (!d.description && !d.first_mes) {
        toastr.warning('No card pieces found in this chat. The builder writes each one under a label line like --- DESCRIPTION ---.');
        return;
    }
    const chatModes = d.extensions.worldhopper.modes;
    const root = $('<div class="wh-cardtool"></div>').append('<h3>Make card</h3>');
    const nameIn = $('<input class="text_pole" type="text" placeholder="Name">').val(d.name);
    root.append($('<label class="wh-card-name"></label>').append('<small>Name</small>', nameIn));
    const dupe = $('<small class="wh-muted"></small>');
    const checkDupe = () => dupe.text(c.characters.some(ch => ch.name === nameIn.val().trim()) ? 'You already have a character with this name; this makes a second one.' : '');
    nameIn.on('input', checkDupe);
    checkDupe();
    root.append(dupe);

    const rows = [
        ['Description', d.description], ['Personality', d.personality], ['Scenario', d.scenario], ['First message', d.first_mes],
        [`Alternate greetings (${d.alternate_greetings.length})`, d.alternate_greetings.join('\n')],
        ['Post-history instructions', d.post_history_instructions],
        [`Character's note (depth ${d.extensions.depth_prompt.depth})`, d.extensions.depth_prompt.prompt],
        ['Example messages', d.mes_example],
        [`Lorebook (${d.character_book?.entries.length || 0} entries)`, (d.character_book?.entries || []).map(e => e.content).join('\n')],
        ['Creator notes', d.creator_notes], ['System prompt', d.system_prompt],
    ].filter(([, text]) => text);
    const table = $('<div class="wh-card-fields"></div>');
    const counts = await Promise.all(rows.map(([, text]) => countTokens(text)));
    rows.forEach(([label], i) => table.append($('<span></span>').text(label), $('<span class="wh-muted"></span>').text(`${counts[i]} tokens`)));
    const alwaysTokens = await countTokens([d.description, d.personality, d.scenario].filter(Boolean).join('\n'));
    root.append(table);
    const missing = [!d.description && 'description', !d.first_mes && 'first message'].filter(Boolean);
    if (d.tags.length) root.append($('<div class="wh-muted"></div>').text(`Tags: ${d.tags.join(', ')}`));
    if (missing.length) root.append($('<div class="wh-card-missing"></div>').text(`Not in the chat yet: ${missing.join(', ')}.`));

    // Modes: the builder's picks, changeable here so the card starts with the right Codex entries.
    root.append($('<div class="wh-mini-title"></div>').text(chatModes.length ? 'Codex modes' : 'Codex modes (the chat didn\'t name any, so pick them here)'));
    const pills = $('<div class="wh-pills"></div>');
    for (const m of MODE_GROUPS.flatMap(([, list]) => list)) {
        const pill = $(`<label class="wh-pill${MODIFIERS.has(m) ? ' wh-modifier' : ''}"></label>`).attr('title', (MODE_BLURBS[m] || '') + (PARENT[m] ? ` (with ${PARENT[m]})` : ''));
        pills.append(pill.append($('<input type="checkbox">').prop('checked', chatModes.includes(m)).data('mode', m), $('<span></span>').text(m)));
    }
    const picked = () => pills.find('input:checked').map((_, el) => $(el).data('mode')).get();
    const doctor = $('<div></div>');
    const recheck = () => {
        const issues = doctorCard(d, { userNames: personaNames(), modes: [...expandModes(picked())], alwaysTokens, preferCard: preferCard() }).filter(i => !/^No Codex modes/.test(i.title));
        doctor.empty();
        if (issues.length) doctor.append('<div class="wh-mini-title">Card Doctor</div>', doctorList(issues));
    };
    pills.on('change', recheck);
    recheck();
    root.append(pills, doctor);

    const res = await c.callGenericPopup(root, c.POPUP_TYPE.CONFIRM, '', { wide: true, okButton: 'Create character', cancelButton: 'Cancel', allowVerticalScrolling: true });
    if (res !== c.POPUP_RESULT.AFFIRMATIVE) return;

    d.name = nameIn.val().trim() || d.name || 'New character';
    if (d.character_book) d.character_book.name = `${d.name} lore`;
    const modes = d.extensions.worldhopper.modes = picked();
    const form = new FormData();
    form.append('avatar', new File([JSON.stringify(card)], 'card.json', { type: 'application/json' }));
    form.append('file_type', 'json');
    form.append('user_name', c.name1);
    const r = await fetch('/api/characters/import', { method: 'POST', body: form, headers: c.getRequestHeaders({ omitContentType: true }), cache: 'no-cache' });
    const out = r.ok ? await r.json() : { error: true };
    if (out.error || !out.file_name) { toastr.error('SillyTavern couldn\'t create the character.'); return; }
    const avatar = `${out.file_name}.png`;
    if (modes.length) { settings().codex.selections['char:' + avatar] = modes; save(); }
    await c.getCharacters();
    const ch = ctx().characters.find(x => x.avatar === avatar);
    if (ch && ctx().powerUserSettings?.tag_import_setting !== 2) await ctx().importTags(ch);   // 2 = never import tags
    toastr.success(`${d.name}${modes.length ? ` (${modes.join(', ')})` : ''}. Click to open it; set a picture by clicking its avatar.`, 'Card created', {
        timeOut: 15000, extendedTimeOut: 10000, closeButton: true,
        onclick: () => { const id = ctx().characters.findIndex(x => x.avatar === avatar); if (id >= 0) ctx().selectCharacterById(String(id)); },
    });
}

/** The Codex's own definitions of these modes, so the deeper review can check the card against them. */
async function codexText(modes) {
    if (!modes.length) return '';
    const data = await loadWorldInfo(settings().codex.world).catch(() => null);
    const want = new Set(modes);
    return Object.values(data?.entries || {})
        .filter(e => { const t = String(e.comment || '').trim(); return t.startsWith('👁 ') && want.has(t.slice(2).trim()); })
        .map(e => `${e.comment}\n${e.content}`).join('\n\n');
}

async function checkCard() {
    const c = ctx();
    const t = selectionTarget();
    if (!t?.character) { toastr.info('Open a character first (group chats aren\'t checked).'); return; }
    const ch = t.character;
    const d = { ...(ch.data || {}), name: ch.name, description: ch.description, personality: ch.personality, scenario: ch.scenario, first_mes: ch.first_mes, mes_example: ch.mes_example };
    const modes = [...expandModes(currentModes())];
    const always = await countTokens([d.description, d.personality, d.scenario].filter(Boolean).join('\n'));
    const issues = doctorCard(d, { userNames: personaNames(), modes, tool: !!d.extensions?.worldhopper?.tool, alwaysTokens: always, preferCard: preferCard() });

    const root = $('<div class="wh-cardtool"></div>').append($('<h3></h3>').text(`Check card · ${ch.name}`));
    const greetings = 1 + (d.alternate_greetings?.length || 0);
    root.append($('<div class="wh-muted"></div>').text(`${always} tokens every reply · ${greetings} greeting${greetings === 1 ? '' : 's'} · modes: ${modes.join(', ') || 'none'}`));
    root.append(doctorList(issues));
    const btn = $('<div class="menu_button wh-card-review"><i class="fa-solid fa-magnifying-glass"></i><span>Deeper review</span></div>')
        .attr('title', `${notesProfile() || 'The notes model'} reads the whole card against the Codex (one request, usually under a minute)`);
    const out = $('<div class="wh-card-review-out"></div>');
    // A thorough read takes a while, so the button counts the seconds, a second click cancels, and after
    // REVIEW_TIMEOUT it gives up rather than spinning forever.
    let running = null;
    btn.on('click', async () => {
        if (running) { running.abort(); return; }
        const job = running = new AbortController();
        const timer = setTimeout(() => job.abort(new Error('timeout')), REVIEW_TIMEOUT_MS);
        const t0 = Date.now();
        const label = btn.find('span');
        const tick = () => label.text(`Reviewing with ${notesProfile() || 'the notes model'}… ${Math.round((Date.now() - t0) / 1000)} s · tap to cancel`);
        tick();
        const ticker = setInterval(tick, 1000);
        btn.addClass('wh-busy').find('i').attr('class', 'fa-solid fa-spinner fa-spin');
        out.html('<small class="wh-muted">A thorough read usually takes under a minute.</small>');
        try {
            // A generous ceiling: on explicit cards Claude spends hidden tokens before it answers.
            const text = await askProfile(notesProfile(), buildReviewMessages(d, modes, await codexText(modes), { tool: !!d.extensions?.worldhopper?.tool }), 4000, 0.3, { signal: job.signal });
            // Escaped first, then only **bold** is turned back into markup.
            const safe = $('<div></div>').text(text.trim() || 'The model returned nothing. Try again.').html();
            out.html(safe.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'));
        } catch (err) {
            out.text(job.signal.aborted
                ? (job.signal.reason?.message === 'timeout' ? `No answer after ${REVIEW_TIMEOUT_MS / 60000} minutes, so the review stopped. Check the Notes model under Settings → Models, or try again.` : 'Review canceled.')
                : `Couldn't run the review: ${err.message}`);
        } finally {
            clearTimeout(timer);
            clearInterval(ticker);
            running = null;
            label.text('Deeper review');
            btn.removeClass('wh-busy').find('i').attr('class', 'fa-solid fa-magnifying-glass');
        }
    });
    root.append(btn, out);
    await c.callGenericPopup(root, c.POPUP_TYPE.TEXT, '', { wide: true, okButton: 'Close', allowVerticalScrolling: true });
}

// ------------------------------------------------------------------ power (phone off-switch)

async function power(path, method = 'POST') {
    const res = await fetch(`/api/plugins/wh-power/${path}`, { method, headers: ctx().getRequestHeaders() });
    if (res.status === 404) throw new Error('The wh-power server plugin isn\'t loaded.');
    if (!res.ok) throw new Error(`Power request failed (${res.status}).`);
    return res.json();
}

async function powerShutdown() {
    const c = ctx();
    let st = {};
    try { st = await power('status', 'GET'); } catch (err) { toastr.error(err.message); return; }
    const box = $('<div></div>').append($('<p></p>').text('Shut SillyTavern down on the PC? This tab will stop working until you start ST again.'));
    const ok = await c.callGenericPopup(box, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Shut down', cancelButton: 'Cancel' });
    if (ok !== c.POPUP_RESULT.AFFIRMATIVE) return;
    try {
        // Make sure nothing unsaved is lost, then switch off.
        await c.saveSettings?.();
        if (c.chat?.length && c.getCurrentChatId?.()) await c.saveChat();
        await power('shutdown');
        toastr.success('SillyTavern is shutting down. You can close this tab.', '', { timeOut: 0, extendedTimeOut: 0 });
    } catch (err) { toastr.error(err.message); }
}

function addSlashCommands() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'wh-modes',
        callback: async (_args, value) => {
            const v = String(value ?? '').trim();
            if (v) {
                const want = v.toLowerCase() === 'none' ? [] : v.split(',').map(x => x.trim()).map(x => ALL_MODES.find(m => m.toLowerCase() === x.toLowerCase())).filter(Boolean);
                setModes(want);
                renderCodexPanel();
                renderLedgerPanel();
            }
            const cur = [...expandModes(currentModes())];
            return cur.length ? cur.join(', ') : 'none';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'comma-separated modes, or "none"; omit to show the current picks', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        helpString: 'Show or set the Worldhopper Codex modes for the current character or group, e.g. /wh-modes Possession, Skinsuit',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'wh-mind',
        callback: async (_args, value) => {
            if (String(value ?? '').trim().toLowerCase() === 'edit') { await openMindView(); return ''; }
            const head = headMind();
            return head ? renderMindBook(head.book, ctx().name1 || 'User', { kinds: MIND_KINDS }) || 'empty' : 'no Mind Book yet';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '"edit" to open the editor; omit to show the Mind Book', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        helpString: 'Show the Mind Book (what Hypnosis, Mind Control and Altered Perception have put into people), or open its editor (/wh-mind edit).',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'wh-ledger',
        callback: async (_args, value) => {
            const v = String(value ?? '').trim().toLowerCase();
            if (v === 'rebuild') { const i = (ctx().chat?.length || 0) - 1; if (i >= 0) await enqueue(() => updateLedger(i, { rebuild: true })); }
            else if (v === 'edit') { await openLedgerView(); }
            else if (v === 'history') { return historyText() || 'no past body changes yet'; }
            else if (v === 'backfill') { await backfillHistory(); return historyText() || 'no past body changes found'; }
            const head = headLedger();
            return head ? renderLedger(head.ledger, ctx().name1 || 'User') || 'empty' : 'no ledger yet';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '"rebuild", "edit", "history" or "backfill"; omit to show the ledger', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        helpString: 'Show the Body Ledger, rebuild it from the chat (/wh-ledger rebuild), open the editor (/wh-ledger edit), show the Body History (/wh-ledger history), or build the history from every earlier reply (/wh-ledger backfill).',
    }));
}

jQuery(async () => {
    try {
        settings();
        guardSendRequest();
        await addSettingsPanel();
        addMessageButton();
        addWandButton();
        addSlashCommands();
        const { eventSource, event_types } = ctx();
        eventSource.on(event_types.WORLDINFO_ENTRIES_LOADED, onEntriesLoaded);
        eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
        if (event_types.MESSAGE_SENT) eventSource.on(event_types.MESSAGE_SENT, () => applyLedgerInjection());
        eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
        if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, onMessageEdited);
        // The preset nudge follows the active preset and its toggles (ticking a block saves the settings).
        for (const ev of [event_types.OAI_PRESET_CHANGED_AFTER, event_types.SETTINGS_UPDATED, event_types.MAIN_API_CHANGED]) {
            if (ev) eventSource.on(ev, () => setTimeout(renderPresetNudge, 0));
        }
        eventSource.on(event_types.CHAT_CHANGED, () => {
            pickerOpen = null;
            renderCodexPanel(); renderLedgerPanel(); renderModelSelects(); renderWorldSelect(); applyLedgerInjection();
            setTimeout(markAll, 0);
            catchUpLedger();
            enqueue(() => suggestModes());
        });
        // Keep the Models and Codex lorebook lists current as profiles and lorebooks come and go.
        for (const ev of [event_types.CONNECTION_PROFILE_CREATED, event_types.CONNECTION_PROFILE_DELETED, event_types.CONNECTION_PROFILE_UPDATED]) {
            if (ev) eventSource.on(ev, () => setTimeout(renderModelSelects, 0));
        }
        // The lorebook list is known once the app is ready (fires at once if it already is).
        eventSource.on(event_types.APP_READY, () => syncCodexBook().catch(err => console.warn(LOG, 'Codex install', err)));
        eventSource.on(event_types.APP_READY, () => { try { syncDisplayScripts(); } catch (err) { console.warn(LOG, 'display scripts', err); } });
        eventSource.on(event_types.APP_READY, noteEditorMoved);
        if (event_types.WORLDINFO_SETTINGS_UPDATED) eventSource.on(event_types.WORLDINFO_SETTINGS_UPDATED, () => { renderWorldSelect(); renderCodexPanel(); });
        for (const ev of [event_types.CHARACTER_MESSAGE_RENDERED, event_types.MESSAGE_UPDATED, event_types.MESSAGE_SWIPED]) {
            if (ev) eventSource.on(ev, (id) => setTimeout(() => markEdited(Number(id)), 0));
        }
        for (const ev of [event_types.MESSAGE_SWIPED, event_types.MESSAGE_DELETED]) {
            if (ev) eventSource.on(ev, () => { applyLedgerInjection(); renderLedgerPanel(); });
        }
        if (event_types.MORE_MESSAGES_LOADED) eventSource.on(event_types.MORE_MESSAGES_LOADED, () => setTimeout(markAll, 0));
        // Badges live in the message DOM, which ST re-renders freely: redraw after anything that renders messages.
        for (const ev of [event_types.USER_MESSAGE_RENDERED, event_types.CHARACTER_MESSAGE_RENDERED, event_types.MESSAGE_UPDATED,
            event_types.MESSAGE_SWIPED, event_types.MESSAGE_DELETED, event_types.MORE_MESSAGES_LOADED, event_types.CHAT_CHANGED]) {
            if (ev) eventSource.on(ev, () => setTimeout(renderBadges, 0));
        }
        console.log(LOG, 'loaded');
    } catch (err) {
        console.error(LOG, 'failed to load', err);
    }
});
