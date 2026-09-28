// Worldhopper Engine — SillyTavern extension.
//   Codex:  per-character metaphysics mode picks → switches on the matching entries of the Codex lorebook for
//           each generation (everything in that book is stored disabled; this is the only switch).
//           Plus a one-time mode suggestion per card.
//   Ledger: a Body Ledger (who is driving which body, the owner's state, powers) updated after each reply, stored
//           per message/swipe, and injected at depth 1 so the writer keeps names and pronouns straight.
//           Body History: past body changes, derived from those snapshots, plus a short note per ended one (what
//           the owner remembers, what was kept, what it left behind), injected at depth 4.
//   Editor: after a reply arrives, a rule pass flags suspect lines and a model fixes only those; then a pronoun
//           check against the Ledger. The original is kept; ⟲ in the message menu toggles back.
//   Cards:  Make card (a card-builder chat → a character with its modes) and Check card (Card Doctor).
// Each background job runs through a connection profile picked under Settings → Models.
import { ConnectionManagerRequestService } from '../../shared.js';
import { getPresetManager } from '../../../preset-manager.js';
import { loadWorldInfo, saveWorldInfo, updateWorldInfoList, world_names } from '../../../world-info.js';
import { detect, buildEditorMessages, parseEditorResponse, applyEdits, looksLikeRoleplay, collapseHedges, bannedPatterns } from './editor-core.js';
import { MODE_GROUPS, MODIFIERS, PARENT, ALL_MODES, MODE_BLURBS, expandModes, planEntry, buildSuggestMessages, parseSuggestResponse, DISPLAY_SCRIPTS } from './codex-core.js';
import {
    EMPTY_LEDGER, normalizeLedger, isEmptyLedger, buildLedgerMessages, parseLedger, parseLedgerUpdate, verifyNewRides, renderLedger, akaOf, aliasResolver,
    labelMultiRides, rosterOf,
    hasCrossedBodies, buildPronounMessages, parsePronounResponse, applyPronounFixes, buildLintMessages, parseLintResponse, applyCuts,
    endedRides, bodyHistory, renderHistory, historyGroups, buildHistoryMessages, parseHistoryResponse,
} from './ledger-core.js';
import { parseBuilderChat, buildCard, doctorCard, buildReviewMessages, estimateTokens } from './card-core.js';

const MODULE = 'worldhopper';
const LOG = '[Worldhopper]';
const LEDGER_KEY = 'worldhopper_ledger';
const HISTORY_KEY = 'worldhopper_history';
const HISTORY_DEPTH = 4;   // background, so a little further back than the Ledger at depth 1
const REVIEW_TIMEOUT_MS = 180000;   // Check card's deeper review: a slow model takes about a minute; past three, give up
const RECENT_REPLIES = 30;   // "Build history" can read just this many of the latest replies instead of the whole chat
const IN_CHAT = 1;   // extension_prompt_types.IN_CHAT
const SYSTEM = 0;    // extension_prompt_roles.SYSTEM
const DEFAULTS = {
    codex: { enabled: true, world: 'WH Metaphysics', anchors: true, details: true, initiative: true, suggest: true, selections: {}, suggested: {}, installedHash: '' },
    // Connection profiles, picked under Settings → Models. The Ledger runs after every reply, so a fast model suits
    // it; history notes need judgement about who remembers what, so a stronger model suits them.
    ledger: { enabled: true, strip: true, badges: true, lanes: true, lanesCompact: false, history: true, profile: '', notesProfile: '' },
    editor: {
        enabled: true,
        profile: '',
        onlyChatCompletion: true,
        temperature: 0.2,
        maxTokens: 600,
        maxCandidates: 8,
        pronouns: true,
        lint: true,
        personal: [],
        checks: { banlist: true, contrast: true, staccato: true, hedges: true, fragments: true, echo: true, repetition: true },
    },
};

const ctx = () => SillyTavern.getContext();

function settings() {
    const all = ctx().extensionSettings;
    const s = (all[MODULE] ??= {});
    s.codex = { ...DEFAULTS.codex, ...(s.codex || {}) };
    s.codex.selections ??= {};
    s.codex.suggested ??= {};
    const hadLedgerProfile = s.ledger && 'profile' in s.ledger;
    s.ledger = { ...DEFAULTS.ledger, ...(s.ledger || {}) };
    s.editor = { ...DEFAULTS.editor, ...(s.editor || {}) };
    s.editor.checks = { ...DEFAULTS.editor.checks, ...(s.editor.checks || {}) };
    // Before 0.2 the Ledger used the Editor's model; keep it that way for existing setups.
    if (!hadLedgerProfile) s.ledger.profile = s.editor.profile || '';
    return s;
}
const save = () => ctx().saveSettingsDebounced();

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
    // DRY off: an RP preset often uses it, and it penalises exactly what these jobs need — copying a sentence or
    // the previous ledger verbatim. With DRY on, the model paraphrases the text it is told to quote, and every
    // guarded fix gets rejected.
    const res = await ConnectionManagerRequestService.sendRequest(profile.id, messages, maxTokens, custom, { temperature, dry_multiplier: 0 });
    return typeof res === 'string' ? res : String(res?.content ?? '');
}

/** The Ledger's model: ledger updates, their checks, and mode suggestions. */
const ledgerProfile = () => settings().ledger.profile;
const askLedger = (messages, maxTokens, temperature) => askProfile(ledgerProfile(), messages, maxTokens, temperature);

/** The Editor's model: line fixes, the pronoun check and the body-rule cuts. */
const askEditor = (messages, maxTokens, temperature) => askProfile(settings().editor.profile, messages, maxTokens, temperature);

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
    if (!s.enabled) return;
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
            const plan = planEntry(e.comment, active, s);
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
    if (!t?.character || (!force && (!s.suggest || currentModes().length || s.suggested[t.key]))) return;
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
// Each mode's family ("occupancy", "overwrite"…), for its chip colour.
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
    else if (!s.enabled) chips.append('<span class="wh-empty">The Codex is off (Settings → Codex).</span>');
    else if (builder && !picked.size) chips.append('<span class="wh-empty">This is a card builder, so it has no modes of its own. When the card is done, use <b>Make card</b> in the wand menu.</span>');
    else if (!picked.size) chips.append('<span class="wh-empty">None yet. Tap <i class="fa-solid fa-pen"></i> to pick some, or <i class="fa-solid fa-wand-magic-sparkles"></i> to suggest them from the card. Only what you pick is ever used.</span>');
    else for (const m of expandModes([...picked])) chips.append($('<span class="wh-chip" tabindex="0"></span>').addClass(`wh-g-${groupOf(m)}`).text(m).attr('title', MODE_BLURBS[m] || '').data('mode', m));
    if (s.enabled && Array.isArray(world_names) && !world_names.includes(s.world)) {
        chips.after($('<div id="wh_codex_missing" class="wh-warning"></div>').text(`The Codex lorebook “${s.world}” isn't installed, so modes have no effect yet (Settings → Codex).`));
    }

    const box = $('#wh_codex_modes').empty();
    for (const [group, modes] of MODE_GROUPS) {
        const row = $('<div class="wh-mode-group"></div>').addClass(`wh-g-${group.toLowerCase()}`).append($('<div class="wh-mode-group-title"></div>').text(group));
        for (const m of modes) {
            const id = 'wh_mode_' + m.replace(/\W+/g, '_');
            const pill = $(`<label class="wh-pill${MODIFIERS.has(m) ? ' wh-modifier' : ''}" for="${id}"></label>`)
                .attr('title', (MODE_BLURBS[m] || '') + (PARENT[m] ? ` (modifier: also switches on ${PARENT[m]})` : ''));
            const cb = $(`<input type="checkbox" id="${id}">`).prop('checked', picked.has(m)).prop('disabled', !t || !s.enabled).data('mode', m);
            row.append(pill.append(cb, $('<span></span>').text(m)));
        }
        box.append(row);
    }
    const open = pickerOpen ?? (!!t && s.enabled && !picked.size && !builder);
    box.toggle(open);
    chips.toggle(!open || !t || !s.enabled);   // the pills already show the picks while the picker is open
    $('#wh_codex_edit').toggleClass('wh-on', open).toggleClass('fa-pen', !open).toggleClass('fa-check', open)
        .attr('title', open ? 'Done' : "Change this card's modes").toggle(!!t && s.enabled);
    $('#wh_codex_suggest_now').toggle(!!t && s.enabled);

    const sug = t ? s.suggested[t.key] : null;
    const showSug = t && s.enabled && !picked.size && Array.isArray(sug) && sug.length;
    $('#wh_codex_suggestion').toggle(!!showSug);
    $('#wh_codex_suggestion_text').text(showSug ? `Suggested: ${sug.join(', ')}` : '');
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

// Modes that give the Ledger nothing to track (nobody changes body or mind). With only these picked, it stays off
// rather than spending a model call on every reply.
const TRACKLESS = new Set(['Timestop']);

function ledgerWanted() {
    if (!settings().ledger.enabled) return false;
    return currentModes().some(m => !TRACKLESS.has(m)) || !isEmptyLedger(headLedger()?.ledger);
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

// Summaryception hides summarised messages as system messages; they are still part of the story.
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
    }
    next = labelMultiRides(next, modes);
    if (chatKey() !== key || !ctx().chat?.[mesId]) return fail;
    storeLedger(mesId, next);
    if (save) await ctx().saveChat();
    applyLedgerInjection();
    renderLedgerPanel();
    ledgerStatus(`Ledger updated (${((performance.now() - t0) / 1000).toFixed(1)}s).`);
    return { ok: true, ended: rebuild ? [] : endedRides(base?.ledger || EMPTY_LEDGER, next) };
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
                if (r.ended.length && settings().ledger.history) { endings++; await noteEndedRides(i, r.ended, { save: false }); }
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
    if (!s.enabled || type === 'quiet') {
        c.setExtensionPrompt(LEDGER_KEY, '', IN_CHAT, 1, false, SYSTEM);
        c.setExtensionPrompt(HISTORY_KEY, '', IN_CHAT, HISTORY_DEPTH, false, SYSTEM);
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
    const text = head ? renderLedger(head.ledger, c.name1 || 'User', { lastUserText }) : '';
    c.setExtensionPrompt(LEDGER_KEY, text, IN_CHAT, 1, false, SYSTEM);
    c.setExtensionPrompt(HISTORY_KEY, s.history ? historyText(limit) : '', IN_CHAT, HISTORY_DEPTH, false, SYSTEM);
}

function ledgerStatus(text) {
    $('#wh_ledger_status').text(text);
    console.log(LOG, text);
}

// The panel's own compact view of the ledger (the prose in renderLedger is written for the model, not for you):
// one line per body, details on a faint second line that expands on tap.
// kind colours the row like the strip: 'you' teal, 'npc' violet, 'idle' dashed; icon is a Font Awesome name.
function panelRow(main, sub, hidden, kind = '', icon = '') {
    const row = $('<div class="wh-row"></div>').addClass(kind ? `wh-k-${kind}` : '').append($('<div class="wh-row-main"></div>').text(main));
    if (icon) row.find('.wh-row-main').prepend(`<i class="fa-solid ${icon} wh-row-icon"></i>`);
    if (hidden) row.find('.wh-row-main').append(' <i class="fa-solid fa-eye-slash" title="hidden from you"></i>');
    if (sub) row.append($('<div class="wh-row-sub"></div>').text(sub).attr('title', sub)).addClass('wh-expandable');
    return row;
}

function renderLedgerPanel() {
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
    for (const m of ledger?.minds || []) {
        const main = `${m.who}'s mind${m.by ? ` ← ${m.by}` : ''}`;
        const sub = [m.how, m.changes, m.triggers ? `triggers: ${m.triggers}` : '', m.state].filter(Boolean).join(' · ');
        box.append(panelRow(main, sub, m.user_knows === 'no', m.by && canon(m.by) === me ? 'you' : 'npc', 'fa-brain'));
    }
    const extra = [
        ledger?.powers?.length ? `Powers: ${ledger.powers.map(p => `${p.who} (${p.power})`).join(', ')}` : '',
        ledger?.aliases?.length ? `Also known as: ${ledger.aliases.map(a => [a.name, ...a.aka].join(' = ')).join('; ')}` : '',
    ].filter(Boolean);
    for (const x of extra) box.append($('<div class="wh-row-sub wh-extra"></div>').text(x));
    if (!ledger?.bodies?.length && !ledger?.minds?.length) {
        const modes = currentModes();
        const idle = modes.length && modes.every(m => TRACKLESS.has(m));
        box.prepend($('<div class="wh-empty"></div>').text(idle ? `${modes.join(', ')} leaves nothing for the Ledger to track, so it stays off in this chat.`
            : ledgerWanted() ? 'Everyone is in their own body, with their own mind.' : 'Starts once this chat has a mode.'));
    }

    const hist = $('#wh_ledger_history').empty();
    const groups = settings().ledger.history ? historyGroups(bodyHistory(ledgerSnapshots())) : [];
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
    $('#wh_ledger_strip_on').prop('checked', settings().ledger.strip);
    $('#wh_ledger_history_on').prop('checked', settings().ledger.history);
    renderStrip();
    renderBadges();
}

// A one-line strip above the chat: who is in which body, at a glance. Tap to edit.
let ledgerBusy = false;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderStrip() {
    if (!$('#wh_ledger_strip').length) {
        const strip = $('<div id="wh_ledger_strip" class="wh-ledger-strip" title="Body Ledger — tap to edit" role="button" tabindex="0"></div>');
        strip.on('click keydown', e => { if (e.type === 'click' || e.key === 'Enter') openLedgerEditor(); });
        $('#chat').before(strip);
    }
    const s = settings().ledger;
    const ledger = headLedger()?.ledger;
    const bodies = ledger?.bodies || [];
    const minds = ledger?.minds || [];
    if (!s.enabled || !s.strip || !ctx().chat?.length || (!bodies.length && !minds.length && !ledgerBusy)) { $('#wh_ledger_strip').hide(); return; }
    const canon = aliasResolver(ledger);
    const me = canon(ctx().name1 || '');
    const chip = (kind, icon, title, sub, tip, hidden) => `<span class="wh-chip wh-${kind}${hidden ? ' wh-hidden' : ''}" title="${esc(tip)}"><i class="fa-solid ${icon} wh-chip-icon"></i>`
        + `<span class="wh-chip-text"><b>${esc(title)}</b><small>${esc(sub)}${hidden ? ' · hidden <i class="fa-solid fa-eye-slash"></i>' : ''}</small></span></span>`;
    // Two lines per body or mind; the colour says who is doing it: teal when it's you, violet when it's someone else.
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
        return chip(kind, icon, title, sub, tip, b.user_knows === 'no');
    }).concat(minds.map(m => {
        const mine = m.by && canon(m.by) === me;
        const title = canon(m.who) === me ? 'You' : m.who;
        const sub = [m.how, mine ? 'by you' : m.by ? `by ${m.by}` : ''].filter(Boolean).join(' · ');
        const tip = [m.changes, m.triggers ? `triggers: ${m.triggers}` : '', m.state ? `now: ${m.state}` : '', m.user_knows === 'no' ? 'hidden from you' : ''].filter(Boolean).join(' · ');
        return chip(mine ? 'you' : 'npc', 'fa-brain', title, sub, tip, m.user_knows === 'no');
    }));
    $('#wh_ledger_strip').html(`${chips.join('')}${ledgerBusy ? '<span class="wh-busy">updating…</span>' : ''}`).show();
    renderLanes();
}

// The body roster over the message box while you run more than one body (multipossession, or you as a hive): a card
// per body in its own colour, saying what it's doing. Tap one to start a line for it; the card for the line you're
// writing lights up. Past six bodies, or on request, the cards shrink to one-line chips.
const LANE_HUES = ['29, 158, 117', '127, 119, 221', '216, 90, 48', '212, 83, 126', '186, 117, 23', '55, 138, 221', '99, 153, 34', '226, 75, 74'];
let laneColourCache = { key: '', map: new Map() };

/** Your own body is always teal; every body you've driven in this chat gets the next colour, in order of first appearance. */
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
    const ledger = s.enabled && s.lanes ? headLedger()?.ledger : null;
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

/** Each [Name] line in the chat takes that body's colour. */
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
    if (!s.enabled || !s.badges || !chat.length) return;
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
const field = (k, label, ph, value, cls = '') => $(`<label class="wh-f ${cls}"></label>`)
    .append($('<small></small>').text(label), $('<input class="text_pole">').attr({ 'data-k': k, placeholder: ph }).val(value || ''));
const delButton = onDelete => $('<div class="menu_button fa-solid fa-trash wh-row-del" title="Remove"></div>')
    .on('click', e => { e.preventDefault(); e.stopPropagation(); onDelete(); });

async function openLedgerEditor() {
    const c = ctx();
    if (!c.chat?.length) { toastr.info('Open a chat first.'); return; }
    const head = headLedger();
    const ledger = normalizeLedger(head?.ledger || EMPTY_LEDGER);
    const root = $('<div class="wh-ledger-editor"></div>');
    root.append('<h3>Body Ledger</h3><small class="wh-muted">Who is in which body right now, and whose mind has been changed. Tap a row to edit it; the next update builds on what you save.</small>');

    const bodies = $('<div class="wh-ledger-rows"></div>');
    const bodyRow = (b = {}, open = false) => {
        const card = $('<details class="wh-body-card"></details>').prop('open', open);
        const title = $('<span class="wh-body-title"></span>');
        const sum = $('<summary></summary>').append(title, delButton(() => card.remove()));
        const fields = $('<div class="wh-fields"></div>').append(
            field('body', 'Body', 'whose body', b.body), field('pronouns', 'Pronouns', 'she/her', b.pronouns),
            field('driver', 'Mind inside', 'who is in it (blank if nobody)', b.driver), field('driver_pronouns', 'Pronouns', 'he/him', b.driver_pronouns),
            field('how', 'How', 'possession, swap, skinsuit…', b.how), field('host', "Owner's mind", 'gone, asleep, watching…', b.host),
            field('notes', 'Notes', 'anything worth remembering', b.notes, 'wh-full'),
            field('doing', 'Busy with', 'what it is doing right now', b.doing, 'wh-full'),
            $('<label class="checkbox_label wh-full"></label>').append($('<input type="checkbox" data-k="user_knows">').prop('checked', b.user_knows !== 'no'), $('<span>You know about this</span>')),
        );
        const refresh = () => {
            const v = k => String(card.find(`[data-k="${k}"]`).val() || '').trim();
            const body = v('body') || 'New body', driver = v('driver');
            title.text(driver ? `${body} ← ${driver}` : `${body}: empty`).append(v('how') ? $('<small></small>').text(` · ${v('how')}`) : '');
            if (!card.find('[data-k="user_knows"]').prop('checked')) title.append(' <i class="fa-solid fa-eye-slash" title="hidden from you"></i>');
        };
        card.append(sum, fields).on('input change', refresh);
        refresh();
        return card;
    };
    ledger.bodies.forEach(b => bodies.append(bodyRow(b)));
    root.append(bodies, $('<div class="menu_button">+ Body</div>').on('click', () => bodies.append(bodyRow({}, true))));

    root.append('<div class="wh-mini-title" title="Whose mind a power has changed while they stay in their own body: hypnosis, mind control, rewrites, drones, dolls.">Minds</div>');
    const minds = $('<div class="wh-ledger-rows"></div>');
    const mindRow = (m = {}, open = false) => {
        const card = $('<details class="wh-body-card"></details>').prop('open', open);
        const title = $('<span class="wh-body-title"></span>');
        const sum = $('<summary></summary>').append(title, delButton(() => card.remove()));
        const fields = $('<div class="wh-fields"></div>').append(
            field('who', 'Whose mind', 'who was changed', m.who), field('by', 'By', 'who did it (blank if nobody)', m.by),
            field('how', 'How', 'hypnosis, mind control, doll…', m.how, 'wh-full'),
            field('changes', 'What changed', 'beliefs, loyalties, rules, what they can\'t perceive', m.changes, 'wh-full'),
            field('triggers', 'Triggers', 'a cue and what it does', m.triggers, 'wh-full'),
            field('state', 'Right now', 'deep trance, awake, posed…', m.state, 'wh-full'),
            $('<label class="checkbox_label wh-full"></label>').append($('<input type="checkbox" data-k="user_knows">').prop('checked', m.user_knows !== 'no'), $('<span>You know about this</span>')),
        );
        const refresh = () => {
            const v = k => String(card.find(`[data-k="${k}"]`).val() || '').trim();
            title.text(`${v('who') || 'Someone'}'s mind${v('by') ? ` ← ${v('by')}` : ''}`).append(v('how') ? $('<small></small>').text(` · ${v('how')}`) : '');
            if (!card.find('[data-k="user_knows"]').prop('checked')) title.append(' <i class="fa-solid fa-eye-slash" title="hidden from you"></i>');
        };
        card.append(sum, fields).on('input change', refresh);
        refresh();
        return card;
    };
    ledger.minds.forEach(m => minds.append(mindRow(m)));
    root.append(minds, $('<div class="menu_button">+ Mind</div>').on('click', () => minds.append(mindRow({}, true))));

    const pairRow = (a, b, extra = '') => {
        const row = $(`<div class="wh-pair ${extra}"></div>`);
        return row.append(a, b, delButton(() => row.remove()));
    };
    root.append('<div class="wh-mini-title" title="Who can do what: the Ledger keeps these in mind even when nobody is using them.">Powers</div>');
    const powers = $('<div class="wh-ledger-rows"></div>');
    const powerRow = (p = {}) => pairRow(field('who', 'Who', 'who has it', p.who), field('power', 'Power', 'e.g. body swap by touch', p.power), 'wh-power-row');
    ledger.powers.forEach(p => powers.append(powerRow(p)));
    root.append(powers, $('<div class="menu_button">+ Power</div>').on('click', () => powers.append(powerRow())));

    root.append('<div class="wh-mini-title" title="One person, several names: a code name, a handle, a host number.">Also known as</div>');
    const aliases = $('<div class="wh-ledger-rows"></div>');
    const aliasRow = (a = {}) => pairRow(field('name', 'Name', 'main name', a.name), field('aka', 'Also called', 'other names, comma-separated', (a.aka || []).join(', ')), 'wh-power-row');
    ledger.aliases.forEach(a => aliases.append(aliasRow(a)));
    root.append(aliases, $('<div class="menu_button">+ Name</div>').on('click', () => aliases.append(aliasRow())));

    const res = await c.callGenericPopup(root, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, okButton: 'Save', cancelButton: 'Cancel' });
    if (res !== c.POPUP_RESULT.AFFIRMATIVE) return;
    const read = (container, sel) => container.find(sel).map((_, row) => {
        const o = {};
        $(row).find('input[data-k]').each((__, inp) => {
            o[$(inp).data('k')] = inp.type === 'checkbox' ? (inp.checked ? 'yes' : 'no') : String($(inp).val() || '');
        });
        return o;
    }).get();
    // Saved as typed: the "once you know, you keep knowing" rule only guards the model's updates, not your edits.
    const next = normalizeLedger({ bodies: read(bodies, '.wh-body-card'), own: ledger.own, minds: read(minds, '.wh-body-card'), powers: read(powers, '.wh-pair'), aliases: read(aliases, '.wh-pair') });
    storeLedger(c.chat.length - 1, next);
    await c.saveChat();
    applyLedgerInjection();
    renderLedgerPanel();
    toastr.success('Body Ledger saved.');
}

// ------------------------------------------------------------------ Editor

function status(text) {
    $('#wh_editor_status').text(text);
    console.log(LOG, text);
}

function lastReplyIndex() {
    const chat = ctx().chat;
    for (let i = chat.length - 1; i >= 0; i--) if (!chat[i].is_user && !chat[i].is_system) return i;
    return -1;
}

function editorContext(mesId) {
    const chat = ctx().chat || [];
    let userText = '';
    const previous = [];
    for (let i = mesId - 1; i >= 0 && (previous.length < 3 || !userText); i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        if (m.is_user) { if (!userText) userText = m.mes || ''; }
        else if (previous.length < 3) previous.push(m.mes || '');
    }
    return { userText, previous };
}

function writeMessage(msg, text) {
    msg.mes = text;
    if (Array.isArray(msg.swipes) && typeof msg.swipe_id === 'number') msg.swipes[msg.swipe_id] = text;
}

function recordEdit(msg, rec) {
    msg.extra ??= {};
    msg.extra.wh_edit = rec;
    const info = msg.swipe_info?.[msg.swipe_id];
    if (info) { info.extra ??= {}; info.extra.wh_edit = rec; }
}

async function runEditor(mesId, type, { force = false } = {}) {
    const s = settings().editor;
    if (!force) {
        if (!s.enabled) return;
        if (['quiet', 'impersonate', 'first_message', 'command'].includes(type)) return;
    }
    const msg = ctx().chat?.[mesId];
    if (!msg || msg.is_user || msg.is_system || !msg.mes) return;
    const original = msg.mes;
    if (!looksLikeRoleplay(original)) { status('Last reply looks like notes or out-of-story work; left alone.'); return; }

    // Style fixes follow the "Chat Completion replies only" setting. The Ledger passes (pronouns, cuts) run on
    // every reply whenever the Ledger has someone in another body, Text Completion replies included.
    const styleFixes = force || !s.onlyChatCompletion || ctx().mainApi === 'openai';
    const head = headLedger(mesId + 1);
    const crossed = !!head && hasCrossedBodies(head.ledger);
    if (!styleFixes && !crossed) return;

    const t0 = performance.now();
    let text = original;
    const applied = [];
    let flagged = 0;

    // 0. pronoun hedges ("your — her — hand") collapse to the settled referent, no model needed
    if (s.checks.hedges) {
        const h = collapseHedges(text);
        text = h.text;
        applied.push(...h.applied);
    }

    // 1. rule pass + line fixes
    const candidates = styleFixes ? detect(text, { ...s.checks, personal: s.personal, max: s.maxCandidates }, editorContext(mesId)) : [];
    flagged = candidates.length;
    if (candidates.length) {
        try {
            const out = applyEdits(text, candidates, parseEditorResponse(await askEditor(buildEditorMessages(text, candidates), s.maxTokens, s.temperature)), bannedPatterns(s.personal));
            text = out.text;
            applied.push(...out.applied);
            if (out.rejected.length) console.debug(LOG, 'rejected rewrites', out.rejected);
        } catch (err) {
            status(`Editor: ${unreachable(s.profile)}.`);
            return;
        }
    }

    // 2. pronoun/name check against the Ledger (as of this reply)
    if (s.pronouns && crossed) {
        try {
            const out = applyPronounFixes(text, parsePronounResponse(await askEditor(buildPronounMessages(text, head.ledger), 500, 0.1)), head.ledger);
            text = out.text;
            applied.push(...out.applied.map(a => ({ action: 'PRONOUN', ...a })));
            if (out.rejected.length) console.debug(LOG, 'rejected pronoun fixes', out.rejected);
        } catch { /* the line fixes still stand */ }
    }

    // 3. cut-only body-rule lint: bodies of one mind talking to each other, narration pointing at who is inside,
    //    and anything that gives away a body change the player doesn't know about
    if (s.lint && crossed) {
        try {
            const out = applyCuts(text, parseLintResponse(await askEditor(buildLintMessages(text, head.ledger, ctx().name1 || 'User'), 500, 0.1)));
            text = out.text;
            applied.push(...out.applied);
            if (out.rejected.length) console.debug(LOG, 'rejected cuts', out.rejected);
        } catch { /* earlier fixes still stand */ }
    }

    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const now = ctx().chat?.[mesId];
    if (!now || now.mes !== original) { status('Editor: the reply changed while it was being checked, so nothing was applied.'); return; }
    if (!applied.length) { status(flagged ? `Last reply: ${flagged} flagged, all kept (${secs}s).` : 'Last reply: nothing flagged.'); return; }
    writeMessage(now, text);
    recordEdit(now, { original, edited: text, applied, at: Date.now() });
    ctx().updateMessageBlock(mesId, now);
    markEdited(mesId);
    await ctx().saveChat();
    status(`Last reply: ${applied.length} fix${applied.length > 1 ? 'es' : ''} (${secs}s). ⟲ in the message menu restores the original.`);
    console.debug(LOG, 'applied', applied);
}

async function toggleEdit(mesId) {
    const msg = ctx().chat?.[mesId];
    const rec = msg?.extra?.wh_edit;
    if (!rec) { toastr.info('No Worldhopper Editor changes on this message.'); return; }
    let target;
    if (msg.mes === rec.edited) target = rec.original;
    else if (msg.mes === rec.original) target = rec.edited;
    else { toastr.warning('This message was changed after the Editor ran, so it can’t be toggled.'); return; }
    writeMessage(msg, target);
    ctx().updateMessageBlock(mesId, msg);
    markEdited(mesId);
    await ctx().saveChat();
    toastr.success(target === rec.original ? 'Original reply restored.' : 'Editor fixes re-applied.');
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

function onMessageReceived(mesId, type) {
    if (['quiet', 'impersonate', 'command', 'first_message'].includes(type)) return;
    let done;
    ledgerReady = new Promise(r => (done = r));
    enqueue(async () => {
        let ended = [];
        try {
            if (ledgerWanted() && !ledgerProfile()) ledgerStatus(`Ledger: ${unreachable('')}.`);
            else if (ledgerWanted()) { setLedgerBusy(true); ended = (await updateLedger(mesId)).ended; }
        } finally {
            setLedgerBusy(false);
            done();
        }
        await runEditor(mesId, type);
        // After the Editor, so the reply is final and the fix you see isn't held up by it. A separate notes model
        // runs alongside the queue instead of holding up the next reply's Ledger; a shared one waits its turn.
        if (ended.length && settings().ledger.history) {
            const notes = noteEndedRides(mesId, ended).catch(err => console.warn(LOG, err));
            if ([ledgerProfile(), settings().editor.profile].includes(notesProfile())) await notes;
        }
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
    if (!dryRun && type !== 'quiet') {
        const t0 = performance.now();
        await Promise.race([ledgerReady, new Promise(r => setTimeout(r, LEDGER_WAIT_MS))]);
        const waited = performance.now() - t0;
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
    fillProfileSelect('#wh_editor_profile', s.editor.profile, '— pick a profile —');
    fillProfileSelect('#wh_ledger_notes_profile', s.ledger.notesProfile, 'Same as Ledger');
    $('#wh_no_profiles').toggle(!(ctx().extensionSettings.connectionManager?.profiles || []).length);
}

function renderWorldSelect() {
    const s = settings().codex;
    const names = Array.isArray(world_names) ? world_names : [];
    const sel = $('#wh_codex_world').empty();
    for (const n of names) sel.append($('<option></option>').val(n).text(n));
    if (s.world && !names.includes(s.world)) sel.append($('<option></option>').val(s.world).text(`${s.world} (not installed)`));
    sel.val(s.world);
}

function renderEditorPanel() {
    const s = settings().editor;
    renderModelSelects();
    renderWorldSelect();
    $('#wh_editor_enabled').prop('checked', s.enabled);
    $('#wh_editor_cc_only').prop('checked', s.onlyChatCompletion);
    $('#wh_editor_pronouns').prop('checked', s.pronouns);
    $('#wh_editor_lint').prop('checked', s.lint);
    $('#wh_editor_personal').val((s.personal || []).join('\n'));
    for (const k of Object.keys(DEFAULTS.editor.checks)) $(`#wh_chk_${k}`).prop('checked', s.checks[k]);
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

    bind('#wh_codex_enabled', () => s.codex.enabled, v => { settings().codex.enabled = v; renderCodexPanel(); });
    bind('#wh_codex_anchors', () => s.codex.anchors, v => { settings().codex.anchors = v; });
    bind('#wh_codex_details', () => s.codex.details, v => { settings().codex.details = v; });
    bind('#wh_codex_initiative', () => s.codex.initiative, v => { settings().codex.initiative = v; });
    bind('#wh_codex_suggest', () => s.codex.suggest, v => { settings().codex.suggest = v; });
    $('#wh_codex_modes').on('change', 'input[type="checkbox"]', onModeToggle);
    $('#wh_codex_suggest_now').on('click', () => enqueue(() => suggestModes({ force: true })));
    $('#wh_codex_edit').on('click', () => { pickerOpen = !$('#wh_codex_modes').is(':visible'); renderCodexPanel(); });
    $('#wh_codex_apply_suggestion').on('click', () => { const t = selectionTarget(); if (t) applySuggestion(t.key); });

    bind('#wh_ledger_enabled', () => s.ledger.enabled, v => { settings().ledger.enabled = v; applyLedgerInjection(); renderLedgerPanel(); });
    bind('#wh_ledger_strip_on', () => s.ledger.strip, v => { settings().ledger.strip = v; renderStrip(); });
    bind('#wh_ledger_badges_on', () => s.ledger.badges, v => { settings().ledger.badges = v; renderBadges(); });
    bind('#wh_ledger_lanes_on', () => s.ledger.lanes, v => { settings().ledger.lanes = v; renderLanes(); });
    bind('#wh_ledger_history_on', () => s.ledger.history, v => { settings().ledger.history = v; applyLedgerInjection(); renderLedgerPanel(); });
    $('#wh_ledger_backfill').on('click', backfillHistory);
    $('#wh_ledger_notes_profile').on('change', function () { settings().ledger.notesProfile = String($(this).val() || ''); save(); });
    $('#wh_ledger_profile').on('change', function () { settings().ledger.profile = String($(this).val() || ''); save(); });
    $('#wh_codex_world').on('change', function () { settings().codex.world = String($(this).val() || ''); save(); renderWorldSelect(); renderCodexPanel(); syncCodexBook(); })
        .on('focus mousedown', () => { if ($('#wh_codex_world option').length !== (world_names?.length || 0)) renderWorldSelect(); });
    $('#wh_codex_update_now').on('click', () => syncCodexBook({ force: true }).catch(err => toastr.error(err.message)));
    $('#wh_ledger_open').on('click', openLedgerEditor);
    $('#wh_ledger_rebuild').on('click', () => {
        const i = (ctx().chat?.length || 0) - 1;
        if (i < 0) return;
        ledgerStatus('Rebuilding from the card and recent messages…');
        enqueue(() => updateLedger(i, { rebuild: true }));
    });

    bind('#wh_editor_enabled', () => s.editor.enabled, v => { settings().editor.enabled = v; });
    bind('#wh_editor_cc_only', () => s.editor.onlyChatCompletion, v => { settings().editor.onlyChatCompletion = v; });
    bind('#wh_editor_pronouns', () => s.editor.pronouns, v => { settings().editor.pronouns = v; });
    bind('#wh_editor_lint', () => s.editor.lint, v => { settings().editor.lint = v; });
    $('#wh_editor_personal').on('change', function () { settings().editor.personal = String($(this).val() || '').split('\n').map(x => x.trim()).filter(Boolean); save(); });
    $('#wh_editor_profile').on('change', function () { settings().editor.profile = String($(this).val() || ''); save(); });
    for (const k of Object.keys(DEFAULTS.editor.checks)) {
        bind(`#wh_chk_${k}`, () => s.editor.checks[k], v => { settings().editor.checks[k] = v; });
    }
    $('#wh_editor_run').on('click', () => { const i = lastReplyIndex(); if (i >= 0) enqueue(() => runEditor(i, 'manual', { force: true })); });

    renderCodexPanel();
    renderLedgerPanel();
    renderEditorPanel();
}

function addMessageButton() {
    const btn = '<div title="Worldhopper Editor: toggle original / fixed" class="mes_button wh-undo fa-solid fa-rotate-left"></div>';
    $('#message_template .mes_buttons .extraMesButtons').prepend(btn);
    $(document).on('click', '.wh-undo', function () {
        toggleEdit(Number($(this).closest('.mes').attr('mesid')));
    });
}

function addWandButton() {
    const item = $('<div id="wh_ledger_wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="Who is in which body"><div class="fa-solid fa-people-arrows extensionsMenuExtensionButton"></div><span>Body Ledger</span></div>');
    item.on('click', openLedgerEditor);
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

/** Turn the labelled blocks of a card-builder chat into a new character, with its Codex modes already picked. */
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
                ? (job.signal.reason?.message === 'timeout' ? `No answer after ${REVIEW_TIMEOUT_MS / 60000} minutes, so the review stopped. Check the Notes model under Settings → Models, or try again.` : 'Review cancelled.')
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
        name: 'wh-edit',
        callback: async (_args, value) => {
            const id = String(value ?? '').trim() ? Number(value) : lastReplyIndex();
            await enqueue(() => runEditor(id, 'manual', { force: true }));
            return '';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'message id (default: the last reply)', typeList: [ARGUMENT_TYPE.NUMBER], isRequired: false })],
        helpString: 'Run the Worldhopper Editor on a message now, even if auto-editing is off.',
    }));
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
        name: 'wh-ledger',
        callback: async (_args, value) => {
            const v = String(value ?? '').trim().toLowerCase();
            if (v === 'rebuild') { const i = (ctx().chat?.length || 0) - 1; if (i >= 0) await enqueue(() => updateLedger(i, { rebuild: true })); }
            else if (v === 'edit') { await openLedgerEditor(); }
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
        eventSource.on(event_types.CHAT_CHANGED, () => {
            pickerOpen = null;
            renderCodexPanel(); renderLedgerPanel(); renderEditorPanel(); applyLedgerInjection();
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
