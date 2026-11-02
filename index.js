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
import { looksLikeRoleplay, fitToContext } from './text-core.js';
import { MODE_GROUPS, MODIFIERS, PARENT, ALL_MODES, MODE_BLURBS, expandModes, planEntry, buildSuggestMessages, parseSuggestResponse, DISPLAY_SCRIPTS } from './codex-core.js';
import {
    EMPTY_LEDGER, normalizeLedger, ledgerStep, renderLedger, akaOf, aliasResolver, personNamedIn,
    rosterOf, tracksBodies, multiBodyGroups, joinLanes,
    hasCrossedBodies, needsPronounCheck, buildPronounMessages, parsePronounResponse, applyPronounFixes, buildLintMessages, parseLintResponse, applyCuts, CUT_FORMAT,
    endedRides, bodyHistory, renderHistory, historyGroups, buildHistoryMessages, parseHistoryResponse, NOTE_FIELDS, intentLine, applyIntent,
} from './ledger-core.js';
import { parseBuilderChat, buildCard, doctorCard, buildReviewMessages, estimateTokens, cardGreetings, pickGreetings, buildMovesMessages, parseMoves, buildTrialJudgeMessages, parseTrialVerdict, summarizeTrial, buildTrialFixMessages, parseTrialFixes, buildGreetingCheckMessages, parseGreetingCheck, summarizeGreetings, locateBreak, TRIAL_RULES } from './card-core.js';
import { DIALS, compileRules, cardRules, normalizeRules, rulesSummary, buildConvertMessages, parseConvert, applyConvertCuts } from './rules-core.js';
import { EMPTY_WORLD, normalizeWorld, worldStep, renderWorld, bodyLines, timeLeft, clockAdvance } from './world-core.js';
import { describesMinor, buildPersonaMessages, parsePersona, personaText, personaKey, sheetFromFields, buildLookMessages, parseLook, portraitPrompt, glance, glanceParts, LOOK_WORDS } from './persona-core.js';
import { ledgerPeople, mindPeople } from './people-core.js';
import { boardOf, splitWhere, sceneBreak, ridesChanged } from './board-core.js';
import { applyStageLook, renderBoard, bindPull, justPulled, readParagraph, replyParagraphs, isStaged, stageReply, stageUser, stageWhere, stageScene, stageMoments, stageLanes, unstage, openSheet, closeSheet, zoomPicture } from './stage.js';
import { speakers, cardPronouns, prosePronouns } from './speech-core.js';
import { ledgerView, mindView, pictureView, rulesView, convertView } from './views.js';
import { user_avatar, getUserAvatar } from '../../../personas.js';
import { shouldSendOnEnter } from '../../../RossAscends-mods.js';
import { MIND_MODES, KINDS as MIND_KINDS, EMPTY_BOOK, normalizeBook, isEmptyBook, needsUpdate, mindStep, renderMindBook, trappedSelfCuts, resistanceSetUp, changeStage } from './mind-core.js';
import { makeFix, makeChecksFix, fixFileName, FIX_KINDS, FIX_LABELS } from './correct-core.js';

const MODULE = 'worldhopper';
const LOG = '[Worldhopper]';
const LEDGER_KEY = 'worldhopper_ledger';
const HISTORY_KEY = 'worldhopper_history';
const HISTORY_DEPTH = 4;   // background, so a little further back than the Ledger at depth 1
const HISTORY_EDITS_KEY = 'worldhopper_history_edits';   // your corrections to the Body History, by ride, in chat metadata
const PERSONA_KEY = 'worldhopper_personas';   // the host sheets, in chat metadata
const REVIEW_TIMEOUT_MS = 180000;   // Check card's deeper review: a slow model takes about a minute; past three, give up
const SCENE_MESSAGES = 4;   // who is "in the scene": named in this many of the latest messages
const RECENT_REPLIES = 30;   // "Build history" can read just this many of the latest replies instead of the whole chat
const RULES_KEY = 'worldhopper_rules';   // the card's own rules, compiled from its dials (rules-core.js)
const WORLD_KEY = 'worldhopper_world';   // the World notes: things that matter and who knows what (world-core.js)
const IN_CHAT = 1;   // extension_prompt_types.IN_CHAT
const SYSTEM = 0;    // extension_prompt_roles.SYSTEM
const DEFAULTS = {
    // Worldhopper on or off (the switch in its heading). Off, nothing is added to prompts and no model runs; what's
    // already in the chat (moment boxes, badges, ⟲) still shows.
    enabled: true,
    codex: { world: 'WH Metaphysics', selections: {}, suggested: {}, installedHash: '' },
    // Connection profiles, picked under Settings → Models. The Ledger runs after every reply, so a fast model suits
    // it; history notes need judgment about who remembers what, so a stronger model suits them.
    // wardenProfile: the Warden (tools/warden), a model trained only for the Ledger's updates and their second looks.
    ledger: { enabled: true, profile: '', notesProfile: '', wardenProfile: '' },
    // Pictures of people in the Ledger and the Mind Book, drawn by Image Generation as it's set up. auto draws them on
    // their own; style, model and workflow ('' = as set in Image Generation) and shape apply to these pictures only.
    // rewrite has Image Generation's own prompt template rewrite the prompt first (for tag-based models).
    pictures: { auto: false, style: '', model: '', workflow: '', shape: 'square', rewrite: false },
    // Keep my corrections (correct-core.js): off until you switch it on. cases: what's been kept, one file each.
    fixes: { on: false },
    // Your pronouns, per persona (by its avatar file): SillyTavern has no field for them, so a model guessed from the
    // description, and in a chat full of women's bodies Claude's thinking took a man for "she".
    personaPronouns: {},
    // Stage mode (stage.js, stage.css): Worldhopper's own look for all of SillyTavern, and the band that pulls down
    // into the Board. hidden: the Board shows the rides kept from you (dashed); the eye in its corner switches it.
    stage: { on: false, hidden: true },
};

const ctx = () => SillyTavern.getContext();

function settings() {
    const all = ctx().extensionSettings;
    const s = (all[MODULE] ??= {});
    s.enabled ??= DEFAULTS.enabled;
    s.codex = { ...DEFAULTS.codex, ...(s.codex || {}) };
    s.codex.selections ??= {};
    s.codex.suggested ??= {};
    s.personaPronouns ??= {};
    s.stage = { ...DEFAULTS.stage, ...(s.stage || {}) };
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
    s.fixes = { ...DEFAULTS.fixes, ...(s.fixes || {}) };
    if (!Array.isArray(s.fixes.cases)) s.fixes.cases = [];
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

// Text Completion services that aren't on your own machine (the rest are: KoboldCpp, llama.cpp, Ollama, and so on).
const HOSTED_TC = ['openrouter', 'featherless', 'mancer', 'infermaticai', 'dreamgen', 'togetherai', 'huggingface'];
/**
 * Whether a profile runs a model on your own machine (or your network): a Text Completion backend like KoboldCpp, or a
 * Chat Completion "custom" endpoint at a local address. Such a server answers one request at a time, in the context it
 * was started with.
 */
function isLocalProfile(name) {
    const p = profileByName(name);
    if (!p) return false;
    if (p.mode !== 'cc') return !HOSTED_TC.includes(p.api);
    let host = '';
    try { host = new URL(p['api-url'] || '').hostname; } catch { return false; }
    return p.api === 'custom' && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|\[?::1\]?$)|\.(local|lan|localhost|ts\.net)$/i.test(host);
}

const warnedSmall = new Set();   // profiles already told their context is too small, this session
/** Send messages through a connection profile (Text or Chat Completion). Returns the text, or throws. `signal` aborts it. */
async function askProfile(name, messages, maxTokens, temperature, { signal = null } = {}) {
    if (!name) throw new Error('no model picked (Worldhopper → Settings → Models)');
    const profile = profileByName(name);
    if (!profile) throw new Error(`connection profile “${name}” not found`);
    const local = isLocalProfile(name);
    if (profile.mode === 'cc') {
        const custom = { stream: false, extractData: true, includePreset: true, includeInstruct: false, signal };
        const send = async max => {
            const res = await ConnectionManagerRequestService.sendRequest(profile.id, messages, max, custom, { temperature });
            return typeof res === 'string' ? res : String(res?.content ?? '');
        };
        const text = await send(maxTokens);
        // A model that thinks before it answers can spend the whole limit on hidden reasoning and send back nothing:
        // Haiku 5.5 on OpenRouter does, even at low effort. One retry with room to spare (a ceiling, not a cost). A
        // local server gets less: its room comes out of the same context the prompt has to fit in.
        if (text.trim() || signal?.aborted) return text;
        return send(local ? Math.min(2 * maxTokens, 2000) : Math.max(4 * maxTokens, 4000));
    }
    // Text Completion: SillyTavern asks the server to keep the prompt within your Context (tokens) setting, and a server
    // asked for more cuts the prompt's beginning, the instructions, so the model carries on the story instead of doing
    // the job. Fit the prompt (and the answer's room) to that context first.
    const context = Number(ctx().maxContext) || 0;
    const fit = fitToContext(messages, maxTokens, context);
    if (!fit.fits && !warnedSmall.has(name)) {
        warnedSmall.add(name);
        toastr.warning(`“${name}” works in ${context} tokens (Context in SillyTavern's settings), too few for Worldhopper's instructions and the chat. 8192 or more works; set the same size where the model is loaded.`, 'Worldhopper', { timeOut: 20000 });
    }
    messages = fit.messages;
    maxTokens = fit.maxTokens;
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

/**
 * The Warden, when one is picked: a small local model trained only for the Ledger, so it does the Ledger's updates and
 * their second looks, and nothing else (World notes, Mind Book and the body checks stay on the Ledger's model). When it
 * can't be reached (its server isn't running), the Ledger's model does the update and the status says so; it's tried
 * again a minute later.
 */
const wardenProfile = () => settings().ledger.wardenProfile || '';
// The modes the Warden was trained on (its Gym stories). With any other mode picked it sits the chat out: in a
// Segmentation + Reverse Vore chat it read every use of the power (taking a head off) as a skinsuit and wrote it back
// after each removal, 15 corrections in an evening (2026-10-29), where Haiku got 10 of those 15 right.
const WARDEN_MODES = ['Possession', 'Multipossession', 'Skinsuit', 'Hive Mind', 'Body Swap'];
const wardenSkips = () => [...expandModes(currentModes())].filter(m => !WARDEN_MODES.includes(m));
let wardenDown = 0;
let bodiesBy = '';   // who did the newest update's calls: 'warden', or 'ledger' when the Warden couldn't be reached
async function askBodies(messages, maxTokens) {
    const w = wardenProfile();
    if (w && Date.now() - wardenDown > 60000 && !wardenSkips().length) {
        try { const text = await askProfile(w, messages, maxTokens, 0.1); bodiesBy ||= 'warden'; return text; }
        catch (err) { wardenDown = Date.now(); console.warn(LOG, 'the Warden couldn\'t be reached; the Ledger model takes over', err); }
    }
    bodiesBy = 'ledger';
    return askLedger(messages, maxTokens, 0.1);
}

// Where Start Warden.bat (or KoboldCpp with the Warden model on port 5002) answers, OpenAI-style.
const WARDEN_URL = 'http://127.0.0.1:5002/v1';

/**
 * Set up: makes (or fixes) a "Warden" connection profile pointing at the Warden's server, picks it, and sends one tiny
 * request through SillyTavern's server, the way the Ledger will (so the check works from a phone too). No preset: the
 * server's own sampling, with the temperature the Engine sends.
 */
async function setupWarden() {
    const c = ctx();
    const cm = c.extensionSettings.connectionManager;
    if (!cm || c.extensionSettings.disabledExtensions?.includes('connection-manager')) { toastr.warning('Turn on SillyTavern\'s Connection Manager extension first: the Warden goes through a connection profile.'); return; }
    cm.profiles ??= [];
    const had = cm.profiles.find(p => p.name === 'Warden');
    const url = await c.callGenericPopup('Where does the Warden answer? With Start Warden.bat (KoboldCpp with the Warden model) on this PC, it\'s this address.', c.POPUP_TYPE.INPUT, had?.['api-url'] || WARDEN_URL);
    if (!url) return;
    const profile = {
        mode: 'cc', exclude: [], proxy: 'None', 'stop-strings': '[]', 'start-reply-with': '', 'reasoning-template': '', 'prompt-post-processing': 'none',
        id: had?.id || crypto.randomUUID(), name: 'Warden', api: 'custom', 'api-url': String(url).trim().replace(/\/+$/, ''), model: 'warden',
    };
    if (had) { for (const k of Object.keys(had)) delete had[k]; Object.assign(had, profile); } else cm.profiles.push(profile);
    settings().ledger.wardenProfile = 'Warden';
    wardenDown = 0;
    save();
    renderModelSelects();
    const t0 = performance.now();
    try {
        const text = await askProfile('Warden', [{ role: 'system', content: 'Answer with {} and nothing else.' }, { role: 'user', content: 'Nothing changed.' }], 8, 0);
        if (!String(text).trim()) throw new Error('empty answer');
        const secs = (performance.now() - t0) / 1000;
        toastr.success(`The Warden answered in ${secs.toFixed(secs < 1 ? 2 : 1)} s. It does the Ledger's updates after each reply from now on.`, 'Worldhopper');
    } catch (err) {
        console.warn(LOG, 'Warden check', err);
        toastr.warning(`The Warden's profile is set up, but nothing answered at ${profile['api-url']}. Start KoboldCpp with the Warden model (Start Warden.bat), then press Set up again. Until then the Ledger model does the updates.`, 'Worldhopper', { timeOut: 15000 });
    }
}

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
    renderStrip();   // the quick actions on the strip come and go with Possession
}

/**
 * What the Body Ledger and the Mind Book hold right now, for the Codex (codex-core's state). A side that isn't running
 * in this chat (switched off, its modes not picked, or no model to run it) is null, and then the Codex arms by the
 * picks alone, as it always did.
 */
function codexState({ fresh = false } = {}) {
    const bodies = ledgerWanted() && ledgerProfile() ? normalizeLedger((!fresh && headLedger()?.ledger) || EMPTY_LEDGER) : null;
    const book = mindWanted() && ledgerProfile() && !fresh ? headMind()?.book : null;
    const rides = bodies ? bodies.bodies.filter(b => b.body && b.driver && b.body.toLowerCase() !== 'none') : [];
    const how = re => rides.some(b => re.test(b.how || ''));
    return {
        bodies: bodies && { ridden: rides.length > 0, several: multiBodyGroups(bodies).length > 0 || how(/hive/i), copy: how(/cop(?:y|ied)|propagat/i),
            puppet: how(/puppet/i), worn: how(/skin|worn/i), swap: how(/swap/i) },
        minds: mindWanted() && ledgerProfile() ? { hypnosis: !!book?.hypnosis?.length, control: !!book?.control?.length, perception: !!book?.perception?.length } : null,
    };
}

async function onEntriesLoaded(lore) {
    blankForTrial();
    await armCodex(lore);
    if (trial?.used) asNormalReply(lore);
}

async function armCodex(lore) {
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

    // What's happening right now, so reminders and details about one kind of body or mind wait until it exists. A card
    // test's reply is the first one of a new chat: nothing has happened yet, and its opening is what's recent.
    const state = codexState({ fresh: !!trial?.used });
    const recent = trial?.used ? `${trial.greeting}\n${trial.player}` : (ctx().chat || []).filter(inStory).slice(-2).map(m => m.mes).join('\n');
    let n = 0;
    for (const list of lists) {
        for (const e of list) {
            if (e.world !== s.world) continue;
            const plan = planEntry(e.comment, active, { state, recent });
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

/** The compiled rules of every card in this chat that has dials (one card, or a group's members). */
/** The cards in this chat: the character, or every member of a group. */
function chatCards() {
    const c = ctx();
    const g = c.groupId ? c.groups?.find(x => x.id === c.groupId) : null;
    return g ? (g.members || []).map(a => c.characters?.find(ch => ch.avatar === a)) : [c.characters?.[c.characterId]];
}

function chatRules() {
    return chatCards().map(ch => compileRules(cardRules(ch?.data))).filter(r => r.writer);
}

/** How fast change builds in this chat, from its cards' "Change that builds" rule: { holds (0: it doesn't), fades }. */
function changePace() {
    const paces = chatCards().map(ch => compileRules(cardRules(ch?.data)).change).filter(p => p.holds);
    return paces.length ? { holds: Math.max(...paces.map(p => p.holds)), fades: paces.some(p => p.fades) } : { holds: 0, fades: false };
}

/**
 * The card's worldhopper data, written whole. SillyTavern deep-merges what an extension writes into the card, so a rule
 * you cleared would stay on disk; clearing the field first (its unset marker) makes the write exact.
 */
async function writeWorldhopperField(chid, value) {
    const c = ctx();
    await c.writeExtensionField(chid, 'worldhopper', '__@@UNSET@@__');
    await c.writeExtensionField(chid, 'worldhopper', value);
}

/** The Card rules editor for this chat's character; what it saves goes into the card (extensions.worldhopper.rules). */
async function openRulesView() {
    const c = ctx();
    const ch = c.characters?.[c.characterId];
    if (c.groupId || !ch) { toastr.info('Card rules belong to one character: open a chat with that character.'); return; }
    return showView('rules', view => rulesView({
        name: ch.name, rules: cardRules(ch.data) || {}, dials: DIALS, preview: r => compileRules(r).writer,
        tokens: text => Math.max(10, Math.round(text.length / 4.4 / 10) * 10), canConvert: !!ch.description, backup: !!ch.data?.extensions?.worldhopper?.rules_backup,
    }, {
        save: async rules => {
            await writeWorldhopperField(c.characterId, { ...(ch.data?.extensions?.worldhopper || {}), rules: normalizeRules(rules) });
            toastr.success(`Saved ${ch.name}'s card rules.`);
            renderCodexPanel();
        },
        convert: () => convertRules(),
        restore: async () => { await restoreCardText(); view.refresh(); },
        refresh: view.refresh,
    }));
}

// The card's text fields "Read them from the card" can take rules out of. Post-history lives only in the V2 data.
const CARD_FIELDS = ['description', 'personality', 'scenario', 'post_history_instructions'];
const cardField = (ch, f) => String((f === 'post_history_instructions' ? ch.data?.post_history_instructions : ch[f] ?? ch.data?.[f]) || '');

/** Writes text fields into the card (top level and V2 data alike), then reloads characters and the open editor. */
async function writeCardFields(chid, fields) {
    const c = ctx();
    const ch = c.characters[chid];
    const top = Object.fromEntries(Object.entries(fields).filter(([k]) => k !== 'post_history_instructions'));
    const res = await fetch('/api/characters/merge-attributes', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ avatar: ch.avatar, ...top, data: { ...fields } }) });
    if (!res.ok) throw new Error(`couldn't save the card (${res.status})`);
}

/** After the card's text changed on disk: fresh characters, and the editor (if it shows this card) showing the new text. */
async function reloadCard(chid) {
    const c = ctx();
    await c.getCharacters();
    if (Number(ctx().characterId) !== Number(chid)) return;
    const ch = ctx().characters[chid];
    $('#description_textarea').val(ch.description || '');
    $('#personality_textarea').val(ch.personality || '');
    $('#scenario_pole').val(ch.scenario || '');
    $('#post_history_instructions_textarea').val(ch.data?.post_history_instructions || '');
    $('#firstmessage_textarea').val(ch.first_mes || '');
    // ST saves the editor with this hidden copy of the card: it has to hold what's on disk now.
    if (ch.json_data) $('#character_json_data').val(ch.json_data);
}

const roughTokens = text => Math.round(String(text || '').length / 4.4);

/** "Read them from the card": the Notes model fills the dials from the card's prose and names what can come out. */
async function convertRules() {
    const c = ctx();
    const chid = c.characterId, ch = c.characters?.[chid];
    if (!ch) return;
    const profile = notesProfile();
    if (!profile) { toastr.warning('Pick a Notes model first (Settings → Models).'); return; }
    const fields = Object.fromEntries(CARD_FIELDS.map(f => [f, cardField(ch, f)]));
    toastr.info(`Reading ${ch.name}'s card for how the power works…`);
    let found;
    try { found = parseConvert(await askProfile(profile, buildConvertMessages({ name: ch.name, fields }), 8000, 0.2)); }
    catch (err) { toastr.error(`Couldn't read the card: ${unreachable(profile)}.`); return; }
    if (!found) { toastr.error('The model\'s answer couldn\'t be read. Try again.'); return; }
    const rules = normalizeRules({ ...found.rules, rider: { name: found.rules.rider?.name || ch.name.split(' ')[0], pronouns: found.rules.rider?.pronouns || '' } });
    const done = applyConvertCuts(fields, found.cut, found.standIn);
    const rulesText = compileRules(rules).writer;
    const sent = f => roughTokens(String(f.post_history_instructions || '').replace('{{original}}', '')) + roughTokens(f.description) + roughTokens(f.personality) + roughTokens(f.scenario);
    const before = sent(fields) + roughTokens(compileRules(cardRules(ch.data)).writer);
    const after = sent({ ...fields, ...done.fields }) + roughTokens(rulesText);
    const summary = rulesSummary(rules);
    const save = async withText => {
        const ext = ch.data?.extensions?.worldhopper || {};
        try {
            if (withText && Object.keys(done.fields).length) {
                const backup = { ...Object.fromEntries(Object.keys(done.fields).map(f => [f, fields[f]])), at: new Date().toISOString() };
                await writeCardFields(chid, done.fields);
                await writeWorldhopperField(chid, { ...ext, rules, rules_backup: backup });
            } else await writeWorldhopperField(chid, { ...ext, rules });
            await reloadCard(chid);
        } catch (err) { toastr.error(String(err.message || err)); return; }
        toastr.success(withText ? `Saved ${ch.name}'s rules as settings and took them out of the card's text.` : `Saved ${ch.name}'s card rules.`);
        renderCodexPanel();
        $('.popup-button-ok:visible').last().trigger('click');
    };
    return showView('convert', view => convertView({
        name: ch.name, rulesText, summary: summary.count ? `${summary.count} set${summary.highlights.length ? `, ${summary.highlights.join(', ')}` : ''}` : '',
        parts: done.parts, unsure: found.unsure, missed: done.missed, tooMuch: done.tooMuch, before, after,
    }, { apply: () => save(true), settingsOnly: () => save(false), refresh: view.refresh }));
}

/** Puts back the text "Read them from the card" took out, and clears the rules made from it. */
async function restoreCardText() {
    const c = ctx();
    const chid = c.characterId, ch = c.characters?.[chid];
    const ext = ch?.data?.extensions?.worldhopper || {};
    if (!ext.rules_backup) return;
    const { at, ...fields } = ext.rules_backup;
    try {
        await writeCardFields(chid, fields);
        const { rules, rules_backup, ...rest } = ext;
        await writeWorldhopperField(chid, rest);
        await reloadCard(chid);
    } catch (err) { toastr.error(String(err.message || err)); return; }
    toastr.success(`Put ${ch.name}'s card text back as it was, and cleared its card rules.`);
    renderCodexPanel();
}

/**
 * The card's rules go in with the Codex: whenever Worldhopper is on and the chat has modes, never for quiet requests.
 * In the chat at depth 4, not "in prompt": for chat completion ST hangs in-prompt extension prompts on the preset's Main
 * Prompt and drops them when the preset doesn't use Main, as the Worldhopper presets don't (found 2026-10-28: until
 * then no card's rules reached the writer).
 */
const RULES_DEPTH = 4;
function applyRulesInjection(type) {
    const rules = on() && type !== 'quiet' && currentModes().length ? chatRules() : [];
    ctx().setExtensionPrompt(RULES_KEY, rules.map(r => r.writer).join('\n\n'), IN_CHAT, RULES_DEPTH, false, SYSTEM);
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
    // A card with its own rules says so under its modes, in a few words; the line opens the editor.
    $('#wh_codex_rules_line').remove();
    const summary = t?.character && !t.group ? rulesSummary(cardRules(t.character.data)) : null;
    if (summary?.count) {
        chips.after($('<div id="wh_codex_rules_line" class="wh-rules-line" tabindex="0" title="Card rules: how this character\'s power works"></div>').append(
            '<i class="fa-solid fa-sliders"></i>', $('<span></span>').text(`Card rules: ${summary.count} set${summary.highlights.length ? ` · ${summary.highlights.join(', ')}` : ''}`))
            .on('click keydown', e => { if (e.type === 'click' || e.key === 'Enter') openRulesView(); }));
    }
    $('#wh_codex_rules').toggle(!!t?.character && !t.group && on());

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

// ------------------------------------------------------------------ World notes
// Kept like the Ledger, a snapshot on the reply they were written after, so swipes and deletes roll them back too.
// They run with the Ledger (the same modes and model), alongside its update rather than after it, so nothing waits longer.

function headWorld(beforeIndex) {
    const chat = ctx().chat || [];
    for (let i = Math.min(beforeIndex ?? chat.length, chat.length) - 1; i >= 0; i--) {
        const w = chat[i]?.extra?.wh_world;
        if (w) return { world: normalizeWorld(w), index: i };
    }
    return null;
}

/** The story clock's elapsed minutes as of a message (-1 when the World notes have no clock), for change that fades. */
function storyTime(before) {
    const c = headWorld(before)?.world.clock;
    return c && (c.day || c.time) ? c.elapsed : -1;
}

function storeWorld(mesId, world) {
    const msg = ctx().chat?.[mesId];
    if (!msg) return;
    const w = normalizeWorld(world);
    msg.extra ??= {};
    msg.extra.wh_world = w;
    const info = msg.swipe_info?.[msg.swipe_id];
    if (info) { info.extra ??= {}; info.extra.wh_world = w; }
}

/** Read the newest reply into the World notes. The caller saves the chat. Returns { ms } or null. */
async function updateWorld(mesId) {
    const chat = ctx().chat || [];
    if (!chat[mesId]) return null;
    const key = chatKey();
    const base = headWorld(mesId);
    const from = base ? base.index + 1 : Math.max(0, mesId - 7);
    const say = m => ({ name: speakerName(m), text: m.mes });
    const msgs = chat.slice(Math.max(from, mesId - 5), mesId + 1).filter(inStory).map(say);
    const context = base ? chat.slice(Math.max(0, base.index - 1), base.index + 1).filter(inStory).map(say) : [];
    // The ledger as it stood before this reply: the Ledger's own update is running at the same time.
    const ledger = headLedger(mesId)?.ledger || EMPTY_LEDGER;
    const t0 = performance.now();
    let step;
    const input = { world: base?.world || null, messages: msgs, context, userName: ctx().name1 || 'User', bodies: bodyLines(ledger), ledger };
    try { step = await worldStep(input, (m, max) => askLedger(m, max, 0.1)); }
    catch (err) { console.warn(LOG, 'World notes skipped', err); return null; }
    if (!step || chatKey() !== key || !ctx().chat?.[mesId]) return null;
    storeWorld(mesId, step.world);
    noteRun('world', mesId, input, step.world);
    return { ms: Math.round(performance.now() - t0) };
}

/**
 * A change made by hand in the Ledger view: one thing, one person's knowledge, one person's whereabouts or one timer,
 * or null to remove it; list 'clock' sets the clock (i is ignored).
 */
async function saveWorldItem(list, i, v) {
    const c = ctx();
    if (!c.chat?.length) return false;
    const w = normalizeWorld(headWorld()?.world || EMPTY_WORLD);
    if (list === 'clock') {
        const next = { day: v?.day || '', time: v?.time || '' };
        const world = { ...w, clock: { ...next, elapsed: w.clock.elapsed + clockAdvance(w.clock, next) } };
        storeWorld(c.chat.length - 1, world);
        noteCorrection('world', world);
        await c.saveChat();
        applyLedgerInjection();
        return;
    }
    const items = [...w[list]];
    // "saw Sam take over Kayla (saw it)": the how in brackets at the end of each line.
    const fact = line => { const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(line.trim()); return line.trim() ? { fact: m ? m[1] : line.trim(), how: m ? m[2] : '' } : null; };
    const ENTRY = {
        knows: () => ({ who: v.who, facts: String(v.facts || '').split('\n').map(fact).filter(Boolean) }),
        things: () => ({ what: v.what, whose: v.whose, holder: v.holder, where: v.where }),
        people: () => ({ who: v.who, where: v.where, wearing: v.wearing, state: v.state }),
        timers: () => ({ what: v.what, when: v.when }),
    };
    if (v === null) items.splice(i, 1);
    else {
        const entry = ENTRY[list]();
        if (i < 0) items.push(entry); else items[i] = entry;
    }
    storeWorld(c.chat.length - 1, { ...w, [list]: items });
    noteCorrection('world', { ...w, [list]: items });
    await c.saveChat();
    applyLedgerInjection();
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
    const t0 = performance.now();
    let step;
    const input = {
        ledger: first ? null : base.ledger,
        messages: msgs,
        context,
        userName,
        modes,
        card: first && t?.character ? cardText(t.character) : '',
        persona,
        userPronouns: userPronouns(),
        rules: chatRules().flatMap(r => r.ledger),
    };
    bodiesBy = '';
    // The Warden does the updates after each reply; a first build (or Rebuild) reads the card cold, which it gets wrong
    // on real cards (22% exactly right on the user's chats vs Haiku's 72%, while even on updates, 2026-10-28), so the
    // Ledger model does those.
    try {
        step = await ledgerStep(input, first ? (m, max) => askLedger(m, max, 0.1) : askBodies);
    } catch (err) { ledgerStatus(`Ledger: ${unreachable(ledgerProfile())}.`); return fail; }
    if (!step) {
        ledgerStatus(`Ledger: the model's answer was unreadable; kept the previous ledger.${isLocalProfile(ledgerProfile()) ? ' A local model that writes story here instead of the update has lost its instructions: a larger context (8192 or more) or a stronger model helps.' : ''}`);
        return fail;
    }
    if (step.log.added.length) console.log(LOG, 'new body changes checked', step.log.added);
    if (step.log.ended.length) console.log(LOG, 'ended body changes checked', step.log.ended);
    const next = step.ledger;
    if (chatKey() !== key || !ctx().chat?.[mesId]) return fail;
    storeLedger(mesId, next);
    noteRun('ledger', mesId, input, next);
    if (save) await ctx().saveChat();
    applyLedgerInjection();
    renderLedgerPanel();
    const ms = Math.round(performance.now() - t0);
    const skips = wardenSkips();
    const by = !wardenProfile() || first ? '' : bodiesBy === 'warden' ? ' by the Warden'
        : skips.length ? `; the Warden sits out chats with ${skips.join(', ')}, which it wasn't trained on`
        : `; the Warden couldn't be reached, so ${ledgerProfile()} did it`;
    ledgerStatus(`Ledger updated (${(ms / 1000).toFixed(1)}s${by}).`);
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

const historyEdits = () => ctx().chatMetadata?.[HISTORY_EDITS_KEY] || {};
function historyText(beforeIndex, scene = null) {
    return renderHistory(bodyHistory(ledgerSnapshots(beforeIndex)), ctx().name1 || 'User', { scene, edits: historyEdits() });
}

/**
 * Your correction to one entry of the Body History (all the rides it groups): its notes, the kind of ride, the host's
 * mind and whether you know. values null takes the entry out; a ride that starts after this shows again.
 */
async function saveHistory(keys, lastEnd, values) {
    const meta = ctx().chatMetadata;
    meta[HISTORY_EDITS_KEY] ??= {};
    for (const k of keys) {
        if (!values) { meta[HISTORY_EDITS_KEY][k] = { removed: lastEnd }; continue; }
        const notes = Object.fromEntries(NOTE_FIELDS.map(f => [f, String(values[f] ?? '').trim()]));
        meta[HISTORY_EDITS_KEY][k] = { at: lastEnd, notes, how: String(values.how ?? '').trim(), host: String(values.host ?? '').trim(), user_knows: values.user_knows === 'no' ? 'no' : 'yes' };
    }
    await saveChatMeta();
    applyLedgerInjection();
    renderLedgerPanel();
    return true;
}
async function removeHistory(keys, lastEnd, title) {
    const c = ctx();
    const ok = await c.callGenericPopup(`Take "${title}" out of the history?`, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Remove', cancelButton: 'Cancel' });
    if (ok !== c.POPUP_RESULT.AFFIRMATIVE) return false;
    return saveHistory(keys, lastEnd, null);
}

/** Ask the notes model what the ended body changes left behind, and keep the answer on the message. */
async function noteEndedRides(mesId, ended, { save = true } = {}) {
    const chat = ctx().chat || [];
    const key = chatKey();
    const msgs = chat.slice(Math.max(0, mesId - 5), mesId + 1).filter(inStory).map(m => ({ name: speakerName(m), text: m.mes }));
    let text;
    const aftermath = chatRules().map(r => r.aftermath).find(Boolean) || '';
    try { text = await askProfile(notesProfile(), buildHistoryMessages(ended, msgs, { aftermath }), 2000, 0.1); }
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

// Your pronouns, said once in every prompt while Worldhopper is on (the Ledger or not).
const YOU_KEY = 'worldhopper_you';
const userPronouns = () => String(settings().personaPronouns?.[user_avatar] || '').trim();

function applyLedgerInjection(type) {
    const c = ctx();
    const s = settings().ledger;
    const pron = userPronouns();
    c.setExtensionPrompt(YOU_KEY, on() && type !== 'quiet' && pron ? `${c.name1 || 'User'} (the player) goes by ${pron}.` : '', IN_CHAT, 1, false, SYSTEM);
    if (!on() || !s.enabled || type === 'quiet') {
        c.setExtensionPrompt(LEDGER_KEY, '', IN_CHAT, 1, false, SYSTEM);
        c.setExtensionPrompt(WORLD_KEY, '', IN_CHAT, 1, false, SYSTEM);
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
    const text = bodies && head ? renderLedger(head.ledger, c.name1 || 'User', { lastUserText, scene, userPronouns: userPronouns(), ...hostSheets(head.ledger, chat, limit) }) : '';
    c.setExtensionPrompt(LEDGER_KEY, text, IN_CHAT, 1, false, SYSTEM);
    // The clock, and things, who knows what, and where people are and what they have on, for the people in the scene;
    // your own bodies always, so bodies of yours in different places stay apart.
    const world = bodies ? headWorld(limit) : null;
    const me = String(c.name1 || 'User').toLowerCase();
    const yours = [c.name1 || 'User', ...(head?.ledger.bodies || []).filter(b => String(b.driver || '').toLowerCase() === me).map(b => b.body)];
    const running = head ? rosterOf(head.ledger, c.name1 || 'User').map(r => r.name) : [];
    c.setExtensionPrompt(WORLD_KEY, world ? renderWorld(world.world, c.name1 || 'User', { scene, always: yours, running }) : '', IN_CHAT, 1, false, SYSTEM);
    c.setExtensionPrompt(HISTORY_KEY, bodies ? historyText(limit, scene) : '', IN_CHAT, HISTORY_DEPTH, false, SYSTEM);
    // The Mind Book, with the watcher lines for the reply about to be written: your newest message, and the scene
    // as the last two messages leave it.
    const kinds = mindKinds();
    const mind = kinds.length ? headMind(limit) : null;
    const recent = chat.slice(Math.max(0, limit - 2), limit).filter(inStory).map(m => m.mes).join('\n');
    c.setExtensionPrompt(MIND_KEY, mind ? renderMindBook(mind.book, c.name1 || 'User', { kinds, latest: lastUserText, recent, scene, ...changePace(), at: limit, time: storyTime(limit) }) : '', IN_CHAT, 1, false, SYSTEM);
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
// Someone you marked "not in this scene" stays out until a message after that names them again.
function hostsBack(ledger, chat, limit) {
    const taken = new Set((ledger?.bodies || []).filter(b => b.body).map(b => personaKey(b.body)));
    const skip = cardNames();
    const recent = from => chat.slice(Math.max(0, limit - SCENE_MESSAGES, from), limit).filter(inStory).map(m => m.mes).join('\n');
    return Object.values(personaMap()).filter(e => e.sheet && !taken.has(personaKey(e.body)) && !skip.has(personaKey(e.body))
        && personNamedIn(recent(e.awayAt == null ? 0 : e.awayAt + 1), [e.body]));
}

/** "Not in this scene" on someone back in their own body: the writer stops getting them until they come up again. */
async function leaveScene(name) {
    const e = ctx().chatMetadata?.[PERSONA_KEY]?.[personaKey(name)];
    if (!e) return;
    e.awayAt = (ctx().chat?.length || 1) - 1;
    await saveChatMeta();
    applyLedgerInjection();
    renderLedgerPanel();
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
    const described = describedIn(chat, named, picked);
    const t = selectionTarget();
    ledgerStatus(`Writing a host persona for ${name}…`);
    let text;
    try {
        text = await askProfile(notesProfile(), buildPersonaMessages({ body: name, row, card: t?.character ? cardText(t.character) : '', messages: msgs, described, userName: c.name1 || 'User' }), 2000, 0.4);
    } catch { ledgerStatus(`Host persona for ${name} skipped: ${unreachable(notesProfile())}.`); return; }
    const sheet = parsePersona(text, [t?.character ? cardText(t.character) : '', ...described.map(m => m.text), ...msgs.map(m => m.text)].join(' '));
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
    if (sheet) map[k] = { body: name, sheet, at: Date.now(), ...(prev?.awayAt != null ? { awayAt: prev.awayAt } : {}) };
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

/**
 * A face in Stage's chat, tapped: shown big, the way a card's picture is (the card's full picture, your persona's, or
 * the one the Engine drew). Someone with no picture yet gets their picture card, to draw or add one.
 */
function zoomFace(name) {
    const c = ctx();
    const ch = cardCharacter(name);
    const src = same(name, c.name1) ? (user_avatar ? getUserAvatar(user_avatar) : '')
        : ch ? `/characters/${encodeURIComponent(ch.avatar)}` : pictureOf(name);
    if (src) zoomPicture(name, src);
    else openPicture(name);
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
    const described = describedIn(chat, named, picked);
    const t = selectionTarget();
    ledgerStatus(`Describing ${name}…`);
    let text;
    try { text = await askProfile(notesProfile(), buildLookMessages({ name, card: t?.character ? cardText(t.character) : '', messages: msgs, described, userName: c.name1 || 'User' }), 1200, 0.4); }
    catch { ledgerStatus(`Picture of ${name} skipped: ${unreachable(notesProfile())}.`); return ''; }
    const look = parseLook(text, name, [t?.character ? cardText(t.character) : '', ...described.map(m => m.text), ...msgs.map(m => m.text)].join(' '));
    if (!look) { ledgerStatus(describesMinor(text) ? `Look for ${name} not kept: it described them as a minor.` : `Look for ${name}: the model's answer was unreadable.`); return ''; }
    if (chatKey() !== key) return '';
    await saveLook(name, look);
    ledgerStatus(`Look written for ${name}.`);
    return look;
}

/** The earliest few messages, beyond the ones already picked, that name someone and say how they look. */
function describedIn(chat, named, picked) {
    return chat.filter(m => !picked.has(m) && named.test(m.mes) && LOOK_WORDS.test(m.mes)).slice(0, 4).map(m => ({ name: speakerName(m), text: m.mes }));
}

/** The prompt someone's picture is drawn from: the one you wrote for them, or one built from their look and clothes. */
function picturePrompt(name) {
    const own = pictureMap()[personaKey(name)]?.prompt;
    if (own) return own;
    const look = lookOf(name).look;
    if (!look) return '';
    const row = (headLedger()?.ledger?.bodies || []).find(b => same(b.body, name));
    const wearing = normalizeWorld(headWorld()?.world || EMPTY_WORLD).people.find(x => same(x.who, name))?.wearing || '';
    return portraitPrompt(look, name, { pronouns: row?.pronouns || '', wearing });
}

/** Your own prompt for someone's picture; saved empty (or unchanged), the picture goes back to the one built for them. */
async function editPrompt(name) {
    const c = ctx();
    const map = pictureMap(true);
    const k = personaKey(name);
    const before = picturePrompt(name);
    const res = await c.callGenericPopup(`The prompt ${name}'s picture is drawn from`, c.POPUP_TYPE.INPUT, before, { rows: 5, wide: true, okButton: 'Save', cancelButton: 'Cancel' });
    if (typeof res !== 'string') return;
    const prompt = res.replace(/\s+/g, ' ').trim();
    if (prompt && describesMinor(prompt)) { toastr.warning('People here are adults: that prompt describes a minor, so it wasn\'t saved.'); return; }
    map[k] = { ...(map[k] || {}), name };
    if (prompt && prompt !== before) map[k].prompt = prompt; else if (!prompt) delete map[k].prompt;
    await saveChatMeta();
    refreshViews();
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
    if (!pictureMap()[personaKey(name)]?.prompt && !lookOf(name).look && !await writeLook(name, key)) return;
    if (chatKey() !== key) return;
    ledgerStatus(`Drawing ${name}…`);
    let drawn;
    try { drawn = await imagine(picturePrompt(name)); } catch (err) { console.warn(LOG, err); ledgerStatus(`Picture of ${name}: ${String(err.message || err).slice(0, 160)}.`); return; }
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
    const res = await c.callGenericPopup(`How ${name} looks: short details with " · " between them, a ~ before a guess`, c.POPUP_TYPE.INPUT, lookOf(name).look, { rows: 3, wide: true, okButton: 'Save', cancelButton: 'Cancel' });
    if (typeof res === 'string') await saveLook(name, res);
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
    // In Stage mode, anyone with a line in the latest replies too: the story's people get faces of their own.
    if (stageOn()) people.push(...stageSpeakers());
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
// cards that read at a glance (views.js): one per person, with everything about them a tap away. A part's ✏️ turns it
// into its form in place. An open view redraws itself whenever what it shows changes, except while you're changing
// something in it; then it waits until you save or cancel.
const liveViews = new Set();   // { kind: 'ledger' | 'mind' | 'picture', render } for each view open
const viewBusy = new Map();   // 'sheet:<person>' or 'pic:<person>' → what's being done, shown on their card
const refreshViews = kind => { for (const v of liveViews) if (!kind || v.kind === kind) v.render(); };
const openCard = { ledger: '', mind: '' };   // whose card is open in each view, so a redraw keeps it open

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
    // Stage mode: the two books open as a sheet, with a tab for each one the chat uses.
    if (stageOn() && BOOKS[kind]) {
        const tabs = [ledgerWanted() || kind === 'ledger' ? { kind: 'ledger', label: 'Body Ledger', icon: 'fa-people-arrows' } : null,
            mindWanted() || kind === 'mind' ? { kind: 'mind', label: 'Mind Book', icon: 'fa-brain' } : null].filter(Boolean);
        return openSheet({ kind, tabs, make: (k, view) => BOOKS[k](view), live: liveViews });
    }
    const box = $('<div class="wh-dos-wrap"></div>');
    const draw = () => box.empty().append(make(view));
    const view = { kind, render: () => { if (!box.find('.wh-dos-editing').length) draw(); }, refresh: draw };
    draw();
    liveViews.add(view);
    try { await c.callGenericPopup(box, c.POPUP_TYPE.TEXT, '', { wide, allowVerticalScrolling: true, okButton: 'Close' }); } finally { liveViews.delete(view); }
}

/** Marked "not in this scene" in the Ledger, and not named since. */
const awayKeys = (map, chat) => new Set(Object.values(map).filter(e => e.awayAt != null
    && !personNamedIn(chat.slice(e.awayAt + 1).filter(inStory).map(m => m.mes).join('\n'), [e.body])).map(e => personaKey(e.body)));

function ledgerViewData() {
    const c = ctx();
    const chat = c.chat || [];
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    const world = normalizeWorld(headWorld()?.world || EMPTY_WORLD);
    const canon = aliasResolver(ledger);
    const me = canon(c.name1 || '');
    const map = personaMap();
    const cards = cardNames();
    const scene = chat.slice(-SCENE_MESSAGES).filter(inStory).map(m => m.mes).join('\n');
    const back = hostsBack(ledger, chat, chat.length).map(e => e.body);
    const away = awayKeys(map, chat);
    const groups = historyGroups(bodyHistory(ledgerSnapshots()), { edits: historyEdits() });
    const { people, things } = ledgerPeople({ ledger, world, sheets: map, back, history: groups, me: c.name1 || '', scene, cards, away });
    const taken = new Set(takenBodies(ledger).map(b => personaKey(b.body)));
    const ride = g => ({
        keys: g.keys, lastEnd: g.lastEnd, hidden: g.user_knows === 'no', raw: { how: g.how, host: g.host, user_knows: g.user_knows, ...g.notes },
        title: `${g.driver} · ${g.ended === 1 ? 'once' : g.ended === 2 ? 'twice' : `${g.ended}×`}${g.ongoing ? ', again now' : ''}`,
        lines: [g.notes.remembers ? ['Remembers', g.notes.remembers] : g.host ? ['Their mind', g.host] : null,
            g.notes.believes ? ['Believes', g.notes.believes] : null, g.notes.owns ? ['Held to', g.notes.owns] : null, g.notes.seen ? ['Seen', g.notes.seen] : null,
            g.notes.kept ? ['Kept', g.notes.kept] : null, g.notes.left ? ['Left behind', g.notes.left] : null].filter(Boolean),
    });
    const full = people.map(p => {
        const k = personaKey(p.name);
        const e = map[k];
        // You and anyone with a card of their own have a picture already, and no sheet or look of the Engine's.
        const ours = !cards.has(k) && p.key !== me;
        const rows = p.rows.map(i => ({ i, row: { ...ledger.bodies[i] } }));
        const look = ours ? lookOf(p.name).look : '';
        return {
            ...p,
            pronouns: p.key === me ? userPronouns() : rows.find(r => r.row.body && r.row.pronouns)?.row.pronouns || '',
            face: faceFor(p.name, p.kind === 'plain' ? 'idle' : p.kind),
            rows,
            own: p.own >= 0 ? { i: p.own, ...ledger.own[p.own] } : null,
            place: p.place >= 0 ? { i: p.place, ...world.people[p.place] } : null,
            knows: p.knows >= 0 ? { i: p.knows, ...world.knows[p.knows] } : null,
            things: p.things.map(i => ({ i, ...world.things[i] })),
            powers: p.powers.map(i => ({ i, ...ledger.powers[i] })),
            alias: p.aliases >= 0 ? { i: p.aliases, ...ledger.aliases[p.aliases] } : null,
            history: p.history.map(gi => ride(groups[gi])),
            sheet: ours && (taken.has(k) || e?.sheet || e?.removed) ? { sheet: e?.sheet || null, removed: !!e?.removed, busy: viewBusy.get(`sheet:${k}`) || '' } : null,
            look: ours ? { parts: glanceParts(look), raw: look } : null,
        };
    });
    return {
        people: full, things: things.map(i => ({ i, ...world.things[i] })), clock: world.clock,
        timers: world.timers.map(t => ({ ...t, left: timeLeft(world.clock, t.when) })), open: openCard.ledger,
        // Pictures for the people a story is using: not for everyone folded away under "Everyone else".
        ...missingPictures(full.filter(p => p.group !== 'rest').map(p => [p.name, p.face])),
        empty: ledgerWanted() ? 'Everyone is in their own body, and there is nothing to note yet.' : 'The Ledger is off: switch on Body Ledger & Mind Book under Settings → Choices, and pick a body mode.',
    };
}

/**
 * "Where they are" on someone's card: the World notes' place (where, wearing, state), and what their body is busy with
 * and any notes on it in the Ledger. Clearing every place field takes them out of the World notes' places.
 */
async function saveNow(p, v) {
    const c = ctx();
    if (!c.chat?.length) return false;
    const t = s => String(s ?? '').trim();
    const w = normalizeWorld(headWorld()?.world || EMPTY_WORLD);
    const place = { who: p.place?.who || p.name, where: t(v.where), wearing: t(v.wearing), state: t(v.state) };
    const people = [...w.people];
    const at = p.place ? people.findIndex(x => same(x.who, p.place.who)) : -1;
    if (place.where || place.wearing || place.state) { if (at >= 0) people[at] = place; else people.push(place); } else if (at >= 0) people.splice(at, 1);
    storeWorld(c.chat.length - 1, { ...w, people });
    noteCorrection('world', { ...w, people });
    const row = p.rows[0]?.row;
    if (!row && !p.own) { await c.saveChat(); applyLedgerInjection(); return true; }
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    if (row) {
        const j = ledger.bodies.findIndex(b => same(b.body, row.body) && same(b.driver, row.driver));
        if (j < 0) return changedMeanwhile('Ledger');
        ledger.bodies[j] = { ...ledger.bodies[j], ...('doing' in v ? { doing: t(v.doing) } : {}), ...('notes' in v ? { notes: t(v.notes) } : {}) };
    } else {
        const j = ledger.own.findIndex(o => same(o.who, p.own.who));
        if (j >= 0 && 'doing' in v) ledger.own[j] = { ...ledger.own[j], doing: t(v.doing) };
    }
    await storeLedgerEdit(ledger);
    return true;
}

/** Someone's look as you typed it: into their sheet when they have one, else kept for their picture. Empty clears it. */
async function saveLook(name, text) {
    const look = glance(String(text || '').replace(/\s+/g, ' ').trim());
    if (look && describesMinor(look)) { toastr.warning('People here are adults: that look describes a minor, so it wasn\'t saved.'); return false; }
    const e = personaMap()[personaKey(name)];
    if (e?.sheet) {
        const { Look, ...rest } = e.sheet;
        const next = look ? { ...e.sheet, Look: look } : rest;
        await setSheet(name, Object.keys(next).length ? next : null, { taken: isTaken(name) });
        applyLedgerInjection();
    } else {
        const map = pictureMap(true);
        const k = personaKey(name);
        map[k] = { ...(map[k] || {}), name };
        if (look) map[k].look = look; else delete map[k].look;
        await saveChatMeta();
    }
    refreshViews();
    return true;
}

/** Saves the Ledger as changed in the view, on the newest message; the next update builds on it. */
async function storeLedgerEdit(next) {
    const c = ctx();
    storeLedger(c.chat.length - 1, normalizeLedger(next));
    noteCorrection('ledger', normalizeLedger(next));
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
    if (v && list === 'own') {
        item = { who: v.who.trim(), notes: v.notes.trim(), doing: v.doing.trim() };
        if (!item.who) { toastr.warning('Say whose own body it is.'); return false; }
    }
    if (i < 0) ledger[list].push(item);
    else if (item) ledger[list][i] = item;
    else ledger[list].splice(i, 1);
    await storeLedgerEdit(ledger);
    return true;
}

async function saveSheetFromView(name, values) {
    const made = sheetFromFields({ ...(personaMap()[personaKey(name)]?.sheet || {}), ...values });
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
    const c = ctx();
    const book = normalizeBook(headMind()?.book || EMPTY_BOOK);
    const me = String(c.name1 || '').toLowerCase();
    const isMe = n => !!n && n.toLowerCase() === me;
    const kind = by => (isMe(by) ? 'you' : 'npc');
    const label = n => (isMe(n) ? 'you' : n);
    const scene = (c.chat || []).slice(-SCENE_MESSAGES).filter(inStory).map(m => m.mes).join('\n');
    const hyp = (h, i) => ({ i, raw: h, who: h.who, kind: kind(h.by), by: h.by, byLabel: label(h.by), hidden: h.user_knows === 'no', now: h.now || 'awake', deepest: h.deepest,
        suggestions: h.suggestions.map(x => ({ text: x.text, stage: x.stage })), triggers: h.triggers });
    const will = (w, i) => ({ i, raw: w, who: w.who, kind: kind(w.by), by: w.by, byLabel: label(w.by), resists: w.resists === 'yes', hidden: w.user_knows === 'no', set: w.set, own: w.own });
    const change = (ch, i) => ({ i, raw: ch, who: ch.who, kind: kind(ch.by), by: ch.by, byLabel: label(ch.by), hidden: ch.user_knows === 'no', what: ch.what, from: ch.from, ...changeStage(ch, changeAt()) });
    const { people, edits } = mindPeople({ book, me: c.name1 || '', scene });
    const full = people.map(p => {
        const h = p.hypnosis >= 0 ? hyp(book.hypnosis[p.hypnosis], p.hypnosis) : null;
        const wills = p.control.map(i => will(book.control[i], i));
        const changes = p.influence.map(i => change(book.influence[i], i));
        const k = (h || wills[0] || changes[0])?.kind || 'npc';
        return { ...p, kind: k, face: faceFor(p.name, k), hypnosis: h, control: wills, influence: changes };
    });
    return {
        ...missingPictures(full.map(p => [p.name, p.face])),
        kinds: [...new Set([...mindKinds(), ...MIND_KINDS.filter(k => book[k].length)])],
        people: full,
        edits: edits.map(i => {
            const e = book.perception[i];
            const who = e.everyone ? `Everyone${e.except.length ? ` but ${e.except.join(', ')}` : ''}` : e.who.join(', ');
            return {
                i, raw: e, kind: kind(e.by), by: e.by, byLabel: label(e.by), hidden: e.user_knows === 'no', what: e.what,
                icon: e.kind === 'unseen' ? 'fa-eye-slash' : e.kind === 'false' ? 'fa-masks-theater' : 'fa-wand-magic-sparkles',
                title: e.kind === 'unseen' ? `${who} can't perceive ${label(e.target)}` : e.kind === 'false' ? `${who}: a false belief` : `${who}: an altered normal`,
            };
        }),
        holds: changeAt().holds, open: openCard.mind,
        empty: 'Pick Hypnosis, Mind Control or Altered Perception for this character, or give its card a "Change that builds" rule, to start a Mind Book.',
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
    noteCorrection('mind', next);
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
    if (kind === 'influence') {
        if (!String(entry.what || '').trim()) { toastr.warning('Say what the change is.'); return false; }
        // A new change, or a count set by hand, counts from here for fading.
        if (!raw || 'times' in values) { entry.last = Math.max(0, (ctx().chat?.length || 1) - 1); entry.lastTime = storyTime(); entry.times = Math.max(1, parseInt(entry.times, 10) || 1); }
    }
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

// The two books, drawn for a popup or a Stage sheet alike.
const BOOKS = {
    ledger: view => ledgerView(ledgerViewData(), ledgerActions(view)),
    mind: view => mindView(mindViewData(), { open: key => { openCard.mind = key; view.refresh(); }, save: saveMindEntry, remove: removeMindEntry, drawMissing, refresh: view.refresh }),
};
function openLedgerView() { return showView('ledger', BOOKS.ledger); }
function openMindView() { return showView('mind', BOOKS.mind); }
function ledgerActions(view) {
    return ({
        open: key => { openCard.ledger = key; view.refresh(); },
        saveBody, removeBody, saveNow, saveLook,
        rewriteLook: name => busyWork(`pic:${personaKey(name)}`, name, 'Writing the look…', () => writeLook(name)),
        saveSheet: saveSheetFromView, deleteSheet,
        writeSheet: name => busyWork(`sheet:${personaKey(name)}`, name, 'Writing the sheet…', () => rewritePersona(name)),
        makePersona,
        savePower: (i, v) => saveListItem('powers', i, v),
        saveAlias: (i, v) => saveListItem('aliases', i, v),
        saveOwn: (i, v) => saveListItem('own', i, v),
        saveHistory, removeHistory, leaveScene,
        saveThing: (i, v) => saveWorldItem('things', i, v),
        saveKnows: (i, v) => saveWorldItem('knows', i, v),
        savePlace: (i, v) => saveWorldItem('people', i, v),
        saveTimer: (i, v) => saveWorldItem('timers', i, v),
        saveClock: v => saveWorldItem('clock', 0, v),
        drawMissing,
        refresh: view.refresh,
    });
}
function openPicture(name, kind = 'idle') {
    const k = personaKey(name);
    return showView('picture', () => pictureView({
        name, image: pictureOf(name), look: glanceParts(lookOf(name).look), prompt: picturePrompt(name), ownPrompt: !!pictureMap()[k]?.prompt,
        busy: viewBusy.get(`pic:${k}`) || '', kind,
    }, {
        draw: () => busyWork(`pic:${k}`, name, 'Drawing…', () => drawPicture(name)),
        upload: () => uploadPicture(name),
        remove: () => removePicture(name),
        editLook: () => editLook(name),
        editPrompt: () => editPrompt(name),
    }), { wide: false });
}

/**
 * Every description in the settings panel (a <small> with no id beside a <b> label) behind an ⓘ by the label: its text
 * shows on hover, and a tap opens it under the label (phones have no hover). Status lines, which have ids, stay out.
 */
function tipify(root) {
    root.find('small:not([id])').each((_, el) => {
        const small = $(el);
        const label = small.siblings('b').first();
        const text = small.text().replace(/\s+/g, ' ').trim();
        if (!label.length || !text || small.hasClass('wh-tipped')) return;
        small.addClass('wh-tipped');
        // Inside the label, so it stays on the label's line where the label and its text are stacked.
        label.append(' ', $('<i class="fa-solid fa-circle-info wh-info" tabindex="0" role="button"></i>').attr({ title: text, 'aria-label': text }));
    });
    root.on('click keydown', '.wh-info', function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();   // inside a switch's label, a tap would flip the switch
        $(this).closest('b').nextAll('small.wh-tipped').first().toggleClass('wh-open');
    });
}

/** The pronouns fields, for the persona you're using now. */
function renderYou() {
    $('#wh_you_for').text(`For ${ctx().name1 || 'your persona'}.`);
    $('#wh_you_pronouns, #wh_persona_pronouns').val(userPronouns());
}

/**
 * A Pronouns box in SillyTavern's Persona Management, under the description and where it goes in the prompt, which
 * (like the description) is for the persona you're using. SillyTavern has no such field; the value is kept in
 * Worldhopper's settings, not in the persona, so an update to SillyTavern can't drop it. Nothing happens if the panel
 * isn't where it's expected.
 */
function addPersonaPronounsBox() {
    const desc = $('#persona_description');
    if (!desc.length || $('#wh_persona_pronouns').length) return;
    const box = $(`<div id="wh_persona_pronouns_row">
        <h4 class="flex-container alignItemsBaseline"><label for="wh_persona_pronouns">Pronouns</label><small title="SillyTavern has no pronoun field: Worldhopper tells every model in the chat, so none has to guess from the description.">Worldhopper</small></h4>
        <input id="wh_persona_pronouns" class="text_pole" list="wh_you_pronoun_list" placeholder="he/him, she/her, they/them…" autocomplete="off">
    </div>`);
    const after = $('.persona_management_description_position_container');
    if (after.length) after.after(box); else desc.after(box);
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
    const groups = historyGroups(bodyHistory(ledgerSnapshots()), { edits: historyEdits() });
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
const upFirst = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** A bar chip's lead: the person's face, small, when there is one; else the chip's icon. */
const chipLead = (icon, face) => (face ? `<img class="wh-chip-face" src="${esc(face)}" alt="" loading="lazy">` : `<i class="fa-solid ${icon} wh-chip-icon"></i>`);

// The bars above the chat: the Ledger's, then the Mind Book's under it. Made together, so they always stack the same way.
function ensureStrips() {
    if ($('#wh_ledger_strip').length) return;
    const bar = (id, cls, title, open) => $(`<div id="${id}" class="wh-ledger-strip ${cls}" title="${title}" role="button" tabindex="0"></div>`)
        .on('click keydown', e => {
            if ($(e.target).closest('.wh-act, .wh-act-input').length) return;   // the quick actions handle their own taps
            if (e.type !== 'click' && e.key !== 'Enter') return;
            // The band, in Stage mode: a body opens their card, anywhere else pulls the Board down or tucks it away.
            if (id === 'wh_ledger_strip' && stageOn()) {
                if (justPulled()) return;
                const chip = $(e.target).closest('.wh-chip[data-name]');
                if (chip.length) openPerson(chip.attr('data-name')); else setBoard(!boardOpen);
                return;
            }
            open();
        }).hide();
    $('#chat').before(bar('wh_ledger_strip', '', 'Body Ledger — tap to open', openLedgerView), bar('wh_mind_strip', 'wh-mind-strip', 'Mind Book — tap to open', openMindView));
    bindStripActions($('#wh_ledger_strip'));
    bindPull($('#wh_ledger_strip'), { isOpen: () => stageOn() && boardOpen, setOpen: v => { if (stageOn()) setBoard(v); } });
}

function renderStrip() {
    ensureStrips();
    const ledger = headLedger()?.ledger;
    const bodies = ledger?.bodies || [];
    const st = actionState();
    if (!st) actionPick = null;
    // The roster goes with it: a chat with no bodies must not keep the last chat's cards over the message box. A
    // possession chat keeps the strip for its + even before anyone is possessed.
    const stage = stageOn();
    $('#wh_ledger_strip').toggleClass('wh-band', stage).toggleClass('whs-open', stage && boardOpen)
        .attr('title', stage ? 'Pull down for the Board · tap a body for their card' : 'Body Ledger — tap to open');
    if (!ledgerWanted() || !ctx().chat?.length || (!bodies.length && !ledgerBusy && !st)) { $('#wh_ledger_strip').hide(); renderBoardNow(); renderLanes(); return; }
    if (actionPick && st) {
        $('#wh_ledger_strip').html(pickerHtml(st)).show().find('.wh-act-input').trigger('focus');
        renderBoardNow();
        renderLanes();
        return;
    }
    const canon = aliasResolver(ledger);
    const me = canon(ctx().name1 || '');
    const chip = (kind, icon, title, sub, tip, hidden, face = '', rider = '') => `<span class="wh-chip wh-${kind}${hidden ? ' wh-hidden' : ''}${face ? ' wh-has-face' : ''}" data-name="${esc(title)}" title="${esc(tip)}">`
        + (rider ? `<span class="wh-chip-lead">${chipLead(icon, face)}${rider}</span>` : chipLead(icon, face))
        + `<span class="wh-chip-text"><b>${esc(title)}</b><small>${esc(sub)}${hidden ? ' <i class="fa-solid fa-eye-slash" title="Hidden from you"></i>' : ''}</small></span></span>`;
    // In Stage mode, a ridden body carries its rider's face, small (a hidden ride only while the Board shows those).
    const riderFace = (b, kind) => {
        if (!stage || (kind !== 'you' && kind !== 'npc') || (b.user_knows === 'no' && !settings().stage.hidden)) return '';
        const img = faceFor(b.driver).image;
        return `<span class="wh-chip-rider ${kind === 'you' ? 'whs-you' : 'whs-npc'}${b.user_knows === 'no' ? ' whs-hidden' : ''}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : esc(String(b.driver).charAt(0).toUpperCase())}</span>`;
    };
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
        const door = st && kind === 'you' && st.mine.some(m => st.canon(m) === st.canon(title))
            ? `<i class="fa-solid fa-door-open wh-act wh-chip-release" data-act="release" data-name="${esc(title)}" role="button" tabindex="0" title="Release ${esc(title)}${st.hive ? ' from the hive' : ''}" aria-label="Release ${esc(title)}${st.hive ? ' from the hive' : ''}"></i>` : '';
        return chip(kind, icon, title, sub, tip, b.user_knows === 'no', faceFor(title).image, copy ? '' : riderFace(b, kind)).replace(/<\/span>$/, `${door}</span>`);
    });
    if (st) {
        const jump = !st.multi && st.mine.length === 1;
        const what = st.hive ? 'Absorb someone into the hive' : jump ? `Leave ${st.mine[0]} and possess someone else` : 'Possess someone';
        chips.push(`<span class="wh-act wh-chip-add" data-act="possess" role="button" tabindex="0" title="${esc(what)}" aria-label="${esc(what)}"><i class="fa-solid fa-user-plus"></i>${bodies.length ? '' : ` <span>${st.hive ? 'Absorb…' : 'Possess…'}</span>`}</span>`);
    }
    // The Ledger's own icon at the front (as in its panel heading), as the Mind Book's bar has a brain, so the two read as a pair.
    $('#wh_ledger_strip').html(`<span class="wh-strip-label" title="Body Ledger"><i class="fa-solid fa-people-arrows"></i></span>${chips.join('')}${ledgerBusy ? '<span class="wh-busy">updating…</span>' : ''}${stripControls(stage)}`).show();
    if (stage) $('#wh_mind_strip').hide();
    renderBoardNow();
    renderLanes();
}

// ------------------------------------------------------------------ Stage mode
// Worldhopper's own look for all of SillyTavern (stage.css), and in a story with bodies, the strip as a band that pulls
// down into the Board: everyone the story is using, by place, with riders' faces and lines. stage.js draws it.
let boardOpen = false;
const stageOn = () => on() && !!settings().stage.on;

/** The strip's buttons at its right end: in Stage mode, the Mind Book and the Board; otherwise the masks that start it. */
function stripControls(stage) {
    if (!stage) return '<span class="wh-band-ctl wh-band-ctl-plain"><span class="wh-act wh-band-btn wh-stage-start" data-act="stage" role="button" tabindex="0" title="Stage mode: Worldhopper\'s own look, with the Board" aria-label="Start Stage mode"><i class="fa-solid fa-masks-theater"></i></span></span>';
    const book = mindWanted() ? headMind()?.book : null;
    const n = book && !isEmptyBook(book) ? mindPeople({ book }).people.length : 0;
    const mind = n || mindBusy ? `<span class="wh-act wh-band-btn" data-act="mind" role="button" tabindex="0" title="Mind Book" aria-label="Mind Book"><i class="fa-solid fa-brain"></i>${mindBusy ? '<i class="fa-solid fa-spinner fa-spin"></i>' : ` ${n}`}</span>` : '';
    return `<span class="wh-band-ctl">${mind}<span class="wh-act wh-band-btn wh-band-toggle" data-act="board" role="button" tabindex="0" title="${boardOpen ? 'Tuck the Board away' : 'Pull down the Board'}" aria-label="Board" aria-expanded="${boardOpen}"><i class="fa-solid fa-chevron-down"></i></span></span>`;
}

/** Before Stage mode goes on: what it changes, and that turning it off puts everything back. */
async function askStage() {
    const c = ctx();
    const html = `<div class="wh-stage-ask">
        <h3><i class="fa-solid fa-masks-theater"></i> Turn on Stage mode?</h3>
        <p>Stage mode is Worldhopper's own look for all of SillyTavern: the top bar, menus, buttons, popups, the chat and the message box. It's drawn in your theme's colors and works with or without Moonlit Echoes.</p>
        <ul>
            <li>Replies split into narration and each speaker's lines, with that person's picture and name instead of the card's. A scenario card's picture goes, and its name gives way to where the scene is.</li>
            <li>The bodies strip becomes a band you pull down for the Board, and the Body Ledger and Mind Book open as sheets instead of popups.</li>
            <li>Moonlit Echoes' Echo, Whisper, Hush, Ripple and Tide chat styles step aside while it's on.</li>
        </ul>
        <p class="wh-muted">Nothing in your chats, cards or settings changes. Turn it off at the top of the Worldhopper panel, from the wand menu, or with the masks on the Board, and everything is back as it was.</p>
    </div>`;
    const ok = await c.callGenericPopup(html, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Turn on Stage mode', cancelButton: 'Not now' });
    return ok === c.POPUP_RESULT.AFFIRMATIVE;
}

/** Stage mode on or off, from the switch, the wand menu, the strip's masks or the Board. On asks first. */
async function setStage(v) {
    if (v && !settings().stage.on && !(await askStage())) { $('#wh_stage_on').prop('checked', false); return; }
    settings().stage.on = !!v;
    save();
    if (!v) { boardOpen = false; closeSheet(); }
    applyStageLook(stageOn());
    $('#wh_stage_on').prop('checked', !!v);
    renderStageWand();
    renderStrip();
    renderMindStrip();
    stageChat();
}

/** The wand menu's Stage mode item says whether it's on. */
function renderStageWand() {
    const live = stageOn();
    $('#wh_stage_wand').toggle(on()).attr('title', live ? 'Stage mode is on: tap to turn it off' : "Stage mode: Worldhopper's own look, with the Board")
        .find('.wh-wand-state').text(live ? 'on' : 'off').toggleClass('wh-on', live);
}

function setBoard(v) {
    boardOpen = !!v;
    renderStrip();
}

/** Everyone on the Board, with their faces, the Mind Book's marks on them, and the clock. */
function boardViewData() {
    const c = ctx();
    const chat = c.chat || [];
    const me = c.name1 || '';
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    const world = normalizeWorld(headWorld()?.world || EMPTY_WORLD);
    const scene = chat.slice(-SCENE_MESSAGES).filter(inStory).map(m => m.mes).join('\n');
    const map = personaMap();
    const back = hostsBack(ledger, chat, chat.length).map(e => e.body);
    const { people } = ledgerPeople({ ledger, world, sheets: map, back, me, scene, cards: cardNames(), away: awayKeys(map, chat) });
    const board = boardOf({ ledger, world, people, me });
    const faces = new Map();
    for (const p of [...board.places.flatMap(g => g.people), ...board.unplaced]) {
        faces.set(p.key, faceFor(p.name).image || '');
        if (p.rider && !faces.has(p.rider.key)) faces.set(p.rider.key, faceFor(p.rider.name).image || '');
    }
    const marks = new Map();
    const book = mindWanted() ? headMind()?.book : null;
    if (book && !isEmptyBook(book)) {
        const canon = aliasResolver(ledger);
        for (const p of mindPeople({ book, me, scene }).people) {
            if (p.hidden && !settings().stage.hidden) continue;
            const list = [];
            if (p.hypnosis >= 0) list.push({ icon: 'fa-hurricane', title: p.status });
            if (p.control.length) list.push({ icon: 'fa-link', title: p.status });
            if (p.influence.length) list.push({ icon: 'fa-seedling', title: p.status });
            if (list.length) marks.set(canon(p.name), list.slice(0, 2));
        }
    }
    return { ...board, faces, marks, clock: [world.clock.day, world.clock.time].filter(Boolean).join(', '), showHidden: !!settings().stage.hidden };
}

/** The Board under the band while it's pulled down, or gone. */
function renderBoardNow() {
    const strip = $('#wh_ledger_strip');
    const want = stageOn() && boardOpen && strip.is(':visible');
    let host = $('#wh_stage_board');
    if (!want) { host.remove(); return; }
    if (!host.length) host = $('<div id="wh_stage_board" role="region" aria-label="Board"></div>').insertAfter(strip);
    placeBoard();
    renderBoard(host, boardViewData(), {
        open: (_key, name) => openPerson(name),
        move: (name, place, yours) => boardMove(name, place, yours).catch(err => toastr.error(err.message)),
        newPlace: async (name, yours) => {
            const where = await ctx().callGenericPopup(yours ? `Where do you take ${name}?` : `Where is ${name} now?`, ctx().POPUP_TYPE.INPUT, '', { okButton: yours ? 'Go' : 'Correct', cancelButton: 'Cancel', rows: 1 });
            if (typeof where === 'string' && where.trim()) await boardMove(name, where.trim(), yours).catch(err => toastr.error(err.message));
        },
        toggleHidden: () => { settings().stage.hidden = !settings().stage.hidden; save(); renderStrip(); stageChat(); },
        openLedger: () => openLedgerView(),
        stageOff: () => { setStage(false).catch(err => toastr.error(err.message)); },
        close: () => setBoard(false),
    });
}

/** The Board hangs just under the band, over the top of the chat. */
function placeBoard() {
    const strip = $('#wh_ledger_strip');
    const host = $('#wh_stage_board');
    if (!host.length || !strip.length) return;
    host.css('top', `${strip.position().top + strip.outerHeight(true) - 2}px`);
}

/**
 * A face dropped on another place. A body you're in goes there in the story: the move is written into your message
 * (in that body's tab when you're running several) and the World notes take it when you send, like the quick actions.
 * Anyone else is a correction to the notes: the story isn't told they went, the next reply just goes by it.
 */
async function boardMove(name, place, yours) {
    if (yours && place) {
        const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
        const roster = rosterOf(ledger, ctx().name1 || '');
        const canon = aliasResolver(ledger);
        const to = place.replace(/^(?:the|a|an)\s+/i, m => m.toLowerCase());
        const line = `*I head to ${to}.*`;
        const ta = document.getElementById('send_textarea');
        if (!ta) return;
        // Running several bodies (multipossession, a hive): the line goes in that body's own tab, so only it moves.
        if (tabsOn()) openTab(roster.find(r => canon(r.name) === canon(name))?.name || '', { focus: false });
        ta.value = ta.value.trim() ? `${ta.value.replace(/\s+$/, '')}\n${line}` : line;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        if (pendingChat !== chatKey()) { pendingIntents = []; pendingChat = chatKey(); }
        pendingIntents.push({ kind: 'move', who: name, place, line });
        toastr.info(`Send your message and ${name} goes to ${place}.`, '', { timeOut: 3000 });
        return;
    }
    await setWhere(name, place);
    toastr.info(place ? `Corrected: the notes have ${name} at ${place} now. The story isn't told they went.` : `Cleared where ${name} is.`, '', { timeOut: 4500 });
}

/** Someone's card in the Body Ledger, opened. */
function openPerson(name) {
    openCard.ledger = aliasResolver(headLedger()?.ledger)(name);
    openLedgerView();
}

/** Where someone is, set by hand on the Board: their place in the World notes ('' clears it), clothes and state kept. */
async function setWhere(name, where) {
    const c = ctx();
    if (!c.chat?.length) return;
    const w = normalizeWorld(headWorld()?.world || EMPTY_WORLD);
    const canon = aliasResolver(headLedger()?.ledger);
    const people = [...w.people];
    const at = people.findIndex(x => canon(x.who) === canon(name));
    const next = { ...(at >= 0 ? people[at] : { who: name, wearing: '', state: '' }), where };
    if (next.where || next.wearing || next.state) { if (at >= 0) people[at] = next; else people.push(next); } else if (at >= 0) people.splice(at, 1);
    storeWorld(c.chat.length - 1, { ...w, people });
    noteCorrection('world', { ...w, people });
    await c.saveChat();
    applyLedgerInjection();
    renderStrip();
    refreshViews('ledger');
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

// Tabs on the message box while you run several bodies: All (lines for no one body in particular, as a line with no name
// is) and a tab per body in its color. The message box writes for the open tab, each tab keeps its own draft (per chat,
// until sent), a dot marks the tabs with something in them, and sending joins them into [Name] lines. Alt+Left/Right
// switch tabs.
const laneDrafts = new Map();   // '' for All, a body's name lowercased → its draft, for the chat in laneDraftsChat
let laneDraftsChat = '';
let laneTab = '';               // the open tab: '' (All) or a body's name
let laneHolder = null;          // the message box's own placeholder, for All
const laneKey = name => String(name || '').toLowerCase();
const tabsOn = () => $('#wh_lanes .wh-lane-tab').length > 0;
const tabNames = () => $('#wh_lanes .wh-lane-tab').map((_, el) => el.dataset.name || '').get();

/** What's in the message box now is the open tab's draft. */
function keepTab() {
    const ta = document.getElementById('send_textarea');
    if (ta && tabsOn()) laneDrafts.set(laneKey(laneTab), ta.value);
}

/** Open a tab: the message box shows its draft, and says whose it is. */
function openTab(name, { focus = true } = {}) {
    const ta = document.getElementById('send_textarea');
    if (!ta) return;
    keepTab();
    laneTab = name || '';
    ta.value = laneDrafts.get(laneKey(laneTab)) || '';
    laneHolder ??= ta.getAttribute('placeholder') || '';
    ta.setAttribute('placeholder', laneTab ? `What ${laneTab} does this turn (leave it empty and ${laneTab} does nothing new)` : laneHolder);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    if (focus) ta.focus();
    markLanes();
}

/** Before SillyTavern reads the message box: every tab's draft joined into it (All first, then a [Name] line per body
 *  with something in its tab), the drafts emptied, and All open again. */
function sendLanes() {
    if (!tabsOn()) return;
    keepTab();
    const ta = document.getElementById('send_textarea');
    const bodies = tabNames().filter(Boolean);
    ta.value = joinLanes(laneDrafts.get('') || '', bodies.map(n => ({ name: n, text: laneDrafts.get(laneKey(n)) || '' })));
    laneDrafts.clear();
    laneTab = '';
    if (laneHolder != null) ta.setAttribute('placeholder', laneHolder);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    markLanes();
}

function renderLanes() {
    if (!$('#wh_lanes').length) {
        $('<div id="wh_lanes" class="wh-lanes" role="tablist" aria-label="Who you are writing for"></div>')
            .on('click', '.wh-lane-tab', e => openTab(e.currentTarget.dataset.name || ''))
            .insertBefore('#nonQRFormItems');
        $('#send_textarea').on('input', markLanes);
        // Ahead of SillyTavern's own handlers (capture), so the joined text is what it sends.
        document.getElementById('send_but')?.addEventListener('click', sendLanes, true);
        document.getElementById('send_textarea')?.addEventListener('keydown', e => {
            if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tabsOn()) {
                e.preventDefault();
                const names = tabNames(), i = names.findIndex(n => laneKey(n) === laneKey(laneTab));
                openTab(names[(i + (e.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length]);
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && shouldSendOnEnter()) sendLanes();
        }, true);
    }
    if (laneDraftsChat !== chatKey()) { laneDrafts.clear(); laneTab = ''; laneDraftsChat = chatKey(); }
    const ledger = ledgerWanted() ? headLedger()?.ledger : null;
    const roster = ledger ? rosterOf(ledger, ctx().name1 || '') : [];
    if (!roster.length) {
        // Down to one body: whatever is in the tabs goes into the message box as lines, so nothing typed is lost.
        if (tabsOn()) sendLanes();
        $('#wh_lanes').hide().empty();
        return;
    }
    if (laneTab && !roster.some(r => laneKey(r.name) === laneKey(laneTab))) { keepTab(); openTab('', { focus: false }); }
    const tab = (name, label, hue, tip) => `<button type="button" role="tab" class="wh-lane-tab" data-name="${esc(name)}" style="--wh-hue: ${hue}" title="${esc(tip)}">`
        + `<span class="wh-lane-dot"></span><span class="wh-lane-label">${label}</span></button>`;
    $('#wh_lanes').html([
        tab('', 'All', '150, 150, 160', 'Lines for no one body in particular, as a line with no name is (Alt+Left/Right to switch)'),
        ...roster.map(r => tab(r.name, `${esc(r.name)}${r.own ? ' <small>(you)</small>' : ''}`, laneHue(r.name), [`What ${r.name} does this turn`, r.doing || r.notes].filter(Boolean).join('\n'))),
    ].join('')).show();
    markLanes();
}

// ------------------------------------------------------------------ quick actions
// On the bodies strip, in chats with Possession: a + at the end to possess someone (in a one-body story, while you're in
// someone, that's a jump), and a door on each of your bodies to release it. A tap writes the move into your message (not
// sent; add to it as you like), and if that line is still there when you send, the Ledger takes the move at once, before
// the reply is written. Nothing is added near the message box. Hidden while the Ledger says the power is someone else's.
let actionPick = null;          // 'possess' while the strip is a list of names to pick from
let pendingIntents = [];        // { kind, from, to, line } written into the message box this chat, applied on send
let pendingChat = '';

function actionState() {
    const c = ctx();
    if (!on() || !ledgerWanted() || !c.chat?.length) return null;
    const modes = expandModes(currentModes());
    // Hive Mind alone: the same moves, as absorbing someone into your hive (nobody's body is left).
    const hive = modes.has('Hive Mind') && !modes.has('Possession');
    if (!modes.has('Possession') && !hive) return null;
    const ledger = normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER);
    const canon = aliasResolver(ledger);
    const me = canon(c.name1 || '');
    if (ledger.powers.length && !ledger.powers.some(p => canon(p.who) === me)) return null;
    const multi = modes.has('Multipossession') || hive;
    const mine = ledger.bodies.filter(b => b.body && b.driver && canon(b.driver) === me && canon(b.body) !== me && !/cop(y|ied)|propagat|swap/i.test(b.how)).map(b => b.body);
    return { ledger, canon, me, multi, hive, mine, userName: c.name1 || 'User' };
}

/** People to offer for Possess or Jump: whoever is in the scene first, then anyone else the chat's records know. */
function actionNames(st) {
    const c = ctx();
    const chat = c.chat || [];
    const scene = chat.slice(-SCENE_MESSAGES).filter(inStory).map(m => m.mes).join('\n');
    const world = normalizeWorld(headWorld()?.world || EMPTY_WORLD);
    // A card's own name only when the story names it: "Marcus" is a person, a narrator card's "Corner Café" isn't.
    const group = c.groupId ? c.groups?.find(x => x.id === c.groupId) : null;
    const cardsHere = [c.name2, ...(group?.members || []).map(av => c.characters?.find(x => x.avatar === av)?.name)].filter(n => n && personNamedIn(scene, [n]));
    const pool = [...world.people.map(p => p.who), ...world.knows.map(k => k.who), ...st.ledger.bodies.flatMap(b => [b.body, b.driver]),
        ...Object.values(personaMap()).map(e => e.body), ...cardsHere];
    const seen = new Set();
    const names = [];
    for (const n of pool) {
        const name = String(n || '').trim();
        const k = st.canon(name);
        if (!name || /^none$/i.test(name) || k === st.me || seen.has(k) || st.mine.some(m => st.canon(m) === k)) continue;
        seen.add(k);
        names.push({ name, here: personNamedIn(scene, [name]) });
    }
    return [...names.filter(x => x.here), ...names.filter(x => !x.here)].slice(0, 8).map(x => x.name);
}

/** The strip as a list of names to pick from, with a box for anyone else (while actionPick is set). */
function pickerHtml(st) {
    const jump = !st.multi && st.mine.length === 1;
    const verb = st.hive ? 'Absorb into the hive' : jump ? `Leave ${st.mine[0]} and possess` : 'Possess';
    return `<span class="wh-strip-label"><i class="fa-solid fa-user-plus"></i></span><span class="wh-act-label">${esc(verb)}</span>`
        + actionNames(st).map(n => `<button type="button" class="wh-act wh-act-name" data-act="pick" data-name="${esc(n)}">${esc(n)}</button>`).join('')
        + `<input type="text" class="wh-act-input text_pole" placeholder="someone else…" aria-label="${esc(verb)} someone else">`
        + `<button type="button" class="wh-act wh-act-x" data-act="cancel" title="Cancel" aria-label="Cancel"><i class="fa-solid fa-xmark"></i></button>`;
}

/** The strip's own controls: taps on them never open the Ledger the way a tap on the strip does. */
function bindStripActions(strip) {
    strip.on('click', '.wh-act', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const { act, name } = this.dataset;
        if (act === 'stage') { setStage(true).catch(err => toastr.error(err.message)); return; }
        if (act === 'board') { setBoard(!boardOpen); return; }
        if (act === 'mind') { openMindView(); return; }
        if (act === 'possess') { actionPick = 'possess'; renderStrip(); return; }
        if (act === 'cancel') { actionPick = null; renderStrip(); return; }
        if (act === 'pick') { pickAction(name); return; }
        if (act === 'release') writeIntent({ kind: 'release', from: name });
    });
    strip.on('keydown', '.wh-act', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        this.click();
    });
    strip.on('click keydown', '.wh-act-input', function (e) {
        e.stopPropagation();
        if (e.type !== 'keydown') return;
        if (e.key === 'Enter') { e.preventDefault(); const v = String($(this).val() || '').trim(); if (v) pickAction(v); }
        if (e.key === 'Escape') { e.preventDefault(); actionPick = null; renderStrip(); }
    });
}

function pickAction(name) {
    const st = actionState();
    actionPick = null;
    if (!st) return;
    // One body at a time: possessing someone new while you're in someone leaves them.
    if (!st.multi && st.mine.length === 1) writeIntent({ kind: 'jump', from: st.mine[0], to: name });
    else writeIntent({ kind: 'possess', to: name });
}

/** The move's line into the message box (the All tab with the body tabs showing), remembered until you send. */
function writeIntent(intent) {
    const st = actionState();
    if (!st) return;
    const line = intentLine(intent, { multi: st.multi, hive: st.hive });
    if (tabsOn() && laneTab) openTab('', { focus: false });
    const ta = document.getElementById('send_textarea');
    if (!ta) return;
    ta.value = ta.value.trim() ? `${ta.value.replace(/\s+$/, '')}\n${line}` : line;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    if (pendingChat !== chatKey()) { pendingIntents = []; pendingChat = chatKey(); }
    pendingIntents.push({ ...intent, line });
    renderStrip();
}

/** On send: each move whose line is still in your message goes into the Ledger, on your message, before the reply. */
async function applyIntents(mesId) {
    const intents = pendingChat === chatKey() ? pendingIntents : [];
    pendingIntents = [];
    const msg = ctx().chat?.[mesId];
    if (!intents.length || !msg?.is_user) return;
    const flat = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const sent = intents.filter(i => flat(msg.mes).includes(flat(i.line)));
    // A body you took somewhere on the Board: the World notes have it there before the reply is written.
    const moves = sent.filter(i => i.kind === 'move');
    if (moves.length) {
        const w = normalizeWorld(headWorld()?.world || EMPTY_WORLD);
        const canon = aliasResolver(headLedger()?.ledger);
        const people = [...w.people];
        for (const mv of moves) {
            const at = people.findIndex(x => canon(x.who) === canon(mv.who));
            if (at >= 0) people[at] = { ...people[at], where: mv.place }; else people.push({ who: mv.who, where: mv.place, wearing: '', state: '' });
        }
        storeWorld(Number(mesId), { ...w, people });
    }
    const st = actionState();
    const rest = sent.filter(i => i.kind !== 'move');
    if (!rest.length || !st) {
        if (moves.length) { await ctx().saveChat(); applyLedgerInjection(); renderLedgerPanel(); }
        return;
    }
    let ledger = st.ledger;
    for (const i of rest) ledger = applyIntent(ledger, i, { userName: st.userName, userPronouns: userPronouns(), multi: st.multi, hive: st.hive });
    storeLedger(Number(mesId), ledger);
    await ctx().saveChat();
    renderLedgerPanel();
}

/** Which tab is open, and a dot on each tab with something in it. */
function markLanes() {
    const box = $('#wh_lanes');
    if (!box.children().length) return;
    const ta = document.getElementById('send_textarea');
    box.find('.wh-lane-tab').each((_, el) => {
        const k = laneKey(el.dataset.name), open = k === laneKey(laneTab);
        el.classList.toggle('wh-on', open);
        el.setAttribute('aria-selected', String(open));
        el.classList.toggle('wh-has', !!String((open ? ta?.value : laneDrafts.get(k)) || '').trim());
    });
}

/** Each [Name] line in the chat takes that body's color. */
function colourLanes() {
    $('#chat .mes_text .custom-wh-lane').each((_, el) => {
        el.style.setProperty('--wh-hue', laneHue($(el).find('.custom-wh-lane-name').first().text()));
    });
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
    stageChat();
}

// ------------------------------------------------------------------ Stage mode: the chat
// Each reply drawn as narration and the lines of the people in it (speech-core.js reads who says or does what; stage.js
// draws it), each with their face and name: the Engine's picture, their card's avatar, or your persona's. A card that
// is a person (not a scenario or narrator card) is one of them. Your own messages show the body you were in.

/** Whether the chat's card is a person, not a scenario: someone the story's records hold, or acts as, and not a card
 *  that calls itself a narrator, a scenario or a game master. */
function cardIsPerson(ch, records, prose) {
    const name = String(ch?.name || '').trim();
    if (!name) return false;
    if (records.has(name.toLowerCase())) return true;
    const own = cardText(ch).slice(0, 4000);
    if (/\b(narrat\w*|scenario|game ?master|storyteller|\bGM\b|text adventure|simulator|multiple characters|several characters)\b/i.test(own)) return false;
    const first = name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // "Seraphina smiles", not "at Corner Café".
    return new RegExp(`(?<!\\b(?:at|in|to|from|the|of|into|inside|outside|near|behind)\\s)\\b${first}\\b\\s+[a-z]`, 'u').test(prose);
}

/** The people a message can be by: [{ name, aka, pronouns }], from the Ledger, the World notes, the sheets and the cards. */
function castOf(ledger, world, people, cardPeople, pronouns = {}) {
    const out = new Map();
    const add = (name, extra = {}) => {
        const n = String(name || '').trim();
        if (!n || /^none$/i.test(n)) return;
        const k = n.toLowerCase();
        const had = out.get(k) || { name: n, aka: [], pronouns: '' };
        if (extra.pronouns && !had.pronouns) had.pronouns = extra.pronouns;
        if (extra.aka) had.aka = [...new Set([...had.aka, ...extra.aka])];
        out.set(k, had);
    };
    for (const b of ledger.bodies) { add(b.body, { pronouns: b.pronouns }); add(b.driver, { pronouns: b.driver_pronouns }); }
    for (const a of ledger.aliases) add(a.name, { aka: a.aka });
    // "Sam's body" in the World notes is Sam.
    for (const p of world.people) add(String(p.who || '').replace(/['’]s\s+(?:own\s+)?body$/i, ''));
    for (const k of world.knows) add(k.who);
    for (const n of people) add(n);
    for (const n of cardPeople) add(n);
    // What the cards say about pronouns, for anyone the Ledger has none for.
    for (const p of out.values()) p.pronouns ||= pronouns[p.name.toLowerCase()] || pronouns[p.name.split(/\s+/)[0].toLowerCase()] || '';
    return [...out.values()];
}

/** Who has a line in the latest replies on the page, in Stage mode. */
function stageSpeakers() {
    const replies = [...document.querySelectorAll('#chat .mes[is_user="false"]')].slice(-SCENE_MESSAGES);
    return [...new Set(replies.flatMap(m => [...m.querySelectorAll('.whs-say[data-who]')].map(n => n.dataset.who)))];
}

const notCopy = b => !/cop(y|ied)|propagat/i.test(b.how || '');
/** Where the World notes have someone, also when they list them as "Sam's body" (your own, left behind or in use). */
function whereIs(world, name, canon) {
    const strip = w => String(w || '').replace(/['’]s\s+(?:own\s+)?body$/i, '');
    return (world.people.find(p => canon(p.who) === canon(name)) || world.people.find(p => canon(strip(p.who)) === canon(name)))?.where || '';
}
/** You in a Ledger: the bodies you drive, and whether someone else drives yours. */
function yoursIn(ledger, me) {
    const canon = aliasResolver(ledger);
    return {
        canon,
        worn: ledger.bodies.filter(b => b.driver && b.body && !/^none$/i.test(b.body) && canon(b.driver) === canon(me) && canon(b.body) !== canon(me) && notCopy(b)),
        taken: ledger.bodies.some(b => b.body && b.driver && canon(b.body) === canon(me) && canon(b.driver) !== canon(me) && notCopy(b)),
    };
}

function stageChat() {
    const c = ctx();
    const chat = c.chat || [];
    const nodes = document.querySelectorAll('#chat .mes[mesid]');
    if (!stageOn() || !chat.length) { nodes.forEach(n => unstage(n)); return; }
    const me = c.name1 || '';
    const sheets = Object.values(personaMap()).map(e => e.body).filter(Boolean);
    const group = c.groupId ? c.groups?.find(x => x.id === c.groupId) : null;
    const cards = group ? (group.members || []).map(av => c.characters?.find(x => x.avatar === av)).filter(Boolean) : [c.characters?.[c.characterId]].filter(Boolean);
    const prose = chat.slice(-12).filter(m => inStory(m) && !m.is_user).map(m => m.mes).join('\n');
    // Pronouns as the cards give them, else as the story's own prose makes clear (someone with none fits any "she
    // says"); the Ledger's own come first, in castOf.
    const everyone = castOf(normalizeLedger(headLedger()?.ledger || EMPTY_LEDGER), normalizeWorld(headWorld()?.world || EMPTY_WORLD), sheets, cards.map(ch => ch.name)).map(p => p.name);
    const pronouns = Object.assign(prosePronouns([prose], everyone), ...cards.map(ch => cardPronouns(cardText(ch))));
    const showHidden = !!settings().stage.hidden;
    let ledger = c.chatMetadata?.[LEDGER_KEY] ? normalizeLedger(c.chatMetadata[LEDGER_KEY]) : normalizeLedger(EMPTY_LEDGER);
    let world = normalizeWorld(EMPTY_WORLD);
    let carry = '';
    let lastScene = null;      // the place and clock the last reply left, for the dividers
    let lastReply = ledger;    // the Ledger as the last reply left it, for who a moment happened to
    const first = Number(nodes[0]?.getAttribute('mesid') ?? chat.length);
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (i >= first) {
            const node = document.querySelector(`#chat .mes[mesid="${i}"]`);
            if (node && inStory(m)) {
                if (m.is_user) {
                    const { worn } = yoursIn(ledger, me);
                    stageUser(node, worn.length === 1 ? { name: worn[0].body, image: faceFor(worn[0].body).image || '', you: me } : null);
                    stageLanes(node, name => faceFor(name).image || '');
                } else {
                    // The reply as its own Ledger and World notes have it: someone who first turns up in it, or a body
                    // taken in it, already counts for its lines.
                    const now = m.extra?.wh_ledger ? normalizeLedger(m.extra.wh_ledger) : ledger;
                    const worldNow = m.extra?.wh_world ? normalizeWorld(m.extra.wh_world) : world;
                    const { canon, worn, taken } = yoursIn(now, me);
                    const records = new Set([...now.bodies.flatMap(b => [b.body, b.driver]), ...worldNow.people.map(p => p.who), ...worldNow.knows.map(k => k.who), ...sheets].filter(Boolean).map(n => n.toLowerCase()));
                    const persons = cards.filter(ch => cardIsPerson(ch, records, prose)).map(ch => ch.name);
                    // You're in the cast too, so a line of yours is known for yours (and not handed to whoever spoke last).
                    const cast = castOf(now, worldNow, sheets, [...persons, me], { ...pronouns, [me.toLowerCase()]: userPronouns() || pronouns[me.toLowerCase()] || '' });
                    // Someone else in your body (taken, or absorbed into a hive): its lines are the story's now.
                    const mine = [...(taken ? [] : [me]), ...worn.map(b => b.body)];
                    const text = chat.slice(Math.max(0, i - SCENE_MESSAGES + 1), i + 1).filter(inStory).map(x => x.mes).join('\n');
                    const scene = [...new Set([...cast.filter(p => personNamedIn(text, [p.name, ...p.aka])).map(p => p.name), ...persons])];
                    // Who the reply's moments happened to: the rides it began and ended since the last reply.
                    const changed = ridesChanged(lastReply, now);
                    const withFaces = r => ({ ...r, riderImage: faceFor(r.rider).image || '', bodyImage: faceFor(r.body).image || '', you: canon(r.rider) === canon(me) });
                    const moments = { began: changed.began.filter(r => !r.hidden || showHidden).map(withFaces), ended: changed.ended.filter(r => !r.hidden || showHidden).map(withFaces) };
                    // The faces too, so a picture drawn or changed shows on the lines at once.
                    const sig = [m.mes, m.swipe_id ?? 0, cast.map(p => `${p.name}=${faceFor(p.name).image || ''}`).join('|'), mine.join('|'), carry, showHidden,
                        [...moments.began, ...moments.ended].map(r => `${r.rider}>${r.body}`).join('|')].join('\u0001');
                    if (!isStaged(node, sig)) {
                        unstage(node);
                        const ps = replyParagraphs(node);
                        const who = speakers(ps.map(readParagraph), { cast, mine, scene, carry });
                        const lines = [];
                        who.forEach((w, j) => {
                            if (!w.who) return;
                            const row = now.bodies.find(b => b.body && canon(b.body) === canon(w.who) && b.driver && canon(b.driver) !== canon(w.who) && notCopy(b));
                            const rider = row && (row.user_knows !== 'no' || showHidden)
                                ? { name: row.driver, image: faceFor(row.driver).image || '', you: canon(row.driver) === canon(me), hidden: row.user_knows === 'no' } : null;
                            lines.push({ p: ps[j], name: w.who, image: faceFor(w.who).image || '', kind: row ? 'npc' : 'plain', rider, cont: j > 0 && who[j - 1].who === w.who });
                        });
                        stageMoments(node, moments);
                        stageReply(node, lines, sig);
                        node.dataset.whsLast = who.filter(w => w.by).at(-1)?.by || '';
                    }
                    carry = node.dataset.whsLast || '';
                    // Where it happens: the place the World notes have your body in once this reply is done. The
                    // card's name gives way to it (the people in the reply carry their own names on their lines).
                    const at = whereIs(worldNow, worn[0]?.body || me, canon);
                    stageWhere(node, at ? upFirst(splitWhere(at).place) : '');
                    // A divider where the scene breaks: a new place, a new day, or half an hour or more gone by.
                    const next = { place: at, day: worldNow.clock.day, time: worldNow.clock.time, elapsed: worldNow.clock.elapsed };
                    stageScene(node, sceneBreak(lastScene, next));
                    if (at || worldNow.clock.day || worldNow.clock.time) lastScene = next;
                }
            }
        }
        if (m.extra?.wh_ledger) ledger = normalizeLedger(m.extra.wh_ledger);
        if (m.extra?.wh_world) world = normalizeWorld(m.extra.wh_world);
        // The place and clock carry on through replies off the page too, so the first divider shown is a real one.
        if (i < first && !m.is_user && inStory(m)) {
            const canon = aliasResolver(ledger);
            const body = ledger.bodies.find(b => b.driver && b.body && canon(b.driver) === canon(me) && canon(b.body) !== canon(me))?.body || me;
            const at = whereIs(world, body, canon);
            if (at || world.clock.day || world.clock.time) lastScene = { place: at, day: world.clock.day, time: world.clock.time, elapsed: world.clock.elapsed };
        }
        if (!m.is_user && inStory(m)) lastReply = ledger;
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

/** The mind modes picked for this chat, as Mind Book kinds (hypnosis, control, perception), and influence when a card
 *  here makes change build, whatever its modes. */
function mindKinds() {
    const modes = expandModes(currentModes());
    return MIND_KINDS.filter(k => (k === 'influence' ? changePace().holds > 0 : modes.has(MIND_MODES[k])));
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
    if (!first && !kinds.some(k => needsUpdate(k, book, text))) return null;
    mindBusy = true; renderMindStrip();
    const input = { book: base?.book || null, messages: msgs, context, userName, kinds, card, at: mesId, fades: changePace().fades, time: storyTime(mesId + 1) };
    try { ({ book, ran } = await mindStep(input, (m, max) => askLedger(m, max, 0.1))); }
    catch { ledgerStatus(`Mind Book: ${unreachable(ledgerProfile())}.`); return null; }
    finally { mindBusy = false; renderMindStrip(); }
    if (!ran || chatKey() !== key || !ctx().chat?.[mesId]) return null;
    noteRun('mind', mesId, input, book);
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

/** The change pace as of now, for showing where a change stands (a card that stopped building reads as four). */
function changeAt() {
    const p = changePace();
    return { holds: p.holds || 4, fades: p.fades, at: (ctx().chat?.length || 1) - 1, time: storyTime() };
}

/**
 * The Mind Book's bar above the chat: a chip per hypnotized person (their trance, or how many times they've been
 * under), per controlled will and per perception edit. Teal when you're the one doing it, violet when someone else
 * is, dashed when it's kept from you. Tap to edit.
 */
function renderMindStrip() {
    ensureStrips();
    const book = headMind()?.book;
    if (!mindWanted() || !ctx().chat?.length || (isEmptyBook(book) && !mindBusy)) { $('#wh_mind_strip').hide(); return; }
    if (stageOn() && $('#wh_ledger_strip').is(':visible')) {
        $('#wh_mind_strip').hide();
        $('#wh_ledger_strip .wh-band-ctl').replaceWith(stripControls(true));
        return;
    }
    const me = String(ctx().name1 || '').toLowerCase();
    const mine = by => (by && by.toLowerCase() === me ? 'you' : 'npc');
    const chip = (kind, icon, title, sub, tip, hidden, face = '') => `<span class="wh-chip wh-${kind}${hidden ? ' wh-hidden' : ''}${face ? ' wh-has-face' : ''}" title="${esc(tip)}">${chipLead(icon, face)}`
        + `<span class="wh-chip-text"><b>${esc(title)}</b><small>${esc(sub)}${hidden ? ' <i class="fa-solid fa-eye-slash" title="Hidden from you"></i>' : ''}</small></span></span>`;
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
        ...(book?.influence || []).map(ch => {
            const s = changeStage(ch, changeAt());
            return chip(mine(ch.by), 'fa-seedling', ch.who, s.stage === 'holds' ? 'change holds' : `change ${s.now}/${changeAt().holds}${s.slipping ? ' · slipping' : ''}`,
                ['change over time', ch.what, ch.by ? `by ${you(ch.by)}` : ''].filter(Boolean).join(' · '), ch.user_knows === 'no', faceFor(ch.who).image);
        }),
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
    for (const ch of book?.influence || []) {
        const s = changeStage(ch, changeAt());
        const main = `${ch.who} · ${s.stage === 'holds' ? 'change holds' : `change ${s.now} of ${changeAt().holds}`}${s.slipping ? ' · slipping' : ''}`;
        box.append(panelRow(main, [ch.what, ch.from ? `before: ${ch.from}` : '', ch.by ? `by ${ch.by}` : ''].filter(Boolean).join(' · '), ch.user_knows === 'no', mine(ch.by), 'fa-seedling'));
    }
    if (isEmptyBook(book)) {
        box.append($('<div class="wh-empty"></div>').text(settings().ledger.enabled
            ? 'Nothing yet. It fills in when someone is hypnotized, controlled, has their perception changed, or (with a card where change builds) is changed a little at a time. Tap ✏️ to add something yourself.'
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
        applied.push(...out.applied.map(a => ({ action: 'PRONOUN', ...a, by: 'body' })));
        if (out.rejected.length) console.debug(LOG, 'rejected pronoun fixes', out.rejected);
    } catch { /* the cuts can still run */ }
    // The WH Editor already made these cuts in its own call, for the same bodies: no second call. If the reply changed
    // who is in which body, the rules it used are stale and the cuts run here as usual.
    const cutByEditor = ctx().chat?.[mesId]?.extra?.wh_lint?.sig === bodiesSignature(head.ledger);
    if (!cutByEditor) try {
        const chat = ctx().chat || [];
        let lastUserText = '';
        for (let i = mesId - 1; i >= 0; i--) if (chat[i]?.is_user) { lastUserText = chat[i].mes; break; }
        const out = applyCuts(text, parseLintResponse(await askLedger(buildLintMessages(text, head.ledger, ctx().name1 || 'User', { lastUserText }), 500, 0.1)), { ledger: head.ledger, userName: ctx().name1 || 'User' });
        text = out.text;
        applied.push(...out.applied.map(a => ({ ...a, by: 'body' })));
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

// ------------------------------------------------------------------ the WH Editor's side of the checks

// Who is in which body, as a string two ledgers can be compared by.
const bodiesSignature = ledger => JSON.stringify(normalizeLedger(ledger).bodies.map(b => [b.body, b.driver, b.user_knows]).sort());
const checking = new Map();   // mesId → promise that resolves when this reply's Engine work is done

// What the WH Editor needs to fold the Engine's cut check into its own model call, so a reply it sends to a model
// anyway costs one call less: the cut rules for the bodies in play before this reply (when the Engine would cut at
// all), the bodies the player drives (what they do there is the player's to write), and the Engine's own parser and
// guarded cutter. The Editor marks the reply (extra.wh_lint), and runBodyChecks skips its own cut call for it.
globalThis.Worldhopper = {
    ...globalThis.Worldhopper,
    bodyRules(mesId) {
        if (!on() || !ledgerWanted() || !ledgerProfile()) return null;
        const head = headLedger(Number(mesId));
        if (!head || !hasCrossedBodies(head.ledger)) return null;
        const userName = ctx().name1 || 'User';
        const canon = aliasResolver(head.ledger);
        const userBodies = [...new Set(head.ledger.bodies.filter(b => b.body && b.driver && canon(b.driver) === canon(userName) && canon(b.body) !== canon(b.driver)).map(b => b.body))];
        const cuts = needsPronounCheck(head.ledger) || head.ledger.bodies.some(b => b.user_knows === 'no' && b.body && b.driver);
        const sys = cuts ? buildLintMessages('', head.ledger, userName)[0].content : '';
        const rules = sys.split('Cut exactly these, and nothing else:\n')[1]?.split('\nCopy each cut exactly')[0]?.trim() || '';
        // The Editor answers in the Engine's form (each cut with its rule), and its cuts get the same checks as the Engine's.
        return { rules, format: CUT_FORMAT, userBodies, signature: bodiesSignature(head.ledger), parse: parseLintResponse, cut: (text, cuts) => applyCuts(text, cuts, { ledger: head.ledger, userName }) };
    },
    whenChecked: mesId => checking.get(Number(mesId)) || Promise.resolve(),
};

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
    noteUndo(mesId, rec, target === rec.original);
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
    const parts = [t.wait > 200 ? `waited ${s(t.wait)} for the ${t.ledger != null ? 'Ledger' : 'Mind Book'}` : '', t.ledger != null ? `Ledger ${s(t.ledger)}` : '', t.world != null ? `World notes ${s(t.world)}` : '', t.mind != null ? `Mind Book ${s(t.mind)}` : '', t.checks != null ? `body checks ${s(t.checks)}` : ''].filter(Boolean);
    if (parts.length) $('#wh_turn_timing').text(`Last turn: ${parts.join(' · ')}`);
}

/**
 * The per-reply jobs (each a function that starts one): side by side, or one after another when the Ledger's model is
 * local. A local server works on one request at a time anyway, some turn a second one away while busy, and each one
 * pushes the others out of its cache, so side by side only made them all slower.
 */
async function runJobs(jobs) {
    if (!isLocalProfile(ledgerProfile())) { await Promise.all(jobs.map(job => job())); return; }
    for (const job of jobs) {
        try { await job(); } catch (err) { console.warn(LOG, err); }
    }
}

function onMessageReceived(mesId, type) {
    if (!on() || ['quiet', 'impersonate', 'command', 'first_message'].includes(type)) return;
    const wait = lastWait;
    lastWait = 0;
    const key = chatKey();
    let done, checked;
    ledgerReady = new Promise(r => (done = r));
    // The WH Editor can hold a reply back until it is final; it waits on this (Worldhopper.whenChecked).
    const checkedP = new Promise(r => (checked = r));
    checking.set(mesId, checkedP);
    checkedP.then(() => { if (checking.get(mesId) === checkedP) checking.delete(mesId); });
    enqueue(async () => { try { await turn(); } finally { checked(); } });
    async function turn() {
        let ended = [];
        const timing = { wait: Math.round(wait) };
        try {
            // The Ledger, the World notes and the Mind Book read the same reply and don't depend on each other, so they
            // run side by side: the next reply waits for the slowest of them, not their sum (2026-10-28; before, the
            // Mind Book waited for the Ledger). On a local model, one after another (runJobs).
            const jobs = [];
            if (ledgerWanted() && !ledgerProfile()) ledgerStatus(`Ledger: ${unreachable('')}.`);
            else if (ledgerWanted()) {
                setLedgerBusy(true);
                jobs.push(() => updateLedger(mesId).then(r => { ended = r.ended; if (r.ok) timing.ledger = r.ms; }));
                jobs.push(() => updateWorld(mesId).then(w => { if (w) timing.world = w.ms; }));
            }
            if (mindWanted() && ledgerProfile()) jobs.push(() => updateMind(mesId).then(m => { if (m) timing.mind = m.ms; }));
            await runJobs(jobs);
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
    }
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
            const jobs = [];
            if (ledgerWanted()) {
                setLedgerBusy(true);
                jobs.push(() => updateLedger(mesId).then(r => { if (r.ok) ended = r.ended; }));
                jobs.push(() => updateWorld(mesId));
            }
            if (mindWanted()) jobs.push(() => updateMind(mesId));
            await runJobs(jobs);
            // Each update saves the chat; side by side, an earlier save can land last, so one more with both in it.
            if (jobs.length > 1 && current()) await ctx().saveChat();
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
    applyRulesInjection(trial ? 'normal' : type);   // a card test's reply gets the card's rules, as in play
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
    fillProfileSelect('#wh_warden_profile', s.ledger.wardenProfile, 'None (the Ledger model does it)');
    renderPictureSelects();
    $('#wh_no_profiles').toggle(!(ctx().extensionSettings.connectionManager?.profiles || []).length);
}

/** Settings → Pictures: what Image Generation is set to, and its own styles, models and workflows to pick from. */
function renderPictureSelects() {
    const p = settings().pictures;
    const sd = ctx().extensionSettings.sd;
    const source = $('#sd_source option:selected').text().trim() || sd?.source || '';
    $('#wh_pictures_source').text(imageGenOn()
        ? `Through Image Generation (${source}).`
        : 'Image Generation is off (Extensions → Image Generation).');
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
    tipify($('.worldhopper-settings'));
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
    $('#wh_codex_rules').on('click', openRulesView);
    $('#wh_codex_apply_suggestion').on('click', () => { const t = selectionTarget(); if (t) applySuggestion(t.key); });
    $('#wh_codex_preset_on').on('click', switchOnPresetHelpers);

    bind('#wh_ledger_enabled', () => s.ledger.enabled, v => { settings().ledger.enabled = v; applyLedgerInjection(); renderLedgerPanel(); });
    bind('#wh_pictures_auto', () => s.pictures.auto, v => { settings().pictures.auto = v; if (v) ensurePictures().catch(err => console.warn(LOG, err)); });
    bind('#wh_stage_on', () => s.stage.on, v => { setStage(v).catch(err => toastr.error(err.message)); });
    // The same entry in two places: here, and under the description in SillyTavern's Persona Management.
    addPersonaPronounsBox();
    $(document).on('change', '#wh_you_pronouns, #wh_persona_pronouns', function () {
        const v = String($(this).val() || '').replace(/\s+/g, ' ').trim();
        if (v) settings().personaPronouns[user_avatar] = v; else delete settings().personaPronouns[user_avatar];
        save();
        renderYou();
        applyLedgerInjection();
        refreshViews('ledger');
    });
    renderYou();
    bind('#wh_fix_on', () => s.fixes.on, v => { settings().fixes.on = v; renderFixes(); });
    $('#wh_fix_clear').on('click', () => clearFixes().catch(err => toastr.error(err.message)));
    renderFixes();
    for (const k of ['style', 'model', 'workflow', 'shape']) $(`#wh_pictures_${k}`).on('change', function () { settings().pictures[k] = String($(this).val() || ''); save(); });
    $('#wh_pictures_rewrite').on('change', function () { settings().pictures.rewrite = $(this).val() === 'yes'; save(); });
    // Image Generation's lists can change while the panel is open (another source, a new style): read them again on the way in.
    $('#wh_pictures_box').on('mouseenter focusin', () => { if (!$('#wh_pictures_box select:focus').length) renderPictureSelects(); });
    $('#wh_ledger_backfill').on('click', backfillHistory);
    $('#wh_ledger_notes_profile').on('change', function () { settings().ledger.notesProfile = String($(this).val() || ''); save(); });
    $('#wh_ledger_profile').on('change', function () { settings().ledger.profile = String($(this).val() || ''); save(); });
    $('#wh_warden_profile').on('change', function () { settings().ledger.wardenProfile = String($(this).val() || ''); wardenDown = 0; save(); });
    $('#wh_warden_setup').on('click', () => setupWarden().catch(err => toastr.error(err.message)));
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
    applyStageLook(stageOn());
    renderStageWand();
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
    const stage = $('<div id="wh_stage_wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0"><div class="fa-solid fa-masks-theater extensionsMenuExtensionButton"></div><span>Stage mode</span><small class="wh-wand-state"></small></div>');
    stage.on('click', () => setStage(!stageOn()).catch(err => toastr.error(err.message)));
    $('#extensionsMenu').append(item, stage);
    renderStageWand();
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
    const { pills, picked } = modePills(chatModes);
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

    await createCharacter(card, nameIn.val(), picked());
}

/** Every Codex mode as a pill to tick, the given ones ticked; picked() lists the ticked ones. */
function modePills(selected) {
    const pills = $('<div class="wh-pills"></div>');
    for (const m of MODE_GROUPS.flatMap(([, list]) => list)) {
        const pill = $(`<label class="wh-pill${MODIFIERS.has(m) ? ' wh-modifier' : ''}"></label>`).attr('title', (MODE_BLURBS[m] || '') + (PARENT[m] ? ` (with ${PARENT[m]})` : ''));
        pills.append(pill.append($('<input type="checkbox">').prop('checked', selected.includes(m)).data('mode', m), $('<span></span>').text(m)));
    }
    return { pills, picked: () => pills.find('input:checked').map((_, el) => $(el).data('mode')).get() };
}

/**
 * Imports a card as a new character with its Codex modes picked, and offers to open it. The card is changed in place
 * (name, modes). Returns the new avatar, or null when SillyTavern refused it.
 */
async function createCharacter(card, name, modes) {
    const c = ctx();
    const d = card.data;
    d.name = String(name || '').trim() || d.name || 'New character';
    if (d.character_book) d.character_book.name = `${d.name} lore`;
    d.extensions.worldhopper.modes = modes;
    const form = new FormData();
    form.append('avatar', new File([JSON.stringify(card)], 'card.json', { type: 'application/json' }));
    form.append('file_type', 'json');
    form.append('user_name', c.name1);
    const r = await fetch('/api/characters/import', { method: 'POST', body: form, headers: c.getRequestHeaders({ omitContentType: true }), cache: 'no-cache' });
    const out = r.ok ? await r.json() : { error: true };
    if (out.error || !out.file_name) { toastr.error('SillyTavern couldn\'t create the character.'); return null; }
    const avatar = `${out.file_name}.png`;
    if (modes.length) { settings().codex.selections['char:' + avatar] = modes; save(); }
    await c.getCharacters();
    const ch = ctx().characters.find(x => x.avatar === avatar);
    if (ch && ctx().powerUserSettings?.tag_import_setting !== 2) await ctx().importTags(ch);   // 2 = never import tags
    toastr.success(`${d.name}${modes.length ? ` (${modes.join(', ')})` : ''}. Click to open it; set a picture by clicking its avatar.`, 'Card created', {
        timeOut: 15000, extendedTimeOut: 10000, closeButton: true, onclick: () => openCharacter(avatar),
    });
    return avatar;
}

const openCharacter = avatar => { const id = ctx().characters.findIndex(x => x.avatar === avatar); if (id >= 0) ctx().selectCharacterById(String(id)); };

// ------------------------------------------------------------------ Keep my corrections
// With the switch on (Settings → Choices), a change you make by hand to the Ledger, the World notes or the Mind Book
// right after the model's update is kept as a Gym case (correct-core.js), and so is ⟲ on a reply the body checks fixed.
// Each case is a file in SillyTavern's own data folder (user/files/wh-fix-….json): the few messages the update read,
// what it wrote and what you made it. Nothing is sent anywhere; the Gym replays them (tools/gym/corrections.mjs).
// Only the update on the newest message counts, since an edit made later could be about something newer.

const lastRun = {};   // per kind: { chat, mesId, input, model, id } for the newest update this session

function noteRun(kind, mesId, input, model) {
    if (!settings().fixes.on) return;
    lastRun[kind] = { chat: chatKey(), mesId, input: structuredClone(input), model: structuredClone(model), id: '' };
}

const fixMeta = () => ({ card: selectionTarget()?.label || '', modes: [...expandModes(currentModes())] });

/** Your edit to a record, kept as a case when it changes the model's newest update (again and again: one case per update). */
async function noteCorrection(kind, truth) {
    const run = lastRun[kind];
    if (!settings().fixes.on || !run || run.chat !== chatKey()) return;
    const chat = ctx().chat || [];
    let newest = chat.length - 1;
    while (newest >= 0 && !inStory(chat[newest])) newest--;
    if (run.mesId < newest) return;
    run.id ||= `${Date.now().toString(36)}-${kind}`;
    try { await storeFix(run.id, makeFix({ id: run.id, kind, input: run.input, model: run.model, truth: structuredClone(truth), meta: fixMeta() })); }
    catch (err) { console.warn(LOG, 'correction not kept', err); }
}

/** ⟲ to the original undoes the body checks' fixes on it (a case); ⟲ back to the fixes takes the case back out. */
function noteUndo(mesId, rec, toOriginal) {
    if (!settings().fixes.on) return;
    const undone = (rec.applied || []).filter(a => a.by === 'body');
    if (!undone.length) return;
    if (!toOriginal) { if (rec.fixId) storeFix(rec.fixId, null).catch(err => console.warn(LOG, err)); return; }
    const head = headLedger(mesId + 1);
    if (!head) return;
    rec.fixId ||= `${Date.now().toString(36)}-checks`;
    const fix = makeChecksFix({ id: rec.fixId, text: rec.original, ledger: head.ledger, userName: ctx().name1 || 'User', rejected: undone, meta: fixMeta() });
    storeFix(rec.fixId, fix).catch(err => console.warn(LOG, 'correction not kept', err));
}

// One at a time, so two quick edits to the same update can't both list it.
let fixQueue = Promise.resolve();
const storeFix = (id, fix) => (fixQueue = fixQueue.catch(() => {}).then(() => writeFix(id, fix)));

/** Writes a case's file and lists it; a null case takes it out (your edits put the record back as the model had it). */
async function writeFix(id, fix) {
    const s = settings().fixes;
    const at = s.cases.findIndex(c => c.id === id);
    if (!fix) {
        if (at < 0) return;
        await deleteFixFile(s.cases[at].path);
        s.cases.splice(at, 1);
        save();
        renderFixes();
        return;
    }
    const bytes = new TextEncoder().encode(JSON.stringify(fix, null, 1));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const res = await fetch('/api/files/upload', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ name: fixFileName(id), data: btoa(bin) }) });
    if (!res.ok) throw new Error(`couldn't save the case (${res.status})`);
    const { path } = await res.json();
    const entry = { id, kind: fix.kind, when: fix.when, card: fix.card || '', changes: fix.changes.length, path };
    if (at >= 0) s.cases[at] = entry;
    else s.cases.push(entry);
    save();
    renderFixes();
}

async function deleteFixFile(path) {
    if (!path) return;
    const res = await fetch('/api/files/delete', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ path }) });
    if (!res.ok && res.status !== 404) throw new Error(`couldn't remove ${path} (${res.status})`);
}

function renderFixes() {
    const s = settings().fixes;
    const by = FIX_KINDS.map(k => [k, s.cases.filter(c => c.kind === k).length]).filter(([, n]) => n);
    $('#wh_fix_count').text(s.cases.length
        ? `${s.cases.length} kept: ${by.map(([k, n]) => `${n} ${FIX_LABELS[k]}`).join(', ')}.`
        : s.on ? 'None kept yet. Fix the Ledger, the World notes or the Mind Book right after a reply, or ⟲ a body-check fix.' : '');
    $('#wh_fix_clear').toggle(s.cases.length > 0);
}

async function clearFixes() {
    const c = ctx();
    const s = settings().fixes;
    const ok = await c.callGenericPopup(`Remove all ${s.cases.length} kept corrections? Their files are deleted.`, c.POPUP_TYPE.CONFIRM, '', { okButton: 'Remove', cancelButton: 'Cancel' });
    if (ok !== c.POPUP_RESULT.AFFIRMATIVE) return;
    for (const f of [...s.cases]) {
        await deleteFixFile(f.path).catch(err => console.warn(LOG, err));
        s.cases.splice(s.cases.indexOf(f), 1);
    }
    for (const k of Object.keys(lastRun)) lastRun[k].id = '';
    save();
    renderFixes();
}



// ------------------------------------------------------------------ Card Doctor 2: test this card

// Each test reply is a quiet generation through SillyTavern standing in for a normal reply, so it gets your preset, your
// chat model, the card and the Codex the way a reply in play does. While one runs, `trial` holds its opening: the
// interceptor swaps the messages it's written from for the greeting and the test move (a copy; the chat itself is never
// touched), the preset's prompts and lore set to go out on normal replies only (the presets' instructions and
// Post-History slot, every Codex entry) go out on it too, the Codex arms as it would in a new chat, the card's rules go
// in, and this chat's notes from other extensions (Author's Note, summaries, memories) are blanked for that one request
// and put back after. (Until 2026-10-28 the trigger part was missing and a test reply got only the main prompt and the
// card, with none of the preset's instructions or the Codex.)
let trial = null;
const TRIAL_KEEP = [RULES_KEY, '__STORY_STRING__', 'QUIET_PROMPT', 'DEPTH_PROMPT', 'PERSONA_DESCRIPTION', 'customDepthWI', 'customWIOutlet_'];
const TRIAL_COUNTS = [3, 6, 10];
const lastTests = new Map();   // avatar → the last test this session, shown again when Check card reopens

globalThis.worldhopperTrialInterceptor = (chat, _size, _abort, type) => {
    if (!trial || trial.used || type !== 'quiet') return;
    trial.used = true;
    const c = ctx(), now = Date.now();
    chat.splice(0, chat.length,
        { name: c.name2, is_user: false, is_system: false, mes: trial.greeting, send_date: now, extra: {}, index: 0 },
        { name: c.name1, is_user: true, is_system: false, mes: trial.player, send_date: now, extra: {}, index: 1 });
};

/** During the test's own request: blank every other extension's prompt for this chat (trialReply puts them back). */
function blankForTrial() {
    if (!trial?.used || trial.blanked) return;
    trial.blanked = {};
    for (const [k, p] of Object.entries(ctx().extensionPrompts || {})) {
        if (!p?.value || TRIAL_KEEP.some(x => k.startsWith(x))) continue;
        trial.blanked[k] = p.value;
        p.value = '';
    }
}

/** During the test's own request: lore set to go out on normal replies goes out on it too (entries here are copies). */
function asNormalReply(lore) {
    for (const list of [lore?.globalLore, lore?.characterLore, lore?.chatLore, lore?.personaLore].filter(Array.isArray)) {
        for (const e of list) {
            if (Array.isArray(e.triggers) && e.triggers.includes('normal') && !e.triggers.includes('quiet')) e.triggers = [...e.triggers, 'quiet'];
        }
    }
}

/** One test reply from the chat model: the next message after `greeting` and the player's `move`, as in a new chat. */
async function trialReply(greeting, move) {
    const c = ctx();
    const t = trial = { greeting: c.substituteParams(greeting), player: move, used: false, blanked: null };
    // The preset's prompts the same way: read as for a normal reply, for this request only.
    const pm = promptManager, should = pm?.shouldTrigger;
    if (should) pm.shouldTrigger = (p, type) => should.call(pm, p, type === 'quiet' && trial === t && t.used ? 'normal' : type);
    try {
        const text = await c.generateQuietPrompt({ quietPrompt: '', removeReasoning: true });
        // Without the hook (the manifest is read at startup) the reply would answer this chat instead of the test.
        if (!t.used) throw new Error('the test hook isn\'t loaded yet: reload SillyTavern once and try again');
        return String(text || '').trim();
    } finally {
        trial = null;
        if (should) pm.shouldTrigger = should;
        for (const [k, v] of Object.entries(t.blanked || {})) { const p = ctx().extensionPrompts?.[k]; if (p && !p.value) p.value = v; }
    }
}

function chatModelName() {
    const c = ctx();
    try { if (c.mainApi === 'openai' && c.getChatCompletionModel()) return c.getChatCompletionModel(); } catch { /* fall through */ }
    return typeof c.onlineStatus === 'string' && c.onlineStatus && c.onlineStatus !== 'no_connection' ? c.onlineStatus : 'your chat model';
}

/**
 * Writes `count` test openings for a card and checks them. `job`: { signal } to cancel; `progress(text)` for the
 * button. Returns what trialResults shows.
 */
async function runCardTest(d, modes, count, job, progress) {
    const c = ctx();
    const user = c.name1 || 'User';
    const model = chatModelName();
    const greetings = cardGreetings(d);
    const rulesText = compileRules(cardRules(d)).writer;
    const ask = (msgs, max, temp) => askProfile(notesProfile(), msgs, max, temp, { signal: job.signal });
    progress('Writing the opening moves');
    const slots = pickGreetings(greetings.length, count);
    let moves = null;
    for (let tries = 0; !moves && tries < 2 && !job.signal.aborted; tries++) moves = parseMoves(await ask(buildMovesMessages(d, modes, { userName: user, slots }), 3000, 0.9), slots);
    if (!moves) throw new Error(job.signal.aborted ? 'canceled' : 'the notes model didn\'t write usable opening moves');
    const openings = [], checks = [];
    for (const [i, m] of moves.slice(0, count).entries()) {
        if (job.signal.aborted) break;
        progress(`Writing reply ${i + 1} of ${Math.min(count, moves.length)} on ${model}`);
        const o = { greeting: m.greeting, move: m.text, reply: '', verdict: null, error: '' };
        openings.push(o);
        try { o.reply = await trialReply(greetings[m.greeting], m.text); } catch (err) {
            if (/test hook/.test(err.message)) throw err;
            o.error = job.signal.aborted ? 'canceled' : String(err.message || err);
            continue;
        }
        if (!o.reply) { o.error = job.signal.aborted ? 'canceled' : 'the model returned nothing'; continue; }
        // Checked while the next reply is written.
        checks.push((async () => {
            const msgs = buildTrialJudgeMessages({ d, modes, userName: user, cardRules: rulesText, greeting: c.substituteParams(greetings[m.greeting]), player: m.text, reply: o.reply });
            for (let tries = 0; !o.verdict && tries < 2 && !job.signal.aborted; tries++) o.verdict = parseTrialVerdict(await ask(msgs, 3000, 0).catch(() => ''), modes);
        })());
    }
    progress('Checking the replies');
    await Promise.all(checks);
    const summary = summarizeTrial(openings);
    let fixes = {};
    if (summary.findings.length && !job.signal.aborted) {
        progress('Suggesting fixes');
        fixes = parseTrialFixes(await ask(buildTrialFixMessages({ d, findings: summary.findings, of: summary.checked, cardRules: rulesText, used: openings.filter(o => o.verdict?.length).map(o => o.greeting) }), 3000, 0.3).catch(() => ''));
    }
    return { when: Date.now(), model, openings, summary, fixes, canceled: job.signal.aborted };
}

function trialResults(r) {
    const box = $('<div class="wh-trial"></div>');
    const { checked, clean, findings } = r.summary;
    const lost = r.openings.length - checked;
    const mins = Math.round((Date.now() - r.when) / 60000);
    box.append($('<div class="wh-trial-head"></div>').text(`${checked} ${checked === 1 ? 'reply' : 'replies'} on ${r.model}: ${clean} clean${lost ? `; ${lost} not written or not checked` : ''}${r.canceled ? ' (stopped early)' : ''}.${mins >= 1 ? ` Tested ${mins} min ago.` : ''}`));
    const list = $('<div class="wh-doctor"></div>');
    if (!findings.length && checked) list.append('<div class="wh-doctor-ok"><i class="fa-solid fa-check"></i> No rule broken in any reply.</div>');
    for (const f of findings) {
        const detail = $('<div class="wh-doctor-detail"></div>');
        for (const q of f.quotes.slice(0, 3)) detail.append($('<q></q>').text(q.quote), $('<small class="wh-trial-from"></small>').text(`Reply ${q.opening + 1}${q.why ? `: ${q.why}` : ''}`));
        if (r.fixes[f.rule]) detail.append($('<div class="wh-trial-fix"></div>').append('<b>Fix: </b>', $('<span></span>').text(r.fixes[f.rule])));
        list.append($('<details class="wh-doctor-item wh-warn"></details>').append(
            $('<summary></summary>').append('<i class="fa-solid fa-triangle-exclamation"></i>', $('<span></span>').text(`${f.label}: ${f.count} of ${checked}`)), detail));
    }
    box.append(list);
    // Every reply, to read for yourself.
    const all = $('<details class="wh-trial-replies"></details>').append($('<summary></summary>').text('Read the replies'));
    r.openings.forEach((o, i) => {
        const n = o.verdict?.length;
        const status = o.error ? `not written: ${o.error}` : o.verdict ? (n ? `${n} break${n === 1 ? '' : 's'}` : 'clean') : 'not checked';
        all.append($('<div class="wh-trial-reply"></div>').append(
            $('<div class="wh-trial-reply-head"></div>').text(`Reply ${i + 1} · greeting ${o.greeting + 1} · ${status}`),
            $('<div class="wh-trial-move"></div>').text(o.move),
            o.reply ? $('<div class="wh-trial-text"></div>').text(o.reply) : ''));
    });
    return box.append(all);
}

/** Check card's "Test this card" section. Returns the section and a stop function for when the popup closes. */
function trialSection(d, modes, avatar) {
    const box = $('<div class="wh-trial-box"></div>').append('<div class="wh-mini-title">Test this card</div>');
    const greetings = cardGreetings(d);
    const out = $('<div class="wh-trial-out"></div>');
    if (lastTests.has(avatar)) out.append(trialResults(lastTests.get(avatar)));
    if (!greetings.length || !notesProfile()) {
        box.append($('<div class="wh-muted"></div>').text(!greetings.length ? 'The card has no greeting to start a test from.' : 'Pick a notes model under Settings → Models first: it writes the opening moves and checks the replies.'));
        return { box: box.append(out), stop: () => {} };
    }
    box.append($('<div class="wh-muted"></div>').text(`Writes a few first replies on ${chatModelName()} with your preset, this card, and the Codex, the way a new chat would, then ${notesProfile()} checks each one against the house rules and the card's own. Each reply is a normal request on your chat model.`));
    const count = $('<select class="text_pole wh-trial-count"></select>').append(TRIAL_COUNTS.map(n => $('<option></option>').val(n).text(`${n} replies`))).val(String(TRIAL_COUNTS[1]));
    const btn = $('<div class="menu_button wh-card-review"><i class="fa-solid fa-flask"></i><span>Test this card</span></div>');
    let running = null;
    const stop = () => { if (!running) return; running.abort(); if (trial) ctx().stopGeneration(); };
    btn.on('click', async () => {
        if (running) { stop(); return; }
        const job = running = new AbortController();
        const t0 = Date.now();
        const label = btn.find('span');
        let step = '';
        const tick = () => label.text(`${step}… ${Math.round((Date.now() - t0) / 1000)} s · tap to stop`);
        const progress = s => { step = s; tick(); };
        const ticker = setInterval(tick, 1000);
        btn.addClass('wh-busy').find('i').attr('class', 'fa-solid fa-spinner fa-spin');
        count.prop('disabled', true);
        out.empty();
        try {
            const r = await runCardTest(d, modes, Number(count.val()), job, progress);
            lastTests.set(avatar, r);
            out.append(trialResults(r));
        } catch (err) {
            out.append($('<div class="wh-muted"></div>').text(err.message === 'canceled' ? 'Test stopped.' : `Couldn't run the test: ${err.message}`));
        } finally {
            clearInterval(ticker);
            running = null;
            label.text('Test this card');
            btn.removeClass('wh-busy').find('i').attr('class', 'fa-solid fa-flask');
            count.prop('disabled', false);
        }
    });
    box.append($('<div class="wh-trial-controls"></div>').append(btn, count), out);
    return { box, stop };
}

// ------------------------------------------------------------------ Check the greetings

const lastGreetingChecks = new Map();   // avatar → the last greeting check this session

/** Every greeting read against the house rules by the notes model, four at a time. */
async function runGreetingCheck(d, modes, job, progress) {
    const greetings = cardGreetings(d);
    const rulesText = compileRules(cardRules(d)).writer;
    const checks = greetings.map((_, index) => ({ index, breaks: null, error: '' }));
    let done = 0;
    progress(`Checked 0 of ${greetings.length}`);
    const one = async ch => {
        for (let tries = 0; !ch.breaks && tries < 2 && !job.signal.aborted; tries++) {
            try {
                ch.breaks = parseGreetingCheck(await askProfile(notesProfile(), buildGreetingCheckMessages({ d, modes, cardRules: rulesText, index: ch.index }), 3000, 0, { signal: job.signal }), modes, greetings[ch.index]);
            } catch (err) { ch.error = job.signal.aborted ? 'canceled' : String(err.message || err); }
        }
        progress(`Checked ${++done} of ${greetings.length}`);
    };
    const queue = [...checks];
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => { while (queue.length && !job.signal.aborted) await one(queue.shift()); }));
    return { when: Date.now(), checks, summary: summarizeGreetings(checks, greetings), canceled: job.signal.aborted };
}

/**
 * Swaps `from` for `to` in one greeting on disk (index as cardGreetings counts them: empty ones skipped), then reloads
 * the card. False when the greeting no longer holds `from` exactly once (edited since the check).
 */
async function swapInGreeting(chid, index, from, to) {
    const c = ctx();
    const ch = c.characters[chid];
    const raw = [ch.first_mes ?? ch.data?.first_mes, ...(ch.data?.alternate_greetings || [])].map(g => String(g ?? ''));
    const at = raw.map((g, i) => (g.trim() ? i : -1)).filter(i => i >= 0)[index];
    if (at == null) return false;
    const spot = locateBreak(raw[at], from, to);
    if (!spot.exact) return false;
    const text = raw[at].replace(spot.quote, () => spot.instead);
    if (at === 0) await writeCardFields(chid, { first_mes: text });
    else {
        const alts = raw.slice(1);
        alts[at - 1] = text;
        const res = await fetch('/api/characters/merge-attributes', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ avatar: ch.avatar, data: { alternate_greetings: alts } }) });
        if (!res.ok) throw new Error(`couldn't save the card (${res.status})`);
    }
    await reloadCard(chid);
    return true;
}

function greetingResults(r, chid) {
    const box = $('<div class="wh-trial"></div>');
    const { checked, clean, findings, questions } = r.summary;
    const lost = r.checks.length - checked;
    box.append($('<div class="wh-trial-head"></div>').text(`${checked} of ${r.checks.length} greeting${r.checks.length === 1 ? '' : 's'} checked: ${clean} clean${lost ? `; ${lost} not checked` : ''}${r.canceled ? ' (stopped early)' : ''}.`));
    const list = $('<div class="wh-doctor"></div>');
    if (!findings.length && checked) list.append('<div class="wh-doctor-ok"><i class="fa-solid fa-check"></i> No house rule broken in any greeting.</div>');
    for (const f of findings) {
        const detail = $('<div class="wh-doctor-detail"></div>');
        for (const it of f.items) {
            const row = $('<div class="wh-greet-fix"></div>').append(
                $('<q></q>').text(it.quote),
                $('<small class="wh-trial-from"></small>').text(`Greeting ${it.greeting + 1}${it.why ? `: ${it.why}` : ''}`));
            if (it.instead) row.append($('<div class="wh-trial-fix"></div>').append('<b>Instead: </b>', $('<span></span>').text(it.instead)));
            if (it.instead && it.exact) {
                const b = $('<div class="menu_button wh-greet-apply"></div>').text('Apply');
                let applied = false;
                b.on('click', async () => {
                    if (b.hasClass('wh-busy')) return;
                    b.addClass('wh-busy');
                    try {
                        const ok = applied ? await swapInGreeting(chid, it.greeting, it.instead, it.quote) : await swapInGreeting(chid, it.greeting, it.quote, it.instead);
                        if (!ok) { toastr.warning(`Greeting ${it.greeting + 1} changed since the check, so this wasn't applied. Check the greetings again.`); return; }
                        applied = !applied;
                        b.text(applied ? 'Undo' : 'Apply');
                        row.toggleClass('wh-greet-applied', applied);
                    } catch (err) { toastr.error(String(err.message || err)); } finally { b.removeClass('wh-busy'); }
                });
                row.append(b);
            } else if (it.instead) row.append($('<small class="wh-muted"></small>').text('Couldn\'t find these exact words in the greeting; change it by hand.'));
            detail.append(row);
        }
        list.append($('<details class="wh-doctor-item wh-warn"></details>').append(
            $('<summary></summary>').append('<i class="fa-solid fa-triangle-exclamation"></i>', $('<span></span>').text(`${f.label}: ${f.count} of ${checked}`)), detail));
    }
    if (questions.length) {
        list.append($('<details class="wh-doctor-item wh-info"></details>').append(
            $('<summary></summary>').append('<i class="fa-solid fa-circle-info"></i>', $('<span></span>').text(`Ends on a question to you: ${questions.length} of ${r.checks.length}`)),
            $('<div class="wh-doctor-detail"></div>').text(`Greetings ${questions.map(i => i + 1).join(', ')} end with someone asking you something. The model copies how greetings end, so its replies will keep handing you a question. End some on an action or a statement instead.`)));
    }
    // No "apply all": on a long test card's first check, a few suggestions were wrong and the interruptions were the greetings'
    // own hooks, so each one is read and applied by hand.
    return box.append(list);
}

/** Check card's "Check the greetings" section. Returns the section and a stop function for when the popup closes. */
function greetingSection(chid, d, modes, avatar) {
    const greetings = cardGreetings(d);
    const box = $('<div class="wh-trial-box"></div>').append('<div class="wh-mini-title">Check the greetings</div>');
    const out = $('<div class="wh-trial-out wh-greet-out"></div>');
    if (lastGreetingChecks.has(avatar)) out.append(greetingResults(lastGreetingChecks.get(avatar), chid));
    if (!greetings.length || !notesProfile()) {
        box.append($('<div class="wh-muted"></div>').text(!greetings.length ? 'The card has no greetings.' : 'Pick a notes model under Settings → Models first: it reads the greetings.'));
        return { box: box.append(out), stop: () => {} };
    }
    box.append($('<div class="wh-muted"></div>').text(`${notesProfile()} reads all ${greetings.length} greeting${greetings.length === 1 ? '' : 's'} against the house rules for this card's modes and suggests words to put in place of each break. The model playing a card copies its greetings, so a habit there shows up in its replies. One request per greeting.`));
    const btn = $('<div class="menu_button wh-card-review wh-greet-check"><i class="fa-solid fa-list-check"></i><span>Check the greetings</span></div>');
    let running = null;
    const stop = () => running?.abort();
    btn.on('click', async () => {
        if (running) { stop(); return; }
        const job = running = new AbortController();
        const t0 = Date.now();
        const label = btn.find('span');
        let step = '';
        const tick = () => label.text(`${step}… ${Math.round((Date.now() - t0) / 1000)} s · tap to stop`);
        const progress = s => { step = s; tick(); };
        const ticker = setInterval(tick, 1000);
        btn.addClass('wh-busy').find('i').attr('class', 'fa-solid fa-spinner fa-spin');
        out.empty();
        try {
            const r = await runGreetingCheck(d, modes, job, progress);
            lastGreetingChecks.set(avatar, r);
            out.append(greetingResults(r, chid));
        } catch (err) {
            out.append($('<div class="wh-muted"></div>').text(`Couldn't check the greetings: ${err.message}`));
        } finally {
            clearInterval(ticker);
            running = null;
            label.text('Check the greetings');
            btn.removeClass('wh-busy').find('i').attr('class', 'fa-solid fa-list-check');
        }
    });
    box.append($('<div class="wh-trial-controls"></div>').append(btn), out);
    return { box, stop };
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
    const tool = !!d.extensions?.worldhopper?.tool;
    const greet = tool ? null : greetingSection(c.characterId, d, modes, ch.avatar);
    const test = tool ? null : trialSection(d, modes, ch.avatar);
    if (greet) root.append(greet.box);
    if (test) root.append(test.box);
    await c.callGenericPopup(root, c.POPUP_TYPE.TEXT, '', { wide: true, okButton: 'Close', allowVerticalScrolling: true });
    greet?.stop();
    test?.stop();
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
        // Stage mode's stylesheet, loaded with the rest (it only acts under body.wh-stage).
        // A fresh copy each load: a stale one beside a newer index.js would draw Stage half old.
        $('<link rel="stylesheet" id="wh_stage_css">').attr('href', `${new URL('./stage.css', import.meta.url).href}?t=${Date.now()}`).appendTo('head');
        applyStageLook(stageOn());
        $(window).on('resize', () => placeBoard());
        guardSendRequest();
        await addSettingsPanel();
        addMessageButton();
        addWandButton();
        addSlashCommands();
        // Stage mode: a speaker's face (or the rider's, small on it) is tapped for a closer look.
        $('#chat').on('click keydown', '[data-whs-face]', function (e) {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();   // the rider's face sits inside the speaker's
            zoomFace(this.dataset.whsFace);
        });
        const { eventSource, event_types } = ctx();
        eventSource.on(event_types.WORLDINFO_ENTRIES_LOADED, onEntriesLoaded);
        eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
        // Your message is in the chat now: the Ledger's turn line reads it.
        if (event_types.MESSAGE_SENT) eventSource.on(event_types.MESSAGE_SENT, async id => { await applyIntents(id); applyLedgerInjection(); });
        eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
        if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, onMessageEdited);
        // The preset nudge follows the active preset and its toggles (ticking a block saves the settings).
        for (const ev of [event_types.OAI_PRESET_CHANGED_AFTER, event_types.SETTINGS_UPDATED, event_types.MAIN_API_CHANGED]) {
            if (ev) eventSource.on(ev, () => setTimeout(renderPresetNudge, 0));
        }
        if (event_types.PERSONA_CHANGED) eventSource.on(event_types.PERSONA_CHANGED, () => { renderYou(); applyLedgerInjection(); renderStrip(); });
        eventSource.on(event_types.CHAT_CHANGED, () => {
            pickerOpen = null;
            closeSheet();
            renderCodexPanel(); renderLedgerPanel(); renderModelSelects(); renderWorldSelect(); renderYou(); applyLedgerInjection();
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
