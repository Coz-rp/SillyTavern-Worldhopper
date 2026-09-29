// Worldhopper Engine — Editor core. Pure functions (no SillyTavern imports) so the same code runs in the
// browser extension and in Node test harnesses.
//
// Pipeline: detect() flags candidate passages with rules (instant, free) → buildEditorMessages() asks a local
// model to KEEP / REWRITE / DELETE only those passages → parseEditorResponse() → applyEdits() splices the
// accepted changes into the reply. The model never sees or rewrites anything that wasn't flagged.

// Stock phrases, from the | Banned Words list (the patterns that match structurally without heavy false
// positives; verified against a sample of trap sentences).
export const BANLIST = [
    ['stock reaction', String.raw`\bbreath\s+(?:he|she|they|I|you)\s+didn'?t\s+know\b`],
    ['stock reaction', String.raw`\bbreath\s+(?:hitch|catch)(?:e[sd]|ing)?\b`],
    ['stock reaction', String.raw`\bshivers?\s+(?:ran\s+|went\s+|ran\s+straight\s+)?(?:down|up)\s+(?:his|her|their|your|my)\s+spine\b`],
    ['stock reaction', String.raw`\bsomething\s+\w+\s+in\s+(?:his|her|their|your)\s+(?:eyes|voice|expression|gaze)\b`],
    ['stock reaction', String.raw`\bcouldn'?t\s+help\s+but\b`],
    ['stock reaction', String.raw`\bdespite\s+(?:him|her|them|your)sel(?:f|ves)\b`],
    ['stock reaction', String.raw`\bwhite-knuckled?\b`],
    ['stock reaction', String.raw`\ba\s+muscle\s+(?:jump|tick|twitch|feather)(?:ing|ed|s)?\s+in\s+(?:his|her|their|your)\s+jaw\b`],
    ['stock reaction', String.raw`\bthe\s+ghost\s+of\s+a\s+(?:smile|grin|laugh)\b`],
    ['stock reaction', String.raw`\bhuffe?d?\s+a\s+laugh\b`],
    ['stock reaction', String.raw`\bcarding\s+(?:his|her|their|your)\s+fingers\b`],
    ['stock reaction', String.raw`\b(?:washed\s+over|flooded\s+through|crashed\s+through|coursed\s+through)\b`],
    ['stock reaction', String.raw`\bbefore\s+(?:he|she|they|you)\s+could\s+stop\s+(?:him|her|them|your)sel(?:f|ves)\b`],
    ['stock reaction', String.raw`\b(?:pupils\s+blown|eyes\s+blown\s+wide)\b`],
    ['stock reaction', String.raw`\bopened\s+(?:his|her|their|your)\s+mouth,?\s+(?:then\s+)?closed\s+it\b`],
    ['stock reaction', String.raw`\bsomething\s+(?:deep\s+)?inside\s+(?:him|her|them|you)\s+(?:broke|shifted|cracked|stirred)\b`],
    ['atmosphere filler', String.raw`\bthe\s+air\s+(?:was\s+thick|hung\s+heavy|grew\s+thick)\b`],
    ['atmosphere filler', String.raw`\bthe\s+silence\s+(?:stretched|settled|hung)\b`],
    ['atmosphere filler', String.raw`\bthe\s+world\s+(?:seemed\s+to|fell\s+away|narrowed)\b`],
    ['atmosphere filler', String.raw`\b(?:ozone|petrichor)\b`],
    ['atmosphere filler', String.raw`\blike\s+a\s+physical\s+(?:thing|blow|weight|touch|presence)\b`],
    ['atmosphere filler', String.raw`\bhung\s+in\s+the\s+air\b`],
    ['stock phrase', String.raw`\b(?:testament\s+to|tapestry\s+of|symphony\s+of)\b`],
    ['stock phrase', String.raw`\breckless\s+abandon\b`],
    ['stock phrase', String.raw`\bbarely\s+(?:above\s+)?a\s+whisper\b`],
    ['stock phrase', String.raw`\bseductive\s+purr\b`],
    ['stock phrase', String.raw`\bmischievous\s+glint\b`],
    ['stock phrase', String.raw`\bimpossibly\s+\w+\b`],
    ['stock phrase', String.raw`\b(?:feeling\s+(?:seen|heard)|undeniable\s+connection)\b`],
    ['stock phrase', String.raw`\bthe\s+ritual\s+of\b`],
    ['stock phrase', String.raw`\ba\s+dance\s+as\s+old\s+as\s+time\b`],
    ['stock phrase', String.raw`\b(?:for|after)\s+a\s+(?:long\s+)?beat\b|\ba\s+beat\s+(?:too\s+long|later|passes|of\s+(?:silence|hesitation))\b`],
    ['stock phrase', String.raw`\bsilent\s+invitation\b`],
    ['stock phrase', String.raw`\b(?:weaponi[sz]ed|short-circuited)\b`],
    ['Claude tell', String.raw`\b(?:filed|filing)\s+(?:that|it|this)\s+away\b`],
    ['Claude tell', String.raw`\bcatalogu?(?:ed|ing|es)?\s+(?:that|it|this|the|every|each)\b`],
    ['Claude tell', String.raw`\ba\s+kind\s+of\s+\w+\b`],
    ['Claude tell', String.raw`\bunhurried(?:ly)?\b`],
    ['Claude tell', String.raw`\b(?:load-bearing|recalibrat\w+)\b`],
];

// Contrast framing: define-by-negating-a-rival. These over-match ordinary English on purpose; the model
// decides KEEP for the innocent ones.
export const CONTRAST = [
    String.raw`\b(?:not|n't)\s+(?:just\s+|only\s+|merely\s+|simply\s+|even\s+)?[^.!?,;:"*\n]{2,50},\s+but\b`,
    String.raw`\b(?:It|That|This|He|She|They|You|I|We)\s+(?:wasn't|isn't|weren't|aren't|didn't|doesn't|don't|won't)\b[^.!?"*\n]{2,60}[.!?]\s+(?:It|That|This|He|She|They|You|I|We)\s+(?:was|is|were|are|did|does|do|will)\b`,
    String.raw`\bless\s+(?:a\s+|an\s+|the\s+)?[a-z]+(?:\s+[a-z]+)?\s+than\s+(?:a\s+|an\s+|the\s+)?[a-z]+`,
    String.raw`\bnot\s+because\b[^.!?"*\n]{2,60}\bbut\s+because\b`,
    String.raw`,\s+not\s+(?:a\s+|an\s+|the\s+|some\s+|just\s+)?[a-z]+(?:\s+[a-z]+)?[.!?]`,
    String.raw`[.!?]\s+(?:Doesn't|Didn't|Couldn't|Wouldn't|Won't|Can't|Isn't|Wasn't)\s+[a-z]+[^.!?"*\n]{0,20}[.!?]`,
];

// Referent hedges: two referents jammed into one slot in body-swap prose ("your — her — hand",
// "Alice's, really Marcus's, fingers"). Same-word repeats ("you — you idiot") are stammers and are skipped.
// Possessives dashed together ("your — her — tits") are hedges; subject pronouns only when bracketed
// ("She — he — told me"), since "She doesn't look at you — she looks away" is an ordinary dash clause.
export const HEDGES = [
    String.raw`\b(your|her|his|their|my)\s*[—–]{1,2}\s*(your|her|his|their|my)\b`,
    String.raw`\b(she|he|they)\s*[—–]{1,2}\s*(she|he|they)\s*[—–]`,
    String.raw`\b(he|she|his|her)\s*\/\s*(he|she|his|her)\b`,
    String.raw`\b([A-Z][a-z]+)'s,\s+(?:really|actually|technically|or rather)\s+([A-Z][a-z]+)'s\b`,
    String.raw`\b([A-Z][a-z]+)\s*\((?:really|actually|or rather|i\.e\.)\s+([A-Z][a-z]+)\)`,
];

/**
 * Collapse pronoun hedge chains without a model: the writer's last word is the settled referent.
 * "your — her — coffee cup" → "her coffee cup"; "She — he — told me" → "He told me". Same-word repeats
 * ("her — her —") are stammers and stay. Returns { text, applied }.
 */
export function collapseHedges(text) {
    const applied = [];
    const chain = (set, needTrailingDash) => new RegExp(
        String.raw`\b(${set})((?:\s*[—–]{1,2}\s*(?:${set}))+)` + (needTrailingDash ? String.raw`\s*[—–]{1,2}\s*` : String.raw`(?:\s*[—–]{1,2})?\s*`) + String.raw`(?=[A-Za-z])`, 'gi');
    const fix = (re) => {
        text = text.replace(re, (m, first) => {
            const words = m.match(/[A-Za-z]+/g);
            if (new Set(words.map(w => w.toLowerCase())).size === 1) return m;   // stammer
            let last = words[words.length - 1].toLowerCase();
            if (/^[A-Z]/.test(first)) last = last[0].toUpperCase() + last.slice(1);
            applied.push({ action: 'HEDGE', from: m.trim(), to: last });
            return last + ' ';
        });
    };
    fix(chain('your|her|his|their|my', false));
    fix(chain('she|he|they', true));
    return { text, applied };
}

// Narration fragments: a short verbless beat after a full sentence ("A flicker — not words. Just awareness.",
// "Her mouth pulls sideways. Something tired and fond.").
const NARRATION_OPENERS = new Set('something nothing just not no only almost barely all still again less more too somewhere anything everything'.split(' '));

// Staccato dialogue: inside a quote, a short fragment after a full stop that can't stand as its own claim
// ("I'll keep score. From a chair. A far chair.").
const FRAGMENT_OPENERS = new Set('from with in on at to for by into onto a an the just only and but or like all maybe probably never always still again even not no whatever especially mostly'.split(' '));

const BOUNDARY = /[*"“”\n<>%`]/;
const MARKUP = /[<>`]|%%/;

function sentenceAround(text, start, end) {
    // Expand [start,end) to the enclosing sentence, never crossing a formatting mark or newline.
    let s = start;
    while (s > 0) {
        const c = text[s - 1];
        if (BOUNDARY.test(c)) break;
        if (/[.!?…]/.test(c) && /\s/.test(text[s] ?? '')) break;
        s--;
    }
    let e = end;
    while (e < text.length) {
        const c = text[e];
        if (BOUNDARY.test(c)) break;
        e++;
        if (/[.!?…]/.test(c) && (e >= text.length || /[\s*"“”]/.test(text[e]))) {
            while (e < text.length && /[.!?…]/.test(text[e])) e++;
            break;
        }
    }
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    return [s, e];
}

function quotedSegments(text) {
    const out = [];
    const re = /["“]([^"“”\n]+)["”]/g;
    let m;
    while ((m = re.exec(text))) out.push([m.index + 1, m.index + 1 + m[1].length]);
    return out;
}

function staccatoCandidates(text) {
    const found = [];
    for (const [qs, qe] of quotedSegments(text)) {
        const seg = text.slice(qs, qe);
        const parts = [];
        const re = /[^.!?…]+[.!?…]+|[^.!?…]+$/g;
        let m;
        while ((m = re.exec(seg))) {
            const raw = m[0];
            const lead = raw.length - raw.trimStart().length;
            parts.push({ s: qs + m.index + lead, e: qs + m.index + raw.trimEnd().length, t: raw.trim() });
        }
        for (let i = 1; i < parts.length; i++) {
            const words = parts[i].t.replace(/[.!?…]+$/, '').split(/\s+/).filter(Boolean);
            const first = (words[0] || '').toLowerCase().replace(/[^a-z']/g, '');
            if (words.length >= 1 && words.length <= 4 && FRAGMENT_OPENERS.has(first)) {
                found.push({ start: parts[i - 1].s, end: parts[i].e, reason: 'chopped dialogue fragment' });
            }
        }
    }
    return found;
}

function sentencesIn(text, s, e) {
    const out = [];
    const seg = text.slice(s, e);
    const re = /[^.!?…]+[.!?…]+|[^.!?…]+$/g;
    let m;
    while ((m = re.exec(seg))) {
        const raw = m[0];
        const lead = raw.length - raw.trimStart().length;
        const t = raw.trim();
        if (t) out.push({ s: s + m.index + lead, e: s + m.index + lead + t.length, t });
    }
    return out;
}

function narrationFragments(text) {
    const found = [];
    const quotes = quotedSegments(text);
    const inQuote = i => quotes.some(([a, b]) => i >= a && i < b);
    const re = /[^*"“”\n]+/g;
    let m;
    while ((m = re.exec(text))) {
        if (inQuote(m.index)) continue;
        const parts = sentencesIn(text, m.index, m.index + m[0].length);
        for (let i = 1; i < parts.length; i++) {
            const words = parts[i].t.replace(/[.!?…]+$/, '').split(/\s+/).filter(Boolean);
            const first = (words[0] || '').toLowerCase().replace(/[^a-z']/g, '');
            if (words.length <= 5 && NARRATION_OPENERS.has(first) && /[.!?…]$/.test(parts[i - 1].t)) {
                found.push({ start: parts[i - 1].s, end: parts[i].e, reason: 'narration fragment' });
            }
        }
    }
    return found;
}

// Word-level n-grams shared with another text, returned as character spans in `text`.
const WORD = /[A-Za-z][A-Za-z']*/g;
function sharedPhrases(text, other, n, minContent) {
    const tw = [...text.matchAll(WORD)].map(m => ({ w: m[0].toLowerCase(), s: m.index, e: m.index + m[0].length }));
    const ow = (String(other).match(WORD) || []).map(w => w.toLowerCase());
    const keys = new Set();
    for (let i = 0; i + n <= ow.length; i++) keys.add(ow.slice(i, i + n).join(' '));
    const spans = [];
    for (let i = 0; i + n <= tw.length; i++) {
        const win = tw.slice(i, i + n);
        if (!keys.has(win.map(x => x.w).join(' '))) continue;
        if (win.filter(x => !FUNCTION_WORDS.has(x.w)).length < minContent) continue;
        const last = spans[spans.length - 1];
        if (last && win[0].s <= last.e) last.e = win[n - 1].e;
        else spans.push({ s: win[0].s, e: win[n - 1].e });
    }
    return spans.map(sp => ({ ...sp, phrase: text.slice(sp.s, sp.e) }));
}
/** Plain phrases from the player's own slop list → whole-word, whitespace-tolerant patterns. */
export function personalPatterns(list) {
    return (Array.isArray(list) ? list : String(list || '').split('\n'))
        .map(x => String(x).trim()).filter(x => x.length >= 3 && !x.startsWith('#'))
        .map(x => '\\b' + phrasePattern(x) + (/\w$/.test(x) ? '\\b' : ''));
}
const phrasePattern = p => p.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(String.raw`[\s\W]+`);

/**
 * Flag candidate passages in a reply.
 * @param {string} text
 * @param {{banlist?: boolean, contrast?: boolean, staccato?: boolean, hedges?: boolean, fragments?: boolean,
 *          echo?: boolean, repetition?: boolean, max?: number}} checks
 * @param {{userText?: string, previous?: string[]}} context  the user's last message; the last few replies
 * @returns {{start:number,end:number,text:string,reasons:string[],matches:string[],patterns:string[]}[]}
 */
export function detect(text, checks = {}, context = {}) {
    const { banlist = true, contrast = true, staccato = true, hedges = true, fragments = true, echo = true, repetition = true, personal = [], max = 8 } = checks;
    const raw = [];
    const scan = (pattern, reason, keep = null) => {
        const re = new RegExp(pattern, 'gi');
        let m;
        while ((m = re.exec(text))) {
            if (m[0].length === 0) { re.lastIndex++; continue; }
            if (keep && !keep(m)) continue;
            const [s, e] = sentenceAround(text, m.index, m.index + m[0].length);
            // Only whole sentences: a span cut short by a formatting mark would be rewritten without its end.
            // Dialogue is the exception on both sides: a tag may start lowercase right after a closing quote
            // ("…," *she says…*), and a spoken line may end on a comma right before its closing quote.
            const span = text.slice(s, e);
            const prev = text.slice(0, s).replace(/[\s*]+$/, '').slice(-1);
            const next = text.slice(e).replace(/^[\s*]+/, '').slice(0, 1);
            const okEnd = /[.!?…—–]$/.test(span) || (/,$/.test(span) && /["”]/.test(next));
            const okStart = !/^[a-z]/.test(span) || /["”]/.test(prev);
            if (e > s && okEnd && okStart) {
                raw.push({ start: s, end: e, reason, match: m[0].replace(/^[.!?,\s]+/, '').trim(), pattern });
            }
        }
    };
    if (banlist) for (const [reason, p] of BANLIST) scan(p, reason);
    for (const p of personalPatterns(personal)) scan(p, 'your slop list');
    if (contrast) for (const p of CONTRAST) scan(p, 'contrast framing');
    if (hedges) for (const p of HEDGES) scan(p, 'referent hedge', m => m[1] && m[2] && m[1].toLowerCase() !== m[2].toLowerCase());
    if (staccato) raw.push(...staccatoCandidates(text).map(c => ({ ...c, match: text.slice(c.start, c.end) })));
    if (fragments) raw.push(...narrationFragments(text).map(c => ({ ...c, match: text.slice(c.start, c.end) })));
    const phraseCandidates = (spans, reason) => {
        for (const sp of spans) {
            const [s, e] = sentenceAround(text, sp.s, sp.e);
            if (e > s) raw.push({ start: s, end: e, reason, match: sp.phrase, pattern: phrasePattern(sp.phrase) });
        }
    };
    // Echo only matters in speech: a character quoting the player's words back. In narration, reusing the
    // player's wording for their own action is just description, and rewording it helps nothing.
    if (echo && context.userText) {
        const quotes = quotedSegments(text);
        const spoken = sharedPhrases(text, context.userText, 5, 2).filter(sp => quotes.some(([a, b]) => sp.s >= a && sp.e <= b));
        phraseCandidates(spoken, 'echoes the user');
    }
    if (repetition && context.previous?.length) phraseCandidates(sharedPhrases(text, context.previous.join(' \n '), 6, 3), 'repeats an earlier reply');

    // Merge overlapping spans; combine their reasons and the phrases that tripped them.
    raw.sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [];
    for (const r of raw) {
        const last = merged[merged.length - 1];
        if (last && r.start < last.end) {
            last.end = Math.max(last.end, r.end);
            if (!last.reasons.includes(r.reason)) last.reasons.push(r.reason);
            if (r.match && !last.matches.includes(r.match)) last.matches.push(r.match);
            if (r.pattern) last.patterns.push(r.pattern);
        } else {
            merged.push({ start: r.start, end: r.end, reasons: [r.reason], matches: r.match ? [r.match] : [], patterns: r.pattern ? [r.pattern] : [] });
        }
    }
    // Never touch HTML (GM's Notebook <details>, trackers), diegetic %% blocks, code, or list/label lines.
    const lineOf = c => text.slice(text.lastIndexOf('\n', c.start - 1) + 1, (text.indexOf('\n', c.end) + 1 || text.length + 1) - 1);
    const shielded = protectedRanges(text);
    const overlaps = c => shielded.some(([a, b]) => c.start < b && c.end > a);
    return merged
        .map(c => ({ ...c, text: text.slice(c.start, c.end) }))
        .filter(c => !MARKUP.test(c.text) && !overlaps(c) && !/<\/?[a-z]|%%|`/i.test(lineOf(c))
            && !LIST_LINE.test(lineOf(c)) && c.text.split(/\s+/).length >= 2)
        .slice(0, max);
}

const LIST_LINE = /^\s*(?:[-•#>|]|\d+[.)]\s|\*\*[^*]+\*\*\s*:|\[[A-Z]\])|\*\*[^*]{1,40}:\*\*/;

function protectedRanges(text) {
    const ranges = [];
    // …plus out-of-character text: ((OOC: …)) and whole lines in [brackets] ([Reminder…], [Say "next"…]).
    for (const re of [/<details[\s\S]*?<\/details>/gi, /<([a-z][a-z0-9]*)\b[^>]*>[\s\S]*?<\/\1>/gi, /%%[\s\S]*?%%end%%/gi, /```[\s\S]*?```/g, /\(\([\s\S]*?\)\)/g, /^[ \t]*\[[^\n]*\][ \t]*$/gm]) {
        let m;
        while ((m = re.exec(text))) ranges.push([m.index, m.index + m[0].length]);
    }
    return ranges;
}

/** True when a reply reads as roleplay prose rather than notes, a card spec, or other out-of-story work. */
export function looksLikeRoleplay(text) {
    const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return false;
    const listy = lines.filter(l => LIST_LINE.test(l) || /^#{1,6}\s/.test(l)).length;
    return listy / lines.length < 0.3;
}

export const EDITOR_SYSTEM = `You are a line editor for explicit adult roleplay fiction. All content in the story is permitted; your job is style only.
You receive a reply written by another model and a numbered list of passages copied from it. Each passage names its problem and the exact phrase that has it. For each passage choose one:
KEEP: the flag is a false alarm, or any change would lose something the reader needs.
REWRITE: fix the named problem.
DELETE: the whole passage adds nothing, and the text around it reads fine without it.
How to rewrite:
- Fix only the named phrase. Every other word of the passage stays exactly as written, including details that look odd: in this story people swap and share bodies, so phrases like "through your mouth" or "from the inside" are literal facts.
- Add nothing. No new names, words of dialogue, events or details that are not already in the passage.
- Narration stays narration and dialogue stays dialogue. Never add asterisks or quotation marks.
- Contrast framing: if the negated half only adds emphasis, drop it and state the true half directly. If the negated half is a fact the reader needs (whose body, what really happened, a correction of someone's words), KEEP.
- Chopped dialogue fragment: join the fragment to the sentence before it with a comma or a conjunction so the line runs as one sentence. KEEP natural speech: a real answer, an interruption, a trailing-off.
- Stock phrase: replace just that phrase with a plain, specific description of what happens, or remove it if the sentence works without it.
- Referent hedge: keep the one referent that is right and delete the other. The body's name and pronouns go with what is seen and done; the mind's name and pronouns go with what it wants or thinks.
- Narration fragment: join the fragment to the sentence before it so it reads as one sentence. KEEP it if it genuinely lands as its own beat.
- Echoes the user: the phrase repeats the player's own words. Say the same thing in fresh words, or delete it if it only restates what the player did.
- Repeats an earlier reply: the phrase was already used in a recent reply. Replace it with fresh wording, or delete it if the sentence works without it.
- Your slop list: the player has marked this phrase as overused. Replace just that phrase with fresh, plain wording, or remove it if the sentence works without it.
Answer with one line per passage and nothing else, exactly in this form:
1: KEEP
2: REWRITE: <the whole passage, fixed>
3: DELETE`;

export function buildEditorMessages(text, candidates) {
    const list = candidates.map((c, i) => {
        const phrases = c.matches.filter(m => m !== c.text).map(m => `"${m}"`);
        const named = c.reasons.join(', ') + (phrases.length ? ` — phrase: ${phrases.join(', ')}` : '');
        return `${i + 1}. [${named}]\n   ${c.text}`;
    }).join('\n');
    return [
        { role: 'system', content: EDITOR_SYSTEM },
        { role: 'user', content: `Reply:\n<<<\n${text}\n>>>\n\nFlagged passages:\n${list}` },
    ];
}

/** @returns {{index:number, action:'KEEP'|'REWRITE'|'DELETE', text?:string}[]} */
export function parseEditorResponse(response) {
    const out = [];
    for (const line of String(response || '').split('\n')) {
        const m = line.match(/^\s*(\d+)\s*[:.)]\s*(KEEP|REWRITE|DELETE)\b\s*:?\s*(.*)$/i);
        if (!m) continue;
        const action = /** @type {any} */ (m[2].toUpperCase());
        out.push({ index: Number(m[1]) - 1, action, text: action === 'REWRITE' ? m[3].trim() : undefined });
    }
    return out;
}

function cleanRewrite(s) {
    let t = String(s || '').trim();
    t = t.replace(/^[<"“*]+|[>"”*]+$/g, '').trim();
    return t;
}

/**
 * Apply accepted decisions. Returns the new text and a log of what changed. Guards reject rewrites that are
 * empty, multi-line, much longer than the original, or carry markup.
 */
const FUNCTION_WORDS = new Set(`a an the and or but so as at by for from in into of on onto to with without up down out over under off
    is are was were be been being am do does did has have had it its it's this that these those there here then than
    he she they you i we him her them me us his hers their theirs your yours my mine our ours who whom whose which what
    not no just only still even very too also again now while when where how all any some each every both
    one ones like same own more most less least much many if because though although until since`.split(/\s+/));
const words = s => (String(s).toLowerCase().match(/[a-z']+/g) || []);

/** Why a rewrite must be refused, or null if it can be applied. */
export function rejectRewrite(fullText, c, t, banned = []) {
    if (!t) return 'empty';
    if (t === c.text) return 'unchanged';
    const count = (s, re) => (s.match(re) || []).length;
    if (/\n/.test(t) || /[<>{}]/.test(t) || count(t, /\*/g) > count(c.text, /\*/g) || count(t, /["“”]/g) > count(c.text, /["“”]/g)) return 'markup or line break';
    if (t.length > Math.max(40, c.text.length * 1.6)) return 'too long';
    for (const p of c.patterns || []) if (new RegExp(p, 'i').test(t)) return 'problem still present';
    // Never trade one tic for another: a rewrite may not bring in any banned or slop-listed phrase that
    // the original passage didn't already have ("a muscle ticks in her jaw" → "her jaw tightens").
    for (const p of banned) { const re = new RegExp(p, 'i'); if (re.test(t) && !re.test(c.text)) return 'swaps in another listed phrase'; }
    const before = words(c.text), after = words(t);
    const beforeSet = new Set(before), afterSet = new Set(after);
    // New content words allowed depend on the job: joining a fragment needs none, a contrast fix at most one,
    // a stock-phrase swap about as many as the phrase it replaces.
    const added = after.filter(w => !beforeSet.has(w) && !FUNCTION_WORDS.has(w));
    const phraseWords = words(c.matches.filter(m => m !== c.text).join(' ')).filter(w => !FUNCTION_WORDS.has(w)).length;
    const JOINS = new Set(['chopped dialogue fragment', 'narration fragment', 'referent hedge', 'contrast framing']);
    let allowed = 0;
    if (c.reasons.some(r => !JOINS.has(r))) allowed = Math.max(allowed, phraseWords + 1);
    if (c.reasons.includes('contrast framing')) allowed = Math.max(allowed, 1);
    if (added.length > allowed) return `adds content (${added.slice(0, 4).join(', ')})`;
    const problemWords = new Set(c.matches.filter(m => m !== c.text).flatMap(words));
    const keepable = before.filter(w => !problemWords.has(w) && !FUNCTION_WORDS.has(w));
    if (keepable.length >= 3 && keepable.filter(w => afterSet.has(w)).length / keepable.length < 0.6) return 'drops too much';
    const outside = fullText.slice(0, c.start) + ' ¦ ' + fullText.slice(c.end);
    const ow = words(outside);
    const shingles = new Set(ow.slice(0, -3).map((w, i) => ow.slice(i, i + 4).join(' ')));
    const inSpan = new Set(before.slice(0, -3).map((w, i) => before.slice(i, i + 4).join(' ')));
    for (let i = 0; i + 4 <= after.length; i++) {
        const g = after.slice(i, i + 4).join(' ');
        if (shingles.has(g) && !inSpan.has(g)) return 'repeats nearby text';
    }
    return null;
}

// A sentence cut off before it ends ("he went to. Then he", "she grabs your."), or a full stop run into the next word.
// A cut out of the middle of a sentence, or a rewrite the model stopped short (which then gets the original's full
// stop), leaves exactly this. Counted after the same tidying the edits get, so " ." and "." compare alike.
const DANGLING = /\b(the|a|an|to|of|with|into|onto|from|and|or|but|your|my|its|our|their)(\s*[—–]|[.!?,;:](?=\s|$|[*"”]))|[a-z][.!?][a-z]/gi;
const dangling = s => (String(s).replace(/[ \t]{2,}/g, ' ').replace(/ +([,.!?;:])/g, '$1').match(DANGLING) || []).length;

/** True when turning `before` into `after` leaves a sentence cut off that wasn't there before. */
export function leavesBroken(before, after) {
    return dangling(after) > dangling(before);
}

/** Every pattern a rewrite must not introduce: the built-in list plus the player's slop list. */
export function bannedPatterns(personal = []) {
    return [...BANLIST.map(([, p]) => p), ...personalPatterns(personal)];
}

export function applyEdits(text, candidates, decisions, banned = bannedPatterns()) {
    const applied = [];
    const rejected = [];
    const byIndex = new Map(decisions.map(d => [d.index, d]));
    const order = candidates.map((c, i) => ({ c, i })).sort((a, b) => b.c.start - a.c.start);
    let out = text;
    for (const { c, i } of order) {
        const d = byIndex.get(i);
        if (!d || d.action === 'KEEP') continue;
        if (d.action === 'REWRITE') {
            let t = cleanRewrite(d.text);
            // Keep the original's closing punctuation (the comma before a dialogue tag, a final full stop).
            const tail = c.text.match(/[.,!?…—–-]+$/)?.[0];
            if (tail && t && !/[.,!?…—–-]$/.test(t)) t += tail;
            const why = rejectRewrite(text, c, t, banned);
            if (why) { rejected.push({ from: c.text, to: t, why }); continue; }
            const next = out.slice(0, c.start) + t + out.slice(c.end);
            if (leavesBroken(out, next)) { rejected.push({ from: c.text, to: t, why: 'leaves a broken sentence' }); continue; }
            out = next;
            applied.push({ action: 'REWRITE', from: c.text, to: t, reasons: c.reasons });
        } else if (d.action === 'DELETE') {
            const next = deleteSpan(out, c.start, c.end);
            if (leavesBroken(out, next)) { rejected.push({ from: c.text, why: 'leaves a broken sentence' }); continue; }
            out = next;
            applied.push({ action: 'DELETE', from: c.text, reasons: c.reasons });
        }
    }
    out = out
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +([,.!?;:])/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^[ \t]+|[ \t]+$/gm, '');
    return { text: out, applied, rejected };
}

// Remove [s,e) with its separating whitespace and, if that empties the italic span or quote it sat in,
// remove the wrapper too. Bold (**…**) is never touched.
export function deleteSpan(text, s, e) {
    // Take the whitespace on whichever side keeps the markup tight: before the span when a closing mark (or
    // line end) follows it, otherwise after it. "*A. B.*" minus B must end "A.*", never "A. *".
    const after = text[e];
    if (after === undefined || /[*"”\n]/.test(after)) { while (s > 0 && /[ \t]/.test(text[s - 1])) s--; }
    else { while (e < text.length && /[ \t]/.test(text[e])) e++; }
    let out = text.slice(0, s) + text.slice(e);
    let l = s - 1;
    while (l >= 0 && /[ \t]/.test(out[l])) l--;
    let r = s;
    while (r < out.length && /[ \t]/.test(out[r])) r++;
    if (l < 0 || r >= out.length) return out;
    const emptiedItalic = out[l] === '*' && out[r] === '*' && out[l - 1] !== '*' && out[r + 1] !== '*';
    const emptiedQuote = (out[l] === '"' && out[r] === '"') || (out[l] === '“' && out[r] === '”');
    if (emptiedItalic || emptiedQuote) {
        out = out.slice(0, l).replace(/[ \t]+$/, '') + (out.slice(r + 1).match(/^[ \t]*\S/) && l > 0 ? ' ' : '') + out.slice(r + 1).replace(/^[ \t]+/, '');
    }
    return out;
}
