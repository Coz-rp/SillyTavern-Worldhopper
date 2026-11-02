// Worldhopper Engine — text helpers the Ledger's checks share. Pure functions, no SillyTavern imports.
// (The WH Editor, a separate extension, keeps its own copies in its editor-core.js.)

const LIST_LINE = /^\s*(?:[-•#>|]|\d+[.)]\s|\*\*[^*]+\*\*\s*:|\[[A-Z]\])|\*\*[^*]{1,40}:\*\*/;
// Lines that are neither prose nor notes: a horizontal rule, and the Worldhopper presets' scene anchor
// ("## **[📍 place · 🕰️ time …]**"). Counted as list lines, they made a short reply under an anchor read as notes.
const NEUTRAL_LINE = /^(?:[-*_]\s*){3,}$|^#{0,4}\s*\**\s*\[?\s*📍/u;

/** True when a reply reads as roleplay prose rather than notes, a card spec, or other out-of-story work. */
export function looksLikeRoleplay(text) {
    const lines = String(text).split('\n').map(l => l.trim()).filter(l => l && !NEUTRAL_LINE.test(l));
    if (!lines.length) return false;
    const listy = lines.filter(l => LIST_LINE.test(l) || /^#{1,6}\s/.test(l)).length;
    return listy / lines.length < 0.3;
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

// A word a cut text shouldn't end on ("…with a false memory of").
const HANGING = /\s+(?:a|an|the|of|to|with|and|or|but|in|on|at|for|from|by|as|into|onto|her|his|their|its|your|my|our|that|who|which|while|when|than|so)$/i;

/**
 * A descriptive field (a Ledger note, a power, where someone is, what they have on) kept within `max` characters
 * without cutting a word or leaving a thought hanging. Past the limit it ends at the last full sentence in the back
 * half, else the last clause (";", ",", " — ", " ("), and reads whole; failing both, at the last word, with "…" so it
 * shows it was shortened. Text an older version chopped at exactly an old limit (`legacy`: a length, or several) is
 * trimmed back the same way, so "…a warm heavy feeling, arms getting hea" reads "…a warm heavy feeling".
 */
export function fitText(v, max, legacy = 0) {
    let s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000);
    const old = [legacy].flat().filter(n => n > 0);
    // An older cut at the last space, just under an old limit, could end on "…a false memory of".
    if (s.length <= max && HANGING.test(s) && old.some(n => s.length < n && s.length >= n * 0.85)) {
        while (HANGING.test(s)) s = s.replace(HANGING, '');
        return `${s}…`;
    }
    if (s.length <= max && !old.includes(s.length)) return s;
    s = s.slice(0, Math.min(s.length, max));
    const sentence = Math.max(s.lastIndexOf('. '), s.lastIndexOf('! '), s.lastIndexOf('? '));
    if (sentence >= s.length * 0.5) return s.slice(0, sentence + 1);
    const clause = Math.max(s.lastIndexOf('; '), s.lastIndexOf(', '), s.lastIndexOf(' — '), s.lastIndexOf(' ('));
    if (clause >= s.length * 0.5) return s.slice(0, clause).replace(/[\s,;:(—-]+$/, '');
    let out = s.slice(0, s.lastIndexOf(' ') > 0 ? s.lastIndexOf(' ') : s.length);
    while (HANGING.test(out)) out = out.replace(HANGING, '');
    return `${out.replace(/[\s,;:(—-]+$/, '')}…`;
}

/**
 * Whether a model's answer stopped before it was done: nothing at all (a model that thinks first can spend the whole
 * limit on hidden reasoning), a JSON object that never closes, or a <think> block that never ends. Only then is asking
 * again with more room worth it. An answer that ended but can't be read, story text where the JSON should be (what a
 * small local model writes once its instructions have fallen out of its context), only comes back longer, and asking
 * again with more room pushed even more of the prompt out: the "endless" update loop people saw on local models.
 */
export function cutShort(answer) {
    const t = String(answer ?? '').trim();
    if (!t) return true;
    if (/<think>(?![\s\S]*<\/think>)/i.test(t)) return true;
    const open = t.indexOf('{');
    if (open < 0) return false;
    let depth = 0, inString = false, escaped = false;
    for (let i = open; i < t.length; i++) {
        const ch = t[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
        } else if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return false;
    }
    return true;
}

const GAP = '\n[…]\n';
/** The text with its middle taken out, `keep` characters left, cut at line breaks (or spaces) where it can be. */
function middleCut(text, keep) {
    let head = Math.floor(keep * 0.4);
    let tail = text.length - (keep - head);
    const nl = text.lastIndexOf('\n', head);
    head = nl > head - 400 && nl > 0 ? nl : Math.max(text.lastIndexOf(' ', head), 0) || head;
    const nl2 = text.indexOf('\n', tail);
    tail = nl2 >= 0 && nl2 < tail + 400 ? nl2 + 1 : (text.indexOf(' ', tail) + 1) || tail;
    return tail > head ? text.slice(0, head) + GAP + text.slice(tail) : text;
}

/**
 * Messages that fit a model's context with room for its answer. A local server handed more than its context holds cuts
 * the prompt from the front, instructions first, and the model, left with the tail end of a story, carries on writing
 * it as if nothing came before. So the answer's room is capped at a quarter of the context, and while the prompt is
 * still too long the middle of the longest message after the instructions is cut out ("[…]"), keeping its start (the
 * notes being updated) and its end (the newest messages and the question). Tokens are guessed from characters, on the
 * safe side. → { messages, maxTokens, fits }: fits is false when even the instructions don't.
 */
export function fitToContext(messages, maxTokens, context, { charsPerToken = 3.2, overhead = 100 } = {}) {
    if (!(context > 0)) return { messages, maxTokens, fits: true };
    const max = Math.min(maxTokens, Math.max(256, Math.floor(context / 4)));
    const room = Math.floor((context - max - overhead) * charsPerToken);
    const size = ms => ms.reduce((n, m) => n + String(m.content ?? '').length, 0);
    const out = messages.map(m => ({ ...m }));
    let over = size(out) - room;
    while (over > 0) {
        let i = -1;
        out.forEach((m, j) => { if (m.role !== 'system' && typeof m.content === 'string' && (i < 0 || m.content.length > out[i].content.length)) i = j; });
        if (i < 0 || out[i].content.length <= 800) break;
        const before = out[i].content.length;
        out[i].content = middleCut(out[i].content, Math.max(600, before - over - GAP.length));
        if (out[i].content.length >= before) break;
        over = size(out) - room;
    }
    return { messages: out, maxTokens: max, fits: over <= 0 };
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
