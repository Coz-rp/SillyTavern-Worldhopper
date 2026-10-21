// Worldhopper Engine for Lumiverse — what goes into the prompt, and where.
// Lumiverse hands the finished prompt to an interceptor, so the extension places its parts the way SillyTavern
// placed them in the SillyTavern Engine:
//   👁 the picked modes' rules (and the Metaphysics Core): at the end of the system prompt, before the chat;
//   📖 detail entries, the Body Ledger and the Mind Book: depth 1, just above the last message (and above any
//      preset wrapper opening it, like the Worldhopper presets' <last_message>);
//   ⛓ anchors: depth 0, right after the last message (after a closing wrapper like </last_message>, before the
//      preset's turn instructions);
//   Body History: depth 4.
// Chat history messages carry Lumiverse's __isChatHistory flag. Where a preset block sits next to an insertion point,
// the text is merged into it, so a preset that squashes its system messages still sends one message there.
import { planEntry } from '../core/codex-core.js';
import { CODEX } from '../core/codex-data.js';

const isHistory = m => !!m?.__isChatHistory;
const isSystemBlock = m => m && !isHistory(m) && m.role === 'system' && typeof m.content === 'string';

function historyIndexes(messages) {
    const out = [];
    messages.forEach((m, i) => { if (isHistory(m)) out.push(i); });
    if (out.length) return out;
    // Without the flags (an older host), everything that isn't a system message counts, minus a trailing instruction.
    messages.forEach((m, i) => { if (m.role !== 'system') out.push(i); });
    return out;
}

/** Fills in {{user}} and {{char}}: Lumiverse resolves macros before an interceptor sees the prompt. */
export function fillMacros(text, { user = 'User', char = '' } = {}) {
    return String(text).replace(/\{\{user\}\}/gi, user).replace(/\{\{char\}\}/gi, char || 'the character');
}

/**
 * The Codex parts for these modes. `scan` is the text of the latest messages, for the 📖 entries' keys; `sticky` keeps
 * a matched entry in for a few more messages, like a lorebook entry's sticky setting.
 * @returns {{ before: string[], anchors: string[], details: string[] }}
 */
export function codexParts(active, { recent = [], count = 0, sticky = new Map(), remember = true } = {}) {
    const out = { before: [], anchors: [], details: [] };
    if (!active.size) return out;
    for (const e of CODEX) {
        const plan = planEntry(e.title, active);
        if (!plan) continue;
        if (plan === 'constant') {
            if (e.position === 0) out.before.push(e.content);
            else if (e.depth === 0) out.anchors.push(e.content);
            else out.details.push(e.content);
            continue;
        }
        // keyed: in when one of its keys matches the last scanDepth messages, and for `sticky` messages after that.
        const scan = recent.slice(-(e.scanDepth || 2)).join('\n');
        const hit = e.keys.some(k => keyRegex(k)?.test(scan));
        if (hit && remember) sticky.set(e.title, count + (e.sticky || 0));
        if (hit || (sticky.get(e.title) ?? -1) >= count) out.details.push(e.content);
    }
    return out;
}

const regexCache = new Map();
function keyRegex(key) {
    if (!regexCache.has(key)) {
        let re = null;
        const m = /^\/([\s\S]+)\/([a-z]*)$/.exec(key);
        try { re = m ? new RegExp(m[1], m[2].replace(/[gy]/g, '')) : new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); } catch { re = null; }
        regexCache.set(key, re);
    }
    return regexCache.get(key);
}

// ------------------------------------------------------------------ placing text in the finished prompt

const join = parts => parts.filter(Boolean).join('\n\n');

/** At the end of the system prompt, before the chat starts. */
function addBeforeHistory(messages, text, breakdown, name) {
    if (!text) return;
    const h = historyIndexes(messages);
    const first = h.length ? h[0] : messages.length;
    const prev = messages[first - 1];
    if (isSystemBlock(prev)) messages[first - 1] = { ...prev, content: `${prev.content}\n\n${text}` };
    else { messages.splice(first, 0, { role: 'system', content: text, __wh: name }); }
}

/** Above the depth-th history message from the end (depth ≥ 1), and above any preset blocks sitting right before it. */
function addAtDepth(messages, depth, text, breakdown, name) {
    if (!text) return;
    const h = historyIndexes(messages);
    if (!h.length) return addBeforeHistory(messages, text, breakdown, name);
    const k = Math.max(0, h.length - depth);
    let at = h[k];
    const floor = k > 0 ? h[k - 1] + 1 : at;   // never past the previous history message, or into the system prompt
    while (at > floor && isSystemBlock(messages[at - 1])) at--;
    if (isSystemBlock(messages[at])) messages[at] = { ...messages[at], content: `${text}\n\n${messages[at].content}` };
    else { messages.splice(at, 0, { role: 'system', content: text, __wh: name }); }
}

/** Right after the last history message: after a closing wrapper (</last_message>) if a preset block opens with one. */
function addAfterLast(messages, text, breakdown, name) {
    if (!text) return;
    const h = historyIndexes(messages);
    if (!h.length) return addBeforeHistory(messages, text, breakdown, name);
    const at = h[h.length - 1] + 1;
    const next = messages[at];
    if (isSystemBlock(next)) {
        const close = /^(?:\s*<\/[\w:-]+>[ \t]*(?:\r?\n|$))+/.exec(next.content);
        const head = close ? close[0].replace(/\s+$/, '') : '';
        const rest = close ? next.content.slice(close[0].length).replace(/^\s+/, '') : next.content;
        messages[at] = { ...next, content: join([head, text, rest]) };
    } else {
        messages.splice(at, 0, { role: 'system', content: text, __wh: name });
    }
}

/**
 * Puts the parts into the finished prompt. parts: { codex, details, ledger, mind, history, anchors } (strings; empty
 * ones are skipped). A continue writes on from the last message, so nothing goes after it: the anchors join depth 1.
 * Returns the breakdown entries for parts that went in as messages of their own.
 */
export function place(messages, parts, { continuing = false } = {}) {
    const breakdown = [];
    // Deepest first, so the depths above still count from the end of the unchanged chat.
    addAtDepth(messages, 4, parts.history, breakdown, 'Worldhopper: Body History');
    addAtDepth(messages, 1, join([parts.ledger, parts.mind, parts.details, continuing ? parts.anchors : '']), breakdown, 'Worldhopper: Ledger, Mind Book, details');
    if (!continuing) addAfterLast(messages, parts.anchors, breakdown, 'Worldhopper: anchors');
    addBeforeHistory(messages, parts.codex, breakdown, 'Worldhopper: Codex');
    // Parts that went in as messages of their own carry a tag until here, for Lumiverse's prompt breakdown.
    messages.forEach((m, i) => { if (m.__wh) { breakdown.push({ messageIndex: i, name: m.__wh }); delete m.__wh; } });
    return breakdown;
}
