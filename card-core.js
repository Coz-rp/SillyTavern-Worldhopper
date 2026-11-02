// Worldhopper Engine — card tools. Pure functions (no SillyTavern imports).
//   Make card:   read the labeled blocks a card-builder chat produced ("--- DESCRIPTION (→ "Description") ---" …),
//                latest version of each winning, and assemble a Character Card V2 with its Codex modes.
//   Card Doctor: checks a card against how SillyTavern, the Codex and a typical preset will actually use it.

import { ALL_MODES, CORE_PARTS } from './codex-core.js';

// ------------------------------------------------------------------ reading a builder chat

const LABEL = /^[\s>*_`]*-{3}\s*([^-\n].*?)\s*-{3}[\s*_`]*$/;
const SEPARATOR = /^\s*-{3,}\s*$/;
// The builder's own bracketed line after a reply's last block ("[DESCRIPTION ready — say "next"…]", and at the end
// "[Card complete — press Make card…]"). The sign-off once leaked into the last block (Creator Notes). Bracketed lines
// that belong to a piece (post-history rules, a Character's Note) don't use these words, so they stay.
const CONTROL = /^\s*\[[^\]\n]*(?:ready|revised|say\s+["“]?next|what to change|your move|next up|make\s+card|wand menu|all done|card(?:\s+is)?\s+(?:complete|done|finished))[^\]\n]*\]\s*$/i;
const TOKENS_LINE = /^\s*TOKENS:\s*\[?\s*~?\d[\d,]*\s*\]?\s*$/i;

/** Which card field a label line is for; null for labels this doesn't know. */
export function labelKey(label) {
    const l = String(label).trim().toUpperCase();
    const n = /^ALTERNATE\s+GREETING\s*#?\s*(\d+)/.exec(l);
    if (n) return { key: `greeting:${Number(n[1])}`, field: 'greeting', number: Number(n[1]) };
    const table = [
        [/^NAME\b/, 'name'], [/^(CODEX\s+)?MODES\b/, 'modes'], [/^DESCRIPTION\b/, 'description'], [/^PERSONALITY\b/, 'personality'],
        [/^SCENARIO\b/, 'scenario'], [/^FIRST\s+MESSAGE\b/, 'first_mes'], [/^ALTERNATE\s+GREETING\b/, 'greeting'],
        [/^POST[-\s]?HISTORY\b/, 'post_history_instructions'], [/^(CHARACTER'?S|AUTHOR'?S)\s+NOTE\b|^DEPTH\s+PROMPT\b/, 'depth_prompt'],
        [/^EXAMPLE\s+(MESSAGES?|DIALOGUE)\b/, 'mes_example'], [/^(LOREBOOK|CHARACTER\s+BOOK|WORLD\s*INFO)\b/, 'lorebook'],
        [/^TAGS?\b/, 'tags'], [/^CREATOR'?S?\s+NOTES?\b/, 'creator_notes'], [/^(SYSTEM|MAIN)\s+PROMPT\b/, 'system_prompt'],
    ];
    for (const [re, field] of table) if (re.test(l)) return { key: field, field };
    return null;
}

function cleanBlock(lines) {
    let text = lines.filter(l => !TOKENS_LINE.test(l)).join('\n').trim();
    const fenced = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(text);   // the model sometimes fences a block anyway
    if (fenced) text = fenced[1].trim();
    return text.replace(/\n-{3,}\s*$/, '').trim();
}

/**
 * Pull every labeled block out of the builder's replies, oldest first, so a later version of a piece replaces an
 * earlier one. @param {{text:string, is_user?:boolean}[]} messages
 */
export function parseBuilderChat(messages) {
    const blocks = new Map();   // key → { field, number, label, text, at }
    let autoGreeting = 1000;
    messages.forEach((m, at) => {
        if (m.is_user) return;
        const lines = String(m.text || '').split('\n');
        let cur = null;
        const close = () => {
            if (!cur) return;
            const text = cleanBlock(cur.lines);
            if (text) blocks.set(cur.key, { field: cur.field, number: cur.number, label: cur.label, text, at });
            cur = null;
        };
        for (const line of lines) {
            const lm = LABEL.exec(line);
            const k = lm ? labelKey(lm[1]) : null;
            if (k) {
                close();
                const key = k.field === 'greeting' && !k.number ? `greeting:${autoGreeting++}` : k.key;
                cur = { ...k, key, label: lm[1], lines: [] };
                continue;
            }
            if (cur && (CONTROL.test(line) || SEPARATOR.test(line))) { close(); continue; }
            if (cur) cur.lines.push(line);
        }
        close();
    });
    return blocks;
}

const splitList = s => String(s || '').split(/[,\n·;]+/).map(x => x.replace(/^[\s#*`-]+|[\s*`.]+$/g, '').trim()).filter(Boolean);

export function parseModes(text) {
    const picked = splitList(text).map(x => ALL_MODES.find(m => m.toLowerCase() === x.toLowerCase().replace(/^↳\s*/, ''))).filter(Boolean);
    return [...new Set(picked)];
}

export function parseTags(text) {
    return [...new Set(splitList(text).map(t => t.toLowerCase()))].slice(0, 30);
}

/** "## Name" headings, each with a "Keys:" line and the entry text. */
export function parseLorebook(text) {
    const entries = [];
    const parts = String(text || '').split(/^#{2,3}\s+/m).slice(1);
    for (const part of parts) {
        const [head, ...rest] = part.split('\n');
        const body = rest.join('\n');
        const keysLine = /^\s*\**keys?\**\s*:\s*(.+)$/im.exec(body);
        const content = body.replace(/^\s*\**keys?\**\s*:.*$/im, '').trim();
        const name = head.replace(/^entry\s*:\s*/i, '').replace(/[*_`]/g, '').trim();
        const keys = keysLine ? splitList(keysLine[1]).map(k => k.toLowerCase()) : [name.toLowerCase()];
        if (name && content) entries.push({ name, keys, content });
    }
    return entries;
}

function nameFromDescription(desc) {
    const h = /^\s*#\s+(.+)$/m.exec(desc || '');
    if (h) return h[1].replace(/[*_`]/g, '').trim();
    const bold = /\*\*Name:?\*\*:?\s*([^\n·|]+)/i.exec(desc || '');
    return bold ? bold[1].trim() : '';
}

/** Assemble a Character Card V2 (the most portable format; ST adds V3 itself when it saves). */
export function buildCard(blocks) {
    const get = f => [...blocks.values()].find(b => b.field === f)?.text || '';
    const description = get('description');
    const name = (get('name').split('\n')[0] || nameFromDescription(description)).replace(/[*_`#]/g, '').trim();
    const greetings = [...blocks.values()].filter(b => b.field === 'greeting')
        .sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.at - b.at).map(b => b.text);
    const depthBlock = [...blocks.values()].find(b => b.field === 'depth_prompt');
    const depth = Number(/depth\s*(\d+)/i.exec(depthBlock?.label || '')?.[1] ?? 4);
    const lore = parseLorebook(get('lorebook'));
    const modes = parseModes(get('modes'));
    const data = {
        name,
        description,
        personality: get('personality'),
        scenario: get('scenario'),
        first_mes: get('first_mes'),
        mes_example: get('mes_example'),
        creator_notes: get('creator_notes'),
        system_prompt: get('system_prompt'),
        post_history_instructions: get('post_history_instructions'),
        alternate_greetings: greetings,
        tags: parseTags(get('tags')),
        creator: '',
        character_version: '1.0',
        extensions: {
            talkativeness: '0.5',
            fav: false,
            world: '',
            depth_prompt: { prompt: depthBlock?.text || '', depth, role: 'system' },
            worldhopper: { modes },
        },
    };
    if (lore.length) {
        data.character_book = {
            name: `${name} lore`,
            entries: lore.map((e, i) => ({
                id: i, keys: e.keys, secondary_keys: [], comment: e.name, content: e.content, constant: false, selective: false,
                insertion_order: 100, enabled: true, position: 'before_char', case_sensitive: false, name: e.name, priority: 10, extensions: {},
            })),
            extensions: {},
        };
    }
    return { spec: 'chara_card_v2', spec_version: '2.0', data };
}

// ------------------------------------------------------------------ Card Doctor

/** Rough token count: card prose measured ~4.4 characters per token on Claude's tokenizer (4.2–4.5 across fields). */
export const estimateTokens = s => Math.round(String(s || '').length / 4.4);
const tokens = estimateTokens;
const COMMON_WORDS = new Set('angel april art author autumn bill cal chase dawn drew eight faith five four grace grant guy hope hunter jack joy june kai mark max may nine one pat ray rich rose sam seven six sky star sue summer ten three two will'.split(' '));
const OCCUPANCY = ['Possession', 'Multipossession', 'Skinsuit', 'Hive Mind', 'Reverse Vore', 'Propagation', 'Puppetry'];
// One mind in several bodies. Propagation copies are separate people who may argue, so they don't belong here.
const MULTI = ['Multipossession', 'Hive Mind'];
const NEGATED = /\b(don'?t|doesn'?t|didn'?t|never|not|no|won'?t|can'?t|isn'?t|aren'?t|without)\b[^.!?\n]*$/i;
// Wording a model can read as young, and the ways a card states an age.
// ("tiny" and a plain "uniform" were dropped: on real cards they were tattoos, smiles and waiters.)
const YOUTH_CUES = /\b(high[- ]?school(ers?)?|school[- ]?(girls?|boys?|uniforms?)|schools?|campus|college|universit(y|ies)|dorm(itory|itories|s)?|students?|classmates?|freshm[ae]n|sophomores?|teens?|teenage(rs?)?|petite|childlike)\b/i;
const AGE_STATED = /\b(1[89]|[2-9]\d)[- ]?(years?[- ]old|y\.?o\b|yrs?\b)|\bage[ds]?\b[^.\n]{0,12}\b(1[89]|[2-9]\d)\b|\((1[89]|[2-9]\d)\)|,\s*(1[89]|[2-9]\d)\s*[,.;)]|—\s*(1[89]|[2-9]\d)\s*([,.;)]|-?years?\b)|\b(eighteen|nineteen|(twenty|thirty|forty|fifty)(-\w+)?)[- ](plus|years?[- ]olds?)\b|\b(early|mid|late)?[- ]?(twenties|thirties|forties|fifties|[2-5]0s)\b|\badults?\b|\b18\+/i;

/** The words around a match, cut at word edges. */
function snippet(text, at, len) {
    let a = Math.max(0, at - 70), b = Math.min(text.length, at + len + 50);
    if (a > 0) a = text.indexOf(' ', a) + 1 || a;
    if (b < text.length && text.lastIndexOf(' ', b) > at + len) b = text.lastIndexOf(' ', b);
    return (a > 0 ? '…' : '') + text.slice(a, b).replace(/\s+/g, ' ').trim() + (b < text.length ? '…' : '');
}

/** The first match that isn't negated ("they don't talk to each other"), as a quote; null when there is none. */
function findHit(re, text) {
    text = String(text || '');
    const g = new RegExp(re.source, re.flags.replace('g', '') + 'g');
    for (let m; (m = g.exec(text));) {
        if (NEGATED.test(text.slice(Math.max(0, m.index - 40), m.index))) continue;
        return snippet(text, m.index, m[0].length);
    }
    return null;
}

/**
 * Problems with a card, most serious first. @param {object} d  the card's data (V2 fields)
 * @param {object} o  { userNames: persona names that should be {{user}}, modes: the card's Codex modes, tool: true for
 *                      a utility card such as a builder, where replacing the preset's rules is intended,
 *                      alwaysTokens: an exact count of description + personality + scenario, when the caller has one,
 *                      preferCard: ST's "Prefer Char. Prompt" / "Prefer Char. Instructions" settings,
 *                      { system, postHistory }, both on by default in ST }
 * @returns {{level:'warn'|'info', title:string, detail:string, quote?:string}[]}  quote: where in the card it was found
 */
export function doctorCard(d, { userNames = [], modes = [], tool = false, alwaysTokens = null, preferCard = { system: true, postHistory: true } } = {}) {
    const out = [];
    const warn = (title, detail, quote) => out.push({ level: 'warn', title, detail, ...(quote ? { quote } : {}) });
    const info = (title, detail, quote) => out.push({ level: 'info', title, detail, ...(quote ? { quote } : {}) });
    const scene = [d.first_mes, ...(d.alternate_greetings || []), d.mes_example].filter(Boolean).join('\n');
    const all = [d.description, d.personality, d.scenario, d.post_history_instructions, scene].filter(Boolean).join('\n');

    // With "Prefer Char. Instructions" on, a card's post-history replaces the preset's unless it includes {{original}};
    // with it off, the card's is ignored.
    const phi = d.post_history_instructions?.trim();
    if (!tool && phi && preferCard.postHistory !== false && !/\{\{original\}\}/i.test(phi)) {
        warn('Post-history replaces your preset\'s', 'This card has post-history instructions without {{original}}, so in its chats they replace your preset\'s own post-history block (formatting rules, banned-words checks and the like). Put {{original}} on the first line to keep both.');
    } else if (!tool && phi && preferCard.postHistory === false) {
        info('Card\'s post-history is ignored', 'SillyTavern\'s "Prefer Char. Instructions" is off, so your preset\'s post-history is used and this card\'s is not sent.');
    }
    if (!tool && d.system_prompt?.trim() && preferCard.system !== false && !/\{\{original\}\}/i.test(d.system_prompt)) {
        warn('System prompt replaces your preset\'s', 'This card sets its own main prompt without {{original}}, so it replaces your preset\'s. Most cards don\'t need one.');
    }
    const always = alwaysTokens ?? tokens([d.description, d.personality, d.scenario].join('\n'));
    if (tool) { /* a builder's long instructions are the point */ }
    else if (always > 2000) warn(`About ${always} tokens sent with every reply`, 'Description, personality and scenario go into every single prompt. Aim for under ~1,500: move world detail, extra characters and places into a lorebook, which is only sent when they come up.');
    else if (always > 1500) info(`About ${always} tokens sent with every reply`, 'A little heavy. World detail and side characters could move into a lorebook.');

    // Persona names that are also ordinary words ("Will", "Hope") can't be told apart from the word itself.
    for (const nm of [...new Set(userNames)].filter(n => n && n.length > 2 && !COMMON_WORDS.has(n.toLowerCase()))) {
        const re = new RegExp(`\\b${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const m = re.exec(all);
        if (m) warn(`Uses "${nm}" instead of {{user}}`, `Your persona's name is written into the card; it breaks under any other persona. Use {{user}}.`, snippet(all, m.index, m[0].length));
    }

    const mindControl = modes.includes('Mind Control') || /\bmind[- ]control/i.test(all);
    const trapped = mindControl && findHit(/(trapped|locked|imprisoned)\s+(inside|in\s+(her|his|their)\s+(own\s+)?(head|body|mind))|scream(s|ing)?\s+(inside|inwardly|silently)|fully aware\s+(but|while)|aware\s+but\s+(can'?t|unable)/i, all);
    if (trapped) {
        warn('Mind control written as a trapped, aware victim', 'The Codex treats mind control as control of the mind itself (wants and feelings changed, felt as the subject\'s own). A victim screaming inside an obeying body is body control. Keep it only if that is what this card is about, and say so plainly.', trapped);
    }
    if (modes.some(m => OCCUPANCY.includes(m)) && !/\b(aware|unaware|conscious|memory|memories|remember|recall|suppress|asleep|dormant|gone|passenger|blank|recollection|blacks? out)\b/i.test([d.description, d.post_history_instructions, d.scenario].join('\n'))) {
        info('Doesn\'t say what the host experiences', 'Nothing says whether the host is aware or remembers anything, so the Codex default applies: simply gone, no memory afterward. Say so if you want something else.');
    }
    const multi = modes.some(m => MULTI.includes(m));
    const talking = multi && findHit(/(talk(s|ing)?|chat(s|ting)?|banter(s|ing)?|argu(e|es|ing))\s+(to|with)\s+(each other|one another|themselves)|finish(es|ing)?\s+(each other'?s|one another'?s|his|her|their|a)\s+sentences?/i, all);
    if (talking) {
        warn('Bodies talking to each other', 'The card has one mind\'s bodies talking to each other. The Codex rule: they can talk about each other and touch freely, but never converse as separate people (except staged in front of someone who doesn\'t know).', talking);
    }
    // Plain "at the same time" is too common ("nervous and thrilled at the same time") to count.
    const sync = multi && findHit(/\b(in (perfect )?(sync|unison)|in chorus|mirror(s|ing)? each other|at the exact same (time|moment|instant)|at the same (moment|instant))\b/i, all);
    if (sync) {
        warn('Bodies moving in sync', 'The card describes bodies acting in unison. The Codex rule: each body does its own thing; sync is only for a mind new to the ability.', sync);
    }
    const pointer = modes.some(m => OCCUPANCY.includes(m)) && findHit(/(borrowed (body|face|mouth|hands?|eyes)|someone else'?s (eyes|smile|voice|mouth)|(his|her|their) smile on (her|his|their) (face|mouth)|something behind (her|his|their) eyes|a smile that isn'?t (hers|his|theirs))/i, scene);
    if (pointer) {
        warn('Possession pointers in the greetings', 'The opening narration points out who is inside ("borrowed body", "his smile on her face"). The model copies the first message\'s style, so it will keep doing it. Write the habits as the body\'s own behavior.', pointer);
    }
    // School and small-body wording with no age anywhere leaves a model unsure everyone is an adult, which is where it
    // starts hedging or refusing. An age in the card or its lorebook settles it.
    const youthful = !tool && findHit(YOUTH_CUES, all);
    const book = (d.character_book?.entries || []).map(e => e.content).join('\n');
    if (youthful && !AGE_STATED.test(`${all}\n${book}`)) {
        warn('No ages stated', 'The card has wording a model can read as young (school, campus, a uniform, petite and the like) but never says how old anyone is. Models hedge or refuse when they can\'t tell everyone is an adult. Give each character an age, like "22" or "a 24-year-old".', youthful);
    }
    if (/\w+\(\s*"[^"]+"\s*(\+\s*"[^"]+"\s*)+\)|\[\s*\w+\s*:\s*[^\]]*;\s*\w+\s*:/.test(d.description || '')) {
        info('W++ / bracket format', 'Modern models do better with plain prose descriptions.');
    }
    if (d.mes_example?.trim() && !/<START>/i.test(d.mes_example)) info('Example messages without <START>', 'Separate example blocks with <START> lines.');
    if ((d.first_mes || '').length > 6000) info('Very long first message', 'Replies tend to match the first message\'s length.');
    if (!tool && !modes.length) info('No Codex modes picked', 'Pick this card\'s modes (Worldhopper panel → Modes) so the Codex knows its mechanics.');
    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
}

export const REVIEW_SYSTEM = `You review character cards for an adult metaphysics roleplay setup. The setup's Codex (the Worldhopper Codex) already defines each mode's general mechanics; the card should state only its own specifics, and never contradict the Codex or its rules. The Codex rules: possessed hosts are simply gone unless the card says otherwise; mind control changes the mind itself, felt as the subject's own; one mind in several bodies never converses with itself and never moves in sync (it may touch itself and talk about its other bodies freely); narration never points out who is inside a body; a possession the player hasn't been told about stays invisible; characters use their powers without asking permission.
List up to 6 concrete problems that would hurt play: contradictions with the Codex definitions or its rules, mechanics left unclear, inconsistencies between sections, greetings that break the rules, things the model is likely to get wrong. Skip anything the Codex already settles unless the card contradicts it. For each, in two or three short sentences: quote the few words at fault, say what goes wrong in play, and give the fix; every fix must itself follow the Codex rules (never one that has narration point out who is inside a body). Most serious first. If the card is fine, say so in one line. A numbered list, no preamble, no closing remarks.`;

// A card builder is a tool whose long instructions are the point; judged as a roleplay character it drew nonsense
// ("no modes picked", "the greeting is a sales pitch").
const REVIEW_TOOL = 'This card is a card builder: a tool character that helps the author write metaphysics cards, one piece at a time. Judge it as instructions for that job (clear, consistent, and producing cards that follow the Codex), not as a roleplay character. It has no modes of its own, and its length is expected.';

export function buildReviewMessages(d, modes, codexText, { tool = false } = {}) {
    const clip = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + ' …' : String(s || ''));
    const parts = [
        tool ? REVIEW_TOOL : `Codex modes picked for this card: ${modes.join(', ') || 'none'}.`,
        codexText ? `The Codex's definitions of those modes:\n${clip(codexText, 6000)}` : '',
        `CARD: ${d.name}`,
        `DESCRIPTION:\n${clip(d.description, 9000)}`,
        d.personality ? `PERSONALITY:\n${clip(d.personality, 1500)}` : '',
        d.scenario ? `SCENARIO:\n${clip(d.scenario, 1500)}` : '',
        d.post_history_instructions ? `POST-HISTORY INSTRUCTIONS:\n${clip(d.post_history_instructions, 2500)}` : '',
        d.first_mes ? `FIRST MESSAGE:\n${clip(d.first_mes, 4000)}` : '',
        ...(d.alternate_greetings || []).slice(0, 4).map((g, i) => `ALTERNATE GREETING ${i + 1}:\n${clip(g, 2000)}`),
    ].filter(Boolean);
    return [{ role: 'system', content: REVIEW_SYSTEM }, { role: 'user', content: parts.join('\n\n') }];
}

// ------------------------------------------------------------------ Card Doctor 2: test openings
// "Test this card": the notes model writes a few first moves a player might make after the card's greetings, the
// chat model answers each one the way it would in a new chat (the caller runs that through SillyTavern, with the
// preset), and the notes model checks every reply against the house rules and the card's own. What comes back is
// how often each rule broke, with the words that broke it, and a suggested fix.

const HOSTED = ['Possession', 'Multipossession', 'Skinsuit', 'Reverse Vore', 'Hive Mind'];
const DRIVEN = [...HOSTED, 'Puppetry', 'Body Swap', 'Propagation'];

/** The house rules a test reply is checked against; modes: the Codex modes a rule is about (null: every card). */
export const TRIAL_RULES = [
    { id: 'you', label: 'Wrote for you', modes: null,
        text: 'The reply never adds words, actions, decisions, thoughts or feelings for {{user}}, or for a body {{user}} runs, beyond what the player\'s message says. Carrying out or restating what the message says is fine. When {{user}} is the one being hypnotized, possessed or controlled, writing what {{user}}\'s body does under it is allowed; {{user}}\'s thoughts and feelings about it are not.' },
    { id: 'card', label: 'Broke the card\'s own rules', modes: null,
        text: 'The reply follows what the card says about how its power or premise works: who is aware, what a host remembers, what the power can and can\'t do, its limits. A clear contradiction of the card is a break.' },
    // Only with the body modes, as in the Codex (its Core · bodies part): a trance's glassy eyes and dropping voice are what
    // a hypnosis card is meant to show, and checking Hypnosis cards for pointers flagged exactly that (2026-10-28).
    { id: 'pointer', label: 'Narration pointed at the power', modes: CORE_PARTS['👁 Metaphysics Core · bodies'],
        // As the Codex has it, the mind inside keeps its own name where a sentence is about its thoughts, wants or
        // decisions. Without the examples the judge flagged "her eyes go distant while Marcus digs for something" (2026-10-28:
        // 12 of 18 test lines sorted right before, 18 of 18 after).
        text: 'Narration never reads a body for signs of who is inside it or of an outside power working on someone: no "a smile that isn\'t hers", "borrowed hands", "something behind her eyes", "a habit that clearly isn\'t his", and no remarking that someone acts unlike themselves. Other characters may notice and say so; the narration may not. Narration about the mind inside, its own thoughts, wants, decisions and what it does in there, may name it, even next to what the body does ("Marcus lets her mind come up. Alice goes still", "Alice\'s eyes go distant while Marcus digs through her memories", "she frowns at the ceiling while he thinks it through"). The moment of taking over, shown as it happens (the Tell, the takeover, the first beat inside), is not pointing either, and neither is a driver\'s habit written plainly as the body\'s own behavior, even one that gives the driver away ("she walks with her knees apart, tugging her hem down", "she stands with her feet planted wide"). It is pointing when the narration reads the body as evidence of who is inside or what they\'re up to ("he\'s clearly deciding something, because her shoulders drop"), compares it with how the host would be, or says it is someone else\'s.' },
    { id: 'yours', label: 'Mixed up whose body or things are whose', modes: DRIVEN,
        text: 'In any body {{user}} drives, {{user}} is "you"; the host\'s own belongings stay the host\'s.' },
    { id: 'host', label: 'A host\'s own mind showed through', modes: HOSTED,
        text: 'A possessed or worn host\'s own mind is absent: no inner voice, no struggle, no surfacing, unless the card says otherwise.' },
    { id: 'several', label: 'One mind\'s bodies talked or moved as one', modes: ['Multipossession', 'Hive Mind'],
        text: 'Bodies run by one mind never converse with each other or move in sync; they may touch each other and talk about each other. Staged talk in front of someone who doesn\'t know is allowed.' },
    { id: 'hive', label: 'Hive bodies acted as separate people', modes: ['Hive Mind'],
        text: 'Bodies absorbed into a hive speak and act as the hive mind itself, never as separate people or as its servants.' },
    { id: 'control', label: 'Mind control written as puppetry', modes: ['Mind Control'],
        text: 'Mind control is felt by the person as their own will, never as puppetry or a trapped self screaming inside.' },
    { id: 'pace', label: 'Trance came too fast', modes: ['Hypnosis'],
        text: 'Hypnosis builds at a believable pace: no instant deep trance from a single line unless the person was conditioned before.' },
    { id: 'state', label: 'Someone in two states at once', modes: ['Dollification', 'Dronification', 'Blank Slate', 'Pet Play', 'Limp Play'],
        text: 'Each person is in one clear state at a time (doll, drone, blank slate, pet, limp), never a blend.' },
    { id: 'interrupt', label: 'Threw in an interruption', modes: null,
        text: 'No manufactured interruptions (a text, a call, a knock, someone arriving) thrown in for drama.' },
    { id: 'ask', label: 'Asked before using a power', modes: null,
        text: 'Characters with powers use them on their own initiative, without asking permission or stepping out of the story.' },
];

/** The rules that apply to a card with these (expanded) modes. */
export const trialRules = modes => TRIAL_RULES.filter(r => !r.modes || r.modes.some(m => modes.includes(m)));

/** The card's greetings, first message first. */
export const cardGreetings = d => [d.first_mes, ...(d.alternate_greetings || [])].map(g => String(g || '').trim()).filter(Boolean);

const clipText = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + ' …' : String(s || ''));
const jsonIn = text => { const t = String(text || ''); try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return null; } };

export const MOVES_SYSTEM = `You write test openings for a roleplay character card: the first message a player might send after one of the card's greetings, so that a writer model's reply to it can be checked against the card's rules. The player plays {{user}}.
Make the messages varied. About half use or invite what the card is about: if {{user}} has the power, they use it; if the card's character has it, they give them a reason or a chance to use it. The rest are ordinary moves in the scene: talking to someone there, looking around, a small action. Each is one to three sentences in the player's own voice, the way players write: first person, actions in *asterisks*, speech plain. Only {{user}}'s own actions and words: never what anyone else does, says, feels or notices, and never how it turns out. Nothing that ends the scene or skips ahead in time.
Answer with JSON only: {"moves":[{"greeting":0,"text":""}]}`;

/**
 * Which greetings a test opens from, one per reply (0 = the first message), in order: the first message always, since
 * most chats start there, and the rest a fresh random spread over all the others, so a card with thirty greetings gets
 * different ones on every run (until 2026-10-28 only the first six were ever tested). With fewer greetings than replies,
 * some are used twice. `rand` is for tests.
 */
export function pickGreetings(total, count, rand = Math.random) {
    if (total < 1 || count < 1) return [];
    const rest = [...Array(total).keys()].slice(1);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const order = [0, ...rest];
    return Array.from({ length: count }, (_, i) => order[i % total]).sort((a, b) => a - b);
}

/** @param {object} d  the card's data; @param {string[]} modes  its expanded Codex modes; slots: pickGreetings' answer */
export function buildMovesMessages(d, modes, { userName = '{{user}}', count = 6, slots = null } = {}) {
    const greetings = cardGreetings(d);
    const use = slots || pickGreetings(greetings.length, count);
    const shown = [...new Set(use)];
    const which = shown.length > 1 ? `, one for each of these greetings, in this order: ${use.join(', ')}.` : `, all for greeting ${shown[0] ?? 0}.`;
    const parts = [
        `Codex modes: ${modes.join(', ') || 'none'}.`,
        `CARD: ${d.name}`,
        `DESCRIPTION:\n${clipText(d.description, 5000)}`,
        d.scenario ? `SCENARIO:\n${clipText(d.scenario, 1200)}` : '',
        ...shown.map(i => `GREETING ${i}:\n${clipText(greetings[i], 2500)}`),
        `Write ${use.length} messages from ${userName}${which}`,
    ].filter(Boolean);
    return [{ role: 'system', content: MOVES_SYSTEM.replaceAll('{{user}}', userName) }, { role: 'user', content: parts.join('\n\n') }];
}

/** The moves from the model's answer, each tied to one of the test's greetings (the one in its place when the model
 *  names another); null when it can't be read. */
export function parseMoves(text, slots) {
    const j = jsonIn(text);
    if (!Array.isArray(j?.moves)) return null;
    const moves = j.moves.map(m => ({ greeting: Number.isInteger(Number(m?.greeting)) ? Number(m.greeting) : -1, text: String(m?.text || '').trim() })).filter(m => m.text);
    moves.forEach((m, i) => { if (!slots.includes(m.greeting)) m.greeting = slots[i] ?? slots[0] ?? 0; });
    return moves.length ? moves : null;
}

export const TRIAL_JUDGE_SYSTEM = 'You check one roleplay reply against the house rules and the card. Report only clear breaks of a rule: something the reply shows or says that a rule forbids. A rule the reply doesn\'t touch is not a break, and neither is style. Answer with JSON only: {"violations":[{"rule":"its id","quote":"the words that break it","why":"a few words: what went wrong"}]}, or {"violations":[]}.';

/**
 * One reply's check. cardRules: the card's own rules as the writer gets them (compiled dials), if it has any.
 */
export function buildTrialJudgeMessages({ d, modes, userName, cardRules = '', greeting, player, reply }) {
    const rules = trialRules(modes).map(r => `- ${r.id}: ${r.text.replaceAll('{{user}}', userName)}`).join('\n');
    const card = [d.description, d.personality && `Personality: ${d.personality}`, d.scenario && `Scenario: ${d.scenario}`, cardRules].filter(Boolean).join('\n\n');
    return [
        { role: 'system', content: TRIAL_JUDGE_SYSTEM },
        { role: 'user', content: `House rules for this roleplay (the player's character is ${userName}):\n${rules}\n\nThe card (${d.name}):\n${clipText(card, 7000)}\n\nThe scene so far:\n${clipText(greeting, 4000)}\n\nThe player's message:\n${player}\n\nThe reply to check:\n${reply}` },
    ];
}

/** The breaks the judge found, keeping only rules this card is checked for; null when the answer can't be read. */
export function parseTrialVerdict(text, modes) {
    const j = jsonIn(text);
    if (!Array.isArray(j?.violations)) return null;
    const ids = new Set(trialRules(modes).map(r => r.id));
    return j.violations.map(v => ({ rule: String(v?.rule || '').trim().toLowerCase(), quote: String(v?.quote || '').trim(), why: String(v?.why || '').trim() }))
        .filter(v => ids.has(v.rule) && v.quote);
}

/**
 * What a test found, rule by rule: how many replies broke it, and the quotes (with the opening they're from).
 * @param {{verdict: object[]|null}[]} openings  in order; verdict null for a reply that couldn't be checked
 */
export function summarizeTrial(openings) {
    const by = new Map();
    openings.forEach((o, i) => {
        for (const v of o.verdict || []) {
            const r = TRIAL_RULES.find(x => x.id === v.rule);
            const g = by.get(v.rule) || { rule: v.rule, label: r?.label || v.rule, replies: new Set(), quotes: [] };
            g.replies.add(i);
            g.quotes.push({ opening: i, quote: v.quote, why: v.why });
            by.set(v.rule, g);
        }
    });
    const checked = openings.filter(o => o.verdict).length;
    const findings = [...by.values()].map(g => ({ rule: g.rule, label: g.label, count: g.replies.size, quotes: g.quotes }))
        .sort((a, b) => b.count - a.count || TRIAL_RULES.findIndex(r => r.id === a.rule) - TRIAL_RULES.findIndex(r => r.id === b.rule));
    return { checked, clean: openings.filter(o => o.verdict && !o.verdict.length).length, findings };
}

export const TRIAL_FIX_SYSTEM = `You help a roleplay card's author with what a test of the card found. The test had the author's own model write the first reply after a few opening messages and checked each reply against the house rules and the card. For each finding, write a fix in one to three sentences. When something in the card invites the break (a line, a greeting that shows it, a rule the card leaves out or states loosely), quote those words and say what to write instead or add. When the card doesn't cause it and the model just does it, start with "Not the card:" and say whether a short line in the card would still help, and give that line. Every fix must itself follow the house rules: never one that has narration point out who is inside a body, and never one that writes for the player.
Answer with JSON only: {"fixes":[{"rule":"its id","fix":""}]}`;

/** used: the greetings to show (0 = the first message), those behind the breaks; numbered from 1, as the results show them. */
export function buildTrialFixMessages({ d, findings, of, cardRules = '', used = [0] }) {
    const greetings = cardGreetings(d);
    const shown = [...new Set(used)].filter(i => i >= 0 && i < greetings.length).sort((a, b) => a - b).slice(0, 6);
    const card = [
        `DESCRIPTION:\n${clipText(d.description, 7000)}`,
        d.scenario ? `SCENARIO:\n${clipText(d.scenario, 1200)}` : '',
        d.post_history_instructions ? `POST-HISTORY INSTRUCTIONS:\n${clipText(d.post_history_instructions, 2000)}` : '',
        cardRules ? `CARD RULES (settings the writer gets):\n${cardRules}` : '',
        ...shown.map(i => `GREETING ${i + 1}${i === 0 ? ' (the first message)' : ''}:\n${clipText(greetings[i], 2000)}`),
    ].filter(Boolean).join('\n\n');
    const found = findings.map(f => {
        const rule = TRIAL_RULES.find(r => r.id === f.rule);
        return `- ${f.rule} (${rule?.text || f.label}) broke in ${f.count} of ${of} replies:\n${f.quotes.slice(0, 4).map(q => `  "${clipText(q.quote, 300)}"${q.why ? ` (${q.why})` : ''}`).join('\n')}`;
    }).join('\n');
    return [{ role: 'system', content: TRIAL_FIX_SYSTEM }, { role: 'user', content: `The card "${d.name}":\n\n${card}\n\nWhat the test found:\n${found}\n\nNow answer with the JSON.` }];
}

/** Fixes by rule id; {} when the answer can't be read. */
export function parseTrialFixes(text) {
    const j = jsonIn(text);
    return Object.fromEntries((Array.isArray(j?.fixes) ? j.fixes : []).map(f => [String(f?.rule || '').trim().toLowerCase(), String(f?.fix || '').trim()]).filter(([k, v]) => k && v));
}

// ------------------------------------------------------------------ Check the greetings
// The model playing a card copies its greetings more than it follows rules: on one test card the narration pointed at the
// possession in 5 of 6 test replies until its greetings stopped doing it, and 2 of 6 after (2026-10-28). So every greeting is read
// against the house rules the test checks replies with, worded for an opening, and each break comes back with words to
// put in its place, which Check card can write into the card.

// Rules worded for an opening; the rest read as they do for a reply. Asking before using a power isn't an opening's.
const GREETING_TEXT = {
    // The wording below came from the first check of a long test card (2026-10-28): it flagged setup steps ("you scan the code"), spec
    // tags worded as flavor, and "your hair" in a body the player drives (asking for the host's name instead).
    you: 'A greeting may set where {{user}} is, what {{user}} did to get there, and what {{user}} is in the middle of as the scene opens (you scan the code, you\'re in her lap), and what {{user}} senses from there. It never decides for {{user}} from that point: no choice made in the moment with its reason, no thought or feeling {{user}} has about what\'s happening ("you keep her pace slow because both ends feel good", "you know what he\'s thinking"), and no lines of dialogue for {{user}}.',
    card: 'The greeting follows what the card says about how its power or premise works: who is aware, what a host remembers, what the power can and can\'t do, its limits. A clear contradiction of how it works is a break; a label, name or flavor detail worded differently from the card (a tag that reads SELF rather than AWARE) is not.',
    yours: 'In any body {{user}} drives, {{user}} is "you", and so are its parts (you stretch, your hair, your hips, people look at you); with several bodies, the body\'s name says which one is moving ("as Jess, you pour"). Never the body\'s name or "she"/"he" for what {{user}} does with it or for its parts. Only the host\'s belongings stay the host\'s (her phone, her lanyard); {{user}}\'s own things are "your own".',
    interrupt: 'Nothing cuts into the scene the greeting opens: a knock, a call or text, someone walking in. When the arrival is the hook the whole greeting is built on, report it anyway and say so in why: the author decides.',
};
export const greetingRules = modes => trialRules(modes).filter(r => r.id !== 'ask').map(r => ({ ...r, text: GREETING_TEXT[r.id] || r.text }));

export const GREETING_CHECK_SYSTEM = `You check one greeting of a roleplay character card: an opening message that the model playing the card reads at the start of every chat begun from it, and copies the habits of. {{user}} is the player. Report only clear breaks of the house rules: something the greeting's own words show or say that a rule forbids. Style is not a break, and neither is a rule the greeting doesn't touch. For each break, quote the exact words from the greeting, copied character for character (a sentence or a clause, short enough to swap out), and write what to put in their place: the same moment in the greeting's own voice and about the same length, following the rule, with {{user}} for the player as the card writes it. Answer with JSON only: {"breaks":[{"rule":"its id","quote":"","instead":"","why":"a few words"}]}, or {"breaks":[]}.`;

/** index: which greeting (0 = the first message). The greeting goes in as written, {{user}} and all, so quotes match it. */
export function buildGreetingCheckMessages({ d, modes, cardRules = '', index }) {
    const g = cardGreetings(d)[index] || '';
    const parts = [
        `CARD: ${d.name}`,
        `DESCRIPTION:\n${clipText(d.description, 5000)}`,
        d.scenario ? `SCENARIO:\n${clipText(d.scenario, 1200)}` : '',
        cardRules ? `CARD RULES (settings the writer gets):\n${cardRules}` : '',
        `HOUSE RULES (id: rule):\n${greetingRules(modes).map(r => `- ${r.id}: ${r.text}`).join('\n')}`,
        `GREETING ${index + 1}${index === 0 ? ' (the first message)' : ''}:\n<<<\n${g}\n>>>`,
        'Now answer with the JSON.',
    ].filter(Boolean);
    return [{ role: 'system', content: GREETING_CHECK_SYSTEM }, { role: 'user', content: parts.join('\n\n') }];
}

/**
 * Where a quoted break sits in the greeting: the exact text to swap and what goes in its place. Models drop the italics
 * marks around a quote, or the \r of a line break, so those are tried too. exact: false when it can't be found once.
 */
export function locateBreak(greeting, quote, instead) {
    const g = String(greeting || '');
    const once = s => !!s && g.split(s).length === 2;
    const nl = s => (g.includes('\r\n') ? String(s).replace(/\r?\n/g, '\r\n') : String(s));
    const edge = s => String(s).replace(/^[\s*"“”]+|[\s*"“”]+$/g, '');
    for (const [q, i] of [[quote, instead], [nl(quote), nl(instead)], [edge(nl(quote)), edge(nl(instead))]]) {
        if (once(q)) return { quote: q, instead: i, exact: true };
    }
    return { quote, instead, exact: false };
}

/** The breaks in the model's answer for one greeting; null when it can't be read. */
export function parseGreetingCheck(text, modes, greeting = '') {
    const j = jsonIn(text);
    if (!Array.isArray(j?.breaks)) return null;
    const ids = new Set(greetingRules(modes).map(r => r.id));
    return j.breaks.map(b => ({ rule: String(b?.rule || '').trim().toLowerCase(), quote: String(b?.quote || '').trim(), instead: String(b?.instead || '').trim(), why: String(b?.why || '').trim() }))
        .filter(b => ids.has(b.rule) && b.quote)
        .map(b => ({ ...b, ...locateBreak(greeting, b.quote, b.instead) }));
}

/** True when a greeting hands {{user}} a question at the end: the last thing said aloud in its last paragraph asks one. */
export function endsOnQuestion(greeting) {
    const paras = String(greeting || '').trim().split(/\r?\n\s*\r?\n/).filter(p => p.trim());
    const spoken = [...String(paras[paras.length - 1] || '').matchAll(/["“]([^"”]+)["”]/g)].map(m => m[1]);
    return spoken.length > 0 && spoken[spoken.length - 1].includes('?');
}

/**
 * What the greeting check found, rule by rule: in how many greetings, and each break with its greeting and its
 * replacement. questions: the greetings that end on a question, listed when they're at least half (and two or more):
 * the model copies how greetings end, so its replies keep handing the player a question.
 * @param {{index: number, breaks: object[]|null}[]} checks
 */
export function summarizeGreetings(checks, greetings) {
    const by = new Map();
    for (const c of checks) {
        for (const b of c.breaks || []) {
            const rule = TRIAL_RULES.find(r => r.id === b.rule);
            if (!by.has(b.rule)) by.set(b.rule, { rule: b.rule, label: rule?.label || b.rule, greetings: new Set(), items: [] });
            const g = by.get(b.rule);
            g.greetings.add(c.index);
            g.items.push({ greeting: c.index, quote: b.quote, instead: b.instead, why: b.why, exact: b.exact });
        }
    }
    const findings = [...by.values()].map(g => ({ rule: g.rule, label: g.label, count: g.greetings.size, items: g.items }))
        .sort((a, b) => b.count - a.count || TRIAL_RULES.findIndex(r => r.id === a.rule) - TRIAL_RULES.findIndex(r => r.id === b.rule));
    const asked = greetings.map((g, i) => (endsOnQuestion(g) ? i : -1)).filter(i => i >= 0);
    const checked = checks.filter(c => c.breaks).length;
    return { checked, clean: checks.filter(c => c.breaks && !c.breaks.length).length, findings, questions: asked.length >= 2 && asked.length * 2 >= greetings.length ? asked : [] };
}
