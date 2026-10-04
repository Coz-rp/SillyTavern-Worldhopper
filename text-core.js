// Worldhopper Engine — text helpers the Ledger's checks share. Pure functions, no SillyTavern imports.
// (The WH Editor, a separate extension, keeps its own copies in its editor-core.js.)

const LIST_LINE = /^\s*(?:[-•#>|]|\d+[.)]\s|\*\*[^*]+\*\*\s*:|\[[A-Z]\])|\*\*[^*]{1,40}:\*\*/;

/** True when a reply reads as roleplay prose rather than notes, a card spec, or other out-of-story work. */
export function looksLikeRoleplay(text) {
    const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
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
