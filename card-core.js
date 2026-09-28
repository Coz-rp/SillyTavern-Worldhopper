// Worldhopper Engine — card tools. Pure functions (no SillyTavern imports).
//   Make card:   read the labelled blocks a card-builder chat produced ("--- DESCRIPTION (→ "Description") ---" …),
//                latest version of each winning, and assemble a Character Card V2 with its Codex modes.
//   Card Doctor: checks a card against how SillyTavern, the Codex and a typical preset will actually use it.

import { ALL_MODES } from './codex-core.js';

// ------------------------------------------------------------------ reading a builder chat

const LABEL = /^[\s>*_`]*-{3}\s*([^-\n].*?)\s*-{3}[\s*_`]*$/;
const SEPARATOR = /^\s*-{3,}\s*$/;
const CONTROL = /^\s*\[[^\]\n]*(?:ready|say\s+["“]?next|what to change|your move|next up)[^\]\n]*\]\s*$/i;
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
 * Pull every labelled block out of the builder's replies, oldest first, so a later version of a piece replaces an
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
    const pointer = findHit(/(borrowed (body|face|mouth|hands?|eyes)|someone else'?s (eyes|smile|voice|mouth)|(his|her|their) smile on (her|his|their) (face|mouth)|something behind (her|his|their) eyes|a smile that isn'?t (hers|his|theirs))/i, scene);
    if (pointer) {
        warn('Possession pointers in the greetings', 'The opening narration points out who is inside ("borrowed body", "his smile on her face"). The model copies the first message\'s style, so it will keep doing it. Write the habits as the body\'s own behaviour.', pointer);
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
List up to 8 concrete problems that would hurt play: contradictions with the Codex definitions or its rules, mechanics left unclear, inconsistencies between sections, greetings that break the rules, things the model is likely to get wrong. Skip anything the Codex already settles unless the card contradicts it. For each: quote the words, say what goes wrong in play, and give the fix; every fix must itself follow the Codex rules (never one that has narration point out who is inside a body). Most serious first. If the card is fine, say so in one line. A numbered list, no preamble, no closing remarks.`;

export function buildReviewMessages(d, modes, codexText) {
    const clip = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + ' …' : String(s || ''));
    const parts = [
        `Codex modes picked for this card: ${modes.join(', ') || 'none'}.`,
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
