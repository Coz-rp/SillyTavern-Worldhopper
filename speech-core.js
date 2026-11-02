// Worldhopper Engine — who says or does each part of a reply, for Stage mode's chat: narration stays on the page, and
// a paragraph with someone's words in it, or one that opens with someone doing something, becomes theirs, shown with
// their picture and name instead of the card's. Read from the prose itself (the writer is never asked for a format):
// the name beside the words ("Jen looks up. "Find them?"", ""Black, right?" Jen asks"), the name a paragraph opens on
// ("Jen wipes the counter."), else for a bare "she" the one just before or the one person it can be. When it can't
// tell, the paragraph stays narration: a wrong face is worse than none. Pure, so the tests can load it.

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lc = s => String(s ?? '').trim().toLowerCase();
const PRONOUN = /^(?:\s|[*_—–-])*(he|she|they|you|i|we)\b/i;
const SPEECH_TAG = /\b(he|she|they|you|i|we)\s+(?:\w+ly\s+)?(?:says?|said|asks?|asked|adds?|added|whispers?|whispered|murmurs?|murmured|mutters?|muttered|calls?|called|replies|replied|answers?|answered|tells?|told|laughs?|laughed|sighs?|sighed|snaps?|snapped|breathes?|breathed|offers?|offered|tries|tried|goes on|went on|continues?|continued)\b/i;

/** "she/her" → "she"; '' when nothing is known. */
const pronounOf = p => {
    const m = /\b(he|she|they|it)\b/i.exec(String(p || ''));
    return m ? m[1].toLowerCase() : '';
};
/** Whether someone could be the "she" in "she says": yes when their pronouns aren't known. */
const fits = (person, word) => !word || !person.pronoun || person.pronoun === word || word === 'they';

/** Where each name turns up in some text: [{ who, at, end }], earliest first. Names match as written (capitalized). */
function mentions(text, cast) {
    const out = [];
    for (const person of cast) {
        for (const n of person.names) {
            const re = new RegExp(`(?<![\\p{L}\\p{N}])${escRe(n)}(?![\\p{L}\\p{N}])`, 'gu');
            let m;
            while ((m = re.exec(text))) out.push({ who: person, at: m.index, end: m.index + m[0].length });
        }
    }
    return out.sort((a, b) => a.at - b.at || b.end - a.end);
}

// "at Jen's desk", "toward Marcus": a name after these isn't who the sentence is about.
const NOT_SUBJECT = /(?:\b(?:at|in|to|from|with|for|of|by|behind|near|toward|towards|into|onto|over|under|beside|past|around|across|through|than|like|and|the|a|an)\s+)$/i;
/** Who a paragraph opens on: the first name in its first sentence that the sentence is about (not "Jen's", not "at Jen"). */
function opener(text, people) {
    const first = text.slice(0, (/[.!?…](?:\s|$)/.exec(text)?.index ?? text.length) + 1);
    return mentions(first, people).find(m => m.at <= 48 && !/^['’]s\b/.test(first.slice(m.end)) && !NOT_SUBJECT.test(first.slice(0, m.at))) || null;
}

/** The last sentence of some text (what leads straight into the words). */
const lastSentence = s => {
    const t = s.replace(/\s+$/, '');
    const cut = Math.max(t.lastIndexOf('. '), t.lastIndexOf('! '), t.lastIndexOf('? '), t.lastIndexOf('\n'));
    return cut >= 0 ? { text: t.slice(cut + 2), from: cut + 2 } : { text: t, from: 0 };
};

/**
 * The speaker of each paragraph.
 * @param {{ text: string, quotes: [number, number][] }[]} paras  each paragraph's plain text and where its words are
 * @param {object} o
 *   cast: [{ name, aka?: string[], pronouns?: string }] everyone the story knows, by the name to show;
 *   mine: the player's name and the bodies the player drives (their words are the player's, never a reply's);
 *   scene: names of the people in the scene, for a bare "she says" with nobody named;
 *   carry: who spoke last before this reply.
 * @returns {{ who: string|null, sure: boolean, kind: 'say'|'act'|null }[]} for each paragraph, whose it is (a name as
 *   in cast) and whether they say something in it or only do something, or null for narration; sure is false when
 *   it came from a pronoun rather than a name.
 */
export function speakers(paras, { cast = [], mine = [], scene = [], carry = '' } = {}) {
    const people = cast.filter(c => c?.name).map(c => ({
        name: c.name, pronoun: pronounOf(c.pronouns),
        names: [...new Set([c.name, ...(c.aka || []), String(c.name).split(/\s+/)[0]].map(s => String(s || '').trim()).filter(s => s.length > 1))],
    }));
    const byName = new Map(people.map(p => [lc(p.name), p]));
    const theirs = new Set(mine.map(lc));
    const here = scene.map(n => byName.get(lc(n))).filter(Boolean);
    let lastSpeaker = byName.get(lc(carry)) || null;   // who said the line before, in this reply or the one before
    let lastNamed = null;                               // who the narration last named (not the player)
    let speechBefore = false;                           // the paragraph before this one was speech
    const out = [];

    for (const p of paras) {
        const text = String(p.text || '');
        const quotes = (p.quotes || []).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
        // Narration: the text with the words taken out, the stretch before the first words and the one after them.
        const before = quotes.length ? text.slice(0, quotes[0][0]) : text;
        const after = quotes.length ? text.slice(quotes[0][1], quotes[1]?.[0] ?? text.length) : '';
        const outside = quotes.reduce((acc, [a, b], i) => acc + text.slice(i ? quotes[i - 1][1] : 0, a), '') + (quotes.length ? text.slice(quotes.at(-1)[1]) : '');
        const named = mentions(outside, people).filter(m => !theirs.has(lc(m.who.name)));
        if (!quotes.length) {
            // Someone doing something: the paragraph opens on them, by name or as "she" right after them.
            const open = opener(text, people);
            const pron = (PRONOUN.exec(text) || [])[1]?.toLowerCase() || '';
            let who = null, sure = true;
            if (open) who = open.who;
            else if (pron === 'he' || pron === 'she' || pron === 'they') {
                sure = false;
                const prev = lastSpeaker && speechBefore ? lastSpeaker : lastNamed;
                if (prev && fits(prev, pron)) who = prev;
                else {
                    const can = here.filter(c => !theirs.has(lc(c.name)) && fits(c, pron));
                    if (can.length === 1) who = can[0];
                }
            }
            if (who && theirs.has(lc(who.name))) who = null;
            if (named.length) lastNamed = named.at(-1).who;
            if (who) { lastSpeaker = who; lastNamed = who; }
            speechBefore = !!who;
            out.push({ who: who ? who.name : null, sure: !!who && sure, kind: who ? 'act' : null });
            continue;
        }
        let who = null, sure = true;
        // 1. A speech tag right after the words: ""Black, right?" Jen asks."
        const tagAfter = mentions(after.slice(0, 48), people)[0];
        // 2. The one who leads into the words: "Jen finally looks up from the register. "Find them?""
        const lead = lastSentence(before);
        const leadNamed = mentions(lead.text, people)[0];
        const pron = (SPEECH_TAG.exec(after.slice(0, 40)) || PRONOUN.exec(lead.text) || [])[1]?.toLowerCase() || '';
        if (pron === 'you' || pron === 'i' || pron === 'we') { who = null; }
        else if (tagAfter && !theirs.has(lc(tagAfter.who.name))) who = tagAfter.who;
        else if (leadNamed && !theirs.has(lc(leadNamed.who.name)) && fits(leadNamed.who, pron)) who = leadNamed.who;
        else if (named.length && !pron) who = named.at(-1).who;
        // "Marcus hands Dana the cup. "Thanks," she says.": the one named here that the "she" fits.
        else if (named.some(m => fits(m.who, pron) && m.who.pronoun)) who = named.filter(m => fits(m.who, pron) && m.who.pronoun).at(-1).who;
        else {
            // 3. Nobody named: the speaker just before if the talk goes on, else whoever the narration last named,
            //    else the one person in the scene it can be.
            sure = false;
            if (speechBefore && lastSpeaker && fits(lastSpeaker, pron)) who = lastSpeaker;
            else if (lastNamed && fits(lastNamed, pron)) who = lastNamed;
            else {
                const can = here.filter(c => !theirs.has(lc(c.name)) && fits(c, pron));
                if (can.length === 1) who = can[0];
                else if (lastSpeaker && fits(lastSpeaker, pron) && can.includes(lastSpeaker)) who = lastSpeaker;
            }
        }
        if (who && theirs.has(lc(who.name))) who = null;
        if (named.length) lastNamed = named.at(-1).who;
        if (who) { lastSpeaker = who; lastNamed = who; }
        speechBefore = !!who;
        out.push({ who: who ? who.name : null, sure: !!who && sure, kind: who ? 'say' : null });
    }
    return out;
}

/**
 * Pronouns a card gives its people, as cards write them: "Kayla Reyes (she/her), 24, barista" → { kayla: 'she/her',
 * 'kayla reyes': 'she/her' }.
 */
export function cardPronouns(text) {
    const out = {};
    const re = /(?<![\p{L}])(\p{Lu}[\p{L}'’-]+)((?:\s+\p{Lu}[\p{L}'’-]+)?)\s*\((she\/her|he\/him|they\/them|she\/they|he\/they)[^)]*\)/gu;
    let m;
    while ((m = re.exec(String(text || '')))) {
        const first = m[1].toLowerCase();
        out[first] ??= m[3].toLowerCase();
        if (m[2]) out[`${first} ${m[2].trim().toLowerCase()}`] ??= m[3].toLowerCase();
    }
    return out;
}

/**
 * A paragraph's plain text and where its words are, from the quotes in it: "…" and “…” (SillyTavern shows these as
 * <q>, which a caller with the page can pass in as ranges instead).
 */
export function quoteRanges(text) {
    const out = [];
    const re = /"[^"\n]+"|“[^”\n]+”/g;
    let m;
    while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
    return out;
}
