// Worldhopper Engine — who says each part of a reply, for Stage mode's chat: narration stays on the page, and a
// paragraph with someone's words in it becomes theirs, shown with their picture and name instead of the card's. Someone
// only doing something stays narration (giving those paragraphs faces put a bubble on nearly every line of a one-on-one
// chat). Read from the prose itself (the writer is never asked for a format): the name beside the words ("Jen looks up.
// "Find them?"", ""Black, right?" Jen asks"), else for a bare "she" the one just before, the one the narration is
// about, or the one person it can be. The player's own lines are read like anyone's, so "Kayla says" is never handed to
// whoever spoke before, and then left on the page. When it can't tell, the paragraph stays narration: a wrong face is
// worse than none. Pure, so the tests can load it.

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lc = s => String(s ?? '').trim().toLowerCase();
const PRONOUN = /^(?:\s|[*_—–-])*(he|she|they|you|i|we)\b/i;
const SPEECH_TAG = /\b(he|she|they|you|i|we)\s+(?:\w+ly\s+)?(?:says?|said|asks?|asked|adds?|added|whispers?|whispered|murmurs?|murmured|mutters?|muttered|calls?|called|replies|replied|answers?|answered|tells?|told|laughs?|laughed|sighs?|sighed|snaps?|snapped|breathes?|breathed|offers?|offered|tries|tried|goes on|went on|continues?|continued)\b/i;
// A pronoun and a verb straight after the words is their tag, whatever the verb (""Worth it," he gasps").
// ("He's already pulling the laptop closer" counts too.)
const TAG_RIGHT_AFTER = /^\s*[,.!?…—–-]*\s*(he|she|they|you|i|we)\b(?:['’]\w+)?\s+(?:\w+ly\s+)?[a-z]+/i;

/** "she/her" → "she"; '' when nothing is known. */
const pronounOf = p => {
    const m = /\b(he|she|they|it)\b/i.exec(String(p || ''));
    return m ? m[1].toLowerCase() : '';
};
/** Whether someone could be the "she" in "she says": yes when their pronouns aren't known. */
const fits = (person, word) => !word || !person.pronoun || person.pronoun === word || word === 'they';
/** Whether the "she" in "she says" can only be them: their pronouns are known and match. */
const strong = (person, word) => !!word && person.pronoun === word;

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
 *   cast: [{ name, aka?: string[], pronouns?: string }] everyone the story knows, by the name to show (the player too,
 *     so their lines are known for theirs);
 *   mine: the player's name, unless someone else drives the player's body, and the bodies the player drives (their
 *     words are the player's, never a reply's);
 *   scene: names of the people in the scene, for a bare "she says" with nobody named;
 *   carry: who spoke last before this reply.
 * @returns {{ who: string|null, by: string|null, sure: boolean, kind: 'say'|null }[]} for each paragraph, whose line it
 *   is (a name as in cast), or null for narration and for the player's own lines; by: who spoke, the player included
 *   (for carry); sure is false when it came from a pronoun rather than a name.
 */
export function speakers(paras, { cast = [], mine = [], scene = [], carry = '' } = {}) {
    const people = cast.filter(c => c?.name).map(c => ({
        name: c.name, pronoun: pronounOf(c.pronouns),
        names: [...new Set([c.name, ...(c.aka || []), String(c.name).split(/\s+/)[0]].map(s => String(s || '').trim()).filter(s => s.length > 1))],
    }));
    const byName = new Map(people.map(p => [lc(p.name), p]));
    const theirs = new Set(mine.map(lc));
    const isMine = p => !!p && theirs.has(lc(p.name));
    const here = scene.map(n => byName.get(lc(n))).filter(Boolean);
    let lastSpeaker = byName.get(lc(carry)) || null;   // who said the line before, in this reply or the one before
    let otherSpeaker = null;                            // who spoke before them: the other side of a back-and-forth
    let lastNamed = null;                               // who the narration is about
    let speechBefore = false;                           // the paragraph before this one was speech
    const out = [];

    for (const p of paras) {
        const text = String(p.text || '');
        const quotes = (p.quotes || []).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
        // Narration: the text with the words taken out, the stretch before the first words and the one after them.
        const before = quotes.length ? text.slice(0, quotes[0][0]) : text;
        const after = quotes.length ? text.slice(quotes[0][1], quotes[1]?.[0] ?? text.length) : '';
        const outside = quotes.reduce((acc, [a, b], i) => acc + text.slice(i ? quotes[i - 1][1] : 0, a), '') + (quotes.length ? text.slice(quotes.at(-1)[1]) : '');
        const named = mentions(outside, people);
        if (!quotes.length) {
            // Someone only doing something: narration, but it's who a "she says" after it means. The one the paragraph
            // opens on, by name or as a "she" carrying on from just before.
            const open = opener(text, people);
            const pron = (PRONOUN.exec(text) || [])[1]?.toLowerCase() || '';
            let subject = open?.who || null;
            if (!subject && (pron === 'he' || pron === 'she' || pron === 'they')) {
                const prev = lastSpeaker && speechBefore ? lastSpeaker : lastNamed;
                if (prev && fits(prev, pron)) subject = prev;
            }
            // Words right after a paragraph are most often from the one its last sentence is about ("Kayla sits up…
            // Marcus stays on his side and starts laughing." then "Oh my God, it worked."): that one, by name or as the
            // last one named that its "he" fits, else the one it opened on.
            const end = lastSentence(text).text;
            const endPron = (PRONOUN.exec(end) || [])[1]?.toLowerCase() || '';
            const endOn = (lastSentence(text).from > 0 ? opener(end, people)?.who : null)
                || (endPron && [...named].reverse().find(m => m.who.pronoun && fits(m.who, endPron))?.who) || null;
            lastNamed = endOn || subject || named.at(-1)?.who || lastNamed;
            speechBefore = false;
            out.push({ who: null, by: null, sure: false, kind: null });
            continue;
        }
        let who = null, sure = true;
        // 1. A speech tag right after the words: ""Black, right?" Jen asks."
        const tagAfter = mentions(after.slice(0, 48), people)[0];
        // 2. The one who leads into the words: "Jen finally looks up from the register. "Find them?""
        const lead = lastSentence(before);
        const leadNamed = mentions(lead.text, people)[0];
        const pron = (TAG_RIGHT_AFTER.exec(after) || SPEECH_TAG.exec(after.slice(0, 40)) || PRONOUN.exec(lead.text) || [])[1]?.toLowerCase() || '';
        if (pron === 'you' || pron === 'i' || pron === 'we') { who = null; }
        else if (tagAfter) who = tagAfter.who;
        else if (leadNamed && fits(leadNamed.who, pron)) who = leadNamed.who;
        else if (named.length && !pron) who = named.at(-1).who;
        // "Marcus hands Dana the cup. "Thanks," she says.": the one named here that the "she" fits.
        else if (named.some(m => fits(m.who, pron) && m.who.pronoun)) who = named.filter(m => fits(m.who, pron) && m.who.pronoun).at(-1).who;
        else {
            // 3. Nobody named: the speaker just before if the talk goes on, else whoever the narration is about, else
            //    the one person in the scene it can be (never the player: a reply doesn't write their lines).
            sure = false;
            // Someone whose pronouns nobody knows fits any "she", but so does the other side of the talk, whose are
            // known (Marcus, with none known, spoke, then ""Oh." She settles back." from Kayla): no telling which, so narration.
            const loose = c => !!c && !!pron && !c.pronoun && speechBefore && otherSpeaker && otherSpeaker !== c && strong(otherSpeaker, pron);
            if (speechBefore && lastSpeaker && fits(lastSpeaker, pron)) who = loose(lastSpeaker) ? null : lastSpeaker;
            else if (lastNamed && fits(lastNamed, pron)) who = loose(lastNamed) ? null : lastNamed;
            // Her line, then "he says": the one she was talking with, when only he can be the "he".
            else if (speechBefore && otherSpeaker && strong(otherSpeaker, pron)) who = otherSpeaker;
            else {
                const can = here.filter(c => !isMine(c) && fits(c, pron));
                if (can.length === 1) who = can[0];
                else if (lastSpeaker && fits(lastSpeaker, pron) && can.includes(lastSpeaker)) who = lastSpeaker;
            }
        }
        if (named.length) lastNamed = named.at(-1).who;
        if (who) {
            if (who !== lastSpeaker) otherSpeaker = lastSpeaker;
            lastSpeaker = who;
            lastNamed = who;
        }
        speechBefore = !!who;
        // The player's words stay on the page, but they're still who spoke.
        const shown = who && !isMine(who) ? who : null;
        out.push({ who: shown ? shown.name : null, by: who ? who.name : null, sure: !!shown && sure, kind: shown ? 'say' : null });
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
 * Pronouns the prose gives people their cards and notes don't. A paragraph that names one person and has someone's
 * words in it is theirs, and a sentence in it that opens on "He" or "She" (outside the words) is most often them:
 * ""…they'd charge extra" Kayla trails off. She's staring at the screen." Counted over the replies, kept only when
 * clear, since someone with no pronouns fits any "she says" and could take a line that isn't theirs.
 * texts: replies' text; names: the cast's names. → { [lowercase name]: 'he'|'she' }.
 */
export function prosePronouns(texts, names) {
    // Names only ("the man" in the World notes is no one's name).
    const people = names.filter(n => /^\p{Lu}/u.test(String(n || '').trim()) && String(n).trim().length > 1)
        .map(n => ({ name: n, names: [...new Set([n, String(n).split(/\s+/)[0]])].filter(s => s.length > 1) }));
    const votes = new Map();
    for (const t of texts) {
        for (const para of String(t || '').replace(/[*_]/g, '').split(/\n\s*\n|\n/)) {
            const quotes = quoteRanges(para);
            if (!quotes.length) continue;
            const outside = quotes.reduce((acc, [a, b], i) => acc + para.slice(i ? quotes[i - 1][1] : 0, a) + ' … ', '') + para.slice(quotes.at(-1)[1]);
            const named = [...new Set(mentions(outside, people).map(m => m.who))];
            if (named.length !== 1) continue;
            for (const m of outside.matchAll(/(?:^|[.!?…]\s+)(He|She)\b/g)) {
                const k = named[0].name.toLowerCase();
                const v = votes.get(k) || { he: 0, she: 0 };
                v[m[1].toLowerCase()]++;
                votes.set(k, v);
            }
        }
    }
    const out = {};
    for (const [k, v] of votes) {
        const [top, other] = v.he >= v.she ? ['he', 'she'] : ['she', 'he'];
        if (v[top] >= 2 && v[top] >= 3 * v[other]) out[k] = top;
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
