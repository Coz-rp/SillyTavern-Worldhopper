// Worldhopper Engine — Mind Book core. Pure functions (no SillyTavern imports), so the same code runs in the
// browser extension and in Node tests and evals.
//
// The Mind Book keeps what the mind-changing modes have put into people, with one record per mode so they never mix:
//   hypnosis    per subject: who did it, susceptibility, times under, deepest stage, stage now, the suggestions (each
//               with the stage it went in at), triggers, amnesia. Realistic pacing: what a trance allows depends on
//               how deep it is, and depth is earned over sessions.
//   control     per will: who it's on (one person or several), the controller, what was set (the update answers with
//               the whole current will, so a newer setting simply replaces an older one), what is still their own.
//   perception  per edit: what it is, its kind (unseen / normal / false), who has it (names, or everyone but…).
// Bodies never appear here; who is in which body is the Ledger's.
//
// Each mode's record is updated by its own small prompt, and only on replies that need it (a marked moment, someone
// still in trance, or the mode's words in the new messages), so most turns cost nothing. Watchers add a line for the
// reply about to be written without asking any model: a trigger word just spoken, a controlled person in the scene,
// someone who can't perceive a person who is right there.

export const MIND_MODES = { hypnosis: 'Hypnosis', control: 'Mind Control', perception: 'Altered Perception' };
export const KINDS = /** @type {const} */ (['hypnosis', 'control', 'perception']);
export const STAGES = ['awake', 'light', 'medium', 'deep', 'somnambulistic'];
export const WILL_KINDS = ['wants', 'feels', 'believes', 'loyal to', 'command'];
export const EDIT_KINDS = ['unseen', 'normal', 'false'];
export const EMPTY_BOOK = Object.freeze({ hypnosis: [], control: [], perception: [] });

const str = (v, n = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const listOf = v => Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
const names = v => listOf(v).flatMap(x => String(x ?? '').split(/\s*,\s*|\s+and\s+|\s*&\s*/)).map(x => str(x, 60)).filter(Boolean);
const yes = v => /^\s*(y|true)/i.test(String(v ?? ''));
const no = v => /^\s*(n|false)/i.test(String(v ?? ''));
const canon = s => str(s).toLowerCase();
const same = (a, b) => !!a && canon(a) === canon(b);
const rank = s => STAGES.indexOf(s);

/** "medium trance" → medium; "under", "trance" with no depth → ''. */
export function stageOf(v) {
    const s = canon(v);
    if (!s) return '';
    if (/somnam/.test(s)) return 'somnambulistic';
    return STAGES.find(x => s.startsWith(x)) || (/^(woke|wakes|out of|not under|none)/.test(s) ? 'awake' : '');
}

// ------------------------------------------------------------------ the record

function normSubject(h) {
    const deepest = stageOf(h?.deepest);
    return {
        who: str(h?.who, 60),
        by: str(h?.by, 60),
        susceptibility: ['low', 'average', 'high'].find(x => canon(h?.susceptibility).startsWith(x)) || '',
        times: Math.max(0, Math.min(999, parseInt(h?.times, 10) || 0)),
        deepest: deepest === 'awake' ? '' : deepest,
        now: stageOf(h?.now) || 'awake',
        suggestions: listOf(h?.suggestions).map(x => {
            const stage = stageOf(x?.stage);
            return { text: str(typeof x === 'string' ? x : x?.text, 220), stage: stage === 'awake' ? '' : stage, times: Math.max(1, parseInt(x?.times, 10) || 1) };
        }).filter(x => x.text).slice(0, 12),
        triggers: listOf(h?.triggers).map(x => ({ cue: str(x?.cue, 50).replace(/^["“']|["”']$/g, ''), effect: str(x?.effect, 180) })).filter(x => x.cue && x.effect).slice(0, 12),
        amnesia: yes(h?.amnesia) ? 'yes' : 'no',
        user_knows: no(h?.user_knows) ? 'no' : 'yes',
    };
}

function normWill(w, i) {
    return {
        id: str(w?.id, 8) || `c${i + 1}`,
        who: names(w?.who ?? w?.subjects).slice(0, 12),
        by: str(w?.by, 60),
        set: listOf(w?.set ?? w?.will).map(x => {
            const kind = WILL_KINDS.find(k => canon(x?.kind).startsWith(k.split(' ')[0])) || 'wants';
            return { kind, text: str(typeof x === 'string' ? x : x?.text, 220) };
        }).filter(x => x.text).slice(0, 10),
        own: str(w?.own ?? w?.untouched, 220),
        resists: yes(w?.resists) ? 'yes' : 'no',
        user_knows: no(w?.user_knows) ? 'no' : 'yes',
    };
}

function normEdit(e, i) {
    const kind = EDIT_KINDS.find(k => canon(e?.kind).startsWith(k)) || (str(e?.target) ? 'unseen' : 'normal');
    return {
        id: str(e?.id, 8) || `p${i + 1}`,
        what: str(e?.what, 220),
        kind,
        target: kind === 'unseen' ? str(e?.target, 60) : '',
        who: names(e?.who).slice(0, 12),
        everyone: yes(e?.everyone),
        except: names(e?.except).slice(0, 12),
        by: str(e?.by, 60),
        user_knows: no(e?.user_knows) ? 'no' : 'yes',
    };
}

/** Ids stay unique when entries are added: a clash or a gap gets the next free number. */
function renumber(list, prefix) {
    const seen = new Set();
    let n = 0;
    for (const x of list) {
        if (!x.id || seen.has(x.id) || !x.id.startsWith(prefix)) { do n++; while (list.some(y => y.id === `${prefix}${n}`) || seen.has(`${prefix}${n}`)); x.id = `${prefix}${n}`; }
        seen.add(x.id);
    }
    return list;
}

export function normalizeBook(raw) {
    const hyp = [];
    for (const h of listOf(raw?.hypnosis).map(normSubject).filter(h => h.who)) if (!hyp.some(x => same(x.who, h.who))) hyp.push(h);
    return {
        hypnosis: hyp.slice(0, 24),
        control: renumber(listOf(raw?.control).map(normWill).filter(w => w.who.length && (w.set.length || w.own)), 'c').slice(0, 24),
        perception: renumber(listOf(raw?.perception).map(normEdit).filter(e => e.what && (e.who.length || e.everyone)), 'p').slice(0, 24),
    };
}

export const isEmptyBook = b => !b || KINDS.every(k => !listOf(b[k]).length);

// ------------------------------------------------------------------ when to update

const WORDS = {
    hypnosis: /%%trance%%|\b(trance\w*|hypno\w*|induc(e|ed|es|ing|tion|tions)\b|deepen\w*|deeper and deeper|suggestion\w*|trigger\w*|pendulum|fractionat\w*|conditioning|post-hypnotic|awaken\w*|wake up|wakes up|snaps? (?:her|his|their|my|your) fingers|count(?:s|ed|ing)? (?:down|back)|go(?:ing|es)? under|went under|sink(?:ing|s)? deeper)/i,
    control: /%%control%%|\b(command(?:s|ed)?|obey\w*|compel\w*|your will|my will|(?:his|her|their) will|bend\w* to|mind control\w*|controll(?:ed|ing)|loyal\w*|devot\w*|from now on|you want to|let(?:s|ting)? go of|releas(?:e|es|ed|ing)|resist\w*|fight(?:s|ing)? (?:it|back|the control)|struggl\w+ against|break(?:s|ing)? free|snap(?:s|ped)? out of|(?:her|his|their|your|my) mind|free(?:d|s)? (?:her|him|them|you))\b/i,
    perception: /\b((?:can|could)(?:'?t|not)? (?:see|hear|perceive|notice)|(?:doesn'?t|don'?t|didn'?t|won'?t) (?:see|hear|notice)|invisible|unseen|unnoticed|perceiv\w*|perception|always been|perfectly normal|completely normal|totally normal|nothing strange|rewrit\w+|(?:edit|chang)(?:ed|es|ing)? (?:her|his|their|your) (?:mind|memory|memories|reality|perception))\b/i,
};

/** True when the new messages give this mode's record something to do. */
export function needsUpdate(kind, book, text) {
    const t = String(text || '');
    if (WORDS[kind]?.test(t)) return true;
    if (kind === 'hypnosis') {
        const b = normalizeBook(book);
        if (b.hypnosis.some(h => h.now !== 'awake')) return true;
        if (b.hypnosis.some(h => h.triggers.some(tr => cueRe(tr.cue).test(t)))) return true;
    }
    return false;
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cueRe = cue => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(cue)}(?=$|[^\\p{L}\\p{N}])`, 'iu');

// ------------------------------------------------------------------ update prompts

const SHARED = (userName) => `Rules for every field:
- Go by what the messages show happening, not by guesses. The card sets the defaults; the messages show what changed.
- user_knows is "no" only when ${userName}, the player, isn't aware of it; once "yes" it stays "yes".
- Copy names exactly as the story writes them.
- Answer with JSON only. If nothing in the new messages changes this record, answer {}.`;

const PROMPTS = {
    hypnosis: userName => `You keep the hypnosis record for an adult roleplay. Hypnosis here is realistic: inductions take patience and skill, depth comes in stages, and repeated sessions make a subject go under faster and deeper.
Stages, lightest to deepest, and how each shows:
- light: relaxed, still aware and able to chat, blinking slowed, time blurring;
- medium: heavy limbs, slumping, answers that come late, soft and literal;
- deep: still, eyes closed or fixed and glassy, a flat voice, little or no response beyond murmured agreement;
- somnambulistic: eyes open, moving and talking and looking normal while completely under, carrying out commands.
A deepener (counting down, "deeper", fractionation) usually takes them a stage further; judge the stage by what the messages show.
For each hypnotized person the record holds:
- by: who hypnotizes them;
- susceptibility: low, average or high (from the card or what the story shows; blank if nothing says);
- now: their stage at the END of the new messages (waking, being snapped out, or the session ending makes it "awake");
- went_under: true only when the new messages show them going into trance from awake;
- suggestions: lasting instructions or changes planted in trance, each written as what it makes the subject do or feel, in plain words about them rather than the hypnotist's own phrasing, with the stage they were in when it was planted, and reinforced: true when the new messages plant it again. A one-off order carried out on the spot is not a suggestion, and neither is an instruction to forget (that is amnesia);
- triggers: a cue (word, phrase, gesture, sound) set to bring on an effect later: cue exactly as given, effect in plain words about the subject;
- amnesia: "yes" when they were told to forget the session;
- user_knows.
Answer with ONLY the people whose record changed, each as their WHOLE current record (copy what still holds, change what the messages changed, leave out what was removed), in this shape:
{"hypnosis":[{"who":"","by":"","susceptibility":"","now":"","went_under":false,"suggestions":[{"text":"","stage":"","reinforced":false}],"triggers":[{"cue":"","effect":""}],"amnesia":"no","user_knows":"yes"}]}
Only people who are actually hypnotized go in the record.
${SHARED(userName)}`,
    control: userName => `You keep the mind control record for an adult roleplay. Mind control here means a controller has taken hold of someone's mind: they set what that person wants, feels, believes or is loyal to, or give a standing command, and the person takes it up as their own wish.
Each entry holds:
- id: keep the id of an entry you change; leave it out for a new one;
- who: the person under control, or several people given the same will;
- by: the controller;
- set: what the controller has set, as a list of {kind, text}, kind one of: wants, feels, believes, loyal to, command. When a new setting conflicts with an older one, keep only the newer. A one-off order carried out on the spot is not worth recording; a standing one ("from now on…") is;
- own: what is still their own (personality, skills, relationships the control left alone), or, when the card or what has happened in play makes controlled people blank drones or zombies, say exactly that;
- resists: "yes" when the card or what has happened in play has this person aware of the control, pushing against it, or only partly under it; otherwise "no". Never "yes" on a guess: only when it has been set up;
- released: true when the control is lifted entirely;
- user_knows.
Answer with ONLY entries that are new or changed, each as its WHOLE current record, in this shape:
{"control":[{"id":"","who":[""],"by":"","set":[{"kind":"","text":""}],"own":"","resists":"no","released":false,"user_knows":"yes"}]}
${SHARED(userName)}`,
    perception: userName => `You keep the altered-perception record for an adult roleplay: edits someone's power has made to what people perceive or take as true. Three kinds:
- unseen: they cannot perceive someone or something (target: who or what);
- normal: something they now treat as ordinary, and always so;
- false: something untrue they now believe as plain fact.
Each edit holds:
- id: keep the id of an edit you change; leave it out for a new one;
- what: the edit in a few plain words, without repeating who has it (for unseen: what they miss, e.g. everything the target says and does);
- kind, and target (only for unseen);
- who: the people who have the edit; or everyone: true with except listing anyone left out;
- by: who made the edit;
- undone: true only when the edit is reversed for everyone who has it. When it is lifted for some of them, keep the edit and take those people out of who (or add them to except);
- user_knows.
Answer with ONLY edits that are new or changed, each WHOLE, in this shape:
{"perception":[{"id":"","what":"","kind":"","target":"","who":[""],"everyone":false,"except":[""],"by":"","undone":false,"user_knows":"yes"}]}
${SHARED(userName)}`,
};

/**
 * Messages for one mode's update. `book` is the whole Mind Book (only this mode's part is shown), `messages` the new
 * messages as [{name, text}], `card` the card text on a mode's first update (else '').
 */
export function buildMindMessages(kind, { book, messages, context = [], userName = 'the player', card = '' }) {
    const b = normalizeBook(book);
    const fmt = list => list.map(m => `${m.name}: ${m.text}`).join('\n\n');
    const parts = [];
    if (card) parts.push(`Character card:\n<<<\n${String(card).slice(0, 5000)}\n>>>`);
    parts.push(`The record so far:\n${JSON.stringify({ [kind]: b[kind] })}`);
    if (context.length) parts.push(`Earlier (already in the record):\n<<<\n${fmt(context)}\n>>>`);
    parts.push(`New messages:\n<<<\n${fmt(messages)}\n>>>`);
    parts.push(`Answer with the changed ${kind === 'perception' ? 'edits' : kind === 'control' ? 'entries' : 'people'} as JSON, or {} if nothing changed.`);
    return [
        { role: 'system', content: PROMPTS[kind](userName) },
        { role: 'user', content: parts.join('\n\n') },
    ];
}

/** The first JSON object in a reply, or null. */
function firstJson(text) {
    const r = String(text || '');
    for (let n = r.indexOf('{'); n >= 0; n = r.indexOf('{', n + 1)) {
        let depth = 0, inStr = false;
        for (let i = n; i < r.length; i++) {
            const ch = r[i];
            if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
            if (ch === '"') inStr = true;
            else if (ch === '{') depth++;
            else if (ch === '}' && --depth === 0) { try { return JSON.parse(r.slice(n, i + 1)); } catch { break; } }
        }
    }
    return null;
}

/**
 * Apply one mode's answer to the book. Returns the new book, or null when the answer can't be read. Counting is
 * done here, never by the model: times under goes up when someone goes under from awake, the deepest stage only
 * ever goes deeper, and a suggestion planted again counts as reinforced.
 */
export function applyMindUpdate(kind, book, answer) {
    const prev = normalizeBook(book);
    const raw = firstJson(answer);
    if (!raw) return /^\s*(\{\s*\}|none|no changes?\.?)\s*$/i.test(String(answer || '')) ? prev : null;
    const items = listOf(raw[kind] ?? (Array.isArray(raw) ? raw : []));
    const next = { ...prev, [kind]: [...prev[kind]] };

    if (kind === 'hypnosis') {
        for (const it of items) {
            const n = normSubject(it);
            if (!n.who) continue;
            const i = next.hypnosis.findIndex(h => same(h.who, n.who));
            const old = i >= 0 ? next.hypnosis[i] : normSubject({ who: n.who });
            const merged = { ...old, ...n, times: old.times, deepest: old.deepest };
            if (!stageOf(it?.now)) merged.now = old.now;   // no stage given: unchanged
            if (!str(it?.by)) merged.by = old.by;
            if (!n.susceptibility) merged.susceptibility = old.susceptibility;
            if (!('suggestions' in (it || {}))) merged.suggestions = old.suggestions;
            if (!('triggers' in (it || {}))) merged.triggers = old.triggers;
            if (old.user_knows === 'yes') merged.user_knows = 'yes';
            if (it?.amnesia === undefined) merged.amnesia = old.amnesia;
            // Going under from awake is one more time under, whether or not the model said so (and a session that
            // went under and woke again within the new messages counts too). Only from awake: local models set
            // went_under on a deepener as well, and deepening is the same session.
            if (old.now === 'awake' && (yes(it?.went_under) || merged.now !== 'awake')) merged.times = old.times + 1;
            // Suggestions keep their history: one planted again is reinforced, and keeps the deeper of its stages.
            merged.suggestions = merged.suggestions.map((s, k) => {
                const was = old.suggestions.find(o => canon(o.text) === canon(s.text));
                const again = yes(listOf(it?.suggestions)[k]?.reinforced);
                const stage = s.stage || was?.stage || (merged.now !== 'awake' ? merged.now : '');
                return { text: s.text, stage: was && rank(was.stage) > rank(stage) ? was.stage : stage, times: (was?.times || 0) + (again || !was ? 1 : 0) || 1 };
            });
            // The deepest stage only goes deeper: where they are now, or where a suggestion was planted.
            for (const st of [merged.now, ...merged.suggestions.map(x => x.stage)]) if (rank(st) > rank(merged.deepest || 'awake')) merged.deepest = st;
            if (merged.deepest && !merged.times) merged.times = 1;
            if (i >= 0) next.hypnosis[i] = merged; else next.hypnosis.push(merged);
        }
    } else {
        const norm = kind === 'control' ? normWill : normEdit;
        for (const it of items) {
            const gone = yes(kind === 'control' ? it?.released : it?.undone);
            const id = str(it?.id, 8);
            let i = id ? next[kind].findIndex(x => x.id === id) : -1;
            if (i < 0 && kind === 'control') {
                // No id: the same controller over any of the same people is the same will.
                const who = names(it?.who ?? it?.subjects).map(canon);
                i = next.control.findIndex(w => same(w.by, it?.by) && w.who.some(x => who.includes(canon(x))));
            }
            if (i < 0 && kind === 'perception') i = next.perception.findIndex(e => canon(e.what) === canon(it?.what));
            if (gone) { if (i >= 0) next[kind].splice(i, 1); continue; }
            const n = norm(it, next[kind].length);
            if (i >= 0) {
                const old = next[kind][i];
                const merged = { ...n, id: old.id };
                if (old.user_knows === 'yes') merged.user_knows = 'yes';
                if (kind === 'control' && !merged.own) merged.own = old.own;
                if (kind === 'control' && it?.resists === undefined) merged.resists = old.resists;
                if (!merged.by) merged.by = old.by;
                next[kind][i] = merged;
            } else next[kind].push({ ...n, id: '' });
        }
    }
    return normalizeBook(next);
}

// ------------------------------------------------------------------ what goes into the prompt

const bare = t => String(t || '').replace(/[\s.;:!?]+$/, '');
const join = list => list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
const isPlayer = (who, userName) => same(who, userName);

/** What a stage allows, from the realistic-hypnosis ladder. */
const STAGE_LINE = {
    light: 'a light trance: relaxed and still aware, time starting to blur, blinking slowed. Simple suggestions take, but only for this session, and most of it will be remembered',
    medium: 'a medium trance: heavy limbs, slow soft answers after a pause, words taken literally. Suggestions hold for hours to days, and only pieces will be remembered',
    deep: 'a deep trance: still, eyes closed or fixed and glassy, a flat voice. Lasting conditioning and complex triggers take hold here, and memories can be changed',
    somnambulistic: 'a somnambulistic trance: eyes open, moving and talking and looking entirely normal while completely under. Near-total control; everything can be forgotten on command, and commands against waking habits are carried out',
};
const LASTS = { light: 'for this session', medium: 'for hours to days', deep: 'lasting', somnambulistic: 'lasting' };
const REMEMBERS = { light: 'remembered', medium: 'half-remembered', deep: 'not remembered in detail', somnambulistic: 'not remembered' };

function subjectLine(h, userName) {
    // Rapid induction works only on a conditioned or highly susceptible subject.
    const conditioned = h.times >= 3 || rank(h.deepest) >= rank('deep') || h.susceptibility === 'high';
    const by = h.by ? ` (hypnotized by ${h.by})` : '';
    const history = h.times ? `Under ${h.times === 1 ? 'once' : h.times === 2 ? 'twice' : `${h.times} times`} so far, deepest ${h.deepest || 'light'}` : 'Never hypnotized before';
    const sus = h.susceptibility === 'high' ? '; highly susceptible, goes under fast and deepens easily'
        : h.susceptibility === 'low' ? '; hard to hypnotize: every step deeper takes longer, and drifts back up easily' : '';
    const state = h.now === 'awake'
        ? (h.times ? `Awake. ${conditioned ? 'A rapid induction works now.' : 'A formal induction still takes a while, and each time under makes the next one quicker.'}`
            : `Awake. A first induction takes patience (a long relaxation, or fixation on one point)${conditioned ? ', though a rapid one can work on someone this susceptible.' : ', and a rapid induction won\'t work yet.'}`)
        : `In ${STAGE_LINE[h.now]}.`;
    const sugg = h.suggestions.map(s => {
        const lasts = s.times >= 3 ? 'lasting, reinforced' : LASTS[s.stage] || 'for now';
        const mem = h.amnesia === 'yes' ? 'not remembered' : REMEMBERS[s.stage] || 'remembered';
        return `${bare(s.text)} (${lasts}; receiving it ${mem})`;
    });
    const trig = h.triggers.map(t => `"${t.cue}" → ${bare(t.effect)}`);
    const out = [`- ${h.who}${by}: ${state} ${history}${sus}.`];
    if (sugg.length) out.push(`  Suggestions, acted on as ${h.who}'s own ideas with ordinary reasons: ${sugg.join('; ')}.`);
    if (trig.length) out.push(`  Triggers, firing exactly on cue without ${h.who} noticing the cue: ${trig.join('; ')}.`);
    if (h.amnesia === 'yes' && h.now === 'awake') out.push(`  ${h.who} was told to forget the sessions and has no memory of them.`);
    if (isPlayer(h.who, userName)) out.push(`  ${h.who} is the player: write what the trance does to ${h.who}'s body and behaviour, and leave ${h.who}'s inner experience to the player.`);
    if (h.user_knows === 'no') out.push(`  ${userName} doesn't know about this: narration shows only what ${userName} could notice.`);
    return out.join('\n');
}

// A card can make controlled people blank drones or zombies; then "still their own" doesn't apply.
const EMPTIED = /^\s*(nothing|none)\b|\b(empty|emptied|blank|drone|zombie|hollow|mindless|no self)\b/i;

function willLine(w, userName) {
    const who = join(w.who);
    const whose = w.who.length > 1 ? 'their' : `${w.who[0]}'s`;
    const set = w.set.map(x => x.kind === 'command' ? `standing command: ${bare(x.text)}` : x.kind === 'loyal to' ? `loyal to ${bare(x.text)}` : `${x.kind} ${bare(x.text)}`);
    const out = [`- ${who}${w.by ? ` (controlled by ${w.by})` : ''}: ${set.join('; ') || 'under control'}.`];
    if (w.own && EMPTIED.test(w.own)) out.push(`  ${w.own}.`.replace(/\.\.$/, '.'));
    else if (w.resists === 'yes') {
        out.push(`  ${w.own ? `Still ${whose} own: ${bare(w.own)}. ` : ''}As it has been set up, ${who} ${w.who.length > 1 ? 'are' : 'is'} aware of the control and ${w.who.length > 1 ? 'push' : 'pushes'} against it; keep that struggle where it was left, neither dropping it nor resolving it on your own.`);
    } else {
        const own = w.own ? `Still ${whose} own: ${w.own}.`.replace(/\.\.$/, '.') : `Everything else about ${who} is still ${whose} own.`;
        out.push(`  ${own} The control is felt as ${whose} own wish and pursued with ${whose} own wits and style; nothing in ${who} strains against it.`);
    }
    if (w.who.some(x => isPlayer(x, userName))) out.push(`  ${userName} is the player: write the changed behaviour, and leave ${userName}'s inner experience to the player.`);
    if (w.user_knows === 'no') out.push(`  ${userName} doesn't know about this: narration shows only what ${userName} could notice.`);
    return out.join('\n');
}

const holders = e => e.everyone ? `Everyone${e.except.length ? ` except ${join(e.except)}` : ''}` : join(e.who);

function editLine(e, userName) {
    const who = holders(e);
    const by = e.by ? ` (edited by ${e.by})` : '';
    let line;
    if (e.kind === 'unseen') {
        const t = e.target || 'it';
        line = `- ${who} can't perceive ${t}${by}: ${bare(e.what)}. They step around ${t} without a thought, hear nothing ${t} says, and give an ordinary cause to anything ${t} does; the gap is never noticed.`;
    }
    else if (e.kind === 'false') line = `- ${who} believe${e.everyone || e.who.length > 1 ? '' : 's'} as plain fact${by}: ${bare(e.what)}. Defended sincerely; there is no seam and no memory of believing otherwise.`;
    else line = `- ${who} take${e.everyone || e.who.length > 1 ? '' : 's'} as ordinary and always so${by}: ${bare(e.what)}. Defended sincerely; people reacting otherwise get reinterpreted, never doubted.`;
    if (e.user_knows === 'no') line += `\n  ${userName} doesn't know about this: narration shows only what ${userName} could notice.`;
    return line;
}

/**
 * The lines for the reply about to be written, no model needed. `latest` is the newest message (normally the
 * player's), `recent` the last couple of messages joined (the scene as it stands).
 */
export function watchLines(book, { latest = '', recent = '', userName = 'the player' } = {}) {
    const b = normalizeBook(book);
    const out = [];
    const here = n => n && cueRe(n).test(recent);
    for (const h of b.hypnosis) for (const t of h.triggers) {
        if (cueRe(t.cue).test(latest)) out.push(`"${t.cue}" was just said. It is ${h.who}'s trigger (${t.effect}): if ${h.who} heard it, it fires now, exactly as set.`);
    }
    for (const w of b.control) {
        const present = w.who.filter(here);
        if (present.length && w.resists !== 'yes' && !(w.own && EMPTIED.test(w.own))) out.push(`${join(present)} ${present.length > 1 ? 'are' : 'is'} in this scene: what ${w.by || 'the controller'} set is simply what ${join(present)} ${present.length > 1 ? 'want' : 'wants'} right now, pursued ${present.length > 1 ? 'in their own ways' : `in ${present[0]}'s own way`}, with nothing pulling against it.`);
    }
    for (const e of b.perception.filter(x => x.kind === 'unseen' && here(x.target))) {
        const blind = e.everyone ? null : e.who.filter(here);
        if (blind && !blind.length) continue;
        const sees = e.everyone ? e.except.filter(here) : [];
        const who = blind ? join(blind) : holders(e);
        const v = verb => (blind ? blind.length === 1 : true) ? `${verb}s` : verb;
        out.push(`${e.target} is in this scene, and ${who} can't perceive ${e.target}. Anything ${e.target} does or says, ${who} ${v('step')} around without noticing; when someone talks to ${e.target}, ${who} ${v('hear')} them talking to nobody and ${v('find')} a reason for it.${sees.length ? ` ${join(sees)} see${sees.length === 1 ? 's' : ''} ${e.target} normally.` : ''}`);
    }
    return out;
}

/** The <mind_book> block, or '' when there's nothing in it. `kinds` limits it to the picked modes. */
export function renderMindBook(book, userName = 'the player', { kinds = KINDS, latest = '', recent = '' } = {}) {
    const b = normalizeBook(book);
    const parts = [];
    if (kinds.includes('hypnosis') && b.hypnosis.length) parts.push('Hypnosis (realistic: patience, stages, repetition):', ...b.hypnosis.map(h => subjectLine(h, userName)));
    if (kinds.includes('control') && b.control.length) parts.push('Mind control:', ...b.control.map(w => willLine(w, userName)));
    if (kinds.includes('perception') && b.perception.length) parts.push('Altered perception:', ...b.perception.map(e => editLine(e, userName)));
    const watch = watchLines({ hypnosis: kinds.includes('hypnosis') ? b.hypnosis : [], control: kinds.includes('control') ? b.control : [], perception: kinds.includes('perception') ? b.perception : [] }, { latest, recent, userName });
    if (!parts.length && !watch.length) return '';
    return ['<mind_book>', 'What mind-changing powers have put into people, as it stands now. Where the chat itself says otherwise, the chat wins.',
        ...parts, ...(watch.length ? ['Right now:', ...watch.map(w => `- ${w}`)] : []), '</mind_book>'].join('\n');
}

// ------------------------------------------------------------------ the trapped self (Mind Control)

// Mind control has no trapped self underneath: no inner scream, no part of them fighting it. Sentences that write one
// are cut, no model needed. Resistance or awareness set up by the card or in play keeps them (resistanceSetUp, and a
// will recorded with resists: yes).
const TRAPPED = new RegExp([
    String.raw`\b(?:trapped|caged|locked|imprisoned|buried)\s+(?:deep\s+)?(?:inside|within|in)\s+(?:her|his|their|your|my)\s+(?:own\s+)?(?:mind|head|body|skull)`,
    String.raw`\b(?:somewhere|deep)\s+(?:deep\s+)?(?:inside|within|down)(?:\s+(?:her|him|them|you))?,?\s+(?:a|some)\s+(?:small|tiny|distant|faint|buried)?\s*(?:part|voice|piece|corner)`,
    String.raw`\ba\s+(?:small|tiny|distant|faint|buried|last)\s+(?:part|voice|piece|corner|spark)\s+of\s+(?:her|him|them|you|his|their|your)(?:\s+(?:mind|self))?\s+(?:screamed|screams|fought|fights|struggled|struggles|protested|protests|resisted|resists|begged|begs|cried|cries|knew|knows|railed|rails|clawed|claws)`,
    String.raw`\b(?:fought|fights|struggled|struggles|strained|strains|pushed|pushes)\s+against\s+the\s+(?:control|compulsion|command|commands|order|orders|pull|grip|hold)`,
    String.raw`\bagainst\s+(?:her|his|their|your|my)\s+(?:own\s+)?will\b`,
    String.raw`\b(?:her|his|their|your|my)\s+body\s+(?:moved|moves|acted|acts)\s+on\s+its\s+own`,
    String.raw`\b(?:screaming|screamed|screams)\s+(?:inside|silently|inwardly)`,
].join('|'), 'i');

export const resistanceSetUp = text => /\b(resists?|resisting|resistance|fight(?:s|ing)? (?:it|back|the control|against)|push(?:es|ing)? (?:back )?against (?:it|the control)|struggl(?:es?|ing) against|trapped (?:inside|in (?:her|his|their) (?:own )?(?:mind|head|body))|inner (?:scream|voice)|partial control|breaks? free|aware (?:of being|that (?:she|he|they) (?:is|are) being) controlled)\b/i.test(String(text || ''));

/** Sentences (exact substrings of `text`) that write a trapped self, for applyCuts. */
export function trappedSelfCuts(text) {
    const out = [];
    const s = String(text || '');
    // Sentences inside narration and speech alike: split on end punctuation, keeping italics markers out of the cut.
    for (const m of s.matchAll(/[^.!?\n*"“”]+[.!?]+/g)) {
        const sentence = m[0].trim();
        if (TRAPPED.test(sentence)) out.push(sentence);
    }
    return out;
}
