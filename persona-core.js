// Host personas: for each body someone else has taken over (Possession, Skinsuit, Hive Mind, Puppetry and the other
// body modes), a short sheet on who that person is in their own life, the way the user's own persona describes them.
// Written once, the first time the Ledger shows the body taken, kept with the chat, and given to the model while the
// body is occupied, so the people around it keep treating it as who it was, and after it's released for as long as that
// person is still in the scene, since the model is playing them again then. It describes the host only: never what
// the one driving the body does, wants or feels (whoever drives a body writes it; the user's bodies stay theirs).
// The sheet goes by the name the Ledger uses for the body; the model writes the three fields only.
// Also the looks that pictures of people in the Ledger and the Mind Book are drawn from.
// No SillyTavern imports, so the tests can load it.

export const PERSONA_FIELDS = ['Look', 'Voice & habits', 'Life'];

// Asked only to describe someone "plainly", models reach for soft, round and full, and the picture comes out heavier
// than anyone wrote them. Where the card and chat are silent, a slim or fit build in concrete words.
const BODY_RULE = 'Unless the card or chat says otherwise, give them a slim or fit build and an attractive face, in concrete words (slim, slender, athletic, toned, lean, tall; an oval or heart-shaped face, high cheekbones). Never call their body or face soft, round, full, plump, chubby, stocky, thick or heavy unless the card or chat does.';

// The look is read at a glance in the Ledger and the Mind Book and goes to the writer with the sheet. Written as a
// sentence it ran long, and details the story never gave read like facts and turned out wrong. Short details instead,
// and a ~ on any the card and chat don't state, so a guess shows as a guess. Clothes stay out: the World notes keep
// what someone has on now, and a picture adds it.
const GLANCE_RULE = `4 to 6 short details separated by " · ": an age range, their build, their hair, then the one or two things people notice first (eyes, skin, glasses, a tattoo, a scar). Each detail is 1 to 4 words. Take them from the card and the chat, including anything they say earlier about this person; put ~ right before any detail they don't state, so it reads as a guess ("~mid 20s"). No clothes. ${BODY_RULE}`;

const PERSONA_SYSTEM = `You write short reference sheets for an adult roleplay. Each sheet describes one person whose body someone else is driving right now (possession, a skinsuit, a hive mind, puppetry and the like), as that person is in their own life, so the story keeps their world consistent.
Write only about who they are. Never write what the one driving their body does, wants, thinks or feels, and never mention the takeover.
Take everything you can from the character card and the chat. For Voice & habits and Life, where they say nothing, invent small, ordinary, specific details that fit, and keep them consistent with everything shown; never write that something isn't mentioned or known. Describe their look plainly, never in sexual terms. They are adults: never describe them as teenagers, minors or high school students, and never put them in a school uniform (no need to say they're adults).
Look is ${GLANCE_RULE}
Voice & habits and Life are one short sentence of about 15 words each: the two or three details that matter most, never a full description. Answer in exactly this form and nothing else:
Look: mid 20s · tall, athletic · black box braids · ~gold nose ring
Voice & habits: how they talk, and one small habit
Life: what they do and who they live with`;

const clip = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n)}…` : String(s || ''));

const said = (body, described) => (described.length ? `Earlier messages that describe ${body}, oldest first:\n${described.map(m => `### ${m.name}\n${clip(m.text, 1200)}`).join('\n\n')}` : '');

/**
 * Messages asking for one host's sheet. `messages` are { name, text }, oldest first; `described` are earlier ones that
 * say how this person looks, which the latest messages often don't.
 */
export function buildPersonaMessages({ body, row = {}, card = '', messages = [], described = [], userName = 'User' }) {
    const facts = [row.pronouns && `pronouns: ${row.pronouns}`, row.how && `taken by: ${row.how}`, row.notes && `right now: ${row.notes}`].filter(Boolean).join('; ');
    const parts = [
        card ? `Character card:\n${clip(card, 3500)}` : '',
        `The player's character is ${userName}.`,
        said(body, described),
        `Recent messages, oldest first:\n${messages.map(m => `### ${m.name}\n${clip(m.text, 1800)}`).join('\n\n')}`,
        `Write the sheet for ${body}${facts ? ` (${facts})` : ''}.`,
    ].filter(Boolean);
    return [{ role: 'system', content: PERSONA_SYSTEM }, { role: 'user', content: parts.join('\n\n') }];
}

/** The sheet as { Look, 'Voice & habits', Life }, or null when fewer than two fields came back. */
/** `source` is the card and chat it was written from: the slim-look guard stands down where they make someone heavier. */
export function parsePersona(text, source = '') {
    const out = {};
    const t = String(text || '').replace(/\*\*/g, '').replace(/^\s*[-•]\s*/gm, '');
    for (const f of PERSONA_FIELDS) {
        const re = new RegExp(`^\\s*${f.replace('&', '(?:&|and)')}\\s*:\\s*(.+?)\\s*$`, 'im');
        const m = t.match(re);
        if (m && m[1].trim()) out[f] = m[1].trim();
    }
    if (Object.keys(out).length < 2) return null;
    // Hosts are adults. A sheet that describes someone as a minor is never kept, injected or drawn. Words only, no
    // numbers, so heights, ages and dates can't set it off.
    if (MINOR.test(Object.values(out).join(' '))) return null;
    if (out.Look) out.Look = glance(slimLook(out.Look, source));
    for (const f of Object.keys(out)) out[f] = capWords(out[f]);
    return out;
}

/** A look as its details, " · " between them and a ~ on a guess, from however the model set them out. */
export function glance(look) {
    let s = String(look || '').replace(/\*\*/g, '').replace(/[.\s]+$/, '').trim();
    if (!/·/.test(s) && /;/.test(s)) s = s.split(';').join(' · ');
    if (!/·/.test(s) && /\s[|•/]\s/.test(s)) s = s.split(/\s[|•/]\s/).join(' · ');
    return s.split('·').map(x => x.trim().replace(/^~\s*/, '~')).filter(x => x && x !== '~').join(' · ');
}

/** A look's details for showing, each with whether it's a guess. An older look written as a sentence is one detail. */
export function glanceParts(look) {
    const s = glance(look);
    if (!s) return [];
    return s.split(' · ').map(x => ({ text: x.replace(/^~/, ''), guess: x.startsWith('~') }));
}

/** A look as the writer and a picture get it: the details as a plain list, guesses included, without the marks. */
export const plainLook = look => glanceParts(look).map(x => x.text).join(', ');

// A sheet goes into the prompt every reply while it matters, so a field that runs long is cut back to about 25 words,
// at a clause break where there is one.
const MAX_FIELD_WORDS = 25;
function capWords(text, max = MAX_FIELD_WORDS) {
    const words = String(text).split(/\s+/);
    if (words.length <= max) return text;
    let cut = words.slice(0, max).join(' ');
    const at = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(';'), cut.lastIndexOf(' and '));
    if (at > cut.length * 0.5) cut = cut.slice(0, at);
    return `${cut.replace(/[\s,;:—–-]+$/, '')}.`;
}

// Only words that can't describe an adult: 18- and 19-year-olds ("teen"), costumes and cosplay ("schoolgirl",
// "school uniform"), and adults' jobs or pasts ("a middle school teacher", "dropped out of high school") never match.
const MINOR = /\b(underage|(?:is|as|still) a minor|middle[- ]schooler|middle[- ]school student|in middle school|junior high student|in junior high|elementary[- ]schooler|in elementary school)\b/i;
/** Whether a model answer describes the host as a minor (so the status can say why nothing was kept). */
export const describesMinor = text => MINOR.test(String(text || ''));

/**
 * The sheet as plain text for the writer and a persona (older sheets' Name and People lines are left out). Each field
 * ends a sentence: the writer gets the sheet on one line, and a look's details carry no period of their own.
 */
export function personaText(sheet) {
    const end = v => (/[.!?]$/.test(v) ? v : `${v}.`);
    return PERSONA_FIELDS.filter(f => sheet?.[f]).map(f => `${f}: ${end(f === 'Look' ? plainLook(sheet[f]) : String(sheet[f]).trim())}`).join('\n');
}

/**
 * A sheet typed in by hand, from its three fields: { sheet, minor }. Fields are kept as typed (no word cap: it's yours);
 * sheet is null when every field is empty. A sheet that describes someone as a minor isn't kept (minor: true).
 */
export function sheetFromFields(fields = {}) {
    const sheet = {};
    for (const f of PERSONA_FIELDS) {
        const v = String(fields[f] ?? '').replace(/\s+/g, ' ').trim();
        if (v) sheet[f] = f === 'Look' ? glance(v) : v;
    }
    if (!Object.keys(sheet).length) return { sheet: null, minor: false };
    if (MINOR.test(Object.values(sheet).join(' '))) return { sheet: null, minor: true };
    return { sheet, minor: false };
}

// ------------------------------------------------------------------ pictures
// A picture of someone in the Ledger or the Mind Book, drawn by SillyTavern's Image Generation however it's set up.
// It's drawn from a look: a host's sheet has one, and anyone else gets one written the same way. The picture's own
// prompt is built from the look and what they have on now (portraitPrompt), or is one you wrote for them.

const LOOK_SYSTEM = `You describe how one person in an adult roleplay looks. Answer with one line: ${GLANCE_RULE}
Describe them plainly, never in sexual terms. They are an adult: never describe them as a teenager, a minor or a high school student (no need to say they're an adult).
Don't start with their name. Answer with the line only, like this:
mid 20s · tall, athletic · black box braids · ~gold nose ring`;

/** Messages asking how one person looks. `messages` are { name, text }, oldest first; `described` as for a sheet. */
export function buildLookMessages({ name, card = '', messages = [], described = [], userName = 'User' }) {
    const parts = [
        card ? `Character card:\n${clip(card, 3500)}` : '',
        `The player's character is ${userName}.`,
        said(name, described),
        messages.length ? `Recent messages, oldest first:\n${messages.map(m => `### ${m.name}\n${clip(m.text, 1800)}`).join('\n\n')}` : '',
        `Describe how ${name} looks.`,
    ].filter(Boolean);
    return [{ role: 'system', content: LOOK_SYSTEM }, { role: 'user', content: parts.join('\n\n') }];
}

/**
 * The look sentence from a model's answer, or null (nothing usable, or it described a minor). A sentence that opens
 * with the person ("June is a woman with…") loses that opening, since the picture prompt names them already.
 */
export function parseLook(text, name = '', source = '') {
    const line = String(text || '').replace(/\*\*/g, '').split('\n').map(x => x.trim()).find(Boolean) || '';
    let look = line.replace(/^(?:look|appearance)\s*:\s*/i, '').replace(/^["“']+|["”']+$/g, '').trim();
    if (name) look = look.replace(new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)?\\s+(?:is|has|looks like|wears)\\s+`, 'i'), '');
    if (!look || MINOR.test(look)) return null;
    return capWords(glance(slimLook(look, source)), 30);
}

// The words that say someone is described in a message: earlier messages with these and the person's name go with a
// look request, since a story says how someone looks once, when they come in, and rarely again.
export const LOOK_WORDS = /\b(hair|eyes?|tall|short|slim|slender|skinny|petite|curvy|athletic|muscular|built|freckle\w*|tattoo\w*|pierc\w*|glasses|skin|beard|stubble|blonde?|brunette|redhead|ginger|ponytail|braids?|curls|bangs|figure|build|scar|lips|cheekbones|in (?:her|his|their) (?:twenties|thirties|forties|fifties)|\d{2}[- ]year[- ]old)\b/i;

/**
 * The picture's prompt, for Image Generation: who it is (a woman or a man by their pronouns), the look's details, what
 * they have on now when the World notes say, and the face centered, so a round avatar shows it.
 */
export function portraitPrompt(look, name, { pronouns = '', wearing = '' } = {}) {
    const clean = s => String(s || '').replace(/[|{}~]/g, ' ').replace(/\s+/g, ' ').trim();
    const who = /^she\b/i.test(pronouns) ? 'a woman' : /^he\b/i.test(pronouns) ? 'a man' : '';
    const bits = [clean(plainLook(look)), wearing ? `wearing ${clean(wearing)}` : ''].filter(Boolean).join(', ');
    return `Close-up portrait of ${clean(name) || 'a person'}${who ? `, ${who}` : ''}${bits ? `, ${bits}` : ''}. Head and shoulders, face centered in the frame, looking straight at the viewer, plain neutral background.`;
}

// Even told not to, a model now and then writes "a soft, round face". Unless the card or the chat makes someone
// heavier, those words come out of a look the model wrote; a look you type yourself is left exactly as it is.
const HEAVY_SOURCE = /\b(?:chubby|plump|fat|heavy[- ]?set|stocky|chunky|pudgy|overweight|full[- ]figured|plus[- ]size|bbw|thick(?:er)?|curvy|big[- ]boned|soft (?:body|belly|tummy|figure|build))\b/i;
const SOFT = 'soft|round(?:ed)?|full|plump|chubby|pudgy|heavy(?:-?set)?|stocky|thick|chunky|curvy|big|solid|sturdy|generous';
const RUN = words => `(?:(?:${words})(?:,?\\s+(?:and\\s+)?|\\s+))+`;
export function slimLook(look, source = '') {
    if (!look || HEAVY_SOURCE.test(source)) return look;
    return String(look)
        .replace(new RegExp(`\\b${RUN(SOFT)}(build|frame|figure|body|physique|shape)\\b`, 'gi'), (m, n) => `slim ${n.toLowerCase()}`)
        .replace(new RegExp(`\\b${RUN('soft|round(?:ed)?|full|plump|chubby|moon')}face\\b`, 'gi'), 'oval face')
        .replace(/\bround[- ]faced\b/gi, 'oval-faced')
        .replace(new RegExp(`\\b${RUN('soft|round(?:ed)?|full|plump|chubby|apple')}cheeks\\b`, 'gi'), 'high cheekbones')
        .replace(/\b(?:soft|round(?:ed)?)\s+(jaw(?:line)?|chin)\b/gi, (m, n) => `defined ${n}`)
        .replace(/\b(?:soft|round(?:ed)?)\s+features\b/gi, 'delicate features')
        .replace(/\bsoft(?:,)?\s+(curves|hips|thighs|arms|belly|stomach|tummy)\b/gi, (m, n) => `slim ${n}`)
        .replace(/\b(?:plump|chubby|pudgy|heavy[- ]?set|stocky|chunky|overweight|full[- ]figured)\b/gi, 'slim')
        .replace(/\b([Aa]) (oval)/g, '$1n $2');
}

/** Store key for a body name. */
export const personaKey = name => String(name || '').trim().toLowerCase();
